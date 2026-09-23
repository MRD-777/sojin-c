# خطة التنفيذ — كسر الـ redirect loop + استعادة زمن تحميل الـ dashboard

## البنود المُستلَمة (قاعدة #10)

| # | البند (من `00-scope.md`) | الحالة |
|---|---|---|
| 1 | تأكيد الحلقة **حياً** في المتصفح قبل قياس النجاح | **أُحيل إلى 🧪 المختبر** — مثبت كبند إلزامي في المرحلة 4؛ الـ session ما تتقفلش من غيره |
| 2 | teardown في `client.ts` ولا `refresh-policy.ts`؟ | **قُبل** — قرار المستخدم: `refresh-policy.ts`. ⚠️ **رُفض وأُصلح جزئياً:** التوسيع بشكله الساذج (network/5xx ⇒ teardown) مرفوض معمارياً — التفاصيل في §"الجواب على سؤال الترقية". القرار النقي بيتوسّع لـ **3 حالات** بدل ما الـ teardown يتوسّع لحالتين |
| 3 | RC-2: dev-server tuning ولا `.next` reset ولا الاتنين؟ | **قُبل وحُسم** — لا ده ولا ده ابتداءً: clean restart + قياس أولاً (المرحلة 3)، والـ tuning **مشروط** بنتيجة القياس |
| 4 | الـ 404 بتاع register | **أُحيل إلى المستخدم** — NOT-REPRODUCED بـ 4 قياسات؛ يُوثَّق ولا يُقفل بالصمت. مفيش كود هيتكتب له في الـ session دي |

---

## 🎯 الجواب على سؤال الترقية: هل ده تغيير دلالة ولا تصحيح توقيت؟

**الجواب المختصر: التوسيع الساذج تغيير دلالة حقيقي — عشان كده مش هنعمله.
الخطة البديلة تصحيح توقيت خالص. ⇒ نفضل في Standard.**

### أولاً: نفصل حاجتين الاسم بيخلطهم

| | التعريف | مين بيحكمه |
|---|---|---|
| **البوابة** (gate) | مين يعدّي للـ dashboard | `decide-redirect.ts` (hasHint) + الـ JWT guard في الـ API |
| **عُمر الجلسة** (session lifetime) | إمتى نعلن إن الجلسة **ماتت** | `terminateSession()` = `store.clear` + `clearAuthHint` |

التوسيع الساذج ما بيلمسش **قاعدة** البوابة. بس `auth_hint` هو **مُدخَل**
للبوابة — فتغيير *إمتى* بيتمسح بيغيّر **سلوكها المُلاحَظ** حتى والقاعدة ثابتة.
يعني: مش تغيير دلالة البوابة، لكنه **تغيير دلالة عُمر الجلسة**، وده بينضح
على البوابة.

### ثانياً: اتجاه التغيير — وليه مش Deep

التوسيع الساذج بيفشل **مقفولاً** (fails closed): بيطرد ناس أكتر، **عمره ما
بيدخّل حد**. مفيش أي مسار بيكسب صلاحية. ⇒ **مش تصعيد أمني ⇒ مفيش ترقية لـ Deep.**

### ثالثاً: ليه رافضه برغم إنه آمن

`auth_hint` عمره **7 أيام** (`auth-hint.ts:16`) ومربوط بالـ refresh cookie
(`auth.controller.ts:36`). التوسيع الساذج معناه:

> أي restart للـ API، أي `nest --watch` recompile، أي لحظة offline
> ⇒ **logout كامل + إعادة إدخال الباسورد**، والـ refresh cookie لسه سليم 7 أيام.

ده بيستبدل bug (حلقة) بـ regression (طرد على أول عطسة شبكة). ومهم:
**الـ dev workflow نفسه هو أكتر حاجة هتولّد الحالة دي** — وهي نفس البيئة اللي
المشكلة اتكشفت فيها.

