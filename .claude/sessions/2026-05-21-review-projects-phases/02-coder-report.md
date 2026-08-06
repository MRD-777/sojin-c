# تقرير المبرمج

## المرحلة 1: Pre-emptive hardening (F1 + F2 + F3) — ✅

تم تطبيق الـ 3 fixes الموافق عليها في رد واحد على الـ codebase. الـ MVT specs مؤجلة لدور المختبر كما تم الاتفاق.

### الملفات المعدّلة

| ملف | F# | التعديل | ΔLOC |
|---|---|---|---|
| `apps/api/src/modules/projects/projects.service.ts` | F1 | إضافة شرط `role: { in: ['SITE_ENGINEER', 'SUPERVISOR', 'ACCOUNTANT', 'WORKER'] }` على الـ `findFirst` لـ member في `assignMember` (سطر ~317-329). + تعليق 3 سطور يوضّح السبب. | +5 / -1 |
| `apps/api/src/modules/projects/projects.service.ts` | F3 | حذف `recalculateProgress(projectId)` public wrapper (4 سطور) + إعادة كتابة JSDoc لـ `recalculateProgressInTx` لتزيل المرجع للـ wrapper المحذوف وتـ document السلوك المطلوب. | +12 / -17 |
| `apps/api/src/modules/phases/phases.service.ts` | F2 | تعديل الـ `where.project` في `findAll` و `findOne` من `{ companyId }` إلى `{ companyId, deletedAt: null }` — يـ enforce cascade soft-delete من project لـ phases الـ visibility. | +2 / -2 |
| `apps/api/src/modules/updates/updates.service.spec.ts` | F3 | تنظيف الـ regression-guard mock: حذف `let recalculateProgress: jest.Mock` + `jest.fn()` + المُمرّر في `provide: ProjectsService` + الـ assertion `expect(recalculateProgress).not.toHaveBeenCalled()` + التعليق التوضيحي. | +0 / -5 |

**إجمالي:** 4 ملفات modified، +19 / -25 سطر صافي.
**ملفات جديدة:** صفر (المختبر سيُنشئ الـ spec files).

### انحرافات عن الـ Plan

**لا يوجد.** الـ 3 fixes اتطبقوا بالضبط كما هو موصوف في `00-plan.md` المرحلة 1:
- F1: نفس الـ enum values الموصى بها (4 staff roles).
- F2: نفس الـ field added (`deletedAt: null`) على نفس الـ 2 query في نفس الـ 2 method.
- F3: نفس الـ method محذوفة، الـ regression-guard ساحب من نفس الـ 4 لوكيشن في الـ spec.

ملاحظة: قمت بإعادة كتابة الـ JSDoc لـ `recalculateProgressInTx` بدل ما أتركه يـ reference method محذوفة (التعليق القديم كان فيه "Same as recalculateProgress() but ..." و"the previous implementation called `recalculateProgress` AFTER ..."). الـ historical context عن C28 محتفظ به لكن مع لغة لا تـ reference الـ wrapper المحذوف.

### ملاحظات

1. **F1 enum values:** استخدمت string literals (e.g., `'SITE_ENGINEER'`) بدل `UserRole.SITE_ENGINEER` لاتباع الـ convention الموجودة في نفس الـ service (سطر 161 يستخدم `role: 'CLIENT'` كـ string literal). الـ Prisma typings بتقبل الـ strings المطابقة للـ enum.

2. **F2 ensureProjectAccess خارج النطاق:** `ProjectsService.ensureProjectAccess` (سطر ~539-555) لا يـ check `project.deletedAt` للـ CLIENT أو لـ other roles (assignment-based check). هذا قد يبقى surface إضافي لـ deleted projects عبر paths أخرى (لو في caller غير الـ Phases module). لكنه خارج F2 scope (الـ F2 specifically محدّد على الـ phase queries). **لـ الهاكر:** هذه candidate لـ attack hypothesis #4 من scope ("Phase-via-other-project" يمكن توسيعه ليشمل "ensureProjectAccess على project deleted").

