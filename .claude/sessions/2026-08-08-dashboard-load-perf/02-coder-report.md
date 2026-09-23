# تقرير المبرمج

## البنود المُستلَمة (قاعدة #10)

| # | البند (من `00-plan.md`) | الحالة |
|---|---|---|
| 1 | لو التنفيذ لمس `decide-redirect.ts` أو توقيت **وضع** الـ hint ⇒ وقف + ترقية لـ Deep | **قُبل — ولم يُفعَّل.** الشرط ما اتحققش. الإثبات تحت في §"فحص شرط الترقية" |
| 2 | نتيجة نقطة القرار في المرحلة 3: RC-2 عرَض ولا سبب مستقل؟ | **أُغلق بالقياس: عرَض.** التفاصيل في المرحلة 3 — البند بيتسلّم للمخطط بالنتيجة |
| 3 | التأكيد الحي في المتصفح | **أُحيل إلى 🧪 المختبر** — خارج دور المبرمج، منقول كما هو |
| 4 | إعلان نسبة الـ mutation (2/5) | **أُحيل إلى 🧪 المختبر** — الـ specs من اختصاصه |
| 5 | الـ 404 بتاع register | **أُحيل إلى المستخدم** — لا كود اتكتب له، كما نصّت الخطة |

---

## المرحلة 1: القرار النقي التلاتي في `refresh-policy.ts` — ✅

**الملفات المعدّلة:**
- `apps/web/src/lib/api/refresh-policy.ts`: أضفت `FailureDisposition` +
  `classifyFailure()`، وأعدت تعريف `shouldRefresh` كـ view فوقها:
  ```ts
  export const shouldRefresh = (i) => classifyFailure(i) === "refresh";
  ```
  القاعدة كما اعتمدها المخطط: `status !== 401` ⇒ `"indeterminate"` ·
  401 + (`alreadyRetried` \|\| `isRefreshCall`) ⇒ `"terminal"` · غير كده ⇒ `"refresh"`.

**انحرافات عن الـ Plan:** لا يوجد.

**ملاحظات:**
- الـ 4 specs القديمة **ما اتلمستش ولا حرف** وفضلت خضراء ⇒ اشتغلت فعلاً
  كـ regression harness على الـ refactor زي ما الخطة قصدت.

---

## المرحلة 2: استهلاك القرار — ✅

**الملفات المعدّلة:**
- `apps/web/src/lib/api/map-auth-error.ts`: حقل اختياري
  `sessionDisposition?: FailureDisposition` (+ `import type` — مفيش دورة
  استيراد: `refresh-policy` ما بيستوردش حاجة).
- `apps/web/src/lib/api/client.ts`: الـ interceptor بقى تلاتي بدل ثنائي.
  `if (status === 401)` اتشال. كل رفض بيتختم بـ `sessionDisposition` عبر
  `rejectWith()`. فرع `"indeterminate"` **ما بيعملش teardown**.
- `apps/web/src/components/auth/route-guard.tsx`: الـ redirect بقى مشروطاً
  بـ **إثبات** (`sessionDisposition === "terminal"`) بدل `isError`؛
  + `SessionUnavailable` retry UI؛ + زرار الخروج اللي بيـ `clearAuthHint()`
  قبل التنقل.
- `apps/web/messages/{en,ar}.json`: مجموعة `Common.sessionUnavailable`.

**انحرافات عن الـ Plan:** ثلاثة — كلها مُبلَّغة، ومحتاجة قرار المخطط:

**(أ) 🔴 الأهم — معالجة فشل الـ refresh نفسه (زيادة على الخطة).**
الخطة نصّت على الفروع التلاتة في `client.ts` بس ما نصّتش على الـ `catch`
بتاع الـ refresh، اللي كان بيعمل `terminateSession()` على **أي** فشل.
سبته كما هو كان هيسيب فجوة **من نفس فصيلة** اللي الـ session جاية تقفلها:
سيرفر يرد 401 → refresh → الـ API يعمل restart في النص (`nest --watch`)
⇒ **logout كامل**. فطبّقت نفس القاعدة عليه.

