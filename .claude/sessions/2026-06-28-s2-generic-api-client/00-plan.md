# خطة التنفيذ — Session S2: Generic API Client + React Query Hooks

> 🧠 المخطط — Standard mode. الأولوية: WEB-S1-001 (route-guard) — الـ S2-blocker.

---

## المشكلة
بعد S1، الـ frontend عنده auth موحّد عبر الـ backend لكن **مفيش طبقة data-access للـ endpoints المحمية**:
1. الـ `QueryProvider` منصوب في root layout لكن **غير مستخدم نهائياً** (صفر `useQuery`/`useMutation`).
2. مفيش generic axios client — `auth-client.ts` مخصّص لـ `/auth/*` فقط وبدون refresh interceptor (متعمّد في S1).
3. **الـ dashboard محمي فقط بـ `auth_hint` المزوّرة** (CVE-S1-002) — مفيش client guard يتحقق من جلسة حقيقية. ده الـ blocker اللي يمنع ربط أي data حقيقية بأمان.

## التحليل (Root Cause)
- S1 بنى البنية التحتية للجلسة عمداً بدون consumers (الـ token في الذاكرة، refresh httpOnly cookie جاهز على الـ API). S2 هو أول consumer.
- الـ `auth_hint` صُمّمت كـ UX hint مش auth boundary (موثّق في S1). الحماية الحقيقية = الـ backend JWT guard + **تحقق client-side فعلي** (`/users/me`) قبل عرض data. الجزء التاني ده ناقص = CVE-S1-002.
- الـ refresh-on-401 ناقص: لو الـ access token (في الذاكرة) ضاع بعد hard reload، مفيش آلية تستعيد الجلسة من الـ refresh cookie تلقائياً → المستخدم يتطرد رغم إن عنده جلسة صالحة.

---

## الحل المقترح

### نظرة عامة على التدفّق
```
[أي طلب محمي عبر client.ts]
  request interceptor: لو فيه accessToken في الـ store → Authorization: Bearer <token>
  → الطلب
  ◄── 401؟
       refresh-policy.shouldRefresh({status,alreadyRetried,isRefreshCall})
        ├─ true  → authClient.refresh() (cookie) → store.setAccessToken(new) → retry الطلب مرة واحدة
        │           (shared in-flight promise → مفيش refresh stampede)
        └─ false → terminal: store.clear() + clearAuthHint() → reject

[RouteGuard على dashboard mount]
  useMe() (GET /users/me عبر client.ts)
   ├─ isLoading  → loading shell
   ├─ success    → hydrate store.user + render children
   └─ isError    → (الـ interceptor صفّى الجلسة بالفعل) → router.replace('/login')

  ← خاصية مهمة: لو hard reload والـ token=null لكن الـ refresh cookie صالح،
    الـ 401 الأول يـ trigger refresh تلقائي → useMe ينجح → الجلسة تُستعاد بصمت.
```

### المرحلة 1: الـ pure policy + الـ generic client + test-infra
- **الملفات:**
  - `apps/web/src/lib/api/refresh-policy.ts` (جديد، **pure**) — `shouldRefresh({status, alreadyRetried, isRefreshCall}): boolean`. المنطق الوحيد: `status===401 && !alreadyRetried && !isRefreshCall`. معزول للـ MVT بدون HTTP.
  - `apps/web/src/lib/api/client.ts` (جديد) — axios instance (يعيد استخدام baseURL/`unwrap`/`mapAuthError` من نمط `auth-client`):
    - request interceptor: يقرأ `useAuthStore.getState().accessToken` (vanilla store، مش React) → يضيف الـ Bearer لو موجود.
    - response interceptor: عند الخطأ → `shouldRefresh(...)` → لو true: ينادي **`authClient.refresh()`** عبر **shared in-flight promise** (singleton) → `setAccessToken` → يعيد الطلب الأصلي مرة واحدة (`alreadyRetried=true`). لو false (terminal): `clear()` + `clearAuthHint()` → reject بـ `mapAuthError`.
  - `apps/web/vitest.config.ts` — إضافة دعم **jsdom** للـ `*.tsx` specs (عبر `environmentMatchGlobs` أو docblock per-file) مع إبقاء `node` كـ default للـ pure specs.
  - `apps/web/package.json` — devDeps: `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`. (MSW **مؤجّل** — الـ MVT يستخدم `vi.mock` على حدود الموديولات، مش HTTP حقيقي.)
