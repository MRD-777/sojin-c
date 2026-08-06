# Scope

## Mode: Standard
السبب: feature متوسطة — 4 صفحات frontend mock متعددة مع filters/stats/tabs، مفيش business logic
حساس ولا auth/payments. الـ Standard mode (مخطط → مبرمج → مختبر) كافي.

## المهمة
بناء 4 صفحات frontend mock-only في `apps/web` تحت module الـ subcontractors + team assignments
matrix. كل البيانات mock inline. مفيش API/DB. الـ pages تتبع الـ patterns الموجودة في الـ codebase
(useTranslations + Shadcn UI + design tokens القائمة).

## الملفات المتأثرة

### Pages جديدة (4 ملفات)
- `apps/web/src/app/[locale]/dashboard/subcontractors/page.tsx` — قائمة المقاولين (كروت + جدول)
- `apps/web/src/app/[locale]/dashboard/subcontractors/[id]/page.tsx` — صفحة المقاول التفصيلية (Tabs)
- `apps/web/src/app/[locale]/dashboard/subcontractors/compare/page.tsx` — مقارنة 2-4 مقاولين
- `apps/web/src/app/[locale]/dashboard/team/assignments/page.tsx` — Matrix view للتعيينات

### Components Shadcn ناقصة — لازم تُضاف via Shadcn CLI قبل الـ pages
- `apps/web/src/components/ui/select.tsx` — جديد (للفلاتر)
- `apps/web/src/components/ui/dialog.tsx` — جديد (إضافة مقاول، confirmation)
- `apps/web/src/components/ui/tabs.tsx` — جديد (صفحة [id])
- `apps/web/src/components/ui/separator.tsx` — جديد (visual dividers)

### ملفات i18n (تعديل)
- `apps/web/messages/ar.json` — إضافة keys تحت `Common.subcontractors.*` و `Common.team.assignments.*`
- `apps/web/messages/en.json` — نفس الـ keys بالـ EN translations

### Optional (لو احتجنا)
- `apps/web/src/components/dashboard/subcontractor-charts.tsx` — Recharts bar chart للـ compare page

## الـ Skills المستخدمة
- Shadcn CLI — `npx shadcn@latest add select dialog tabs separator` داخل `apps/web/`
- next-intl v4 patterns — موجودة في الصفحات الحالية (مرجع: `team/page.tsx`)
- Recharts — موجودة في `team-charts.tsx` كمرجع للـ chart في compare page
- Lucide React icons — كل الصفحات

## الحدود (خارج نطاق هذا الـ session)
- ❌ مفيش API calls — كل البيانات mock thoroughly inline
- ❌ مفيش Zustand global state — local `useState` فقط للـ filters/dialogs
- ❌ مفيش backend wiring — مفيش Prisma schema، مفيش endpoints
- ❌ مفيش charts معقدة — bar chart واحدة بسيطة في compare page (لو الوقت سمح)
- ❌ مفيش navigation links في الـ sidebar (الـ user يطلبها separately لو احتاج)
- ❌ مفيش tests كاملة بـ Playwright — MVT بـ vitest/jest render tests فقط (rule #2)
- ❌ مفيش form validation كاملة على Dialog إضافة المقاول — visual demo فقط
- ❌ مفيش dark mode tweaks خارج الـ tokens الموجودة

## ملاحظات حرجة من فحص الـ codebase

1. **مسار الـ routes**: الـ existing structure هو `[locale]/dashboard/...` مباشرة (مش `(dashboard)` route
   group). اتبعنا الـ existing.

2. **i18n إجباري**: كل الصفحات الموجودة بتستخدم `useTranslations` + `messages/{ar,en}.json`. لا inline
   Arabic. ده يحفظ الـ EN locale working.

3. **Components Naming**: الـ Shadcn CLI سيـ install الـ components بـ كل subcomponents (مثلاً
   `SelectTrigger, SelectContent, SelectItem`)، نتأكد إن الـ generated files compatible مع الـ tailwind
   v4 + React 19 (الـ project نسخته `shadcn@4.5.0` مثبت بالفعل في الـ deps).

4. **Next.js 16 warning**: `apps/web/AGENTS.md` يحذر إن ده مش Next.js المعروف. هنلتزم بالـ patterns
   الموجودة في الصفحات الحالية كـ ground truth، مش memory.

5. **`useLocale` + `isAr` pattern**: كل صفحة في الـ codebase بتستخدم `isAr = locale === 'ar'` لتطبيق
   `text-right` / `pr-10` / `pl-10` على الـ inputs والـ tables. هنتبع نفس الـ pattern.

6. **Lucide React version**: `lucide-react: ^1.11.0` — نسخة قديمة. أيقونات مثل `Star, ArrowLeft, Phone,
   Mail, Plus, Search, Filter, MoreVertical, Building2, Users, TrendingUp, TrendingDown, BarChart3,
   Calendar` كلها موجودة في النسخة دي.

## تعريف النجاح
- [ ] 4 components Shadcn جديدة مضافة وتـ compile بدون errors
- [ ] 4 pages تُـ render في الـ dev server بدون runtime errors
- [ ] كل النصوص في الـ pages تيجي من `messages/{ar,en}.json` (مفيش Arabic inline في JSX)
- [ ] Filters (search, select dropdowns) تأثر على الـ displayed mock data
- [ ] الـ navigation من card → `/dashboard/subcontractors/[id]` يشتغل
- [ ] dark mode لا يكسر visually
- [ ] **MVT: 4 specs مكتوبة وpassing** (1 لكل page — render + basic interaction). يحدد المخطط الـ
  exact budget في `00-plan.md`.

---

⏸️ AWAITING APPROVAL — رد بـ "approve" للبداية أو "edit: [تعديل]" للتعديل.

✋ تم Scope — للدور التالي (المخطط)؟
