# تقرير المبرمج

**الـ session:** S7-ROLES-GATE — البوابتان (أ) و(ب)
**الـ Mode:** Quick (دور واحد)

---

## التغييرات

| # | الملف | التعديل |
|---|---|---|
| 1 | `apps/api/src/modules/finance/finance-roles.matrix.spec.ts` | **جديد** — spec دائم لمصفوفة الصلاحيات من الـ metadata (البوابة أ). 56 حالة |
| 2 | `apps/api/src/common/decorators/roles.decorator.ts` | `(...roles: string[])` → `(...roles: UserRole[])` + `import type { UserRole }` + تعليق يشرح الجذر ويمنع الالتفاف بـ `as UserRole` |
| 3 | `apps/api/src/common/guards/roles.guard.ts` | `getAllAndOverride<string[]>` → `<UserRole[]>` (المقارنة `user.role === role` بقت بين طرفين مُقيَّدين بنفس الـ enum) + تصحيح تعليق مضلِّل |
| — | `apps/api/src/common/decorators/current-user.decorator.ts` | **صفر تعديل** — `role: UserRole` منفَّذ سلفاً (A3). تفصيل تحت |

`git diff --stat`: ملفان معدَّلان، **26 سطر مضاف / 4 محذوفة** + ملف spec جديد. **صفر تعديل على أي controller** — تفصيل السبب في «نتيجة الـ sweep».

---

## المرحلة 1 — البوابة (أ): spec المصفوفة

**الملف:** `src/modules/finance/finance-roles.matrix.spec.ts` (56 حالة، كلها passing).

### الالتزام بتأكيدك الصريح
`PLANNED_MATRIX` **مكتوب حرفياً بالإيد** من جدول المرحلة 3 في
`.claude/sessions/2026-07-16-s7-financial-boq/00-plan.md` **سطور 128–136**.
صفر اشتقاق من `finance.controller.ts` أو من أي metadata. التحذير ده مكتوب
كـ header في الملف نفسه عشان يوصل للقارئ بعد ستة شهور، مش هنا بس.

قرار تفصيلي مرتبط: حقل `roles` في الـ interface نوعه **`string[]` متعمَّد لا `UserRole[]`**.
لو اتقيّد بالـ enum يبقى **الـ tsc** هو اللي بيفحص الجدول، والـ spec بيفحص
«متطابق مع نفسه». فحص صحة الأسماء لازم يجري على **الـ metadata وقت التشغيل**
عشان يفضل حارساً حياً حتى لو حد رجّع الـ decorator لـ `string[]` يوماً.

### طبقات الـ spec الأربع

**(1) الحصر — قبل أي مقارنة صفوف:**
- الـ 9 handlers بالظبط، لا زيادة ولا نقصان.
- **كل handler عليه `@Roles` غير فارغة.** ← دي أخطر حالة في الملف كله:
  `roles.guard.ts:35` بيرجّع `true` لما `requiredRoles` غير موجودة أو فاضية،
  يعني **handler جديد بلا `@Roles` = endpoint مالي مفتوح لكل دور مصادَق عليه**.
  الغياب مايظهرش في أي جدول صفوف — محتاج اختبار صريح على العدم.
- صفر `@Roles` على مستوى الـ class (اللي كانت هتوسّع بصمت).
- الـ controller base path = `/` (المسارات كاملة على الـ handlers).

**(2) الجدول التسعة صفاً صفاً** (`describe.each`): method + path + مجموعة الأدوار
+ منع التكرار + الـ HTTP status. مقارنة الأدوار **كمجموعة** (الترتيب بلا دلالة
أمنية) **مع فحص طول منفصل** (العدد له دلالة).

