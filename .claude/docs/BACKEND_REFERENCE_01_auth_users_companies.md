# 📘 الملف 1 — Architecture + Auth + Users + Companies

> الجزء الأول من التقرير المرجعي. بيغطي البنية العامة للـ API، وموديولات المصادقة والمستخدمين والشركات.
> الـ Cross-cutting infrastructure (Guards/Filters/Idempotency...) متشروحة بالتفصيل في **الملف 5**، لكن هنشير ليها هنا لما تلزم.

---

## 🏗️ القسم 0: البنية العامة (Architecture Overview)

### التقنيات (Stack)
- **NestJS** (Node) — framework أساسي، معماري modular.
- **Prisma 7** — ORM فوق **PostgreSQL**.
- **Supabase Auth** — provider خارجي للمصادقة (إنشاء users، login، tokens). الـ backend بتاعنا **مش** بيخزّن passwords — Supabase اللي بيملكها.
- **Supabase Storage** — لتخزين الملفات (media).
- **passport-jwt** — للتحقق من الـ JWT اللي بييجي من Supabase.
- **class-validator / class-transformer** — لـ validation الـ DTOs.
- **@nestjs/throttler** — rate limiting.

### نقطة الدخول — `src/main.ts` (164 سطر)
ده الملف اللي بيشغّل التطبيق. بالترتيب (الترتيب مهم وكل خطوة معلّق عليها في الكود):

1. **تحميل `.env`** — بيحمّل `.env.local` ثم `.env` عن طريق `dotenv` **قبل** ما NestJS يشتغل، عشان `validateEnvironment()` تقدر تشوف القيم.
2. **`validateEnvironment()`** — fail-fast: لو فيه env var ناقص أو غلط، التطبيق بيموت فوراً قبل ما NestJS يبدأ DI (تفاصيل الدالة في الملف 5).
3. **`NestFactory.create(AppModule)`** — مع `bufferLogs: true` في production.
4. **trust proxy** — `expressApp.set('trust proxy', 'loopback, linklocal, uniquelocal')`. ده مهم: التطبيق بيقعد ورا proxy (Vercel/Fly)، فبدون السطر ده `req.ip` هيكون IP الـ proxy مش العميل الحقيقي — وده بيكسر مفتاح الـ throttler والـ IP اللي بيتسجل في الـ audit.
5. **helmet** — security headers (تفاصيل في الملف 5). لازم يشتغل قبل أي route.
6. **cookieParser** — لازم عشان الـ refresh-token cookie. بيستخدم `COOKIE_SECRET` لو موجود.
7. **HTTPS redirect** — في production بس: لو الطلب مش https (حسب header `x-forwarded-proto`) بيعمل redirect 308 لنسخة https.
8. **API prefix** — كل الـ routes تحت `api/v1` ما عدا `/health` و `/health/(.*)` (عشان probes تلاقي URL ثابت).
9. **CORS** — whitelist ديناميكي (تفاصيل في الملف 5).
10. **ValidationPipe عام** — بإعدادات مهمة جداً:
    - `whitelist: true` — يشيل أي property مش معرّف في الـ DTO.
    - `forbidNonWhitelisted: true` — يرفض الطلب لو فيه property زيادة (**دفاع ضد mass-assignment**).
    - `transform: true` — يحوّل الـ payload لـ instance من الـ DTO class.
    - `enableImplicitConversion: false` — يمنع التحويل الضمني (`'true'` → `true`). لازم `@Type()` صريح.
    - `disableErrorMessages` في production — عشان ما يبوّظش أسماء الحقول للمهاجم (schema discovery).
11. **Swagger** — على `/docs`، متعطّل في production إلا لو `DOCS_ENABLED=true`.
12. **`enableShutdownHooks()`** — graceful shutdown (يقفل Prisma pool نظيف على SIGTERM).
13. **`app.listen(PORT)`** — default 4000.

لو الـ bootstrap فشل → `console.error` + `process.exit(1)` (يخلّي الـ orchestrator يعيد التشغيل).

### الـ Root Module — `src/app.module.ts` (124 سطر)
بيجمّع كل الموديولات. أهم حاجتين:

**1. ترتيب الـ Guards (مهم — بتشتغل من فوق لتحت):**
```
1. ThrottlerGuard    ← الأرخص؛ يرفض DOS قبل أي DB read
2. JwtAuthGuard      ← يتحقق من الهوية
3. RolesGuard        ← يتحقق من قائمة الأدوار المطلوبة
4. PermissionsGuard  ← يتحقق من الصلاحيات الدقيقة
```
كلهم مسجّلين كـ `APP_GUARD` (global). يعني **كل** endpoint محمي افتراضياً، إلا لو عليه `@Public()`.

