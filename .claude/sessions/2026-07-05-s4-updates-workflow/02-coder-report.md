# تقرير المبرمج

## المرحلة 1: الأنواع — `types/update.ts` — ✅

**الملفات المعدّلة:**
- `apps/web/src/types/update.ts` (جديد) — أنواع web-local للـ Updates + Phase-action bodies.

**Cross-check مقابل Prisma model (مش تخمين):**
قرأت المصادر الفعلية قبل الكتابة وطابقت كل حقل:
- `schema.prisma:191-232` (`model Update`) — كل الـ scalars.
- `schema.prisma:237-260` (`model Media`)، `384-405` (`model Comment`).
- `schema.prisma:618-702` (enums: `UpdateStatus`, `MediaType`, `CommentType`, `CommentStatus`).
- `updates.service.ts:115-133` (findAll **SELECT** — الشكل الضيّق) + `145-172` (findOne **INCLUDE** — كل الـ scalars + relations).

**قرارات دقّة مبنية على المصدر (مش على الـ plan draft):**
| البند | الواقع من المصدر | القرار في الـ type |
|---|---|---|
| `workHours` | `Decimal(5,2)` (`schema.prisma:201`) | **`string`** على الـ wire (مش number) — الـ plan draft كان بيقول number، صُحّح. |
| `cost` | `Decimal(15,2)` | `string`. |
| `workersCount` / `progressIncrement` | `Int` | `number`. |
| list vs detail | findAll = `select` (14 حقل)، findOne = `include` (كل الـ scalars) | `UpdateListItem` **أضيق** من `UpdateDetail` — كل واحد اتظبط على شكله بالظبط، مش نسخة واحدة مشتركة. |
| `reviewer` | relation `User?` + select `{id,name}` | `UpdateReviewerRef | null`. |
| `materialsUsed` | `Json default "[]"` (JSON عادي) | `MaterialUsed[]` — أرقام تفضل أرقام (مش Decimal serialization). |
| `deletedAt` في detail | الـ include بيرجّع كل scalar بما فيه `deletedAt` (دايماً null بفعل softDeleteFilter) | `string | null` — موثّق كـ wire-fidelity. |

**تصدير الأنواع:**
- Enums: `UpdateStatus`, `MediaType`, `CommentType`, `CommentStatus`.
- Nested: `MaterialUsed`, `UpdateUserRef`, `UpdateReviewerRef`, `UpdatePhaseRef`, `UpdateMedia`, `UpdateComment`.
- Responses: `UpdateListItem` (list SELECT)، `UpdateDetail` (detail INCLUDE).
- Query: `PhaseUpdatesQuery`.
- Bodies: `RejectUpdateBody`, `ForceCancelBody`, `OverrideProgressBody`, `ReorderPhaseBody`.
- `UserRole` أُعيد استخدامه من `types/project.ts` (مش re-declare) — مصدر واحد.

**انحرافات عن الـ Plan:**
- تصحيح `workHours` من number → **string** (خطأ في وصف الـ plan، الواقع Decimal). انحراف تصحيحي مبني على المصدر، مش scope creep.
- `MaterialUsed.cost` = `number` (JSON blob، مش Decimal) — لم يكن محدداً في الـ plan؛ محسوم من schema comment (`schema.prisma:202`).

**Verification (literal):**

`npx tsc --noEmit` (من `apps/web`):
```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ ... }' but required in type 'AuthState'.
---EXIT:2---
```

**تحليل:** الـ 5 أخطاء دي **كلها pre-existing baseline** موثّقة في BACKLOG:
- `permissions/page.tsx:287` (`cn`) + `dropdown-menu.tsx:19` (alignment) = **WEB-TSC-001**.
- `decide-redirect.spec.ts:9,18` (NODE_ENV) = **WEB-TSC-002**.
- `use-auth-store.ts:57` (setUser) = **WEB-STORE-001**.

**صفر خطأ جديد من `types/update.ts`** — الملف types-only، بيـ compile نظيف. الـ baseline مطابق للموثّق حرفياً.

**ملاحظات:**
- الملف declarations فقط (صفر runtime) — مفيش spec في المرحلة دي؛ الـ MVT بيبدأ من المرحلة 2 (idempotency-key) و3 (clients).
- `UpdateDetail.deletedAt` مقصود إبقاؤه رغم إنه دايماً null — أمانة للـ wire؛ مايتقروش في الـ UI.

---

## المرحلة 2: مولّد + حامل مفتاح الـ Idempotency — `lib/api/idempotency-key.ts` — ✅

**الملفات المعدّلة:**
- `apps/web/src/lib/api/idempotency-key.ts` (جديد) — module نقي (لا React) بـ 4 exports.

