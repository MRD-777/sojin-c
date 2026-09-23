# Scope — تشخيص بطء تحميل الـ Dashboard (7-8 دقائق)

## Mode: Standard
السبب: المشكلة اتفكّكت لـ **3 أسباب جذرية مستقلة** — واحد منهم bug حقيقي في
مسار فشل الـ auth (redirect loop) بيحتاج MVT + mutation، والتاني dev-server
tuning. ده أكبر من Quick (دور واحد / fix واحد) وأصغر من Deep (مفيش تغيير
في حدود الأمان نفسها — الـ gate باقي كما هو، إحنا بنصلّح liveness).

🔴 **شرط ترقية لـ Deep:** لو الإصلاح المقترح للـ RouteGuard انتهى بتغيير
**دلالة** البوابة (مين يعدّي ومين لأ) بدل توقيت الـ redirect فقط → نرفع
لـ Deep صراحةً قبل ما المبرمج يكتب سطر.

---

## ⚠️ ملاحظة على حالة الشغل
دي **مرحلة تشخيص فقط**. لم يُعدَّل أي ملف من ملفات المشروع. كل الأرقام تحت
مقيسة فعلياً على الجهاز دلوقتي (curl + netstat + Get-Process)، مش تقديرات.

---

## المهمة
تشخيص السبب الجذري لبطء تحميل الـ dashboard (7-8 دقائق) والمؤشرات المصاحبة
له من الـ Network tab (audit pending / login 401 / register 404 /
ERR_CONNECTION_REFUSED)، ثم الاتفاق على خطة إصلاح قبل تنفيذها.

---

## 📊 القياسات الفعلية (baseline — قبل أي إصلاح)

| القياس | الأمر | النتيجة |
|---|---|---|
| API health | `curl :4000/health` — **بداية الـ session** | `code=000` (connection refused) |
| API health | `curl :4000/health` — بعد ~4 دقائق | `200` في **4.3 ms** (uptime=245s ⇒ الـ API قام بعد بداية الفحص) |
| **API `/api/v1/audit-logs`** | `curl` بدون token | **401 في 4.7 ms** |
| `/en/dashboard` (cold) | `curl -b auth_hint=1` | **200 في 59.65 s** |
| `/en/dashboard` (warm) | نفس الطلب تاني | **200 في 0.41 s** |
| `/en/dashboard/audit` | محاولة 1 | **000 — timeout بعد 180 s** |
| `/en/dashboard/audit` | محاولة 2 (المفروض warm) | **000 — timeout بعد 180 s** |
| `/en/dashboard/audit` | محاولة 3 (بعد ~6 دقائق) | **000 — timeout بعد 40 s** |
| `/en/dashboard/team` | `curl` | **200 في 1.24 s** |
| `/en/dashboard/projects` | `curl` | **000 — timeout 45 s** |
| `/en/dashboard/finance` | `curl` | **000 — timeout 45 s** |
| `/en/dashboard/reports` | `curl` | **000 — timeout 45 s** |
| `/en/login` + `auth_hint=1` | `curl -D -` | **307 → `location: /en/dashboard`** في 9 ms |
| `/en/register` (بدون كوكي) | `curl` | **200** — لا يوجد 404 |
| `/register` (بدون locale) | `curl -D -` | **307 → `/ar/register`** |
| `POST :4000/api/v1/auth/register` | `curl -d '{}'` | **400** (validation) — الـ route **موجود**، مش 404 |
| **Next dev server (PID 15684)** | `Get-Process` عند بداية الفحص | **661 MB** |
| **Next dev server (PID 15684)** | بعد ~10 دقائق فحص | **4,166 MB / 781 s CPU** |
| ذاكرة الجهاز | `Win32_OperatingSystem` | 15.9 GB إجمالي — **3.1 GB فاضية** |

---

## 🎯 التشخيص — 3 أسباب جذرية (+ ملاحظتان)

### RC-1 🔴 CRITICAL — Redirect ping-pong بين `/dashboard` و `/login`
**مؤكَّد من الكود + مقيس نصفه بالـ curl. النصف التاني (السلوك الحي في
المتصفح) لسه محتاج تأكيد — مذكور صراحةً تحت في "المتبقي".**

الحلقة:

```
apps/web/src/components/auth/route-guard.tsx:28-30
  useEffect(() => { if (isError) router.replace("/login"); }, [isError, router]);
        │  isError = أي فشل لـ useMe — بما فيه فشل الشبكة
        ▼
apps/web/src/lib/auth/decide-redirect.ts:46
  if (isAuthPage && hasHint) return `/${locale}/dashboard`;
        │  auth_hint لسه موجود
        ▼
  رجعنا لـ /dashboard → RouteGuard يشتغل تاني → ...
```

