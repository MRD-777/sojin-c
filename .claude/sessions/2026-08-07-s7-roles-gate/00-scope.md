# Scope

## Mode: Quick
السبب: بندان محدودان ومعروفان مسبقاً بالكامل (spec واحد جديد + تغيير توقيع سطر واحد)، بلا تغيير في أي business logic ولا في أي عقد API — الـ deliverable والحدود واضحان من الـ BACKLOG قبل البداية.

---

## المهمة

قفل **البوابتين (أ) و(ب)** من `🔴 S7-ROLES-GATE` في `BACKLOG.md` — الشرط الملزم الأول من
`05-principal-report.md` (قرار 2️⃣) **قبل أي ربط frontend لأي endpoint من التسعة الماليّة**.

1. **(أ) spec مصفوفة الصلاحيات من الـ metadata** — تحويل سكربت الـ boot العابر
   (`scratchpad/route-check.mjs`، المرحلة 7 من S7، اختفى بنهاية الـ session) إلى **spec دائم**
   داخل `modules/finance/`: يقرأ `Reflect.getMetadata('roles', handler)` لكل واحد من الـ 9
   handlers، يثبّت الجدول المخطط **بالظبط** (method + path + مجموعة الأدوار)، ويتحقق من
   **كل اسم دور** مقابل `enum UserRole`.

2. **(ب) API-ROLES-001 + A3** — تضييق نوع الـ `@Roles` decorator من `string[]` إلى `UserRole[]`،
   وتأكيد `JwtPayload.role: UserRole`، ثم `tsc` على كل المشروع كفحص شامل لكل الـ 68 استعمال
   للـ `@Roles` في الـ repo دفعة واحدة.

---

## الوضع القائم (متحقَّق قبل البدء)

| البند | الحالة الفعلية اليوم |
|---|---|
| `roles.decorator.ts:8` | `export const Roles = (...roles: string[])` — **غير مُقيَّد** ✅ يحتاج تغيير |
| `current-user.decorator.ts:14` | `role: UserRole` — **A3 مُنفَّذ بالفعل** (أُغلق في Session 1.8 Part 2، 2026-05-24). الـ BACKLOG بيعيد ذكره تحت البوابة (ب) لأنه لم يُشطَب هناك ⇒ في هذه الـ session **تحقّق + توثيق فقط، لا كود** |
| `UserRole` | 7 أعضاء: `SUPER_ADMIN, PROJECT_MANAGER, SITE_ENGINEER, SUPERVISOR, ACCOUNTANT, WORKER, CLIENT` — متاح **كقيمة runtime** من `@prisma/client` (مش type فقط) ⇒ الـ spec يقدر يقارن فعلياً |
| `@Roles(` في الـ repo | **68 استعمال** عبر 12 controller. اتنين منها **spread من ثوابت** (`...FIELD_ROLES` / `...VIEWER_ROLES` في `updates.controller.ts:38,47`، معرَّفة `as const`) — أول مرشّح لخطأ tsc بعد التضييق |
| الحارس الآلي على مصفوفة finance | **صفر** — السكربت العابر اختفى |

---

## الملفات المتأثرة

| المسار | إيه اللي هيتغير |
|---|---|
| `apps/api/src/common/decorators/roles.decorator.ts` | `(...roles: string[])` → `(...roles: UserRole[])` + `import type { UserRole } from '@prisma/client'` |
| `apps/api/src/modules/finance/finance-roles.matrix.spec.ts` | **ملف جديد** — spec المصفوفة (البوابة أ) |
| `apps/api/src/common/guards/roles.guard.ts` | **احتمالي فقط:** تعليق السطر 4 بيقول `@Roles('super_admin', 'project_manager')` — أسماء **lowercase غير موجودة في الـ enum**. تعليق مضلِّل، تصحيح نصي بلا كود |
| أي controller يظهر فيه خطأ tsc بعد التضييق | إصلاح ما يظهر فعلياً — **غير معروف مسبقاً، وهذا هو بيت القصيد** |

---

## الـ services المذكورة صراحةً + ميزانية التغطية (قاعدة #6)

