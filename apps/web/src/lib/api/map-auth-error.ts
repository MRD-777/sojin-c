// ============================================
// map-auth-error — pure error normalizer (MVT-covered)
//
// Turns any thrown axios error into a stable { code, message }. The backend
// already returns a localized (Arabic) `message` in its error envelope
// (apps/api/src/common/filters/global-exception.filter.ts), so per decision
// P5 we surface that message directly instead of maintaining a parallel
// i18n map. The `code` is preserved for special-casing (e.g. lockout).
// ============================================

import type { FailureDisposition } from "./refresh-policy";

/** Shape of the backend error envelope (GlobalExceptionFilter). */
export interface BackendErrorEnvelope {
  // `success` is optional here only because we parse loosely-typed response
  // bodies (Record<string, unknown>); the API always sends `false`.
  success?: false;
  code?: string;
  message?: string;
  requestId?: string;
  errors?: unknown[];
}

export interface AuthError {
  /** Stable backend code, or a synthetic one for transport-level failures. */
  code: string;
  /** Human message — backend's localized message when available. */
  message: string;
  /**
   * HTTP status of the response that produced this error; `undefined` when no
   * response ever came back (transport failure).
   *
   * Carried because normalizing an error is where the status would otherwise
   * DIE: `authClient.refresh()` throws `mapAuthError(e)` (auth-client.ts:78),
   * so by the time the generic client's interceptor sees a failed refresh, the
   * raw AxiosError is gone. Without this field the interceptor cannot tell a
   * 401 (refresh cookie provably dead) from a 429/5xx (we learned nothing) and
   * has to fall back on guessing from `code` — which is how "logged out by a
   * rate limit" gets built.
   */
  status?: number;
  requestId?: string;
  /** Field-level issues from class-validator (when present). */
  errors?: unknown[];
  /**
   * What this failure means for the SESSION — stamped by the generic client's
   * response interceptor (client.ts), never computed here: `mapAuthError` sees
   * one error, while the disposition also depends on retry state.
   *
   * Consumers must treat an ABSENT value as "indeterminate". Only an explicit
   * "terminal" is proof the session is dead, so any unforeseen failure path
   * fails towards *not* navigating — which is what keeps the /dashboard ⇄
   * /login redirect loop closed.
   */
  sessionDisposition?: FailureDisposition;
}

const FALLBACK_NETWORK_MESSAGE = "تعذّر الاتصال بالخادم — تحقق من الاتصال وحاول مجدداً";
const FALLBACK_UNKNOWN_MESSAGE = "حدث خطأ غير متوقع — حاول مجدداً";

interface AxiosLikeError {
  response?: { data?: unknown; status?: number };
  request?: unknown;
  message?: string;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * Normalize an unknown thrown value into an AuthError.
 * - Has a response body with our envelope → use its code + message.
 * - Made a request but got no response (network/CORS/timeout) → NETWORK.
 * - Anything else → UNKNOWN.
 */
export function mapAuthError(error: unknown): AuthError {
  const err = (isObject(error) ? error : {}) as AxiosLikeError;
  const body = err.response?.data;

  // Read once, attach to every branch that HAS a response. The status is a
  // fact about the exchange, independent of whether the body matched our
  // envelope — a 401 behind a gateway's HTML error page is still a 401.
  const status = err.response?.status;

  if (isObject(body) && (body.code !== undefined || body.message !== undefined)) {
    const env = body as BackendErrorEnvelope;
    return {
      code: typeof env.code === "string" ? env.code : "UNKNOWN",
      message:
        typeof env.message === "string" && env.message.length > 0
          ? env.message
          : FALLBACK_UNKNOWN_MESSAGE,
      status,
      requestId: env.requestId,
      errors: env.errors,
    };
  }

  // Request was made but no response came back. `status` stays undefined by
  // definition here — which is exactly what classifyFailure reads as "unknown".
  if (err.request !== undefined && err.response === undefined) {
    return { code: "NETWORK", message: FALLBACK_NETWORK_MESSAGE };
  }

  return { code: "UNKNOWN", message: FALLBACK_UNKNOWN_MESSAGE, status };
}
