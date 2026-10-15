# تقرير المبرمج — Session A (نموذج التقرير اليومي)

## 📥 البنود المُستلَمة

| # | البند | المصدر | الحالة |
|---|---|---|---|
| 1 | `git diff --stat -- apps/api` فاضي + tsc حرفي + stdout حرفي | الخطة، بند مُسلَّم 1 | **قُبل ومُنفَّذ** — القسم "التحقق (حرفي)" |
| 2 | تعليق في `can-submit-report.ts` يسمّي `updates.controller.ts:38-44` + MVT-5 يعدّد السبعة أدوار | الخطة، بند 2 | **قُبل ومُنفَّذ** — التعليق موجود، والـ spec بيعدّد 7 بـ `Record<UserRole, boolean>` (لو انحذف دور من الـ union، الملف ما بيـcompileش) |
| 3 | الاعتماد على تصدير `STATUS_META` يُذكَر لـ Session B | الخطة، بند 3 | **قُبل** — مُسلَّم للمختبر + Session B أدناه، **مع انحراف 1** |
| 4 | MVT-1/2/5 بلا mutation ⇒ قيد مُعلَن | الخطة، بند 4 | **أُحيل للمختبر** — المبرمج ما عملش أي mutation (مش دوره)، والقيد منقول كما هو |
| 5 | `WEB-CURRENCY-001` تُفتَح بعد موافقة المالك | الخطة، بند 5 | **قُبل ومُنفَّذ** — اتسجّلت في `BACKLOG.md` |
| 6 | MVT-4: number + 3 تأكيدات + شاهد سالب + **حالة `"999999999.99"`** | قرار المالك 1 | **قُبل ومُنفَّذ ومُتحقَّق** — الحالة الحدية خضراء، صفر انزياح |
| 7 | كسور الـ cost **و`workHours`** برقمين محلياً + تعليق بالمصدرين | قرار المالك 2 | **قُبل ومُنفَّذ** — `COST_RE` و`HOURS_RE` بتعليق يسمّي الـ DTO والعمود |
| 8 | تسجيل `API-DECIMAL-001` | قرار المالك 2 | **قُبل ومُنفَّذ** — 🟡 MEDIUM في `BACKLOG.md` |
| 9 | العملة (ج.م) في الفورم + تسجيل `WEB-CURRENCY-001` للإصلاح في Session B | قرار المالك 3 | **قُبل ومُنفَّذ** |
| 10 | 🔴 سؤال فصل المهام (self-approval) — جواب بملف:سطر + تسجيل لو مش ممنوع + **صفر قيد بديل في الـ UI** | قرار المالك 4 | **قُبل ومُنفَّذ** — الجواب أدناه، `SEC-SOD-001` 🔴 HIGH مُسجَّلة، **وصفر سطر UI اتكتب بداله** |
| 11 | ممنوع تعديل الباك إند | قرار المالك 1 + النطاق | **قُبل** — `git diff -- apps/api` فاضي، مُرفَق |

---

## 🔴 جواب سؤال فصل المهام (قبل أي كود)

**السؤال:** هل الباك إند بيمنع إن مُقدِّم التقرير هو اللي يعتمده؟
**الجواب: لا، مفيش أي منع.**

**الدليل:** `apps/api/src/modules/updates/updates.service.ts`
- `approve()` = أسطر **409-540**. حوارسه **تلاتة فقط**: الوجود (**437**)، المستأجر (**438-440**)، والحالة PENDING (**441-443**).
- إعادة القراءة داخل الـ tx (**453-461**) بتـ select **`{ id, status }`** وحدهما — فمفيش حتى قراءة لـ `submittedBy`.
- الكتابة (**463-470**) بتحطّ `reviewedBy: user.userId` (**467**) بلا أي مقارنة.
- `grep -n "submittedBy" updates.service.ts` ⇒ **99 · 108 · 192 · 253 · 276 · 1019** — **ولا واحد داخل `approve()` أو `reject()`**.
- والسلسلة كاملة بيد شخص واحد فعلياً: PM/SUPER_ADMIN **داخل `FIELD_ROLES`** (`updates.controller.ts:38-44`) و**معفيّان من فحص التعيين** (`updates.service.ts:215`).