⚠️ **حد الدقة (مهم — مش تفصيلة):** `authClient.refresh()` بيعمل
`throw mapAuthError(e)` (`auth-client.ts:78`)، يعني الـ **HTTP status
بيضيع** قبل ما يوصلني. فأقدر أميّز حالة الـ transport بس (`code === "NETWORK"`)،
و**5xx من `/auth/refresh` لسه بيتقرا `terminal`**. ده تحسين جزئي مش كامل،
ومسجَّل كبند مُسلَّم.

**(ب) فرع `refresh` بدون `config`.** الكود القديم كان `if (willRefresh && config)`
وبيقع في الـ fallthrough. حددته صراحةً: `indeterminate` (ما وصلناش نختبر
الجلسة أصلاً) بدل ما يتسرّب برفض موسوم `"refresh"`.

**(ج) 4 مفاتيح i18n بدل "مفتاحين".** `title` / `description` / `retry` /
`retrying` / `signIn` = 5 فعلياً في locale-ين. الـ `description` بيقول للمستخدم
صراحةً **إنه لسه مسجَّل دخول وإن دي مشكلة اتصال** — وده جوهر الإصلاح
معروضاً للمستخدم، مش نص تزييني.

**ملاحظات:**
- الافتراضي الآمن اتطبق: `isSessionProvenDead()` بترجع `false` لأي شكل غير
  متوقع (`undefined` / حقل غايب) ⇒ أي مسار فشل مجهول بيفشل **ناحية عدم
  الحركة** ⇒ مستحيل يولّد حلقة تانية.
- `route-guard.spec.tsx` القديم (401 terminal، بيسوق السلسلة الحقيقية كاملة)
  فضل أخضر **بدون تعديل** ⇒ دليل مستقل إن الختم بيوصل صح من الـ interceptor
  للـ guard.

---

## 🔒 فحص شرط الترقية لـ Deep — لم يتحقّق

| الشرط | الحالة | الدليل |
|---|---|---|
| `decide-redirect.ts` اتلمس؟ | ❌ لا | مش في `git status` |
| `middleware.ts` اتلمس؟ | ❌ لا | مش في `git status` |
| توقيت **وضع** الـ hint اتغيّر؟ | ❌ لا | `setAuthHint()` ليها call-site-ين بس (`use-auth.ts:39,92`) — **الاتنين ما اتلمسوش** |
| `apps/api` اتلمس؟ | ❌ لا | مش في `git status` |

الإضافة الوحيدة لـ `clearAuthHint` هي **مسح** بفعل صريح من المستخدم
(ضغط زرار)، وده خارج الشرط بنصّه ("مش مسحه").

**التحقق السلوكي (control):** بعد كل التغييرات، `/en/login` + `auth_hint=1`
لسه بيرد **`307 → /en/dashboard`** بالظبط زي الـ baseline. رجل البوابة
**ما اتحركتش** — اللي اتغيّر هو إن الـ Guard بطّل يبعت المستخدم هناك من غير دليل.

---

## المرحلة 3: RC-2 — القياس قبل أي tuning — ✅

**الخطوات المنفّذة:** تأكيد `:4000` قايم (200) → قتل شجرة `next dev`
(PID 8640 + الأبناء) → **مسح `apps/web/.next` بالكامل** → `next dev --turbopack`
من جديد → إعادة **نفس أوامر الـ baseline بالحرف**.

**ملاحظة أثناء التنفيذ:** أول محاولة قتل (PID 15684) اتعوّضت فوراً —
الـ supervisor (`next dev`, PID 8640) عمل respawn لـ start-server كـ PID 6472،
وقفل الملفات منع مسح `.next`. اضطريت أقتل الشجرة كلها. ده يفسّر ليه
"restart" عادي مش بيداوي الحالة دي.

### 🎯 نقطة القرار — النتيجة: **RC-2 كان عرَضاً، مش سبباً مستقلاً**

