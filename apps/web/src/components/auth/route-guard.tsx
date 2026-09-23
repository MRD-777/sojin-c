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
// interceptor (outside React).
//
// ── Why the redirect needs PROOF, not just `isError` (2026-08-08) ──
// This guard used to redirect on any useMe error. An unreachable API is an
// error, but not a dead session — and the middleware, still seeing an intact
// `auth_hint`, bounced /login straight back to /dashboard. Guard and
// middleware disagreed about the same unknown, and the app ping-ponged
// between the two routes for minutes.
//
// So we navigate ONLY on an explicit "terminal" verdict from the interceptor.
// An absent or "indeterminate" disposition renders a retry surface instead:
// the session is untouched, nothing navigates, and the loop cannot form.
// ============================================
import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { useMe } from "@/lib/hooks/use-me";
import { clearAuthHint } from "@/lib/auth/auth-hint";
import type { AuthError } from "@/lib/api/map-auth-error";

/**
 * Proof that the session is dead. Anything else — a missing disposition, a
 * network failure, a 5xx — is NOT proof, and must not move the user.
 */
function isSessionProvenDead(error: unknown): boolean {
  return (error as AuthError | null)?.sessionDisposition === "terminal";
}

export function RouteGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch, isFetching } = useMe();

  const sessionIsDead = isError && isSessionProvenDead(error);

  // Redirect via effect (not during render) to avoid React's "update during
  // render" warning. replace (not push) keeps the protected route out of
  // history, so Back can't land the user on the guarded dashboard.
  useEffect(() => {
    if (sessionIsDead) router.replace("/login");
  }, [sessionIsDead, router]);

  if (isLoading) {
    return <RouteGuardLoading />;
  }

  // Proven dead → a redirect is in flight; render nothing so protected
  // content never flashes.
  if (sessionIsDead) {
    return null;
  }

  // Errored, but the session's fate is unknown: stay put and let the user
  // retry. Rendering `null` here would be a permanent blank screen.
  if (isError) {
    return (
      <SessionUnavailable
        onRetry={() => void refetch()}
        isRetrying={isFetching}
        onSignIn={() => {
          // The user has decided the session is over — an unambiguous signal we
          // could never infer ourselves. Clearing the hint first is what stops
          // the middleware bouncing them back here from /login.
          clearAuthHint();
          router.replace("/login");
        }}
      />
    );
  }

  if (!data) {
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

/**
 * Shown when we could not verify the session AND could not disprove it —
 * typically an unreachable or erroring API. Offers the two honest options:
 * try again, or end the session deliberately.
 */
function SessionUnavailable({
  onRetry,
  onSignIn,
  isRetrying,
}: {
  onRetry: () => void;
  onSignIn: () => void;
  isRetrying: boolean;
}) {
  const t = useTranslations("Common.sessionUnavailable");

  return (
    <div
      className="flex h-screen flex-col items-center justify-center gap-6 bg-[#fcfcfc] px-6 text-center dark:bg-[#050505]"
      role="alert"
    >
      <div className="max-w-md space-y-2">
        <h1 className="text-lg font-semibold text-[#111] dark:text-white">
          {t("title")}
        </h1>
        <p className="text-sm leading-relaxed text-[#666] dark:text-[#999]">
          {t("description")}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="rounded-md bg-[#111] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black/90 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-white/90"
        >
          {isRetrying ? t("retrying") : t("retry")}
        </button>
        <button
          type="button"
          onClick={onSignIn}
          className="rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-[#111] transition-colors hover:bg-black/5 dark:border-white/10 dark:text-white dark:hover:bg-white/5"
        >
          {t("signIn")}
        </button>
      </div>
    </div>
  );
}
