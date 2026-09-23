# خطة التنفيذ — R-1: تغطية مسار refresh-success في `client.ts`

## المشكلة

الـ response interceptor في `apps/web/src/lib/api/client.ts` بيـ implement ثلاث ضمانات:
(1) 401 ⇒ refresh ⇒ retry ناجح، (2) retry **واحد** لا أكثر، (3) refresh **واحد** مشترك
عند التزاحم. **ولا واحدة من التلاتة مُختبَرة على مستوى الـ interceptor.** المُختبَر فعلياً:
فرع الفشل الطرفي (`route-guard.spec.tsx`) + الـ **دالة النقية** `shouldRefresh`
(`refresh-policy.spec.ts`).

معيار النجاح #3 في `00-plan.md` بتاع S2 («hard reload بجلسة صالحة ⇒ refresh صامت ⇒
dashboard يتحمّل») **مُعلَن ولم يُتحقَّق منه إطلاقاً** — تصنيفه «معيار نجاح غير مستوفى»
لا «coverage مؤجّل» (رفع المراجع الأعلى في S2).

---

## التحليل — الجذر البنيوي

الفرق بين المُختبَر وغير المُختبَر **مش صدفة**، وله سبب واحد:

> **الفروع المُختبَرة هي اللي أطرافها pure أو observable من خارج axios.**
> **الفروع غير المُختبَرة هي اللي حالتها بتعيش جوّه دورة حياة `axios` نفسها:**
> `config._retry` (يمرّ بـ `mergeConfig`)، و `refreshInFlight` (متغيّر module-level
> بيتقاسمه consumers متزامنون).

يعني الحالة اللي بتقرّر السلوك **مش في طبقة قابلة للاستدعاء المباشر** — لازم تتقاد
عبر الـ transport. ده اللي خلّى S2 يكتفي بالـ pure spec، وده بالظبط اللي الخطة دي بتقفله.

---

# 🔴 الأولوية الأولى — `_retry` propagation عبر `mergeConfig`

**(بترتيب صريح من المستخدم — دي المخاطرة الحقيقية في الـ session)**

## أ. الآلية المعنية (قراءة الكود، بالأسطر)

`client.ts:97-102` — لما الـ refresh ينجح:
```ts
config._retry = true;
config.headers.Authorization = `Bearer ${token}`;
return client(config);          // ← الـ retry
```
والـ retry ده لو فشل بـ 401 تانٍ، بيرجع لنفس الـ interceptor، اللي بيقرأ (`client.ts:91`):
```ts
alreadyRetried: config?._retry ?? false
```

**الحلقة كلها معلّقة على سؤال واحد:** هل الـ `_retry: true` بيـ **survive** رحلته
جوّه axios (`client(config)` ⇒ `mergeConfig(this.defaults, config)` ⇒ dispatch ⇒
`error.config`)؟

**لو الإجابة لأ ⇒ كل retry فاشل بيولّد refresh جديد بلا سقف: `شهية` refresh loop
حقيقي في production**، والـ `refresh-policy.spec.ts` **الأخضر مش هيلاحظه إطلاقاً**
لأنه بيغذّي `alreadyRetried` كوسيطة يدوية.

## ب. القراءة الساكنة (axios **1.15.0** — المثبَّت فعلياً)

`node_modules/axios/lib/core/mergeConfig.js:101` — قاعدة المفاتيح غير المعروفة:
```js
const merge = utils.hasOwnProp(mergeMap, prop) ? mergeMap[prop] : mergeDeepProperties;
```
`_retry` **مش** في `mergeMap` ⇒ بياخد `mergeDeepProperties` (سطر 33)، واللي بيرجّع
`getMergedValue(a, b)` لما `b !== undefined`؛ و `true` لا plainObject ولا array ⇒
**بيرجع `true` كما هو.**

**⇒ القراءة الساكنة بتقول إن الـ propagation شغّال في 1.15.0.**

