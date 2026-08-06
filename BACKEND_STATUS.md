# 🏗️ Backend Status — Construction SaaS

> **آخر تحديث:** 2026-05-15
> **النطاق:** `apps/api` (NestJS v11 + Prisma v7 + Supabase)
> **الحالة العامة:** Business logic كاملة لكل الـ 13 موديول، الـ infra hardening 95% خلصان، فاضل Phase 2 (Notifications + Real-time) والـ media security hardening.

---

## 📊 نظرة سريعة

| القسم | الحالة | اللي فاضل |
|---|---|---|
| **Database Schema** | ✅ 18 model + 3 migrations | لا شيء |
| **Auth & Authorization** | ✅ كامل | لا شيء |
| **Business Modules (13)** | ✅ كل الـ CRUD + state machines | media hardening فقط |
| **Cross-cutting Infra** | ✅ Guards + Interceptors + Filters + Idempotency + Resilience | لا شيء |
| **Audit & Compliance** | ✅ Append-only + DB triggers | لا شيء |
| **Testing** | ⚠️ 13 spec file (unit) | E2E tests + coverage للـ services الباقية |
| **Notifications** | ❌ commented-out | BullMQ worker + Redis integration |
| **Real-time (Chat/WS)** | ❌ REST فقط | WebSocket gateway |
| **Media Security** | ⚠️ basic | Magic-byte + storage quota + path traversal |
| **CI/CD & Deployment** | ❌ مفيش | Dockerfile + pipeline + secrets |

---

## 1️⃣ Database Schema — ✅ كامل

### 18 Model
```
Company → User → Project → Phase → Update → Media
                       ↓        ↓        ↓
                  Payment   ProjectAssignment   Comment
                       ↓        ↓        ↓
                  ChatRoom  PhaseSubContractor   UpdateVersion
                       ↓
              ChatParticipant + ChatMessage
                       
SubContractor + AuditLog + Notification + DailyUpdateTracker
```

### Enums (16)
`SubscriptionPlan`, `SubscriptionStatus`, `UserRole`, `Language`, `ProjectType`, `ProjectStatus`, `ProjectRole`, `PhaseStatus`, `UpdateStatus`, `MediaType`, `PaymentType`, `PaymentMethod`, `NotificationType`, `NotificationPriority`, `NotificationChannel`, `ChatRoomType`, `ChatMessageType`, `CommentType`, `CommentStatus`, `SubContractorStatus`, `AuditAction`, `DailyUpdateStatus`

### Migrations المطبّقة (3)
| التاريخ | الـ migration | الهدف |
|---|---|---|
| 2026-05-13 | `audit_immutability` | DB triggers تمنع UPDATE/DELETE/TRUNCATE على `audit_logs` |
| 2026-05-13 | `soft_delete_payments_media` | إضافة `deletedAt`, `deletedBy`, `deletionReason` للـ payments و media |
| 2026-05-13 | `audit_request_id` | ربط audit logs بـ correlation/request ID |

### مميزات حماية البيانات
- **Soft delete** على كل entity تقريباً (`deletedAt`, `deletedBy`, `deletionReason`)
- **Multi-tenant indexes** على كل `companyId` للأداء + العزل
- **Append-only audit log** مفروض على مستوى الـ DB (triggers)
- **Decimal(15,2)** على كل الـ amounts المالية (لا floating point)
- **BigInt** للـ storage quota
- **Storage quota** افتراضي 5GB per company

---

## 2️⃣ Auth & Authorization — ✅ كامل

### Endpoints
| Method | Route | Throttle | Public? |
|---|---|---|---|
| POST | `/auth/register` | 5/min | ✅ |
| POST | `/auth/login` | 5/min | ✅ |
| POST | `/auth/refresh` | 30/min | ✅ |
| POST | `/auth/logout` | default | ❌ |

### Auth Flow
```
Supabase (identity) → JWT (access_token)
        ↓
JwtStrategy → reads payload.sub (supabaseAuthId)
        ↓
Fetches User from DB → builds JwtPayload {sub, email, userId, companyId, role, permissions[]}
        ↓
TenantIsolationMiddleware → attaches companyId on req.user
```