### رابعاً: الخطأ الجذري الحقيقي — خطأ تصنيف (category error)

الكود عنده **حالتين** لمجال فيه **تلاتة**:

| الواقع | الكود دلوقتي |
|---|---|
| الجلسة **ميتة بدليل** (401 مُثبَت) | `terminal` ✅ |
| الجلسة **حية** | success ✅ |
| **مش عارفين** (السيرفر ما ردّش / 5xx / 429) | ❌ **مفيش تمثيل** |

والحلقة هي بالظبط ناتج الحالة التالتة الغائبة، لأن **النصين بيختلفوا عليها**:

```
RouteGuard   → بيعامل "مش عارفين" كأنها ميتة  → redirect /login
middleware   → بيعامل "مش عارفين" كأنها حية    → 307 رجوع /dashboard
                                    └── الخلاف نفسه = الحلقة
```

⇒ أي إصلاح لازم **يوفّق النصين**. وفيه طريقتين بس:

- **(ب)** الاتنين يعاملوها كـ **ميتة** ⇒ التوسيع الساذج ⇒ طرد على كل blip.
- **(أ)** الاتنين يعاملوها كـ **حية-غير-متحقَّق-منها** ⇒ الـ Guard **يبطّل ينقل**
  ⇒ ✅ **المختار.**

(أ) **ما بيلمسش البوابة أصلاً** — لا قاعدتها ولا مُدخلها. الـ Guard بس بيبطّل
يـ navigate على حدث ما كانش يستاهل navigation من الأول.
**ده تصحيح توقيت بالضبط: الـ redirect كان بيحصل في لحظة غلط.**

> **شرط الترقية لو انكسر أثناء التنفيذ:** لو المبرمج لقى نفسه بيعدّل
> `decide-redirect.ts` أو بيغيّر إمتى `auth_hint` **يتحط**، يقف فوراً ويرفع
> لـ Deep. تعديل `decide-redirect.ts` = **قراءة فقط** في الخطة دي.

---

## المشكلة
`/dashboard` بياخد 7-8 دقايق. مقاس: cold = 59.6 s، وصفحات `audit/projects/finance/reports`
بتعمل **timeout** (000) بدل ما ترد. الـ dev server طالع من 661 MB لـ 4,166 MB.

## التحليل (الـ root cause)
سببين بيغذّوا بعض (الأدلة الكاملة في `00-scope.md`):
- **RC-1** — الحلقة الموصوفة فوق. زنادها **RC-3** (الـ API كان واقف).
- **RC-2** — الـ dev server مخنوق. الحلقة بتقصفه بـ navigations، وهو المخنوق
  بيخلي كل navigation بعشرات الثواني ⇒ **حلقة موت**.

🔴 **فرضية التسلسل:** RC-2 ممكن يكون **نتيجة** RC-1 مش سبباً مستقلاً.
عشان كده الترتيب: نصلّح RC-1 → restart نضيف → **نقيس** → وبعدين بس نقرر
هل RC-2 لسه موجود. أي tuning قبل القياس ده تخمين.

---

## الحل المقترح

### المرحلة 1: `refresh-policy.ts` — القرار النقي التلاتي
**الملفات:** `apps/web/src/lib/api/refresh-policy.ts`

```ts
export type FailureDisposition = "refresh" | "terminal" | "indeterminate";

export function classifyFailure(input: RefreshDecisionInput): FailureDisposition;
```

القاعدة الواحدة — **الـ 401 المُثبَت هو الوحيد اللي بيقتل الجلسة**:

| المُدخَل | النتيجة |
|---|---|
| 401 + `!alreadyRetried` + `!isRefreshCall` | `"refresh"` |
| 401 + (`alreadyRetried` \|\| `isRefreshCall`) | `"terminal"` |
| **أي حاجة تانية** — `undefined` / 5xx / 429 / 403 / 4xx | **`"indeterminate"`** |

