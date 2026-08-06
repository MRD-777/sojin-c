# Scope

## Mode: Standard
السبب: ربط 3 صفحات Projects (List + Detail + Create) بالـ backend — feature متوسطة، multiple endpoints مترابطة، مفيش auth/payments حسّاس جوّه الـ scope (الـ payments summary مؤجّل، شوف الحدود). مش Deep لأن مفيش سطح هجوم جديد على طبقة الـ auth (الـ interceptor اتعمل في S2).

## المهمة
ربط صفحات Projects الـ 3 (المجموعة 1.2 List + 1.4 Detail + 1.3 Create) بالـ backend الجاهز عبر الـ generic `client` + React Query، واستبدال الـ mock data بـ data حقيقية.

## الـ Endpoints المستهدفة (جاهزة في الـ backend)
- `GET /projects` (ListProjectsQueryDto: page/limit/search/status/type/sortBy/sortOrder) → `{ items, total, page, limit, totalPages }`. كل item فيه `client{id,name,email,avatar}` + `_count{phases,assignments}`.
- `GET /projects/:id` → project كامل + **`phases[]` + `assignments[]` مجمّعين في نفس الـ call** (مش 3 calls زي ما الـ tracker كان مفترض) + `_count{payments,chatRooms}`.
- `POST /projects` (SUPER_ADMIN / PROJECT_MANAGER فقط) — `CreateProjectDto`:
  - `name` (required, ≤300)
  - `clientId` (**required UUID v4 — لازم يكون CLIENT حقيقي في نفس الشركة**)
  - `description?` / `location?` (≤2000 / ≤500)
  - `type?` ∈ `FULL_FINISHING | PARTIAL_FINISHING | CONSTRUCTION`
  - `startDate? / expectedEndDate?` (ISO date)
  - `totalBudget?` (≥0)
  - `dailyUpdateDeadline?` (`HH:mm`)
- `GET /users?role=CLIENT` (لملء الـ client selector في الـ Create) — عبر `GET /users` مع الفلتر.

## الملفات المتأثرة
**جديدة (data layer):**
- `apps/web/src/lib/api/projects-client.ts` — thin functions فوق الـ generic `client` (list / getOne / create). — [service #1]
- `apps/web/src/lib/hooks/use-projects.ts` — `useProjects(query)` (list). — [service #2]
- `apps/web/src/lib/hooks/use-project.ts` — `useProject(id)` (detail). — [service #3]
- `apps/web/src/lib/hooks/use-create-project.ts` — `useCreateProject()` (mutation + invalidate). — [service #4]
- `apps/web/src/lib/hooks/use-clients.ts` — `useClients()` (CLIENT users للـ dropdown في Create). — [service #5]
- `packages/shared-types/src/*` أو `apps/web/src/types/project.ts` — أنواع الـ Project response (List item / Detail / CreateInput). — [types]

**معدّلة (UI wiring):**
- `apps/web/src/app/[locale]/dashboard/projects/page.tsx` — استبدال الـ mock array بـ `useProjects` + loading/empty/error states.
- `apps/web/src/app/[locale]/dashboard/projects/[id]/page.tsx` — استبدال الـ mock object بـ `useProject(id)` + states.
- `apps/web/src/app/[locale]/dashboard/projects/new/page.tsx` — ربط الـ wizard بـ `useCreateProject`؛ إضافة **client selector** (النقطة الأهم — مفيش حالياً)؛ محاذاة قيم `type` مع الـ enum؛ الحقول اللي مش في الـ DTO (workers/custom roles) تفضل UI بس **من غير submission** في S3.

## الـ Services (coverage budget — rule #6)
| service/hook | budget |
|---|---|
| projects-client (list/getOne/create) | ≥1 spec (envelope unwrap + params) |
| use-projects | ≥1 spec |
| use-project | ≥1 spec |
| use-create-project | ≥1 spec (mutation success + error map) |
| use-clients | deferred للـ MVT — spec خفيف لو الوقت سمح |

## تعريف النجاح (المخطط يفصّله في الـ plan مع MVT budget)
- [ ] List بيعرض projects حقيقية من `GET /projects` + loading/empty/error.
- [ ] Detail بيعرض project حقيقي من `GET /projects/:id` (+ phases + assignments المجمّعين).
- [ ] Create بيبعت `CreateProjectDto` صحيح (بـ `clientId` حقيقي مختار من dropdown) وبيـ redirect للـ detail عند النجاح.
- [ ] كل الـ type values في الـ Create متطابقة مع الـ backend enum.
- [ ] MVT: [عدد يحدده المخطط] specs مكتوبة وpassing.
- [ ] `next build` type-check: مفيش أخطاء **جديدة** (WEB-TSC-001/002 pre-existing مش من scope الـ session).

## الحدود (خارج نطاق هذا الـ session)
- **`payments/summary` على الـ Detail (1.4) → مؤجّل لـ S7.** السبب: BACKLOG R-1 (refresh-success غير مُختبَر) = **S3-blocker قبل أي data مالية "ثقيلة"**؛ والـ summary بيانات مالية. الـ Detail في S3 = core + phases + assignments بس (single `findOne` call). أي KPI مالي في الـ UI يفضل mock مع TODO صريح.
- **assignMember / removeMember** (`POST/DELETE /:id/assignments`) — مؤجّل؛ الـ workers step في الـ wizard يفضل UI-only بدون submission.
- **update / changeStatus / delete** — مش في S3 (المجموعة 1.2-1.4 = List/Detail/Create بس).
- **Review Inbox / Phases lifecycle / Updates** (1.5-1.7) → S4 (Deep mode).
- الـ residuals R-1..R-4 + WEB-TSC-001/002 → تفضل في الـ BACKLOG؛ S3 ما بيقفلهاش (بس ما بيزوّدش عليها).
- Permissions gate على الأزرار (Create يظهر لـ non-PM/non-admin) → S11؛ في S3 بس نتأكد إن الـ backend 403 بيتعالج gracefully في الـ UI.

## نقاط قرار محتاجة موافقتك قبل الـ plan
1. **payments/summary مؤجّل لـ S7** (بدل ما يتربط في الـ Detail دلوقتي) — بسبب R-1. موافق؟
2. **الـ workers/custom-roles step في الـ Create يفضل UI-only** (assignMember مؤجّل) — موافق؟
3. **إضافة client selector جديد في الـ Create** (يتطلب `useClients` عبر `GET /users?role=CLIENT`) — ده تغيير UI ملموس. موافق؟

⏸️ AWAITING APPROVAL — رد بـ "approve" للبداية أو "edit: [تعديل]".

✋ تم Scope — للدور التالي (🧠 المخطط)؟
