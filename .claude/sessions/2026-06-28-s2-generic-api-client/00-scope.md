# Scope — Session S2: Generic API Client + React Query Hooks

## Mode: Standard
السبب: feature متوسطة مترابطة (generic client + hooks + route-guard) فوق بنية تحتية موجودة جزئياً (QueryProvider منصوب لكن غير مستخدم) — مش security-critical refactoring واسع يستدعي Deep، ومش fix واحد محدود يكفيه Quick. 3 أدوار: 🧠 المخطط → 💻 المبرمج → 🧪 المختبر.

> 🔴 لو scope creep (مثلاً اتضح إن الـ refresh-on-401 يحتاج tenant/session redesign، أو الـ guard يكشف ثغرة معمارية) → نرفع لـ Deep صراحة، مش silently.

---

## المهمة
بناء طبقة data-access موحّدة في الـ frontend: (1) generic axios client بـ Bearer-attach + refresh-on-401 interceptor، (2) React Query hooks فوقه (يبدأ بـ `useMe`)، (3) **client route-guard للـ dashboard** يقفل CVE-S1-002 (WEB-S1-001، الـ S2-blocker) — يستدعي `/users/me` on mount ويطرد غير المصرّح له قبل أي data fetch.

الأولوية حسب طلب المستخدم: **WEB-S1-001 (route-guard) أولاً** — هو الـ blocker اللي يخلّي ربط data حقيقية آمن.

---

## الملفات المتأثرة

| الملف | النوع | السبب |
|------|------|-------|
| `apps/web/src/lib/api/client.ts` | ➕ جديد | generic axios instance + interceptors (Bearer attach + refresh-on-401 single-retry) — WEB-S1-003 |
| `apps/web/src/lib/api/refresh-policy.ts` | ➕ جديد (pure) | قرار «هل نـ retry بعد 401؟» معزول للـ MVT بدون HTTP mocks (مثل نمط S1 pure-first) |
| `apps/web/src/lib/hooks/use-me.ts` | ➕ جديد | `useMe()` React Query hook (GET `/users/me`) — أول استهلاك فعلي للـ QueryProvider الموجود |
| `apps/web/src/components/auth/route-guard.tsx` | ➕ جديد | client guard: useMe on mount → 401 ⇒ `clear()`+`clearAuthHint()`+redirect `/login`؛ يعرض children لو authenticated فقط — WEB-S1-001 |
| `apps/web/src/app/[locale]/dashboard/layout.tsx` | ✏️ تعديل | لفّ `DashboardLayoutWrapper` بالـ `RouteGuard` |
| `apps/web/src/lib/api/auth-client.ts` | ✏️ تعديل (محتمل) | إعادة استخدام/توحيد مع الـ generic client (يحدّده المخطط — قد يبقى منفصل للـ auth/* فقط) |
| `apps/web/vitest.config.ts` + `package.json` | ✏️ تعديل | test-infra: jsdom + RTL (+ MSW لو لزم) لتمكين MVT للـ guard/hooks — WEB-S1-004 (الحد الأدنى) |

---

## الوحدات + ميزانية التغطية (rule #6)
كل وحدة باسمها + coverage budget:
- **`refresh-policy.ts`** (pure) — **≥2 specs** (MVT الأساسي: 401 ⇒ retry-once؛ retry فشل ⇒ terminal).
- **`client.ts`** interceptors — **≥1 spec** أو deferred لـ MSW في WEB-S1-004 لو الـ infra مش كافية (المخطط يحسم).
- **`use-me.ts`** — **≥1 spec** (RTL + QueryClient wrapper) أو deferred-to-WEB-S1-004 صراحة.
- **`route-guard.tsx`** — **≥1 spec** (RTL: unauthenticated ⇒ redirect + clear) — **إجباري** لأنه الـ deliverable الأمني (CVE-S1-002).
- `auth-client.ts` — covered بالفعل (`map-auth-error.spec.ts`) + S1 specs؛ أي تعديل توحيد ⇒ regression check.

> الحد الأدنى الملزم (rule #2/#3): المخطط يحدّد العدد النهائي في `00-plan.md` قسم تعريف النجاح، على ألا يقل عن: refresh-policy (2) + route-guard (1).

---

## الـ Skills المستخدمة
- `CLAUDE.md` → Standard mode workflow + rules #1،#2،#3،#4،#6،#8.
- `BACKLOG.md` → WEB-S1-001 (الـ trigger/قاعدة «لا data قبل الـ guard») + WEB-S1-003 + WEB-S1-004.
- `apps/web/AGENTS.md` → **Next.js 16**: قبل تعديل `dashboard/layout.tsx` أو أي client component جديد، راجع `node_modules/next/dist/docs/`.
- `INTEGRATION_PLAN.md` → §2.5 (error handling) + §4 (client patterns + الأنواع) للـ refresh flow.
- Session S1 artifacts → `use-auth-store` (token/clear)، `auth-hint` (clearAuthHint)، `map-auth-error`، `auth-client` (refresh endpoint).

---

## الحدود (خارج نطاق هذا الـ session)
- ❌ ترحيل الـ features الموجودة (projects/finance/team…) لـ React Query — S2 يبني النمط + `useMe` فقط.
- ❌ WEB-S1-002 (CSP) — hardening مستقل.
- ❌ WEB-S1-005 (i18n لرسائل الـ backend) — مؤجّل.
- ❌ WEB-CLEANUP-001 (حذف `lib/supabase/*`) — cleanup مستقل.
- ❌ WEB-TSC-001 (إصلاح `cn`/dropdown) — خارج النطاق؛ `next build` يفضل محجوب بيه، الـ verification يعتمد tsc-isolation + `vitest` (نفس نهج S1).
- ❌ MSW الكامل لكل الـ endpoints — لو احتجناه نضيف الحد الأدنى للـ guard/hook فقط.

---

## تعريف النجاح (مبدئي — المخطط يفصّله)
- [ ] generic `client.ts` يربط Bearer من الـ store تلقائياً + refresh-on-401 single-retry.
- [ ] **RouteGuard يطرد المستخدم غير المصرّح من الـ dashboard** (401 ⇒ clear+clearAuthHint+redirect) — CVE-S1-002 مقفول.
- [ ] `useMe()` يجيب `/users/me` عبر الـ generic client.
- [ ] MVT ≥3 specs مكتوبة وpassing (refresh-policy ×2 + route-guard ×1 كحد أدنى).
- [ ] tsc: صفر أخطاء جديدة (الـ 2 pre-existing فقط).

---

⏸️ AWAITING APPROVAL — رد بـ "approve" للانتقال لدور 🧠 المخطط (`00-plan.md`)، أو "edit: [تعديل]".

✋ تم scope — للدور التالي؟