**`shouldRefresh` يفضل موجود ومُصدَّر**، بس يتعاد تعريفه فوق الـ core الجديد:
```ts
export const shouldRefresh = (i: RefreshDecisionInput) => classifyFailure(i) === "refresh";
```
⇒ الـ 4 specs الموجودة في `refresh-policy.spec.ts` **تفضل كما هي بالحرف**
وتتحوّل تلقائياً لـ **regression harness على الـ refactor**. ممنوع تعديلها.

**الـ Risks:**
- 403 مصنّف `indeterminate` مش `terminal` — مقصود: "مصرّح لكن ممنوع" ≠ "جلسة ميتة".
  (وده كان **زناد تاني للحلقة**: 403 دلوقتي بيعمل redirect بدون مسح الـ hint.)
- 429 مهم: أثناء عاصفة الحلقة الـ refresh بيتخنق (30/min في `auth.controller.ts:109`).
  لو 429 اتحسب `terminal` هنطرد المستخدم بسبب ازدحام إحنا اللي عملناه.

### المرحلة 2: `client.ts` + `route-guard.tsx` — استهلاك القرار
**الملفات:** `apps/web/src/lib/api/client.ts` · `apps/web/src/lib/api/map-auth-error.ts` · `apps/web/src/components/auth/route-guard.tsx`

**2أ — `client.ts`:** يستبدل `shouldRefresh` بـ `classifyFailure`:
- `"refresh"` → **نفس السلوك الحالي بالظبط** (لا تغيير).
- `"terminal"` → `terminateSession()` — **نفس السلوك الحالي بالظبط**.
- `"indeterminate"` → **لا teardown**؛ يرفض بس. (`client.ts:111` `if (status === 401)`
  يتشال ويبقى فرع من الـ switch.)

**2ب — `map-auth-error.ts`:** حقل اختياري على `AuthError`:
```ts
sessionDisposition?: FailureDisposition;  // import type فقط
```
الـ interceptor بيحطه على الخطأ المرفوض. `mapAuthError` نفسه ما بيحسبهوش.
المستهلكين الحاليين (`useLogin`/`useRegister` بيعرضوا `.message`) ما بيتأثروش.

**2ج — `route-guard.tsx`:** الشرط بيبقى **إثبات**، مش أي خطأ:
```ts
if (isError && (error as AuthError)?.sessionDisposition === "terminal")
  router.replace("/login");
```
🔴 **الافتراضي الآمن: غياب الحقل ⇒ لا redirect.** أي مسار فشل غير متوقع
(unwrap يرمي، خطأ من خارج الـ interceptor) بيفشل **ناحية عدم الحركة** —
فمستحيل يولّد حلقة تانية.

وفي حالة `indeterminate` الـ Guard يعرض **UI إعادة محاولة** بدل `null`
(الـ `null` الحالي = شاشة بيضا للأبد).

**مخرج الطوارئ (لازم):** زرار "تسجيل الدخول" في الـ retry UI بيـ `clearAuthHint()`
**قبل** ما ينقل لـ `/login`. سبب: نية المستخدم الصريحة قرار لا لبس فيه —
بيديه طريق خروج من غير ما إحنا نخمّن إن الجلسة ماتت. من غير الزرار ده
المستخدم المسجَّل-خارج فعلاً + API واقف بيعلق على شاشة retry.

**الـ Risks:**
- `error` من React Query نوعه `unknown` — لازم narrowing، مش `as any`.
- الـ retry UI محتاج نصوص i18n (`next-intl`) — يستخدم مفاتيح موجودة أو يضيف مفتاحين.

