// ============================================
// auth-client — minimal, auth-scoped HTTP layer
//
// Deliberately separate from the future generic API client (Session S2):
// it carries NO refresh-on-401 interceptor. Its only jobs are to talk to
// /api/v1/auth/* (+ /users/me), unwrap the success envelope, and normalize
// errors via mapAuthError.
//
// Cross-origin cookie note: `withCredentials: true` lets the browser store
// and replay the httpOnly refresh_token cookie set by the API origin
// (apps/api/src/modules/auth/auth.controller.ts). CORS is configured with
// credentials=true (apps/api/src/common/config/cors.config.ts).
// ============================================
import axios, { type AxiosInstance } from "axios";
import { mapAuthError } from "./map-auth-error";
import { API_ROOT, unwrap } from "./http-shared";
import type { AuthUser } from "@/store/use-auth-store";

/** Bare instance — no auth interceptors (that's S2's generic client). */
const http: AxiosInstance = axios.create({
  baseURL: API_ROOT,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// ── Response shapes (mirror auth.controller.ts / auth.service.ts) ──
export interface LoginResponse {
  accessToken: string;
  expiresAt?: number;
  user: AuthUser;
}

export interface RegisterResponse {
  company: { id: string; name: string; slug: string };
  user: { id: string; name: string; email: string; role: string };
}

export interface RefreshResponse {
  accessToken: string;
  expiresAt?: number;
}

/** POST /auth/register — body must match RegisterCompanyDto exactly. */
export interface RegisterPayload {
  companyName: string;
  companyEmail: string;
  companyPhone?: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export const authClient = {
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const res = await http.post("/auth/login", { email, password });
      return unwrap<LoginResponse>(res.data);
    } catch (e) {
      throw mapAuthError(e);
    }
  },

  async register(payload: RegisterPayload): Promise<RegisterResponse> {
    try {
      const res = await http.post("/auth/register", payload);
      return unwrap<RegisterResponse>(res.data);
    } catch (e) {
      throw mapAuthError(e);
    }
  },

  /** Reads the refresh cookie automatically (withCredentials). */
  async refresh(): Promise<RefreshResponse> {
    try {
      const res = await http.post("/auth/refresh", {});
      return unwrap<RefreshResponse>(res.data);
    } catch (e) {
      throw mapAuthError(e);
    }
  },

  /** Best-effort: clears the refresh cookie server-side. */
  async logout(accessToken: string | null): Promise<void> {
    try {
      await http.post(
        "/auth/logout",
        {},
        accessToken
          ? { headers: { Authorization: `Bearer ${accessToken}` } }
          : undefined,
      );
    } catch (e) {
      // Logout must never block the client; cookie clear + store wipe happen
      // regardless. Swallow but normalize for callers that want to log it.
      throw mapAuthError(e);
    }
  },

  async me(accessToken: string): Promise<AuthUser> {
    try {
      const res = await http.get("/users/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return unwrap<AuthUser>(res.data);
    } catch (e) {
      throw mapAuthError(e);
    }
  },
};
