// ============================================
// refresh-policy — pure decision: what does a failed request mean? (MVT-covered)
//
// Isolated from the HTTP layer (no axios, no store) so the logic can be
// unit-tested without mocking transport — the same pure-first pattern as
// map-auth-error / decide-redirect (Session S1).
//
// The single rule: retry via /auth/refresh ONLY when the failure is a fresh
// 401 that has not already been retried and is not itself the refresh call.
// The last guard (`isRefreshCall`) is what prevents a refresh → 401 → refresh
// infinite loop (CVE-S1-002 hardening).
//
// ── Why THREE outcomes and not two (Session 2026-08-08) ──
// This layer used to answer one boolean: refresh, or terminal. That is two
// states for a domain that has three:
//
//   proven dead  — the server answered 401 and we have no way to recover it
//   alive        — the request succeeded
//   UNKNOWN      — the server never answered (network down / 5xx / 429)
//
// Collapsing UNKNOWN into "terminal" is what produced the dashboard redirect
// loop: the RouteGuard treated an unreachable API as a dead session and
// navigated to /login, while the middleware still saw an intact `auth_hint`
// cookie and bounced straight back to /dashboard. The two halves disagreed
// about the same fact, and that disagreement IS the loop.
//
// So the rule below is deliberately narrow:
//     ONLY A PROVEN 401 KILLS A SESSION.
// Everything else is `indeterminate` — the caller must neither tear the
// session down nor navigate on it. Note this is also why 403 and 429 are
// indeterminate: "authenticated but forbidden" and "slow down" are both
// statements about a request, not about the session behind it.
// ============================================

export interface RefreshDecisionInput {
  /** HTTP status of the failed response (undefined on network errors). */
  status: number | undefined;
  /** Has this request already been retried once after a refresh? */
  alreadyRetried: boolean;
  /** Is the failing request itself the /auth/refresh call? */
  isRefreshCall: boolean;
}

/**
 * What a failed request tells us about the session behind it.
 *
 *  - "refresh"       → recoverable: attempt ONE silent refresh + retry.
 *  - "terminal"      → the session is provably dead: tear it down.
 *  - "indeterminate" → we learned NOTHING about the session. Do not tear it
 *                      down, and above all do not navigate on it.
 */
export type FailureDisposition = "refresh" | "terminal" | "indeterminate";

/**
 * Classify a failed request. This is the single source of truth for the
 * refresh/teardown decision; `shouldRefresh` is a view over it.
 */
export function classifyFailure({
  status,
  alreadyRetried,
  isRefreshCall,
}: RefreshDecisionInput): FailureDisposition {
  // Anything that is not a 401 — including `undefined` (network error), 5xx,
  // 429 and 403 — leaves the session's fate unknown.
  if (status !== 401) return "indeterminate";

  // A 401 we cannot recover from: the retry is already spent, or the refresh
  // call itself came back 401. Either way the credential is genuinely dead.
  if (alreadyRetried || isRefreshCall) return "terminal";

  return "refresh";
}

/**
 * True ⇒ attempt a single silent refresh + retry.
 *
 * Kept as the narrow boolean view over `classifyFailure` so its existing specs
 * keep guarding the exact same behaviour — they now double as a regression
 * harness over the three-state core.
 */
export function shouldRefresh(input: RefreshDecisionInput): boolean {
  return classifyFailure(input) === "refresh";
}
