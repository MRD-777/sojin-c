# تقرير المخطط (ما بعد التنفيذ) — Session S1

> 🧠 المخطط — مراجعة post-execution لتنفيذ المبرمج (المراحل 1→5) ضد `00-plan.md`.

---

## مقارنة Plan vs Reality

| البند | المخطط (Plan) | المنفّذ (Reality) | متطابق؟ |
|-------|--------|---------|---------|
| **م1** auth store | zustand non-persist، `setSession`/`setAccessToken`/`setPending…`/`clear` | مطابق — `create()` بلا persist، نفس الـ actions، token في الذاكرة | ✅ |
| **م1** auth-client | axios، `baseURL=API_URL+/api/v1`، `withCredentials`، بدون refresh interceptor | مطابق + `unwrap` للـ envelope | ✅ |
| **م1** map-auth-error | pure، `{code,message}`، يميّز NETWORK | مطابق + `requestId`/`errors` | ✅ |
| **م1** auth-hint | `auth_hint=1; SameSite=Lax; max-age=604800`، Secure في prod | مطابق + `buildAuthHintCookie(secure)` pure helper | ✅ |
| **م1** register-payload | 6 حقول، بدون role، companyEmail=بريد الأدمن | مطابق حرفياً (P3) | ✅ |
| **م1** test infra | vitest خفيف + script + config | مطابق (`vitest@3.2.6`، environment node) | ✅ |
| **م2** حذف actions.ts | حذف كامل للدوال الثلاث + Supabase logic | محذوف بالكامل (grep نظيف) | ✅ |
| **م2** use-auth.ts | `useLogin/useRegister/useLogout`، useState، auto-login، بدون RQ | مطابق + نوع `RegisterOutcome` صريح (انحراف، تحت) | ⚠️ |
| **م3** login page | `useActionState`→`useLogin`، error.message عربي | مطابق | ✅ |
| **م3** register page | zod min10+complexity، `setPending`، بدون backend call | مطابق (نسخة طبق الأصل من DTO regex) | ✅ |
| **م3** setup page | guard pending، `buildRegisterPayload`، auto-login، حقول زائدة تظهر لا تُرسل | مطابق + branch على outcome | ✅ |
| **م4** decide-redirect | pure، بدون فرع NODE_ENV | مطابق (NODE_ENV = تعليق فقط) | ✅ |
| **م4** middleware | إزالة Supabase + dev bypass، auth_hint، matcher ثابت | مطابق، بقى sync | ✅ |
| **م5** cleanup | grep نظيف، supabase dead code → BACKLOG | مطابق + اكتشاف: dead code تام (صفر مستهلك في كل web/src) | ✅ |

---

## الانحرافات عن الـ Plan

1. **`RegisterOutcome` discriminated type في `useRegister`** (م2)
   - المبرمج أضاف `"success" | "autologin-failed" | "register-failed"` بدل boolean/ضمني.
   - **مبرّر:** الـ plan نصّ على قرار **P2** حرفياً («لو فشل auto-login → redirect لـ `/login`»). بدون تمييز «الحساب اتعمل بس الدخول فشل» عن «التسجيل فشل»، يستحيل تنفيذ P2 صح — الصفحة هتعامل الحالتين بنفس الشكل وتـ trap المستخدم أو تـ double-register.
   - **مقبول؟ ✅** — ده تنفيذ أدق لقرار موجود في الـ plan، مش feature جديد. لا يمسّ أي ملف آخر. كمان المبرمج وضع `clearPendingRegistration()` لحظة تأكُّد وجود الحساب (قبل auto-login) → يمنع double-register عند resubmit، وهي حالة الـ plan ما نصّ عليها صراحة لكنها ضمن روح P2.

2. **`fields.form` كمفتاح banner عام في register** (م3) — تفصيلة تنفيذية، لا سلوك فعلي (مفيش backend call في register فمفيش error عام دلوقتي). مقبول، صفر أثر.

لا انحرافات أخرى. صفر scope creep.

---

## تقييم المعمارية

