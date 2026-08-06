# تقرير الهاكر 🔴

> Session: 2026-05-16-mvt-auth-users-companies
> الدور: 🔴 Red Team — Test attack (modified role)
> فلسفة: مش بأثبت إن الـ tests شغالة. بأثبت إنها بـ false-confidence — passing بدون ما تحمي الـ invariant.
> ملاحظة: لا تعديل على الكود في هذا الـ turn حسب تعليمات المستخدم — كل الإصلاحات مسجّلة كـ NEEDS-CODER مع snippet مقترح.

---

## Attack Vectors المفحوصة (modified)

- [x] **Weak assertions** — test passes رغم تغيير سلوكي خاطئ
- [x] **Lax mocks** — mock بيخفي bug في الـ implementation
- [x] **Coverage blind spots** — happy path مغطى، failure path غائب
- [x] **False confidence** — اسم الـ test ≠ الـ assertion
- [x] **Side-effect-only assertions** — الـ test يـ verify الـ side-effect (audit, supabase) لكن مش الـ primary action (DB write)
- [x] **Private-method tests** — الـ algorithmic test يـ exercise الـ private، يفوّت الـ integration path

---

## الثغرات المكتشفة

### [CVE-TEST-001] الـ update/updateMyProfile tests يـ verify الـ audit row فقط — مش الـ DB write الفعلي
- **الخطورة:** 🔴 **CRITICAL**
- **الموقع:**
  - `users.service.spec.ts:296-322` (A5 updateMyProfile)
  - `users.service.spec.ts:325-360` (CVE-USERS-004 update)
- **السيناريو:**
  1. attacker (أو developer مخطئ) يـ refactor `update()` بطريق الخطأ:
     ```typescript
     const data: Prisma.UserUpdateInput = {};
     // forgot to populate data — bug!
     // oldValues snapshot لسه صح (يقرا من target)
     ```
  2. الـ DB write يحصل بـ `data = {}` — الـ user record ما يتغيرش
  3. الـ audit row لسه يحتوي الـ correct `oldValues` و `newValues: {}` — الـ test الـ `expect(entry.oldValues).toEqual({specialty, avatar})` يـ pass!
  4. الـ admin يشوف 200 OK، الـ user record ما اتغيرتش، الـ test passes
- **التأثير:** الـ regression net الأهم (إن الـ update يـ apply فعلاً) **مش موجود**. الـ test يحمي الـ audit invariant، **مش** الـ business action.
- **الإصلاح المقترح:** إضافة assertion على الـ DB write الفعلي:
  ```typescript
  // CVE-USERS-004 spec — append after the audit assertions:
  expect(prisma.user.update).toHaveBeenCalledTimes(1);
  expect(prisma.user.update).toHaveBeenCalledWith({
    where: { id: 'target-1' },
    data: { specialty: 'NewSpec', avatar: 'https://new.avatar' },
    select: expect.anything(), // USER_SELECT shape — opaque
  });

  // A5 updateMyProfile spec — same pattern:
  expect(prisma.user.update).toHaveBeenCalledWith({
    where: { id: 'admin-1' },
    data: { phone: '+201999999' },
    select: expect.anything(),
  });
  ```
- **الحالة:** NEEDS-CODER ⚠️

---

### [CVE-TEST-002] الـ A4 create tests ما يـ verifyش إن الـ tempPassword **لا** يتسرب في الـ audit newValues
- **الخطورة:** 🔴 **CRITICAL** (security blind spot)
- **الموقع:** `users.service.spec.ts:220-274` (A4 create tests — كلاهما)
- **السيناريو:**
  1. developer مخطئ يـ refactor الـ audit call:
     ```typescript
     await this.auditLog.logInTransaction(tx, {
       // ...
       newValues: { ...dto },  // bug — dto.password يدخل في الـ audit row
       req,
     });
     ```
  2. الـ tempPassword الـ generated أو الـ admin-provided كلاهما يتكتب في الـ audit_logs table
  3. الـ audit log redactor (لو موجود) قد يـ catch — أو لا (depends on key matching)
  4. الـ test الـ `result.tempPassword === 'string'` يـ pass — هو يـ verify الـ response shape، **مش** الـ audit content
