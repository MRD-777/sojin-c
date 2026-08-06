# 📔 الملف 5 — Database Schema + Cross-cutting Infrastructure + Enums

> الجزء الأخير والمرجعي. بيغطي: قاعدة البيانات كاملة (كل model + relations + fields)، البنية المشتركة (Guards/Interceptors/Filters/Middleware/Idempotency/Resilience/Supabase/Errors)، وكل الـ Enums.

---

═══════════════════════════════════════════════════════════════

## 🗄️ القسم 1: Database Schema (`prisma/schema.prisma`)

- **Provider:** PostgreSQL. **ORM:** Prisma 7 (الـ connection URL في `prisma.config.ts` مش في الـ schema).
- **19 model** (17 entity أساسية + UpdateVersion + DailyUpdateTracker + IdempotencyRecord).
- **اتفاقيات عامة:**
  - كل الـ IDs هي `uuid` (`@db.Uuid`).
  - أسماء الأعمدة snake_case في DB (`@map`)، camelCase في الكود.
  - معظم الـ entities فيها `deletedAt` (soft delete) + `createdAt` + `updatedAt`.
  - علاقات الـ tenant بترجع لـ `companyId`.

### 1. Company (الشركة) — الجذر
الكيان الجذر للـ multi-tenancy. كل حاجة بترجع له.
| الحقل | النوع | الشرح |
|------|------|------|
| `id` | uuid PK | |
| `name` | String | اسم الشركة |
| `slug` | String **unique** | معرّف URL ثابت (مولّد بـ stem + random suffix) |
| `logo`, `phone`, `address`, `commercialRegister`, `taxId`, `employeeCount`, `specialization` | String? | بيانات اختيارية |
| `email` | String | إجباري |
| `subscriptionPlan` | SubscriptionPlan | default TRIAL |
| `subscriptionStatus` | SubscriptionStatus | default TRIAL |
| `storageQuota` | BigInt | default 5GB (5368709120) |
| `storageUsed` | BigInt | default 0 — بيتزوّد مع رفع media |
| `currency` | String | default "EGP" |
| `timezone` | String | default "Africa/Cairo" — مستخدم في حساب يوم التحديثات |
| `settings` | Json | default `{}` |
| `createdAt/updatedAt/deletedAt` | DateTime | |
- **Relations:** users[], projects[], subContractors[], auditLogs[].

### 2. User (المستخدم)
| الحقل | النوع | الشرح |
|------|------|------|
| `id` | uuid PK | |
| `companyId` | uuid FK | الـ tenant |
| `supabaseAuthId` | String? **unique** | الربط بـ Supabase Auth (مش بيترجّع في الـ API) |
| `name`, `email` | String | |
| `phone`, `specialty`, `avatar` | String? | |
| `role` | UserRole | default WORKER |
| `customPermissions` | Json | default `[]` — صلاحيات `resource.action` |
| `isActive` | Boolean | default true |
| `notificationPreferences` | Json | default `{}` |
| `preferredLanguage` | Language | default AR |
| `lastLogin` | DateTime? | بيتحدّث مرة في الـ login بس (A2) |
| `createdAt/updatedAt/deletedAt` | | |
- **Constraints:** `@@unique([companyId, email])` — الإيميل فريد جوه الشركة. indexes على companyId, role, [companyId, role].
- **Relations كتيرة:** company, clientProjects (كـ عميل), projectAssignments, submittedUpdates, reviewedUpdates, forceCancelledUpdates, payments, deletedPayments, deletedMedia, notifications, chatParticipations, chatMessages, comments, auditLogs, createdChatRooms, dailyTrackers, changedVersions.

### 3. Project (المشروع)
| الحقل | النوع | الشرح |
|------|------|------|
| `id` | uuid PK | |
| `companyId` | uuid FK | |
| `clientId` | uuid FK | العميل (User بدور CLIENT) |
| `name` | String | |
| `description` | Text? | |
| `location` | String? | |
| `type` | ProjectType | default FULL_FINISHING |
| `status` | ProjectStatus | default DRAFT |
| `startDate`, `expectedEndDate`, `actualEndDate` | Date? | |
| `totalBudget` | **Decimal(15,2)** | default 0 |
| `overallProgress` | Int | default 0 — محسوب (weighted avg) |
| `dailyUpdateDeadline` | String | default "17:00" (HH:mm) |
- **Indexes:** companyId, [companyId, status], clientId.
- **Relations:** company, client, phases[], payments[], assignments[], chatRooms[], dailyTrackers[].