**2. Interceptor + Filter عامين:**
- `TransformInterceptor` (APP_INTERCEPTOR) — يلفّ كل response في `{ success, data, meta }`.
- `GlobalExceptionFilter` (APP_FILTER) — يوحّد كل الأخطاء (من غير تسريب تفاصيل).

**3. Middleware:**
```typescript
consumer.apply(CorrelationIdMiddleware, TenantIsolationMiddleware).forRoutes('*');
```
- `CorrelationIdMiddleware` لازم يشتغل **الأول** عشان كل حاجة بعده تقدر تقرا الـ requestId.

الموديولات المستوردة: ConfigModule (global), ThrottlerModule, IdempotencyModule (global), SupabaseAdminModule (global), PrismaModule, AuthModule, HealthModule + كل الـ feature modules.

> ملاحظة: `NotificationsModule` لسه مش موجود (Phase 2 / F5 — محتاج Redis + BullMQ). ده بيفسّر إن إرسال الإشعارات في الكود غالباً TODO.

### شكل الـ Response الموحّد
كل response ناجح بيرجع بالشكل ده (من `TransformInterceptor`):
```json
{ "success": true, "data": { ... }, "meta": { "timestamp": "..." } }
```
ولو الـ response فيه `{ items, total }` (list) بيتحوّل لـ:
```json
{ "success": true, "data": [ ... ], "meta": { "total": 50, "page": 1, "limit": 20, "timestamp": "..." } }
```

وكل خطأ بيرجع (من `GlobalExceptionFilter`):
```json
{ "success": false, "code": "AUTH_BIZ_006", "message": "البريد أو كلمة المرور غير صحيحة", "requestId": "uuid", "path": "/api/v1/auth/login", "timestamp": "..." }
```

### الـ JWT Payload — الكائن اللي بيمثّل المستخدم في كل request
معرّف في `src/common/decorators/current-user.decorator.ts`:
```typescript
interface JwtPayload {
  sub: string;          // Supabase auth ID
  email: string;
  userId: string;       // الـ ID الداخلي بتاعنا في DB
  companyId: string;    // الـ tenant — أساس العزل
  role: UserRole;
  permissions: string[];
}
```
بيتحط على `request.user` بعد ما الـ `JwtStrategy.validate` يخلّص. أي controller بيوصله عن طريق `@CurrentUser()`.

---

═══════════════════════════════════════════════════════════════

## 🔐 القسم 1: موديول Auth (المصادقة)

### 1. الغرض
الموديول ده مسؤول عن **دخول الناس للنظام**:
- تسجيل شركة جديدة + أول Super Admin ليها (`register`).
- تسجيل الدخول (`login`).
- تجديد الـ token (`refresh`).
- تسجيل الخروج (`logout`).
- التحقق من الـ JWT في كل طلب (عن طريق `JwtStrategy`).
- الحماية من brute-force (عن طريق `LoginAttemptsTracker`).

المنطق الأساسي: **Supabase Auth هو اللي بيملك الـ passwords والـ tokens**. الـ backend بتاعنا بيتكلم مع Supabase، وبيخزّن نسخة من بيانات المستخدم في DB بتاعنا (مربوطة بـ `supabaseAuthId`).

### 2. الملفات
| الملف | الأسطر | بيعمل إيه |
|------|:-----:|----------|
| `auth.module.ts` | 32 | يربط الموديول. بيستورد `AuditModule`، `PassportModule` (strategy=jwt)، و`JwtModule` (secret من env، access token عمره 900 ثانية = 15 دقيقة). |
| `auth.controller.ts` | 162 | 4 endpoints: register/login/refresh/logout. بيدير الـ refresh-token cookie. |
| `auth.service.ts` | 521 | كل المنطق: registerCompany, login, refreshToken, logout + helpers (slug generation, email masking). |
| `jwt.strategy.ts` | 88 | `validate()` — بتشتغل بعد التحقق من توقيع الـ JWT؛ بتحمّل المستخدم من DB وتبني الـ payload. |
| `login-attempts.tracker.ts` | 164 | عدّاد فشل تسجيل الدخول لكل email + قفل 15 دقيقة بعد 5 محاولات. in-memory. |
| `dto/index.ts` | 80 | `RegisterCompanyDto`, `LoginDto`, `RefreshTokenDto`. |

### 3. الـ Endpoints بالتفصيل

#### 🔹 `POST /api/v1/auth/register`
- **الأدوار:** `@Public()` (مفيش auth — ده تسجيل شركة جديدة).
- **Throttle:** `auth` profile — 5 طلبات/دقيقة (التسجيل نادر ومستهدف من البوتات).
- **الـ DTO:** `RegisterCompanyDto`
  | الحقل | القواعد |
  |------|---------|
  | `companyName` | string, مطلوب, 2–100 حرف |
  | `companyEmail` | email صالح, مطلوب |
  | `companyPhone` | اختياري, regex `^[+]?[\d\s\-()]{8,20}$` |
  | `adminName` | string, مطلوب, 2–100 حرف |
  | `adminEmail` | email صالح, مطلوب |
  | `adminPassword` | string, 10–128 حرف, **لازم يحتوي على: حرف صغير + كبير + رقم + رمز خاص** (regex معقّد) |

