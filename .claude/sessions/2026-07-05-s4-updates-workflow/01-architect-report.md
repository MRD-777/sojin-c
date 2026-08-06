# تقرير المخطط (ما بعد التنفيذ) — S4: Updates Workflow + Review Inbox

## منهجية المراجعة (نفس نهج S3 — الكود الفعلي، مش التقرير)
قرأت الملفات المنفّذة **سطراً بسطر** وحكمت عليها مباشرة، مش على وصف المبرمج:
- `lib/api/idempotency-key.ts` (كامل) — عقد الاستقرار الفعلي.
- `lib/api/updates-client.ts` (كامل) — وصول الـ `Idempotency-Key` header + شكل الـ action returns.
- `lib/hooks/use-update-actions.ts` + `use-phase-updates.ts` + `use-phase-actions.ts` (كامل) — الـ invalidation keys + `retry:false` + صفر optimistic.
- `components/dashboard/updates/update-detail-dialog.tsx` + `reviews-panel.tsx` (كامل) — دورة حياة الـ holder + role gating + states.
- `app/[locale]/dashboard/projects/[id]/page.tsx` (المقاطع المتأثرة: 76, 129–132, 356–402) — تغليف الـ Tabs + تمرير `active`/الأدوار.
- **grep على المستهلكين** (`useOverridePhaseProgress|useReorderPhase|phases-client`) + فحص حالة `projects/reviews/page.tsx`.

**أساس الـ verification:** حكمي على التوافق النوعي بالفحص (كل الـ imports تحل، props الـ base-ui مطابقة، صفر hardcoded query key). الـ literal tsc baseline (5 أخطاء pre-existing) مأخوذ من الـ coder report عبر المراحل 1–5 — **لم أُعِد تشغيل tsc في هذه المرّة** (الـ run اتلغى للانتقال لدور المخطط). لا أدّعي تشغيلاً لم يحدث.

---

## نطاق التنفيذ: **5 من 7 مراحل** — قرار تقليص صريح
الـ plan المعتمد كان **7 مراحل**. الجلسة سلّمت **1–5**؛ المرحلتان 6 و7 **مؤجّلتان**:

| المرحلة | الحالة | الدليل |
|---|---|---|
| 1 types → 5 UI (reviews + dialog) | ✅ منفّذة | الملفات موجودة + مقروءة |
| **6 — UI تحكّم المراحل (override + reorder)** | ⛔ **غير منفّذة** | تبويب "المراحل" (page:362–387) **read-only**؛ لا أزرار override/reorder |
| **7 — rewrite `reviews/page.tsx` → منتقي مشاريع** | ⛔ **غير منفّذة** | الملف لسه mock أصلي (`ReviewItem`, تاريخ Apr 29) — صفر تعديل |

هذا انحراف نطاق **مقبول لكن يجب ألا يكون صامتاً** (قاعدة "ارفع/غيّر النطاق صراحة"). أُقرّه هنا رسمياً: الجلسة أغلقت على 5 مراحل بموافقتك، و6/7 ينتقلان للـ BACKLOG.

### أثر التقليص على الكود — كود مبنيّ بلا مستهلك
المرحلة 4 بنت الـ hooks + الـ client لأفعال المراحل **قبل** UI المرحلة 6. بما أن 6 مؤجّلة:
- `lib/hooks/use-phase-actions.ts` (`useOverridePhaseProgress`, `useReorderPhase`) — **صفر مستهلك** (grep مؤكّد).
- `lib/api/phases-client.ts` (`overridePhaseProgress`, `reorderPhase`) — **صفر مستهلك خارج الـ hook**.

**الحكم على الـ dead exports:** مقبول مؤقتاً، **بشرط توثيقه كـ residual** يُغلق في جلسة المرحلة 6. غير مقبول لو بقي بلا مالك. tsc لا يمسك unused exports، فالخطر إنه يُنسى. → BACKLOG.
معايير النجاح المرتبطة بـ 6/7 (`phase override/reorder مربوطين`, `overallProgress يتحدّث`, منتقي المشاريع) **غير محقّقة في هذه الجلسة** — لا تُعتبر فشلاً، تُعتبر مؤجّلة.

