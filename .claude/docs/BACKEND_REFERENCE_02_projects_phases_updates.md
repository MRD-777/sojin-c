# 📗 الملف 2 — Projects + Phases + Updates (قلب النظام)

> الجزء التاني من التقرير. بيغطي الموديولات اللي بتمثّل المنطق الأساسي للأعمال: المشاريع، مراحلها، والتحديثات اليومية (أهم وأعقد جزء في النظام).
> الهرمية: **Project → Phase → Update → (Media + Comments)**. كل update بيرفع نسبة تقدم المرحلة، وكل مرحلة بترفع تقدم المشروع.

---

## 🧩 العلاقة بين الموديولات الثلاثة (مهم تفهمها الأول)

```
Company
  └── Project       (overallProgress 0-100, status state machine)
        └── Phase   (progress 0-100, weight, status state machine)
              └── Update  (progressIncrement, cost, status state machine — القلب)
```

**حساب التقدم (Progress) بيمشي من تحت لفوق:**
1. الـ Update لما يتعمله **approve** → بيزوّد `phase.progress` بمقدار `update.progressIncrement` (بحد أقصى 100).
2. بعد كده بيتنده `recalculateProgressInTx` → بيحسب `project.overallProgress` = المتوسط المرجّح (weighted average) لتقدم المراحل حسب وزن كل مرحلة.

**التبعية في الكود:**
- `PhasesModule` و `UpdatesModule` بيستوردوا `ProjectsModule` عشان يستخدموا `ProjectsService.ensureProjectAccess` و `recalculateProgressInTx`.
- الثلاثة بيستوردوا `AuditModule`. و `ProjectsModule` بيستورد `CompaniesModule` (للـ TierLimits).

---

═══════════════════════════════════════════════════════════════

## 📋 القسم 1: موديول Projects (المشاريع)

### 1. الغرض
إدارة المشاريع: إنشاء، تعديل، تغيير الحالة (state machine)، تعيين/إزالة أعضاء الفريق، الحذف الناعم. + الرؤية المبنية على الدور (role-based visibility) — كل دور بيشوف مشاريع مختلفة. + حساب التقدم الكلي للمشروع.

### 2. الملفات
| الملف | الأسطر | بيعمل إيه |
|------|:-----:|----------|
| `projects.module.ts` | 16 | يستورد AuditModule + CompaniesModule. يصدّر ProjectsService (عشان Phases/Updates). |
| `projects.controller.ts` | 143 | 8 endpoints. |
| `projects.service.ts` | 578 | كل المنطق + state machine + progress calc + access control. |
| `dto/index.ts` | 162 | 7 DTOs. |

**ثوابت مهمة في الـ service:**
- `STATUS_TRANSITIONS` — جدول انتقالات حالة المشروع (تحت).
- `PROJECT_SELECT` — الحقول الآمنة للإرجاع (مع بيانات العميل).

### 3. الـ Endpoints بالتفصيل

#### 🔹 `GET /api/v1/projects` (findAll)
- **الأدوار:** كل الأدوار المصادَقة (مفيش `@Roles`)؛ **لكن الرؤية بتتفلتر في الـ service:**
  - `CLIENT` → بس المشاريع اللي هو `clientId` بتاعها.
  - `SUPER_ADMIN` / `PROJECT_MANAGER` → كل مشاريع الشركة.
  - باقي الأدوار (مهندس/مشرف/محاسب/عامل) → بس المشاريع المعيّن عليها (`assignments.some({ userId, removedAt: null })`).
- **Query DTO:** `ListProjectsQueryDto` — pagination + `search` (name/location) + `status` + `type`.
- بيرجّع كل مشروع مع `_count` لعدد الـ phases والـ assignments.

#### 🔹 `GET /api/v1/projects/:id` (findOne)
- **كل الأدوار** (الوصول بيتفحص في الـ service بـ `ensureProjectAccess`).
- بيرجّع المشروع كامل + المراحل (مرتبة بالـ order) + الأعضاء المعيّنين + `_count` للمدفوعات وغرف الشات.
- لو المشروع مش في الشركة → `404`. لو الدور مالوش وصول → `403` (من `ensureProjectAccess`).

