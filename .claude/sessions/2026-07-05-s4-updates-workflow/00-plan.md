# خطة التنفيذ — S4: Updates Workflow + Review Inbox + Phases

## المشكلة
ثلاث قدرات مربوطة بالـ mock ومحتاجة backend حقيقي (المجموعة 1.5–1.7):
1. **Review Inbox** — مراجعة التحديثات المعلّقة (PENDING) واعتمادها/رفضها.
2. **Updates lifecycle (review side)** — `approve` (idempotent)، `reject`، `force-cancel` (idempotent + SUNK_COST).
3. **Phases** — `progress` override + `reorder` داخل project detail.

الحسّاسية: `approve`/`force-cancel` بيحرّكوا تقدّم ومدفوعات، ومحميين بـ `Idempotency-Key` من الـ **client**. لو المفتاح اتولّد تاني على كل render/retry → الـ backend يشوفه request جديد → double-apply للتقدّم أو تكرار الـ SUNK_COST payment.

## التحليل (root cause / لماذا الآن)
- الـ backend مُصلَّد بالكامل (Serializable + in-tx re-read + idempotency store). **الثغرة الوحيدة المتبقّية client-side: استقرار مفتاح الـ idempotency.** ده جوهر Deep mode هنا.
- **لا يوجد endpoint عالمي للـ PENDING** — فقط `GET /phases/:phaseId/updates`. القرار (المعتمد من المستخدم): Review Inbox = **تبويب داخل project detail** يجمّع PENDING عبر مراحل المشروع الواحد (bounded aggregation)، مش aggregation عام (N+M).
- project detail بيرجّع `phases[]` بالفعل → مصدر jثابت لـ phaseIds؛ **مش محتاجين `listProjectPhases`** (تقليل سطح).

---

## الحل المقترح (مراحل)

### المرحلة 1: الأنواع — `types/update.ts`
مشتقّة **حرفياً** من الـ selects المؤكّدة (`updates.service.ts:115-172`)، نفس عقيدة `types/project.ts`.
- `UpdateStatus = "DRAFT"|"PENDING"|"APPROVED"|"REJECTED"|"FORCE_CANCELLED"`.
- `MaterialUsed { name, quantity, unit, cost }`.
- `UpdateListItem` — من list select: `id,title,description,workDone,workersCount,workHours,cost(string),progressIncrement,status,rejectionReason,isLocked,submittedAt,reviewedAt,createdAt` + `submitter{id,name,role,avatar}` + `reviewer{id,name}|null` + `_count{media,comments}`.
- `UpdateDetail` — من `include`: كل أعمدة `Update` (تشمل `workRemaining,materialsUsed,forceCancelReason,lockedAt,submittedBy,reviewedBy,forceCancelledBy,updatedAt`) + `phase{id,name,projectId,project{id,companyId,name,clientId}}` + `submitter` + `reviewer` + `media[]` + `comments[]`. **الـ Risk:** الـ include بيرجّع كل الأعمدة — المبرمج يـ cross-check مقابل Prisma `Update` model قبل ما يثبّت الحقول (مايخمّنش).
- `RejectUpdateBody { reason: string }` (10–1000)، `ForceCancelBody { reason: string }` (20–2000).
- `OverrideProgressBody { progress: number; reason: string }` (0–100 / 20–2000)، `ReorderPhaseBody { order: number }` (0–1000).
- Decimal→string، dates→ISO، Int→number (نفس ملاحظات project.ts).
- **Risks:** casing (UPPERCASE على الـ wire) — نفس قرار S3 (web-local literal unions، مش shared-types).

### المرحلة 2: مولّد + حامل مفتاح الـ Idempotency — `lib/api/idempotency-key.ts`
- `generateIdempotencyKey(): string` → `crypto.randomUUID()` (36 حرف، صالح مقابل `^[A-Za-z0-9_-]{16,64}$`).
- `createIdempotencyKeyHolder(): { current(): string; reset(): void }` — closure بيولّد المفتاح **مرة واحدة (lazy)** ويـ cache-ه لحد ما `reset()` يتنده (بعد نجاح الـ mutation). ده الشكل الـ **pure/node-testable** لعقد الاستقرار (القرار المعتمد Q2: يتولّد عند فتح الـ dialog ويتخزن). الـ dialog بيحمل instance واحد في `useRef`.
- **Risks:** `crypto.randomUUID` في node test env — Node 20 عنده global `crypto`؛ لو لأ، fallback على `node:crypto` webcrypto. المبرمج يتأكد الـ spec بيشتغل في vitest node env.
- **لماذا holder وليس useRef مباشرة:** الـ hook render tests محجوبة بـ infra (WEB-S1-004، vitest node env)؛ فصل المنطق في closure نقي بيخلّي **عقد الاستقرار قابل للاختبار algorithmically** (توجيه المختبر في CLAUDE.md).