- **التأثير:** Security/compliance — password material في append-only audit table. الـ skill 07 الـ "redact sensitive fields" مش مفروض اعتمادياً، الـ test لازم يـ enforce.
- **الإصلاح المقترح:**
  ```typescript
  // Append to both A4 tests:
  const auditEntry = auditLog.logInTransaction.mock.calls[0][1];
  expect(auditEntry.newValues).not.toHaveProperty('password');
  // Also defensive — never include the auth ID in audit payload:
  expect(auditEntry.newValues).not.toHaveProperty('supabaseAuthId');
  ```
- **الحالة:** NEEDS-CODER ⚠️

---

### [CVE-TEST-003] الـ A1 registerCompany audit test ما يـ assertش على `entityId`
- **الخطورة:** 🟡 HIGH
- **الموقع:** `auth.service.spec.ts:84-112`
- **السيناريو:**
  1. الـ implementation تـ swap الـ entityId بالغلط:
     ```typescript
     await this.auditLog.logInTransaction(tx, {
       entityType: 'company',
       entityId: user.id,  // bug — should be company.id
       // ...
     });
     await this.auditLog.logInTransaction(tx, {
       entityType: 'user',
       entityId: company.id,  // bug — should be user.id
       // ...
     });
     ```
  2. الـ test يـ pass لأن:
     - `entityTypes.toEqual(arrayContaining(['company', 'user']))` ✓
     - `action === 'CREATE'` ✓
     - `companyId === 'co-1'` ✓
     - `oldValues === null` ✓
  3. الـ audit_logs بقت corrupted — الـ entityId لكل row يـ point للـ wrong entity. كل forensic query على entityId يـ return الـ wrong row.
- **التأثير:** Forensic — audit trail integrity. لو in incident response، الـ query "ما اللي حصل للـ User X" يـ return الـ Company row.
- **الإصلاح المقترح:**
  ```typescript
  // After the loop over mock.calls:
  const companyAudit = auditLog.logInTransaction.mock.calls.find(
    ([, e]) => e.entityType === 'company',
  )?.[1];
  const userAudit = auditLog.logInTransaction.mock.calls.find(
    ([, e]) => e.entityType === 'user',
  )?.[1];
  expect(companyAudit.entityId).toBe('co-1');
  expect(userAudit.entityId).toBe('user-1');
  ```
- **الحالة:** NEEDS-CODER ⚠️

---

### [CVE-TEST-004] الـ A2 lastLogin test ما يـ verifyش الـ fire-and-forget invariant
- **الخطورة:** 🟡 HIGH
- **الموقع:** `auth.service.spec.ts:174-194`
- **السيناريو:**
  1. الـ test الحالي يثبت "successful login يستدعي `prisma.user.update` مرة واحدة"
  2. لكن الـ A2 الـ design intent: الـ update هو **fire-and-forget** — لو فشل، الـ login لازم يـ return success
  3. لو الـ implementation اتغيرت لـ `await prisma.user.update(...)` (blocking await بدون `.catch`)، الـ test الحالي يفضل passing
  4. الـ regression: الـ update فشل → الـ login بقى throwing → الـ user ما يقدرش يدخل لو الـ DB write على lastLogin فشل (مثلاً read-only replica، write lag)
- **التأثير:** Availability — الـ login يصبح dependent على الـ DB write الـ non-critical. لو الـ lastLogin column locked أو الـ write فشل، الـ login fails.
- **الإصلاح المقترح:** test variant يـ verify الـ rejection-tolerance:
  ```typescript
  it('returns the login result even if lastLogin update rejects (fire-and-forget)', async () => {
    const { service, prisma } = build();
    prisma.user.findFirst.mockResolvedValue(makeHealthyUserWithCompany());
    prisma.user.update.mockRejectedValue(new Error('DB unavailable'));

    // Must NOT throw — the update is fire-and-forget.
    const result = await service.login(VALID_LOGIN_DTO);
    expect(result.accessToken).toBeDefined();

    // Allow microtask to fire so the .catch in the implementation runs
    // (otherwise jest may print an unhandled-rejection warning).
    await Promise.resolve();
  });
  ```
- **الحالة:** NEEDS-CODER ⚠️

---

### [CVE-TEST-005] الـ A4 create tests ما يـ verifyش الـ tier-limit ordering
- **الخطورة:** 🟡 HIGH
- **الموقع:** `users.service.spec.ts:220-274`
- **السيناريو:**
  1. الـ design intent: `tierLimits.assertCanAddUser` تـ run **قبل** الـ Supabase call — عشان ما نخلقش orphan Supabase users لشركات تخطت الـ limit
  2. لو الـ implementation اتـ reorder بطريق الخطأ:
     ```typescript
     // After Supabase user created:
     await this.tierLimits.assertCanAddUser(adminUser.companyId);
     ```
  3. الـ test يـ pass لأن الـ assertions على الـ response shape فقط
  4. كل tier-overage attempt يخلق orphan Supabase user قبل rollback — operations cost
