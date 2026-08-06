# 🔌 خطة ربط الـ Frontend بالـ Backend — Construction SaaS

> **مبنية على قراءة الكود الفعلي** (لا افتراضات). كل سطر مرجعي مكتوب بالمسار + رقم السطر.
> آخر تحديث: 2026-06-26.
> مراجع أعمق للـ endpoints: `.claude/docs/BACKEND_REFERENCE_*.md`.

---

## 📌 ملخص تنفيذي (اقرأه أولاً)

الوضع الحالي **منفصل تماماً**:

- **الـ Backend** (`apps/api`) جاهز ومتين: NestJS، prefix `/api/v1`، 12 موديول، RBAC كامل (Roles + Permissions guards عالمية)، response envelope موحّد، error envelope موحّد، idempotency، audit، lockout، tenant isolation. **لكن الـ frontend لا يستدعيه إطلاقاً.**
- **الـ Frontend** (`apps/web`) يتكلم **مباشرة مع Supabase** عبر `@supabase/ssr` (login/register/إنشاء company + user في جداول Supabase مباشرة)، وكل صفحات الـ dashboard تعرض **mock data ثابتة** (arrays inline أو i18n strings).
- **لا يوجد API client، ولا hooks، ولا أي استدعاء لـ `/api/v1`** في الـ web.

النتيجة: عندنا backend enterprise-grade شغّال في الفراغ، و frontend جميل بصرياً لكنه واجهة فارغة. هذه الخطة تربطهم بأمان وبالترتيب الصحيح.

**أهم 3 قرارات** (التفاصيل في القسم 2):
1. **Auth = Backend-first** — نوقف الـ Supabase-direct نهائياً ونوجّه كل auth عبر `/api/v1/auth/*`. الـ Supabase يبقى IdP خلف الـ backend فقط.
2. **Data = React Query** (الـ provider موجود بالفعل) + axios client واحد بـ interceptors.
3. **Token = access في الذاكرة (zustand)** + **refresh في httpOnly cookie** (الـ backend يضبطها بالفعل — انظر `auth.controller.ts:35-56`).

---

# القسم 1: تحليل الوضع الحالي

## 1.1 جدول الصفحات: mock أم API؟

> كل صفحات الـ dashboard حالياً **mock 100%**. العمود الأخير = الـ endpoint الفعلي الموجود في الـ backend الذي يجب الربط به.

| الصفحة (مسار `apps/web/src/app/[locale]/...`) | المصدر الحالي | Endpoint الموجود فعلاً في الـ backend | جاهزية الـ backend |
|---|---|---|---|
| `(auth)/login/page.tsx` | Server Action → Supabase مباشرة (`actions.ts:44`) | `POST /api/v1/auth/login` (`auth.controller.ts:80`) | ✅ جاهز |
| `(auth)/register/page.tsx` | Server Action → `supabase.auth.signUp` (`actions.ts:71`) | `POST /api/v1/auth/register` (`auth.controller.ts:69`) | ✅ جاهز |
| `(auth)/setup-workspace/page.tsx` | Server Action → insert في جداول Supabase (`actions.ts:107`) | مدموج داخل `register` (company+user atomic) | ⚠️ يحتاج إعادة تصميم flow |
| `dashboard/page.tsx` (Overview) | mock inline (`page.tsx:28-55, 83-208`) | لا يوجد endpoint dashboard مجمّع — يُركّب من `projects` + `payments/summary` | 🟡 جزئي |
| `dashboard/projects/page.tsx` | mock array (`projectsData` سطر 77-145) | `GET /api/v1/projects` (`projects.controller.ts:37`) | ✅ جاهز |
| `dashboard/projects/new/page.tsx` | state محلي، `handleSubmit` يعمل `router.push` فقط (`new/page.tsx:85-88`) | `POST /api/v1/projects` (`projects.controller.ts:61`) | ✅ جاهز |
| `dashboard/projects/[id]/page.tsx` | mock | `GET /api/v1/projects/:id` + `GET .../phases` + `.../payments/summary` | ✅ جاهز |
| `dashboard/projects/reviews/page.tsx` | mock | `GET /api/v1/phases/:phaseId/updates` (status=PENDING) + approve/reject | ✅ جاهز |
| `dashboard/projects/sla/page.tsx` | mock | لا يوجد endpoint SLA مخصص | ❌ غير موجود |
| `dashboard/team/page.tsx` | mock | `GET /api/v1/users` (`users.controller.ts:37`) | ✅ جاهز |
| `dashboard/team/permissions/page.tsx` | mock | `PATCH /api/v1/users/:id/permissions` (`users.controller.ts:130`) | ✅ جاهز |
| `dashboard/team/{attendance,leaves,org-chart,performance,training,safety}` | mock | **لا يوجد backend** لأي منها | ❌ غير موجود |
| `dashboard/subcontractors/page.tsx` + `_data.ts` | mock (`_data.ts`) | `GET /api/v1/sub-contractors` (`sub-contractors.controller.ts:30`) | ✅ جاهز |
| `dashboard/finance/page.tsx` | mock | `GET /api/v1/projects/:id/payments/summary` (`payments.controller.ts:51`) | 🟡 جزئي (per-project فقط) |
| `dashboard/finance/payments/page.tsx` | mock | `GET /api/v1/projects/:projectId/payments` (`payments.controller.ts:40`) | ✅ جاهز |
| `dashboard/finance/{invoices,petty-cash,profitability,reconciliation}` | mock | **لا يوجد backend** | ❌ غير موجود |
| `dashboard/audit/page.tsx` | mock | `GET /api/v1/audit-logs` (`audit.controller.ts:17`, SUPER_ADMIN) | ✅ جاهز |
| `dashboard/reports/page.tsx` | mock | لا يوجد endpoint reports | ❌ غير موجود |
| `dashboard/chat` (في الـ nav، الصفحة ناقصة) | — | `GET/POST /api/v1/projects/:projectId/chat-rooms` + messages | ✅ جاهز (صفحة ناقصة) |

## 1.2 الـ Gaps: backend موجود ومش مستخدم في الـ frontend