- **التغييرات:** إضافات جديدة + config. لا تعديل سلوك قائم.
- **الـ Risks:**
  - **refresh stampede:** عدة 401 متوازية → عدة `/auth/refresh`. الحل: shared in-flight promise واحد يتشارك فيه كل الطلبات المتزامنة.
  - **refresh loop:** لو الـ refresh call نفسه رجّع 401 → `isRefreshCall` يمنع إعادة المحاولة. (نضمن إن `authClient.refresh` على instance منفصل بلا الـ interceptor ده — وهو كذلك في S1.)
  - الـ client.ts يقرأ الـ store وقت الطلب (vanilla `getState`) → آمن خارج React.

### المرحلة 2: useMe hook + RouteGuard + الربط
- **الملفات:**
  - `apps/web/src/lib/hooks/use-me.ts` (جديد) — `useMe()`: `useQuery({ queryKey:['me'], queryFn: () => client.get('/users/me') → unwrap<AuthUser>, retry:false })`. `retry:false` لأن الـ interceptor بيتولّى الـ refresh-retry؛ retry إضافي من RQ يأخّر الـ redirect بلا فائدة. عند النجاح: `setSession`/hydrate `store.user` (DP2).
  - `apps/web/src/components/auth/route-guard.tsx` (جديد، `"use client"`) — `<RouteGuard>`:
    - `const { data, isLoading, isError } = useMe()`.
    - `useEffect`: لو `isError` → `router.replace('/login')` (الـ interceptor صفّى الجلسة بالفعل؛ الـ guard مسؤول عن الـ redirect فقط — DP1).
    - `isLoading` → loading shell؛ `isError || !data` → `null` (بيتـ redirect)؛ غير كده → `children`.
  - `apps/web/src/app/[locale]/dashboard/layout.tsx` (تعديل) — لفّ `<DashboardLayoutWrapper>` بـ `<RouteGuard>`.
- **الـ Risks:**
  - الـ redirect داخل render → نستخدم `useEffect` (مش أثناء render) لتجنّب React warning.
  - useMe لازم يشتغل حتى لو `accessToken=null` (عشان يـ trigger الـ refresh عبر cookie) → `enabled` افتراضي true.
  - `router.replace` (مش push) عشان مايتسجلش في الـ history (لا back للـ dashboard المحمي).

---

## الـ Skills المطلوبة
- `apps/web/AGENTS.md` → Next.js 16: قبل تعديل `dashboard/layout.tsx` راجع docs (server vs client component boundaries).
- S1 artifacts → `use-auth-store` (`accessToken`/`setAccessToken`/`setSession`/`clear`)، `auth-hint` (`clearAuthHint`)، `auth-client` (`refresh`/`unwrap`)، `map-auth-error`.
- `@tanstack/react-query` v5 → `useQuery` API (`retry`, `queryKey`, `queryFn`).

---