- **التأثير:** Operations + tier enforcement integrity.
- **الإصلاح المقترح:**
  ```typescript
  // Add a third test:
  it('checks tier limit BEFORE creating the Supabase user', async () => {
    const { service, tierLimits, supabase } = buildHarness();
    tierLimits.assertCanAddUser.mockRejectedValue(
      new Error('tier limit hit'),
    );

    await expect(
      service.create(adminJwt, baseDto, mockReq),
    ).rejects.toThrow();

    // The whole point: Supabase MUST NOT have been touched.
    expect(supabase.auth.admin.createUser).not.toHaveBeenCalled();
  });
  ```
- **الحالة:** NEEDS-CODER ⚠️

---

### [CVE-TEST-006] الـ A3 deactivate/activate ما يـ exerciseش الـ `null supabaseAuthId` path
- **الخطورة:** 🟡 MEDIUM
- **الموقع:** `users.service.spec.ts:175-216`
- **السيناريو:**
  1. الـ implementation فيها guard: `if (target.supabaseAuthId) supabase.updateUserById(...)`
  2. الـ tests يـ exercise الـ truthy path فقط (`supabaseAuthId: 'sup-target-1'`)
  3. لو الـ guard اتشال بطريق الخطأ، target بـ `supabaseAuthId === null` (legacy users من قبل Supabase integration) سيـ trigger:
     ```
     supabase.auth.admin.updateUserById(null, { ban_duration: '24h' })
     // → Supabase SDK throws / returns error / silently fails
     ```
  4. الـ test الحالي ما يكشفش الـ regression لأنه دايماً يـ provide truthy value
- **التأثير:** Defensive coding — legacy users قد يكسروا الـ deactivate flow.
- **الإصلاح المقترح:**
  ```typescript
  it('deactivate skips the Supabase call when supabaseAuthId is null (legacy user)', async () => {
    const { service, prisma, supabase } = buildHarness();
    prisma.user.findFirst.mockResolvedValue({
      ...makeWorkerTarget(),
      supabaseAuthId: null,
    });
    prisma.user.update.mockResolvedValue({ id: 'target-1', isActive: false });

    await service.deactivate(adminJwt, 'target-1', mockReq);

    expect(supabase.auth.admin.updateUserById).not.toHaveBeenCalled();
  });
  ```
- **الحالة:** NEEDS-CODER ⚠️

---

### [CVE-TEST-007] الـ A3 deactivate/activate ما يـ assertش على الـ audit row content
- **الخطورة:** 🟡 MEDIUM
- **الموقع:** `users.service.spec.ts:175-216`
- **السيناريو:**
  1. الـ tests يـ verify الـ Supabase ban call، لكن **مش** الـ audit row من نفس الـ flow
  2. لو الـ implementation اتغيرت لـ audit بـ wrong values:
     ```typescript
     newValues: { isActive: true },  // bug — copy-paste error from `activate`
     ```
     في الـ deactivate flow → الـ audit row يقول "user activated" بينما الـ DB state بقى deactivated. الـ test passes.
- **التأثير:** Audit integrity.
- **الإصلاح المقترح:**
  ```typescript
  // After the supabase assertions:
  const entry = auditLog.logInTransaction.mock.calls[0][1];
  expect(entry.entityType).toBe('user');
  expect(entry.action).toBe('UPDATE');
  expect(entry.oldValues).toEqual({ isActive: true });
  expect(entry.newValues).toEqual({ isActive: false });
  ```
- **الحالة:** NEEDS-CODER ⚠️

---

### [CVE-TEST-008] الـ A8 wrong-credentials test ما يـ assertش على `loginAttempts.recordFailure`
- **الخطورة:** 🟢 LOW
- **الموقع:** `auth.service.spec.ts:154-167`
- **السيناريو:**
  1. الـ lockout policy (skill 03 §12): 5 failures → 15-min lock
  2. الـ implementation: `loginAttempts.recordFailure(email)` بعد الـ Supabase rejection
  3. لو حد شيل الـ call بطريق الخطأ (مثلاً "نظّف الـ login flow")، الـ lockout بقى dead code
  4. الـ test يـ verify الـ exception فقط — مش الـ side-effect على الـ lockout state
