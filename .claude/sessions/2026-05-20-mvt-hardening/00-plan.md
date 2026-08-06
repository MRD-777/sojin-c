# خطة التنفيذ — Session 1.6: MVT Hardening

> Session ID: `2026-05-20-mvt-hardening`
> الـ scope المُعتمد: `00-scope.md` (10 TEST-XXX findings — test files only، no production code changes)

---

## المشكلة

الـ MVT الـ delivered في Session 1.5 (13 spec) passes الـ assertion-presence check لكن **مش** الـ invariant-protection check. هاكر Session 1.5 لقى 10 gaps في الـ specs نفسها — patterns متكررة لـ false-confidence:

1. **Side-effect verified بدون primary action** — spec يثبت "audit row صح" لكن مش يثبت "DB write حصل بالـ payload الصحيح" → الـ implementation يقدر يكتب `data: {}` والـ spec يفضل passing.
2. **Sensitive payload leak غير محصور** — A4 spec يتأكد إن الـ `tempPassword` بترجع في الـ response shape، بس مش بيتأكد إنها **لا** تتسرب في الـ audit `newValues`.
3. **Test variants ناقصة** — fire-and-forget، null-path، ordering invariants غير مُختبرة.
4. **Configuration assertions ضعيفة** — SupabaseAdminProvider spec يتأكد إن الـ client `truthy`، مش يتأكد إن `autoRefreshToken=false`.

---

## التحليل

### الـ Root Cause الأساسي

كل الـ 10 gaps بترجع لـ **سؤال غلط** أثناء كتابة الـ spec: "إيه الـ side-effect اللي عايز أتأكد منه؟" بدل "إيه الـ business invariant اللي الـ regression يقدر يكسره؟"

الـ side-effect (audit row، Supabase call) **مش** الـ invariant — هو **proxy** ليه. الـ invariant الحقيقي = "الـ user record تـ updated بالـ values دي". لو الـ proxy اتـ assert عليه بمفرده، الـ regression net فيها holes كبيرة.

### الـ Pattern العام للحل (paired assertions — CLAUDE.md rule #4)

كل spec يـ verify side-effect لازم يقترن بـ assertion على primary action:

```
[side-effect verified]    +    [primary action verified]
audit logInTransaction    +    prisma.user.update payload
supabase ban call         +    audit oldValues/newValues
response shape            +    audit newValues redaction
```

### تصنيف الـ 10 findings حسب pattern الإصلاح

| Pattern | Findings | عدد الـ specs |
|---|---|---|
| **A. Add paired DB-write assertion** (modify) | TEST-001، TEST-002، TEST-003، TEST-007 | 6 specs modified |
| **B. New test variant** (negative/edge path) | TEST-004، TEST-005، TEST-006، TEST-010 | 4 specs added |
| **C. Restructure with module mock** | TEST-009 | 1 spec restructured |
| **D. Add lockout-state assertion** | TEST-008 | 1 spec modified |

**الإجمالي:** 7 modifications + 4 additions = **11 spec-units** (TEST-009 = 1 restructured spec هتكون 4 specs منفصلة في الـ file بسبب الـ jest.mock setup — بس counted as 1 MVT unit).

---

## الحل المقترح

### المرحلة 1 — P0 CRITICAL: Paired DB-write على update flows
**الملف:** `apps/api/src/modules/users/users.service.spec.ts`
**الـ findings:** TEST-001، TEST-002

**التغييرات:**

1. **TEST-001-A** (line ~314-321، A5 `updateMyProfile` spec):
   - Append بعد الـ audit assertions:
   ```typescript
   expect(prisma.user.update).toHaveBeenCalledTimes(1);
   expect(prisma.user.update).toHaveBeenCalledWith(
     expect.objectContaining({
       where: { id: 'admin-1' },
       data: { phone: '+201999999' },
     }),
   );
   ```

