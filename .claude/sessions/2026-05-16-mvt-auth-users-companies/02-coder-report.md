# تقرير المبرمج 💻

> Session: 2026-05-16-mvt-auth-users-companies
> الموافقة: approve (كامل) + D4=extract الـ factory

---

## المرحلة 1: Test Infrastructure (mocks) — ✅

**الملفات الجديدة:**
- `apps/api/src/test-utils/prisma-mock.ts` (62 LOC) — `createMockPrisma()`:
  - `user` و `company` كل واحد عنده 6 jest.fn() (findFirst/findUnique/findMany/create/update/count)
  - `$transaction` بـ dual-mode: callback form يـ pass الـ mock نفسه كـ tx (assertions على `prisma.user.X` تـ match calls عبر `tx.user.X`) + array form يـ resolve الـ promises
  - `softDeleteFilter` getter matches PrismaService الحقيقي (`{ deletedAt: null }`)
  - export الـ `MockPrisma` و `MockPrismaModel` types عشان الـ specs تـ annotate الـ callback parameters
- `apps/api/src/test-utils/audit-log-mock.ts` (27 LOC) — `createMockAuditLog()`:
  - `logInTransaction` + `log` كلاهما `jest.fn().mockResolvedValue(undefined)` — الـ production service يرجع void
  - export الـ `MockAuditLog` interface
- `apps/api/src/test-utils/supabase-mock.ts` (66 LOC) — `createMockSupabase()`:
  - `auth.admin.{createUser, deleteUser, updateUserById, signOut}` — كل واحد بـ default reasonable
  - `createUser` default → `{ data: { user: { id: 'sup-mock-id' } }, error: null }` (happy path)
  - `signInWithPassword` + `refreshSession` بـ session كاملة (access_token + refresh_token + expires_at)
  - الـ rotated tokens في `refreshSession` لها قيم مختلفة (`access.jwt.rotated` vs `access.jwt.mock`) — يسهل تأكيد إن الـ rotation حصلت في specs الـ refresh
  - export الـ `MockSupabase`، `MockSupabaseAuth`، `MockSupabaseAdmin` interfaces

**Smoke spec:**
- `apps/api/src/test-utils/test-utils.spec.ts` (110 LOC، 11 tests) — يـ verify:
  - `createMockPrisma` يـ expose كل الـ 6 methods على user + company
  - `softDeleteFilter` يطابق الـ getter الحقيقي
  - `$transaction` (callback form) يـ alias الـ tx مع نفس الـ mock (الـ assertion الحرجة للـ specs اللي جاية)
  - `$transaction` (array form) يـ resolve الـ promises
  - كل `createMock*()` يرجع instance مستقل (لا state leaks)
  - الـ default returns على `createUser`، `signInWithPassword`، `refreshSession`

**انحرافات عن الـ Plan:** لا يوجد.

**ملاحظات:**
- الـ `MockPrismaModel.findMany` ضُمَّ في الـ interface (مش في الـ Plan أصلاً) لأن `users.service.findAll` يستخدمه — وهنحتاجه في spec المرحلة 5 (CVE-USERS-004 regression). إضافة، مش تغيير سلوك.
- الـ utilities تـ expose الـ interfaces (`MockPrisma`، `MockAuditLog`، `MockSupabase`) كـ named exports عشان الـ specs تقدر تـ annotate الـ callback parameters — اكتشفته في الـ smoke test أول run لما TS رفض الـ `tx` بدون نوع.
- الـ casting pattern في الـ specs المستقبلية:
  ```typescript
  const prisma = createMockPrisma();
  const service = new UsersService(prisma as unknown as PrismaService, ...);
  ```
  موثق في الـ docstring لكل utility.

**Verification:**
```
$ npx jest src/test-utils/test-utils.spec.ts
Test Suites: 1 passed, 1 total
Tests:       11 passed, 11 total ✓

$ npx jest src/modules/auth/login-attempts.tracker.spec.ts src/modules/companies/tier-limits.service.spec.ts
Test Suites: 2 passed, 2 total
Tests:       23 passed, 23 total ✓   (Session 1 baseline لسه ثابت — لا regression)

$ npx tsc --noEmit
# 4 pre-existing errors في payments/updates (out of scope) فقط — 0 errors جديدة
```

---

## ملخص مرحلي

- المراحل المكتملة: **1/6**
- الملفات الجديدة: **4** (3 utilities + 1 smoke spec)
- LOC المضافة: **~265**
- Tests الجديدة: **11 passing**
- Tests الـ baseline (Session 1): **23 لسه passing — لا regression**
- typecheck: نظيف على الـ utilities + الـ smoke spec
- انحرافات عن الـ Plan: 0