### مميزات الأمان
- **HttpOnly + Secure + SameSite=Strict cookies** للـ refresh token
- **Cookie path narrowing** على `/api/v1/auth` فقط
- **Token rotation** على كل refresh
- **Signed cookies** لو `COOKIE_SECRET` موجود
- **Login attempts tracker** + tests (`login-attempts.tracker.ts`)
- **Throttling** صارم للـ register/login

### 7 Roles (Hierarchy)
`SUPER_ADMIN > PROJECT_MANAGER > SITE_ENGINEER > SUPERVISOR > ACCOUNTANT > WORKER > CLIENT`

### 3 Guards Global (بترتيب)
1. `ThrottlerGuard` — DOS protection
2. `JwtAuthGuard` — identity (skip لـ `@Public()` فقط)
3. `RolesGuard` — `@Roles(...)`
4. `PermissionsGuard` — fine-grained permissions

---

## 3️⃣ Business Modules — ✅ 13 موديول كامل

### 🏢 CompaniesModule (255 LOC service)
- `GET /companies/me` — كل المستخدمين
- `PATCH /companies/me` — SUPER_ADMIN
- `PATCH /companies/settings` — SUPER_ADMIN
- `GET /companies/storage` — SUPER_ADMIN
- **`TierLimitsService`** منفصل — حدود الـ subscription plans + tests ✅

### 👤 UsersModule (559 LOC service)
- `GET /users` + `GET /users/me` + `GET /users/:id`
- `PATCH /users/me` (self) + `PATCH /users/:id` (admin)
- `POST /users` (invite) + `DELETE /users/:id` (soft)
- `PATCH /users/:id/role` + `PATCH /users/:id/permissions`
- `POST /users/:id/deactivate` + `/activate`
- صلاحيات: SUPER_ADMIN فقط للإنشاء/الحذف/تغيير الـ role

### 📋 ProjectsModule (556 LOC service)
- CRUD كامل + `PATCH /:id/status` (state machine)
- `POST /:id/assignments` + `DELETE /:id/assignments/:userId`
- **State Machine:** `DRAFT → IN_PROGRESS → ON_HOLD ↔ IN_PROGRESS → COMPLETED/CANCELLED`
- Visibility filtering حسب الـ role
- Soft delete مع reason إلزامي

### 🔧 PhasesModule (357 LOC service)
- CRUD كامل + `PATCH /:id/progress` (override) + `PATCH /:id/reorder`
- حساب `overallProgress` تلقائياً للمشروع
- `progress = Σ(phase.progress × phase.weight) / Σ(phase.weight)`

### 📝 UpdatesModule (873 LOC — قلب النظام)
- CRUD على Drafts + state transitions:
  - `POST /:id/submit` — DRAFT → PENDING
  - `POST /:id/approve` — PENDING → APPROVED (**idempotent**)
  - `POST /:id/reject` — PENDING → REJECTED
  - `POST /:id/force-cancel` — APPROVED → FORCE_CANCELLED (**SUPER_ADMIN + idempotent**)
  - `PATCH /:id/edit-approved` — لحد 24 ساعة بعد الـ approval
- **`UpdateVersion`** snapshot على كل تعديل بعد الـ approval
- **FORCE_CANCEL** يعكس الـ progress + يخلق `SUNK_COST` payment
- `GET /:id/versions` — history للـ SUPER_ADMIN/PM
- Submitter ownership check إلزامي

### 💰 PaymentsModule (378 LOC service + tests)
- `GET /projects/:pid/payments` + `/summary` + `GET /payments/:id`
- `POST /projects/:pid/payments` — **idempotent (Idempotency-Key header)**
- `DELETE /payments/:id` — SUPER_ADMIN + soft + reason ≥ 20 char إلزامي
- Hard delete ممنوع (financial records)

