# خطة التنفيذ — Auth + Users + Companies Review

> الدور: 🧠 المخطط (The Architect)
> التاريخ: 2026-05-16
> الحالة: ⏸️ AWAITING APPROVAL

---

## المشكلة

الـ 3 موديولات (Auth، Users، Companies) متبنية والـ structure سليم، لكن مراجعة عميقة ضد الـ skills كشفت **10 findings** — 5 منهم 🔴 critical (audit gap، perf bug، broken invite، security leak)، 3 🟡 important (consistency)، 2 🟢 cleanup.

الـ findings دي مش "bugs اتعملت بالغلط" — معظمها سهوات في الـ pattern compliance:
- audit log اتعمل على معظم الـ services لكن mostly missing في Auth + UpdateMyProfile
- AppException hierarchy اتعملت لكن AuthService لسه بيستخدم NestJS built-ins
- `lastLogin` update اتعمل في 3 أماكن — مفيش owner واحد
- DTOs محكومة في معظم الأماكن لكن `sortBy` لسه `@IsString()` بدون whitelist (info leak عبر ordering oracles)

---

## التحليل

### الـ Findings مرتبة بالخطورة

#### 🔴 P0 — هتدخل الـ session دي

**A1. `registerCompany` بدون audit log**
- **الموقع:** `auth.service.ts:104-125`
- **التحليل:** أهم action في النظام (إنشاء شركة + super_admin) ما بيكتبش `audit_logs`. السكيل 07 صريح: "كل create/update/delete لازم يُسجَّل". لو في dispute قانوني عن متى الشركة اتسجلت → مفيش proof.
- **الـ Root cause:** الـ tx بيخلق Company + User بدون استدعاء `auditLog.logInTransaction(tx, ...)`. مش متعمد — سهو لأن registerCompany سابقة وجود الـ `logInTransaction` helper.
- **التأثير:** قانوني/audit. لو عميل قال "ما اشتركتش" مفيش proof في الـ DB.

**A2. `JwtStrategy.validate()` يكتب على الـ DB كل request**
- **الموقع:** `jwt.strategy.ts:75-78`
- **التحليل:** كل request مصدّق عليه = `prisma.user.update({ lastLogin: now })`. ده يعمل:
  - **Perf hotspot:** 1000 req/s = 1000 write/s على جدول users
  - **`lastLogin` يفقد معناه:** بقى `lastRequest` (متى آخر API call) مش "متى آخر login فعلي"
  - **Double-write على login:** `AuthService.login()` بيعمله fire-and-forget + JwtStrategy بيعمله مرة تانية = 2 updates على نفس الـ row في ثانية واحدة
- **الـ Root cause:** الـ lastLogin update موجود في الـ login (الصح) واتكرر في الـ JwtStrategy (غلط) عشان كل request يحدّث. المنطق الصحيح: update **في login فقط**.
- **التأثير:** Perf + correctness. عند الـ scale يبقى bottleneck.

**A3. `users.deactivate()` لا يحظر Supabase user**
- **الموقع:** `users.service.ts:391-411`
- **التحليل:** بيـ set `isActive: false` في الـ DB بس. الـ user عنده refresh token صالح؟ ممكن يستمر يجدد JWTs عبر Supabase مباشرة، ولما الـ access token الجديد يتفحص في JwtStrategy → بـ reject لأن isActive=false. لكن الـ user عنده **valid Supabase session للـ refresh** — ميقدرش يدخل API لكن الـ identity provider لسه شايفه نشط.
- **الـ Root cause:** الـ `softDelete` بيحظر Supabase user (`ban_duration: '876000h'`)، الـ `deactivate` لا. التمييز مش واضح.
- **التأثير:** Security — deactivated user يقدر يفضل يجدد tokens. غير ضار direct لكن بيدّي impression خاطئ إن الـ deactivate "وقف" الـ user.