---

## المرحلة 2: Algorithmic / DTO specs — ✅

**ترتيب التنفيذ:** D4 refactor → A9 spec → A6 spec → CVE-USERS-005 spec.

### D4 — Extract `createSupabaseAdminClient` factory

**الملف المعدّل:**
- `apps/api/src/common/supabase/supabase-admin.provider.ts`:
  - استخرجت الـ inline `useFactory` إلى exported function `createSupabaseAdminClient(config: ConfigService): SupabaseClient`
  - الـ provider الـ Nest الآن يفوّض للـ function: `useFactory: createSupabaseAdminClient`
  - الـ السلوك unchanged — نفس الـ checks، نفس الـ throw message، نفس الـ client config (`autoRefreshToken: false`, `persistSession: false`)
  - docstring جديد يوضّح ليه (Session 1.5 D4 — testability)

**انحرافات عن الـ Plan:** لا يوجد.

### Spec 1 — A9 SupabaseAdminProvider (`supabase-admin.provider.spec.ts`)

**الملف الجديد:** 60 LOC، **4 tests passing**:
1. ✅ both env vars present → returns truthy SupabaseClient with `.auth` namespace
2. ✅ `NEXT_PUBLIC_SUPABASE_URL` missing → throws `/FATAL: Missing Supabase configuration/`
3. ✅ `SUPABASE_SERVICE_ROLE_KEY` missing → throws same error
4. ✅ both missing → throws

**ملاحظة:** الـ test يستخدم `configWith()` helper لـ stub الـ `ConfigService.get()` بدون NestJS bootstrap — أنظف وأسرع.

### Spec 2 — A6 ListUsersQueryDto sortBy whitelist (`list-users-query.dto.spec.ts`)

**الملف الجديد:** 65 LOC، **14 tests passing**:
- **6 tests** (`it.each(ALLOWED)`) — كل قيمة من `['name', 'email', 'role', 'createdAt', 'lastLogin']` بـ 0 errors
- **2 tests** — default behavior (no sortBy) + sortBy + sortOrder combination
- **1 test** — `sortBy=supabaseAuthId` (الـ original leak vector) → 1 error بـ constraint `isIn`
- **5 tests** (`it.each([...])`) — id/companyId/customPermissions/phone/deletedAt كلها مرفوضة بـ `isIn`
- **1 test** — `sortOrder=sideways` يرفض (sanity على الـ inherited PaginationDto)

**ملاحظة:** الـ assertion على `constraints.isIn` (مش مجرد "errors.length > 0") يثبت إن **الـ whitelist** هو اللي رفض، مش الـ type check — regression net صلب.

### Spec 3 — CVE-USERS-005 password distribution (`users.service.spec.ts`)

**الملف الجديد:** 90 LOC، **3 tests passing**:
1. ✅ `length === 16` على 20 sample
2. ✅ كل char من الـ 62-char alphabet (sanity check على 800 char)
3. ✅ **Uniform distribution** على 160,000 samples (10,000 password × 16 char):
   - Expected per char: 160,000 / 62 ≈ 2580
   - Tolerance: ±14% → band `[2220, 2940]`
   - الـ old modulo bias (chars 0-7 يضربوا ~3125 vs uniform 2500) **كانت ستفشل** بسبب الـ upper bound

**ملاحظة فنية:** الـ test ينفّذ في ~1.5s محلياً. لو حصل failure، الـ outliers تـ console.error قبل الـ assertion يسهّل الـ triage. الـ timeout مرفوع لـ 15s لـ CI safety.

**انحرافات عن الـ Plan:** لا يوجد.

### Verification

```
$ npx jest --testPathPatterns='(auth|users|companies|supabase|test-utils)'
Test Suites: 6 passed, 6 total
Tests:       55 passed, 55 total ✓

$ npx tsc --noEmit
# 4 pre-existing errors في payments/updates (out of scope) فقط — 0 errors جديدة
```

**تقسيمة الـ 55 tests:**
- `test-utils.spec.ts` — 11 (المرحلة 1)
- `login-attempts.tracker.spec.ts` — ~15 (Session 1 baseline)
- `tier-limits.service.spec.ts` — ~8 (Session 1 baseline)
- `supabase-admin.provider.spec.ts` — 4 (A9 جديد)
- `list-users-query.dto.spec.ts` — 14 (A6 جديد)
- `users.service.spec.ts` — 3 (CVE-USERS-005 جديد)

### Coverage حتى الآن (MVT progress)

