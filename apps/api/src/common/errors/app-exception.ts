// ============================================
// AppException hierarchy (skill 06).
//
// Three tiers — each maps to a default HTTP status and a logging level:
//
//   ValidationException → 400 (or caller-specified 4xx)
//     User input is invalid. Recovered by the user fixing their input.
//     Log level: debug (no alert).
//
//   BusinessException   → caller-specified 4xx (default 422)
//     Input was technically valid but a business rule rejected it.
//     Examples: 24h lock window expired, state transition not allowed,
//     duplicate update for the day.
//     Log level: info/warn (visibility only).
//
//   SystemException     → 500
//     Infrastructure failure or unhandled bug. The user message is
//     INTENTIONALLY generic ("حدث خطأ في النظام") — the devMessage stays
//     server-side. Triggers alerting in production.
//
// All three carry:
//   - code:      stable identifier for the frontend to switch on
//   - userMessage: human, localized, safe to show
//   - devMessage:  English, with context — server-only
//   - context:   arbitrary structured fields for the audit/log line
//   - cause:     original error if wrapping
// ============================================
import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from './error-codes';

export interface AppErrorMeta {
  code: ErrorCode;
  /** Arabic, localized, safe to show in UI. */
  userMessage: string;
  /** English, with technical context. Never leaks to client. */
  devMessage: string;
  context?: Record<string, unknown>;
  cause?: unknown;
  /** Override the default HTTP status for this exception class. */
  status?: HttpStatus;
}

/**
 * Base class — never throw this directly; use one of the three subclasses.
 * Exported so consumers can `instanceof`-check in their own handlers.
 */
export class AppException extends HttpException {
  readonly code: ErrorCode;
  readonly devMessage: string;
  readonly context: Record<string, unknown>;
  readonly originalCause: unknown;

  constructor(defaultStatus: HttpStatus, meta: AppErrorMeta) {
    const status = meta.status ?? defaultStatus;
    super(
      { success: false, code: meta.code, message: meta.userMessage },
      status,
    );
    this.code = meta.code;
    this.devMessage = meta.devMessage;
    this.context = meta.context ?? {};
    this.originalCause = meta.cause;
  }
}

export class ValidationException extends AppException {
  constructor(meta: AppErrorMeta) {
    super(HttpStatus.BAD_REQUEST, meta);
  }
}

export class BusinessException extends AppException {
  constructor(meta: AppErrorMeta) {
    super(HttpStatus.UNPROCESSABLE_ENTITY, meta);
  }
}

export class SystemException extends AppException {
  constructor(meta: AppErrorMeta) {
    // The user message is ALWAYS replaced with a generic one — devMessage
    // stays in the logs only. This guards against accidentally leaking
    // SQL/stack details to clients via a hand-written userMessage.
    super(HttpStatus.INTERNAL_SERVER_ERROR, {
      ...meta,
      userMessage: 'حدث خطأ في النظام — تم إبلاغ الفريق التقني',
    });
  }
}
