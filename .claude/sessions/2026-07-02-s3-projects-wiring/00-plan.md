# خطة التنفيذ — S3 Projects Wiring

## المشكلة
صفحات Projects الـ 3 (List / Detail / Create) كلها mock data. الـ backend جاهز بالكامل (`GET /projects`, `GET /projects/:id`, `POST /projects`) لكن مفيش data layer في الـ web يربطهم. الـ Create بالذات مكسور منطقياً: بيطلب `clientId` (CLIENT UUID حقيقي) والـ wizard مفيهوش selector، وقيم `type` مش متطابقة مع الـ backend enum.

## التحليل — root cause
- الـ web وصل لطبقة auth كاملة في S1/S2 (generic `client` + refresh + React Query + `useMe`) لكن **صفر data hooks** لأي domain module. S3 هو أول domain wiring.
- الـ pattern الصحيح موجود بالفعل ويتبع: `useMe` (`useQuery` + `unwrap` + `client`) و `route-guard.spec` (jsdom + axios adapter mock). هنبني عليهم بدون اختراع pattern جديد.

## الحل المقترح (5 مراحل + مرحلة tests)

### المرحلة 1: Types + data client
- **الملفات:**
  - `apps/web/src/types/project.ts` (جديد) — `ProjectListItem`, `ProjectDetail`, `ProjectPhase`, `ProjectAssignment`, `ClientOption`, `CreateProjectInput`, `Paginated<T>`. مشتقّة من `PROJECT_SELECT` في الـ backend service (مش من الـ mock UI).
  - `apps/web/src/lib/api/projects-client.ts` (جديد) — 3 دوال thin فوق `client` + `unwrap`:
    - `listProjects(query): Promise<Paginated<ProjectListItem>>`
    - `getProject(id): Promise<ProjectDetail>`
    - `createProject(input: CreateProjectInput): Promise<ProjectDetail>`
- **التغييرات:** كل دالة تستخدم `client.get/post` + `unwrap<T>(res.data)` (نفس `use-me`). الـ list بيمرّر الـ query params عبر axios `params`.
- **الـ Risks:** انحراف الـ types عن الـ backend `select` (خصوصاً `overallProgress` number، `totalBudget` Decimal→string/number، `client` nullable). التخفيف: نطابق حرفياً مع `PROJECT_SELECT` (projects.service.ts:37-53) و detail select (120-139).

### المرحلة 2: React Query hooks
- **الملفات:**
  - `use-projects.ts` — `useProjects(query)` → `useQuery(['projects', query], () => listProjects(query))`.
  - `use-project.ts` — `useProject(id)` → `useQuery(['project', id], () => getProject(id), { enabled: !!id })`.
  - `use-create-project.ts` — `useCreateProject()` → `useMutation` + `onSuccess` يعمل `invalidateQueries(['projects'])`.
  - `use-clients.ts` — `useClients()` → `useQuery(['clients'], ...)` عبر `GET /users?role=CLIENT` → `ClientOption[]`.
- **التغييرات:** `retry: false` على الـ queries (الـ interceptor بيملك الـ refresh زي `use-me`). المفاتيح ثابتة + exported للـ invalidation.
- **الـ Risks:** الـ query key للـ list لازم يشمل الـ query object عشان الـ pagination/search cache صح. التخفيف: `['projects', query]`.

### المرحلة 3: ربط List page
- **الملف:** `dashboard/projects/page.tsx`
- **التغييرات:** استبدال `projectsData` mock بـ `useProjects`. إضافة loading (يستخدم `loading.tsx` أو skeleton inline) / empty / error states. الـ progress = `overallProgress`، الـ budget = `totalBudget`، الـ status = enum الحقيقي (DRAFT/IN_PROGRESS/...). الـ expandable financial mini-dashboard (المستخلصات/الاحتجاز) = بيانات مالية → **يفضل mock مع TODO صريح** (payments مؤجّل لـ S7 حسب الـ scope).
- **الـ Risks:** الـ status badge mapping (backend enum 5 قيم مقابل UI 4 قيم). التخفيف: mapping function صريح يغطّي الـ 5.

### المرحلة 4: ربط Detail page
- **الملف:** `dashboard/projects/[id]/page.tsx`
- **التغييرات:** `useProject(projectId)`. عرض core + `phases[]` + `assignments[]` (المجمّعين من نفس الـ call). أي KPI مالي (contractValue/approvedInvoices/profitMargin) = mock مع TODO (S7). loading/error/not-found states (404 → رسالة مناسبة).
- **الـ Risks:** الـ 404 من الـ backend بيرجع عبر الـ interceptor كـ error — الـ guard مايطردش (مش 401). التخفيف: التعامل مع `isError` كـ not-found UI مش redirect.