| Finding | Spec الـ MVT | عدد الـ tests | الحالة |
|---|---|---|---|
| A1 (registerCompany audit) | المرحلة 4 | — | ⏳ pending |
| A2 (JwtStrategy no DB write) | المرحلة 3 | — | ⏳ pending |
| A3 (Supabase ban) | المرحلة 5 | — | ⏳ pending |
| A4 (invite conditional response) | المرحلة 5 | — | ⏳ pending |
| A5 (updateMyProfile selective oldValues) | المرحلة 5 | — | ⏳ pending |
| **A6 (sortBy whitelist)** | `list-users-query.dto.spec.ts` | 14 | ✅ |
| A8 (AppException codes) | المرحلة 4 | — | ⏳ pending |
| **A9 (SupabaseAdminProvider)** | `supabase-admin.provider.spec.ts` | 4 | ✅ |
| CVE-USERS-004 (update full oldValues) | المرحلة 5 | — | ⏳ pending |
| **CVE-USERS-005 (modulo bias)** | `users.service.spec.ts` | 3 | ✅ |

**3/10 fixes مغطّاة بـ MVT حتى الآن.**

---

## ملخص مرحلي (بعد المرحلة 2)

- المراحل المكتملة: **2/6**
- الملفات الجديدة في الـ session: **7** (3 utilities + 1 smoke spec + 3 spec ملفات)
- الملفات المعدّلة (non-behavioral): **1** (supabase-admin.provider.ts — D4 extract)
- Tests الجديدة في الـ session: **32** (11 المرحلة 1 + 21 المرحلة 2)
- Tests الـ baseline (Session 1): **23 لسه passing — لا regression**
- typecheck: نظيف على الـ session deliverables
- انحرافات عن الـ Plan: 0

---

## المرحلة 3: JwtStrategy spec (A2 core MVT) — ✅

**الملف الجديد:**
- `apps/api/src/modules/auth/jwt.strategy.spec.ts` — 85 LOC، **3 tests passing**:

### Tests

1. ✅ **`returns the expected JwtPayload shape on a healthy user`**
   - mock `prisma.user.findFirst` → user كامل بـ `customPermissions: ['projects.read']`
   - assert الـ return بـ `.toEqual({ sub, email, userId, companyId, role, permissions: [...] })` — exact shape match
   - يضمن إن الـ JwtPayload contract ثابت (أي downstream `req.user.X` بيعتمد عليه)

2. ✅ **`does NOT write to the database during validation (CORE A2 regression net)`** — هذا هو الـ MVT الرئيسي للـ A2:
   - mock `findFirst` يرجع user healthy
   - call `.validate(...)`
   - **3 negative assertions:**
     - `prisma.user.update` لم تُنادى
     - `prisma.user.create` لم تُنادى
     - `prisma.$transaction` لم تُنادى
   - لو أي refactor مستقبلي يضيف "heartbeat" أو "lastActivity tracker" داخل `.validate()` → الـ test يفشل فوراً

3. ✅ **`rejects a deactivated user with UnauthorizedException`**
   - mock user بـ `isActive: false` → `validate()` يرمي `UnauthorizedException`
   - belt-and-suspenders: assert إن `prisma.user.update` لم تُنادى حتى في الـ failure path

### ملاحظات فنية

- **`PassportStrategy(Strategy)` constructor:** الـ `super(...)` call مع secretOrKey صحيح ساعد إن الـ instantiation تنجح في الـ unit test بدون Passport runtime. الـ key المستخدم في الـ stub: `'unit-test-secret-very-long-padding-padding'` — قيمة مرضية لـ HS256.

- **`makeActiveUser()` factory:** helper بـ overrides pattern. الـ tests الـ 3 تشاركوا الـ base shape — الاختلافات (customPermissions، isActive) تُمرَّر كـ override صراحةً.

- **`buildStrategy(prisma)` factory:** يـ inject ConfigService stub يفهم فقط `JWT_SECRET`. الـ JwtStrategy ما يقرأش أي env var تاني داخل `validate()`، فالـ stub المحدود كافٍ.

- **حالات الـ rejection الباقية** (`!user`، `company.deletedAt`، `subscriptionStatus === 'EXPIRED'`) خارج الـ MVT الـ 3 لكن الـ pattern موثّق — يضافوا في session لاحق لو محتاج deeper coverage.

**انحرافات عن الـ Plan:** لا يوجد.

### Verification