### 4. ProjectAssignment (تعيين الموظفين)
ربط User بـ Project بدور محدد.
| الحقل | النوع | الشرح |
|------|------|------|
| `projectId`, `userId` | uuid FK | |
| `roleInProject` | ProjectRole | |
| `isRequiredDailyUpdate` | Boolean | default false |
| `assignedAt` | DateTime | |
| `removedAt` | DateTime? | soft-remove (null = نشط) |
- **Constraint:** `@@unique([projectId, userId])`.

### 5. Phase (مرحلة المشروع)
| الحقل | النوع | الشرح |
|------|------|------|
| `projectId` | uuid FK | |
| `name` | String | |
| `description` | Text? | |
| `order` | Int | default 0 — ترتيب العرض |
| `weight` | Int | default 1 — وزن في حساب التقدم |
| `status` | PhaseStatus | default NOT_STARTED |
| `progress` | Int | default 0 (0–100) |
| `startDate`, `expectedEndDate` | Date? | |
| `budget`, `actualCost` | **Decimal(15,2)** | default 0 |
- **Indexes:** projectId, [projectId, order].
- **Relations:** project, updates[], subContractors[] (PhaseSubContractor).

### 6. Update (التحديث اليومي) — قلب النظام
| الحقل | النوع | الشرح |
|------|------|------|
| `phaseId` | uuid FK | |
| `submittedBy` | uuid FK | اللي قدّمه |
| `reviewedBy` | uuid? FK | اللي راجعه |
| `title` | String | |
| `description`, `workDone`, `workRemaining` | Text? | |
| `workersCount` | Int | default 0 |
| `workHours` | **Decimal(5,2)** | default 0 |
| `materialsUsed` | Json | default `[]` — `[{name, quantity, unit, cost}]` |
| `cost` | **Decimal(15,2)** | default 0 |
| `progressIncrement` | Int | default 0 — كام % يضيف للمرحلة عند الاعتماد |
| `status` | UpdateStatus | default DRAFT |
| `rejectionReason`, `forceCancelReason` | Text? | |
| `forceCancelledBy` | uuid? FK | |
| `isLocked` | Boolean | default false — بعد 24 ساعة من الاعتماد |
| `lockedAt`, `submittedAt`, `reviewedAt` | DateTime? | |
- **Indexes:** phaseId, submittedBy, status, [phaseId, status], [submittedBy, status].
- **Relations:** phase, submitter, reviewer, forceCanceller, media[], comments[], versions[].

### 7. Media (الوسائط)
| الحقل | النوع | الشرح |
|------|------|------|
| `updateId` | uuid FK | |
| `type` | MediaType | |
| `url` | String | **الـ storage path** (مش URL كامل) |
| `thumbnailUrl` | String? | |
| `fileSize`, `originalFileSize` | Int | bytes (محسوبة server-side) |
| `mimeType` | String | (محسوبة من magic bytes) |
| `caption` | String? | |
| `order` | Int | default 0 |
| `deletedAt`, `deletedBy`, `deletionReason` | | soft delete مع سبب |
- **Indexes:** updateId, [updateId, deletedAt].

### 8. Payment (المدفوعات)
| الحقل | النوع | الشرح |
|------|------|------|
| `projectId` | uuid FK | |
| `amount` | **Decimal(15,2)** | |
| `type` | PaymentType | |
| `method` | PaymentMethod | default CASH |
| `description` | Text? | |
| `date` | Date | |
| `receiptUrl` | String? | |
| `recordedBy` | uuid FK | |
| `deletedAt`, `deletedBy`, `deletionReason` | | soft delete (إجباري قانوناً) |
- **Indexes:** projectId, [projectId, type], [projectId, deletedAt].

