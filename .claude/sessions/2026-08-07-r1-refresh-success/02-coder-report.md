# تقرير المبرمج — R-1

## البنود المُستلَمة (قاعدة #10)

من `00-plan.md` → «بنود مُسلَّمة». البنود 1 و 2 مُوجَّهة للمختبر — أُبقيت مفتوحة له صراحةً،
لم تُقفَل هنا.

| # | البند | الحالة |
|---|---|---|
| 1 | جدول الـ mutation — **لا تعطّل `client.ts:101`** لـ MVT-1 | **أُحيل إلى 🧪 المختبر** — هدفه؛ عُزِّز بتسجيل `WEB-S2-TOKENDUP-001` في الـ backlog ليبقى الهدف الخطأ موثَّقاً خارج ملفات الـ session |
| 2 | الاقتران المقصود M2 (MVT-2 + MVT-3 معاً) | **أُحيل إلى 🧪 المختبر** — لا فعل للمبرمج |
| 3 | تسجيل `WEB-S2-DBLMAP-001` + ربطه كمتطلَّب سابق لـ R-3 | ✅ **قُبل ونُفِّذ** — `BACKLOG.md`، قسم «Session R-1 — Tickets مضافة». **بلا إصلاح** |
| 4 | تسجيل `WEB-S2-TOKENDUP-001` (سطر 101 متجاوَز) | ✅ **قُبل ونُفِّذ** — نفس القسم. **بلا تعديل على الكود** |
| 5 | تنظيف تسريب `refreshInFlight` في `afterEach` | ✅ **قُبل ونُفِّذ** — `client.spec.ts` `afterEach` بيـ drain الـ microtasks قبل استرجاع الـ adapter |
| 6 | لو `_retry` propagation مكسور ⇒ يوقف ويُرفَع | ✅ **قُبل — والنتيجة: غير مكسور.** MVT-2 أخضر ⇒ الـ propagation شغّال في axios 1.15.0. **لا gap، لا وقفة** |
| 7 | `R-2` يظل مفتوحاً | ✅ **قُبل** — صفر عمل عليه، صفر ادّعاء بإغلاقه |

---

## المرحلة 1: ملف الـ spec + الـ harness — ✅

**الملفات المعدّلة:**
- `apps/web/src/lib/api/client.spec.ts` — 🆕 (env: node، بلا DOM)

**اللي اتعمل:**
- `recordingAdapter(handler)` — بيسجّل كل config واصل للـ transport + **snapshot بالقيمة**
  لـ `Authorization` و `_retry` **لحظة الاستدعاء**.
- `authHeaderOf(config)` — بيقرأ الـ header سواء كان `headers` كائناً عادياً أو
  `AxiosHeaders` (بلا افتراض شكل واحد).
- `reject401(config)` / `ok(config, data)` — أشكال axios حقيقية مع envelope الـ backend.
- `flushMicrotasks(20)` — تقديم طابور الـ microtasks **بلا أي timer** (السلسلة كلها
  promise-only) ⇒ حتمية بلا اعتماد على ساعة.
- `deferred<T>()` — promise متحكَّم فيه يدوياً لتثبيت نافذة الـ concurrency.
- `afterEach` بيعمل `flushMicrotasks()` **قبل** استرجاع الـ adapter، فأي refresh معلّق
  يوصل لـ `.finally` اللي بيصفّر `refreshInFlight` (`client.ts:58`).

**انحرافات عن الـ Plan:** لا يوجد.

---

## المرحلة 2: MVT-1 — الفرع الناجح end-to-end — ✅

الستة تأكيدات المنصوص عليها في الخطة، منها الأعمق:
`authHeaders[0] === "Bearer OLD_TOKEN"` و `authHeaders[1] === "Bearer NEW_TOKEN"` —
**من الوسيطة اللي وصلت الـ transport، byte-for-byte** — بالإضافة لـ paired assertion
على الـ store (`accessToken === NEW`) و `refresh` مرة واحدة.

**انحرافات عن الـ Plan:** لا يوجد.

---

## المرحلة 3: MVT-2 — canary الـ `_retry` propagation — ✅

**🔴 النتيجة (جوهر الـ session): الـ propagation شغّال — والـ spec دلوقتي حارسه.**
`retryFlags[1] === true` من الـ config اللي **وصل الـ transport فعلاً** في المحاولة الثانية
⇒ `mergeConfig` في axios **1.15.0** بيمرّر المفاتيح غير المعروفة، مطابقاً للقراءة الساكنة
في `00-plan.md` قسم (ب). **صفر gap. صفر تعديل مطلوب على `client.ts`.**

الـ spec فيه تعليق تشخيصي صريح: لو سقط بعد ترقية axios ⇒ الـ propagation اتكسر ⇒
refresh loop، والمطلوب قراءة `mergeConfig.js` في النسخة الجديدة **لا تخفيف التأكيد**.