**الـ root cause الدقيق** في `apps/web/src/lib/api/client.ts:89-113`:
الـ teardown (اللي بيمسح `auth_hint`) مربوط بـ **status 401 حصراً**:

```ts
const willRefresh = shouldRefresh({ status, ... });   // status === 401 فقط
if (willRefresh && config) { ... } 
if (status === 401) { terminateSession(); }           // ← الشرط الوحيد للمسح
```

في `refresh-policy.ts:32` → `return status === 401 && ...`، و الـ JSDoc
نفسه بيقول: **"undefined on network errors"**.

⇒ لما الـ API يبقى واقف (وده اللي حصل فعلاً — RC-3)، الـ status =
`undefined`، فـ `terminateSession()` **ما بيتنادش**، فـ `auth_hint` **بيفضل
موجود**، فالـ middleware بيرجّع المستخدم للـ dashboard كل مرة → لا نهاية.

الـ 401 الحقيقي بيكسر الحلقة (بيمسح الـ hint). **الفشل الشبكي والـ 5xx
هما اللي بيعلّقوها.** ده بالظبط الفرق بين "مسار النجاح" اللي اتقفل في R-1
و مسار الفشل اللي لسه مفتوح.

> **ربط بالمُلاحَظ:** ده يفسّر الـ "login بيرجع متكرر" — كل دورة في الحلقة
> بتولّد request لـ `/en/login` بيرد **307**. لو اللي في الـ Network tab
> فعلاً `401` مش `307`، فده بند تاني ومحتاج الـ URL بالظبط (شوف "المتبقي").

---

### RC-2 🔴 CRITICAL — الـ Next dev server بيتخنق (4.2 GB وطالع)
مش بطء compile عادي — **hang حقيقي**:
- `/en/dashboard/audit` عمل timeout **مرتين على 180 s** + مرة على 40 s.
  الطلب التاني كان المفروض warm ⇒ **الـ compile مش بيخلص أصلاً**.
- `/en/dashboard/{projects,finance,reports}` نفس السلوك.
- `/en/dashboard/team` رد في **1.24 s** (كان compiled من قبل) ⇒ السيرفر حي،
  بس مش قادر يـ compile حاجة جديدة.
- الـ process من **661 MB → 4,166 MB** أثناء الفحص، مع **3.1 GB فاضية بس**
  على الجهاز ⇒ GC thrashing / memory pressure.

**العلاقة بين RC-1 و RC-2 (الأهم):** الاتنين بيغذّوا بعض. الـ redirect loop
بيقصف الـ dev server بـ navigations متتالية، والـ dev server المخنوق بيخلي
كل navigation تاخد عشرات الثواني → **حلقة موت**. ده اللي بيحوّل مشكلة
"صفحة بطيئة" لـ **7-8 دقائق**.

---

### RC-3 🟡 HIGH — الـ API كان واقف (سبب الـ ERR_CONNECTION_REFUSED)
عند بداية الفحص مفيش listener على :4000 (`netstat` فاضي، `curl` → `000`).
قام بعد كده لوحده (uptime 245s وقت القياس) — على الأرجح `turbo run dev`
شغّله متأخر أو الـ nest watch عمل restart.

ده **الزناد** اللي بيولّع RC-1: طول ما الـ API واقف، كل `/users/me` بيرجع
network error → `auth_hint` ما بيتمسحش → الحلقة تشتغل.

---

### ✅ NOT-A-CAUSE-1 — الـ audit endpoint بريء تماماً
- `GET /api/v1/audit-logs` بيرد في **4.7 ms**.
- `apps/web/src/app/[locale]/dashboard/audit/page.tsx` — **mock data 100%**،
  مفيش ولا استدعاء API فيه (اتأكدنا بـ grep على كل `apps/web/src`:
  الاستخدام الوحيد لكلمة audit خارج الصفحة هو link في `config/navigation.ts:83`).
- `apps/web/src/app/[locale]/dashboard/page.tsx` — **mock data 100%** كمان.

⇒ الـ "audit" الواقف Pending في الـ Network tab هو **طلب صفحة/RSC prefetch**
لـ `/[locale]/dashboard/audit` (من `next/link` في الـ sidebar)، **مش**
استدعاء لـ `/api/v1/audit-logs`. مفيش infinite retry loop ولا `useEffect`
غلط في الصفحة — الصفحة أصلاً مفيهاش أي fetch.