---

## مقارنة Plan vs Reality (المراحل المنفّذة 1–5)

| البند | المخطط (plan) | المنفّذ (الكود) | متطابق؟ |
|---|---|---|---|
| `workHours` على الـ wire | number (draft) | **string** (Decimal 5,2 من `schema.prisma:201`) | ✅ تصحيح مبني على المصدر |
| آلية استقرار المفتاح | closure lazy يـ cache حتى reset | `createIdempotencyKeyHolder` (`idempotency-key.ts:59–70`) — بالضبط | ✅ |
| توليد المفتاح | داخل الـ holder، **مش** في mutationFn | `mutationFn: approveUpdate(id, idempotencyKey)` — المفتاح argument (`use-update-actions.ts:65`) | ✅ |
| header الوصول | `Idempotency-Key` على approve + force-cancel | `headers:{ "Idempotency-Key": key }` (`updates-client.ts:64, 89`) | ✅ |
| invalidation (review) | phase-updates(prefix) + update + project | `use-update-actions.ts:53–57` — الثلاثة بالـ keys المستوردة | ✅ صفر drift |
| invalidation (phase) | project فقط | `use-phase-actions.ts:41–42, 52–53` | ✅ |
| صفر optimistic | معيار نجاح | لا `onMutate`/`setQueryData` في أي mutation | ✅ |
| key-drift بين hook مفرد و`useQueries` | (لم يُذكر صراحة) | `phaseUpdatesQueryOptions` factory كمصدر واحد (`use-phase-updates.ts:22`) مستهلك في `reviews-panel.tsx:57` | ✅ **استباق ذكي** (وافقتَ عليه) |
| role gating | UX فقط | `canReview`/`canForceCancel` من `useMe` (page:130–132) + إخفاء الأزرار (dialog:289, 313) | ✅ |
| MVT budget | 4 specs | الكود المستهدف للـ 4 **موجود وقابل للاختبار** | ✅ budget قائم |

---

## الانحرافات عن الـ Plan (adjudication)

1. **`workHours` number→string** — تصحيح مبني على `schema.prisma` (Decimal). **مقبول ✅** (أمانة للمصدر، مش scope creep).
2. **إضافة `isValidIdempotencyKey` + `getRandomValues` fallback** (`idempotency-key.ts:23, 36`) — الـ validator يربط عقد الـ client بـ `^[A-Za-z0-9_-]{16,64}$` الخاص بالـ backend كمصدر واحد ويدّي الـ MVT paired assertion نظيفة؛ الـ fallback يزيل SPOF مع **throw** بدل degrade صامت. **مقبول ✅** — نفس المسؤولية، صفر سطح جديد على الأفعال.
3. **`Paginated` من `@/types/project` + `UpdateActionResult`/`PhaseActionResult` محلية** — الـ action response الفعلي متباين عن الـ GET selects (`workHours` يصير number في `updates.service.ts:515`)؛ تعريف الحد الأدنى المضمون (`{id,status}`) بدل نسخ الشكل المتباين = أمانة أعلى. **مقبول ✅**.
4. **`phaseUpdatesQueryOptions` factory** — ضروري لمنع key-drift في `useQueries`. **مقبول ✅** (استباق صحيح).
5. **حذف `CardHeader` المكرّر في تبويب المراحل** — تجميلي، صفر تغيير منطقي. **مقبول ✅**.

**كل الانحرافات تصحيحية/تضييقية — صفر scope creep.** لا انحراف زاد سطحاً غير مطلوب.

---

## تقييم أولي: `reason-change-after-failure` (تسليم للهاكر — نقطة تركيزك #2)

### السيناريو
force-cancel على update معتمد: المستخدم يُدخل reason R1 (≥20) ويؤكّد → `cancelKey.current()` يولّد المفتاح **K**. الطلب يفشل (409/500/network). `reset()` **لا يُنادى** (يحدث في `onSuccess` فقط) فـ K يبقى مخزّناً. المستخدم يعدّل الـ reason إلى R2 ويعيد التأكيد → `current()` يرجّع **نفس K**، لكن الـ body تغيّر → الـ backend fingerprint(K) مربوط بـ R1 → **422** (مفتاح مطابق، بيانات مختلفة).