كل هذه الموديولات شغّالة في الـ backend وصفر استهلاك في الـ frontend:

| الموديول | Endpoints رئيسية | الحالة في الـ frontend |
|---|---|---|
| **projects** | list/get/create/update/status/delete + assignments | ❌ غير مربوط (mock) |
| **phases** | `projects/:id/phases`، progress، reorder، delete | ❌ لا توجد صفحة |
| **updates** | lifecycle كامل: create→submit→approve/reject/force-cancel + versions | ❌ لا توجد صفحة (reviews mock) |
| **media** | upload-url → register → signed-url → delete | ❌ غير مربوط |
| **payments** | list/get/summary/create (idempotent)/delete | ❌ mock |
| **comments** | `updates/:id/comments` CRUD + status | ❌ غير مربوط |
| **sub-contractors** | list/get/create/update + phase-assignments | ❌ mock |
| **chat** | rooms + messages + read | ❌ لا توجد صفحة |
| **audit** | `audit-logs` query | ❌ mock |
| **companies** | `me`، update، settings، storage | ❌ غير مربوط |
| **users** | list/get/me/create/role/permissions/activate/deactivate/delete | ❌ mock |

> خلاصة: **11 من 12 موديول** غير مستهلكة. الموديول الوحيد المُلامس جزئياً هو `auth` — ومع ذلك الـ frontend يتجاوزه ويكلم Supabase مباشرة.

## 1.3 الـ Blockers الأمنية (بأرقام أسطر فعلية)

### 🔴 BLOCKER-1 — Auth يتجاوز الـ Backend بالكامل (Supabase-direct)
- **الموقع:** `apps/web/src/app/[locale]/(auth)/actions.ts:56-69` (login)، `:82-105` (register)، `:107-173` (setup-workspace).
- **المشكلة:** الـ frontend يعمل `supabase.auth.signInWithPassword` و`signUp` و`insert` مباشرة في جداول `companies`/`users` باستخدام anon key. هذا يتجاوز:
  - الـ lockout بعد 5 محاولات (`auth.service.ts:235-244`، `LoginAttemptsTracker`).
  - فحص `isActive` + `subscriptionStatus=EXPIRED` + `company.deletedAt` (`auth.service.ts:298-321`).
  - الـ atomic transaction + audit log + Supabase rollback عند فشل الـ DB (`auth.service.ts:117-217`).
  - توليد slug آمن crypto (`auth.service.ts:492-520`) — الـ frontend يستخدم `Math.random().toString(36)` (`actions.ts:136`) → عرضة للتصادم.
- **خطر إضافي:** `registerManager` يحقن `role: 'org:admin'` (`actions.ts:93`) — قيمة **غير موجودة** في enum الأدوار (`packages/shared-types/src/enums.ts:7-15` كلها snake_case مثل `super_admin`). انفصال كامل في نموذج الأدوار.

### 🔴 BLOCKER-2 — الـ Middleware يسمح بالدخول بدون auth في الـ development
- **الموقع:** `apps/web/src/middleware.ts:40-49`.
- **المشكلة:** الـ redirect للـ login مشروط بـ `if (process.env.NODE_ENV !== 'development')` — يعني في الـ dev أي شخص يفتح `/dashboard` يدخل **بدون أي توكن**. كل تطوير الربط سيحصل تحت هذا الـ bypass، وسهل أن يتسرّب السلوك للـ production إذا اختلّ `NODE_ENV`.
- **خطر تابع:** الـ middleware يعتمد على Supabase session cookie (`middleware.ts:33-35`) — بعد التحول لـ backend-first لن تكون هذه الـ cookie مصدر الحقيقة.

### 🟡 BLOCKER-3 — لا يوجد جسر للتوكن بين الطبقتين
- لا يوجد أي مكان في `apps/web` يقرأ access token ويمرره كـ `Authorization: Bearer` لـ `/api/v1`. الـ backend يرفض أي request بدون JWT (الـ `JwtAuthGuard` عالمي — `app.module.ts:86-93`)، فحتى لو ربطنا صفحة، ستُرجع 401.

### 🟡 BLOCKER-4 — تضارب نموذج الجلسة (Supabase cookie ضد backend cookie)
- الـ backend يضبط refresh cookie على `path=/api/v1/auth` ودومين الـ API (`auth.controller.ts:37`، port 4000).
- الـ Supabase-ssr يضبط session cookies على دومين الـ web (port 3000).
- لو فضل الاثنان شغّالين، يبقى عندنا مصدران للجلسة يتعارضان. لازم نلغي أحدهما (القرار: نلغي Supabase-direct).

### 🟢 ملاحظة CORS
- `apps/api/src/main.ts:75` يفعّل CORS عبر `buildCorsOptions()`. أي طلب بـ credentials (cookies) يتطلب أن يكون الـ origin (`http://localhost:3000`) في الـ whitelist + `credentials: true`. **تأكيد إلزامي قبل أول request** (`common/config/cors.config.ts`).

---

# القسم 2: قرارات معمارية

> لكل قرار: الخيارات → التوصية → السبب. القرارات مبنية على ما هو **مُثبّت في الكود** بالفعل.

## 2.1 Auth — Backend-first أم Supabase-direct؟

| الخيار | الوصف | Trade-offs |
|---|---|---|
| **(أ) Backend-first ✅ موصى به** | الـ web يكلم `/api/v1/auth/*` فقط. Supabase = IdP خلف الـ backend. | + يستفيد من lockout/audit/atomic/subscription checks الموجودة.<br>+ مصدر واحد للحقيقة + RBAC من DB.<br>− لازم حذف/تعطيل `actions.ts` + إعادة كتابة middleware. |
| (ب) Supabase-direct | نُبقي الوضع الحالي ونضيف backend للبيانات فقط. | − يضاعف منطق الأمان وينحرف عنه (الأدوار، الـ audit، الـ lockout).<br>− `JwtStrategy` يعتمد على وجود user في DB (`jwt.strategy.ts:37`) — التسجيل المباشر يخلق سجلات غير متّسقة. |

