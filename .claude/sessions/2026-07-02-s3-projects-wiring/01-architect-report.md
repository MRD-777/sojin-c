# تقرير المخطط (ما بعد التنفيذ) — S3 Projects Wiring

> ملاحظة mode: الـ session Standard، فمفيش هاكر/principal. تقرير المخطط ما-بعد-التنفيذ ده اتطلب صراحة كـ بوابة مراجعة قبل المختبر (مطابق لتسليمة المبرمج). راجعت الـ **الكود الفعلي** مش تقرير المبرمج بس.

## مقارنة Plan vs Reality

| البند | المخطط | المنفّذ | متطابق؟ |
|-------|--------|---------|---------|
| المرحلة 1: types + projects-client | `types/project.ts` + 3 دوال thin فوق `client`+`unwrap` | نفسها بالظبط؛ types مشتقّة حرفياً من `PROJECT_SELECT` | ✅ |
| المرحلة 2: 5 hooks | use-projects/use-project/use-create-project/use-clients + fetch clients inline-أو-client | 5 hooks + `users-client.ts` منفصل (بدل inline) | ✅ (انحراف #1) |
| المرحلة 3: List page | `useProjects` + loading/empty/error + status 5 قيم | نفسها؛ الحقول المالية → real حيث متاح + TODO بدل mock | ✅ |
| المرحلة 4: Detail page | `useProject` + phases + assignments + not-found = isError | نفسها؛ الأقسام بدون-backend → placeholders بـ TODO | ✅ |
| المرحلة 5: Create page | client selector Step1 + type→enum + submit→map→redirect | نفسها؛ selector اتحط Step1 + شيل الـ input المكرّر Step3 | ✅ (انحراف #2،#3) |
| Data-layer files | 8 ملفات جديدة | كل الـ 8 موجودة (تحققت بـ Test-Path) | ✅ |
| `retry:false` على queries | نعم (زي use-me) | مطبّق على الـ 3 queries + لا retry على mutation | ✅ (قرار زائد سليم) |
| MVT budget | 5 specs | لسه مستحقّة — دور المختبر الجاي | ⏳ pending |
| tsc: صفر أخطاء جديدة | معيار نجاح #6 | صفر خطأ جديد عبر الـ 5 مراحل (5 pre-existing ثابتة) | ✅ |

## الانحرافات عن الـ Plan

1. **`users-client.ts` منفصل بدل fetch inline** (المرحلة 2). مبرر: يحافظ على thin-client pattern الموحّد + قابل لـ spec مستقل. **مقبول ✅** — في اتجاه الـ plan (الخطة سمحت "inline أو users-client").
2. **موقع الـ client selector: Step 1 + إزالة الـ input النصّي المكرّر من Step 3** (المرحلة 5). الخطة نصّت "selector في Step 1" صراحةً؛ المبرمج نفّذها وأزال المفهوم المتضارب. **مقبول ✅** — تنفيذ حرفي للخطة + تنظيف تبعي مبرَّر.
3. **إضافة `dailyUpdateDeadline` كـ time input في Step 2** (المرحلة 5). الخطة خيّرت بين "default أو optional"؛ المبرمج اختار حقل حقيقي optional (يتشال لو فاضي). **مقبول ✅** — أصدق من state field ميت، بلا كلفة، بلا توسيع scope.

خلاصة: 3 انحرافات كلها **طفيفة + في اتجاه الخطة + موثّقة صراحة** من المبرمج (احترام كامل لقاعدة "المبرمج مايزيدش من غير إبلاغ"). صفر انحراف يستدعي إعادة تخطيط.

## تقييم المعمارية

- **الطبقية سليمة:** `types → client (thin+unwrap) → hooks (React Query) → pages`. نفس pattern الـ `use-me`/`route-guard` المعتمد؛ صفر pattern مخترع. صفر تأثير على طبقة الـ auth (تأكدت — كل الملفات إضافات صافية).
- **الـ pure mapper (`map-form-to-create-input.ts`) قرار معماري ممتاز:** فصل الـ form→DTO عن React خلّاه unit-testable لوحده، وركّز أخطر منطق (strip-empties عشان `@IsDateString`/`@IsNumber`/`@IsEnum` ماتنكسرش، + `isProjectType` guard يمنع placeholder `""` يوصل الـ wire) في مكان واحد mockless. ده بالظبط أعمق نقطة للـ paired assertion (MVT #4/#5).
- **الـ "real حيث متاح + placeholder بـ TODO" بدل mock مفبرك** عبر List/Detail/Create — أصدق معمارياً من الـ mock الأصلي وبيمنع false-confidence على بيانات مالية مؤجّلة (S7). متوافق مع حدود الـ scope.
- **الاكتشاف المهم (validation guard اليدوي على الـ conditionally-rendered steps):** الـ HTML `required` على حقول Step 1 المخفية مايـfireش عند submit من Step 5 (React بيـunmount الـ steps الأخرى). الحل: guard يدوي على `name`+`clientId` يرجّع المستخدم لـ Step 1 قبل ما يضرب الـ backend 400 (تأكدت: `new/page.tsx:138-147`). ده bug حقيقي كان هيمر صامت في form متعدّد الخطوات — التقاطه أثناء التنفيذ = علامة جودة.
- **asymmetry موثّقة على `totalBudget`** (`number` على الـ input، `string`/Decimal على الـ response) — صح ومعلّم بـ comment.

## حاجات محتاجة تتعمل في sessions قادمة

- **MVT (5 specs) لسه مستحقّة** — دور المختبر الجاي. **الميزانية تفضل 5 كما هي في الـ plan** (مفيش NEEDS-CODER، مفيش سطح جديد يوسّعها). الـ spec #4 (create) لازم يلتزم بـ rule #4: يؤكّد إن **الـ body الواصل للـ axios adapter = `CreateProjectInput` كامل بـ `clientId`** (أعمق طبقة)، مش مجرّد "resolved".
- **spec مقترح إضافي (نتيجة الاكتشاف):** الـ guard اليدوي للـ conditionally-rendered submit يستحق tag في توصيات المختبر (حتى لو خارج الـ 5 MVT) — لأنه منطق أمان-إدخال مش مغطّى بـ HTML validation.
- **search/filters على الـ List = UI-only** بـ TODO (خارج scope S3 صح) → wiring في S5.
- **توحيد enums web-local مع `shared-types`** (lowercase vs UPPERCASE) → بند backlog كما اتفق.
- **payments/summary (S7) + assignMember (workers step UI-only) + permissions gate (S11)** — كلها مؤجّلة صح، معلّمة بـ TODO في الكود.

## الحكم

✅ **التنفيذ متوافق مع الـ Plan.** الـ 5 مراحل اتنفّذت بالترتيب، الـ 3 انحرافات طفيفة/موثّقة/في اتجاه الخطة، الـ 8 ملفات موجودة، صفر خطأ tsc جديد، والقرارات المعمارية (pure mapper، thin client، real-or-TODO) سليمة. **البوابة الوحيدة المتبقية قبل الإغلاق = MVT (5 specs) عند المختبر** — من غيرها الـ session ماتقفلش (rule #2). التنفيذ جاهز يتسلّم للمختبر.

✋ تم المخطط (ما بعد التنفيذ) — للدور التالي (🧪 المختبر)؟