## ج. 🔴 وليه القراءة دي **ليست** إغلاقاً للمخاطرة

1. **مش سلوكاً موثَّقاً في الـ public API** — دي **تفصيلة تنفيذ** في ملف داخلي.
   `_retry` اصطلاح مجتمعي شائع، **مش عقد**. أي minor bump في axios يقدر يـ whitelist
   الـ config keys (اقتراح متكرّر upstream) ⇒ الـ flag يُسقَط **صامتاً**، والـ
   `refresh-policy.spec.ts` يفضل أخضر 4/4، والـ suite كلها خضراء، وفي production
   يبدأ refresh loop.
2. **الـ `^1.15.0` في `package.json` بيسمح بالترقية دي بلا مراجعة بشرية.**
3. القراءة بتغطّي `mergeConfig` بس — **مش** بتغطّي إن الـ config **الواصل للـ error**
   بعد فشل الـ dispatch هو نفس الـ merged object.

> **الاستنتاج المعماري:** المخاطرة مش «هل الكود صح النهاردة» — القراءة بتقول أيوه.
> المخاطرة إن الـ **صحة دي غير محروسة**، ومعلّقة على تفصيلة داخلية في dependency
> بـ caret range. **الـ spec مطلوب كـ canary على axios، مش كتوثيق للسلوك.**

## د. القرار المعماري الناتج

**spec مستقل (MVT-2) هدفه الوحيد تثبيت الـ propagation** — يقرأ `_retry` من الـ config
اللي **وصل الـ transport فعلاً** في المحاولة الثانية. مستقل عن MVT-3 (السلوك)،
لأن المستهدَف مختلف: MVT-2 يحرس **الآلية** (axios)، MVT-3 يحرس **النتيجة** (لا loop).
لو اتكسر الـ propagation، MVT-2 بيقول **ليه** فوراً بدل ما نصطاد السبب من فشل سلوكي.

---

# 🔴 اكتشاف أثناء التخطيط — تداخل يهدّد صدق الـ mutation

**(لازم يُقرأ قبل كتابة أي spec — بيغيّر تصميم التأكيدات)**

الـ retry بيتم بـ `client(config)` — **استدعاء كامل**، يعني **الـ request interceptor
(`client.ts:49-55`) بيشتغل تاني** ويكتب:
```ts
config.headers.Authorization = `Bearer ${useAuthStore.getState().accessToken}`;
```
والـ store **اتحدّث بالفعل** بالتوكن الجديد في `refreshAccessToken` (`client.ts:65`)
**قبل** الـ retry.

**⇒ التوكن الجديد بيوصل الطلب المُعاد عبر مسارين مستقلين:**

| المسار | السطر | فاعل؟ |
|---|---|---|
| (أ) الإسناد المباشر قبل الـ retry | `client.ts:101` | **مُتجاوَز** — الـ request interceptor بيكتب فوقه |
| (ب) store ⇒ request interceptor | `client.ts:65` → `client.ts:50-52` | ✅ **هو الفاعل الحقيقي** |

## الأثر المباشر على المختبر (قاعدة #5ب)

**تعطيل `client.ts:101` وحده ⇒ MVT-1 يفضل أخضر** — والـ mutation تبقى **كاذبة**:
تقرير بيقول «الـ spec بيعضّ» وهو ما عضّش. ده **بالظبط** نمط false-confidence اللي
قاعدة #4 موجودة عشانه.

**⇒ إلزامي: mutation target الصحيح لـ MVT-1 هو `client.ts:65`** (`setAccessToken`)،
لأنه الفاعل الأعمق. مُثبَّت مسبقاً في جدول الـ mutation تحت — **مش متروك لاجتهاد المختبر**.

## الحكم على السطر 101 نفسه

**ليس bug** (السلوك النهائي صحيح) — لكنه **سطر بيوحي بضمانة هو مش مصدرها**. قارئ
بيفترض إنه الحارس، والـ mutation عليه بترجع خضراء ⇒ يُستنتَج «مغطّى» وهو غير مغطّى.
**يُسجَّل كملاحظة معمارية (`WEB-S2-TOKENDUP-001`) — بلا تعديل** (النطاق تغطية فقط).

