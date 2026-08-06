# Project Plan — Construction SaaS

> آخر مراجعة: 2026-05-16
> أساس المراجعة: الكود الفعلي في `apps/api` و `apps/web` مقارن بـ `.claude/skills/`
> ⚠️ **Phase 1 خلص (Backend hardening).** فاضل من Phase 1: Notifications worker + Daily Tracker cron + production migrations baseline. Phase 2 (Frontend wiring) جاهز يبدأ.

---

## 🎯 Current Focus: Backend Only (Enterprise-Grade)

الفرونت متوقف مؤقتاً. التركيز كله على إن الـ Backend يبقى enterprise-grade ويضاهي أنظمة الشركات الكبيرة.

### Quality Bar (كل سطر كود لازم يلتزم بها)

**Architecture**
- كل module عنده single responsibility
- DI صح بدون circular dependencies
- Business rules في الـ service layer (مش في الـ controller)
- Controllers thin — input parsing + delegate + return

**Performance**
- كل query عندها index موجود (verified عبر `EXPLAIN`)
- N+1 queries ممنوعة — استخدم `include`/`select` بدقة
- DB connection pooling مضبوط
- Heavy ops في background jobs (BullMQ) مش في الـ request cycle

**Reliability**
- كل external call عندها timeout + retry + circuit breaker
- Graceful shutdown (handle SIGTERM)
- Health check شامل: DB + Storage + Queue + ClamAV

**Observability**
- Structured JSON logging (Pino)
- Correlation ID على كل request
- Performance metrics على الـ endpoints المهمة
- Error tracking جاهز للـ production

**Security**
- كل skills في `.claude/skills/` ملزمة بدون استثناءات
- كل endpoint بيعدي على 4 طبقات: Authentication → Authorization → Ownership → Validation

### Week 1 Execution Order (Critical Fixes — Backend)

الترتيب الأصلي (C1→C2→C3...) كان فيه dependency conflicts. الترتيب المنطقي:

```
1. C23 → schema.url fix (1-line, prerequisite للـ migrations)
2. C22 → Prisma migrations infrastructure
3. C3  → Rewrite AuditLogService (foundation لـ C1, C2, C4)
4. C24 → Audit immutability SQL trigger (migration)
5. C1  → Payment soft-delete + audit-in-transaction
6. C2  → Media soft-delete (يحتاج schema change)
7. C4  → Move audit calls inside transactions في باقي الـ services
8. C5  → Decimal arithmetic في payments.getSummary
9. C6  → نفس C24 (already covered)
```

### Critical Fixes Status

| ID | Title | Status | Notes |
|---|---|---|---|
| C23 | Schema datasource url | ✅ Done | Explicit `url = env("DATABASE_URL")` in schema |
| C22 | Prisma migrations setup | ✅ Done | `prisma/migrations/` folder + README + baseline workflow |
| C3 | AuditLogService rewrite | ✅ Done | `logInTransaction()` + `log()` separation + secret redaction + IP/UA capping + tests |
| C24 | Audit immutability trigger | ✅ Done | SQL migration with BEFORE UPDATE/DELETE/TRUNCATE triggers |
| C1 | Payment soft-delete | ✅ Done | `deletedAt`/`deletedBy`/`deletionReason` + audit-in-tx + tests |
| C2 | Media soft-delete | ✅ Done | Schema extended + ownership check on read + tests |
| C4 | Audit-in-transactions | ✅ Done | All mutations in updates / projects / phases / users / companies wrapped |
| C5 | Decimal arithmetic | ✅ Done | `payments.getSummary` uses `Decimal.plus/minus`; serialized as strings |
| C6 | Audit immutability (DB) | ✅ Done | Same as C24 |
| **Security Hardening Batch** | | | |
| C13 | @Roles on update mutations | ✅ Done | All endpoints declare allowed roles explicitly |
| C26 | UpdateCompanyDto whitelist | ✅ Done | Subscription/storage/slug fields rejected at validation layer |
| I1 | Helmet security headers | ✅ Done | CSP + HSTS + COOP + Referrer-Policy via `security.config.ts` |
| I2 | Strict multi-env CORS | ✅ Done | Dynamic allowlist with forensic logging + Idempotency-Key allowed |
| C10 | Rate limiting | ✅ Done | `@nestjs/throttler` w/ 3 profiles (default/auth/heavy) |
| I23 | Correlation ID | ✅ Done | Middleware + AsyncLocalStorage + persisted in `audit_logs.requestId` |
| I13 | Health checks | ✅ Done | `/health` liveness + `/health/ready` w/ DB+Supabase checks + tests |
| **Resilience + Tier Limits Batch** | | | |
| I12 | Retry + Circuit breaker | ✅ Done | `retryWithBackoff` (full jitter) + `CircuitBreaker` (CLOSED/HALF_OPEN/OPEN) + tests |
| C14 | Idempotency on financial endpoints | ✅ Done | `IdempotencyService` + `@IdempotencyKey()` decorator on `POST /payments`, `POST /updates/:id/approve`, `POST /updates/:id/force-cancel` |
| C27 | Tier limits enforcement | ✅ Done | `TierLimitsService` injected into users.create, projects.create, media.addToUpdate; 402 + upgradeTo hint |
| **Auth Hardening + Business Rules Batch** | | | |
| I9 | Duplicate update guard | ✅ Done | Same user × phase × day with active status blocked; timezone-aware via Company.timezone |
| I19 | Collision-proof slug | ✅ Done | crypto-random suffix + 5-attempt DB probe loop (was `Date.now()`) |
| C11 | Refresh token in httpOnly cookie | ✅ Done | Cookie set on /login and /refresh; rotated on every refresh; path-scoped to /api/v1/auth |
| I5 | Account lockout | ✅ Done | `LoginAttemptsTracker` — 5 fails / 15-min lock; isolation per email; case-insensitive |
| **Errors + Observability + Consistency Batch** | | | |
| I14 | AppException hierarchy | ✅ Done | Validation/Business/System tiers; stable error codes; GlobalExceptionFilter rewrite with requestId; SystemException always masks devMessage |
| I4 | Env validation at boot | ✅ Done | `validateEnvironment()` runs before Nest; catches missing/placeholder/short JWT secret, prod-only CORS, etc. + tests |
| C28 | recalculateProgress inside tx | ✅ Done | New `recalculateProgressInTx(tx, projectId)` used by updates.approve/forceCancel + phases.create/update/overrideProgress/softDelete |
| **Media Security Batch (C17–C21)** | | | |
| C17 | Trust fileSize/mimeType from client | ✅ Done | `MediaSecurityService.verifyUploadedFile()` re-derives size + mime from storage; client values discarded |
| C18 | Date.now() + raw filename in upload path | ✅ Done | Server-generated UUID v4 paths scoped `{companyId}/{userId}/{uuid}.{ext}`; bucket from `MEDIA_TYPE_POLICY`, not client |
| C19 | Magic-byte validation | ✅ Done | `file-type` v16 sampled over first N bytes; `ALWAYS_BLOCKED_MIMES` for executables; rejected uploads cleaned up |
| C20 | Storage quota enforcement | ✅ Done | Quota checked against verified size (not client claim); tier-aware via `TierLimitsService` |
| C21 | Signed URL on read | ✅ Done | Buckets private; `Media.url` stores path only; reads get short-TTL signed URLs (`SIGNED_URL_TTL_SECONDS`) |
| **Path/Tenant Hardening (bundled)** | | | |
| — | `assertPathBelongsToTenant` | ✅ Done | Fast-rejects foreign-tenant paths before any storage call |
| — | Orphan cleanup on rejection | ✅ Done | Failed `verifyUploadedFile` deletes the uploaded blob best-effort |
| — | `Media.url` semantics | ✅ Done | Path-only persistence; resolution to URL is read-side concern (signed-URL on demand) |

