# تقرير المخطط (ما بعد التنفيذ) — Updates Module Full Review

> Session: 2026-05-30-updates-module-full-review · Mode: Deep
> Decisions المعتمدة: D1=A · D2=A · D3=A · D4=defer
> المرجع: الكود الفعلي في `apps/api/src/modules/updates/*` (بعد الاستعادة، tsc EXIT=0، 22/22 service specs passing).

---

## ملاحظة سلامة (Integrity note)

الكود اللي بُنيت عليه المراجعة دي هو **النسخة المُستعادة** بعد حادثة إتلاف الملفات
أثناء الـ session (موثّقة للمستخدم). تم التحقق إن المُستعاد مطابق لحالة نهاية Phase 7
الموصوفة في `02-coder-report.md`:
- `tsc --noEmit` = **EXIT 0** (صفر أخطاء).
- `jest (updates|idempotency).service.spec` = **22 passed / 22**.
- full sweep = 253 passed / 14 failed، والـ 14 كلها pre-existing (ENV-SPEC-001 + AUDIT-SPEC-001 في BACKLOG) — **صفر regression جديد**.
- كل ملفات الموديول UTF-8، `dto/` فيه `index.ts` فقط (الملفات الفاضية الطفيلية اتمسحت).

المراجعة المعمارية أدناه صالحة لأن المُستعاد = نية الـ coder report بالظبط، متحقَّق منها مرتين.

---

## مقارنة Plan vs Reality

| البند (Plan) | المخطط | المنفّذ في الكود | متطابق؟ |
|---|---|---|---|
| Phase 1 — CVE-UPD-001 filter narrow | three-tier (CLIENT/ADMIN/FIELD)، query.status يـ refine مش يـ bypass | `findAll` lines 92–110: نفس الـ three-tier بالظبط؛ FIELD + non-APPROVED status → `status + submittedBy=me` | ✅ |
| Phase 1 — `ListUpdatesQueryDto.status` enum | `@IsEnum(UpdateStatus)` | منفّذ (الـ service بيستخدم `query.status` كـ `UpdateStatus` بدون cast) | ✅ |
| Phase 2 — CVE-UPD-002 idempotency داخل tx (D1=A) | `saveInTransaction` + IdempotencyRecord Prisma model + migration | `approve` line 495 و `forceCancel` line 719: `idempotency.saveInTransaction(tx, …)` داخل الـ `$transaction` | ✅ |
| Phase 3 — CVE-UPD-003 create race | duplicate-check + create + audit داخل Serializable tx **+ DB partial unique index** | داخل Serializable tx ✅ (lines 248–305)؛ **الـ DB partial index لم يُنفّذ** ⚠️ | ⚠️ جزئي |
| Phase 3 — CVE-UPD-005 forceCancel race | in-tx re-read authoritative + ConflictException عند تغيّر الحالة | lines 620–640: re-read داخل tx + `ConflictException` | ✅ |
| Phase 3 — CVE-UPD-007 version race | Serializable + `@@unique([updateId, versionNumber])` | tx Serializable (line 842) + الـ unique constraint (schema، حسب الـ coder report) | ✅ (schema غير مقروء هنا) |
| Phase 4 — D3=A قفل money fields | `EditApprovedDto` standalone بدون cost/progressIncrement/materialsUsed؛ service يكتب descriptive فقط | lines 808–818: `data` فيها title/description/workDone/workRemaining/workersCount/workHours فقط | ✅ |
| Phase 5 — CVE-UPD-006 + BUG-UPD-011 IDOR | كل denial path = `NotFoundException` | `findOne` 174–196 + `getOwnedUpdate` 977–986: كلها NotFound | ✅ |
| Phase 6 — DTO tightening per skill 04 | جدول bounds كامل | في `dto/index.ts` (موصوف في coder report؛ tsc يؤكد التوافق النوعي) | ✅ (يحتاج فحص المختبر) |
| Phase 7 — editDraft cleanup BUG-UPD-009 | clear rejectionReason/reviewedBy/reviewedAt عند REJECTED→DRAFT | lines 345–347: spread شرطي صحيح + audit يحتفظ بالـ reason | ✅ |
| Phase 8 — ACCOUNTANT (D2=A) | admin-tier visibility | `ADMIN_TIER_ROLES` constant (49–53) مستخدم في findAll + findOne | ✅ (مدموج في 1+5) |
| Phase 9 — MVT ≥27 spec جديد | 27 spec جديد passing | **لم يُكتب بعد** — الموجود 22 = baseline قديم (دور المختبر) | ⏳ مؤجّل للمختبر |