- **التأثير:** Security feature silently disabled.
- **الإصلاح المقترح:**
  ```typescript
  // After the throw assertion:
  // The tracker is a real instance — assert state via the public API.
  expect(loginAttempts.check('alice@acme.test').failures).toBe(1);
  ```
- **الحالة:** NEEDS-CODER ⚠️

---

### [CVE-TEST-009] SupabaseAdminProvider لا يـ assertش على الـ client config (autoRefreshToken, persistSession)
- **الخطورة:** 🟢 LOW
- **الموقع:** `supabase-admin.provider.spec.ts:23-32`
- **السيناريو:**
  1. الـ design intent: الـ admin client `autoRefreshToken: false` + `persistSession: false` — هو stateless، service-role-keyed
  2. لو حد بدّل لـ `autoRefreshToken: true` بطريق الخطأ، الـ client هيحاول يـ refresh الـ service-role key (مش الـ admin pattern)
  3. الـ test الحالي `expect(client).toBeDefined() + expect(client.auth).toBeDefined()` يـ pass على أي SupabaseClient — حتى لو فيه wrong config
- **التأثير:** السلوك في production يختلف بدون detection. الـ key rotation strategy ممكن تنكسر بصمت.
- **الإصلاح المقترح:** spy على `createClient` (يحتاج jest.mock للـ supabase-js module):
  ```typescript
  jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn().mockReturnValue({ auth: {} }),
  }));
  import { createClient } from '@supabase/supabase-js';
  // ...
  it('passes stateless config to the SDK', () => {
    createSupabaseAdminClient(configWith({ ... }));
    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role-key-xyz',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  });
  ```
- **الحالة:** NEEDS-CODER ⚠️ (تعقيد متوسط — يحتاج module-level mock)

---

### [CVE-TEST-010] الـ CVE-USERS-005 distribution test يـ exercise الـ private method — يفوّت الـ `create()` integration
- **الخطورة:** 🟢 LOW
- **الموقع:** `users.service.spec.ts:42-65` + `90-160`
- **السيناريو:**
  1. الـ test يستدعي `(service as any).generateSecurePassword()` مباشرة
  2. لو حد ضاف **post-processing** في `create()` بعد الـ generation (مثلاً "تـ ensure إن في symbol واحد على الأقل" بـ replacement loop يكسر الـ distribution)، الـ distribution test ما يكشفش
  3. الـ distribution مظبوطة في الـ private method، الـ post-processing بيـ break it، الـ test passes
- **التأثير:** الـ regression net للـ CVE-USERS-005 ضيقة — تحمي الـ algorithm لكن مش الـ integration.
- **الإصلاح المقترح:** integration test مكمّل (مش بديل):
  ```typescript
  it('the password returned by create() is also uniformly distributed', async () => {
    const samples: string[] = [];
    for (let i = 0; i < 1000; i++) {
      const { service, prisma } = buildHarness();
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: `u-${i}` });
      const r = await service.create(adminJwt, { name: 'X', email: `u${i}@co.test`, role: 'WORKER' }, mockReq);
      samples.push((r as any).tempPassword);
    }
    // Run a relaxed chi-squared check on the aggregated chars.
    // ... (similar to the private-method test, but on `samples`)
  });
  ```
- **الحالة:** NEEDS-CODER ⚠️ (مع توصية: low priority — الـ private-method coverage يكفي للـ MVT)

---

## ثغرات فُحصت ولم تُعتبر مشاكل (NOT-A-BUG)

### `Promise.resolve()` microtask wait
- **الـ context:** المرحلة 4 spec رقم 5 (lastLogin update)
- **التحليل:** الـ المخطط post-execution flagged كـ "fragile". الـ الهاكر يوافق إنه pattern قابل للكسر، لكن الـ behavior الفعلي للـ Node.js promise scheduling consistent. لو الـ implementation اتغيرت لـ `setImmediate`، الـ test يفشل بـ deterministic، مش flaky. مقبول.

### الـ `MockPrismaModel.findMany` extension
- الـ المخطط أشار ليه. الـ الهاكر يؤكد: لا attack surface — الـ utility زاد فيلد، الـ specs الموجودة ما يـ depend عليه. مقبول.

