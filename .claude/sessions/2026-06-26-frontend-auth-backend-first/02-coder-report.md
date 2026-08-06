# تقرير المبرمج — Session S1

## المرحلة 1: البنية التحتية للجلسة — ✅

**الملفات المُنشأة:**
- `apps/web/src/store/use-auth-store.ts` — zustand **non-persist**: `accessToken`, `user`, `pendingRegistration` + actions (`setSession`, `setAccessToken`, `setPendingRegistration`, `clearPendingRegistration`, `clear`). الـ access token في الذاكرة فقط (لا persist middleware — مقصود، §2.4).
- `apps/web/src/lib/api/map-auth-error.ts` — pure: يحوّل أي خطأ axios لـ `{ code, message, requestId?, errors? }`. يعتمد رسالة الـ backend العربية مباشرة (P5)، يميّز `NETWORK` (request بلا response) عن `UNKNOWN`.
- `apps/web/src/lib/api/auth-client.ts` — axios instance (`baseURL=NEXT_PUBLIC_API_URL+/api/v1`, `withCredentials:true`, **بدون** refresh interceptor) + `login/register/refresh/logout/me`، تفكّ الـ envelope وتطبّع الأخطاء.
- `apps/web/src/lib/auth/auth-hint.ts` — `setAuthHint/clearAuthHint` + helper pure `buildAuthHintCookie(secure)`. `auth_hint=1; SameSite=Lax; max-age=604800` (P4)؛ `Secure` في production فقط؛ no-op على الـ server.
- `apps/web/src/lib/auth/register-payload.ts` — pure `buildRegisterPayload(personal, company)` → الـ 6 حقول فقط (P3/D1)، `companyEmail=بريد الأدمن`، `companyPhone` يُضاف فقط لو موجود، **بدون `role`**.
- `apps/web/vitest.config.ts` — config أدنى (environment `node`, `include: src/**/*.spec.ts`, alias `@`/`@web` مطابقة لـ tsconfig).

**الملفات المُعدّلة:**
- `apps/web/.env.local` — إضافة `NEXT_PUBLIC_API_URL=http://localhost:4000` (مع fallback في الكود).
- `apps/web/package.json` — `"test": "vitest run"` + `vitest@^3.2.4` في devDependencies.

**انحرافات عن الـ Plan:**
- لا يوجد. كل ملفات المرحلة 1 اتنفّذت كما في `00-plan.md`. (`decide-redirect.ts` و`use-auth.ts` تخصّ المرحلتين 4 و2 — مش دلوقتي.)

**ملاحظات:**
- إصلاح واحد أثناء الـ typecheck: في `map-auth-error.ts` كان الـ cast لـ `BackendErrorEnvelope` بيفشل بسبب `success: false` literal على `Record<string,unknown>`. الحل: `success?: false` (optional) — لأننا بنـ parse body فضفاض النوع؛ الـ API دائماً يبعت `false`.
- `vitest@3.2.6` اتثبّت فعلياً (الـ resolver رفّع الـ patch). 181 package مضافة.

---

## Verification (literal)

### الـ Vitest runner (إثبات جاهزية البنية)
```
 RUN  v3.2.6 D:/tampalets/saas-one/apps/web
No test files found, exiting with code 1
include: src/**/*.spec.ts
```
> متوقّع: لا توجد specs بعد (يكتبها دور المختبر — MVT). الـ runner مُوصّل ويقرأ المسار الصح.

### `npx tsc --noEmit` — بعد الإصلاح (ملفات S1 فقط)
```
✅ no errors in new S1 files (src/lib/, src/store/)
```

### `npx tsc --noEmit` — أخطاء متبقية (pre-existing، خارج نطاق S1)
```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: ... }' is not assignable ... Property 'alignment' does not exist ...
```
> الملفان دول لم يُلمسا في هذه الـ session — أخطاء موجودة مسبقاً (permissions page + base-ui dropdown). تُسجّل للـ BACKLOG، خارج نطاق S1.

