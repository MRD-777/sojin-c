"use client";
// ============================================
// use-auth — lightweight client auth hooks (Session S1, decision P2)
//
// Thin wrappers over `authClient` + `useAuthStore`. No React Query here on
// purpose: these are self-contained mutations driven by local useState
// (isPending/error). React-Query-based mutations are deferred to S2.
//
// Each hook owns the side-effects of its flow so pages stay declarative:
//   useLogin    → login            → setSession + setAuthHint
//   useRegister → register → login → setSession + setAuthHint + clear pending
//   useLogout   → logout (best-effort) → store.clear + clearAuthHint
// ============================================
import { useCallback, useState } from "react";
import { authClient, type RegisterPayload } from "@/lib/api/auth-client";
import { useAuthStore } from "@/store/use-auth-store";
import { setAuthHint, clearAuthHint } from "@/lib/auth/auth-hint";
import type { AuthError } from "@/lib/api/map-auth-error";

interface AsyncState {
  isPending: boolean;
  /** Normalized backend/transport error for message display (P5). null when idle/ok. */
  error: AuthError | null;
}

const IDLE: AsyncState = { isPending: false, error: null };

/** Sign in with credentials. Returns true on success. */
export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  const [state, setState] = useState<AsyncState>(IDLE);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setState({ isPending: true, error: null });
      try {
        const res = await authClient.login(email, password);
        setSession({ accessToken: res.accessToken, user: res.user });
        setAuthHint();
        setState(IDLE);
        return true;
      } catch (e) {
        setState({ isPending: false, error: e as AuthError });
        return false;
      }
    },
    [setSession],
  );

  return { login, ...state };
}

/**
 * Outcome of the register flow — pages branch on this:
 *  - "success"          → account created + signed in → /dashboard
 *  - "autologin-failed" → account EXISTS but auto-login failed → /login (P2)
 *  - "register-failed"  → nothing created → stay on the form, show error
 */
export type RegisterOutcome = "success" | "autologin-failed" | "register-failed";

/**
 * Atomic register: POST /auth/register (returns no tokens — auth.service.ts),
 * then auto-login with the same credentials (P2). The pending registration is
 * cleared the moment the account exists, so a retry can never double-create.
 */
export function useRegister() {
  const setSession = useAuthStore((s) => s.setSession);
  const clearPendingRegistration = useAuthStore((s) => s.clearPendingRegistration);
  const [state, setState] = useState<AsyncState>(IDLE);

  const register = useCallback(
    async (payload: RegisterPayload): Promise<RegisterOutcome> => {
      setState({ isPending: true, error: null });

      // Step 1 — create the company + admin atomically on the backend.
      try {
        await authClient.register(payload);
      } catch (e) {
        setState({ isPending: false, error: e as AuthError });
        return "register-failed";
      }

      // Account now exists → drop the in-memory pending creds regardless of
      // what auto-login does next (prevents double-register on resubmit).
      clearPendingRegistration();

      // Step 2 — auto-login (P2). The account is already created, so a failure
      // here is recoverable by the user signing in manually.
      try {
        const res = await authClient.login(payload.adminEmail, payload.adminPassword);
        setSession({ accessToken: res.accessToken, user: res.user });
        setAuthHint();
        setState(IDLE);
        return "success";
      } catch (e) {
        setState({ isPending: false, error: e as AuthError });
        return "autologin-failed";
      }
    },
    [setSession, clearPendingRegistration],
  );

  return { register, ...state };
}

/**
 * Best-effort logout: tells the backend to clear the refresh cookie, then
 * wipes local session no matter what. A network/server failure must never
 * trap the user in a signed-in shell.
 */
export function useLogout() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const clear = useAuthStore((s) => s.clear);
  const [isPending, setIsPending] = useState(false);

  const logout = useCallback(async (): Promise<void> => {
    setIsPending(true);
    try {
      await authClient.logout(accessToken);
    } catch {
      // Swallow: local wipe below is the source of truth for the UI.
    } finally {
      clear();
      clearAuthHint();
      setIsPending(false);
    }
  }, [accessToken, clear]);

  return { logout, isPending };
}
