# تقرير المبرمج — WEB-S4-P7-001

## التغييرات

- `apps/web/src/app/[locale]/dashboard/projects/reviews/page.tsx` — **rewrite كامل**: حُذف الـ mock (`ReviewItem`، `reviewItems`، helpers `getPriority/getSLA/getTypeIcon`) وحلّ محلّه منتقي مشاريع فوق `useProjects()` مع حالات loading / error (+ retry) / empty، وبطاقات مشاريع حقيقية (اسم + عميل + عدد المراحل + status badge). كل بطاقة (click + keyboard Enter/Space + زر "مراجعة التحديثات") → `router.push(\`./${id}?tab=reviews\`)`. الـ header وi18n key `nav.projects_reviews` محفوظان كما هما. صفر `ReviewItem` mock متبقٍّ (تحقّق grep = 0).
- `apps/web/src/app/[locale]/dashboard/projects/[id]/page.tsx` — **تعديل موضعي (نقطة القرار #1، معتمدة)**: أُضيف `useSearchParams` للـ import (سطر 5)، والقيمة الابتدائية لـ `detailTab` صارت تقرأ `?tab=reviews` مرة واحدة (سطر 84–86): `searchParams.get("tab") === "reviews" ? "reviews" : "phases"`. **أحادي الاتجاه** فقط — لا كتابة على الـ URL عند تبديل التبويب (bidirectional sync يظل مؤجّلاً كما نصّ الـ scope). صفر تغيير على منطق التبويبات، `ReviewsPanel`، أو حاملات الـ Idempotency-Key.

**انحرافات عن الـ Scope:** لا يوجد. نقطة القرار #1 (`?tab=reviews` deep-link) اعتُمدت صراحة، والحدود احتُرمت (صفر badge عدّاد PENDING، صفر bidirectional sync، صفر لمس لطبقة الـ updates/client.ts).

**قراءة docs (توجيه `apps/web/AGENTS.md`):** `useSearchParams` مستخدم داخل client component (`"use client"` أعلى الملفين) — لا حاجة لـ `<Suspense>` boundary هنا لأن الصفحتين client-rendered بالكامل، ونمط الاستخدام هو قراءة أولية داخل `useState` initializer (لا يُعلّق الـ render).

## Verification (literal)

### tsc (`npx tsc --noEmit`) — 5 أخطاء، كلها baseline، صفر جديد

```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ accessToken: null; user: null; pendingRegistration: null; setSession: ({ accessToken, user }: { accessToken: string; user: AuthUser; }) => void; setAccessToken: (accessToken: string) => void; setPendingRegistration: (pendingRegistration: PendingRegistration) => void; clearPendingRegistration: () => void; clear: ()...' but required in type 'AuthState'.
```

مطابقة الـ baseline (WEB-TSC-001 ×2 = `cn` + `alignment`، WEB-TSC-002 ×2 = `NODE_ENV`، WEB-STORE-001 = `setUser`). صفر خطأ في `reviews/page.tsx` أو `[id]/page.tsx`. ✅

### vitest (`npx vitest run`) — لا regression

```
 Test Files  14 passed (14)
      Tests  44 passed (44)
   Start at  19:43:00
   Duration  21.47s
```

الملفات الحسّاسة للتغيير (`use-project.spec.tsx`, `use-projects.spec.tsx`, `updates-client.spec.ts`, `idempotency-key.spec.ts`) كلها passing — صفر regression على طبقة الـ updates/projects المقفولة في S4. ✅

## ملاحظات

- الكود كان منفَّذاً بالكامل على القرص عند بداية هذا التقرير (نُفِّذ في سياق سابق)؛ هذا الدور تحقّق منه literally (grep للـ mock = 0، tsc، vitest) ووثّقه.
- **تعريف النجاح — كله مُحقَّق:**
  - [x] `reviews/page.tsx` يعرض مشاريع حقيقية من `useProjects()` مع loading/empty/error.
  - [x] كل مشروع يـ link لـ `dashboard/projects/[id]?tab=reviews`.
  - [x] project detail يفتح على تبويب المراجعات مع `?tab=reviews`، وعلى المراحل افتراضياً بدونه (صفر regression على المسار العادي).
  - [x] صفر `ReviewItem` mock متبقٍّ؛ صفر خطأ tsc جديد فوق الـ 5 baseline.
  - [x] نمط استخدام `useSearchParams` (client component + قراءة أولية) روجع مقابل توجيه `apps/web/AGENTS.md`.
- **مؤجّل (خارج النطاق، مؤكَّد):** badge عدّاد PENDING لكل مشروع (يحتاج endpoint خلفي)، وbidirectional URL↔tab sync، وsearch/filter wiring على المنتقي.

✋ تم — الـ session مقفولة.
