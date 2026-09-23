# تقرير المختبر

> الميزانية المعتمدة: **7 specs + mutation 3/7** (المخطط §5، بعد رفعها من 5).
> المنفَّذ: **7 specs + mutation 4/7**. الزيادة مبرَّرة في §الـ Mutation.

---

## البنود المُستلَمة (قاعدة #10)

| # | البند | المصدر | الحالة |
|---|---|---|---|
| 1 | **MVT = 7** (مش 5)، و**MVT-6/7 زوج إلزامي** — 6 لوحده غير مقبول | المخطط #3 | **قُبل ونُفِّذ.** 7/7 مكتوبة وخضراء. الزوج مكتوب في نفس الملف تحت عنوان واحد، والمُحفِّز فيهم **متطابق ما عدا الـ status** — وده اللي بيخلّي الزوج يعزل الفارق بدل ما يوصفه |
| 2 | **mutation 3/7 مُعلَنة** + الباقي يتنقل كـ "تغطية غير مُثبَتة" | المخطط #4 | **قُبل — ونُفِّذ 4/7.** المُثبَت: MVT-3 · 5 · 6 · 7. **غير المُثبَت صراحةً: MVT-1 · 2 · 4** (§الـ Mutation، البند الأخير) |
| 3 | **التأكيد الحي على `npm run dev`** مش الـ `npx` المؤقت | المخطط #5 / الـ scope #1 | **قُبل ونُفِّذ حرفياً** — `npm run dev` من جذر الـ repo (turbo → `next dev --turbopack`). §التأكيد الحي |
| 4 | `SessionUnavailable` محتاج `NextIntlClientProvider` في أي spec بيـ mount-ه | المخطط #6 | **قُبل — ومؤكَّد.** بدونه MVT-5 كان بيسقط على `useTranslations` throw. الـ provider بيستخدم **`messages/en.json` الحقيقي** لا stub — الـ stub كان هيفضل أخضر بعد حذف المفاتيح من الكتالوج والشاشة تشحن مكسورة |
| 5 | **هل فيه specs تانية بتـ mock فشل `authClient` بشكل مستحيل في production؟** | المبرمج #4 | **قُبل — واتعمل audit كامل. الجواب: لا، ولا واحد.** §Audit تحت |
| 6 | MVT-6/7 يبنوا الرفض بـ `mapAuthError` الحقيقية مش object literal | المبرمج #5 | **قُبل ونُفِّذ** — `client.session-liveness.spec.ts:201,254` |
| 7 | انحرافات (د) و(هـ) | المبرمج #1،#2 | **مُغلَقة قبل دوري** — approve صريح من المستخدم. لا إجراء عليّ |

---

## إحصائيات

- **MVT المطلوب: 7 / المكتوب: 7** ✅
- Tests written (جديدة في الدور ده): **3 specs** موزّعة على 7 بنود MVT
  (spec واحد بيغطي بند واحد ما عدا MVT-2 = جدول 9 صفوف + invariant على المجموعة)
- **Tests passing: 55 / 55** · **failing: 0** · Test Files: 16/16
- الـ suite قبل دوري: 48 ⇒ بعده: **55** (+7)
- **Mutation: 4 من 7 مُعلَنة** (المطلوب 3)
- **Coverage %: غير مقيس** — `@vitest/coverage-v8` **مش متثبّت** في الـ repo.
  ⚠️ ما اتثبّتش عمداً: تثبيت dependency تحت دور المختبر خارج نطاق الـ session.
  التغطية موصوفة بالـ MVT + الـ mutation بدل رقم غير موجود.

### الملفات

| الملف | الحالة |
|---|---|
| `refresh-policy.spec.ts` | **+2 specs** (MVT-1، MVT-2) — الـ 4 القديمة **ما اتلمستش ولا حرف** |
| `client.session-liveness.spec.ts` | **ملف جديد** (jsdom) — MVT-3، 4، 6، 7 |
| `route-guard.spec.tsx` | **+1 spec** (MVT-5) + الـ provider في الـ helper. الـ spec القديم: **صفر تعديل في assertions** |

---