```
$ npx jest src/modules/auth/jwt.strategy.spec.ts
Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total ✓

$ npx jest --testPathPatterns='(auth|users|companies|supabase|test-utils)'
Test Suites: 7 passed, 7 total
Tests:       58 passed, 58 total ✓   (55 من قبل + 3 جديدة)

$ npx tsc --noEmit
# 4 pre-existing errors في payments/updates (out of scope) فقط — 0 errors جديدة
```

### Coverage بعد المرحلة 3 (MVT progress)

| Finding | Spec الـ MVT | عدد الـ tests | الحالة |
|---|---|---|---|
| A1 (registerCompany audit) | المرحلة 4 | — | ⏳ pending |
| **A2 (JwtStrategy no DB write)** | `jwt.strategy.spec.ts` | 3 | ✅ |
| A3 (Supabase ban) | المرحلة 5 | — | ⏳ pending |
| A4 (invite conditional response) | المرحلة 5 | — | ⏳ pending |
| A5 (updateMyProfile selective oldValues) | المرحلة 5 | — | ⏳ pending |
| **A6 (sortBy whitelist)** | `list-users-query.dto.spec.ts` | 14 | ✅ |
| A8 (AppException codes) | المرحلة 4 | — | ⏳ pending |
| **A9 (SupabaseAdminProvider)** | `supabase-admin.provider.spec.ts` | 4 | ✅ |
| CVE-USERS-004 (update full oldValues) | المرحلة 5 | — | ⏳ pending |
| **CVE-USERS-005 (modulo bias)** | `users.service.spec.ts` | 3 | ✅ |

**4/10 fixes مغطّاة بـ MVT.**

---

## ملخص مرحلي (بعد المرحلة 3)

- المراحل المكتملة: **3/6**
- الملفات الجديدة في الـ session: **8** (3 utilities + 1 smoke + 4 spec ملفات)
- الملفات المعدّلة (non-behavioral): **1** (supabase-admin.provider.ts — D4)
- Tests الجديدة في الـ session: **35** (11 + 21 + 3)
- Tests الـ baseline (Session 1): **23 لسه passing — لا regression**
- typecheck: نظيف على الـ session deliverables
- انحرافات عن الـ Plan: 0

---

## المرحلة 4: AuthService spec (A1 + A8 + A2 indirect) — ✅

**الملف الجديد:**
- `apps/api/src/modules/auth/auth.service.spec.ts` — 195 LOC، **5 tests passing**

### Tests

**`describe('AuthService.registerCompany — A1 audit, A8 error codes')`**

1. ✅ **A1 MVT — `writes 2 audit rows ... inside the same transaction`**
   - Happy path: mock الـ duplicate-checks بـ null، mock الـ slug probe بـ null، mock الـ `tx.company.create`/`tx.user.create` بـ resolved values
   - **3 assertions حرجة:**
     - `auditLog.logInTransaction` تُنادى **مرتين** (Company.CREATE + User.CREATE)
     - الـ `entityTypes` تحتوي على `'company'` و `'user'` (بـ `arrayContaining` — يتسامح مع الـ order)
     - كل entry: `action === 'CREATE'`، `companyId === 'co-1'`، `oldValues === null`
     - `prisma.$transaction` تُنادى **مرة واحدة** (الـ 2 audit rows داخل tx واحد، مش top-level)

2. ✅ **A8 MVT — `throws BusinessException(AUTH_BIZ_002) when company email is already registered`**
   - mock `prisma.company.findFirst` → existing → `validateRegistration` يرفض قبل ما يلمس Supabase
   - assertion على `.code === ErrorCodes.AUTH_BIZ_002` (contract stable)
   - **defensive assertions:** `supabase.auth.admin.createUser` و `auditLog.logInTransaction` لم تُنادى — يثبت إن الـ early-return شغّال

3. ✅ **A8 — `throws SystemException(AUTH_SYS_001) when Supabase createUser fails with a non-conflict error`**
   - mock الـ duplicate-checks بـ null، mock `supabase.auth.admin.createUser` بـ error generic ('service unavailable')
   - assert `caught instanceof SystemException && caught.code === AUTH_SYS_001`
   - يثبت إن الـ Supabase outage يـ map للـ system tier (مش business tier) — مهم للـ alerting/monitoring

**`describe('AuthService.login — A8 error codes, A2 lastLogin update')`**

4. ✅ **A8 MVT — `throws BusinessException(AUTH_BIZ_006) on wrong credentials`**
   - mock `signInWithPassword` بـ error
   - assert `caught instanceof BusinessException && caught.code === AUTH_BIZ_006`
   - الـ message constant (مش بيـ distinguish بين "email غلط" و "password غلط") — sanity check للـ constant-time defense (موثق، مش asserted هنا تجنّب الـ message coupling)