**التوصية: (أ) Backend-first.**
**السبب:** الـ backend بالفعل بنى الـ flow الكامل (`auth.service.ts`) بما فيه الـ rollback عند فشل DB والـ audit داخل نفس الـ transaction. الـ `JwtStrategy` يتحقق من Supabase JWT عبر `JWT_SECRET` ثم يحمّل المستخدم من DB ويبني الصلاحيات (`jwt.strategy.ts:18-87`) — أي أن **الـ backend مصمّم أصلاً ليستقبل Supabase access token كـ Bearer**. هذا يجعل التحول سلساً: نسجّل عبر الـ backend، نأخذ الـ `accessToken` من الـ response، ونمرره لكل الطلبات.

> **ملاحظة flow التسجيل:** الـ backend يدمج «إنشاء الشركة + super admin» في `POST /auth/register` بعملية ذرّية واحدة (`auth.service.ts:71`). لذلك مسار `register` ثم `setup-workspace` المنفصل (`actions.ts`) **يُدمج في خطوة واحدة** أو يصبح wizard يجمع الحقول ثم يرسل request واحد لـ `register`.

## 2.2 Data Fetching — React Query أم Server Actions أم الاثنين؟

| الخيار | Trade-offs |
|---|---|
| **React Query (موصى به)** | + الـ `QueryProvider` موجود بالفعل (`components/providers/query-provider.tsx`).<br>+ كل صفحات الـ dashboard `"use client"` بالفعل → React Query طبيعي.<br>+ caching/invalidation/optimistic + retry جاهز.<br>− الـ access token في الذاكرة (client) فقط. |
| Server Actions | + جيد لـ SEO/server context.<br>− الـ access token في ذاكرة العميل، فالـ server action ما يقدرش يوصّله بسهولة بدون تمرير cookie للـ backend.<br>− يخلط نموذجين. |
| الاثنين | تعقيد بلا داعٍ في هذه المرحلة. |

**التوصية: React Query لكل القراءات والطفرات (reads + mutations).** Server Actions تُستبقى **فقط** كـ thin proxy اختياري لطلب الـ auth إن أردنا إبقاء الـ login/refresh على الـ server (انظر 2.4). السبب: التناسق — كل الصفحات client، والـ token client، والـ provider موجود.

## 2.3 Forms — react-hook-form أم FormData + Zod؟

**الواقع الحالي:** `zod@4` مثبّت ومستخدم في `actions.ts`. صفحات الـ forms تستخدم inputs غير منضبطة (`new/page.tsx`) أو `useActionState` (`login/page.tsx`). **react-hook-form غير مثبّت.**

| الخيار | Trade-offs |
|---|---|
| **react-hook-form + zodResolver (موصى به)** | + field-level errors سهلة + ربط مباشر بـ `errors[]` من الـ backend envelope.<br>+ مناسب للـ wizard متعدد الخطوات (`new/page.tsx`).<br>− إضافة dependency (`react-hook-form` + `@hookform/resolvers`). |
| FormData + Zod (server actions) | + بدون deps.<br>− لا يتماشى مع React Query mutations client-side. |

**التوصية: react-hook-form + zod** للـ forms المعقّدة (إنشاء مشروع، إنشاء مستخدم، payment). للـ forms البسيطة (بحث/فلتر) inputs منضبطة عادية تكفي. السبب: التوحيد مع React Query mutations + تحويل أخطاء الحقول من الـ backend (`disableErrorMessages` يطفّئ تفاصيل الحقول في production — `main.ts:90` — فنعتمد على رسالة الـ `code` الموحّدة كـ fallback).

## 2.4 Token Storage — فين الـ access؟ والـ refresh؟

**ما يبنيه الـ backend فعلاً:**
- `login` يُرجع `accessToken` + `expiresAt` + `user` في الـ JSON، ويضع `refresh_token` في **httpOnly + SameSite=strict cookie** على `path=/api/v1/auth` (`auth.controller.ts:90-101`).
- `refresh` يقرأ الـ cookie ويُدوّرها (rotation) ويُرجع access جديد (`auth.controller.ts:108-136`).

**التوصية:**
- **access token → في الذاكرة فقط** عبر zustand store (غير مُخزّن في localStorage). أكثر أماناً ضد XSS exfiltration.
- **refresh token → httpOnly cookie** (الـ backend يديرها بالفعل). الـ axios client يرسل `withCredentials: true` فتُرفق تلقائياً مع `/auth/refresh`.
- **على 401** → interceptor ينادي `/auth/refresh`، يحدّث الـ access في الـ store، يعيد الطلب. فشل الـ refresh → مسح الـ store + توجيه `/login`.
- **hint cookie للـ middleware:** بما أن الـ refresh cookie httpOnly على دومين الـ API (port 4000) ولا يراها Next middleware (port 3000)، نضبط cookie غير حسّاسة `auth_hint=1` على دومين الـ web بعد login (تُمسح عند logout) ليقرّر الـ middleware التوجيه. الحماية الحقيقية تبقى في الـ backend guard، الـ hint مجرد UX redirect.

> **سبب عدم استخدام localStorage للـ access:** أي XSS يقرأها فوراً. الذاكرة + refresh rotation (المبني في `auth.service.ts:362-396`) يقلّل نافذة السرقة.

## 2.5 Error Handling — استراتيجية الـ toast

**شكل الخطأ الموحّد من الـ backend** (`global-exception.filter.ts:35-43, 184-198`):
```json
{ "success": false, "code": "AUTH_BIZ_006", "message": "البريد أو كلمة المرور غير صحيحة",
  "requestId": "…", "path": "/api/v1/auth/login", "timestamp": "…", "errors": ["..."] }
```

**التوصية:**
- الـ axios response interceptor يحوّل أي رد `success:false` إلى `ApiError` يحمل `code`, `message`, `requestId`, `errors`.
- React Query global `onError` (في `QueryCache`/`MutationCache`) → `sonner` toast بـ `message`، ومع `requestId` صغير للـ support. (`sonner` مثبّت بالفعل + `components/ui/sonner.tsx`.)
- أخطاء الحقول (`errors[]` من ValidationPipe) → تُمرَّر للـ form لعرضها تحت الحقول.
- **401 لا يعرض toast** — يُعالَج بصمت بالـ refresh ثم retry؛ فقط الفشل النهائي يعرض «انتهت الجلسة».

