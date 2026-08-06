// ============================================
// auth-hint — non-sensitive UX redirect cookie (web origin)
//
// The real auth boundary is the API's JWT guard; the access token is in
// memory and the refresh cookie is httpOnly on the API origin (port 4000),
// invisible to the Next middleware on the web origin (port 3000). So we set
// a tiny, readable `auth_hint=1` cookie on the web origin purely so the
// middleware can decide redirects (INTEGRATION_PLAN §2.4, decision P4).
//
// ⚠️ This cookie is spoofable. It only drives UX redirects — never trust it
// for authorization. Any protected API call still 401s without a valid JWT.
// ============================================

export const AUTH_HINT_NAME = "auth_hint";
/** 7 days — mirrors the refresh cookie max-age (auth.controller.ts:36). */
export const AUTH_HINT_MAX_AGE_SECONDS = 604800;

/** Build the Set-Cookie string (pure — kept separate for testability). */
export function buildAuthHintCookie(secure: boolean): string {
  const base = `${AUTH_HINT_NAME}=1; path=/; samesite=lax; max-age=${AUTH_HINT_MAX_AGE_SECONDS}`;
  return secure ? `${base}; secure` : base;
}

function isSecureContext(): boolean {
  // Secure flag only in production over HTTPS — browsers reject Secure
  // cookies on http://localhost.
  return process.env.NODE_ENV === "production";
}

/** Set the hint after a successful login/register. No-op on the server. */
export function setAuthHint(): void {
  if (typeof document === "undefined") return;
  document.cookie = buildAuthHintCookie(isSecureContext());
}

/** Expire the hint on logout / terminal refresh failure. No-op on server. */
export function clearAuthHint(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_HINT_NAME}=; path=/; samesite=lax; max-age=0`;
}