### تقييم الخطورة الأوّلي: **LOW — liveness/UX، مش safety**
سبب التصنيف المنخفض (تبرير threat-model، مش تهوين):
- **الـ 422 هو الناتج الآمن الصحيح.** الـ fingerprint guard بيعمل وظيفته بالظبط: يمنع إعادة استخدام مفتاح ببيانات مختلفة. **صفر double-apply، صفر double-charge (SUNK_COST)، صفر state corruption.**
- **لا مسار تصعيد.** الـ 422 حرمان للمستخدم من فعله هو، مش bypass ولا IDOR ولا privilege. المفتاح client-local في `useRef` per-dialog-instance — لا يمكن حقنه على ضحية.
- **مسار الـ retry الشائع سليم:** لو الفشل عابر و الـ reason **لم يتغيّر**، إعادة التأكيد بنفس K = **idempotent replay صحيح** (الـ backend يكمل أو يرجّع الكاش). الحافة تخصّ **فقط** "تعديل الـ reason بعد فشل".
- **يوجد escape hatch فعلي:** إغلاق + إعادة فتح نفس الـ update يـ trigger الـ `useEffect([updateId])` (dialog:104–109) فيـ reset الـ holders → مفتاح جديد. **تحقّقت من هذا المسار** (updateId يمرّ null→id).

### الفجوة الحقيقية (للهاكر يقرّر)
الـ escape hatch **غير مكتشَف من المستخدم**: بعد الـ 422 الرسالة تبقى generic ("فشل تنفيذ الإجراء، حاول مجدداً" — dialog:280) بلا توجيه إن الـ reason المعدّل يحتاج dialog جديد → **422-loop صامت**. هذه liveness، مش security.

### القرار المعماري المطروح على الهاكر (paired ضد الـ threat model)
الاختيار بين تصميمين **قرار أمني** (يغيّر سطح الـ replay)، ولهذا كان **تسليمه للهاكر بدل حلّه ارتجالياً هو الصح** (المبرمج توقّف عند حدّه الصحيح — نقطة أمنية = خارج صلاحية الارتجال):
- **الخيار أ — reset المفتاح عند تغيير الـ reason:** يجعل "تعديل + إعادة" يعمل مباشرة. يوسّع سطح الـ replay شكلياً، **لكن الخطر مُقيَّد بـ state machine**: force-cancel هو APPROVED→FORCE_CANCELLED أحادي الاتجاه؛ فعل ثانٍ على update صار FORCE_CANCELLED يرفضه الـ status guard بصرف النظر عن المفتاح. الهاكر يتحقّق من هذا الحدّ في الـ backend.
- **الخيار ب — الوضع الحالي (مفتاح ثابت حتى النجاح/reset):** آمن، لكن يتطلب تحسين UX (عند 422: reset المفتاح تلقائياً + رسالة محدّدة توجّه لإعادة الإدخال) بدل الـ generic message.

