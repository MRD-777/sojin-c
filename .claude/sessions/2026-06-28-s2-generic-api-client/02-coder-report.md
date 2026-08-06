# تقرير المبرمج — Session S2

> 💻 المبرمج — Standard mode. ينفّذ `00-plan.md` مرحلة مرحلة. قرارات المستخدم: DP1=فصل interceptor/guard، DP2=useMe يـ hydrate الـ store (المرحلة 2)، DP3=auth-client يفضل منفصل (shared helpers فقط)، DP4=MSW مؤجّل.

---

## المرحلة 1: الـ pure policy + الـ generic client + test-infra — ✅

**الملفات المعدّلة:**

| الملف | النوع | إيه اللي اتعمل |
|------|------|----------------|
| `src/lib/api/refresh-policy.ts` | ➕ جديد (pure) | `shouldRefresh({status, alreadyRetried, isRefreshCall})` — المنطق الوحيد `status===401 && !alreadyRetried && !isRefreshCall`. صفر axios/store dependencies → MVT بدون HTTP mocks. |
| `src/lib/api/http-shared.ts` | ➕ جديد | تنفيذ DP3/WEB-S1-003: استخراج `API_ROOT` + `unwrap<T>()` كـ single source of truth بدل دمج الـ instances (الدمج كان هيرجّع الـ refresh loop). |
| `src/lib/api/client.ts` | ➕ جديد | الـ generic axios instance للـ endpoints المحمية: request interceptor (Bearer من `useAuthStore.getState()`) + response interceptor (refresh-on-401 single retry عبر **shared in-flight promise** singleton؛ terminal ⇒ `clear()`+`clearAuthHint()` — DP1/rule #4). |
| `src/lib/api/auth-client.ts` | ✏️ تعديل | استبدال الـ `API_ROOT`/`unwrap` المحليين بـ import من `http-shared.ts`. **سلوك مطابق 100%** — يفضل bare بدون interceptors (DP3). |
| `vitest.config.ts` | ✏️ تعديل | `include` يشمل `*.spec.tsx`؛ `setupFiles: ["./vitest.setup.ts"]`؛ default environment يفضل `node`. الـ jsdom opt-in per-file عبر docblock `// @vitest-environment jsdom` (بدل `environmentMatchGlobs` المهجور في vitest 3). |
| `vitest.setup.ts` | ➕ جديد | `import "@testing-library/jest-dom/vitest"` — `expect.extend` فقط، no-op آمن للـ node specs (لا يلمس `document`). |
| `apps/web/package.json` | ✏️ تعديل | devDeps: `jsdom@^25`, `@testing-library/react@^16`, `@testing-library/jest-dom@^6`. **MSW مؤجّل (DP4).** |

**انحرافات عن الـ Plan:**
- **`http-shared.ts` ملف جديد لم يُسمَّ صراحة في جدول الملفات** — لكنه التنفيذ المباشر لـ DP3 («التوحيد يتحقق بـ استخراج helpers مشتركة، مش instance واحد»). الـ plan ذكره كـ «أو استخراج helper مشترك فقط». فضّلت ملف مشترك على نسخ الكود في `client.ts` (وإلا كان «تكرار» مش «توحيد»). نتج عنه تعديل بسيط مطابق-السلوك في `auth-client.ts` (import بدل تعريف محلي) — regression مغطّى بالـ 11 spec القائمة (passing أدناه).
- باقي كل شيء مطابق للـ plan.

**ملاحظات:**
- **منع الـ stampede:** `refreshInFlight` promise واحد مشترك؛ كل 401 متزامن يـ await نفس `authClient.refresh()`. يُصفّر في `.finally()` ليسمح بـ refresh لاحق.
- **منع الـ loop:** الـ `client.ts` ينادي `authClient.refresh()` على الـ **bare instance** (بلا response interceptor) → 401 من الـ refresh نفسه لا يعيد الدخول لهذا المنطق. لذلك `isRefreshCall` ثابت `false` في `client.ts` (موثّق inline)، والـ pure layer يحرس نفس الـ invariant عبر باراميتر `isRefreshCall` للـ MVT.
- **terminal teardown:** فرعان يصفّيان الجلسة — (أ) فشل الـ refresh نفسه (catch)، (ب) 401 بعد استهلاك الـ retry (`_retry=true` ⇒ `shouldRefresh=false` ⇒ `if (status===401) terminateSession()`). كلاهما interceptor-owned (DP1).
- الـ Bearer يُقرأ وقت الإرسال عبر vanilla `getState()` → آمن خارج React.

**Verification (literal — rule #8):**

`npx vitest run` (regression: الـ 11 spec القائمة بعد refactor الـ auth-client + الـ setupFiles الجديد):
```
 RUN  v3.2.6 D:/tampalets/saas-one/apps/web

 ✓ src/lib/auth/decide-redirect.spec.ts (4 tests) 3ms
 ✓ src/lib/api/map-auth-error.spec.ts (3 tests) 4ms
 ✓ src/lib/auth/register-payload.spec.ts (2 tests) 5ms
 ✓ src/store/use-auth-store.spec.ts (2 tests) 5ms

 Test Files  4 passed (4)
      Tests  11 passed (11)
   Start at  20:03:54
   Duration  5.90s (transform 1.18s, setup 7.84s, collect 620ms, tests 17ms, environment 1ms, prepare 3.80s)
```

`npx tsc --noEmit` (stderr، EXIT 2):
```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
```

**تحليل أخطاء tsc:** الـ 4 كلها **pre-existing في ملفات لم ألمسها** — صفر أخطاء جديدة من ملفات المرحلة 1:
- `permissions/page.tsx` (`cn`) + `dropdown-menu.tsx` (`alignment`) = **WEB-TSC-001** (خارج النطاق صراحةً في الـ scope).
- `decide-redirect.spec.ts` (NODE_ENV read-only ×2) = ملف S1 (يكتب `process.env.NODE_ENV` في الـ test) — قائم قبل هذه الـ session.
- ✅ لا يظهر أي من `client.ts` / `refresh-policy.ts` / `http-shared.ts` / `auth-client.ts` / `vitest.setup.ts` في المخرجات.

> الـ plan توقّع «2 pre-existing». الواقع 4: الزوج المتوقّع (WEB-TSC-001) + زوج spec-file من S1 (NODE_ENV). كلها pre-existing ولا واحدة من المرحلة 1. (للتسجيل في تقرير المخطط post-exec.)

---

## المرحلة 2: useMe hook + RouteGuard + ربط الـ dashboard layout — ✅

**الملفات المعدّلة:**

| الملف | النوع | إيه اللي اتعمل |
|------|------|----------------|
| `src/lib/hooks/use-me.ts` | ➕ جديد | `useMe()`: `useQuery({ queryKey:['me'], queryFn: client.get('/users/me') → unwrap<AuthUser>, retry:false })`. `retry:false` لأن الـ interceptor بيتولّى الـ refresh+single-retry — retry إضافي من RQ = تأخير للـ redirect بلا فائدة. hydration للـ store (DP2) عبر `useEffect` يزامن `data → setSession`. صدّرت `ME_QUERY_KEY` للـ invalidate/read لاحقاً. |
| `src/components/auth/route-guard.tsx` | ➕ جديد (`"use client"`) | `<RouteGuard>`: `const {data,isLoading,isError}=useMe()`. `useEffect`: `isError ⇒ router.replace('/login')` (i18n router من `@/i18n/routing`). `isLoading ⇒` loading shell (spinner + `role=status`)؛ `isError \|\| !data ⇒ null` (redirect جارٍ، مايفلاش-ش محتوى محمي)؛ غير كده ⇒ `children`. (DP1: الـ guard يملك الـ redirect فقط؛ الـ interceptor صفّى الجلسة قبل كده.) |
| `src/app/[locale]/dashboard/layout.tsx` | ✏️ تعديل | لفّ `<DashboardLayoutWrapper>` بـ `<RouteGuard>`. الـ layout يفضل server component يـ render الـ client guard (مسموح في Next — مفيش حاجة لـ `"use client"` على الـ layout). |

**انحرافات عن الـ Plan:**

- **آلية الـ hydration (DP2): استخدمت `setSession` بدل `setUser`.** الـ plan (line 59) قال «`setSession`/hydrate `store.user`» وقائمة الـ helpers (line 74) عدّت `setSession` **ولم تذكر** `setUser`. اكتشفت إن `setUser` **معلَن في الـ interface (use-auth-store.ts:51) لكن غير مُنفَّذ** في الـ `create(...)` → phantom method: أي `getState().setUser(...)` هيـ type-check ويكسر runtime (`undefined is not a function`). فبدل ما أعتمد على trap، أو أعدّل ملف خارج نطاق المرحلة 2 (`use-auth-store.ts` مش في قائمة ملفات المرحلة 2)، استخدمت `setSession({ accessToken: <token-from-getState>, user })` — helper مُنفَّذ فعلاً ومذكور في الـ plan. حارس token (`if (token)`) يمنع تمرير null. **صفر ملفات خارج نطاق المرحلة اتلمست.**
- **`retry: false` صريح على useMe** — الـ `QueryProvider` default هو `retry: 1`. الـ plan نصّ صراحة على `retry:false` (line 59) عشان الـ interceptor يملك الـ refresh-retry، فده تطبيق للـ plan مش انحراف — مذكور للتوضيح.
- باقي كل شيء مطابق للـ plan (RouteGuard states، `router.replace` مش push، redirect في `useEffect` مش أثناء render).

**ملاحظات:**

- **استعادة الجلسة الصامتة (نجاح تعريف #3):** useMe بيمرّ عبر `client.ts` → لو hard reload والـ token=null لكن الـ refresh cookie صالح، الـ 401 الأول يـ trigger refresh داخل الـ interceptor → useMe ينجح → الجلسة تُستعاد بلا طرد. الـ guard مايشوفش `isError` في الحالة دي.
- **React Query v5:** `useQuery` مابقاش عنده `onSuccess` callback → الـ hydration اتعمل عبر `useEffect(data → store)` (النمط الرسمي البديل في v5).
- **الـ redirect عبر i18n router:** `useRouter` من `@/i18n/routing` (next-intl `createNavigation`) — بيحافظ على الـ locale في المسار (`/en/login` أو `/ar/login`)، مش `next/navigation` الخام.

**اكتشاف مهم للمخطط (post-exec) → BACKLOG:**

> **[WEB-STORE-001] `setUser` phantom في `use-auth-store.ts`** — الـ method معلَن في `AuthState` (سطر 51) لكن غير مُنفَّذ في `create(...)`. ينتج عنه:
> 1. **خطأ tsc pre-existing** — `use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing`. **الـ Stage 1 report عدّ 4 أخطاء، الواقع 5** — الخطأ ده فاته على الـ coder في المرحلة 1. أثبتُّه pre-existing بإزالة ملفات المرحلة 2 وتشغيل tsc (الخطأ باقٍ) — **صفر مساهمة من المرحلة 2.**
> 2. **latent runtime trap** — أي استدعاء `getState().setUser(...)` يـ type-check (الـ property على الـ interface) ويكسر runtime.
> الإصلاح المقترح (session لاحقة): إمّا تنفيذ `setUser: (user) => set({ user })` في الـ store، أو حذفه من الـ interface لو مش مطلوب.

> (تذكير: **NODE_ENV read-only** — `decide-redirect.spec.ts` يكتب `process.env.NODE_ENV` وبقى read-only → خطآن pre-existing. مسجّل للمخطط post-exec لإدخاله BACKLOG حسب طلب المستخدم.)

**Verification (literal — rule #8):**

`npx vitest run` (regression — الـ 11 spec القائمة بعد إضافة المرحلة 2، لسه passing):
```
 RUN  v3.2.6 D:/tampalets/saas-one/apps/web

 ✓ src/lib/api/map-auth-error.spec.ts (3 tests) 4ms
 ✓ src/lib/auth/decide-redirect.spec.ts (4 tests) 5ms
 ✓ src/lib/auth/register-payload.spec.ts (2 tests) 6ms
 ✓ src/store/use-auth-store.spec.ts (2 tests) 4ms

 Test Files  4 passed (4)
      Tests  11 passed (11)
   Start at  17:49:15
   Duration  7.17s (transform 973ms, setup 11.10s, collect 667ms, tests 19ms, environment 1ms, prepare 4.37s)
```

`npx tsc --noEmit` (stderr، EXIT 2 — 5 أخطاء، **كلها pre-existing، صفر من ملفات المرحلة 2**):
```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ accessToken: null; user: null; pendingRegistration: null; setSession: ({ accessToken, user }: { accessToken: string; user: AuthUser; }) => void; setAccessToken: (accessToken: string) => void; setPendingRegistration: (pendingRegistration: PendingRegistration) => void; clearPendingRegistration: () => void; clear: ()...' but required in type 'AuthState'.
```
- ✅ لا يظهر `use-me.ts` / `route-guard.tsx` / `dashboard/layout.tsx` في المخرجات → صفر أخطاء جديدة من المرحلة 2.
- **إثبات pre-existing للـ setUser:** شغّلت tsc بعد إزالة ملفات المرحلة 2 الثلاثة → الأخطاء الخمسة نفسها (بما فيها setUser) ظهرت → لا واحد منها من المرحلة 2.

---
## ملخص نهائي

- المراحل المكتملة: **2/2**
- الملفات المعدّلة (المرحلة 2): 3 (2 ➕ جديد + 1 ✏️ تعديل) — إجمالي الـ session: 9 ملفات
- انحرافات عن الـ Plan: 1 (hydration بـ `setSession` بدل `setUser` الـ phantom — مبرَّر، داخل نطاق ملفات المرحلة)
- اكتشافات للـ BACKLOG: 2 (WEB-STORE-001 setUser phantom + NODE_ENV read-only)
- MVT: **لم يُكتَب بعد** — مسؤولية دور 🧪 المختبر (3 specs مطلوبة، rule #3). الكود مُهيَّأ للـ MVT: `refresh-policy` pure، و`RouteGuard` قابل للـ mock عبر `use-me`/router/store (DP4).
- وقت التنفيذ التقديري: ~20 دقيقة

✋ تم المبرمج (المرحلة 2) — للدور التالي؟
