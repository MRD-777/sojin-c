# Frontend Status — apps/web

> آخر تحديث: 2026-05-16
> Stack: Next.js 16.2.3 (App Router) · React 19.2.4 · TypeScript strict · Tailwind v4 · Shadcn UI · next-intl v4 · Supabase SSR · Zustand v5

---

## 1) النظرة العامة (TL;DR)

الفرونت **UI-complete تقريباً للـ MVP**، لكنه **مفصول تماماً عن الـ API**.
كل البيانات اللي بتظهر دلوقتي **mock / hardcoded** داخل الـ page components.
الـ Auth (login/register/setup-workspace) شغّال فعلياً مع Supabase مباشرة، من غير ما يمر على NestJS.

```
✅ UI Layer        ───────────────────────  ~85%
⚠️ Auth Layer      ───────────────────  ~65% (Supabase direct، فيه bugs)
❌ Data Layer      ──                          0% (مفيش API client، مفيش hooks)
❌ Realtime/Chat   ──                          0%
❌ File uploads    ──                          0%
```

---

## 2) ✅ اللي اتعمل بالكامل (Done)

### 2.1 Infrastructure & Tooling
- [x] Turborepo monorepo مع `apps/web` و `apps/api` و `packages/shared-types`.
- [x] Next.js 16 + React 19 + TypeScript strict — يبني بدون أخطاء.
- [x] Tailwind v4 + Shadcn UI components (15 component) في `src/components/ui/`.
- [x] ESLint config + tsconfig.
- [x] Theme system (Light/Dark) عبر `next-themes` + `ThemeProvider`.
- [x] Color tokens موحّدة (#111 / #666 / black-white-overlays) عبر كل الصفحات.

### 2.2 i18n (Internationalization)
- [x] `next-intl` v4 شغّال بالكامل (AR default + EN).
- [x] Locale prefix في الـ URL (`/ar/...`, `/en/...`).
- [x] `i18n/routing.ts` + `i18n/request.ts` متضبطين.
- [x] `messages/ar.json` و `messages/en.json` فيهم **1603 line لكل واحد** — كل النصوص متترجمة.
- [x] `LanguageSwitcher` component جاهز.
- [x] RTL handling في الـ layout.

### 2.3 Routing & Middleware
- [x] `[locale]` segment + auth/dashboard route groups.
- [x] `middleware.ts` بيدمج `next-intl` + Supabase session check + redirect logic.
- [x] Auth pages: `(auth)/login`, `(auth)/register`, `(auth)/setup-workspace`.
- [x] Public marketing pages: `/`, `/about`, `/contact`, `/pricing`, `/solutions`.
- [x] Dashboard routes (كلهم موجودين كـ `page.tsx`):
  - `dashboard/` (overview)
  - `dashboard/projects/` + `projects/[id]` + `projects/new` + `projects/reviews` + `projects/sla`
  - `dashboard/finance/` + `payments` + `invoices` + `petty-cash` + `profitability` + `reconciliation`
  - `dashboard/team/` + `org-chart` + `attendance` + `leaves` + `performance` + `permissions` + `safety` + `training`
  - `dashboard/audit/`
  - `dashboard/reports/`
- [x] `loading.tsx`, `error.tsx`, `not-found.tsx` على مستوى dashboard.

### 2.4 Auth (Frontend side — Supabase Direct)
- [x] `src/lib/supabase/client.ts` + `server.ts` (SSR-ready).
- [x] Server Action: `login` — يستخدم `signInWithPassword`، يـ map الـ errors لكودات عربية.
- [x] Server Action: `registerManager` — `signUp` + user metadata (firstName/lastName/phone/role).
- [x] Server Action: `setupWorkspace` — Zod validation + يكتب على `companies` و `users` tables مباشرة من Supabase.
- [x] صفحات Login + Register + Setup-Workspace فيها form validation كاملة + error messages بالعربي.
- [x] Middleware يحمي `/dashboard/*` من unauthenticated users (مع dev bypass).

### 2.5 Dashboard Layout
- [x] `DashboardLayoutWrapper` — wrapper كامل.
- [x] **PrimarySidebar** (w-16, dark `bg-[#111]`, icon-only) — desktop + mobile bottom nav variant.
- [x] **SecondarySidebar** (collapsible, text labels) — مع `secondaryNavigation` mapping per primary item.
- [x] **TopHeader** — search + theme toggle + language switcher + user menu.
- [x] **Zustand stores**: `use-sidebar-store.ts` (active item, collapsed state) + `use-ui-store.ts` (command palette).
- [x] **CommandPalette** component موجود في `ui/command-palette.tsx`.
- [x] Navigation config مركزي في `src/config/navigation.ts` (primary + secondary + bottom + roles field).

### 2.6 Reusable Dashboard Components (`components/dashboard/global/`)
- [x] `StatCard` — KPI card مع trend indicator.
- [x] `ProgressBar` — موحّد عبر كل الـ pages.
- [x] `StatusBadge` — لكل الحالات.
- [x] `Breadcrumbs` — auto-generated من الـ pathname.
- [x] `EmptyState` — placeholder.

### 2.7 Chart Components (Recharts v3)
- [x] `overview-charts.tsx` — `CashFlowChart` + `ProjectsPhaseChart`.
- [x] `finance-charts.tsx` — finance-specific charts.
- [x] `team-charts.tsx` — team-specific charts.
- [x] كلهم Load بـ `dynamic(..., { ssr: false })` + skeleton fallback.

### 2.8 Landing Page (`components/landing/`)
- [x] `HeroSection` + `BentoFeatures` + `BlueprintGrid` + `SocialProof` + `FinalCta` + `Footer` + `Header`/`LandingHeader` + `MouseBg`.
- [x] Framer Motion + GSAP animations مفعّلة.

### 2.9 Pages — UI Done (with mock data)
كل الـ pages دي مبنية بالكامل من ناحية الـ UI/UX، لكن كل البيانات mock:

| Page | LOC | الحالة |
|---|---|---|
| `dashboard/page.tsx` | 217 | ✅ KPIs + 2 charts |
| `dashboard/projects/page.tsx` | 431 | ✅ List + filters + status badges |
| `dashboard/projects/[id]/page.tsx` | 590 | ✅ Detail view (phases, updates, payments, team) |
| `dashboard/projects/new/page.tsx` | 504 | ✅ Multi-step create form |
| `dashboard/projects/reviews/page.tsx` | 220 | ✅ Review inbox UI |
| `dashboard/projects/sla/page.tsx` | 217 | ✅ SLA tracker UI |
| `dashboard/finance/page.tsx` | — | ✅ Finance overview |
| `dashboard/finance/payments/page.tsx` | 244 | ✅ Payments list |
| `dashboard/finance/invoices/page.tsx` | 266 | ✅ Invoices list |
| `dashboard/finance/petty-cash/page.tsx` | 260 | ✅ Petty cash UI |
| `dashboard/finance/profitability/page.tsx` | 250 | ✅ Profitability dashboard |
| `dashboard/finance/reconciliation/page.tsx` | 269 | ✅ Reconciliation UI |
| `dashboard/team/page.tsx` | — | ✅ Team overview |
| `dashboard/team/attendance/page.tsx` | 378 | ✅ Attendance UI |
| `dashboard/team/leaves/page.tsx` | 307 | ✅ Leaves UI |
| `dashboard/team/org-chart/page.tsx` | 452 | ✅ Org chart |
| `dashboard/team/performance/page.tsx` | 329 | ✅ Performance UI |
| `dashboard/team/permissions/page.tsx` | 309 | ✅ Permissions matrix UI |
| `dashboard/team/safety/page.tsx` | 331 | ✅ Safety UI |
| `dashboard/team/training/page.tsx` | 306 | ✅ Training UI |
| `dashboard/audit/page.tsx` | 263 | ✅ Audit trail UI |
| `dashboard/reports/page.tsx` | 204 | ✅ Reports UI |

---

## 3) ⚠️ شغّال لكن فيه مشاكل (Partial / Buggy)

### 3.1 Auth Architecture Conflict
- الفرونت بيتكلم Supabase **مباشرة** (Server Actions).
- الـ NestJS API عنده `POST /auth/register-company` endpoint جاهز ومش مستخدم.
- **القرار لسه معلّق**: نتوحد على NestJS API ولا نفضل Supabase direct؟
- النتيجة: مفيش transaction guarantees بين `companies` و `users` insert في `setupWorkspace` — لو الـ user insert فشل بعد company insert، الـ company بيفضل orphan.

### 3.2 setup-workspace Redirect Bug
- `actions.ts:172` بيـ return `redirectUrl: "pricing"` بدل `"dashboard"`.
- المفروض بعد إنشاء الـ workspace يروح dashboard مش pricing.

### 3.3 Dev Middleware Bypass
- `middleware.ts:42`: لو `NODE_ENV !== 'development'` بيـ skip الـ redirect.
- يعني في dev الـ unauthenticated user يقدر يدخل `/dashboard` ويشوف الـ mock data.
- **خطر**: لو حد نسي يـ test في production-mode، ممكن يـ ship feature معتمدة على dev bypass.

### 3.4 Secondary Sidebar Doesn't Filter by Role
- `config/navigation.ts` فيه `roles: [...]` field على كل nav item.
- لكن الـ Sidebar components مش بتقرأ الـ field ده — كل users بيشوفوا كل الـ items.
- معناه `CLIENT` ممكن يشوف entry للـ Finance/Audit (لو دخل بـ URL مباشر هيتـ block من الـ backend، لكن الـ UX مش نظيف).

### 3.5 Navigation Config — Routes غير موجودة
في `navigation.ts` items بتشاور على routes مش متبنية:
- `/dashboard/subcontractors` + `/payments` + `/compare` — مفيش `page.tsx`.
- `/dashboard/chat` — مفيش `page.tsx`.
- `/dashboard/settings` + `/subscription` + `/workflow` — مفيش `page.tsx`.
- `/dashboard/profile` — مفيش `page.tsx`.
- `/dashboard/team/assignments` — مفيش `page.tsx`.

أي user يدوس عليهم هيقع على 404.

### 3.6 Mock Data في كل مكان
- KPIs زي `value="12"`, `"$2.4M"`, `"450"` hardcoded في `dashboard/page.tsx`.
- نفس الحالة في projects/finance/team/audit. مفيش data fetching حقيقي خالص.

---

## 4) ❌ اللي لسه ناقص (Pending)

### 4.1 Data Layer — أهم Gap في الفرونت
- [ ] **مفيش `src/lib/api.ts`** — axios client مش متعمل.
- [ ] **مفيش axios-retry config** — المكتبة متثبتة بس.
- [ ] **مفيش interceptors** للـ JWT attachment أو refresh token.
- [ ] **مفيش `unwrap` helper** للـ `TransformInterceptor` response format (`{success, data, meta}`).
- [ ] **مفيش React Query hooks** — `@tanstack/react-query` متثبت لكن `QueryProvider` ممكن مش متربط بالـ layout (لازم نتأكد).
- [ ] **مفيش query keys factory** ولا types مشتركة من `packages/shared-types`.
- [ ] **مفيش error handling layer** (toast على network errors، retry logic، إلخ).
- [ ] **مفيش optimistic updates** ولا cache invalidation strategy.

### 4.2 Pages مفقودة بالكامل
- [ ] `dashboard/subcontractors/` (list + detail + payments + compare-prices).
- [ ] `dashboard/chat/` (chat rooms list + chat thread + composer).
- [ ] `dashboard/settings/` (company info + subscription + workflow rules).
- [ ] `dashboard/profile/` (user profile + change password + preferences).
- [ ] `dashboard/team/assignments/` (project assignments matrix).

### 4.3 Auth — Missing Flows
- [ ] **Logout** — مفيش server action ولا button مفعّل.
- [ ] **Forgot password** flow.
- [ ] **Reset password** page + token handling.
- [ ] **Email verification** flow (لو الـ Supabase project طالبه).
- [ ] **OAuth providers** (Google/Microsoft) — لو هيتعملوا.
- [ ] **Invite teammates** flow (POST to API → email link → set password).

### 4.4 Real-Data Wiring (per feature)
أي page دلوقتي عاوزة:
1. RBAC check (يا client-side يا server-side).
2. API call مع `companyId` implicit.
3. Loading / error / empty states.
4. Pagination (الـ API بيدعمها في `meta`).
5. Filters + sorting سيرفر-side.

Pages اللي تحتاج wiring (priority order):
- [ ] **Projects list + detail** (الأهم — قلب النظام).
- [ ] **Project create form** (POST + redirect).
- [ ] **Updates workflow** (DRAFT → PENDING → APPROVED + media + comments + versioning).
- [ ] **Review inbox** (PENDING updates عبر كل المشاريع).
- [ ] **SLA tracker** (deadlines + overdue logic).
- [ ] **Dashboard overview** (KPIs aggregations من الـ API).
- [ ] **Finance pages** (payments + invoices + petty-cash + profitability + reconciliation).
- [ ] **Team pages** (members + attendance + leaves + permissions + إلخ).
- [ ] **Audit trail** (paginated + filter by entity/user/action).
- [ ] **Reports** (export CSV/PDF).

### 4.5 Forms & Mutations
- [ ] **Form library decision**: react-hook-form ولا الاكتفاء بـ FormData + Zod؟ (دلوقتي auth شغّال بـ FormData).
- [ ] **DTO sharing**: نقل Zod schemas من `packages/shared-types` ليتشاركوا مع الـ API.
- [ ] **Server Actions vs Mutations**: قرار consistency — كل CRUD يا Server Actions يا React Query mutations.

### 4.6 File Uploads (للـ Media on Updates)
- [ ] Drag-and-drop component.
- [ ] Multi-file selection.
- [ ] Image preview + cropping.
- [ ] Upload progress.
- [ ] **يعتمد على الـ backend**: الـ API لسه ما عملش Supabase Storage integration.

### 4.7 Realtime
- [ ] **Chat**: لا Supabase Realtime ولا WebSocket محضّر.
- [ ] **Notifications bell**: مفيش subscription على notifications.
- [ ] **Live update on project review**: لو engineer قدم update، الـ PM المفروض يشوفها في الـ inbox فوراً.

### 4.8 Permissions on UI Layer
- [ ] قراءة `permissions[]` من الـ JWT (مش متخزّن في الـ client دلوقتي).
- [ ] `<PermissionGate permission="...">` component للـ conditional rendering.
- [ ] Filter `navigation.ts` items بالـ role/permissions في الـ sidebars.
- [ ] Hide CRUD buttons (Edit/Delete/Force-Cancel) من اللي مش معاهم الصلاحية.

### 4.9 UX Polish
- [ ] **Toast standardization** — `sonner` متثبتة لكن مش معروف لو متبَّقة في كل الـ actions.
- [ ] **Skeleton states** متّسقة عبر كل الـ data fetches.
- [ ] **Empty states** فعلية (مش بس component).
- [ ] **Confirmation dialogs** للـ destructive actions (delete project, force-cancel update).
- [ ] **Keyboard shortcuts** — CommandPalette موجود بس مش معروف الـ shortcuts.

### 4.10 Testing
- [ ] **مفيش tests** خالص. لا unit ولا E2E.
- [ ] Playwright/Vitest قرار pending.

### 4.11 Build & Production
- [ ] **Sentry / error tracking** مش مربوط.
- [ ] **Analytics** مش مربوط.
- [ ] **Env validation** (مثلاً `t3-env` ولا zod schema للـ env vars).
- [ ] **next.config.ts**: لازم review للـ image domains, headers, redirects للـ production.
- [ ] **PWA / offline support** — لو الـ site engineers هيستخدموا التطبيق من موقع البناء.

---

## 5) Files تستحق التنظيف

ملفات موجودة وممكن تكون unused / debug-only:
- `supabase_test.ts` (في root الـ web app).
- `supabase_test_simple.cjs`.
- `update_json.js`.
- `messages/analyze_json.py`.
- مجلد `تفاصيل المشروع` في root الـ web app.

يفضّل يتأكد منهم ويتشالوا قبل production.

---

## 6) أولوياتي المقترحة (Recommended Sequence)

1. **حسم قرار الـ Auth architecture** (Supabase direct ولا NestJS API). كل حاجة بعد كده بتتبني على القرار ده.
2. **فيكس setup-workspace redirect** + **logout flow**.
3. **بناء `lib/api.ts`** (axios + retry + JWT interceptor + `unwrap` helper).
4. **ربط `QueryProvider` بالـ root layout** + إنشاء query keys factory.
5. **ربط Projects list ثم Project detail** كأول real feature (الأهم business-wise).
6. **Updates workflow كاملة** (DRAFT → PENDING → APPROVED + Review Inbox + SLA).
7. **File upload component** + ربطه بـ Media on Updates (لما الـ backend يجهّز Supabase Storage).
8. **Settings + Profile + Subscriptions pages** (مش موجودين أصلاً).
9. **Subcontractors + Chat** (لو Chat هيستخدم Supabase Realtime).
10. **Permissions/Role gating** في الـ UI layer.
11. **Testing layer** + Sentry + Analytics قبل ما نـ ship.

---

## 7) ملخص الأرقام

- **~30 page** في الـ App Router (Auth + Dashboard + Marketing).
- **~15 reusable UI components** في `components/ui/`.
- **~10 dashboard composite components** (sidebars, header, charts, globals).
- **~9 landing page components**.
- **3 Server Actions** (login, registerManager, setupWorkspace).
- **2 Zustand stores** (sidebar, ui).
- **0 API hooks**. **0 axios calls**. **0 React Query queries**.
- **1603 translation keys** × 2 locales.