### 9. Notification (الإشعارات)
معرّف في الـ schema لكن **الموديول لسه مش متعمل** (Phase 2 / F5 — محتاج Redis+BullMQ).
| الحقل | النوع | |
|------|------|--|
| `userId` | uuid FK | |
| `type` | NotificationType | |
| `title`, `body` | String/Text | |
| `referenceType`, `referenceId` | String?/uuid? | الكيان المرتبط |
| `priority` | NotificationPriority | default NORMAL |
| `channel` | NotificationChannel | default IN_APP |
| `isRead` | Boolean | default false |
| `scheduledFor` | DateTime? | |

### 10–12. Chat (ChatRoom / ChatParticipant / ChatMessage)
- **ChatRoom:** projectId, type (ChatRoomType, default DIRECT), name?, createdBy. Relations: participants[], messages[].
- **ChatParticipant:** roomId, userId, joinedAt, lastReadAt. `@@unique([roomId, userId])`.
- **ChatMessage:** roomId, senderId, content (Text), type (ChatMessageType, default TEXT), attachmentUrl?, isRead, deletedAt?. Indexes: roomId, [roomId, createdAt].

### 13. Comment (التعليقات)
| الحقل | النوع | الشرح |
|------|------|------|
| `updateId`, `userId` | uuid FK | |
| `content` | Text | |
| `type` | CommentType | default COMMENT |
| `status` | CommentStatus? | default OPEN |
| `parentId` | uuid? FK | للردود (self-relation "CommentReplies") |
- **Indexes:** updateId, [updateId, type].

### 14–15. SubContractor / PhaseSubContractor
- **SubContractor:** companyId, name, specialty, phone, email?, rating (Decimal(2,1)), totalProjects (Int), notes?. Index: companyId.
- **PhaseSubContractor:** phaseId, subContractorId, agreedCost/actualCost (Decimal(15,2)), status (SubContractorStatus, default ACTIVE). `@@unique([phaseId, subContractorId])`.

### 16. AuditLog (سجل المراجعة) — Append-only
| الحقل | النوع | الشرح |
|------|------|------|
| `companyId`, `userId` | uuid FK | |
| `userRole` | String | snapshot وقت العملية |
| `entityType` | String | lowercase snake_case |
| `entityId` | uuid | |
| `action` | AuditAction | |
| `oldValues`, `newValues` | Json? | الحقول اللي اتغيرت (sanitized) |
| `reason` | Text? | إجباري للعمليات السلبية |
| `ipAddress`, `userAgent`, `requestId` | String? | للـ forensics |
- **Indexes:** companyId, [companyId, entityType], [companyId, createdAt], [entityType, entityId], requestId.
- **🔒 محمي على مستوى DB:** migration `audit_immutability` بيضيف triggers بتمنع UPDATE/DELETE/TRUNCATE (حتى الـ SUPER_ADMIN مايقدرش يعبث). الاحتفاظ: 7 سنين (القانون التجاري المصري مادة 24).

### 17. UpdateVersion (إصدارات التحديث)
snapshot غير قابل للتعديل لحالة التحديث قبل أي تعديل-بعد-اعتماد.
| الحقل | النوع | الشرح |
|------|------|------|
| `updateId` | uuid FK | |
| `versionNumber` | Int | |
| `snapshot` | Json | الحالة الكاملة |
| `changedBy` | uuid FK | |
| `changeReason` | Text? | |
- **Constraint:** `@@unique([updateId, versionNumber])` — **CVE-UPD-007**: بيمنع تعديلين متوازيين من إدخال نفس الرقم (Postgres بيـ abort التاني، العميل يعيد المحاولة بـ count جديد).

### 18. DailyUpdateTracker (متتبع المواعيد)
تتبّع التزام كل user بالتحديث اليومي على كل مشروع. (الموديول الفعلي لسه مش منفّذ كـ controller، بس الـ model موجود.)
| الحقل | النوع | |
|------|------|--|
| `projectId`, `userId` | uuid FK | |
| `date` | Date | |
| `deadline` | String | HH:mm |
| `status` | DailyUpdateStatus | default PENDING |
| `submittedAt`, `delayMinutes`, `notificationSentToAdmin` | | |
- **Constraint:** `@@unique([projectId, userId, date])`.