5. ✅ **A2 indirect — `updates lastLogin exactly once on a successful login`**
   - mock `user.findFirst` بـ user healthy + `user.update.mockResolvedValue({})` (الـ fire-and-forget catch chain يتطلب promise حقيقية)
   - `await Promise.resolve()` بعد `login()` عشان الـ microtask للـ fire-and-forget يتم
   - **assertion ثنائية:**
     - `prisma.user.update` تُنادى **مرة واحدة بالظبط**
     - الـ args يحتوي `where: { id: 'user-1' }` و `data: { lastLogin: expect.any(Date) }`
   - **علاقة بـ A2:** الـ jwt.strategy.spec.ts (المرحلة 3) يثبت إن `validate()` ما يحدثش `lastLogin`؛ هذا الـ test يثبت إن `login()` بيحدثه — مجموعة الـ 2 specs تـ pin الـ invariant: "تحديث واحد لكل login فعلي، صفر تحديثات لكل request".

### ملاحظات فنية

- **fire-and-forget timing:** الـ `login()` ينفذ `prisma.user.update(...).catch(...)` بدون `await`. الـ jest mock يـ record الـ call immediately (synchronous)، لكن الـ `.catch` على الـ returned promise يتطلب الـ mock يرجع promise — لو ما رجعش، الـ `.catch` يرمي TypeError على undefined. حللتها بـ `prisma.user.update.mockResolvedValue({})` per-test.
- **`expect.any(Date)`** على الـ `lastLogin` value — ما نقيدش الـ time بالظبط (clock skew). يكفي إن النوع Date.
- **LoginAttemptsTracker** استخدمت instance حقيقي (مش mock) لأنه pure logic، لا I/O. لو مـ stubbedش، الـ assertions على lockout state من spec الـ المرحلة 4 ممكن تخـ leak إلى spec تاني — لكن `build()` يـ instantiate جديد كل test، فلا state leakage.
- **`auditLog.logInTransaction.mock.calls[i][1]`** — الـ index 1 لأن الـ signature: `(tx, entry)`. الـ entry هو الـ argument الثاني.

**انحرافات عن الـ Plan:** لا يوجد.

### Verification

```
$ npx jest src/modules/auth/auth.service.spec.ts
Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total ✓

$ npx jest --testPathPatterns='(auth|users|companies|supabase|test-utils)'
Test Suites: 8 passed, 8 total
Tests:       63 passed, 63 total ✓   (58 من قبل + 5 جديدة)

$ npx tsc --noEmit
# 4 pre-existing errors فقط (out of scope) — 0 errors جديدة
```

### Coverage بعد المرحلة 4 (MVT progress)

| Finding | Spec الـ MVT | عدد الـ tests | الحالة |
|---|---|---|---|
| **A1 (registerCompany audit)** | `auth.service.spec.ts` | 1 (core) | ✅ |
| **A2 (JwtStrategy no DB write)** | `jwt.strategy.spec.ts` + `auth.service.spec.ts` (لـ login side) | 3 + 1 | ✅ |
| A3 (Supabase ban) | المرحلة 5 | — | ⏳ pending |
| A4 (invite conditional response) | المرحلة 5 | — | ⏳ pending |
| A5 (updateMyProfile selective oldValues) | المرحلة 5 | — | ⏳ pending |
| **A6 (sortBy whitelist)** | `list-users-query.dto.spec.ts` | 14 | ✅ |
| **A8 (AppException codes)** | `auth.service.spec.ts` | 3 (BIZ_002 + SYS_001 + BIZ_006) | ✅ |
| **A9 (SupabaseAdminProvider)** | `supabase-admin.provider.spec.ts` | 4 | ✅ |
| CVE-USERS-004 (update full oldValues) | المرحلة 5 | — | ⏳ pending |
| **CVE-USERS-005 (modulo bias)** | `users.service.spec.ts` | 3 | ✅ |

**6/10 fixes مغطّاة بـ MVT.**

---

## ملخص مرحلي (بعد المرحلة 4)

- المراحل المكتملة: **4/6**
- الملفات الجديدة في الـ session: **9** (3 utilities + 1 smoke + 5 spec ملفات)
- الملفات المعدّلة (non-behavioral): **1** (supabase-admin.provider.ts — D4)
- Tests الجديدة في الـ session: **40** (11 + 21 + 3 + 5)
- Tests الـ baseline (Session 1): **23 لسه passing — لا regression**
- typecheck: نظيف على الـ session deliverables
- انحرافات عن الـ Plan: 0

---