### 📸 MediaModule (314 LOC + tests)
- `POST /updates/:uid/media` + `GET /updates/:uid/media`
- `POST /media/upload-url` — signed upload URL (Supabase Storage)
- `DELETE /media/:id` — soft + reason إلزامي
- حد أقصى **20 media per update**
- Supabase Storage client مدمج

### 💬 CommentsModule (306 LOC service)
- `GET /updates/:uid/comments` + nested replies
- CRUD + `PATCH /:id/status` (OPEN → ACKNOWLEDGED → RESOLVED)
- 3 أنواع: COMMENT, REVIEW_REQUEST, CHANGE_REQUEST
- Soft delete

### 🏗️ SubContractorsModule (276 LOC)
- CRUD على company sub-contractors
- `POST /phases/:pid/sub-contractors` — assign لمرحلة
- `PATCH /phase-assignments/:id` — تحديث `agreedCost` و `actualCost`
- Rating + total projects tracking

### 🗨️ ChatModule (213 LOC — REST فقط)
- `GET /projects/:pid/chat-rooms` + `POST` (create)
- `GET /chat-rooms/:rid/messages` + `POST` (send)
- `POST /chat-rooms/:rid/read` — mark as read
- ⚠️ **مفيش WebSocket gateway لسه** — polling فقط

### 🔍 AuditModule (295 LOC + spec)
- `GET /audit-logs` — SUPER_ADMIN فقط
- Filters: entityType, action, userId, from, to
- **Append-only** على مستوى الـ DB (triggers)
- `logInTransaction()` — كل audit مع الـ business transaction
- يسجّل: oldValues, newValues, reason, ipAddress, userAgent, requestId
- Retention: 7 سنين (قانون التجارة المصري م.24)

### ❤️ HealthModule
- `GET /health` + `GET /health/db` + `GET /health/storage` (189 LOC)
- Liveness + Readiness probes

---

## 4️⃣ Cross-cutting Infrastructure — ✅ كامل

### `common/guards/`
- `JwtAuthGuard` — يتجاوز `@Public()` فقط
- `RolesGuard` — يفرض `@Roles(...)`
- `PermissionsGuard` — fine-grained permissions

### `common/middleware/`
- `CorrelationIdMiddleware` — request tracing (UUID لكل request) + spec
- `TenantIsolationMiddleware` — يحط `companyId` على `req.user`

### `common/interceptors/`
- `TransformInterceptor` — global response envelope `{success, data, meta}`

### `common/filters/`
- `GlobalExceptionFilter` — يطبّع كل الأخطاء، يمنع leak الـ stack traces

### `common/errors/`
- `AppException` + `error-codes.ts` — typed error codes موحّدة

### `common/decorators/`
- `@Public()`, `@Roles(...)`, `@Permissions(...)`, `@CurrentUser()`, `@IdempotencyKey()`

### `common/idempotency/` (module)
- `IdempotencyService` — body-hash + key validation
- `InMemoryStore` — ⚠️ هيتبدّل بـ Redis في الـ production
- **Tests** ✅

### `common/resilience/`
- `CircuitBreaker` + tests ✅
- `Retry` (exponential backoff) + tests ✅

### `common/config/`
- `throttler.config.ts` — 3 profiles (default 100/min, auth 5/min, heavy 10/min)
- `cors.config.ts`
- `security.config.ts` (Helmet)
- `env-validation.ts` + spec ✅

### `common/context/`
- `RequestContext` — AsyncLocalStorage لتتبع الـ correlation ID

---

## 5️⃣ State Machines المفعّلة

### Projects
```
DRAFT ──→ IN_PROGRESS ──→ ON_HOLD ──→ IN_PROGRESS
                      └─→ COMPLETED (terminal)
                      └─→ CANCELLED (terminal)
DRAFT ──→ CANCELLED
```

### Updates (قلب النظام)
```
DRAFT → PENDING → APPROVED ─→ FORCE_CANCELLED (SUPER_ADMIN فقط)
              └─→ REJECTED → DRAFT (بعد تعديل)
```
- APPROVED قابل للتعديل خلال **24 ساعة** بس
- كل تعديل بعد approval → `UpdateVersion` snapshot
- FORCE_CANCEL → reverse progress + create `SUNK_COST` payment