### المرحلة 3: طبقة الـ data — `lib/api/updates-client.ts` + `lib/api/phases-client.ts`
دوال async رفيعة فوق الـ generic `client` + `unwrap` (نفس عقد `projects-client.ts`):
- `updates-client.ts`:
  - `listPhaseUpdates(phaseId, query?)` → `GET /phases/:phaseId/updates` (params: `{status?, page?, limit?}`).
  - `getUpdate(id)` → `GET /updates/:id`.
  - `approveUpdate(id, idempotencyKey)` → `POST /updates/:id/approve` مع `{ headers: { "Idempotency-Key": idempotencyKey } }`، بدون body.
  - `rejectUpdate(id, body)` → `POST /updates/:id/reject` `{reason}`.
  - `forceCancelUpdate(id, body, idempotencyKey)` → `POST /updates/:id/force-cancel` `{reason}` + header.
- `phases-client.ts`:
  - `overridePhaseProgress(id, body)` → `PATCH /phases/:id/progress` `{progress,reason}`.
  - `reorderPhase(id, body)` → `PATCH /phases/:id/reorder` `{order}`.
- **قرار:** `submit` **مؤجّل بالكامل** (data fn + hook + UI) — ملهوش entry-point بدون تأليف/قائمة مسودات (خارج النطاق). انحراف تضييقي عن الـ scope (الـ scope فوّض القرار للمخطط صراحة).
- **Risks:** header casing — axios بيـ normalize؛ الـ backend بيقرأ `idempotency-key` lower. الـ spec يؤكّد الوصول.

### المرحلة 4: الـ React Query hooks
- Queries (`retry:false`، نفس S3):
  - `usePhaseUpdates(phaseId, query)` — key `["phase-updates", phaseId, query]`، `enabled:!!phaseId`.
  - `useUpdate(id)` — key `["update", id]`، `enabled:!!id`.
- Mutations (`lib/hooks/use-update-actions.ts` + `lib/hooks/use-phase-actions.ts`):
  - `useApproveUpdate` / `useForceCancelUpdate` — `retry:false` (money-moving؛ ممنوع blind retry). `mutationFn` بياخد المفتاح كـ **argument** (مولّد برّه من الـ holder)، **مش** بيولّده جوه `mutationFn`.
  - `useRejectUpdate`، `useOverridePhaseProgress`، `useReorderPhase`.
  - **Invalidation (بعد نجاح):** approve/reject/force-cancel → invalidate `["phase-updates", phaseId]` + `["update", id]` + `projectQueryKey(projectId)` (التقدّم اتغيّر بالـ recalc). override/reorder → invalidate `projectQueryKey(projectId)`.
  - **صفر optimistic update** على أي فعل (تعريف النجاح).
- **Risks:** لازم الـ hooks تعرف `phaseId`/`projectId` للـ invalidation — تتمرّر من الـ caller (متوفّرة في سياق الـ panel).

