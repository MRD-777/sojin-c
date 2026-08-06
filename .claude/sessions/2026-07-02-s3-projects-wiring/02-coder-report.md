# تقرير المبرمج

## المرحلة 1: Types + data client — ✅

**الملفات المعدّلة:**
- `apps/web/src/types/project.ts` (جديد) — أنواع الـ Project web-local، مشتقّة **حرفياً** من الـ backend select مش من الـ mock UI:
  - literal unions للـ enums (UPPERCASE — زي ما بيرجع على الـ wire): `ProjectStatus` (5)، `ProjectType` (3)، `PhaseStatus` (4)، `ProjectRoleInProject` (5)، `UserRole` (7).
  - `Paginated<T>` = `{ items, total, page, limit, totalPages }` (findAll return).
  - `ProjectClientRef` / `ProjectPhase` / `ProjectAssignment` (nested selects).
  - `ProjectCore` (PROJECT_SELECT) → `ProjectListItem` (+`_count{phases,assignments}`) و `ProjectDetail` (+`phases[]`+`assignments[]`+`_count{payments,chatRooms}`).
  - `ProjectsListQuery` (ListProjectsQueryDto) + `CreateProjectInput` (CreateProjectDto) + `ClientOption`.
- `apps/web/src/lib/api/projects-client.ts` (جديد) — 3 دوال thin فوق الـ generic `client` + `unwrap`:
  - `listProjects(query)` → `client.get('/projects', { params })`.
  - `getProject(id)` → `client.get('/projects/:id')`.
  - `createProject(input)` → `client.post('/projects', input)`.

**انحرافات عن الـ Plan:**
- لا يوجد. الـ stage اتنفّذ زي ما الخطة حددت بالظبط (types + projects-client فقط؛ دالة الـ clients اتأجّلت للمرحلة 2 مع `use-clients` زي ما الخطة قسّمت).

**قرارات دقيقة اتأخدت أثناء التنفيذ (مطابقة للـ backend، موثّقة كـ comments في الكود):**
1. **حقول Decimal → `string`:** `totalBudget` / `budget` / `actualCost` هي `Decimal(15,2)` في Prisma → بتتسلسل كـ string في JSON (`Decimal.prototype.toJSON`). أنواعها `string` على الـ response.
2. **`totalBudget` asymmetric:** `number` على `CreateProjectInput` (DTO `@IsNumber`) لكن `string` على الـ response — asymmetry مقصود وموثّق.
3. **حقول Int → `number`:** `overallProgress` / `progress` / `weight` / `order`.
4. **التواريخ → `string`** (`@db.Date`/`DateTime` → ISO string)، nullable حيث الـ schema `?`.
5. **enums UPPERCASE literal unions web-local** بدل import من `shared-types` (اللي قيمه lowercase لغرض تاني) — تفادياً لـ mismatch على الـ status/type mapping في المراحل الجاية. توحيدها مع shared-types = بند backlog لاحق (زي ما الخطة قالت).

**ملاحظات:**
- صفر تأثير على طبقة الـ auth — إضافات صافية بس.

## Verification (literal)

الأمر: `npx tsc --noEmit` داخل `apps/web`.

```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ accessToken: null; user: null; pendingRegistration: null; setSession: ({ accessToken, user }: { accessToken: string; user: AuthUser; }) => void; setAccessToken: (accessToken: string) => void; setPendingRegistration: (pendingRegistration: PendingRegistration) => void; clearPendingRegistration: () => void; clear: ()...' but required in type 'AuthState'.
```

**تحليل الأخطاء الـ 5 — كلها pre-existing backlog items، صفر منها من المرحلة 1:**
| الخطأ | Ticket |
|---|---|
| `permissions/page.tsx:287` (`cn`) | WEB-TSC-001 |
| `dropdown-menu.tsx:19` (`alignment`) | WEB-TSC-001 |
| `decide-redirect.spec.ts:9,18` (`NODE_ENV`) | WEB-TSC-002 |
| `use-auth-store.ts:57` (`setUser` missing) | WEB-STORE-001 / R-4 |