- **خطوة بخطوة في `registerCompany()`:**
  1. **Layer 1 — Business validation** (`validateRegistration`): يتأكد إن `companyEmail` مش مستخدم لشركة تانية (active)، و`adminEmail` مش مستخدم لمستخدم تاني. لو مكرر → `409 AUTH_BIZ_002`.
  2. **Layer 2 — إنشاء user في Supabase** عن طريق `supabase.auth.admin.createUser` (مع `email_confirm: true` و metadata فيه الاسم والـ role). لو Supabase قال "already registered" → `409 AUTH_BIZ_002`. لو فشل لأي سبب تاني → `500 AUTH_SYS_001`.
  3. **حجز slug فريد** (`reserveUniqueSlug`) **قبل** الدخول في الـ transaction (عشان collision ما يضيّعش transaction slot).
  4. **Layer 3 — DB transaction** (`prisma.$transaction`):
     - `company.create` (الاسم, slug, email, phone).
     - `user.create` (مربوط بالـ company، الـ role = `SUPER_ADMIN`، `supabaseAuthId`).
     - **audit إجباري جوه الـ transaction**: سطرين append-only — `company.CREATE` و `user.CREATE`. لو أي audit فشل → الـ transaction كله يترجع (rollback).
  5. **Rollback ذكي:** لو الـ DB transaction فشل، يحاول يمسح الـ Supabase user اللي اتعمل (عشان ما يفضلش يتيم). لو الـ rollback نفسه فشل → log حرج "Manual cleanup required". وفي الآخر يرمي `500 AUTH_SYS_002`.

- **مثال request body:**
```json
{
  "companyName": "شركة تمبلتس للمقاولات",
  "companyEmail": "info@tampalets.com",
  "companyPhone": "+201001234567",
  "adminName": "محمد علي",
  "adminEmail": "admin@tampalets.com",
  "adminPassword": "MyP@ssw0rd123"
}
```
- **مثال response (نجاح):**
```json
{
  "success": true,
  "data": {
    "company": { "id": "uuid", "name": "شركة تمبلتس للمقاولات", "slug": "shrk-tmblts-llmqwlt-x7g2pq" },
    "user": { "id": "uuid", "name": "محمد علي", "email": "admin@tampalets.com", "role": "SUPER_ADMIN" }
  },
  "meta": { "timestamp": "..." }
}
```
- **الأخطاء الممكنة:** `409 AUTH_BIZ_002` (email مكرر)، `500 AUTH_SYS_001` (Supabase فشل)، `500 AUTH_SYS_002` (DB transaction فشل / slug generation اتعطّل بعد 5 محاولات)، `400` (validation من الـ pipe).

> **ملاحظة عن الـ slug:** الـ `slugStem` بياخد اسم الشركة، يحوّله lowercase، يشيل أي حرف مش ASCII alnum، ويحطّ `-`. لو الاسم كله عربي → النتيجة فاضية → fallback = `"company"`. بعدها بيضاف suffix عشوائي 6 bytes (base64url). ده بيفسّر إن أسماء الشركات العربية بتطلع slug زي `company-x7g2pq`.

#### 🔹 `POST /api/v1/auth/login`
- **الأدوار:** `@Public()`.
- **Throttle:** `auth` — 5/دقيقة.
- **HTTP code:** 200 (مش 201).
- **الـ DTO:** `LoginDto` — `email` (email صالح، مطلوب) + `password` (string، مطلوب).
- **خطوة بخطوة في `login()`:**
  1. **Lockout pre-check** (`loginAttempts.check`): لو الـ email مقفول → `429 AUTH_BIZ_001` مع رسالة فيها كام دقيقة فاضلة. ده بيحصل **قبل** ما نكلّم Supabase أصلاً.
  2. **Supabase auth** (`signInWithPassword`). لو فشل → `recordFailure` + `401 AUTH_BIZ_006` برسالة موحّدة "البريد أو كلمة المرور غير صحيحة" (نفس الرسالة سواء الـ email مش موجود أو الـ password غلط — دفاع ضد user enumeration).
  3. **تحميل المستخدم من DB** (`findFirst` بـ `supabaseAuthId` + `deletedAt: null`) مع بيانات الشركة. لو مش موجود (Supabase قال نعم وDB مش عارفاه) → `500 AUTH_SYS_002` (تناقض IdP/DB).
  4. **فحوصات الحالة:** لو `!isActive` → `401 AUTH_BIZ_004`. لو الشركة `deletedAt` → `401 AUTH_BIZ_007`. لو `subscriptionStatus === EXPIRED` → `401 AUTH_BIZ_003`.
  5. **نجاح:** `recordSuccess` (يصفّر العدّاد) + تحديث `lastLogin` (fire-and-forget — فشله مايوقفش الـ login).
  6. يرجّع `accessToken` + `refreshToken` + `expiresAt` + بيانات المستخدم والشركة.