#### 🔹 `POST /api/v1/projects` (create)
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`.
- **DTO:** `CreateProjectDto`:
  | الحقل | القواعد |
  |------|---------|
  | `name` | string, مطلوب, ≤300 |
  | `description` | اختياري, ≤2000 |
  | `location` | اختياري, ≤500 |
  | `type` | enum (FULL_FINISHING/PARTIAL_FINISHING/CONSTRUCTION), default FULL_FINISHING |
  | `clientId` | **UUID v4 مطلوب** |
  | `startDate`, `expectedEndDate` | ISO date strings, اختياري |
  | `totalBudget` | رقم ≥0, اختياري |
  | `dailyUpdateDeadline` | regex `^\d{2}:\d{2}$` (HH:mm), default 17:00 |
- **خطوة بخطوة:**
  1. **Tier gate:** `tierLimits.assertCanAddProject` → 402 لو وصلت الحد.
  2. **التحقق من العميل:** لازم `clientId` يكون user موجود في نفس الشركة **ودوره `CLIENT`**. لو لأ → `400 "العميل غير موجود أو ليس بدور عميل"`.
  3. transaction: `project.create` (status default = DRAFT) + audit (`CREATE`).
- **مثال request:**
```json
{ "name": "فيلا التجمع الخامس", "clientId": "uuid-client", "type": "FULL_FINISHING", "totalBudget": 2500000, "dailyUpdateDeadline": "16:00" }
```

#### 🔹 `PATCH /api/v1/projects/:id` (update)
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`. **DTO:** `UpdateProjectDto` (نفس حقول الإنشاء، كلها اختيارية، **ما عدا clientId و status**).
- **Whitelist يدوي** — `status` **مش** قابل للتعديل من هنا (ليه endpoint مخصص). transaction: update + audit.

#### 🔹 `PATCH /api/v1/projects/:id/status` (changeStatus) — State Machine
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`. **DTO:** `ChangeProjectStatusDto` — `status` (enum) + `reason?` (≤500).
- **المنطق:**
  1. يتأكد إن الانتقال مسموح حسب `STATUS_TRANSITIONS` (تحت). لو لأ → `400` برسالة بتقول الانتقالات المسموحة.
  2. **reason إجباري (≥20 حرف)** للانتقالات السلبية: `ON_HOLD`, `CANCELLED`. لو ناقص → `400`.
  3. لو الحالة الجديدة `COMPLETED` → بيحط `actualEndDate = now`.
  4. transaction: update + audit. **الـ audit action بيتحدد ذكياً:** `CANCELLED` → `DELETE` (terminal سلبي)، غير كده → `UPDATE`.

#### 🔹 `DELETE /api/v1/projects/:id` (softDelete)
- **الأدوار:** `SUPER_ADMIN` فقط. **DTO:** `DeleteProjectDto` — `reason` (20–2000، إجباري).
- transaction: `deletedAt = now` + audit (`DELETE`) مع snapshot (name, status, totalBudget).

#### 🔹 `POST /api/v1/projects/:id/assignments` (assignMember)
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`. **DTO:** `AssignMemberDto` — `userId` (UUID), `roleInProject` (enum: SITE_ENGINEER/SUPERVISOR/ACCOUNTANT/WORKER/FOREMAN), `isRequiredDailyUpdate?` (bool).
- **المنطق:**
  1. العضو لازم يكون في نفس الشركة ودوره واحد من `[SITE_ENGINEER, SUPERVISOR, ACCOUNTANT, WORKER]` (مش CLIENT ولا PM/admin — دول بيشوفوا كل المشاريع أصلاً).
  2. لو معيّن بالفعل (`removedAt: null`) → `409`.
  3. **Upsert ذكي:** لو كان معيّن قبل كده واتشال (`removedAt` مش null) → يعيد تفعيله (update). وإلا → create جديد.
  4. audit (`CREATE`، entityType=`project_assignment`).