### 19. IdempotencyRecord (سجل الطلبات المكرّرة)
تخزين atomic لحماية الـ replay على الـ Idempotency-Key.
| الحقل | النوع | الشرح |
|------|------|------|
| `tenantId` | uuid | الشركة |
| `key` | String | الـ Idempotency-Key |
| `requestFingerprint` | String | SHA-256 للـ body |
| `statusCode` | Int | |
| `body` | Json | الـ response المخزّن |
| `expiresAt` | DateTime | 24 ساعة |
- **PK:** `@@id([tenantId, key])` (composite). Index على expiresAt.
- **CVE-UPD-002:** بيعيش في Prisma عشان `saveInTransaction` يقدر يخزّن السجل في **نفس** الـ tx بتاع الآثار اللي بيحميها (approve, force-cancel, payment). الـ store القديم (in-memory) كان بيخزّن **بعد** الـ commit — فشل عابر كان بيخلّي الآثار committed بس المفتاح uncached → retry يعيد التنفيذ.

### الـ Migrations الموجودة
| Migration | الغرض |
|----------|------|
| `audit_immutability` | triggers تمنع تعديل audit_logs |
| `soft_delete_payments_media` | إضافة deletedBy/deletionReason |
| `audit_request_id` | إضافة requestId للـ audit |
| `cleanup_orphan_project_assignments` | تنظيف |
| `add_idempotency_records_table` | جدول IdempotencyRecord (CVE-UPD-002) |
| `update_versions_unique_per_update` | unique constraint (CVE-UPD-007) |

---

═══════════════════════════════════════════════════════════════

## 🛡️ القسم 2: Cross-cutting Infrastructure

### الـ Guards (4 — global، بتشتغل بالترتيب ده)

**1. `ThrottlerGuard`** (من @nestjs/throttler) — rate limiting. 3 profiles في `throttler.config.ts`:
- `default`: 100/دقيقة (catch-all).
- `auth`: 5/دقيقة (login/register/refresh).
- `heavy`: 10/دقيقة (exports، audit listing).
- المفتاح من `req.ip` (بيحترم trust-proxy).

**2. `JwtAuthGuard`** (`jwt-auth.guard.ts`, 41 سطر) — بيمتد `AuthGuard('jwt')`.
- بيتخطّى الـ endpoints اللي عليها `@Public()` (بيقرا metadata `IS_PUBLIC_KEY`).
- غير كده بينفّذ passport jwt → بيشغّل `JwtStrategy.validate`.
- `handleRequest`: لو فيه error أو مفيش user → `UnauthorizedException`.

**3. `RolesGuard`** (`roles.guard.ts`, 59 سطر) — بيقرا `@Roles(...)`.
- بيتخطّى `@Public()`. لو مفيش roles مطلوبة → مسموح.
- **`SUPER_ADMIN` بيعدّي على كل حاجة** (`if user.role === 'SUPER_ADMIN' return true`).
- بيتأكد إن `user.role` في قائمة الأدوار المطلوبة، وإلا `403`.

**4. `PermissionsGuard`** (`permissions.guard.ts`, 64 سطر) — بيقرا `@Permissions(...)`.
- بيتخطّى `@Public()`. لو مفيش permissions مطلوبة → مسموح.
- `SUPER_ADMIN` عنده كل الصلاحيات.
- بيتأكد إن المستخدم عنده **كل** الصلاحيات المطلوبة (`every`)، وإلا `403`.

> ملاحظة: الـ `@Permissions` decorator موجود لكن معظم الـ endpoints بتعتمد على `@Roles` بس.

### الـ Decorators (`common/decorators/`)
| Decorator | الوظيفة |
|----------|--------|
| `@Public()` | علّم endpoint إنه مفتوح (مفيش auth). `SetMetadata(IS_PUBLIC_KEY, true)` |
| `@Roles(...roles)` | الأدوار المسموحة |
| `@Permissions(...perms)` | الصلاحيات الدقيقة |
| `@CurrentUser(field?)` | يطلّع الـ JwtPayload من `request.user` (أو حقل منه) |
| `@IdempotencyKey()` | يطلّع ويتحقق من header `Idempotency-Key` (16–64 char، `[A-Za-z0-9_-]`، وإلا 400) |

### الـ Interceptor — `TransformInterceptor` (73 سطر)
- بيلفّ كل response في `{ success: true, data, meta }`.
- لو الـ data أصلاً فيها `success` → بيسيبها.
- لو فيها `{ items, total }` → بيحوّلها لـ `{ data: items, meta: { total, page, limit, timestamp } }`.
- غير كده → `{ data, meta: { timestamp } }`.

