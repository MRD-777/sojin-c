# خطة التنفيذ — S7: نظام المقايسات والإدارة المالية

## المشكلة
المشروع مفيهوش تمثيل لقيمة العقد، الاحتجاز، السلفة، ولا جدول كميات (BOQ). العميل والمحاسب مش قادرين يشوفوا المستحق الصافي real-time، ولا نسبة إنجاز كل بند من التقارير المعتمدة. `payments` بيغطي الحركات النقدية فقط (دخل/مصروف) — مفيش طبقة "مقايسة" تربط الإنجاز بالمال.

## التحليل (Root cause)
لا يوجد schema يمثّل الإعدادات المالية للمشروع ولا شجرة البنود. الحسابات المالية المطلوبة (retention/advance/netDue) تجميعية عبر مصادر متعددة:
- `Update.cost` (عبر `Update → Phase → Project`، مفيش projectId مباشر).
- `Payment.amount` (نوع `CLIENT_PAYMENT` فقط).
- إعدادات ثابتة جديدة (`ProjectFinancialSettings`).

القرار المعماري: **module مستقل `finance`** يملك الإعدادات + الملخص + BOQ، ويستورد `AuditModule` + `ProjectsModule`. الأرقام كلها Decimal، والملخص غير مخزّن (يُحسب per-request) لمنع أي manipulation، تمشياً مع القاعدة الذهبية.

---

## القرارات المعتمدة من المستخدم (مثبّتة)
1. **Module مستقل `finance`** ✅
2. **ACCOUNTANT access = الخيار (أ):** توسيع `ensureProjectAccess` ليمرّر `ACCOUNTANT` company-wide (نفس early-return لـ `SUPER_ADMIN`/`PROJECT_MANAGER`).
3. **BOQ delete:** منع حذف بند له **أبناء نشطون** (`children` بـ `deletedAt: null`) — مش cascade. لو له أبناء نشطون ⇒ `400`.
4. **completedPct** = `Σ cost للـ Updates بحالة APPROVED المرتبطة بالبند / contractValue` (من الروابط المباشرة على البند فقط، مقيَّد 0–100).

---

## الحل المقترح

### المرحلة 1: Schema + Migration (طبقة الـ DB)
**الملفات:** `apps/api/prisma/schema.prisma` + migration جديدة.

**3 models جديدة:**

```prisma
// One-to-one مع Project
model ProjectFinancialSettings {
  id                String    @id @default(uuid()) @db.Uuid
  projectId         String    @unique @map("project_id") @db.Uuid
  contractValue     Decimal   @default(0) @map("contract_value") @db.Decimal(15, 2)
  retentionPct      Decimal   @default(5) @map("retention_pct") @db.Decimal(5, 2)  // نسبة مئوية 0-100
  advanceAmount     Decimal   @default(0) @map("advance_amount") @db.Decimal(15, 2)
  advancePct        Decimal   @default(0) @map("advance_pct") @db.Decimal(5, 2)    // نسبة مئوية 0-100
  warrantyMonths    Int       @default(0) @map("warranty_months")
  warrantyStartDate DateTime? @map("warranty_start_date") @db.Date
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")
  project Project @relation(fields: [projectId], references: [id])
  @@map("project_financial_settings")
}

// شجرة — self relation + soft delete
model BOQItem {
  id             String    @id @default(uuid()) @db.Uuid
  projectId      String    @map("project_id") @db.Uuid
  parentId       String?   @map("parent_id") @db.Uuid
  name           String
  contractValue  Decimal   @default(0) @map("contract_value") @db.Decimal(15, 2)
  order          Int       @default(0)
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")
  deletedAt      DateTime? @map("deleted_at")
  deletedBy      String?   @map("deleted_by") @db.Uuid
  deletionReason String?   @map("deletion_reason") @db.Text
  project  Project         @relation(fields: [projectId], references: [id])
  parent   BOQItem?        @relation("BOQTree", fields: [parentId], references: [id])
  children BOQItem[]       @relation("BOQTree")
  updates  BOQItemUpdate[]
  @@index([projectId])
  @@index([projectId, parentId])
  @@index([projectId, deletedAt])
  @@map("boq_items")
}

// join — تقرير معتمد ↔ بند
model BOQItemUpdate {
  id        String   @id @default(uuid()) @db.Uuid
  boqItemId String   @map("boq_item_id") @db.Uuid
  updateId  String   @map("update_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at")
  boqItem BOQItem @relation(fields: [boqItemId], references: [id])
  update  Update  @relation(fields: [updateId], references: [id])
  @@unique([boqItemId, updateId])   // منع الربط المكرّر
  @@index([boqItemId])
  @@index([updateId])
  @@map("boq_item_updates")
}
```

