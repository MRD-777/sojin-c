# خطة التنفيذ — Session 1.5 (MVT debt)

> الدور: 🧠 المخطط (The Architect)
> التاريخ: 2026-05-17
> الحالة: ⏸️ AWAITING APPROVAL

---

## المشكلة

Session 1 (auth + users + companies review) خلصت بـ 10 fixes (8 plan + 2 hacker) لكن **0 specs مكتوبة** — المختبر اعترف بصراحة بأن الحد الأدنى ما اتعملش. النتيجة: الـ 10 fixes الـ critical (audit gap closure، ban-on-deactivate، modulo-bias fix) **بدون regression net**. أي session لاحق ممكن يكسر invariant بدون detection.

المراجع الأعلى في Session 1 رفع `جودة الـ Tests: 3/10` ووضع `Coverage` كـ Condition #1 قبل production.

## التحليل

ليه السيشن الأولى ما كتبتش الـ specs؟
1. **عدم وجود MVT budget في الـ Plan** — الـ "تعريف النجاح" كان فيه بنود كود لا بنود tests. الـ المختبر ما عندوش mandate
2. **عدم وجود test infrastructure** — مفيش `createMockPrisma()` أو `createMockAuditLog()`. الـ ~70 specs الموصى بها هتـ duplicate نفس الـ mocks 70 مرة بدون utilities
3. **Pre-existing typecheck errors** في payments/updates منعت `jest` بدون filter من الـ run