- **في الـ Controller:** الـ `refreshToken` بيتشال من الـ JSON ويتحط في **cookie** اسمه `refresh_token` (httpOnly + Secure في prod + SameSite=Strict + path=`/api/v1/auth` + عمره 7 أيام). الـ JSON بيرجّع `accessToken` + `expiresAt` + `user` بس.
- **مثال request:** `{ "email": "admin@tampalets.com", "password": "MyP@ssw0rd123" }`
- **مثال response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGci...",
    "expiresAt": 1718900000,
    "user": {
      "id": "uuid", "name": "محمد علي", "email": "admin@tampalets.com",
      "role": "SUPER_ADMIN", "specialty": null, "avatar": null, "preferredLanguage": "AR",
      "company": { "id": "uuid", "name": "شركة تمبلتس", "slug": "...", "logo": null }
    }
  }
}
```
(+ `Set-Cookie: refresh_token=...; HttpOnly; ...`)
- **الأخطاء:** `429 AUTH_BIZ_001` (مقفول), `401 AUTH_BIZ_006` (بيانات غلط), `401 AUTH_BIZ_004` (معطّل), `401 AUTH_BIZ_007` (شركة محذوفة), `401 AUTH_BIZ_003` (اشتراك منتهي), `500 AUTH_SYS_002`.

#### 🔹 `POST /api/v1/auth/refresh`
- **الأدوار:** `@Public()`. **Throttle:** 30/دقيقة (بيرست UX مقبول).
- **مفيش body** — بياخد الـ refresh token من الـ **cookie** (signed لو فيه `COOKIE_SECRET`، وإلا unsigned).
- **خطوة بخطوة:** `refreshToken(currentToken)` → لو مفيش token → `401 AUTH_BIZ_005`. بينده `supabase.auth.refreshSession`. لو فشل → `401 AUTH_BIZ_005` (يجبر re-login). لو نجح → يرجّع accessToken جديد + refreshToken جديد.
- **Rotation:** كل refresh بيصدر refresh token جديد ويستبدل الـ cookie. الـ token المسروق بيبطل بعد أول refresh شرعي.
- **response:** `{ accessToken, expiresAt }` (+ cookie جديد).

#### 🔹 `POST /api/v1/auth/logout`
- **مش `@Public()`** (محتاج token). HTTP 200.
- بياخد الـ `Authorization` header، يطلّع منه الـ access token، ويحاول `supabase.auth.admin.signOut` (best-effort). بعدها يمسح الـ cookie (بنفس الـ options بتاعة الإنشاء — لازم يتطابقوا وإلا المتصفح مايمسحوش).
- **response:** `{ "message": "تم تسجيل الخروج بنجاح" }`.

### 4. الـ Business Logic المعقّد

**أ) `LoginAttemptsTracker` (الحماية من brute-force):**
- خريطة in-memory: `email → { failures, firstFailureAt, lockedUntil }`.
- السياسة: 5 محاولات فاشلة متتالية → قفل **15 دقيقة**. النافذة 24 ساعة.
- **ليه per-email مش per-IP؟** الكود بيشرح: الشركات الكبيرة في مصر (بنوك، وزارات، مقاولات) بتشارك IP واحد ورا NAT. القفل بالـ IP هيقفل الشركة كلها. الـ IP layer بيتعامل معاه الـ throttler العام (5/دقيقة).
- `check()` بيقرا بس (مايسجّلش). `recordFailure()` بيزوّد العدّاد. `recordSuccess()` بيمسح السجل.
- حد أقصى 50,000 entry؛ لو اتملّت بيشيل أقدم 10%.

**ب) `JwtStrategy.validate()` (التحقق في كل request):**
- بييجي معاه payload فيه `sub` (Supabase auth ID).
- بيحمّل المستخدم من DB (`supabaseAuthId` + `deletedAt: null`) مع بيانات الشركة.
- بيرفض (401) لو: المستخدم مش موجود / `!isActive` / الشركة محذوفة / الاشتراك منتهي.
- بيبني `permissions` من `customPermissions` (JSON array في DB).
- **ملاحظة معمارية مهمة (A2):** الكود **مش** بيحدّث `lastLogin` هنا. التعليق بيشرح إن ده كان bug قديم — تحديث `lastLogin` في كل validation حوّل العمود لـ "lastRequest" وعمل write hotspot على كل طلب. دلوقتي `lastLogin` بيتحدّث مرة واحدة بس في `AuthService.login`.

### 5. القرارات الأمنية
- **Constant-time-ish login:** نفس رسالة الخطأ سواء الـ email مش موجود أو الـ password غلط (`AUTH_BIZ_006`).
- **Email masking في الـ logs:** `maskEmail` بيحوّل `alice@x.com` لـ `al***@x.com` — عشان ما نسجّلش PII كامل.
- **Refresh token في cookie httpOnly** — مش في JSON، عشان XSS ما يقدرش يسرقه.
- **SameSite=Strict** على الـ cookie — دفاع CSRF.
- **path=/api/v1/auth** على الـ cookie — مايتبعتش في أي route تاني.
- **Token rotation** على كل refresh.
- **Audit جوه الـ transaction** عند التسجيل — لو الـ audit فشل، الشركة ماتتعملش (مبدأ: "لو ماتسجّلش، يبقى ماحصلش").
- **Supabase rollback** عند فشل الـ DB — عشان ما يفضلش auth user يتيم.

---

═══════════════════════════════════════════════════════════════

## 👤 القسم 2: موديول Users (المستخدمين)

### 1. الغرض
إدارة المستخدمين جوه الشركة الواحدة: عرض، إنشاء (دعوة)، تعديل، تغيير الأدوار، الصلاحيات المخصّصة، التفعيل/التعطيل، والحذف الناعم (soft delete). كل العمليات معزولة بالـ `companyId` (tenant isolation) ومعظمها `SUPER_ADMIN` فقط.

### 2. الملفات
| الملف | الأسطر | بيعمل إيه |
|------|:-----:|----------|
| `users.module.ts` | 16 | يستورد `AuditModule` + `CompaniesModule` (عشان `TierLimitsService`). |
| `users.controller.ts` | 183 | 11 endpoint كامل RBAC. |
| `users.service.ts` | 731 | **أكبر service بعد updates**. كل منطق المستخدمين. |
| `dto/index.ts` | 177 | 6 DTOs: Create/Update/UpdateMyProfile/ChangeRole/UpdatePermissions/ListUsersQuery + DeleteUserDto. |

ثابت مهم في الـ service: `USER_SELECT` — قائمة الحقول الآمنة للإرجاع (id, name, email, phone, role, specialty, avatar, isActive, preferredLanguage, lastLogin, createdAt, customPermissions). **مش بيرجّع `supabaseAuthId` أبداً**.

### 3. الـ Endpoints بالتفصيل

#### 🔹 `GET /api/v1/users` (findAll)
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`.
- **Query DTO:** `ListUsersQueryDto extends PaginationDto` — `page`, `limit`, `sortBy`, `sortOrder` + `search` (في name/email)، `role` (enum)، `isActive` (boolean).
- **أمان مهم (A6 — ordering oracle):** `sortBy` متقيّد بـ `@IsIn(['name','email','role','createdAt','lastLogin'])`. السبب: الـ PaginationDto الأساسي بيقبل أي string، فمهاجم ممكن يعمل `sortBy=supabaseAuthId` ويستخدم ترتيب الصفحات كـ oracle لتسريب الـ IDs السرية. التقييد بيمنع ده.
- **المنطق:** `where = { companyId, deletedAt: null }` + الفلاتر. بيرجّع `{ items, total, page, limit, totalPages }`.

