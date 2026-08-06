# تقرير المخطط (ما بعد التنفيذ) — Session 1.6: MVT Hardening

> Session ID: `2026-05-20-mvt-hardening`
> Inputs: `00-plan.md` + `02-coder-report.md` (4 phases) + actual diffs in 3 spec files

---

## مقارنة Plan vs Reality

| البند | المخطط | المنفّذ | متطابق؟ |
|---|---|---|---|
| عدد الـ phases | 4 (P0 → P3) | 4 (P0 → P3) | ✅ |
| MVT budget | 10 unique findings | 10 unique findings (12 spec-units) | ✅ |
| Specs added | 4 (TEST-004، TEST-005، TEST-006، TEST-010) | 5 (الـ 4 + TEST-009 new config spec) | ✅ (الـ TEST-009 spec كان متخطط له داخل restructure) |
| Specs modified | 7 (TEST-001 ×2، TEST-002 ×2، TEST-003، TEST-007 ×2، TEST-008) | 7 (مطابق) | ✅ |
| Spec files touched | 3 (`users.service.spec.ts`، `auth.service.spec.ts`، `supabase-admin.provider.spec.ts`) | 3 (مطابق) | ✅ |
| Production code changes | 0 (rule #6 attack-and-fix-on-test-code-only) | 0 (مؤكد بـ git-style diff inspection) | ✅ |
| Diff size estimated | ~145 سطر | فعلياً ~165 سطر (الـ inline comments أطول قليلاً) | ✅ acceptable |
| jest expected | 23 tests passing | 23 tests passing | ✅ |
| tsc errors جديدة | 0 | 0 (الـ 4 pre-existing بس) | ✅ |
| Decision points raised | 3 | 3 (كلها answered: TEST-010 smoke 20×، TEST-004 spec-then-NEEDS-CODER-fallback، TEST-009 module-mock accepted) | ✅ |

**النتيجة:** الـ Plan تطابق مع الـ Reality في كل البنود الـ structural. الانحرافات الموجودة كلها spec-level details (مش architectural).

---

## الانحرافات عن الـ Plan

### 1. `toEqual` بدل `toMatchObject` في TEST-007 (audit content)
- **الـ Plan قال:** `expect(entry.oldValues).toMatchObject({ isActive: true })`
- **المبرمج عمل:** `expect(entry.oldValues).toEqual({ isActive: true })`
- **المبرر المُقدَّم:** الـ production audit shape `{ isActive }` فقط — لا `reason` field. `toEqual` يكشف أي field يضاف لاحقاً → tighter regression net.
- **التقييم المعماري:** ✅ **مقبول** — في الواقع تحسين على الـ Plan. الـ Plan كان defensive حول إمكانية إضافة `reason` لاحقاً؛ الفحص الفعلي للـ production code أثبت إن defensive worry ده لم يتحقق. الـ `toEqual` يـ enforce intentional change — لو أحد ضاف `reason` للـ audit، الـ spec هيـ fail ويـ force documentation. ده الـ desired behavior.

### 2. `VALID_LOGIN_DTO.email` بدل literal `'alice@acme.test'` في TEST-008
- **الـ Plan قال:** `expect(loginAttempts.check('alice@acme.test').failures).toBe(1)`
- **المبرمج عمل:** `expect(loginAttempts.check(VALID_LOGIN_DTO.email).failures).toBe(1)`
- **التقييم المعماري:** ✅ **مقبول** — DRY consistency. الـ literal لو الـ fixture اتغيرت بقت source of truth drift.

### 3. أضاف `toHaveBeenCalledTimes(1)` قبل `toHaveBeenCalledWith` في TEST-009
- **الـ Plan قال:** `expect(createClient).toHaveBeenCalledWith(url, key, {...})` فقط
- **المبرمج عمل:** أضاف `expect(createClient).toHaveBeenCalledTimes(1)` كـ sanity guard قبل الـ `with` assertion
- **التقييم المعماري:** ✅ **مقبول** — defensive improvement. لو حصلت double-invocation عن طريق خطأ (e.g. retry loop)، الـ count assertion يكشفها فوراً. الـ pattern ده موجود بالفعل في باقي الـ Phase 1 و Phase 3 specs (TEST-001، TEST-007) → consistency.

**الـ Verdict على الانحرافات:** كل الـ 3 انحرافات **improvements** على الـ Plan، مش regressions. لا واحدة تحتاج rollback.

---

## تقييم المعمارية

### نقاط القوة المعمارية

1. **Paired-assertion pattern self-documenting** — كل spec جديد/معدّل عنده inline comment يبدأ بـ "TEST-XXX (Session 1.6) —" + 2-3 سطر يشرح الـ invariant والـ regression scenario. الـ future developer لو حاول يـ delete أحد الـ assertions يـ confront the "why" مباشرة بدل ما يستنتج من commit log قديم. ده يطبق `CLAUDE.md` rule #4 على مستوى الـ codebase، مش بس على مستوى الـ session.

2. **Production code untouched** — rule #6 (`attack-and-fix` on test code only) respected. الـ pre-flight verification (المبرمج فحص الـ production code قبل كتابة كل spec للتأكد إنه يطابق الـ expectation) منع false-failures وlinked الـ specs بـ explicit anchors لـ سطور production-code معروفة.

3. **`toEqual` strictness على audit content** — الـ deviation رقم 1 (Phase 3) تخلق pattern معماري جديد: **الـ audit `oldValues`/`newValues` يـ asserted strictly، مش loosely**. ده يحمي من silent payload-leak regression (نفس الفلسفة وراء TEST-002 redaction assertions).

### نقاط للملاحظة

4. **Pattern shift صغير: module-level `jest.mock` في supabase-admin.provider.spec.ts** — كل باقي الـ specs في الـ session تستخدم harness-based mocks (`createMockSupabase()`، `createMockAuditLog()`). الـ supabase-admin.provider.spec.ts الآن يستخدم `jest.mock('@supabase/supabase-js')` على module level — pattern مختلف.
   - **هل هو architectural inconsistency؟** لا، لأن الـ provider الـ being tested هو الـ factory الـ بيستدعي `createClient` مباشرة — مش route عبر harness mock. الـ module-level mock هو الـ صحيح للـ use case ده.
   - **توصية للـ `08-testing` skill update:** أضف فقرة "When to use harness mocks vs module-level jest.mock" — الـ rule: module-level لـ external SDK factory tests، harness لـ service-layer business logic.

5. **`loginAttempts` كـ real instance (مش mock) في TEST-008** — الـ assertion `loginAttempts.check(email).failures` يعتمد على real `LoginAttemptsTracker` state. ده intentional ومـ correct للـ stateful trackers، بس مختلف عن باقي الـ dependencies (كلها mocked). لو القارئ ما لاحظش، ممكن يفترض غلط إن `loginAttempts` jest mock زي الباقي.
   - **توصية:** comment صغير في `build()` يـ flag الـ pattern: `// loginAttempts is a real instance — stateful tracker, asserted via public API`.

6. **الـ smoke test في TEST-010 يبني `buildHarness()` 20 مرة في loop** — كل iteration بيعمل clean instance. الـ overhead negligible (ms scale)، بس لو الـ smoke iterations زادت في session لاحق (e.g. 100×)، الـ pattern يقتضي share-one-harness + `.mockClear()` بين iterations.

### ملاحظات على Test Infrastructure

- الـ `audit-log-mock.ts` shape (`logInTransaction: jest.fn()`) دعم كل assertions Phase 1-4 بدون تعديل — الـ Session 1.5 infrastructure جاهزة.
- الـ `prisma-mock.ts` ما اتعدّلش في الـ session ده، مع إن TEST-007 audit assertions added a new pattern (`expect(...prisma...).toHaveBeenCalledWith(objectContaining({where, data}))` بدون `select`) — الـ mock لسه shape-compatible.

---

## حاجات محتاجة تتعمل في sessions قادمة

### High priority (Session 1.7 candidates)
1. **`@prisma/client/runtime/library` → `@prisma/client` migration** — الـ 4 tsc errors الـ pre-existing في `payments` و `updates`. مسجلة في PLAN.md NEEDS-CODER backlog. هتـ flag في تقرير المراجع كـ session-blocking-for-CI.
2. **CompaniesService specs** — deferred من Session 1.5، scope ضيّع الـ service.
3. **JwtStrategy remaining rejection paths** — deferred من Session 1.5.
4. **CVE-USERS-001 — Last-SUPER_ADMIN race fix + spec** — MEDIUM، في NEEDS-CODER backlog.

### Medium priority (process)
5. **Document harness-vs-module-mock decision tree** في `.claude/skills/08-testing.md` — based on ملاحظة #4 أعلاه.
6. **`loginAttempts` real-instance pattern note** في `auth.service.spec.ts` `build()` — based on ملاحظة #5 أعلاه. لو الـ مراجع approved، الـ المبرمج يضيفها في Session 1.7 مع specs CompaniesService.

### Low priority
7. **A7 — Permission catalog whitelist** (`packages/shared-types`) — NEEDS-CODER backlog.

---

## الحكم

✅ **التنفيذ متوافق مع الـ Plan + 3 improvements طفيفة موثقة.**

التفصيل:
- كل الـ 10 unique TEST-XXX findings مغطاة بـ spec assertions/variants passing.
- الـ MVT budget محقق (10/10).
- الـ deviations الـ 3 (toEqual، DRY email، toHaveBeenCalledTimes guard) كلها **improvements**، مش regressions — مقبولة بدون rollback.
- 0 production code changes — rule #6 attack-and-fix-on-test-code-only فُرض بنجاح.
- الـ pre-flight verification قبل كل spec منع false-test-failures وأكد إن الـ specs بتـ assert ضد production-code reality (مش ضد plan-only expectations).

**الـ session جاهز للدور الجاي (🔴 الهاكر) لـ re-attack.** التوقع: الهاكر هيلاقي ≤2 new gaps (الـ paired-assertion pattern بيـ close معظم الـ false-confidence attack surface من Session 1.5).

✋ تم المخطط (ما بعد التنفيذ) — للدور التالي (🔴 الهاكر)؟