### المرحلة 3: RC-2 — قياس قبل أي tuning
**الملفات:** لا تعديل كود ابتداءً.
1. التأكد إن `:4000` قايم (`netstat` + `curl /health`).
2. إيقاف dev server (PID 15684) + مسح `apps/web/.next`.
3. `npm run dev:web` من جديد.
4. إعادة **نفس أوامر الـ baseline** بالحرف.
5. **نقطة قرار:** لو الصفحات بقت بترد ⇒ RC-2 كان عرَض من RC-1، **يتقفل بالقياس**.
   لو لسه بتعمل timeout ⇒ يترفع كبند مستقل (`NODE_OPTIONS=--max-old-space-size`
   / فحص `next dev --turbopack` على 16.2.3) — **قرار للمخطط، مش inline fix**.

**الـ Risks:** مسح `.next` بيخلي أول hit بطيء طبيعياً — القياس المعتمد هو
**التاني** لكل مسار، والاتنين يتسجّلوا.

### المرحلة 4: القياس النهائي
جدول جنب جدول مع baseline `00-scope.md` بنفس الأوامر بالحرف، **زائد** التأكيد
الحي في المتصفح (البند المُستلَم #1): فتح `/en/dashboard` والـ API واقف
⇒ **مفيش ping-pong في الـ Network tab** + شاشة retry ظاهرة.

---

## الـ Skills المطلوبة
- `CLAUDE.md` قواعد #2 (MVT) · #4 (paired assertions) · #5ب/#5b (mutation) · #8 (literal output) · #10 (handoff)

## نقاط القرار (تحتاج موافقتك)
1. **رفض التوسيع الساذج** للـ teardown لصالح الحالة التالتة `indeterminate` — مع
   الالتزام بقرارك إن المنطق يعيش في `refresh-policy.ts`.
2. **رفع الـ MVT من 4 لـ 5 specs** (السبب تحت).
3. **زرار الخروج** في الـ retry UI (مخرج الطوارئ) — سطح UI بسيط جديد.

## التأثير على الـ Codebase
| الملف | التغيير |
|---|---|
| `lib/api/refresh-policy.ts` | +`classifyFailure` +النوع؛ `shouldRefresh` يتعاد تعريفه فوقه |
| `lib/api/client.ts` | فرع تلاتي بدل ثنائي؛ `if (status === 401)` يتشال |
| `lib/api/map-auth-error.ts` | +حقل اختياري `sessionDisposition` |
| `components/auth/route-guard.tsx` | redirect بإثبات فقط + retry UI + زرار خروج |
| `lib/auth/decide-redirect.ts` | ❌ **لا تعديل** (قراءة فقط — مؤشر ترقية) |
| `apps/api/**` | ❌ **لا تعديل** |

---

## تعريف النجاح
- [ ] فشل شبكة على `/users/me` ⇒ **لا redirect ولا teardown** — الجلسة تنجو
- [ ] 401 مُثبَت ⇒ teardown + redirect **زي ما هو** (مفيش regression)
- [ ] الـ 4 specs القديمة في `refresh-policy.spec.ts` **passing بدون تعديل**
- [ ] `/en/dashboard` + `/en/dashboard/audit` بيردوا بأرقام مقيسة جنب الـ baseline
- [ ] تأكيد حي في المتصفح: مفيش ping-pong، شاشة retry ظاهرة
- [ ] **MVT: 5 specs مكتوبة وpassing** (إجباري)
- [ ] **Mutation على 2 من 5** (MVT-3 و MVT-5) — مُعلَنة كنسبة صراحةً

### ميزانية الـ MVT — 5 specs
> **رفع من 4 (scope) لـ 5.** السبب: الفصل بين "الجلسة نجت" (MVT-3) و"الجلسة
> اتمسحت لما لازم" (MVT-4) لازم يكون **spec-ين متقابلين**. لو واحد بس،
> خضاره ممكن يكون لأن الـ teardown **مكسور في كل الحالات** مش لأن الشرط صح.

| # | الملف | البند | الـ assertion الأعمق (قاعدة #4) |
|---|---|---|---|
| 1 | `refresh-policy.spec.ts` | `status: undefined` ⇒ `"indeterminate"` | **مقرون:** `shouldRefresh` لنفس المُدخَل لسه `false` (ما بدأناش نـ refresh على أخطاء الشبكة) |
| 2 | `refresh-policy.spec.ts` | جدول: 500/502/429/403 ⇒ `indeterminate` · 401 fresh ⇒ `refresh` · 401+retried / 401+isRefreshCall ⇒ `terminal` | الـ `terminal` الوحيد هو 401 مُثبَت |
| 3 | **ملف جديد** `client.session-liveness.spec.ts` (jsdom) | فشل شبكة ⇒ **الجلسة تنجو** | `accessToken === OLD` **و** `user` لسه هو المزروع **و** `document.cookie` لسه فيه `auth_hint=1` **و** الرفض `code:"NETWORK"` + `sessionDisposition:"indeterminate"` |
| 4 | نفس الملف | 401 مُثبَت ⇒ **الجلسة تتمسح** (control) | `accessToken === null` **و** `auth_hint` **اتشال فعلاً من `document.cookie`** |
| 5 | `route-guard.spec.tsx` | **قاتل الحلقة:** API مش موصول ⇒ **مفيش تنقل** | `replace` **ما اتنادتش ولا مرة** **و** `auth_hint` لسه موجود **و** retry UI ظاهر **و** الـ children المحمية مش ظاهرة |

🔴 **ليه ملف jsdom جديد لـ 3+4:** `client.spec.ts` الحالي بيشتغل node env،
فـ `document` مش موجود و `clearAuthHint` بيعمل **no-op** (`auth-hint.ts:38`).
يعني spy على الدالة هيبقى **assertion سطحي** — أعمق تمثيل ممكن هو
**الكوكي نفسه**، وهو المُدخَل الحقيقي للـ middleware (الرجل التانية للحلقة).
ممنوع تحويل `client.spec.ts` الحالي لـ jsdom — الـ 4 specs بتوعه شغالة كما هي.

### الـ Mutation المطلوب (قاعدة #5ب/#5b) — **2 من 5، مُعلَن**
| الـ Spec | التعطيل | المتوقع |
|---|---|---|
| **MVT-5** | رجّع `route-guard.tsx` لـ `if (isError) replace("/login")` | **MVT-5 وحده يسقط** |
| **MVT-3** | خلي فرع `indeterminate` في `client.ts` ينادي `terminateSession()` | **MVT-3 وحده يسقط** |
> سقوط جانبي (spec تاني يقع معاهم) = اقتران زائف ⇒ يتبلغ، مش يتجاهل.
> الـ 3 الباقيين (1، 2، 4) **بلا mutation** — تغطيتهم غير مُثبَتة بالمعيار ده،
> ومنقولة كده صراحةً للمراجع.

---

## بنود مُسلَّمة — تحتاج إغلاقاً صريحاً (قاعدة #10)
| # | البند | الدور المستهدَف |
|---|---|---|
| 1 | لو التنفيذ لمس `decide-redirect.ts` أو توقيت **وضع** الـ hint ⇒ وقف + ترقية لـ Deep | 💻 المبرمج |
| 2 | نتيجة نقطة القرار في المرحلة 3: RC-2 عرَض ولا سبب مستقل؟ | 💻 المبرمج → 🧠 المخطط |
| 3 | التأكيد الحي في المتصفح (مُستلَم #1 من الـ scope) — الـ session ما تتقفلش من غيره | 🧪 المختبر |
| 4 | إعلان نسبة الـ mutation (2/5) وحالة الـ 3 غير المُختبَرين بالطفرة | 🧪 المختبر |
| 5 | الـ 404 بتاع register — NOT-REPRODUCED، مستني URL من المستخدم | 👤 المستخدم |

---
⏸️ AWAITING APPROVAL
رد بـ "approve" للمتابعة أو "edit: [تعديل]" للتعديل

✋ تم المخطط — للدور التالي؟