## الـ MVT — بند بند

| # | البند | الـ assertion الأعمق (قاعدة #4) | النتيجة |
|---|---|---|---|
| 1 | `status: undefined` ⇒ `indeterminate` | **مقرون على نفس المُدخَل:** `shouldRefresh` لسه `false` — الحالة الجديدة ما اتعملتش بتوسيع فرع الـ refresh (يعني مش بنقصف شبكة ميتة بـ `/auth/refresh`) | ✅ |
| 2 | المجال كله: 500/502/429/403/404/undefined ⇒ `indeterminate` · 401 fresh ⇒ `refresh` · 401+retried / 401+isRefreshCall ⇒ `terminal` | **على المجموعة لا الصفوف:** عدد الـ `terminal` = **2 بالظبط**، وكلاهما `status === 401`. تعديل مستقبلي يخلّي 500 أو 429 terminal بيقلب العدّاد **حتى لو حدّث صفّه** | ✅ |
| 3 | فشل شبكة على `/users/me` ⇒ **الجلسة تنجو** | `accessToken === OLD` **و** `user` مطابق **و** `document.cookie` لسه فيه `auth_hint=1` (الكوكي نفسه — مُدخَل الـ middleware، مش spy على `clearAuthHint`) **و** الرفض `code:"NETWORK"` + `indeterminate` **و** `refresh` **ما اتنادتش أصلاً** | ✅ |
| 4 | 401 بعد استهلاك الـ retry ⇒ **الجلسة تتمسح** (control لـ 3) | `accessToken === null` **بعد** ما كان `NEW` (فالـ null إثبات مسح لا غياب) **و** `user === null` **و** `auth_hint` **اتشال فعلاً من الكوكي** **و** الـ transport اتنادى **مرتين بالظبط** | ✅ |
| 5 | **قاتل الحلقة عند الـ Guard:** API مش موصول ⇒ **مفيش تنقل** | **الرجلين على مُحفِّز واحد:** `replace` **ما اتنادتش ولا مرة** (رجل الـ Guard) **و** `auth_hint` سليم في `document.cookie` (رجل الـ middleware — الخلاف بينهم *هو* الحلقة) **+** الجلسة سليمة في الـ store **+** زراري Retry/SignIn ظاهرين **+** `protected` مش في الـ DOM | ✅ |
| 6 | الـ refresh يفشل بـ **429** (envelope كامل) ⇒ **الجلسة تنجو** | `code === "TOO_MANY_REQUESTS"` **و** الرسالة العربية الأصلية **و** `status === 429` **و** `code !== "UNKNOWN"` صراحةً (← ده اللي بيقتل §2ب) **و** الجلسة + الكوكي سليمين **و** الـ transport اتنادى **مرة واحدة** (مفيش retry بعد refresh فاشل) | ✅ |
| 7 | الـ refresh يفشل بـ **401** ⇒ **terminal** (control لـ 6) | `code === "UNAUTHORIZED"` محفوظ **و** `status === 401` **و** `terminal` **و** `accessToken === null` **و** `auth_hint` اتشال من الكوكي | ✅ |

### ليه ملف jsdom جديد (تنفيذ نص الخطة)
تحت `node` مفيش `document` ⇒ `clearAuthHint` **no-op** (`auth-hint.ts:38`) ⇒ أي spy عليه
بيأكّد نداء **ما بيغيّرش حاجة**. الكوكي مش تفصيلة: هو **المُدخَل اللي الـ middleware بيقراه**،
يعني الرجل التانية للحلقة. فكل ادعاء teardown/نجاة فوق متقاس على `document.cookie` نفسه،
والـ hint متزروع بـ `setAuthHint()` **الحقيقية** لا سطر مكتوب باليد.

---

## الـ Mutation (قاعدة #5ب) — **4 من 7، مُعلَنة**

> الحد الأدنى الإلزامي = كل spec بيحرس CVE + أخطر spec. الأربعة المُثبَتين
> **هم بالظبط اللي بيحرسوا الحلقة و§2ب**. الرابعة (D) زيادة على ميزانية المخطط،
> والسبب إن §2ب (double-mapping) كان **بند اكتشفه المخطط بنفسه** ولو فضل بلا
> mutation يبقى قفلناه بـ spec **بيوصف** مش بيعضّ.