### المرحلة 5: ربط Create page (الأعقد)
- **الملف:** `dashboard/projects/new/page.tsx`
- **التغييرات:**
  1. **Client selector جديد** (Step 1) مدعوم بـ `useClients()` — لازم يختار CLIENT حقيقي → `clientId`.
  2. **محاذاة `type`** مع الـ enum: `FULL_FINISHING | PARTIAL_FINISHING | CONSTRUCTION` (استبدال residential/commercial/infrastructure).
  3. جمع باقي الحقول (name/description/location/dates/budget/deadline) في state.
  4. عند submit → `useCreateProject().mutate(mapFormToCreateInput(form))` → نجاح → `router.push` للـ detail (`./${created.id}`).
  5. الـ workers/custom-roles step يفضل **UI-only** (مش بيتبعت — assignMember مؤجّل). TODO صريح.
  6. عرض validation errors من الـ backend 400 (عبر `mapAuthError`/error message) + disable submit أثناء pending.
- **الـ Risks:**
  - الـ form حالياً uncontrolled (`required` HTML بس). التحويل لـ controlled state لازم يكون دقيق عشان الـ mapping يشتغل.
  - `dailyUpdateDeadline` format `HH:mm` — لو الحقل مش موجود نبعت default أو نسيبه optional.
  - غير-PM/admin هيتلقّى 403 من الـ backend — نعرض رسالة gracefully (permissions gate الكامل في S11).

### المرحلة 6: MVT (tests)
تفاصيل في "تعريف النجاح".

## الـ Skills المطلوبة
- `apps/web/AGENTS.md` → قاعدة "This is NOT the Next.js you know": أي كود Next لازم يراجع `node_modules/next/dist/docs/` قبل الكتابة (خصوصاً params/navigation في الـ Detail).
- pattern داخلي: `use-me.ts` (query + unwrap) + `route-guard.spec.tsx` (jsdom + axios adapter mock) كمرجع للـ hooks والـ specs.

## نقاط القرار
- كلها اتوافق عليها في الـ scope (payments مؤجّل S7 / workers UI-only / client selector جديد). مفيش قرار مفتوح.

## التأثير على الـ Codebase الحالي
- `types/project.ts` + 5 ملفات hooks/client جديدة — إضافات صافية، صفر تأثير على auth layer.
- 3 صفحات معدّلة — الـ UI/CSS يفضل كما هو، بس مصدر الـ data يتبدّل.
- `packages/shared-types` — **مش هنعدّله** في S3 (نبقّي الأنواع web-local في `types/project.ts` لتجنّب توسيع scope؛ توحيدها مع shared-types = بند backlog لاحق).

## تعريف النجاح
- [ ] List بيعرض projects حقيقية + loading/empty/error.
- [ ] Detail بيعرض project + phases + assignments حقيقية + not-found state.
- [ ] Create بيبعت `CreateProjectInput` صحيح (بـ `clientId` من الـ dropdown) + redirect عند النجاح + عرض 400/403 gracefully.
- [ ] كل `type` values متطابقة مع الـ backend enum.
- [ ] أي KPI مالي في الـ UI عليه TODO صريح "mock — payments deferred to S7".
- [ ] `next build` type-check: صفر أخطاء **جديدة** (WEB-TSC-001/002 pre-existing موثّقين، مش من scope الـ session).
- [ ] **MVT: 5 specs مكتوبة وpassing** (إجباري):
  1. `projects-client.spec.ts` — `listProjects` يـ unwrap الـ envelope + يمرّر query params للـ transport (axios adapter mock).
  2. `use-projects.spec.tsx` (jsdom) — يرجّع `items` من transport مموّه.
  3. `use-project.spec.tsx` (jsdom) — يرجّع detail بـ phases/assignments؛ + spec سالب: `enabled:false` لمّا `id` فاضي.
  4. `use-create-project.spec.tsx` (jsdom) — **paired assertion (rule #4، أعمق طبقة):** الـ mutation success لازم يؤكّد إن **الـ body اللي وصل الـ axios adapter = `CreateProjectInput` كامل بـ `clientId`** (مش مجرّد "resolved") + `invalidateQueries(['projects'])` اتنادت.
  5. `map-form-to-create-input.spec.ts` — pure function: form state → `CreateProjectInput` (type→enum mapping صحيح + الحقول الاختيارية الفاضية بتتشال مش بتتبعت كـ empty string).

---
⏸️ AWAITING APPROVAL
رد بـ "approve" للمتابعة أو "edit: [تعديل]" للتعديل

✋ تم المخطط — للدور التالي (💻 المبرمج)؟
