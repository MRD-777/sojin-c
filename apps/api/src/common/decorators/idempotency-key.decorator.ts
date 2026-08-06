// ============================================
// @IdempotencyKey() param decorator
//
// Extracts and validates the `Idempotency-Key` HTTP header.
// Required for financial / state-change endpoints. Rejects:
//   - Missing header → 400
//   - Wrong length (< 16 or > 64) → 400
//   - Unsafe chars (whitespace, control, semicolons) → 400
//
// Format: UUID (36) or any opaque [A-Za-z0-9_-]{16,64}.
// Clients should generate a fresh UUID per logical operation.
// ============================================
import {
  BadRequestException,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';

const SAFE_KEY = /^[A-Za-z0-9_-]{16,64}$/;

export const IdempotencyKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const raw = req.headers['idempotency-key'];
    const key = Array.isArray(raw) ? raw[0] : raw;

    if (!key || typeof key !== 'string') {
      throw new BadRequestException(
        'Idempotency-Key header مطلوب لهذا الـ endpoint',
      );
    }

    if (!SAFE_KEY.test(key)) {
      throw new BadRequestException(
        'Idempotency-Key غير صالح — استخدم UUID أو نص بطول 16-64 من [A-Za-z0-9_-]',
      );
    }

    return key;
  },
);
