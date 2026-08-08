# Sessions Backlog

> Cross-session NEEDS-CODER + deferred items. أول مكان يـ check قبل بدء session جديد.

---

## Session 1.7 — NEEDS-CODER tickets (consolidated)

أصلهم: Session 1.5 deferrals + Session 1.6 hacker findings + Session 1.6 principal exit notes.

| # | Ticket | Source | Severity | Type |
|---|---|---|---|---|
| 1 | ~~**CVE-TEST-016** — activate/deactivate audit `oldValues` hardcoded.~~ ✅ **DONE** in `2026-05-20-cve-test-016-audit-state-derived/` (Session 1.7 Quick mode). | Session 1.6 hacker `03-hacker-report.md` | 🟡 MEDIUM | production fix + new spec |
| 2 | **`@prisma/client/runtime/library` → `@prisma/client` migration** — 4 tsc errors في `apps/api/src/modules/payments/*` و `apps/api/src/modules/updates/*`. CI-blocker لو الـ CI tighten. | pre-existing من Session 1.5، confirmed Session 1.6 | 🟡 MEDIUM | migration |
| 3 | **CompaniesService specs** — deferred من Session 1.5 (scope ضيّع الـ service). Session 1.6 scope explicitly defers. | `00-scope.md` Session 1.6 line 34 | 🟡 MEDIUM | new specs |
| 4 | **JwtStrategy remaining rejection paths** — partial coverage موجود في `jwt.strategy.spec.ts`، الـ remaining paths مش مغطاة. | Session 1.5 deferral، confirmed Session 1.6 architect review | 🟢 LOW | new specs |
| 5 | **HTTP integration tests (supertest)** — كل الـ MVT حتى الآن service-layer فقط. Controller + Roles guard + ValidationPipe wiring غير مغطى. | Session 1.6 principal `05-principal-report.md` نقاط الضعف #4 | 🟡 MEDIUM | new test infrastructure + specs |

---

## ملاحظات عند بدء Session 1.7

