// ============================================
// client — generic HTTP layer for PROTECTED endpoints (WEB-S1-003)
//
// Unlike auth-client (bare, /auth/* only), this instance carries two
// interceptors:
//   1. request  — attach `Authorization: Bearer <accessToken>` read from the
//                 in-memory auth store at send time (vanilla getState, so it
//                 is safe to call from outside React).
//   2. response — on a fresh 401, attempt ONE silent refresh + retry; on a
//                 terminal 401 (retry also failed, or the refresh failed)
//                 wipe the session (store.clear + clearAuthHint) and reject.
//
// Refresh ownership (DP1): the interceptor owns terminal-session teardown
// because it sits on the deepest event (final refresh failure — rule #4). The
// RouteGuard (Phase 2) owns only the redirect.
//
// Two failure modes are designed out explicitly:
//   • refresh stampede — N parallel 401s would fire N /auth/refresh calls. A
//     single shared in-flight promise makes them all await one refresh.
//   • refresh loop — /auth/refresh runs on auth-client's BARE instance, which
//     has no response interceptor, so a 401 from refresh itself can never
//     re-enter this logic. (refresh-policy's isRefreshCall guard documents the
//     same invariant for the pure layer.)
// ============================================
import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { useAuthStore } from "@/store/use-auth-store";
import { clearAuthHint } from "@/lib/auth/auth-hint";
import { authClient } from "./auth-client";
import { mapAuthError } from "./map-auth-error";
import { shouldRefresh } from "./refresh-policy";
import { API_ROOT } from "./http-shared";

/** Per-request flag marking the single post-refresh retry. */
interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export const client: AxiosInstance = axios.create({
  baseURL: API_ROOT,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// ── 1. Request: attach the Bearer token if we have one ──
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Shared in-flight refresh (singleton) — kills the stampede ──
let refreshInFlight: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = authClient
      .refresh()
      .then((res) => {
        useAuthStore.getState().setAccessToken(res.accessToken);
        return res.accessToken;
      })
      .finally(() => {
        // Clear regardless of outcome so the next 401 can refresh again.
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/** Terminal teardown — interceptor-owned (DP1, rule #4). */
function terminateSession(): void {
  useAuthStore.getState().clear();
  clearAuthHint();
}

// ── 2. Response: refresh-on-401 single retry, else terminal ──
client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    const willRefresh = shouldRefresh({
      status,
      alreadyRetried: config?._retry ?? false,
      // Refresh runs on the bare auth-client instance; a request reaching THIS
      // interceptor is never the refresh call itself.
      isRefreshCall: false,
    });

    if (willRefresh && config) {
      try {
        const token = await refreshAccessToken();
        config._retry = true;
        config.headers.Authorization = `Bearer ${token}`;
        return client(config); // single retry
      } catch (refreshError) {
        // The refresh itself failed → terminal.
        terminateSession();
        return Promise.reject(mapAuthError(refreshError));
      }
    }

    // Terminal 401 (retry already consumed) → wipe the session.
    if (status === 401) {
      terminateSession();
    }
    return Promise.reject(mapAuthError(error));
  },
);