### Comments
```
OPEN → ACKNOWLEDGED → RESOLVED
```

---

## 6️⃣ Testing — ⚠️ Unit Tests فقط

### Spec files موجودة (13)
| الملف | الغرض |
|---|---|
| `app.controller.spec.ts` | Root smoke test |
| `env-validation.spec.ts` | تحقق الـ env vars |
| `idempotency.service.spec.ts` | Idempotency logic |
| `correlation-id.middleware.spec.ts` | Request tracing |
| `circuit-breaker.spec.ts` | Resilience |
| `retry.spec.ts` | Exponential backoff |
| `audit-log.service.spec.ts` | Audit logging |
| `login-attempts.tracker.spec.ts` | Brute force protection |
| `tier-limits.service.spec.ts` | Subscription limits |
| `health.controller.spec.ts` | Health probes |
| `media.service.spec.ts` | Media CRUD |
| `payments.service.spec.ts` | Payments logic |
| `updates.service.spec.ts` | Update state machine |

### اللي ناقص
- **E2E tests** — `test/app.e2e-spec.ts` موجود (skeleton) لكن مفيش tests فعلية
- Spec files لـ: projects, phases, comments, sub-contractors, chat, users, companies, auth services
- Coverage report لم يُربط
- Integration tests للـ workflows الكاملة (DRAFT → APPROVED مثلاً)

---

## 7️⃣ اللي فاضل (Backlog مرتّب بالأولوية)

### 🔴 P0 — Production blockers (الأهم)

#### 1. Media Security Hardening (C17–C21 في PLAN)
**موقعها:** `apps/api/src/modules/media/media.service.ts:11-16`
- [ ] **Magic-byte validation** — تحقق فعلي من نوع الملف بدل الاعتماد على الـ mimeType من الـ client
- [ ] **Trust fileSize/mimeType من الـ client** ← ثغرة دلوقتي
- [ ] **Public bucket reads / Signed URL expiry** — تطبيق expiry policy
- [ ] **Storage quota enforcement** — منع تجاوز `company.storageQuota` (5GB افتراضي)
- [ ] **Path traversal protection** — sanitize الـ uploaded filenames

#### 2. NotificationsModule
**موقعها:** `apps/api/src/app.module.ts:76` (commented-out)
- [ ] إعداد BullMQ worker module
- [ ] ربط Redis (موجود في `docker-compose.yml`)
- [ ] Producers في: Updates, Payments, Comments, DailyUpdateTracker
- [ ] Channels: IN_APP (موجود في الـ DB) → PUSH → EMAIL → SMS
- [ ] Retry policy + dead letter queue

#### 3. DailyUpdateTracker Cron Job
- [ ] Worker يفحص كل deadline يومياً
- [ ] يخلق `Notification` نوع `DEADLINE_REMINDER` / `DEADLINE_MISSED`
- [ ] SLA breach detection للـ admin

#### 4. Production Database Migrations
- [ ] حالياً `prisma db push` فقط — مفيش full migration history للـ schema الأصلي
- [ ] لازم `prisma migrate dev --name init` لإنشاء baseline migration

### 🟡 P1 — مهم لكن مش blocker

#### 5. Real-time Chat (WebSocket)
- [ ] `ChatGateway` (Socket.io أو native WS)
- [ ] Room-based broadcasting
- [ ] Online presence tracking
- [ ] Typing indicators

#### 6. Redis-backed Idempotency Store
**موقعها:** `common/idempotency/in-memory-store.ts`
- [ ] استبدال الـ in-memory بـ Redis-backed implementation
- [ ] TTL = 24 ساعة على كل key

#### 7. E2E Test Suite
- [ ] Full workflow tests (register → create project → submit update → approve → payment)
- [ ] RBAC tests لكل role
- [ ] Multi-tenant isolation tests

#### 8. Audit Best-effort Metric
**موقعها:** `audit-log.service.ts:175` (TODO)
- [ ] emit metric `audit.log.best_effort_failed` للـ alerting

