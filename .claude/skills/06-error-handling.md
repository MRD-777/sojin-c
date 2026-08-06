---
name: error-handling
description: Use when implementing error handling, exception filters, try/catch blocks, retries, circuit breakers, health checks, queues, or any code that interacts with external services (Supabase, BullMQ, Redis, payment gateways). Enforces three-tier error model, error codes, structured logging, graceful degradation, and alerting.
---

# Error Handling — Safety Rules

> ⚠️ في نظام مالي، silent failure أخطر من crash. crash بنشوفه — silent failure بنكتشفه بعد شهرَين لما العميل يشتكي.
> القاعدة: **كل error لها مستوى محدد، كود محدد، رسالة للـ user، رسالة للـ developer، و log entry بـ context كامل**.

---

## 1. Three-Tier Error Model

```
┌──────────────────────────────────────────────────────────┐
│ Tier 1: Validation Errors                                 │
│ سبب: input غلط من client                                  │
│ HTTP: 400 Bad Request, 422 Unprocessable                  │
│ Examples: amount negative, missing field, invalid email   │
│ Log level: debug (مش بنحتاج alert)                       │
│ Recovery: client يصلح ويعيد المحاولة                     │
├──────────────────────────────────────────────────────────┤
│ Tier 2: Business Errors                                   │
│ سبب: input صحيح لكن business rule بترفض                  │
│ HTTP: 403, 409, 422                                        │
│ Examples: 24h lock expired, duplicate update,             │
│           insufficient quota, state transition invalid    │
│ Log level: info-warn (visibility مهمة، مش urgent)        │
│ Recovery: user يعدل سلوكه                                │
├──────────────────────────────────────────────────────────┤
│ Tier 3: System Errors                                     │
│ سبب: حاجة في الـ infrastructure ولات                     │
│ HTTP: 500, 502, 503, 504                                   │
│ Examples: DB connection lost, Supabase down,              │
│           Redis timeout, OOM, bug                          │
│ Log level: error (alert فوري — production)               │
│ Recovery: على فريق الـ ops                                │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Error Code Registry

كل error لها كود فريد. الـ format: `<MODULE>_<TIER>_<NUM>`.

```typescript
// common/errors/error-codes.ts
export const ErrorCodes = {
  // Auth
  AUTH_VAL_001: 'AUTH_VAL_001',  // Invalid email format
  AUTH_VAL_002: 'AUTH_VAL_002',  // Weak password
  AUTH_BIZ_001: 'AUTH_BIZ_001',  // Account locked (too many attempts)
  AUTH_BIZ_002: 'AUTH_BIZ_002',  // Email already registered
  AUTH_BIZ_003: 'AUTH_BIZ_003',  // Subscription expired
  AUTH_SYS_001: 'AUTH_SYS_001',  // Supabase auth provider unavailable

  // Projects
  PROJ_VAL_001: 'PROJ_VAL_001',  // Invalid project ID format
  PROJ_BIZ_001: 'PROJ_BIZ_001',  // Invalid status transition
  PROJ_BIZ_002: 'PROJ_BIZ_002',  // User not authorized to access project
  PROJ_BIZ_003: 'PROJ_BIZ_003',  // Cannot delete project with active phases
  PROJ_SYS_001: 'PROJ_SYS_001',  // Progress recalculation failed

  // Updates
  UPD_VAL_001: 'UPD_VAL_001',
  UPD_BIZ_001: 'UPD_BIZ_001',  // 24h lock window expired
  UPD_BIZ_002: 'UPD_BIZ_002',  // Duplicate update for today
  UPD_BIZ_003: 'UPD_BIZ_003',  // Invalid state transition
  UPD_BIZ_004: 'UPD_BIZ_004',  // Client cannot create updates

  // Payments
  PAY_VAL_001: 'PAY_VAL_001',  // Amount out of range
  PAY_BIZ_001: 'PAY_BIZ_001',  // Duplicate payment (idempotency)
  PAY_BIZ_002: 'PAY_BIZ_002',  // Insufficient project budget
  PAY_SYS_001: 'PAY_SYS_001',  // Payment provider timeout

  // Files
  FILE_VAL_001: 'FILE_VAL_001',  // Invalid file type
  FILE_VAL_002: 'FILE_VAL_002',  // File too large
  FILE_BIZ_001: 'FILE_BIZ_001',  // Storage quota exceeded
  FILE_SYS_001: 'FILE_SYS_001',  // Storage upload failed
  FILE_SYS_002: 'FILE_SYS_002',  // Malware scan service down

  // Common
  COMMON_SYS_001: 'COMMON_SYS_001',  // Database connection error
  COMMON_SYS_002: 'COMMON_SYS_002',  // Redis timeout
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
```

---

## 3. Custom Exception Classes

```typescript
// common/errors/app-exception.ts
import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-codes';

export interface AppErrorMeta {
  code: ErrorCode;
  userMessage: string;          // عربي، للـ end user
  devMessage: string;            // إنجليزي، للـ debugging
  context?: Record<string, unknown>;
  cause?: unknown;
}

export class AppException extends HttpException {
  readonly code: ErrorCode;
  readonly devMessage: string;
  readonly context: Record<string, unknown>;
  readonly originalCause: unknown;

  constructor(status: HttpStatus, meta: AppErrorMeta) {
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
  constructor(meta: AppErrorMeta & { status?: HttpStatus }) {
    super(meta.status ?? HttpStatus.UNPROCESSABLE_ENTITY, meta);
  }
}

export class SystemException extends AppException {
  constructor(meta: AppErrorMeta) {
    super(HttpStatus.INTERNAL_SERVER_ERROR, {
      ...meta,
      userMessage: 'حدث خطأ في النظام — تم إبلاغ الفريق التقني',
      // ⚠️ ما نكشفش الـ devMessage للـ user
    });
  }
}
```

### Usage
✅ صح:
```typescript
async editApproved(user, updateId, dto, req) {
  const update = /* ... */;

  if (update.isLocked) {
    throw new BusinessException({
      code: ErrorCodes.UPD_BIZ_001,
      userMessage: 'التحديث مقفل — انتهت فترة التعديل (24 ساعة)',
      devMessage: `Update ${updateId} is locked since ${update.lockedAt}`,
      context: { updateId, lockedAt: update.lockedAt, userId: user.userId },
      status: HttpStatus.FORBIDDEN,
    });
  }

  try {
    // ... DB operations
  } catch (error) {
    throw new SystemException({
      code: ErrorCodes.COMMON_SYS_001,
      userMessage: 'حدث خطأ في حفظ التعديل',
      devMessage: 'Prisma transaction failed in editApproved',
      context: { updateId, userId: user.userId },
      cause: error,
    });
  }
}
```

❌ غلط:
```typescript
throw new Error('failed');  // ⛔ مفيش code، مفيش context، رسالة فضفاضة
throw new BadRequestException(error.message);  // ⛔ تسريب internal details
```

---

## 4. Global Exception Filter — يلتقط الكل

الـ `GlobalExceptionFilter` موجود في المشروع. لازم نوسعه عشان يتعامل مع الـ `AppException`:

```typescript
// common/filters/global-exception.filter.ts
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown> = {
      success: false,
      code: 'COMMON_SYS_001',
      message: 'حدث خطأ في النظام',
    };

    if (exception instanceof AppException) {
      status = exception.getStatus();
      body = exception.getResponse() as Record<string, unknown>;

      this.logger[exception instanceof SystemException ? 'error' : 'warn'](
        `[${exception.code}] ${exception.devMessage}`,
        {
          context: exception.context,
          path: request.url,
          method: request.method,
          userId: (request as any).user?.userId,
          companyId: (request as any).user?.companyId,
          ip: request.ip,
          cause: exception.originalCause instanceof Error
            ? { name: exception.originalCause.name, message: exception.originalCause.message, stack: exception.originalCause.stack }
            : exception.originalCause,
        },
      );
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      body = typeof resp === 'string' ? { success: false, message: resp } : { success: false, ...resp };
    } else {
      // Unknown error — أعلى severity
      this.logger.error('Unhandled exception', {
        error: exception instanceof Error ? { name: exception.name, message: exception.message, stack: exception.stack } : exception,
        path: request.url,
        method: request.method,
        userId: (request as any).user?.userId,
        companyId: (request as any).user?.companyId,
      });

      // ⚠️ alert فوري للـ ops
      this.alertingService.criticalAlert({
        title: 'Unhandled exception in API',
        path: request.url,
        userId: (request as any).user?.userId,
      });
    }

    response.status(status).json(body);
  }
}
```

---

## 5. Try/Catch على كل Async Operation

❌ غلط — silent failure:
```typescript
async sendEmail(to: string) {
  this.emailService.send(to, subject, body);  // ⛔ promise مش awaited
}
```

❌ غلط — swallow الـ error:
```typescript
try {
  await riskyOp();
} catch {
  // مفيش حاجة
}
```

❌ غلط — catch + return null:
```typescript
async getUser(id: string) {
  try {
    return await this.prisma.user.findUnique({ where: { id } });
  } catch {
    return null;   // ⛔ caller مش هيعرف إن الـ DB واقعة
  }
}
```

✅ صح — fire-and-forget مع log:
```typescript
async login(dto: LoginDto) {
  // ... main logic

  // fire-and-forget — non-critical
  this.prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  }).catch((err) => {
    this.logger.error('Failed to update lastLogin (non-critical)', err);
  });

  return tokens;
}
```

✅ صح — re-throw with context:
```typescript
async create(user, dto, req) {
  try {
    return await this.prisma.payment.create({ data: { /* ... */ } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new BusinessException({
          code: ErrorCodes.PAY_BIZ_001,
          userMessage: 'هذه الدفعة مسجلة من قبل',
          devMessage: `Unique constraint violation: ${error.meta?.target}`,
          context: { projectId: dto.projectId, amount: dto.amount },
          cause: error,
        });
      }
    }
    throw new SystemException({
      code: ErrorCodes.PAY_SYS_001,
      userMessage: 'فشل في تسجيل الدفعة',
      devMessage: 'Payment creation failed',
      context: { projectId: dto.projectId },
      cause: error,
    });
  }
}
```

---

## 6. Retry with Exponential Backoff للـ External Calls

أي call لـ Supabase, Redis, email provider, payment gateway, geo API — لازم retry logic.

✅ صح — manual:
```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number; maxDelayMs?: number; shouldRetry?: (err: unknown) => boolean } = {},
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 200, maxDelayMs = 5000, shouldRetry = () => true } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts || !shouldRetry(error)) throw error;

      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      const jitter = Math.random() * delay * 0.3;
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }
  throw lastError;
}