**توصيتي للهاكر:** ثبّت أولاً بالـ backend أن `force-cancel` على update غير-APPROVED مرفوض دائماً (يحدّد سقف خطر الخيار أ)، ثم قرّر أ vs ب. أياً كان القرار، الفجوة الحالية = **UX LOW**، ليست CVE. **إعادة اختبار (rule #5):** أي spec جديد يُكتب لهذه الحافة يجب أن يُهاجَم ضد نفس نمط "مفتاح ثابت + بيانات متغيّرة".

---

## تقييم المعمارية (المراحل المنفّذة)

**نقاط قوة:**
- **الـ holder هو الأعمق (rule #4):** العقد "**نفس المفتاح بالضبط** ثابت عبر إعادة الاستدعاء" مفصول في module نقي قابل للاختبار node-env — بالضبط ما يحتاجه الـ MVT-4، ويلتفّ على حجب infra للـ hook render tests (WEB-S1-004).
- **صفر hardcoded query key:** كل الـ keys مستوردة من مصدرها (`PHASE_UPDATES_QUERY_KEY`, `updateQueryKey`, `projectQueryKey`)؛ prefix-invalidation `[...KEY, phaseId]` يطابق كل الـ status objects — صفر drift بين المفرد والمجمّع.
- **الـ `active` gating صحيح** (`enabled: active` في الـ factory) — base-ui `Tabs.Panel` يبقى mounted، فالـ `enabled` هو الرافعة الصحيحة لمنع over-fetch (page:395).
- **throw بدل weak-key** على غياب Web Crypto — رفض degrade صامت على فعل مالي.

**ملاحظات/nits (غير حاجبة):**
- **`useRef(createIdempotencyKeyHolder())`** (dialog:97–98) ينشئ holder جديداً على **كل render** ويُهمله (سلوك useRef الموثّق). غير ضار (closures صغيرة تُجمَع GC) لكن الأنسب `useRef<…>(null)` + lazy، أو `useState(() => …)`. **nit، مش defect.**
- **الـ dead exports** (phase-actions/phases-client) — راجع قسم التقليص؛ residual مؤقت.
- الـ `active` isLoading يستخدم `r.isLoading && r.isFetching` (panel:61) — يتجنّب وميض loading على cached data؛ سليم لكن يستحق spec خفيف من المختبر إن أراد.

---

## حاجات محتاجة تتعمل في sessions قادمة (→ BACKLOG)
1. **المرحلة 6** — UI تحكّم المراحل (override progress + reorder) يستهلك الـ hooks الموجودة. يغلق الـ dead exports.
2. **المرحلة 7** — rewrite `projects/reviews/page.tsx` → منتقي مشاريع (لسه mock).
3. **`reason-change-after-failure`** — بعد قرار الهاكر (أ/ب): تحسين UX عند 422 (reset + رسالة موجّهة).
4. **hook-level render tests** لدورة حياة الـ holder داخل `useRef` — محجوبة بـ WEB-S1-004؛ حالياً مغطّاة algorithmically (MVT-4).

> ملاحظة إجرائية: البنود 1–4 يجب أن تُكتب في `.claude/sessions/BACKLOG.md` (لكن **ليس في هذا الرد** — قاعدة ملف-واحد-لكل-دور). أوصي بتحديث الـ BACKLOG بعد إغلاق الجلسة.

---

## الحكم

⚠️ **في انحرافات مقبولة + نطاق مقلَّص صراحة (5/7 مراحل).**

- المراحل المنفّذة **1–5 متوافقة معمارياً مع الـ Plan**؛ كل الانحرافات الخمسة تصحيحية/تضييقية بلا scope creep.
- عقد الـ Idempotency (holder → argument → header → stable-across-retry) **منفّذ صحيحاً بالفحص** ومطابق للـ backend regex.
- المرحلتان 6/7 مؤجّلتان صراحةً؛ الـ dead exports مقبولة كـ residual موثّق **بشرط** إغلاقها في جلسة المرحلة 6.
- الـ `reason-change-after-failure`: تقييم أوّلي **LOW (liveness، مش safety)**؛ تسليمه للهاكر كان القرار الصح لأنه قرار سطح-replay أمني، لا ارتجال المبرمج.
- **لا مشاكل معمارية حاجبة.** الـ session يكمل للهاكر.

**للهاكر (المطلوب صراحةً):** ابدأ من `reason-change-after-failure` — ثبّت سقف خطر الخيار أ عبر الـ backend status guard على force-cancel، وقيّم أ vs ب. لا تعتبر الـ 422 ثغرة بذاتها؛ الفجوة UX.

---
✋ تم المخطط (ما بعد التنفيذ) — للدور التالي (🔴 الهاكر)؟

---
---

# تقرير المخطط — Stage 2 (NEEDS-CODER return، rule #9)

> section **جديد** (لا overwrite للـ Stage 1). المطلوب من rule #9: مقارنة **Hacker Proposal vs Reality** (مش Plan vs Reality) + إقرار MVT budget الجديد قبل المختبر. راجعت **الكود الفعلي** بعد نقل الـ holders (الملفات الثلاثة + `tabs.tsx` + مصدر base-ui)، مش تقرير المبرمج فقط.

## Hacker Proposal (ATT-2) vs Reality (`keepMounted=false`)

| المحور | Hacker Proposal (ATT-2) | Reality (بالمصدر) | الحكم |
|---|---|---|---|
| فرضية الأساس | "`UpdateDetailDialog` **دائم mounting** في `reviews-panel:163` (غير مشروط) → الـ holder في `useRef` آمن" | الـ dialog داخل `TabsContent` = `TabsPrimitive.Panel` **بدون `keepMounted`** (`tabs.tsx:72`)؛ base-ui default `keepMounted=false` (`TabsPanel.js:37`)، `if (hidden && !keepMounted) return null` (`:99`) | ❌ **الفرضية ساقطة** — "غير مشروط داخل الـ panel" لا يعني دائم؛ الـ panel نفسه يُفصَل |
| نتيجة تبديل التبويب | (غير مُقيَّم) | phases↔reviews → `ReviewsPanel` + الـ dialog + الـ holders **تُدمَّر وتُعاد** | الفرضية أغفلت طبقة الـ Tabs |
| التوصية | "لا تضف `key={updateId}`" (حارس ضد remount **داخل** بقاء الـ dialog) | الحارس صحيح لكنه **جزئي** — لا يغطّي unmount الـ panel الأعلى | ⚠️ ناقص، مش خاطئ |
| التصنيف | FIXED-BY-HACKER (reason-change reset فقط) | الجذر **معماري** (مكان الـ holder) → يستلزم coder | ✅ إعادة التصنيف لـ NEEDS-CODER صحيحة |

**الحكم على الهاكر (لا يُلغي قيمته):** الهاكر أنتج CVE-S4-001 الحقيقي وأصلح البُعد السطحي (reason-change) بدقّة، **لكن** بنى تقييم ATT-2 على ادعاء المرحلة 5 غير المُتحقَّق ("الـ Panel يبقى mounted") بدل قراءة مصدر base-ui. الدرس (للـ meta-review): **ادعاء mounting = يُتحقَّق من المصدر، لا يُورَث من تقرير سابق.** اكتشاف المبرمج لـ `keepMounted=false` كان أقوى validation ممكن لأنه **يقلب الفرضية** لا يؤكّدها.

## تقييم إصلاح المرحلة 6 (الكود الفعلي)

| البند | التقييم |
|---|---|
| اختيار "page-owned + props" | ✅ **الأأمن** — عمر المفتاح مفصول عن mount كل child؛ محصّن حتى لو أُضيف `key={updateId}` لاحقاً (يُبطل قلق ATT-2 من جذره، لا يتحايل عليه) |
| `useState(() => createIdempotencyKeyHolder())` | ✅ lazy init — **يصلح ضمناً nit الـ eager-alloc** (Stage 1) بعمر = عمر الـ page |
| فصل الملكية | ✅ نظيف: `openUpdate` (فتح) → panel؛ `onSuccess` (نجاح) → dialog. كل انتقال openId→non-null يمر عبر `openUpdate` (reset مضمون) — تحقّقت: setOpenId المباشر الوحيد المتبقّي هو `onClose→null` (لا يستخدم مفتاح) |
| حذف `useEffect` holder-reset من الـ dialog | ✅ مبرَّر — الملكية انتقلت؛ الـ effect بقى UI-state فقط. صفر ازدواج ownership |
| نظافة الـ imports | ✅ `useRef` مُزال، `import type { IdempotencyKeyHolder }` — tsc نظيف (لو noUnusedLocals فعّال كان سمك `useRef` الزائد) |

**الانحراف الوحيد:** إبقاء سطر `reason-change reset` (onChange) مؤقتاً بشكل الـ prop. **قراري:** **يبقى** — حذفه ثم إعادته في المرحلة 7 = churn بلا قيمة، والسطر آمن ومُوثّق. المرحلة 7 تتحوّل من "تنفيذ" إلى **"formalize + MVT + توثيق قرار (ب)"**. مقبول ✅.

## Plan vs Reality — تحديث النطاق
النطاق الآن **8 مراحل** (لا 7): 1–5 (منفّذة) + 6 (CVE-S4-001 holder relocation، منفّذة) + 7 (reason-change formalize، مؤجّلة) + 8 (progress override + reorder UI = المرحلة 6 الأصلية في الـ plan، مؤجّلة). البند "dead exports" (`use-phase-actions`/`phases-client`) من Stage 1 **يُغلق في المرحلة 8**.

## إقرار الـ MVT budget الجديد (إجباري قبل المختبر — rule #9)

الـ 4 MVT الأصلية **قائمة بلا تغيير** (طبقات client/hooks/holder لم تُمَس في المرحلة 6). أُقرّ الـ budget الجديد صراحةً:

**MVT قابلة للكتابة node-env = 5** (المختبر مُلزَم بها):
- **MVT-1** `updates-client.spec` — method/URL/body لكل فعل + **paired:** المفتاح الممرَّر === `seen.headers["Idempotency-Key"]` على approve & force-cancel.
- **MVT-2** `phases-client.spec` — progress/reorder body+URL.
- **MVT-3** `idempotency-key.spec` (أ) — `generateIdempotencyKey` يطابق `^[A-Za-z0-9_-]{16,64}$` + قيم متمايزة + **throw** عند غياب Web Crypto.
- **MVT-4** `idempotency-key.spec` (ب — الأعمق، rule #4): **الاستقرار** — `current()` × N بلا reset = **نفس** المفتاح (ضمان double-click/retry).
- **MVT-5 (جديد، CVE-S4-001 — rule #5):** `idempotency-key.spec` (ج): **النضارة على النية الجديدة** — `K1 = current()` → `reset()` → `K2 = current()` مع `K1 ≠ K2`؛ **ومقترناً** بإعادة تأكيد الاستقرار (بدون reset بينهما = نفس المفتاح). ده يثبت النمط اللي يقفله CVE-S4-001: "reason معدّل = مفتاح جديد، نفس النية = replay". **rule #5:** الـ spec الجديد يُهاجَم ضد نفس نمط "مفتاح ثابت + بيانات متغيّرة" (لا يجوز أن يجعل المفتاح دائم النضارة — يكسر الـ idempotency).

**assertion موثّقة (infra-blocked، غير محتسبة — WEB-S1-004):**
- **holder ownership:** "الـ holder مملوك للـ page ويبقى عبر unmount/remount للـ dialog/panel" هو سلوك **mount/render** محجوب بـ WEB-S1-004 → **لا spec node-env**. يُوثَّق في تقرير المختبر كـ checklist مع الإحالة لـ verification عبر **code review + tsc** (props threading page→panel→dialog) + اكتشاف `keepMounted=false`. **ليس بديلاً عن MVT-5.**

**الحد الأدنى المُقرّ: 5 specs مكتوبة وpassing** (كان 4؛ +1 لـ CVE-S4-001). أقل من 5 → المراجع الأعلى يرفض (rule #2). الـ reason-change component wiring (onChange→reset) يُتحقَّق code-review + tsc، لا node spec (component render محجوب).

## الحكم — Stage 2
⚠️ **انحراف مقبول (reason-change carry-over) + إصلاح معماري سليم.**
- إعادة تصنيف CVE-S4-001 لـ NEEDS-CODER **صحيحة**؛ الجذر كان مكان الـ holder، لا الـ onChange.
- إصلاح المرحلة 6 (page-owned) **الأأمن** من خيارات المستخدم، ويصلح nit الـ eager-alloc ضمناً.
- الـ MVT budget الجديد **= 5 مُقرّ صراحةً** + 1 assertion موثّقة (infra-blocked). المختبر مُصرَّح له بالبدء **بعد** المرحلتين 7 و8 (النطاق لسه مفتوح) — أو، لو المستخدم أغلق النطاق عند 6، يبدأ المختبر على الـ 5 الآن.
- **لا مشاكل معمارية حاجبة.** الجلسة تكمل (للمرحلة 7، ثم 8، ثم المختبر).

✋ تم المخطط Stage 2 — للدور التالي (المبرمج: المرحلة 7)؟

---
---

# تقرير المخطط — Stage 2 (تكملة): إقرار المرحلتين 7 و8

> section **جديد** (لا overwrite). بعد تسليم المبرمج للمرحلتين 7 (formalize قرار ب) و8 (progress override + reorder UI). راجعت **الكود الفعلي**: `components/dashboard/projects/phase-admin-controls.tsx` (كامل) + مقاطع `page.tsx` المعدّلة (import، `canManagePhases`، حقن الأدوات بالجارين)، وتحقّقت من ادعاءات المبرمج **بالمصدر مباشرةً** (`phases/dto/index.ts`, `phases.service.ts`, `phases.controller.ts`) لا من تقريره.

## 1. إقرار reorder = swap — انحراف من **المصدر** لا من الهاكر

**التحقّق المستقل (قرأت المصدر بنفسي، مش نقلت عن المبرمج):**
| الادعاء | المصدر | صحيح؟ |
|---|---|---|
| `order` عدد صحيح مُقيَّد | `ReorderPhaseDto`: `@IsInt() @Min(0) @Max(1000)` (`dto/index.ts`) | ✅ |
| الـ orders تُولَّد متتالية | `order = (maxPhase?.order ?? -1) + 1` (`phases.service.ts:124`) → `0,1,2,3…` | ✅ |
| الـ reorder = SET مفرد لا swap ذري | `data: { order: dto.order }` (`phases.service.ts:286`) — كتابة عمود واحد لصف واحد | ✅ |
| الدور | `@Roles('SUPER_ADMIN','PROJECT_MANAGER')` على progress + reorder (`controller.ts:74,86`) | ✅ مطابق لـ `canManagePhases` |

**الحكم:** الـ plan (المرحلة 6 الأصلية، سطر 79) وصف الـ reorder كـ **"single set — الـ UI يحسب order بين الجارين"**. هذا الوصف **غير قابل للتحقيق على المصدر الفعلي**: بين عددين صحيحين متتاليين (`n`, `n+1`) **لا توجد قيمة صحيحة ثالثة**، فأي single-set لا يُنتج نقلاً مرئياً موثوقاً. حلّ المبرمج — **swap بكتابتين متسلسلتين** (المرحلة تأخذ `order` الجار، ثم الجار يأخذ `order` المرحلة، بقيم مُلتقطة من render) — هو **التنفيذ الصحيح الوحيد** الذي يعمل فعلاً.

- **التصنيف:** انحراف **تصحيحي مبني على المصدر** — **نظير تام لتصحيح `workHours` (number→string) في المرحلة 1**. ليس ارتجالاً، وليس استجابةً لاقتراح هاكر (يُميَّز عن CVE-S4-001 الذي كان hacker-originated). المبرمج اكتشف تعارض الـ plan مع الـ schema وحلّه بالحلّ الأعمق. **مقبول ✅.**
- **صفر توسّع سطح:** نفس الـ hook (`useReorderPhase`)، نفس الـ endpoint، نفس الـ DTO. الاختلاف كتابتان بدل واحدة على مستوى المستهلك فقط.
- **المكوّن في مجلد جديد `components/dashboard/projects/`** (انحراف #2 للمبرمج): فصل دلالي (phases ≠ updates)، صفر سطح جديد. **مقبول ✅.**

## 2. إقرار الـ MVT budget النهائي

الـ **5 specs الأصلية قائمة بلا تغيير** (المرحلة 8 لم تمسّ طبقة الـ client/holder — `phases-client.ts` كما هي):

| # | Spec | يغطّي | node-env؟ |
|---|---|---|---|
| MVT-1 | `updates-client.spec` | method/URL/body لكل فعل + **paired** المفتاح===header | ✅ محتسب |
| MVT-2 | `phases-client.spec` | **progress + reorder body+URL** — يغطّي عقد المرحلة 8 على مستوى الـ transport | ✅ محتسب |
| MVT-3 | `idempotency-key.spec` (أ) | regex + تمايز + throw | ✅ محتسب |
| MVT-4 | `idempotency-key.spec` (ب) | استقرار المفتاح (double-click/retry) | ✅ محتسب |
| MVT-5 | `idempotency-key.spec` (ج) | النضارة على النية الجديدة (CVE-S4-001 / قرار ب — reset≠stable) | ✅ محتسب |

**holder ownership assertion (المرحلة 6/8):** "الـ holder مملوك للـ page ويبقى عبر unmount/remount للـ dialog/panel" — سلوك **mount/render** محجوب بـ **WEB-S1-004** → **يُوثَّق في تقرير المختبر كـ checklist** (verification عبر code-review + tsc على props threading page→panel→dialog + اكتشاف `keepMounted=false`)، **وليس spec محتسباً ولا بديلاً عن MVT-5**.

**المرحلة 8 لا تُضيف MVT محتسباً جديداً — وهذا مقصود ومبرَّر:**
- عقد الـ client (progress/reorder body+URL) **مغطّى بالفعل بـ MVT-2**.
- سلوك الـ **swap بكتابتين** = سلوك مكوّن (سلسلة `mutate → onSuccess → mutate`) — يُتحقَّق code-review + tsc (render محجوب WEB-S1-004).
- منطق تحقّق الـ override (`progressValid`/`reasonValid`) inline في المكوّن (render-bound) — checklist لا spec.

**الحد الأدنى المُقرّ نهائياً: 5 specs مكتوبة وpassing** + 1 assertion موثّقة (holder ownership، infra-blocked). أقل من 5 → رفض المراجع الأعلى (rule #2).

## 3. ملاحظة على non-atomic swap (tie risk) → BACKLOG

الـ swap كتابتان PATCH **غير ذريتين**. مخاطر يجب توثيقها:
- **فشل جزئي:** لو نجحت الكتابة الأولى (المرحلة تأخذ `order` الجار) وفشلت الثانية → **المرحلتان تتشاركان نفس الـ order** → tie غير مستقر تحت `orderBy: order asc` (الترتيب حينها DB-defined). يُحلّ بأي reorder/reload تالٍ، لكنه state متضارب مؤقت.
- **نافذة refetch متداخلة:** كل `useReorderPhase.onSuccess` يـ invalidate `projectQueryKey` → refetch. بين الكتابتين قد يهبط refetch على الحالة المكرّرة (transient duplicate) فيومض الترتيب.
- **الخطورة:** 🟢 **LOW** — لا double-apply ولا فساد مالي (reorder لا يمسّ progress/payments)؛ الأثر تجميلي/liveness (ترتيب عرض). لكنه **correctness gap حقيقي يستحق ticket** لأن tsc لا يمسكه ولا يوجد spec يغطّيه.
- **التوصية (→ BACKLOG):** **endpoint reorder ذري على الـ backend** — إمّا `$transaction` يبدّل قيمتَي order لصفّين، أو `POST /projects/:id/phases/reorder` يستقبل ترتيباً كاملاً `[phaseId…]` ويكتبه في transaction واحدة. حتى ذلك الحين، الـ swap بكتابتين مقبول كـ **residual موثّق** (يطابق سياسة dead-exports في Stage 1).

## الحكم — Stage 2 (تكملة)
⚠️ **انحرافان مقبولان (reorder=swap مصدري + مجلد جديد) + residual موثّق (non-atomic swap).**
- **reorder=swap:** انحراف تصحيحي مبني على المصدر (Int schema)، نظير `workHours` م.1 — **ليس** hacker-originated. **مُقَرّ ✅.**
- **المرحلة 7 (formalize قرار ب):** مكتملة كوداً وتقريراً؛ عقدها مغطّى بـ MVT-5. **مُقَرّة ✅.**
- **MVT budget النهائي = 5 محتسبة** + holder-ownership assertion موثّقة (infra-blocked). المرحلة 8 لا تُضيف MVT محتسباً (MVT-2 يغطّي العقد). **مُقَرّ صراحةً ✅.**
- **non-atomic swap tie risk:** LOW، residual موثّق، **→ BACKLOG ticket** (reorder ذري خلفي). لا يحجب الجلسة.
- النطاق الآن **8/8 مراحل منفّذة**؛ الـ dead exports (Stage 1) **أُغلقت** بالمرحلة 8 (`use-phase-actions`/`phases-client` صار لهما مستهلك).
- **لا مشاكل معمارية حاجبة.** المختبر مُصرَّح له بالبدء على الـ 5 MVT.

✋ تم المخطط Stage 2 — للمختبر؟