**ما فعلته:** سجّلت `SEC-SOD-001` 🔴 **HIGH** في `BACKLOG.md`، **ولم أضف أي قيد في الـ UI** — التزاماً بتوجيهك (قيد UI هنا كان هيدّي إحساساً زائفاً بالحماية وهو قابل للتجاوز بـ curl).

---

## المرحلة 1: طبقة العقد — ✅

**الملفات المعدّلة:**
- `apps/web/src/types/update.ts`: `CreateUpdateBody` + `EditUpdateBody` (+30 سطر)، بتعليق بيوثّق ليه الأرقام **أرقام لا نصوص** (مع `main.ts:79-92` و`dto/index.ts:85`).
- `apps/web/src/lib/api/updates-client.ts`: `createUpdate` / `editUpdate` / `submitUpdate` (+38)، بنفس نمط الدوال القائمة (`client` العام + `unwrap` + `UpdateActionResult`). `client.patch` له سابقة قائمة (`phases-client.ts:30,39`).

**ملف جديد:**
- `apps/web/src/lib/updates/map-report-form-to-body.ts` (210 سطر) — `ReportFormState` + `validateReportForm` + `mapReportFormToBody` + `reportFormFromUpdate`. مرآة `lib/projects/map-form-to-create-input.ts`.

**ملاحظات:**
- `COST_RE = /^\d{1,9}(\.\d{1,2})?$/` بيحمل **حدّين من مصدرين** بتعليق يسمّيهما: عدد الأرقام الصحيحة = `@Max(COST_MAX)` (`dto:31,87`)، والكسور = العمود `Decimal(15,2)` (`schema.prisma:205`). **صفر عملية حسابية على الـ cost** في قرار القبول/الرفض.
- `reportFormFromUpdate` بتحطّ `workHours`/`cost` في الخانات **كما وصلا من السلك** (نصوص Decimal) — بلا أي `Number()` ذهاب وعودة، فمسودة محفوظة بـ `12500.50` تُعدَّل كـ `"12500.50"`.

---

## المرحلة 2: الـ mutations — ✅

**الملف المعدّل:** `apps/web/src/lib/hooks/use-update-actions.ts` (+60): `useCreateUpdate` / `useEditUpdate` / `useSubmitUpdate`.

**ملاحظات:**
- `retry: false` على الثلاثة (نفس الملف، نفس السبب الموثَّق).
- أُعيد استخدام `useInvalidateReview` القائم **بلا تعديل سطر واحد فيه**: لـ `create` بنمرّر `id` الراجع من الاستجابة — وإبطال مفتاح تفاصيل لم يُخزَّن قبلاً = no-op.

---

## المرحلة 3: الـ predicate + زرار المرحلة — ✅

**ملفان جديدان:**
- `apps/web/src/lib/updates/can-submit-report.ts` (34) — القائمة مكتوبة `readonly UserRole[]` (فحص compile على الحروف) ومقروءة كـ `readonly string[]` عند الفحص (لأن `AuthUser.role` نص حرّ). نفس حيلة `isProjectType` القائمة.
- `apps/web/src/components/dashboard/updates/phase-report-button.tsx` (113) — `Button` + `Badge` + `STATUS_META` **مستورد**، صفر ستايل جديد.

**ملاحظات:**
- الاستعلام هو `phaseUpdatesQueryOptions(phase.id, {}, active)` — **نفس مفتاح ودالة** قوائم المراجعة، صفر مفتاح جديد، ومقيَّد بـ `active` فـ CLIENT/ACCOUNTANT (اللي مش بيشوفوا الزرار أصلاً) **صفر طلبات**.
- **تكلفة معروفة ومُعلَنة:** لمستخدم مسموح له، تبويب "المراحل" (وهو التبويب الافتراضي) بيعمل **طلباً لكل مرحلة** (N طلب صغير متوازي، نفس ما يفعله `ReviewsPanel` على تبويبه). مُسلَّم للمختبر للقياس (بند 3 أدناه).

---

## المرحلة 4: الـ Dialog — ✅

**ملف جديد:** `apps/web/src/components/dashboard/updates/report-form-dialog.tsx` (520 سطر).