---

# القسم 3: الخطة على مراحل (Phases)

> الترتيب يتبع التبعية: **إصلاحات أمنية → API client → auth → projects → users/companies → phases/updates → payments → media → permissions → الباقي**.

## ⚠️ تنبيه Next.js 16
`apps/web/AGENTS.md` ينص: «This is NOT the Next.js you know». قبل كتابة أي كود routing/middleware/server-action، **اقرأ `node_modules/next/dist/docs/` للجزء المعني**. أمثلة الكود أدناه تتبع الأنماط الحالية في الـ repo لكن يجب التحقق من توقيعات الـ API الـ 16.

---

## Phase 0 — إصلاحات أمنية (Auth + Middleware)
- **الهدف:** إيقاف الـ Supabase-direct وإصلاح الـ middleware bypass قبل أي ربط بيانات.
- **الملفات:**
  - `apps/web/src/app/[locale]/(auth)/actions.ts` — إعادة كتابة: `login`/`register` تنادي الـ backend بدل Supabase (أو تُحذف لصالح hooks client-side).
  - `apps/web/src/middleware.ts` — إزالة الـ dev bypass (السطور 42-48)، التحويل لاعتماد `auth_hint` cookie بدل Supabase session.
  - `apps/web/src/lib/supabase/*` — يبقى للاستخدامات غير-auth فقط (مثل upload المباشر للملفات لاحقاً)، أو يُعزل.
- **التبعيات:** لا شيء (أول phase). يعتمد عليه كل ما بعده.
- **التقدير:** يوم كامل (Deep mode — security-critical).
- **تعريف «خلصت»:**
  - [ ] لا يوجد أي استدعاء `supabase.auth.*` لأغراض login/register في `apps/web`.
  - [ ] `/dashboard` بدون توكن يُحوّل لـ `/login` في **كل** البيئات.
  - [ ] الـ role المُرسل دائماً من enum (`super_admin` …) لا `org:admin`.
  - [ ] MVT: ≥1 spec لكل من (middleware redirect، auth flow mapping).

---

## Phase 1 — API Client + البنية التحتية
- **الهدف:** axios instance واحد بـ interceptors (auth + unwrap + refresh + retry)، + types مشتركة، + ضبط QueryProvider.
- **الملفات الجديدة:**
  - `apps/web/src/lib/api/client.ts` — الـ axios instance (المثال في القسم 4.1).
  - `apps/web/src/lib/api/errors.ts` — `ApiError` + type guards.
  - `apps/web/src/lib/api/query-keys.ts` — مفاتيح موحّدة.
  - `apps/web/src/store/use-auth-store.ts` — zustand: `accessToken`, `user`, `setSession`, `clear`.
  - `packages/shared-types/src/api.ts` — `ApiResponse<T>`, `ApiErrorEnvelope`, `Paginated<T>` (مطابقة لـ `transform.interceptor.ts` و`global-exception.filter.ts`).
  - `apps/web/.env.local` — `NEXT_PUBLIC_API_URL=http://localhost:4000`.
  - تعديل `components/providers/query-provider.tsx` — إضافة `QueryCache`/`MutationCache` onError + توحيد `withCredentials`.
- **التبعيات:** Phase 0 (auth store + refresh endpoint مفهوم).
- **التقدير:** نص يوم (Standard — يلمس منطق الـ refresh).
- **تعريف «خلصت»:**
  - [ ] استدعاء `api.get('/users/me')` يرجّع `data` مفكوكة من الـ envelope.
  - [ ] 401 يطلق refresh واحد ثم retry (لا loop لانهائي).
  - [ ] `packages/shared-types` يصدّر أنواع الـ envelope.
  - [ ] MVT: spec لـ unwrap + spec لـ refresh-on-401 (mock adapter).

---

## Phase 2 — ربط صفحات Auth
- **الهدف:** login/register/setup فعلية عبر الـ backend.
- **الملفات:** `(auth)/login/page.tsx`، `register/page.tsx`، `setup-workspace/page.tsx` + hook `lib/api/hooks/use-auth.ts` (`useLogin`, `useRegister`, `useLogout`, `useMe`).
- **التبعيات:** Phase 1.
- **التقدير:** نص يوم (Standard).
- **تعريف «خلصت»:** login حقيقي يملأ الـ store ويوجّه للـ dashboard؛ logout يمسح الـ store + `auth_hint` + ينادي `/auth/logout`. MVT: ≥1 spec.

---

## Phase 3 — ربط Projects (list + detail + create)
- **الهدف:** أول موديول بيانات كامل end-to-end كـ «قالب» لباقي الموديولات.
- **الملفات:**
  - `apps/web/src/lib/api/hooks/use-projects.ts` (`useProjects`, `useProject`, `useCreateProject`, `useUpdateProject`, `useChangeProjectStatus`).
  - `dashboard/projects/page.tsx` — استبدال `projectsData` (سطر 77-145) بـ `useProjects`.
  - `dashboard/projects/new/page.tsx` — `handleSubmit` (سطر 85-88) → `useCreateProject` (mapping حقول الـ wizard إلى `CreateProjectDto`).
  - `dashboard/projects/[id]/page.tsx` — `useProject(id)`.
- **التبعيات:** Phase 1، 2.
- **التقدير:** نص يوم (Standard).
- **تعريف «خلصت»:** القائمة من DB مع pagination + search + filter status/type (الـ DTO يدعمها — `projects/dto/index.ts:149-162`). MVT: ≥1 spec للـ hook mapping.

> ⚠️ ملاحظة حقول: الـ wizard في `new/page.tsx` فيه حقول لا يقبلها `CreateProjectDto` (مثل `code`, `contractType`, `priority`, `retention`, `downPayment`). الـ DTO يقبل: `name, description, location, type∈{FULL_FINISHING,…}, clientId (UUID مطلوب), startDate, expectedEndDate, totalBudget, dailyUpdateDeadline (HH:mm)`. **`clientId` مطلوب وUUID** — يحتاج اختيار عميل حقيقي (من `users` بدور `client`)، فلا يمكن إرسال نص حر. هذا قرار يُرفع للمخطط في session Projects.