| المسار | Baseline (`00-scope.md`) | بعد الإصلاح + clean restart | |
|---|---|---|---|
| `/en/dashboard` cold | **59.65 s** | **6.04 s** | ⬇️ ~10× |
| `/en/dashboard` warm | 0.41 s | **0.098 s** | ⬇️ ~4× |
| `/en/dashboard/audit` | **timeout ×3** (180/180/40 s) | **1.31 s** cold · **0.107 s** warm | ✅ بيرد |
| `/en/dashboard/projects` | **timeout** (45 s) | **1.31 s** · **0.138 s** | ✅ بيرد |
| `/en/dashboard/finance` | **timeout** (45 s) | **1.55 s** · **0.105 s** | ✅ بيرد |
| `/en/dashboard/reports` | **timeout** (45 s) | **1.27 s** · **0.121 s** | ✅ بيرد |
| `/en/dashboard/team` | 1.24 s | **1.76 s** cold · **0.125 s** warm | ✅ |
| ذاكرة الـ dev server | **4,166 MB** وطالعة | **1,457 MB** مستقرة | ⬇️ ~2.9× |
| `/en/login` + hint (control) | 307 → `/en/dashboard` | **307 → `/en/dashboard`** | ثابت عمداً |

⇒ **صفر timeouts.** مفيش أي tuning (لا `--max-old-space-size` ولا غيره)
اتعمل — الخطة منعت التخمين قبل القياس، والقياس أثبت إن مفيش حاجة تتضبط.

