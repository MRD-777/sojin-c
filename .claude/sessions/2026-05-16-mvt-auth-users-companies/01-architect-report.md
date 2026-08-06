# تقرير المخطط 🧠 (ما بعد التنفيذ)

> Session: 2026-05-16-mvt-auth-users-companies
> الدور: 🧠 Architect — Post-execution review
> التاريخ: 2026-05-17

---

## مقارنة Plan vs Reality

### الـ deliverables الكلية

| البند | المخطط | المنفّذ | متطابق؟ |
|---|---|---|:---:|
| MVT specs (الـ floor الإجباري) | ≥10 specs (1 لكل fix) | 10 fixes × ≥1 spec | ✅ |
| إجمالي الـ tests الجديدة (budget) | 21 spec | 46 spec | ✅ (تجاوز إيجابي) |
| ملفات جديدة | 8 (3 utilities + 5 spec) | 9 (3 utilities + 1 smoke + 5 spec) | ✅ (smoke spec إضافي) |
| ملف معدّل non-behavioral | 1 (D4 refactor) | 1 | ✅ |
| تعديل سلوكي على business logic | 0 | 0 | ✅ |
| الـ 23 baseline tests passing | لازم | 23 / 23 ✓ | ✅ |
| typecheck نظيف على الـ scope | لازم | 0 errors جديدة | ✅ |
| الـ 4 pre-existing payments/updates errors | out of scope | لم تُلمس | ✅ |

### الـ المراحل بالتفصيل

| المرحلة | Plan (LOC / Tests) | Reality (LOC / Tests) | الانحراف |
|---|---|---|---|
| **1. Test infrastructure** | 3 utilities ~80 LOC | 3 utilities + 1 smoke spec ~265 LOC، 11 tests | ✅ smoke spec كان مفترض في المرحلة 6؛ نُقل للأولى — قرار سليم |
| **2. Algorithmic/DTO specs** | 3 specs ≈7 tests | 3 specs، 21 tests | ✅ تجاوز إيجابي (it.each في A6 = 14 test بدلاً من 3) |
| **3. JwtStrategy spec** | 1 ملف، 3 tests | 1 ملف، 3 tests | ✅ متطابق |
| **4. AuthService spec** | 1 ملف، 5 tests | 1 ملف، 5 tests | ✅ متطابق |
| **5. UsersService spec** | 6 tests على ملف الـ المرحلة 2 | 6 tests (الإجمالي 9 في الملف) | ✅ متطابق |
| **6. Verification** | jest + tsc + report | jest + tsc + final summary | ✅ متطابق |

---

## الانحرافات عن الـ Plan

### انحراف #1 — MockPrismaModel.findMany ضافت بدون مرجع في الـ Plan
- **المكان:** `apps/api/src/test-utils/prisma-mock.ts`
- **التفصيل:** الـ Plan ذكر `user.findFirst, findUnique, update, create, count` + `company.find...`. الـ `findMany` ضافت لأن `users.service.findAll` يستخدمه ولأنه هيلزم للـ spec الـ A6 (لو ضافت integration test على findAll لاحقاً).
- **مبرر:** ✅ مقبول — extension، مش تغيير في الـ scope. اتعمل proactively لـ session لاحق بدلاً من ما يضاف diff صغير لكل spec جديد.
- **حكم:** مقبول مع توثيق فقط.

### انحراف #2 — Smoke spec في المرحلة 1 بدلاً من المرحلة 6
- **المكان:** `apps/api/src/test-utils/test-utils.spec.ts`
- **التفصيل:** الـ Plan في المرحلة 6 قال "verification" generically. المبرمج كتب smoke spec على الـ utilities نفسها في المرحلة 1.
- **مبرر:** ✅ تحسين — fail-fast على الـ utility bugs (لو الـ `$transaction` mock مش بيـ alias الـ tx صح، كل الـ specs اللاحقة بتفشل بسبب غامض). الـ smoke spec كشف الـ TS7006 implicit-any في الـ tx parameter — مكتشف في المرحلة 1، مش في المرحلة 4 أو 5.
- **حكم:** مقبول — قرار تحسيني.