**A4. `users.create()` invite flow مكسور**
- **الموقع:** `users.service.ts:161-216`
- **التحليل:** Admin يعمل invite، الـ service بيولد `tempPassword` ويبعت لـ Supabase، يخلق User row في الـ DB — لكن الـ tempPassword **ما بيرجعش في الـ response**. النتيجة:
  - الـ user اتخلق في الـ DB + Supabase
  - مفيش حد عارف الـ password
  - مفيش invite email
  - الـ user عمره ما يقدر يدخل
- **الـ Root cause:** الـ feature متبنية نص — الـ NotificationsModule (اللي المفروض يبعت invite email) لسه commented-out (Phase 1 P0 الباقي). الـ workaround المؤقت: **إرجاع الـ tempPassword للـ admin** عشان ينقله للـ user manually، أو تعليق الـ endpoint بـ 501 NotImplemented لحد ما NotificationsModule يخلص.
- **التأثير:** Functional. الـ feature مش شغال. أي admin يستخدمه بيخلق orphan users.

**A5. `users.updateMyProfile()` بدون audit log + بدون transaction**
- **الموقع:** `users.service.ts:125-140`
- **التحليل:** Self-edits (name, phone, avatar, language, notifications) ما بتنكتبش في audit. لو user غيّر بياناته خلال incident response، مفيش trail يقول إنه عدّل بياناته متى. السكيل 07: "كل mutation = audit".
- **الـ Root cause:** Self-edits ممكن تكون اعتُبرت "low-stakes" وقت الكتابة، لكن دي بياناته الـ identity (name, phone) — اللي ممكن تتسرق عبر XSS وتتغير.
- **التأثير:** Compliance + forensics.

**A6. `ListUsersQueryDto.sortBy` بدون whitelist** (ordering oracle)
- **الموقع:** `common/dto/pagination.dto.ts:23-24`
- **التحليل:** `sortBy?: string = 'createdAt'` بـ `@IsString()` فقط. الـ users.service يـ pass-it للـ Prisma `orderBy: { [sortBy]: sortOrder }`. Attacker يقدر يبعت `sortBy=supabaseAuthId&sortOrder=asc` → الـ list مرتبة بـ supabaseAuthId. كل request يـ leak bits من الـ private IDs (binary search-style attack — paginate + diff الترتيب لاستخراج الـ supabaseAuthId).
- **Caveat:** المشكلة في الـ shared DTO، لكن الـ Users module هو أول مكان فيه users private fields. الإصلاح: لكل list endpoint نعرف الـ allowed sort columns.
- **التأثير:** Info leak. مش catastrophic لكن قابل للاستغلال.

#### 🟡 P1 — يدخل لو في وقت، يتقرر مع المراجع

**A7. `updatePermissions` بدون permission catalog whitelist**
- **الموقع:** `users.service.ts:340-345`
- **التحليل:** أي string بالشكل `resource.action` بيتقبل. Admin يقدر يكتب `db.drop` ويتحفظ. الـ guards بيتجاهلوا الـ unknown permissions، لكن الـ data integrity سيئة.
- **الإصلاح المقترح:** قائمة `KNOWN_PERMISSIONS` من `packages/shared-types` + validate الـ permissions ضدها.

**A8. AuthService بدون AppException hierarchy**
- **الموقع:** `auth.service.ts:90, 92, 159, 202, 230, 234, 237, 241, 297`
- **التحليل:** كل الـ errors `ConflictException` / `BadRequestException` / `UnauthorizedException` من NestJS. باقي الـ modules بتستخدم `AppException` مع error codes موحدة. المختبر لو حب يـ assert على error code مش هيلاقي.
- **الإصلاح المقترح:** wrap في `AuthBusinessException(AUTH_INVALID_CREDENTIALS, ...)` أو يقابلهم.

**A9. Supabase admin client مكرر في `auth.service.ts` و `users.service.ts`**
- **الموقع:** `auth.service.ts:62` و `users.service.ts:56-60`
- **التحليل:** نفس الـ `createClient(...)` في الـ 2 services. لو configuration اتغيرت (URL/key)، الـ update لازم يحصل في الـ 2.
- **الإصلاح المقترح:** `SupabaseAdminProvider` في `common/` يـ inject الـ client.

#### 🟢 P2 — لا يدخل الـ session دي