### 🔴 انحراف #1 — عن الـ Plan، مكتشَف بفشل حقيقي أثناء التنفيذ

**الخطة نصّت (المرحلة 3):** «يقرأ `_retry` من الـ config اللي وصل الـ transport».
نُفِّذ حرفياً في المحاولة الأولى — `expect(t.configs[0]._retry).toBeFalsy()` — **وسقط**:

```
AssertionError: expected true to be falsy
- Expected: false
+ Received: true
 ❯ src/lib/api/client.spec.ts:202:33
```

**السبب — وهو الجزء المهم:** الـ config بتاع المحاولة الأولى **هو نفس الكائن** اللي
الـ interceptor بيحقن فيه `config._retry = true` (`client.ts:100`)، لأن `error.config`
هو الكائن اللي الـ transport اتسلّمه. فالاحتفاظ بـ **مرجع** وقراءته بعدين بيوصف
**لحظة تانية غير لحظة الإرسال**.

**الإصلاح:** snapshot **بالقيمة** لحظة الاستدعاء (`retryFlags[]`) — نفس انضباط
`authHeaders[]`.

**⚠️ ليه ده مش تفصيلة تجميلية:** الاتجاه اللي ظهر كان الـ **حميد** (false-negative:
الـ spec سقط وهو المفروض ينجح). الاتجاه المعاكس هو الخطر: أي تأكيد **مرجعي** على
كائن بيتحوّر لاحقاً يقدر يـ **ينجح لسبب غلط**. القاعدة اللي طلعت من هنا:
**كل تأكيد على «إيه اللي اتبعت» لازم يُلتقَط لحظة الإرسال، مش يُقرأ من مرجع باقٍ.**
مسجَّل للمختبر تحت.

---

## المرحلة 4: MVT-3 — retry واحد بالظبط — ✅

401 ⇒ refresh ينجح ⇒ الـ retry بيرجع 401 ⇒ terminal. التأكيدات: `refresh` **مرة واحدة**،
`count === 2` (سقف عددي)، teardown حقيقي (`accessToken`/`user` = null بعد ما كان `NEW`)،
والـ promise **مرفوض** بـ `code: "UNAUTHORIZED"`.

الـ adapter **بيرمي `LOOP: transport called N times, expected 2`** من الاستدعاء التالت ⇒
لو حصل loop حقيقي بيبان كفشل صريح فوري بدل تعليق حتى الـ timeout.

**انحرافات عن الـ Plan:** لا يوجد.

---

## المرحلة 5: MVT-4 — لا stampede — ✅

3 طلبات متزامنة (`/a`, `/b`, `/c`) كلها 401 مع refresh **مؤجّل** (`deferred`).
قبل فتح البوابة: `count === 3` و `refresh` **مرة واحدة** — يعني التلاتة وصلوا فرع
الـ 401 **قبل** أي حلّ للـ refresh (النافذة مثبَّتة، مش صدفة توقيت). بعد الفتح:
`refresh` **لسه مرة واحدة**، `count === 6`، وكل طلب رجع **نتيجته هو** (الـ payload
مفتاحه الـ url ⇒ أي تداخل بين الـ configs كان هيظهر كـ payload غلط)، والتلات retries
كلها حملت `Bearer NEW_TOKEN` على مستوى الـ transport.

**انحرافات عن الـ Plan:** لا يوجد.

---

## المرحلة 6: التحقق — ✅

### Vitest — الـ suite الكامل (literal stdout، قاعدة #8)

```
 RUN  v3.2.6 D:/tampalets/saas-one/apps/web

 ✓ src/lib/projects/map-form-to-create-input.spec.ts (5 tests) 7ms
 ✓ src/lib/auth/register-payload.spec.ts (2 tests) 6ms
 ✓ src/lib/api/idempotency-key.spec.ts (9 tests) 17ms
 ✓ src/lib/api/phases-client.spec.ts (2 tests) 10ms
 ✓ src/lib/api/client.spec.ts (4 tests) 21ms
 ✓ src/lib/api/projects-client.spec.ts (3 tests) 12ms
 ✓ src/lib/api/updates-client.spec.ts (5 tests) 16ms
 ✓ src/lib/api/map-auth-error.spec.ts (3 tests) 4ms
 ✓ src/lib/auth/decide-redirect.spec.ts (4 tests) 4ms
 ✓ src/store/use-auth-store.spec.ts (2 tests) 6ms
 ✓ src/lib/api/refresh-policy.spec.ts (4 tests) 4ms
 ✓ src/lib/hooks/use-project.spec.tsx (2 tests) 108ms
 ✓ src/lib/hooks/use-create-project.spec.tsx (1 test) 106ms
 ✓ src/components/auth/route-guard.spec.tsx (1 test) 68ms
 ✓ src/lib/hooks/use-projects.spec.tsx (1 test) 98ms

 Test Files  15 passed (15)
      Tests  48 passed (48)
   Start at  18:28:54
   Duration  3.92s (transform 673ms, setup 5.38s, collect 4.74s, tests 488ms, environment 8.72s, prepare 3.62s)
```