### انحراف #3 — 14 tests لـ A6 بدلاً من 3
- **المكان:** `apps/api/src/modules/users/dto/list-users-query.dto.spec.ts`
- **التفصيل:** الـ Plan قال 3 cases (valid, invalid, default). الـ implementation استخدم `it.each` لـ:
  - 6 tests على كل قيمة من الـ whitelist
  - 1 test على `supabaseAuthId` (الـ original leak vector)
  - 5 tests على فيلدات تانية متوقع رفضها
  - 2 tests على defaults + combinations
- **مبرر:** ✅ تحسين تكتيكي — الـ `it.each` يجعل كل قيمة في الـ whitelist لها regression net مستقل. لو حد ضاف قيمة جديدة للـ `USER_SORT_COLUMNS` بدون test، الـ pattern موثّق ليه يضيف الـ test.
- **حكم:** مقبول — over-coverage على surface حساسة (ordering oracle) منطقي.

**الـ ملخص:** 3 انحرافات صغيرة، كلها تحسينية، صفر انحرافات سلبية أو غير مبررة.

---

## تقييم المعمارية

### نقاط القوة

1. **Harness pattern في `users.service.spec.ts` و `auth.service.spec.ts`** — `buildHarness()` يـ expose الـ mocks للـ assertion على side-effects. الـ DRY سليم، الـ readability عالية، والـ pattern قابل للنقل لـ specs قادمة.

2. **Type exports في الـ test-utils** — `MockPrisma`, `MockPrismaModel`, `MockAuditLog`, `MockSupabase` كلها exported. يتيح للـ specs annotation صريحة على الـ callback parameters (`async (tx: MockPrisma) => ...`) بدلاً من `any` implicit.

3. **D4 refactor نظيف** — `createSupabaseAdminClient(config)` exported كـ standalone function، الـ NestJS provider يفوّض ليه. الـ test يـ exercise الـ factory مباشرة بدون NestJS bootstrap. صفر تغيير سلوكي.

4. **Smoke spec على الـ utilities** — defense ضد bit-rot في الـ mocks نفسها. لو حد عدّل `$transaction` mock بطريقة تكسر الـ tx-aliasing، الـ smoke spec يكشف فوراً.

5. **Assertion على `.code` بدلاً من الـ Arabic message** — `auth.service.spec.ts` يـ asserts على `ErrorCodes.AUTH_BIZ_002` بدلاً من string match. ده exactly الـ pattern المفروض — الـ messages قابلة للـ translation/rewording، الـ codes contracts ثابتة.

6. **Belt-and-suspenders في CVE-USERS-004 spec** — الـ `expect(oldValues).toEqual({...})` + 3 `not.toHaveProperty()` assertions. لو الـ implementation اتغيرت لـ "always { name, phone }" pattern القديم، الـ test يفشل بـ message واضح.

7. **`Promise.resolve()` microtask yield في الـ A2 lastLogin spec** — تعامل مع الـ fire-and-forget update بـ تقنية صحيحة (مش `setTimeout(0)` ولا `setImmediate`). الـ pattern documented في comment.

### نقاط الضعف المعمارية

1. **`$transaction` mock الـ simplistic لا يـ model الـ rollback**
   - **التفصيل:** الـ utility يـ call الـ callback مع `prisma` نفسه كـ `tx`. لو الـ callback رمى exception، الـ caller يـ catch لكن مفيش "rollback" حقيقي — الـ mock writes اللي حصلت لـ `tx.user.create` لسه موجودة في الـ mock state.
   - **التأثير:** الـ A1 spec يثبت إن الـ 2 audit rows اتكتبت داخل tx، لكنه **ما يثبتش** إن لو الـ second audit row فشل، الـ first audit row + الـ Company/User rows يـ rollback. الـ Plan أشار للقيود ("ميختبرش race conditions") لكن لم يـ flag هذه القيد بالذات.
   - **التوصية:** spec للـ rollback في session لاحق — يتطلب إما Prisma test container (heavy) أو mock أعمق يـ track الـ writes لكل tx وdiscard على exception.

2. **A1 spec لا يـ assert على الـ correlation_id**
   - **التفصيل:** الـ CLAUDE.md ذكر إن الـ 2 audit rows من registerCompany "لازم نفس الـ correlation_id". الـ spec يثبت إن الـ 2 calls حصلوا داخل الـ same `$transaction`، لكن ما بيـ assertش على الـ `req` argument (اللي يـ propagate الـ correlation_id).
   - **التأثير:** لو refactor قسم الـ 2 logs على 2 transactions منفصلين، الـ test الحالي قد يبقى passing.
   - **التوصية:** assertion إضافي على `entry.req === mockReq` في كلا الـ calls.