| الوحدة | الميزانية في هذه الـ session |
|---|---|
| `FinanceController` (metadata فقط، بلا DI) | **≥1 spec — هو الـ deliverable الأساسي** (البوابة أ) |
| `FinancialSettingsService` | deferred — مغطّى بالفعل من S7 (MVT-1/2/2b/3/15) |
| `FinancialSummaryService` | deferred — مغطّى بالفعل من S7 |
| `BOQService` | deferred — مغطّى بالفعل من S7 |
| `RolesGuard` (سلوك وقت التشغيل) | **deferred صراحةً إلى البوابة (ج)** — HTTP integration tests بـ supertest (BACKLOG #5). انظر التحذير أدناه |

---

## تعريف النجاح

- [ ] spec جديد يقرأ `Reflect.getMetadata('roles', handler)` للـ **9 handlers** ويثبّت الجدول التسعة (method + path + الأدوار) — فشل الـ spec عند أي تعديل غير معلن في أي صف
- [ ] الـ spec يتحقق من **كل اسم دور** في الـ metadata مقابل `UserRole` runtime، ويمسك: (أ) typo، (ب) دور غير موجود، (ج) تكرار داخل نفس الـ handler
- [ ] **assertion أعمق (قاعدة #4):** الـ enum المستخدَم للتحقق يُطابَق مقابل `prisma/schema.prisma` نصياً — يمسك client مولَّد قديم (`prisma generate` فايت)، مش بس يثق في المولَّد
- [ ] `Roles = (...roles: UserRole[])` مطبَّق
- [ ] `JwtPayload.role: UserRole` — متحقَّق (منفَّذ سلفاً)
- [ ] `npx tsc -p tsconfig.build.json --noEmit` = **EXIT 0** (كود الإنتاج)
- [ ] `npx tsc -p tsconfig.json --noEmit` = صفر خطأ جديد فوق الـ baseline (يشمل ملفات الـ spec)
- [ ] `npx jest --silent` = **صفر regression**؛ الـ baseline الموروث **بالظبط**: 2 suites فاشلة / 14 test (`env-validation.spec.ts` + `audit-log.service.spec.ts` — TEST-BASELINE-001)
- [ ] الـ verification منسوخ حرفياً في `02-coder-report.md` (قاعدة #8)

---

## الحدود (خارج نطاق هذه الـ session)

- **البوابة (ج)** — HTTP integration tests بـ supertest (BACKLOG #5). ⚠️ **تحذير المراجع الأعلى منقول كما هو:** البوابة (أ) **ليست بديلاً عن** (ج). (أ) تثبّت ما هو **مُعلَن في الـ metadata**، ولا تثبت أن `RolesGuard` **ينفّذه فعلاً وقت التشغيل**.
- **أي ربط frontend** — الـ session دي بتفتح البوابة، مش بتعبرها. `R-1` (refresh-success غير مُختبَر) يفضل حاجباً مستقلاً قبل ربط `financial-summary`.
- **CVE-S7-007** (إرجاع `contractValue` للـ CLIENT، محسوم = خيار ب) — بوابته "جلسة الربط" وبيتطلب تحديث MVT-5. **لا يُلمَس هنا.**
- **P-1** (ثلاثة أرقام لقيمة المشروع) — جلسة الربط.
- **TEST-BASELINE-001** (الـ 14 الحمراء) — Quick mode session مستقلة. تُنقل هنا كـ baseline للمقارنة فقط، **ولا تُصلَّح**.
- **توسيع الـ spec لمصفوفات باقي الـ controllers** (payments/projects/updates/…) — الـ 68 استعمال هيتحققوا **نوعياً** بالـ tsc، لكن **تثبيت جداولهم** بـ specs خارج النطاق. لو التضييق كشف خطأ في controller غير finance ⇒ **يُصلَّح** (ده الغرض) لكن **بلا spec جدول له**.

---

## المخاطر المعروفة

1. **تضييق النوع قد يكشف أخطاء قائمة** — ده **النتيجة المرجوّة لا العطل**. لو ظهر typo حقيقي في أي controller، إصلاحه = تغيير سلوك صلاحية فعلي ⇒ **يُبلَّغ صراحةً في التقرير بسطر مستقل**، لا يُدفن كـ "إصلاح tsc".
2. **spec المصفوفة قد يتحوّل لـ snapshot يوافق على أي شيء** — لو اتكتب بقراءة الـ metadata وحقنها في التوقّع. **الجدول المتوقَّع لازم يكون مكتوباً حرفياً في الـ spec**، مصدره جدول الخطة، لا الكود.
3. **الاعتماد على `UserRole` المولَّد وحده** — لو الـ client قديم، الـ spec يوافق على enum قديم. مُعالَج بمطابقة `schema.prisma` نصياً (معيار النجاح #3).

---

⏸️ AWAITING APPROVAL — رد بـ "approve" للبداية.

✋ تم الـ scope — للدور التالي (💻 المبرمج)؟