#### 🔹 `GET /api/v1/users/me` (getMyProfile)
- أي مستخدم مصادَق. بينده `findOne(companyId, userId)`.

#### 🔹 `GET /api/v1/users/:id` (findOne)
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`. الـ `:id` بيتحقق منه بـ `ParseUUIDPipe`.
- بيرجّع المستخدم + `notificationPreferences` + الـ `projectAssignments` النشطة (مع تفاصيل المشروع). لو مش موجود في نفس الشركة → `404`.

#### 🔹 `PATCH /api/v1/users/me` (updateMyProfile)
- أي مستخدم. **DTO:** `UpdateMyProfileDto` — `name` (2–200)، `phone` (regex)، `avatar`، `notificationPreferences` (object)، `preferredLanguage` (AR/EN).
- **المنطق:** يبني `data` whitelist، يصوّر `oldValues` للحقول اللي هتتغير بس، ثم `transaction`: update + audit (`UPDATE`).
- **ليه audited (A5):** الـ name/phone/avatar بيانات PII؛ مهاجم بـ XSS هيسارع يغيّرها. الـ snapshot بيخلّي محقّق forensic يعرف الحساب كان بتاع مين وقت الاختراق.

#### 🔹 `POST /api/v1/users` (create / invite)
- **الأدوار:** `SUPER_ADMIN`. **DTO:** `CreateUserDto` — `name` (2–200)، `email`، `phone?` (regex)، `role` (enum من 7 أدوار)، `specialty?`، `password?` (اختياري، 8–100).
- **خطوة بخطوة:**
  1. **Tier gate:** `tierLimits.assertCanAddUser(companyId)` — لو وصلت حد الباقة → `402 TIER_LIMIT_EXCEEDED`. بيتعمل **قبل** Supabase عشان ما يفضلش auth user يتيم.
  2. فحص email مكرر في الشركة → `409`.
  3. **إنشاء في Supabase:** لو الأدمن دخّل `password` يستخدمه، وإلا `generateSecurePassword()` (16 حرف crypto-secure). لو Supabase فشل → `400`.
  4. **DB transaction:** `user.create` + audit (`CREATE`). لو فشل → الـ catch يمسح الـ Supabase user.
  5. **الرد:** لو الأدمن دخّل الـ password بنفسه → يرجّع `{ user }` بس. لو النظام ولّد password → يرجّع `{ user, tempPassword, mustSharePasswordSecurely }` (الـ tempPassword بيظهر **مرة واحدة بس**).
- **السياق (A4 / Q1=A):** ده حل مؤقت لحد ما `NotificationsModule` ييجي (عشان يبعت invite email بـ set-password link). دلوقتي الأدمن مسؤول يسلّم الـ password يدوياً بقناة آمنة.

#### 🔹 `PATCH /api/v1/users/:id` (update — admin)
- **الأدوار:** `SUPER_ADMIN`. **DTO:** `UpdateUserDto` — `name`, `phone`, `specialty`, `avatar`, `preferredLanguage`.
- **أمان whitelist:** الكود **مش** بيمرّر `dto` خام لـ Prisma. بيبني `data` يدوياً. السبب: الـ DTO ممكن (بقصد أو mass-assignment) يحتوي على `role`/`companyId`/`supabaseAuthId` — ولا واحد منهم قابل للتعديل هنا.
- يصوّر `oldValues` للحقول اللي هتتغير فقط (CVE-USERS-004 — الإصدار القديم كان بيصوّر name+phone دايماً ويسيب الباقي خارج الـ audit). transaction: update + audit.

#### 🔹 `PATCH /api/v1/users/:id/role` (changeRole)
- **الأدوار:** `SUPER_ADMIN`. **DTO:** `ChangeRoleDto` — `role` (enum).
- **حمايتان مهمتان:**
  1. **منع تغيير دور النفس:** لو `adminUser.userId === targetUserId` → `403`.
  2. **منع إزالة آخر Super Admin:** لو الـ target هو `SUPER_ADMIN` والـ role الجديد مش `SUPER_ADMIN` → `ensureNotLastSuperAdmin` (يعدّ كام super admin نشط تاني؛ لو صفر → `403`).
- transaction: update role + audit (oldValues: {role}, newValues: {role}).

#### 🔹 `PATCH /api/v1/users/:id/permissions` (updatePermissions)
- **الأدوار:** `SUPER_ADMIN`. **DTO:** `UpdatePermissionsDto` — `permissions: string[]`.
- **validation إضافي في الـ service:** كل permission لازم يطابق `^[a-z_]+\.[a-z_]+$` (شكل `resource.action`). لو غلط → `400`.
- transaction: `customPermissions = dto.permissions` + audit.

#### 🔹 `POST /api/v1/users/:id/deactivate`
- **الأدوار:** `SUPER_ADMIN`.
- **الحمايات:** منع تعطيل النفس (403)؛ لو الـ target `SUPER_ADMIN` → `ensureNotLastSuperAdmin`.
- **المنطق:** transaction (isActive=false + audit). بعد الـ commit: **Supabase ban لمدة 24 ساعة** (best-effort — فشله مايرجّعش الـ DB).
- **ليه الـ ban (A3):** بدونه، مستخدم متعطّل بـ refresh token صالح يقدر يفضل يطلّع access tokens من الـ IdP (كلها هترفض من JwtStrategy، لكن الـ session لسه حية عند Supabase). الـ ban بيقطع الـ session عند الـ IdP.
- **CVE-TEST-016:** الـ `oldValues.isActive` بيتاخد من الحالة الفعلية (`target.isActive`) مش من الافتراض `true` — عشان no-op deactivate (target متعطّل أصلاً) ما يسجّلش انتقال كاذب.

#### 🔹 `POST /api/v1/users/:id/activate`
- **الأدوار:** `SUPER_ADMIN`. عكس deactivate: isActive=true + audit + لفّ الـ ban (`ban_duration: 'none'`). نفس قاعدة CVE-TEST-016.

#### 🔹 `DELETE /api/v1/users/:id` (softDelete)
- **الأدوار:** `SUPER_ADMIN`. **DTO:** `DeleteUserDto` — `reason` (20–2000 حرف، **إجباري**).
- **الحمايات:** منع حذف النفس (403)؛ reason أقل من 20 حرف → `400`؛ آخر super admin → `403`.
- **المنطق:** transaction (`deletedAt = now`, `isActive = false` + audit `DELETE` مع snapshot كامل + reason). بعد الـ commit: **Supabase ban 876000 ساعة ≈ 100 سنة** (best-effort).
- **response:** `{ "message": "تم حذف المستخدم بنجاح" }`.

### 4. الـ Business Logic المعقّد

**`generateSecurePassword()` (CVE-USERS-003 — rejection sampling):**
- بيولّد password 16 حرف من charset فيه 61 حرف (`ABCDEF...!@#$%&*`).
- **المشكلة اللي بيحلها:** `byte % 62` بيعمل modulo bias — أول 8 أحرف هيكونوا ~25% أكتر احتمالاً من الباقي (لأن 256 مش قابلة للقسمة على 62). الحل: يرفض أي byte أكبر من `maxValid` (= أكبر مضاعف لـ charsetSize أصغر من 256، يعني 248) ويعيد العيّنة.
- معدل الرفض الأسوأ ~3% — لا يُذكر.

