# Scope — Session S1: توحيد الـ Auth عبر الـ Backend (Backend-first)

## Mode: Deep
السبب: شغل auth حسّاس أمنياً (security-critical) + production-blocking + بيمس عدة ملفات في طبقتين (web auth + middleware + احتمال CORS) — ده بالظبط التعريف اللي CLAUDE.md بيحطه تحت Deep mode.

---

## المهمة
إيقاف الـ Supabase-direct نهائياً في طبقة الـ auth، وتوحيد كل الـ login/register/logout عبر NestJS backend (`/api/v1/auth/*`)، مع تخزين الـ access token في الذاكرة (zustand) والاعتماد على الـ refresh httpOnly cookie اللي الـ backend بيضبطها، وإصلاح الـ middleware bypass.

---

## الـ Blockers المستهدفة (من INTEGRATION_PLAN.md القسم 1.3)

| # | Blocker | الموقع الفعلي | المطلوب |
|---|---|---|---|
| BLOCKER-1 | الـ auth يكلم Supabase مباشرة بدل الـ backend | `actions.ts:56-69` (login)، `:82-105` (register)، `:107-173` (setup) | تحويل لاستدعاء `POST /api/v1/auth/{login,register}` |
| BLOCKER-2 | dev bypass في الـ middleware | `middleware.ts:42-48` (`if NODE_ENV !== 'development'`) | إزالة الـ bypass — redirect في كل البيئات |
| BLOCKER-3 | role غلط `'org:admin'` | `actions.ts:93` (`role: 'org:admin'`) | الـ backend بيحدد `SUPER_ADMIN` تلقائياً (`auth.service.ts:133`) — نوقف إرسال أي role من الـ client |
| BLOCKER-4 | setup-workspace بيكتب على جداول Supabase مباشرة | `actions.ts:107-173` (insert في `companies` + `users`) | دمج البيانات في نداء `register` واحد ذرّي (`auth.service.ts:71-218`) |

---

## الملفات المتأثرة

### تُعدّل (web)
- `apps/web/src/app/[locale]/(auth)/actions.ts` — إعادة كتابة: إزالة كل `supabase.auth.*` والـ table inserts؛ الـ auth يروح للـ backend. (الـ `"use server"` غالباً يتشال — انظر قرار D2 تحت.)
- `apps/web/src/middleware.ts` — إزالة dev bypass (`:42-48`)؛ التحويل لاعتماد `auth_hint` cookie بدل Supabase session (`:13-35`).
- `apps/web/src/app/[locale]/(auth)/login/page.tsx` — ربط بالـ flow الجديد (client mutation بدل `useActionState` على server action).
- `apps/web/src/app/[locale]/(auth)/register/page.tsx` — نفس الشيء.
- `apps/web/src/app/[locale]/(auth)/setup-workspace/page.tsx` — يُدمج مع register (خطوة واحدة) أو يتحوّل لخطوة post-register للحقول الزائدة (قرار D1).

### تُنشأ (web)
- `apps/web/src/store/use-auth-store.ts` — zustand: `accessToken`, `user`, `setSession`, `setAccessToken`, `clear` (non-persist، في الذاكرة).
- `apps/web/src/lib/api/auth-client.ts` — طبقة auth-specific صغيرة (`login`, `register`, `logout`, `refresh`, `me`) بـ `fetch`/axios + `credentials: include`. **مش** الـ generic client بالكامل (ده S2) — الحد الأدنى لتشغيل الـ auth فقط.
- `apps/web/src/lib/auth/auth-hint.ts` — set/clear للـ `auth_hint` cookie على دومين الـ web (غير حسّاسة، UX redirect فقط).

### تُراجَع (api) — تعديل فقط لو لزم
- `apps/api/src/common/config/cors.config.ts` — تأكيد `origin` الـ web في الـ whitelist + `credentials: true` (مطلوب لإرسال الـ refresh cookie cross-origin). تعديل **فقط** لو ناقص.

### لا تُلمس (مرجع فقط)
- `apps/api/src/modules/auth/auth.controller.ts`, `auth.service.ts`, `jwt.strategy.ts` — منطق الـ backend سليم؛ هذه الـ session لا تغيّره.

---

## الـ Services / الموديولات + Coverage budget (rule #6)

