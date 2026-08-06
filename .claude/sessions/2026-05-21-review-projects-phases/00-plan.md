# خطة التنفيذ

## المشكلة

موديولا **Projects** و **Phases** في production بدون أي test coverage (0 specs)، رغم احتوائهم على business logic حساس: state machines، RBAC visibility filtering، tier-limits gate، progress weighted-avg، paired transactional audits (C28)، soft-delete، negative-action reason guards. بالإضافة، فحص معماري للكود الفعلي كشف 4 نقاط محتمل تحتاج hardening pre-emptive قبل ما يدخل الهاكر، ودي محتاجة قرار من المستخدم.

## التحليل

**القراءة المعمارية الكاملة كشفت:**

### ✅ ما هو سليم بالفعل (لا يحتاج تعديل)
- **Mass-assignment defense:** `main.ts:79-82` بيـ configure `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`. فأي extra field من client يـ rejected بـ 400 قبل ما يوصل للـ service. الـ `newValues: dto as Record<string, unknown>` آمن.
- **Audit reason DEFENSE-IN-DEPTH:** `AuditLogService.assertEntryValid` (`audit-log.service.ts:233-245`) بيـ enforce `reason ≥20 chars` للـ `DELETE/REJECT/FORCE_CANCEL/PROGRESS_OVERRIDE`. ده يعني إن service-level check (مثل `NEGATIVE_TRANSITIONS` في `changeStatus`) duplicate guard، مش الـ only line.
- **C28 (paired tx) في updates.service:** `updates.service.ts:413, 615` بيستخدم `recalculateProgressInTx(tx, ...)` بشكل صحيح. الـ spec `updates.service.spec.ts:189` بيـ assert إن الـ post-tx variant **مش** بتتنادى.
- **State machine tables:** الـ transitions matrices متطابقة مع enum schema (`schema.prisma:584-587` لـ PhaseStatus).
- **`UpdateStatus` active-set في `softDelete` guard:** `['DRAFT', 'PENDING', 'APPROVED']` صحيحة — تستثني `REJECTED` و `FORCE_CANCELLED` (terminal states).

### ⚠️ نقاط محتملة تحتاج hardening (4 candidates للقرار)

| # | الاسم | الموقع | الـ Root Cause | الـ Severity |
|---|---|---|---|---|
| **F1** | `assignMember` لا يمنع تعيين CLIENT/SUPER_ADMIN كـ member | `projects.service.ts:317-325` | الـ `findFirst` بيـ verify `companyId + soft-delete + id` فقط، مش `user.role`. الـ enum `ProjectRole` (SITE_ENGINEER/SUPERVISOR/…) لا يربط بـ User.role | 🟡 MEDIUM (business invariant، مش security horizontal escalation — كل الأطراف داخل نفس الـ tenant) |
| **F2** | Phase queries لا تـ filter بـ `project.deletedAt` | `phases.service.ts:54-77` + `:81-90` | الـ `softDeleteFilter` بيتطبّق على الـ Phase نفسها، لكن الـ project الـ parent لو deleted، الـ phase تظل visible عبر الـ Phases API | 🟠 HIGH (data leak: assigned engineers ممكن يشوفوا phases لـ projects المفروض اتمسحت) |
| **F3** | `recalculateProgress` (public non-tx) — dead code in production | `projects.service.ts:467-469` | بقي للـ regression guard في `updates.service.spec.ts:189`. لو developer جديد ناداه، يكسر C28 | 🟡 MEDIUM (footgun، مش active bug) |
| **F4** | `reorder` لا يـ enforce uniqueness لـ `order` في الـ project | `phases.service.ts:274-303` | اتنين phase ممكن يحملوا نفس الـ `order=0`، فـ `orderBy: order asc` يبقى non-deterministic بين الـ ties | 🟢 LOW (data integrity، مش security) |