**A10. `maskEmail` مكرر** في `auth.service.ts:328` و `login-attempts.tracker.ts:142`. نقل لـ `common/utils/mask.ts`.

**A11. `TIER_LIMITS` exported from `companies.service.ts` و imported by `tier-limits.service.ts`** — circular-import-prone. نقل لـ `companies.constants.ts`.

### Findings ثانوية (موثقة، لا تُصلَح هذه الـ session)
- `reserveUniqueSlug` يستخدم `findUnique` بدون `deletedAt: null` filter → soft-deleted company تحتجز slug للأبد. منخفض الخطورة.
- `JwtStrategy.validate()` نون-null assertion على `JWT_SECRET` → لو env ناقصة، runtime error مش clear. تم تغطيتها في `env-validation.ts` على الـ boot، فمقبول.
- `TierLimitsService.assertCanAddX` فيه race condition (count قبل create) → traffic منخفض، نتجاهل.

---

## الحل المقترح

### المرحلة 1 — Audit Gap Closure (P0: A1, A5)

**الهدف:** كل mutation في الـ 3 modules لها audit log داخل الـ transaction.

**الملفات:**
- `auth.service.ts` — `registerCompany`: wrap الـ Company+User create في tx، أضف `logInTransaction` مع `entityType='company'` و `action=CREATE` لكل من الـ Company والـ User
- `users.service.ts` — `updateMyProfile`: lift في `$transaction` + `logInTransaction` مع oldValues snapshot

**التغييرات:**
1. `registerCompany`: نقل الـ `logInTransaction` للـ tx callback. snapshot الـ Company و User newValues مع masking للـ email.
2. `updateMyProfile`:
   - جيب الـ user الحالي قبل update لـ oldValues snapshot
   - lift في `$transaction` + audit
   - الـ entityType='user'، action=UPDATE، userRole=user.role

**الـ Risks:**
- لو الـ audit row فشل → الـ registerCompany بقت كاملة بترجع — الـ user يحاول يسجل تاني. القرار صح (نفضل registration يفشل عن إنه يصير بدون trail).
- `req` في `registerCompany` غير متوفر حالياً — لازم نضيف `@Req() req: Request` للـ controller ونمرره. تأثير: signature change بسيط.

### المرحلة 2 — `lastLogin` Single Owner (P0: A2)

**الهدف:** `lastLogin` يتحدّث **في login فقط**، مش على كل JWT validation.

**الملفات:**
- `jwt.strategy.ts` — حذف الـ `prisma.user.update` block
- `auth.service.ts` — التحديث الموجود في `login()` (line 247-252) يفضل كما هو

**التغييرات:**
1. شيل lines 75-78 من `jwt.strategy.ts`.
2. تأكد إن `login()` لسه بيحدثه — موجود.

**الـ Risks:**
- **Behavioral change:** `lastLogin` كان يتحدّث على كل request → بقى على الـ login فقط. أي UI/report بـ assume "lastLogin = last activity" هيتغير معناه. حالياً مفيش UI يعرضه، فمقبول.
- لو في حد بيستخدم `lastLogin` كـ heartbeat (session activity tracking) → كان غلط أصلاً، الـ source الصح للـ heartbeat = correlation_id في audit_logs.

### المرحلة 3 — Deactivate Bans Supabase (P0: A3)

**الهدف:** `deactivate` يحظر الـ Supabase user (بنفس مدة `softDelete` أو fixed) + `activate` يفك الحظر.

**الملفات:**
- `users.service.ts` — `deactivate` + `activate`

**التغييرات:**
1. `deactivate`: بعد الـ tx، استدعِ `supabaseAdmin.auth.admin.updateUserById(supabaseAuthId, { ban_duration: '24h' })` — مدة محدودة لأنه قابل للإعادة. لو فشل: log warning، لا rollback (الـ DB حالة isActive=false كافية للـ JwtStrategy reject).
2. `activate`: `supabaseAdmin.auth.admin.updateUserById(supabaseAuthId, { ban_duration: 'none' })` — يفك الحظر.