### (A) MVT-5 — `route-guard.tsx`: `sessionIsDead = isError` (رجوع للسلوك القديم)

```
FAIL  src/components/auth/route-guard.spec.tsx > RouteGuard (indeterminate — API unreachable) > API unreachable ⇒ NO navigation, session + hint intact, retry UI shown, children hidden
TestingLibraryElementError: Unable to find role="heading" and name "Can't reach the server"

 Test Files  1 failed | 15 passed (16)
      Tests  1 failed | 54 passed (55)
```
⇒ **MVT-5 وحده سقط.** صفر سقوط جانبي. ✅ مطابق للمتوقَّع.

### (B) MVT-3 — `client.ts`: `if (disposition === "indeterminate") terminateSession();`

```
FAIL  src/components/auth/route-guard.spec.tsx > ... > API unreachable ⇒ NO navigation, session + hint intact, ...
FAIL  src/lib/api/client.session-liveness.spec.ts > client — session liveness on failure > network failure on a protected call ⇒ session SURVIVES intact (no teardown, no refresh attempt)
     → expected null to be 'OLD_TOKEN' // Object.is equality
     → expected '' to contain 'auth_hint=1'

 Test Files  2 failed | 14 passed (16)
      Tests  2 failed | 53 passed (55)
```
⚠️ **سقوط جانبي: MVT-5 وقع مع MVT-3.** المتوقَّع في الخطة كان "MVT-3 وحده".
**تقييمي: ده اقتران حقيقي لا زائف — ويُنقَل للمراجع كما هو، لا كنجاح.**

- الطفرة بتمسح الجلسة على **نفس** فشل الشبكة اللي MVT-5 بيقوده. MVT-5 بيؤكّد
  `auth_hint` باقي؛ الطفرة بتشيله. فسقوطه **نتيجة سلوكية صحيحة**، مش تسريب mock.
- ودي مش صدفة تنظيمية: MVT-3 و MVT-5 بيؤكّدوا **نفس الحقيقة عند طبقتين**
  (client / guard). ده **مقصود** — الحلقة بنيت من اختلافهما.
- 🔴 **لكن الثمن حقيقي:** الاقتران معناه إن MVT-5 **مش عازل** لطبقة الـ Guard وحدها.
  لو الـ teardown اتكسر في الـ client، هيسقط spec-ين والرسالة هتوجّه لمكانين.
  مُسجَّل، غير مُصلَح — إصلاحه يحتاج stub للـ client في MVT-5، وده **بيضحّي**
  بأهم خاصية فيه (إنه بيقود السلسلة الحقيقية).

### (C) MVT-6 — `client.ts` catch: `terminateSession()` غير مشروط (سلوك ما قبل 2د)

```
FAIL  src/lib/api/client.session-liveness.spec.ts > ... > refresh fails with 429 (full envelope) ⇒ session SURVIVES, and the real code/message reach the caller
     → expected null to be 'OLD_TOKEN' // Object.is equality

 Test Files  1 failed | 15 passed (16)
      Tests  1 failed | 54 passed (55)
```
⇒ **MVT-6 وحده سقط، و MVT-7 فضل أخضر.** ✅ مطابق لتوقّع المخطط بالحرف.
ودي **الشهادة الأهم في التقرير**: الزوج بيميّز فعلاً على **الـ status**، لا على
"أي فشل refresh". يعني الحقل اللي 2د ضافته **مقروء ومُستهلَك**، مش موجود بس.

### (D) MVT-6+7 — الـ double-mapping (§2ب): `rejectWith(refreshError, …)` بدل `rejectMapped`

