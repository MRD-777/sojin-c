# تقرير الهاكر — Session S1

> 🔴 Red Team — **Hacker mode: attack-and-fix** (default، حسب الـ scope rule #7).
> الهجوم اتبنى على أولويات المخطط الـ 7 + attack vectors إضافية.

---

## Attack Vectors المفحوصة

- [x] Authentication bypass (auth_hint tampering)
- [x] Authorization / privilege escalation (role injection رغم whitelist)
- [x] Input validation (client zod vs backend DTO)
- [x] Tenant isolation (CORS credentialed origin)
- [x] Business logic abuse (register/auto-login flow)
- [x] Secret leakage (password في الذاكرة بين الخطوتين)
- [x] Open redirect (post-login navigation)
- [x] XSS → token exfiltration
- [x] Ghost session (بقايا Supabase cookies)
- [x] Sensitive logging (password/token في console)

---

## الثغرات المكتشفة

### [CVE-S1-001] Plaintext password يبقى في الذاكرة بعد login لحساب مختلف
- **الخطورة:** MEDIUM
- **الموقع:** `apps/web/src/store/use-auth-store.ts` — `setSession` (قبل الإصلاح)
- **السيناريو (خطوة بخطوة):**
  1. مستخدم يبدأ register → `setPendingRegistration({...password})` يحط الـ plaintext password في الـ store (الذاكرة).
  2. يهجر setup-workspace (ما يكمّلش register) → الـ `pendingRegistration` **يفضل في الذاكرة** (مفيش `clearPendingRegistration`).
  3. في **نفس الـ tab** يروح `/login` ويسجّل دخول بحساب تاني → `useLogin` بيستدعي `setSession` فقط، **مش** `clear`/`clearPendingRegistration`.
  4. النتيجة: الـ plaintext password بتاع التسجيل المهجور بيعيش داخل جلسة authenticated لمستخدم آخر، متاح لأي script (XSS) أو React DevTools طول عمر الـ tab.
- **التأثير:** تسريب credential عبر الجلسات في نفس الجهاز/الـ tab. يكبّر نافذة سرقة الـ password عبر XSS من «بين خطوتين» لـ «طول الجلسة».
- **الإصلاح المطبق:** ربط مسح `pendingRegistration` بأعمق primary action (rule #4): `setSession` نفسه بقى يصفّر `pendingRegistration: null`. ده يغطّي **المسارين** (login العادي + register auto-login) بضمان واحد، بدل الاعتماد على استدعاء منفصل قابل للنسيان.
  ```ts
  setSession: ({ accessToken, user }) =>
    set({ accessToken, user, pendingRegistration: null }),
  ```
- **الحالة:** FIXED-BY-HACKER ✅
- **توصية للمختبر:** الـ MVT #4 (`setSession` ثم `clear`) لازم يضيف assertion إضافي: بعد `setPendingRegistration(...)` ثم `setSession(...)` → `pendingRegistration === null` (paired/deepest assertion — يثبت إن مسح الـ secret مربوط بالـ session set، مش بسطر منفصل).

---

### [CVE-S1-002] auth_hint cookie قابلة للتزوير = البوابة الوحيدة للـ dashboard
- **الخطورة:** LOW (في S1) → ⬆️ HIGH (في S2 لما data حقيقية تنزل)
- **الموقع:** `apps/web/src/middleware.ts` + `apps/web/src/app/[locale]/dashboard/layout.tsx`
- **السيناريو:**
  1. مهاجم بدون أي حساب يكتب في الـ devtools: `document.cookie = "auth_hint=1; path=/"`.
  2. يفتح `/ar/dashboard` → الـ middleware يلاقي `hasHint=true` → `decideAuthRedirect` يرجّع `null` → الصفحة تتحمّل.
- **التحقق الفعلي (ليه LOW في S1):** فحصت كل صفحات `dashboard/**` + `DashboardLayoutWrapper`:
  ```
  grep "authClient|fetch(|api/v1|useAuthStore|accessToken|.me(|axios" src/app/[locale]/dashboard/ src/components/dashboard/
  → صفر نتائج
  ```
  الـ dashboard **mock بالكامل** — صفر data fetch. التزوير يعرض shell فاضي فقط، **مفيش تسريب data**. وأي API call حقيقي (S2) هيرجع 401 لأن الـ in-memory token = null.
- **التأثير (S1):** عرض UI shell فقط — لا data، لا actions. (S2): لو نزلت data حقيقية بدون client route-guard → عرض بيانات tenant بدون auth.
- **الإصلاح:** ❌ NOT FIXED inline (مبرّر) — الإصلاح الحقيقي = client route-guard (`/users/me` on mount) وهو architectural change **مؤجّل صراحة لـ S2** في الـ plan (سطر 86) وملاحظات المخطط (A-S1-2). الحماية الحقيقية موجودة في الـ backend JWT guard لكل endpoint.
- **الحالة:** OPEN — accepted لـ S1، **blocker لـ S2**.
- **توصية:** S2 لازم يضيف client route-guard قبل أول data fetch في الـ dashboard. سُجّل ضمن residuals.

---

### [CVE-S1-003] لا يوجد Content-Security-Policy header
- **الخطورة:** MEDIUM (defense-in-depth)
- **الموقع:** `apps/web/next.config.ts` — `headers()` فيه X-Frame-Options/nosniff/Referrer/Permissions، **بدون CSP**.
- **السيناريو:** الـ access token في الذاكرة (مش localStorage) — كويس ضد سرقة persistence-based. **لكن** أي XSS نشط في نفس الـ context يقدر يقرأ `useAuthStore.getState().accessToken` مباشرة. CSP صارم (script-src self + nonce) بيقلّل سطح حقن الـ XSS أصلاً.
- **التأثير:** بدون CSP، أي XSS gadget = exfiltration فوري للـ token (وممكن الـ pendingRegistration password قبل CVE-S1-001).
- **الإصلاح:** ❌ NOT FIXED inline (مبرّر) — CSP صارم مع Next + framer-motion + next-intl يحتاج nonce wiring للـ inline scripts اللي Next بيحقنها؛ CSP غلط = كسر التطبيق runtime. لا أقدر أتحقق من الـ runtime هنا (الـ build type-check محجوب بـ pre-existing errors، ومش هشغّل dev server). إضافة CSP مكسور أسوأ من غيابه.
- **الحالة:** OPEN — يحتاج مهمة hardening مخصّصة (report-only CSP أولاً ثم enforce).
- **توصية:** S2/hardening — أضف CSP report-only، راقب violations، ثم enforce مع nonce.

---

## Attack Vectors اللي اتفحصت وطلعت آمنة (لا ثغرة)

| الهجوم | النتيجة | الدليل |
|--------|---------|--------|
| **Role injection رغم whitelist** (أولوية #3) | ✅ آمن | `buildRegisterPayload` يبعت 6 حقول فقط بدون `role`؛ `setup handleSubmit` يقرأ `companyName` فقط (الحقول الزائدة في الـ DOM لا تُقرأ ولا تُرسَل)؛ backend `whitelist:true` (main.ts:80) يجرّد أي زيادة + يفرض `SUPER_ADMIN` (auth.service). **صفر قناة لتسريب role.** |
| **Open redirect بعد login** (أولوية #5) | ✅ آمن | `login/page.tsx` يـ hardcode `router.push("/dashboard")`. `grep "searchParams\|redirect\|next=\|returnTo\|callbackUrl"` على `(auth)/**` → صفر. مفيش user-controlled redirect target. |
| **Ghost session من بقايا Supabase** (أولوية #7) | ✅ آمن | الـ middleware ما عادش يقرأ أي Supabase cookie (`grep supabase` على middleware → صفر). `decideAuthRedirect` يقرأ `auth_hint` فقط. أي `sb-*` cookie قديمة = inert تماماً. |
| **XSS injection sink** (أولوية #6 جزئياً) | ✅ آمن | `grep "dangerouslySetInnerHTML\|innerHTML" src/` → صفر. مفيش HTML sink في طبقة الـ auth. (التسريب المتبقي = CVE-S1-003 defense-in-depth.) |
| **Token persistence (XSS theft surface)** | ✅ آمن | `grep "localStorage\|sessionStorage"` → النتيجة الوحيدة تعليق. الـ token memory-only فعلاً. |
| **Sensitive logging** | ✅ آمن | `grep console.*` على `lib/api,lib/auth,store,(auth)` → صفر. الـ `console.error(password/error)` القديم في `actions.ts` اختفى مع الحذف. `removeConsole` في production (next.config:17) يجرّد أي بقايا. |
| **CORS credentialed wildcard** (tenant isolation) | ✅ آمن | `cors.config.ts`: allowlist (`allowed.has(origin)`)، `credentials:true`، يرفض أي origin مجهول مع log. مفيش origin reflection. الـ refresh cookie ما يتسربش لـ origin غريب. |
| **Password في الذاكرة بين الخطوتين** (أولوية #2) | ⚠️→✅ | non-persist zustand؛ يُمسح بـ `clearPendingRegistration` في register success؛ **وبعد CVE-S1-001** يُمسح أيضاً عند أي `setSession`. البقاء الوحيد المقبول = حالة `register-failed` (retry مقصود، in-memory، يزول بإغلاق الـ tab). |
| **auto-login credential handling** (أولوية #4) | ✅ آمن | الـ password يُمرّر كـ local var (`payload.adminPassword`) لـ `authClient.login`؛ مش بيتكتب في أي مكان دائم؛ `clearPendingRegistration` قبل auto-login + `setSession` يصفّر pending. |

---

## ملاحظات للمراجعة (مش ثغرات — robustness)

- **N1 — `decideAuthRedirect` substring matching:** يستخدم `pathname.includes("/dashboard")`. غير قابل للاستغلال حالياً (ترتيب الفحص يضمن fail-safe: الـ dashboard check قبل الـ auth check). **لكن** البوابة تحمي المسارات اللي فيها literal `/dashboard` فقط — لو S2 أضاف مسار محمي بدون الكلمة دي (مثل `/ar/settings`) مش هيتحمى تلقائياً. **توصية S2:** حوّل لـ segment-aware + قائمة مسارات محمية صريحة. لم أعدّله الآن لتجنّب churn على الـ MVT اللي المختبر هيكتبه.

---

## ملخص الإصلاحات
- CRITICAL: 0 لقى → اتصلح 0
- HIGH: 0 لقى → اتصلح 0 (CVE-S1-002 يصبح HIGH في S2، مؤجّل بمبرر)
- MEDIUM: 3 لقى (CVE-S1-001, -002[حالياً LOW], -003) → اتصلح **1** (CVE-S1-001)
- LOW: 0
- NEEDS-CODER: 0 — الـ session **لم يتوقف** (CVE-S1-001 اتصلح inline؛ -002/-003 OPEN مؤجّلة بمبرر معماري موثّق في الـ plan)

## ثغرات لسه مفتوحة (مع مبرر)
- **CVE-S1-002** — auth_hint tampering — السبب: الإصلاح = client route-guard architectural مؤجّل صراحة لـ S2 (plan سطر 86)؛ S1 dashboard mock فصفر data leak؛ الحماية الفعلية في الـ backend guard.
- **CVE-S1-003** — لا CSP — السبب: CSP صارم يحتاج nonce wiring + تحقق runtime مش متاح في الـ session دي؛ CSP مكسور أسوأ من غيابه. يحتاج مهمة hardening مخصّصة.

## Verification (literal) — بعد إصلاح CVE-S1-001
```
$ npx tsc --noEmit | grep -c "error TS"
2
$ npx tsc --noEmit | grep "error TS" | grep -v "permissions/page\|dropdown-menu"
zero NEW errors — only the 2 pre-existing remain
```
> الإصلاح (CVE-S1-001) لم يُدخل أي خطأ جديد. باقي فقط الـ 2 pre-existing (`WEB-TSC-001`).

## توصيات للمختبر
اعمل MVT/tests للحالات دي:
1. **CVE-S1-001 (إجباري — re-attack، rule #5):** `setPendingRegistration({...password})` ثم `setSession({...})` → assert `pendingRegistration === null` **و** `accessToken/user` اتظبطوا. (paired assertion — يثبت مسح الـ secret مربوط بالـ session، مش سطر منفصل.)
2. `buildRegisterPayload` → 6 حقول + **غياب `role`** (تأكيد CVE-vector #3 مقفول).
3. `decideAuthRedirect` → no-hint + dashboard ⇒ login **في كل البيئات** (غياب فرع NODE_ENV).
4. `mapAuthError` → استخراج `{code,message}` من envelope + fallback NETWORK.
5. (اختياري) `decideAuthRedirect` → `/ar/dashboard` بـ hint ⇒ null (مش redirect) — يغطّي N1.

✋ تم الهاكر — للدور التالي (🧪 المختبر)؟