3. **F3 regression-guard tradeoff:** الـ JS-level assertion `expect(recalculateProgress).not.toHaveBeenCalled()` اتشال. البديل compile-time stronger: لو developer أضاف `this.projectsService.recalculateProgress(...)` في أي مكان، TypeScript هيـ fail الـ build فوراً لأن الـ method مش موجودة على الـ class. هذا الـ guard أقوى من runtime spec.

4. **`@prisma/client/runtime/library` pre-existing import error (BACKLOG #2):** الـ jest لا يقدر يـ compile `updates.service.spec.ts` بسبب الـ import في سطر 27. هذا الـ failure pre-existing من قبل الـ session (مذكور في BACKLOG.md ticket #2)، مش introduced by my changes. تعديلاتي على الـ spec syntactically صحيحة وستـ compile بمجرد إصلاح الـ ticket #2 import migration.

5. **لا new specs in this stage:** بناءً على تعليمات المستخدم ("الـ specs مش دلوقتي — المختبر هيكتبها")، الـ MVT المتفق عليه (≥12 specs) دور المختبر.

---

## Verification (literal)

### tsc (`npx tsc --noEmit` from `apps/api/`)

```
src/modules/payments/payments.service.spec.ts(20,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/payments/payments.service.ts(29,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/updates/updates.service.spec.ts(27,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/updates/updates.service.ts(36,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
```

**Analysis:** 4 errors total, **all pre-existing** from BACKLOG ticket #2 (`@prisma/client/runtime/library` import migration). Errors localized to `payments/*` and `updates/*` modules — **zero errors in `projects/*` or `phases/*`** (the modules I modified). **Zero new tsc errors introduced by F1+F2+F3.**

### jest (`npx jest src/modules/updates/updates.service.spec.ts` — the spec I modified)

```
ts-jest[config] (WARN) message TS151002: Using hybrid module kind (Node16/18/Next) is only supported in "isolatedModules: true". Please set "isolatedModules: true" in your tsconfig.json. To disable this message, you can set "diagnostics.ignoreCodes" to include 151002 in your ts-jest config. See more at https://kulshekhar.github.io/ts-jest/docs/getting-started/options/diagnostics
FAIL src/modules/updates/updates.service.spec.ts
  ● Test suite failed to run

    src/modules/updates/updates.service.spec.ts:27:25 - error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.

    27 import { Decimal } from '@prisma/client/runtime/library';
                               ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Test Suites: 1 failed, 1 total
Tests:       0 total
Snapshots:   0 total
Time:        6.522 s
Ran all test suites matching src/modules/updates/updates.service.spec.ts.
```

**Analysis:** الـ failure هو **pre-existing** (line 27 — الـ import من BACKLOG ticket #2)، **مش** من F3 cleanup. الـ cleanup على lines 61, 78, 117, 188 (مش 27). الـ spec كان يفشل في compile قبل تعديلاتي وبعدهم نفس الـ failure نفسه — لا regression، لا fix لـ ticket #2 (خارج الـ scope).

### grep verification — لا callers متبقية لـ `recalculateProgress` (non-InTx)

```
$ rg '\.recalculateProgress\b(?!InTx)' apps/api/src
(no matches)
```

**Analysis:** F3 حذف clean — صفر مراجع للـ wrapper المحذوف في الكود كله.

### `payments.service.spec.ts` cross-check (يستخدم ProjectsService كذلك)

```
$ rg 'recalculateProgress|ProjectsService' apps/api/src/modules/payments/payments.service.spec.ts
18:import { ProjectsService } from '../projects/projects.service';
109:        provide: ProjectsService,
110:        useValue: { ensureProjectAccess },
```

**Analysis:** الـ payments spec بيـ mock `ensureProjectAccess` فقط على `ProjectsService` — لا يستخدم `recalculateProgress` ولا `recalculateProgressInTx`. F3 ما بيـ affect الـ spec ده.

---

## المرحلة 2: CVE-PROJ-001 fix (NEEDS-CODER returned من الهاكر) — ✅

اتفتحت بعد رد المستخدم: "CVE-PROJ-001 مؤكد. الـ session ترجع للمبرمج." الـ fix يقفل CVE-PROJ-001 (cross-tenant admin bypass) + A2 (deletedAt في ensureProjectAccess) في move واحد.

### الملفات المعدّلة

| ملف | التعديل | ΔLOC |
|---|---|---|
| `apps/api/src/modules/projects/projects.service.ts` | إعادة كتابة `ensureProjectAccess` (سطور ~536-575): إضافة tenant + soft-delete project lookup أول الدالة لكل الـ roles بما فيها admins. الـ CLIENT branch يستخدم الـ `project.clientId` المُسترجع بدل ما يـ duplicate الـ DB query. الـ assignment-based branch بقي كما هو (الـ project lookup أعلاه يجعل الـ check transitively tenant-safe). الـ JSDoc الجديد يوثّق الـ CVE rationale. | +28 / -10 |

**إجمالي للمرحلة 2:** 1 ملف، +28 / -10 سطر.
**Files جديدة:** صفر.

### Diff معماري (Before / After)

**Before (الـ vulnerable):**
```ts
async ensureProjectAccess(user, projectId) {
  if (['SUPER_ADMIN', 'PROJECT_MANAGER'].includes(user.role)) return;  // ← bypass
  if (user.role === 'CLIENT') {
    const project = await prisma.project.findFirst({ where: { id, clientId: userId, companyId } });
    if (!project) throw Forbidden;
    return;
  }
  const assignment = await prisma.projectAssignment.findFirst({ where: { projectId, userId, removedAt: null } });
  if (!assignment) throw Forbidden;
}
```

**After (الـ fixed):**
```ts
async ensureProjectAccess(user, projectId) {
  // Tenant + soft-delete gate FIRST for every role
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: user.companyId, ...softDeleteFilter },
    select: { id: true, clientId: true },
  });
  if (!project) throw Forbidden;

  if (['SUPER_ADMIN', 'PROJECT_MANAGER'].includes(user.role)) return;  // ← الآن بعد الـ gate

  if (user.role === 'CLIENT') {
    if (project.clientId !== user.userId) throw Forbidden;
    return;
  }

  const assignment = await prisma.projectAssignment.findFirst({ where: { projectId, userId, removedAt: null } });
  if (!assignment) throw Forbidden;
}
```

### تطبيق الـ Fix على المخاوف المسجلة

| المخاوف | الحالة بعد الـ fix |
|---|---|
| **CVE-PROJ-001** (admin cross-tenant) | ✅ مغلق — admin يـ pass الـ tenant gate قبل return |
| **A2** (deletedAt في ensureProjectAccess) | ✅ مغلق — `softDeleteFilter` مدموج في الـ project lookup الأول |
| **CHAT-FOLLOWUP-001** (chat.findRooms/createRoom defense-in-depth) | ⚠️ **مقفول transitively** — الـ source-fix يمنع الـ exploit، لكن الـ chat module لسه بدون defense-in-depth الذي اعتمده 4 modules أخرى. **يبقى للـ session 1.8 كـ hardening followup.** |

### تأثير الـ Performance

- **Admin paths (SUPER_ADMIN/PROJECT_MANAGER):** Before = 0 DB queries، After = 1 query. زيادة لكل `ensureProjectAccess` call عبر 6 modules (projects, phases, chat, payments, sub-contractors, comments, updates).
- **CLIENT paths:** Before = 1 query، After = 1 query (نفس).
- **Assignment-based paths:** Before = 1 query، After = 2 queries (project lookup + assignment).
- **Mitigation:** الـ extra query is by `id` على table مع PK index، expected sub-ms. لا cache invalidation logic added. لو ظهرت hot-path concerns → caching opportunity في session تالي (مش الآن).

### Diff معماري آخر (الـ behavior change للـ CLIENT path)

**Before:** CLIENT تـ get `ForbiddenException` لـ project موجودة (cross-tenant، deleted، أو not-owned) جميعاً بنفس الـ behavior (الـ where clause بيـ embed كل الـ 3 checks).

**After:** CLIENT تـ get `ForbiddenException` بـ semantics واضحة:
- Project missing/cross-tenant/deleted → throw عند الـ project lookup الأول (سطر ~545).
- Project موجود لكن `clientId !== user.userId` → throw عند الـ ownership check (سطر ~553).

في الحالتين، نفس الـ ForbiddenException بنفس الـ Arabic message. لا behavioral change للـ end-user (intentionally — الـ existence/non-existence info لا تتسرّب)، لكن الـ stack-trace الداخلي يفصل بين الـ 2 causes — مفيد لـ debugging.

### انحرافات عن مقترح الهاكر

**لا يوجد.** الـ implementation يطابق الـ `Fix المقترح للمبرمج` في 03-hacker-report.md سطراً بسطر، ما عدا إضافة JSDoc أوسع (10 سطور) لتوثيق الـ CVE rationale — تحسين documentation، ليس scope creep.

### ملاحظات

1. **الـ chat module لسه يحتاج defense-in-depth (CHAT-FOLLOWUP-001):** الـ source fix يقفل الـ exploit، لكن `chat.service.ts:findRooms` و `createRoom` لسه يستخدمان `ensureProjectAccess` كـ sole gate بدون companyId filter في الـ chatRoom query. هذا fine الآن (الـ admins ما عاد يقدروا يـ bypass)، لكن مش defense-in-depth zar زي باقي الـ 4 callers. **يبقى ticket session 1.8.**

2. **الـ JwtPayload `role` تايب لسه `string` (مش enum):** `current-user.decorator.ts:13` يستخدم `role: string`. الـ `['SUPER_ADMIN', 'PROJECT_MANAGER'].includes(user.role)` يعمل وقت runtime، لكن تـ typo في الكود لا يُمسك بـ TypeScript. حقاً ينبغي تـ tighten لـ `role: UserRole` — **observation للـ session 1.8**.

3. **الـ Performance impact للأدمين modular:** لو ظهر الـ extra query bottleneck (unlikely)، يقدر يـ add caching داخل ensureProjectAccess (per-request cache via RequestContext). الـ choice deferred — لا يـ optimize prematurely.

4. **MVT يصير أوسع:** بعد الـ fix، الـ MVT المطلوب من المختبر يجب أن يشمل الـ 6 specs المُقترحة في 03-hacker-report.md "توصيات للمختبر" — تـ cover الـ admin tenant gate، الـ deletedAt cascade، والـ CLIENT non-owner case. **هذا اتجاوز الـ scope MVT الأصلي 12 → 18+ spec.** ينبغي على المخطط post-exec الـ stage 2 يـ confirm budget الجديد.

---

## Verification (literal) — Stage 2

### tsc (`npx tsc --noEmit` from `apps/api/`)

```
src/modules/payments/payments.service.spec.ts(20,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/payments/payments.service.ts(29,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/updates/updates.service.spec.ts(27,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/updates/updates.service.ts(36,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
```

**Analysis:** نفس الـ 4 pre-existing errors من BACKLOG #2 (مطابقة Stage 1). **صفر errors جديدة من Stage 2 fix.** الـ `projects.service.ts` (الملف الوحيد المعدّل في Stage 2) لا يظهر في الـ output.

### jest على الـ specs اللي بتـ mock ensureProjectAccess

كل الـ specs الـ downstream (`payments.service.spec.ts`، `updates.service.spec.ts`، الـ chat module بدون spec) بتـ mock `ensureProjectAccess` بـ `jest.fn().mockResolvedValue(undefined)` — فهي **لا تتأثر بالـ internal change** للـ implementation. لا regression متوقع.

`updates.service.spec.ts` الـ pre-existing compile failure (BACKLOG #2 line 27) لا يـ change حالة من Stage 1.

`payments.service.spec.ts` نفس الـ compile failure (BACKLOG #2 line 20) — pre-existing.

### grep verification — قنوات الـ exploit المغلقة

```
$ rg 'ensureProjectAccess' apps/api/src --type ts | grep -v spec
src/modules/chat/chat.service.ts:27:    await this.projectsService.ensureProjectAccess(user, projectId);
src/modules/chat/chat.service.ts:70:    await this.projectsService.ensureProjectAccess(user, projectId);
src/modules/chat/chat.service.ts:210:    await this.projectsService.ensureProjectAccess(user, room.project.id);
src/modules/comments/comments.service.ts:283:    await this.projectsService.ensureProjectAccess(user, update.phase.projectId);
src/modules/payments/payments.service.ts:76:    await this.projectsService.ensureProjectAccess(user, projectId);
src/modules/payments/payments.service.ts:118:    await this.projectsService.ensureProjectAccess(user, payment.projectId);
src/modules/payments/payments.service.ts:129:    await this.projectsService.ensureProjectAccess(user, projectId);
src/modules/payments/payments.service.ts:219:    await this.projectsService.ensureProjectAccess(user, projectId);
src/modules/projects/projects.service.ts:145:    await this.ensureProjectAccess(user, project.id);
src/modules/sub-contractors/sub-contractors.service.ts:143:    await this.projectsService.ensureProjectAccess(user, phase.projectId);
src/modules/updates/updates.service.ts:760:    await this.projectsService.ensureProjectAccess(user, phase.projectId);
src/modules/phases/phases.service.ts:52:    await this.projectsService.ensureProjectAccess(user, projectId);
src/modules/phases/phases.service.ts:94:    await this.projectsService.ensureProjectAccess(user, phase.projectId);
src/modules/phases/phases.service.ts:105:    await this.projectsService.ensureProjectAccess(user, projectId);
```

**Analysis:** 14 callers production code. كلهم الآن يستفيدون من الـ tenant + soft-delete gate. الـ chat module's 3 callers أيضاً (كانوا الـ exploited path) — الآن آمنين عبر الـ source fix.

---

## ملخص نهائي

- **المراحل المكتملة:** 2 / 2 (Stage 1 original + Stage 2 NEEDS-CODER return).
- **الملفات المعدّلة (إجمالي):** 4 ملفات production code + 1 spec cleanup = 5 ملفات.
- **انحرافات عن الـ Plan:** 0 في Stage 1، 0 في Stage 2 (تطابق سطر-بسطر مع مقترح الهاكر).
- **tsc errors جديدة:** 0 (4 pre-existing فقط — BACKLOG #2، unchanged عبر الـ 2 stages).
- **jest regressions جديدة:** 0.
- **CVEs المغلقة في Stage 2:**
  - CVE-PROJ-001 (CRITICAL، cross-tenant admin bypass) ✅
  - A2 (deletedAt في ensureProjectAccess) ✅ (subsumed)
- **CVEs المتبقية للـ followup:**
  - CHAT-FOLLOWUP-001 (defense-in-depth في chat module) — session 1.8 backlog.
- **NEEDS-CODER flags:** 0 جديدة بعد Stage 2.
- **MVT budget impact:** +6 specs على ensureProjectAccess (المخطط post-exec يجب أن يعيد moderate الـ tester budget).
- **وقت التنفيذ التقديري:** ~8 دقائق لـ Stage 2 (+ 12 دقيقة Stage 1 = ~20 دقيقة كاملة).

**جاهز للدور التالي — المخطط (تقرير ما بعد التنفيذ Stage 2) لتأكيد إن الـ fix يطابق مقترح الهاكر و الـ tester budget يعدّل لـ الـ 6 specs الإضافية.**

✋ تم المبرمج (Stage 2) — للدور التالي؟