### 🟢 P2 — تحسينات (Nice-to-have)

#### 9. CI/CD
- [ ] GitHub Actions workflow: lint → typecheck → test → build
- [ ] Docker image للـ API
- [ ] Migration runner في الـ pipeline

#### 10. Deployment Config
- [ ] `Dockerfile` للـ `apps/api`
- [ ] `docker-compose.prod.yml`
- [ ] Secrets management (Doppler / Vault)
- [ ] Environment-specific configs

#### 11. Observability
- [ ] Pino structured logging (موجود partially)
- [ ] OpenTelemetry tracing
- [ ] Prometheus metrics endpoint
- [ ] Sentry للأخطاء

#### 12. API Documentation
- [ ] Swagger UI كامل (`@nestjs/swagger` مثبت — محتاج decorators)
- [ ] Postman collection

#### 13. Reports & Analytics
- [ ] `ReportsModule` — تقارير financial / progress / SLA
- [ ] PDF export
- [ ] Excel export

#### 14. Frontend Integration
- [ ] الفرونت حالياً Supabase direct — قرار: نوحّد على NestJS API
- [ ] إنشاء `apps/web/src/lib/api.ts` (axios client)
- [ ] react-query hooks
- [ ] استبدال الـ mock data بالـ API الحقيقي

---

## 8️⃣ Decision Log (قرارات مرجعية)

| القرار | الحالة | الـ rationale |
|---|---|---|
| Multi-tenant بـ `companyId` على كل entity | ✅ مطبّق | بسيط + يفي بمتطلبات SaaS |
| Soft delete على كل حاجة | ✅ مطبّق | متطلب قانوني (7 سنين retention) |
| Audit log append-only على مستوى الـ DB | ✅ مطبّق | حتى SUPER_ADMIN ميقدرش يعدّل |
| Idempotency على الـ approve/force-cancel/payments | ✅ مطبّق | منع double-click bugs |
| Refresh token في httpOnly cookie | ✅ مطبّق | XSS + CSRF protection |
| Supabase direct vs NestJS API للـ auth | ❌ معلّق | الفرونت بيكلم Supabase مباشرة، API عنده `registerCompany` — لازم نتفق |
| In-memory idempotency vs Redis | ❌ مؤجل | شغّال للـ dev، Redis قبل الـ production |

---

## 9️⃣ Known Issues (مذكورة في CLAUDE.md)

1. **Auth architecture conflict** — الفرونت يتكلم Supabase مباشرة، الـ NestJS API عنده onboarding منفصل
2. **`setup-workspace` redirect bug** — بعد النجاح بيـredirect لـ `/pricing` بدل `/dashboard`
3. **Dev middleware bypass** — Auth disabled في development
4. **مفيش API client في الفرونت** — `axios` مثبت لكن مفيش `src/lib/api.ts`
5. **Secondary sidebar لا تفلتر بالـ role** — `roles` field موجود في navigation config لكن غير مُفعّل
6. **`prisma.config.ts` لا تحذفه** — Prisma 7 محتاجه

---

## 🎯 الخطوة التالية المقترحة

> **اقتراح:** أولوية P0 #1 (Media Security Hardening) — لأنه ثغرة أمنية حقيقية في الكود الحالي، وحلها صغير ومحدود النطاق. بعدها NotificationsModule لأن الـ DailyUpdateTracker والـ workflows محتاجاها فعلياً.

**ترتيب مقترح للأسبوع الجاي:**
1. ✅ Media: magic-byte + storage quota + path sanitization (~ يومين)
2. ✅ NotificationsModule + BullMQ worker (~ 3 أيام)
3. ✅ DailyUpdateTracker cron + SLA notifications (~ يومين)
4. ✅ Prisma initial migration + DB push → migrate دفعة واحدة (~ نصف يوم)
5. ✅ E2E tests للـ workflows الحرجة (~ يومين)

**بعد ما الباك اند يخلص هاردنينج:** نبدأ في ربط الفرونت بالـ API (يبني `apps/web/src/lib/api.ts` + react-query hooks).