---

# 🔴 gap حقيقي مُكتشَف في `client.ts` — يُرفَع ولا يُصلَح

## `WEB-S2-DBLMAP-001` — double-mapping بيمسح `code` و `message` الحقيقيين 🟡 MEDIUM

**السلسلة (بالأسطر):**
1. `auth-client.ts:73-80` — `refresh()` في الـ catch بيعمل `throw mapAuthError(e)`
   ⇒ بيرمي **`AuthError` مسطّح**: `{ code, message, requestId?, errors? }`.
2. `client.ts:106` — الـ interceptor بيمسك الرمية دي ويعمل **`mapAuthError` تاني**.
3. `map-auth-error.ts:52-73` — الـ input بقى `AuthError` **مالوش `.response` ولا `.request`**
   ⇒ الفرع الأول (`err.response?.data`) بيسقط، والتاني (`err.request !== undefined`)
   بيسقط ⇒ **يرجع الـ fallback**:
   ```ts
   { code: "UNKNOWN", message: "حدث خطأ غير متوقع — حاول مجدداً" }
   ```

**الأثر:** على **كل** فشل refresh طرفي، الـ caller بياخد `UNKNOWN` + رسالة عامة —
والـ `code` الحقيقي (`UNAUTHORIZED` / `TOKEN_EXPIRED` / `NETWORK`) والرسالة العربية
من الـ backend **بيتدمّروا**. المستخدم بيشوف «حدث خطأ غير متوقع» بدل سبب حقيقي.

**⚠️ الأخطر — العلاقة المباشرة بـ `R-3`:** الـ fix المقترح لـ R-3 هو إن الـ RouteGuard
**يفرّق** بين terminal-auth و transient بقراءة **نوع** الخطأ بدل `isError` boolean.
البند ده بيقول إن المعلومة دي **مُدمَّرة قبل ما توصل الـ guard** على مسار فشل الـ refresh.
⇒ **`WEB-S2-DBLMAP-001` مُتطلَّب سابق لـ `R-3`** — R-3 غير قابل للتنفيذ الكامل قبله.

**الـ Fix (لجلسة لاحقة — ليس هنا):** يا إمّا `client.ts:106` يرمي `refreshError` كما هو
(لأنه **مُطبَّع بالفعل**)، أو `mapAuthError` يبقى idempotent (يرجّع الـ input لو هو
`AuthError` صالح). التاني أمتن — بيقفل النمط لكل المستهلكين لا لموضع واحد.

**لماذا لا يُصلَح في هذه الـ session:** (1) قيد المستخدم الصريح، (2) تغيير سلوكي
بيمسّ `map-auth-error` = طبقة **مستهلكوها أوسع من `client.ts`** (auth-client + كل
الـ hooks) ⇒ يحتاج plan خاص + regression pass، (3) الـ session تغطية.

---

## الحل المقترح

### المرحلة 1: ملف الـ spec + الـ harness المشترك
- **الملف:** `apps/web/src/lib/api/client.spec.ts` 🆕 (env: **node** — بلا DOM؛
  `clearAuthHint` محروس بـ `typeof document === "undefined"`، ونفس نمط
  `projects-client.spec.ts` القائم)
- **الـ harness:** `client.defaults.adapter = vi.fn(...)` — **نفس** النمط المستعمل في
  `projects-client.spec.ts:19-26` و `route-guard.spec.tsx:71`. **صفر بنية جديدة**
  (WEB-S1-004 خارج النطاق).
- **حدود الـ mock (DP4):** الـ **transport فقط** + `authClient.refresh`. الـ interceptors
  الحقيقية والـ store الحقيقي والـ `mapAuthError` الحقيقي **بيشتغلوا كلهم**.