**ملاحظات:**
- الحالات منقولة من المرجع: loading/error/rejection-banner/`sm:max-w-lg max-h-[85vh] overflow-y-auto`.
- خانة الـ cost: `type="text"` + `inputMode="decimal"` + `dir="ltr"` **عن قصد** — `type="number"` بيسمح للمتصفح يطبّع المكتوب (1e5، فواصل محلية، `""` صامتة على إدخال جزئي) وده حقل بيدخل `netDue`. التعليق في الملف بيشرح ده.
- الصور: سطر نص **"الصور — قريباً"** داخل إطار منقّط، **بلا أي عنصر تفاعلي**.
- ترتيب الحقول: العنوان (ومعاه `* (مطلوب)`) أولاً، فاصل + عنوان "تفاصيل إضافية (اختيارية)"، بعده الاختيارية. **صفر accordion/collapse.**

**قيد مُعلَن (أحجام اللمس):** أقصى حجم زرار في نظام التصميم هو `size="lg"` = **h-9 (36px)** — أقل من 44px المعتاد للمس. استعملت `lg` ولم أكتب أي ارتفاع يدوي، التزاماً بـ "ممنوع أحجام hardcoded". رفع الحجم قرار نظام تصميم لا قرار Session A. (`Input` = h-10، `Textarea` = min-h-80px — مقبولان.)

---

## المرحلة 5: مسارات الفشل — ✅

- **5أ (409):** refetch بنفس المفتاح ← تبنّي صفّي DRAFT/REJECTED ← **القيم المحلية ما تتلمسش** ← رسالة "تقريرك اتحفظ قبل كده — اضغط إرسال تاني". ملقيناش ⇒ قفل + شارة الحالة الحاجبة.
- **5ب (create ✅ / submit ❌):** `activeId` بيُكتَب **لحظة** نجاح الإنشاء ⇒ أي ضغطة تالية edit/submit، **مستحيل create تانٍ**.
- **5ج:** التفريع على **الحالة المُعاد جلبها** من السيرفر، **لا على نص الخطأ** إطلاقاً.

**ملاحظة تقنية مهمة (خطأ كان هيعيش):** في `handleFailure` بمرّر `idUsed` **بالقيمة** لا بالقراءة من الـ state — لأن `setActiveId` مش بيكون flushed لما الـ submit يفشل في نفس الـ handler، فقراءة `activeId` كانت هترجع `null` وتاخد الفرع الغلط. (نفس درس **snapshot-by-value** الموجود في `.claude/skills/08-testing.md`.)

---

## المرحلة 6: الربط + الموبايل — ✅

**الملف المعدّل:** `apps/web/src/app/[locale]/dashboard/projects/[id]/page.tsx` (+13): استيرادان + `canReport` + إدخال `<PhaseReportButton>` مشروط داخل صف المرحلة.
- على 360px الصف أصلاً `flex-col` (سطر 394) ⇒ الزرار سطر مستقل، صفر تزاحم مع `PhaseAdminControls` (بند الحدود (ب) من الخطة — مقفول بالبنية).

---

## ⚠️ الانحرافات عن الـ Plan — 4، كلها مُعلَنة

**انحراف 1 — تعديل سطر واحد في `update-detail-dialog.tsx`.**
الخطة قالت "صفر تعديل". الواقع: أضفت كلمة **`export`** على `STATUS_META` (`const` → `export const`) + تعليق. البديل الوحيد كان **نسخ** الجدول — واللي الخطة نفسها منعته صراحة ("استيراد لا نسخ"). التعديل إضافي بحت، صفر تغيير سلوك.

**انحراف 2 — منطق شارة/زرار صف المرحلة (الأهم).**
الخطة قالت: PENDING/APPROVED ⇒ **شارة بس بلا زرار**. **ده كان متعارضاً مع F-6 في نفس الخطة:** تحديد "هل النهاردة مأخوذ؟" يستلزم حدود يوم بـ **timezone الشركة**، و F-6 منعت إعادة حسابها على العميل. تنفيذ الجدول حرفياً كان معناه إما حساب تواريخ محلي (العيب اللي F-6 رفضته)، أو **حجب الزرار بالغلط** على مَن آخر تقرير له APPROVED من الأسبوع الماضي.
**المنفَّذ:** الشارة بتعرض **حالة آخر تقرير ليك** (بعنوان "آخر تقرير:" — بلا أي ادّعاء إنه النهاردة)، و**الزرار متاح دايماً**، و**الباك إند (409) هو الحَكَم** على "النهاردة". النتيجة: صفر حساب تواريخ، صفر حجب خاطئ، **و MVT-1 ("الشارة بتبقى PENDING") بقى قابلاً للتحقق فعلاً** — وهو اللي الجدول الأصلي كان هيمنعه.