**الـ Risks:**
- لو `target.supabaseAuthId` كان `null` (user اتخلق قبل Supabase integration) → skip بدون error.
- Supabase API change (ban_duration enum) → wrap في try/catch + log واضح.

### المرحلة 4 — Broken Invite Flow (P0: A4)

**القرار:** بما إن `NotificationsModule` لسه commented-out (مينفعش نبعت email)، السلوك المؤقت الأنسب:

**الخيار A (مقترح):** الـ endpoint يرجع الـ `tempPassword` في الـ response **مرة واحدة** + warning واضح:
```typescript
return {
  user: created,
  tempPassword: tempPassword,
  warning: 'كلمة المرور المؤقتة تظهر مرة واحدة فقط. سلّمها للمستخدم بأمان.',
};
```
- pros: الـ feature يعمل دلوقتي. matches workflow real-world (admin بيقول للـ user بالـ password ID على Slack/WhatsApp).
- cons: الـ password في الـ HTTP log و frontend memory. مقبول مع TLS + admin trust.

**الخيار B:** الـ endpoint يرجع 501 NotImplemented لحد ما NotificationsModule يخلص.
- pros: لا data leak ولا dead users.
- cons: feature معطلة لأسابيع.

**القرار:** يحتاج تأكيد منك (نقطة قرار).

**الملفات:** `users.service.ts` + `users.controller.ts` (response type).

### المرحلة 5 — sortBy Whitelist (P0: A6)

**الهدف:** كل list endpoint يحدد بـ `@IsIn([...])` الـ columns المسموح بها للـ sortBy.

**الـ approach:**
- لا تعديل على الـ shared `PaginationDto` (هتأثر على كل الـ modules — out of scope).
- بدلاً: في `ListUsersQueryDto` نـ override الـ sortBy بـ `@IsIn(['name', 'email', 'role', 'createdAt', 'lastLogin'])`.

**التغييرات:**
- `users/dto/index.ts` — `ListUsersQueryDto` يـ override sortBy.

**الـ Risks:**
- breaking change للـ clients اللي بيبعتوا `sortBy=updatedAt` (مش في الـ whitelist). حالياً مفيش frontend بيستخدم الـ endpoint، فمقبول.

### المرحلة 6 — AppException في Auth (P1: A8) + Supabase Provider (P1: A9) + Permissions Whitelist (P1: A7)

**Decision:** ندخّل المرحلة دي **فقط** لو المراحل 1-5 خلصت بدون انحرافات. لو لقينا blockers، نأجلها.

**A7 — Permission catalog:**
- نضيف `KNOWN_PERMISSIONS: ReadonlyArray<string>` في `packages/shared-types`
- `updatePermissions` يـ validate ضدها

**A8 — AppException:**
- نضيف `AuthBusinessException` codes في `error-codes.ts` (AUTH_INVALID_CREDENTIALS, AUTH_ACCOUNT_LOCKED, AUTH_COMPANY_EXPIRED, AUTH_USER_NOT_FOUND)
- نستبدل throws الـ Auth بـ AppException equivalents

**A9 — SupabaseAdminProvider:**
- ملف جديد: `common/supabase/supabase-admin.provider.ts`
- inject في AuthService + UsersService بدل ما كل واحد يـ create client

---

## الـ Skills المطلوبة
- `07-audit-compliance` → §"كل mutation = audit"، §"logInTransaction pattern" — للمرحلة 1
- `01-api-endpoints` → §"DTO validation layers"، §"sortBy whitelist pattern" — للمرحلة 5
- `02-database` → §"transaction boundaries" — للمرحلة 1
- `03-auth-security` → §"session lifecycle"، §"ban vs deactivate distinction" — للمرحلة 3
- `06-error-handling` → §"AppException hierarchy"، §"error codes" — للمرحلة 6 (لو دخلت)
- `08-testing` → §"service spec coverage" — للمختبر بعدين

## نقاط القرار

### Q1 — مرحلة 4 (Invite Flow): A أم B؟
- **A:** نرجّع tempPassword في الـ response (workaround مؤقت)
- **B:** نرجّع 501 NotImplemented لحد ما NotificationsModule يخلص

