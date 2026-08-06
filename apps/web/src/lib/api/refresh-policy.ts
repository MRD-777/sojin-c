// ============================================
// refresh-policy — pure decision: "do we refresh after a 401?" (MVT-covered)
//
// Isolated from the HTTP layer (no axios, no store) so the refresh-on-401
// logic can be unit-tested without mocking transport — the same pure-first
// pattern as map-auth-error / decide-redirect (Session S1).
//
// The single rule: retry via /auth/refresh ONLY when the failure is a fresh
// 401 that has not already been retried and is not itself the refresh call.
// The last guard (`isRefreshCall`) is what prevents a refresh → 401 → refresh
// infinite loop (CVE-S1-002 hardening).
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
 * True ⇒ attempt a single silent refresh + retry. False ⇒ terminal: the
 * caller must clear the session.
 */
export function shouldRefresh({
  status,
  alreadyRetried,
  isRefreshCall,
}: RefreshDecisionInput): boolean {
  return status === 401 && !alreadyRetried && !isRefreshCall;
}
