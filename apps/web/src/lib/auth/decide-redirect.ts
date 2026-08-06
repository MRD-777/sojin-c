// ============================================
// decide-redirect — pure auth redirect policy (MVT-covered)
//
// All the middleware's routing logic lives here so it can be unit-tested
// without a NextRequest. CRITICAL: there is NO `NODE_ENV` branch — an
// unauthenticated dashboard hit redirects to /login in EVERY environment
// (the old middleware bypassed this in development, which was the bug).
//
// The `hasHint` input is the spoofable `auth_hint` cookie — it only drives
// UX redirects. The real auth boundary is the API's JWT guard; any protected
// API call still 401s without a valid token.
// ============================================

export interface DecideRedirectInput {
  /** request.nextUrl.pathname (locale-prefixed, e.g. "/ar/dashboard"). */
  pathname: string;
  /** Whether the auth_hint cookie is present and "1". */
  hasHint: boolean;
  /** Supported locales (routing.locales). */
  locales: readonly string[];
  /** Fallback locale (routing.defaultLocale). */
  defaultLocale: string;
}

/**
 * Decide where (if anywhere) to redirect.
 * @returns target pathname, or null to continue with the normal response.
 */
export function decideAuthRedirect({
  pathname,
  hasHint,
  locales,
  defaultLocale,
}: DecideRedirectInput): string | null {
  const isAuthPage =
    pathname.includes("/login") || pathname.includes("/register");
  const isDashboard = pathname.includes("/dashboard");

  const seg = pathname.split("/")[1] ?? "";
  const locale = locales.includes(seg) ? seg : defaultLocale;

  // Unauthenticated → cannot see the dashboard. ALL environments.
  if (isDashboard && !hasHint) return `/${locale}/login`;

  // Already "signed in" → keep them out of the auth pages.
  if (isAuthPage && hasHint) return `/${locale}/dashboard`;

  return null;
}