### الـ Filter — `GlobalExceptionFilter` (207 سطر)
بيوحّد كل الأخطاء على 3 طبقات:
1. **`AppException`** (الهرمية بتاعتنا) — بيسجّل بمستوى مناسب ويرجّع envelope بالـ code الرسمي.
   - `SystemException` → `logger.error` (+ alert TODO).
   - `ValidationException` → `logger.debug`.
   - `BusinessException` → `logger.warn`.
2. **`HttpException`** (أخطاء Nest الأخرى، زي ValidationPipe) — بيحافظ على الـ status ويطلّع رسالة نظيفة. بيحوّل أخطاء class-validator (array messages) لرسالة موحّدة + بيحط الـ errors في الـ envelope.
3. **أي حاجة تانية** — `logger.error` بالـ stack الكامل + يرجّع 500 عام مع الـ requestId.
- كل response فيه: `{ success: false, code, message, requestId, path, timestamp }`.

### الـ Middleware (بتشتغل قبل الـ guards)
**1. `CorrelationIdMiddleware`** (43 سطر) — **بيشتغل الأول.**
- بيقرا `X-Request-Id` من العميل لو موجود وبيطابق `^[A-Za-z0-9_-]{16,64}$` (وإلا UUID جديد — مانثقش في IDs العميل عشان log injection).
- بيرجّعه في response header + بيشغّل باقي الـ request جوه `RequestContext.run` (AsyncLocalStorage).

**2. `TenantIsolationMiddleware`** (43 سطر) — خفيف.
- وقت الـ middleware، `req.user` لسه مش موجود (ده شغل الـ guard). فبينسخ `companyId` بس لو فيه user متعلّق (hook point مستقبلي للـ RLS).
- **العزل الحقيقي للـ tenant في:** JwtStrategy (بيحمّل companyId) + الـ services (`where: { companyId }` صريح).

### الـ RequestContext (`common/context/request-context.ts`, 44 سطر)
- AsyncLocalStorage بيخزّن `{ requestId, startedAt }` لكل request.
- `RequestContext.requestId()` بيرجّع الـ ID في أي مكان في الـ scope (الـ logger والـ audit بيستخدموه).
- مدمج في Node ≥16، مفيش dependency، بيحترم async/await.

### الـ Idempotency (`common/idempotency/`)
- **`IdempotencyService`** (139 سطر): `lookup` (يقارن fingerprint — لو نفس المفتاح ببيانات مختلفة → 422)، `save` (برّه tx)، `saveInTransaction` (جوه tx — المفضّل للعمليات الحرجة). الـ fingerprint = SHA-256 لـ JSON مرتّب المفاتيح. TTL = 24 ساعة.
- **`PrismaIdempotencyStore`** (100 سطر): الـ store الفعلي (default). `get` (بـ composite PK + lazy eviction للمنتهي)، `set`/`setInTransaction` (upsert).
- **`InMemoryIdempotencyStore`** (85 سطر): **مش مستخدم حالياً** — محتفظ به للـ reference والـ tests. (single-instance fallback).
- **الموديول global** — أي موديول يقدر يحقن `IdempotencyService`.

### الـ Resilience (`common/resilience/`)
- **`retryWithBackoff`** (`retry.ts`, 95 سطر): exponential backoff مع full jitter. للـ calls الـ idempotent بس (مش POST خام). `defaultShouldRetry` بيعيد بس على أخطاء transient (timeout, econnrefused, 502/503/504...).
- **`CircuitBreaker`** (`circuit-breaker.ts`, 124 سطر): 3 حالات (CLOSED/OPEN/HALF_OPEN). بعد `threshold` فشل متتالي (default 5) → OPEN (fail fast). بعد `cooldownMs` (default 30s) → HALF_OPEN (probe واحد). نجاح → CLOSED. **process-local** (مش مشترك بين instances).