ملفّاي الجديدين (`types/project.ts`, `projects-client.ts`) **مالهمش أي خطأ** في الـ output. (`tsc` بيرجّع صفر أخطاء جديدة — تعريف النجاح #6 محقّق للمرحلة دي.)

---

## المرحلة 2: React Query hooks — ✅

**الملفات المعدّلة:**
- `apps/web/src/lib/api/users-client.ts` (جديد) — `listClients()` → `GET /users?role=CLIENT&limit=100` → `ClientOption[]` (يـ unwrap الـ envelope + ياخد `.items`). دالة الـ fetch للـ clients اللي اتأجّلت من المرحلة 1.
- `apps/web/src/lib/hooks/use-projects.ts` (جديد) — `useProjects(query)` + `PROJECTS_QUERY_KEY` exported. الـ key = `[...PROJECTS_QUERY_KEY, query]` عشان الـ pagination/search/status/type كل واحد يـ cache تحت key بتاعه.
- `apps/web/src/lib/hooks/use-project.ts` (جديد) — `useProject(id)` + `projectQueryKey(id)` factory. `enabled: !!id` يمنع الـ fire بـ param فاضي.
- `apps/web/src/lib/hooks/use-create-project.ts` (جديد) — `useCreateProject()` mutation؛ `onSuccess` → `invalidateQueries(PROJECTS_QUERY_KEY)`.
- `apps/web/src/lib/hooks/use-clients.ts` (جديد) — `useClients()` + `CLIENTS_QUERY_KEY`؛ `staleTime` 5 دقايق.

**انحرافات عن الـ Plan:**
- انحراف صغير مبرَّر: الخطة خلّت دالة fetch الـ clients "inline أو users-client". اخترت **`users-client.ts` منفصل** بدل inline — يحافظ على نفس الـ thin-client pattern بتاع `projects-client.ts` (single source، قابل لـ spec مستقل). صفر أثر على الـ scope.

**قرارات دقيقة اتأخدت أثناء التنفيذ:**
1. **`retry: false` على الـ 3 queries** (`useProjects`/`useProject`/`useClients`) — نفس منطق `use-me`: الـ interceptor بيملك الـ 401→refresh + retry واحد، فـ retry إضافي من React Query = latency زيادة قبل الـ guard redirect بس.
2. **مفيش retry على الـ create mutation** (متعمّد، موثّق كـ comment): الـ `POST /projects` مش idempotent (مفيش `Idempotency-Key` زي الـ payments) → retry أعمى ممكن يعمل double-create.
3. **الـ 404 على الـ detail = `isError` مش 401** — موثّق في `use-project.ts` إن الـ guard مايطردش عليه (الـ not-found UI في المرحلة 4).
4. **`listClients` بـ `limit: 100`** — الـ default page size (20) ممكن يقطع الـ dropdown.

**ملاحظات:**
- صفر تأثير على طبقة الـ auth — كل الملفات إضافات صافية فوق الـ generic client + React Query الموجودين.

## Verification (literal) — بعد المرحلة 2

الأمر: `npx tsc --noEmit` داخل `apps/web`.

```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ accessToken: null; user: null; pendingRegistration: null; setSession: ({ accessToken, user }: { accessToken: string; user: AuthUser; }) => void; setAccessToken: (accessToken: string) => void; setPendingRegistration: (pendingRegistration: PendingRegistration) => void; clearPendingRegistration: () => void; clear: ()...' but required in type 'AuthState'.
```

**نفس الـ 5 أخطاء pre-existing بالظبط (WEB-TSC-001 ×2, WEB-TSC-002 ×2, WEB-STORE-001 ×1) — صفر خطأ جديد من المرحلة 2.** الـ 5 ملفات الجديدة نضيفة تماماً في الـ output.

---

✋ تم المبرمج (المرحلة 2) — للمرحلة 3 (ربط List page)؟

---

## المرحلة 3: ربط List page — ✅

**الملفات المعدّلة:**
- `apps/web/src/app/[locale]/dashboard/projects/page.tsx` — استبدال الـ `projectsData` mock array بالكامل بـ `useProjects()`:
  - **loading / error / empty** states كاملة (Loader2 spinner / رسالة خطأ + زر retry / empty state + زر إنشاء).
  - table rows من data حقيقية: `name`, `client.name`, status badge (enum حقيقي 5 قيم), progress = `overallProgress`, budget = `formatMoney(totalBudget)`.
  - stat card "activeProjects" → `data.total` (بـ TODO إن الـ active-only count محتاج status filter في S5).

**قرارات دقيقة اتأخدت أثناء التنفيذ:**
1. **status badge أُعيد كتابته لـ 5 قيم backend** (`DRAFT/IN_PROGRESS/ON_HOLD/COMPLETED/CANCELLED`) بدل الـ 4 UI. مفيش i18n keys لـ DRAFT/CANCELLED → labels bilingual inline؛ التلات التانيين يعيدوا استخدام مفاتيح `Common` الموجودة. **"delayed" اتشال كـ row status** — مفيش backend equivalent (concept مشتق من الـ timeline، بيعيش في الـ Detail/S7).
2. **`formatMoney` helper** — `totalBudget` بيوصل string (Decimal) → `Number()` + `Intl.NumberFormat` + tag عملة حسب الـ locale.
3. **الـ expanded row اتربط بـ list payload بس** — الحقول اللي مش في الـ list response (المستخلصات/الاحتجاز/هامش الربح، تفصيل الـ phases، الـ stakeholders الخارجيين) **مش اتعملها mock مفبرك**؛ بدلها:
   - Financials: `totalBudget` حقيقي كـ contract value + بلوك dashed بـ TODO صريح "المستخلصات والاحتجاز → payments (S7)".
   - Timeline: `remainingDays` **محسوب** من `expectedEndDate` (real) + عدد الـ phases من `_count.phases` (real) + الـ `description` (real).
   - Stakeholders: owner = `client.name` (real) + عدد أعضاء الفريق من `_count.assignments` (real).
4. **الـ navigation اتساب زي ما هو بالظبط** (`./projects/new`, `./projects/${project.id}`) — مش من scope المرحلة تغيير سلوك التنقّل.
5. **search/filters اتساب UI-only** بـ TODO صريح (الخطة مذكرتش الـ search wiring في المرحلة 3 — تفادي scope creep).
6. حذف import مش مستخدم (`TrendingUp`) + الـ interfaces القديمة (`EnterpriseProject`/`ProjectPhase` المحلية).

**انحرافات عن الـ Plan:**
- لا يوجد جوهري. الخطة قالت "financial mini-dashboard يفضل mock مع TODO" — نفّذت أدق من كده: ربطت كل حقل متاح في الـ list payload وسِبت بس اللي مش موجود فعلاً كـ TODO (أصدق من mock مفبرك). ده في اتجاه الخطة مش ضدها.

**ملاحظات:**
- صفر تأثير على طبقة الـ auth أو باقي الصفحات. الـ styling/JSX الأصلي محفوظ.

## Verification (literal) — بعد المرحلة 3

الأمر: `npx tsc --noEmit` داخل `apps/web`.

```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ accessToken: null; user: null; pendingRegistration: null; setSession: ({ accessToken, user }: { accessToken: string; user: AuthUser; }) => void; setAccessToken: (accessToken: string) => void; setPendingRegistration: (pendingRegistration: PendingRegistration) => void; clearPendingRegistration: () => void; clear: ()...' but required in type 'AuthState'.
```

**نفس الـ 5 أخطاء pre-existing بالظبط — صفر خطأ جديد من المرحلة 3.** (تحقّقت كمان إن كل الـ i18n keys المستخدمة موجودة: `loading` تحت `Common`، والباقي مستخدم أصلاً في النسخة القديمة.)

---

✋ تم المبرمج (المرحلة 3) — للمرحلة 4 (ربط Detail page)؟

---

## المرحلة 4: ربط Detail page — ✅

**الملفات المعدّلة:**
- `apps/web/src/app/[locale]/dashboard/projects/[id]/page.tsx` — استبدال الـ mock object الضخم (590 سطر) بـ `useProject(projectId)`:
  - **loading state** (spinner) + **not-found/error state** (panel بـ رسالة + زر رجوع + retry).
  - **الأقسام المربوطة بـ data حقيقية من الـ detail payload:**
    - Header: `name`, status badge (enum حقيقي 5 قيم), `id`, owner = `client.name`, `description`.
    - KPI strip: `overallProgress`، `totalBudget` (formatMoney)، remaining days (محسوب من `expectedEndDate`)، عدد الفريق (`assignments.length`)، عدد الـ phases.
    - Project info: `startDate`/`expectedEndDate`/`dailyUpdateDeadline`/`location`/`type` (label mapping)، `client.name`/`client.email`.
    - **Phases (REAL):** `project.phases[]` — name/weight/budget/progress/status + completed check + empty state.
    - **Team (REAL):** `project.assignments[]` — user.name/email/roleInProject + **workforce distribution محسوب** بالـ grouping على `roleInProject` + empty state.

**قرارات دقيقة اتأخدت أثناء التنفيذ:**
1. **not-found = `isError` مش redirect** (مطابق لـ decision المرحلة 2 والـ plan المرحلة 4): الـ 404 بيوصل كـ error عادي (مش 401) فالـ guard مايطردش — الصفحة بتعرض panel "المشروع غير موجود" + زر رجوع.
2. **status/phase mapping للـ enums الحقيقية** — `getStatusBadge(ProjectStatus)` (5 قيم) + `isPhaseDone(PhaseStatus)`. الـ getProgressBar اتبسّط لـ `(progress, completed?)`.
3. **workforce distribution من data حقيقية** — reduce/group على `assignments.roleInProject` بدل الـ mock array، مع `ROLE_LABELS` bilingual.
4. **`TYPE_LABELS` + `ROLE_LABELS`** — mapping للـ enum → عربي/إنجليزي (مفيش i18n keys ليهم؛ inline زي المرحلة 3).
5. **الأقسام اللي مفيش لها backend في الـ detail response** (الموقف المالي/المستخلصات، مقاولو الباطن، المخاطر/التنبيهات، سجل النشاطات، المعدات) — **اتشالت الـ mock arrays المفبركة** واتحوّلت لـ **placeholder panels بـ TODO صريح** يوجّه للـ session المناسبة (payments S7 / subcontractors S10 / audit S9 / no-backend). أصدق من عرض بيانات مخترعة، ومتوافق مع قاعدة الـ tracker للـ NO-BACKEND sections.

**انحرافات عن الـ Plan:**
- لا يوجد جوهري — نفس فلسفة المرحلة 3 المعتمدة (real حيث متاح + TODO للباقي). الخطة قالت "core + phases + assignments + KPI مالي mock مع TODO" — اتنفّذ بالظبط، مع تحويل الأقسام المالية/الخارجية لـ placeholders بدل mock مفبرك.

**ملاحظات:**
- تقليص كبير في حجم الملف (شيل ~8 mock arrays ضخمة). صفر تأثير على auth أو صفحات تانية.

## Verification (literal) — بعد المرحلة 4

الأمر: `npx tsc --noEmit` داخل `apps/web`.

```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ accessToken: null; user: null; pendingRegistration: null; setSession: ({ accessToken, user }: { accessToken: string; user: AuthUser; }) => void; setAccessToken: (accessToken: string) => void; setPendingRegistration: (pendingRegistration: PendingRegistration) => void; clearPendingRegistration: () => void; clear: ()...' but required in type 'AuthState'.
```

**نفس الـ 5 أخطاء pre-existing بالظبط — صفر خطأ جديد من المرحلة 4.**

---

✋ تم المبرمج (المرحلة 4) — للمرحلة 5 (ربط Create page)؟

---

## المرحلة 5: ربط Create page (الأعقد) — ✅

**الملفات المعدّلة:**
- `apps/web/src/lib/projects/map-form-to-create-input.ts` (جديد) — **pure function** `mapFormToCreateInput(form: ProjectFormState): CreateProjectInput` + type `ProjectFormState`. مفصولة عن الـ React عمداً عشان تكون spec-able لوحدها (MVT #5). المنطق:
  - `name` + `clientId` دايماً موجودين (required).
  - كل حقل optional يتحط **فقط** لو عنده قيمة حقيقية — الفاضي **يتشال مش يتبعت كـ `""`** (empty string كان هيكسر `@IsDateString`/`@IsNumber`/`@IsEnum` على الـ backend، ودلالياً = "مش متقدّم").
  - `type` يمرّ فقط لو ضمن الـ 3 enum values (`isProjectType` guard) → placeholder `""` مستحيل يوصل الـ wire.
  - `totalBudget`: `Number()` + `Number.isFinite` guard؛ الفاضي/NaN يتشال.
  - `description`/`location` بيتعملهم `.trim()`.
- `apps/web/src/app/[locale]/dashboard/projects/new/page.tsx` — تحويل الـ wizard من uncontrolled + `router.push('./')` وهمي إلى form مربوط فعلياً:
  - **controlled state** واحد (`ProjectFormState`) للحقول الـ backend-backed فقط + `setField` updater generic.
  - **Client selector حقيقي** (Step 1) مدعوم بـ `useClients()` → بيملأ `clientId` (UUID). fallback states: loading (`t("loading")`) / error ("تعذّر تحميل العملاء") / empty ("لا يوجد عملاء بعد"). الـ selector `disabled` أثناء loading/error.
  - **type محاذى للـ enum**: الـ options بقت `FULL_FINISHING | PARTIAL_FINISHING | CONSTRUCTION` بدل residential/commercial/infrastructure.
  - الحقول المربوطة: `name`, `clientId`, `type`, `description` (Step 1)، `location`, `startDate`, `expectedEndDate`, `dailyUpdateDeadline` (Step 2)، `totalBudget` (Step 4).
  - **submit**: `mapFormToCreateInput(form)` → `createProject.mutate(input, { onSuccess: created => router.push(\`./${created.id}\`) })`. الـ `invalidateQueries(['projects'])` في الـ hook نفسه فالـ list بيبقى fresh عند الوصول.
  - **validation guard يدوي** (name + clientId): لأن الـ steps conditionally-rendered، الـ HTML `required` على name المخفي مايـfireش عند submit من Step 5 — فبعمل فحص يدوي، ولو ناقص أرجّع المستخدم لـ Step 1 + رسالة، بدل ما أبعت request الـ backend هيرفضه 400.
  - **عرض الأخطاء**: banner أحمر يعرض `formError` (client-side) أو `backendError` (رسالة الـ interceptor المعرّبة من الـ 400/403). الـ submit button `disabled` + spinner أثناء `isPending`.

**انحرافات عن الـ Plan (مذكورة صراحة — rule: المبرمج مايزيدش/يشيل من غير إبلاغ):**
1. **موقع الـ client selector: Step 1 مش Step 3.** الخطة نصّت "Client selector جديد (Step 1)". لكن الـ form الأصلي كان فيه حقل `client` نصّي حر في **Step 3**. نفّذت زي الخطة (selector في Step 1، جنب name/type/description — الحقول الـ core required)، و**شلت** الـ input النصّي المكرّر من Step 3 (تفادي مفهومين "client" متضاربين). Step 3 اتحوّل لـ UI-only (consultant/contract) مع بانر TODO صريح يوجّه إن العميل الرسمي في Step 1. → انحراف طفيف في اتجاه الخطة، مش ضدها.
2. **إضافة حقل `dailyUpdateDeadline` (time input) في Step 2.** الخطة قالت "لو الحقل مش موجود نبعت default أو نسيبه optional". اخترت أضيف time input حقيقي (backend field فعلي، optional، يتشال لو فاضي) بدل ما أسيب الـ state field ميت بدون UI — أصدق + بلا كلفة. لسه optional تماماً (فاضي → مايتبعتش).

**قرارات دقيقة اتأخدت أثناء التنفيذ:**
1. **الحقول غير-الـ backend اتساب UI-only بـ comments صريحة** (code, contractType, priority, currency, internalBudget/downPayment/retention, workHours→شيلته, constraints, consultant, contract*, workers/managers) — مش اتبعتت. الـ finance منها مؤجّل S7، والـ workers/assign مؤجّل. نفس فلسفة المرحلة 3/4 (real حيث متاح + TODO للباقي، مش mock مفبرك يتبعت).
2. **Step 5 (workforce) بانر TODO صريح** "للعرض فقط... لن تُرسَل" — الـ workers state موجود للـ UX بس مايدخلش الـ `CreateProjectInput`.
3. **redirect نسبي `./${created.id}`** — من `/projects/new` بيحلّ لـ `/projects/{id}` (نفس convention الـ detail/list؛ `router.push('./')` الموجود أصلاً بيروح للـ list، فـ `./${id}` يروح للـ detail).
4. **`retry` مفيش على الـ mutation** (موروث من الـ hook، المرحلة 2) — منع double-create.
5. **رسائل bilingual inline** حيث مفيش i18n keys (client fallback states، بانرات TODO، رسالة الـ validation) — نفس نهج المرحلة 3/4.

**ملاحظات:**
- صفر تأثير على طبقة الـ auth أو صفحات List/Detail. الـ styling/JSX الأصلي محفوظ بالكامل — بس مصدر الـ data اتبدّل + الحقول اتربطت.
- `Calendar` import (كان مستورد وغير مستخدم) بقى مستخدم فعلاً دلوقتي في حقل الـ dailyUpdateDeadline.

## Verification (literal) — بعد المرحلة 5

الأمر: `npx tsc --noEmit` داخل `apps/web`.

```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ accessToken: null; user: null; pendingRegistration: null; setSession: ({ accessToken, user }: { accessToken: string; user: AuthUser; }) => void; setAccessToken: (accessToken: string) => void; setPendingRegistration: (pendingRegistration: PendingRegistration) => void; clearPendingRegistration: () => void; clear: ()...' but required in type 'AuthState'.
```

**نفس الـ 5 أخطاء pre-existing بالظبط — صفر خطأ جديد من المرحلة 5.** الملفّان الجديد/المعدّل (`map-form-to-create-input.ts`, `new/page.tsx`) نضيفان تماماً في الـ output.

---

## ملخص نهائي

- المراحل المكتملة: **5/5** (Types+client → hooks → List → Detail → Create). مرحلة 6 (MVT) = دور المختبر.
- الملفات المعدّلة/الجديدة: 12 (types×1, api-clients×2, hooks×5, pure-mapper×1, pages×3).
- انحرافات عن الـ Plan: 2 طفيفة (موقع الـ selector Step1، إضافة dailyUpdateDeadline) — كلاهما في اتجاه الخطة وموثّق.
- Verification: صفر خطأ tsc جديد عبر الـ 5 مراحل (الـ 5 pre-existing = WEB-TSC-001/002 + WEB-STORE-001، موثّقين خارج scope).

✋ تم المبرمج (المرحلة 5 — كل مراحل التنفيذ خلصت) — للدور التالي (🧠 المخطط، تقرير ما بعد التنفيذ)؟