**Relations مضافة على models قائمة (back-relations إجبارية في Prisma):**
- `Project`: `financialSettings ProjectFinancialSettings?` + `boqItems BOQItem[]`.
- `Update`: `boqLinks BOQItemUpdate[]`.

**التغييرات:**
- تعديل `schema.prisma`.
- `npx prisma migrate dev --name s7_financial_boq --create-only` → مراجعة الـ SQL يدوياً.
- تطبيق الـ SQL على Supabase (`tbezbzlsuerjlohaoawy`) عبر `mcp__supabase__apply_migration` بعد موافقة (المبرمج يعرض الـ SQL في تقريره — Rule #8).
- `npx prisma generate` لتحديث الـ client types.

**الـ Risks:** أسماء الأعمدة snake_case لازم تطابق باقي الـ schema. تطبيق على DB حيّة — الـ 3 tables جديدة تماماً (لا ALTER على tables قائمة عدا إضافة back-relations وهي client-side مش DDL) ⇒ خطر منخفض. Decimal(5,2) للنِّسب كافٍ (0.00–999.99، نتحقق 0–100 في الـ DTO).

---

### المرحلة 2: توسيع `ensureProjectAccess` لـ ACCOUNTANT (القرار أ)
**الملف:** `apps/api/src/modules/projects/projects.service.ts:561`.

```ts
// قبل:
if (['SUPER_ADMIN', 'PROJECT_MANAGER'].includes(user.role)) return;
// بعد:
if (['SUPER_ADMIN', 'PROJECT_MANAGER', 'ACCOUNTANT'].includes(user.role)) return;
```

**⚠️ Blast radius (لازم يتوثّق ويُهاجَم في الهاكر):** `ensureProjectAccess` هو Layer-3 gate مشترك بين `payments`، `comments`، `updates`، `chat`، `media`. توسيعه يعطي ACCOUNTANT وصولاً company-wide **حيثما يكون ACCOUNTANT مُدرَجاً في `@Roles`** (Layer-2). أثره الفعلي:
- `payments` (findAll/findOne/getSummary): ACCOUNTANT كان assigned-only ⇒ يبقى company-wide. **ده المقصود.**
- `comments` (كل الأدوار في @Roles): ACCOUNTANT يبقى يقدر يقرأ/يعلّق على أي مشروع في شركته. **أثر جانبي — الهاكر يقيّمه.**
- `media`/`updates`/`chat`: يُفحص أي endpoint فيه ACCOUNTANT في @Roles.

**التخفيف:** الـ tenant isolation (companyId) ثابت — التوسيع company-wide مش cross-tenant. الخطر الأقصى = ACCOUNTANT يشوف بيانات مشروع مش معيَّن عليه داخل نفس الشركة، وهو دور مالي موثوق. **يُوثّق كقرار واعٍ + regression spec.**

**الـ Risks:** كسر specs قائمة تفترض ACCOUNTANT assigned-only. المبرمج يشغّل `payments.service.spec` + `projects` specs بعد التعديل ويوثّق أي كسر (Rule #8 literal output).

---

### المرحلة 3: هيكل Module `finance` (skeleton + DTOs)
**الملفات الجديدة:** `apps/api/src/modules/finance/{finance.module.ts, finance.controller.ts, dto/index.ts}`.

**Controller — 9 endpoints + مصفوفة الصلاحيات:**

| Endpoint | Method | @Roles |
|---|---|---|
| `projects/:projectId/financial-settings` | GET | SUPER_ADMIN, ACCOUNTANT, PROJECT_MANAGER |
| `projects/:projectId/financial-settings` | PATCH | SUPER_ADMIN, ACCOUNTANT |
| `projects/:projectId/financial-summary` | GET | SUPER_ADMIN, ACCOUNTANT, PROJECT_MANAGER, CLIENT |
| `projects/:projectId/boq` | GET | SUPER_ADMIN, ACCOUNTANT, PROJECT_MANAGER, CLIENT |
| `projects/:projectId/boq` | POST | SUPER_ADMIN, ACCOUNTANT |
| `boq/:id/sub-items` | POST | SUPER_ADMIN, ACCOUNTANT |
| `boq/:id` | PATCH | SUPER_ADMIN, ACCOUNTANT |
| `boq/:id` | DELETE | SUPER_ADMIN, ACCOUNTANT |
| `boq/:id/link-update` | PATCH | SUPER_ADMIN, ACCOUNTANT, PROJECT_MANAGER, SITE_ENGINEER, SUPERVISOR |

> **نقطة قرار (link-update roles):** الـ task table غطّى BOQ CRUD = SUPER_ADMIN/ACCOUNTANT فقط، لكن `PROJECT_OVERVIEW` (قسم "مين بيعمل إيه") ينص إن SITE_ENGINEER/SUPERVISOR يربطوا التقارير بالبنود. الافتراض المقترح أعلاه يوسّع link-update لدول (بدون WORKER/CLIENT). **لو تفضّل link-update = SUPER_ADMIN/ACCOUNTANT فقط قُل edit.**

**DTOs (كلها validation صارمة — الهاكر target):**
- `UpdateFinancialSettingsDto` (PATCH — كل الحقول optional): `contractValue?` (Decimal ≥0، 2 خانات)، `retentionPct?` (0–100)، `advanceAmount?` (≥0)، `advancePct?` (0–100)، `warrantyMonths?` (int 0–120)، `warrantyStartDate?` (ISO date).
- `CreateBOQItemDto`: `name` (1–200)، `contractValue` (0.00–999,999,999.99، 2 خانات)، `order?` (int ≥0).
- `UpdateBOQItemDto`: `name?`، `contractValue?`، `order?`.
- `LinkUpdateDto`: `updateId` (UUID).
- `DeleteBOQItemDto`: `reason?` (optional، ≤2000) — BOQ إعداد مش حركة نقدية، فالسبب اختياري لكن الـ audit إجباري.

**الـ Risks:** `@IsNumber` مع Decimal — الـ DTO يستقبل `number` ويتحوّل لـ `Decimal` في الـ service (نفس نمط `CreatePaymentDto.amount`). النِّسب كـ number 0–100.

---

### المرحلة 4: `FinancialSettingsService` (GET/PATCH + audit)
**الملف:** `apps/api/src/modules/finance/financial-settings.service.ts`.

- **GET:** `ensureProjectAccess` ثم `findUnique({ projectId })`. لو مفيش ⇒ يرجّع default object (كل القيم 0 + retentionPct=5) **بدون إنشاء صف** (أو يُنشأ lazily — نقطة قرار؛ الافتراض: يرجّع defaults بدون كتابة).
- **PATCH:** `ensureProjectAccess` + التأكد إن المشروع موجود (companyId + soft-delete). ثم **upsert** داخل transaction: لو مفيش صف يُنشأ، لو موجود يُحدَّث. **audit `logInTransaction`** بـ `oldValues` (القيم قبل — من الصف القديم أو defaults) و `newValues` (بعد) — entityType=`project_financial_settings`. **Paired assertion (Rule #4):** الـ spec يتأكد إن نفس القيمة المُدخَلة اتكتبت في الـ DB (deep) مش بس إن الـ audit اتنادى (surface).
- كل الأرقام Decimal، الإخراج `toFixed(2)` للنِّسب والقيم.

**الـ Risks:** الـ `oldValues` عند أول PATCH (مفيش صف) = defaults أو null — يُحدَّد بدقة عشان الـ audit ما يكونش مضلِّلاً (درس CVE-TEST-016 من BACKLOG: oldValues مش hardcoded — يُشتق من الحالة الفعلية).

---

### المرحلة 5: `FinancialSummaryService` (الحساب real-time)
**الملف:** `apps/api/src/modules/finance/financial-summary.service.ts`.

**الحساب (Decimal-only، ممنوع `Number()`):**
```
totalCompleted = Σ Update.cost
   WHERE status=APPROVED AND deletedAt=null
     AND phase.project.id = projectId AND phase.project.companyId = user.companyId
     AND phase.deletedAt = null
   → prisma.update.aggregate({ _sum: { cost }, where: { ... phase: { project: {...} } } })

retention        = totalCompleted × (retentionPct / 100)
advanceRecovered = min(advanceAmount, totalCompleted × (advancePct / 100))
totalPaid        = Σ Payment.amount WHERE projectId AND type=CLIENT_PAYMENT AND deletedAt=null
netDue           = totalCompleted − retention − advanceRecovered − totalPaid
retentionReleased = warrantyStartDate != null
                    AND addMonths(warrantyStartDate, warrantyMonths) < today
```
- `contractValue = 0` أو settings غير موجودة ⇒ retention/advance = 0 (defaults).
- الإخراج كله strings (`toFixed(2)`) + `retentionReleased: boolean`.
- **CLIENT:** نفس الأرقام المالية (totalCompleted/retention/advanceRecovered/totalPaid/netDue/retentionReleased) **بدون** الإعدادات الداخلية الخام (`retentionPct`/`advancePct`/`advanceAmount`/`contractValue` لا تُرجَع للـ CLIENT — يشوف النتائج مش المدخلات). الفرع حسب `user.role`.

**الـ Risks:**
- **الـ join عبر Phase:** أي خطأ يرجّع 0 أو يسرّب مشاريع أخرى. لازم `phase.project.companyId` في الـ where (defense-in-depth) + استبعاد phases/updates المحذوفة.
- **قسمة النِّسب:** `retentionPct/100` بـ Decimal (`.div(100)`) — دقة محفوظة.
- **min():** `Decimal.min(advanceAmount, ...)`.
- **addMonths:** منطق تواريخ — نستخدم حساب يدوي بـ Date (setMonth) مع الحذر من انزلاق نهاية الشهر؛ أو مقارنة بسيطة. warrantyStartDate=null ⇒ retentionReleased=false.

---

### المرحلة 6: `BOQService` (CRUD شجري + soft-delete + link + completedPct)
**الملف:** `apps/api/src/modules/finance/boq.service.ts`.

- **GET tree:** `ensureProjectAccess` ثم fetch كل `boqItems` (deletedAt=null، projectId، company عبر project) مرتبين بـ `order`. حساب `completedPct` لكل بند، ثم بناء الشجرة (parent/children) في الذاكرة.
  - **completedPct:** جلب كل `BOQItemUpdate` للمشروع حيث `update.status=APPROVED AND update.deletedAt=null`، select `boqItemId` + `update.cost`. reduce في الذاكرة: `Σ cost per boqItemId`. `pct = contractValue>0 ? min(100, (sum/contractValue)×100) : 0`. يُرجَع `completedValue` (Decimal string) + `completedPct` (0–100).
  - الروابط المباشرة على البند فقط (per task) — مفيش rollup تلقائي للأب (يُذكر كـ future enhancement).
- **POST بند رئيسي** (`projects/:id/boq`): `parentId=null`. audit CREATE.
- **POST sub-item** (`boq/:id/sub-items`): `parentId` = الـ :id من الـ URL. التحقق إن البند الأب موجود وغير محذوف وفي نفس المشروع/الشركة. audit CREATE.
- **PATCH** (`boq/:id`): تعديل name/contractValue/order. audit UPDATE (old/new).
- **DELETE soft** (`boq/:id`): **منع الحذف لو فيه `children` بـ `deletedAt=null` ⇒ `400 "لا يمكن حذف بند له تفريعات نشطة"`** (القرار #3). وإلا set `deletedAt/deletedBy/deletionReason` + audit DELETE. **لا `prisma.boqItem.delete()` أبداً.**
- **PATCH link-update** (`boq/:id/link-update`): التحقق إن الـ update موجود، حالته **APPROVED**، و`update.phase.project.id === boqItem.projectId` (**IDOR/cross-project defense**) ونفس الشركة. إنشاء `BOQItemUpdate` (الـ unique constraint يمنع التكرار ⇒ لو مكرّر `400`/idempotent). audit.

**الـ Risks:**
- **Cross-project link (IDOR):** أخطر vector — ربط update من مشروع/شركة أخرى ببند. الدفاع: مطابقة `project.id` + `companyId` عبر `update → phase → project`.
- **completedPct divide-by-zero** عند contractValue=0.
- **soft-delete children check:** لازم يفلتر `deletedAt: null` (بند له أبناء كلهم محذوفون = يُسمح بحذفه).
- **الـ tree N+1:** جلب كل الروابط في query واحدة + reduce، مش query per item.

---

### المرحلة 7: الربط + التحقق
**الملف:** `apps/api/src/app.module.ts` (تسجيل `FinanceModule`).
- `npx tsc -p tsconfig.build.json --noEmit` ⇒ صفر أخطاء جديدة (literal في التقرير — Rule #8).
- التأكد إن الـ routes متسجّلة (nest route list أو boot).

---

## الـ Skills المطلوبة
- `02-database.md` → soft-delete + transactions + Decimal + self-relation tree.
- `03-auth-security.md` → صلاحيات per-role + `ensureProjectAccess` + tenant isolation.
- `07-audit-compliance.md` → `logInTransaction` (settings PATCH + BOQ delete) + oldValues مشتقة (درس CVE-TEST-016).
- `01-api-endpoints.md` → بنية controller/DTO.
- `06-error-handling.md` → رسائل عربية موحّدة.
- `08-testing.md` → نمط `*.service.spec.ts` (mock Prisma، paired assertions).

## نقاط القرار (محتاجة موافقتك أو تُقَرّ ضمنياً بـ approve)
1. **link-update roles** = SUPER_ADMIN/ACCOUNTANT/PROJECT_MANAGER/SITE_ENGINEER/SUPERVISOR (بناءً على PROJECT_OVERVIEW). ← أكّد أو edit.
2. **GET financial-settings عند عدم وجود صف** = يرجّع defaults بدون إنشاء صف (lazy، مش upsert-on-read).
3. **DeleteBOQItemDto.reason** = اختياري (BOQ إعداد مش حركة نقدية).
4. **completedPct** = روابط مباشرة فقط بلا rollup للأب (per task literal).

## التأثير على الـ Codebase الحالي
- `projects.service.ts:561` → ACCOUNTANT يبقى company-wide في **كل** المستهلكين لـ `ensureProjectAccess` (blast radius موثّق أعلاه — يُهاجَم في الهاكر).
- `schema.prisma` → 3 tables + back-relations على Project/Update.
- `app.module.ts` → +FinanceModule.
- `payments` specs → يُعاد تشغيلها للـ regression بعد تغيير ensureProjectAccess.

## تعريف النجاح
- [ ] 3 models + migration مُطبّقة على Supabase + `prisma generate` نظيف.
- [ ] 9 endpoints بالصلاحيات الصحيحة (جدول المرحلة 3).
- [ ] financial-summary: القيم الـ 5 + retentionReleased صحيحة مقابل مثال رقمي معلوم بـ Decimal.
- [ ] ACCOUNTANT company-wide شغّال + صفر regression في payments specs.
- [ ] audit على PATCH settings + soft-delete BOQ (oldValues مشتقة مش hardcoded).
- [ ] منع حذف بند له أبناء نشطون (400).
- [ ] link-update يمنع cross-project (IDOR).
- [ ] صفر خطأ tsc جديد فوق baseline.
- [ ] **MVT: 8 specs مكتوبة وpassing** (إجباري):
  - FinancialSettingsService: 2 (GET defaults/existing؛ PATCH يكتب audit + paired assertion على القيمة الفعلية في الـ DB).
  - FinancialSummaryService: 2 (الحساب الكامل بأرقام معلومة؛ CLIENT بدون الإعدادات الداخلية).
  - BOQService: 3 (soft-delete لا يستدعي delete()؛ completedPct من APPROVED فقط؛ منع حذف بند له أبناء نشطون).
  - ensureProjectAccess: 1 regression (ACCOUNTANT company-wide يمرّ؛ ACCOUNTANT شركة أخرى يُرفض).
  - **+1 spec لكل CVE-FIXED-BY-HACKER** (يُضاف لميزانية المختبر بعد الهاكر).

---
⏸️ AWAITING APPROVAL
رد بـ "approve" للمتابعة للمبرمج (💻)، أو "edit: [تعديل]" لتعديل الخطة.

✋ تم المخطط — للدور التالي؟