#### 🔹 `DELETE /api/v1/projects/:id/assignments/:userId` (removeMember)
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`. **DTO:** `RemoveMemberDto` — `reason` (20–2000).
- soft-remove (`removedAt = now`) + audit (`DELETE`). لو مش معيّن أصلاً → `404`.

### 4. الـ Business Logic المعقّد

**أ) State Machine للمشروع (`STATUS_TRANSITIONS`):**
```
DRAFT       → [IN_PROGRESS, CANCELLED]
IN_PROGRESS → [ON_HOLD, COMPLETED, CANCELLED]
ON_HOLD     → [IN_PROGRESS, CANCELLED]
COMPLETED   → []   (نهائي — مايتحركش)
CANCELLED   → []   (نهائي)
```
مثال: مشروع `DRAFT` → محاولة `COMPLETED` مباشرة → مرفوض (`400`) لأنها مش في القائمة. لازم يعدي بـ `IN_PROGRESS` الأول.

**ب) حساب التقدم الكلي (`recalculateProgressInTx`) — المتوسط المرجّح:**
- بياخد كل المراحل غير المحذوفة (`progress`, `weight`).
- لو مفيش مراحل أو مجموع الأوزان = 0 → `overallProgress = 0`.
- وإلا: `overallProgress = round( Σ(progress × weight) / Σ(weight) )` بحد أقصى 100.

**مثال رقمي فعلي:**
مشروع فيه 3 مراحل:
| المرحلة | progress | weight |
|--------|:--------:|:------:|
| الأساسات | 100% | 3 |
| الهيكل | 50% | 2 |
| التشطيب | 0% | 5 |

`Σ(progress × weight)` = (100×3) + (50×2) + (0×5) = 300 + 100 + 0 = **400**
`Σ(weight)` = 3 + 2 + 5 = **10**
`overallProgress` = round(400 / 10) = **40%**

> **قرار معماري مهم (C28):** الدالة اسمها `recalculateProgressInTx` ونوع البراميتر `Prisma.TransactionClient` بس — **مفيش نسخة تشتغل برّه transaction**. السبب: قبل كده كانت بتشتغل بعد ما الـ approve/forceCancel transaction يـ commit، فلو الـ process مات بين الكتبتين → نافذة حالة قديمة (stale). دلوقتي التوقيع نفسه بيمنع الغلطة وقت الـ compile.

### 5. القرارات الأمنية

**`ensureProjectAccess` (CVE-PROJ-001) — أهم قرار أمني في الموديول:**
- بيعمل **tenant + soft-delete gate الأول لكل الأدوار، حتى الـ admins**.
- **الثغرة اللي بيقفلها:** قبل كده الـ admins كانوا بيعملوا short-circuit قبل أي DB lookup، فـ `SUPER_ADMIN`/`PROJECT_MANAGER` من شركة A كان يقدر يمرّر `projectId` بتاع شركة B خلال الفحص — وبعدين callers تانية بتثق في العقد (زي `chat.findRooms`) كانت بترجّع بيانات cross-tenant.
- **بيرمي دايماً `ForbiddenException` (مش NotFound)** عند الفشل، لأن وجود/عدم وجود المورد نفسه معلومة مميّزة (privileged) — التمييز بين 403 و404 ممكن يتستغل كـ oracle.
- بعد فحص الـ tenant: admins → مسموح؛ CLIENT → لازم يكون هو الـ clientId؛ باقي الأدوار → لازم يكون عنده assignment نشط.

أمان إضافي: tenant isolation في كل query، mass-assignment whitelist، reason إجباري للعمليات السلبية، audit جوه كل transaction.

---

═══════════════════════════════════════════════════════════════

## 🔧 القسم 2: موديول Phases (المراحل)

### 1. الغرض
إدارة مراحل المشروع: إنشاء، تعديل (مع state machine)، تجاوز نسبة التقدم يدوياً (override)، إعادة الترتيب (reorder)، الحذف الناعم. كل تغيير في حالة/وزن/تقدم المرحلة بيعيد حساب تقدم المشروع الأب.

### 2. الملفات
| الملف | الأسطر | بيعمل إيه |
|------|:-----:|----------|
| `phases.module.ts` | 16 | يستورد AuditModule + ProjectsModule. |
| `phases.controller.ts` | 107 | 6 endpoints. لاحظ إن الـ `@Controller()` فاضي — الـ routes فيها prefix يدوي. |
| `phases.service.ts` | 357 | المنطق + state machine للمرحلة. |
| `dto/index.ts` | 114 | 5 DTOs. |

**ثابت:** `PHASE_STATUS_TRANSITIONS`.

### 3. الـ Endpoints بالتفصيل

> ملاحظة: الـ controller فيه routes بمسارين مختلفين — بعضها تحت `projects/:projectId/phases` وبعضها تحت `phases/:id`.

#### 🔹 `GET /api/v1/projects/:projectId/phases` (findAll)
- **كل الأدوار** (`ensureProjectAccess` بيفحص). بيرجّع المراحل مرتبة بالـ order + `_count` للـ updates والـ subContractors.

#### 🔹 `GET /api/v1/phases/:id` (findOne)
- **كل الأدوار**. بيرجّع المرحلة + المشروع. لو مش في الشركة → `404`، وبعدها `ensureProjectAccess`.

#### 🔹 `POST /api/v1/projects/:projectId/phases` (create)
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`. **DTO:** `CreatePhaseDto` — `name` (≤300), `description?` (≤2000), `order?` (int ≥0), `weight?` (int 1–100, default 1), `startDate?`, `expectedEndDate?`, `budget?` (≥0).
- **المنطق:**
  1. `ensureProjectAccess` + التأكد إن المشروع موجود في الشركة.
  2. **Auto-order:** لو `order` مش متبعت → بياخد أكبر order موجود + 1 (يعني المرحلة الجديدة تتحط في الآخر).
  3. transaction: create + audit (`CREATE`) + **`recalculateProgressInTx`** (لأن إضافة مرحلة بتغيّر توزيع الأوزان).