### المرحلة 5: UI — لوحة المراجعات داخل project detail
- استخدام الـ `Tabs` primitive الموجود: تبويب داخل قسم المراحل → **"المراحل" | "المراجعات المعلّقة"** (حالة محلية `useState`، **بدون URL sync** — تفادي refactor للـ routing؛ decision نقطة #1).
- **التجميع:** `useQueries` على `project.phases.map(p => p.id)` بينادي `listPhaseUpdates(phaseId, {status})` — `enabled` فقط لما التبويب active (تفادي over-fetch). flatten + إرفاق `phaseName` لكل عنصر.
- **status filter:** PENDING (default) + APPROVED (عشان الوصول لـ force-cancel). العميل بيـ narrow admin-tier فقط — اللوحة surface للـ SUPER_ADMIN/PROJECT_MANAGER.
- **Update detail = Dialog/drawer** (مش route جديد؛ decision #2): كليك على عنصر → `useUpdate(id)` → عرض التفاصيل الكاملة + الأفعال حسب الحالة والدور (`useMe`):
  - PENDING + (SUPER_ADMIN|PROJECT_MANAGER) → **approve** / **reject** (reject بـ Textarea reason ≥10).
  - APPROVED + SUPER_ADMIN → **force-cancel** بـ confirmation + Textarea reason **≥20** (decision Q3). تحذير صريح إنه بيولّد SUNK_COST + يعكس التقدّم.
  - المفتاح: `createIdempotencyKeyHolder()` في `useRef` يُنشأ عند فتح dialog الـ approve/force-cancel؛ `holder.current()` يمرّر للـ mutation؛ `holder.reset()` بعد النجاح.
- **role gating** = UX فقط (الـ backend هو البوابة). أزرار الأفعال تختفي لغير المصرّح.
- **states:** loading/empty ("لا مراجعات معلّقة")/error لكل من التجميع والـ dialog.
- **استخراج مكوّنات** تحت `components/dashboard/updates/` (ReviewsPanel، UpdateDetailDialog) عشان صفحة الـ detail ما تتضخّمش.

### المرحلة 6: UI — تحكّم المراحل (progress override + reorder) في project detail
- في قسم المراحل الموجود (Section 4): لكل phase صف أدوات لـ SUPER_ADMIN/PROJECT_MANAGER:
  - **override progress:** Dialog بـ `progress` (0–100) + reason (≥20) → `useOverridePhaseProgress`.
  - **reorder:** أزرار ↑/↓ (أو input order 0–1000) → `useReorderPhase` بقيمة الترتيب الجديدة.
- بعد النجاح: invalidation للـ detail → المراحل + `overallProgress` يتحدّثوا (recalc backend).
- **Risks:** reorder على الـ backend مجرد set لقيمة order (مفيش swap ذري) — الـ UI يحسب الـ order الجديد بشكل بسيط (بين الجارين) ويقبل إعادة تحميل. توثيق كـ حد.

### المرحلة 7: UI — المسار المستقل `reviews/page.tsx` → منتقي مشاريع
- إعادة كتابة الـ mock: `useProjects()` (جاهز من S3) → قائمة مشاريع، كل واحد يـ link لـ `dashboard/projects/[id]` (حيث تبويب المراجعات). نص توضيحي إن المراجعة per-project. يحافظ على الـ nav entry بدون aggregation عام.

---

## الـ Skills المطلوبة
- قراءة `node_modules/next/dist/docs/` قبل أي كود (`apps/web/AGENTS.md`) — خصوصاً `useQueries`/client components/params في النسخة الحالية.
- `BACKEND_REFERENCE_02` §2 (Phases) + §3 (Updates) — عقود مؤكّدة بالفعل من source.

## نقاط القرار (محتاجة موافقتك)
1. **التبويب بحالة محلية بدون URL sync** — كليك من المنتقي المستقل بيفتح الـ detail على تبويب المراحل الافتراضي (مش reviews مباشرة). مقبول؟ (البديل: URL/hash sync = سطح أكبر.)
2. **Update detail = Dialog** مش route `[updateId]` مستقل — أبسط وأضيق. مقبول؟
3. **`submit` مؤجّل بالكامل** لـ session التأليف (مافيش entry-point بدونها). مقبول؟
4. **reorder** = set order بسيط (مش drag-and-drop) في S4. مقبول؟

## التأثير على الـ Codebase الحالي
- **جديد:** `types/update.ts`، `lib/api/idempotency-key.ts`، `lib/api/updates-client.ts`، `lib/api/phases-client.ts`، `lib/hooks/{use-phase-updates,use-update,use-update-actions,use-phase-actions}.ts`، `components/dashboard/updates/{reviews-panel,update-detail-dialog}.tsx` (+ specs).
- **معدّل:** `dashboard/projects/[id]/page.tsx` (تبويب المراجعات + تحكّم المراحل — تعديل موضعي على Section 4)، `dashboard/projects/reviews/page.tsx` (rewrite → منتقي).
- **غير مُمَس:** `client.ts`/auth (صفر تعديل، ضمانة S3)، `projects-client.ts`، الـ residuals R-1..R-4.

## تعريف النجاح
- [ ] تبويب المراجعات بيعرض PENDING حقيقي مجمّع عبر مراحل المشروع (loading/empty/error) + approve/reject end-to-end.
- [ ] force-cancel من update detail (APPROVED، SUPER_ADMIN) بـ reason ≥20 + تحذير SUNK_COST.
- [ ] approve + force-cancel بيبعتوا `Idempotency-Key` صالح **ومستقر عبر إعادة الفعل** (holder).
- [ ] phase progress-override + reorder مربوطين؛ `overallProgress` يتحدّث بعد invalidation.
- [ ] صفر optimistic update على أي فعل مالي؛ صفر تعديل على `client.ts`.
- [ ] صفر خطأ tsc جديد (baseline: WEB-TSC-001/002 + WEB-STORE-001 pre-existing).
- [ ] **MVT: 4 specs مكتوبة وpassing** (إجباري):
  - MVT-1 `updates-client.spec.ts` — unwrap + method/URL لكل فعل + **`Idempotency-Key` header يوصل على approve & force-cancel**.
  - MVT-2 `phases-client.spec.ts` — progress/reorder body+URL.
  - MVT-3 `idempotency-key.spec.ts` (test أ) — `generateIdempotencyKey` يطابق `^[A-Za-z0-9_-]{16,64}$` وبيولّد قيم متمايزة.
  - MVT-4 `idempotency-key.spec.ts` (test ب — **الأعمق، rule #4**) — الـ holder: `current()` N مرّات = **نفس المفتاح**؛ بعد `reset()` = مفتاح جديد متمايز. + paired في MVT-1: المفتاح الممرَّر هو **نفسه** اللي يوصل الـ transport header (مش مجرد "صالح الشكل").

---
⏸️ AWAITING APPROVAL
رد بـ "approve" للمتابعة أو "edit: [تعديل]" للتعديل. (نقاط القرار 1–4 محتاجة إقرار.)

✋ تم المخطط — للدور التالي؟
