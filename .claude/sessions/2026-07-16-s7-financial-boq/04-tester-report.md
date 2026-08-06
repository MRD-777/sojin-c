# تقرير المختبر — S7

> **الـ MVT كود فعلي مكتوب ومُشغَّل** (قاعدة #2) — لا checklist. 5 ملفات spec جديدة، كلها passing.

---

## إحصائيات

| البند | العدد |
|---|---|
| **MVT المطلوب** (12 مخطط + 5 CVE-FIXED-BY-HACKER) | **17** |
| **MVT المُغطّى** | **17 / 17** ✅ |
| ملفات spec جديدة | 5 |
| `it` blocks مكتوبة | 59 (تتوسّع لـ **66 حالة** بسبب `it.each`) |
| Tests passing (الجديدة) | **66 / 66** |
| Tests failing (الجديدة) | **0** |
| الـ suite الكامل قبل | 301 test (287 ✅ / 14 ❌ baseline) |
| الـ suite الكامل بعد | **367 test (353 ✅ / 14 ❌ نفس الـ baseline)** |
| Regression | **0** |
| Coverage (أدوات) | لم تُقَس — `--coverage` غير مفعّل في الـ repo؛ التغطية موصوفة سلوكياً أدناه |

### الملفات المكتوبة
| الملف | it-blocks |
|---|---|
| `src/modules/finance/financial-settings.service.spec.ts` | 11 |
| `src/modules/finance/financial-summary.service.spec.ts` | 15 |
| `src/modules/finance/boq.service.spec.ts` | 18 |
| `src/modules/finance/dto/finance-dto.spec.ts` | 11 |
| `src/modules/projects/ensure-project-access.accountant.spec.ts` | 4 |

> ملف الـ `ensureProjectAccess` **جديد مستقل** — لم يُعدَّل `projects.service.spec.ts` القائم (صفر لمس لـ suite شغّالة).

---

## تغطية الـ 17 spec الإلزامية

| # | المطلوب | الحالة | التأكيد المزدوج المُنفَّذ |
|---|---|:---:|---|
| 1 | GET بلا صف ⇒ defaults | ✅ | `upsert` و`create` و`update` و`runSerializable` **صفر استدعاء** |
| 2 | PATCH audit بـ oldValues مشتقة | ✅ | `upsert.mock.calls[0][0].update.contractValue.toFixed(2) === '2500.50'` + `Object.keys(update) === ['contractValue']` |
| 3 | PATCH no-op (`{}` + نفس القيمة) | ✅ | `upsert` **و** `logInTransaction` صفر استدعاء |
| 4 | Summary — الحساب الكامل | ✅ | المصالحة محسوبة **من السلاسل المُرجَعة** + فحص `where` للـ aggregate (مسار Phase) |
| 5 | Summary — CLIENT | ✅ | `not.toHaveProperty` للأربعة **+ الاتجاه المعاكس** (non-CLIENT عنده الأربعة) |
| 6 | `retentionReleased` | ✅ | 4 حدود + **قصّ نهاية الشهر بتاريخ تمييزي** |
| 7 | soft-delete | ✅ | **`bOQItem.delete` صفر استدعاء** + `deletedAt`/`deletedBy` في وسائط `update` |
| 8 | حذف بلا سبب (حل التصادم) | ✅ | `deletionReason = null` في الصف **مقابل** `audit.reason` = النص المعلن + طول ≥20 |
| 9 | حارس الأبناء | ✅ | 400 **و** `update`/`delete`/`logInTransaction` صفر استدعاء |
| 10 | `completedPct` | ✅ | حساب + **فحص الـ where** (APPROVED/deleted/phase/project) + ÷0 + سقف 100 |
| 11أ | IDOR — تقرير من مشروع آخر | ✅ | 404 + `create` صفر استدعاء + **`where.phase.project.id === 'proj-1'`** |
| 11ب | IDOR — بند من شركة أخرى | ✅ | 404 + **`update.findFirst` لم تُنادَ إطلاقاً** + `where.project.companyId` |
| 12 | `ensureProjectAccess` regression | ✅ | **`projectAssignment.findFirst` صفر استدعاء** (يُثبت الـ early-return) |
| 13 | CVE-S7-001 `order` | ✅ | الحد يمرّ / الحد+1 و`2147483648` يُرفضان بـ `max` — من الجهتين |
| 14 | CVE-S7-002 اسم مسافات | ✅ | 4 صور مرفوضة + اسم حقيقي بمسافات محيطة يمرّ |
| 15 | CVE-S7-003 تاريخ مستحيل | ✅ | 3 تواريخ ⇒ 400 + صفر كتابة؛ وتاريخ صحيح ⇒ **`upsert` استقبل `2026-02-28T00:00:00.000Z`** |
| 16 | CVE-S7-004 نطاق العدّاد | ✅ | `count` نُوديت بـ `{parentId, projectId, deletedAt}` بالضبط |
| 17 | CVE-S7-005 عمق الشجرة | ✅ | 10 آباء ⇒ 400 + `create` صفر استدعاء + `findUnique` **10 مرات بالضبط**؛ و9 ⇒ ينجح |

---

## 🔬 إثبات إن الـ specs **تعضّ** فعلاً (mutation check)

الخطر الحقيقي في specs تُكتب **بعد** الكود: إنها تصف السلوك بدل ما تحرسه. اختبرت ده بدل ما أفترضه — عطّلت إصلاحين من إصلاحات الهاكر في `boq.service.ts` وشغّلت الـ suite:

```
$ (revert CVE-S7-004: remove `projectId` from the children count)
$ (revert the cross-project gate: remove `id: boqItem.projectId` from the link where)
$ npx jest src/modules/finance/boq.service.spec.ts

  ● BOQService › MVT-9 — active children guard › MVT-16 — CVE-S7-004: the count is scoped by projectId (not just parentId)
  ● BOQService › MVT-11 — cross-project / cross-tenant link (IDOR) › (a) an update from another project ⇒ 404 and NO link is written
Tests:       2 failed, 16 passed, 18 total
```

**النتيجة:** الـ specs المستهدَفة **وحدها** سقطت — لا أكثر ولا أقل. الملف اتسترجع فوراً والـ suite رجعت خضراء (66/66).

**الأهم — ده بالظبط اللي كان هيتخفى بدون التأكيد المزدوج:** في حالة الـ IDOR، الـ mock بيرجّع `null` للتقرير **بغض النظر** عن الـ where. spec بيكتفي بـ `rejects.toBeInstanceOf(NotFoundException)` كان هيفضل **أخضر** والبوابة مشالة. اللي أسقطه هو تأكيد `where.phase.project.id` — أي التأكيد على **الوسيطة نفسها** لا على النتيجة. نفس الشيء في MVT-16: 400/200 كان هيعدّي، واللي عضّ هو وسائط `count`.

> هذا رد مباشر على درس **CVE-TEST-011** (قاعدة #4): الـ status الصحيح ممكن ييجي من مسار غلط تماماً.

---

## Unit Tests

| الـ Test | إيه اللي بيختبره | النتيجة |
|---|---|:---:|
| MVT-1 (×2) | defaults عند غياب الصف + نطاق القراءة (tenant + soft-delete) | ✅ |
| MVT-2 / 2b (×3) | audit UPDATE/CREATE، oldValues مشتقة، القيمة الفعلية للـ upsert، القراءة داخل الـ tx | ✅ |
| MVT-3 (×3) | no-op بجسم فاضٍ / بنفس القيم / تغيير حقيقي وسط حقول ثابتة | ✅ |
| MVT-15 (×5) | 3 تواريخ مستحيلة مرفوضة + تخزين دقيق + مناعة ضد `+03:00` | ✅ |
| MVT-4 (×6) | الحساب، مسار Phase، سقف السلفة، التقريب، مشروع فاضٍ، netDue سالب | ✅ |
| MVT-5 (×3) | حجب الأربعة عن CLIENT، الاتجاه المعاكس، تطابق الأرقام بين الدورين | ✅ |
| MVT-6 (×6) | بلا تاريخ، منقضٍ، جارٍ، اليوم الأخير/التالي، القصّ، سنة كبيسة | ✅ |
| MVT-7/8 (×4) | soft-delete + الأشكال الثلاثة لسبب الـ audit | ✅ |
| MVT-9/16 (×3) | الحارس من الجهتين + نطاق العدّاد | ✅ |
| MVT-10 (×3) | الحساب، فلترة الـ query، التشجير واليتيم | ✅ |
| MVT-11 (×5) | IDOR (أ) و(ب)، غير معتمد، ربط ناجح، idempotency | ✅ |
| MVT-17 (×3) | العمق من الجهتين + اشتقاق `projectId` من الأب | ✅ |
| MVT-12/13/14 (×15) | صلاحية ACCOUNTANT + حدود الـ DTO | ✅ |

## Integration Tests

**لا يوجد — ولا واحد.** كل الـ 66 spec **service-layer بـ Prisma مموّه**. لا يوجد supertest ولا HTTP boot في الـ repo (BACKLOG ticket #5 مفتوح منذ Session 1.6). التبعات المباشرة على S7 مذكورة في "مناطق محتاجة coverage".

## Business Logic Tests

| الـ Transition / القاعدة | المتوقع | النتيجة |
|---|---|:---:|
| PATCH بلا تغيير فعلي | صفر كتابة + صفر audit | ✅ |
| أول PATCH (لا صف) | `action = CREATE` + oldValues = defaults | ✅ |
| `advanceRecovered` | `min(advanceAmount, نسبي)` | ✅ |
| `netDue` سالب | يُعرض كما هو، بلا clamp | ✅ |
| `completedPct` | APPROVED فقط، ÷0 ⇒ 0، سقف 100 | ✅ |
| حذف بند له ابن نشط | 400 + صفر كتابة | ✅ |
| حذف بند كل أبنائه محذوفون | ينجح | ✅ |
| ربط تقرير غير معتمد | 400 | ✅ |
| ربط مكرر | idempotent + صفر audit ثانٍ | ✅ |
| `retentionPct = 100` | **يُقبل** (قرار موثَّق) | ✅ مثبَّت بـ spec |

> spec `retentionPct = 100` **يثبّت السلوك الحالي عمداً**: أي سقف صامت يُضاف مستقبلاً بلا قرار معلن هيكسر الـ spec ويطلب مبرراً. القرار المفتوح لا يُترك بلا حارس.

## Security Tests

| الهجوم | النتيجة |
|---|:---:|
| Tenant isolation (الإعدادات / البنود / الروابط) | ✅ فحص `where` في كل قراءة |
| IDOR — تقرير من مشروع آخر | ✅ (mutation-verified) |
| IDOR — بند من شركة أخرى (سلسلة 2→4) | ✅ |
| Privilege escalation — ACCOUNTANT خارج شركته | ✅ Forbidden |
| ACCOUNTANT company-wide بلا تعيين | ✅ يمرّ (early-return مُثبَت) |
| SITE_ENGINEER بلا تعيين | ✅ Forbidden (التوسيع لم يتسرّب) |
| مشروع محذوف | ✅ Forbidden |
| Mass assignment (`netDue` في الـ body) | ✅ مرفوض |
| Boundary values (`order`، النِّسب، الخانات العشرية) | ✅ من الجهتين |
| Hard delete على سجل مسعّر | ✅ `delete` غير مستدعاة |
| تلاعب في سبب الـ audit | ✅ الصف والـ audit مفصولان ومؤكَّدان |

## Regression Tests

```
$ npx tsc -p tsconfig.build.json --noEmit
TSC EXIT: 0

$ npx jest --silent
Test Suites: 2 failed, 26 passed, 28 total
Tests:       14 failed, 353 passed, 367 total
Snapshots:   0 total
Time:        18.093 s, estimated 20 s
```

- **قبل الـ MVT:** 23 suite / 301 test (287 ✅ / 14 ❌).
- **بعد الـ MVT:** 28 suite / 367 test (**353 ✅** / 14 ❌).
- **الفارق: +5 suites، +66 test، +66 passing، والـ 14 الفاشلة هي نفسها بالضبط** (`env-validation.spec.ts` + `audit-log.service.spec.ts` = ENV-SPEC-001 + AUDIT-SPEC-001 في الـ BACKLOG، لم تُمَسّ في هذه الـ session).
- **صفر regression** على `payments` / `projects` / `updates` رغم توسيع `ensureProjectAccess` في المرحلة 2.

---

## Bugs اتكشفت أثناء الـ Testing

**صفر bugs جديدة في كود الإنتاج.** والصدق يقتضي تسجيل حدود هذه النتيجة:

1. **الـ specs اتكتبت بعد الكود وفي نفس الـ session** ⇒ هي في جوهرها **characterization tests**: بتثبّت السلوك القائم وتحرسه من الانحدار، لكنها **لم تكتشف عيوباً باستقلال**. كل عيوب هذه الـ session اتكشفت في دور الهاكر بالقراءة الخصامية، لا بالـ specs. **الـ mutation check أعلاه هو التعويض الوحيد المتاح** عن غياب الاستقلالية: يثبت على الأقل إن الحراسة حقيقية.
2. **العيب الوحيد اللي الـ specs أمسكته اتكتب في الـ specs نفسها**: خطأ TS في تحويل نوع الرد (union فيه `boolean`) — أُصلح في ملف الـ spec، صفر أثر على الإنتاج.
3. **بند دقة على تقرير المبرمج:** الادعاء إن `bOQItem.delete` "لا تُستدعى أبداً" كان قبل اليوم **قراءة كود**؛ دلوقتي بقى **مؤكَّداً آلياً** (MVT-7).

---

## مناطق لسه محتاجة coverage

| # | المنطقة | لماذا مكشوفة | الأثر |
|---|---|---|---|
| 1 | **مصفوفة الصلاحيات (`@Roles` + `RolesGuard`)** | كل الـ specs service-layer؛ الـ guard مالوش أي spec | **الأخطر:** أي دور غلط على أي endpoint من التسعة **لن يمسكه شيء** — لا tsc (API-ROLES-001) ولا spec. تحققه الوحيد اليوم سكربت boot **عابر** يختفي بنهاية الـ session |
| 2 | `ValidationPipe` wiring | specs الـ DTO تنادي `validate()` مباشرةً | لو الـ pipe اتشال/اتظبط غلط، حدود الـ DTO كلها بتتحوّل ديكور — والـ 11 spec بتاعتها هتفضل خضراء |
| 3 | `ParseUUIDPipe` على الـ params | نفس السبب | `:id` غير UUID يوصل للـ service |
| 4 | `P2002 ⇒ 409` (الإعدادات) و`P2002` في الربط | مسارات سباق حقيقية، صعبة التمثيل في mock | 409 غير مؤكَّد |
| 5 | سلوك الـ transaction الحقيقي (rollback عند فشل الـ audit) | الـ mock ما بيمثّلش rollback | ضمانة "فشل الـ audit ⇒ رجوع الكتابة" **موروثة من نمط payments، غير مُختبَرة هنا** |
| 6 | عزلة القراءة (A-S7-3) | `$transaction` المموّه لا يمثّل مستوى العزل | ملاحظة المخطط قائمة بلا كاشف |
| 7 | `findTree` بحمل حقيقي (N+1، شجرة كبيرة) | لا اختبار أداء | — |

**البنود 1–3 تُغلق كلها بـ WEB-S1-004 / BACKLOG #5 (HTTP integration tests).** بند 1 تحديداً **يستحق ترقية أولوية**: هو المكان الوحيد في S7 اللي فيه خطر أمني **بلا أي شبكة أمان آلية**.

---

## الحكم

# ✅ READY

- **MVT: 17/17 مكتوبة وpassing** — الميزانية المعتمدة مستوفاة بالكامل، بما فيها الـ IDOR بحالتيه المنفصلتين وتطبيق التأكيد المزدوج على الخمسة الجديدة.
- **66/66 spec جديدة خضراء، 353/367 في الـ suite الكامل، صفر regression**، والـ 14 الحمراء baseline موثَّق ومسجَّل قبل الـ session.
- **tsc: EXIT 0.**
- الـ specs **مُثبَت أنها تعضّ** (mutation check على إصلاحين).

**تحفّظان مرفوعان للمراجع الأعلى — لا يمنعان الـ READY لكن لا يجوز ابتلاعهما:**
1. **الـ specs characterization لا اكتشافية** (بند "Bugs" أعلاه) — قيمتها في منع الانحدار، لا في إثبات الصحة الابتدائية.
2. **طبقة الـ HTTP/Guards غير مغطاة إطلاقاً** — مصفوفة صلاحيات التسعة endpoints محروسة حالياً بمراجعة بشرية وسكربت عابر فقط.

✋ تم المختبر — للدور التالي (👁️ المراجع الأعلى)؟
