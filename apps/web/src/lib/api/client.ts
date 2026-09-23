// ============================================
// client — generic HTTP layer for PROTECTED endpoints (WEB-S1-003)
//
// Unlike auth-client (bare, /auth/* only), this instance carries two
// interceptors:
//   1. request  — attach `Authorization: Bearer <accessToken>` read from the
//                 in-memory auth store at send time (vanilla getState, so it
//                 is safe to call from outside React).
//   2. response — classify the failure (refresh-policy) and act on it:
//                 "refresh"       → ONE silent refresh + retry
//                 "terminal"      → wipe the session (store.clear + clearAuthHint)
//                 "indeterminate" → reject and CHANGE NOTHING
//
// The third case is load-bearing: an unreachable API (or a 5xx/429/403) tells
// us nothing about whether the session is still valid. Treating it as terminal
// signs users out on every dev-server restart; treating it as terminal *only
// in the guard* (redirect) while leaving `auth_hint` intact produced the
// /dashboard ⇄ /login redirect loop. Both halves now agree: unknown means
// unknown, and every rejection is stamped with `sessionDisposition` so the
// RouteGuard reads the same verdict instead of guessing from `isError`.
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
import { mapAuthError, type AuthError } from "./map-auth-error";
import { classifyFailure, type FailureDisposition } from "./refresh-policy";
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

/**
 * Normalize a failure AND stamp what it means for the session, so consumers
 * (RouteGuard) never have to re-derive it from status codes they can't see.
 */
function rejectWith(error: unknown, disposition: FailureDisposition): Promise<never> {
  const mapped: AuthError = { ...mapAuthError(error), sessionDisposition: disposition };
  return Promise.reject(mapped);
}

/**
 * Same, for an error that is ALREADY normalized (everything thrown by
 * authClient — auth-client.ts:78).
 *
 * Why this exists instead of reusing `rejectWith`: mapAuthError over an
 * AuthError finds neither `.response` nor `.request` and falls through to
 * `{ code: "UNKNOWN" }` — silently erasing the real code and message. Mapping
 * is not idempotent, so the caller (which knows whether its input was mapped)
 * has to pick. Guessing the shape here instead would put a heuristic inside an
 * auth-critical path; the type is the contract.
 */
function rejectMapped(mapped: AuthError, disposition: FailureDisposition): Promise<never> {
  return Promise.reject({ ...mapped, sessionDisposition: disposition });
}

// ── 2. Response: refresh / terminal / indeterminate ──
client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;

    const disposition = classifyFailure({
      status: error.response?.status,
      alreadyRetried: config?._retry ?? false,
      // Refresh runs on the bare auth-client instance; a request reaching THIS
      // interceptor is never the refresh call itself.
      isRefreshCall: false,
    });

    if (disposition === "refresh") {
      // No config ⇒ nothing to replay. We never got to test the session, so
      // this is unknown — NOT a reason to sign anyone out.
      if (!config) return rejectWith(error, "indeterminate");

      try {
        const token = await refreshAccessToken();
        config._retry = true;
        config.headers.Authorization = `Bearer ${token}`;
        return client(config); // single retry
      } catch (refreshError) {
        // The refresh failed — WHY decides the session's fate, and it is the
        // SAME question `classifyFailure` already answers. `isRefreshCall: true`
        // is the flag that exists for exactly this moment:
        //   401                    → terminal      (the refresh cookie is dead)
        //   429 / 5xx / no response→ indeterminate (we learned nothing)
        //
        // This used to be a local `code === "NETWORK"` boolean — two states for
        // the three-state domain the rest of this file exists to represent, so
        // a rate-limited refresh (auth.controller.ts throttles it at 30/min)
        // signed the user out. Reusing the pure rule keeps ONE verdict in the
        // codebase instead of a second, weaker copy of it.
        //
        // The status survives the trip because mapAuthError now carries it
        // (map-auth-error.ts) — auth-client itself is untouched.
        const mapped: AuthError =
          (refreshError as AuthError | null) ?? mapAuthError(refreshError);

        const disposition = classifyFailure({
          status: mapped.status,
          alreadyRetried: false,
          isRefreshCall: true,
        });

        if (disposition === "terminal") terminateSession();

        return rejectMapped(mapped, disposition);
      }
    }

    // Proven-dead 401 (the single retry is already spent) → wipe the session.
    if (disposition === "terminal") {
      terminateSession();
    }

    // "indeterminate" falls through with NO teardown: the session survives an
    // unreachable or erroring API.
    return rejectWith(error, disposition);
  },
);