---

## ملخص المرحلة 1
- المراحل المكتملة في هذا الرد: 1/5 (الباقي بإذن منفصل).
- الملفات المُنشأة: 6 / المُعدّلة: 2.
- انحرافات عن الـ Plan: 0.
- أخطاء tsc في كود S1: 0 (أخطاء pre-existing فقط، موثّقة).
- وقت التنفيذ التقديري: ~25 دقيقة (+ ~3 دقائق تثبيت vitest).

✋ تم المبرمج (المرحلة 1) — للمرحلة التالية (المرحلة 2: إزالة الـ Supabase-direct)؟

---

## المرحلة 2: إزالة الـ Supabase-direct من طبقة الـ auth — ✅

**الملفات المحذوفة:**
- `apps/web/src/app/[locale]/(auth)/actions.ts` — 🗑️ **حذف كامل** (173 سطر). شال الدوال الثلاث (`login`, `registerManager`, `setupWorkspace`) وكل `supabase.auth.signInWithPassword/signUp/getUser` و`supabase.from('companies'/'users').insert`، بالإضافة لـ `mapSupabaseError` والـ zod schemas المحلية (هتتبني من جديد على قواعد الـ backend في المرحلة 3). الملف كان `"use server"` بلا أي مستهلك غير الصفحات الثلاث (هتتعاد ربطها في المرحلة 3).

**الملفات المُنشأة:**
- `apps/web/src/lib/auth/use-auth.ts` (جديد، `"use client"`) — 3 hooks خفيفة فوق `authClient` + `useAuthStore`، بـ `useState` لـ `isPending`/`error` (بدون React Query — مؤجّل لـ S2):
  - `useLogin()` → `login(email,password)`: `authClient.login` → `setSession` + `setAuthHint` → `true`؛ فشل → `error` + `false`.
  - `useRegister()` → `register(payload)`: `authClient.register` ثم **auto-login** بنفس الـ credentials (P2) → `setSession` + `setAuthHint` + `clearPendingRegistration`. يرجّع discriminated outcome: `"success"` / `"autologin-failed"` (الحساب اتعمل بس الدخول فشل → الصفحة تحوّل لـ `/login`) / `"register-failed"` (مفيش حاجة اتعملت → تفضل في الفورم). الـ `clearPendingRegistration` بيحصل لحظة ما الحساب يتأكّد وجوده → يمنع double-register عند إعادة الإرسال.
  - `useLogout()` → `logout()`: `authClient.logout(accessToken)` best-effort داخل `try/finally`؛ مهما حصل → `store.clear()` + `clearAuthHint()`. أي فشل شبكة مش بيحبس المستخدم في shell مسجّل دخول.