### Per-Fix Workflow

1. Implementation
2. Unit test (مع mocked Prisma) + integration test (مع real DB لو ممكن)
3. Verify all existing tests لسه passing
4. Update PLAN.md status من ⏳ → ✅
5. لو لقيت مشكلة جديدة → ضيفها للـ PLAN كـ Critical/Important/Nice-to-have

### Side Fixes Bundled with Week 1

أثناء تنفيذ C1-C5، تم إصلاح ثغرات إضافية في نفس الـ services. لا تحتاج PR منفصل:

- ✅ `Payment` و `Media` DTOs ما عدتش تتبع enums منفصلة — استخدمت Prisma enums مباشرة (drift fix)
- ✅ `Payment.findOne` endpoint جديد (كان critical C25 في الـ PLAN الأصلي — أُضيف الآن)
- ✅ `Payment.findAll` بقت تـ enforce `companyId` filter عبر relation (defense-in-depth)
- ✅ `Payment.findAll` بقت تـ cap الـ limit عند 100
- ✅ `media.findByUpdate` بقت تـ enforce ownership + companyId + CLIENT visibility check (كان leak)
- ✅ `Project.removeMember` بقت تتطلب reason ≥ 20 chars
- ✅ `Project.softDelete` بقت تتطلب reason ≥ 20 chars
- ✅ `Project.changeStatus` للـ ON_HOLD/CANCELLED بقت تتطلب reason
- ✅ `Phase.update` بقت تـ enforce state machine (NOT_STARTED → IN_PROGRESS → COMPLETED — مع ON_HOLD)
- ✅ `Phase.reorder` بقت تـ audit
- ✅ `Phase.softDelete` بقت تتطلب reason + ترفض الحذف لو في active updates
- ✅ `User.update` whitelist explicit (كان mass-assignment vulnerable — C12 مغطى)
- ✅ `User.softDelete` بقت تتطلب reason + الـ Supabase ban بعد الـ tx (مش قبل) — لو الـ tx فشل، الـ user مش هيتـ ban
- ✅ `Company.updateCompany` whitelist explicit — `subscriptionPlan` / `storageQuota` / `slug` ما عادوا قابلين للتعديل عبر الـ endpoint ده
- ✅ `Company.getStorageUsage` بقت tier-aware (Q7 limits) + `BigInt` → string serialization
- ✅ `Update.findOne` ownership check محسّن مع CLIENT visibility
- ✅ `Update.create` بقت تتطلب project assignment للـ non-admins + audit-in-tx
- ✅ `Update.editDraft` بقت تـ audit (كان مفيش audit للـ method ده)
- ✅ `Update.approve` cap-at-100 بقت atomic داخل الـ Serializable tx

### Newly Discovered Issues (مضافة للـ Phase 1)

- [x] **C26** (🔴): ✅ resolved — `UpdateCompanyDto` whitelist explicit، subscription/storage/slug ما عادوا قابلين عبر الـ endpoint
- [x] **C27** (🟡): ✅ resolved — `TierLimitsService` مفعّل في `users.create` و `projects.create` و `media.addToUpdate`
- [x] **C28** (🟡): ✅ resolved — `recalculateProgressInTx(tx, projectId)` داخل الـ Serializable tx بدل ما يجري بعد commit
- [x] **C29** (🟡): ✅ resolved — تمت إعادة كتابة كاملة عبر `MediaSecurityService` (UUID paths + magic-byte + signed URLs + tenant-scoped paths)
- [ ] **C30** (🟢): الـ `Payment.findAll` و `Payment.getSummary` مش بيحسبوا الـ soft-deleted في الـ totals، لكن مفيش endpoint بيعرضهم للـ admin (forensic review). محتاج `GET /payments/deleted` للـ SUPER_ADMIN فقط.

### Tests Added (Week 1)

- ✅ `audit-log.service.spec.ts` — 30+ tests (logInTransaction, log, validation, redaction, IP/UA)
- ✅ `payments.service.spec.ts` — softDelete + create (now idempotent) + findAll + findOne + getSummary (Decimal precision)
- ✅ `media.service.spec.ts` — softDelete (ownership, double-delete, rollback) + findByUpdate (visibility) + addToUpdate cap
- ✅ `updates.service.spec.ts` — approve (audit-in-tx, rollback, cap-at-100, recalc, idempotent) + reject + forceCancel (SUNK_COST + progress reversal + idempotent) + editApproved (24h window, snapshot)
- ✅ `correlation-id.middleware.spec.ts` — UUID minting + safe X-Request-Id reuse + log-injection rejection + concurrent isolation
- ✅ `health.controller.spec.ts` — liveness + readiness with DB/Supabase failure scenarios
- ✅ `retry.spec.ts` — first-try success, transient retry, non-transient bypass, max attempts, custom predicates
- ✅ `circuit-breaker.spec.ts` — CLOSED → OPEN transitions, HALF_OPEN probe, counter reset on success
- ✅ `idempotency.service.spec.ts` — replay, body fingerprinting, mismatched-body 422, tenant scoping, TTL
- ✅ `tier-limits.service.spec.ts` — user/project/storage caps for each tier + upgradeTo hint + boundary conditions
- ✅ `login-attempts.tracker.spec.ts` — counter behaviour, lock threshold (5), 15-min window, isolation, case-insensitive
- ✅ `env-validation.spec.ts` — JWT secret length/placeholder detection, prod-only CORS/COOKIE requirements, URL validation
- ✅ `media-security.service.spec.ts` — verifyUploadedFile (magic-byte, blocked mimes, size mismatch), assertPathBelongsToTenant, signed URL TTL, orphan cleanup
- ⏳ `projects.service.spec.ts` — pending (next iteration)
- ⏳ `phases.service.spec.ts` — pending (next iteration)
- ⏳ `users.service.spec.ts` — pending (next iteration)
- ⏳ `companies.service.spec.ts` — pending (next iteration)
- ⏳ E2E suite — `test/app.e2e-spec.ts` skeleton فقط

