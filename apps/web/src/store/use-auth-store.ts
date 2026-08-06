// ============================================
// Auth Store — in-memory session (NON-persist by design)
//
// Security (INTEGRATION_PLAN §2.4): the access token lives ONLY in memory.
// We deliberately do NOT use zustand/persist here — persisting to
// localStorage would expose the token to any XSS. The refresh token is an
// httpOnly cookie owned by the API origin; the browser replays it on
// /auth/refresh automatically. A lost in-memory token is recovered by a
// silent refresh, so memory-only is both safe and sufficient.
// ============================================
import { create } from "zustand";

/** Mirrors AuthService.LoginResult.user (apps/api/src/modules/auth/auth.service.ts). */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  specialty: string | null;
  avatar: string | null;
  preferredLanguage: string;
  company: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
  };
}

/**
 * Transient registration data carried between the two-step register UI.
 * Held in memory only and wiped right after the atomic /auth/register call
 * (so the password never lingers). Lost on hard refresh — guarded by a
 * redirect back to /register.
 */
export interface PendingRegistration {
  firstName: string;
  lastName: string;
  phone?: string;
  email: string;
  password: string;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  pendingRegistration: PendingRegistration | null;

  setSession: (session: { accessToken: string; user: AuthUser }) => void;
  setAccessToken: (accessToken: string) => void;
  setUser: (user: AuthUser) => void;
  setPendingRegistration: (pending: PendingRegistration) => void;
  clearPendingRegistration: () => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  pendingRegistration: null,

  // Establishing a session also wipes any half-finished registration: an
  // abandoned pendingRegistration carries a plaintext password, and it must
  // never outlive the moment a (possibly different) account signs in. Bound
  // to the deepest primary action so it covers BOTH login and register
  // auto-login paths (CVE-S1-001).
  setSession: ({ accessToken, user }) =>
    set({ accessToken, user, pendingRegistration: null }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setPendingRegistration: (pendingRegistration) => set({ pendingRegistration }),
  clearPendingRegistration: () => set({ pendingRegistration: null }),

  // Full wipe on logout / terminal refresh failure.
  clear: () =>
    set({ accessToken: null, user: null, pendingRegistration: null }),
}));
