# خطة التنفيذ — Session S1: توحيد الـ Auth عبر الـ Backend

> 🧠 المخطط — Deep mode. القرارات D1/D2/D3 محسومة من المستخدم:
> **D1** = الحقول الزائدة تتأجّل (register يبعت 6 حقول فقط).
> **D2** = client-side mutations.
> **D3** = `auth_hint=1`، session expiry، locale-aware redirect.

---

## المشكلة
طبقة الـ auth في الـ frontend تتكلم مع Supabase مباشرة (login/register/insert في جداول) وتتجاوز الـ backend بالكامل، بينما الـ `JwtAuthGuard` العالمي (`app.module.ts:86-93`) يرفض أي طلب لـ `/api/v1` بدون JWT. النتيجة: نموذجا جلسة متعارضان، منطق أمان مكرّر ومنحرف (role `'org:admin'` غير موجود في الـ enum)، و middleware يسمح بالدخول بدون توكن في الـ dev.

## التحليل (Root Cause)
- **السبب الجذري:** الـ frontend اتبنى على افتراض «Supabase as backend» (BaaS)، والـ backend اتبنى لاحقاً كـ source-of-truth بـ RBAC + audit + lockout — والطبقتان لم تُربطا. لا يوجد جسر توكن، ولا api client، ولا auth store.
- **لماذا الـ Supabase-direct خطر:** يتجاوز `LoginAttemptsTracker` (`auth.service.ts:235`)، فحوصات `isActive`/`subscriptionStatus`/`company.deletedAt` (`:298-321`)، الـ atomic transaction + audit + Supabase rollback (`:117-217`)، وتوليد الـ slug الآمن (`:492-520`).
- **لماذا الـ backend جاهز للاستقبال:** `JwtStrategy` (`jwt.strategy.ts:18-21`) يتحقق من Supabase JWT عبر `JWT_SECRET` و`payload.sub`، أي أن أي Supabase access token صالح كـ `Bearer`. فبمجرد ما ناخد الـ `accessToken` من `POST /auth/login` ونمرّره، كل الـ API يشتغل.

---

## الحل المقترح

### نظرة عامة على التدفّق الجديد (Backend-first, client-side)
```
[Login]
  browser ── POST :4000/api/v1/auth/login {email,password} (credentials:include)
         ◄── { accessToken, expiresAt, user }  + Set-Cookie: refresh_token (httpOnly, :4000)
  → authStore.setSession({accessToken,user}) (ذاكرة)
  → setAuthHint() (cookie auth_hint=1 على :3000)
  → router.push(/{locale}/dashboard)

[Register] (UI خطوتين، نداء backend واحد في النهاية)
  Step1 register page  → validate (zod) → authStore.setPendingRegistration({name,email,password,phone}) → نروح setup
  Step2 setup page     → دمج + بناء RegisterCompanyDto (6 حقول) → POST /auth/register
                       → auto-login (POST /auth/login بنفس credentials) → setSession + setAuthHint
                       → clear pendingRegistration → dashboard

[Refresh] (عند 401 — حد أدنى في S1)  browser ── POST /auth/refresh (cookie تلقائي) ◄── accessToken جديد
[Logout]  POST /auth/logout (Bearer) → backend يمسح الـ refresh cookie → authStore.clear() + clearAuthHint() → /login
```

---