---

## Phase 4 — ربط Users + Companies (Team + Settings)
- **الهدف:** فريق العمل + بيانات الشركة + الصلاحيات.
- **الملفات:** `use-users.ts`, `use-company.ts`; `dashboard/team/page.tsx`, `team/permissions/page.tsx`, `dashboard/settings/*` (صفحة الإعدادات ناقصة — تُنشأ).
- **Endpoints:** `users` (`users.controller.ts`)، `companies/me|settings|storage` (`companies.controller.ts:24-62`).
- **التبعيات:** Phase 1، 2.
- **التقدير:** نص يوم (Standard).
- **تعريف «خلصت»:** قائمة المستخدمين + تعديل دور/صلاحيات (SUPER_ADMIN فقط) تعمل. MVT: ≥1 spec.

---

## Phase 5 — Phases + Updates (دورة الاعتماد)
- **الهدف:** أهم business logic: المراحل + التحديثات اليومية + workflow الاعتماد.
- **الملفات:** `use-phases.ts`, `use-updates.ts`; صفحات جديدة تحت `dashboard/projects/[id]/phases` + ربط `projects/reviews/page.tsx`.
- **Endpoints:** `phases.controller.ts` (list/progress/reorder)، `updates.controller.ts` (submit/approve/reject/force-cancel/versions/edit-approved).
- **التبعيات:** Phase 3.
- **التقدير:** نص–يوم (Standard، يقترب من Deep بسبب الـ state machine).
- **تعريف «خلصت»:** approve/reject من شاشة الـ reviews يعمل ويُحدّث القائمة (invalidation). MVT: ≥1 spec لكل transition.

---

## Phase 6 — Payments / Finance (مع Idempotency)
- **الهدف:** السجلات المالية.
- **الملفات:** `use-payments.ts`; `finance/page.tsx`, `finance/payments/page.tsx`.
- **Endpoints:** `payments.controller.ts` — **`POST projects/:projectId/payments` يتطلب `Idempotency-Key` header** (`payments.controller.ts:75-85`، `idempotency-key.decorator.ts`: UUID أو `[A-Za-z0-9_-]{16,64}`).
- **التبعيات:** Phase 3.
- **التقدير:** نص يوم (Standard).
- **تعريف «خلصت»:** إنشاء payment يرسل `Idempotency-Key`؛ إعادة الإرسال بنفس المفتاح لا تُكرّر. الصفحات بدون backend (`invoices/petty-cash/profitability/reconciliation`) تبقى mock مع TODO واضح. MVT: ≥1 spec idempotency.

---