| Service / Module | الطبقة | التغيير في الـ session | Coverage budget |
|---|---|---|---|
| `AuthService` (`auth.service.ts`) | api | **لا تغيير** — مستهلَك كما هو | موجود مسبقاً (`auth.service.spec.ts`) — لا specs جديدة |
| `JwtStrategy` | api | لا تغيير | deferred (BACKLOG #4) — خارج النطاق |
| `useAuthStore` (جديد) | web | منطق set/clear للجلسة | ≥1 spec (pure: set→get→clear) |
| `auth-client` (جديد) | web | mapping payload + تطبيع الخطأ | ≥1 spec (pure: error/role mapping) |
| `middleware` redirect logic | web | إزالة bypass + auth_hint gate | ≥1 spec (pure: قرار التوجيه) |
| register payload merge (D1) | web | دمج حقول register+setup → DTO | ≥1 spec (pure: transform) |

> **MVT budget النهائي يحدده المخطط في `00-plan.md`** (rule #3). التقدير المبدئي: 4 specs (auth-store، error/role mapping، middleware decision، register-merge transform).

---

## قرارات معمارية مرفوعة للمخطط (تُحسم في 00-plan.md)

- **D1 — مصير حقول setup-workspace الزائدة:** `RegisterCompanyDto` (`auth/dto/index.ts:19-58`) يقبل فقط: `companyName, companyEmail, companyPhone?, adminName, adminEmail, adminPassword`. لكن `setup-workspace` بيجمع كمان: `commercialRegister, specialization, currency, address, taxId, employeeCount` — **مفيش لها مقابل في الـ DTO ولا في إنشاء الـ Company** (`auth.service.ts:118-124` بيحط `name, slug, email, phone` بس).
  - الخيار المقترح: register يرسل الـ 6 حقول المدعومة فقط؛ الحقول الزائدة تُؤجَّل (TODO صريح أو خطوة post-login عبر `companies` لاحقاً). **توسيع الـ backend DTO خارج نطاق هذه الـ session** (هيرفع لـ session backend منفصل).
- **D2 — Server Action أم Client-side call؟** الـ refresh cookie لازم تكون first-party على دومين الـ API (`auth.controller.ts:37` path=`/api/v1/auth`، port 4000). لو اتنادت من server action على دومين الـ web (3000) مش هتتبعت للـ API على refresh. **الترجيح: تحويل الـ auth لـ client-side mutations** (browser → :4000، `credentials: include`). المخطط يأكّد.
- **D3 — اسم وحقول الـ `auth_hint` cookie** + سياسة الـ expiry + التعامل مع locale في الـ redirect (`middleware.ts:44-46, 53-56`).

---

## الـ Hacker mode (rule #7)
**attack-and-fix** (default). auth = أعلى سطح هجوم؛ الهاكر يصلح inline ما يقدر، ويفتح NEEDS-CODER لأي تغيير معماري. تركيز الهجوم المتوقع:
- تسريب الـ access token (XSS / localStorage) — لازم يفضل في الذاكرة فقط.
- تجاوز الـ middleware عبر تزوير `auth_hint` cookie (تأكيد إنها UX فقط، الحماية في الـ backend guard).
- بقايا Supabase session بعد التحول (cookies قديمة تخلق جلسة شبح).
- open-redirect في الـ post-login redirect.
- إرسال role من الـ client (mass-assignment) — لازم يتجاهله الـ backend (DTO `whitelist:true` في `main.ts:80`).

---

## الـ Skills المستخدمة
- نظام الأدوار في `CLAUDE.md` (Deep mode — 7 ملفات، 6 وقفات).
- `INTEGRATION_PLAN.md` (المرجع المعماري — Phase 0 + قرارات القسم 2).
- `apps/web/AGENTS.md` — **Next.js 16 مختلف**: قبل أي تعديل middleware / server-action، قراءة `node_modules/next/dist/docs/` للجزء المعني.

---

## الحدود (خارج نطاق هذه الـ session)
- الـ generic API client الكامل بالـ interceptors + refresh-on-401 العام → **S2 (Phase 1)**.
- ربط أي صفحة dashboard ببيانات حقيقية → S3+.
- توسيع `RegisterCompanyDto` أو موديل الـ Company بحقول جديدة → session backend منفصل.
- `forgot-password` / reset flow (مشار له في `login/page.tsx:128`) — مفيش backend endpoint له، مؤجّل.
- إعداد بنية اختبار web كاملة (vitest/jest) — لو مش موجودة، الـ MVT يقتصر على pure functions framework-agnostic (يحسمه المخطط). ملاحظة: `apps/web/package.json` مفيهوش test script أو test dep.
- أي تعديل في منطق `auth.service.ts` / `auth.controller.ts`.

---

## تعريف النجاح (مبدئي — يُفصّله المخطط)
- [ ] صفر استدعاءات `supabase.auth.*` لأغراض login/register في `apps/web` (grep نظيف).
- [ ] صفر `supabase.from('companies'|'users').insert` في طبقة الـ auth.
- [ ] `/dashboard` بدون جلسة → redirect لـ `/login` في **production و development**.
- [ ] الـ access token مش في localStorage/sessionStorage (zustand non-persist).
- [ ] الـ role مبيتبعتش من الـ client؛ الـ backend يحدد `SUPER_ADMIN`.
- [ ] register خطوة واحدة ذرّية عبر الـ backend (مفيش insert مباشر لـ Supabase).
- [ ] **MVT: [عدد] specs مكتوبة وpassing** — يحدده المخطط (rule #3).

---
⏸️ AWAITING APPROVAL — رد بـ "approve" للانتقال لدور 🧠 المخطط (00-plan.md)، أو "edit: [تعديل]".

✋ تم scope — للدور التالي؟
