# Scope

## Mode: Deep
السبب: review كود قديم لموديولين متشابكين (Projects + Phases) فيهم business logic حساس (state machine، progress recalc، RBAC، tier limits، soft-delete، audit) — مطابق تماماً لـ "review كود قديم Session 1 style" + "major refactoring بيمس عدة modules" في CLAUDE.md. الـ 5 modes flag بتاع Deep كلها منطبقة.

---

## المهمة

Full review لموديولي **Projects** و **Phases** في `apps/api/src/modules/`:
- جودة المعمارية (separation of concerns، الـ helpers، الـ transactions).
- جودة الأمان (RBAC، tenant isolation، IDOR، privilege escalation، state-machine bypass، mass assignment).
- جودة الـ tests (مفيش specs لأي من الموديولين حالياً — هنبني MVT من الصفر).
- الـ business invariants: progress weighted-avg، tier limits، negative-action reasons، paired audit primary+side-effect.

النتيجة: الـ 7 ملفات الـ Deep mode، مع MVT specs مكتوبة وpassing.

---

## الملفات المتأثرة (READ + ANALYZE — يحتمل modify لو الهاكر لقى ثغرات)

### Projects module
- `apps/api/src/modules/projects/projects.controller.ts` (143 LOC) — 8 endpoints، Roles guards.
- `apps/api/src/modules/projects/projects.service.ts` (556 LOC) — business logic، state machine، progress calc، RBAC visibility filter.
- `apps/api/src/modules/projects/projects.module.ts` — DI wiring.
- `apps/api/src/modules/projects/dto/index.ts` (162 LOC) — 7 DTOs.

### Phases module
- `apps/api/src/modules/phases/phases.controller.ts` (107 LOC) — 7 endpoints.
- `apps/api/src/modules/phases/phases.service.ts` (357 LOC) — state machine، progress override، reorder، soft-delete مع active-updates guard.
- `apps/api/src/modules/phases/phases.module.ts` — DI wiring.
- `apps/api/src/modules/phases/dto/index.ts` (114 LOC) — 5 DTOs.

### New (سيُنشأ في دور المختبر)
- `apps/api/src/modules/projects/projects.service.spec.ts` — MVT specs (Projects).
- `apps/api/src/modules/phases/phases.service.spec.ts` — MVT specs (Phases).

### Read-only context (مش هتتعدل)
- `apps/api/src/modules/companies/tier-limits.service.ts` — يُستدعى من `projects.create`.
- `apps/api/src/modules/audit/audit-log.service.ts` — يُستدعى من كل mutation.
- `apps/api/src/prisma/prisma.service.ts` — `softDeleteFilter`.
- `apps/api/src/modules/auth/__tests__/` patterns موجودة — هنقتدي بها لـ test setup.

---

## الـ Services الحاضرة في الـ scope (rule #6)