**baseline قبل الـ session: 14 ملف / 44 test.** بعدها: **15 / 48** ⇒ **+1 ملف، +4 tests،
صفر regression.**

### tsc (literal stderr) — `npx tsc --noEmit`، **EXIT=2**

```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ accessToken: null; user: null; pendingRegistration: null; setSession: ({ accessToken, user }: { accessToken: string; user: AuthUser; }) => void; setAccessToken: (accessToken: string) => void; setPendingRegistration: (pendingRegistration: PendingRegistration) => void; clearPendingRegistration: () => void; clear: ()...' but required in type 'AuthState'.
```

**5 أخطاء — مطابقة للـ baseline حرفاً بحرف** (WEB-TSC-001 ×2 + WEB-TSC-002 ×2 +
WEB-STORE-001 ×1). **صفر خطأ جديد.** الـ EXIT=2 هو حالة الـ baseline نفسها.

> **ملاحظة منهجية:** الـ baseline اتقاس **قبل** إنشاء أي ملف في الـ session (نفس الأمر،
> نفس الخمسة) — فالمقارنة ضد قياس فعلي لا ضد رقم منقول من الـ backlog.

### صفر تعديل على `client.ts` — مُتحقَّق

```
$ git status --short
?? .claude/sessions/2026-08-07-r1-refresh-success/
?? apps/web/src/lib/api/client.spec.ts

$ git diff --stat -- apps/web/src/lib/api/client.ts
[فارغ]
```

الملفان الوحيدان الجديدان **untracked**، و `client.ts` **غير مذكور إطلاقاً** ⇒ صفر تعديل
على أي ملف إنتاجي.

---

## ملخص نهائي

- المراحل المكتملة: **6/6**
- الملفات الجديدة: **1** (`client.spec.ts`) — صفر ملف إنتاجي معدَّل
- MVT: **4/4 مكتوبة وpassing** (الميزانية 4)
- انحرافات عن الـ Plan: **1** (انحراف #1 — snapshot بالقيمة بدل المرجع؛ مبرَّر بفشل حقيقي)
- gaps مرفوعة بلا إصلاح: **2** (`WEB-S2-DBLMAP-001`، `WEB-S2-TOKENDUP-001`)
- gaps مطلوبة اتضح إنها **غير موجودة**: `_retry` propagation ✅ سليم في axios 1.15.0
- الوقت التقديري: ~35 دقيقة

---

## بنود مُسلَّمة — تحتاج إغلاقاً صريحاً (قاعدة #10)

| # | البند | الدور المستهدَف |
|---|---|---|
| 1 | جدول الـ mutation المُثبَّت (M1 على `client.ts:65` **لا** 101؛ M2 على 100؛ M3 على 61) — تنفيذه كما هو | 🧪 المختبر |
| 2 | الاقتران المقصود M2 (MVT-2 + MVT-3 يسقطوا معاً) — **يُعلَن**، وسقوط MVT-1/MVT-4 معاهم = اقتران **زائف** يُبلَّغ | 🧪 المختبر |
| 3 | **درس انحراف #1:** التأكيدات المرجعية على configs بتتحوّر. لو المختبر ضاف أي تأكيد على «إيه اللي اتبعت» ⇒ لازم snapshot لحظة الإرسال | 🧪 المختبر |
| 4 | **الـ `LOOP:` throw في MVT-3 مش مُختبَر بذاته** — آلية أمان للـ spec ما اتشغّلتش (لأن مفيش loop). لو mutation M2 نجح، المتوقَّع إنها **هي** اللي تضرب: تأكيد جانبي إن آلية الأمان شغالة | 🧪 المختبر |
| 5 | `flushMicrotasks(20)` رقم **مُختار لا مُشتَق** — كفى هنا. لو ظهر flake مستقبلاً، السبب مرشَّح أول | 🧪 المختبر / sessions قادمة |
| 6 | حالة R-1 في `BACKLOG.md` + سطر الـ Updates log — **لسه ما اتكتبوش** عمداً (الـ session ما اتقفلتش) | 📋 عند إقفال الـ session |
| 7 | `R-2` (red-team على `client.ts`) — **مفتوح**. الـ session غطّت 3 فروع، **ما فحصتش** `error.config === undefined` ولا header injection | 📋 خارج الـ session |

✋ تم المبرمج — للدور التالي (🧪 المختبر)؟