## نقاط القرار
- **DP1 — ملكية الـ terminal-401:** الـ **interceptor** يملك تصفية الجلسة (`clear()`+`clearAuthHint()`) لأنها مربوطة بأعمق حدث (فشل الـ refresh النهائي — rule #4). الـ **RouteGuard** يملك الـ redirect فقط (UI concern، يحتاج i18n router اللي مش متاح جوه interceptor خارج React). → **الترجيح: فصل المسؤوليتين كما فوق.**
- **DP2 — useMe يـ hydrate الـ store؟** نعم — عند نجاح `/users/me` نحدّث `store.user` ليبقى الـ store هو مصدر الـ UI. منخفض الخطورة، يمنع double-source. (الـ token موجود أصلاً من الـ login/refresh.)
- **DP3 — توحيد auth-client (WEB-S1-003):** **لا ندمجهما في instance واحد.** `auth-client` يفضل bare لـ `/auth/*` (pre-auth، بدون Bearer interceptor وبدون refresh — وإلا refresh-calling-refresh = loop). الـ `client.ts` الجديد = للـ endpoints المحمية، و**يستدعي `authClient.refresh()`** عند الـ 401. التوحيد يتحقق بـ **استخراج helpers مشتركة** (baseURL/`unwrap`)، مش instance واحد. → يقفل روح WEB-S1-003 بأمان (يمنع الـ loop).
- **DP4 — MSW؟** مؤجّل. الـ MVT يستخدم `vi.mock` على حدود الموديولات (`use-me`, router, store) — أبسط وكافٍ للـ guard. MSW الكامل = WEB-S1-004 لاحقاً.

---

## التأثير على الـ Codebase الحالي
| الملف | التغيير |
|------|---------|
| `lib/api/refresh-policy.ts` | ➕ جديد (pure) |
| `lib/api/client.ts` | ➕ جديد (interceptors) |
| `lib/hooks/use-me.ts` | ➕ جديد |
| `components/auth/route-guard.tsx` | ➕ جديد |
| `dashboard/layout.tsx` | ✏️ لفّ بـ RouteGuard |
| `auth-client.ts` | ✅ بدون تغيير (يفضل bare؛ DP3) — أو استخراج helper مشترك فقط |
| `vitest.config.ts`, `package.json` | ➕ jsdom + RTL (WEB-S1-004 الحد الأدنى) |
| `QueryProvider` | ✅ بدون تغيير (نستخدمه كما هو) |

---

## تعريف النجاح
- [ ] `client.ts` يربط Bearer تلقائياً + refresh-on-401 single-retry مع shared promise (لا stampede، لا loop).
- [ ] **RouteGuard يطرد غير المصرّح من الـ dashboard** (terminal-401 ⇒ clear+clearAuthHint+redirect `/login`) — **CVE-S1-002 مقفول**.
- [ ] hard reload بجلسة صالحة ⇒ refresh صامت ⇒ الـ dashboard يتحمّل (مفيش طرد خاطئ).
- [ ] `useMe()` يجيب `/users/me` عبر الـ generic client + يـ hydrate الـ store.
- [ ] **MVT: 3 specs مكتوبة وpassing** (إجباري — rule #3):
  1. `refresh-policy.shouldRefresh` → 401 fresh (not retried, not refresh-call) ⇒ **true**.
  2. `refresh-policy.shouldRefresh` → **deepest no-loop assertion (rule #4):** 401 على الـ refresh-call نفسه (`isRefreshCall=true`) ⇒ **false**، وكذلك `alreadyRetried=true` ⇒ false.
  3. `RouteGuard` (RTL+jsdom) → useMe error ⇒ **paired assertion (rule #4):** `router.replace('/login')` اتنادت **و** `store.clear()` حصل فعلاً (`accessToken===null`) **و** الـ children مش معروضة — مش بس الـ redirect.
- [ ] (اختياري) `RouteGuard` success ⇒ children معروضة + `store.user` اتحدّث.
- [ ] tsc: صفر أخطاء جديدة (الـ 2 pre-existing فقط — `next build` يفضل محجوب بـ WEB-TSC-001، خارج النطاق).

---
⏸️ AWAITING APPROVAL
رد بـ "approve" للانتقال لدور 💻 المبرمج (ينفّذ مرحلة مرحلة → `02-coder-report.md`)، أو "edit: [تعديل]".

✋ تم المخطط — للدور التالي؟