| Service | الحالة في الـ session | Coverage budget |
|---|---|---|
| `ProjectsService` | في الـ scope بالكامل | ≥6 specs (MVT) |
| `PhasesService` | في الـ scope بالكامل | ≥6 specs (MVT) |
| `TierLimitsService` | mocked dependency فقط — مش under-test هنا | deferred (لها session منفصلة لو محتاجة) |
| `AuditLogService` | mocked فقط — paired-assertion target فقط (rule #4) | deferred |
| `ProjectsController` / `PhasesController` | حدود الـ HTTP-layer testing لسه deferred backlog #5 | deferred |

---

## الـ Skills المستخدمة

- **02 (Architecture)** — separation: controller thin، service fat، DI، module boundaries.
- **03 (RBAC)** — `@Roles` decorators + role-based visibility filter في `findAll` + `ensureProjectAccess`.
- **04 (Audit & negative-action reason)** — كل mutation فيها `logInTransaction`؛ negative transitions/deletes فيهم reason ≥20 char.
- **05 (State machine)** — `STATUS_TRANSITIONS` لـ Projects، `PHASE_STATUS_TRANSITIONS` لـ Phases.
- **07 (Soft-delete + Tenant isolation)** — `softDeleteFilter`، `getOwnedProject(companyId, ...)` gate.
- **C28 (paired transactional consistency)** — `recalculateProgressInTx` (في الـ tx، مش بعدها).

---

## Hacker mode (rule #7)

**`attack-and-fix-critical-only`**

السبب: الكود في production، فالـ trivial issues (cosmetic، code-style) هتبقى توصيات في `03-hacker-report.md` لـ backlog، مش inline fixes. CRITICAL/HIGH only يتصلحوا inline. لو طلع HIGH+ ومحتاج architectural change → NEEDS-CODER ويرجع الـ session للمبرمج (rule #1 الترتيب).

---

## التركيز الخاص (Attack hypotheses قبل ما الهاكر يبدأ)

الـ scoping هنا بيوجه الهاكر، مش بيـ pre-fix:

1. **RBAC bypass في `findAll`** — لو `user.role === undefined` أو role غريب، الـ if/else if/else بيقع على نسيج "must be assigned" — صح؟ لو الـ role ضايع، الـ `userId` undefined ممكن يرجع كل المشاريع؟
2. **Tenant cross-leak في `assignMember`** — هل `member` lookup بيـ enforce `companyId`؟ (أيوة من القراءة، لكن لازم spec).
3. **State-machine bypass via `update()`** — `update` بيمنع `status` field عبر whitelist، لكن لو DTO جابلها `status` كـ extra field فيه `transform` بيـ leak؟ (Global ValidationPipe whitelist موجود؟ — لازم نتأكد).
4. **Phase-via-other-project** — `findOne(phaseId)` بيـ check `project.companyId` لكن `update`/`overrideProgress` بيـ trust `findOne`. لو الـ phase مش موجودة فعلاً → NotFound، صح. لكن لو phase موجودة لكن الـ project بتاعها deleted → `softDeleteFilter` على الـ phase موجود، بس الـ project soft-delete مش بيـ cascade على الـ phases.
5. **Progress overflow / weight=0 edge cases** — recalc بيـ handle weight=0 و phases=0، لكن hooves الـ `Math.min(100, ...)` بتـ clamp، هل ممكن `Math.round` ينتج NaN؟
6. **Reorder collision** — `dto.order` لا يـ enforce uniqueness على الـ project؛ ممكن phasein بنفس الـ order يبقوا — مش security لكن business-invariant.
7. **`recalculateProgress()` (public) outside tx** — هل في caller بيستخدمها بدون tx؟ Grep + verify.
8. **Mass assignment via `update()` + Audit `newValues: dto`** — الـ data whitelist بيـ filter الـ DB write، لكن الـ audit بيحفظ `dto as Record<string, unknown>` (سطر 234 و 219 phases) — لو الهجمة بعتت extra fields، هتـ persist في الـ audit log كـ noise — security-relevant؟
9. **CANCELLED → DELETE audit mapping** — `changeStatus` بيـ map CANCELLED لـ `AuditAction.DELETE`. الـ AuditLogService بيرفض DELETE بدون reason؟ rule #4 lineage موجود (CVE-TEST-011): paired primary+side-effect لازم الـ primary يبقى deepest. هل في spec بيـ verify إن الـ audit DELETE فعلاً اتـ write مع reason، مش بس إن الـ project status اتـ flip؟ (CVE-TEST-011 pattern).
10. **Phase soft-delete: active-updates guard** — `status: { in: ['DRAFT', 'PENDING', 'APPROVED'] }` بيستثني CANCELLED/REJECTED — صح إن الـ schema فيه الـ statuses دي؟

---

## الحدود (خارج نطاق هذا الـ session)

- HTTP-layer integration tests (supertest) — في الـ backlog ticket #5، session منفصل.
- `TierLimitsService` و `AuditLogService` deep-review — لو ظهرت ثغرة جوها أثناء الـ session، توثق كـ NEEDS-CODER ولا تتصلح inline.
- `@prisma/client/runtime/library` migration (backlog ticket #2) — مفيش علاقة بالموديولين.
- `CompaniesService` specs (backlog ticket #3) — session منفصل.
- `JwtStrategy` remaining paths (backlog #4) — session منفصل.
- `CVE-USERS-001` و `A7 permission catalog` — Session 1.8+.
- Frontend (Next.js) consumers لأي endpoint من الـ موديولين.
- Performance/load testing — مش security review.

---

## تعريف النجاح

- [ ] الـ 7 ملفات Deep mode موجودة في `.claude/sessions/2026-05-21-review-projects-phases/`.
- [ ] كل دور وقّع بسطر `✋ تم ...` وانتظر approval.
- [ ] الهاكر فحص الـ 10 attack hypotheses أعلاه + أي vector تاني يطلع.
- [ ] **MVT: ≥12 specs مكتوبة وpassing** (≥6 Projects + ≥6 Phases) — جزء منهم paired-assertion على الـ audit DELETE (rule #4).
- [ ] جدول الـ "Skills المستخدمة" في `00-plan.md` يطابق الـ skills أعلاه.
- [ ] أي CVE-FIXED-BY-HACKER عنده spec واحد على الأقل (rule #2 + rule #5).
- [ ] الـ literal jest stdout + tsc stderr في `02-coder-report.md` و `04-tester-report.md` (rule #8).
- [ ] لو في NEEDS-CODER، الـ session يوقف ويرجع للمبرمج قبل الاستمرار (مش يـ defer للـ backlog).

---

⏸️ AWAITING APPROVAL — رد بـ "approve" للبداية، أو "edit: [تعديل]" للتعديل.

✋ تم Scope — للدور التالي (المخطط)؟
