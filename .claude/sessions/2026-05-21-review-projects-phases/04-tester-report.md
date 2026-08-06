# تقرير المختبر

## إحصائيات

- **MVT المطلوب: 21 (8 Projects + 7 Phases + 6 ensureProjectAccess) / المكتوب: 21** ✅
- Tests written: **21** (14 Projects + 7 Phases) عبر ملفين spec جديدين.
- Tests passing: **21 / 21** ✅
- Tests failing: 0
- Existing specs مكسورة بعد extension: 0 (تم التحقق على users.service.spec.ts + test-utils.spec.ts = 24/24 لسه passing).
- tsc errors جديدة: 0 (4 pre-existing فقط — BACKLOG #2، unchanged).
- Paired-assertion specs (rule #4 — deepest primary action): **5** (P6, P8, PH1, PH3, PH6) — كلها على `logInTransaction` args أو على filter shape، **ليس على side-effect shallow** (CVE-TEST-011 lesson).

---

## Unit Tests

### Projects MVT (8 specs)

| الـ Test ID | إيه اللي بيختبره | النتيجة |
|---|---|---|
| **P1** | `create()` rejects when client lookup returns null (cross-tenant clientId) + asserts the lookup filter has `companyId + role: 'CLIENT'` (tenant gate paired-assertion) | ✅ |
| **P2** | `create()` rejects when targeted user is not CLIENT role (documents intent; same null-return path) | ✅ |
| **P3** | `findAll()` CLIENT path: where clause restricts `clientId = user.userId`، وأكد إن assignments-filter غير مطبق (no false-permissive branch) | ✅ |
| **P4** | `findAll()` SITE_ENGINEER path: where clause uses `assignments: { some: { userId, removedAt: null } }`، وأكد إن clientId-filter غير مطبق | ✅ |
| **P5** | `changeStatus()` rejects invalid transition DRAFT → COMPLETED (state machine guard) | ✅ |
| **P6** | `changeStatus()` CANCELLED writes audit DELETE: **paired-assertion على `logInTransaction(action=DELETE, oldValues={status:'IN_PROGRESS'}, newValues={status:'CANCELLED'}, reason=<exact string>, entityType:'project', entityId, userId, userRole)`** — deepest primary action، NOT الـ `project.update` side-effect (rule #4 + CVE-TEST-011 lesson explicit) | ✅ |
| **P7** | `softDelete()` rejects reason < 20 chars (negative-action reason guard، defense-in-depth مع AuditLogService.assertEntryValid) | ✅ |
| **P8** | `assignMember()` F1 staff-only gate: rejects CLIENT/PM/SUPER_ADMIN target + **paired-assertion على `prisma.user.findFirst` filter shape: `role: { in: [SITE_ENGINEER, SUPERVISOR, ACCOUNTANT, WORKER] }`** | ✅ |

### Phases MVT (7 specs)

| الـ Test ID | إيه اللي بيختبره | النتيجة |
|---|---|---|
| **PH1** | `create()` C28 paired-assertion: `projectsService.recalculateProgressInTx` بيتنادى داخل الـ `$transaction` callback مع `tx` client (`prisma` في الـ harness) و `projectId='proj-1'` | ✅ |
| **PH2** | `update()` rejects NOT_STARTED → COMPLETED (state machine — must transit IN_PROGRESS first) | ✅ |
| **PH3** | `overrideProgress()` paired-assertion على `logInTransaction(action=PROGRESS_OVERRIDE, oldValues={progress:30}, newValues={progress:75}, reason=<exact>, entityType:'phase', entityId)` — deepest، NOT الـ `phase.update` side-effect | ✅ |
| **PH4** | `reorder()` paired-assertion على `logInTransaction(action=UPDATE, oldValues={order:2}, newValues={order:5}, entityType:'phase')` | ✅ |
| **PH5** | `softDelete()` refuses حين `update.count > 0` + paired-assertion على الـ count query filter: `status: { in: ['DRAFT', 'PENDING', 'APPROVED'] }, deletedAt: null` (يثبت إن الـ guard مش over- ولا under-blocking) | ✅ |
| **PH6** | `softDelete()` **double paired-assertion** (rule #4):<br>1. `logInTransaction(action=DELETE, oldValues={name, status, progress}, newValues=null, reason=<exact>)`<br>2. `recalculateProgressInTx(tx, projectId)` بيتنادى داخل نفس الـ tx | ✅ |
| **PH7** | `findAll()` F2 closure paired-assertion: where clause has **exact** `project: { companyId: 'co-A', deletedAt: null }` + phase-level `deletedAt: null` | ✅ |

### ensureProjectAccess MVT (6 specs — CVE-PROJ-001 + A2)

| الـ Test ID | إيه اللي بيختبره | النتيجة |
|---|---|---|
| **EA1** | SUPER_ADMIN of company A passing cross-tenant projectId → `ForbiddenException` + **paired-assertion على الـ project lookup filter `{id, companyId: 'co-A', deletedAt: null}`** (CVE-PROJ-001 closure — admins MUST pass tenant gate) | ✅ |
| **EA2** | PROJECT_MANAGER cross-tenant → `ForbiddenException` (نفس الـ pattern، الـ second admin role) | ✅ |
| **EA3** | SUPER_ADMIN within own company + not-deleted → resolves cleanly + assert إن `projectAssignment.findFirst` **لم يتنادى** على الـ admin path (efficient short-circuit بعد الـ gate) | ✅ |
| **EA4** | SUPER_ADMIN own-company but project soft-deleted → `ForbiddenException` + paired-assertion على `deletedAt: null` في الـ filter (**A2 closure**) | ✅ |
| **EA5** | CLIENT non-owner (same company, different `project.clientId`) → `ForbiddenException` + assert `projectAssignment.findFirst` غير مطبق على CLIENT path | ✅ |
| **EA6** | SITE_ENGINEER without active assignment → `ForbiddenException` + **paired-assertion على exact assignment filter `{projectId, userId, removedAt: null}`** | ✅ |

---

## Integration Tests

**N/A — deferred** كما هو في scope. الـ HTTP-layer testing (supertest + ValidationPipe + Roles guard wiring) موجود في BACKLOG ticket #5. سيُعالج في session منفصل. الـ MVT الحالي service-layer فقط، يطابق الـ Plan.

---

## Business Logic Tests (State Machine Coverage)

| الـ Transition | الـ Test | النتيجة |
|---|---|---|
| Project DRAFT → COMPLETED (invalid، skips IN_PROGRESS) | P5 | ✅ reject |
| Project IN_PROGRESS → CANCELLED (valid + audit DELETE mapping) | P6 | ✅ allow + audit |
| Phase NOT_STARTED → COMPLETED (invalid، skips IN_PROGRESS) | PH2 | ✅ reject |
| Phase progress override + audit PROGRESS_OVERRIDE | PH3 | ✅ allow + audit |

---

## Security Tests

| الهجوم | الـ Test | النتيجة |
|---|---|---|
| Tenant cross-leak (admin) — CVE-PROJ-001 | EA1, EA2 | ✅ blocked |
| Tenant cross-leak (CLIENT non-owner) | EA5 | ✅ blocked |
| Tenant cross-leak في create() عبر clientId | P1 | ✅ blocked |
| Soft-delete cascade على ensureProjectAccess — A2 | EA4 | ✅ blocked |
| Privilege escalation via assignMember (CLIENT-as-WORKER) — F1 | P8 | ✅ blocked |
| Privilege escalation via assignMember (PM-as-WORKER) — F1 | P8 (نفس spec يغطي الـ 3 non-staff roles via `role: in` filter assertion) | ✅ blocked |
| State machine bypass (skip required intermediate state) — Project | P5 | ✅ blocked |
| State machine bypass — Phase | PH2 | ✅ blocked |
| Soft-delete required reason gate — Project | P7 | ✅ blocked |
| Active-updates guard على Phase soft-delete | PH5 | ✅ blocked |
| Audit DELETE primary-action verification (CVE-TEST-011 pattern) — Project | P6 | ✅ deep |
| Audit PROGRESS_OVERRIDE primary-action verification — Phase | PH3 | ✅ deep |
| Audit DELETE primary-action + C28 paired-action — Phase softDelete | PH6 | ✅ deep |
| F2 phase visibility cascade (project.deletedAt) | PH7 | ✅ closed |

---

## Regression Tests

- **F3 cleanup spec على `updates.service.spec.ts`** — pre-existing compile failure من BACKLOG #2 unchanged. الـ regression-guard converted to compile-time (TypeScript يـ catch any future `this.projectsService.recalculateProgress(...)` call as method-doesn't-exist error). 0 regressions.
- **Mock infrastructure extension** — added `project`, `phase`, `projectAssignment`, `update` models إلى `MockPrisma`. الـ users.service.spec.ts (الذي يستخدم نفس الـ factory) لسه يمر: **24/24 passing** بعد الـ extension.

---

## Bugs اتكشفت أثناء الـ Testing

**لا يوجد.** الـ 21 spec كلها passed في الـ first run بدون debugging fixes. هذا يعكس:
1. الـ Plan + المبرمج + الهاكر متوافقين على الـ behavior expected.
2. الـ paired-assertions نجحت في mapping الـ deepest primary actions بدقة (لو كانت shallow كانت ممكن مرت بـ wrong reasons).

---

## مناطق لسه محتاجة coverage (deferred — في الـ backlog)

1. **HTTP integration via supertest** (BACKLOG #5) — Controller + Roles guard + ValidationPipe wiring + idempotency-key handling.
2. **`assignMember` reassignment path** (when `existing.removedAt !== null`) — currently uncovered by P8 (P8 covers the role-gate rejection only).
3. **`update()` Project — `expectedEndDate >= startDate` invariant** — currently no business-rule check في الكود ولا spec.
4. **`recalculateProgressInTx` math edge cases** (weight=0, phases=0, weighted overflow) — covered by `Math.min` in code but no algorithmic spec.
5. **`reorder()` uniqueness على `(projectId, order)`** — deferred F4 (Plan Q4)، يحتاج schema migration.
6. **`changeStatus` COMPLETED → terminal verification** — actualEndDate set side-effect غير مغطى spec.
7. **CHAT-FOLLOWUP-001 specs** — chat module defense-in-depth + ensureProjectAccess interaction، deferred لـ session 1.8.
8. **A3 (JwtPayload.role: UserRole typing)** — typing-only، لا runtime spec.

---

## الحكم

✅ **READY**

**السبب:**
- **MVT 21/21 passing** على الـ first run، تتجاوز الـ floor 18 (Plan original 12 + Stage 2 architect upgrade +6).
- **5 paired-assertion specs** كلها تـ assert على الـ deepest primary action: `logInTransaction` args بـ exact `oldValues`/`newValues`/`reason`، أو على exact filter shapes في الـ Prisma queries (P8 `role: in`، PH5 `status: in`، PH7 `project.deletedAt`، EA1 `companyId + deletedAt`، EA6 `removedAt: null`). **CVE-TEST-011 lesson applied** — لا spec يـ pair على side-effect shallow.
- **CVE-PROJ-001 closure verified** (EA1, EA2, EA3, EA4) — الـ admin paths عاد يـ pass الـ tenant + soft-delete gate.
- **A2 closure verified** (EA4) — الـ `deletedAt: null` في الـ first lookup.
- **F1 closure verified** (P8) — staff-only role gate في `assignMember`.
- **F2 closure verified** (PH7) — phase cascade على `project.deletedAt`.
- **F3 closure verified** transitively — compile-time guard (TypeScript) لـ `recalculateProgress` (non-InTx) absence + grep confirmation في 02-coder-report.md.
- **Pattern #5 (re-attack new specs) respected** — الـ 6 ensureProjectAccess specs الجديدة تـ attack نفس الـ pattern اللي قفلناها (trust-without-verify عند الـ role-branch). الـ pattern مغطّى deeply في الـ specs الجديدة بنفسها.
- **MVT MISSING: لا** (auto-reject avoidance — rule on principal report).

**هذا الـ session جاهز للدور التالي — المراجع الأعلى لاتخاذ القرار النهائي.**

---

## Verification (literal — rule #8)

### الـ specs الجديدة (`projects.service.spec.ts` + `phases.service.spec.ts`)

```
$ npx jest src/modules/projects/projects.service.spec.ts src/modules/phases/phases.service.spec.ts
ts-jest[config] (WARN) message TS151002: Using hybrid module kind (Node16/18/Next) is only supported in "isolatedModules: true". Please set "isolatedModules: true" in your tsconfig.json. To disable this message, you can set "diagnostics.ignoreCodes" to include 151002 in your ts-jest config. See more at https://kulshekhar.github.io/ts-jest/docs/getting-started/options/diagnostics
[... 5 more identical ts-jest config warnings — one per test file load ...]

Test Suites: 2 passed, 2 total
Tests:       21 passed, 21 total
Snapshots:   0 total
Time:        13.709 s
Ran all test suites matching src/modules/projects/projects.service.spec.ts|src/modules/phases/phases.service.spec.ts.
```

**Analysis:** 21 tests، 2 suites، **21/21 passing**، 0 failing، 0 skipped. الـ 6 ts-jest config warnings هي pre-existing noise حول `isolatedModules` (نفس النص في كل spec في الـ repo). لا relation بالـ specs الجديدة.

### Regression check على الـ specs الموجودة (الـ factory extension)

```
$ npx jest src/test-utils/test-utils.spec.ts src/modules/users/users.service.spec.ts
[... ts-jest config warnings × 2 ...]

Test Suites: 2 passed, 2 total
Tests:       24 passed, 24 total
Snapshots:   0 total
Time:        7.042 s, estimated 8 s
Ran all test suites matching src/test-utils/test-utils.spec.ts|src/modules/users/users.service.spec.ts.
```

**Analysis:** 24 tests، 2 suites، **24/24 passing**. الـ `prisma-mock.ts` extension (إضافة project/phase/projectAssignment/update models إلى MockPrisma) لم يكسر أي spec قائم.

### tsc final check

```
$ npx tsc --noEmit
src/modules/payments/payments.service.spec.ts(20,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/payments/payments.service.ts(29,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/updates/updates.service.spec.ts(27,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
src/modules/updates/updates.service.ts(36,25): error TS2307: Cannot find module '@prisma/client/runtime/library' or its corresponding type declarations.
```

**Analysis:** نفس 4 pre-existing errors فقط — BACKLOG ticket #2. **صفر errors جديدة** من الـ specs الجديدة (`projects.service.spec.ts`، `phases.service.spec.ts`) ولا من الـ `prisma-mock.ts` extension.

---

✋ تم المختبر — للدور التالي (المراجع الأعلى)؟
