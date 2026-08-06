# تقرير المبرمج — Session 1.6: MVT Hardening

> Session ID: `2026-05-20-mvt-hardening`
> Plan reference: `00-plan.md` (4 phases، MVT budget = 10 specs)
> Mode: `attack-and-fix` على test code فقط — أي production-code gap → NEEDS-CODER (rule #6).

---

## المرحلة 1: P0 CRITICAL — Paired DB-write + Audit redaction — ✅

**الـ findings المعالجة:** TEST-001 (×2 specs)، TEST-002 (×2 specs).

**الملفات المعدّلة:**

- `apps/api/src/modules/users/users.service.spec.ts`:
  - **A5 `updateMyProfile` spec** (~line 308-321 سابقاً): appended paired assertion `prisma.user.update.toHaveBeenCalledWith({where:{id:'admin-1'}, data:{phone:'+201999999'}})`.
  - **CVE-USERS-004 `update` spec** (~line 323-360 سابقاً): appended paired assertion `prisma.user.update.toHaveBeenCalledWith({where:{id:'target-1'}, data:{specialty:'NewSpec', avatar:'https://new.avatar'}})`.
  - **A4 generated-password spec** (~line 234-258 سابقاً): added `auditLog` للـ destructuring، appended 3 redaction assertions (`newValues not.toHaveProperty('password' | 'tempPassword' | 'supabaseAuthId')`).
  - **A4 admin-supplied-password spec** (~line 260-287 سابقاً): نفس الـ pattern كـ A4 generated.

**انحرافات عن الـ Plan:**
- لا يوجد. الـ assertions الفعلية تطابقت 1:1 مع snippets الـ Plan؛ الـ object containing pattern مستخدم كما هو موصى به في الـ Risks section.
- ملاحظة: استخدمت `expect.objectContaining({where, data})` بدل strict `toHaveBeenCalledWith({where, data, select: ...})` — السبب: الـ `select: USER_SELECT` thirdـpartial شامل وغير ثابت inline في الـ spec؛ الـ pattern الـ loose يحمي الـ regression net الأساسي (where + data) ويتغاضى عن الـ select shape الـ implementation-detail.

**ملاحظات إضافية:**
- **Production code zero diff** — كل الـ تعديلات في spec file واحد. لا تغيير على `users.service.ts` ولا أي service آخر.
- **Comments واضحة:** كل assertion block ليه inline comment يـ document `TEST-XXX (Session 1.6)` + سبب الـ assertion (paired DB-write، sensitive-payload-leak).
- **Pre-flight verification on production code:**
  - Verified `users.service.ts:265-275` يستخدم `auditLog.logInTransaction(tx, {...})` (مش `log()`) → الـ A4 assertions يمكنها قراءة `mock.calls[0][1]` بدون TypeError.
  - Verified `newValues: { name, email, role }` (line 273) → الـ redaction assertions `not.toHaveProperty('password' | 'tempPassword' | 'supabaseAuthId')` كلها سـ pass.
  - Verified `prisma.user.update` يـ called مع `{where, data, select}` shape (لقطة من الـ update method) → الـ `objectContaining` pattern compatible.

---

### Verification — المرحلة 1

**jest stdout (literal — `npx jest src/modules/users/users.service.spec.ts --no-coverage`):**

```
ts-jest[config] (WARN) message TS151002: Using hybrid module kind (Node16/18/Next) is only supported in "isolatedModules: true". Please set "isolatedModules: true" in your tsconfig.json. To disable this message, you can set "diagnostics.ignoreCodes" to include 151002 in your ts-jest config. See more at https://kulshekhar.github.io/ts-jest/docs/getting-started/options/diagnostics
Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
Snapshots:   0 total
Time:        29.632 s
Ran all test suites matching src/modules/users/users.service.spec.ts.
```

- ✅ **9 tests passed** — نفس العدد قبل الـ Phase 1 (الـ 4 modifications أضافت assertions داخل specs موجودة، مش specs جديدة).
- ⚠️ ts-jest warning عن `isolatedModules` — pre-existing config issue، unrelated to Phase 1.

**tsc stderr (literal — `npx tsc --noEmit` على `apps/api`):**

```
src/modules/payments/payments.service.spec.ts(20,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/payments/payments.service.ts(29,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/updates/updates.service.spec.ts(27,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/updates/updates.service.ts(36,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
```

- **0 errors في `users.service.spec.ts`** ولا في أي ملف عدّلته الـ Phase 1.
- الـ 4 errors الموجودة كلها pre-existing — `@prisma/client/runtime/library` deprecated import path في `payments/*` و `updates/*` files. مسجلة في `PLAN.md` NEEDS-CODER backlog ("@prisma/client/runtime/library → @prisma/client migration"). **لا تأثير من الـ Phase 1**.

**MVT count بعد المرحلة 1:** 4/10 (TEST-001-A، TEST-001-B، TEST-002-A، TEST-002-B).

---

## المرحلة 2: P1 HIGH — Forensic integrity + Fire-and-forget + Tier ordering — ✅

**الـ findings المعالجة:** TEST-003، TEST-004، TEST-005.

**الملفات المعدّلة:**

- `apps/api/src/modules/auth/auth.service.spec.ts`:
  - **A1 `registerCompany` spec** (line ~127-147 سابقاً): appended entity-specific `find()` lookups + `entityId` assertions (companyAudit.entityId = `co-1`، userAudit.entityId = `user-1`). الـ existing `for` loop ولا الـ `$transaction` assertion ما اتغيراش.
  - **New spec بعد lastLogin spec** (TEST-004): `returns success even when the fire-and-forget lastLogin update rejects` — `prisma.user.update.mockRejectedValue(...)` + assertion إن الـ login returns `accessToken` defined. Microtask drain (×2) لاستيعاب الـ rejected promise قبل الـ test exit.

- `apps/api/src/modules/users/users.service.spec.ts`:
  - **New spec في A4 describe** (TEST-005): `checks the tier limit BEFORE touching Supabase` — `tierLimits.assertCanAddUser.mockRejectedValueOnce(...)` + `expect(supabase.auth.admin.createUser).not.toHaveBeenCalled()` + `expect(prisma.user.create).not.toHaveBeenCalled()`.

**انحرافات عن الـ Plan:**
- لا يوجد. الـ 3 specs تطابقت 1:1 مع snippets الـ Plan.
- ملاحظة طفيفة: TEST-004 spec أضاف assertion إضافي `expect(prisma.user.update).toHaveBeenCalledTimes(1)` بعد الـ microtask drain — sanity check إن الـ fire-and-forget call فعلاً انطلقت (مش إن الـ implementation skip-the-update entirely).

**ملاحظات إضافية:**
- **Pre-flight verification on production code (TEST-004):**
  - Verified `auth.service.ts:327-332`:
    ```typescript
    this.prisma.user
      .update({ where: { id: user.id }, data: { lastLogin: new Date() } })
      .catch((err) => this.logger.error('Failed to update lastLogin', err));
    ```
    لا `await` على الـ call → fire-and-forget شغّال فعلاً. الـ spec هيـ pass.
- **Pre-flight verification on production code (TEST-005):**
  - Verified `users.service.ts:217` (`assertCanAddUser`) قبل `users.service.ts:235` (`supabaseAdmin.auth.admin.createUser`) — الـ ordering الصحيح موجود. الـ spec هيـ pass.
- **Production code zero diff** — لا تغيير على أي production file. كل التعديلات حصرياً في 2 spec files.
- **الـ logger noise في jest stdout (TEST-004):** الـ stack trace في الـ output هو الـ `logger.error('Failed to update lastLogin', err)` من production code's `.catch()` — **proof إيجابي** إن الـ fire-and-forget `.catch()` branch ركض فعلاً. مش regression.

---

### Verification — المرحلة 2

**jest stdout (literal — `npx jest src/modules/auth/auth.service.spec.ts src/modules/users/users.service.spec.ts --no-coverage`):**

```
[Nest] 13428  - 05/20/2026, 1:25:44 AM     LOG [AuthService] ✅ Company registered: "Acme Construction" [co-1] by alice@acme.test
[Nest] 13428  - 05/20/2026, 1:25:44 AM   ERROR [AuthService] Supabase auth creation failed for alice@acme.test
service unavailable
[Nest] 13428  - 05/20/2026, 1:25:44 AM    WARN [AuthService] Failed login attempt #1 for: al***@acme.test
[Nest] 13428  - 05/20/2026, 1:25:44 AM   ERROR [AuthService] Failed to update lastLogin
[Nest] 13428  - 05/20/2026, 1:25:44 AM   ERROR [AuthService] Error: DB unavailable
    at Object.<anonymous> (D:\tampalets\saas-one\apps\api\src\modules\auth\auth.service.spec.ts:263:42)
    ... (jest-circus internal frames trimmed)

Test Suites: 2 passed, 2 total
Tests:       16 passed, 16 total
Snapshots:   0 total
Time:        4.825 s, estimated 6 s
Ran all test suites matching src/modules/auth/auth.service.spec.ts|src/modules/users/users.service.spec.ts.
```

- ✅ **16 tests passed** (6 في auth + 10 في users) — كان 14 قبل Phase 2، أضفنا 2 new specs (TEST-004 + TEST-005). TEST-003 modification داخل spec موجود فما زاد العدد.
- ⚠️ الـ ERROR logger lines في الـ output هي output من الـ production-code `.catch()` block — تثبت إن الـ fire-and-forget `.catch()` ركض في TEST-004 (الـ A1 + BIZ_006 errors بقت الـ pre-existing specs).
- الـ stack trace `at auth.service.spec.ts:263:42` يـ point للـ `mockRejectedValue(new Error('DB unavailable'))` في TEST-004 — expected.

**tsc stderr (literal — `npx tsc --noEmit` على `apps/api`):**

```
src/modules/payments/payments.service.spec.ts(20,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/payments/payments.service.ts(29,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/updates/updates.service.spec.ts(27,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/updates/updates.service.ts(36,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
```

- **0 errors في `auth.service.spec.ts` ولا `users.service.spec.ts`** ولا في أي ملف معدّل في Phase 2.
- نفس الـ 4 pre-existing errors من Phase 1 — لا تغيير، لا new errors من Phase 2.

**MVT count بعد المرحلة 2:** 7/10 (TEST-001-A، TEST-001-B، TEST-002-A، TEST-002-B، TEST-003، TEST-004، TEST-005).

---

## المرحلة 3: P2 MEDIUM — Defensive paths (null guard + audit content) — ✅

**الـ findings المعالجة:** TEST-006، TEST-007-A، TEST-007-B.

**الملفات المعدّلة:**

- `apps/api/src/modules/users/users.service.spec.ts`:
  - **deactivate spec** (A3 describe): added `auditLog` للـ destructuring + appended 6 audit-content assertions (entityType، entityId، action، oldValues=`{isActive:true}`، newValues=`{isActive:false}`).
  - **activate spec** (A3 describe): نفس الـ pattern لكن mirrored — oldValues=`{isActive:false}`، newValues=`{isActive:true}`.
  - **New spec** (TEST-006): `deactivate skips the Supabase call when supabaseAuthId is null (legacy user)` — `findFirst` يرجع `{...makeWorkerTarget(), supabaseAuthId: null}` + `expect(supabase.auth.admin.updateUserById).not.toHaveBeenCalled()`.

**انحرافات عن الـ Plan:**

- **استخدمت `toEqual` بدل `toMatchObject`** في TEST-007 audit assertions. السبب: الـ production code (`users.service.ts:516-517` و `:570-571`) يكتب `oldValues` و `newValues` بـ shape محدود `{ isActive: boolean }` فقط — مفيش `reason` field فعلاً. الـ `toEqual` يـ provide tighter regression net (يكشف أي field يضاف لاحقاً عن طريق الخطأ). الـ Plan recommended `toMatchObject` كحماية افتراضية، بس production code الفعلي يـ allow `toEqual` بأمان. الـ deviation متعمدة + موثقة + consistent مع pattern Phase 1 (الـ A5 spec يستخدم `toEqual` أيضاً).

**ملاحظات إضافية:**

- **Pre-flight verification on production code:**
  - **TEST-006 guard:** Verified `users.service.ts:526`:
    ```typescript
    if (target.supabaseAuthId) {
      await this.supabaseAdmin.auth.admin
        .updateUserById(target.supabaseAuthId, { ban_duration: '24h' })
        .catch(...);
    }
    ```
    الـ guard موجود → الـ spec سيـ pass.
  - **TEST-007 audit shape:** Verified `users.service.ts:516-517` (deactivate) و `:570-571` (activate) — الـ audit rows فيها `isActive` فقط في `oldValues`/`newValues`. الـ `toEqual` strict matching يتماشى مع production state.
- **Production code zero diff** — Phase 3 modifications حصرياً في `users.service.spec.ts`.
- **A4 spec destructure update from Phase 1:** لاحظت إن الـ A3 specs كانت بتـ destructure `{ service, prisma, supabase }` فقط — أضفت `auditLog` للـ destructure في الـ deactivate و activate specs. الـ `buildHarness()` بيرجع `auditLog` بالفعل، فالتعديل آمن.

---

### Verification — المرحلة 3

**jest stdout (literal — `npx jest src/modules/users/users.service.spec.ts --no-coverage`):**

```
ts-jest[config] (WARN) message TS151002: Using hybrid module kind (Node16/18/Next) is only supported in "isolatedModules: true". Please set "isolatedModules: true" in your tsconfig.json. To disable this message, you can set "diagnostics.ignoreCodes" to include 151002 in your ts-jest config. See more at https://kulshekhar.github.io/ts-jest/docs/getting-started/options/diagnostics
Test Suites: 1 passed, 1 total
Tests:       11 passed, 11 total
Snapshots:   0 total
Time:        5.883 s
Ran all test suites matching src/modules/users/users.service.spec.ts.
```

- ✅ **11 tests passed** — كان 10 بعد Phase 2 (9 + 1 TEST-005). الـ Phase 3 أضاف 1 spec جديد (TEST-006) → 11. الـ TEST-007-A/B تعديلات داخل specs موجودة فما زادت العدد.
- ⚠️ ts-jest config warning — pre-existing، unrelated to Phase 3.

**tsc stderr (literal — `npx tsc --noEmit` على `apps/api`):**

```
src/modules/payments/payments.service.spec.ts(20,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/payments/payments.service.ts(29,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/updates/updates.service.spec.ts(27,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/updates/updates.service.ts(36,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
```

- **0 errors في `users.service.spec.ts`** ولا في أي ملف معدّل في Phase 3.
- نفس الـ 4 pre-existing errors — لا تغيير، لا new errors من Phase 3.

**MVT count بعد المرحلة 3:** 9/10 (TEST-001-A، TEST-001-B، TEST-002-A، TEST-002-B، TEST-003، TEST-004، TEST-005، TEST-006، TEST-007-A، TEST-007-B = 10 spec-units لكن TEST-007-A و TEST-007-B = pair واحد في MVT count → 9 unique findings مغطاة. الباقي للـ Phase 4: TEST-008، TEST-009، TEST-010 = 3 findings).

> ملاحظة عن العد: الـ MVT budget في الـ Plan = 10 spec-units (TEST-007 يحسب 2 specs منفصلين). بعد Phase 3 = 9 spec-units مكتوبة (الـ 4 من Phase 1 + 3 من Phase 2 + 2 من Phase 3). الباقي = 3 specs في Phase 4 → final = 10 محققاً المـ MVT budget.

---

## المرحلة 4: P3 LOW — Lockout state + Client config + Smoke integration — ✅

**الـ findings المعالجة:** TEST-008، TEST-009، TEST-010.

**الملفات المعدّلة:**

- `apps/api/src/modules/auth/auth.service.spec.ts`:
  - **wrong-credentials spec** (TEST-008): added `loginAttempts` للـ destructuring + appended assertion `expect(loginAttempts.check(VALID_LOGIN_DTO.email).failures).toBe(1)` بعد الـ throw assertion.

- `apps/api/src/common/supabase/supabase-admin.provider.spec.ts`:
  - **Restructured entire file** (TEST-009): added `jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn().mockReturnValue({ auth: {} }) }))` على module level + imported `createClient` + `beforeEach` يـ clear الـ call history + new spec `passes stateless config (autoRefreshToken=false, persistSession=false) to createClient` يـ assert `createClient` تـ called بـ `{ auth: { autoRefreshToken: false, persistSession: false } }`.
  - الـ existing 4 specs preserved بدون تعديل assertion logic — الـ mock returns `{ auth: {} }` فالـ `expect(client.auth).toBeDefined()` يستمر passing.

- `apps/api/src/modules/users/users.service.spec.ts`:
  - **New spec في CVE-USERS-005 describe** (TEST-010): smoke loop يستدعي `service.create()` 20 مرة + يـ assert إن كل `tempPassword` فيها 16 char من الـ `PASSWORD_CHARSET`. الـ heavy 10k-sample distribution test الموجود يفضل بدون تعديل — هو الـ rigorous coverage الـ TEST-010 smoke يكمّله.

**انحرافات عن الـ Plan:**

- لا يوجد. الـ 3 changes تطابقت 1:1 مع snippets الـ Plan + الـ user approval ("TEST-010 = smoke (20×)").
- ملاحظة على TEST-008: الـ Plan snippet استخدم `loginAttempts.check('alice@acme.test')` بـ literal string. غيّرتها لـ `VALID_LOGIN_DTO.email` للـ DRY consistency مع باقي الـ spec الـ بيستخدم الـ fixture.
- ملاحظة على TEST-009: أضفت `expect(createClient).toHaveBeenCalledTimes(1)` قبل الـ `toHaveBeenCalledWith` — sanity guard في حالة spec تستدعي `createSupabaseAdminClient` أكتر من مرة عن طريق الخطأ.

**ملاحظات إضافية:**

- **Pre-flight verification on production code (TEST-008):**
  - Verified `auth.service.ts:289` يستدعي `this.loginAttempts.recordFailure(email)` بعد Supabase rejection — الـ spec سيـ pass.
- **Pre-flight verification on production code (TEST-009):**
  - Verified `supabase-admin.provider.ts:55-57`:
    ```typescript
    return createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    ```
    الـ config يطابق الـ assertion بالظبط.
- **module-level jest.mock في TEST-009:**
  - الـ mock بيـ replace `createClient` فقط — الـ existing 4 specs لسه يتأكدوا من `client.auth` (`{auth: {}}` فيه `.auth` truthy → pass) و الـ throw paths لا تستدعي `createClient` أصلاً (الـ throw قبلها) → safe.
  - الـ `beforeEach` يـ clear call history → الـ "passes stateless config" spec يـ count فقط own invocation = 1.
- **Production code zero diff** — Phase 4 modifications حصرياً في 3 spec files.
- **TEST-010 cost:** 20 × (`buildHarness` + 1 prisma.findFirst + 1 prisma.create + 1 service.create + 1 generateSecurePassword) — أقل من 100ms locally، negligible في CI.

---

### Verification — المرحلة 4

**jest stdout (literal — `npx jest src/modules/auth/auth.service.spec.ts src/modules/users/users.service.spec.ts src/common/supabase/supabase-admin.provider.spec.ts --no-coverage`):**

```
... (NestJS Logger output from production-code .catch() branches, ts-jest TS151002 warning — same as Phase 2)

Test Suites: 3 passed, 3 total
Tests:       23 passed, 23 total
Snapshots:   0 total
Time:        8.207 s
Ran all test suites matching src/modules/auth/auth.service.spec.ts|src/modules/users/users.service.spec.ts|src/common/supabase/supabase-admin.provider.spec.ts.
```

- ✅ **23 tests passed** = 6 (auth) + 12 (users) + 5 (supabase-provider).
- Δ vs Phase 3: +2 specs (TEST-009 + TEST-010 = 2 new specs)، +1 modification (TEST-008 modified existing) — العدد قبل Phase 4 كان 21 (16 من Phase 2 jest run + 4 من supabase-admin.provider.spec الأصلي + 1 لو نحسب فرق Phase 3 الـ TEST-006 = 17 في users + 6 في auth + 4 في supabase = 27... ينتظر). الـ counted total الـ صحيح: 12 users + 6 auth + 5 supabase = 23 ✅.

**tsc stderr (literal — `npx tsc --noEmit` على `apps/api`):**

```
src/modules/payments/payments.service.spec.ts(20,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/payments/payments.service.ts(29,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/updates/updates.service.spec.ts(27,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/updates/updates.service.ts(36,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
```

- **0 errors في `auth.service.spec.ts`، `users.service.spec.ts`، ولا `supabase-admin.provider.spec.ts`**.
- نفس الـ 4 pre-existing errors — لا تغيير، لا new errors من Phase 4.

**MVT count بعد المرحلة 4:** **10/10** (TEST-001 [×2] + TEST-002 [×2] + TEST-003 + TEST-004 + TEST-005 + TEST-006 + TEST-007 [×2] + TEST-008 + TEST-009 + TEST-010 = 12 spec-units، 10 unique CVE-TEST findings — الـ MVT budget محقق).

---

## ملخص نهائي

| البند | القيمة |
|---|---|
| المراحل المكتملة | **4/4** (Phase 1، 2، 3، 4) |
| الملفات المعدّلة (spec files) | **3** (auth.service.spec.ts، users.service.spec.ts، supabase-admin.provider.spec.ts) |
| الملفات المعدّلة (production) | **0** ✅ rule #6 attack-and-fix-on-test-code-only respected |
| Specs added | **5** (TEST-004، TEST-005، TEST-006، TEST-009 config، TEST-010 smoke) |
| Specs modified | **7** (TEST-001 ×2، TEST-002 ×2، TEST-003، TEST-007 ×2، TEST-008) |
| MVT spec-units مكتوبة | **12** (covering 10 unique TEST-XXX findings) |
| MVT budget | **10/10 ✅** |
| انحرافات عن الـ Plan | **2 طفيفة موثقة:** `toEqual` بدل `toMatchObject` في TEST-007 (tighter regression net)؛ `VALID_LOGIN_DTO.email` بدل literal في TEST-008 (DRY) |
| jest final | **3 suites، 23 tests passed، 0 failed** |
| tsc errors جديدة | **0** (الـ 4 pre-existing موثقة في NEEDS-CODER backlog) |
| Production-code bugs اتكشفت | **0** — كل الـ pre-flight checks confirmed production يطابق الـ spec expectations |
| وقت التنفيذ التقديري | ~25 دقيقة (4 phases مع verification بين كل phase) |

**جاهز للـ المرحلة التالية (🧠 المخطط — تقرير ما بعد التنفيذ).**

✋ تم المبرمج (كل المراحل) — للدور التالي (🧠 المخطط post-execution)؟
