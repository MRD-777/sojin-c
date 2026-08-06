# تقرير المبرمج 💻

> Session: 2026-05-16-review-auth-users-companies
> الموافقة: approve (كامل) + Q1=A + Q2=A8/A9 فقط (A7 مؤجل)

---

## المرحلة 1: Audit Gap Closure (A1 + A5) — ✅

**الملفات المعدّلة:**
- `apps/api/src/modules/auth/auth.service.ts` — `registerCompany`:
  - Signature تغيّر: استقبل `req?: Request` للـ audit context (IP + UA)
  - الـ `Company.create` + `User.create` انتقلوا داخل `prisma.$transaction`
  - أضيف `auditLog.logInTransaction` × 2 (Company.CREATE + User.CREATE) داخل الـ tx
  - `oldValues: null` في الحالتين (creation = لا history سابق)
  - `newValues` للـ Company يحتوي: name/slug/email/phone — بدون أي auth secret
  - `newValues` للـ User يحتوي: name/email/role — **بدون** `supabaseAuthId` ولا `password` (الـ redactor يحذفهم تلقائياً لكن نتجنّب passing-them-in أصلاً)
- `apps/api/src/modules/auth/auth.controller.ts` — `register` endpoint بقى يـ thread `@Req() req: Request` للـ service
- `apps/api/src/modules/users/users.service.ts` — `updateMyProfile`:
  - أضيف pre-fetch للـ user الحالي قبل الـ update عشان snapshot الـ oldValues على الحقول اللي بتتغير فقط
  - الـ update + audit انتقلوا داخل `prisma.$transaction`
  - الـ `data` بـ whitelist (name/phone/avatar/notificationPreferences/preferredLanguage) — لا mass-assignment
  - `entityType='user'`، `action=UPDATE`، `userRole=user.role`
- `apps/api/src/modules/users/users.controller.ts` — `updateMyProfile` يستقبل `@Req() req: Request`

**انحرافات عن الـ Plan:** لا يوجد.

**ملاحظات:**
- في `updateMyProfile`، الـ pre-fetch بيقرا فقط الحقول اللي ممكن تتغير (5 fields). كنت ممكن أعمل `findOne` كامل لكن ده هيـ leak غير ضروري في الـ audit row.
- الـ rollback المخطط (audit row فشل → الـ Company+User rollback) شغّال تلقائياً بحكم إنهم في نفس الـ `$transaction`.

---

## المرحلة 2: lastLogin Single Owner (A2) — ✅

**الملفات المعدّلة:**
- `apps/api/src/modules/auth/jwt.strategy.ts` — حذف الـ `prisma.user.update({ lastLogin })` block

**انحرافات عن الـ Plan:** لا يوجد.

**ملاحظات:**
- استبدلت الكود بـ comment block يشرح ليه الـ update اتشال (forensic value لأي مطوّر يحاول يضيفه تاني).
- الـ `AuthService.login()` لسه بيـ update الـ `lastLogin` fire-and-forget (line 327-332 الأصلي). ده الـ behaviour الصح: مرة واحدة لكل login فعلي.

---

## المرحلة 3: Deactivate Bans Supabase (A3) — ✅

**الملفات المعدّلة:**
- `apps/api/src/modules/users/users.service.ts` — `deactivate` و `activate`:
  - `deactivate`: بعد الـ tx، call على `supabaseAdmin.auth.admin.updateUserById(supabaseAuthId, { ban_duration: '24h' })` — best-effort مع `.catch` يـ log warning بدون rollback
  - `activate`: نفس الشكل لكن `ban_duration: 'none'` (clear الـ ban)
  - الـ Supabase ban يحصل **بعد** الـ DB tx يـ commit (لو فشل ميتسببش في rollback)
  - guard على `target.supabaseAuthId` — لو null (user قديم قبل Supabase integration) → skip بدون error

**انحرافات عن الـ Plan:** لا يوجد.

**ملاحظات:**
- `softDelete` كان عنده `ban_duration: '876000h'` (100 سنة = permanent). الفارق بقى واضح:
  - `deactivate` = 24h ban (reversible)
  - `softDelete` = 100y ban (effectively permanent)
- الـ failure mode منطقي: لو الـ Supabase ban فشل، الـ DB حالة `isActive=false` كافية لأن JwtStrategy بترفض الـ user على الـ API surface. الـ Supabase ban هو just defense-in-depth ضد session abuse عبر refresh token.