## المرحلة 5: UsersService spec — A3 + A4 + A5 + CVE-USERS-004 — ✅

**الملف المعدّل (إضافة):**
- `apps/api/src/modules/users/users.service.spec.ts` — أضيف `buildHarness()` factory + `adminJwt` fixture + `mockReq` + 3 describe blocks جديدة، **6 tests passing جديدة** (الإجمالي 9 في الـ ملف).

### Harness pattern

- `buildHarness()` يرجع `{ service, prisma, auditLog, supabase, tierLimits }` — يفتح الـ mocks للـ assertion على side-effects.
- `buildService()` القديم لسه مستخدم في الـ CVE-USERS-005 distribution tests (مالوش حاجة بالـ mocks).
- `adminJwt` fixture موحّد (`SUPER_ADMIN` بـ `companyId='co-1'`) — يتشارك عبر الـ 6 tests.

### Tests الجديدة

**`describe('UsersService.deactivate / activate (A3 — Supabase ban management)')`**

1. ✅ **A3 — `deactivate calls supabase.updateUserById with ban_duration=24h`**
   - target = WORKER (يتجنب `ensureNotLastSuperAdmin` — out of scope هنا)
   - mock `prisma.user.findFirst` + `prisma.user.update`
   - assert `supabase.auth.admin.updateUserById` تُنادى **مرة واحدة** بـ `('sup-target-1', { ban_duration: '24h' })`

2. ✅ **A3 — `activate calls supabase.updateUserById with ban_duration=none`**
   - نفس الـ shape لكن target بـ `isActive: false` ابتداءً
   - assert الـ ban duration === `'none'` (clears الـ ban)

**`describe('UsersService.create (A4 — conditional tempPassword echo)')`**

3. ✅ **A4 MVT — `returns tempPassword + warning when the admin did NOT supply a password`**
   - DTO بدون `password` field
   - **3 assertions:** `result.user` defined، `typeof result.tempPassword === 'string'`، `tempPassword.length === 16`، `mustSharePasswordSecurely` نص غير-فارغ
   - يثبت الـ MVT للـ Q1=A workaround behavior

4. ✅ **A4 — `does NOT echo a password back when the admin supplied one`**
   - DTO فيها `password: 'AdminPicked!1Pw'`
   - **`result.tempPassword === undefined` + `result.mustSharePasswordSecurely === undefined`** — يثبت الـ "deviation تحسيني" من Session 1 (admin-provided ما يـ echoش)
   - يحمي الـ wire/log exposure regression

**`describe('UsersService audit oldValues selectivity')`**

5. ✅ **A5 MVT — `updateMyProfile: oldValues snapshot is scoped to changed fields only`**
   - pre-fetch يرجع `{ name, phone, avatar, notificationPreferences, preferredLanguage }` كاملة
   - DTO = `{ phone: '+201999999' }` فقط
   - **CORE assertion:** `entry.oldValues` deep-equals `{ phone: '+201000000' }` — لا تسرّب لـ name/avatar/إلخ من الـ pre-fetch
   - assertions ثانوية: `entityType === 'user'`، `action === 'UPDATE'`

6. ✅ **CVE-USERS-004 MVT — `update: oldValues includes specialty + avatar but NOT unchanged fields`**
   - الـ target الكامل في الـ findFirst (name + phone + specialty + avatar + preferredLanguage)
   - DTO = `{ specialty: 'NewSpec', avatar: 'https://new.avatar' }`
   - **CORE assertion:** `entry.oldValues` deep-equals `{ specialty: 'OldSpec', avatar: 'https://old.avatar' }` بالظبط
   - **Belt-and-suspenders:** 3 `not.toHaveProperty()` calls على `name`/`phone`/`preferredLanguage` — لو refactor بيرجع لـ old "always { name, phone }" pattern، الـ test يفشل

### ملاحظات فنية

- **`describe('UsersService audit oldValues selectivity')`** يجمع الـ A5 + CVE-USERS-004 لأن الـ invariant نفسه ("oldValues = الحقول المتغيرة فقط") مطبَّق على flow-ين مختلفين. اسم الـ describe يوضّح ده.
- **`mock.calls[0][1]`** — index 0 للـ first call، index 1 للـ second argument (الـ entry بعد الـ tx). الـ destructuring `const [, entry] = ...` يتجاوز الـ tx ويوصل للـ entry مباشرة.
- **`expect.not.toHaveProperty`** على الـ oldValues يكشف الـ over-snapshotting bugs اللي الـ `toEqual` وحده قد يفوّتها لو الـ developer ضاف الـ key لكن بقيمة `undefined`.
- **`makeWorkerTarget()`** factory محلي لـ A3 tests — يحدد بوضوح إن الـ scope هو الـ Supabase side-effect، مش الـ SUPER_ADMIN invariant (للأخير spec منفصل في session مستقبلي).