## Phase 7 — Media Upload (signed URL flow)
- **الهدف:** رفع الملفات بالـ flow الآمن المبني في الـ backend.
- **الملفات:** `use-media.ts`; مكوّن `components/upload/`؛ ربط داخل شاشة الـ update.
- **Flow** (`media.controller.ts:5-13`): `POST media/upload-url` → الـ client يعمل `PUT` للملف مباشرة لـ Supabase → `POST updates/:uid/media` (الـ server يتحقق magic bytes + size) → `GET media/:id/signed-url` للعرض.
- **التبعيات:** Phase 5 (media مرتبطة بـ update).
- **التقدير:** يوم كامل (**Deep** — file upload = attack surface؛ rule #7 hacker mode).
- **تعريف «خلصت»:** رفع صورة لـ update يكتمل ويُعرض عبر signed-url. MVT + hacker pass على upload.

---

## Phase 8 — Permissions Gating + Nav + تنظيف الصفحات الناقصة
- **الهدف:** إخفاء/تعطيل العناصر حسب الدور والصلاحيات + توحيد التنقل + توثيق الصفحات بلا backend.
- **الملفات:** `components/auth/permission-gate.tsx` (القسم 4.5)، `config/navigation.ts` (موجود بـ `roles` بالفعل — سطر 40-122، يُربط بالـ store)، `lib/auth/can.ts` يستخدم `DEFAULT_ROLE_PERMISSIONS` من `packages/shared-types/src/permissions.ts`.
- **التبعيات:** Phase 2 (الـ user/role في الـ store).
- **التقدير:** نص يوم (Standard).
- **تعريف «خلصت»:** عناصر nav المقيّدة بـ `roles` تختفي للأدوار غير المصرّح لها؛ أزرار الإنشاء/الحذف خلف `PermissionGate`. MVT: ≥1 spec لـ `can()`.

---

## Phase 9 — Subcontractors + Comments + Chat + Audit (read-mostly)
- **الهدف:** إغلاق باقي الموديولات.
- **الملفات:** `use-subcontractors.ts`, `use-comments.ts`, `use-chat.ts`, `use-audit.ts`؛ ربط `subcontractors/page.tsx` + `audit/page.tsx` + إنشاء `dashboard/chat/page.tsx`.
- **التبعيات:** Phase 1–3.
- **التقدير:** يوم (يمكن تقسيمه: audit+subcontractors = Quick، chat = Standard لأن فيه realtime لاحقاً).
- **تعريف «خلصت»:** الجداول من DB. الـ chat polling/realtime يُترك كـ enhancement. MVT لكل hook.

---

# القسم 4: أمثلة كود جاهزة (Boilerplate فعلي)

> الأنواع مطابقة حرفياً لـ `transform.interceptor.ts` و`global-exception.filter.ts`. الكود يتبع أنماط الـ repo الحالية.

## 4.1 `apps/web/src/lib/api/client.ts` — axios instance

```ts
import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import axiosRetry from "axios-retry";
import { useAuthStore } from "@/store/use-auth-store";
import { ApiError, type ApiErrorEnvelope } from "./errors";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1`;

export const api = axios.create({
  baseURL: BASE,
  withCredentials: true, // يرسل refresh cookie لـ /auth/refresh (cross-origin)
  headers: { "Content-Type": "application/json" },
});

// إعادة المحاولة لأخطاء الشبكة على الطلبات الآمنة فقط (GET)
axiosRetry(api, {
  retries: 2,
  retryCondition: (e) =>
    axiosRetry.isNetworkOrIdempotentRequestError(e) && (e.config?.method ?? "get") === "get",
  retryDelay: axiosRetry.exponentialDelay,
});

// ── Request: حقن الـ access token من الذاكرة ──
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response: فكّ الـ envelope + معالجة 401 بـ refresh واحد ──
let refreshing: Promise<string | null> | null = null;

async function runRefresh(): Promise<string | null> {
  try {
    // raw axios (بدون interceptors) حتى لا ندخل في حلقة
    const res = await axios.post<{ success: boolean; data: { accessToken: string; expiresAt?: number } }>(
      `${BASE}/auth/refresh`, {}, { withCredentials: true },
    );
    const token = res.data.data.accessToken;
    useAuthStore.getState().setAccessToken(token);
    return token;
  } catch {
    useAuthStore.getState().clear();
    if (typeof window !== "undefined") window.location.href = "/login";
    return null;
  }
}

api.interceptors.response.use(
  (res) => res.data?.data ?? res.data, // unwrap { success, data, meta } → data
  async (error: AxiosError<ApiErrorEnvelope>) => {
    const original = error.config as AxiosRequestConfig & { _retried?: boolean };
    const status = error.response?.status;

    if (status === 401 && original && !original._retried && !original.url?.includes("/auth/")) {
      original._retried = true;
      refreshing ??= runRefresh().finally(() => (refreshing = null));
      const token = await refreshing;
      if (token) {
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
        return api(original);
      }
    }

    // تطبيع الخطأ لـ ApiError موحّد
    const env = error.response?.data;
    throw new ApiError({
      code: env?.code ?? "NETWORK",
      message: env?.message ?? "تعذّر الاتصال بالخادم",
      requestId: env?.requestId,
      errors: env?.errors,
      status,
    });
  },
);
```

> **مهم:** لأن الـ response interceptor يفكّ الـ envelope، أنواع الـ hooks تتعامل مع `data` مباشرة. للـ endpoints المرقّمة (pagination) نحتاج الـ `meta` أيضاً — انظر 4.2 (نستخدم متغيّر `unwrapWithMeta` أو نقرأ الـ raw response لتلك الحالات).

## 4.2 `apps/web/src/lib/api/query-keys.ts` + hook كامل `use-projects.ts`

```ts
// query-keys.ts
export const qk = {
  projects: {
    all: ["projects"] as const,
    list: (params: Record<string, unknown>) => ["projects", "list", params] as const,
    detail: (id: string) => ["projects", "detail", id] as const,
  },
  users: { all: ["users"] as const, me: ["users", "me"] as const },
} as const;
```

```ts
// lib/api/hooks/use-projects.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/api/query-keys";

export interface Project {
  id: string; name: string; status: string; type: string | null;
  totalBudget: number | null; clientId: string; createdAt: string;
}
interface ListParams { page?: number; limit?: number; search?: string; status?: string; type?: string; }

export function useProjects(params: ListParams = {}) {
  return useQuery({
    queryKey: qk.projects.list(params),
    // الـ interceptor فكّ الـ envelope → data هنا = Project[] (الـ items)
    queryFn: () => api.get<unknown, Project[]>("/projects", { params }),
    placeholderData: (prev) => prev, // keepPreviousData للـ pagination
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: qk.projects.detail(id),
    queryFn: () => api.get<unknown, Project>(`/projects/${id}`),
    enabled: Boolean(id),
  });
}

export interface CreateProjectInput {
  name: string; clientId: string; type?: string; description?: string;
  location?: string; startDate?: string; expectedEndDate?: string;
  totalBudget?: number; dailyUpdateDeadline?: string;
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => api.post<unknown, Project>("/projects", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.projects.all }),
  });
}
```

## 4.3 ربط صفحة — قبل / بعد (`dashboard/projects/page.tsx`)

**قبل** (`projects/page.tsx:77-145` — mock ثابت):
```tsx
const projectsData: EnterpriseProject[] = [
  { id: "PRJ-2025-001", name: t("...prj1Name"), client: t("...prj1Client"), status: "active", progress: 68, /* … */ },
  { id: "PRJ-2025-005", /* … */ },
];
// … الجدول يعمل projectsData.map(...)
```

**بعد** (بيانات حقيقية + حالات تحميل/خطأ):
```tsx
"use client";
import { useProjects } from "@/lib/api/hooks/use-projects";

export default function ProjectsHubPage() {
  const [search, setSearch] = useState("");
  const { data: projects = [], isLoading, isError, error } = useProjects({ search, limit: 20 });

  if (isLoading) return <ProjectsTableSkeleton />;       // loading.tsx موجود بالفعل كنمط
  if (isError)   return <EmptyState message={error.message} />; // EmptyState موجود

  return (
    /* نفس الـ JSX، لكن: */
    <tbody>
      {projects.map((project) => (
        <tr key={project.id} onClick={() => toggleRow(project.id)}>
          <td>{project.name}</td>
          {getStatusBadge(project.status)}
          {/* الحقول المالية المركّبة (contractValue…) غير موجودة في الـ API —
              تُشتق من payments/summary أو تُخفى حتى Phase 6 */}
        </tr>
      ))}
    </tbody>
  );
}
```

> القاعدة: لا تكسر الـ JSX الموجود — استبدل **مصدر البيانات** فقط، واخفِ الحقول التي لا يوفّرها الـ backend بعلامة TODO بدل اختراع قيم.

## 4.4 Mutation مع Optimistic Update + Idempotency-Key (payments)

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export function useCreatePayment(projectId: string) {
  const qc = useQueryClient();
  const key = ["payments", projectId] as const;

  return useMutation({
    mutationFn: (input: CreatePaymentInput) =>
      api.post(`/projects/${projectId}/payments`, input, {
        // إلزامي (payments.controller.ts:81) — UUID لكل عملية منطقية
        headers: { "Idempotency-Key": crypto.randomUUID() },
      }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Payment[]>(key);
      qc.setQueryData<Payment[]>(key, (old = []) => [
        { ...input, id: `optimistic-${Date.now()}`, _optimistic: true } as Payment, ...old,
      ]);
      return { prev };
    },
    onError: (_e, _input, ctx) => ctx && qc.setQueryData(key, ctx.prev), // rollback
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
```