**مثال رقمي لـ `ensureNotLastSuperAdmin`:**
- شركة فيها 2 super admin نشطين (A و B).
- محاولة تعطيل A → `count` للـ super admins النشطين **ما عدا A** = 1 (B). 1 ≠ 0 → مسموح.
- بعد تعطيل A، محاولة تعطيل B → `count` ما عدا B = 0 (لأن A بقى inactive) → `403` "لا يمكن إزالة آخر مدير أعلى".

### 5. القرارات الأمنية
- **Tenant isolation:** كل query فيه `companyId` من الـ JWT + `deletedAt: null`.
- **Mass-assignment defense:** whitelist يدوي في update/updateMyProfile/changeRole.
- **Ownership/self-protection:** منع تغيير/تعطيل/حذف النفس.
- **Last super admin protection:** ضمان دايماً واحد على الأقل.
- **Ordering oracle defense:** تقييد `sortBy`.
- **IdP consistency:** Supabase ban/unban متزامن مع DB flags.
- **Audit شامل:** كل mutation فيها `logInTransaction`.
- **Temp password exposure minimization:** يرجّع الـ password بس لو النظام ولّده.

---

═══════════════════════════════════════════════════════════════

## 🏢 القسم 3: موديول Companies (الشركات)

### 1. الغرض
إدارة بيانات الشركة (الـ tenant نفسه): عرض بيانات شركتي، تعديلها، الإعدادات (settings JSON)، وتقرير استخدام التخزين. بالإضافة لـ `TierLimitsService` اللي بيفرض حدود الباقة على كل الموديولات التانية.