⚠️ **حدّ القياس (لازم يتقال):** الـ curl **ما بيشغّلش JS**، يعني الأرقام
دي بتقيس زمن السيرفر **بدون** الحلقة. الدليل إن الحلقة نفسها اتكسرت
**لسه ناقص** — تأكيد المتصفح الحي (بند مُستلَم #3) هو اللي يقفله، وهو
مسؤولية المختبر.

---

## Verification (literal — قاعدة #8)

### `npx tsc --noEmit` — **بعد** التغييرات
```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ accessToken: null; user: null; pendingRegistration: null; setSession: ({ accessToken, user }: { accessToken: string; user: AuthUser; }) => void; setAccessToken: (accessToken: string) => void; setPendingRegistration: (pendingRegistration: PendingRegistration) => void; clearPendingRegistration: () => void; clear: ()...' but required in type 'AuthState'.
```

### `npx tsc --noEmit` — **baseline** (نفس الأمر مع `git stash` للتغييرات)
```
BASELINE_TSC_EXIT=2
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ accessToken: null; user: null; pendingRegistration: null; setSession: ({ accessToken, user }: { accessToken: string; user: AuthUser; }) => void; setAccessToken: (accessToken: string) => void; setPendingRegistration: (pendingRegistration: PendingRegistration) => void; clearPendingRegistration: () => void; clear: ()...' but required in type 'AuthState'.
```
⇒ **متطابقان حرفياً. التغييرات أضافت صفر أخطاء tsc.** الـ 5 أخطاء
pre-existing (في ملفات ما اتلمستش) وخارج نطاق الـ session.

### `npx vitest run`
```
 ✓ src/lib/auth/register-payload.spec.ts (2 tests) 5ms
 ✓ src/lib/projects/map-form-to-create-input.spec.ts (5 tests) 5ms
 ✓ src/lib/api/idempotency-key.spec.ts (9 tests) 12ms
 ✓ src/lib/api/map-auth-error.spec.ts (3 tests) 4ms
 ✓ src/lib/auth/decide-redirect.spec.ts (4 tests) 4ms
 ✓ src/store/use-auth-store.spec.ts (2 tests) 3ms
 ✓ src/lib/api/refresh-policy.spec.ts (4 tests) 3ms
 ✓ src/lib/api/client.spec.ts (4 tests) 16ms
 ✓ src/lib/api/projects-client.spec.ts (3 tests) 8ms
 ✓ src/lib/api/phases-client.spec.ts (2 tests) 8ms
 ✓ src/lib/api/updates-client.spec.ts (5 tests) 11ms
 ✓ src/lib/hooks/use-projects.spec.tsx (1 test) 98ms
 ✓ src/lib/hooks/use-create-project.spec.tsx (1 test) 95ms
 ✓ src/lib/hooks/use-project.spec.tsx (2 tests) 117ms
 ✓ src/components/auth/route-guard.spec.tsx (1 test) 65ms

 Test Files  15 passed (15)
      Tests  48 passed (48)
   Start at  18:59:08
   Duration  67.35s (transform 3.70s, setup 67.05s, collect 119.25s, tests 453ms, environment 144.94s, prepare 18.49s)

VITEST_EXIT=0
```

### `git diff --stat`
```
 apps/web/messages/ar.json                    |   9 ++-
 apps/web/messages/en.json                    |   9 ++-
 apps/web/src/components/auth/route-guard.tsx | 110 +++++++++++++++++++++++++--
 apps/web/src/lib/api/client.ts               |  68 +++++++++++++----
 apps/web/src/lib/api/map-auth-error.ts       |  13 ++++
 apps/web/src/lib/api/refresh-policy.ts       |  68 ++++++++++++++---
 6 files changed, 244 insertions(+), 33 deletions(-)
```

### `next dev` log (بعد الـ clean restart)
```
▲ Next.js 16.2.3 (Turbopack)
- Local:         http://localhost:3000
- Network:       http://10.78.90.220:3000
- Environments: .env.local
✓ Ready in 972ms
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead. Learn more: https://nextjs.org/docs/messages/middleware-to-proxy
```

---

## ملخص نهائي
- المراحل المكتملة: **3/3**
- الملفات المعدّلة: **6** (+244 / −33)
- انحرافات عن الـ Plan: **3** — كلها مُبلَّغة، صفر صامتة
- **MVT: 0 مكتوبة** — من اختصاص 🧪 المختبر (5 specs في ميزانية الخطة)
- شرط الترقية لـ Deep: **لم يتحقّق** (مُثبَت بأربعة فحوص + control سلوكي)
- حالة البيئة: dev server شغّال على `:3000` (PID 9416)، API على `:4000`

## ⚠️ ملاحظة على حالة البيئة
قتلت شجرة `next dev` الأصلية اللي كانت تحت `npm run dev` بتاعك وشغّلت
واحدة جديدة بـ `npx next dev --turbopack` مباشرة. الـ **terminal الأصلي
بتاعك مش هيبقى فيه الـ dev server**. لو بتفضّل ترجّعه لـ turbo، اقفل
الـ process الحالي وشغّل `npm run dev` من جديد.

---

## بنود مُسلَّمة — تحتاج إغلاقاً صريحاً (قاعدة #10)
| # | البند | الدور المستهدَف |
|---|---|---|
| 1 | **انحراف (أ):** هل معالجة فشل الـ refresh (`code === "NETWORK"`) مقبولة كزيادة على الخطة؟ | 🧠 المخطط |
| 2 | **فجوة باقية:** `authClient.refresh()` بيبلع الـ HTTP status ⇒ 5xx من `/auth/refresh` لسه `terminal`. تعديل `auth-client.ts` ليحافظ على الـ status = قرار معماري | 🧠 المخطط |
| 3 | **انحراف (ب):** فرع `refresh` بدون `config` ⇒ `indeterminate` — تأكيد | 🧠 المخطط |
| 4 | **انحراف (ج):** 5 مفاتيح i18n بدل "مفتاحين" | 🧠 المخطط |
| 5 | RC-2 = عرَض (مُثبَت بالقياس). هل يتقفل نهائياً ولا يتسجّل في BACKLOG كـ dev-hygiene؟ | 🧠 المخطط |
| 6 | الأرقام فوق **بدون JS** — كسر الحلقة نفسه لسه محتاج تأكيد حي في المتصفح | 🧪 المختبر |
| 7 | تحذير Next 16: `middleware` deprecated لصالح `proxy` — خارج النطاق، للتسجيل | 🧠 المخطط → BACKLOG |

✋ تم المبرمج — للدور التالي؟

---
---

# المرحلة 2د: توحيد قرار فشل الـ refresh (NEEDS-CODER returned)

> رجوع للمبرمج بقاعدة #9، بناءً على `01-architect-report.md` §2 + §2ب.
> **Stage 1 فوق لم يُمَس** — ولا حرف.

## البنود المُستلَمة (قاعدة #10)

| # | البند (من `01-architect-report.md`) | الحالة |
|---|---|---|
| 1 | `status` في `map-auth-error.ts` + الـ `catch` يستدعي `classifyFailure({ isRefreshCall: true })` + `rejectMapped` | **قُبل ونُفِّذ بالكامل** — التلات أجزاء §أ/ب/ج تحت |
| 2 | لو 2د احتاجت `auth-client.ts` أو `decide-redirect.ts` ⇒ قف وارجع | **قُبل — ولم يُفعَّل.** تحليل المخطط صحّ: الملفين ما اتلمسوش. إثبات في §"فحص شرط التوقف" |
| 3 | MVT = 7 (6 و 7 زوج إلزامي) | **أُحيل إلى 🧪 المختبر** — منقول بلا تخفيف |
| 4 | mutation 3/7 مُعلَنة + الـ 4 الباقيين تغطية غير مُثبَتة | **أُحيل إلى 🧪 المختبر** |
| 5 | التأكيد الحي على `npm run dev` مش الـ `npx` المؤقت | **أُحيل إلى 🧪 المختبر** |
| 6 | `SessionUnavailable` محتاج `NextIntlClientProvider` في أي spec بيـ mount-ه | **أُحيل إلى 🧪 المختبر — ومؤكَّد تجريبياً.** البند ده اتحقق فعلاً أثناء 2د: أول suite run فشل بـ `useTranslations` throw من `route-guard.tsx:118` بالظبط زي ما المخطط توقّع. التفاصيل في انحراف (هـ) |
| 7 | `DEV-HYGIENE-001` في الـ BACKLOG | **أُحيل إلى 👁️ المراجع الأعلى** — النص جاهز في تقرير المخطط §4، لم أكتبه (خارج دوري) |
| 8 | `NEXT16-001` في الـ BACKLOG موسوماً Deep | **أُحيل إلى 👁️ المراجع الأعلى** |
| 9 | الـ 404 بتاع register | **أُحيل إلى 👤 المستخدم** — لا كود |

---

## §أ — `map-auth-error.ts`: الحقل + تعبئته

```ts
export interface AuthError {
  // ...
  /** HTTP status of the response that produced this error; undefined when no
   *  response ever came back (transport failure). */
  status?: number;
}
```
+ `AxiosLikeError.response` اتوسّعت لـ `{ data?: unknown; status?: number }`
(من غيرها الـ `err.response?.status` مكانش هيـ type-check).

التعبئة اتقرت **مرة واحدة** فوق الفروع:
```ts
const status = err.response?.status;
```
وبتترحّل لفرع الـ envelope **و** فرع الـ `UNKNOWN`. فرع `NETWORK` بيسيبها
`undefined` — وده مش إغفال، ده **المُدخَل الصحيح** لـ `classifyFailure`
(مفيش response ⇒ مفيش يقين).

⚠️ **انحراف (د) — التعبئة في فرع `UNKNOWN` كمان، مش الـ envelope وحده.**
التعليمة نصّت حرفياً على "فرع الـ envelope". نفّذت أوسع، والسبب حالة حقيقية:

> gateway بيرد **401** بصفحة HTML (مش envelope الـ API). الـ body مش
> object فيه `code`/`message` ⇒ فرع الـ envelope مش بيتاخد ⇒ يقع في
> `UNKNOWN`. لو الـ `status` مترحّلش هناك ⇒ `undefined` ⇒ `indeterminate`
> ⇒ **401 حقيقي مثبَت ما بيقتلش الجلسة.**

ده كان هيخالف قاعدة الـ session نفسها ("الـ 401 المُثبَت وحده بيقتل الجلسة")
في الاتجاه المعاكس: المستخدم بجلسة ميتة فعلاً يفضل على شاشة retry.
الـ `status` **حقيقة عن التبادل**، مستقلة عن شكل الـ body — فمكانها كل فرع
فيه response. **قرار قابل للنقض من المخطط.**

## §ب — `client.ts`: الـ boolean اتشال، القاعدة الواحدة محلّه

```ts
const mapped: AuthError =
  (refreshError as AuthError | null) ?? mapAuthError(refreshError);

const disposition = classifyFailure({
  status: mapped.status,
  alreadyRetried: false,
  isRefreshCall: true,
});

if (disposition === "terminal") terminateSession();

return rejectMapped(mapped, disposition);
```

- `isRefreshCall: true` بيدي بالظبط: 401 ⇒ `terminal` · 429/5xx/بلا رد ⇒
  `indeterminate` · و`"refresh"` **غير قابل للإنتاج** من هنا (الـ 401 مع
  `isRefreshCall` بيرجع `terminal` قبل ما يوصل لفرع الـ refresh).
- الـ `?? mapAuthError(...)` مش تخمين شكل — **فحص null فقط**. لو الـ chain
  رجّع `null`/`undefined` (مش من `authClient`)، بنـ normalize عادي.
  مفيش heuristic على شكل المُدخَل، زي ما المخطط اشترط.

## §ج — `rejectMapped`: إيقاف الـ double-mapping (§2ب)

دالة تانية جنب `rejectWith`، **مش بديلة عنها**: الفرق مش في السلوك المرغوب
بل في **حالة المُدخَل** — خام (`rejectWith`) مقابل مخطوط بالفعل (`rejectMapped`).
النوع في التوقيع هو العقد؛ المستدعي هو اللي يعرف.

⚠️ **حد باقٍ (مسجَّل، غير مُصلَح):** لو حاجة **غير** `AuthError` وغير null
هربت من الـ chain (مثلاً `setAccessToken` رمى جوّه الـ `.then`)، الـ spread
`{ ...mapped }` هيدي object بلا `code`/`message`. الـ `sessionDisposition`
**بينجو** ⇒ الـ RouteGuard لسه بيقرأ الصح ⇒ **الحلقة تفضل مقفولة**؛ اللي
بيضيع نص الرسالة. تصعيده يحتاج type guard على الشكل — وده اللي المخطط منعه
صراحةً. **متروك كما هو عمداً، للمخطط.**

---

## 🔒 فحص شرط التوقف (البند المُستلَم #2) — لم يتحقّق

| الملف | اتلمس؟ | الدليل |
|---|---|---|
| `auth-client.ts` | ❌ لا | مش في `git diff --stat` تحت |
| `decide-redirect.ts` | ❌ لا | مش في `git diff --stat` |
| `middleware.ts` | ❌ لا | مش في `git diff --stat` |
| `apps/api` | ❌ لا | مش في `git diff --stat` |

تحليل المخطط اتأكد عملياً: الـ status اتحفظ **من غير أي تعديل على
`auth-client.ts`**، لأنه بيفوّض لـ `mapAuthError` أصلاً.

---

## ⚠️ انحراف (هـ) — لمست ملف spec لم يرد في التعليمة

**التعليمة حددت ملفين. عدّلت تالت: `route-guard.spec.tsx`.** مُبلَّغ كاملاً:

### إيه اللي حصل
أول `vitest run` بعد §أ+§ب: **1 failed / 47 passed**. الفشل في
`route-guard.spec.tsx` — "terminal 401 ⇒ session really cleared…" — والـ error
`useTranslations` بيرمي من `route-guard.tsx:118`، يعني الـ guard رسم
`SessionUnavailable` بدل الـ redirect.

### التشخيص — الـ spec كان أخضر لسبب غلط
الـ mock كان:
```ts
vi.spyOn(authClient, "refresh").mockRejectedValue(new Error("refresh failed"));
```
`Error` عارية: مفيش `code`، مفيش `status`.
- **قبل 2د:** `code !== "NETWORK"` ⇒ `terminal` ⇒ أخضر.
- **بعد 2د:** `status === undefined` ⇒ `indeterminate` ⇒ أحمر.

🔴 **الخلاصة المهمة:** `authClient.refresh()` **عمره ما بيرمي `Error` عارية** —
بيرمي `mapAuthError(e)` دايماً (`auth-client.ts:78`). فالـ stimulus ده شكل
**مستحيل في production**. الـ spec اسمه "terminal **401**" لكنه كان بيختبر
"أي فشل refresh ⇒ terminal" — وهي **بالظبط السلوك الثنائي اللي 2د جات تشيله**.
يعني الـ spec كان **مقترناً بالـ bug**: خضاره كان بيوثّق العيب لا الخاصية.

### التعديل
الرفض اتبنى بـ **`mapAuthError` الحقيقية** فوق axios error بـ `status: 401` —
أعمق تمثيل ممكن (قاعدة #4)، وبيمنع الـ spec إنه يـ drift لو الـ normalizer
اتغيّر. ما لمستش ولا assertion من الأربعة.

### إثبات إن الـ spec لسه **بيعضّ** (مش رُبِّت عليه)
mutation على الـ stimulus نفسه — `status: 401` → `503` في mock الـ refresh:
```
AssertionError: expected "spy" to be called with arguments: [ '/login' ]
      Tests  1 failed (1)
```
⇒ الـ spec بقى بيميّز على **الـ status** فعلاً: 401 ⇒ redirect + teardown ·
503 ⇒ الجلسة تنجو. رجّعته لـ 401 والـ suite رجع أخضر.

### تصحيح إجرائي على نفسي
جرّبت أثبت الـ regression بـ `git stash` على الملفين وتشغيل الـ spec.
**التجربة دي كانت باطلة** ولا تصلح دليلاً: الـ stash بيرجّع للـ **commit**
(ما قبل الـ session) مش لـ Stage 1، فطلع خليط — guard بتاع Stage 1 مع client
قديم بلا `sessionDisposition` أصلاً. الدليل المعتمد هو سجل Stage 1 الحرفي فوق
(`✓ route-guard.spec.tsx (1 test) 65ms`) مقابل الـ run الأحمر بعد 2د.

**قرار للمخطط:** تعديل spec قائم خارج الملفين المحددين — مقبول ولا يترجع؟
موقفي: كان **إلزامياً** (الـ suite مش هتعدّي من غيره) و**مبرَّر** (الـ stimulus
كان غير واقعي)، بس القرار مش قراري.

---

## Verification (literal — قاعدة #8)

### `npx tsc --noEmit` — بعد 2د
```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ accessToken: null; user: null; pendingRegistration: null; setSession: ({ accessToken, user }: { accessToken: string; user: AuthUser; }) => void; setAccessToken: (accessToken: string) => void; setPendingRegistration: (pendingRegistration: PendingRegistration) => void; clearPendingRegistration: () => void; clear: ()...' but required in type 'AuthState'.
TSC_EXIT=2
```
⇒ **نفس الـ 5 أخطاء الـ pre-existing حرفياً، صفر جديد** — مطابقة للـ baseline
المنسوخ في Stage 1 (المقارنة اتعملت سطراً بسطر على نفس المخرَج).

### `npx vitest run` — بعد 2د
```
 ✓ src/lib/api/idempotency-key.spec.ts (9 tests) 18ms
 ✓ src/lib/auth/register-payload.spec.ts (2 tests) 7ms
 ✓ src/lib/projects/map-form-to-create-input.spec.ts (5 tests) 7ms
 ✓ src/lib/api/client.spec.ts (4 tests) 22ms
 ✓ src/lib/api/updates-client.spec.ts (5 tests) 19ms
 ✓ src/lib/api/phases-client.spec.ts (2 tests) 12ms
 ✓ src/lib/api/projects-client.spec.ts (3 tests) 15ms
 ✓ src/store/use-auth-store.spec.ts (2 tests) 6ms
 ✓ src/lib/api/map-auth-error.spec.ts (3 tests) 6ms
 ✓ src/lib/auth/decide-redirect.spec.ts (4 tests) 6ms
 ✓ src/lib/api/refresh-policy.spec.ts (4 tests) 5ms
 ✓ src/lib/hooks/use-projects.spec.tsx (1 test) 107ms
 ✓ src/lib/hooks/use-project.spec.tsx (2 tests) 110ms
 ✓ src/lib/hooks/use-create-project.spec.tsx (1 test) 114ms
 ✓ src/components/auth/route-guard.spec.tsx (1 test) 48ms

 Test Files  15 passed (15)
      Tests  48 passed (48)

VITEST_EXIT=0
```
- الـ 4 specs بتوع `refresh-policy.spec.ts` — **لسه خضراء بلا تعديل** (الـ
  regression harness شغّال عبر المرحلتين).
- الـ 3 specs بتوع `map-auth-error.spec.ts` خضراء: الحقل الجديد اختياري
  والـ assertions على `.code`/`.message` مش على الـ object كله.
- `client.spec.ts` (R-1، 4 specs) خضرا: مساراته الـ refresh فيها **بينجح**،
  فما اتأثرش بتغيير الـ `catch`.

### `git diff --stat` (الـ session كاملة — Stage 1 + 2د)
```
 apps/web/messages/ar.json                         |   9 +-
 apps/web/messages/en.json                         |   9 +-
 apps/web/src/components/auth/route-guard.spec.tsx |  23 ++++-
 apps/web/src/components/auth/route-guard.tsx      | 110 ++++++++++++++++++++--
 apps/web/src/lib/api/client.ts                    |  94 ++++++++++++++----
 apps/web/src/lib/api/map-auth-error.ts            |  39 +++++++-
 apps/web/src/lib/api/refresh-policy.ts            |  68 +++++++++++--
 7 files changed, 313 insertions(+), 39 deletions(-)
```

---

## ملخص المرحلة 2د
- الأجزاء المكتملة: **3/3** (§أ status · §ب القاعدة الواحدة · §ج الـ double-map)
- الملفات المعدّلة في 2د: **3** (`map-auth-error.ts` · `client.ts` · + spec)
- انحرافات: **2** — (د) تعبئة `status` في فرع `UNKNOWN` كمان · (هـ) لمس ملف spec.
  **صفر صامتة.**
- شرط التوقف: **لم يتحقّق** (4 فحوص)
- **MVT: 0 مكتوبة** — دور 🧪 المختبر (الميزانية 7 بإقرار المخطط)

---

## بنود مُسلَّمة — تحتاج إغلاقاً صريحاً (قاعدة #10)

| # | البند | الدور المستهدَف |
|---|---|---|
| 1 | **انحراف (د):** تعبئة `status` في فرع `UNKNOWN` (401 خلف gateway بـ HTML) — أوسع من التعليمة الحرفية | 🧠 المخطط |
| 2 | **انحراف (هـ):** تعديل `route-guard.spec.tsx` خارج الملفين المحددين — مقبول ولا يترجع؟ | 🧠 المخطط |
| 3 | **حد باقٍ في §ج:** مُدخَل غير-`AuthError` وغير-null يفقد `code`/`message` (الـ disposition بينجو) — رفعه يحتاج type guard الممنوع | 🧠 المخطط |
| 4 | **اكتشاف يخص التغطية:** الـ specs اللي بتـ mock فشل `authClient` بأشكال **مستحيلة في production** بتوثّق العيب لا الخاصية. `route-guard.spec.tsx` اتصلّح — **هل فيه غيره؟** | 🧪 المختبر |
| 5 | MVT-6/7 لازم يبنوا الرفض بـ `mapAuthError` الحقيقية زي ما اتعمل هنا، مش object literal مكتوب باليد | 🧪 المختبر |
| 6 | البنود 3–9 من تقرير المخطط اتنقلت بلا تخفيف (جدول البنود المُستلَمة فوق) | 🧪 المختبر / 👁️ المراجع / 👤 المستخدم |

✋ تم المبرمج (المرحلة 2د) — للدور التالي؟