**توصية المخطط:** A. الـ feature لازم تشتغل دلوقتي، والـ trade-off مقبول مع TLS + admin trust + سطر warning واضح.

### Q2 — مرحلة 6 (P1): تدخل الـ session ولا تتأجل؟
- **Pro دخولها:** AppException consistency = لازم؛ الـ 3 fixes صغيرة (~100 LOC).
- **Con:** الـ session هتكبر؛ A7 يتطلب تعديل packages/shared-types (يلمس الفرونت).

**توصية المخطط:** ندخّل **A8 + A9 فقط** (cleanup داخلي محض). A7 يتأجل لـ session مستقل لأنه يلمس packages/shared-types.

### Q3 — مرحلة 2 (`lastLogin`): هل في report/UI بيعتمد على الـ lastLogin "كـ heartbeat"؟
- لو لا → آمن نشيل الـ update من JwtStrategy.
- لو أيوة → نحتاج بديل (separate `lastActivity` field أو correlation_id-based heartbeat).

**فحص سريع:** بحثت في الـ codebase ومفيش UI/report يستخدم lastLogin غير admin view (مش متبني لسه). آمن.

---

## التأثير على الـ Codebase الحالي

| الملف | إيه اللي هيتغير |
|---|---|
| `auth.service.ts` | `registerCompany` — يدخل في tx واحدة + audit؛ accept `req: Request` arg |
| `auth.controller.ts` | `register` endpoint — يمرر `@Req() req` للـ service |
| `auth.service.ts` (مرحلة 6) | كل throws تتحول لـ `AppException`؛ يحقن `SupabaseAdminProvider` بدل ما يـ create client |
| `jwt.strategy.ts` | حذف الـ lastLogin update block (lines 75-78) |
| `users.service.ts` | `updateMyProfile` يدخل في tx + audit؛ `deactivate`/`activate` يدير ban في Supabase؛ `create` يرجع tempPassword (مرحلة 4-A) |
| `users.controller.ts` | response type للـ `create` يتضمن tempPassword |
| `users/dto/index.ts` | `ListUsersQueryDto.sortBy` يـ override بـ `@IsIn([...])` |
| `companies.service.ts` | لا تغيير في الـ session دي |
| `common/supabase/supabase-admin.provider.ts` (جديد، مرحلة 6) | client مشترك |
| `common/errors/error-codes.ts` (مرحلة 6) | AUTH_* codes جديدة |

**Migrations:** لا — الـ session ده business logic فقط.
**Breaking changes للـ API consumers:** `sortBy` whitelist (المرحلة 5). مفيش consumer حالي. مقبول.

---

## تعريف النجاح

- [ ] `registerCompany` بـ audit log داخل الـ tx (Company.CREATE + User.CREATE)
- [ ] `updateMyProfile` بـ audit log داخل tx + oldValues snapshot
- [ ] `JwtStrategy.validate()` لا يكتب على الـ DB
- [ ] `users.deactivate` و `users.activate` يعدلوا الـ ban_duration في Supabase
- [ ] `users.create` يرجع tempPassword (لو الموافقة على Q1=A) + warning
- [ ] `ListUsersQueryDto.sortBy` بـ `@IsIn([...])` whitelist
- [ ] (لو Q2 approved) كل throws في Auth بـ `AppException` + codes موحدة
- [ ] (لو Q2 approved) `SupabaseAdminProvider` مشترك بدل ما كل service يـ create client
- [ ] لا existing tests فشلت
- [ ] الـ build لسه بيـ pass + typecheck نظيف
- [ ] القرارات في Q1/Q2/Q3 موثقة في الـ coder-report

---

⏸️ AWAITING APPROVAL

رد بـ **"approve"** للمتابعة بكامل الخطة، أو
**"approve: minimum"** للاكتفاء بالمرحلة 1-5 (P0 فقط)، أو
**"edit: ..."** لأي تعديل.

أيضاً محتاج جواب صريح على:
- **Q1:** A (نرجّع tempPassword) أم B (501 NotImplemented)؟
- **Q2:** ندخّل المرحلة 6 ولا نأجلها؟