الـ Root cause = **process gap** (مش technical). الإصلاح الـ procedural تم في CLAUDE.md (rule #2 + #3 الجديدة). الـ session دي تـ pay-down الـ debt الفعلي.

### حدود الـ MVT في هذا الـ session

الـ MVT = "1 test على الأقل لكل fix يثبت إن الـ behavior المطلوب موجود". مش "coverage كاملة". الـ tail الـ ~60 spec يبقى للـ session منفصل بعد ما الـ infrastructure تستقر.

---

## الحل المقترح

### المرحلة 1: Test infrastructure (mocks) — ~80 LOC

**الهدف:** mocks يـ reuse عبر الـ specs لتجنب duplication.

**الملفات:**
- `apps/api/src/test-utils/prisma-mock.ts` (جديد)
- `apps/api/src/test-utils/audit-log-mock.ts` (جديد)
- `apps/api/src/test-utils/supabase-mock.ts` (جديد)

**التغييرات:**
1. `createMockPrisma()` — يرجع object فيه:
   - `user.findFirst`, `user.findUnique`, `user.update`, `user.create`, `user.count` — كلها `jest.fn()`
   - `company.findFirst`, `company.findUnique`, `company.create`, `company.update`
   - `$transaction` — implementation تـ call الـ callback مع `tx` mock (= نفس الـ object)
   - `softDeleteFilter` getter = `{ deletedAt: null }`
2. `createMockAuditLog()` — يرجع `{ logInTransaction: jest.fn(), log: jest.fn() }`
3. `createMockSupabase()` — يرجع object فيه `auth.admin.{createUser, deleteUser, updateUserById, signOut}` + `auth.{signInWithPassword, refreshSession}`

**الـ Risks:**
- الـ `$transaction` mock الـ trivial (يـ call الـ callback مع نفسه) ميختبرش race conditions، لكن كافي للـ MVT
- لو في spec محتاج tx-isolation فعلية، نـ skip بـ TODO comment ونـ flag

---

### المرحلة 2: Algorithmic / DTO specs (الأسهل، لا Prisma) — ~3 specs

**الهدف:** لقطة سريعة للـ fixes اللي ممكن تتـ test بدون mocks ثقيلة.

**الملفات:**
- `apps/api/src/modules/users/users.service.spec.ts` — قسم `generateSecurePassword` (CVE-USERS-005)
- `apps/api/src/modules/users/dto/list-users-query.dto.spec.ts` (جديد، A6)
- `apps/api/src/common/supabase/supabase-admin.provider.spec.ts` (جديد، A9)

**التغييرات:**

**Spec 1 — `generateSecurePassword` distribution (CVE-USERS-005):**
- يـ instantiate `UsersService` بـ mocks (الـ method private، نـ call عبر `(service as any).generateSecurePassword()`)
- يـ generate 10,000 password (لا 16 char كل واحد = 160,000 char)
- يـ compute frequency لكل char في الـ 62-char alphabet
- assertion: كل char له count في `[2200, 2950]` (~2580 expected ± 14% tolerance — chi-squared loose bound). لو الـ bias موجود، الـ first 8 chars هتطلع >3000 والباقي <2500
- **2 tests:** `length===16`، `uniform distribution within tolerance`

**Spec 2 — `ListUsersQueryDto.sortBy` whitelist (A6):**
- يستخدم `class-validator`'s `validate()` على instance من الـ DTO
- 3 cases:
  - `sortBy: 'name'` → 0 errors
  - `sortBy: 'supabaseAuthId'` → 1 error مع `constraints.isIn`
  - `sortBy: 'createdAt', sortOrder: 'desc'` (default) → 0 errors
- **3 tests**

**Spec 3 — `SupabaseAdminProvider` env validation (A9):**
- يستورد الـ `useFactory` من الـ provider (نـ extract كـ exported function للـ testability، **أو** نـ test عبر NestJS test bed)
- مفضل: نـ extract الـ factory لـ exported `createSupabaseAdminClient(config)` function في نفس الـ file. الـ provider يستخدمها. الـ test يـ call الـ function direct
- Cases:
  - ConfigService بـ both env vars → returns client
  - ConfigService بـ URL غايبة → throws `'FATAL: Missing Supabase configuration'`
  - ConfigService بـ key غايبة → throws نفس الـ error
- **2 tests** (refactor تـ extract function يلمس supabase-admin.provider.ts — تعديل غير-سلوكي)

**الـ Risks:**
- الـ distribution test بطيء (10k iterations) — possible to drop to 5k لو slow
- الـ refactor للـ provider (extract factory) **يلمس production code** — يحتاج موافقة منك. البديل: NestJS test bed (أبطأ + verbose). توصيتي: الـ extract لأنه يحسن الـ testability بدون كسر سلوك
- الـ DTO test يحتاج `class-transformer`'s `plainToInstance` + `validate` — الـ pattern موجود في `env-validation.spec.ts` كمرجع

---

### المرحلة 3: JwtStrategy spec (A2) — ~1 spec ملف

**الهدف:** يثبت إن `JwtStrategy.validate()` لا يكتب على الـ DB.

**الملفات:**
- `apps/api/src/modules/auth/jwt.strategy.spec.ts` (جديد)

**التغييرات:**
- يـ instantiate `JwtStrategy` بـ `ConfigService` mock + `PrismaService` mock (الـ `createMockPrisma`)
- الـ ConfigService mock يرجع `JWT_SECRET = 'test-secret'`
- الـ `prisma.user.findFirst` mock يرجع user كامل (active، company.subscriptionStatus='ACTIVE'، company.deletedAt=null)
- يـ call `.validate({ sub: 'supabase-id' })`
- **3 tests (MVT minimum = 1):**
  1. `validate_returns_jwt_payload_shape` — assert على {sub, email, userId, companyId, role, permissions}
  2. `validate_does_not_write_to_db` — assert `prisma.user.update` mock بـ 0 calls (CORE MVT لـ A2)
  3. `validate_rejects_inactive_user` — mock user.isActive=false → throws UnauthorizedException

**الـ Risks:**
- `PassportStrategy(Strategy)` extension يـ require الـ `super(...)` call. الـ constructor باق يـ work في الـ unit test direct (مفيش Passport runtime). لو في issues، نـ scope الـ test لـ `.validate()` فقط
- الـ JwtPayload type قد يـ require fields ما اتعطتش — `customPermissions` من user

---

### المرحلة 4: AuthService spec (A1, A4 part, A8) — ~1 spec ملف، ~5 tests

**الهدف:** الـ MVT لـ A1 + A8. ملاحظة: A4 جزئياً (الـ invite في users.service.ts، مش auth.service.ts) — هنا نـ test الـ register flow.

**الملفات:**
- `apps/api/src/modules/auth/auth.service.spec.ts` (جديد)

**التغييرات:**

**Spec — `registerCompany`:**
- mocks: `PrismaService` (mock), `LoginAttemptsTracker` (real)، `AuditLogService` (mock)، `SupabaseClient` (mock)
- Cases:
  1. **A1 MVT** — happy path: تـ assert `auditLog.logInTransaction` تُنادى **مرتين** بـ entityType ∈ `{company, user}` و `action: CREATE` (واحد لكل) — هذا الـ regression net للـ A1
  2. **A8 MVT** — duplicate email: mock `prisma.company.findFirst` يرجع موجود → assert throws مع `instanceof BusinessException` و `error.code === 'AUTH_BIZ_002'`
  3. (extra) — Supabase fail → throws `SystemException` بـ `code === 'AUTH_SYS_001'` (validates A8 system path)

**Spec — `login`:**
  4. **A8 MVT** — wrong credentials: Supabase signInWithPassword يرجع error → throws `BusinessException` بـ `code === 'AUTH_BIZ_006'`
  5. **A2 indirect** — successful login: `prisma.user.update` تُنادى مرة واحدة مع `data.lastLogin` (يثبت إن `login()` لسه يحدث الـ lastLogin؛ الـ A2 المخطط أكد إن الـ JwtStrategy ما يحدثهاش)

**الـ Risks:**
- `randomBytes` import في `auth.service.ts` (للـ slug generation) — لازم الـ mock للـ `reserveUniqueSlug` indirectly (عبر `company.findUnique` mock يرجع null)
- الـ test الـ 5 (login lastLogin) يـ verify السلوك الإيجابي لـ A2؛ الـ سلوك السلبي (JwtStrategy ما يحدثش) موثق في الـ JwtStrategy spec

---

### المرحلة 5: UsersService spec (A3, A4, A5, CVE-004) — ~1 spec ملف، ~6 tests

**الهدف:** الـ MVT لـ A3 + A4 + A5 + CVE-USERS-004.

**الملفات:**
- `apps/api/src/modules/users/users.service.spec.ts` — يـ extend الـ ملف من المرحلة 2 (يحتوي بالفعل على generateSecurePassword tests)

**التغييرات:**

**Tests (يضافوا للـ ملف الموجود):**

1. **A3 MVT — `deactivate`:** mock target user عنده `supabaseAuthId='abc'`، mock prisma.user.update يرجع user. assert `supabase.auth.admin.updateUserById` تُنادى **مرة واحدة** بـ `(supabaseAuthId, { ban_duration: '24h' })`
2. **A3 — `activate`:** نفس الـ shape لكن `ban_duration: 'none'`
3. **A4 MVT — `create` بدون password:** dto بدون password → response يحتوي `tempPassword` و `mustSharePasswordSecurely`
4. **A4 — `create` بـ password:** dto بـ password='UserChose1!' → response **ما يحتويش** `tempPassword`
5. **A5 MVT — `updateMyProfile`:** dto = `{ phone: '+201234' }` → assert `auditLog.logInTransaction` تُنادى بـ `oldValues: { phone: <old> }` بدون `name`
6. **CVE-USERS-004 MVT — `update`:** dto = `{ specialty: 'X', avatar: 'Y' }` → assert `auditLog.logInTransaction` تُنادى بـ `oldValues: { specialty: <old>, avatar: <old> }` (يثبت الـ fix بـ regression net)

**الـ Risks:**
- الـ `$transaction` mock في الـ utility يـ call الـ callback مع نفسه — يكفي للـ assertion على `tx.user.update` و `auditLog.logInTransaction(tx, ...)`
- الـ `TierLimitsService` dependency في `create` — mock بـ `assertCanAddUser: jest.fn().mockResolvedValue(undefined)`
- الـ Supabase `auth.admin.createUser` mock يرجع `{ data: { user: { id: 'sup-id' } }, error: null }`

---

### المرحلة 6: Verification & guard rails

**التغييرات:**
1. تشغيل `npx jest --testPathPattern='(auth|users|companies|supabase)'` — يـ verify إن الـ specs الجديدة تـ pass بدون touching الـ payments/updates errors
2. تشغيل `npx tsc --noEmit` — يـ verify إن الـ specs الجديدة لا تـ introduce typecheck errors جديدة (الـ 4 pre-existing من Session 1 لسه موجودة، out of scope)
3. تحديث `02-coder-report.md` بالـ test counts

**الـ Risks:** صفر — verification فقط.

---

## الـ Skills المطلوبة

- `08-testing` → §"service unit tests"، §"jest.fn assertion patterns"، §"transaction mocking"
- `06-error-handling` → §"AppException assertion: assert .code، not .message"
- `03-auth-security` → §"constant-time message verification" (للـ A8 wrong-credentials test)

---

## نقاط القرار

### D1 — Controller-level specs؟
- **القرار:** لا. الـ controllers رقيقة (decorator-driven forwarding للـ service). الـ MVT على الـ service-level يـ cover الـ regression net. الـ controller tests يبقوا للـ session منفصل (HTTP layer testing مع supertest).
- **توصية:** approve as-stated.

### D2 — Test utilities الآن ولا بعدين؟
- **القرار:** الآن — الـ duplication عبر 4 spec ملفات من نفس الـ Prisma mock = ~150 LOC duplicate لو inline. الـ utility ملف واحد = ~80 LOC.
- **توصية:** approve as-stated.

### D3 — `@prisma/client/runtime/library` blocker؟
- **القرار:** نـ scope الـ jest بـ `--testPathPattern` filter. الـ migration session منفصل.
- **توصية:** approve as-stated.

### D4 — Refactor `SupabaseAdminProvider` لـ extract factory function؟ (مرحلة 2، spec 3)
- **الـ context:** الـ factory الحالية inline في الـ `providers` array. لتـ test الـ env validation بدون NestJS bootstrap كامل، نحتاج نـ extract الـ factory function لـ exported `createSupabaseAdminClient(config: ConfigService)`. الـ provider يستخدمها.
- **التأثير:** ~5 سطور تغيير، non-behavioral. الـ provider لسه يـ inject نفس الـ Symbol، الـ runtime مفيش فرق.
- **البديل:** نـ test عبر `Test.createTestingModule({ providers: [SupabaseAdminProvider] })` — verbose، أبطأ، لكن zero production change.
- **توصية:** extract الـ factory (production يفضل + الـ test أوضح). محتاج موافقة منك.

### D5 — `generateSecurePassword` distribution test sample size؟
- **الـ context:** 10,000 samples × 16 chars = 160,000 char أحرف. على alphabet=62، expected per-char ≈ 2581. tolerance ±14% → `[2220, 2940]`. لو الـ modulo bias الـ قديم (8/256 chars بيوصلوا) موجود، الـ first 8 chars هيطلعوا فوق 3000.
- **البديل:** 5,000 samples → expected ≈ 1290، tolerance ±20% → الـ test يكشف الـ bias الكبير لكن قد يفوّت الـ subtle drift
- **توصية:** 10,000. الـ test هياخد ~200ms — مقبول.

---

## التأثير على الـ Codebase الحالي

| الملف | إيه اللي هيتغير |
|---|---|
| `apps/api/src/test-utils/prisma-mock.ts` (جديد) | utility لـ createMockPrisma() |
| `apps/api/src/test-utils/audit-log-mock.ts` (جديد) | utility لـ createMockAuditLog() |
| `apps/api/src/test-utils/supabase-mock.ts` (جديد) | utility لـ createMockSupabase() |
| `apps/api/src/common/supabase/supabase-admin.provider.ts` | extract `createSupabaseAdminClient()` exported function (D4)؛ الـ provider يستخدمها — non-behavioral |
| `apps/api/src/common/supabase/supabase-admin.provider.spec.ts` (جديد) | 2 tests لـ A9 |
| `apps/api/src/modules/auth/auth.service.spec.ts` (جديد) | 5 tests لـ A1 + A2 (indirect) + A8 |
| `apps/api/src/modules/auth/jwt.strategy.spec.ts` (جديد) | 3 tests لـ A2 + auth rejection paths |
| `apps/api/src/modules/users/users.service.spec.ts` (جديد) | 8 tests لـ A3 + A4 + A5 + CVE-004 + CVE-005 |
| `apps/api/src/modules/users/dto/list-users-query.dto.spec.ts` (جديد) | 3 tests لـ A6 |

**Migrations:** لا.
**Breaking changes:** لا.
**تعديل على business logic:** صفر (الـ refactor للـ D4 هيكلي بحت، يخرج export موجود).

---

## تعريف النجاح

- [ ] **MVT: 21 specs مكتوبة وpassing (الحد الأدنى = 10 — 1 لكل fix؛ المخطط للـ 21 لتغطية صلبة)** (إجباري)
- [ ] 1 spec على الأقل لكل من: A1, A2, A3, A4, A5, A6, A8, A9, CVE-USERS-004, CVE-USERS-005 (10 fixes × ≥1 spec)
- [ ] `npx jest --testPathPattern='(auth|users|companies|supabase|test-utils)'` ينتهي بـ exit 0
- [ ] الـ existing 23 tests من Session 1 (login-attempts + tier-limits) لسه passing
- [ ] الـ typecheck للـ specs الجديدة + الـ 3 modules نظيف (الـ 4 pre-existing payments/updates errors out of scope)
- [ ] الـ refactor لـ `SupabaseAdminProvider` (D4 لو approved) لا يكسر الـ wiring الموجود — يـ verify بـ `npx tsc --noEmit` + import grep
- [ ] الـ 02-coder-report.md يحتوي على الـ test counts per phase + الـ jest output النهائي

---

⏸️ AWAITING APPROVAL

رد بـ **"approve"** للمتابعة بكامل الخطة، أو **"edit: ..."** لأي تعديل.

محتاج جواب صريح على:
- **D4:** نـ extract الـ factory في `supabase-admin.provider.ts` (توصيتي) ولا نـ test عبر NestJS test bed؟

✋ تم المخطط — للدور التالي (💻 المبرمج)؟