## 4.5 `components/auth/permission-gate.tsx`

```tsx
"use client";
import type { ReactNode } from "react";
import { useAuthStore } from "@/store/use-auth-store";
import { DEFAULT_ROLE_PERMISSIONS, type Permission } from "@construction/shared-types";
import { UserRole } from "@construction/shared-types";

// SUPER_ADMIN يملك كل الصلاحيات (مطابق لـ permissions.guard.ts:46)
export function can(role: string | undefined, permission: Permission, custom: string[] = []) {
  if (!role) return false;
  if (role === "super_admin" || role === "SUPER_ADMIN") return true;
  const defaults = DEFAULT_ROLE_PERMISSIONS[role.toLowerCase() as UserRole] ?? [];
  return defaults.includes(permission) || custom.includes(permission);
}

export function PermissionGate({
  permission, children, fallback = null,
}: { permission: Permission; children: ReactNode; fallback?: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  return can(user?.role, permission, user?.permissions) ? <>{children}</> : <>{fallback}</>;
}
```
```tsx
// استخدام:
<PermissionGate permission={PERMISSIONS.PROJECTS_CREATE}>
  <Button onClick={() => router.push("./projects/new")}>{t("newProject")}</Button>
</PermissionGate>
```

> **تنبيه:** الـ Gate للـ UX فقط. الحماية الحقيقية في الـ backend (`roles.guard.ts` + `permissions.guard.ts` عالميان). لا تعتمد على الـ Gate كحاجز أمني.

## 4.6 الأنواع المشتركة `packages/shared-types/src/api.ts`

```ts
// مطابق لـ apps/api/src/common/interceptors/transform.interceptor.ts
export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: { total?: number; page?: number; limit?: number; timestamp: string };
}
// مطابق لـ apps/api/src/common/filters/global-exception.filter.ts
export interface ApiErrorEnvelope {
  success: false;
  code: string;
  message: string;
  requestId?: string;
  errors?: unknown[];
  path?: string;
  timestamp: string;
}
export interface Paginated<T> { items: T[]; meta: { total: number; page: number; limit: number }; }
```

---

# القسم 5: ترتيب التنفيذ بالـ Sessions (نظام الأدوار في CLAUDE.md)

> التعيين يتبع قاعدة اختيار الـ mode: security/auth/payments/file-upload = **Deep**؛ feature متوسطة مترابطة = **Standard**؛ مهمة محدودة = **Quick**.

| # | Session | Phases | Mode | السبب |
|---|---|---|:---:|---|
| **S1** | إصلاحات Auth الأمنية + Middleware | Phase 0 | 🔴 **Deep** | auth security-critical + يلمس عدة ملفات + production-blocking (BLOCKER-1،2). rules #2،#4،#7. |
| **S2** | API Client + Infra + Auth store | Phase 1 | 🟡 **Standard** | منطق refresh/interceptor مترابط؛ MVT إجباري لـ unwrap + refresh. |
| **S3** | ربط صفحات Auth | Phase 2 | 🟡 **Standard** | يبني على S2؛ flows مترابطة. |
| **S4** | Projects (list/detail/create) — القالب | Phase 3 | 🟡 **Standard** | أول موديول كامل؛ يثبّت النمط لكل ما بعده. |
| **S5** | Users + Companies (Team/Settings) | Phase 4 | 🟡 **Standard** | RBAC على تعديل الأدوار/الصلاحيات. |
| **S6** | Phases + Updates (workflow الاعتماد) | Phase 5 | 🔴 **Deep** | state machine حسّاس (approve/reject/force-cancel) + audit. |
| **S7** | Payments / Finance | Phase 6 | 🔴 **Deep** | مالي + idempotency — يتطلب hacker pass (double-submit/race). |
| **S8** | Media Upload (signed URL) | Phase 7 | 🔴 **Deep** | file upload attack surface (magic bytes/size/IDOR). |
| **S9** | Permissions Gate + Nav | Phase 8 | 🟡 **Standard** | يلمس كل الصفحات لكن منطق محدود. |
| **S10** | Subcontractors + Audit | Phase 9 (جزء) | 🟢 **Quick** | read-mostly، CRUD بسيط. |
| **S11** | Comments + Chat | Phase 9 (جزء) | 🟡 **Standard** | chat فيه polling/realtime مستقبلاً. |

**الترتيب الأمثل:** S1 → S2 → S3 → S4 → (S5 ∥ S6 يمكن تتوازى بعد S4) → S7 → S8 → S9 → S10 → S11.

> قبل كل session: **اقرأ `.claude/sessions/BACKLOG.md`** (فيه NEEDS-CODER مفتوحة، أبرزها: migration الـ Prisma runtime import، وHTTP integration tests الناقصة) — قد تتقاطع مع الربط.

---

# القسم 6: المخاطر والـ Checklist

## 6.1 المخاطر لكل Phase