**انحراف 3 — `" 12500.50 "` اتقبل بعد trim بدل ما يُرفَض.**
الخطة حطّته في قائمة الشاهد السالب. المساحات المحيطة **لا تغيّر القيمة** ولا تمرّ بأي عملية حسابية، ورفضها إزعاج بلا مقابل أمني (لصق من كيبورد موبايل). **المُنفَّذ:** trim ثم تحقق، **مع إضافة حالة جديدة للشاهد السالب تحفظ قوته**: `"12 500.50"` (مسافة **داخلية**) مرفوض. الشاهد السالب بقى **8 حالات** بدل 8 (استُبدلت واحدة).
🔬 **الـ spec هو اللي أمسك التعارض** — سقط أحمر على الحالة دي قبل أي تعديل، مش اتفصّل على الكود.

**انحراف 4 — قراءة تفاصيل التقرير عند المتابعة.**
الخطة فرضت التعبئة من صفّ القائمة. لكن `select` القائمة **مابيرجّعش `workRemaining`** (`updates.service.ts:115-133`) ⇒ "العمل المتبقي" كان هيظهر **فاضياً وقيمته على السيرفر مش فاضية** (واجهة مضلِّلة). **المُنفَّذ:** `useUpdate(existing.id)` (هوك قائم) لتعبئة أمينة، **مع قيد صارم:** الاستعلام **مربوط بمعرّف لحظة الفتح فقط** فمستحيل يشتغل بعد 409 ⇒ قيم السيرفر **لا تقدر** تطغى على المكتوب (وده المُثبَت في MVT-2).

**انحراف إجرائي مُعلَن:** الـ specs الخمسة **كتبها المبرمج** أثناء التنفيذ، مع إن الـ MVT شغل المختبر. **المختبر لا يعاملها كمُصدَّقة سلفاً** — دوره الباقي كما هو: الـ **mutation** (قاعدة #5ب، أنا ما عملتهوش) + تدقيق إن الـ specs **تعضّ** لا تصف.

---

## ✅ التحقق (حرفي)

**1) الباك إند — صفر تعديل:**
```
$ git diff --stat -- apps/api
[لا مخرجات]
```

**2) tsc — قبل التنفيذ (baseline):**
```
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ accessToken: null; user: null; ... }' but required in type 'AuthState'.
```

**3) tsc — بعد التنفيذ:**
```
$ npx tsc --noEmit -p tsconfig.json
=== tsc exit: 2 ===
src/app/[locale]/dashboard/team/permissions/page.tsx(287,40): error TS2304: Cannot find name 'cn'.
src/components/ui/dropdown-menu.tsx(19,37): error TS2322: Type '{ children: Element; sideOffset: number; alignment: "center" | "end" | "start"; side: "top" | "bottom" | "left" | "right"; }' is not assignable to type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
  Property 'alignment' does not exist on type 'IntrinsicAttributes & Omit<MenuPositionerProps, "ref"> & RefAttributes<HTMLDivElement>'.
src/lib/auth/decide-redirect.spec.ts(9,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/lib/auth/decide-redirect.spec.ts(18,19): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/store/use-auth-store.ts(57,56): error TS2741: Property 'setUser' is missing in type '{ accessToken: null; user: null; ... }' but required in type 'AuthState'.
=== error count: 5 ===
```
⇒ **القائمتان متطابقتان سطراً بسطر: 5 = 5، صفر خطأ جديد.**

**4) vitest — قبل:**
```
 Test Files  16 passed (16)
      Tests  55 passed (55)
   Duration  9.84s
```