- **أدوات إلزامية:**
  - `scriptedAdapter(...responses)` — بيرجّع رد مختلف لكل استدعاء بالترتيب،
    و**بيسجّل الـ config الوارد كاملاً** في `calls[]` (عشان التأكيد على الـ header
    والـ `_retry` من **الوسيطة** لا من النتيجة).
  - **`afterEach` بيصفّي `refreshInFlight`:** المتغيّر module-level (`client.ts:58`)
    **بيتسرّب بين الـ specs**. الضمانة: كل spec بيـ await وصول كل الـ promises
    لحالة نهائية + `useAuthStore.getState().clear()` + استرجاع الـ adapter.
- **الـ Risks:** لو الـ adapter اتساب متغيّراً ⇒ تسميم كل الـ suite. التخفيف:
  `originalAdapter` محفوظ + `afterEach` غير مشروط.

### المرحلة 2: MVT-1 — الفرع الناجح end-to-end 🔴 **جوهر R-1**
- 401 على الطلب الأول ⇒ `authClient.refresh` بيرجّع `"NEW"` ⇒ retry ⇒ **200 + data**.
- **التأكيدات (على الوسيطة، لا النتيجة — ضد نمط S7):**
  1. الـ caller بياخد الـ data الصح (`result` = محتوى الـ envelope).
  2. `adapter.calls.length === 2`.
  3. `calls[0].headers.Authorization === "Bearer OLD"` ← **byte-for-byte**.
  4. `calls[1].headers.Authorization === "Bearer NEW"` ← **byte-for-byte، أعمق تأكيد**.
  5. `useAuthStore.getState().accessToken === "NEW"` (paired assertion على الـ store).
  6. `refreshSpy` اتنادى **مرة واحدة**.
- **الـ Risks:** التأكيد على `result` وحده كان هيعدّي حتى لو الـ retry بعت `OLD` —
  التأكيد #4 هو اللي بيعضّ.

### المرحلة 3: MVT-2 — 🔴 canary الـ `_retry` propagation
- نفس السيناريو، والتأكيد المباشر: `calls[1]._retry === true` **و** `calls[0]._retry`
  falsy — من الـ config اللي **وصل الـ transport**، لا من متغيّر محلي في الـ spec.
- تعليق إلزامي في الـ spec: *«لو الـ spec ده سقط بعد ترقية axios ⇒ `mergeConfig`
  بطّل يـ propagate المفاتيح غير المعروفة ⇒ refresh loop. راجع
  `mergeConfig.js:101` في النسخة الجديدة قبل أي تعديل على الـ spec.»*
- **الـ Risks:** لو الـ propagation مكسور **النهاردة** ⇒ MVT-2 و MVT-3 هيسقطوا معاً
  ⇒ **gap حقيقي**: يُوثَّق ويُرفَع، **ولا يُصلَح** (قيد المستخدم + شرط ترقية Deep في الـ scope).

### المرحلة 4: MVT-3 — retry واحد بالظبط (لا loop)
- 401 ⇒ refresh ينجح ⇒ **الـ retry بيرجع 401 كمان** ⇒ terminal.
- **التأكيدات:**
  1. `refreshSpy` **مرة واحدة** (مش اتنين) ← الحارس الأهم ضد الـ loop.
  2. `adapter.calls.length === 2` بالظبط ← **سقف عددي**؛ الـ loop بيبان كتجاوز صريح.
  3. teardown: `accessToken === null` و `user === null`.
  4. الـ promise **مرفوض** (مش resolve صامت).
- **الـ Risks:** لو حصل loop حقيقي، الـ spec ممكن يعلّق بدل ما يسقط. التخفيف:
  الـ adapter **بيرمي `Error("LOOP: transport called >2 times")`** من الاستدعاء التالت
  ⇒ فشل صريح فوري بدل timeout غامض.