---

## المرحلة 4: Broken Invite Flow (A4, Q1=A) — ✅

**الملفات المعدّلة:**
- `apps/api/src/modules/users/users.service.ts` — `create`:
  - Logic بقى: لو الـ admin بعت `password` في الـ DTO → نستخدمه as-is ولا نرجّعه في الـ response (الـ admin already knows it)
  - لو الـ admin مبعتش password → الـ service يـ generate `tempPassword` secure (16 char، crypto-random) ويرجّعه في الـ response **مرة واحدة** مع `mustSharePasswordSecurely` warning بالعربي
- `apps/api/src/modules/users/users.controller.ts` — لا تغيير في الـ signature (الـ response shape يتغير بناءً على وجود الـ password في الـ DTO)

**انحرافات عن الـ Plan:**
- الـ plan قال "نرجّع tempPassword دايماً". في التنفيذ ميّزت بين:
  - admin بعت password (يعرفها) → ما نرجعهاش في الـ response
  - admin مبعتش password (هنولّدها) → نرجعها مرة واحدة
- **مبرر الانحراف:** echo-ing الـ admin-provided password على wire غير ضروري ويزود الـ attack surface. الفكرة الأصلية للـ Q1=A كانت "احنا محتاجين الـ admin يعرف الـ password" — لو هو اللي مدخلها أصلاً، الـ goal محقق.

**ملاحظات:**
- الـ `mustSharePasswordSecurely` warning بالعربي صريح: "كلمة المرور المؤقتة تظهر مرة واحدة فقط. سلّمها للمستخدم بأمان (يفضل قناة مشفرة) — ولن تستطيع استرجاعها بعد إغلاق هذه النافذة."
- الـ rollback (DB tx فشل → delete Supabase user) شغّال صح.
- الـ audit log بيتكتب داخل الـ tx — `newValues: { name, email, role }` بدون أي password reference.

---

## المرحلة 5: sortBy Whitelist (A6) — ✅

**الملفات المعدّلة:**
- `apps/api/src/modules/users/dto/index.ts`:
  - `USER_SORT_COLUMNS = ['name', 'email', 'role', 'createdAt', 'lastLogin'] as const` — اقتصرت على الحقول اللي:
    - exposed بالفعل في `USER_SELECT` (مفيش info leak)
    - عندها legitimate UI sort use cases
  - `ListUsersQueryDto.sortBy` بقى `declare sortBy?: string` مع `@IsIn(USER_SORT_COLUMNS)` — `declare` لتجنب override warnings مع الـ base class
  - رسالة الخطأ بالعربي: `حقل الفرز يجب أن يكون أحد: name, email, role, createdAt, lastLogin`

**انحرافات عن الـ Plan:** لا يوجد.

**ملاحظات:**
- لم أعدّل الـ base `PaginationDto` (out of scope — يلمس كل modules).
- استبعدت `id`، `supabaseAuthId`، `companyId`، `phone`، `customPermissions` من الـ whitelist (ordering oracle vectors).
- الـ `updatedAt` و `deletedAt` مش في الـ whitelist — لو في حاجة محتاجاهم ينضافوا لاحقاً بقصد.

---

## المرحلة 6: AppException في Auth (A8) + SupabaseAdminProvider (A9) — ✅

### A8 — AppException في AuthService

**الملفات المعدّلة:**
- `apps/api/src/common/errors/error-codes.ts` — أضيف الـ codes:
  - `AUTH_BIZ_001` — Account locked
  - `AUTH_BIZ_002` — Email already registered
  - `AUTH_BIZ_003` — Subscription expired
  - `AUTH_BIZ_004` — Account deactivated
  - `AUTH_BIZ_005` — Refresh token expired/invalid
  - `AUTH_BIZ_006` — Invalid credentials
  - `AUTH_BIZ_007` — Company unavailable (soft-deleted)
  - `AUTH_SYS_001` — Supabase auth provider unavailable
  - `AUTH_SYS_002` — Supabase ↔ DB inconsistency
- `apps/api/src/modules/auth/auth.service.ts`:
  - 9 throw statements اتحوّلوا من `ConflictException`/`BadRequestException`/`UnauthorizedException` (NestJS) إلى `BusinessException`/`SystemException` (AppException hierarchy)
  - كل `throw` يحتوي:
    - `code` — من `ErrorCodes`
    - `userMessage` — بالعربي للـ frontend
    - `devMessage` — للـ logs (يشمل masked email)
    - `status` — HTTP code
    - `cause` (للـ system exceptions) — original error للـ stack trace
  - الـ login error بيستخدم نفس الـ `userMessage` سواء الـ email غلط أو الـ password غلط — constant-time-ish defense ضد user enumeration