2. **TEST-001-B** (line ~347-359، CVE-USERS-004 `update` spec):
   - Append بعد الـ `not.toHaveProperty` assertions:
   ```typescript
   expect(prisma.user.update).toHaveBeenCalledTimes(1);
   expect(prisma.user.update).toHaveBeenCalledWith(
     expect.objectContaining({
       where: { id: 'target-1' },
       data: { specialty: 'NewSpec', avatar: 'https://new.avatar' },
     }),
   );
   ```

3. **TEST-002-A** (line ~234-258، A4 generated-password spec):
   - Append بعد الـ response-shape assertions:
   ```typescript
   expect(auditLog.logInTransaction).toHaveBeenCalledTimes(1);
   const auditEntry = auditLog.logInTransaction.mock.calls[0][1];
   expect(auditEntry.newValues).not.toHaveProperty('password');
   expect(auditEntry.newValues).not.toHaveProperty('supabaseAuthId');
   expect(auditEntry.newValues).not.toHaveProperty('tempPassword');
   ```

4. **TEST-002-B** (line ~260-287، A4 admin-supplied-password spec):
   - نفس الـ assertion pattern من TEST-002-A.

**الـ Risks:**
- 🟡 الـ `expect.objectContaining` لازم يبقى loose enough — الـ implementation بترجع `select: USER_SELECT` بعد الـ update. لو الـ spec يستخدم strict `toHaveBeenCalledWith({where, data})`، هيفشل لأن الـ third arg موجود. حل: استخدم `objectContaining` (موصى به).
- 🟡 TEST-002: الـ A4 الحالي بيرجع `result.user`، فالـ audit `newValues` لازم تكون موجودة في الـ implementation أصلاً. لازم نتأكد إن الـ create() بيستدعي `logInTransaction` (مش `log()`). لو الـ implementation بيستخدم `log()` العادي، الـ `logInTransaction.mock.calls[0]` undefined → الـ spec هيـ fail بـ TypeError. **mitigation:** قبل التعديل، تأكد من الـ create() implementation.

---

### المرحلة 2 — P1 HIGH: Forensic integrity + fire-and-forget + ordering
**الملفات:**
- `apps/api/src/modules/auth/auth.service.spec.ts`
- `apps/api/src/modules/users/users.service.spec.ts`

**الـ findings:** TEST-003، TEST-004، TEST-005

**التغييرات:**

5. **TEST-003** (auth.service.spec.ts، A1 registerCompany spec، line ~127-147):
   - استبدل الـ `for...of` loop بـ entity-specific lookups:
   ```typescript
   const companyAudit = auditLog.logInTransaction.mock.calls.find(
     ([, e]) => e.entityType === 'company',
   )?.[1];
   const userAudit = auditLog.logInTransaction.mock.calls.find(
     ([, e]) => e.entityType === 'user',
   )?.[1];
   expect(companyAudit).toBeDefined();
   expect(userAudit).toBeDefined();
   expect(companyAudit!.entityId).toBe('co-1');
   expect(userAudit!.entityId).toBe('user-1');
   // Keep the existing "both CREATE / both co-1 / both oldValues null" loop.
   ```

6. **TEST-004** (auth.service.spec.ts، new spec بعد line ~234):
   ```typescript
   it('returns success even when fire-and-forget lastLogin update rejects', async () => {
     const { service, prisma } = build();
     prisma.user.findFirst.mockResolvedValue(makeHealthyUserWithCompany());
     prisma.user.update.mockRejectedValue(new Error('DB unavailable'));

     // Must NOT throw — lastLogin update is fire-and-forget.
     const result = await service.login(VALID_LOGIN_DTO);
     expect(result.accessToken).toBeDefined();

     // Yield microtask so the rejected promise resolves before the test
     // ends — otherwise jest may print "unhandled rejection".
     await Promise.resolve();
     await Promise.resolve();
   });
   ```