#### 🔹 `PATCH /api/v1/phases/:id` (update)
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`. **DTO:** `UpdatePhaseDto` — `name?`, `description?`, `weight?` (1–100), `status?` (enum)، `startDate?`, `expectedEndDate?`, `budget?`.
- **State machine:** لو `status` بيتغير، لازم يكون انتقال مسموح. transaction: update + audit. **لو `weight` اتغير → recalc** (لأن الوزن بيأثر على تقدم المشروع).

#### 🔹 `PATCH /api/v1/phases/:id/progress` (overrideProgress)
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`. **DTO:** `OverrideProgressDto` — `progress` (int 0–100) + `reason` (**20–2000 إجباري**).
- بيكتب الـ progress يدوياً + audit (`PROGRESS_OVERRIDE`) + **recalc**. ده الـ override اليدوي لما الإدارة عايزة تظبط النسبة بدون updates.

#### 🔹 `PATCH /api/v1/phases/:id/reorder` (reorder)
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`. **DTO:** `ReorderPhaseDto` — `order` (int 0–1000).
- update للـ order + audit (`UPDATE`). **مفيش recalc** (الترتيب مايأثرش على النسبة).

#### 🔹 `DELETE /api/v1/phases/:id` (softDelete)
- **الأدوار:** `SUPER_ADMIN` فقط. **DTO:** `DeletePhaseDto` — `reason` (20–2000).
- **حماية مهمة:** بيرفض الحذف لو فيه أي update نشط (`DRAFT`/`PENDING`/`APPROVED`) على المرحلة → `400 "يوجد X تحديث نشط عليها"`.
- transaction: `deletedAt = now` + audit (`DELETE`) + **recalc**.

### 4. الـ Business Logic المعقّد

**State Machine للمرحلة (`PHASE_STATUS_TRANSITIONS`):**
```
NOT_STARTED → [IN_PROGRESS, ON_HOLD]
IN_PROGRESS → [ON_HOLD, COMPLETED]
ON_HOLD     → [IN_PROGRESS]
COMPLETED   → []   (نهائي)
```
لاحظ: مفيش `CANCELLED` للمراحل (عكس المشاريع). و `COMPLETED` نهائي.

**ليه كل تغيير بيعمل recalc؟** لأن تقدم المشروع = دالة في (progress, weight) لكل مرحلة. أي تغيير في الاتنين دول لازم يحدّث `project.overallProgress` فوراً وجوه نفس الـ transaction (C28).

### 5. القرارات الأمنية
- **`ensureProjectAccess`** بيتنده في كل operation (وراثة الحماية من Projects).
- **Tenant isolation** عن طريق `project: { companyId, deletedAt: null }` في كل query.
- **منع حذف مرحلة بـ updates نشطة** — حماية للبيانات المالية والتقدّم.
- **reason إجباري** للـ override والحذف.
- **audit + recalc جوه transaction واحد** — atomicity.

---

═══════════════════════════════════════════════════════════════

## 📝 القسم 3: موديول Updates (التحديثات اليومية) — قلب النظام

### 1. الغرض
ده **أهم وأعقد موديول في النظام**. التحديث اليومي هو السجل اللي بيعمله العامل/المهندس في الموقع كل يوم: شغل اتعمل، عمالة، ساعات، مواد مستخدمة، تكلفة، ونسبة تقدم. بيمر بدورة حياة (state machine) من مسودة → مراجعة → اعتماد. الاعتماد بيحرّك "فلوس" (نسبة التقدم + المدفوعات)، فالأمان والـ idempotency والـ concurrency control هنا في أعلى مستوياتهم.

### 2. الملفات
| الملف | الأسطر | بيعمل إيه |
|------|:-----:|----------|
| `updates.module.ts` | 16 | يستورد AuditModule + ProjectsModule. |
| `updates.controller.ts` | 193 | 10 endpoints. بيعرّف `FIELD_ROLES` و `VIEWER_ROLES`. |
| `updates.service.ts` | **1028** | **أكبر service في المشروع**. كل منطق دورة الحياة + concurrency + tz handling. |
| `dto/index.ts` | 234 | 6 DTOs مع ثوابت حدود مركزية. |

**ثوابت مهمة:**
- `LOCK_WINDOW_MS = 24h` — نافذة تعديل التحديث المعتمد.
- `ADMIN_TIER_ROLES = [SUPER_ADMIN, PROJECT_MANAGER, ACCOUNTANT]` — الأدوار اللي بتشوف كل التحديثات (المحاسب موجود هنا — D2=A — لأنه محتاج بنود التكلفة والمواد قبل الاعتماد).

### 3. الـ Endpoints بالتفصيل

#### 🔹 `GET /api/v1/phases/:phaseId/updates` (findAll)
- **الأدوار (VIEWER):** كل الأدوار بما فيهم CLIENT. **DTO:** `ListUpdatesQueryDto` — pagination + `status?` (enum).
- **فلترة الحالة بـ 3 مستويات (CVE-UPD-001):**
  - **CLIENT** → `status = APPROVED` ثابت، الـ `query.status` بيتجاهَل تماماً.
  - **ADMIN_TIER** → فلتر حر (يشوفوا كل حاجة).
  - **FIELD ROLES** (مهندس/مشرف/عامل) → **متقيّد:**
    - مفيش `query.status` → `OR: [submittedBy = me, status = APPROVED]`.
    - `query.status = APPROVED` → كله (APPROVED مرئي للكل).
    - أي status تاني → بس بتاعي أنا (`status = X AND submittedBy = me`).
  - **الثغرة المقفولة:** قبل كده FIELD role كان يقدر يبعت `?status=PENDING` ويتخطى الـ narrow ويشوف كل التحديثات المعلّقة في المرحلة. دلوقتي الـ query.status بيـ refine الـ narrow مش بيستبدله.

#### 🔹 `GET /api/v1/updates/:id` (findOne)
- **الأدوار (VIEWER).** بيرجّع التحديث كامل + المرحلة + المشروع + الـ media (غير المحذوفة) + الـ comments.
- **فحوصات الرؤية (CVE-UPD-006):** كل مسارات الرفض بترجّع **`NotFoundException`** (مش 403) عشان المهاجم ما يقدرش يعرف وجود المورد من الفرق بين 403 و404:
  - cross-tenant → 404.
  - CLIENT مش صاحب المشروع، أو الحالة مش APPROVED → 404.
  - FIELD role مش صاحب التحديث والحالة مش APPROVED → 404.

#### 🔹 `POST /api/v1/phases/:phaseId/updates` (create) — DRAFT
- **الأدوار (FIELD).** CLIENT ممنوع (`403`). **DTO:** `CreateUpdateDto`:
  | الحقل | القواعد |
  |------|---------|
  | `title` | مطلوب, 5–200 |
  | `description` | اختياري, ≤5000 |
  | `workDone`, `workRemaining` | اختياري, ≤2000 |
  | `workersCount` | int 0–1000 |
  | `workHours` | رقم 0–24 |
  | `materialsUsed` | array, ≤50 عنصر `{name, quantity, unit, cost}` |
  | `cost` | رقم 0–999,999,999.99 |
  | `progressIncrement` | int 0–100 |
- **خطوة بخطوة:**
  1. CLIENT → 403.
  2. `getPhaseWithAccess`. لو مش admin/PM → لازم يكون معيّن على المشروع (`403` لو لأ).
  3. **Duplicate-submission guard (I9 + CVE-UPD-003):** قاعدة العمل = مستخدم واحد × مرحلة واحدة × يوم تقويمي واحد = تحديث **نشط** واحد بحد أقصى (نشط = DRAFT/PENDING/APPROVED، مش REJECTED/FORCE_CANCELLED).
     - حدود اليوم بتتحسب بـ **timezone الشركة** (`computeDayBounds`) — مش UTC — عشان مستخدمي القاهرة ما يتفاجئوش بانتقال منتصف الليل UTC.
     - الفحص + الإنشاء بيتعملوا في **نفس الـ transaction بـ Serializable isolation** (`runSerializable`) عشان POSTين متوازيين ما يعدّوش الفحص الاتنين ويعملوا insert. Postgres Serializable بيكتشف الـ write-skew ويـ abort واحد، والعميل يعيد المحاولة.
  4. لو فيه تحديث اليوم → `409` مع وصف حالته (مسودة/قيد المراجعة/معتمد).
  5. create (status=DRAFT) + audit.

#### 🔹 `PATCH /api/v1/updates/:id` (editDraft) — DRAFT/REJECTED
- **الأدوار (FIELD).** **DTO:** `EditUpdateDto` (كل الحقول اختيارية بس بنفس الحدود).
- **المنطق:** `getOwnedUpdate` (لازم تكون صاحبه). يسمح بالتعديل بس لو الحالة DRAFT أو REJECTED.
- **معالجة REJECTED → DRAFT (BUG-UPD-009):** لو كان مرفوض، التعديل بيرجّعه DRAFT **ويمسح** الـ `rejectionReason`/`reviewedBy`/`reviewedAt` (عشان ما يفضلش يظهر "مرفوض بسبب X" بعد إعادة الاعتماد). لكن الـ audit بيحتفظ بالـ rejectionReason القديم في الـ trail.

#### 🔹 `POST /api/v1/updates/:id/submit` — DRAFT → PENDING
- **الأدوار (FIELD).** لازم صاحبه + الحالة DRAFT + `title` مش فاضي. transaction: status=PENDING + `submittedAt = now` + audit.

#### 🔹 `POST /api/v1/updates/:id/approve` — PENDING → APPROVED (idempotent)
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`. **لازم header `Idempotency-Key`** (16–64 char).
- **خطوة بخطوة (أعقد دالة):**
  1. **Idempotency lookup** بـ fingerprint = `{updateId, action: 'approve'}`. لو موجود → يرجّع الـ cached body (double-click ما يزوّدش التقدم مرتين).
  2. فحص الوجود + tenant + الحالة PENDING (pre-tx، fast-fail).
  3. **`runSerializable` transaction:**
     - **CVE-UPD-008:** re-read للحالة **جوه** الـ tx قبل التعديل. الفحص اللي برّه TOCTOU window — approve متوازي اتعمله commit الأول ممكن يخلّي Serializable مش قادر يـ abort (مفيش tx overlap في الحالة المتدرّجة)، فبدون الـ guard ده التقدم هيتزوّد مرتين. لو الحالة اتغيّرت → `409`.
     - status=APPROVED + reviewedBy/reviewedAt.
     - **زيادة تقدم المرحلة** بـ `increment: progressIncrement` ثم cap عند 100 (`updateMany where progress > 100`).
     - **`recalculateProgressInTx`** للمشروع.
     - audit (`APPROVE`).
     - **CVE-UPD-009:** تطبيع (normalize) الـ response body مرة واحدة (cost كـ string، dates كـ ISO) عشان الـ first-call والـ replay يطابقوا بعض في الشكل.
     - **`saveInTransaction`** للـ idempotency record **جوه** الـ tx (CVE-UPD-002) عشان المفتاح + الآثار يـ commit مع بعض atomically.