**انحرافات عن الـ Plan:** لا يوجد.

### A9 — SupabaseAdminProvider مشترك

**الملفات الجديدة:**
- `apps/api/src/common/supabase/supabase-admin.provider.ts`:
  - `SupabaseAdminModule` — `@Global()` Nest module
  - `SUPABASE_ADMIN_CLIENT` — Symbol-based InjectionToken
  - `useFactory` يقرأ `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` من ConfigService
  - يـ throw عند الـ boot لو env ناقصة — fail fast
  - `auth: { autoRefreshToken: false, persistSession: false }` — admin client مالوش session

**الملفات المعدّلة:**
- `apps/api/src/app.module.ts` — import `SupabaseAdminModule` (line 45 + 59)
- `apps/api/src/modules/auth/auth.service.ts` — `@Inject(SUPABASE_ADMIN_CLIENT) private readonly supabase` بدل create-client-from-config
- `apps/api/src/modules/users/users.service.ts` — نفس الـ injection pattern للـ `supabaseAdmin`
- `apps/api/src/modules/auth/auth.module.ts` — لا تغيير (الـ SupabaseAdminModule global فمش محتاج imports)

**انحرافات عن الـ Plan:** لا يوجد.

**ملاحظات:**
- اخترت Symbol بدل string token للـ DI — type-safer (`Symbol('SUPABASE_ADMIN_CLIENT')` لا يـ collide مع أي string قد يتكرر).
- الـ `@Global()` makes the provider available everywhere بدون import متكرر في كل module.

---

## Typecheck — `npx tsc --noEmit` (apps/api)

**نتيجة:** ✅ الـ 3 modules اللي اتعملت (auth + users + companies) typecheck نظيفة.

**أخطاء متبقية (خارج النطاق):**
```
src/modules/payments/payments.service.ts        — @prisma/client/runtime/library missing
src/modules/payments/payments.service.spec.ts   — نفس السبب
src/modules/updates/updates.service.ts          — نفس السبب
src/modules/updates/updates.service.spec.ts     — نفس السبب
```
هذه الـ 4 errors **pre-existing** في modules خارج نطاق الـ session (payments + updates). السبب: الـ `@prisma/client/runtime/library` تم نقله في Prisma 7. الإصلاح: import `Decimal` من `@prisma/client` مباشرة بدل `runtime/library`. سيُعالَج في session منفصل.

**Fix صغير اضطُرّ ليه أثناء الـ typecheck:**
- `users.service.ts:135` — `data.notificationPreferences` كانت `Record<string, unknown>` (من الـ DTO type) بينما Prisma يطلب `Prisma.InputJsonValue`. أضيف cast صريح:
  ```typescript
  data.notificationPreferences = dto.notificationPreferences as Prisma.InputJsonValue;
  ```
  هذا تعديل **tactical** للـ type system؛ لا يغيّر runtime behavior.

---

## ملخص نهائي

| Metric | القيمة |
|---|---|
| المراحل المكتملة | 6/6 ✅ |
| الـ Findings المُعالَجة | A1, A2, A3, A4, A5, A6, A8, A9 (8 من أصل 11) |
| الـ Findings المؤجَّلة بقصد | A7 (permission catalog — يحتاج packages/shared-types) — تم تأكيد التأجيل في Q2 |
| Findings ثانوية موثقة | A10 (maskEmail dup)، A11 (TIER_LIMITS circular-import) — P2 |
| الملفات المعدّلة | 9 (+1 ملف جديد: supabase-admin.provider.ts) |
| انحرافات عن الـ Plan | 1 — مرحلة 4: تمييز admin-provided vs generated password (انحراف تحسيني، يقلل attack surface) |
| Pre-existing errors لمسناها | 0 |
| Pre-existing errors تركناها | 4 (payments + updates — out of scope) |
| Migration changes | 0 (business logic only — كما وعدنا في الـ scope) |
| Breaking changes | 1 — `sortBy` whitelist يرفض القيم خارج الـ 5 columns (لا frontend consumer حالياً) |

**جاهز للمراحل التالية:** المخطط (post-execution review) → الهاكر → المختبر → المراجع الأعلى.