**التأكيد على إزالة الـ Supabase-direct (تعريف النجاح #1):**
```
$ grep -rn "supabase\.auth\|supabase\.from" apps/web/src/app apps/web/src/lib/auth apps/web/src/middleware.ts
(صفر نتائج في طبقة actions/use-auth — الباقي: middleware لسه فيه Supabase، يتشال في المرحلة 4؛ lib/supabase/* dead code، BACKLOG في المرحلة 5)
```

**انحرافات عن الـ Plan:**
- **انحراف واحد طفيف (إضافة، مبرَّر):** الـ plan (سطر 63) وصف `useRegister()` يرجّع نجاح/فشل ضمني. أضفت نوع `RegisterOutcome` صريح (`success | autologin-failed | register-failed`) عشان أنفّذ قرار **P2** حرفياً («لو فشل auto-login → redirect لـ `/login`») — الصفحة محتاجة تفرّق بين «الحساب اتعمل بس الدخول فشل» و«التسجيل نفسه فشل». مفيش ده = مستحيل تطبّق P2 صح. لا يغيّر أي ملف تاني؛ الصفحة في المرحلة 3 هتـ branch عليه.

**ملاحظات:**
- الصفحات الثلاث (`login/register/setup-workspace`) دلوقتي بتـ import من `../actions` المحذوف → typecheck بيطلّع أخطاء فيها. **ده متوقّع ومقصود** حسب تسلسل الـ plan: المرحلة 2 تشيل الـ actions، المرحلة 3 تعيد ربط الصفحات بالـ hooks الجديدة. الـ build مش هيخضرّ إلا بعد المرحلة 3.
- `use-auth.ts` نفسه: صفر أخطاء tsc (مش ضمن قائمة الأخطاء المتبقية).

---

## Verification (literal) — المرحلة 2

### `npx tsc --noEmit` — أخطاء المرحلة 2 (كلها متوقّعة: صفحات المرحلة 3)
```
src/app/[locale]/(auth)/login/page.tsx(4,23): error TS2307: Cannot find module '../actions' or its corresponding type declarations.
src/app/[locale]/(auth)/login/page.tsx(72,21): error TS2339: Property 'errorCode' does not exist on type 'never'.
... (login: 7 أخطاء — كلها متفرّعة من سطر import المحذوف)
src/app/[locale]/(auth)/register/page.tsx(5,33): error TS2307: Cannot find module '../actions' or its corresponding type declarations.
... (register: 15 خطأ)
src/app/[locale]/(auth)/setup-workspace/page.tsx(5,32): error TS2307: Cannot find module '../actions' or its corresponding type declarations.
... (setup-workspace: 17 خطأ)
```
> إجمالي 39 خطأ جديد، كلها cascade من 3 سطور `import ... from "../actions"` في الصفحات الثلاث (أهداف المرحلة 3). `use-auth.ts` غير موجود في القائمة = نظيف.

### الأخطاء الـ pre-existing (خارج نطاق S1، ثابتة من المرحلة 1)
```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: ... Property 'alignment' does not exist ...
```
> إجمالي عدّاد tsc = 41 (39 متوقّع للمرحلة 3 + 2 pre-existing). لا أخطاء في كود المرحلة 2 نفسه.

---

## ملخص المرحلة 2
- المراحل المكتملة: 2/5 (الباقي بإذن منفصل).
- الملفات المحذوفة: 1 (`actions.ts`) / المُنشأة: 1 (`use-auth.ts`).
- انحرافات عن الـ Plan: 1 (إضافة `RegisterOutcome` لتنفيذ P2 — مبرَّرة، لا تمسّ ملفات أخرى).
- أخطاء tsc في كود المرحلة 2: 0 (الـ 39 خطأ كلها في صفحات المرحلة 3 المتوقّعة، + 2 pre-existing).
- وقت التنفيذ التقديري: ~15 دقيقة.

✋ تم المبرمج (المرحلة 2) — للمرحلة التالية (المرحلة 3: ربط صفحات الـ auth بالـ flow الجديد)؟

---

## المرحلة 3: ربط صفحات الـ auth بالـ flow الجديد — ✅

**الملفات المُعدّلة:**
- `apps/web/src/app/[locale]/(auth)/login/page.tsx` — استبدال `useActionState(login)` بـ `useLogin()`. `onSubmit` controlled: يقرأ `email/password` من `FormData` → `await login(...)` → نجاح → `router.push("/dashboard")` (locale-aware عبر `useRouter` من `@/i18n/routing`). الـ error banner بيعرض `error.message` (عربي جاهز من الـ backend، P5). شِلت الـ field-error paragraphs (كانت تعتمد `state.fields` من الـ server action المحذوف)؛ الـ inputs محتفظة بـ `required`.
- `apps/web/src/app/[locale]/(auth)/register/page.tsx` — استبدال `useActionState(registerManager)` بـ **client-side zod** مُحاذاة للـ backend `RegisterCompanyDto`: password `min 10 + max 128 + complexity regex` (نسخة طبق الأصل من `dto/index.ts:49-56`)، phone regex `^[+]?[\d\s\-()]{8,20}$`. `onSubmit`: validate → لو فشل يعرض field errors محلية (`useState`)؛ لو نجح → `setPendingRegistration({...})` → `router.push("/setup-workspace")`. **صفر نداء backend هنا** (D2/flow). أضفت `noValidate` عشان الـ zod هو مصدر الأخطاء مش HTML5.
- `apps/web/src/app/[locale]/(auth)/setup-workspace/page.tsx` — استبدال `useActionState(setupWorkspace)` بـ `useRegister()`. **Guard:** `useEffect` لو `pendingRegistration` فاضي (hard refresh فقد الذاكرة) → `router.replace("/register")`. `onSubmit`: `buildRegisterPayload(pending, {companyName})` (6 حقول فقط، D1) → `await register(payload)` → branch على `RegisterOutcome`: `success`→`/dashboard`، `autologin-failed`→`/login` (P2)، `register-failed`→يفضل في الفورم مع الـ banner. الحقول الزائدة (commercialRegister/currency/specialization/address/taxId/employeeCount) **باقية ظاهرة في الـ UI لكن لا تُرسَل** (TODO صريح في الكود — D1).

**انحرافات عن الـ Plan:**
- لا يوجد جوهري. تفصيلة تنفيذية: في register استخدمت `fields.form` كمفتاح للـ banner العام (لو احتجناه مستقبلاً) — لا يغيّر السلوك (مفيش backend call فمفيش error عام دلوقتي).

**ملاحظات:**
- الـ JSX/التصميم اتحافظ عليه بالكامل — التغيير في منطق الإرسال + إزالة مراجع `state` الميتة فقط (مطابق لقيد الـ plan «نفس الـ JSX»).
- رسائل الـ field errors في register بتعرض الـ code (`required`/`weakPassword`/`invalidEmail`/`invalidPhone`) — مطابق لسلوك الـ server action القديم اللي كان بيعرض raw zod message. i18n الكامل لها = مؤجّل (residual موثّق في الـ plan).

---

## المرحلة 4: إصلاح الـ middleware — ✅

**الملفات المُنشأة:**
- `apps/web/src/lib/auth/decide-redirect.ts` (جديد، **pure**) — `decideAuthRedirect({pathname,hasHint,locales,defaultLocale}): string|null`. كل منطق التوجيه هنا، **بدون أي فرع `NODE_ENV`** (السطر الوحيد اللي فيه `NODE_ENV` = تعليق توضيحي بيشرح غيابه). المنطق: `isDashboard && !hasHint`→`/{locale}/login` (كل البيئات)؛ `isAuthPage && hasHint`→`/{locale}/dashboard`؛ غير كده→`null`.

**الملفات المُعدّلة:**
- `apps/web/src/middleware.ts` — **إزالة** `createServerClient` + `supabase.auth.getUser` (`@supabase/ssr`) و**إزالة الـ dev bypass** (`NODE_ENV !== 'development'`). الـ middleware بقى sync: `intlMiddleware` → يقرأ `auth_hint` cookie → `decideAuthRedirect(...)` → لو target فيه `NextResponse.redirect`. الـ `matcher` ثابت بدون تغيير.

**انحرافات عن الـ Plan:**
- لا يوجد. مطابق للمرحلة 4 في الـ plan (سطور 77-87).

**ملاحظات:**
- استوردت `AUTH_HINT_NAME` من `auth-hint.ts` (const string فقط) — آمن في الـ edge runtime؛ دوال `setAuthHint/clearAuthHint` اللي بتلمس `document` مش بتتنادى في الـ middleware.
- residual risk موثّق في الـ plan: `auth_hint` قابلة للتزوير → الحماية الحقيقية في الـ backend JWT guard (client route-guard مؤجّل لـ S2).

---

## المرحلة 5: تنظيف وتأمين البقايا — ✅

**الإجراءات:**
- تأكيد grep نهائي (literal تحت): صفر `supabase.auth`/`supabase.from` في `apps/web/src/app` و`middleware.ts`.
- اكتشاف إضافي: `lib/supabase/{client,server}.ts` بقى **صفر مستهلك في `apps/web/src` بالكامل** (مش بس طبقة الـ auth) → dead code تام. **لم يُحذف** (out of scope — D1/plan) وسُجّل في `BACKLOG.md` كـ `WEB-CLEANUP-001`.
- سُجّل الـ 2 pre-existing tsc errors في `BACKLOG.md` كـ `WEB-TSC-001` (build-blocker، خارج S1).

**انحرافات عن الـ Plan:** لا يوجد.

---

## Verification (literal) — المراحل 3+4+5

### grep cleanup (تعريف النجاح #1)
```
$ grep -rn "supabase\.auth\|supabase\.from" apps/web/src/app
(صفر نتائج — exit 1)

$ grep -n "supabase\|createServerClient\|@supabase" apps/web/src/middleware.ts
(صفر نتائج — exit 1)

$ grep -rn "lib/supabase\|@/lib/supabase" apps/web/src
(صفر نتائج — exit 1 → الملفات dead code تماماً)

$ grep -rn "NODE_ENV" apps/web/src/middleware.ts apps/web/src/lib/auth/decide-redirect.ts
apps/web/src/lib/auth/decide-redirect.ts:5:// without a NextRequest. CRITICAL: there is NO `NODE_ENV` branch — an
(السطر الوحيد = تعليق، مفيش فرع فعلي — تعريف النجاح #2)
```

### `npx tsc --noEmit` — بعد ربط الصفحات
```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: ... }' is not assignable ...
tsc error count: 2
```
> الـ 39 خطأ المتفرّعة من `../actions` **اختفت كلها** بعد ربط الصفحات بالـ hooks. باقي فقط الـ 2 pre-existing (cn + dropdown، `WEB-TSC-001`). كود S1 = صفر أخطاء.

### `npx next build` — literal
```
 ▲ Creating an optimized production build ...
 ✓ Compiled successfully in 6.9s
...
./src/app/[locale]/dashboard/team/permissions/page.tsx:287:40
Type error: Cannot find name 'cn'.
```
> الـ webpack compile **نجح** (كل كود S1 — الصفحات المعاد ربطها + الـ hooks + الـ middleware في edge runtime — اتـ bundle بدون مشاكل). الـ build فشل فقط في خطوة type-check على `permissions/page.tsx` (pre-existing، `WEB-TSC-001`)، مش على أي ملف من S1.

---

## ملخص نهائي (المراحل 1→5)
- المراحل المكتملة: **5/5**.
- الملفات المُنشأة: 9 (`use-auth-store`, `auth-client`, `map-auth-error`, `auth-hint`, `register-payload`, `vitest.config` [م1] + `use-auth` [م2] + `decide-redirect` [م4]) — *(8 source + 1 config)*.
- الملفات المُعدّلة: 5 (`login/register/setup-workspace pages` + `middleware` + `.env.local`/`package.json`).
- الملفات المحذوفة: 1 (`actions.ts`).
- انحرافات عن الـ Plan: 1 جوهري (`RegisterOutcome` لتنفيذ P2 — م2)، مبرَّر.
- أخطاء tsc في كود S1: **0** (الـ 2 المتبقية pre-existing → BACKLOG).
- `next build`: compile ناجح؛ type-check محجوب بـ pre-existing فقط.
- تعريف النجاح (كود): #1 grep نظيف ✅ / #2 لا فرع NODE_ENV ✅ / #3 token non-persist ✅ (م1) / #4 لا role من الـ client ✅ (register-payload) / #5 password min10+complexity على الـ client ✅ / #6 auto-login بعد register ✅ / #7 logout يمسح store+hint+POST ✅. الـ **MVT (البند الأخير)** = شغل دور المختبر.
- وقت التنفيذ التقديري للمراحل 3+4+5: ~35 دقيقة.

✋ تم المبرمج (كل المراحل 1→5) — للدور التالي (🧠 المخطط — تقرير ما بعد التنفيذ `01-architect-report.md`)؟