### ❓ NOT-REPRODUCED-1 — الـ 404 بتاع "register"
كل الاحتمالات اتجربت ومفيش 404:
`/en/register` → 200 · `/register` → 307 → `/ar/register` ·
`POST /api/v1/auth/register` → 400 (الـ route موجود في
`auth.controller.ts:69`) · الـ RSC prefetch → 200.
**محتاج الـ Request URL الكامل من الـ Network tab.**

---

## الملفات المتأثرة (المتوقَّعة — للتأكيد في الـ plan)
- `apps/web/src/lib/api/client.ts` — توسيع الـ terminal teardown ليشمل الفشل
  غير الـ 401 (network / 5xx). **قلب RC-1.**
- `apps/web/src/lib/api/refresh-policy.ts` — احتمال إضافة قرار نقي منفصل
  لـ "هل ده فشل terminal؟" بدل ربط كل حاجة بـ 401.
- `apps/web/src/components/auth/route-guard.tsx` — منع الـ redirect لما الـ
  hint لسه موجود ومفيش يقين إن الجلسة ماتت (تمييز "الـ API واقف" عن "مش مصرح").
- `apps/web/src/lib/auth/decide-redirect.ts` — قراءة فقط على الأرجح؛ أي تعديل
  هنا = مؤشر ترقية لـ Deep.
- `apps/web/next.config.ts` / dev workflow — RC-2 (memory headroom / تقليل
  الـ prefetch في dev). **لا تعديل على منطق الإنتاج.**
- `apps/api` — **لا تعديل كود**. RC-3 تشغيلي (نتأكد إن :4000 قايم).

## الـ Services المذكورة صراحةً + ميزانية التغطية (قاعدة #6)
| الوحدة | التغطية |
|---|---|
| `client.ts` (response interceptor) | **≥2 specs** — network error + 5xx ⇒ teardown يحصل |
| `refresh-policy.ts` | **≥1 spec** — القرار الجديد للفشل الـ terminal |
| `route-guard.tsx` | **≥1 spec** — مفيش redirect والـ hint لسه موجود بدون يقين |
| `decide-redirect.ts` | موجود له spec — **regression فقط**، مفيش سلوك جديد |
| `AuditController` (api) | **deferred** — بريء، خارج النطاق |

## الحدود (خارج نطاق الـ session)
- ربط صفحة audit بالـ API الحقيقي (لسه mock) — session تانية.
- أي تعديل على `apps/api`.
- الـ 404 بتاع register — **موقوف لحد ما يوصل الـ URL**.
- تحسين زمن الـ production build (المشكلة dev-only).

## تعريف النجاح
- [ ] RC-1 مقفول: فشل شبكة على `/users/me` ⇒ **لا ping-pong** (مثبت بـ spec)
- [ ] RC-2 مخفَّف: `/en/dashboard/audit` بيرد في وقت محدود بدل timeout
- [ ] RC-3: :4000 قايم ومتحقَّق منه قبل القياس
- [ ] قياس **بعد** الإصلاح بنفس أوامر الـ baseline فوق، جنب أرقام الـ baseline
- [ ] **MVT: 4 specs مكتوبة وpassing** (يقرّها المخطط في `00-plan.md`)
- [ ] **Mutation على spec الـ RC-1** (قاعدة #5ب/#5b) — نعطّل الإصلاح، الـ spec
      لازم يسقط هو وحده

---

## بنود مُسلَّمة — تحتاج إغلاقاً صريحاً (قاعدة #10)
| # | البند | الدور المستهدَف |
|---|---|---|
| 1 | تأكيد الحلقة **حياً** في المتصفح (لسه code-confirmed بس) قبل ما نقيس النجاح | 🧪 المختبر |
| 2 | قرار: هل الـ teardown يتوسّع في `client.ts` ولا في `refresh-policy.ts`؟ | 🧠 المخطط |
| 3 | RC-2: هل الحل ضبط dev-server ولا `.next` cache reset ولا الاتنين؟ | 🧠 المخطط |
| 4 | الـ 404 بتاع register — لا يُقفل بالصمت؛ يا يتأكد يا يتوثّق كـ غير قابل لإعادة الإنتاج | 🧠 المخطط |

---

⏸️ AWAITING APPROVAL — رد بـ "approve" للانتقال للمخطط، أو "edit: [تعديل]".