> ⚠️ ملاحظة هامة: لو الهاكر لقى ثغرة CRITICAL/HIGH خارج الـ 4 دول، الـ session هترجع لـ NEEDS-CODER فوراً (rule #1 + scope hacker-mode = `attack-and-fix-critical-only`). الـ F-items دي ما-أنا-شفته من القراءة فقط.

---

## الحل المقترح

### المرحلة 1: Pre-emptive hardening — F1, F2, F3 فقط (F4 مؤجل)

> راجع "نقاط القرار" أدناه لاختيار أي F-items يدخلوا فعلياً. الحل المكتوب أدناه هو **التوصية**؛ المستخدم يقدر يـ subset أو يضيف.

#### F1 (مُوصى به) — role-gate في `assignMember`
- **الملفات:** `apps/api/src/modules/projects/projects.service.ts` (assignMember، ~317-325).
- **التغيير:** إضافة شرط على الـ `findFirst` للـ member: `role: { in: ['SITE_ENGINEER', 'SUPERVISOR', 'ACCOUNTANT', 'WORKER', 'FOREMAN'] }`. لو الـ user CLIENT أو ADMIN-level → `NotFoundException('الموظف غير موجود')` (نفس الـ error msg لتجنب user enumeration).
- **الـ Risk:** existing data ممكن يحتوي على assignments لـ CLIENT (لو كان فيه bug قديم). توصية: المختبر يكتب spec بدل ميجراشن fix-up.

#### F2 (مُوصى بشدة) — cascade `project.deletedAt` على phase queries
- **الملفات:** `apps/api/src/modules/phases/phases.service.ts`.
- **التغيير:** في `findAll` (`:54`)، `findOne` (`:81`)، الـ `where` clause تتغير من:
  ```ts
  project: { companyId: user.companyId }
  ```
  إلى:
  ```ts
  project: { companyId: user.companyId, deletedAt: null }
  ```
- **الـ Risk:** ممكن بعض الـ phases المرتبطة بـ projects deleted تبقى inaccessible عبر API. هذا هو السلوك المطلوب لكن لو في dashboard بيـ query عبر phaseId مباشرة على project deleted، هيكسر. مفيش caller زي ده في الكود الحالي (grep يثبت). مفيش data migration مطلوبة لأن الفلتر read-time.

#### F3 (مُوصى به) — Deprecate `recalculateProgress` (public non-tx)
- **الملفات:** `apps/api/src/modules/projects/projects.service.ts` (`:466-469`).
- **التغيير:** حذف الـ method تماماً + تحديث `updates.service.spec.ts:62, 79, 117, 189` لإزالة الـ mock والـ assertion (الـ regression guard ما عاد له معنى لو الـ method مش موجودة — TypeScript بيـ catch أي call).
- **الـ Risk:** الـ regression guard في الـ spec بيختفي. البديل: TypeScript نفسه هو الـ guard الأقوى — الـ method مش موجودة، فأي محاولة call تكسر الـ build. تحسين strictly.

### المرحلة 2: لا يوجد عمل coder بعد ذلك في الـ stage الحالي
- الهاكر بياخد التالي (الدور الثالث في الترتيب).
- لو الهاكر فتح NEEDS-CODER، الـ session بيرجع للمبرمج لـ stage جديد.

---

## الـ Skills المطلوبة

- **02 (Architecture)** — separation: controller thin، service fat، DI module wiring → سليم. لا تعديل.
- **03 (RBAC)** — F1 يـ tighten الـ assignment surface؛ `findAll` else-branch هتفحصها الهاكر (attack hypothesis #1 + #6 في scope).
- **04 (Audit & negative-action reason)** — F2 cascade-filter لا يمس الـ audit؛ paired-assertion لـ DELETE موجود defense-in-depth بـ AuditLogService.
- **07 (Soft-delete + Tenant isolation)** — F2 هو الإصلاح الرئيسي هنا (cascade على parent).
- **C28 (paired transactional consistency)** — F3 يـ enforce الـ pattern at compile time.

---

## نقاط القرار

أحتاج موافقتك على الـ subset قبل ما المبرمج يبدأ. اقتراحي default: **F1 + F2 + F3** (F4 deferred).

| # | السؤال | اقتراحي |
|---|---|---|
| Q1 | F1 (role-gate في assignMember) — يتطبّق الآن أم يتأجل؟ | ✅ يتطبّق |
| Q2 | F2 (cascade على project.deletedAt) — يتطبّق الآن أم يتأجل؟ | ✅ يتطبّق بشدة (data leak) |
| Q3 | F3 (حذف recalculateProgress public + تحديث الـ spec) — يتطبّق أم يتأجل؟ | ✅ يتطبّق (cleanup small surface) |
| Q4 | F4 (reorder uniqueness على order) — يتطبّق أم يتأجل؟ | ⏸️ يتأجل (يحتاج schema migration + استراتيجية للـ existing ties) |
| Q5 | عندما يكتب الهاكر عن HIGH/CRITICAL خارج F1-F4، هل نتوقف ونرجع للمبرمج (NEEDS-CODER) أم نـ defer كلهم للـ backlog؟ | ✅ نتوقف ونرجع (هذا هو السلوك الافتراضي rule #1) |

---

## التأثير على الـ Codebase الحالي

| الملف | التغيير المقترح | حجم التغيير |
|---|---|---|
| `apps/api/src/modules/projects/projects.service.ts` | F1 (3 سطور إضافة) + F3 (4 سطور حذف) | ≈7 LOC |
| `apps/api/src/modules/phases/phases.service.ts` | F2 (2 سطر تعديل في 2 method) | ≈4 LOC |
| `apps/api/src/modules/updates/updates.service.spec.ts` | F3 cleanup (إزالة mock + assertion) | ≈5 LOC حذف |
| `apps/api/src/modules/projects/projects.service.spec.ts` | **NEW** — MVT specs | ~150-200 LOC |
| `apps/api/src/modules/phases/phases.service.spec.ts` | **NEW** — MVT specs | ~150-200 LOC |

**لا migrations مطلوبة. لا breaking changes في الـ API contracts.**

---

## تعريف النجاح

- [ ] الـ 3 (أو أقل، حسب القرار) F-fixes الموافق عليها مُطبّقة وtsc passing.
- [ ] **MVT: ≥12 specs مكتوبة وpassing** (≥6 Projects + ≥6 Phases) (إجباري — rule #2 + rule #3)
  - **Projects MVT الـ scaffold المقترح:**
    1. `create()` rejects when clientId is not a CLIENT role
    2. `create()` rejects when clientId in different company
    3. `findAll()` CLIENT role: where clause restricts to `clientId = userId`
    4. `findAll()` ENGINEER role: where clause restricts to assignments
    5. `changeStatus()` rejects invalid transition (DRAFT → COMPLETED)
    6. **`changeStatus()` CANCELLED → paired-assertion: `logInTransaction` called with `action: 'DELETE'` AND `reason: <provided>` AND correct `oldValues.status`** (rule #4 — deepest primary action, not just `project.status==='CANCELLED'`)
    7. `softDelete()` rejects reason <20 chars
    8. (لو F1 approved) `assignMember()` rejects when target user.role = 'CLIENT'
  - **Phases MVT الـ scaffold المقترح:**
    1. `create()` triggers `recalculateProgressInTx` inside the tx (paired)
    2. `update()` rejects invalid status transition (NOT_STARTED → COMPLETED)
    3. **`overrideProgress()` paired-assertion: `logInTransaction` called with `action: 'PROGRESS_OVERRIDE'` AND `reason: <provided>` AND old/new progress correct** (rule #4)
    4. `reorder()` writes audit UPDATE with old/new order
    5. `softDelete()` refuses when activeUpdates count > 0
    6. **`softDelete()` paired-assertion: `logInTransaction(action: DELETE, reason)` AND `recalculateProgressInTx` called inside tx** (rule #4)
    7. (لو F2 approved) `findAll()` excludes phases of soft-deleted projects
- [ ] الهاكر فحص الـ 10 attack hypotheses من scope + أي vector إضافي.
- [ ] الـ literal jest stdout مع PASS count يطابق MVT في `04-tester-report.md` (rule #8).
- [ ] لو الهاكر لقى HIGH/CRITICAL: الـ session ترجع للمبرمج (NEEDS-CODER pattern من rule #1)، مش defer.
- [ ] الـ paired-assertion specs (Projects #6، Phases #3 و #6) تـ assert على **deepest primary action = الـ `logInTransaction` call args** — مش على side-effects shallow زي `project.status` فقط (rule #4 + CVE-TEST-011 lesson).

---

⏸️ AWAITING APPROVAL

رد بـ:
- **"approve"** → كل التوصيات (F1 + F2 + F3) + كل الـ Q answers بالـ default
- **"approve: F2 only"** أو أي subset
- **"edit: [تفاصيل]"** للتعديل

✋ تم المخطط — للدور التالي (المبرمج)؟