**انحرافات عن الـ Plan:** لا يوجد.

### Verification

```
$ npx jest src/modules/users/users.service.spec.ts
Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total ✓     (3 المرحلة 2 + 6 المرحلة 5)

$ npx jest --testPathPatterns='(auth|users|companies|supabase|test-utils)'
Test Suites: 8 passed, 8 total
Tests:       69 passed, 69 total ✓   (63 من قبل + 6 جديدة)

$ npx tsc --noEmit
# 4 pre-existing errors فقط (out of scope) — 0 errors جديدة
```

### Coverage بعد المرحلة 5 (MVT progress)

| Finding | Spec الـ MVT | عدد الـ tests | الحالة |
|---|---|---|---|
| **A1 (registerCompany audit)** | `auth.service.spec.ts` | 1 (core) | ✅ |
| **A2 (JwtStrategy no DB write)** | `jwt.strategy.spec.ts` + `auth.service.spec.ts` | 3 + 1 | ✅ |
| **A3 (Supabase ban)** | `users.service.spec.ts` | 2 (deactivate + activate) | ✅ |
| **A4 (invite conditional response)** | `users.service.spec.ts` | 2 (gen + admin-provided) | ✅ |
| **A5 (updateMyProfile selective oldValues)** | `users.service.spec.ts` | 1 | ✅ |
| **A6 (sortBy whitelist)** | `list-users-query.dto.spec.ts` | 14 | ✅ |
| **A8 (AppException codes)** | `auth.service.spec.ts` | 3 | ✅ |
| **A9 (SupabaseAdminProvider)** | `supabase-admin.provider.spec.ts` | 4 | ✅ |
| **CVE-USERS-004 (update full oldValues)** | `users.service.spec.ts` | 1 | ✅ |
| **CVE-USERS-005 (modulo bias)** | `users.service.spec.ts` | 3 | ✅ |

**10/10 fixes مغطّاة بـ MVT.** ✅ — الـ Definition of Done الإجباري من الـ Plan تحقق.

---

## ملخص مرحلي (بعد المرحلة 5)

- المراحل المكتملة: **5/6**
- الملفات الجديدة في الـ session: **9** (3 utilities + 1 smoke + 5 spec ملفات)
- الملفات المعدّلة (non-behavioral): **1** (supabase-admin.provider.ts — D4)
- Tests الجديدة في الـ session: **46** (11 + 21 + 3 + 5 + 6)
- Tests الـ baseline (Session 1): **23 لسه passing — لا regression**
- **MVT coverage: 10/10 fixes ✅** (الحد الأدنى من الـ Plan = 10، الـ session مدّاه)
- typecheck: نظيف على الـ session deliverables
- انحرافات عن الـ Plan: 0

---

## المرحلة 6: Verification & guard rails — ✅

**التغييرات في الكود:** صفر — المرحلة دي verification فقط.

### نتيجة الـ jest على الـ scope

```
$ npx jest --testPathPatterns='(auth|users|companies|supabase|test-utils)'

Test Suites: 8 passed, 8 total
Tests:       69 passed, 69 total
Snapshots:   0 total
Time:        9.011 s
```

**تفصيل الـ 8 suites:**

| Spec file | Tests | المصدر |
|---|---:|---|
| `test-utils/test-utils.spec.ts` | 11 | المرحلة 1 (smoke على الـ utilities) |
| `auth/login-attempts.tracker.spec.ts` | 15 | Session 1 baseline |
| `companies/tier-limits.service.spec.ts` | 8 | Session 1 baseline |
| `common/supabase/supabase-admin.provider.spec.ts` | 4 | المرحلة 2 (A9) |
| `users/dto/list-users-query.dto.spec.ts` | 14 | المرحلة 2 (A6) |
| `users/users.service.spec.ts` | 9 | المرحلتان 2 + 5 (CVE-005، A3، A4، A5، CVE-004) |
| `auth/jwt.strategy.spec.ts` | 3 | المرحلة 3 (A2) |
| `auth/auth.service.spec.ts` | 5 | المرحلة 4 (A1، A8، A2-indirect) |
| **المجموع** | **69** | |

**الـ math check:** 23 (baseline) + 46 (session 1.5 جديدة) = 69 ✓

### نتيجة الـ typecheck

