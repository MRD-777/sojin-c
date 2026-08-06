// ============================================
// http-shared — helpers shared by the two HTTP instances (DP3 / WEB-S1-003)
//
// We deliberately do NOT merge auth-client and the generic client into one
// axios instance: auth-client must stay "bare" (no Bearer, no refresh-on-401)
// or /auth/refresh would call itself on a 401 → loop. Instead, the only thing
// the two share is the API base URL and the success-envelope unwrapper, lifted
// here so there is a single source of truth. This closes the spirit of
// WEB-S1-003 (de-duplicate) without re-introducing the refresh loop.
// ============================================

/** API base, e.g. http://localhost:4000/api/v1. */
export const API_ROOT =
  `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1`;

/** Unwrap the backend success envelope { success, data, meta } → data. */
export function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}