### `$transaction` mock simplistic
- الـ المخطط أقرّ بـ rollback gap. الـ الهاكر يضيف: الـ ACCEPTED مع الـ Plan note إن "TODO comment" المفروض يتـ flag صراحة، **لكن** لم يحدث flagging في أي spec. التوصية: comment في `prisma-mock.ts` يـ document الـ limit صراحة. P3.

---

## ملخص الإصلاحات

| الخطورة | لقى | FIXED-BY-HACKER | NEEDS-CODER | NOT-A-BUG |
|---|---|---|---|---|
| 🔴 CRITICAL | 2 | 0 | 2 (TEST-001, TEST-002) | 0 |
| 🟡 HIGH | 3 | 0 | 3 (TEST-003, TEST-004, TEST-005) | 0 |
| 🟡 MEDIUM | 2 | 0 | 2 (TEST-006, TEST-007) | 0 |
| 🟢 LOW | 3 | 0 | 3 (TEST-008, TEST-009, TEST-010) | 0 |
| **المجموع** | **10** | **0** | **10** | **3** (موثقة) |

**سبب صفر FIXED-BY-HACKER:** المستخدم حدد "اكتب 03-hacker-report.md فقط ثم قف" — التزمت بـ no-code-modifications في هذا الـ turn. كل الـ findings مع snippet مقترح؛ المستخدم يقرر أيهم يدخل في session follow-up.

---

## توصيات للمختبر

الـ 10 findings دي = **10 specs إضافية** للـ session القادم (Session 1.6 — MVT hardening). الـ priority order:

### P0 (المرحلة 1 لو session 1.6 اتعمل)
1. **TEST-001** — append `prisma.user.update.toHaveBeenCalledWith(...)` على A5 + CVE-USERS-004 specs (3 lines × 2 specs)
2. **TEST-002** — append `not.toHaveProperty('password')` على A4 specs (2 lines × 2 specs)

### P1
3. **TEST-003** — entityId assertions في A1
4. **TEST-004** — fire-and-forget regression test (new test variant)
5. **TEST-005** — tier-limit ordering test (new test variant)

### P2
6. **TEST-006** — null supabaseAuthId path (new test variant)
7. **TEST-007** — audit content في deactivate/activate

### P3
8. **TEST-008** — loginAttempts.recordFailure assertion
9. **TEST-009** — client config assertion (يحتاج module mock)
10. **TEST-010** — create() integration distribution test

### Meta-findings للـ Plan template
- **كل audit assertion لازم يشارك مع DB-write assertion** — pattern مفقود في الـ MVT specs. Plan template في sessions جاية يلزم بنود الـ 2 معاً.
- **كل side-effect assertion (Supabase, etc.) لازم يشارك مع primary-action assertion** — نفس الفكرة عبر طبقات.
- **`mock.calls[0][1]` pattern fragile** — لو الـ signature انعكست، رسالة الخطأ غامضة. consider helper:
  ```typescript
  function lastAuditEntry(mock: jest.Mock) {
    return mock.mock.calls[mock.mock.calls.length - 1][1];
  }
  ```

---

## الحكم

**الـ session deliverables منيعة على الـ obvious regressions** (الـ A1 audit يـ run مرتين، الـ JwtStrategy ما يكتبش على DB، الـ sortBy whitelist يـ reject الـ leak vector) — لكن **توجد 10 attack vectors على مستوى الـ tests** اللي تـ allow regressions حقيقية إن تـ slip through:

- **TEST-001 و TEST-002** — CRITICAL. الـ tests تـ verify side-effects بدون primary action. لو session تالتة كسرت الـ `data` payload أو سرّبت password في audit، **الـ test يـ pass**. هذه gaps **توازي** الـ Session 1 audit gap من حيث الـ خطورة.
- **TEST-003 إلى TEST-005** — HIGH. forensics integrity + availability + ordering invariants.
- **TEST-006 إلى TEST-010** — MEDIUM/LOW. defensive coding gaps.

**توصية للمراجع:** افتح Session 1.6 — "MVT hardening" — يـ pick up الـ 10 findings + meta-pattern (audit-assertion-needs-DB-assertion). الـ effort estimate: ~30 lines من assertions إضافية + 4 test variants جدد. half-day max.

**حالة الـ Session 1.5:** ✅ acceptable كـ MVT floor (10/10 fixes covered)، **لكن** الـ floor low — الـ tests تـ pass الـ assertion-presence check لكن مش الـ invariant-protection check.

✋ تم الهاكر — للدور التالي (🧪 المختبر)؟
