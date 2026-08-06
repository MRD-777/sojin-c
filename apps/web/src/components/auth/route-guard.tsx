"use client";
// ============================================
// RouteGuard — client-side session boundary for the dashboard (CVE-S1-002)
//
// The auth_hint cookie is spoofable and only drives middleware UX redirects;
// it is NOT an auth boundary. This guard adds the real client-side check: it
// calls /users/me through the generic client and only renders protected
// children once a genuine session is confirmed.
//
// Responsibility split (DP1): the client's response interceptor owns terminal
// session teardown (store.clear + clearAuthHint) because it sits on the
// deepest event (final refresh failure). This guard owns ONLY the redirect —
// a UI concern needing the i18n router, which is unavailable inside the
// interceptor (outside React). So by the time we see isError here, the session
// has already been wiped; we just navigate away.
// ============================================
import { useEffect, type ReactNode } from "react";
import { useRouter } from "@/i18n/routing";
import { useMe } from "@/lib/hooks/use-me";

export function RouteGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data, isLoading, isError } = useMe();

  // Redirect via effect (not during render) to avoid React's "update during
  // render" warning. replace (not push) keeps the protected route out of
  // history, so Back can't land the user on the guarded dashboard.
  useEffect(() => {
    if (isError) router.replace("/login");
  }, [isError, router]);

  if (isLoading) {
    return <RouteGuardLoading />;
  }

  // Error or no data → a redirect is in flight; render nothing so protected
  // content never flashes.
  if (isError || !data) {
    return null;
  }

  return <>{children}</>;
}

/** Minimal full-screen shell shown while the session is being verified. */
function RouteGuardLoading() {
  return (
    <div
      className="flex h-screen items-center justify-center bg-[#fcfcfc] dark:bg-[#050505]"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading…</span>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-black/20 border-t-black/70 dark:border-white/20 dark:border-t-white/70" />
    </div>
  );
}