**الـ API المصدّر:**
| Export | العقد |
|---|---|
| `isValidIdempotencyKey(key)` | يطابق `^[A-Za-z0-9_-]{16,64}$` — **نفس regex الـ backend حرفياً** (`idempotency-key.decorator.ts:19`)، مصدر واحد للعقد. |
| `generateIdempotencyKey()` | `crypto.randomUUID()` (36 حرف UUID v4) → fallback على `getRandomValues` (48 hex) → **throw** لو مفيش Web Crypto (مايـ degrade-ش صامت لمفتاح ضعيف على فعل مالي). |
| `IdempotencyKeyHolder` | interface: `current(): string` + `reset(): void`. |
| `createIdempotencyKeyHolder()` | closure: `current()` بيولّد lazy مرة واحدة ويـ cache؛ `reset()` بيمسح → الفعل الجاي مفتاح جديد. |

**قرارات التنفيذ (مبنية على القواعد + الـ threat model):**
- **module نقي (لا `"use client"`, لا hooks):** عشان عقد الاستقرار يبقى قابل للاختبار في vitest **node env** (الـ hook/page render tests لسه محجوبة infra — WEB-S1-004). الـ dialog بيحمل الـ holder في `useRef` (المرحلة 5).
- **throw بدل fallback ضعيف:** لو مفيش `randomUUID`/`getRandomValues` → exception صريح. تفادي مسار weak-randomness ممكن الهاكر يعترض عليه (collision على idempotency key = double-apply). الـ fallback الوحيد المسموح (`getRandomValues` hex) لسه crypto-grade + مطابق للـ SAFE_KEY.
- **الـ holder هو الأعمق (rule #4):** العقد مش "المفتاح شكله صالح" بل "**نفس المفتاح بالظبط** ثابت عبر إعادة الـ invocation" — ده اللي الـ MVT-4 هيثبته.

**انحرافات عن الـ Plan:**
- إضافة `isValidIdempotencyKey` + `getRandomValues` fallback (مش مذكورين صراحة في الـ plan). مبرَّر: (أ) `isValidIdempotencyKey` بيربط عقد الـ client بالـ backend regex كـ single-source ويدّي الـ MVT paired assertion نظيفة؛ (ب) الـ fallback يزيل SPOF لو بيئة مفيهاش `randomUUID`. **مش scope creep** — نفس المسؤولية (توليد مفتاح صالح مستقر)، صفر سطح جديد على الـ actions. أُبلغ المخطط للمراجعة.

**Verification (literal):**

`npx tsc --noEmit` (من `apps/web`):
```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ ... }' but required in type 'AuthState'.
---EXIT:2---
```

**تحليل:** نفس الـ 5 أخطاء baseline (WEB-TSC-001 ×2، WEB-TSC-002 ×2، WEB-STORE-001). **صفر خطأ جديد** من `idempotency-key.ts`.

**ملاحظات:**
- المولّد + الـ holder جاهزين للـ MVT-3/MVT-4 (المختبر). الـ spec هيشتغل node env بلا mocks (algorithmic) — بالظبط توجيه CLAUDE.md للمختبر.
- `globalThis.crypto` مـ typed كـ `Crypto` في lib.dom؛ `randomUUID`/`getRandomValues` موجودين — صفر تحذير tsc.

---

## المرحلة 3: طبقة الـ data — `updates-client.ts` + `phases-client.ts` — ✅

**الملفات المعدّلة:**
- `apps/web/src/lib/api/updates-client.ts` (جديد) — 5 دوال + `UpdateActionResult`.
- `apps/web/src/lib/api/phases-client.ts` (جديد) — 2 دالة + `PhaseActionResult`.

**العقود (مطابقة للـ controllers):**
| الدالة | الـ endpoint | تفاصيل |
|---|---|---|
| `listPhaseUpdates(phaseId, query?)` | `GET /phases/:phaseId/updates` | params: `{status?,page?,limit?}` → `Paginated<UpdateListItem>` |
| `getUpdate(id)` | `GET /updates/:id` | → `UpdateDetail` |
| `approveUpdate(id, key)` | `POST /updates/:id/approve` | **بدون body** (`null`) + `headers:{ "Idempotency-Key": key }` |
| `rejectUpdate(id, {reason})` | `POST /updates/:id/reject` | body فقط |
| `forceCancelUpdate(id, {reason}, key)` | `POST /updates/:id/force-cancel` | body **+** `headers:{ "Idempotency-Key": key }` |
| `overridePhaseProgress(id, {progress,reason})` | `PATCH /phases/:id/progress` | body |
| `reorderPhase(id, {order})` | `PATCH /phases/:id/reorder` | body |

**تأكيد وصول الـ Idempotency-Key header (مطلوب صراحة من المستخدم):**
- approve + force-cancel بيمرّروا `{ headers: { "Idempotency-Key": idempotencyKey } }` في axios config → يوصل الـ backend اللي بيقرأه `req.headers['idempotency-key']` (axios بيـ normalize الـ casing).
- **المفتاح مايتولّدش هنا** — بيتمرّر كـ argument من الـ holder (Stage 2). توليده per-call كان هيلغي الاستقرار (جوهر المفتاح). ده هيتأكّد بالـ MVT-1 (الـ header يوصل الـ transport) + MVT-4 (نفس المفتاح عبر إعادة الفعل).

**قرار على return types (cross-check مش تخمين):**
قرأت الـ normalized response الفعلي للـ approve (`updates.service.ts:511-521`): بيرجّع `{ ...updated, cost: string, workHours: Number(...), dates: ISO }` — **شكل متباين** عن الـ GET selects (خصوصاً `workHours` بقى **number** هنا، مش string زي القائمة/التفصيل). القرار:
- **مش هأعيد تعريف الشكل المتباين ده** كـ type مشترك ممكن يضلّل.
- الـ actions بترجّع `UpdateActionResult { id, status }` / `PhaseActionResult { id }` — الحد الأدنى **المضمون حضوره**. الـ UI مابيرندرش الـ action body أصلاً (بيعمل invalidate + refetch للـ queries القانونية `UpdateDetail`/`UpdateListItem`). أمانة للواقع + صفر ادعاء زائد.

**انحرافات عن الـ Plan:**
- `Paginated` مستورد من `@/types/project` (مش `@/types/update`) — الـ tsc مسك الغلط (TS2305) واتصلح فوراً. مصدر واحد للـ pagination envelope (مش re-declaration).
- إضافة `UpdateActionResult`/`PhaseActionResult` (types محلية للـ client layer) — مذكورة ضمناً في الـ plan كـ return types؛ عرّفتها محلياً عشان ما أعيدش فتح المرحلة 1 وعشان الشكل المتباين ما يتسربش لـ `types/update.ts`.

**Verification (literal):**

خطوة وسيطة — الـ tsc مسك import غلط:
```
src/lib/api/updates-client.ts(24,3): error TS2305: Module '"@/types/update"' has no exported member 'Paginated'.
```
بعد التصحيح (`Paginated` من `@/types/project`)، `npx tsc --noEmit`:
```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ ... }' but required in type 'AuthState'.
---EXIT:2---
```

**تحليل:** رجع للـ 5 أخطاء baseline. **صفر خطأ جديد** من الـ clients.

**ملاحظات:**
- `listProjectPhases` **مش موجود** (قرار الـ plan) — project detail بيرجّع `phases[]` أصلاً.
- الـ clients جاهزة للـ MVT-1 (updates) + MVT-2 (phases): mock الـ transport (axios adapter) زي `projects-client.spec.ts`، assert method/URL/params/body + `seen.headers["Idempotency-Key"]`.

---

## المرحلة 4: React Query hooks — ✅

**الملفات المعدّلة (كلها جديدة):**
- `lib/hooks/use-phase-updates.ts` — `usePhaseUpdates` + `phaseUpdatesQueryOptions` factory + `PHASE_UPDATES_QUERY_KEY`.
- `lib/hooks/use-update.ts` — `useUpdate` + `updateQueryKey`.
- `lib/hooks/use-update-actions.ts` — `useApproveUpdate`, `useRejectUpdate`, `useForceCancelUpdate`.
- `lib/hooks/use-phase-actions.ts` — `useOverridePhaseProgress`, `useReorderPhase`.

**Queries (نفس عقيدة S3):**
- `usePhaseUpdates(phaseId, query)` — key `["phase-updates", phaseId, query]`، `enabled:!!phaseId`، `retry:false`.
- **`phaseUpdatesQueryOptions(phaseId, query, enabled?)`** مُصدَّر كـ single-source للـ key+queryFn+retry — عشان الـ `useQueries` في المرحلة 5 (aggregation عبر مراحل المشروع) يستخدم **نفس الـ keys بدون drift** بين الـ hook المفرد والـ view المجمّع.
- `useUpdate(id)` — key `["update", id]`، `enabled:!!id`، `retry:false`.

**الـ invalidation queries (تأكيد الصحة — المطلوب صراحة):**

| Mutation | onSuccess بيـ invalidate | السبب |
|---|---|---|
| approve / reject / force-cancel | `["phase-updates", phaseId]` (prefix، كل الحالات) **+** `["update", id]` **+** `["project", projectId]` | الحالة اتغيّرت (يختفي من PENDING) + التفصيل + `overallProgress` بعد recalc |
| overridePhaseProgress | `["project", projectId]` فقط | recalc للمشروع؛ مايمسّش الـ updates |
| reorderPhase | `["project", projectId]` فقط | الترتيب في `phases[]` بتاع الـ detail؛ مفيش recalc backend لكن الـ detail بيعكس الترتيب |

- **الـ prefix invalidation** `[...PHASE_UPDATES_QUERY_KEY, phaseId]` بيطابق كل `["phase-updates", phaseId, {status:...}]` أياً كان الـ status object (React Query prefix match) — فالـ PENDING والـ APPROVED lists الاتنين يتجدّدوا بعد الفعل.
- الـ keys مستوردة من مصادرها (`projectQueryKey` من `use-project`, `updateQueryKey` من `use-update`, `PHASE_UPDATES_QUERY_KEY` من `use-phase-updates`) — **صفر hardcoded key string**، صفر drift.
- `useInvalidateReview()` helper مشترك بين الـ 3 review mutations — منطق واحد.

**قرارات التنفيذ:**
- **الـ variables تحمل الـ context الكامل** (`id`+`phaseId`+`projectId`) بدل args على مستوى الـ hook — عشان instance واحد من الـ hook يخدم كل صفوف الـ panel (كل update له phaseId مختلف، projectId ثابت).
- **`retry:false` على الـ 5 mutations كلها** (مش بس المالية): كلها state transitions — retry بعد response مفقود لكن committed يـ re-apply (override) أو يرجّع 400 (reject/approve مش PENDING تاني). المالية (approve/force-cancel) الـ Idempotency-Key بيخليها safe replay، لكن الأبسط والأأمن: مفيش auto-retry، الـ backend هو الحكم، المستخدم يعيد يدوياً.
- **صفر optimistic update** على أي mutation (معيار النجاح) — كل التغييرات تظهر من الـ server-confirmed refetch.

**انحرافات عن الـ Plan:**
- إضافة `phaseUpdatesQueryOptions` factory (مش مذكور صراحة) — ضروري عشان المرحلة 5 (`useQueries`) ما تعيدش تعريف الـ key/queryFn وتسبّب drift. نفس المسؤولية (طبقة الـ query للـ phase updates). أُبلغ المخطط.

**Verification (literal):**

`npx tsc --noEmit` (من `apps/web`):
```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ ... }' but required in type 'AuthState'.
---EXIT:2---
```

**تحليل:** نفس الـ 5 baseline. **صفر خطأ جديد** من الـ hooks الأربعة.

**ملاحظات:**
- الـ hooks جاهزة للمرحلة 5 (UI): الـ panel هيـ fan-out بـ `useQueries(project.phases.map(p => phaseUpdatesQueryOptions(p.id, {status}, activeTab==='reviews')))`.
- الـ MVT للـ hooks (idempotency stability عبر retry) محجوب infra على مستوى الـ hook — بيتغطّى algorithmically عبر الـ holder (MVT-4) + الـ client header (MVT-1). موثّق للمختبر.

---

## المرحلة 5: UI — لوحة المراجعات + Update Detail Dialog — ✅

**الملفات المعدّلة:**
- `components/dashboard/updates/update-detail-dialog.tsx` (جديد) — Dialog التفاصيل + الأفعال + holders المفتاح.
- `components/dashboard/updates/reviews-panel.tsx` (جديد) — تجميع `useQueries` + القائمة + status toggle.
- `app/[locale]/dashboard/projects/[id]/page.tsx` (معدّل) — تغليف قسم المراحل بـ `Tabs` (المراحل | مراجعة التحديثات) + role gates.

**استخدام الـ Idempotency holder (المطلوب صراحة — تأكيد):**
- `approveKey` + `cancelKey` = `useRef(createIdempotencyKeyHolder())` — **stable عبر الـ renders**.
- عند الضغط على "اعتماد"/"تأكيد الإلغاء": `holder.current()` → **يولّد المفتاح مرة واحدة lazy** ويمرّره للـ mutation. أي retry/re-click بيعيد **نفس المفتاح** (idempotent replay).
- **`holder.reset()` في `onSuccess`** → الفعل التالي يبدأ مفتاح جديد.
- **`useEffect([updateId])` بيـ reset الـ holders الاتنين** عند تبديل التحديث → تحديث جديد **مايرثش** مفتاح تحديث سابق.
- دفاع طبقي: `retry:false` + `disabled={busy}` (isPending) بيمنعوا الـ double-submit على مستوى الـ UI كمان — لكن الـ holder بيضمن الاستقرار بصرف النظر.

**لوحة المراجعات (decision Q1 = ج، per-project):**
- `useQueries(project.phases.map(p => phaseUpdatesQueryOptions(p.id, {status}, active)))` — تجميع محدود بعدد مراحل المشروع، **نفس keys** الـ hook المفرد (factory من المرحلة 4، صفر drift).
- **`active` gating:** الـ `enabled` = `active` (التبويب = reviews) → مفيش over-fetch لما التبويب مقفول (base-ui Tabs.Panel بيفضل mounted).
- **status toggle** (PENDING/APPROVED) → الوصول لصفوف APPROVED اللي الـ force-cancel بيشتغل عليها.
- flatten + إرفاق `phaseId`+`phaseName` لكل صف (للعرض + context الـ invalidation في الـ dialog).
- states: loading (أول تحميل فقط)/error/empty (رسالة مختلفة PENDING vs APPROVED)/list.

**role gating (UX فقط، الـ backend هو البوابة):**
- `canReview = role ∈ {SUPER_ADMIN, PROJECT_MANAGER}` → approve/reject.
- `canForceCancel = role === SUPER_ADMIN` → force-cancel.
- `role` من `useMe()` (cached من الـ route-guard).

**الـ Dialog — أفعال حسب الحالة:**
- PENDING + canReview → **اعتماد** / **رفض** (Textarea reason، disabled < 10 حرف).
- APPROVED + canForceCancel → **إلغاء قسري** (تحذير SUNK_COST صريح + Textarea reason، disabled < 20 حرف).
- `actionError` بيتعرض؛ `close()` محجوب أثناء `busy` (مايسقّطش mutation نص الطريق).

**قرارات + ملاحظات للهاكر/المختبر:**
- **حافة reason-change بعد فشل:** لو الـ force-cancel فشل (مثلاً 409) والمستخدم **غيّر الـ reason** وأعاد المحاولة بنفس المفتاح → الـ backend fingerprint فيه الـ reason فبيرجّع **422** (نفس المفتاح، بيانات مختلفة). الحل الحالي: يقفل الـ dialog ويفتحه تاني (`updateId` effect يـ reset المفتاح). **موثّق للهاكر يقيّم** لو محتاج reset-on-reason-change.
- **AGENTS.md (Next docs):** المكوّنات client فوق أنماط مثبتة في صفحة الـ detail (base-ui Dialog/Tabs، react-query، useRef) — **صفر Next API جديد** (لا server components، لا params/searchParams جديدة). الـ tsc أكّد توافق كل props الـ base-ui.
- `AuthUser.role` هو `string` (مش enum) — قارنت بـ string literals.

**Verification (literal):**

`npx tsc --noEmit` (من `apps/web`):
```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ ... }' but required in type 'AuthState'.
---EXIT:2---
```

**تحليل:** نفس الـ 5 baseline. **صفر خطأ جديد** من الـ 3 ملفات (مكوّنين + تعديل الـ page). كل props الـ base-ui (Dialog `open`/`onOpenChange`، Tabs `value`/`onValueChange`) اتحقّقت.

**انحرافات عن الـ Plan:**
- في تبويب المراحل شلت الـ `CardHeader` المكرّر (التبويب نفسه بقى بيسمّي القسم) — تعديل تجميلي، صفر تغيير في منطق عرض المراحل.
- لا انحرافات وظيفية أخرى.

---
✋ تم المبرمج (المرحلة 5) — للمرحلة التالية (6: تحكّم المراحل progress/reorder)؟

---

## المرحلة 6: CVE-S4-001 — نقل الـ Idempotency holders للـ page (NEEDS-CODER returned) — ✅

> **دورة NEEDS-CODER (rule #9):** الهاكر صنّف CVE-S4-001 مبدئياً FIXED-BY-HACKER (reason-change reset)، والمستخدم أعاد تصنيفه NEEDS-CODER لأن الجذر الأعمق **معماري**: مكان الـ holders. هذا Stage 2 — section **جديد**، لا overwrite لـ Stages 1–5.

**الـ Hacker Proposal مقابل ما نُفّذ:**
اقتراح الهاكر (ATT-2) كان "لا تضف `key={updateId}` للـ dialog" + الإبقاء على الـ holders في `useRef` داخل الـ dialog بحجة إنه دائم mounting. **الواقع اللي اكتشفته بالمصدر خالف الحجة:**
- `components/ui/tabs.tsx:72` يرندر `TabsPrimitive.Panel` **بدون `keepMounted`**.
- `@base-ui/react/tabs/panel/TabsPanel.js:37` → `keepMounted = false` افتراضياً؛ `:99` `if (hidden && !keepMounted) return null`؛ `:110` `shouldRender = keepMounted || mounted`.
- **الخلاصة:** الـ Panel غير النشط **يُفصَل (unmount)** → `ReviewsPanel` + الـ dialog + أي holder بداخلهم **يُدمَّر عند تبديل التبويب**. فادعاء المرحلة 5 ("base-ui Tabs.Panel بيفضل mounted") كان **خطأ**. → holder مملوك للـ dialog/panel = هش.

**القرار (الأبسط + الأأمن — من خيارات المستخدم الثلاثة):**
اخترت **الخيار الأول: نقل الـ holders للـ `project detail page` وتمريرها props**. لماذا هو الأأمن:
- الـ page لا يُفصَل عند تبديل التبويب (على مستوى الـ route)، بعكس الـ panel/dialog → عمر المفتاح **مفصول تماماً** عن mount أي child.
- محصّن ضد أي remount مستقبلي للـ dialog (حتى لو أحدهم أضاف `key={updateId}` — تحذير الهاكر يصبح غير ضروري).
- الخيار 3 (Dialog force-unmount) يصارع animations الـ base-ui Dialog ويربط الضمان بتوقيت الـ mount (أهش). الخيار 1 يفوز.

**الملفات المعدّلة:**
- `app/[locale]/dashboard/projects/[id]/page.tsx`:
  - `import { createIdempotencyKeyHolder }`.
  - `const [approveKey] = React.useState(() => createIdempotencyKeyHolder())` + `cancelKey` مثله — **lazy init** (initializer يشتغل مرة واحدة، يصلح nit الـ eager-alloc اللي رصده المخطط) بعمر = عمر الـ page.
  - تمرير `approveKey`/`cancelKey` لـ `<ReviewsPanel>`.
- `components/dashboard/updates/reviews-panel.tsx`:
  - props جديدة `approveKey`/`cancelKey: IdempotencyKeyHolder`.
  - `openUpdate(id)`: `approveKey.reset(); cancelKey.reset(); setOpenId(id)` — **فتح update = فعل جديد → مفتاح نظيف**. صفوف القائمة تنادي `openUpdate` بدل `setOpenId` المباشر.
  - تمرير الـ holders لـ `<UpdateDetailDialog>`.
- `components/dashboard/updates/update-detail-dialog.tsx`:
  - props جديدة `approveKey`/`cancelKey`؛ **حُذف** `useRef(createIdempotencyKeyHolder())` (الاتنين) + حُذف `useRef` من import React + الـ import صار `import type { IdempotencyKeyHolder }`.
  - الاستخدامات: `approveKey.current.current()` → `approveKey.current()`؛ `.current.reset()` → `.reset()` (approve + force-cancel + reason-change onChange).
  - الـ `useEffect([updateId])` بقى يـ reset **mode + reason فقط** (UI state)؛ reset الـ holders انتقل ملكيته للـ panel (على الفتح). كل انتقال openId لقيمة non-null يمر عبر `openUpdate` → reset مضمون قبل أي استخدام للمفتاح.

**فصل الملكية بعد النقل (عقد واضح):**
| الحدث | من يـ reset المفتاح |
|---|---|
| فتح update (فعل جديد) | `ReviewsPanel.openUpdate` |
| نجاح approve/force-cancel | الـ dialog (`onSuccess`) |
| تغيير reason الـ force-cancel | الـ dialog (Textarea onChange) — **يخص المرحلة 7 رسمياً** (مُبقى من inline fix الهاكر ليبقى الشجر أخضر) |
| إعادة فتح نفس الـ update بعد فشل | `openUpdate` (escape hatch لا يزال يعمل) |

**انحرافات عن التوجيه:**
- **`reason-change reset` (سطر onChange):** مُبقى من إصلاح الهاكر السابق ومُحدَّث لشكل الـ prop-holder (`cancelKey.reset()`) **فقط ليَـ compile**. **لم أدّعِ تنفيذ المرحلة 7** — هي ستـ formalize + تكتب MVT لهذا السلوك. لو المخطط Stage 2 فضّل رجعه لحد المرحلة 7، أحذفه.
- **لم أُنفّذ المرحلة 7 ولا 8** (وقفة بعد 6 حسب التوجيه).

**Verification (literal):**

`npx tsc --noEmit` (من `apps/web`):
```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ ... }' but required in type 'AuthState'.
---EXIT:2---
```
نفس الـ 5 baseline (WEB-TSC-001 ×2، WEB-TSC-002 ×2، WEB-STORE-001). **صفر خطأ جديد** من نقل الـ holders عبر الـ 3 ملفات.

**ملاحظات للمخطط Stage 2 (rule #9):**
- يلزم section جديد في `01-architect-report.md` يـ compare **"Hacker Proposal vs Reality"** (اكتشاف الـ unmount يقلب حجة الهاكر ATT-2).
- يلزم **إقرار MVT budget الجديد** قبل المختبر: أقترح +1 spec (holder ownership: reset-on-open + المفتاح يعيش عبر إعادة إنشاء child افتراضي) فوق الـ MVT الأربعة + spec CVE-S4-001 (reset-on-reason-change) اللي أوصى به الهاكر.

**ملخص جزئي (حتى المرحلة 6):**
- المراحل المكتملة: 6/8 (7 و8 مؤجّلتان لهذه الوقفة).
- الملفات المعدّلة في المرحلة 6: 3.
- انحرافات: 1 (إبقاء reason-change reset مؤقتاً — موثّق).

✋ تم المبرمج (المرحلة 6: CVE-S4-001 holder relocation) — للدور التالي (🧠 المخطط Stage 2)؟

---

## المرحلة 7: formalize قرار (ب) — reason-change reset (force-cancel فقط) — ✅

> **السياق:** المخطط Stage 2 حوّل المرحلة 7 من "تنفيذ" إلى **"formalize + توثيق قرار (ب) + تجهيز MVT-5"** لأن السلوك نفسه اتطبّق inline من الهاكر واتحدّث لشكل الـ prop في المرحلة 6. المرحلة دي تخلّيه **وحدة مسمّاة موثّقة** بدل side-effect مدفون في JSX.

**الملف المعدّل:**
- `components/dashboard/updates/update-detail-dialog.tsx` — استخراج معالج مسمّى + توثيق العقد الكامل.

**التغيير (قبل → بعد):**
- **قبل:** الـ force-cancel Textarea `onChange` = arrow inline بـ `setReason` + `cancelKey.reset()` + تعليق inline.
- **بعد:** معالج مسمّى `onForceCancelReasonChange(value)` بجوار `onApprove`/`onReject`/`onForceCancel`، والـ Textarea بقى `onChange={(e) => onForceCancelReasonChange(e.target.value)}`. القرار بقى **وحدة واحدة مسمّاة** لها doc-comment authoritative.

**العقد الموثّق (decision ب — CVE-S4-001):**
- fingerprint الـ backend يربط `{updateId, action:'force_cancel', reason}` (`updates.service.ts:602-606`)؛ نفس المفتاح + reason مختلف → **422** (`idempotency.service.ts:55-62`).
- reason معدّل = **فعل منطقي جديد** → إسقاط المفتاح المخزّن هنا → التأكيد التالي يولّد مفتاحاً جديداً (لا 422-loop).
- reason **غير معدّل** → لا `onChange` → المفتاح ثابت → إعادة متطابقة = **idempotent replay** (ضمان double-click/network-retry محفوظ). ← ده جوهر rule #4، ومحل تأكيد MVT-5.
- **scoped لـ force-cancel حصراً:** reject بلا idempotency key، approve بلا reason.

**حدود الـ reset (توثيق صريح لمن يملك كل حدّ — لتفادي reset مكرّر/غامض):**
| الحدّ | المالك | لماذا هنا |
|---|---|---|
| فتح update (فعل جديد) | `ReviewsPanel.openUpdate` (م.6) | مفتاح نظيف لكل update |
| نجاح الفعل | الـ dialog `onSuccess` (م.5) | الفعل اكتمل → التالي جديد |
| **تعديل reason بعد فشل** | **`onForceCancelReasonChange` (م.7)** | النية اتغيّرت |

- **قرار عدم إضافة reset على دخول force-cancel mode:** غير لازم — زر الدخول يعمل `setReason("")`، والتأكيد محجوب حتى `length ≥ 20`، فأي تأكيد يسبقه keystroke (onChange → reset). الـ `openUpdate` يكون صفّر المفتاح على الفتح أصلاً، وflow الـ force-cancel لا يولّد مفتاحاً قبل التأكيد. إضافة reset على الدخول = redundant noise. موثّق بدل ما يتضاف.

**انحرافات عن التوجيه:** لا يوجد. صفر تغيير سلوكي (السلوك اتثبّت م.6)؛ المرحلة دي refactor توثيقي بحت (rename + doc). لم أنفّذ المرحلة 8 (وقفة بعد 7).

**جاهزية MVT-5 (للمختبر):** العقد الآن معلن نصّاً في الكود + مربوط بـ `idempotency-key.ts` النقي. MVT-5 يُكتب **algorithmically على الـ holder** (node-env، بلا render): `K1=current()` → `reset()` → `K2=current()`، `K1≠K2`؛ **+ paired** بدون reset بينهما = نفس المفتاح. الـ component wiring (`onChange → reset`) يُتحقَّق code-review + tsc (render محجوب WEB-S1-004) — مطابق لإقرار المخطط Stage 2.

**Verification (literal):**

`npx tsc --noEmit` (من `apps/web`):
```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ ... }' but required in type 'AuthState'.
---EXIT:2---
```
نفس الـ 5 baseline. **صفر خطأ جديد** من الـ refactor التوثيقي.

**ملخص جزئي (حتى المرحلة 7):**
- المراحل المكتملة: 7/8 (8 مؤجّلة لهذه الوقفة).
- الملف المعدّل في المرحلة 7: 1.
- انحرافات: 0.

✋ تم المبرمج (المرحلة 7: formalize قرار ب) — للمرحلة التالية (8: progress override UI + phase reorder)؟

---

## المرحلة 8: تحكّم المراحل — progress override + reorder — ✅

> **ملاحظة على الترقيم:** المرحلة 7 (formalize قرار ب) كانت **مكتملة بالفعل** كوداً وتقريراً (الكود: `onForceCancelReasonChange` معالج مسمّى في `update-detail-dialog.tsx:181` + doc-comment). لذلك هذه الوقفة تضيف **section واحد فقط** (المرحلة 8)، لا إعادة كتابة للمرحلة 7.

**الملفات المعدّلة:**
- `components/dashboard/projects/phase-admin-controls.tsx` (**جديد**) — مكوّن أدوات المرحلة: ↑/↓ reorder + زر/Dialog تعديل النسبة. يملك الـ hooks الاثنين (`useOverridePhaseProgress`, `useReorderPhase`).
- `app/[locale]/dashboard/projects/[id]/page.tsx` (معدّل موضعياً) — import + `canManagePhases` gate + حقن `<PhaseAdminControls>` في كل صف مرحلة (Section 4، تبويب المراحل) مع تمرير الجارين للـ swap.

**العقود (مطابقة للـ backend المؤكّد بالمصدر):**
| الفعل | الـ endpoint | القيود (من `phases/dto/index.ts`) | الدور (من `phases.controller.ts`) |
|---|---|---|---|
| override progress | `PATCH /phases/:id/progress` | `progress` **Int 0–100**، `reason` **≥20 ≤2000** | `SUPER_ADMIN` \| `PROJECT_MANAGER` |
| reorder | `PATCH /phases/:id/reorder` | `order` **Int 0–1000** (plain SET، بلا swap ذري) | `SUPER_ADMIN` \| `PROJECT_MANAGER` |

**قرار reorder — swap بكتابتين بدل "single set بين الجارين" (انحراف موثّق):**
الـ plan (المرحلة 6، سطر 79) وصف الـ reorder كـ **"single set — الـ UI يحسب order بين الجارين"**. **الواقع من المصدر خالف قابلية التنفيذ:**
- `ReorderPhaseDto.order` = **`@IsInt() @Min(0) @Max(1000)`** — عدد صحيح فقط. لا توجد قيمة صحيحة "بين" جارين متتاليين (الـ orders تُولَّد auto-calc متتالية: `maxPhase.order + 1` → `0,1,2,3…`، `phases.service.ts:124`). فـ "single set بين الجارين" **غير قابل للتحقيق** على orders صحيحة متتالية، وأي single-set لا يُنتج نقلاً مرئياً موثوقاً.
- الحل المُنفَّذ: **swap = كتابتان متسلسلتان** — تُعطى المرحلة الحالية `order` الجار، ثم يُعطى الجار `order` المرحلة (القيم مُلتقطة من render قبل أي refetch). **غير ذري**: لو فشلت الثانية، تتشارك المرحلتان نفس الـ order مؤقتاً (tie غير مستقر تحت `orderBy: order asc`) لحين reorder/reload تالٍ.
- **مبرّر الانحراف:** نفس نية القرار Q4 المعتمد ("reorder بسيط، مش drag-and-drop") لكن بتنفيذ **يعمل فعلاً** بدل single-set لا ينقل شيئاً. صفر سطح API جديد (نفس الـ hook `useReorderPhase`، نفس الـ endpoint). موثّق في header الملف + هنا. **يُرفع للمخطط Stage 2** للإقرار (نمط تصحيح-من-المصدر، مطابق لتصحيح `workHours` في المرحلة 1).

**قرارات تنفيذ أخرى:**
- **مكوّن مستقل تحت `components/dashboard/projects/`** (مجلد جديد) بدل تضخيم `page.tsx`: كل صف يحقن `<PhaseAdminControls>` واحد يملك dialog تعديل النسبة الخاص به (يُفتح فقط عند الطلب). الـ page ما يزال مصدر ترتيب المراحل (يمرّر الجارين بالـ index). مطابق لتوجيه الـ plan "استخراج مكوّنات".
- **صفر optimistic update:** النسبة الجديدة + الترتيب الجديد يظهران من refetch الـ project-detail بعد الـ invalidation (الـ hooks من المرحلة 4 تـ invalidate `projectQueryKey` فقط). `overallProgress` يتحدّث بالـ recalc الخلفي.
- **role gate = UX فقط:** `canManagePhases = SUPER_ADMIN|PROJECT_MANAGER` (مطابق لـ `@Roles` الخلفي)؛ الأدوات تختفي لغير المصرّح، والـ backend هو البوابة.
- **تحقق override client-side:** `progress` = عدد صحيح 0–100، `reason` ≥20 — يعكس قيود الـ DTO؛ زر الحفظ محجوب حتى الصلاحية. `close()` محجوب أثناء `isPending` (ما يسقّط mutation نص الطريق).
- **حدود reorder:** ↑ محجوب على أول مرحلة، ↓ على آخر مرحلة؛ كلاهما محجوب أثناء `reorder.isPending` (يمنع swap متداخل).

**انحرافات عن الـ Plan:**
1. **reorder = swap بكتابتين** بدل single-set-between-neighbours — مبرَّر بالمصدر (Int schema)، موثّق أعلاه، مرفوع للمخطط.
2. **مكوّن في مجلد جديد `components/dashboard/projects/`** — لم يُذكر صراحة في قائمة تأثير الـ plan (سطر 97 عدّد `updates/` فقط)؛ إضافة تضييقية للفصل الدلالي (phases ≠ updates)، صفر سطح جديد.
لا انحرافات وظيفية أخرى.

**Verification (literal):**

`npx tsc --noEmit` (من `apps/web`):
```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ ... }' but required in type 'AuthState'.
---EXIT:2---
```
نفس الـ 5 baseline (WEB-TSC-001 ×2، WEB-TSC-002 ×2، WEB-STORE-001). **صفر خطأ جديد** من المكوّن + تعديل الـ page.

**ملاحظات للمختبر (توسعة MVT محتملة):**
- منطق الـ override validation (`progressValid`/`reasonValid`) pure — قابل للاختبار algorithmically لو استُخرج، لكنه inline في المكوّن حالياً (render محجوب WEB-S1-004). العقد الأهم (client/URL/body لـ progress+reorder) مغطّى بالفعل بـ **MVT-2** (`phases-client.spec.ts`).
- **swap reorder** = سلوك مكوّن (كتابتان متسلسلتان) — يُتحقَّق code-review + tsc؛ الـ two-write contract يخص الـ `phases-client` (mocked transport) مش render.

**ملخص نهائي (الـ session كامل — 8 مراحل):**
- المراحل المكتملة: **8/8** ✅
- ملفات المرحلة 8: 2 (1 جديد + 1 معدّل).
- انحرافات المرحلة 8: 2 (swap-vs-single-set + مجلد جديد) — كلاهما موثّق ومبرَّر بالمصدر، مرفوعان للمخطط Stage 2.
- baseline tsc ثابت عبر الـ 8 مراحل (صفر خطأ جديد تراكمياً).

✋ تم المبرمج (المرحلة 8) — الـ session المبرمج مكتمل (8/8). للدور التالي (🧠 المخطط Stage 2 لإقرار انحرافات م.8 + MVT budget، ثم المختبر)؟