| Phase | الخطر | التخفيف |
|---|---|---|
| 0 (Auth) | كسر الدخول بالكامل أثناء التحول؛ بقايا Supabase session تتعارض | feature flag/فرع منفصل؛ اختبار login يدوي قبل دمج؛ مسح Supabase cookies. |
| 1 (Client) | حلقة refresh لانهائية على 401؛ CORS credentials | `_retried` guard (موجود في 4.1)؛ تأكيد `credentials:true` + origin في `cors.config.ts`. |
| 1 (Token) | الـ refresh cookie على `path=/api/v1/auth` فقط — أي طلب `/auth/refresh` لازم يكون تحت نفس الـ origin/port | استخدام `NEXT_PUBLIC_API_URL` الموحّد + `withCredentials`. |
| 3 (Projects) | `clientId` UUID **مطلوب** لكن الـ wizard يأخذ نص حر | إضافة selector عملاء حقيقي (users role=client) قبل تفعيل الإنشاء. |
| 5 (Updates) | تنفيذ transition غير مسموح → 4xx | الاعتماد على رسائل الـ backend + تعطيل الأزرار حسب الحالة. |
| 6 (Payments) | double-submit يكرّر سجل مالي | `Idempotency-Key` لكل mutation (موجود في 4.4) + disable الزر أثناء `isPending`. |
| 7 (Media) | رفع ملف خبيث / تجاوز الحجم / IDOR | الـ backend يتحقق magic bytes (`media-security.service.ts`)؛ لا تثق بالـ client؛ hacker pass إلزامي. |
| 8 (Permissions) | الاعتماد على الـ Gate كحماية | الحماية في الـ backend؛ الـ Gate UX فقط. |
| كل المراحل | اختلاف أسماء الحقول (camelCase الـ API ضد ما تعرضه الصفحات) | طبقة mapping صريحة في كل hook؛ عدم اختراع حقول غير موجودة. |
| كل المراحل | Next.js 16 APIs مختلفة عن المعتاد | قراءة `node_modules/next/dist/docs/` قبل أي middleware/server-action. |

## 6.2 Checklist قبل النشر

- [ ] `apps/web/.env.local` و`apps/api/.env.local` مضبوطان (`NEXT_PUBLIC_API_URL`, `JWT_SECRET` = Supabase JWT secret، `COOKIE_SECRET` للـ signed cookies في production).
- [ ] CORS: origin الـ web في whitelist (`cors.config.ts`) + `credentials:true`.
- [ ] **لا يوجد** `supabase.auth.signIn/signUp` لأغراض auth في `apps/web` (grep نظيف).
- [ ] الـ middleware يحوّل بدون توكن لـ `/login` في **production و development**.
- [ ] الـ access token **ليس** في localStorage/sessionStorage (zustand non-persist).
- [ ] refresh cookie: `httpOnly + Secure (prod) + SameSite=strict` (مؤكَّد في `auth.controller.ts:48-55`).
- [ ] كل mutation مالية/حساسة ترسل `Idempotency-Key`.
- [ ] كل صفحة لها loading + error state (الـ `loading.tsx` و`error.tsx` موجودان كنمط).
- [ ] الصفحات بلا backend (`invoices/petty-cash/profitability/reconciliation/attendance/leaves/org-chart/performance/training/safety/reports/sla`) مُعلّمة TODO صريح — لا mock يبدو حقيقياً في production.
- [ ] الأدوار من enum (`super_admin`…) متّسقة بين الـ store والـ nav والـ Gate.
- [ ] `DOCS_ENABLED` غير مفعّل في production (`main.ts:96`).
- [ ] HTTP integration tests (BACKLOG #5) أُضيفت لمسارات الـ auth المربوطة حديثاً.
- [ ] `npm run build` للـ web + `tsc` للـ api بدون أخطاء (راعِ migration الـ Prisma import — BACKLOG #2).

---

## ملحق: خريطة الـ Endpoints الكاملة (مرجع سريع للربط)

| الموديول | المسارات (تحت `/api/v1`) | القيود |
|---|---|---|
| auth | `POST auth/{register,login,refresh,logout}` | public عدا logout؛ throttle 5/min |
| users | `GET users` (SA,PM)، `GET/PATCH users/me`، `GET users/:id`، `POST users`، `PATCH users/:id/{role,permissions}`، `POST users/:id/{activate,deactivate}`، `DELETE users/:id` | معظمها SUPER_ADMIN |
| companies | `GET/PATCH companies/me`، `PATCH companies/settings`، `GET companies/storage` | تعديل = SUPER_ADMIN |
| projects | `GET projects`، `GET projects/:id`، `POST projects`، `PATCH projects/:id`، `PATCH projects/:id/status`، `DELETE projects/:id`، `POST/DELETE projects/:id/assignments` | إنشاء=SA,PM؛ حذف=SA |
| phases | `GET projects/:projectId/phases`، `GET phases/:id`، `POST projects/:projectId/phases`، `PATCH phases/:id`، `PATCH phases/:id/{progress,reorder}`، `DELETE phases/:id` | تعديل=SA,PM |
| updates | `GET phases/:phaseId/updates`، `GET updates/:id`، `POST phases/:phaseId/updates`، `PATCH updates/:id`، `POST updates/:id/{submit,approve,reject,force-cancel}`، `PATCH updates/:id/edit-approved`، `GET updates/:id/versions` | approve/reject=SA,PM؛ force-cancel=SA |
| media | `POST media/upload-url`، `POST updates/:updateId/media`، `GET updates/:updateId/media`، `GET media/:id/signed-url`، `DELETE media/:id` | flow ثلاثي الخطوات |
| payments | `GET projects/:projectId/payments`، `GET .../payments/summary`، `GET payments/:id`، `POST projects/:projectId/payments` (**Idempotency-Key**)، `DELETE payments/:id` (SA) | summary يشمل CLIENT |
| comments | `GET/POST updates/:updateId/comments`، `PATCH comments/:id`، `PATCH comments/:id/status`، `DELETE comments/:id` | — |
| sub-contractors | `GET/POST sub-contractors`، `GET/PATCH sub-contractors/:id`، `GET/POST phases/:phaseId/sub-contractors`، `PATCH phase-assignments/:id`، `DELETE sub-contractors/:id` (SA) | — |
| chat | `GET/POST projects/:projectId/chat-rooms`، `GET chat-rooms/:roomId/messages`، `POST chat-rooms/:roomId/messages`، `POST chat-rooms/:roomId/read` | — |
| audit | `GET audit-logs` | SUPER_ADMIN |
| health | `GET /health`، `GET /health/ready` | بدون prefix، public |

> كل النواتج مغلّفة بـ `{ success, data, meta }`؛ كل الأخطاء بـ `{ success:false, code, message, requestId }`. الـ pagination: `data` = المصفوفة، `meta.total/page/limit`.