- **الأخطاء:** `404`, `400` (مش PENDING), `409` (race), `422` (idempotency key بنفس المفتاح وبيانات مختلفة).

#### 🔹 `POST /api/v1/updates/:id/reject` — PENDING → REJECTED
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`. **DTO:** `RejectUpdateDto` — `reason` (10–1000، إجباري).
- transaction: status=REJECTED + rejectionReason + reviewer + audit (`REJECT`). مفيش idempotency (مش بيحرّك فلوس).

#### 🔹 `POST /api/v1/updates/:id/force-cancel` — APPROVED → FORCE_CANCELLED (idempotent)
- **الأدوار:** `SUPER_ADMIN` فقط. **DTO:** `ForceCancelDto` — `reason` (20–2000). **لازم Idempotency-Key.**
- **ده أخطر operation** — بيعكس التقدم **ويسجّل تكلفة غارقة (SUNK_COST)**. خطوة بخطوة:
  1. Idempotency lookup (fingerprint فيه الـ reason كمان).
  2. pre-tx read: fast-fail على الوجود/tenant/الحالة APPROVED.
  3. **`runSerializable`:**
     - **CVE-UPD-005:** re-read جوه الـ tx (cost/progressIncrement/status لحظتها). لو مش APPROVED → `409`.
     - status=FORCE_CANCELLED + forceCancelReason + forceCancelledBy.
     - **عكس التقدم:** `decrement: progressIncrement` ثم floor عند 0.
     - **لو الـ cost > 0 → إنشاء Payment نوع `SUNK_COST`** (method=OTHER، الوصف فيه عنوان التحديث) + audit للـ payment.
     - audit للـ FORCE_CANCEL.
     - `recalculateProgressInTx`.
     - `saveInTransaction` للـ idempotency.

#### 🔹 `PATCH /api/v1/updates/:id/edit-approved` — تعديل خلال 24 ساعة
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`. **DTO:** `EditApprovedDto` — title/description/workDone/workRemaining/workersCount/workHours + `changeReason` (20–1000، **إجباري**). **ملاحظة:** الحقول المالية (cost/progressIncrement/materialsUsed) **مرفوضة** هنا (D3=A) — أي محاولة لإرسالها → 400.
- **المنطق:**
  1. لازم الحالة APPROVED + `!isLocked`.
  2. **فحص نافذة الـ 24 ساعة:** لو `now - reviewedAt > 24h` → **auto-lock** (isLocked=true, lockedAt=now) + `403 "انتهت فترة التعديل"`.
  3. **`runSerializable`:**
     - **snapshot للحالة قبل التعديل في `UpdateVersion`** (تاريخ غير قابل للتعديل) — versionNumber = count + 1.
     - **CVE-UPD-007:** Serializable + الـ unique constraint `(updateId, versionNumber)` بيمنعوا تعديلين متوازيين من إدخال نفس الرقم — Postgres بيـ abort التاني فالعميل يعيد المحاولة بـ count جديد.
     - update للحقول غير المالية بس (خط دفاع تاني).
     - audit (`UPDATE`) + reason.