### المرحلة 1: البنية التحتية للجلسة (auth store + auth client + auth_hint + env + test infra)
- **الملفات:**
  - `apps/web/src/store/use-auth-store.ts` (جديد) — zustand **non-persist**:
    - state: `accessToken: string | null`, `user: AuthUser | null`, `pendingRegistration: PendingRegistration | null`.
    - actions: `setSession({accessToken,user})`, `setAccessToken(t)`, `setPendingRegistration(p)`, `clearPendingRegistration()`, `clear()`.
  - `apps/web/src/lib/api/auth-client.ts` (جديد) — axios instance (`baseURL = NEXT_PUBLIC_API_URL + '/api/v1'`, `withCredentials: true`) + دوال: `login`, `register`, `refresh`, `logout`, `me`. تفكّ الـ envelope (`res.data.data`) وتطبّع الخطأ عبر `mapAuthError`.
  - `apps/web/src/lib/api/map-auth-error.ts` (جديد، **pure**) — يحوّل أي خطأ axios لـ `{ code, message }`؛ يعتمد رسالة الـ backend العربية المُجهّزة (`global-exception.filter.ts:104`) ويحتفظ بالـ `code` للحالات الخاصة (lockout retryAfter).
  - `apps/web/src/lib/auth/auth-hint.ts` (جديد، **pure-ish**) — `setAuthHint()` / `clearAuthHint()`:
    `document.cookie = "auth_hint=1; path=/; samesite=lax; max-age=604800" (+ "; secure" في production)`.
  - `apps/web/src/lib/auth/register-payload.ts` (جديد، **pure**) — `buildRegisterPayload(step1, step2): RegisterCompanyDto` (المنطق في «نقاط القرار» تحت).
  - `apps/web/.env.local` — إضافة `NEXT_PUBLIC_API_URL=http://localhost:4000` (مع fallback في الكود).
  - **test infra:** `apps/web/vitest.config.ts` + إضافة `vitest` لـ devDependencies + `"test": "vitest run"` في `package.json` (انظر قرار P1).
- **التغييرات:** كلها إضافات جديدة (لا تعديل سلوك قائم بعد).
- **الـ Risks:**
  - نسيان `NEXT_PUBLIC_API_URL` → fallback `http://localhost:4000` يمنع crash.
  - الـ `auth-client` axios instance منفصل عن الـ generic client (S2) — مقصود لتجنّب تشابك مع interceptors لسه مش موجودة. **لا** نضيف refresh-on-401 interceptor عام هنا (S2).

### المرحلة 2: إزالة الـ Supabase-direct من طبقة الـ auth
- **الملفات:**
  - `apps/web/src/app/[locale]/(auth)/actions.ts` — **حذف** الدوال الثلاث (`login`, `registerManager`, `setupWorkspace`) وكل `supabase.auth.*` و`supabase.from(...).insert`. الملف `"use server"` يصبح بلا auth logic → يُحذف بالكامل (مفيش مستهلك تاني له).
  - `apps/web/src/lib/auth/use-auth.ts` (جديد) — hooks client خفيفة: `useLogin()`, `useRegister()`, `useLogout()` تدير `isPending`/`error` بـ `useState` فوق `auth-client` + `authStore`. (بدون React Query — أبسط و self-contained؛ RQ mutations = S2.)
- **الـ Risks:** تحويل من `useActionState` (server action) لـ client handler يغيّر توقيع الـ form. يتعالج في المرحلة 3.

### المرحلة 3: ربط صفحات الـ auth بالـ flow الجديد
- **الملفات:**
  - `login/page.tsx` — استبدال `useActionState(login)` بـ `useLogin()`: `onSubmit` → `authClient.login` → `setSession` + `setAuthHint` → `router.push("/dashboard")` (locale تلقائي عبر `useRouter` من `@/i18n/routing`). عرض `error.message` (عربي من الـ backend مباشرة).
  - `register/page.tsx` — `onSubmit`: zod validate (مُحاذى لقواعد الـ backend: **password min 10 + complexity** بدل `min(8)` الحالي في `actions.ts:17`) → `setPendingRegistration` → `router.push("/setup-workspace")`. **لا** نداء backend هنا.
  - `setup-workspace/page.tsx` — `onSubmit`: لو `pendingRegistration` فاضي → رجوع لـ `/register`؛ غير كده `buildRegisterPayload` → `useRegister()` → auto-login → `setSession`+`setAuthHint`+`clearPendingRegistration` → `/dashboard`.
- **التغييرات على الـ UI:** الحفاظ على نفس الـ JSX/التصميم بالكامل — تغيير منطق الإرسال فقط. الحقول الزائدة في setup (`commercialRegister, specialization, currency, address, taxId, employeeCount`) **تبقى ظاهرة لكن لا تُرسَل** (TODO صريح: تُحفظ لاحقاً عبر `companies` — قرار D1).
- **الـ Risks:**
  - الـ refresh الكامل للصفحة بين step1↔step2 يفقد `pendingRegistration` (ذاكرة) → نعالجه بـ guard (redirect لـ register لو فاضي).
  - رسائل الـ backend عربية فقط → في locale=en تظهر عربي (residual — يُحسّن بـ code→i18n mapping لاحقاً).
  - الـ password يمرّ في الذاكرة بين الخطوتين → مقبول (non-persist، يُمسح بعد register). الهاكر يراجع.

