// ============================================
// Global Exception Filter
//
// Three-tier handling:
//   1. AppException (our own hierarchy) — log at appropriate level, return
//      the canonical envelope { success: false, code, message, requestId }.
//   2. HttpException (other Nest exceptions, e.g. ValidationPipe errors) —
//      preserve status + extract a clean user message.
//   3. Anything else — log at ERROR with full stack, return generic 500
//      with the requestId so the user can reference it in a bug report.
//
// All responses include:
//   - code: stable identifier for the frontend
//   - message: localized human message
//   - requestId: ties the response to server logs
//   - timestamp: ISO 8601
// ============================================
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  AppException,
  ErrorCodes,
  SystemException,
  ValidationException,
} from '../errors';
import { RequestContext } from '../context/request-context';

interface ErrorEnvelope {
  success: false;
  code: string;
  message: string;
  requestId?: string;
  errors?: unknown[];
  path?: string;
  timestamp: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = RequestContext.requestId();

    if (exception instanceof AppException) {
      this.handleAppException(exception, request, response, requestId);
      return;
    }

    if (exception instanceof HttpException) {
      this.handleHttpException(exception, request, response, requestId);
      return;
    }

    this.handleUnknown(exception, request, response, requestId);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  private handleAppException(
    exception: AppException,
    request: Request,
    response: Response,
    requestId: string | undefined,
  ): void {
    const status = exception.getStatus();
    const userId = (request as Request & { user?: { userId?: string } }).user?.userId;
    const companyId = (request as Request & { user?: { companyId?: string } }).user
      ?.companyId;

    // Log severity by tier
    const logFields = {
      code: exception.code,
      devMessage: exception.devMessage,
      context: exception.context,
      path: request.url,
      method: request.method,
      userId,
      companyId,
      requestId,
      cause: this.serializeCause(exception.originalCause),
    };

    if (exception instanceof SystemException) {
      this.logger.error(`[${exception.code}] ${exception.devMessage}`, logFields);
      // TODO: emit metric/alert (Sentry, PagerDuty) — guarded by env flag
    } else if (exception instanceof ValidationException) {
      this.logger.debug(`[${exception.code}] ${exception.devMessage}`, logFields);
    } else {
      // BusinessException — log as warn, useful visibility, no alert
      this.logger.warn(`[${exception.code}] ${exception.devMessage}`, logFields);
    }

    response.status(status).json(this.envelope(exception.code, exception.message, requestId, request.url));
  }

  private handleHttpException(
    exception: HttpException,
    request: Request,
    response: Response,
    requestId: string | undefined,
  ): void {
    const status = exception.getStatus();
    const resp = exception.getResponse();

    let message = 'حدث خطأ — يرجى المحاولة مجدداً';
    let errors: unknown[] | undefined;
    let code: string = ErrorCodes.COMMON_SYS_999;

    if (typeof resp === 'string') {
      message = resp;
    } else if (resp && typeof resp === 'object') {
      const r = resp as Record<string, unknown>;
      // class-validator + ValidationPipe → message: string[] (array of issues)
      if (Array.isArray(r.message)) {
        errors = r.message as unknown[];
        message = 'بيانات غير صالحة — يرجى مراجعة الحقول';
        code = ErrorCodes.COMMON_SYS_999; // generic validation
      } else if (typeof r.message === 'string') {
        message = r.message;
      }
      // If the body already has a `code` (e.g., from PaymentRequiredException
      // in TierLimitsService), preserve it.
      if (typeof r.code === 'string') code = r.code;
    }

    // Map common HTTP statuses to coarse codes when none provided
    if (!code || code === ErrorCodes.COMMON_SYS_999) {
      if (status === HttpStatus.UNAUTHORIZED) code = 'AUTH_BIZ_999';
      else if (status === HttpStatus.FORBIDDEN) code = 'AUTH_BIZ_999';
      else if (status === HttpStatus.NOT_FOUND) code = 'COMMON_BIZ_404';
      else if (status === HttpStatus.CONFLICT) code = 'COMMON_BIZ_409';
      else if (status === HttpStatus.TOO_MANY_REQUESTS) code = 'COMMON_BIZ_429';
    }

    this.logger.warn(`[${code}] ${request.method} ${request.url} → ${status}`, {
      requestId,
      errors,
    });

    const envelope = this.envelope(code, message, requestId, request.url);
    if (errors) envelope.errors = errors;
    response.status(status).json(envelope);
  }

  private handleUnknown(
    exception: unknown,
    request: Request,
    response: Response,
    requestId: string | undefined,
  ): void {
    this.logger.error(
      `[${ErrorCodes.COMMON_SYS_999}] Unhandled exception on ${request.method} ${request.url}`,
      {
        requestId,
        cause: this.serializeCause(exception),
      },
    );

    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(
        this.envelope(
          ErrorCodes.COMMON_SYS_999,
          'حدث خطأ في النظام — تم إبلاغ الفريق التقني',
          requestId,
          request.url,
        ),
      );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  private envelope(
    code: string,
    message: string,
    requestId: string | undefined,
    path: string,
  ): ErrorEnvelope {
    return {
      success: false,
      code,
      message,
      requestId,
      path,
      timestamp: new Date().toISOString(),
    };
  }

  private serializeCause(cause: unknown): unknown {
    if (!cause) return undefined;
    if (cause instanceof Error) {
      return { name: cause.name, message: cause.message, stack: cause.stack };
    }
    return String(cause);
  }
}