### 2. الملفات
| الملف | الأسطر | بيعمل إيه |
|------|:-----:|----------|
| `companies.module.ts` | 18 | يستورد AuditModule. **بيصدّر** `CompaniesService` + `TierLimitsService` (عشان users/projects/media يستخدموهم). |
| `companies.controller.ts` | 66 | 4 endpoints. |
| `companies.service.ts` | 255 | getMyCompany/updateCompany/updateSettings/getStorageUsage + ثابت `TIER_LIMITS`. |
| `tier-limits.service.ts` | 165 | فرض حدود الباقات + `PaymentRequiredException` (402). |
| `dto/update-company.dto.ts` | 96 | `UpdateCompanyDto` + `UpdateCompanySettingsDto`. |
| `dto/index.ts` | 1 | re-export. |

**ثابت `TIER_LIMITS`** (مصدر الحقيقة لحدود الباقات):
| الباقة | maxProjects | maxUsers | storageBytes |
|-------|:-----------:|:--------:|:------------:|
| TRIAL | 3 | 10 | 10 GB |
| BASIC | 3 | 10 | 10 GB |
| PRO | 15 | 50 | 50 GB |
| ENTERPRISE | ∞ (MAX_SAFE_INTEGER) | ∞ | 200 GB |

### 3. الـ Endpoints بالتفصيل

#### 🔹 `GET /api/v1/companies/me`
- **أي مستخدم مصادَق.** بيرجّع بيانات الشركة (select محدد — مش بيرجّع deletedAt/updatedAt). لو مش موجودة → `404`.

#### 🔹 `PATCH /api/v1/companies/me` (updateCompany)
- **الأدوار:** `SUPER_ADMIN`. **DTO:** `UpdateCompanyDto` — كله اختياري:
  | الحقل | القواعد |
  |------|---------|
  | `name` | 2–200 |
  | `logo` | URL **HTTPS فقط**, ≤1000 |
  | `phone` | regex `^\+?[\d\s-]{8,20}$` |
  | `email` | email صالح, ≤200 |
  | `address` | ≤500 |
  | `commercialRegister`, `taxId` | ≤100 |
  | `employeeCount` | ≤50 |
  | `specialization` | ≤200 |
  | `currency` | regex `^[A-Z]{3,10}$/i` |
  | `timezone` | ≤100 |