### المرحلة 4: إصلاح الـ middleware
- **الملفات:**
  - `apps/web/src/lib/auth/decide-redirect.ts` (جديد، **pure**) — `decideAuthRedirect({ pathname, hasHint, locales, defaultLocale }): string | null`. منطق التوجيه كله هنا (قابل للاختبار، **بدون أي فرع `NODE_ENV`**).
  - `apps/web/src/middleware.ts` — إزالة `createServerClient`/`supabase.auth.getUser` (`:13-35`) وإزالة الـ dev bypass (`:42-48`). يبقى `intlMiddleware`، ثم يقرأ `request.cookies.get('auth_hint')` ويستدعي `decideAuthRedirect`؛ لو رجّع target → `NextResponse.redirect`.
- **منطق `decideAuthRedirect`:**
  - `isDashboard && !hasHint` → `/{locale}/login` (في **كل** البيئات).
  - `isAuthPage && hasHint` → `/{locale}/dashboard`.
  - غير كده → `null` (كمّل عادي).
- **الـ Risks:**
  - `auth_hint` قابلة للتزوير (المستخدم يحطها يدوي) → الحماية الحقيقية في الـ backend guard + كل API call هيرجع 401. في S1 صفحات الـ dashboard mock فمفيش تسريب data. **توصية:** client route-guard يستدعي `/users/me` عند mount للـ dashboard → مؤجّل لـ S2 (residual risk موثّق).
  - بقايا Supabase cookies → الـ middleware بقى بيتجاهلها تماماً، فمستحيل تخلق ghost session.

### المرحلة 5: تنظيف وتأمين البقايا
- **الملفات:**
  - `apps/web/src/lib/supabase/{client,server}.ts` — بعد المرحلة 2/4 يصبحان dead code (مفيش مستهلك). **لا يُحذفان في هذه الـ session** (out of scope cleanup) لكن يُتأكَّد grep إنهما غير مستوردين في طبقة الـ auth. يُسجّل في الـ BACKLOG كـ cleanup.
  - تأكيد grep نهائي: صفر `supabase.auth` / `supabase.from(...).insert` في `apps/web/src/app/**` و`middleware.ts`.

---

## الـ Skills المطلوبة
- `CLAUDE.md` → Deep mode workflow + rules #1،#2،#3،#4،#7،#8.
- `INTEGRATION_PLAN.md` → القسم 2 (قرارات: 2.1 backend-first، 2.4 token storage، 2.5 error handling) + القسم 4.1/4.6 (أنماط client + الأنواع).
- `apps/web/AGENTS.md` → **Next.js 16**: قبل تعديل `middleware.ts` أو إزالة server actions، قراءة `node_modules/next/dist/docs/` (middleware + server-actions). توقيعات الـ API قد تختلف.
- `packages/shared-types` → `UserRole` enum (التأكد إن مفيش role يتبعت من الـ client).

---

## نقاط القرار

- **P1 — بنية اختبار الـ MVT (يحتاج إقرار):** `apps/web` مفيهوش test infra. القرار المقترح: **إضافة vitest خفيف** (`vitest` + `vitest.config.ts` + script) لتشغيل specs لـ pure functions فقط — مش بنية كاملة (مفيش jsdom/RTL). البديل (`node:test`) أصعب مع TS. → **الترجيح: vitest**.
- **P2 — auto-login بعد register:** الـ backend `register` لا يُرجع توكنات (`auth.service.ts:183-195` يرجّع `{company,user}` فقط). فبعد نجاح register ننادي `login` تلقائياً بالـ credentials الموجودة في الذاكرة → UX سلس + الدخول للـ dashboard مباشرة. (لو فشل auto-login → redirect لـ `/login` برسالة.)
- **P3 — `buildRegisterPayload` mapping** (pure، يُختبر):
  ```
  adminName    = `${step1.firstName} ${step1.lastName}`.trim()
  adminEmail   = step1.email
  adminPassword= step1.password
  companyName  = step2.companyName
  companyEmail = step1.email              // مفيش حقل company email في الـ UI — نستخدم بريد الأدمن (مطابق للسلوك الحالي actions.ts:138)
  companyPhone = step1.phone || undefined // اختياري
  // ❌ لا role، لا حقول setup الزائدة — DTO whitelist:true (main.ts:80) يرفض أي زيادة
  ```