**Coverage target reminder**: 80% on services. Current additions cover the highest-stakes paths.

### Migrations (cumulative)

| Order | Name | Purpose |
|---|---|---|
| 1 | `0_init` (baseline — to be generated) | Initial schema (18 models) |
| 2 | `20260513000000_audit_immutability` | DB triggers preventing UPDATE/DELETE/TRUNCATE on `audit_logs` |
| 3 | `20260513000001_soft_delete_payments_media` | `deletedBy` + `deletionReason` on payments; full soft-delete on media |
| 4 | `20260513000002_audit_request_id` | `request_id` column on `audit_logs` for correlation |

### Infrastructure Changes (cumulative)

- **New deps**: `helmet`, `cookie-parser`, `@nestjs/throttler` (+ `@types/cookie-parser`)
- **New env vars**: `CORS_ALLOWED_ORIGINS`, `COOKIE_SECRET`, `DOCS_ENABLED`, `ENABLE_MALWARE_SCAN`, `CLAMD_HOST`, `CLAMD_PORT`
- **New files**:
  - `common/config/cors.config.ts` — dynamic multi-env CORS allowlist
  - `common/config/security.config.ts` — Helmet/CSP options
  - `common/config/throttler.config.ts` — 3 rate-limit profiles
  - `common/context/request-context.ts` — AsyncLocalStorage scope
  - `common/middleware/correlation-id.middleware.ts` — X-Request-Id handling
  - `common/resilience/retry.ts` + `circuit-breaker.ts` — reusable resilience utilities
  - `common/idempotency/` — `IdempotencyStore` interface + `InMemoryIdempotencyStore` + `IdempotencyService` + `IdempotencyModule` (global)
  - `common/decorators/idempotency-key.decorator.ts` — `@IdempotencyKey()` param decorator
  - `modules/health/health.controller.ts` + `health.module.ts`
  - `modules/companies/tier-limits.service.ts` — single source of truth for plan enforcement, throws 402
- **Updated `main.ts`**:
  - `trust proxy` set for real client IPs
  - Helmet → cookieParser → HTTPS redirect (prod) → setGlobalPrefix → CORS → ValidationPipe → Swagger (gated) → enableShutdownHooks
  - Swagger off by default in production (`DOCS_ENABLED=true` to override)
  - `ValidationPipe` now uses `enableImplicitConversion: false` + `disableErrorMessages` in prod
- **Module wiring**:
  - `CompaniesModule` exports `TierLimitsService`; imported by `UsersModule`, `ProjectsModule`, `MediaModule`
  - `IdempotencyModule` is `@Global` so any service can inject `IdempotencyService` without import boilerplate

---

## Phase 1: Security & Code Review

### 🔴 Critical Fixes (لازم تتصلح قبل أي حاجة)

#### A. Financial & Data Integrity

- [ ] **C1. Hard delete on Payment records** — `apps/api/src/modules/payments/payments.service.ts:141`
  - `prisma.payment.delete()` على entity مالية = خسارة audit trail قانونياً
  - **الإصلاح**: تحويل لـ soft delete (`deletedAt`) + إضافة `deletedBy` للـ Payment schema
  - **Skill**: `02-database` + `07-audit-compliance`

- [ ] **C2. Hard delete on Media records** — `apps/api/src/modules/media/media.service.ts:142`
  - نفس المشكلة: media مرتبطة بـ updates مرتبطة بمدفوعات
  - **الإصلاح**: soft delete + اسم ملف يبقى في Storage (للـ audit)