---

## الانحرافات عن الـ Plan

1. **DB partial unique index على `Update` لم يُنفّذ** (Phase 3 / CVE-UPD-003) —
   مبرّر الـ coder: الـ index بيحسب اليوم بـ UTC بينما الـ service بـ company-tz،
   فالـ index هيـ block submissions شرعية تعبر منتصف ليل UTC داخل نفس اليوم المحلي.
   **مقبول معمارياً؟ ✅ نعم** — الـ Serializable isolation وحدها كافية للـ atomicity
   نظرياً. **لكن** فيه caveat حرج (انظر تقييم المعمارية #1).

2. **`getVersions` controller @Roles أضاف `ACCOUNTANT`** — مش في الـ plan، الـ coder
   أبلغ. **مقبول ✅** — اتساق مع D2=A، والـ service layer (`findOne`) بيـ enforce الـ ACL
   فعلياً، فالـ route-role توسيع آمن (الـ non-admin هيتـ reject في الـ service).

3. **Phase 8 اتدمج في Phase 1 + Phase 5** بدل مرحلة مستقلة — **مقبول ✅** —
   centralization عبر `ADMIN_TIER_ROLES` constant أنظف من تكرار الـ list في 3 أماكن.

4. **بلاست-رادياس Phase 2 أوسع من «Updates module only»** — تحويل الـ global
   idempotency store من in-memory لـ Prisma (D1=A) بيمسّ **كل endpoint idempotent**
   (payments، إلخ)، مش updates بس. الـ plan اعترف بده وأقرّه. **مقبول ✅ بشرط**
   إن المختبر يـ smoke-test الـ payments idempotency path (regression awareness).

---

## تقييم المعمارية

### 🔴 #1 — أهم ثغرة معمارية: Serializable بدون retry wrapper
الإصلاحات الثلاثة (CVE-UPD-003/005/007) بتعتمد على `isolationLevel: 'Serializable'`
عشان Postgres يـ abort الـ conflicting tx. **لكن Prisma مابيعملش auto-retry لأخطاء
الـ serialization failure (40001 / P2034).** التعليقات في الكود بتقول "الـ client
يـ retries" — ده افتراض مش مضمون:
- لو الـ client مابيـ retry-ش على 500 → الـ user ياخد error بدل نجاح شفّاف.
- النتيجة العملية: تحت تزامن حقيقي، create/forceCancel/editApproved ممكن يـ fail
  بـ 500 بدل ما يـ retry تلقائياً.

**التوصية:** retry wrapper حوالين الـ `$transaction` (مثلاً 3 محاولات على P2034 مع
backoff بسيط) — يُفضّل كـ helper مشترك في `PrismaService` عشان كل الـ Serializable
tx-es تستفيد. **ده NEEDS-CODER candidate للهاكر يأكّده** (هل هو exploitable كـ
availability/correctness issue ولا degradation مقبول؟).

### 🟡 #2 — الـ idempotency cached body شكله entity خام
`approve` بيـ cache `body: updated` (Prisma entity فيه `Decimal` cost + `Date`
fields). الـ `IdempotencyRecord.body` نوعه `Json` → الـ Decimal/Date هيتـ serialize.
عند replay، الـ cached body ممكن يرجع cost كـ string بدل number، أو dates بصيغة
مختلفة عن الـ first response. **inconsistency محتمل في الـ response shape بين
first-call و replay.** المختبر لازم يـ assert تطابق الـ shape (paired assertion).

### 🟡 #3 — DB round-trip على كل idempotent request
PrismaIdempotencyStore بيستبدل الـ in-memory store → كل approve/forceCancel بقى فيه
DB lookup إضافي قبل أي tx. صحيح أأمن (multi-instance + restart-survival)، لكن
perf note: على endpoints عالية التردد ده cost. **مقبول للـ approve/forceCancel
(عمليات نادرة)**، بس يتسجّل كـ awareness.

### 🟢 #4 — tenant isolation متّسق وقوي
كل query في الموديول بيـ filter بـ `companyId` + `softDeleteFilter`، وكل denial =
NotFound. الـ `getPhaseWithAccess` بيـ delegate لـ `ensureProjectAccess` (cross-module
contract). **معماري نظيف.**

### 🟢 #5 — audit-inside-tx متّسق (skill 07 / C28)
كل state transition + الـ progress recalc + الـ SUNK_COST payment + الـ idempotency
save كلهم داخل نفس الـ `$transaction` (`logInTransaction` + `recalculateProgressInTx`
+ `saveInTransaction`). **atomicity guarantee محترمة بالكامل.**

### 🟢 #6 — DST / timezone handling سليم
`computeDayBounds` + `toUtcFromLocal` بيستخدموا `Intl.DateTimeFormat` بدون dependency،
مع fallback لـ UTC عند tz غير صالح + معالجة `hour === 24` edge. **منطق دقيق.**

---

## حاجات محتاجة تتعمل في sessions قادمة

| البند | المستوى | ملاحظة |
|---|---|---|
| **Serializable retry wrapper** (تقييم #1) | 🔴 HIGH | الهاكر يأكّد إن كان availability/correctness gap؛ لو نعم → NEEDS-CODER داخل الـ session (rule: self-contained) |
| **DB partial unique index** كـ defense-in-depth لـ CVE-UPD-003 | 🟡 MEDIUM | محتاج raw SQL migration بـ `(createdAt AT TIME ZONE company.tz)` — غير trivial؛ مؤجّل لو الهاكر اقتنع بالـ Serializable |
| **idempotency body shape consistency** (تقييم #2) | 🟡 MEDIUM | المختبر يـ assert؛ لو inconsistent → normalize الـ cached body |
| **payments idempotency regression** (انحراف #4) | 🟡 MEDIUM | المختبر smoke-test بعد تبديل الـ store |
| **BACKLOG A1** — `recalculateProgressInTx` signature tightening | 🟢 LOW | updates بيـ call-وها صح (داخل tx)؛ لكن الـ signature لسه بيقبل PrismaService — مش مشكلة updates مباشرة |
| المراجعة لم تقرأ `schema.prisma` و `dto/index.ts` و `prisma-store.ts` و `idempotency.service.ts` سطر-بسطر | — | **الهاكر + المختبر مكلّفون بفحصهم فعلياً** (المخطط اعتمد على الـ coder report + tsc لهم) |

---

## الحكم

⚠️ **في انحرافات مقبولة + ثغرة معمارية واحدة محتاجة تأكيد الهاكر.**

- التنفيذ متوافق مع الـ Plan في **9 من 11 بند** (✅)، بند واحد جزئي (الـ DB index — انحراف مبرّر)، وبند مؤجّل للمختبر (الـ MVT — وده صح في Deep mode).
- **الانحرافات كلها موثّقة ومبرّرة** — مفيش انحراف silent.
- **الأولوية للدور الجاي (الهاكر):** يحقّق في **تقييم #1 (Serializable بدون retry)** — ده الـ finding الأخطر؛ لو exploitable → NEEDS-CODER (rule #9) ويتقفل داخل الـ session حسب قاعدة الـ scope «self-contained».
- الـ MVT budget لسه **27 spec جديد** زي ما الـ plan حدّد — المختبر مُلزَم بيه (rule #2)، والهاكر لو فتح NEEDS-CODER فالمخطط Stage 2 لازم يـ approve أي زيادة في الـ budget (rule #9).

---

## التأثير على الـ Codebase الحالي (تأكيد)

| ملف | الحالة |
|---|---|
| `updates.service.ts` | ✅ كل الإصلاحات حاضرة، tsc clean |
| `updates.controller.ts` | ✅ VIEWER/FIELD roles + ACCOUNTANT في getVersions |
| `updates.module.ts` | ✅ `imports: [AuditModule, ProjectsModule]` صحيح |
| `dto/index.ts` | ✅ موجود (يحتاج فحص المختبر للـ bounds) |
| `common/idempotency/*` | ⚠️ blast-radius أوسع — يحتاج regression check |
| `app.module.ts` | ✅ UpdatesModule متوصّل (سطر 71) — لم يُلمَس |
| `prisma/schema.prisma` + migrations | ⏳ IdempotencyRecord + UpdateVersion unique — يحتاج تأكيد الهاكر/المختبر |

✋ تم المخطط (ما بعد التنفيذ) — للدور التالي؟

---

# تقرير المخطط — Stage 2 (Hacker Proposal vs Reality)

> سياق: `03-hacker-report.md` فتح **NEEDS-CODER** (Rule #9). هذا الـ Stage 2 يقارن
> **اقتراح الهاكر** ("الـ Fix المقترح للمبرمج") مقابل **المنفّذ فعلاً** في الكود (قرأت
> المقاطع المعدّلة سطر-بسطر على القرص، مش اعتماداً على الـ coder report)، ثم **يعتمد
> صراحةً الـ MVT budget الجديد** قبل ما المختبر يبدأ (شرط Rule #9).

## مقارنة Hacker Proposal vs Reality

| الـ Fix (اقتراح الهاكر) | المنفّذ في الكود | متطابق؟ |
|---|---|---|
| **Fix 1 / CVE-UPD-008** — in-tx re-read لـ `status` داخل tx الـ approve، throw `ConflictException` لو `!fresh \|\| status !== 'PENDING'` (نسخة طبق الأصل من forceCancel) | `updates.service.ts` 453–461: `tx.update.findFirst({select:{id,status}})` + الـ guard بالظبط + رسالة Conflict؛ قبل أول write | ✅ مطابق |
| **Fix 2 / CVE-UPD-009** — بناء `responseBody` مُطَبَّع مرة واحدة، cache + return نفسه (نمط payments) | 511–535: spread `...updated` ثم override `cost .toFixed(2)`، `workHours Number(...)`، `submittedAt/reviewedAt/lockedAt ?.toISOString() ?? null`، `createdAt/updatedAt .toISOString()`؛ `saveInTransaction` + `return responseBody` | ✅ مطابق (أشمل من المقترح — غطّى كل Decimal/Date) |
| **Fix 3 / PAY-IDEM-001** — نقل `save` → `saveInTransaction(tx,…)` داخل tx الموجود في `payments.create` + body مُطَبَّع | `payments.service.ts`: الـ persistence + الـ normalized body اتنقلوا جوّه `runSerializable` body؛ `saveInTransaction` بدل `save`؛ return الـ normalized body | ✅ مطابق |
| **Fix 4 / retry wrapper** — `PrismaService.runSerializable<T>(fn, retries)` بـ retry على P2034، استبدال المواضع الخمسة | `prisma.service.ts`: helper بـ `instanceof PrismaClientKnownRequestError && code==='P2034'`، 3 retries، jittered backoff، rethrow لغير-P2034. استُبدل في approve+create+forceCancel+editApproved (updates) + payments.create = **5 مواضع** | ✅ مطابق |

## تقييم معماري للكود الجديد

### 🟢 #1 — تماثل approve مع forceCancel اكتمل
الـ CVE-UPD-008 كان عدم اتساق صارخ (forceCancel محمي، approve مكشوف). دلوقتي
الاتنين عندهم نفس الـ in-tx guard pattern. **الـ asymmetry اتقفلت.**

### 🟢 #2 — `runSerializable` centralization صحيحة
الـ retry helper في `PrismaService` (مش متكرر في كل method)، والـ `editDraft`/`submit`/
`reject` **عن صواب** فضلوا على `$transaction` العادي (مش Serializable، مش محتاجين
retry). الـ retry بيعيد قراءة الحالة الطازجة على كل محاولة، فالـ in-tx guards
(status re-check) بتفضل صحيحة — **مفيش stale-read على retry.**

### 🟢 #3 — تقييم #1 (Stage 1) اتقفل
الـ "Serializable بدون retry" اللي رفعته في Stage 1 كـ HIGH candidate بقى مُعالَج
بـ wrapper مشترك. الحالة المتداخلة دلوقتي تعيد المحاولة شفّافياً بدل 500.

### 🟡 #4 — ملاحظة دقيقة (مقبولة، مش blocker): `progressIncrement` لسه pre-tx read
في approve، الـ in-tx `fresh` يعيد قراءة `status` فقط؛ الـ `phase.progress` increment
لسه بيستخدم `update.progressIncrement` من الـ **pre-tx** read (السطر 475). **آمن** لأن
الـ PENDING update مايقدرش يتعدّل (editDraft = DRAFT/REJECTED فقط، وموني-fields locked
بعد approve عبر D3=A). فمفيش نافذة لتغيّر الـ increment بين القراءتين. **مقبول** — يُذكر
للمختبر كـ assertion implicit (الـ increment value = pre-tx value).

### 🟡 #5 — `runSerializable` غير مغطّى بـ unit test مباشر
الـ specs بتـ mock الـ PrismaService كله، فالـ retry-loop نفسه مش ممارَن. **يُلزَم
المختبر** بـ spec على الـ helper (PrismaClientKnownRequestError P2034 → retry ثم نجاح؛
non-P2034 → propagate فوراً). داخل الـ MVT budget أدناه.

### 🟢 #6 — بلاست-رادياس payments محدود فعلاً
الـ pull-in لـ PAY-IDEM-001 كان نقل سطر داخل tx موجود — صفر تغيير في الـ schema أو
الـ signature. الـ regression sweep (253 passed، صفر new) يؤكّد عدم تأثّر باقي
الموديولات.

## الانحرافات
- **مفيش انحراف عن اقتراح الهاكر.** الـ coder طبّق الـ 4 بدقّة؛ التوسّع الوحيد
  (normalization غطّى كل Decimal/Date مش بس cost/date) **تحسين مقبول.**
- الـ spec-mock edits (runSerializable + saveInTransaction في الـ mocks، تعمير approve
  rows) = **ضرورة تقنية** لإبقاء الـ suites green بعد تغيّر السلوك — **مش** specs جديدة
  (دي للمختبر).

## ✅ اعتماد الـ MVT Budget الجديد (شرط Rule #9 — صريح)

الـ budget الأصلي في `00-plan.md` = **27 spec جديد**. أعتمد **+5 specs** للـ NEEDS-CODER
returns، فالـ **budget الجديد = 32 spec جديد** (14 existing → إجمالي 46). توزيع الـ +5:

| # | الـ Spec المطلوب | الـ Method | paired assertion (Rule #4) |
|---|---|---|---|
| +1 | staggered status-flip داخل tx → `ConflictException` **و** `phase.update(increment)` اتنادى **مرة واحدة** | `approve` (CVE-UPD-008) | الـ primary action الأعمق = `tx.phase.update` called once — مش بس "throws" |
| +2 | happy path: in-tx `fresh.status==='PENDING'` → approve يكمّل | `approve` (CVE-UPD-008) | — |
| +3 | الـ `saveInTransaction` body shape === الـ return shape (cost = string، dates = ISO) | `approve` (CVE-UPD-009) | assert على الـ captured body بتاع `saveInTransaction` (deepest layer) مش على الـ return بس |
| +4 | `saveInTransaction` اتنادى بـ **tx client** داخل الـ Serializable tx (مش `save` post-commit) | `payments.create` (PAY-IDEM-001) | assert arg[0] = tx، و`save` not called |
| +5 | `runSerializable`: P2034 → retry ثم نجاح؛ non-P2034 → propagate فوراً (no retry) | `PrismaService` (Fix 4) | assert عدد محاولات `$transaction` |

**ملاحظة للمختبر:** الـ +5 دول **حد أدنى إجباري** فوق الـ 27. لو الـ infra ماتسمحش بـ
spec كامل لـ `runSerializable` (محتاج PrismaClientKnownRequestError حقيقي)، اكتب على
الأقل assertion-level test يـ simulate الـ error code. والـ Rule #5 (re-attack new specs)
يطبّق: أي spec جديد لازم يصمد ضد الـ pattern "side-effect بدون primary action".

## الحكم (Stage 2)

✅ **التنفيذ متوافق مع اقتراح الهاكر بالكامل (4/4 fixes)** — صفر انحراف، tsc clean،
صفر new regression. الـ CVE-UPD-008 (HIGH) + PAY-IDEM-001 (HIGH) + CVE-UPD-009 (MEDIUM)
+ retry wrapper كلهم مغلقين على مستوى الكود. **الـ MVT budget الجديد (32) معتمد صراحةً.**
المختبر مأذون له يبدأ.

✋ تم المخطط (Stage 2 — Hacker Proposal vs Reality) — للمختبر (MVT + report)؟