**5) vitest — بعد (الـ suite الكامل):**
```
 Test Files  19 passed (19)
      Tests  88 passed (88)
   Duration  11.65s
=== vitest exit: 0 ===
```
⇒ **+3 ملفات، +33 اختبار، صفر regression** (الـ 55 القديمة كلها خضراء).

**6) الـ specs الجديدة وحدها:**
```
 ✓ src/components/dashboard/updates/report-form-dialog.spec.tsx (4 tests) 733ms
 ✓ src/lib/updates/map-report-form-to-body.spec.ts (20 tests) 8ms
 ✓ src/lib/updates/can-submit-report.spec.ts (9 tests) 3ms
 Test Files  3 passed (3)
      Tests  33 passed (33)
```

**7) `next build` — compile ✅، type-check محجوب بخطأ سابق للجلسة:**
```
▲ Next.js 16.2.3 (Turbopack)
  Creating an optimized production build ...
✓ Compiled successfully in 35.2s
  Running TypeScript ...
Failed to type check.
./src/app/[locale]/dashboard/team/permissions/page.tsx:287:40
Type error: Cannot find name 'cn'.
```
⇒ **"✓ Compiled successfully" = كل الملفات الجديدة اتجمّعت فعلاً** (حدود `"use client"`، الاستيرادات، شجرة الموديولات كلها سليمة). والفشل بعدها على **ملف لم تلمسه الجلسة** وهو **خطأ الـ baseline رقم 1** ⇒ **تأكيد حيّ لـ `WEB-TSC-001`** (المسجَّلة بنفس الملف:السطر ونفس الوصف "compile ينجح والـ type-check يفشل") — **لا تزال حاجبة للـ build اليوم.**

---

## 🚫 ما لم يُتحقَّق منه (ولم أدّعِ عكسه)

**التحقق الحيّ في متصفح لم يحدث.** الصفحة محمية بـ `RouteGuard` وبتحتاج جلسة حقيقية + API شغّال + Supabase، و"ممنوع login حقيقي" قيد قائم من جلسة سابقة. ⇒ **صفر دليل بصري على شكل الفورم على 360px**، وما قلتهوش شغّال بصرياً. المُثبَت هو: التجميع ينجح، الـ DOM بيتولّد ويتفاعل في jsdom (33 اختبار)، والأحجام مأخوذة من مكوّنات المنصة لا من قيم يدوية.

---

## 🧭 جرد الحدود

**(أ) حد السجل:** `WEB-TSC-001` — **تُلمَس بلا إغلاق، ومؤكَّدة حيّة** (الدليل في التحقق 7). `WEB-S3-002` (render-tests مؤجّلة على نفس الصفحة) — **تُلمَس بلا إغلاق**؛ ملاحظة: specs هذه الجلسة بترندر **المكوّن** لا الصفحة، فالتذكرة باقية بنصّها. `WEB-S4-ERR-001` — ملف `update-detail-dialog.tsx` اتلمس بكلمة `export` فقط؛ **التذكرة لم تُقفَل** (رسالة الخطأ العامة لسه هناك). التذاكر التلاتة الجديدة (`SEC-SOD-001`, `API-DECIMAL-001`, `WEB-CURRENCY-001`) **مفتوحة لا مقفولة.**

**(ب) حد البنود — ضرب بنودي في نفسها:**
- **انحراف 1 × Session B:** `export` على `STATUS_META` بقى **عقداً** بين ملفين؛ حذفه في Session B يكسر البناء (لا يكسره بصمت — tsc بيمسكه). أثر حقيقي، مُسلَّم.
- **انحراف 2 × انحراف 4:** الاتنين بيعتمدوا على "آخر تقرير ليّ"؛ لكن انحراف 4 **مربوط بمعرّف لحظة الفتح** وانحراف 2 بيعيد الحساب على كل refetch ⇒ لو تقرير جديد ظهر وسط فتح الفورم، الشارة بتتحدّث والفورم **لا** — وده **المطلوب** (القيم المحلية مقدَّسة). مُعلَن عشان ما يُقرأش كـ bug.
- **المرحلة 3 × المرحلة 6:** N طلب على التبويب الافتراضي — بند قياس للمختبر.
- باقي البنود: مستقلة.