### المرحلة 5: MVT-4 — لا stampede (concurrency)
- **3** طلبات متزامنة (`Promise.all`) كلها بتـ 401، وكلها بتنجح بعد refresh **واحد**.
- **قرار تصميمي إلزامي — deferred promise:** `authClient.refresh` بيرجّع promise
  **مُتحكَّم فيه يدوياً** (`resolve` خارجي)، **لا** promise فورية. السبب: لو الـ refresh
  اتحلّت في نفس الـ microtask، ممكن الطلبات التلاتة تمرّ **بالصدفة** (أو الـ spec
  يعدّي لأسباب توقيت لا لأن الـ singleton شغّال) ⇒ **spec بيوصف بدل ما يعضّ**.
  الـ deferred بيثبّت النافذة: نضمن وصول التلاتة لنقطة الـ 401 **قبل** حلّ الـ refresh.
- **التأكيدات:** `refreshSpy` **مرة واحدة** بالظبط؛ التلات نتايج **متمايزة وصحيحة**
  (كل طلب بياخد data بتاعه — ضد اختلاط الـ configs)؛ `adapter.calls.length === 6`.
- **الـ Risks:** أعلى spec عرضةً للهشاشة. التخفيف: الـ deferred + صفر `setTimeout`
  + صفر اعتماد على ترتيب الـ microtasks.