#### 🔹 `GET /api/v1/updates/:id/versions` (getVersions)
- **الأدوار:** `SUPER_ADMIN`, `PROJECT_MANAGER`, `ACCOUNTANT`. بيرجّع تاريخ الإصدارات (snapshots) مرتب تنازلياً مع بيانات اللي عدّل.

### 4. الـ Business Logic المعقّد

**أ) State Machine للتحديث (من التعليقات + الكود):**
```
DRAFT ──submit──> PENDING ──approve──> APPROVED ──(24h)──> 🔒 LOCKED
  ↑                  │                    │
  │ (edit)           ├─reject─> REJECTED  └─force-cancel─> FORCE_CANCELLED
  │                  │            │
  └──────────────────┘            └──(edit)──> DRAFT (يمسح الرفض)
```
- DRAFT و REJECTED قابلين للتعديل (والتعديل بيرجّع REJECTED لـ DRAFT).
- APPROVED قابل للتعديل (غير مالي بس) خلال 24 ساعة، بعدها مقفول للأبد.
- FORCE_CANCELLED و REJECTED حالات سلبية.

**ب) معالجة الـ Timezone (`computeDayBounds` + `toUtcFromLocal`):**
- بيحسب بداية/نهاية اليوم التقويمي في timezone الشركة (IANA) ويحوّلهم لـ UTC instants.
- بيستخدم `Intl.DateTimeFormat` بدل مكتبة خارجية (date-fns-tz).
- **BUG-UPD-012:** لو الـ timezone غلط، الـ fallback لـ UTC لازم يغطّي **الاتنين** formatters — قبل كده واحد بس كان بيعمل fallback والتاني بيرمي RangeError ويحوّل timezone غلط لـ 500 على الإنشاء. دلوقتي فيه `effectiveTz` بيتستخدم في التحويل كمان.