- **P4 — مدة `auth_hint`:** `max-age=604800` (7 أيام، مطابقة لعمر الـ refresh cookie في `auth.controller.ts:36`)، `SameSite=Lax` (تتبعت على top-level navigation)، `Secure` في production فقط. تُمسح في logout وعند فشل refresh نهائي.
- **P5 — عرض الأخطاء:** نعرض `error.message` (عربي جاهز من الـ backend) مباشرة بدل mapping يدوي. الـ `code` يُحتفظ به لمعالجة خاصة (lockout). i18n الكامل لرسائل الـ backend = مؤجّل.

---

## التأثير على الـ Codebase الحالي

| الملف | التغيير |
|---|---|
| `(auth)/actions.ts` | 🗑️ حذف كامل (server actions الثلاثة + Supabase logic) |
| `middleware.ts` | ✏️ إزالة Supabase + dev bypass؛ التحويل لـ `auth_hint` + `decideAuthRedirect` |
| `(auth)/login/page.tsx` | ✏️ `useActionState` → `useLogin` client |
| `(auth)/register/page.tsx` | ✏️ → `setPendingRegistration` + navigate (بدون backend call)؛ password min 10+complexity |
| `(auth)/setup-workspace/page.tsx` | ✏️ → `buildRegisterPayload` + register + auto-login |
| `store/use-auth-store.ts` | ➕ جديد |
| `lib/api/auth-client.ts`, `map-auth-error.ts` | ➕ جديد |
| `lib/auth/{auth-hint,register-payload,decide-redirect,use-auth}.ts` | ➕ جديد |
| `.env.local`, `package.json`, `vitest.config.ts` | ➕ env + vitest |
| `lib/supabase/{client,server}.ts` | ⚠️ يصبح dead code (لا يُحذف الآن — BACKLOG) |
| `apps/api/**` | ✅ بدون تغيير (CORS متأكَّد سليم: `cors.config.ts:72,31`) |

---

## تعريف النجاح
- [ ] صفر `supabase.auth.*` / `supabase.from(...).insert` لأغراض auth في `apps/web` (grep نظيف).
- [ ] `/dashboard` بدون `auth_hint` → redirect `/{locale}/login` في **production و development** (لا فرع `NODE_ENV`).
- [ ] الـ access token في zustand **non-persist** فقط (مفيش localStorage/sessionStorage).
- [ ] register = نداء backend واحد ذرّي؛ **مفيش role يتبعت من الـ client**؛ الـ backend يحدد `SUPER_ADMIN`.
- [ ] password validation على الـ client مُحاذاة للـ backend (min 10 + complexity).
- [ ] auto-login بعد register يدخل الـ dashboard.
- [ ] logout يمسح الـ store + `auth_hint` وينادي `POST /auth/logout`.
- [ ] **MVT: 4 specs مكتوبة وpassing** (إجباري — rule #3):
  1. `buildRegisterPayload` → يبني الـ 6 حقول صح + **يؤكّد عدم وجود `role`** ولا حقول زائدة (paired/deepest assertion — rule #4).
  2. `decideAuthRedirect` → no-hint + dashboard ⇒ login في كل البيئات (**يؤكّد غياب فرع `NODE_ENV`**، مش بس «يرجّع string»).
  3. `mapAuthError` → يستخرج `{code,message}` من envelope الـ backend + fallback شبكة.
  4. `useAuthStore` → `setSession` ثم `clear` يصفّر `accessToken` و`user` (في الذاكرة).
- [ ] `npm run build` (web) بدون أخطاء + `vitest run` أخضر.

---
⏸️ AWAITING APPROVAL
رد بـ "approve" للانتقال لدور 💻 المبرمج (ينفّذ مرحلة مرحلة → 02-coder-report.md)، أو "edit: [تعديل]".

✋ تم المخطط — للدور التالي؟