### المرحلة 6: التحقق + الرفع
- `npx vitest run` كامل — **الـ stdout الحرفي** في التقرير (قاعدة #8).
- `npx tsc --noEmit` — مقارنة بالـ baseline (WEB-TSC-001/002 + WEB-STORE-001).
  **العدد المتوقَّع 5** (متسجّل في backlog). أي زيادة = انحراف.
- تحديث `BACKLOG.md`: R-1 ⇒ DONE + تسجيل `WEB-S2-DBLMAP-001` و `WEB-S2-TOKENDUP-001`.

---

## جدول الـ Mutation المُثبَّت مسبقاً (قاعدة #5ب — إلزامي للمختبر)

**مثبَّت هنا لا في اجتهاد المختبر**، لأن اختيار الهدف الغلط بينتج mutation كاذبة (فوق).

| # | الـ Spec | 🎯 الهدف المُعطَّل | السقوط المتوقَّع | ملاحظة |
|---|---|---|---|---|
| M1 | MVT-1 | **`client.ts:65`** — احذف `setAccessToken(res.accessToken)` | **MVT-1 وحده** | 🔴 **لا تعطّل `client.ts:101`** — متجاوَز، والـ mutation هتطلع كاذبة |
| M2 | MVT-2 + MVT-3 | `client.ts:100` — احذف `config._retry = true` | **الاتنين معاً** | **اقتران مقصود مُعلَن**: نفس القيد على عمقين (آلية/سلوك). سقوط MVT-1 أو MVT-4 معاهم = اقتران **زائف** ⇒ يُبلَّغ |
| M3 | MVT-4 | `client.ts:61` — خلّي `refreshInFlight` يتسند بلا شرط (شيل `if (!refreshInFlight)`) | **MVT-4 وحده** | لو MVT-1 سقط كمان ⇒ MVT-1 بيقيس الـ singleton بلا قصد |

**النسبة:** mutation على **4 من 4** (100%) — لا عيّنة، لا استنتاج.

---

## الـ Skills المطلوبة
- `apps/web/AGENTS.md` — «This is NOT the Next.js you know». **لا ينطبق مباشرةً**:
  صفر Next API في الـ spec (node env، بلا render، بلا router). مذكور للاكتمال.

---

## نقاط القرار (تحتاج موافقتك)

1. **`WEB-S2-DBLMAP-001` — نوثّق فقط، بلا spec.**
   **التوصية: توثيق فقط.** الـ characterization spec هيثبّت **سلوكاً خاطئاً** كعقد
   أخضر؛ ولما ييجي الإصلاح هيسقط ويُقرأ كـ regression. الأصح: spec يتكتب **مع**
   الإصلاح في جلسته. *(لو تفضّل spec مُعلَّم `it.skip` + TODO ⇒ قول وهيتضاف.)*

2. **MVT-2 (canary الـ `_retry`) spec مستقل، مش تأكيد جوّه MVT-3.**
   **التوصية: مستقل.** الفصل هو اللي بيخلّي رسالة الفشل تفرّق بين «axios اتغيّر»
   و«منطقنا اتكسر» — وده كل قيمة الـ canary.

3. **الـ mutation targets مُثبَّتة في الخطة لا متروكة للمختبر.**
   **التوصية: مثبَّتة** (الجدول فوق) — الاكتشاف بتاع التداخل بيثبت إن الهدف
   «الأوضح» (سطر 101) هو الهدف **الخطأ**.

---

## التأثير على الـ Codebase الحالي

| الملف | التغيير |
|---|---|
| `apps/web/src/lib/api/client.spec.ts` | 🆕 4 specs |
| `apps/web/src/lib/api/client.ts` | **صفر تعديل** — أي تعديل انحراف يوقف الـ session |
| `apps/web/src/lib/api/*` الباقي | صفر |
| `.claude/sessions/BACKLOG.md` | تحديث حالة + بندين جديدين |

---

## تعريف النجاح

- [ ] MVT-1: الفرع الناجح — `Bearer NEW` مُتحقَّق **على الـ transport** byte-for-byte
- [ ] MVT-2: `_retry === true` واصل الـ transport في المحاولة الثانية (canary axios)
- [ ] MVT-3: `refresh` مرة واحدة + سقف `calls === 2` + teardown + رفض
- [ ] MVT-4: 3 متزامنة ⇒ `refresh` **مرة واحدة** + 3 نتايج متمايزة صحيحة
- [ ] **MVT: 4 specs مكتوبة وpassing** (إجباري — قاعدة #3)
- [ ] **Mutation: 3 عمليات على 4/4 specs، بالجدول المُثبَّت، بلا سقوط جانبي** (قاعدة #5ب)
- [ ] الـ suite الكامل passing، صفر regression، **stdout حرفي** (قاعدة #8)
- [ ] `tsc` = **5 أخطاء baseline** بالظبط، صفر جديد
- [ ] `client.ts` **غير معدَّل** — مُتحقَّق بـ `git diff`
- [ ] `WEB-S2-DBLMAP-001` + `WEB-S2-TOKENDUP-001` مُسجَّلان في `BACKLOG.md`

---

## بنود مُسلَّمة — تحتاج إغلاقاً صريحاً (قاعدة #10)

| # | البند | الدور المستهدَف |
|---|---|---|
| 1 | جدول الـ mutation المُثبَّت — **لا تعطّل `client.ts:101`** لـ MVT-1 | 🧪 المختبر |
| 2 | الاقتران المقصود M2 (MVT-2 + MVT-3 يسقطوا معاً) — يُعلَن لا يُعامَل كخلل | 🧪 المختبر |
| 3 | `WEB-S2-DBLMAP-001` — توثيق بلا إصلاح + تسجيله كـ **متطلَّب سابق لـ R-3** | 💻 المبرمج (تسجيل) |
| 4 | `WEB-S2-TOKENDUP-001` (سطر 101 متجاوَز) — ملاحظة معمارية بلا تعديل | 💻 المبرمج (تسجيل) |
| 5 | تسريب `refreshInFlight` بين الـ specs — تنظيف مُثبَت في `afterEach` | 💻 المبرمج |
| 6 | لو الـ `_retry` propagation طلع **مكسوراً النهاردة** ⇒ gap حقيقي: يوقف ويُرفَع، بلا إصلاح | 💻 المبرمج ثم 🧪 المختبر |
| 7 | `R-2` (red-team على `client.ts`) — **يظل مفتوحاً**، الـ session ما بتقفلوش | 📋 خارج الـ session |

---
⏸️ AWAITING APPROVAL
رد بـ "approve" للمتابعة أو "edit: [تعديل]" للتعديل

✋ تم المخطط — للدور التالي (💻 المبرمج)؟