### الـ Supabase Admin (`common/supabase/supabase-admin.provider.ts`, 72 سطر)
- provider **global** يصدّر token `SUPABASE_ADMIN_CLIENT`.
- بيبني Supabase client واحد بالـ service-role key (`autoRefreshToken: false`, `persistSession: false`).
- مصدر حقيقة واحد (قبل كده auth و users كانوا بيبنوا كل واحد client بتاعه).
- بيرمي عند الإقلاع لو الـ env vars ناقصة (fail-fast).
- **ملاحظة:** `MediaSecurityService` بيبني client خاص بيه (مش بيستخدم ده) عشان Storage.

### الـ Errors (`common/errors/`)
- **`error-codes.ts`** (72 سطر): registry للـ codes بصيغة `<MODULE>_<TIER>_<NUM>`. الـ tiers: VAL (400)، BIZ (4xx)، SYS (500). الـ codes **ثابتة** — الـ frontend بيترجم على الـ code مش الرسالة.
- **`app-exception.ts`** (88 سطر): الهرمية:
  - `AppException` (base، بيمتد HttpException). فيه code + userMessage (عربي، آمن) + devMessage (إنجليزي، server-only) + context + cause.
  - `ValidationException` → 400.
  - `BusinessException` → 422 (default).
  - `SystemException` → 500 — **بيستبدل الـ userMessage دايماً برسالة عامة** عشان مايسرّبش SQL/stack.

### الـ PrismaService (`prisma/prisma.service.ts`, 84 سطر)
- بيمتد PrismaClient. `onModuleInit` → `$connect`، `onModuleDestroy` → `$disconnect`.
- `softDeleteFilter` getter → `{ deletedAt: null }` (مستخدم في كل الـ services).
- **`runSerializable(fn, retries=3)`** — interactive transaction بـ Serializable isolation **مع retry تلقائي** على serialization failures (P2034 / Postgres 40001). ده الـ defense-in-depth للـ TOCTOU guards في updates/payments. الأخطاء غير الـ serialization بتطلع فوراً (مفيش retry). فيه jittered backoff صغير بين المحاولات.

### الـ Config (`common/config/`)
- **`throttler.config.ts`** — الـ 3 profiles.
- **`cors.config.ts`** (88 سطر): whitelist ديناميكي من `CORS_ALLOWED_ORIGINS`. في dev بيضيف localhost تلقائياً. بيرفض الـ origins المجهولة مع log. `credentials: true` (للـ cookie). methods + headers محددة.
- **`security.config.ts`** (82 سطر): helmet — CSP مضبوط (يسمح بـ Supabase host للصور)، HSTS (production، سنة)، COEP معطّل (عشان Supabase images)، referrer-policy، hidePoweredBy.
- **`env-validation.ts`** (162 سطر): `validateEnvironment()` — بيتأكد من DATABASE_URL، Supabase URL/key، JWT_SECRET (≥32 char + مش placeholder)، COOKIE_SECRET (إجباري في prod)، CORS_ALLOWED_ORIGINS (إجباري في prod). ERROR = يموّت الـ process، WARN = يسجّل ويكمّل.

---

═══════════════════════════════════════════════════════════════

## 🔢 القسم 3: كل الـ Enums

### SubscriptionPlan
`BASIC` (Starter), `PRO`, `ENTERPRISE`, `TRIAL` — باقات الاشتراك (الحدود في TIER_LIMITS، راجع الملف 1).

### SubscriptionStatus
`ACTIVE`, `EXPIRED` (بيمنع الـ login), `TRIAL`.

### UserRole (7 أدوار — أساس الـ RBAC)
| الدور | الوصف |
|------|------|
| `SUPER_ADMIN` | مدير أعلى — يعدّي على كل الـ guards |
| `PROJECT_MANAGER` | مدير مشاريع — يشوف كل المشاريع |
| `SITE_ENGINEER` | مهندس موقع |
| `SUPERVISOR` | مشرف |
| `ACCOUNTANT` | محاسب — يشوف المدفوعات والتكاليف |
| `WORKER` | عامل |
| `CLIENT` | عميل — يشوف المعتمد على مشاريعه فقط |

### Language
`AR`, `EN`.

### ProjectType
`FULL_FINISHING` (تشطيب كامل), `PARTIAL_FINISHING` (تشطيب جزئي), `CONSTRUCTION` (إنشاءات).

### ProjectStatus (state machine)
`DRAFT`, `IN_PROGRESS`, `ON_HOLD`, `COMPLETED` (نهائي), `CANCELLED` (نهائي).

