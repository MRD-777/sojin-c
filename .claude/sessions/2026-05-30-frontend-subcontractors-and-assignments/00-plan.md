# خطة التنفيذ — Standard Mode

## المشكلة
المستخدم محتاج 4 صفحات frontend (mock-only) تحت module جديد للـ subcontractors + صفحة matrix
للتعيينات. الـ codebase عنده pattern ثابت (next-intl + Shadcn + tokens محددة) لكن:
- 4 Shadcn components ناقصة (`select, dialog, tabs, separator`) لازم تتـ install.
- مفيش keys للـ subcontractors/assignments في `messages/{ar,en}.json` — لازم تتضاف.
- الـ `StatCard` API الفعلي مختلف عن اللي البرومت قاله (مفيش `trendValue`/`description`، الـ trend
  بياخد `{ value, isPositive, label? }`) — لازم نتعامل مع الـ existing API.

## التحليل — Root cause

السبب إن الصفحات دي مش موجودة هو إن الـ subcontractor module لسه في stage الـ design (مفيش backend
schema حتى الآن — راجعت `apps/api/src/modules` ومفيش subcontractors module). الـ user بيريد
mock-only frontend عشان يـ visualize الـ UX قبل ما يبدأ في الـ backend. ده يعني:
- mock data inline (مفيش fetcher، مفيش Zustand store)
- filters local state فقط
- navigation بين الـ pages مهم (compare, [id])
- الـ data shapes تكون consistent مع الـ schema المذكور في البرومت — عشان لما الـ backend يجي
  يكون hookup سهل.

## الحل المقترح — 5 مراحل

### المرحلة 1: تثبيت Shadcn components الناقصة
- **الملفات المنشأة:**
  - `apps/web/src/components/ui/select.tsx`
  - `apps/web/src/components/ui/dialog.tsx`
  - `apps/web/src/components/ui/tabs.tsx`
  - `apps/web/src/components/ui/separator.tsx`
- **الأوامر:** `cd apps/web && npx shadcn@latest add select dialog tabs separator`
- **الـ deps المتوقع إضافتها:** `@radix-ui/react-select`, `@radix-ui/react-dialog`,
  `@radix-ui/react-tabs`, `@radix-ui/react-separator`
- **Risks:**
  - الـ Shadcn CLI ممكن يحاول يـ overwrite ملفات موجودة → نـ confirm "No" لو طلب
  - الـ CLI قد يحتاج `components.json` config موجود — لو مش موجود نـ run `shadcn init` أولاً
  - Tailwind v4 + React 19 compatibility — الـ shadcn@4.x يدعم v4 (بالفعل في الـ deps).

### المرحلة 2: إضافة i18n keys
- **الملفات:** `apps/web/messages/ar.json`, `apps/web/messages/en.json`
- **الـ keys الجديدة:** كلهم تحت `Common`
  - `subcontractors.title, subtitle, count, comparePrices, addNew`
  - `subcontractors.stats.{total, active, avgRating, totalContractValue}`
  - `subcontractors.filters.{searchPlaceholder, specialty, rating, status, viewCards, viewTable}`
  - `subcontractors.card.{currentProjects, totalProjects, totalContracts, viewFull, contact,
    rate, joined, agreed, actual}`
  - `subcontractors.table.{name, specialty, rating, currentProjects, totalContracts, status, actions}`
  - `subcontractors.specialties.{all, electrical, plumbing, painting, ac, gypsum, ceramic, steel}`
  - `subcontractors.status.{all, active, inactive}`
  - `subcontractors.detail.{tabs: {current, history, ratings}, info, terminate, exportReport,
    avgDeviation, contactInfo, notes, ratingForm: {label, save, placeholder}}`
  - `subcontractors.compare.{title, selectPlaceholder, compareBtn, criteria: {...}, recommended}`
  - `team.assignments.{title, addAssignment, filters: {project, role, dailyOnly}, matrix: {...},
    list: {...}, roles: {siteEngineer, supervisor, accountant, worker, foreman},
    dailyUpdate, removed, assignedAt}`