- اقرأ `D:/tampalets/saas-one/.claude/sessions/2026-05-20-mvt-hardening/05-principal-report.md` قسم "مخاطر متبقية" لـ severity context.
- اقرأ `06-meta-review.md` "دروس للـ sessions القادمة" — في 2 workflow rules جديدة (#8 + #9 في CLAUDE.md) لازم تتطبق على Session 1.7.
- لو الـ scope بياخد كل الـ 5 tickets دفعة واحدة → likely too wide. اقترح prioritization: (CVE-TEST-016 + tsc migration) standalone، ثم (CompaniesService specs + JwtStrategy) معاً، ثم (HTTP integration) standalone phase تالية.

---

## Session 1.8+ (NEEDS-CODER pre-existing — non-urgent)

- **CVE-USERS-001** — Last-SUPER_ADMIN race condition fix + spec (Session 1.5 backlog)
- **A7 permission catalog whitelist** — `packages/shared-types`

---

## Session 1.8 — Tickets مضافة من Session 2

### CHAT-FOLLOWUP-001 — chat defense-in-depth 🟡 MEDIUM
- الموقع: chat.service.ts:findRooms (line ~26) + createRoom (line ~70)
- المشكلة: يـ trust ensureProjectAccess كـ sole gate بدون
  companyId filter في الـ chatRoom query — defense-in-depth gap.
- الـ exploit-path مغلق at-source (CVE-PROJ-001 fix في Session 2).
- الـ Fix: إضافة project: { companyId: user.companyId, deletedAt: null }
  في الـ chatRoom queries.
- Source: Session 2 / 03-hacker-report.md

### A1 — recalculateProgressInTx signature tightening 🟡 MEDIUM-HIGH
- الموقع: projects.service.ts:484 — signature يقبل PrismaService | TransactionClient
- المشكلة: الـ PrismaService overload يسمح لـ developer يـ call
  المـ method بعد الـ $transaction commit (C28 violation).
  الـ JSDoc الجديد legitimize الـ overload بدل ما يحذّر منه.
- الـ Fix: tighten الـ signature لـ tx: Prisma.TransactionClient فقط،
  أو فصل الـ read-only path لـ method منفصلة.
- Source: Session 2 / 01-architect-report.md (A1)

### PROJ-NOTE-002 — assignMember orphan data audit 🟢 LOW-MEDIUM
- المشكلة: F1 يمنع new assignments لـ CLIENT/PM/SUPER_ADMIN،
  لكن data قديمة بـ User.role IN ('CLIENT', 'PROJECT_MANAGER', 'SUPER_ADMIN')
  مع removedAt IS NULL ممكن تـ pollute الـ visibility filter في findAll.
- الـ Fix: one-time SELECT audit + cleanup migration (SET removedAt = NOW()).
- Source: Session 2 / 05-principal-report.md (PROJ-NOTE-002)

### ~~A3 — JwtPayload.role typing~~ ✅ **DONE — مقفول من 2026-05-24 (Session 1.8 Part 2)**
> 🔴 **تصحيح سجلّي مهم (رُصد في session 2026-08-07):** البند ده **لم يُنفَّذ في
> session 2026-08-07** — كان **مقفولاً بالفعل من 2026-05-24**، والـ Updates log
> بيوثّق إغلاقه في سطر Session 1.8 Part 2. اللي حصل إنه **ما اتشطبش هنا**، فاستمر
> ظاهراً كبند مفتوح **وأُعيد إدراجه في `S7-ROLES-GATE` البوابة (ب)** كأنه مطلوب.
> `current-user.decorator.ts:14` فيه `role: UserRole` من التاريخ ده. **صفر كود
> اتكتب له في 2026-08-07 — تحقق بالقراءة المباشرة فقط.**
>
> **📘 الدرس — نمط P-1b مقلوباً:** P-1b كان «بند مُسلَّم مات بالصمت». ده عكسه:
> **بند مُنفَّذ فضل حياً في السجل**. الخطر مش شغل مكرَّر — الخطر إن قارئ بوابة
> ملزِمة يفترض إن كل بند مذكور فيها لسه مطلوباً، أو أسوأ: **يفترض إن المذكور في
> البوابة = المطلوب فعلاً بلا تحقق مباشر من الكود**. **الإغلاق يُشطب عند مصدره،
> لا في الـ Updates log وحده.**

**(الأصل — 🟢 LOW):**
- الموقع: current-user.decorator.ts:13 — role: string بدل UserRole enum
- المشكلة: typo في role string لا يُمسك بـ TypeScript. لو enum value
  تغير في Prisma schema → silent fail محتمل.
- الـ Fix: tighten الـ type لـ role: UserRole.
- Source: Session 2 / 05-principal-report.md (A3)

---

## Session 1.9+

### ENV-SPEC-001 — env-validation.spec.ts failures 🟡 MEDIUM
- العدد: 8 tests failing
- السبب: validateEnvironment بيـ throw generic message
  "Environment validation failed: 1 critical issue(s)"
  بدل إن الـ message يحتوي على variable name (e.g. COOKIE_SECRET).
  الـ spec بيتوقع /COOKIE_SECRET/ في الـ throw message.
- الخيارات: (a) إصلاح validateEnvironment يـ embed الـ var name،
  أو (b) تحديث الـ spec ليتوافق مع الـ current message.
- Source: pre-existing، confirmed by baseline check في Session 1.8 Part 2.

### AUDIT-SPEC-001 — audit-log.service.spec.ts:92 failure 🟡 MEDIUM
- العدد: 6 tests failing
- السبب: expect(received).rejects.not.toThrow() — promise resolved
  بدل rejected. الـ spec بيتوقع throw لكن الـ service بيـ resolve.
- الخيارات: (a) إصلاح السلوك في audit-log.service.ts،
  أو (b) تحديث الـ spec لو الـ current behavior مقصود.
- Source: pre-existing، confirmed by baseline check في Session 1.8 Part 2.

---

## Session S1 (frontend auth backend-first) — Tickets مضافة

### WEB-S1-001 — client route-guard للـ dashboard ✅ DONE (Session S2)
> مقفول في `2026-06-28-s2-generic-api-client/` — CVE-S1-002 مُختبَر end-to-end (MVT #3، paired assertion على أعمق طبقة). التفاصيل الأصلية محفوظة أدناه للسياق.

**(الأصل — 🔴 HIGH، S2-blocker):**
- المصدر: CVE-S1-002 (هاكر) + 05-principal-report.md شرط #1.
- المشكلة: `auth_hint` cookie قابلة للتزوير وهي **البوابة الوحيدة** للـ dashboard
  (`middleware.ts` + `dashboard/layout.tsx`). حالياً LOW لأن الـ dashboard mock
  بالكامل (صفر data fetch — متحقَّق). **يتحوّل HIGH لحظة نزول أي data حقيقية في S2.**
- الـ trigger الصريح للتصعيد: أول data fetch حقيقي في أي صفحة dashboard.
- الـ Fix: client route-guard يستدعي `/users/me` (`authClient.me`) on mount قبل
  أي data fetch؛ لو 401 → `clear()` + `clearAuthHint()` + redirect `/login`.
- **قاعدة لـ S2: ما تبدأش ربط data حقيقية قبل ما الـ guard ده ينزل.**
- Source: Session S1 / 03-hacker-report.md (CVE-S1-002) + 05-principal-report.md.

### WEB-S1-002 — Content-Security-Policy 🟡 MEDIUM
- المصدر: CVE-S1-003 (هاكر) + 05-principal-report.md شرط #2.
- المشكلة: `next.config.ts headers()` فيه X-Frame-Options/nosniff/Referrer/Permissions
  لكن **بدون CSP**. الـ token في الذاكرة يقلّل سرقة persistence-based، لكن XSS نشط
  ما زال يقدر يقرأ `useAuthStore.getState().accessToken`.
- الـ Fix: CSP **report-only** أولاً (script-src self + nonce لـ inline scripts اللي
  Next بيحقنها) → راقب violations → ثم enforce. تحذير: CSP غلط = كسر runtime
  (framer-motion/next-intl)؛ يحتاج تحقق dev-server فعلي.
- Source: Session S1 / 03-hacker-report.md (CVE-S1-003).

### WEB-S1-003 — توحيد auth-client مع الـ generic client 🟡 MEDIUM
- المصدر: 01-architect-report.md (A-S1-1) + 05-principal-report.md شرط #5.
- المشكلة: `lib/api/auth-client.ts` instance axios منفصل عمداً (بدون refresh
  interceptor) عن الـ generic client القادم. drift risk: baseURL/error-mapping/
  envelope-unwrap ممكن يتفرّعوا بين الـ instancين — نفس نمط الانحراف اللي S1
  جاء يقفله على مستوى أكبر.
- الـ Fix: generic API client موحّد + refresh-on-401 interceptor + React Query
  mutations؛ `auth-client` يبقى thin layer فوقه أو يندمج فيه.
- Source: Session S1 / 01-architect-report.md.

### WEB-S1-004 — test-infra: jsdom + RTL + MSW 🟡 MEDIUM
- المصدر: 04-tester-report.md (coverage مؤجّل) + 05-principal-report.md شرط #4.
- المشكلة: vitest config حالياً `environment: node` فقط. صفر coverage لمنطق
  الصفحات (`RegisterOutcome` branching, guard الـ pending, `router.push`)
  والـ hooks (`useLogin/useRegister/useLogout`) والـ HTTP layer (`auth-client`).
- الـ Fix: jsdom environment + React Testing Library + MSW (mock الـ /auth/*).
  ثم specs لـ: الـ 3 صفحات، الـ 3 hooks، auto-login failure path الفعلي.
- Source: Session S1 / 04-tester-report.md "مناطق لسه محتاجة coverage".

### WEB-S1-005 — i18n لرسائل الـ backend في locale=en 🟢 LOW
- المصدر: plan P5 (residual) + 01-architect-report.md (A-S1-3).
- المشكلة: `mapAuthError` يعرض `message` العربي الجاهز من الـ backend مباشرة (P5).
  في `locale=en` تظهر رسائل الخطأ عربي.
- الـ Fix: code→i18n mapping على الـ client (الـ `code` محفوظ أصلاً في `AuthError`)؛
  fallback على الـ backend message لو مفيش mapping.
- Source: Session S1 / 00-plan.md (P5) + 01-architect-report.md.

### WEB-CLEANUP-001 — Supabase client dead code 🟢 LOW
- الموقع: `apps/web/src/lib/supabase/{client,server}.ts`
- المشكلة: بعد توحيد الـ auth عبر الـ backend (Session S1 المراحل 2/4)، صفر مستهلك
  لهذين الملفين في `apps/web/src` بالكامل (grep نظيف). أصبحا dead code.
- الـ Fix: حذف الملفين + إزالة `@supabase/ssr` / `@supabase/supabase-js` من
  `apps/web/package.json` لو مفيش مستهلك آخر. (مؤجّل من S1 — out of scope cleanup.)
- Source: Session S1 / 00-plan.md المرحلة 5.

### WEB-TSC-001 — 2 pre-existing tsc/build errors في الـ web 🟡 MEDIUM (build-blocker)
- الموقع: `dashboard/team/permissions/page.tsx:287` (`Cannot find name 'cn'`)
  + `components/ui/dropdown-menu.tsx:19` (base-ui `alignment` prop type mismatch).
- المشكلة: `next build` بيـ compile بنجاح (✓ Compiled successfully) لكن يفشل في
  خطوة الـ type-check على هذين الملفين. مش متعلقين بطبقة الـ auth — موجودين قبل S1.
- الـ Fix: استيراد `cn` الناقص + محاذاة props الـ dropdown مع base-ui الحالي.
- Source: Session S1 / 02-coder-report.md (تأكَّدا في المرحلتين 1 و3).

---

## Session S2 (generic API client + React Query) — Tickets مضافة

### WEB-STORE-001 — `setUser` phantom في use-auth-store 🟡 MEDIUM (pre-existing tsc error)
- الموقع: `apps/web/src/store/use-auth-store.ts:51` (إعلان) — غير مُنفَّذ في `create(...)` (سطر 57).
- المشكلة: `setUser: (user) => void` معلَن في الـ `AuthState` interface لكن **مش مُنفَّذ** في الـ store object. ينتج عنه:
  1. **خطأ tsc pre-existing** — `use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing`. **الـ Stage 1 coder report عدّ 4 أخطاء، الواقع 5** — الخطأ ده فاته. أُثبت pre-existing في S2 المرحلة 2 (إزالة ملفات المرحلة + إعادة tsc → الخطأ باقٍ).
  2. **latent runtime trap** — أي `useAuthStore.getState().setUser(...)` هيـ type-check (الـ property على الـ interface) ويكسر runtime (`undefined is not a function`).
- الـ Fix: إمّا تنفيذ `setUser: (user) => set({ user })` في الـ `create(...)`، أو حذف الإعلان من الـ interface لو مفيش مستهلك مقصود. (S2 استخدم `setSession` للـ hydration تجنّباً للـ trap — WEB-S1-001 مقفول من غير الاعتماد عليه.)
- Source: Session S2 / 02-coder-report.md المرحلة 2 + 04-tester-report.md.

### WEB-TSC-002 — NODE_ENV read-only assignment في decide-redirect.spec.ts 🟢 LOW (pre-existing tsc error)
- الموقع: `apps/web/src/lib/auth/decide-redirect.spec.ts:9` + `:18`.
- المشكلة: الـ spec بيعمل `process.env.NODE_ENV = ...` لكن `NODE_ENV` بقى **read-only** في الـ types الحالية → خطآن `TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property`. الـ spec بيـ pass في vitest (runtime) لكن يفشل tsc.
- الـ Fix: استخدام `vi.stubEnv("NODE_ENV", ...)` بدل الإسناد المباشر، أو `Object.defineProperty`.
- Source: Session S1 spec، confirmed pre-existing في Session S2 (المرحلة 1 + 2).

---

## S2 residuals — شروط لـ S3 (مش optional)

> مصدرها `05-principal-report.md` (APPROVED WITH NOTES) + `06-meta-review.md`. الـ session اتقفل Standard + principal (مفيش 🔴 هاكر مستقل ولا 01-architect post-exec) — عشان كده R-2 قائم بنيوياً. **الـ 4 residuals دول شروط دخول S3، مش بنود اختيارية:** R-1 بالذات blocker قبل ربط أي data ثقيلة.

### ~~R-1 — refresh-success path غير مُختبَر~~ ✅ **DONE** (2026-08-07، Standard mode)
> مقفول في `2026-08-07-r1-refresh-success/` — **MVT 4/4 passing** (`apps/web/src/lib/api/client.spec.ts`،
> 48/48 في الـ suite الكامل، صفر regression، **صفر تعديل على أي ملف إنتاجي**).
> **mutation على 100% من الـ specs (4 عمليات، لا عيّنة)** — M1/M2/M3 من الجدول + **M0 شاهد سالب**.
> الفروع الثلاثة المحروسة الآن: 401⇒refresh⇒retry ناجح بالتوكن الجديد (byte-for-byte على
> الـ transport) · retry **واحد** بالظبط (سقف عددي + `LOOP:` guard مُثبَت اشتغاله بـ probe) ·
> **لا stampede** (3 متزامنة ⇒ refresh واحد مشترك).
>
> **✅ نتيجة جانبية مهمة:** `_retry` propagation عبر `mergeConfig` في axios **1.15.0** طلع
> **سليماً** — الـ gap المُفترَض في الخطة **غير موجود**، والـ MVT-2 (canary) بقى حارسه عند أي ترقية.
>
> ⛔ **حدود الإغلاق (منقولة من حكم المختبر، وما زالت سارية):** «48/48 خضراء» **لا تعني
> `client.ts` مُراجَع أمنياً** — تعني فروعه الثلاثة السعيدة محروسة. **`R-2` مفتوح بالكامل**،
> و`error.config === undefined` + header injection **صفر تغطية** (مقيس لا مُفترَض).
>
> **التفاصيل الأصلية محفوظة أدناه للسياق.**

**(الأصل — 🟡 MEDIUM، S3-blocker قبل data ثقيلة):**
- الموقع: `apps/web/src/lib/api/client.ts` (response interceptor، فرع 401→refresh→retry) + `route-guard.tsx`.
- المشكلة: معيار نجاح #3 في `00-plan.md` (line 104) — «hard reload بجلسة صالحة ⇒ refresh صامت ⇒ dashboard يتحمّل» — **معيار نجاح مُعلَن ولسه unverified إطلاقاً**. الـ MVT غطّى الـ terminal-401 branch بس (401 بعد فشل refresh ⇒ teardown + redirect)، مش فرع 401→refresh-**ينجح**→retry-**ينجح**→data ترجع. ده أهم مسار UX في الـ feature.
- التصنيف الصح: **«معيار نجاح غير مستوفى»** مش «coverage مؤجّل» — المختبر عدّه في المؤجّل، المراجع رفع مستواه.
- الـ Fix: spec يرجّع **401 ثم 200** من الـ transport (axios adapter mock) ويؤكّد: (أ) الـ dashboard اتحمّل (children معروضة)، (ب) الـ token اتجدّد في الـ store (`accessToken` = القيمة الجديدة مش null)، (ج) `authClient.refresh` اتنادت مرة واحدة. مرشّح WEB-S1-004 infra.
- Source: Session S2 / 05-principal-report.md (R-1) + 06-meta-review.md.

### R-2 — مفيش red-team مستقل على client.ts 🟡 MEDIUM
- الموقع: `apps/web/src/lib/api/client.ts` (request + response interceptors).
- المشكلة: الـ session اتنفّذ Standard mode → **مفيش 🔴 هاكر pass خصامي** على الـ interceptor الجديد. التهديد-موديلينج الـ inline في الـ plan غطّى loop/stampede بس. سطح هجوم لسه غير مفحوص: **retry recursion**، **header injection عبر `error.config`**، وسلوك الـ interceptor لما **`error.config === undefined`** (axios قد يرمي error بلا config → الـ retry logic يقرأ `config._retry` على undefined).
- الـ Fix: **رفع S3 لـ Deep mode** أو Deep-session قصيرة مخصّصة (🔴 هاكر على `client.ts` فقط)، أو قبول واعٍ موثّق إن الـ backend JWT guard هو البوابة الحقيقية والـ client دفاع ثانوي.
- درس عام (06-meta-review): أي interceptor/guard جديد بيمسّ الـ auth = مرشّح لرفع الـ mode لـ Deep — Standard + principal مش بديل عن red-team لما فيه سطح هجوم جديد.
- Source: Session S2 / 05-principal-report.md (R-2) + 06-meta-review.md.

### R-3 — RouteGuard يطرد على أي isError مش بس terminal-auth 🟢 LOW-MEDIUM
- الموقع: `apps/web/src/components/auth/route-guard.tsx` (`useEffect` على `isError`) + `use-me.ts` (`retry:false`).
- المشكلة: مع `retry:false` على `useMe`، **أي** `isError` (500، network-blip، timeout على `/users/me`) ⇒ `router.replace('/login')` — رغم إن الجلسة ممكن تكون صالحة تماماً. **طرد خاطئ على شبكة متقطعة** أو أثناء backend hiccup مؤقت. الـ guard مابيفرّقش بين terminal-auth (401 بعد استهلاك refresh) و transient error.
- الـ Fix: تفرقة داخل الـ guard بين terminal-auth (401 بعد فشل refresh ⇒ redirect) و transient (5xx/network ⇒ يعرض retry/error state مش redirect). الـ interceptor بالفعل بيميّز الـ 401 النهائي — الـ guard يحتاج يقرأ نوع الخطأ مش مجرد `isError` boolean.
- spec سالب مقترح: 500 على `/users/me` ⇒ **مفيش** redirect (كان هيكشف الحالة دي لو اتكتب).
- Source: Session S2 / 05-principal-report.md (R-3) + 06-meta-review.md.

### R-4 — WEB-STORE-001: setUser phantom + setSession side-effect 🟡 MEDIUM
- **بند مركّب — الجزء الأول (phantom) مسجّل بالفعل كـ [WEB-STORE-001] فوق؛ هنا نضيف الجزء التاني (side-effect) ونربطهم كشرط S3.**
- الموقع: `apps/web/src/store/use-auth-store.ts:51/57` (phantom) + `use-me.ts` (hydration بـ `setSession`).
- المشكلة:
  1. **phantom trap** (تفاصيل في WEB-STORE-001): `setUser` معلَن مش مُنفَّذ → tsc error + latent runtime trap.
  2. **side-effect غير مقصود:** S2 استخدم `setSession(...)` للـ hydration بدل `setUser` (تجنّباً للـ trap)، لكن `setSession` بيمسح `pendingRegistration` كـ side-effect — على مسار `/users/me` (guard mount) ده يمسح أي registration معلّق بلا داعٍ.
- الـ Fix: نفّذ `setUser: (user) => set({ user })` في الـ `create(...)` → (أ) يقفل الـ phantom trap، (ب) بدّل الـ hydration في `use-me.ts` من `setSession` لـ `setUser` → يشيل مسح `pendingRegistration` غير المقصود.
- Source: Session S2 / 02-coder-report.md المرحلة 2 + 05-principal-report.md (R-4) + 06-meta-review.md. راجع [WEB-STORE-001] فوق.

> **ملاحظة:** R-5 (CSP مفتوح) = WEB-S1-002 القائم؛ R-6 (`next build` محجوب) = WEB-TSC-001 القائم. مش مكرّرين هنا — بس بيزيدوا إلحاحاً كل ما زادت الـ data الحقيقية في الـ client.

> **حالة R-1..R-4 بعد S3:** لسه **مفتوحين كلهم**. S3 كان Standard mode على data-layer صرف (صفر تعديل على `client.ts`/auth) فما فتحش سطح جديد وما قفلش أي residual. R-1 يفضل **S7-blocker** (قبل ربط `payments/summary` في Finance). R-2/R-3/R-4 على حالهم.

> **🔄 حالة R-1..R-4 بعد 2026-08-07 (الأحدث):** **R-1 ✅ مقفول** (session `2026-08-07-r1-refresh-success/`) ⇒ **حجب R-1 على ربط `financial-summary` مرفوع**. **R-2 و R-3 و R-4 مفتوحون بالكامل** — والـ session ما ادّعتش غير كده صراحةً. **R-3 اكتسب متطلَّباً سابقاً جديداً:** `WEB-S2-DBLMAP-001` (المعلومة اللي R-3 محتاج يقرأها **مُدمَّرة قبل ما توصل الـ guard**) ⇒ **R-3 غير قابل للتنفيذ الكامل قبله**.

---

## Session S3 (Projects wiring: List + Detail + Create) — Tickets مضافة

> الـ session اتقفل Standard mode + architect post-exec review. APPROVED (المختبر READY). MVT 5/5 passing (12/12 tests في 5 ملفات جديدة، 28/28 suite كامل، صفر regression، صفر خطأ tsc جديد). الـ residuals دي **مؤجّلات coverage/cleanup — مش blockers**، معظمها كلفة test-harness.

### WEB-S3-001 — component-level validation-guard render test مؤجّل 🟢 LOW-MEDIUM
- الموقع: `apps/web/src/app/[locale]/dashboard/projects/new/page.tsx:141` (الـ manual required-field guard على name+clientId).
- المشكلة: الـ guard اليدوي اللي بيعوّض عن فشل الـ HTML `required` على الـ conditionally-rendered steps (React بيـ unmount الـ steps التانية، فالـ `required` على Step 1 المخفي مايـfireش عند submit من Step 5) **مش متغطّى بـ render-test حقيقي** — لأنه محتاج harness كامل للـ wizard (Next 16 + i18n + next context + عشرات UI deps = كلفة/هشاشة عالية). غُطّي **indirectly** في `map-form-to-create-input.spec.ts` (الـ "clientId passthrough" spec: الـ mapper مايحرسش clientId → بيثبت إن الـ page guard هو الحارس).
- الـ Fix: full page-render spec للـ guard (submit من Step 5 بـ clientId فاضي ⇒ يرجّع Step 1 + مايضربش الـ backend)، **أو** استخراج الـ predicate كـ pure function قابلة للـ spec (قرار مبرمج+مخطط). مرشّح WEB-S1-004 infra.
- Source: Session S3 / 01-architect-report.md (الاكتشاف) + 04-tester-report.md (مناطق محتاجة coverage).

### WEB-S3-002 — error-state render tests (403/404 في الـ UI) مؤجّل 🟢 LOW
- الموقع: `projects/page.tsx` (list error) + `projects/[id]/page.tsx` (not-found/error) + `projects/new/page.tsx` (400/403 banner).
- المشكلة: الـ hooks بترجّع `isError` والصفحات بتعرض banner/not-found state، لكن **render-test فعلي للـ error states مؤجّل** (نفس كلفة الـ page harness). منطق الـ hook نفسه (isError propagation) مغطّى ضمناً بالـ MVT.
- الـ Fix: بعد ما WEB-S1-004 infra ينزل، specs للـ error/not-found/empty branches. مرتبط بـ R-3 (تفرقة terminal-auth vs transient).
- Source: Session S3 / 04-tester-report.md.

### WEB-S3-003 — useClients spec + enum types unification 🟢 LOW
- الجزء 1 (spec): `useClients` (dropdown في الـ Create) اتأجّل من الـ MVT بقرار الـ plan — spec خفيف (unwrap + `.items`) قابل يتضاف مع WEB-S1-004 infra.
- الجزء 2 (types): الـ enums معرّفة web-local UPPERCASE في `types/project.ts` (متعمّد — الـ shared-types lowercase لغرض تاني). توحيدها مع `packages/shared-types` بند cleanup لاحق بعد ما يتقرر الـ canonical casing.
- Source: Session S3 / 00-plan.md (deferrals) + 02-coder-report.md (قرار enums web-local).

### WEB-S3-004 — search/filters wiring على الـ List 🟢 LOW
- الموقع: `projects/page.tsx` (الـ search box + status/type filters).
- المشكلة: الـ List UI فيه search/filter controls بس **UI-only** في S3 (بـ TODO صريح) — مش مربوطين بالـ `ProjectsListQuery` params (اللي الـ hook + client بيدعموهم بالفعل). تفادي scope creep في S3.
- الـ Fix: ربط الـ controls بـ `useProjects({ search, status, type, page })` — البنية التحتية جاهزة. مجدول لـ **S5** (Dashboard Overview) أو standalone.
- Source: Session S3 / 02-coder-report.md المرحلة 3.

> **ملاحظة على 1.4 (Detail):** مربوط core + phases + assignments (real). أي KPI مالي (المستخلصات/الاحتجاز/هامش الربح) + مقاولو الباطن + audit = **placeholders بـ TODO** موجّهة للـ sessions المناسبة (payments S7 / subcontractors S10 / audit S9) — مش mock مفبرك. `payments/summary` على الـ Detail يفضل **S7-blocked على R-1**.

---

## Session S4 (Updates workflow + Review Inbox + Phases: 1.5-1.7) — Tickets مضافة

> الـ session اتقفل Deep mode كامل (7 ملفات)، APPROVED WITH NOTES. المجموعة 1.5/1.6/1.7 = ✅ DONE في PAGE_WIRING_TRACKER. **MVT 5/5 passing** (16/16 tests في 3 ملفات spec، paired assertion على المفتاح byte-for-byte على الـ transport header + MVT-5 من الجهتين K1≠K2 و K2=K3، صفر خطأ tsc جديد). CVE-S4-001 (LOW) مُصلَّح معمارياً (نقل holders لملكية الـ page). البند WEB-S4-P7-001 **مُلزِم قبل production**.

### WEB-S4-P7-001 — `reviews/page.tsx` لسه mock (standalone Review Inbox picker) ✅ **DONE** (2026-07-13، Quick mode)
> استُبدل الـ mock بمنتقي مشاريع حقيقي فوق `useProjects()` (loading/error/empty states + status badges)، وكل مشروع يـ link لـ `dashboard/projects/[id]?tab=reviews`. الـ deep-link يفتح تبويب المراجعات مباشرة عبر قراءة query-param أحادية الاتجاه في `[id]/page.tsx` (`useSearchParams` → قيمة ابتدائية لـ `detailTab`، **بدون** bidirectional URL↔tab sync — يظل مؤجّلاً). صفر `ReviewItem` mock متبقٍّ، صفر خطأ tsc جديد فوق الـ 5 baseline، 44/44 vitest passing. **ملاحظة دقّة:** التنفيذ query-param based (`?tab=reviews`) مش hash-based. التفاصيل الأصلية محفوظة أدناه.
- الموقع: `apps/web/src/app/[locale]/dashboard/projects/reviews/page.tsx`.
- المشكلة: الـ Review Inbox اتربط كـ **tab داخل project detail** (bounded aggregation)، لكن المسار المستقل `reviews/page.tsx` (اللي عليه nav entry حي) **لسه mock** بالكامل (`ReviewItem` interface + بيانات ثابتة، تاريخ Apr 29). المرحلة 7 الأصلية (rewrite → منتقي مشاريع) مؤجّلة. أي مستخدم يدخل من الـ nav يرى بيانات وهمية.
- الـ Fix: إمّا rewrite `reviews/page.tsx` → `useProjects()` → قائمة مشاريع تـ link لـ tab المراجعات داخل detail، **أو إخفاء الـ nav entry** حتى يُربَط. **لا يجوز عرض mock في production.**
- Source: Session S4 / 01-architect-report.md (تقليص النطاق) + 05-principal-report.md (شرط #1).

### WEB-S4-SWAP-001 — non-atomic phase reorder swap 🟡 MEDIUM
- الموقع: `apps/web/src/components/dashboard/projects/phase-admin-controls.tsx`.
- المشكلة: reorder منفّذ كـ **كتابتان متسلسلتان مش ذريتان** (المرحلة تأخذ order الجار، ثم الجار يأخذ order المرحلة). لو فشلت الكتابة الثانية → **مرحلتان بنفس الـ order مؤقتاً** (tie-state غير مستقر تحت `orderBy: order asc`). الأثر يظهر في **ترتيب عرض حيّ للمستخدم** (مش transient داخلي بحت) — لذا MEDIUM لا LOW. يُحلّ بأي reorder/reload تالٍ لكنه correctness gap بلا spec ولا يمسكه tsc.
- الـ Fix: reorder ذري خلفي — Prisma `$transaction` يبدّل قيمتَي order لصفّين، أو `POST /projects/:id/phases/reorder` يستقبل ترتيباً كاملاً `[phaseId…]` ويكتبه في transaction واحدة (أو optimistic lock على الـ order) + spec.
- Source: Session S4 / 01-architect-report.md Stage 2 (تكملة، بند 3) + 05-principal-report.md.

### WEB-S4-ERR-001 — generic error message على أفعال الـ dialog 🟢 LOW
- الموقع: `apps/web/src/components/dashboard/updates/update-detail-dialog.tsx:280`.
- المشكلة: "فشل تنفيذ الإجراء" لا تميّز 400/409/422/network. بعد CVE-S4-001 صار الـ 422 غير قابل للوصول عبر الـ UI فالإلحاح منخفض.
- الـ Fix: error message تفصيلي مربوط بـ status code.
- Source: Session S4 / 03-hacker-report.md (ثغرات مفتوحة) + 05-principal-report.md.

> **ملاحظة على WEB-S1-004:** حجب الـ render/hook test infra بقى ضريبة متكرّرة — في S4 حجب holder lifecycle عبر شجرة Tabs→Panel→Dialog + reason-change wiring + override validation عن الـ spec (مغطّاة code-review فقط). رفعه صار استثماراً ذا أولوية (درس meta-review S4).

---

## Session 2026-07-14 — Supabase integration + local run + auth ES256 — ✅ **DONE** (Quick mode, operational)

> ربط المشروع بمشروع Supabase حقيقي (`tbezbzlsuerjlohaoawy`)، seed بيانات ديمو، وتشغيل الـ backend + auth end-to-end من المتصفح. **أهم اكتشاف: مشروع Supabase بيوقّع توكنات الدخول بـ ES256 (asymmetric)، مش HS256** — دي الخلفية اللي أي session جديدة لازم تعرفها قبل ما تلمس الـ auth.

### 🔑 CVE/FINDING-AUTH-ES256 — الـ backend كان HS256-only، المشروع ES256 — ✅ **محلول**
- **العَرَض:** أي request بتوكن دخول حقيقي كان هيترفض 401 مهما حطّينا `JWT_SECRET`.
- **الجذر:** GoTrue في المشروع ده بيوقّع الـ access_token بمفتاح **غير متماثل ES256 (EC P-256)**. الـ `kid = 65696675-11d6-48b7-bb00-d4c01a54676a` (ده **key-id**، مش سر — وكان محطوط غلط كـ JWT_SECRET). التوكن claims: `iss = https://tbezbzlsuerjlohaoawy.supabase.co/auth/v1`، `aud = authenticated`، `alg = ES256`.
- **الـ "JWT Secret" الـ legacy** (القيمة الحقيقية في `apps/api/.env` تحت `JWT_SECRET` — مشطوبة من هنا لأن الملف ده مرفوع على GitHub) حقيقي بس **غير مستخدَم للتوقيع** → لا يتحقق من ES256 أبداً.
- **الحل (في الكود):** `apps/api/src/modules/auth/jwt.strategy.ts` بقى يتحقق عبر **JWKS** (`jwks-rsa` → `passportJwtSecret`) على `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`، مع تثبيت `algorithms:['ES256']` + `issuer` + `audience:'authenticated'` (دفاع ضد alg-confusion). `JWT_SECRET` بقى مستخدَم فقط لتسجيل JwtModule + env-validation (مش للتحقق). المكتبة المضافة: `jwks-rsa`. الـ spec `jwt.strategy.spec.ts` بيـ `jest.mock('jwks-rsa')` لأن `jose` (ESM) مابيـ transform-ش تحت jest.
- **مُتحقَّق end-to-end:** login (`admin@demo.com/Admin123!`) → Bearer → `GET /api/v1/projects` = **200**؛ بدون توكن / توكن مزوّر = **401**.
- **⚠️ لأي session جاي:** لو هتشتغل على auth — **متحاولش HS256/JWT_SECRET**. المشروع asymmetric. لو Supabase رجّع legacy HS256 signing يوماً → لازم عكس التغيير.

### PRISMA7-ADAPTER — إكمال هجرة Prisma 7 (driver adapter) — ✅ **محلول**
- Prisma 7 client engine بيتطلب **driver adapter**؛ مكانش متركّب فالـ `PrismaService` مكانش يقدر يـ construct أصلاً (الـ spec نفسه بيتجنّب البناء).
- ثُبّت `@prisma/adapter-pg` + `pg` + `@types/pg`، ورُبط `PrismaPg(DATABASE_URL)` في `src/prisma/prisma.service.ts` و `prisma/seed.ts`.
- **علاقته بـ Ticket #2** (`@prisma/client/runtime/library` migration): بعد إعادة توليد client Prisma 7 + الـ adapter، `npx tsc -p tsconfig.build.json --noEmit` بيعدّي **صفر أخطاء**. غالباً Ticket #2 اتحل ضمناً — **يُتحقَّق صراحةً** في session تنظيف قبل ما يتقفل نهائياً.

### الإعدادات/البيانات (reference)
- `apps/api/.env`: `NEXT_PUBLIC_SUPABASE_URL` كان محطوط غلط (publishable key بدل الـ URL) — اتصلّح. `DATABASE_URL` = **session pooler port 5432** (الـ transaction pooler 6543 **غير واصل** من شبكة الـ dev). الباسورد فيه رموز خاصة → URL-encoded.
- Seed idempotent في `prisma/seed.ts` (+ `prisma.config.ts` → `migrations.seed`). مستخدمو Auth اتعملوا عبر `scripts/create-demo-users.mjs`. smoke test في `scripts/smoke-auth.mjs`.
- users الديمو: `admin@demo.com/Admin123!` (SUPER_ADMIN)، `client@demo.com/Client123!` (CLIENT). auth IDs: admin `10ac109f-…`, client `de747a5c-…`.

---

## Session S7 (financial + BOQ) — Tickets مضافة

### ~~API-ROLES-001 — `@Roles()` غير مُقيَّد بالنوع~~ ✅ **DONE** (2026-08-07، Quick mode)
> مقفول في `2026-08-07-s7-roles-gate/` مع البوابتين (أ) و(ب) من `S7-ROLES-GATE`.
> `Roles = (...roles: UserRole[])` مُطبَّق، و`RolesGuard.getAllAndOverride<UserRole[]>`
> كمان (الشق المنصوص عليه حرفياً في نص الـ ticket أدناه: «المقارنة في `RolesGuard`
> تبقى type-safe») — بدونه الطرفان مُقيَّدان والمقارنة بينهما لسه `string` مقابل `UserRole`.
>
> **🔴 نتيجة الـ sweep — النتيجة هي الدليل لا غيابه:** `npx tsc -p tsconfig.build.json
> --noEmit` = **EXIT 0** ⇒ **صفر typo قائم في كل الـ 68 استعمال عبر 12 controller**.
> **صفر تعديل على أي controller** — الحماية اتضافت والكود القائم طلع سليماً.
>
> **⚠️ و«EXIT 0» وحده ما كانش يثبت شيئاً** (متوافق تماماً مع «التضييق ما اشتغلش أصلاً») —
> فاتعملت **paired assertion على أداة التحقق نفسها** (قاعدة #4): حقن `'ACCOUNTENT'` في
> `finance.controller.ts:62` ⇒
> `error TS2345: Argument of type '"ACCOUNTENT"' is not assignable to parameter of type 'UserRole'.`
> **EXIT 2**، ثم الرجوع لـ EXIT 0. **ده اللي حوّل صفر-أخطاء من غياب إشارة إلى دليل.**
>
> **ملاحظة على `updates.controller.ts:38,47`:** `FIELD_ROLES`/`VIEWER_ROLES` بـ `as const`
> بيتعملهم spread في 5 `@Roles`. عدّوا لأن `as const` بينتج literal types. **لو كانوا
> `string[]` عاديين كانوا هيعدّوا بلا فحص إطلاقاً حتى بعد التضييق** — أي ثابت أدوار
> جديد لازم يكون `as const` أو `UserRole[]` صراحةً.
>
> **مرتبط:** [A3] كان **مقفولاً سلفاً من 2026-05-24** — انظر التصحيح السجلّي عنده.

**(الأصل — 🟡 MEDIUM ثم مرفوع لـ HIGH):**
- **الموقع:** `apps/api/src/common/decorators/roles.decorator.ts:8`
  ```ts
  export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
  ```
- **المشكلة:** الـ signature `string[]` — أي **typo في اسم دور لا يمسكه الـ TypeScript ولا أي test**، والنتيجة **صامتة تماماً** وذات اتجاهين:
  1. `@Roles('ACCOUNTENT')` ⇒ الدور المقصود **يتقفل** عليه الـ endpoint (403 غامض، يُقرأ كـ bug في الـ business logic لا في الصلاحيات).
  2. حذف/إعادة تسمية عضو في `enum UserRole` (`schema.prisma:652`) ⇒ كل `@Roles` القديمة تفضل **compile نظيف** وهي بتشير لدور مش موجود.
- **الحجم:** الـ decorator مستعمل في كل controller في الـ API (payments/projects/updates/phases/users/companies/chat/comments/media/sub-contractors/audit + finance الجديد) — الـ Layer-2 gate كله قائم على strings حرّة.
- **الاكتشاف:** Session S7 / المرحلة 3 — أثناء التحقق يدوياً من أسماء الـ 5 أدوار في `finance.controller.ts` مقابل `enum UserRole`. **التحقق اضطر يكون يدوي بالظبط لأن الـ tsc لا يغطيه.**
- **الـ Fix:**
  ```ts
  import type { UserRole } from '@prisma/client';
  export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
  ```
  ثم `npx tsc -p tsconfig.build.json --noEmit` = فحص شامل لكل `@Roles` في الـ repo دفعة واحدة (يكشف أي typo قائم فوراً). كلفة متوقعة: منخفضة (تغيير سطر + إصلاح ما يظهر).
- **مرتبط بـ [A3 — JwtPayload.role typing]** (Session 1.8، 🟢 LOW): نفس الجذر بالظبط (role كـ string حرّ بدل `UserRole`) في `current-user.decorator.ts:13`. **يُنفَّذان معاً في session واحدة** — الاتنين مع بعض بيقفلوا الحلقة: الدور اللي في الـ JWT والدور اللي في الـ metadata كلاهما مُقيَّد بالـ enum، والمقارنة بينهما في `RolesGuard` تبقى type-safe.
- **خارج نطاق S7** صراحةً (S7 = finance module فقط) — مُسجَّل بطلب المستخدم كـ ticket مستقل.
- **🔴 رُفعت أولويته إلى HIGH عند إقفال S7** — انظر `S7-ROLES-GATE` أدناه (البوابة ب).
- Source: Session S7 / 02-coder-report.md المرحلة 3 (ملاحظة #5).

---

### 🔴 S7-ROLES-GATE — مصفوفة صلاحيات finance بلا أي حارس آلي — **HIGH** · ⚠️ **(أ) و(ب) DONE — (ج) لسه مفتوحة**
> **البوابة: قبل أي ربط للـ frontend بأي endpoint من التسعة.** قرار المراجع الأعلى (`05-principal-report.md` قرار 2️⃣).
>
> **✅ حالة 2026-08-07 (`2026-08-07-s7-roles-gate/`، Quick mode):** البوابتان **(أ)** و**(ب)**
> مقفولتان ⇒ **الحظر على ربط الـ frontend مرفوع.** البوابة **(ج) باقية على حالها**، وحظرها
> المستقل قائم: **لا تُعرَّض الـ 9 endpoints لمستخدمين حقيقيين في production قبلها.**
>
> ⛔ **تنبيه: رفع حظر (أ)+(ب) لا يعني أن الربط صار مفتوحاً** — ~~`R-1` (refresh-success غير
> مُختبَر) حاجب **مستقل** قائم قبل ربط `financial-summary`~~ **✅ R-1 مقفول 2026-08-07 ⇒ حجبه
> مرفوع** (شُطب هنا **عند مصدره** لا في الـ Updates log وحده — تطبيقاً لدرس A3 المقلوب)،
> و`CVE-S7-007` (خيار ب) + `P-1` بوابتهما «جلسة الربط» نفسها **وما زالتا قائمتين**.

- **الوضع القائم:** 9 endpoints مالية، صلاحية كل واحد **سلسلة نصية حرة** (`@Roles(...roles: string[])`). **لا الـ tsc يمسك خطأها ولا أي spec.** تحققها الوحيد اليوم سكربت boot **عابر** كتبه المبرمج في المرحلة 7 و**اختفى بنهاية الـ session**.
- **لماذا HIGH:** المنطقة **الوحيدة** في S7 اللي فيها خطر أمني بلا أي شبكة أمان آلية — وهي المسار اللي بيقرر **مين يشوف مال مين**.
- **التقسيم الثلاثي (أبواب صريحة، لا "أولوية عالية" مبهمة):**

| # | البند | الأولوية | البوابة | الحالة |
|---|---|---|---|---|
| **أ** | ~~**spec لمصفوفة الصلاحيات من الـ metadata**~~ — تحويل سكربت الـ boot العابر إلى **spec دائم** يقرأ `Reflect.getMetadata('roles')` لكل handler، يثبّت الجدول التسعة، ويتحقق من كل اسم دور مقابل `enum UserRole` | 🔴 HIGH | قبل أي ربط frontend | ✅ **DONE 2026-08-07** — `finance-roles.matrix.spec.ts`، **56 حالة passing** |
| **ب** | ~~**API-ROLES-001 + A3**~~ — `Roles = (...roles: UserRole[])` + `JwtPayload.role: UserRole` | 🔴 HIGH | قبل أي ربط frontend | ✅ **DONE 2026-08-07** — (A3 كان مقفولاً سلفاً من 2026-05-24) |
| **ج** | **BACKLOG #5** — HTTP integration tests (supertest: الـ guard + ValidationPipe + ParseUUIDPipe فعلياً) | 🟡 MEDIUM، بميعاد | **قبل تعريض finance لمستخدمين حقيقيين في production** | 🔴 **مفتوحة** |

#### ✅ ما نفّذته البوابة (أ) — `apps/api/src/modules/finance/finance-roles.matrix.spec.ts`

الـ spec **مايبنيش DI ولا يوصل DB** (بيقرأ metadata من الـ prototype مباشرةً)، **6.2 ثانية**،
صالح للـ CI بلا أي بنية تحتية. الجدول المرجعي **مكتوب حرفياً بالإيد** من جدول المرحلة 3
في `00-plan.md` (سطور 128–136) — **ممنوع توليده من الكود اللي بيتحقق منه** (تحذير مكتوب
كـ header في الملف). حقل `roles` نوعه `string[]` **متعمَّد لا `UserRole[]`**: لو اتقيّد
بالـ enum يبقى **الـ tsc** هو اللي بيفحص والـ spec بيفحص «متطابق مع نفسه».

**أربع طبقات:** (1) الحصر — الـ 9 بالظبط + **كل handler عليه `@Roles` غير فارغة** (لأن
`roles.guard.ts:35` بيرجّع `true` لما الـ metadata غايبة ⇒ **handler جديد بلا decorator =
endpoint مالي مفتوح لكل دور مصادَق عليه**) + صفر `@Roles` على مستوى الـ class · (2) الجدول
صفاً صفاً: method + path + الأدوار كمجموعة + طول + منع تكرار + HTTP status · (3) صحة
الأسماء مقابل `UserRole` **+ مطابقة الـ enum المولَّد مع `prisma/schema.prisma` نصياً**
(قاعدة #4 — لو `prisma generate` فايت، الـ client بيحمل enum قديم وكل فحص مبني عليه بيوافق
على أسماء ميتة) + assertion سالبة (`ACCOUNTENT`/`accountant`/`ADMIN` يترفضوا) · (4) **ثوابت
دلالية**: CLIENT قارئ فقط، WORKER مستبعَد كلياً، SUPER_ADMIN صريح في كل endpoint، تعديل
الإعدادات محصور في SUPER_ADMIN+ACCOUNTANT.

**🏆 mutation check — 3 طفرات على 100% من الطبقات، صفر اقتران زائف:**

| الطفرة | النتيجة |
|---|---|
| `@Roles('ACCOUNTENT')` على `getSettings` | **2 failed / 54 passed** — صفّ الأدوار + فحص الـ enum، بالظبط الاتنين |
| حذف `@Roles` بالكامل من `createBOQItem` | **4 failed / 52 passed** — الأربعة كشف مشروع لنفس العيب |
| `CLIENT` على `PATCH boq/:id` **+ تحديث الجدول معاه** | **1 failed / 55 passed** — «CLIENT قارئ فقط» **وحده** |

🔴 **الطفرة الثالثة هي النتيجة الأهم:** تعديل صلاحية **متّسق مع الجدول** عدّى من طبقة
مقارنة الصفوف **بالكامل**، ومسكته طبقة الثوابت الدلالية وحدها. **الدليل التجريبي إن
الجدول وحده لا يكفي:** الجدول يثبّت **الحالة**، الثوابت تثبّت **القاعدة**. أي spec مصفوفة
لاحق (للـ 11 controller الباقية) **لازم يحمل الطبقتين**.

> **⚠️ حدود الضمانة (منقول كما هو من `05-principal-report.md`، وما زال سارياً حرفياً):**
> (أ) **ليست بديلاً عن** (ج). (أ) تثبّت ما هو **مُعلَن في الـ metadata**، ولا تثبت أن
> `RolesGuard` **ينفّذه فعلاً وقت التشغيل**. التحذير ده مكتوب كمان في header ملف الـ spec.

- **مبرر الترتيب:** (أ) و(ب) معاً كلفتهما **ساعات لا أيام**، وبيحوّلوا خطراً غير محروس إلى **ضمانة وقت-ترجمة + spec دائم** — أعلى عائد لكل ساعة في الـ BACKLOG كله. (ج) استثمار بنية تحتية حقيقي، **ولا يصح استخدامه كذريعة لتأجيل (أ) و(ب): الرخيص لا ينتظر الغالي.** ✅ **متحقَّق:** (أ)+(ب) اتنفّذوا في **session واحدة Quick mode**، بـ **26 سطر تعديل إنتاجي + spec واحد**.
- **⚠️ تحذير صريح:** (أ) **ليس بديلاً عن** (ج). (أ) يثبّت ما هو **مُعلَن في الـ metadata**، ولا يثبت أن الـ `RolesGuard` **ينفّذه فعلاً وقت التشغيل**.
- **ما لا يُقبل تحت أي ظرف:** ~~تعريض أي من الـ 9 endpoints لمستخدم حقيقي قبل استيفاء (أ) و(ب).~~ ✅ مستوفى — **ويبقى قائماً بنصّه لـ (ج): لا تعريض لمستخدمين حقيقيين في production قبل الـ HTTP integration tests.**
- Source: Session S7 / 04-tester-report.md (مناطق محتاجة coverage #1) + 05-principal-report.md قرار 2️⃣.

---

### 📋 بنود مُسلَّمة من session 2026-08-07 (S7-ROLES-GATE أ+ب)

> الـ session كانت **Quick mode (دور واحد)** ⇒ القاعدة #10 لا تنطبق إجرائياً (مفيش دور
> مستقبِل يفتح جدول «البنود المُستلَمة»). البنود اتسجّلت هنا صراحةً **بدل ما تموت بالصمت** —
> وده بالظبط ما تفرضه روح القاعدة #10 حتى خارج نطاق تطبيقها الحرفي.

| # | البند | الحالة |
|---|---|---|
| 1 | تحديث `BACKLOG.md` (شطب أ/ب + API-ROLES-001 + تصحيح A3) | ✅ **مُغلَق بهذا التحديث** |
| 2 | `boq/:id` مكرَّر بين `PATCH` و`DELETE` — الـ spec يميّز بالـ method زي الـ router | ✅ توثيقي، صفر إجراء |
| 3 | **ROLES-SPEC-001** — فحص التكرار يسقط بـ TypeError لا assertion | 🟢 LOW — مفتوح أدناه |
| 4 | **ROLES-POLICY-001** — الثوابت الدلالية الأربعة قابلة للنقض من مالك المنتج | 🟡 مسألة منتج — مفتوحة أدناه |
| 5 | **البوابة (ج)** لسه مفتوحة | 🔴 **مفتوحة** — BACKLOG #5، حظر production قائم |
| 6 | **ROLES-MATRIX-002** — مصفوفات الـ 11 controller الباقية بلا specs جداول | 🟡 MEDIUM — مفتوح أدناه |

#### ROLES-SPEC-001 — فحص التكرار يسقط بـ TypeError لا assertion 🟢 LOW
- **الموقع:** `finance-roles.matrix.spec.ts` — اختبار «مفيش دور مكرَّر داخل نفس الـ handler».
- **المشكلة:** لما الـ metadata **غايبة تماماً** (mutation 2)، الاختبار بيسقط بـ
  `TypeError: undefined.length` مش بـ assertion failure. **العيب بيتكشف** (وكمان بيتكشف
  بتلات اختبارات تانية أوضح منه) — بس الرسالة أقل وضوحاً من المفروض للقارئ.
- **الـ Fix:** سطر guard واحد (`const actual = readRoles(h) ?? []`).
- **مؤجَّل بوعي** عشان ما يزوّدش سطح الـ spec بلا داعٍ — الحالة مغطّاة صراحةً باختبار
  «كل handler عليه `@Roles` غير فارغة».
- Source: session 2026-08-07 / `02-coder-report.md` (بند مُسلَّم #3).

#### ROLES-POLICY-001 — الثوابت الدلالية = قرارات منتج مثبَّتة في spec 🟡 مسألة لمالك المنتج
- **الموقع:** `finance-roles.matrix.spec.ts` — قسم «ثوابت الصلاحيات الماليّة» (4 اختبارات).
- **المسألة:** «`CLIENT` قارئ فقط» و«`WORKER` مستبعَد من الوحدة الماليّة كلياً» **قرارات
  منتج** لا هندسية، وهي دلوقتي **مثبَّتة في spec**. لو اتغيّرت السياسة، الـ suite **هتفرمل
  عمداً** وهتطلب مبرراً معلناً.
- **الفرملة مقصودة** — نفس منطق `retentionPct` بلا سقف (S7-MINOR #5): أي تغيير يُضاف
  لاحقاً بلا قرار معلن هيكسر الـ spec ويطلب مبرراً.
- **مرتبط بـ `CVE-S7-007`** (المحسوم = خيار ب): لو اتقرر كشف `contractValue` للـ CLIENT،
  ده تغيير **projection** لا تغيير **صلاحية route** ⇒ **لا يمسّ الثوابت دي** — يمسّ MVT-5.
  **التفرقة دي مهمة عند جلسة الربط.**
- Source: session 2026-08-07 / `02-coder-report.md` (بند مُسلَّم #4).

#### ROLES-MATRIX-002 — الـ 11 controller الباقية بلا specs جداول 🟡 MEDIUM
- **الوضع:** بعد تضييق `@Roles`، أسماء الأدوار في الـ **68 استعمال** كلها متحقَّقة
  **نوعياً بالـ tsc**. لكن **جداول الصلاحيات نفسها** (مين يقدر يعمل إيه على كل endpoint)
  **غير مثبَّتة بأي spec** خارج `finance` — أي تعديل صامت على `@Roles` في
  `payments`/`projects`/`users`/… بيعدّي بلا أي حارس.
- **الـ Fix:** `finance-roles.matrix.spec.ts` **قالب جاهز للنسخ**. الأولوية المقترحة حسب
  الحساسية: `payments` ← `users` ← `projects` ← الباقي.
- **⚠️ شرط:** أي نسخة لازم تحمل **الطبقتين** (الجدول + الثوابت الدلالية) — mutation 3
  أثبتت إن الجدول وحده بيعدّي عليه تعديل متّسق.
- **خارج نطاق session 2026-08-07** صراحةً (مذكور في حدود الـ scope).
- Source: session 2026-08-07 / `02-coder-report.md` (بند مُسلَّم #6).

---

### 🔴 P-1 — «قيمة المشروع» صارت ثلاثة أرقام بلا أي مصالحة — 🟡 MEDIUM
> **نتيجة مستقلة للمراجع الأعلى — لم يرصدها أي من الأدوار الأربعة.** البوابة: **جلسة الربط**.

- **المشكلة:** بعد S7، للمشروع الواحد **ثلاث قيم مالية مستقلة تماماً**:

| الرقم | المالك | من يقرأه |
|---|---|---|
| `Project.totalBudget` | `projects` (سابق) | `payments.getSummary` يعرضه كـ `budget` |
| `ProjectFinancialSettings.contractValue` | `finance` (جديد) | `financial-summary` يُرجعه |
| `Σ BOQItem.contractValue` | `finance` (جديد) | شجرة الـ BOQ |

- **لا شيء يوفّق بينها.** ميزانية 800 ألف + قيمة عقد مليون + مجموع بنود 1.5 مليون = **كلها صالحة في الـ DB في نفس اللحظة**، وكلها هتظهر على **نفس شاشة Finance** بعد الربط.
- **🔴 والأدهى:** `contractValue` **لا يدخل أي عملية حسابية إطلاقاً** — لا `retention` ولا `advanceRecovered` ولا `netDue` يستخدمه (كلها مبنية على `totalCompleted`). حقل **يُخزَّن ويُدقَّق ويُحجب عن العميل… ولا يُحسب به شيء**. هو اليوم **بيان عرضي فقط**.
- **ليس عيباً في تنفيذ S7** — الخطة طلبت الحقل والتنفيذ نفّذه بأمانة. لكنه **دَين تصميم يظهر يوم الربط لا قبله**.
- **المطلوب (إلزامي قبل production):** تحديد **الرقم المرجعي الواحد** لقيمة المشروع + **دلالة صريحة للباقي** (أو حذف ما لا معنى له).
- **مرتبط بـ A-S7-2** (تعريف Σ `CLIENT_PAYMENT` في مكانين) — **نفس العائلة بالضبط:** ازدواج مصدر حقيقة رقم مالي. يُحسمان معاً.
- Source: Session S7 / 05-principal-report.md (P-1).

---

### 📘 P-1b — درس إجرائي، **ليس ticket تقنياً** — ✅ مُعالَج بالقاعدة #10
> يُسجَّل هنا للسياق فقط. **لا كود يُكتب، لا فحص يُفتح.**

- **الواقعة:** المبرمج وسم قراراً صراحةً بـ **«قابل للنقض من الهاكر»** (إظهار `warrantyStartDate`/`warrantyMonths` للـ CLIENT). الهاكر **لم يتناوله إطلاقاً** — لا قبول ولا رفض ولا ذكر. حسمه المراجع الأعلى **بالإبقاء** (مدة الضمان بند في عقد العميل نفسه، وبدونها `retentionReleased` رقم بلا معنى).
- **الرقم:** 7 من 8 بنود مُسلَّمة أُغلقت = **87.5%** — والخطر في النسبة نفسها: نظام يقفل 87% يولّد ثقة بأن الباقي مقفول.
- **✅ المعالجة:** **القاعدة #10 (Explicit Handoff Closure)** أُضيفت إلى `CLAUDE.md` عند إقفال S7 + إعادة صياغة نطاق القاعدة #5.
- **الدرس الأعمق (يُقرأ قبل كل session):** الأدوار الأربعة أدّت **نطاقاتها** بجودة عالية، والعيبان الوحيدان اللذان نجَوا (**P-1** و**P-1b**) وقعا **بين النطاقات لا داخلها** — أحدهما بين modules والآخر بين دورين. **نظام الأدوار يحرس العمق ولا يحرس الحدود بينها بنفس القوة.**
- Source: Session S7 / 05-principal-report.md (P-1b) + 06-meta-review.md (القسم الأول).

---

### CVE-S7-007 — تناقض إفصاح `contractValue` للـ CLIENT — 🟡 MEDIUM · **محسوم = خيار (ب)**
> **القرار متخذ. المتبقي تنفيذ فقط.** البوابة: **جلسة الربط**.

- **المشكلة:** `GET /financial-summary` **يحجب** `contractValue` عن الـ CLIENT، وفي نفس الوقت `GET /boq` **مسموح للـ CLIENT** ويرجّع `contractValue` **لكل بند** ⇒ جمع بسيط للجذور يعطي قيمة العقد **بتفصيل أدق مما حُجب أصلاً**.
- **✅ القرار (المراجع الأعلى): خيار (ب) — يُرجَع `contractValue` للـ CLIENT في الملخص.**
  - الحجب الحالي **أمان موهوم**: سياسة تبدو محكمة وليست كذلك — أسوأ من غياب السياسة، لأن قراراً لاحقاً سيُبنى عليها.
  - في مجال المقاولات، **بيان الكميات ملحق تعاقدي يُسلَّم للعميل**. حجب رقم يملكه العميل ورقياً ليس حماية.
  - **الخيار (أ) مرفوض** — نزع `CLIENT` من `GET /boq` نقض لجدول صلاحيات معتمد + حرمان العميل من بيان هو طرف فيه، ثمن أعلى مقابل حماية صفر.
- **⛔ شرط ملزم:** أي تغيير في هذه الـ projection **لا يمرّ بدون تحديث MVT-5**. الـ spec الحالي يثبّت السلوك القائم — **والفرملة مقصودة**.
- **لماذا لم يُنفَّذ في S7:** المختبر وقّع على suite خضراء؛ تغيير الـ projection يبطل MVT-5. **تغيير عقد API بعد توقيع الاختبار بلا إعادة دورة كاملة = التسرّع الذي يمنعه هذا النظام.**
- **⚠️ مسألة مرفوعة لمالك المنتج (لا قرار هندسي):** نفس المنطق ينطبق — **وربما بقوة أكبر** — على `retentionPct` و`advancePct` و`advanceAmount`: **نسبة الاحتجاز وشروط السلفة بنود صريحة في كل عقد إنشاءات**، أي ليست "مدخلات داخلية" بالمعنى الذي بُني عليه الحجب. تُطرح مع (ب). الثمن الهندسي لو تقرر كشفها: **سطران في فرع واحد + تحديث MVT-5**.
- Source: Session S7 / 03-hacker-report.md (CVE-S7-007) + 05-principal-report.md قرار 1️⃣.

---

### CVE-S7-006 — تضخيم الإنجاز بربط تقرير واحد بعدة بنود — 🟡 MEDIUM
- **المشكلة:** الـ unique constraint `(boqItemId, updateId)` يمنع تكرار **نفس الزوج** ولا يمنع ربط **نفس التقرير بـ 50 بنداً**. كل بند يحتسب **كامل** `update.cost`. `SITE_ENGINEER` (أدنى دور له صلاحية الربط) يقدر يخلي كل بنود المقايسة تعرض 100%.
- **سقف الضرر — عرضي بحت:** `netDue` يُحسب من `Update.cost` مباشرةً **ولا يمرّ على الـ BOQ إطلاقاً** ⇒ **لا تحويل أموال، تضليل عرض فقط.**
- **الإصلاح الحقيقي = توزيع نسبي** (عمود نسبة/مبلغ على `BOQItemUpdate`) ⇒ **تغيير schema + تغيير عقد API + تعديل المرحلتين 5 و6** = نطاق session كاملة. الخطة اختارت صراحةً "روابط مباشرة بلا rollup".
- **البوابة:** جلسة schema لاحقة.
- Source: Session S7 / 03-hacker-report.md (CVE-S7-006).

---

### CVE-S7-008 — `ensureProjectAccess` خارج الـ transaction (TOCTOU على الصلاحية) — 🟢 LOW · **مقبول بوعي**
- **المشكلة:** S7 طبّقت بانضباط قاعدة "كل قراءة سابقة جوّه transaction الكتابة" — **على قراءات البيانات فقط**. قراءة **الصلاحية** فضلت برّه. مهندس موقع تُسحب تعيينه أثناء تنفيذ طلبه يقدر يكمل **كتابة واحدة** بعد السحب.
- **التأثير:** كتابة واحدة بصلاحية منتهية، **ضمن نفس المستأجر**، **مسجَّلة بالكامل في الـ audit**. النافذة أجزاء من الثانية وتتطلب تزامناً مع فعل إداري.
- **لماذا لم يُصلَح:** الإصلاح يستلزم `ensureProjectAccess` بنسخة تقبل `TransactionClient` ⇒ تعديل في `projects.service.ts` يمسّ **كل** مستهلكيه (payments/comments/updates/chat/media). **كلفة blast-radius أعلى بكثير من الخطر.**
- Source: Session S7 / 03-hacker-report.md (CVE-S7-008).

---

### A-S7-1 — `FinanceModule` يُصدّر قارئ إعدادات بلا بوابة — 🟢 LOW
- `FinanceModule.exports` يشمل `FinancialSettingsService`، و`getEffectiveState` **لا تُجري أي فحص صلاحية** (موثّق بتحذير). أي module مستقبلي يستورد `FinanceModule` يحصل على **قارئ إعدادات مالية بلا بوابة**.
- **لا مستهلك اليوم** ⇒ غير حاجب. **تصدير استباقي = سطح بلا مقابل.**
- **الـ Fix:** تضييق `exports` لما يُستهلك فعلاً (**لا شيء حالياً**)، أو نقل `getEffectiveState` لـ provider داخلي غير مُصدَّر.
- Source: Session S7 / 01-architect-report.md (A-S7-1).

### A-S7-3 — تعليق يَعِد بعزلة غير مضمونة — 🟢 LOW-MEDIUM
- `findTree` و`getSummary` يلفّان قراءتيهما في `prisma.$transaction([...])` **بلا `isolationLevel`** ⇒ العزلة = `READ COMMITTED`، وفيها **كل جملة تأخذ لقطتها الخاصة**. الاستعلامان ما زالا قادرين على رؤية حالتين مختلفتين — **وهو بالضبط ما قال التعليق إنه يمنعه**.
- **🔴 الأخطر هنا هو التعليق لا الكود:** الخطر التشغيلي منخفض (نافذة أجزاء من الثانية، لا شيء يُخزَّن)، لكن **تعليقاً يَعِد بضمانة غير قائمة أخطر من غيابه** — القارئ التالي يبني عليه.
- **الـ Fix:** إما `{ isolationLevel: RepeatableRead }` للقراءتين، أو **تخفيف نص التعليق** ليصف ما يضمنه فعلاً.
- Source: Session S7 / 01-architect-report.md (A-S7-3).

### A-S7-4 — غياب حارس المشروع الملغى في `finance` — 🟢 LOW (توثيق فقط)
- `payments.service.ts:232` يمنع تسجيل دفعة على مشروع `CANCELLED`؛ `finance` يسمح بـ PATCH للإعدادات وبكل كتابات الـ BOQ على مشروع ملغى.
- **حكم الهاكر: فجوة اتساق موثَّقة — لا ثغرة.** تعديل إعدادات/مقايسة مشروع ملغى **لا يحرّك مالاً**، و**التسوية بعد الإلغاء حالة عمل حقيقية** (ضبط قيمة العقد لتصفية المستحق) — حارس صارم كان هيمنع إغلاقاً مشروعاً.
- **ما هو خطأ فعلاً: أن التباين غير موثَّق.** القارئ التالي سيرى الحارس في `payments` وغيابه في `finance` ويستنتج سهواً.
- **الـ Fix:** تعليق صريح في `financial-settings.service.update` و`boq.service` يوثّق القرار (حركة نقدية ↔ بيان تخطيطي) — **لا حارس**. يُنفَّذ في أي جلسة لاحقة تمسّ الملفين.
- Source: Session S7 / 03-hacker-report.md (المحور 3) + 01-architect-report.md (A-S7-4).

### A-S7-5 — تشعّب مصدر حقيقة الـ schema — 🟡 MEDIUM **ومتراكم**
- ملف الـ migration المحلي موجود، و`_prisma_migrations` **غير موجود على الـ DB**، والتتبّع في `supabase_migrations.schema_migrations`. **أي بيئة جديدة تُقام بـ `prisma migrate deploy` ستحاول إنشاء جداول قائمة.**
- **ليس خطأ S7** (نمط قائم منذ 2026-07-14) **لكنه يتراكم** مع كل migration جديدة.
- Source: Session S7 / 01-architect-report.md (A-S7-5، تبعة D-1).

---

### S7-MINOR — بنود أدنى من عتبة الـ CVE (مرصودة للسجل) — 🟢 LOW
| # | البند | الأثر |
|---|---|---|
| 1 | **لا `unlink`** لرابط BOQ↔تقرير | رابط اتعمل بالغلط (تقرير صح، بند غلط) **دائم عبر الـ API**، وبيفضل يضخّم `completedPct` للبند الغلط |
| 2 | **لا مسح لـ `warrantyStartDate`** | `@IsDateString` مايقبلش `null` ⇒ تاريخ ضمان اتحط بالغلط **مايتشالش** (يتعدّل بس). **يضاعف أثر CVE-S7-003 المُصلَّح** |
| 3 | **لا `Idempotency-Key` على `POST /boq`** | تكرار ينشئ بنداً مزدوجاً — **مرئي وقابل للحذف**، بخلاف الدفعات |
| 4 | `linkUpdate` عند سباق `P2002` يرجّع `id: null` | مسار سباق نادر، غير مؤكَّد بـ spec |
| 5 | `retentionPct` بلا سقف (قرار موثَّق) | `retentionPct=100` ⇒ `netDue ≤ 0` دائماً. **قرار الهاكر: تُسجَّل ولا تُصلَّح** — لا خصم مستفيد، والحالة العكسية (`=0`) تُسقِط التصنيف، والفعل مرصود بالكامل في الـ audit. **معيار الأمان هنا الرصد لا المنع.** التوصية عند الربط: **تحذير مرئي** عند `>10` أو عند `netDue ≤ 0` مع إنجاز موجب — لا حدّ صامت في الـ DTO. مثبَّت بـ spec متعمَّد ⇒ أي سقف يُضاف لاحقاً بلا قرار معلن هيكسر الـ spec ويطلب مبرراً |
| 6 | **علامة بنيوية لغياب سبب الحذف** في الـ audit | الحالة الشائعة تُنتج سلسلة **ثابتة** في `audit_logs.reason` ⇒ فرز "الحذوفات بلا مبرر" يحتاج **مطابقة نصية على البادئة** (ربط هشّ). المقترح: `userReasonProvided: false` داخل `oldValues` |

- البنود 1 و2 نفس النمط: **"فعل بلا نقيض" في الـ API**.
- Source: Session S7 / 02-coder-report.md + 03-hacker-report.md (تحت العتبة) + 01-architect-report.md.

---

### 🔴 TEST-BASELINE-001 — الـ baseline الأحمر (14 test) — **Quick mode session مستقلة**
> **ticket منفصل — غير مرتبط بـ S7 إطلاقاً.** يجمع ENV-SPEC-001 + AUDIT-SPEC-001 في بند تنفيذي واحد.

- **الوضع:** 14 test فاشلة في 2 suites (`env-validation.spec.ts` = 8، `audit-log.service.spec.ts` = 6) — **مفتوحة منذ 2026-05-24، أي ~10 أسابيع** حتى إقفال S7.
- **🔴 لماذا رُفعت لـ ticket مستقل الآن — الدَّين لم يعد اختبارياً بل بوابياً:**
  1. مع baseline أحمر **يستحيل بوابة CI على "كل الاختبارات خضراء"** — أبسط بوابة جودة وأقواها معطّلة.
  2. **"صفر regression" بقى إشارة تحتاج قراءة يدوية** لأسماء الـ suites الفاشلة في **كل session** للتأكد إنها **نفسها** الـ 14 لا 14 غيرها. ده تحقق بشري متكرر بدل تحقق آلي.
- **الأثر التراكمي المُقاس:** كل session من 2026-05-24 لـ S7 اضطرت تنسخ الـ baseline وتقارنه يدوياً (`02-coder-report.md` وثّقها في 7 مراحل، و`04-tester-report.md` كررها).
- **الخيارات (لكل suite):** (a) إصلاح السلوك في الكود، أو (b) تحديث الـ spec لو السلوك الحالي مقصود. **القرار per-suite، مش واحد للاتنين.**
- **التفاصيل التقنية الكاملة:** انظر ENV-SPEC-001 و AUDIT-SPEC-001 في قسم "Session 1.9+" أعلاه.
- **الاقتراح:** **Quick mode** — الـ scope محدود ومعروف، والـ deliverable واضح (suite خضراء ⇒ بوابة CI ممكنة).
- Source: Session S7 / 05-principal-report.md (نقاط الضعف #4 + مخاطر متبقية).

---

## Session R-1 (refresh-success coverage) — Tickets مضافة

> من `2026-08-07-r1-refresh-success/` (**Standard mode، 4 ملفات، ✅ مقفولة** — MVT 4/4،
> mutation 100%). **كل البنود هنا مُوثَّقة بلا إصلاح** — نطاق الـ session تغطية فقط، وقيد
> المستخدم كان صريحاً: أي gap يُرفَع ولا يُصلَح. **صفر تعديل على أي ملف إنتاجي**
> (`git diff --stat -- client.ts` = فارغ بعد استرجاع الطفرات الأربعة).

### WEB-S2-DBLMAP-001 — double-mapping بيمسح `code`/`message` الحقيقيين 🟡 MEDIUM
> 🔴 **متطلَّب سابق لـ `R-3`** — انظر آخر فقرة.

- **الموقع:** `apps/web/src/lib/api/client.ts:106` ⟵ `apps/web/src/lib/api/auth-client.ts:73-80`
  ⟵ `apps/web/src/lib/api/map-auth-error.ts:51-73`.
- **السلسلة:**
  1. `authClient.refresh()` في الـ catch بيعمل `throw mapAuthError(e)` ⇒ بيرمي **`AuthError`
     مُطبَّعاً بالفعل**: `{ code, message, requestId?, errors? }`.
  2. الـ interceptor بيمسك الرمية دي ويعمل **`mapAuthError` تاني** عليها.
  3. الـ `AuthError` **مالوش `.response` ولا `.request`** ⇒ فرع الـ envelope يسقط
     (`err.response?.data` = undefined) وفرع الشبكة يسقط (`err.request !== undefined` = false)
     ⇒ بيرجع الـ fallback: `{ code: "UNKNOWN", message: "حدث خطأ غير متوقع — حاول مجدداً" }`.
- **الأثر:** على **كل** فشل refresh طرفي، الـ `code` الحقيقي (`UNAUTHORIZED` / `TOKEN_EXPIRED`
  / `NETWORK`) والرسالة العربية القادمة من الـ backend **بيتدمّروا**. المستخدم بيشوف رسالة
  عامة بدل السبب الفعلي، والمستهلك البرمجي بيفقد قدرته على الـ special-casing.
- **الـ Fix (لجلسة لاحقة):** يا إمّا `client.ts:106` يرمي `refreshError` كما هو (مُطبَّع سلفاً)،
  أو — **الأمتن** — `mapAuthError` يبقى **idempotent** (يرجّع الـ input لو هو `AuthError` صالح)،
  فيقفل النمط لكل المستهلكين لا لموضع واحد. **يحتاج regression pass:** `map-auth-error`
  مستهلكوها أوسع من `client.ts` (auth-client + كل الـ hooks).
- 🔴 **العلاقة بـ `R-3`:** الـ fix المقترح لـ R-3 إن الـ RouteGuard يفرّق بين terminal-auth
  و transient **بقراءة نوع الخطأ** بدل `isError` boolean. البند ده بيقول إن المعلومة دي
  **مُدمَّرة قبل ما توصل الـ guard** على مسار فشل الـ refresh ⇒ **R-3 غير قابل للتنفيذ
  الكامل قبل إغلاق DBLMAP-001.**
- **لماذا لا spec هنا:** قرار المخطط (نقطة قرار #1، مُوافَق عليها) — الـ characterization
  spec بيثبّت **سلوكاً خاطئاً كعقد أخضر**، وساعة الإصلاح هيسقط ويُقرأ regression.
  الـ spec يتكتب **مع** الإصلاح.
- **Source:** Session R-1 / `00-plan.md` (اكتشاف أثناء التخطيط).

### WEB-S2-TOKENDUP-001 — `client.ts:101` مُتجاوَز، بيوحي بضمانة هو مش مصدرها 🟢 LOW
> 🔬 **مؤكَّد تجريبياً بـ M0 (شاهد سالب) — لم يعد استنتاجاً من قراءة الكود.**
- **الموقع:** `apps/web/src/lib/api/client.ts:101` مقابل `client.ts:65` + `client.ts:49-55`.
- **الملاحظة:** الـ retry بيتم بـ `return client(config)` = **استدعاء كامل** ⇒ الـ **request
  interceptor بيشتغل تاني** ويكتب `Authorization` من الـ store؛ والـ store اتحدّث بالتوكن
  الجديد في `refreshAccessToken` (`client.ts:65`) **قبل** الـ retry. يعني الإسناد المباشر
  في السطر 101 **بيتكتب فوقه دايماً**.
- **ليس bug** — السلوك النهائي صحيح، والتوكن الجديد بيوصل فعلاً (مُثبَت transport-level في
  `client.spec.ts` MVT-1).
- 🔴 **الخطورة الحقيقية اختبارية لا وظيفية:** السطر ده هو الهدف **الأوضح** لأي mutation
  على «هل الـ retry بيحمل التوكن الجديد؟» — وتعطيله **بيسيب الـ spec أخضر** ⇒ **mutation
  كاذبة** (تقرير بيقول «الـ spec بيعضّ» وهو ما عضّش). الهدف الصحيح هو **`client.ts:65`**.
  مُثبَّت في جدول الـ mutation في `00-plan.md` عشان ما يُترَكش لاجتهاد لاحق.
- **الـ Fix المقترح:** حذف السطر 101 + تعليق يوضّح إن الـ store هو الناقل، **أو** إبقاؤه
  مع تعليق صريح إنه دفاع مكرَّر لا مصدر. **أي الاتنين تغيير سلوكي** ⇒ خارج نطاق R-1.
- 🔬 **الدليل (M0، `04-tester-report.md`):** حذف السطر 101 وتشغيل الـ suite ⇒ **4/4 خضراء،
  صفر سقوط**. الادّعاء «الهدف ده كاذب» **اتقاس ولم يُستنتَج** — ولو المختبر تبع حدسه بدل
  الجدول المُثبَّت كان **هيكتب إن MVT-1 «بيعضّ» وهو ما عضّش**.
- **Source:** Session R-1 / `00-plan.md` (اكتشاف أثناء التخطيط) + `04-tester-report.md` (M0).

### WEB-R1-FLUSH-001 — `flushMicrotasks(20)` رقم مُختار لا مُشتَق 🟢 LOW
- **الموقع:** `apps/web/src/lib/api/client.spec.ts` — الـ harness (`flushMicrotasks`).
- **المشكلة:** الدالة بتقدّم طابور الـ microtasks **بلا أي timer** (السلسلة كلها promise-only
  ⇒ حتمية بلا اعتماد على ساعة) — لكن الرقم **20** **مُختار بالتجربة لا مُشتَق** من طول سلسلة
  الـ promises الفعلية (`401 → interceptor → refresh → .then → retry → adapter → unwrap`).
- **الحالة:** كفى فعلياً — **صفر flake في 6 تشغيلات كاملة** (منها 4 تحت طفرات). لكن
  **غير مُثبَت**: لو زادت حلقة في السلسلة (interceptor جديد، أو `mapAuthError` بقى async)،
  الرقم يقصُر **بصمت** ⇒ الـ spec يسقط لسبب يبدو عشوائياً.
- 🔴 **القيمة الحقيقية للبند: تشخيصية.** لو ظهر flake في `client.spec.ts` مستقبلاً ⇒ **ده
  المرشَّح الأول للسبب**، قبل أي شك في `client.ts` نفسه.
- **الـ Fix المقترح:** اشتقاق الرقم من طول السلسلة، أو حلقة `while` بتـ drain لحد ما الطابور
  يهدأ (مع سقف أمان صريح)، بدل ثابت.
- **Source:** Session R-1 / `02-coder-report.md` (بند مُسلَّم #5) + `04-tester-report.md`
  (قُبل كمخاطرة قائمة مُعلَنة).

### WEB-R1-GAPS-001 — 3 فجوات تغطية جديدة في `client.ts` — **مرشَّحات لـ `R-2`** 🟡 MEDIUM
> **مقيسة لا مُفترَضة:** المختبر أكّد **صفر تغطية** للثلاثة بالقياس، لا بالقراءة.
> الثلاثة **خارج نطاق R-1** بنصّه (R-1 = الفرع الناجح فقط).

| # | الفجوة | الموقع | ليه بتهمّ |
|---|---|---|---|
| 1 | **فشل الـ refresh تحت تزاحم** — N طلب مستنيين refresh **مشترك** يفشل | `client.ts:58-70` + فرع الـ catch | هل الـ N كلهم بياخدوا **رفضاً نظيفاً**؟ `terminateSession` بيتنادى **N مرة** — idempotent **نظرياً، غير مقيس**. MVT-4 غطّى النجاح المشترك فقط |
| 2 | **استعادة الـ singleton بعد فشل** — 401 ⇒ refresh يفشل ⇒ 401 تانٍ لاحقاً: يقدر يـ refresh تاني؟ | `.finally` اللي بيصفّر `refreshInFlight` | لو `refreshInFlight` فضل معلّقاً بعد الفشل ⇒ **كل الجلسات اللاحقة في نفس الـ tab محرومة من الـ refresh بصمت**. غير مُختبَر إطلاقاً |
| 3 | **`error.config === undefined`** + header injection عبر `error.config` | فرع الـ retry (`config._retry`) | axios يقدر يرمي error **بلا `config`** ⇒ قراءة `config._retry` على undefined. **مُسجَّل أصلاً في `R-2`** — مُكرَّر هنا للاكتمال |
- **الإحالة:** الثلاثة **مرشَّحات مباشرة لـ `R-2`** (red-team على `client.ts`)، أو session
  تغطية قصيرة تالية. البند 3 **هو نفسه** المذكور في نص `R-2` — مش بند جديد.
- ⛔ **البند ده هو تفصيل «حدود الإغلاق» في R-1:** الـ session قفلت **الفروع السعيدة**؛ فروع
  الفشل تحت تزاحم **لسه بيضاء بالكامل**.
- **Source:** Session R-1 / `04-tester-report.md` («مناطق لسه محتاجة coverage» #1/#2/#3
  + جدول Security Tests).

### 📘 R-1/F-1 — درس إجرائي: **التنبّؤ بالـ mutation يكون على مستوى التأكيد لا الـ spec**
> **ملاحظة إجرائية للمخطط — ليست ticket تقنياً. لا كود يُكتب، لا فحص يُفتح.**

- **الواقعة:** الخطة تنبّأت إن الطفرة **M1** (`client.ts:65` — `setAccessToken`) هتُسقط
  **MVT-1 وحده**. الواقع: أسقطت **MVT-1 + MVT-4**.
- **التشخيص (وهو الجزء المهم):** المختبر **ما اكتفاش بتسجيل السقوط الجانبي** — فحص **أي
  تأكيد** بالظبط اللي سقط في MVT-4، فطلع **الرابع** (كل الـ retries المتزامنة حملت التوكن
  الجديد) بينما **التأكيد الأساسي — مكافحة الـ stampede — نجا سليماً**.
- 🔴 **الحكم: اقتران في نطاق التأكيدات، لا اقتران في المفاهيم.** والدليل الحاسم **M3**:
  كسر الـ singleton أسقط **MVT-4 وحده** ولم يمسّ MVT-1 ⇒ **لو المفهومان مقترنان فعلاً كان
  M3 لازم يسقّط الاتنين**. الحكم اتبنى على **قياس مقابل**، مش على تفسير.
- **القرار المتّخذ: عدم حذف التأكيد الرابع.** «كل الـ retries المتزامنة حملت التوكن الجديد»
  خاصية **أقوى** من نظيرتها في MVT-1 (طلب واحد) — هي اللي بتمنع «الأول بياخد الجديد والباقي
  بيتعادوا بالقديم». **حذف تغطية حقيقية إرضاءً لنظافة جدول الـ mutation = تضحية بالجوهر
  إرضاءً لمعيار إجرائي.** البديل الصحيح: **الاقتران يُعلَن**.
- 📌 **الدرس للـ sessions القادمة (يُقرأ مع القاعدتين #4 و #5ب):**
  1. **الـ mutation بتضرب التأكيدات، لا الأغراض.** أي جدول mutation في `00-plan.md` لازم
     يتنبّأ **بالتأكيد** المتوقَّع سقوطه، لا بالـ spec كوحدة — تصنيف الـ specs بـ «الغرض»
     بيولّد تنبّؤات لا تصمد.
  2. **سقوط جانبي ≠ فشل تلقائي في الـ specs.** يُفحَص لمستوى التأكيد قبل الحكم؛ الفرق بين
     «اقتران تأكيدات» (مقبول ومُعلَن) و«اقتران مفاهيم» (عيب حقيقي) **يُحسم بطفرة مقابلة**.
  3. **(درس M0 المرافق)** أي هدف mutation **مُدَّعى إنه «كاذب»** يُقاس **بشاهد سالب**، لا
     يُستنتَج من قراءة الكود — وإلا **بنستبدل ثقة بثقة**. ولما يكون فيه **مساران** بيوصّلوا
     نفس الأثر، الـ mutation على الأضعف بترجع خضراء وتُقرَأ كـ «مغطّى»: **تعدّد المسارات
     بيخلّي الـ mutation نفسها محتاجة شاهداً سالباً**.
- **Source:** Session R-1 / `04-tester-report.md` (F-1 + M0 + بنود مُسلَّمة #1 و #2).

---

## Updates log

- **2026-05-20:** Consolidated بعد Session 1.6 closure. User-confirmed list.
- **2026-05-20:** Ticket #1 (CVE-TEST-016) closed in Session 1.7 Quick mode.
- **2026-05-24:** Session 2 closure — 4 tickets أضيفوا لـ Session 1.8 (CHAT-FOLLOWUP-001, A1, PROJ-NOTE-002, A3). Rule #9 (NEEDS-CODER return cycle) أُضيفت لـ CLAUDE.md.
- **2026-05-24:** Session 1.8 Part 2 — CHAT-FOLLOWUP-001 + A1 + A3 + PROJ-NOTE-002 closed. 14 pre-existing failures documented (ENV-SPEC-001 + AUDIT-SPEC-001).
- **2026-06-28:** Session S1 (frontend auth backend-first) closure — APPROVED WITH NOTES. CVE-S1-001 closed inline (hacker). 7 residuals مسجّلين: WEB-S1-001 (🔴 client route-guard، S2-blocker) + WEB-S1-002..005 + WEB-CLEANUP-001 + WEB-TSC-001. MVT 5/5 passing (11/11 tests).
- **2026-07-02:** Session S2 (generic API client + React Query) closure — Standard + principal، APPROVED WITH NOTES. **WEB-S1-001 (S2-blocker) مقفول ومُختبَر end-to-end** (CVE-S1-002). MVT 3/3 على أعمق طبقة (16/16 tests). 4 residuals مضافين كـ **شروط لـ S3 (مش optional):** R-1 (refresh-success غير مُختبَر، S3-blocker قبل data ثقيلة) + R-2 (مفيش red-team على client.ts) + R-3 (RouteGuard يطرد على أي isError) + R-4 (WEB-STORE-001 phantom + setSession side-effect). WEB-STORE-001 + WEB-TSC-002 مسجّلين كـ pre-existing tsc errors.
- **2026-07-05:** Session S3 (Projects wiring: List 1.2 + Create 1.3 + Detail 1.4) closure — Standard mode + architect post-exec review، APPROVED (المختبر READY). المجموعة 1.2/1.3/1.4 = ✅ DONE في PAGE_WIRING_TRACKER. **MVT 5/5 passing** (12/12 tests، paired assertion على body الفعلي للـ POST + clientId، 28/28 suite، صفر regression، صفر خطأ tsc جديد). 4 residuals جديدة **(كلها LOW — مؤجّلات coverage/cleanup مش blockers):** WEB-S3-001 (guard render-test مؤجّل، مغطّى indirectly) + WEB-S3-002 (error-state render tests) + WEB-S3-003 (useClients spec + enum unification) + WEB-S3-004 (search/filters wiring → S5). **R-1..R-4 لسه مفتوحين** — S3 ما مسّش client.ts. R-1 = S7-blocker (payments). `payments/summary` على الـ Detail مؤجّل S7.
- **2026-07-13:** WEB-S4-P7-001 closed in `2026-07-12-web-s4-p7-reviews-picker/` (Quick mode). استُبدل mock الـ standalone `reviews/page.tsx` بمنتقي مشاريع حقيقي (`useProjects()` + loading/error/empty + status badges)، كل مشروع يـ link لـ `[id]?tab=reviews`؛ deep-link عبر query-param أحادي الاتجاه في `[id]/page.tsx` (`useSearchParams` → initial `detailTab`، بدون bidirectional sync). صفر خطأ tsc جديد فوق baseline (5)، 44/44 vitest passing، صفر `ReviewItem` mock. **باقي مفتوح:** badge عدّاد PENDING per-project (يحتاج endpoint خلفي) + bidirectional URL↔tab sync + search/filter wiring على المنتقي (WEB-S3-004).
- **2026-07-14:** Session Supabase-integration (Quick/operational) closure — ربط المشروع بـ Supabase حقيقي + seed ديمو + تشغيل backend/auth end-to-end. **أهم بند: FINDING-AUTH-ES256** — المشروع بيوقّع بـ ES256 (asymmetric) مش HS256؛ `jwt.strategy.ts` اتحوّل لتحقق JWKS/ES256 (مكتبة `jwks-rsa`). كمان: إكمال Prisma 7 driver-adapter (`@prisma/adapter-pg`) في `PrismaService` + seed، وتصحيح `.env` (SUPABASE_URL + session pooler 5432). Ticket #2 (runtime/library) **غالباً محلول ضمناً** (tsc build نظيف) — يُتحقَّق صراحةً لاحقاً. المفصّل فوق في قسم "Session 2026-07-14".
- **2026-07-16:** Session S7 (financial + BOQ، **جارية**) — **API-ROLES-001** مسجَّل أثناء المرحلة 3 بطلب المستخدم (خارج نطاق S7): `@Roles(...roles: string[])` غير مُقيَّد بالنوع ⇒ typo في اسم دور = صلاحية غلط بصمت، والـ tsc لا يمسكه. يُنفَّذ مع **A3** (نفس الجذر في `JwtPayload.role`). باقي بنود S7 تُضاف عند إقفال الـ session.
- **2026-08-03:** **Session S7 closure — Deep mode كامل (7 ملفات)، ⚠️ APPROVED WITH NOTES.** backend-only: 3 models + migration مُطبّقة على Supabase، 9 endpoints، module `finance` مستقل، توسيع `ensureProjectAccess` لـ ACCOUNTANT company-wide. **MVT 17/17 passing** (الميزانية رُفعت 8 → 12 من المخطط البعدي → 17 بعد الهاكر) — 66 حالة في 5 ملفات spec، 353/367 في الـ suite الكامل، **صفر regression**، tsc EXIT 0، والـ 14 الحمراء هي نفسها الـ baseline الموروث. **الهاكر: 8 ثغرات، 5 FIXED-BY-HACKER، صفر NEEDS-CODER، صفر CRITICAL/HIGH.**
  - **🏆 أول mutation check في المشروع** — تعطيل إصلاحين ⇒ سقوط الـ spec-ين المستهدَفين **وحدهما**. أول دليل تجريبي على **جودة** الـ specs لا كمّها. (الـ mutation غطّى 2 من 17 — التوسيع مطلوب، انظر القاعدة #5ب.)
  - **🔴 نتيجتان مستقلتان للمراجع الأعلى لم يرصدهما أي دور:** **P-1** (ثلاثة أرقام لقيمة المشروع بلا مصالحة + `contractValue` لا يدخل أي حساب) و**P-1b** (بند مُسلَّم باسم الهاكر مات بالصمت). **كلاهما وقع بين النطاقات لا داخلها** — واحد بين modules والآخر بين دورين.
  - **📘 تغييران دائمان في `CLAUDE.md`:** **القاعدة #10 (Explicit Handoff Closure)** — لا بند مُسلَّم يموت بالصمت، بجدول "البنود المُستلَمة" إلزامي في مقدمة تقرير الدور المستقبِل؛ و**إعادة صياغة القاعدة #5** لتوزيعها صراحةً (الهاكر على الكود / المختبر بالـ mutation على الـ specs) + **#5b** (بلا mutation ⇒ تغطية غير مُثبَتة).
  - **البنود المضافة:** 🔴 **S7-ROLES-GATE (HIGH، بوابتان قبل أي ربط frontend)** + **P-1** + CVE-S7-006 + **CVE-S7-007 (محسوم = خيار ب، ينفَّذ في جلسة الربط مع تحديث MVT-5)** + CVE-S7-008 + A-S7-1/3/4/5 + S7-MINOR (6 بنود) + 🔴 **TEST-BASELINE-001 (Quick mode مستقلة — الـ baseline الأحمر بقى دَيناً بوابياً لا اختبارياً)**. **API-ROLES-001 مرفوع MEDIUM → HIGH.**
  - **⛔ حاجب قائم:** **R-1** (refresh-success غير مُختبَر) يبقى شرطاً واجب إغلاقه **قبل** ربط `financial-summary` بالـ frontend — S7 ما مسّتش `client.ts`.
- **2026-08-07:** **Session S7-ROLES-GATE (أ+ب) closure — Quick mode، الشرط الملزم الأول من S7 مقفول.** الـ deliverable: `apps/api/src/modules/finance/finance-roles.matrix.spec.ts` (**56 حالة passing**، 6.2 ثانية، بلا DI/DB ⇒ صالح للـ CI) + `Roles = (...roles: UserRole[])` + `RolesGuard.getAllAndOverride<UserRole[]>` + تصحيح تعليق مضلِّل في `roles.guard.ts:4` (كان بيوصّي بأسماء **lowercase غير موجودة في الـ enum** — وصفة للثغرة نفسها اللي الـ session بتقفلها). **26 سطر تعديل إنتاجي، صفر تعديل على أي controller.**
  - **نتيجة الـ sweep:** `tsc` = **EXIT 0** ⇒ **صفر typo قائم في 68 استعمال عبر 12 controller**. و**«EXIT 0» وحده ما كانش دليلاً** — اتعملت **paired assertion على أداة التحقق نفسها** (قاعدة #4): حقن `'ACCOUNTENT'` ⇒ `TS2345 … not assignable to parameter of type 'UserRole'` **EXIT 2**، ثم الرجوع لـ EXIT 0.
  - **🏆 mutation check رغم إن Quick mode مايفرضهوش** (قاعدة #5ب = Standard/Deep) — لأن الملف **حارس أمني بيستبدل سكربتاً عابراً**، و«56 passing» رقم عن الكمّ وحده. **3 طفرات على 100% من الطبقات، صفر اقتران زائف.** الأهم: طفرة `CLIENT` على endpoint كتابة **مع تحديث الجدول معاها** عدّت من طبقة مقارنة الصفوف بالكامل وسقطت في **الثوابت الدلالية وحدها** ⇒ **دليل تجريبي إن الجدول يثبّت الحالة والثوابت تثبّت القاعدة، وإن جدولاً بلا ثوابت حارس ناقص.**
  - **🔴 تصحيح سجلّي — [A3] كان مقفولاً من 2026-05-24** (Session 1.8 Part 2)، **لم يُنفَّذ في هذه الـ session** (صفر كود — تحقق بالقراءة المباشرة قبل أي لمسة). ما اتشطبش عند مصدره فاستمر ظاهراً كبند مفتوح **وأُعيد إدراجه في بوابة ملزِمة**. **نمط P-1b مقلوباً: بند مُنفَّذ فضل حياً في السجل.** الدرس: **الإغلاق يُشطب عند مصدره، لا في الـ Updates log وحده.**
  - **⛔ الباقي مفتوح:** **البوابة (ج)** (HTTP integration tests — **حظر production على الـ 9 endpoints قائم بنصّه**) + **R-1** (حاجب مستقل قبل ربط `financial-summary`) + `CVE-S7-007` + `P-1` (بوابتهما جلسة الربط). **رفع حظر (أ)+(ب) لا يعني أن الربط صار مفتوحاً.**
  - **البنود المضافة:** ROLES-SPEC-001 (🟢 TypeError بدل assertion في فحص التكرار) + ROLES-POLICY-001 (🟡 الثوابت الدلالية = قرارات منتج مثبَّتة في spec، الفرملة مقصودة) + ROLES-MATRIX-002 (🟡 الـ 11 controller الباقية بلا specs جداول — الملف قالب جاهز، **بشرط حمل الطبقتين**).
- **2026-08-07 (لاحقاً في نفس اليوم):** **Session R-1 (refresh-success coverage) closure — Standard mode (4 ملفات)، ✅ APPROVED / المختبر READY.** الـ deliverable: `apps/web/src/lib/api/client.spec.ts` — **MVT 4/4 مكتوبة وpassing** (48/48 في الـ suite الكامل، 15 ملف، صفر regression)، **وصفر تعديل على أي ملف إنتاجي** (`git diff --stat -- client.ts` فارغ). **`R-1` مقفول ⇒ حجبه على ربط `financial-summary` مرفوع** (شُطب **عند مصدره** في قسم S2-residuals **وفي بوابة S7-ROLES-GATE** — تطبيقاً لدرس A3 المقلوب).
  - **🏆 mutation على 100% من الـ specs (4 عمليات، لا عيّنة ولا استنتاج بالقياس على الباقي)** — أول تغطية mutation كاملة في المشروع. M2 (`_retry`) و M3 (الـ singleton) **مطابقان للتنبّؤ بصفر سقوط جانبي**.
  - **🥇 M0 — شاهد سالب لم يكن في الخطة، وأهم نتيجة في الـ session:** الخطة **ادّعت** إن `client.ts:101` هدف mutation **كاذب**؛ المختبر **قاسه بدل ما يصدّقه** ⇒ حذف السطر = **4/4 خضراء**. **`WEB-S2-TOKENDUP-001` اتحوّل من استنتاج قراءة إلى نتيجة مقيسة.** الدرس: لما يبقى فيه **مساران** بيوصّلوا نفس الأثر، الـ mutation على الأضعف بترجع خضراء وتُقرَأ كـ «مغطّى» ⇒ **تعدّد المسارات بيخلّي الـ mutation نفسها محتاجة شاهداً سالباً.**
  - **🔴 F-1 — سقوط جانبي غير متنبَّأ به في M1، مُبلَّغ ومفحوص لدرجة الحكم:** M1 أسقط MVT-1 **+ MVT-4** بدل MVT-1 وحده. المختبر حدّد **أي تأكيد** سقط (الرابع، المساعد) وأثبت إن التأكيد الأساسي لـ MVT-4 **نجا**، ثم حسم الحكم **بقياس مقابل (M3)**: كسر الـ singleton أسقط MVT-4 **وحده** ⇒ **اقتران تأكيدات لا اقتران مفاهيم.** قرار: **عدم حذف التأكيد الرابع** — تغطية حقيقية لا تُضحَّى لنظافة جدول. **الخطأ كان في تنبّؤ الخطة لا في الـ specs.**
  - **✅ gap مُفترَض طلع غير موجود:** `_retry` propagation عبر `mergeConfig` **سليم في axios 1.15.0** — و MVT-2 (canary) بقى حارسه عند أي ترقية. والـ `LOOP:` guard **مُثبَت اشتغاله بـ probe مؤقت** (اتحذف بعد القياس) لا باستنتاج.
  - **البنود المضافة:** `WEB-S2-DBLMAP-001` (🟡 double-mapping بيمسح `code`/`message` الحقيقيين — **متطلَّب سابق لـ R-3**) + `WEB-S2-TOKENDUP-001` (🟢 مؤكَّد بـ M0) + `WEB-R1-FLUSH-001` (🟢 `flushMicrotasks(20)` غير مُشتَق — **المرشَّح الأول لأي flake**) + `WEB-R1-GAPS-001` (🟡 3 فجوات مقيسة: فشل refresh تحت تزاحم / استعادة الـ singleton بعد فشل / `error.config === undefined` — **مرشَّحات R-2**) + **درس F-1 الإجرائي** (التنبّؤ بالـ mutation **على مستوى التأكيد لا الـ spec**).
  - **📘 تغيير دائم في `.claude/skills/08-testing.md`:** قاعدة **snapshot-by-value** (من انحراف #1 للمبرمج) — كل تأكيد على «إيه اللي اتبعت» يُلتقَط **لحظة الإرسال**، لا يُقرأ من مرجع باقٍ بيتحوّر.
  - **⛔ الباقي مفتوح:** **`R-2` مفتوح بالكامل** — والحكم ✅ **لا يمتد له**. «48/48 خضراء» **لا تعني `client.ts` مُراجَع أمنياً**؛ تعني **فروعه الثلاثة السعيدة** محروسة. `R-3` (يحتاج DBLMAP-001 أولاً) + `R-4` + البوابة **(ج)** + `CVE-S7-007` + `P-1` على حالهم.
- **2026-07-12:** Session S4 (Updates workflow + Review Inbox + Phases: 1.5-1.7) closure — **Deep mode كامل (7 ملفات)**، APPROVED WITH NOTES. المجموعة 1.5/1.6/1.7 = ✅ DONE في PAGE_WIRING_TRACKER (8/8 مراحل بعد دورة NEEDS-CODER). **MVT 5/5 passing** (16/16 tests في 3 ملفات spec، paired byte-for-byte على الـ Idempotency-Key header + MVT-5 من الجهتين K1≠K2 و K2=K3، صفر خطأ tsc جديد). **CVE-S4-001** (LOW، reason-change 422-loop) مُصلَّح معمارياً — نقل الـ Idempotency holders لملكية الـ page بعد اكتشاف `keepMounted=false` (rule #9 NEEDS-CODER cycle أمسك العلّة). 3 residuals جديدة: **WEB-S4-P7-001** (reviews/page.tsx mock، 🟡 MEDIUM، **مُلزِم قبل production**) + **WEB-S4-SWAP-001** (non-atomic reorder swap، 🟡 MEDIUM) + WEB-S4-ERR-001 (generic error msg، 🟢 LOW). WEB-S1-004 بقى ضريبة متكرّرة (حجب render/lifecycle specs) — رفعه أولوية. **R-1..R-4 لسه مفتوحين** — S4 ما مسّش client.ts. R-1 = S7-blocker (payments).