```
     → expected { code: 'UNKNOWN', …(3) } to match object { code: 'TOO_MANY_REQUESTS', …(2) }
     → expected { code: 'UNAUTHORIZED', …(2) }  ← فعلياً: { code: 'UNKNOWN', …(3) }
 Test Files  1 failed | 15 passed (16)
      Tests  2 failed | 53 passed (55)
```
⇒ الاتنين سقطوا **على تأكيد الـ `code` بالتحديد**، والـ teardown في MVT-7 فضل شغّال
(التصنيف بيقرا `mapped.status` قبل الرفض) — يعني الطفرة عزلت **الضرر الحقيقي** لـ §2ب:
الجلسة بتتقرّر صح والمستخدم بيتقاله "خطأ غير متوقع". **§2ب مُثبَت مُغلَقاً.**

### الـ 3 الباقيين — **تغطية غير مُثبَتة** (قاعدة #5b)

| Spec | الحالة |
|---|---|
| **MVT-1** | ✅ passing · ❌ **بلا mutation** |
| **MVT-2** | ✅ passing · ❌ **بلا mutation** |
| **MVT-4** | ✅ passing · ❌ **بلا mutation** — وهو **control** لـ MVT-3، فكونه غير مُثبَت معناه إن "الـ teardown لسه بيشتغل" مؤكَّد بـ spec أخضر لا بطفرة |

**بينقلوا للمراجع الأعلى بالوصف ده حرفياً: خضارهم بيقول إنهم موجودون، لا إنهم يعضّون.**

### تحقّق من نظافة الـ mutations
```
 apps/web/src/components/auth/route-guard.tsx | 110 +++++++++++++++++++++++++--
 apps/web/src/lib/api/client.ts               |  94 +++++++++++++++++----
```
مطابق **رقماً برقم** لِـ `git diff --stat` المنسوخ في `02-coder-report.md` قبل الطفرات
⇒ الأربع طفرات اترجعت بالكامل، صفر بقايا.

---

## Audit — البند المُسلَّم #5 من المبرمج: مُحفِّزات مستحيلة في specs تانية؟

**الجواب: لا يوجد غيره.** الفحص شمل كل ملفات الـ spec:

| الملف | يلمس `authClient`؟ | شكل الرفض |
|---|---|---|
| `route-guard.spec.tsx` | ✅ `mockRejectedValue` | مبني بـ **`mapAuthError` حقيقية** (اتصلّح في 2د) + الجديد `spyOn` بلا mock (للتأكيد إنها ما اتنادتش) |
| `client.session-liveness.spec.ts` | ✅ | مبني بـ **`mapAuthError` حقيقية** ×2 |
| `client.spec.ts` | ✅ | **`mockResolvedValue` فقط** — والشكل `{ accessToken }` هو نفسه `RefreshResponse`. مفيش رفض مُخترَع |
| باقي الـ 13 ملف | ❌ | بيـ mock الـ transport (adapter) لا الـ `authClient` — فالـ `mapAuthError` الحقيقية بتشتغل عليهم أصلاً |

> **الدرس المعمم (للمراجع):** الشكل الخطر مش "mock" — هو **mock لطبقة بتـ normalize**
> بقيمة الطبقة دي **عمرها ما بتنتجها**. `authClient` بيرمي `mapAuthError(e)` **حصراً**،
> فأي رفض في spec لازم يعدّي من نفس الدالة. ده قيد قابل للفحص آلياً لو اتحوّل لـ lint rule.

---

## التأكيد الحي في المتصفح — البند المُسلَّم #5 (المخطط) / #1 (الـ scope)

**التشغيل: `npm run dev` من جذر الـ repo** — الشكل اللي المستخدم بيشغّله فعلاً:

```
> turbo run dev
web:dev: ▲ Next.js 16.2.3 (Turbopack)
web:dev: - Local:  http://localhost:3000
web:dev: ✓ Ready in 12.8s
```
**الـ API واقف** (`:4000` مش listening) — وده **بالظبط RC-3**، زناد الحلقة الأصلي.
المُحفِّز مش مُصطنَع: هو الحالة اللي المشكلة اتكشفت فيها.

### السيناريو
`auth_hint=1` مزروع على الـ origin (كوكي UX قابل للتزوير بالتصميم) ⇒ فتح `/en/dashboard`.