**(3) صحة أسماء الأدوار:**
- **أعمق طبقة قابلة للتمثيل (قاعدة #4):** ما اكتفيتش بـ `UserRole` المولَّد —
  الـ spec بيقرأ `prisma/schema.prisma` **نصياً**، بيستخرج بلوك `enum UserRole`
  بـ regex، وبيطابقه مع `Object.keys(UserRole)` ومع قائمة السبعة الـ literal.
  **السبب:** لو `prisma generate` فايت، الـ client بيحمل enum قديم وكل فحص
  مبني عليه بيوافق على أسماء ميتة. الاكتفاء بالمولَّد كان هيبقى نفس نمط
  false-confidence اللي الـ session دي جاية تقفله.
- كل اسم في الـ metadata عضو فعلي في `UserRole`.
- **assertion سالبة تثبت إن الفحص بيعضّ:** `ACCOUNTENT` (الـ typo الواقعي من S7)
  و`accountant` (lowercase) و`ADMIN` — التلاتة لازم يترفضوا. لو الشرط اتقلب
  سهواً (`has` بدل `!has`) الاختبار ده بيسقط فوراً.

**(4) ثوابت دلالية أعلى من الجدول** — الطبقة دي **مش زينة**، ودي أهم إضافة
تجاوزت الحد الأدنى المطلوب. الجدول بيثبّت **الحالة**؛ دي بتثبّت **القاعدة**:
- `CLIENT` قارئ فقط — صفر endpoint كتابة يسمح له.
- `WORKER` مستبعَد من الوحدة الماليّة بالكامل.
- `SUPER_ADMIN` مذكور صراحةً في كل endpoint (بلا اعتماد على bypass الحارس).
- تعديل الإعدادات الماليّة محصور في `SUPER_ADMIN` + `ACCOUNTANT`.

**ليه الطبقة دي ضرورية:** تعديل «مُتقن» على الصلاحيات — يغيّر الـ decorator
**ويحدّث الجدول معاه** — بيعدّي من طبقة (2) بالكامل. الثوابت هي اللي بتمسكه.
مُثبَت تجريبياً في mutation #3 تحت.

---

## Mutation check — إثبات إن الـ spec يعضّ لا يوصف

الـ Quick mode مايفرضش mutation (قاعدة #5ب = Standard/Deep)، لكن الملف ده
**حارس أمني بيستبدل سكربتاً عابراً**، و«56 passing» رقم عن الكمّ وحده.
**3 mutations على 100% من الطبقات (الحصر + الجدول + الثوابت):**

| # | الطفرة | المتوقَّع | الفعلي | اقتران زائف؟ |
|---|---|---|---|---|
| 1 | `@Roles('ACCOUNTENT')` على `getSettings` (typo واقعي) | صفّ الأدوار لـ `getSettings` + فحص الـ enum | **2 failed / 54 passed** — بالظبط الاتنين | ❌ صفر |
| 2 | حذف `@Roles` بالكامل من `createBOQItem` (endpoint مفتوح) | فحص الـ handler غير المحروس | **4 failed / 52 passed** | ❌ صفر — الأربعة كلهم كشف حقيقي لنفس العيب |
| 3 | `CLIENT` على `PATCH boq/:id` **+ تحديث الجدول معاه** | الثوابت وحدها | **1 failed / 55 passed** — «CLIENT قارئ فقط» وحده | ❌ صفر |

**قراءة النتائج:**
- **mutation 1** أثبت إن الطبقتين (2) و(3) مستقلتان: الـ typo كشفه الاتنين
  بمعزل عن بعض، بلا سقوط جانبي في أي من الـ 54 الباقية.
- **mutation 2** أنتج 4 سقوطات، والأربعة **كشف مشروع لنفس العيب** لا اقتران
  زائف: الحصر (`@Roles` غايبة)، صفّ الأدوار، فحص التكرار، وثابت `SUPER_ADMIN`.
  ⚠️ **ملاحظة دقّة:** فحص التكرار سقط بـ **TypeError** (`undefined.length`) مش
  بـ assertion — مقبول (الاختبار سقط والعيب اتكشف) لكنه رسالة أقل وضوحاً من
  المفروض. **مسجَّل تحت كبند مُسلَّم.**
- **mutation 3 هي النتيجة الأهم:** تعديل صلاحية **متّسق مع الجدول** عدّى من
  طبقة (2) بالكامل — وسقط في الثوابت وحدها. ده الدليل التجريبي إن الطبقة
  الرابعة مش تزيّد.

الـ 3 mutations اتراجعوا بـ `git checkout --` والتحقق بعد كل واحدة إن الشجرة
رجعت نظيفة.

---

## المرحلة 2 — البوابة (ب): API-ROLES-001 + A3

### (ب-1) `@Roles` — تنفيذ فعلي
```ts
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```
`import type` (مش قيمة) ⇒ صفر أثر على الـ runtime bundle.

### (ب-2) `JwtPayload.role` — ⚠️ **منفَّذ سلفاً، صفر كود في الـ session دي**
`current-user.decorator.ts:14` فيه `role: UserRole` **بالفعل** — أُغلق في
**Session 1.8 Part 2 (2026-05-24)**، والـ Updates log في `BACKLOG.md` سطر 474
بيوثّق ده صراحةً. بس البند فضل مذكوراً في البوابة (ب) لأنه **ما اتشطبش هناك**.

🔴 **ده بالظبط نمط P-1b مقلوباً:** بند **مقفول** فضل مفتوح في السجل. الخطر مش
شغل مكرَّر — الخطر إن قارئ البوابة يفترض إن الشق ده لسه محتاج تنفيذ، أو —
أسوأ — يفترض إن المذكور في البوابة = المطلوب فعلاً بلا تحقق. **اتحقّقت بالقراءة
المباشرة قبل ما ألمس أي حاجة.**

### (ب-3) `RolesGuard` — إضافة مُبلَّغة، مبرَّرها من نص الـ ticket نفسه
الـ scope وسم `roles.guard.ts` كـ «احتمالي فقط: تعليق». عملت فيه **تعديلين**:

1. **تصحيح التعليق (سطر 4):** كان `@Roles('super_admin', 'project_manager')` —
   أسماء **lowercase غير موجودة في `enum UserRole` إطلاقاً**. مش سهو تجميلي:
   قبل التقييد، أي واحد ينقل التعليق حرفياً كان بيحصل على **endpoint مقفول على
   الجميع بصمت** (الـ 403 الغامض في نص API-ROLES-001 بالظبط). التعليق كان
   **وصفة للثغرة اللي الـ session دي بتقفلها.**
2. **`getAllAndOverride<UserRole[]>` بدل `<string[]>`:** ده **مذكور حرفياً في نص
   الـ ticket** في `BACKLOG.md` سطر 323 — «والمقارنة بينهما في `RolesGuard` تبقى
   type-safe». بدونه الـ decorator والـ JWT مُقيَّدان والمقارنة بينهما لسه
   `string` مقابل `UserRole` ⇒ **الحلقة مش مقفولة**.

**تصنيفه:** توسيع مُعلَن داخل نطاق البوابة (ب)، لا انحراف — النص المرجعي طلبه.
تُترك للمراجع.

---

## 🔴 نتيجة الـ sweep — الفحص الشامل للـ 68 استعمال

`npx tsc -p tsconfig.build.json --noEmit` بعد التضييق = **EXIT 0**.

**الترجمة الدقيقة: صفر typo قائم في كل الـ 68 استعمال عبر 12 controller.**
مش «مفيش حاجة اتكسرت» — **كل اسم دور في كل `@Roles` في الـ repo اتحقق منه
الـ compiler وطلع صحيحاً.** ده النتيجة، مش غيابها.

| المستهلك | عدد `@Roles` | الحالة |
|---|---|---|
| `users.controller.ts` | 9 | ✅ |
| `sub-contractors.controller.ts` | 8 | ✅ |
| `updates.controller.ts` | 10 (منها **5 spread من ثوابت**) | ✅ |
| `media.controller.ts` | 5 (كلها متعددة الأسطر) | ✅ |
| `projects.controller.ts` | 6 | ✅ |
| `phases.controller.ts` | 5 | ✅ |
| `payments.controller.ts` | 5 | ✅ |
| `finance.controller.ts` | 9 | ✅ |
| `companies.controller.ts` | 3 | ✅ |
| `comments.controller.ts` | 1 | ✅ |
| `chat.controller.ts` | 1 | ✅ |
| `audit.controller.ts` | 1 | ✅ |

**المرشّح الأول للانكسار — `updates.controller.ts:38,47`:** `FIELD_ROLES` و
`VIEWER_ROLES` ثابتان بـ `as const` بيتعملهم spread في `@Roles(...FIELD_ROLES)`.
عدّوا نظيفين لأن `as const` بينتج literal types والسبعة كلهم أعضاء صالحون.
لو كان فيهم اسم واحد غلط ⇒ 5 أخطاء دفعة واحدة. **الـ `as const` نجّاهم — ولو
كانوا `string[]` عاديين كانوا هيعدّوا بلا فحص إطلاقاً حتى بعد التضييق.**

### ⚠️ ليه «EXIT 0» وحده ما كانش يثبت أي حاجة

EXIT 0 متوافق تماماً مع سيناريو «التضييق ما اشتغلش أصلاً». فعملت **paired
assertion (قاعدة #4) على الـ tsc نفسه** — حقنت `'ACCOUNTENT'` في
`finance.controller.ts:62` وأعدت التشغيل:

```
src/modules/finance/finance.controller.ts(62,25): error TS2345: Argument of type '"ACCOUNTENT"' is not assignable to parameter of type 'UserRole'.
TSC-BUILD EXIT: 2
```

**الرسالة بتحدّد الملف والسطر والعمود واسم النوع.** ده اللي بيحوّل «صفر أخطاء»
من غياب إشارة إلى **دليل**. الطفرة اتراجعت والـ tsc رجع EXIT 0.

---

## Verification (literal) — قاعدة #8

### الـ baseline قبل أي تعديل
```
$ npx tsc -p tsconfig.build.json --noEmit
TSC-BUILD EXIT: 0
```
```
$ npx tsc -p tsconfig.json --noEmit
TSC-FULL EXIT: 0
```
```
$ npx jest --silent
Test Suites: 2 failed, 26 passed, 28 total
Tests:       14 failed, 353 passed, 367 total
Snapshots:   0 total
Time:        49.13 s
```

### الـ spec الجديد وحده
```
$ npx jest --silent src/modules/finance/finance-roles.matrix.spec.ts
Test Suites: 1 passed, 1 total
Tests:       56 passed, 56 total
Snapshots:   0 total
Time:        6.203 s
```

### بعد كل التعديلات
```
$ npx tsc -p tsconfig.build.json --noEmit
TSC-BUILD EXIT: 0
```
```
$ npx tsc -p tsconfig.json --noEmit
TSC-FULL EXIT: 0
```
```
$ npx nest build
NEST-BUILD EXIT: 0
```
```
$ npx jest --silent
FAIL src/common/config/env-validation.spec.ts (11.025 s)
FAIL src/modules/audit/audit-log.service.spec.ts (12.217 s)
Test Suites: 2 failed, 27 passed, 29 total
Tests:       14 failed, 409 passed, 423 total
Snapshots:   0 total
Time:        21.461 s, estimated 44 s
```

### mutation runs (literal)
```
mutation 1 — @Roles('ACCOUNTENT') على getSettings
Tests:       2 failed, 54 passed, 56 total
  ● … GET projects/:projectId/financial-settings → getSettings › مجموعة الأدوار مطابقة للخطة بالظبط
  ● … صحة أسماء الأدوار مقابل enum UserRole › كل اسم دور في الـ metadata عضو فعلي في UserRole (يمسك أي typo)
```
```
mutation 2 — حذف @Roles من createBOQItem
Tests:       4 failed, 52 passed, 56 total
  ● … POST projects/:projectId/boq → createBOQItem › مجموعة الأدوار مطابقة للخطة بالظبط
  ● … POST projects/:projectId/boq → createBOQItem › مفيش دور مكرَّر داخل نفس الـ handler
  ● … ثوابت الصلاحيات الماليّة › SUPER_ADMIN مذكور صراحةً في كل endpoint (لا اعتماد على bypass الحارس)
  ● … حصر الـ handlers › كل handler عليه @Roles غير فارغة (الغياب = endpoint مفتوح لكل الأدوار)
```
```
mutation 3 — CLIENT على PATCH boq/:id + تحديث الجدول معاه
Tests:       1 failed, 55 passed, 56 total
  ● … ثوابت الصلاحيات الماليّة › CLIENT قارئ فقط — صفر endpoint كتابة يسمح له
```
```
paired assertion على الـ tsc — @Roles('ACCOUNTENT')
src/modules/finance/finance.controller.ts(62,25): error TS2345: Argument of type '"ACCOUNTENT"' is not assignable to parameter of type 'UserRole'.
TSC-BUILD EXIT: 2
```

### قراءة الـ 14 الفاشلة
**هي نفسها الـ baseline الموروث بالظبط** — نفس الـ 2 suites
(`env-validation.spec.ts` + `audit-log.service.spec.ts` = **TEST-BASELINE-001**)
ونفس العدد **قبل وبعد**. الـ session دي ما لمستش أي منهما.
**صفر regression:** 353 → **409 passing** (+56 = الـ spec الجديد بالظبط)،
367 → 423 total. الزيادة كلها في العمود الأخضر.

---

## حالة معايير النجاح (من `00-scope.md`)

| المعيار | الحالة |
|---|---|
| spec يقرأ `Reflect.getMetadata('roles')` للـ 9 handlers ويثبّت الجدول | ✅ 56 حالة، الجدول literal من الخطة |
| يمسك typo / دور غير موجود / تكرار | ✅ + assertion سالبة + **مُثبَت بـ mutation 1** |
| assertion أعمق: الـ enum مقابل `schema.prisma` نصياً | ✅ regex على بلوك `enum UserRole` |
| `Roles = (...roles: UserRole[])` | ✅ |
| `JwtPayload.role: UserRole` | ✅ **متحقَّق — منفَّذ سلفاً في Session 1.8 Part 2، صفر كود هنا** |
| `tsc -p tsconfig.build.json` = EXIT 0 | ✅ + **مُثبَت أنه يعضّ** (EXIT 2 على typo محقون) |
| `tsc -p tsconfig.json` = صفر خطأ جديد | ✅ EXIT 0 (قبل وبعد) |
| `jest` صفر regression + baseline بالظبط | ✅ 14 failed هي نفسها، +56 أخضر |
| verification literal (قاعدة #8) | ✅ فوق |

**9/9 مستوفاة.**

---

## بنود مُسلَّمة — تحتاج إغلاقاً صريحاً

> الـ Quick mode دور واحد ⇒ القاعدة #10 لا تنطبق إجرائياً (مفيش دور مستقبِل).
> البنود دي **موجَّهة للمستخدم/الـ BACKLOG**، متروكة صراحةً بدل ما تموت بالصمت.

1. **تحديث `BACKLOG.md`** — شطب البوابتين (أ) و(ب) من `S7-ROLES-GATE`، شطب
   `API-ROLES-001`، **وشطب `A3` مع تصحيح إنه كان مقفولاً من 2026-05-24** +
   سطر في الـ Updates log. **لم أعدّله — تعديل السجل قرار المستخدم.**
2. **`@Roles` على `boq/:id` مكرَّر بين `PATCH` و`DELETE`** — الـ spec بيميّز
   بينهم بالـ method (زي ما بيعمل الـ router). ملحوظة توثيقية، صفر إجراء.
3. **فحص التكرار بيسقط بـ TypeError لا assertion** لما الـ metadata غايبة
   (mutation 2). العيب بيتكشف — بس برسالة أقل وضوحاً من المفروض. إصلاح
   تجميلي بسطر guard؛ **مؤجَّل بوعي** عشان ما أزوّدش سطح الـ spec بلا داعٍ.
4. **الثوابت الدلالية الأربعة قابلة للنقض من مالك المنتج** — «`CLIENT` قارئ
   فقط» و«`WORKER` مستبعَد كلياً» **قرارات منتج** مثبَّتة دلوقتي في spec.
   لو اتغيّرت سياسة، الـ spec هيفرمل عمداً. **الفرملة مقصودة، والقرار مش لي.**
5. **البوابة (ج) لسه مفتوحة** — الـ spec ده يثبّت الـ **metadata** فقط. الطبقة
   الغائبة: `RolesGuard` ينفّذ ده فعلاً وقت التشغيل. **لا تُعرَّض الـ 9
   endpoints لمستخدمين حقيقيين في production قبلها** (BACKLOG #5، supertest).
6. **مصفوفات الـ 11 controller الباقية بلا specs جداول** — أسماؤها اتحققت
   نوعياً بالـ tsc دلوقتي، لكن **جداولها غير مثبَّتة**. الملف ده قالب جاهز
   للنسخ. خارج نطاق الـ session (مذكور في حدود الـ scope).

---

## ملاحظات

- **الـ spec مايبنيش DI ولا يوصل DB** — بيقرأ metadata من الـ prototype مباشرةً.
  زمن التشغيل 6.2 ثانية، وصالح للـ CI بلا أي بنية تحتية. ده بالظبط اللي كان
  ناقص السكربت العابر: مكانش بيتشغّل في CI **ولا كان موجوداً أصلاً بعد الـ session**.
- **`Object.getOwnPropertyNames(prototype)`** هي اللي بتخلي فحص «الـ 9 بالظبط»
  و«لا handler بلا `@Roles`» ممكنين. أي endpoint عاشر يتضاف = **الـ suite تحمرّ
  فوراً** حتى لو الكاتب نسي الـ decorator بالكامل — وده **بالضبط** السيناريو
  اللي خطر البوابة (أ) كان قائماً عليه.
- **صفر تعديل على أي controller** — النتيجة الأنظف الممكنة للـ sweep: الحماية
  اتضافت والكود القائم طلع سليماً.
- **الـ 14 الحمراء (TEST-BASELINE-001) لسه بتفرض قراءة يدوية** لأسماء الـ suites
  في كل session للتأكد إنها **نفسها**. عملتها هنا يدوياً. البند ده Quick mode
  session مستقلة في الـ BACKLOG، **وكل session بتدفع ضريبته من جديد**.

---

✋ تم — الـ session مقفولة.