- **Risks:**
  - تضارب key مع keys موجودة → نـ namespace تحت `subcontractors.*` و `team.assignments.*` فقط
  - الـ JSON يكسر لو في trailing commas → نـ validate بـ node بعد التعديل

### المرحلة 3: صفحة subcontractors/page.tsx (قائمة)
- **الملف:** `apps/web/src/app/[locale]/dashboard/subcontractors/page.tsx`
- **العناصر:**
  - Header مع Breadcrumbs + title + count badge + 2 buttons (إضافة، مقارنة)
  - Stats Row: 4 × StatCard (total, active, avgRating, totalContractValue)
  - Filters Bar: Input بحث + 3 × Select (specialty, rating, status) + toggle عرض (cards/table)
  - عرض الكروت (default): grid `md:grid-cols-2 lg:grid-cols-3` — بطاقة كاملة لكل مقاول
  - عرض الجدول (alternative): Table مع نفس الأعمدة
  - Dialog "إضافة مقاول جديد" — form بسيط (visual فقط، مفيش submit logic حقيقي)
- **Mock data:** 8 مقاولين متنوعين (تخصصات، تقييمات 3.1-4.8، 1 inactive)
- **Risks:**
  - الـ rating stars: استخدم `Star` icon من Lucide مع `fill-current` للـ filled
  - الـ filter logic لازم client-side `useMemo` على الـ MOCK_DATA
  - زر "عرض الملف الكامل" → `router.push` بـ `next/navigation` (App Router)

### المرحلة 4: صفحتين فرعيتين (detail + compare)
- **`subcontractors/[id]/page.tsx`:**
  - `params: { id: string, locale: string }` — Next 16 يـ pass الـ params كـ Promise، لازم نتعامل
    مع ده (نقرأ docs محلية لو متاحة، أو نستخدم `use(params)` hook من React 19)
  - في Next 16 الـ params في server components Promise. لكن إحنا `'use client'` → نستخدم
    `React.use(params)` لـ unwrap
  - Tabs 3: المشاريع الحالية / السجل / التقييمات
  - Form إضافة تقييم: select stars (1-5) + textarea + button (visual فقط)
- **`subcontractors/compare/page.tsx`:**
  - 4 Select boxes لاختيار المقاولين (مع option "اختر…")
  - زر "قارن" → state يـ trigger الـ table
  - Table مقارنة (criteria في rows، contractors في columns)
  - Optional: bar chart بسيط بـ Recharts لو الوقت سمح — نـ skip لو طول الـ session

### المرحلة 5: صفحة team/assignments matrix
- **الملف:** `apps/web/src/app/[locale]/dashboard/team/assignments/page.tsx`
- **العناصر:**
  - Header + Filters Bar + Toggle (matrix/list)
  - Matrix view (default): grid بـ employees rows × projects columns. كل خلية بـ badge للدور
    (لون مختلف حسب الدور: مهندس=أزرق، مشرف=برتقالي، محاسب=أخضر، عامل=رمادي، مقدم=بنفسجي)
  - 📅 icon لو `is_required_daily_update`
  - أعمدة المشاريع المتوقفة لها خلفية خفيفة
  - Tooltip على كل خلية: تاريخ التعيين
  - List view: Table تفصيلية
- **Mock data:** 5 موظفين × 4 مشاريع (واحد متوقف، واحد مكتمل، اتنين نشطين)
- **Risks:**
  - الـ Tooltip من `@/components/ui/tooltip` لازم يكون wrapped بـ TooltipProvider — نـ check
    موجود في الـ layout أم لازم نضيفه