### النتيجة — مقروءة من الصفحة نفسها (Resource Timing + DOM + cookie)
```json
{"path":"/en/dashboard","apiCalls":["/api/v1/users/me"],"refreshCalls":0,
 "navEntries":["http://localhost:3000/en/dashboard"],"hintStillSet":true,
 "retryScreen":"Can't reach the server"}
```

| المعيار | المتوقَّع | المقيس | |
|---|---|---|---|
| **ping-pong في الـ Network** | صفر | **navigation entries = 1**؛ ولا طلب واحد لـ `/en/login` في الـ 47 طلب المسجَّلين | ✅ |
| نداءات `/users/me` | 1 | **1** | ✅ |
| نداءات `/auth/refresh` | **0** (فشل شبكة مش 401) | **0** | ✅ |
| الـ URL بعد الاستقرار | `/en/dashboard` | `/en/dashboard` | ✅ |
| `auth_hint` | باقي | **باقي** | ✅ |
| شاشة الـ retry | ظاهرة | **"Can't reach the server"** + الزرارين | ✅ |

**وبعد ضغط "Try again" فعلياً:**
```json
{"path":"/en/dashboard","apiCalls":2,"refreshCalls":0,"navEntries":1,
 "hintStillSet":true,"retryScreen":"Can't reach the server"}
```
⇒ محاولة واحدة إضافية بالظبط، **بلا تنقّل، بلا refresh، بلا teardown**.
الـ retry **مقيَّد ومقصود**، مش حلقة جديدة بواجهة.

📸 لقطة: `C:\Users\mohamed\AppData\Local\Temp\claude-chrome-screenshots-2GmMMO\screenshot-1788107013199-0.jpg`

> **حالة البيئة:** الـ dev server **لسه شغّال** في الخلفية (بدأته أنا لأجل البند ده).
> إيقافه محتاج قتل **شجرة** الـ process (`DEV-HYGIENE-001`) — متروك للمستخدم عمداً.

---

## 🔴 Bug اتكشف أثناء التأكيد الحي — خارج نطاق الـ session

### `(auth)` route group بالكامل بيرجّع **404** في الـ dev tree الحالي

| المسار | الحالة |
|---|---|
| `/en/login` · `/ar/login` | **404** |
| `/en/register` | **404** |
| `/en/setup-workspace` | **404** |
| `/en/about` · `/en/pricing` (أشقّاء **برّه** الـ group) | 200 |
| `/en/dashboard` (+hint) | 200 |

من لوج الـ dev server (`npm run dev`):
```
GET /en/login 404 in 88ms (next.js: 16ms, proxy.ts: 6ms, application-code: 66ms)
GET /ar/login 404 in 60ms
GET /en/register 404 in 60ms
GET /en/setup-workspace 404 in 69ms
```
الملفات موجودة: `src/app/[locale]/(auth)/{login,register,setup-workspace}/page.tsx`.

**ثلاث نتائج، بترتيب الأهمية:**

1. 🔴 **البند #9 (الـ 404 بتاع register) — REPRODUCED، ويُغلَق كـ NOT-REPRODUCED لا.**
   البند كان مستنّي URL من المستخدم. المشكلة **مش في register**: الـ **group كله**
   ساقط. النطاق أوسع من الوصف الأصلي.
2. ⚠️ **مسار الـ redirect الشرعي بيهبط على 404.** `/en/dashboard` بدون hint ⇒ **307**
   ⇒ `/en/login` ⇒ **404**. يعني الـ teardown الصحيح (401 مُثبَت) بينقل المستخدم
   لصفحة غير موجودة. **ده ما بيبطّلش أي نتيجة من نتائج الـ session** — MVT-4/7 بيقيسوا
   الـ teardown، و MVT-5 بيقيس عدم التنقّل — لكنه **بيمنع التأكيد الحي للمسار المقابل**
   (401 ⇒ redirect) على متصفح حقيقي.
3. ✅ **الحلقة نفسها مقفولة برغمه** — بل إن 404 على `/login` كان **هيغذّي** الحلقة القديمة.