3. **`lastLogin` test ينتظر microtask واحد فقط**
   - **التفصيل:** `await Promise.resolve()` ينتظر microtask واحد. لو الـ fire-and-forget chain طال (مثلاً `.then().catch()` متعدد)، الـ assertion قد يـ fire قبل الـ call.
   - **التأثير:** non-deterministic flake في CI لو الـ implementation اتغيرت.
   - **التوصية:** `await new Promise(setImmediate)` أو `jest.useFakeTimers()` + `jest.runAllTicks()` — patterns أكثر تحديداً. مؤجل (الـ test الحالي شغّال).

4. **Distribution-coverage imbalance**
   - **التفصيل:** A6 له 14 tests، CVE-USERS-004 له 1. الـ MVT floor مطبق على الـ 2، لكن الـ "deep coverage" متركز في الـ A6 (الـ ordering oracle vector).
   - **التأثير:** ليس bug، لكن الـ distribution يعكس إن الـ tester instincts اختلفت من spec للتاني.
   - **التوصية:** session لاحق يـ balance — يضيف edge cases على CVE-USERS-004 (الـ undefined values، الـ empty string، الـ same-value update).

5. **الـ `Phase 5 will extend...` placeholder في الـ users.service.spec.ts header**
   - **التفصيل:** المبرمج حدّث الـ header في المرحلة 5 لإزالة الـ placeholder الـ Phase-2-only. الـ trick: لو session لاحقة ضافت Phase 7-9 على نفس الملف، الـ header يحتاج تحديث مرة تانية.
   - **التوصية:** consider قسم "Coverage" stateful في الـ header (auto-updated بـ comment scanner) — overkill حالياً، tracking-only.

---

## حاجات محتاجة تتعمل في sessions قادمة

| البند | الأولوية | الـ rationale |
|---|---|---|
| **Spec للـ tx rollback semantics** | P1 | الـ MVT يثبت "audit ran inside tx"، لا يثبت "audit failure → rollback". critical للـ skill 07 |
| **Specs للـ controllers (HTTP layer)** | P1 | الـ `@Roles()` decorator config + `forbidNonWhitelisted` على mass-assignment ما اتغطّوش. supertest + Nest TestingModule |
| **Specs للـ CompaniesService** | P2 | updateCompany، updateSettings، getStorageUsage — 0 specs حالياً |
| **Spec للـ A1 correlation_id propagation** | P2 | يقفل الـ gap في النقطة #2 |
| **Spec للـ CVE-USERS-001 race** (Last-SUPER_ADMIN) | P0 | NEEDS-CODER من Session 1 — لازم يُفتح session للـ fix + spec |
| **`@prisma/client/runtime/library` migration** | P0 | يفك الـ blocker على `npx jest` بدون filter |
| **Specs للـ remaining ~60 من checklist المختبر في Session 1** | P3 | tail coverage بعد ما الـ MVT يستقر |
| **Balancing edge cases على CVE-USERS-004** | P3 | undefined values، empty string |

---

## الحكم

✅ **التنفيذ متوافق مع الـ Plan**

الـ session نفّذت كل الـ 6 phases على المتفق عليه. الـ 3 انحرافات (findMany extension، smoke spec في الـ phase 1، 14 tests لـ A6) كلها تحسينية ومبررة. الـ MVT floor (10/10 fixes) محقق. الـ baseline 23 tests ثابتة. الـ typecheck نظيف على الـ scope (الـ 4 pre-existing errors خارج النطاق ومُعترف بها).

**نقاط معمارية محتاجة follow-up:**
1. الـ `$transaction` mock simplistic — لا يـ verify rollback (P1 session لاحق)
2. الـ A1 spec لا يـ assert على correlation_id (P2 — assertion إضافي)
3. الـ `lastLogin` microtask wait fragile (P3 — tactical fix)

**جاهز للأدوار التالية:** 🔴 الهاكر → 🧪 المختبر → 👁️ المراجع الأعلى.

✋ تم المخطط (ما بعد التنفيذ) — للدور التالي (🔴 الهاكر)؟