## الـ Skills المطلوبة
- **Shadcn CLI** → `npx shadcn@latest add <component>` داخل `apps/web/`
- **next-intl v4** → `useTranslations` + namespace navigation
- **Lucide React 1.x** → الـ icons المذكورة في scope
- **React 19 + Next 16** → `React.use(params)` للـ dynamic routes في client components
- **Recharts 3.x** → optional bar chart in compare (موجود في `team-charts.tsx` كـ reference)

## نقاط القرار
1. **الـ chart في compare page**: skip للـ MVT، نضيفه لو وقت السساعة سمح. الـ table المقارنة كافية
   functionally.
2. **Dialog "إضافة مقاول"**: visual فقط — form fields بدون validation أو submission. نعرض toast (لو
   sonner موجود) أو نقفل الـ dialog فقط.
3. **`router.push` للـ navigation داخل الـ [id]**: نـ encode الـ locale prefix manually أو نعتمد
   على `next-intl` middleware. الـ existing pattern في الصفحات يستخدم Link href مع locale prefix
   implicit — نتبعها.
4. **الـ params في `[id]/page.tsx`**: Next 16 يستخدم Promise. هنـ استخدم `React.use(params)` للـ
   client component. ده tested approach في React 19.

## التأثير على الـ Codebase الحالي
- `components/ui/{select,dialog,tabs,separator}.tsx` → ملفات جديدة. لا تأثير على الموجود.
- `messages/{ar,en}.json` → keys جديدة فقط تحت namespace جديد. لا تأثير على keys موجودة.
- `package.json` → 4 deps جديدة (@radix-ui/react-*) — additive، لا breaking.
- لا تعديلات على layouts، sidebars، أو global state.

## تعريف النجاح
- [ ] Shadcn 4 components install ناجح، الـ files موجودة، tsc يـ pass
- [ ] i18n keys مضافة في AR + EN، الـ JSON valid
- [ ] 4 pages compile ومفيش runtime errors عند الفتح
- [ ] Filters تأثر فعلياً على الـ rendered cards/rows
- [ ] Navigation: card "عرض الملف الكامل" → `[id]` يشتغل، Breadcrumb يرجع للقائمة
- [ ] Dialog "إضافة" يفتح ويقفل
- [ ] Tabs في `[id]` تبدّل بين 3 tabs
- [ ] Matrix view يعرض الـ 5×4 grid بألوان مختلفة حسب الدور
- [ ] **MVT: 4 specs مكتوبة وpassing** (1 spec لكل page)
  - **MVT budget breakdown:**
    1. `subcontractors/page.tsx` — render + filter by specialty يقلل count
    2. `subcontractors/[id]/page.tsx` — render + tab switching changes content
    3. `subcontractors/compare/page.tsx` — render + selecting contractors يـ enable compare button
    4. `team/assignments/page.tsx` — render matrix + role filter يـ hide cells

## ملاحظات للمختبر
- استخدم `@testing-library/react` + `vitest` (لو الـ web app عنده test setup). لو مفيش، استخدم
  `@testing-library/react` مع `jest` أو نخلي MVT كـ smoke tests على mock data في الـ module
  المنفصل (pure JS — كـ `filter helpers`).
- لو الـ setup مش جاهز للـ React testing → اكتب MVT للـ helper functions اللي بيـ filter الـ
  MOCK_DATA (مثلاً `filterBySpecialty(contractors, 'electrical')`). ده يحقق rule #2.

## نقاط الـ Pause إجبارية
1. بعد المرحلة 1 (تثبيت components) → المبرمج يـ verify الـ install قبل ما يبدأ المرحلة 2
2. بعد كل مرحلة في `02-coder-report.md` يـ append section جديد (تراكمي)
3. في النهاية يقدم الـ literal verification output (jest stdout + tsc stderr) في الـ report

---

⏸️ AWAITING APPROVAL
رد بـ "approve" للمتابعة للمبرمج، أو "edit: [تعديل]" لو حاجة محتاجة تعديل.

✋ تم المخطط — للدور التالي (المبرمج)؟