**قِدَم:** pre-existing بدرجة عالية من الترجيح — الـ session ما لمستش routing ولا
`next-intl` ولا الـ `(auth)` group (مؤكَّد من `git diff --stat`: 8 ملفات، ولا واحد منهم في المسار ده).
**لم أشخّصه ولم أصلحه — خارج دوري وخارج نطاق الـ session.** 🔴 قبل أي إصلاح:
`apps/web/AGENTS.md` بيفرض قراءة `node_modules/next/dist/docs/` — ولاحظ إن اللوج
بيسمّي الـ middleware **`proxy.ts`**، وده يمس `NEXT16-001` مباشرةً.

---

## Regression

| المنطقة | النتيجة |
|---|---|
| الـ 4 specs القديمة في `refresh-policy.spec.ts` | ✅ **passing بلا تعديل** — شرط صريح في الخطة ومُستوفى بعد المرحلتين |
| `client.spec.ts` (R-1، 4 specs) | ✅ passing — مسارات الـ refresh الناجح ما اتأثرتش |
| `map-auth-error.spec.ts` (3) | ✅ passing — الحقل الجديد اختياري |
| `decide-redirect.spec.ts` (4) | ✅ passing — الملف ما اتلمسش (control معماري) |
| باقي الـ suite (24 spec) | ✅ passing |

### `npx vitest run` (literal — قاعدة #8)
```
 RUN  v3.2.6 D:/tampalets/saas-one/apps/web

 ✓ src/lib/api/refresh-policy.spec.ts (6 tests) 7ms
 ✓ src/lib/api/idempotency-key.spec.ts (9 tests) 10ms
 ✓ src/lib/projects/map-form-to-create-input.spec.ts (5 tests) 4ms
 ✓ src/lib/auth/register-payload.spec.ts (2 tests) 4ms
 ✓ src/lib/auth/decide-redirect.spec.ts (4 tests) 3ms
 ✓ src/store/use-auth-store.spec.ts (2 tests) 3ms
 ✓ src/lib/api/map-auth-error.spec.ts (3 tests) 3ms
 ✓ src/lib/api/client.spec.ts (4 tests) 12ms
 ✓ src/lib/api/projects-client.spec.ts (3 tests) 10ms
 ✓ src/lib/api/updates-client.spec.ts (5 tests) 14ms
 ✓ src/lib/api/phases-client.spec.ts (2 tests) 10ms
 ✓ src/lib/api/client.session-liveness.spec.ts (4 tests) 24ms
 ✓ src/lib/hooks/use-projects.spec.tsx (1 test) 114ms
 ✓ src/lib/hooks/use-create-project.spec.tsx (1 test) 111ms
 ✓ src/lib/hooks/use-project.spec.tsx (2 tests) 117ms
 ✓ src/components/auth/route-guard.spec.tsx (2 tests) 143ms

 Test Files  16 passed (16)
      Tests  55 passed (55)
   Start at  19:25:44
   Duration  16.05s (transform 2.81s, setup 26.16s, collect 26.76s, tests 590ms, environment 56.11s, prepare 5.88s)
```

### `npx tsc --noEmit` (literal)
```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ accessToken: null; user: null; pendingRegistration: null; setSession: ({ accessToken, user }: { accessToken: string; user: AuthUser; }) => void; setAccessToken: (accessToken: string) => void; setPendingRegistration: (pendingRegistration: PendingRegistration) => void; clearPendingRegistration: () => void; clear: ()...' but required in type 'AuthState'.
TSC_EXIT=2
```
⇒ **نفس الـ 5 أخطاء الـ pre-existing حرفياً، صفر جديد** — الـ 3 ملفات الجديدة/المعدَّلة
نضيفة نوعياً (بما فيها `import messages from "../../../messages/en.json"`).

---

## مناطق لسه محتاجة coverage

1. **`SessionUnavailable` — زرار "تسجيل الدخول"** (مخرج الطوارئ): المسار
   `clearAuthHint()` **قبل** `replace("/login")` **مش مغطى بأي spec**. MVT-5 بيؤكّد
   وجود الزرار لا **أثر ضغطه**. 🟡 مهم: الترتيب هو اللي بيمنع الـ middleware يرجّع
   المستخدم — لو اتقلب، **الحلقة ترجع من مدخل تاني**.
