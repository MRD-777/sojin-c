# تقرير المراجع الأعلى — S4: Updates Workflow + Review Inbox + Phases

> **منهجية:** لا أثق في أي دور — حتى نفسي. قرأت الملفات الستة السابقة **وتحقّقت مستقلاً** بإعادة تشغيل الـ 3 spec files (16/16 passing، EXIT:0) وبفحص حالة `reviews/page.tsx` الفعلية (لا زالت mock — `ReviewItem` interface + بيانات ثابتة). الحكم أدناه مبنيّ على ما رأيته بنفسي، لا على ادعاءات التقارير.

---

## ملخص المهمة
ربط المجموعة 1.5–1.7 (Review Inbox + أفعال state-machine للتحديثات + تحكّم المراحل) بالـ backend الحقيقي، مع الجوهر الأمني = **استقرار مفتاح الـ Idempotency client-side** على الأفعال المالية (approve / force-cancel → SUNK_COST). سُلّمت 8/8 مراحل (بعد إعادة الترقيم في دورة NEEDS-CODER)، مع CVE-S4-001 واحد (LOW) مُصلَّح معمارياً بنقل الـ holders لملكية الـ page، و5 MVT مكتوبة وpassing.

---

## مراجعة شاملة

| المحور | التقييم | ملاحظات |
|--------|---------|---------|
| جودة المعمارية | **9/10** | فصل الـ holder في module نقي node-testable = القرار الأعمق؛ نقل الملكية للـ page (بدل الـ dialog/panel القابل للـ unmount) يقفل ATT-2 من جذره لا يتحايل عليه؛ صفر hardcoded query key؛ صفر تعديل على `client.ts`/auth (ضمانة S3 محفوظة). خصم نقطة: `reviews/page.tsx` لا زال mock فالـ nav entry المستقل غير مربوط (المرحلة 7 الأصلية مؤجّلة). |
| جودة الأمان | **9/10** | 0 CRITICAL/HIGH/MEDIUM؛ CVE-S4-001 (LOW liveness) مُصلَّح بالحلّ الآمن؛ role gating يطابق `@Roles` الخلفي حرفياً؛ throw بدل degrade صامت على غياب Web Crypto = رفض weak-key على فعل مالي؛ الـ paired assertion يثبت المفتاح byte-for-byte على الـ transport header. خصم نقطة: طبقة render (holder lifecycle عبر شجرة Tabs→Panel→Dialog) غير مُختبَرة spec — مغطّاة code-review فقط (infra-blocked WEB-S1-004، مبرَّر لكنه فجوة حقيقية). |
| جودة الـ Tests | **8/10** | MVT budget 5/5 مطابق لإقرار المخطط؛ الـ paired (MVT-5: K1≠K2 + K2=K3) يثبت الـ invariant من الجهتين — نضارة على النية الجديدة **و** استقرار على نفس النية؛ re-attack (rule #5) مُطبَّق على الـ spec الجديد. خصم نقطتين: كل التغطية على الطبقات pure/node — صفر تغطية render أو HTTP integration؛ non-atomic swap بلا spec (residual موثّق). |
| جاهزية للـ Production | **7/10** | الطبقات المربوطة (Review Inbox داخل project detail + phase controls) جاهزة سلوكياً وموثّقة؛ لكن **المسار المستقل `reviews/page.tsx` لا زال mock** — أي مستخدم يدخل من الـ nav يرى بيانات وهمية. هذا لا يحجب الـ merge (النطاق أُغلق صراحةً على المنتقي المؤجّل) لكنه **يجب ألا يصل production بدون إمّا إخفاء الـ nav entry أو إتمام المرحلة 7**. |

---

## نقاط القوة
- **الـ Idempotency holder = أعمق تمثيل ممكن للعقد.** المفتاح نفسه (لا charset/length فقط) مفصول في closure نقي، مُختبَر algorithmically، ومربوط بـ backend regex `^[A-Za-z0-9_-]{16,64}$` عبر `isValidIdempotencyKey` كمصدر واحد. ده بالظبط ما تفرضه rule #4.
- **دورة NEEDS-CODER عملت شغلها.** الهاكر صنّف ATT-2 آمناً بناءً على ادعاء المرحلة 5 غير المُتحقَّق ("Panel يبقى mounted")؛ المستخدم أعاد التصنيف، والمبرمج اكتشف `keepMounted=false` بالمصدر — وهو validation **يقلب** الفرضية لا يؤكّدها. النظام أمسك خطأً كان سيصل production.
- **صفر optimistic update على أي فعل مالي** — مُتحقَّق بالفحص (لا `onMutate`/`setQueryData`)؛ معيار نجاح صريح محقّق.
- **الانحرافات كلها تصحيحية/تضييقية** (`workHours` number→string، reorder=swap، `submit` مؤجّل) — مبنية على المصدر أو تضييق نطاق معلن، صفر scope creep.
- **الـ paired assertion (MVT-5)** — كما أشار المستخدم — يثبت الـ invariant من الجهتين: `K1≠K2` (reset = نية جديدة) **و** `K2=K3` (بلا reset = idempotent replay). هذا أعمق spec في الجلسة لأنه يمنع الحلّ الخاطئ (مفتاح دائم النضارة يكسر الـ replay) بنفس القدر الذي يمنع به العلّة (مفتاح جامد يسبّب 422-loop).

---

## نقاط الضعف
- **`reviews/page.tsx` لا زال mock** (تحقّقت بنفسي) — المرحلة 7 الأصلية (منتقي المشاريع) مؤجّلة للـ BACKLOG. الـ nav entry يعرض بيانات وهمية. مقبول كنطاق مؤجّل، لكنه **دَيْن مرئي للمستخدم** لا دَيْن داخلي.
- **صفر تغطية render/integration.** كل الـ MVT على الطبقات pure. lifecycle الـ holder عبر mount/unmount الفعلي، والـ reason-change onChange→reset wiring، والـ swap بكتابتين — كلها مغطّاة code-review فقط (WEB-S1-004). الحجب مبرَّر لكن الفجوة تتراكم عبر الجلسات.
- **non-atomic reorder swap** — كتابتان PATCH غير ذريتين؛ فشل جزئي = tie مؤقت. LOW (لا يمسّ progress/payments) وموثّق كـ residual، لكنه correctness gap بلا spec ولا يمسكه tsc.

---

## مخاطر متبقية

| الخطر | المستوى |
|-------|---------|
| `reviews/page.tsx` mock يصل production بدون إخفاء nav أو إتمام م.7 | **MEDIUM** (UX/ثقة — بيانات وهمية للمستخدم؛ ليس أمنياً) |
| holder lifecycle عبر شجرة Tabs غير مُختبَر spec (regression مستقبلي لو أُضيف `key={updateId}` أو غُيّر keepMounted) | **LOW–MEDIUM** (مغطّى code-review + تحذير موثّق، لكن بلا حارس آلي) |
| non-atomic swap tie تحت فشل جزئي | **LOW** (تجميلي، يُحلّ بأي reorder/reload تالٍ) |
| generic error message على 400/409/422 يخفي سبب الفشل | **LOW** (بعد CVE-S4-001 صار الـ 422 غير قابل للوصول عبر الـ UI؛ تحسين UX فقط) |

---

## القرار النهائي

⚠️ **APPROVED WITH NOTES** — الطبقات المُنفَّذة (1–8) جاهزة معمارياً وأمنياً؛ الـ MVT budget = 5/5 مطابق لإقرار المخطط (rule #2 محقّقة، **لا rejection تلقائي**)؛ صفر خطأ tsc جديد عبر الـ 8 مراحل. الـ merge مسموح **بشرط** البنود التالية تُكتب في BACKLOG وتُغلق قبل أي إطلاق production للمسار المستقل:

1. **المرحلة 7 الأصلية (`reviews/page.tsx` → منتقي مشاريع)** — إمّا إتمامها أو **إخفاء الـ nav entry** حتى تُربَط. لا يجوز عرض mock للمستخدم في production. **(المُلزِم قبل production.)**
2. **hook-level render tests** لـ holder lifecycle عبر شجرة Tabs→Panel→Dialog — عند رفع حجب WEB-S1-004. حارس آلي ضد regression `key={updateId}`/`keepMounted`.
3. **reorder ذري خلفي** (`$transaction` swap أو `POST /phases/reorder` بترتيب كامل) + spec — يقفل non-atomic tie.
4. **error message تفصيلي** (400/409/422/network) على أفعال الـ dialog — LOW، تحسين UX.

**التحقّق المستقل الذي أجريته (rule #8 — literal):**
```
NO_COLOR=1 npx vitest run src/lib/api/updates-client.spec.ts src/lib/api/phases-client.spec.ts src/lib/api/idempotency-key.spec.ts

 ✓ src/lib/api/idempotency-key.spec.ts (9 tests) 9ms
 ✓ src/lib/api/updates-client.spec.ts (5 tests) 10ms
 ✓ src/lib/api/phases-client.spec.ts (2 tests) 7ms

 Test Files  3 passed (3)
      Tests  16 passed (16)
---EXIT:0---
```
+ فحص `reviews/page.tsx` → لا زال `ReviewItem` mock (يؤكّد تأجيل المرحلة 7 الأصلية كما وثّق المخطط).

**لماذا NOTES وليس APPROVED نظيف:** لا مشكلة معمارية أو أمنية حاجبة، لكن دَيْن مرئي للمستخدم (mock في مسار nav حي) + غياب حارس آلي على أهم invariant lifecycle. كلاهما BACKLOG بمالك واضح، لا blocker للـ merge — لكن البند #1 **مُلزِم قبل production**.

🔴 فحص الـ auto-reject: MVT في تقرير المختبر = **5 (لا صفر)** → لا rejection تلقائي. rule #2 محقّقة.

---
✋ تم المراجع (تقرير المهمة) — للـ meta-review؟