// Usage
const signedUrl = await retryWithBackoff(
  () => this.supabase.storage.from('updates-media').createSignedUrl(path, 3600),
  {
    maxAttempts: 3,
    baseDelayMs: 300,
    shouldRetry: (err) => {
      // retry على network errors فقط، مش validation errors
      return err instanceof Error && /timeout|network|503|502/i.test(err.message);
    },
  },
);
```

**القواعد:**
- **Idempotent operations فقط** (GET, PUT idempotent، POST لا — إلا لو فيها Idempotency-Key)
- لا retry على 4xx errors (الـ request غلط، الـ retry هيفشل برضه)
- Retry على: timeouts, 5xx, network errors
- Max 3 attempts، exponential backoff (300ms, 600ms, 1200ms) + jitter
- لا retry forever — circuit breaker للحالات السيئة

---

## 7. Circuit Breaker للـ External Services

لو Supabase وقع، ما نخليش 1000 user يعملوا requests كلها بتفشل بعد timeout.

✅ Pattern (مبسّط):
```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private readonly threshold = 5,
    private readonly cooldownMs = 30_000,
  ) {}

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure > this.cooldownMs) {
        this.state = 'HALF_OPEN';
      } else {
        throw new SystemException({
          code: 'COMMON_SYS_003' as any,
          userMessage: 'الخدمة غير متاحة مؤقتاً — حاول بعد قليل',
          devMessage: 'Circuit breaker OPEN',
        });
      }
    }

    try {
      const result = await fn();
      if (this.state === 'HALF_OPEN') this.state = 'CLOSED';
      this.failures = 0;
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailure = Date.now();
      if (this.failures >= this.threshold) this.state = 'OPEN';
      throw error;
    }
  }
}
```

**استخدمها على**: Supabase Auth/Storage, email provider, payment gateway, ClamAV — أي service خارجي.

---

## 8. Graceful Degradation

الـ app ما تـ crash-ش لو service غير حرجة وقعت.

| Service down | Behavior |
|---|---|
| Email notifications | log + queue للـ retry، الـ action الأساسي يكمل |
| ClamAV | reject upload (security > availability) |
| Redis (cache) | continue بدون cache، أبطأ بس شغّال |
| Redis (rate limit) | allow request مع log warning |
| Audit log DB | **crash** — ما نعملش action بدون audit |
| Notifications | log + retry queue، الـ action يكمل |
| File storage | reject الـ upload (الـ media essential) |

```typescript
// Email — graceful
async sendNotificationEmail(user, message) {
  try {
    await this.emailService.send(user.email, message);
  } catch (error) {
    this.logger.warn('Email send failed — queued for retry', { userId: user.id, cause: error });
    await this.bullQueue.add('email-retry', { userId: user.id, message });
    // ✅ لا re-throw — الـ action الأساسي يكمل
  }
}