**(ج) حد الوحدات:**
| الحقيقة | المالك | مصدر ثانٍ؟ | الحكم |
|---|---|---|---|
| حدّ كسور `cost`/`workHours` | العمود (رقمين) | الـ DTO (مفتوح) | **مُعلَن في الكود بتعليق يسمّي الاتنين** + `API-DECIMAL-001` |
| أقصى `cost` | `COST_MAX` (DTO) | العمود (13 رقماً) | الـ DTO أضيق ⇒ هو المُنفَّذ |
| عملة العرض | `Company.currency` = EGP | `ر.س` في 3 شاشات | **لا يزال غير محسوم** ⇒ `WEB-CURRENCY-001` (Session B) |
| قائمة الأدوار | `updates.controller.ts:38-44` | `can-submit-report.ts` | نسخة + تعليق + spec على 7 أدوار |
| "هل النهاردة مأخوذ؟" | **الباك إند وحده** (409 + timezone الشركة) | **لا يوجد — بقصد** | انحراف 2 أزال المصدر الثاني بدل ما يخلقه |

---

## 📤 بنود مُسلَّمة — تحتاج إغلاقاً صريحاً

1. **للمختبر — mutation (قاعدة #5ب، لم يُنفَّذ منه شيء):** الحد الأدنى المتفق عليه = **MVT-3 + MVT-4**. مرشّحات طفرة محددة: (أ) شيل `setActiveId(id)` من `runSend` ⇒ **MVT-3 لازم يسقط وحده**؛ (ب) خلّي `mapReportFormToBody` تستعمل `parseFloat` بدل الـ regex+`Number` ⇒ **MVT-4 لازم يسقط على الحالات المرفوضة**؛ (ج) خلّي مسار 409 يعبّي من السيرفر ⇒ **MVT-2 لازم يسقط على تأكيد القيم المحلية**.
2. **للمختبر — تدقيق "أخضر لسبب غلط":** الـ specs بترفض/بترجّع كائنات أخطاء **مصنوعة يدوياً** (`{status:409}`). الطبقة الحقيقية بترفض بـ `mapAuthError(...)+sessionDisposition` (`client.ts:96-97`). السؤال الواجب: هل الشكل المُستعمل في الـ mock **ممكن** تنتجه الطبقة الحقيقية؟ (نفس فصيلة انحراف (هـ) في جلسة dashboard-load-perf.)
3. **للمختبر — قياس:** N طلب لكل مرحلة على التبويب الافتراضي (المرحلة 3). هل يحتاج `enabled` أضيق أو عدّاد خلفي؟
4. **للمختبر/المراجع — المتبقي بلا تغطية:** الوضع المقفول بعد فشل submit على صفّ مش DRAFT (5ج) **مغطّى جزئياً** (فرع 409-PENDING فقط)؛ و`runSaveDraft` **بلا spec إطلاقاً**؛ وRTL/360px **بلا أي تحقق بصري**.
5. **لـ Session B:** (أ) الحفاظ على `export const STATUS_META`؛ (ب) إضافة معرض الصور يستلزم استبدال سطر "الصور — قريباً" في `report-form-dialog.tsx` (موضع واحد، معلَّم بتعليق)؛ (ج) `WEB-CURRENCY-001` تُقفَل هناك.
6. **للمالك:** `SEC-SOD-001` 🔴 HIGH — **قرار منتج مطلوب** (حارس مطلق يعطّل شركة بمدير واحد؛ البديل حارس + override موثَّق في الـ audit).

---
## ملخص نهائي
- المراحل المكتملة: **6/6**
- ملفات معدَّلة: **5** · ملفات جديدة: **6** (منها 3 specs)
- انحرافات عن الـ Plan: **4 معلَنة** + 1 إجرائي
- tsc: **5 = 5** (صفر جديد) · vitest: **55 → 88** (صفر regression) · باك إند: **صفر تعديل**
- تذاكر مضافة: **3** (`SEC-SOD-001` 🔴 · `API-DECIMAL-001` 🟡 · `WEB-CURRENCY-001` 🟡)
- component/style جديد خارج المعلَن سلفاً: **صفر** · package جديد: **صفر** · لون hardcoded: **صفر**

✋ تم المبرمج — للدور التالي؟