2. **الـ 403 ⇒ شاشة retry لا تنتهي** (موصوف كـ LOW في تقرير المخطط) — بلا spec.
3. **`useMe` + `retry:false`**: أي blip بيرمي المستخدم على شاشة alert — سلوك مقصود
   بلا spec يوثّقه.
4. **`middleware`/`proxy` نفسه** — الرجل التانية للحلقة، متغطّى بـ `decide-redirect.spec`
   (نقي) لا بالتكامل. التأكيد الحي فوق هو الدليل الوحيد على الرجلين معاً.

---

## الحكم

### ✅ READY — الـ MVT كامل (7/7)، الـ mutation فوق الميزانية (4/7)، والتأكيد الحي منفَّذ على `npm run dev`

- **7/7 specs** مكتوبة وخضراء · **55/55** suite · صفر tsc جديد.
- **الادعاء المركزي للـ session مُثبَت بالطفرة لا بالخضار:** إرجاع الـ `catch` لسلوك
  ما قبل 2د أسقط **MVT-6 وحده** وسيب **MVT-7** أخضر ⇒ التمييز قائم على **الـ status**.
- **§2ب (double-mapping) مُثبَت مُغلَقاً** بطفرة رابعة زيادة على الميزانية.
- **التأكيد الحي:** navigation واحد، صفر `/en/login`، صفر refresh، الـ hint باقي،
  شاشة retry ظاهرة — على `npm run dev` والـ API واقف.

**قيود مُعلَنة صراحةً (مش تحفّظات مخفية):**
1. **MVT-1، 2، 4 بلا mutation** ⇒ تغطيتهم **غير مُثبَتة** بمعيار #5b.
2. **الاقتران بين MVT-3 و MVT-5** تحت الطفرة (B) — حقيقي لا زائف، ومُسجَّل بثمنه.
3. **الـ 404 على `(auth)` group** — خارج النطاق، بس **بيمنع** التأكيد الحي لمسار
   الـ 401 ⇒ redirect. يعني التأكيد الحي **نصف مُغلَق**: المسار اللي الـ session
   بتصلّحه مؤكَّد حياً؛ المسار المقابل (control) مؤكَّد بالـ specs فقط.
4. **Coverage % غير مقيس** (مفيش provider).

---

## بنود مُسلَّمة — تحتاج إغلاقاً صريحاً (قاعدة #10)

| # | البند | الدور المستهدَف |
|---|---|---|
| 1 | **الـ 404 على `(auth)` group كله** — البند #9 بقى **REPRODUCED** ونطاقه أوسع من register. يستاهل session مستقلة، ومترابط مع `NEXT16-001` (اللوج بيسمّي الـ middleware `proxy.ts`) | 👁️ المراجع الأعلى → BACKLOG |
| 2 | **MVT-1/2/4 تغطية غير مُثبَتة** — منقولة بالنص، مش مطموسة تحت "7/7 passing" | 👁️ المراجع الأعلى |
| 3 | **الاقتران MVT-3 ⇄ MVT-5** تحت الطفرة (B): أقبله كثمن مقصود، ولا أعزل MVT-5 بـ stub؟ | 👁️ المراجع الأعلى |
| 4 | **زرار "تسجيل الدخول" بلا spec** — ترتيب `clearAuthHint()` قبل `replace` هو حارس حلقة غير محروس | 👁️ المراجع الأعلى (session قادمة) |
| 5 | **`@vitest/coverage-v8` مش متثبّت** — أي معيار coverage رقمي مستقبلي محتاج القرار ده أولاً | 👁️ المراجع الأعلى |
| 6 | **الـ dev server لسه شغّال** — إيقافه محتاج قتل شجرة الـ process (`DEV-HYGIENE-001`) | 👤 المستخدم |
| 7 | `DEV-HYGIENE-001` + `NEXT16-001` في الـ BACKLOG (منقولة بلا تخفيف من المبرمج) | 👁️ المراجع الأعلى |

---

✋ تم المختبر — للدور التالي؟