### ProjectRole (الدور في المشروع)
`SITE_ENGINEER`, `SUPERVISOR`, `ACCOUNTANT`, `WORKER`, `FOREMAN`.

### PhaseStatus (state machine)
`NOT_STARTED`, `IN_PROGRESS`, `COMPLETED` (نهائي), `ON_HOLD`.

### UpdateStatus (state machine — قلب النظام)
`DRAFT`, `PENDING`, `APPROVED`, `REJECTED`, `FORCE_CANCELLED`.

### MediaType
`IMAGE`, `VIDEO`, `DOCUMENT`.

### PaymentType
`CLIENT_PAYMENT` (دخل), `EXPENSE` (مصروف), `SUNK_COST` (تكلفة غارقة — من تحديث ملغي).

### PaymentMethod
`CASH`, `BANK_TRANSFER`, `CHECK`, `OTHER`.

### NotificationType (18 نوع — للموديول المستقبلي)
`UPDATE_SUBMITTED`, `UPDATE_APPROVED`, `UPDATE_REJECTED`, `UPDATE_FORCE_CANCELLED`, `UPDATE_EDITED_AFTER_APPROVAL`, `DEADLINE_REMINDER`, `DEADLINE_MISSED`, `DEADLINE_LATE`, `PAYMENT_RECORDED`, `PHASE_COMPLETED`, `PHASE_CANCELLED`, `NEW_CHAT_MESSAGE`, `NEW_COMMENT`, `CHANGE_REQUEST`, `REVIEW_REQUEST`, `SLA_BREACH`, `NEW_ASSIGNMENT`, `PROGRESS_OVERRIDE`.

### NotificationPriority
`LOW`, `NORMAL`, `HIGH`, `URGENT`.

### NotificationChannel
`IN_APP`, `PUSH`, `EMAIL`, `SMS`.

### ChatRoomType
`DIRECT`, `GROUP`.

### ChatMessageType
`TEXT`, `IMAGE`, `FILE`, `VOICE`.

### CommentType
`COMMENT` (عادي), `REVIEW_REQUEST` (طلب مراجعة), `CHANGE_REQUEST` (طلب تغيير).

### CommentStatus
`OPEN`, `ACKNOWLEDGED`, `RESOLVED`.

### SubContractorStatus
`ACTIVE`, `COMPLETED`, `TERMINATED`.

### AuditAction
`CREATE`, `UPDATE`, `DELETE`, `APPROVE`, `REJECT`, `FORCE_CANCEL`, `PROGRESS_OVERRIDE`.
(آخر 4 = "سلبية" → reason إجباري.)

### DailyUpdateStatus
`PENDING`, `SUBMITTED_ON_TIME`, `SUBMITTED_LATE`, `MISSED`.

---

## 🎯 خلاصة القرارات المعمارية الكبرى (عبر كل النظام)

1. **Multi-tenancy:** كل query فيه `companyId` من الـ JWT. العزل في الـ services مش في الـ DB (RLS hook point موجود بس مش مفعّل).
2. **Soft delete في كل حتة:** `deletedAt` + `softDeleteFilter`. الماليات والـ media ما بتتحذفش hard أبداً.
3. **Audit trail شامل:** مسارين (transactional للحرج، best-effort للباقي). الجدول append-only على مستوى DB.
4. **Idempotency للعمليات المالية:** approve/force-cancel/payment محميين بـ Idempotency-Key + saveInTransaction.
5. **Concurrency control:** Serializable + in-tx re-read + unique constraints (CVE-UPD-003/005/007/008).
6. **Decimal للماليات:** ممنوع float في أي حساب مالي.
7. **Error envelope موحّد:** codes ثابتة، رسائل عربية آمنة، devMessage server-only.
8. **Anti-enumeration:** رفض الرؤية = 404 موحّد (مش 403).
9. **Defense-in-depth:** whitelist DTOs + ValidationPipe + manual whitelist في الـ services.
10. **Supabase external:** Auth + Storage. الـ backend مش بيخزّن passwords.

---

✅ **انتهى التقرير المرجعي الكامل (5 ملفات).**
ابدأ من [الفهرس](./BACKEND_REFERENCE.md) أو أي ملف حسب اللي محتاجه.
