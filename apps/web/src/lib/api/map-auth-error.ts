// ============================================
// map-auth-error — pure error normalizer (MVT-covered)
//
// Turns any thrown axios error into a stable { code, message }. The backend
// already returns a localized (Arabic) `message` in its error envelope
// (apps/api/src/common/filters/global-exception.filter.ts), so per decision
// P5 we surface that message directly instead of maintaining a parallel
// i18n map. The `code` is preserved for special-casing (e.g. lockout).
// ============================================

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
  requestId?: string;
  /** Field-level issues from class-validator (when present). */
  errors?: unknown[];
}

const FALLBACK_NETWORK_MESSAGE = "تعذّر الاتصال بالخادم — تحقق من الاتصال وحاول مجدداً";
const FALLBACK_UNKNOWN_MESSAGE = "حدث خطأ غير متوقع — حاول مجدداً";

interface AxiosLikeError {
  response?: { data?: unknown };
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

  if (isObject(body) && (body.code !== undefined || body.message !== undefined)) {
    const env = body as BackendErrorEnvelope;
    return {
      code: typeof env.code === "string" ? env.code : "UNKNOWN",
      message:
        typeof env.message === "string" && env.message.length > 0
          ? env.message
          : FALLBACK_UNKNOWN_MESSAGE,
      requestId: env.requestId,
      errors: env.errors,
    };
  }

  // Request was made but no response came back.
  if (err.request !== undefined && err.response === undefined) {
    return { code: "NETWORK", message: FALLBACK_NETWORK_MESSAGE };
  }

  return { code: "UNKNOWN", message: FALLBACK_UNKNOWN_MESSAGE };
}