**نقاط القوة المعمارية:**
- **فصل الـ pure logic عن الـ I/O نموذجي:** `decide-redirect`، `register-payload`، `map-auth-error`، `buildAuthHintCookie` كلها pure وقابلة للاختبار بدون mocks — ده اللي بيخلّي الـ MVT الأربعة ممكنة بـ vitest خفيف بدون jsdom/RTL. قرار سليم.
- **حدود الجلسة صحيحة:** الـ access token في الذاكرة فقط، refresh في httpOnly cookie على origin الـ API، `auth_hint` non-sensitive على origin الـ web. النموذج الثلاثي ده يطابق §2.4 ويغلق سطح XSS على الـ token.
- **مصدر واحد للحقيقة:** كل الـ validation/RBAC رجعت للـ backend؛ الـ client zod = UX layer فقط (مع تعليق صريح إن الـ backend يعيد التحقق). ده يقفل الـ root cause الأصلي (نموذجا جلسة متعارضان).
- **إزالة فرع NODE_ENV من التوجيه** = إصلاح الثغرة الأخطر في الـ middleware القديم (dev bypass كان بيسمح دخول dashboard بدون auth).

**ملاحظات معمارية (مش blockers):**
- **A-S1-1 — تمييز origin الـ instance:** `auth-client` axios منفصل عمداً عن الـ generic client (S2). سليم الآن، لكن لازم S2 يوحّد الـ baseURL/error-mapping عشان ما يحصلش drift بين الـ instancين (نفس نمط الانحراف اللي الـ session ده جاء يقفله على مستوى أكبر).
- **A-S1-2 — `auth_hint` spoofable:** موثّق كـ residual في الـ plan؛ الحماية الحقيقية backend guard. مقبول لـ S1 (dashboard mock، صفر data leak)، لكن client route-guard (`/users/me` on mount) لازم يتنفّذ S2 قبل ما الـ dashboard يحمل data حقيقية.
- **A-S1-3 — رسائل الـ backend عربية فقط:** في locale=en الأخطاء هتظهر عربي. residual موثّق. code→i18n mapping مؤجّل — مقبول.
- **A-S1-4 — `RegisterOutcome="autologin-failed"`:** الحساب موجود لكن المستخدم يروح `/login`. UX edge نادر (register نجح + login فشل فوراً) — مقبول، لكن يُفضّل S2 يضيف toast يوضّح «الحساب اتعمل، سجّل دخول».

---

## حاجات محتاجة تتعمل في sessions قادمة

- **WEB-CLEANUP-001** (BACKLOG) — حذف `lib/supabase/{client,server}.ts` + إزالة `@supabase/*` من package.json (dead code تام بعد S1).
- **WEB-TSC-001** (BACKLOG) — إصلاح الـ 2 pre-existing tsc errors (`cn` + dropdown) — build-blocker مستقل عن S1.
- **S2** — generic API client + refresh-on-401 interceptor + React Query mutations + client route-guard (A-S1-2) + i18n لرسائل الـ backend (A-S1-3).

---

## الحكم

✅ **التنفيذ متوافق مع الـ Plan** — كل المراحل الخمسة اتنفّذت كما صُمّمت. الانحراف الوحيد الجوهري (`RegisterOutcome`) هو تنفيذ أدق لقرار P2 موجود في الـ plan، لا توسّع scope. المعمارية تقفل الـ root cause (طبقتا جلسة متعارضتان) بفصل نظيف بين pure logic و I/O، وحدود جلسة صحيحة، وإزالة dev bypass الخطير.

⚠️ **شرط للإغلاق:** تعريف النجاح يتطلّب **MVT = 4 specs** (rule #2/#3) — لسه دور المختبر. كود S1 جاهز معمارياً، لكن الـ session **لا تُغلق** قبل كتابة الـ MVT الأربعة (`buildRegisterPayload` مع تأكيد غياب role، `decideAuthRedirect` مع تأكيد غياب فرع NODE_ENV، `mapAuthError`، `useAuthStore` setSession→clear).

ملاحظة للهاكر القادم (rule #5/#7): ركّز على — (1) `auth_hint` tampering، (2) password leakage بين الخطوتين في الذاكرة، (3) أي قناة يتسرّب منها `role` للـ backend رغم الـ whitelist، (4) الـ auto-login credential handling.

✋ تم المخطط (ما بعد التنفيذ) — للدور التالي (🔴 الهاكر)؟
