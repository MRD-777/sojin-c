# Scope — S4: Updates Workflow + Review Inbox + Phases

## Mode: Deep
السبب: الموديول ده بيمس **state machine مالية حسّاسة** (DRAFT→PENDING→APPROVED→FORCE_CANCELLED)، والـ `force-cancel` بيولّد Payment نوع `SUNK_COST` (تأثير مالي فعلي)، والـ `approve`/`force-cancel` محتاجين `Idempotency-Key` header مولّد من الـ client ومستقر عبر الـ retries. أي غلطة في الـ idempotency أو في افتراضات الـ state machine على الـ client = double-apply للتقدم أو للمدفوعات. ده بالظبط نوع الشغل اللي rule (Deep = auth/payments/money-moving) بيفرضه.

---

## المهمة
ربط **المجموعة 1.5–1.7** من `PAGE_WIRING_TRACKER.md` بالـ backend الحقيقي:
- **1.5 Review Inbox** (`dashboard/projects/reviews/page.tsx`) — عرض التحديثات المعلّقة (PENDING) + إجراءات المراجعة (approve/reject).
- **1.7 Updates lifecycle** — أفعال الـ state machine الخاصة بالمراجعة: `submit` (DRAFT→PENDING)، `approve` (PENDING→APPROVED، idempotent)، `reject` (PENDING→REJECTED)، `force-cancel` (APPROVED→FORCE_CANCELLED، idempotent، SUNK_COST).
- **1.6 Phases** (داخل project detail) — `progress` override + `reorder`.

الـ pattern متبع من S3 بالحرف: طبقة `*-client.ts` رفيعة فوق الـ generic `client` (unwrap للـ envelope) → React Query hooks → UI. صفر تعديل على `client.ts`/auth (نفس نهج S3).

---

## الملفات المتأثرة

### جديدة (data plane + hooks)
- `apps/web/src/types/update.ts` — أنواع web-local مشتقّة حرفياً من response shapes للـ Updates + Phase mutations (UPPERCASE enums على الـ wire، Decimal→string، dates→ISO). نفس عقيدة `types/project.ts`.
- `apps/web/src/lib/api/updates-client.ts` — دوال async رفيعة: `listPhaseUpdates`, `getUpdate`, `submitUpdate`, `approveUpdate`, `rejectUpdate`, `forceCancelUpdate`.
- `apps/web/src/lib/api/phases-client.ts` — `listProjectPhases`, `overridePhaseProgress`, `reorderPhase`.
- `apps/web/src/lib/api/idempotency-key.ts` — مولّد مفتاح idempotency (16–64 char، `crypto.randomUUID()`) + عقد استقراره عبر الـ retry. **نقطة حسّاسة #1.**
- `apps/web/src/lib/hooks/use-phase-updates.ts` — `usePhaseUpdates(phaseId, status?)` (query).
- `apps/web/src/lib/hooks/use-update.ts` — `useUpdate(id)` (query، detail).
- `apps/web/src/lib/hooks/use-update-actions.ts` — mutations: `useSubmitUpdate`, `useApproveUpdate`, `useRejectUpdate`, `useForceCancelUpdate` (الأخيرين بيحقنوا Idempotency-Key، `retry:false` على money-moving).
- `apps/web/src/lib/hooks/use-phase-actions.ts` — `useOverridePhaseProgress`, `useReorderPhase`.

### معدّلة (UI wiring)
- `apps/web/src/app/[locale]/dashboard/projects/reviews/page.tsx` — استبدال الـ mock بالبيانات الحقيقية + أفعال approve/reject. **نقطة حسّاسة #2:** الـ backend مفيهوش endpoint عالمي للـ PENDING عبر المشاريع — بس `GET /phases/:phaseId/updates`. لازم قرار aggregation (تحت في "نقاط القرار").
- `apps/web/src/app/[locale]/dashboard/projects/[id]/page.tsx` — إضافة controls للـ phases (progress override + reorder) في Section 4 الموجود (مراحل). تعديل موضعي، مش إعادة كتابة.

### specs جديدة (MVT)
- `apps/web/src/lib/api/updates-client.spec.ts`
- `apps/web/src/lib/api/phases-client.spec.ts`
- `apps/web/src/lib/api/idempotency-key.spec.ts`
- (احتمال) spec على مستوى hook للـ idempotency-key stability عبر الـ retry.

---

## الـ Services / الوحدات + coverage budget (rule #6)
كل وحدة data-plane تتذكر باسمها + الحد الأدنى من التغطية:

| الوحدة | Budget |
|---|---|
| `updates-client.ts` (list/get/submit/approve/reject/force-cancel) | **≥1 spec** — envelope unwrap + الأفعال بتوصل الـ wire بالـ method/URL الصح، والـ Idempotency-Key header بيتبعت على approve+force-cancel |
| `phases-client.ts` (progress/reorder) | **≥1 spec** — body + URL params يوصلوا صح |
| `idempotency-key.ts` | **≥1 spec** — الطول 16–64، شكل صالح، **واستقرار المفتاح عبر إعادة نفس الـ mutation** (paired assertion، rule #4 — الـ deepest: المفتاح نفسه مش بس charset) |
| `use-update-actions.ts` (approve/force-cancel) | **≥1 spec** — idempotency-key ثابت عبر الـ retry ومش بيتولّد تاني على re-render |
| `useOverridePhaseProgress` / `useReorderPhase` | deferred-if-costly → على الأقل الـ client-layer spec يغطّيهم (مذكورين في phases-client budget) |

MVT النهائي يتحدّد في `00-plan.md` (المخطط) — الحد الأدنى: 1 spec لكل fix + 1 لكل CVE-FIXED-BY-HACKER + 1 لكل idempotency-key contract.

## الـ Skills المستخدمة
- قراءة `node_modules/next/dist/docs/` قبل أي كود (توجيه `apps/web/AGENTS.md` — النسخة دي من Next فيها breaking changes).
- `BACKEND_REFERENCE_02_projects_phases_updates.md` (القسمين 2 + 3) كمصدر وحيد لعقود الـ Updates/Phases.

## Hacker mode (rule #7)
**attack-and-fix** (default). سطح الهجوم الجديد المتوقّع (client-side فوق backend مُصلَّد):
- استقرار الـ Idempotency-Key عبر الـ React Query retry / double-click / re-render (لو اتولّد تاني كل render → الـ backend هيشوفه كـ request جديد → double-apply محتمل للتقدم/الـ SUNK_COST).
- افتراضات الـ state machine على الـ client (زر approve يظهر على حالة مش PENDING، force-cancel على مش APPROVED) — الـ backend بيرفض بـ 409/400، لكن الـ UI لازم ما يوعدش المستخدم بغير الواقع.
- optimistic UI على أفعال بتحرّك فلوس — ممنوع optimistic على approve/force-cancel (لازم نستنى تأكيد الـ server).
- Review Inbox aggregation: تسريب cross-tenant/cross-project عبر phaseIds مخمّنة (الـ backend `ensureProjectAccess` بيحرس — نتأكد إن الـ client مابيفترضش وصول).

## الحدود (خارج نطاق هذا الـ session)
- **تأليف التحديث (create DRAFT + edit DRAFT)** — الفورم الكبير (materials array، workHours، cost) → session تابعة. الـ `submit` مدرج هنا كـ فعل state-machine، لكن UI تأليف المسودة نفسها مؤجّل. (لو الـ submit UI محتاج مسودة موجودة أصلاً — المخطط يقرر يشمل entry-point بسيط أو يؤجّل الفعل كله.)
- **edit-approved (نافذة 24 ساعة) + versions history** → session تابعة.
- **Media upload/view على التحديثات** → S8 (attack surface منفصل).
- **Comments على التحديثات** → S9.
- **تعديل `client.ts`/auth** — صفر تعديل (نفس ضمانة S3). لو احتجنا header لكل-request → يتحقن على مستوى الـ call مش الـ instance.
- **R-1..R-4 residuals** (S2) — مش بيتقفلوا هنا؛ S4 مابيمسّش `client.ts`. لكن أي فعل بيقرأ data ثقيلة بيزيد إلحاح R-1 (موثّق، مش blocker لـ S4).
- **CreatePhase / DeletePhase** — خارج النطاق (1.6 محدّد بـ progress/reorder بس).

## نقاط القرار (للمخطط)
1. **Review Inbox aggregation:** مفيش endpoint عالمي للـ PENDING. الخيارات: (أ) Review Inbox مربوط بمشروع واحد (تختار مشروع → phases بتاعته → PENDING لكل phase)؛ (ب) aggregation عام عبر كل المشاريع (N+M calls، ثقيل)؛ (ج) scope أضيق: تبويب داخل project detail. **توصية مبدئية: (أ) أو (ج)** لتفادي N+M والـ over-fetch. المخطط يحسم.
2. **Idempotency-Key strategy:** مولّد مرة واحدة لكل نيّة مستخدم (عند فتح الـ dialog / أول click) ومحفوظ في ref/state لحد ما الـ mutation تنجح، مش متولّد في الـ mutationFn (اللي بيتنده كل retry). لازم spec يثبت الاستقرار.
3. **مدى شمول force-cancel في الـ UI:** فعل نادر وخطير (SUPER_ADMIN فقط، SUNK_COST). المخطط يقرر entry-point (على update معتمد داخل detail) + confirmation إجباري بالـ reason (≥20 حرف backend).

## تعريف النجاح
- [ ] Review Inbox بيعرض PENDING حقيقي (loading/empty/error states) + approve/reject شغّالين end-to-end.
- [ ] approve + force-cancel بيبعتوا `Idempotency-Key` صالح **ومستقر عبر الـ retry**.
- [ ] Phases progress-override + reorder مربوطين في project detail مع recalc بيظهر بعد invalidation.
- [ ] صفر optimistic update على أي فعل بيحرّك فلوس.
- [ ] صفر تعديل على `client.ts`/auth؛ صفر خطأ tsc جديد.
- [ ] MVT: العدد النهائي يتحدّد في الـ plan (الحد الأدنى: idempotency-key stability + كل client fix).

---
⏸️ AWAITING APPROVAL — رد بـ "approve" للبداية (المخطط → 00-plan.md).

✋ تم Scope — للدور التالي (🧠 المخطط)؟