```
$ npx tsc --noEmit

src/modules/payments/payments.service.spec.ts(20,25): error TS2307: Cannot find module '@prisma/client/runtime/library'
src/modules/payments/payments.service.ts(29,25):      error TS2307: Cannot find module '@prisma/client/runtime/library'
src/modules/updates/updates.service.spec.ts(27,25):   error TS2307: Cannot find module '@prisma/client/runtime/library'
src/modules/updates/updates.service.ts(36,25):        error TS2307: Cannot find module '@prisma/client/runtime/library'
```

- **4 pre-existing errors** في payments + updates (out of scope — موروثة من Session 1، يحتاج session منفصل لـ Prisma 7 Decimal migration)
- **0 errors جديدة** من أي ملف لمسناه في الـ session دي

### Definition of Done — final check

| المعيار | الحالة |
|---|:---:|
| MVT: ≥10 specs مكتوبة وpassing (الـ floor الإجباري) | ✅ 10/10 |
| Spec على الأقل لكل من A1, A2, A3, A4, A5, A6, A8, A9, CVE-USERS-004, CVE-USERS-005 | ✅ |
| `jest --testPathPatterns='(auth\|users\|companies\|supabase\|test-utils)'` exit 0 | ✅ |
| الـ 23 baseline tests من Session 1 لسه passing (لا regression) | ✅ |
| Typecheck نظيف على الـ 3 modules + الـ specs الجديدة | ✅ |
| الـ D4 refactor (supabase-admin.provider) لا يكسر الـ wiring الموجود | ✅ |
| الـ 02-coder-report يحتوي الـ test counts per phase + jest output النهائي | ✅ |

---

## ملخص نهائي للـ Session

### الـ deliverables

| Type | Count | تفاصيل |
|---|---:|---|
| الملفات الجديدة | **9** | 3 utilities + 1 smoke + 5 spec ملفات |
| الملفات المعدّلة (non-behavioral) | **1** | `supabase-admin.provider.ts` — D4 factory extract |
| تعديلات على business logic | **0** | Plan-locked: tests-only session |
| Tests الجديدة | **46** | 11 + 21 + 3 + 5 + 6 (per phase) |
| Tests passing (in-scope, total) | **69 / 69** | 23 baseline + 46 new |
| MVT coverage | **10 / 10 fixes** | كل fix من Session 1 له ≥1 spec |
| typecheck errors جديدة | **0** | الـ 4 pre-existing فقط، out of scope |
| انحرافات عن الـ Plan | **0** | كل الـ phases على المتفق عليه |
| LOC مضافة (تقدير) | **~720** | utilities + 5 specs |

### الـ fixes اللي اتغطّت بـ MVT

| Finding | Spec File | Tests | الـ Invariant المحمي |
|---|---|---:|---|
| **A1** | `auth.service.spec.ts` | 1 | registerCompany يـ emit Company.CREATE + User.CREATE داخل tx واحد |
| **A2** | `jwt.strategy.spec.ts` + `auth.service.spec.ts` | 3+1 | `validate()` لا يكتب على DB؛ `login()` يحدّث lastLogin مرة واحدة |
| **A3** | `users.service.spec.ts` | 2 | `deactivate` → ban 24h؛ `activate` → ban none |
| **A4** | `users.service.spec.ts` | 2 | tempPassword echoed فقط لما الـ service يولّدها |
| **A5** | `users.service.spec.ts` | 1 | updateMyProfile oldValues = الحقول المتغيرة فقط |
| **A6** | `list-users-query.dto.spec.ts` | 14 | sortBy whitelist بـ `@IsIn` (مش `@IsString` فقط) |
| **A8** | `auth.service.spec.ts` | 3 | كل throw له `.code` ضمن `ErrorCodes.AUTH_*` |
| **A9** | `supabase-admin.provider.spec.ts` | 4 | factory يـ fail-fast على missing env |
| **CVE-USERS-004** | `users.service.spec.ts` | 1 | `update` oldValues يشمل specialty/avatar (مش name/phone هاردكود) |
| **CVE-USERS-005** | `users.service.spec.ts` | 3 | password distribution موحّدة عبر 62 char (لا modulo bias) |

### حالة الـ session

- ✅ كل المراحل الـ 6 منفّذة
- ✅ كل الـ MVT criteria محققة
- ✅ صفر regressions
- ✅ Tests-only — صفر تعديل سلوكي على الـ business logic
- جاهز للأدوار التالية: 🧠 المخطط (post-execution review) ثم 🔴 الهاكر ثم 🧪 المختبر ثم 👁️ المراجع الأعلى

✋ تم المبرمج — للدور التالي (🧠 المخطط post-execution)؟