7. **TEST-005** (users.service.spec.ts، new spec في A4 describe block):
   ```typescript
   it('checks tier limit BEFORE creating the Supabase user', async () => {
     const { service, prisma, tierLimits, supabase } = buildHarness();
     prisma.user.findFirst.mockResolvedValue(null);
     tierLimits.assertCanAddUser.mockRejectedValueOnce(
       new Error('tier limit hit'),
     );

     await expect(
       service.create(adminJwt, baseDto, mockReq),
     ).rejects.toThrow();

     // The whole point of the ordering: Supabase MUST NOT be touched
     // when the tier limit rejects. No orphan auth users.
     expect(supabase.auth.admin.createUser).not.toHaveBeenCalled();
     expect(prisma.user.create).not.toHaveBeenCalled();
   });
   ```

**الـ Risks:**
- 🟢 TEST-003: الـ `find()` returns undefined لو ما لقاش — الـ `?.[1]` chain + `expect(...).toBeDefined()` يحمي من الـ false-pass.
- 🟡 TEST-004: لو الـ production `login()` يستخدم `await prisma.user.update(...).catch(...)` (مع `.catch` صحيح)، الـ spec يـ pass. لو يستخدم `await` مباشرة، الـ spec هيـ fail (طبيعي — هو الـ regression-net). **لو فشل، يُسجل كـ NEEDS-CODER للـ session تالي** (rule #6 — production code تعديل ممنوع في الـ session ده).
- 🟡 TEST-005: نفس القاعدة — لو الـ implementation يستدعي `assertCanAddUser` بعد `createUser` (line 235 قبل line 217)، الـ spec هيـ fail. Verified currently correct: line 217 (`tierLimits.assertCanAddUser`) قبل line 235 (`supabaseAdmin.auth.admin.createUser`). الـ spec سيـ pass.

---

### المرحلة 3 — P2 MEDIUM: Defensive paths
**الملف:** `apps/api/src/modules/users/users.service.spec.ts`
**الـ findings:** TEST-006، TEST-007

**التغييرات:**

8. **TEST-006** (new spec في A3 describe block):
   ```typescript
   it('deactivate skips Supabase call when supabaseAuthId is null (legacy user)', async () => {
     const { service, prisma, supabase } = buildHarness();
     prisma.user.findFirst.mockResolvedValue({
       ...makeWorkerTarget(),
       supabaseAuthId: null,
     });
     prisma.user.update.mockResolvedValue({ id: 'target-1', isActive: false });

     await service.deactivate(adminJwt, 'target-1', mockReq);

     // The guard `if (target.supabaseAuthId)` MUST hold — otherwise the
     // SDK throws on `updateUserById(null, ...)`.
     expect(supabase.auth.admin.updateUserById).not.toHaveBeenCalled();
   });
   ```

9. **TEST-007-A** (modify deactivate spec، line ~189-202):
   - Append بعد الـ Supabase assertions:
   ```typescript
   expect(auditLog.logInTransaction).toHaveBeenCalledTimes(1);
   const entry = auditLog.logInTransaction.mock.calls[0][1];
   expect(entry.entityType).toBe('user');
   expect(entry.action).toBe('UPDATE');
   expect(entry.oldValues).toMatchObject({ isActive: true });
   expect(entry.newValues).toMatchObject({ isActive: false });
   ```
   - Update `buildHarness()` destructuring to include `auditLog`.

10. **TEST-007-B** (modify activate spec، line ~204-220):
    - Mirror الـ TEST-007-A pattern لكن `oldValues: { isActive: false }` و `newValues: { isActive: true }`.

**الـ Risks:**
- 🟢 TEST-006: الـ guard موجود في الـ implementation (تم التحقق في hacker report). الـ spec سيـ pass.
- 🟡 TEST-007: استخدام `toMatchObject` بدل `toEqual` لأن الـ audit row قد يحتوي extra metadata (reason، actorId). الـ A3 implementation قد يضيف `reason` في الـ deactivate audit — لو الـ spec يستخدم strict `toEqual({isActive:...})`، هيفشل.

---

### المرحلة 4 — P3 LOW: Configuration + lockout state + integration
**الملفات:**
- `apps/api/src/modules/auth/auth.service.spec.ts`
- `apps/api/src/common/supabase/supabase-admin.provider.spec.ts`
- `apps/api/src/modules/users/users.service.spec.ts`

**الـ findings:** TEST-008، TEST-009، TEST-010

**التغييرات:**

11. **TEST-008** (auth.service.spec.ts، modify wrong-credentials spec line ~196-212):
    - Append بعد الـ throw assertion:
    ```typescript
    // The lockout policy (skill 03 §12) must record the failure — silently
    // disabling this turns 5-fails/15-min-lock into dead code.
    expect(loginAttempts.check('alice@acme.test').failures).toBe(1);
    ```
    - Update `build()` destructuring في الـ spec to include `loginAttempts`.

12. **TEST-009** (supabase-admin.provider.spec.ts، restructure entire file):
    - Add at top:
    ```typescript
    jest.mock('@supabase/supabase-js', () => ({
      createClient: jest.fn().mockReturnValue({ auth: {} }),
    }));
    import { createClient } from '@supabase/supabase-js';
    ```
    - In each existing test، add `(createClient as jest.Mock).mockClear();` في `beforeEach`.
    - Add a new test:
    ```typescript
    it('passes stateless config (autoRefreshToken=false, persistSession=false) to createClient', () => {
      createSupabaseAdminClient(configWith({
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-xyz',
      }));
      expect(createClient).toHaveBeenCalledWith(
        'https://example.supabase.co',
        'service-role-key-xyz',
        { auth: { autoRefreshToken: false, persistSession: false } },
      );
    });
    ```

13. **TEST-010** (users.service.spec.ts، new spec في CVE-USERS-005 describe block):
    - **قرار:** هذا الـ test يستدعي `create()` 1000 مرة → heavy. الـ recommendation من الهاكر: low-priority، الـ private-method coverage يكفي.
    - **الخطة:** **Skip لـ session 1.7** أو نكتفي بـ **smoke test** مختصر:
    ```typescript
    it('create() returns a password drawn from the documented charset (smoke)', async () => {
      const { service, prisma } = buildHarness();
      const allowed = new Set(PASSWORD_CHARSET);
      for (let i = 0; i < 20; i++) {
        prisma.user.findFirst.mockResolvedValueOnce(null);
        prisma.user.create.mockResolvedValueOnce({ id: `u-${i}` });
        const r = await service.create(
          adminJwt,
          { name: 'X', email: `u${i}@co.test`, role: 'WORKER' },
          mockReq,
        );
        const pw = (r as { tempPassword?: string }).tempPassword;
        expect(pw).toBeDefined();
        for (const ch of pw!) expect(allowed.has(ch)).toBe(true);
      }
    });
    ```
    - Smoke test يثبت إن الـ integration path تستخدم نفس الـ charset؛ الـ distribution خلاص محمي بالـ private-method test الموجود (10k samples).

**الـ Risks:**
- 🔴 TEST-009 الـ jest.mock at module level يكسر الـ existing tests اللي بتستهلك الـ client الحقيقي. **mitigation:** الـ mock يرجع `{ auth: {} }` — الـ existing tests بيتأكدوا من `client.auth` بس، فهيظلوا passing. هنتأكد بـ literal jest output.
- 🟡 TEST-009 الـ `(createClient as jest.Mock).mockClear()` لازم في beforeEach عشان الـ "throws when missing" tests ما يـ countوش على الـ new test.
- 🟢 TEST-010 smoke test مش بديل عن الـ distribution test — هو layer إضافي يحمي من post-processing regression.

---

## الـ Skills المطلوبة

| Skill | القسم | الاستخدام |
|---|---|---|
| `08-testing` | كامل (paired assertions، mock fragility) | كل الـ phases |
| `07-audit-compliance` | فقرة "Redact sensitive fields" + "Immutability" | TEST-002، TEST-003، TEST-007 |
| `03-auth-security` | فقرة 12 (lockout) | TEST-008 |
| `06-error-handling` | فقرة "fire-and-forget semantics" | TEST-004 |

---

## نقاط القرار (require approval)

1. **TEST-010 تنفيذ:** smoke test (20 iterations في الـ create() integration) أم defer كلياً لـ Session 1.7؟
   - **توصيتي:** smoke (20×) — الـ MVT count يبقى = 10، والـ private-method test الحالي (10k×) لسه يحمي الـ distribution invariant.

2. **TEST-004 لو فشل (الـ implementation مش fire-and-forget فعلاً):**
   - **القرار المقترح:** الـ spec يكتب، لو fail → session يقف ويسجل NEEDS-CODER (rule #6 attack-and-fix لـ test code فقط، production code → NEEDS-CODER).
   - بديل: نتحقق من الـ production code أولاً قبل كتابة الـ spec → لو الـ flow مش fire-and-forget، نلغي TEST-004 من الـ scope.

3. **TEST-009 module-level jest.mock:**
   - الـ mock بيـ affect كل الـ tests في الـ file. الـ existing 4 tests يتأكدوا من `client.auth` فقط — الـ mock بيرجع `{ auth: {} }` فالـ assertion يستمر passing.
   - بديل أنظف: `jest.doMock` داخل describe — لكن syntax أصعب وفيها timing pitfalls. **توصيتي:** الـ module-level mock مقبول.

---

## التأثير على الـ Codebase الحالي

| الملف | نوع التغيير | حجم التغيير المتوقع |
|---|---|---|
| `apps/api/src/modules/users/users.service.spec.ts` | تعديل + 3 specs جديدة | +90 سطر |
| `apps/api/src/modules/auth/auth.service.spec.ts` | تعديل + 1 spec جديد | +30 سطر |
| `apps/api/src/common/supabase/supabase-admin.provider.spec.ts` | restructure + 1 spec جديد | +25 سطر |
| **الإجمالي** | | **~145 سطر** |

**Production code:** 0 تغييرات. لو ظهر bug في production code أثناء التنفيذ → NEEDS-CODER (rule #6).

---

## تعريف النجاح

- [ ] الـ 10 findings TEST-001 → TEST-010 كلها لها spec assertions/variants جديدة passing
- [ ] **MVT: 10 specs مكتوبة وpassing** (إجباري) — TEST-001 (×2 specs modified)، TEST-002 (×2 specs modified)، TEST-003 (×1 modified)، TEST-004 (×1 new)، TEST-005 (×1 new)، TEST-006 (×1 new)، TEST-007 (×2 specs modified)، TEST-008 (×1 modified)، TEST-009 (×1 new)، TEST-010 (×1 new) = 10 MVT units
- [ ] `pnpm --filter @saas-one/api test` literal stdout مكتوب في `02-coder-report.md` (rule #7) — Test Suites/Tests/Time
- [ ] `pnpm --filter @saas-one/api tsc --noEmit` 0 errors literal stderr في `02-coder-report.md`
- [ ] الهاكر يـ re-attack ويلاقي ≤2 new gaps (rule #4 — paired assertions enforced)
- [ ] لو spec فشل بسبب production-code bug → NEEDS-CODER documented، session يكمل للـ specs الباقية (rule #6 — `attack-and-fix` mode على test code فقط)

---

⏸️ AWAITING APPROVAL
رد بـ "approve" للمتابعة للمبرمج، أو "edit: [تعديل]" للتعديل (مثلاً: "edit: defer TEST-010 لـ Session 1.7" أو "edit: skip module-level jest.mock في TEST-009").

✋ تم المخطط — للدور التالي (💻 المبرمج)؟