**ج) مثال رقمي للـ approve → progress:**
- مرحلة `progress = 30`، تحديث `progressIncrement = 80`.
- approve → `phase.progress = 30 + 80 = 110` → الـ cap بيخليها `100`.
- بعدها recalc للمشروع.
- لو اتعمل force-cancel للتحديث ده: `progress = 100 - 80 = 20` (مش 30! لأن الـ cap ضيّع 10) → floor عند 0 لو طلعت سالبة.

**د) مثال رقمي للـ SUNK_COST:**
- تحديث معتمد `cost = 50000` جنيه، اتعمله force-cancel.
- يتعمل Payment: `{ amount: 50000, type: SUNK_COST, method: OTHER, description: "تكلفة غارقة من تحديث ملغي: <العنوان>" }`.
- ده بيخلّي التكلفة محسوبة في حسابات المشروع حتى بعد إلغاء التحديث.

### 5. القرارات الأمنية (الموديول ده فيه أكتر قرارات أمنية في النظام)
| القرار | الوصف | الكود |
|-------|------|------|
| **Tenant isolation** | كل query فيه فحص `companyId` | كل الدوال |
| **404 موحّد** | كل رفض رؤية → NotFound مش 403 (anti-enumeration) | CVE-UPD-006, BUG-UPD-011 |
| **Status filter narrowing** | FIELD roles مايقدروش يتخطوا الـ narrow بـ query | CVE-UPD-001 |
| **Idempotency** | approve/force-cancel محميين بمفتاح | CVE-UPD-002, PAY-IDEM |
| **Serializable + in-tx re-read** | منع double-apply في الـ concurrency | CVE-UPD-003/005/008 |
| **Unique version constraint** | منع تكرار رقم الإصدار | CVE-UPD-007 |
| **24h lock window** | مفروض server-side، auto-lock | LOCK_WINDOW_MS |
| **Money fields locked post-approval** | cost/progress مايتعدّلوش بعد الاعتماد | D3=A |
| **CLIENT hardcoded APPROVED** | العميل يشوف المعتمد بس على مشاريعه | rule 5 |
| **Audit جوه كل transaction** | كل transition متسجّل | كل الدوال |

➡️ التالي: **الملف 3** — Payments, Media (+ security), Comments.