// Audit log — fail-loud
async createPayment(user, dto, req) {
  return this.prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({ /* ... */ });
    await this.auditLog.logInTransaction(tx, { /* ... */ });   // ⚠️ ضمن الـ transaction
    // لو الـ audit فشل → الـ payment يـ rollback
    return payment;
  });
}
```

---

## 9. Health Checks

```typescript
// modules/health/health.controller.ts
@Controller('health')
@Public()
export class HealthController {
  @Get()
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async readiness() {
    const checks = await Promise.allSettled([
      this.checkDB(),
      this.checkSupabase(),
      this.checkRedis(),
    ]);

    const results = {
      database: checks[0].status === 'fulfilled' ? 'ok' : 'down',
      supabase: checks[1].status === 'fulfilled' ? 'ok' : 'down',
      redis: checks[2].status === 'fulfilled' ? 'ok' : 'down',
    };

    const healthy = Object.values(results).every(s => s === 'ok');

    if (!healthy) {
      throw new HttpException({ status: 'degraded', checks: results }, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return { status: 'ok', checks: results };
  }

  private async checkDB() {
    await this.prisma.$queryRaw`SELECT 1`;
  }
  // ...
}
```

**Use cases:**
- `GET /health` — liveness — للـ load balancer (لو رجع 200 = الـ pod حي)
- `GET /health/ready` — readiness — للـ deployment (لو رجع 200 = جاهز يستقبل traffic)

---

## 10. Dead Letter Queue (DLQ) للعمليات الفاشلة

أي job مالي / notification مهم لو فشل بعد 3 retries → DLQ.

```typescript
// modules/notifications/notifications.processor.ts
@Processor('notifications')
export class NotificationsProcessor {
  @Process('send')
  async handleSend(job: Job<NotificationPayload>) {
    try {
      await this.send(job.data);
    } catch (error) {
      if (job.attemptsMade >= 3) {
        // Move to DLQ
        await this.dlqQueue.add('notification-failed', {
          original: job.data,
          error: error instanceof Error ? error.message : String(error),
          failedAt: new Date(),
          attempts: job.attemptsMade,
        });
        // Alert
        this.alerting.notify('Notification moved to DLQ', { jobId: job.id });
      }
      throw error;
    }
  }
}
```

**DLQ items**:
- يتراجعوا يدوياً (admin dashboard)
- alert لو DLQ size > 10
- export to file كل أسبوع للـ audit

---

## 11. Alerting Strategy

| Severity | When | Where |
|---|---|---|
| **Critical** | Unhandled exception, DB down, > 50% error rate | PagerDuty / phone call |
| **High** | Error rate spike, DLQ growing, circuit breaker open | Slack + email |
| **Warning** | Slow queries (>1s), elevated 4xx, low storage | Slack |
| **Info** | Deployment, backup completed | Slack channel |

**ممنوع تماماً**: alert على كل error (alert fatigue). فلتر:
- Tier 1 errors (validation) → metric counter فقط، مفيش alert
- Tier 2 errors (business) → log فقط، alert لو الـ rate شاذ
- Tier 3 errors (system) → alert فوري

---

## 12. Logging Best Practices

✅ صح — structured logging:
```typescript
this.logger.error('Payment creation failed', {
  code: 'PAY_SYS_001',
  userId: user.userId,
  companyId: user.companyId,
  projectId: dto.projectId,
  amount: dto.amount,
  duration: Date.now() - startTime,
  cause: error instanceof Error ? { name: error.name, message: error.message } : error,
});
```

❌ غلط:
```typescript
console.log('error', error);   // ⛔ مفيش context، مفيش level
this.logger.log(`User ${user.email} failed: ${error.message}`);  // ⛔ string interpolation — صعب الـ parsing
```

**القواعد:**
- استخدم `Logger` من NestJS (مش `console`)
- JSON format في production
- مفيش PII / secrets في الـ logs (شوف `03-auth-security.md`)
- مفيش log noise — debug logs بـ env flag

---

## Anti-patterns

```typescript
// ⛔ 1. Silent catch
try { await op(); } catch {}

// ⛔ 2. Catch and return null
catch { return null; }

// ⛔ 3. throw new Error('string')
throw new Error('failed');

// ⛔ 4. Leaking internal errors
throw new BadRequestException(error.message);   // قد يحتوي stack/sql

// ⛔ 5. Async بدون await
this.emailService.send(...);

// ⛔ 6. Retry على validation errors
retryWithBackoff(() => api.create(invalidData));   // هيفشل 3 مرات

// ⛔ 7. مفيش timeout على external call
await fetch(externalUrl);   // يقفل الـ thread للأبد لو الـ server hang

// ⛔ 8. alert على كل error
notifyOps(error);   // alert fatigue

// ⛔ 9. Console.log في production
console.log(user);   // مفيش level، structured

// ⛔ 10. Continue بعد audit log failure (للـ financial)
await prisma.payment.create({ /* ... */ });
auditLog.log({ /* ... */ }).catch(() => {});   // payment موجود بدون audit
```

---

## Checklist لأي PR

- [ ] كل async operation عليها await أو `.catch(...)`
- [ ] الـ errors بـ `AppException` (Validation/Business/System) — مش `Error` خام
- [ ] Error code من الـ registry
- [ ] userMessage بالعربي، devMessage بالإنجليزي
- [ ] Context object فيها userId, companyId, entity IDs
- [ ] لا تسريب internal messages للـ user
- [ ] External calls عليها retry + circuit breaker (لو لازم)
- [ ] Critical operations: audit log داخل الـ transaction
- [ ] Health check بيشمل أي dependency جديدة
- [ ] DLQ على jobs مالية / notifications
- [ ] Alert level مناسب (مش spam)
- [ ] Structured log فيه كل الـ context