- **Whitelist صارم:** الـ service بيبني `data` يدوياً. الحقول **الممنوعة**: `subscriptionPlan`/`subscriptionStatus` (billing webhook فقط)، `storageQuota`/`storageUsed` (مشتقة)، `slug` (ثابت للـ URL). لو الأدمن بعت أي منهم → الـ global pipe بيرجّع `400` (forbidNonWhitelisted).
- **المنطق:** يجيب الـ `old`، يبني `data`، transaction: update + audit (`UPDATE`) مع `pickOldValuesForChangedFields` (يصوّر القيم القديمة للحقول اللي فعلاً اتغيّرت بس).

#### 🔹 `PATCH /api/v1/companies/settings` (updateSettings)
- **الأدوار:** `SUPER_ADMIN`. **DTO:** `UpdateCompanySettingsDto` — `settings` (object).
- transaction: يكتب `settings` JSON + audit (oldValues/newValues = settings).

#### 🔹 `GET /api/v1/companies/storage` (getStorageUsage)
- **الأدوار:** `SUPER_ADMIN`.
- **المنطق:** يجيب quota/used/plan. يحسب `available` و`percentage` (integer 0–100، بـ BigInt math عشان determinism). يرجّع كمان tierLimits + `warning` (≥80%) + `critical` (≥95%).
- **ملاحظة:** الـ BigInt بيتحوّل لـ string عند الحدود (`toString()`) لأن BigInt مش JSON-safe.

### 4. الـ Business Logic المعقّد — `TierLimitsService`

3 دوال بتفرض الحدود، كلها بترمي `PaymentRequiredException` (HTTP **402**) مع تلميح للباقة التالية:

- **`assertCanAddUser(companyId)`:** يعدّ الـ users النشطين (`deletedAt: null`). لو `count >= maxUsers` → 402.
- **`assertCanAddProject(companyId)`:** يعدّ المشاريع **غير الـ CANCELLED وغير المحذوفة**. (الـ CANCELLED مابتستهلكش slot). لو `count >= maxProjects` → 402.
- **`assertCanUseStorage(companyId, incomingBytes)`:** لو `storageUsed + incomingBytes > storageQuota` → 402. (`incomingBytes <= 0` = no-op).

`PaymentRequiredException` بيرجّع body فيه `{ statusCode: 402, message, code: 'TIER_LIMIT_EXCEEDED', upgradeTo }`. الـ frontend بيستخدم الـ 402 عشان يفتح modal الترقية.

**مثال رقمي:** شركة TRIAL (maxUsers=10) عندها 10 users نشطين. الأدمن بيحاول يضيف الـ 11. `count=10 >= 10` → 402 برسالة "وصلت لحد المستخدمين في باقتك (10 مستخدم). قم بالترقية إلى BASIC للمزيد."

> ملاحظة: `nextTier` بيستخدم ترتيب `['TRIAL','BASIC','PRO','ENTERPRISE']`. ENTERPRISE → null (مفيش أعلى → "تواصل معنا لخطة مخصصة").

### 5. القرارات الأمنية
- **Mass-assignment defense قوي جداً** هنا — الـ subscriptionPlan/storageQuota محميين على 3 مستويات (DTO documentation + global pipe forbidNonWhitelisted + whitelist يدوي في الـ service).
- **Tenant isolation:** كل query بالـ `companyId` من الـ JWT + softDeleteFilter.
- **HTTPS-only logo** — منع `javascript:` أو `http:` URLs.
- **Audit جوه الـ transaction** لكل تعديل.
- **Centralized tier enforcement** — مصدر حقيقة واحد، observability موحّد، رسائل ترقية متسقة.

---

## 🔗 الترابط بين الموديولات الثلاثة

```
AuthModule ──imports──> AuditModule (للـ audit عند التسجيل)
                └──uses──> SUPABASE_ADMIN_CLIENT (global)
                └──uses──> PrismaService

UsersModule ──imports──> AuditModule + CompaniesModule (للـ TierLimitsService)
                 └──uses──> SUPABASE_ADMIN_CLIENT

CompaniesModule ──imports──> AuditModule
                     └──exports──> CompaniesService + TierLimitsService
```

- **AuditLogService** (من AuditModule) هو الـ glue — كل الموديولات الثلاثة بتستخدمه لكتابة الـ audit trail. تفاصيله الكاملة في **الملف 4** و**الملف 5**.
- **SUPABASE_ADMIN_CLIENT** — provider global واحد (تفاصيله في الملف 5)، بيستخدمه Auth وUsers.

➡️ التالي: **الملف 2** — Projects, Phases, Updates (قلب النظام والـ state machine).
