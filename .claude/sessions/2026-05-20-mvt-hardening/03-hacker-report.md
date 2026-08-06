# تقرير الهاكر 🔴 — Session 1.6: MVT Hardening

> Session ID: `2026-05-20-mvt-hardening`
> الدور: 🔴 Red Team — re-attack بعد Coder Phases 1-4
> Mode: **`attack-and-fix` على test code فقط** (per `00-scope.md` rule #6). كل gap في test code → fix inline. أي gap يلزم تعديل production code → `NEEDS-CODER`، الـ session ما يقفش (الـ scope بقية الـ findings مغطاة inline).
> فلسفة: مش بأثبت إن الـ paired-assertion pattern شغّال. بأثبت إن الـ pattern نفسه اتطبّق بـ false-completeness — paired بسطح، مش بـ depth.

---

## السياق

الـ Coder قفل 10 Session-1.5 findings عبر 4 phases. تأكدنا (Architect post-execution) إن الـ structural diff تطابق مع الـ Plan + 3 improvements طفيفة. السؤالان اللي طرحهم الـ user:

1. **هل الـ paired assertions قفلت Session 1.5 gaps؟** → 10/10 findings لها spec assertions/variants، **لكن** 4 منهم لسه يحملوا residual paired-assertion gaps (التفاصيل أدناه).
2. **في gaps جديدة في Phase 4 specs (TEST-009 module mock، TEST-010 smoke)؟** → نعم، **TEST-010 نفسها** يحمل بالظبط نفس الـ pattern اللي Session 1.5 جاء يقفله (CVE-TEST-001/002) — verify side-effect (response shape) بدون verify primary action (Supabase password binding). **CRITICAL.** TEST-009 عنده gap minor (client identity).

الـ re-attack وجد **6 findings جديدة** — 5 minha inline-fixed، 1 منها NEEDS-CODER (production bug).

---

## Attack Vectors المفحوصة

- [x] **Paired-assertion completeness** — هل كل side-effect spec قُرن بـ primary-action assertion؟ (4 residual gaps لقيت)
- [x] **Phase 4 new specs (TEST-009/010)** — هل يحملوا نفس الـ pattern الـ session جاء يصلحه؟ (TEST-010 = نعم، CRITICAL)
- [x] **Strict-vs-loose matchers** — هل الـ `objectContaining` بيـ allow regression invisibility؟ (acceptable في الـ contexts المستخدمة)
- [x] **Audit-content vs DB-state coherence** — هل الـ audit row يـ reflect actual state، أم hardcoded؟ (1 production bug في activate)
- [x] **Side-effect counter probes** — `loginAttempts.failures === 1` بيحمي من cap-at-1 bug؟ (لا — gap)
- [x] **Module-mock identity** — هل الـ returned object من factory هو الـ `createClient` result الفعلي؟ (لا — gap)
- [x] **Multi-call increment invariants** — counters increment أم idempotent على نفس الـ key؟ (gap في TEST-008)
- [x] **Test pollution / hoisting safety** — `jest.mock` module-level مع `beforeEach` clear (verified clean)

---

## ملخص Session 1.5 closure

| Session 1.5 finding | المُغطى في Session 1.6 | residual gap بعد إصلاح Coder؟ |
|---|---|---|
| TEST-001-A (A5 updateMyProfile DB-write) | ✅ paired `prisma.user.update.toHaveBeenCalledWith` (line 447-453) | لا |
| TEST-001-B (CVE-USERS-004 update DB-write) | ✅ paired `prisma.user.update.toHaveBeenCalledWith` (line 496-502) | لا |
| TEST-002-A (A4 generated audit-redaction) | ✅ `not.toHaveProperty('password' | 'tempPassword' | 'supabaseAuthId')` | لا |
| TEST-002-B (A4 admin-supplied audit-redaction) | ✅ نفس الـ pattern | لا |
| TEST-003 (A1 entityId per-entity) | ✅ entityId asserts | **نعم** — primary-action paired prisma.create ناقصة → CVE-TEST-015 (inline-fixed) |
| TEST-004 (login fire-and-forget) | ✅ rejection-absorbing spec | لا |
| TEST-005 (tier-limit ordering) | ✅ `not.toHaveBeenCalled` على Supabase + create | لا |
| TEST-006 (null supabaseAuthId guard) | ✅ negative Supabase assertion | **نعم** — DB-update/audit primary-action ناقصة → CVE-TEST-013 (inline-fixed) |
| TEST-007-A/B (activate/deactivate audit content) | ✅ `toEqual` على oldValues/newValues | **نعم** — audit hardcoded، مش derived من target.isActive → CVE-TEST-016 (NEEDS-CODER) |
| TEST-008 (loginAttempts failure recorded) | ✅ `.failures === 1` بعد فشل واحد | **نعم** — cap-at-1 regression invisible → CVE-TEST-012 (inline-fixed بـ new spec) |
| TEST-009 (createClient stateless config) | ✅ `toHaveBeenCalledWith(url, key, {auth: {...}})` | **نعم** — returned-client identity مش مُؤكدة → CVE-TEST-014 (inline-fixed) |
| TEST-010 (create() smoke charset) | ✅ charset/length loop على `result.tempPassword` | **نعم — CRITICAL** — Supabase-bound password مش مقترن → CVE-TEST-011 (inline-fixed) |

**خلاصة:** **6/12 specs (الـ Coder كتب 12 spec-units) مغلقة كاملة. 6 لها residual gaps.** الـ Coder طبّق pattern paired-assertion لكن بسطح — كل spec قُرن بـ "اقرب" primary action، مش بـ "الأعمق" primary action. مثال TEST-010 طبّق pattern paired (charset + length) لكن مش paired (response ↔ Supabase). **5 من الـ 6 الـ inline-fixed أصبحوا closed.**

---

## الثغرات المكتشفة

### [CVE-TEST-011] TEST-010 smoke ما يـ verify إن الـ password المعروض هو نفسه الـ password المربوط في Supabase
- **الخطورة:** 🔴 **CRITICAL**
- **الموقع:** `apps/api/src/modules/users/users.service.spec.ts:176-196` (قبل الإصلاح)
- **النوع:** **نفس الـ pattern من Session 1.5 CVE-TEST-001/002** — verify side-effect (response shape) بدون verify primary action (external system binding). الـ Coder كتب الـ smoke كـ "TEST-010" لكنه يحمل نفس false-confidence اللي Session 1.6 جاء يصلحه.
- **السيناريو:**
  1. attacker (أو developer مخطئ) يـ refactor `create()`:
     ```typescript
     // Production line 233:
     const tempPassword = dto.password || this.generateSecurePassword();
     // line 235-240:
     await this.supabaseAdmin.auth.admin.createUser({
       ...,
       password: tempPassword.slice(0, 8),  // bug — Supabase gets 8-char prefix
     });
     // Response (line 287-292):
     return { user: newUser, tempPassword, ... };  // full 16-char string echoed
     ```
  2. الـ admin يشوف 16-char password في الـ response (passes charset + length).
  3. الـ user يحاول يـ login بالـ 16-char — يفشل (Supabase عنده 8-char فقط).
  4. الـ smoke spec passes لأنه يـ verify `result.tempPassword` (الـ 16-char الـ wide) فقط.
- **التأثير:** Onboarding failure مع invisible production bug. الـ E2E test (مش موجود لسه) كان هيمسكها — الـ smoke الـ unit يـ allow regression to ship.
- **الإصلاح المطبق (inline):**
  ```typescript
  // CVE-TEST-011 (Session 1.6 hacker re-attack) — paired primary-action
  // assertion. Without this, a regression that returns a charset-OK
  // password in the response BUT passes a different/weaker string to
  // Supabase (e.g. `password: tempPassword.slice(0, 8)`) slips past
  // every charset/length check above. The smoke must prove the password
  // surfaced to the admin is the SAME one bound to the Supabase user.
  expect(supabase.auth.admin.createUser).toHaveBeenCalledWith(
    expect.objectContaining({ password: result.tempPassword }),
  );
  ```
  أضفت `supabase` للـ destructure في loop (الـ `buildHarness()` بيرجعه بالفعل).
- **الحالة:** **FIXED-BY-HACKER ✅**

---

### [CVE-TEST-013] TEST-006 (null supabaseAuthId) ما يـ verify إن الـ DB update + audit ركضوا فعلاً
- **الخطورة:** 🟡 **HIGH**
- **الموقع:** `apps/api/src/modules/users/users.service.spec.ts:284-296` (قبل الإصلاح)
- **النوع:** **negative-only assertion** — الـ spec يثبت "Supabase NOT called"، لكن لا يثبت "deactivation actually happened in DB". الـ guard مكتوب صح في production، لكن لو regression حوّل الـ guard لـ early-return:
  ```typescript
  if (!target.supabaseAuthId) return target;  // bug — skips DB update + audit entirely
  ```
  الـ legacy user يبقى active، والـ admin يشوف "200 OK" لـ deactivate call فاشل.
- **السيناريو:**
  1. Developer "يحسّن" الـ guard ليصبح early-return بدل skip-only-Supabase.
  2. الـ DB row للـ legacy user يفضل `isActive: true`.
  3. الـ audit table يفضل بدون row (forensic blackhole).
  4. الـ negative Supabase assertion (`not.toHaveBeenCalled`) لسه passes — مفيش Supabase call فعلاً.
- **التأثير:** Legacy users لا يتعطّلوا، والـ audit trail يحتوي holes. الـ guard المقصود deferred-action، مش skip-action.
- **الإصلاح المطبق (inline):**
  ```typescript
  // CVE-TEST-013 (Session 1.6 hacker re-attack) — paired DB+audit assertion.
  // The not-called assertion above only proves "no Supabase SDK crash on null id".
  // It does NOT prove the deactivation actually happened in the DB. ...
  expect(prisma.user.update).toHaveBeenCalledTimes(1);
  expect(prisma.user.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: 'target-1' },
      data: { isActive: false },
    }),
  );
  expect(auditLog.logInTransaction).toHaveBeenCalledTimes(1);
  ```
  أضفت `auditLog` للـ destructure.
- **الحالة:** **FIXED-BY-HACKER ✅**

---

### [CVE-TEST-015] TEST-003 (registerCompany audit entityIds) ما يـ verify إن الـ DB creates نفسهم happened
- **الخطورة:** 🟡 **HIGH**
- **الموقع:** `apps/api/src/modules/auth/auth.service.spec.ts:103-164` (قبل الإصلاح)
- **النوع:** **نفس الـ pattern Session 1.5 CVE-TEST-001 لكن للـ create path** — الـ Coder طبّق paired-assertion على update flows (TEST-001-A/B) لكن نسي الـ create flow. الـ TEST-003 يثبت audit entityId mapping صح، لكن لا يثبت `prisma.company.create` ولا `prisma.user.create` تـ called بـ الـ payloads المتوقعة.
- **السيناريو:**
  1. Developer يـ refactor `registerCompany` ويـ swap payloads بالغلط:
     ```typescript
     const company = await tx.company.create({ data: { ... } });
     const user = await tx.user.create({ data: { ...wrongFields } });
     ```
     أو:
     ```typescript
     const company = await tx.company.create({ data: {} });  // empty data
     ```
  2. الـ audit rows لسه يحتويا الـ correct entityIds (لأنهم بيقروا من `company.id` و `user.id` الـ mocked).
  3. الـ TEST-003 يفضل passing — `companyAudit.entityId === 'co-1'` (من mock returned)، `userAudit.entityId === 'user-1'`.
  4. الـ tenant الـ created مكسور (empty company name، missing user role).
- **التأثير:** الـ most-consequential action في الـ system (tenant creation from nothing) ليس عنده primary-action regression net. الـ TEST-003 protects audit forensics فقط.
- **الإصلاح المطبق (inline):**
  ```typescript
  // CVE-TEST-015 (Session 1.6 hacker re-attack) — paired primary-action assertion.
  // TEST-003 above proves the entityIds in the audit rows match, but the audit
  // rows are SIDE-EFFECTS. ... same Session 1.5 false-confidence pattern that
  // TEST-001 closed for the update path, now closed for the create path.
  expect(prisma.company.create).toHaveBeenCalledTimes(1);
  expect(prisma.company.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      name: 'Acme Construction',
      email: 'info@acme.test',
      phone: '+201234567',
    }),
  });
  expect(prisma.user.create).toHaveBeenCalledTimes(1);
  expect(prisma.user.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      companyId: 'co-1',
      name: 'Alice Admin',
      email: 'alice@acme.test',
      role: 'SUPER_ADMIN',
    }),
  });
  ```
  استخدمت `objectContaining` للـ `data` لأن `companyPhone?.trim()` + `slug` (dynamic) موجودين — الـ pattern يـ enforce الـ load-bearing fields بدون brittle on الـ derived ones.
- **الحالة:** **FIXED-BY-HACKER ✅**

---

### [CVE-TEST-012] TEST-008 lockout state assertion (`.failures === 1`) لا يحمي من cap-at-1 regression
- **الخطورة:** 🟡 **HIGH** (lockout dead-code risk)
- **الموقع:** `apps/api/src/modules/auth/auth.service.spec.ts:230-237` (TEST-008 الموجود — صح، لكن غير كافٍ)
- **النوع:** **single-point invariant** — الـ assertion يثبت counter وصل لـ 1 بعد فشل واحد، لكن لا يثبت إن الـ counter بيـ increment فعلاً. لو الـ regression:
  ```typescript
  // Original (login-attempts.tracker.ts:102):
  rec.failures += 1;

  // Buggy regression:
  rec.failures = 1;
  ```
  TEST-008 لسه يـ pass (after 1 rejection → failures = 1)، لكن `MAX_FAILURES = 5` lockout never fires لأن الـ counter never exceeds 1.
- **السيناريو:**
  1. attacker يـ brute-force endless wrong-credentials.
  2. الـ throttler (5/min) فقط يحدد سرعة — مفيش lock بعد 5، مفيش 15-min cool-off.
  3. الـ skill-03 §12 policy effectively disabled.
- **التأثير:** Defense-in-depth layer disabled silently. الـ test يحمي من "recordFailure ما اتنادتش"، لكن لا يحمي من "recordFailure broken increment".
- **الإصلاح المطبق (new spec):**
  ```typescript
  it('increments the failure counter on consecutive wrong-credential attempts', async () => {
    const { service, supabase, loginAttempts } = build();

    supabase.auth.signInWithPassword
      .mockResolvedValueOnce({ data: { user: null, session: null }, error: { message: '...' } })
      .mockResolvedValueOnce({ data: { user: null, session: null }, error: { message: '...' } });

    await expect(service.login(VALID_LOGIN_DTO)).rejects.toBeInstanceOf(BusinessException);
    await expect(service.login(VALID_LOGIN_DTO)).rejects.toBeInstanceOf(BusinessException);

    // Two rejections → failures MUST be 2, not 1. Anything else means the
    // counter is broken and the lockout policy will never trigger.
    expect(loginAttempts.check(VALID_LOGIN_DTO.email).failures).toBe(2);
  });
  ```
  لاحظ — لم أتوسع لإثبات "5th failure locks" (الـ full lockout integration scope creep) — الـ minimum-viable proof: `.failures === 2` يكفي لإثبات الـ increment.
- **الحالة:** **FIXED-BY-HACKER ✅**

---

### [CVE-TEST-014] TEST-009 (supabase-admin client config) لا يثبت identity للـ returned client
- **الخطورة:** 🟢 **MEDIUM**
- **الموقع:** `apps/api/src/common/supabase/supabase-admin.provider.spec.ts:43-55` (قبل الإصلاح)
- **النوع:** **shape-only assertion** — الـ existing "returns a SupabaseClient" يثبت `client.auth.toBeDefined()` فقط. أي object شكله `{auth: anything}` يـ pass.
- **السيناريو:**
  1. Developer يـ add caching layer:
     ```typescript
     let cached: SupabaseClient | null = null;
     export function createSupabaseAdminClient(config) {
       if (cached) return cached;  // bug — stale on key rotation
       cached = createClient(...);
       return cached;
     }
     ```
     أو wrapping:
     ```typescript
     export function createSupabaseAdminClient(config) {
       const raw = createClient(...);
       return new WrappedClient(raw);  // wrapper doesn't expose all methods
     }
     ```
  2. الـ TEST-009 الـ config assertion `expect(createClient).toHaveBeenCalledWith(...)` لسه passes — createClient اتنادى صح.
  3. الـ "returns a SupabaseClient" spec لسه passes — wrapper مش لاحقاً عنده `.auth`.
  4. لكن الـ returned client هو wrapper، مش الـ raw SDK client — production calls تكسر.
- **التأثير:** Identity-substitution regressions invisible. الـ contract الـ provider هو "return the raw createClient instance"، مش "return something auth-shaped".
- **الإصلاح المطبق (inline):**
  ```typescript
  // CVE-TEST-014 (Session 1.6 hacker re-attack) — identity assertion.
  // `client.auth.toBeDefined()` passes for ANY object shaped `{auth: ?}` —
  // including a wrapper, a stub, or a memoized stale instance returned by
  // a future caching layer. The provider's contract is to return the raw
  // createClient result; assert identity so substitution is loud.
  const createdByMock = (createClient as jest.Mock).mock.results[0].value;
  expect(client).toBe(createdByMock);
  ```
  الـ `mock.results[0].value` يـ refer للـ object الـ returned من الـ jest.fn() — `mockClear()` في `beforeEach` يـ reset الـ results array، فالـ index 0 يطابق الـ call الوحيد في هذا الـ spec.
- **الحالة:** **FIXED-BY-HACKER ✅**

---

### [CVE-TEST-016] TEST-007 specs لا يكشفوا إن audit `oldValues`/`newValues` مش derived من state — production hardcoded
- **الخطورة:** 🟢 **MEDIUM** (production bug، forensic accuracy)
- **الموقع:**
  - test: `apps/api/src/modules/users/users.service.spec.ts:249-276` (activate spec)
  - production: `apps/api/src/modules/users/users.service.ts:563-573` (activate)
- **النوع:** **production bug masked by hardcoded test mock + hardcoded production write**. الـ TEST-007-B mocks `target.isActive: false` ثم يـ assert الـ audit `oldValues: {isActive: false}`. الـ production code (line 570) writes `oldValues: { isActive: false }` constant. كلاهما يطابق — الـ spec passes — لكن الـ audit لا يـ reflect الـ actual prior state.
- **السيناريو:**
  1. الـ SUPER_ADMIN يـ activate user كان already active (e.g., reconciliation rerun، idempotency window).
  2. الـ production code يـ writes `oldValues: { isActive: false }` REGARDLESS of `target.isActive`.
  3. الـ audit trail يدل forensic investigator على transition `false → true` كاذب — كان `true → true`.
  4. الـ TEST-007-B لا تكشف لأن الـ mock يطابق الـ hardcoded write.
- **التأثير:** Audit trail forensic integrity. compliance review قد يعتمد على audit logs لإثبات حالة-قبل وحالة-بعد لكل تغيير — الـ hardcoded write يخدع الـ review.
- **الإصلاح المقترح:** production code change — الـ audit oldValues/newValues يـ derived من `target.isActive` و الـ DTO transition:
  ```typescript
  // users.service.ts activate (line ~563):
  await this.auditLog.logInTransaction(tx, {
    ...,
    oldValues: { isActive: target.isActive },  // ← read from state
    newValues: { isActive: true },
    ...
  });
  ```
  والـ spec يضاف case إضافي:
  ```typescript
  it('activate audit reflects target state — no-op transition (true → true) is honest', async () => {
    const { service, prisma, auditLog } = buildHarness();
    prisma.user.findFirst.mockResolvedValue({ ...makeWorkerTarget(), isActive: true });  // already active
    prisma.user.update.mockResolvedValue({ id: 'target-1', isActive: true });
    await service.activate(adminJwt, 'target-1', mockReq);
    const entry = auditLog.logInTransaction.mock.calls[0][1];
    expect(entry.oldValues).toEqual({ isActive: true });  // ← would fail with current production
    expect(entry.newValues).toEqual({ isActive: true });
  });
  ```
- **الحالة:** **NEEDS-CODER ⚠️** (production code change ممنوع في Session 1.6 per rule #6 + scope حدد test-files-only)
- **توصية:** افتح Session 1.7 ticket — "Audit oldValues على transitions يقرأ من target state". الـ same pattern قد يطبق على deactivate أيضاً (يـ writes `oldValues: { isActive: true }` constant — same hardcoding bug).

---

## Attack vectors فُحصت ولم تثمر (موثقة للـ negative-result transparency)

1. **TEST-002 redaction `not.toHaveProperty('password')` على deep keys** — جربت: لو الـ audit يحتوي `metadata: { password: '...' }`، الـ top-level `not.toHaveProperty('password')` لا يكشف. **النتيجة:** production code (users.service.ts:273) يكتب `newValues: { name, email, role }` فقط — لا metadata nesting. الـ depth attack vector closed by production shape.

2. **TEST-009 module-mock cross-test pollution** — جربت: هل الـ existing 4 tests تـ contaminate الـ new "passes stateless config" spec؟ **النتيجة:** الـ `beforeEach` يـ `mockClear()` clears `mock.calls + mock.results`. الـ 4 throw-tests لا تستدعي `createClient` (الـ throw قبلها). الـ count stays accurate. لا pollution.

3. **TEST-004 microtask drain race** — جربت: لو production يـ switch من `.catch()` إلى `setImmediate`، الـ `await Promise.resolve(); await Promise.resolve();` لا يكفي. **النتيجة:** production line 327-332 يستخدم `.then().catch()` على Promise — microtask queue كافٍ. الـ vector hypothetical للـ future regression، مش immediate. Acceptable.

4. **TEST-007 `toEqual` strictness on extra audit fields** — جربت: لو production يضيف `reason` للـ deactivate audit لاحقاً، الـ `toEqual({isActive: true})` يكسر. **النتيجة:** المبرمج وثّقها كـ intentional deviation (Architect approved) — الـ strictness intentional لـ enforce explicit-add discipline. لا gap.

5. **TEST-005 ordering also covers `prisma.user.findFirst`** — جربت: هل الـ duplicate-check قبل tier limit؟ **النتيجة:** production code (users.service.ts:217 → 220) → tier check قبل findFirst. الـ TEST-005 يـ assert على Supabase + create فقط، مش findFirst. minor opportunity للـ تحسين، مش gap (الـ ordering invariant الأهم محمي).

---

## ملخص الإصلاحات

| Severity | لقى | اتصلح inline | NEEDS-CODER |
|---|---|---|---|
| CRITICAL | 1 (CVE-TEST-011) | 1 | 0 |
| HIGH | 3 (CVE-TEST-012, 013, 015) | 3 | 0 |
| MEDIUM | 2 (CVE-TEST-014, 016) | 1 | **1** (CVE-TEST-016) |
| LOW | 0 | 0 | 0 |
| **الإجمالي** | **6** | **5** | **1** |

**الـ session لا يتوقف** — الـ NEEDS-CODER الوحيد (CVE-TEST-016) production bug خارج scope Session 1.6 (test-files-only per rule #6). يُسجل للـ Session 1.7 backlog.

---

## Verification بعد الإصلاحات

**jest stdout (literal — `npx jest <3 spec files> --no-coverage`):**

```
ts-jest[config] (WARN) message TS151002: Using hybrid module kind (Node16/18/Next) is only supported in "isolatedModules: true". (×3 — pre-existing)
[Nest] 13144 - 05/20/2026, 2:14:33 AM   LOG [AuthService] ✅ Company registered: "Acme Construction" [co-1] by alice@acme.test
[Nest] 13144 - 05/20/2026, 2:14:33 AM ERROR [AuthService] Supabase auth creation failed for alice@acme.test
service unavailable
[Nest] 13144 - 05/20/2026, 2:14:33 AM  WARN [AuthService] Failed login attempt #1 for: al***@acme.test
[Nest] 13144 - 05/20/2026, 2:14:33 AM  WARN [AuthService] Failed login attempt #1 for: al***@acme.test
[Nest] 13144 - 05/20/2026, 2:14:33 AM  WARN [AuthService] Failed login attempt #2 for: al***@acme.test
[Nest] 13144 - 05/20/2026, 2:14:33 AM ERROR [AuthService] Failed to update lastLogin
[Nest] 13144 - 05/20/2026, 2:14:33 AM ERROR [AuthService] Error: DB unavailable
    at Object.<anonymous> (D:\tampalets\saas-one\apps\api\src\modules\auth\auth.service.spec.ts:328:42)
    ... (jest-circus internal frames trimmed)

Test Suites: 3 passed, 3 total
Tests:       24 passed, 24 total
Snapshots:   0 total
Time:        6.767 s, estimated 8 s
Ran all test suites matching src/modules/users/users.service.spec.ts|src/modules/auth/auth.service.spec.ts|src/common/supabase/supabase-admin.provider.spec.ts.
```

- ✅ **24 tests passed** = 12 (users) + 7 (auth، +1 CVE-TEST-012 new spec) + 5 (supabase-provider).
- ✅ "Failed login attempt #1" + "#2" في الـ log = literal proof إن CVE-TEST-012 الـ multi-failure increment فعّل الـ `recordFailure` مرتين.
- ✅ Δ vs Coder Phase 4 = **+1 spec** (CVE-TEST-012). الـ CVE-TEST-011/013/014/015 تعديلات داخل specs موجودة — لا change في count.

**tsc stderr (literal — `npx tsc --noEmit` على `apps/api`):**

```
src/modules/payments/payments.service.spec.ts(20,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/payments/payments.service.ts(29,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/updates/updates.service.spec.ts(27,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/updates/updates.service.ts(36,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
```

- ✅ **0 new errors** من أي من الـ 5 inline fixes. نفس الـ 4 pre-existing errors (NEEDS-CODER backlog).

---

## ثغرات لسه مفتوحة (مع مبرر)

| الثغرة | السبب |
|---|---|
| **CVE-TEST-016** — audit oldValues hardcoded في activate/deactivate | production code change → خارج scope Session 1.6 (rule #6). افتح ticket للـ Session 1.7. |
| **CVE-USERS-001** — last-SUPER_ADMIN race | pre-existing من Session 1.5، في NEEDS-CODER backlog |
| **A7 permission whitelist** — pre-existing | NEEDS-CODER backlog |
| **`@prisma/client/runtime/library` migration** — 4 tsc errors في payments/updates | NEEDS-CODER backlog، unrelated to MVT |

---

## توصيات للمختبر

الـ specs أصبحت في حالة جيدة لـ MVT count — **10 unique findings + 6 hacker re-attacks closed inline** = 16 hardening points مغطاة. التوصيات للمختبر:

1. **لا يكتب specs تكرّر CVE-TEST-XXX المغلقة بالفعل.** الـ Coder writes (12 spec-units) + Hacker writes (5 inline fixes + 1 new spec for CVE-TEST-012) = 13 spec-units مفعّلة على specs الـ 3 files. أي further specs محتاجة جديدة تركز على **مناطق غير مغطاة** فقط.

2. **لو الـ Tester عاوز أمان إضافي:** يـ generate الـ following candidate specs (مش mandatory للـ MVT — هم extension):
   - `loginAttempts.recordSuccess` يـ reset الـ counter حتى لو counter كان عند `MAX_FAILURES - 1` (skill 03 §12 explicit).
   - الـ A4 generated-password يطابق `result.tempPassword` مع `prisma.user.create.data.password` (لو الـ create stores hash — gap محتمل).
   - `updateMyProfile` لو الـ DTO فاضي → expect `data: {}` و no audit row written.

3. **لا يـ test الـ CVE-TEST-016 (audit hardcoded)** — هو NEEDS-CODER، لا spec يقدر يثبت "production is wrong" بدون تعديل production. الـ Tester يـ document في حالة "scenarios needing coverage" مع رابط للـ Session 1.7 ticket.

4. **تحقق إن الـ MVT count بعد إصلاحاتي صحيح**: 12 (Coder) + 1 (CVE-TEST-012 new) = 13 spec-units. الـ MVT budget الـ original = 10. الفعلي بعد hacker re-attack = 13. ✅ صحيح، above budget.

---

✋ تم الهاكر — للدور التالي (🧪 المختبر)؟