- [ ] **C3. Audit log failures silently swallowed** — `apps/api/src/modules/audit/audit-log.service.ts:51-58`
  - الـ comment يقول "must NEVER break main operation" — ده يخالف skill 07 صراحة
  - السيناريو: payment يتـ create، audit log فشل → عملية مالية بدون trail
  - **الإصلاح**:
    - إضافة `logInTransaction(tx, entry)` للعمليات المالية/state-change
    - الـ `log()` العادي يفضل swallow للـ non-critical (e.g., access logs)
    - alert فوري لو audit failure حصل
  - **Skill**: `07-audit-compliance` (الفقرة "Immutability" + Anti-pattern #2)

- [ ] **C4. Audit log writes OUTSIDE transactions في عمليات state-change**
  - `updates.service.ts:295` — approve: audit بعد الـ $transaction
  - `updates.service.ts:337` — reject: نفس المشكلة
  - `updates.service.ts:416` — forceCancel: نفس المشكلة
  - `payments.service.ts:115` — create: audit بعد الـ create
  - `updates.service.ts:195` — editDraft: **مفيش audit أصلاً**
  - `phases.service.ts:196` — reorder: **مفيش audit أصلاً**
  - **الإصلاح**: نقل كل الـ audit calls داخل `$transaction` interactive، استخدم `logInTransaction(tx, ...)`

- [ ] **C5. Float arithmetic للمالية** — `payments.service.ts:78-82, 86-89`
  - `Number(p._sum.amount)` بيفقد precision للـ Decimal
  - السيناريو: 0.1 + 0.2 = 0.30000000000000004 → عميل بيشتكي إن المجموع غلط
  - **الإصلاح**: استخدم `Decimal.add()` من `@prisma/client/runtime/library`
  - **Skill**: `02-database` فقرة 11

- [ ] **C6. Audit logs مش immutable على مستوى الـ DB**
  - مفيش trigger أو policy يمنع UPDATE/DELETE على `audit_logs`
  - SUPER_ADMIN compromised = audit يقدر يتمسح
  - **الإصلاح**: SQL migration بـ trigger يمنع UPDATE/DELETE/TRUNCATE
  - **Skill**: `07-audit-compliance` فقرة 4

#### B. Auth & Authorization

- [ ] **C7. Frontend `setup-workspace` بيتجاوز الـ Backend كلياً**
  - `apps/web/src/app/[locale]/(auth)/actions.ts:107-173`
  - بيكتب على `companies` و `users` tables مباشرة عبر Supabase client
  - **النتائج**:
    - لا validation من الـ Backend
    - لا audit log
    - لا transaction (companies + users في statements منفصلة → orphaned data ممكنة)
    - User يقدر يـ call setupWorkspace مرتين → 2 companies لنفس الـ user
  - **الإصلاح**: استخدم `POST /api/v1/auth/register-company` الموجود في الـ Backend بالفعل
  - **Decision needed**: شوف الـ "Decisions" section تحت

- [ ] **C8. Middleware auth bypass في development** — `apps/web/src/middleware.ts:42`
  - `if (process.env.NODE_ENV !== 'development')` بيوقف حماية كل الـ dashboard routes
  - لو NODE_ENV ضاع أو misconfigured في staging/prod → بدون auth خالص
  - **الإصلاح**: شيلها كلياً، استخدم flag منفصل (`AUTH_BYPASS_FOR_LOCAL_DEV=true`) مع explicit check وlog warning صريح في كل request

- [ ] **C9. `registerManager` يـ redirect لـ `dashboard`** بدلاً من `setup-workspace`
  - `apps/web/src/app/[locale]/(auth)/actions.ts:104`
  - User بدون شركة يدخل dashboard → broken state، كل الـ queries هتفشل
  - **الإصلاح**: redirect لـ `/setup-workspace` لو ما عندوش company

- [ ] **C10. No rate limiting on login** — `apps/api/src/modules/auth/auth.controller.ts`
  - `@nestjs/throttler` مش مثبت
  - السيناريو: brute force على أي email حقيقي
  - **الإصلاح**: `pnpm add @nestjs/throttler` + ThrottlerGuard global + `@Throttle({ auth: { limit: 5, ttl: 60_000 } })` على `/auth/login`, `/auth/register-company`
  - **Skill**: `03-auth-security` فقرة 3

- [ ] **C11. Refresh token يتـ return في الـ JSON body** — `auth.service.ts:194-197`
  - `refreshToken` يبقى accessible عن طريق JavaScript → XSS = token مسروق
  - **الإصلاح**: refresh token في httpOnly cookie + access token في الـ body فقط
  - **Skill**: `03-auth-security` فقرة 1

- [ ] **C12. Mass assignment في `users.service.update()`** — `users.service.ts:223-227`
  - `data: dto` يمرر كل الـ fields من الـ DTO مباشرة لـ Prisma
  - لو الـ DTO فيه `companyId` أو `role`، attacker يقدر يغيرهم عبر admin endpoint
  - **الإصلاح**: whitelist الـ fields explicit (زي الـ pattern في projects.service.update)

- [ ] **C13. Missing `@Roles()` decorators على Update mutations**
  - `updates.controller.ts` — `POST /phases/:phaseId/updates` (create) بدون @Roles
  - `PATCH /updates/:id` (editDraft) بدون @Roles
  - `POST /updates/:id/submit` بدون @Roles
  - الـ service بيعمل defensive check بس Layer 2 ناقصة
  - **الإصلاح**: ضيف `@Roles('SUPER_ADMIN', 'PROJECT_MANAGER', 'SITE_ENGINEER', 'SUPERVISOR', 'WORKER')` على creation/edit endpoints
  - **Skill**: `01-api-endpoints` فقرة 3

- [ ] **C14. Idempotency غير موجود على العمليات المالية**
  - `POST /payments` — double-click = double payment
  - `POST /updates/:id/approve` — double approval = phase progress incremented مرتين
  - **الإصلاح**: IdempotencyService + Redis cache + `Idempotency-Key` header إجباري
  - **Skill**: `01-api-endpoints` فقرة 8

- [ ] **C15. State machine validation ناقصة على Phase status** — `phases.service.ts:138`
  - `status: dto.status as PhaseStatus | undefined` — أي transition مسموح
  - السيناريو: COMPLETED → NOT_STARTED ممكنة بدون reason → progress accounting يتلخبط
  - **الإصلاح**: STATUS_TRANSITIONS map زي الـ Project + `reason` للـ negative transitions

- [ ] **C16. `overrideProgress` بدون bounds check** — `phases.service.ts:171`
  - dto.progress ممكن يكون -100 أو 500
  - الـ DTO فيها validation؟ — تأكد ومتعتمدش على Prisma constraints
  - **الإصلاح**: `@IsInt() @Min(0) @Max(100)` في DTO + double-check في service

#### C. File Uploads (Critical Security Holes) — ✅ Done

كل الـ five items خلصت عبر `MediaSecurityService` + `media-security.constants.ts`. تفاصيل التطبيق في الـ Critical Fixes Status table أعلاه.

- [x] **C17. Trust client-provided `fileSize`/`mimeType`** — Server re-derives both from storage; client values discarded
- [x] **C18. `Date.now()` + raw filename + public bucket URL** — UUID v4 paths scoped `{companyId}/{userId}/{uuid}.{ext}`; bucket from `MEDIA_TYPE_POLICY`
- [x] **C19. Magic byte validation** — `file-type` v16 sampled over first N bytes + `ALWAYS_BLOCKED_MIMES`
- [x] **C20. Storage quota enforcement** — Gated on verified size, tier-aware via `TierLimitsService`
- [x] **C21. Signed URL on read access** — Private buckets + short-TTL signed URLs (`SIGNED_URL_TTL_SECONDS`); `Media.url` stores path only

#### D. Database / Schema

- [ ] **C22. مفيش migration files** — schema بـ `db push` فقط
  - production deployment ما عندوش tracked schema history
  - rollback مستحيل
  - **الإصلاح**: `prisma migrate dev --name initial` + commit الـ migrations + استخدام `migrate deploy` على production

- [ ] **C23. Schema datasource بدون `url`** — `apps/api/prisma/schema.prisma:10-12`
  - `datasource db { provider = "postgresql" }` بدون `url = env("DATABASE_URL")`
  - يعتمد على ENV implicit — هش لو الاسم اتغير
  - **الإصلاح**: `url = env("DATABASE_URL")` صراحة

- [ ] **C24. Audit log غير محمي من tampering على مستوى الـ DB**
  - **الإصلاح**: SQL migration:
  ```sql
  CREATE OR REPLACE FUNCTION prevent_audit_modification()
    RETURNS TRIGGER AS $$
  BEGIN
    RAISE EXCEPTION 'audit_logs is append-only';
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER no_modify_audit_logs
    BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_logs
    FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_modification();
  ```

- [ ] **C25. مفيش `findOne` للـ payments + access check ناقص في `findAll`**
  - `payments.controller.ts` ما فيهوش `GET /payments/:id`
  - `findAll` بيعتمد على `ensureProjectAccess` بس — لو في bug فيها، أي حد يـ list مدفوعات أي مشروع
  - **الإصلاح**: ضيف `findOne` + double `where` filter بـ companyId عبر relation

---

### 🟡 Important Fixes (يتصلح في أقرب وقت)

#### E. Security Hardening

- [ ] **I1. Helmet غير مثبت** — لا security headers (CSP, HSTS, X-Frame-Options)
  - `pnpm add helmet` + `app.use(helmet(...))` في main.ts
  - **Skill**: `03-auth-security` فقرة 7

- [ ] **I2. CORS strict whitelist غير كافٍ** — `main.ts:17-22`
  - حالياً single origin من `APP_URL` — تمام لكن مفيش staging support
  - **الإصلاح**: array من allowed origins + dynamic check

- [ ] **I3. مفيش CSRF protection للـ state-changing endpoints**
  - SameSite=Strict على الـ cookies يكفي مع double-submit
  - **الإصلاح**: لما refresh token يتحط في cookie (بعد C11)، ضيف CSRF check

- [ ] **I4. JWT secret consistency check**
  - الـ `JwtStrategy` يستخدم `JWT_SECRET` env — لازم نتأكد إنه نفس Supabase project's JWT secret
  - **الإصلاح**: log warning في bootstrap لو الـ secret format مش متطابق

- [ ] **I5. مفيش account lockout بعد محاولات فاشلة**
  - حتى مع rate limiting، attacker يقدر يجرب 5 محاولات كل دقيقة على ملايين الـ emails
  - **الإصلاح**: Redis counter per email + lockout مدته متزايدة بعد كل محاولة

- [ ] **I6. مفيش log sanitization** — passwords/tokens ممكن تتسرب لو الـ DTOs اتـ log
  - **الإصلاح**: `sanitizeForLog()` utility + استخدامها في كل logger.log اللي بياخد object
  - **Skill**: `03-auth-security` فقرة 5

- [ ] **I7. Companies update DTO بدون whitelist** — `companies.service.ts:80`
  - `data: dto` للـ update — لو الـ DTO فيها `subscriptionPlan` أو `storageQuota` accidentally
  - **الإصلاح**: explicit field picking

#### F. Code Quality / Skills Compliance

- [ ] **I8. `editApproved` controller restriction vs service behavior تعارض**
  - Controller line 119: `@Roles('SUPER_ADMIN', 'PROJECT_MANAGER')` only
  - Skill 04 يقول submitter يقدر يعدل خلال 24h
  - Service ما بيتأكدش من الـ submitter
  - **الإصلاح**: قرر السلوك الصحيح — لو submitter only، شيل الـ admins من @Roles. لو الاتنين، أضف submitter للـ allowed roles
  - **Decision needed**

- [ ] **I9. مفيش duplicate update check** — `updates.service.ts.create`
  - مستخدم يقدر يبعت 5 updates لنفس الـ phase في نفس اليوم
  - **الإصلاح**: check قبل create — DailyUpdateTracker متاح
  - **Skill**: `04-daily-reports` فقرة 3

- [ ] **I10. `media.findByUpdate` بدون access check** — `media.service.ts:98`
  - أي حد عنده updateId يقدر يـ list كل الـ media
  - **الإصلاح**: ownership check + companyId filter

- [ ] **I11. `users.service.update` بدون validation للـ role/companyId**
  - مذكور في C12 لكن worth highlighting
  - **الإصلاح**: explicit whitelist + raise error لو الـ DTO فيها restricted fields

- [ ] **I12. مفيش retry/circuit breaker للـ Supabase calls**
  - أي Supabase outage = errors في كل المستخدمين فوراً
  - **الإصلاح**: utility wrapper + استخدامها في auth + media + storage
  - **Skill**: `06-error-handling` فقرات 6-7

- [ ] **I13. مفيش health check endpoint**
  - لا liveness ولا readiness
  - **الإصلاح**: `GET /health` و `GET /health/ready` (موصوف في skill 06)

- [ ] **I14. Error responses inconsistent**
  - Filter بيرجع `{ success: false, error: { ... } }` (لاحظ الـ error wrapper)
  - الـ TransformInterceptor success بيرجع `{ success: true, data, meta }`
  - الـ AppException في skill 06 شكلها مختلف
  - **الإصلاح**: توحيد الـ response shape مع AppException pattern

- [ ] **I15. `pickChangedFields` confusing semantics** — `companies.service.ts:166`
  - بترجع old values لـ changed fields. الاسم بيقول "changed" بس بترجع الـ original
  - **الإصلاح**: rename لـ `pickOldValuesForChanged` أو refactor للوضوح

- [ ] **I16. Secondary sidebar مش بتفلتر بالـ role** — `apps/web/src/components/dashboard/secondary-sidebar.tsx`
  - Navigation config عندها `roles` field مش متستخدم
  - **الإصلاح**: read الـ user role من Zustand/context + filter

- [ ] **I17. Frontend duplicate code للـ `getStatusBadge`/`getProgressBar`**
  - مكرر في 4 pages
  - الموجود في `components/dashboard/global/` مش بيتستخدم
  - **الإصلاح**: refactor الـ pages عشان تستخدم الـ shared components

- [ ] **I18. Frontend hardcoded Arabic strings** — `apps/web/src/app/[locale]/dashboard/projects/[id]/page.tsx`
  - "القوة العاملة"، "مقاولي الباطن" hardcoded — مش بتترجم لـ EN
  - **الإصلاح**: نقل كل الـ strings لـ `messages/{ar,en}.json`

- [ ] **I19. `slug` generation collision-prone** — `auth.service.ts:281-296`
  - `Date.now().toString(36)` ممكن collide مع registrations متزامنة
  - **الإصلاح**: استخدم `randomUUID().slice(0,8)` أو DB retry-loop مع unique check

- [ ] **I20. مفيش password reset flow**
  - Supabase بيدعمه، لكن مفيش UI/API endpoint
  - **الإصلاح**: `POST /auth/forgot-password` + `POST /auth/reset-password` + UI pages

- [ ] **I21. مفيش testing infrastructure feline** — `app.controller.spec.ts` لوحده
  - **الإصلاح**: test DB setup + factories + first batch من unit tests للـ critical services
  - **Skill**: `08-testing` (الـ checklist كله)

- [ ] **I22. مفيش Swagger `@ApiProperty()` على الـ DTOs**
  - Swagger config موجود في main.ts، لكن الـ DTOs ما فيهاش decorators
  - **الإصلاح**: pass على كل DTO + ضيف `@ApiProperty({ description, example })`

- [ ] **I23. مفيش request ID / correlation ID**
  - الـ logs ما فيهاش way لـ correlate request واحد عبر services
  - **الإصلاح**: middleware يضيف `X-Request-Id` header + يحطه في الـ async context

#### G. Frontend Data Layer

- [ ] **I24. مفيش API client** — `apps/web/src/lib/` ما فيهوش `api.ts`
  - axios مثبت لكن غير مستخدم
  - **الإصلاح**: `src/lib/api.ts` مع axios instance + JWT interceptor + error normalization
  - (دي blocking لـ Phase 2 — أي feature بيتربط بالـ API محتاجها)

- [ ] **I25. مفيش react-query hooks**
  - TanStack Query مثبت ومـ QueryProvider configured، لكن مفيش hooks
  - **الإصلاح**: `src/hooks/` directory + hook لكل resource

---

### 🟢 Nice to Have

- [ ] **N1. ملفات scratch في الـ root** — احذف `compare_json.js`, `update_json.js`, `scratch/`, `src_files.txt`, `src_files_utf8.txt`, `system_analysis.md`, `project_documentation.md`
- [ ] **N2. `supabase_test.ts` في `apps/web/`** — احذف
- [ ] **N3. `apps/api/dist/`** متعمل commit — أضف للـ .gitignore (لو مش موجود)
- [ ] **N4. `apps/web/.next/`** متعمل commit — تأكد إنه في .gitignore
- [ ] **N5. Unused dependencies** — `@base-ui/react`, `avatar@0.1.0` في web/package.json
- [ ] **N6. `bcrypt` في API package.json** — مش مستخدم (Supabase بيتولى الـ passwords)
- [ ] **N7. ESLint pre-commit hook** + Prettier
- [ ] **N8. Shared UI components → `packages/ui`** بدلاً من `apps/web/src/components/ui`
- [ ] **N9. VSCode workspace settings** (settings.json + recommended extensions)
- [ ] **N10. `pnpm -r typecheck` task** في turbo.json
- [ ] **N11. Storybook للـ UI components**
- [ ] **N12. PWA manifest** للـ mobile-friendly install
- [ ] **N13. Sentry / OpenTelemetry** للـ production observability
- [ ] **N14. Database connection pooling config** (PgBouncer / Supabase pooler) — verify settings
- [ ] **N15. Backup strategy documentation** — مكتوب في skill 02 بس مش validated على production

---

## Phase 2: Complete Missing Features

> ⚠️ **يبدأ بعد ما Phase 1 critical fixes تخلص.** الـ skill يقول "Security > Auditability > Correctness > Performance > DX" — مفيش feature تستحق إنها تتبني على base مش آمن.

### High Priority

#### F1. API Client Layer (frontend) — Blocking
- **Why**: كل feature تانية بتتربط بالـ Backend بتعتمد على ده. حالياً كل الـ UI mock.
- **Skills affected**: `01-api-endpoints` (response format), `03-auth-security` (token injection)
- **Estimate**: 1-2 days
- **Dependencies**: I24 (Phase 1)
- **Includes**:
  - `src/lib/api.ts` — axios instance، base URL من ENV، JWT interceptor (من Supabase session)
  - Error normalization (يفهم `{ success: false, error: { ... } }`)
  - Refresh token interceptor (401 → refresh → retry)
  - Request ID propagation

#### F2. React Query Hooks لكل resource
- **Why**: الـ glue بين الـ API client والـ UI
- **Skills affected**: `01-api-endpoints`
- **Estimate**: 3-4 days
- **Dependencies**: F1
- **Includes**:
  - `useProjects()`, `useProject(id)`, `useCreateProject()`, `useUpdateProject()`
  - `useUpdates(phaseId)`, `useApproveUpdate()`, `useRejectUpdate()`
  - `usePayments(projectId)`, `useCreatePayment()`
  - `useUsers()`, `useChangeRole()`, ...
  - Cache invalidation patterns
  - Optimistic updates للـ status transitions

#### F3. Unify Auth Flow — Decision Required
- **Why**: التعارض الحالي (Supabase direct vs Backend API) خطر أمني (C7)
- **Skills affected**: `03-auth-security`, `07-audit-compliance`
- **Estimate**: 2-3 days
- **Dependencies**: C7, C9, C11 (Phase 1)
- **Decision (انظر Decisions)**: Backend-first
- **Includes**:
  - `actions.ts` يستدعي `/api/v1/auth/register-company` بدل Supabase direct
  - `setupWorkspace` يتحذف أو يستخدم `/api/v1/companies` (لو split flow بقى)
  - Login flow يحط refresh في cookie بدل return body

#### F4. Connect Existing Pages to Real API
- **Why**: حالياً 100% mock. أي عرض للـ user = بيانات وهمية
- **Skills affected**: كلها
- **Estimate**: 5-7 days
- **Dependencies**: F1, F2
- **Order**:
  1. Dashboard Overview (KPIs من real data)
  2. Projects List + Detail
  3. Finance Overview
  4. Team / Users
  5. Audit Trail page

#### F5. Notifications Module (Backend) — BullMQ
- **Why**: حالياً commented-out في app.module. كل state transition محتاج notification.
- **Skills affected**: `04-daily-reports` (notification triggers), `06-error-handling` (DLQ)
- **Estimate**: 3-4 days
- **Dependencies**: Redis up (docker-compose موجود)
- **Includes**:
  - `NotificationsModule` + processor
  - Templates لكل NotificationType (18 type في الـ enum)
  - Triggers من updates/payments/projects services
  - In-app channel أولاً، Email/Push بعدين

#### F6. File Upload Backend — Replace Broken Media Flow
- **Why**: C17-C21 critical — الـ flow الحالي insecure
- **Skills affected**: `05-file-uploads` بالكامل
- **Estimate**: 3-4 days
- **Dependencies**: C17-C21 (Phase 1)
- **Includes**:
  - Multer config + size limits
  - Magic bytes validation
  - Sharp re-encoding للـ images
  - Supabase Storage private buckets
  - Signed URLs مع expiry لـ reads
  - Storage quota enforcement (tier-aware من Q7)
  - **ClamAV: Docker container منفصل في `docker-compose.yml`** ✅ decided
    - service جنب الـ Redis، TCP socket على الـ Docker network
    - skip في الـ dev بـ env flag (`ENABLE_MALWARE_SCAN=false`)
    - الـ API بيتصل بـ `clamscan` library عبر TCP

#### F7. Complete Empty Services (Backend)
- **Why**: SubContractors, Comments, Chat services موجودة كهياكل بدون logic
- **Skills affected**: `01-api-endpoints`, `02-database`, `07-audit-compliance`
- **Estimate**: 5-7 days
- **Dependencies**: C1-C6 (Phase 1 patterns)
- **Order**:
  1. SubContractors (مهم للـ financial)
  2. Comments (مهم للـ review workflow)
  3. Chat (last priority — real-time complexity)

#### F8. Database Migrations Setup
- **Why**: production safety
- **Estimate**: 1 day
- **Dependencies**: C22 (Phase 1)
- **Includes**:
  - `prisma migrate dev --name initial` على الـ schema الحالي
  - Migration للـ audit immutability trigger (C24)
  - Migration لإضافة `version` field للـ optimistic locking
  - Migration لإضافة `createdBy/updatedBy/deletedBy` على الـ entities
  - CI step لـ `prisma migrate deploy` على staging قبل production

---

### Medium Priority

#### F9. Missing Pages (Frontend)
- **Why**: Navigation بتشاور على pages مش موجودة → 404
- **Pages**:
  - `/dashboard/subcontractors` + sub-pages
  - `/dashboard/chat` (المؤقت — قبل real-time)
  - `/dashboard/settings` (company info, subscription, workflow)
  - `/dashboard/profile`
  - `/dashboard/audit` (الموجود placeholder بس)
  - `/dashboard/projects/reviews` (Review Inbox)
  - `/dashboard/projects/sla` (SLA Tracker)
  - `/dashboard/team/permissions`
- **Estimate**: 7-10 days
- **Dependencies**: F2 (hooks ready), F7 (backend logic ready)

#### F10. New Project Form (`/dashboard/projects/new`)
- **Why**: page موجودة placeholder
- **Estimate**: 2 days
- **Dependencies**: F2
- **Includes**: multi-step form، client selection، validation Zod، optimistic submit

#### F11. Daily Update Workflow UI
- **Why**: قلب النظام — site engineer لازم يقدم update يومي
- **Skills affected**: `04-daily-reports` كامل
- **Estimate**: 4-5 days
- **Includes**:
  - "Submit Update" form (mobile-first — engineers في الموقع)
  - File upload integration (F6)
  - Review Inbox (PMs)
  - Approve/Reject/Force Cancel UI مع reason
  - Version history viewer

#### F12. Notification Center UI
- **Why**: F5 backend لازمها UI
- **Estimate**: 2-3 days
- **Dependencies**: F5
- **Includes**: bell icon، unread badge، list، mark-as-read، realtime via Supabase Realtime

#### F13. Daily Update Cron + Tracker
- **Why**: schema فيها DailyUpdateTracker لكن مفيش logic بيـ populate
- **Skills affected**: `04-daily-reports` فقرة 10
- **Estimate**: 2 days
- **Dependencies**: F5 (لـ notifications)
- **Includes**:
  - Cron يومي صباحاً → create trackers
  - Cron بعد الـ deadline → mark MISSED + notify

#### F14. PDF Export للـ Reports
- **Why**: العميل ممكن يطلب reports رسمية
- **Estimate**: 3-4 days
- **Includes**:
  - Puppeteer أو react-pdf
  - Templates: project summary, financial statement, audit trail
  - Watermark + signature placeholder

#### F15. Audit Trail Export
- **Why**: legal compliance — `07-audit-compliance` فقرة 8
- **Estimate**: 1-2 days
- **Dependencies**: F8 (migrations done)
- **Includes**: CSV/PDF export + meta-audit للـ export نفسه

---

### Low Priority

#### F16. Real-time via Supabase Realtime ✅ decided
- **Stack**: Supabase Realtime (Postgres changes + Broadcast)
- **Estimate**: 3-5 days (أقل من WebSocket gateway لأن الـ infra جاهزة)
- **Dependencies**: F7 (chat tables + auth context)
- **Includes**:
  - Realtime subscription على `chat_messages` filtered بـ companyId/roomId
  - RLS policies على الـ Postgres tables عشان الـ filter يحصل في الـ DB
  - Subscription على `notifications` للـ in-app real-time delivery

#### F17. Mobile App via Capacitor ✅ decided
- **Stack**: Capacitor 6 wrapper حول الـ Next.js PWA
- **Estimate**: 1-2 weeks للـ MVP (iOS + Android wrapper)
- **Dependencies**: F4 (web app working with real API)
- **Includes**:
  - Capacitor config + iOS/Android project shells
  - Camera plugin (للـ site photos)
  - Geolocation plugin (للـ update submission proof)
  - Push notifications (FCM/APNs) integration مع F5
  - Offline mode لـ draft updates (تتـ sync لما يبقى online)
- **Migration path**: لو احتجنا native features أكتر، React Native بعد MVP

#### F18. Pricing / Billing Integration
- **Stack**: Paddle (أسهل من Stripe في mid-east tax)
- **Estimate**: 1-2 weeks
- **Dependencies**: tier enforcement على services (Q7 implementation)
- **Subscription Tiers** (محدد):

  | Tier | Projects | Users | Storage | Price |
  |---|---|---|---|---|
  | Starter | 3 | 10 | 10 GB | TBD |
  | Professional | 15 | 50 | 50 GB | TBD |
  | Enterprise | ∞ | ∞ | 200 GB | TBD |

- **Includes**:
  - Tier limits enforcement (شوف Q7 implementation list)
  - Webhook handler لـ subscription events
  - Grace period (7 يوم) قبل downgrade
  - Storage warning عند 80%، block عند 100%

#### F19. Landing Page Polish
- **Estimate**: 3-5 days
- **Includes**: SEO، animations، social proof من real customers

#### F20. Onboarding Wizard
- **Estimate**: 3-4 days
- **Includes**: guided tour، sample project creation، first user invite

#### F21. Internationalization Expansion
- **Estimate**: depends on locales
- **Includes**: FR, ES لو targeting markets جديدة

---

## Notes

### Architectural Decisions Made During Review

#### D1. Auth Flow: Backend-First
**القرار**: كل auth operations عبر NestJS Backend. Supabase Auth بيستخدم بس كـ identity provider خلف الـ Backend.
**السبب**:
- Multi-tenant enforcement عبر middleware
- Audit log إجباري لكل registration/login
- Validation موحدة
- لا duplicate flows
**التأثير**: C7, C11, F3

#### D2. Soft Delete على كل الـ Entities المالية والقانونية
**القرار**: مفيش `prisma.X.delete()` في أي مكان للـ Payment, Update, Project, Phase, User, Media, Contract.
**السبب**: legal evidence + audit trail
**التأثير**: C1, C2, schema additions

#### D3. Audit Log داخل الـ Transaction للعمليات المالية
**القرار**: للـ state changes المالية/critical، الـ audit log يبقى داخل الـ `$transaction`. لو فشل، الـ operation يـ rollback.
**السبب**: ما ينفعش payment موجود بدون audit
**التأثير**: C3, C4 — يخالف الـ comment الحالي في `audit-log.service.ts`

#### D4. Frontend `setup-workspace` Endpoint بيتحذف
**القرار**: الـ registration الـ user-flow بيبقى single step عبر `POST /auth/register-company` (الموجود في الـ Backend).
**السبب**: الـ Backend بيعمل Company + User في transaction، الـ Frontend بيقسمهم → orphan companies + race conditions
**التأثير**: C7, C9, F3 — UI تتـ refactor عشان كل البيانات في step واحدة

---

### Questions — Status

#### Q1. `editApproved` — مين يقدر يعدل بعد approval؟  ⏳ مفتوح
- **Skill 04 يقول**: submitter يقدر يعدل خلال 24h
- **Controller حالياً يقول**: SUPER_ADMIN + PROJECT_MANAGER only

#### Q2. Storage quota — hard block أم soft warning؟  ⏳ مفتوح

#### Q3. Audit log retention — 7 سنوات (Egyptian law) أم أكتر؟  ⏳ مفتوح

#### Q4. Mobile strategy — ✅ **Capacitor wrapper** (مع خيار RN مستقبلاً)
- ابدأ بـ Capacitor للسرعة + reuse الـ web codebase
- RN لو احتجنا native features أو deeper hardware integration

#### Q5. Real-time stack — ✅ **Supabase Realtime**
- استخدم الموجود الافتراضي
- WebSocket server منفصل لو احتجنا control أعلى مستقبلاً

#### Q6. ClamAV deployment — ✅ **Docker container منفصل في docker-compose**
- service مستقلة جنب الـ Redis
- API بيتصل عبر TCP socket داخل الـ Docker network

#### Q7. Subscription Tiers — ✅ **محدد**

| Tier | Projects | Users | Storage |
|---|---|---|---|
| **Starter** (default trial) | 3 | 10 | 10 GB |
| **Professional** | 15 | 50 | 50 GB |
| **Enterprise** | Unlimited | Unlimited | 200 GB |

تطبيق هذه الـ limits لازم يحصل في:
- `companies.service.ts.getStorageUsage` — موجود، يحتاج tier-aware threshold
- `users.service.ts.create` — check `userCount < tier.maxUsers` قبل invite
- `projects.service.ts.create` — check `activeProjectCount < tier.maxProjects` قبل إنشاء
- `media.service` — quota من `Company.storageQuota` (الموجود)

#### Q8. JWT lifecycle — ⏳ مفتوح
- 15 min (skill) vs Supabase default (1h)
- توصية مبدئية: نلتزم بـ 15 min — Supabase JWT lifetime configurable في الـ dashboard

---

### Estimated Total Effort

| Phase | Critical Path | Total Range |
|---|---|---|
| Phase 1 (Security) | 8-10 working days | 10-14 days (مع buffer) |
| Phase 2 High Priority | 20-25 working days | 25-35 days |
| Phase 2 Medium | 15-20 working days | 20-28 days |
| Phase 2 Low | flexible | 30+ days |

**Total to "production-ready MVP"**: ~6-8 weeks for 1 senior fullstack engineer.

---

### Recommended Execution Order — Updated 2026-05-16

Backend hardening (Phase 1 🔴) خلص. الـ gating criteria كلها passing عدا E2E suite. الترتيب الجديد:

1. **الأسبوع الجاي (P0 backend cleanup)**:
   - F5 — `NotificationsModule` + BullMQ worker (Redis موجود في `docker-compose.yml`)
   - F13 — Daily Update Tracker cron + SLA notifications
   - Redis-backed IdempotencyStore (يستبدل `InMemoryIdempotencyStore`)
   - Production migration baseline: `prisma migrate dev --name init` على الـ schema الأصلي
   - E2E suite للـ critical workflows (register → project → update → approve → payment)
2. **بعدها (Phase 2 — Frontend wiring)**:
   - F3 — حسم الـ auth architecture (decision: Backend-first عبر `/auth/register-company`)
   - F1 — `apps/web/src/lib/api.ts` (axios + retry + JWT interceptor + `unwrap` helper)
   - F2 — React Query hooks per resource + query keys factory
   - Fix `setup-workspace` redirect + logout flow
   - F4 — Connect pages بترتيب: Projects → Updates → Finance → Team → Audit
3. **Medium priority بعد ما الفرونت يتربط**:
   - F11 — Daily Update workflow UI (Submit form + Review Inbox + Force-Cancel UI)
   - F12 — Notification Center UI + bell badge
   - Missing pages: Subcontractors, Chat, Settings, Profile, Permissions matrix
4. **Low priority**:
   - F16 Supabase Realtime (chat + notifications)
   - F17 Capacitor wrapper
   - F18 Paddle billing
   - F14/F15 PDF/CSV exports

**Phase 2 gate criteria** (preserved):
- ✅ كل الـ Critical (🔴) في Phase 1 خلصت
- ✅ مفيش `prisma.X.delete()` في أي financial entity
- ✅ Audit log writes داخل transactions للـ state changes
- ⏳ Test coverage > 60% على services اللي اتعدلت — 13 spec حالياً، باقي projects/phases/users/companies/auth
- ⏳ Pen-test scenarios (multi-tenant isolation، authorization matrix) passing — يحتاج E2E suite

---

## Sessions القادمة

### Session 1.6 — MVT Hardening 🔴 BLOCKING قبل production
الـ 10 hacker findings من Session 1.5 (TEST-001 → TEST-010):
- TEST-001 + TEST-002 (CRITICAL): paired assertions على update + password redaction
- TEST-003 → TEST-005 (HIGH): entityId + fire-and-forget + tier ordering
- TEST-006 → TEST-010 (MEDIUM/LOW): defensive gaps
Effort: half-day (~110 lines assertions + 4 test variants)

### Session 1.7 — HTTP Integration Tests + CompaniesService specs
- supertest + Nest TestingModule على كل endpoints
- CompaniesService: updateCompany، updateSettings، getStorageUsage (~10 specs)
- JwtStrategy remaining rejection paths

### NEEDS-CODER (من Sessions سابقة — يدخل في أول session مناسب)
- CVE-USERS-001 — Last-SUPER_ADMIN race fix + spec (MEDIUM)
- @prisma/client/runtime/library → @prisma/client migration (payments/updates)
- A7 — Permission catalog whitelist (packages/shared-types)
