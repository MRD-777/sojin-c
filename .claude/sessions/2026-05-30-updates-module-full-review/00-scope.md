# Scope — Updates Module Full Review

## Mode: Deep
السبب: مراجعة شاملة لـ Updates module — heart-of-the-system بـ state machine، idempotency، multi-tenant isolation، audit logging داخل الـ tx، و edit-window enforcement. الـ surface area كبير (10 service methods + 10 endpoints) والـ logic security-critical (money/progress movement عبر approve/forceCancel). Quick/Standard مش كفاية: الـ session بتحتاج architect + hacker + tester + principal.

## قواعد إضافية لهذه الـ Session (user-mandated)
1. **Self-contained session** — مفيش debt يـ defer لـ session تانية. كل ما يُكتشف يُغلق هنا.
2. **NEEDS-CODER returns inline** — لو الهاكر فتح NEEDS-CODER، الـ session ترجع للمبرمج (Rule #9) وتخلص جوّاها.
3. **Tests + hardening داخل نفس الـ session** — مفيش "deferred coverage". الـ MVT + الـ regression suite كلها قبل الـ principal exit.

## المهمة
Full deep-review لـ Updates module:
- مراجعة المعمارية الحالية (state machine، tx boundaries، helpers).
- اكتشاف وإصلاح أي ثغرة (security، logic، tenant isolation، race conditions، audit integrity).
- كتابة MVT specs لكل fix + لكل code path غير مغطّى حالياً.
- النتيجة: module جاهز للـ production بلا debt.

## الملفات المتأثرة (enumerated)
- `apps/api/src/modules/updates/updates.controller.ts` (193 سطر) — endpoints + role decorators.
- `apps/api/src/modules/updates/updates.service.ts` (874 سطر) — كل الـ logic.
- `apps/api/src/modules/updates/updates.module.ts` (16 سطر) — DI wiring (likely no change).
- `apps/api/src/modules/updates/dto/index.ts` (142 سطر) — validation rules.
- `apps/api/src/modules/updates/updates.service.spec.ts` (470 سطر، 14 tests) — موجود لكن coverage غير كامل.

**Out-of-module touchpoints يحتمل لمسها:**
- `apps/api/src/modules/projects/projects.service.ts` — `ensureProjectAccess` / `recalculateProgressInTx` (read-only؛ لو ثغرة في contract، تتسجل كـ NEEDS-CODER داخل الـ session).
- `apps/api/src/modules/audit/audit-log.service.ts` — `logInTransaction` signature (read-only).
- `apps/api/src/common/idempotency/idempotency.service.ts` — `lookup` / `save` (read-only).
- `apps/api/prisma/schema.prisma` — Update / UpdateVersion / Phase models (read-only reference).

## الـ Services + Coverage Budget (Rule #6)
| Service Method | Risk | MVT Budget |
|---|---|---|
| `UpdatesService.findAll` | tenant isolation + CLIENT hardcoding + role-based filter | ≥3 specs |
| `UpdatesService.findOne` | visibility checks (CLIENT vs FIELD vs ADMIN) + tenant | ≥3 specs |
| `UpdatesService.create` | duplicate guard + timezone + assignment + DRAFT init + audit | ≥3 specs |
| `UpdatesService.editDraft` | DRAFT/REJECTED only + ownership + REJECTED→DRAFT cycle | ≥2 specs |
| `UpdatesService.submit` | DRAFT→PENDING + title required + ownership | ≥2 specs |
| `UpdatesService.approve` | idempotency + Serializable tx + progress cap + project recalc | ≥1 spec (موجود 6) |
| `UpdatesService.reject` | reason mandatory + audit + PENDING only | ≥1 spec (موجود 1) |
| `UpdatesService.forceCancel` | idempotency + SUNK_COST + progress floor + tx integrity | ≥1 spec (موجود 4) |
| `UpdatesService.editApproved` | 24h window + auto-lock + version snapshot | ≥1 spec (موجود 4) |
| `UpdatesService.getVersions` | visibility delegated to findOne | ≥1 spec |
| `UpdatesService.computeDayBounds` / `toUtcFromLocal` | DST + invalid tz + Cairo midnight | ≥2 specs |
| `UpdatesService.getPhaseWithAccess` / `getOwnedUpdate` | tenant scoping helpers | covered indirectly |
| `UpdatesController` (DTO wiring + Roles + ParseUUIDPipe) | covered indirectly عبر service specs |  — |

**إجمالي MVT المتوقع: ≥20 spec جديد** (دقّة الـ budget يحدّدها المخطط في `00-plan.md` بعد الـ deep dive).

## الـ Hacker Mode (Rule #7)
**attack-and-fix** (default).
- لو الـ fix معماري (يلمس contracts برّا الـ module مثل ProjectsService أو AuditLogService) → NEEDS-CODER، يـ trigger Rule #9 inside-session.
- لو الـ fix داخلي للـ Updates module فقط → FIXED-BY-HACKER.

## الـ Skills المستخدمة
- **Skill 04** (Updates lifecycle + state machine) — reference للـ state transitions و duplicate-guard rule.
- **Skill 07** (Audit logging) — audit-inside-tx contract.
- **C28** (transaction integrity rule) — `recalculateProgressInTx` lives inside الـ tx.
- **MVT discipline** (CLAUDE.md Rule #2) — test code فعلي مش checklist.
- **Paired assertions** (Rule #4) — primary action على الـ deepest mock layer.

## الحدود (خارج نطاق هذا الـ session)
- مفيش refactor للـ ProjectsService أو AuditLogService — لو fix محتاج تغيير في contract، يتسجل NEEDS-CODER ويترجع للمبرمج جوّا الـ session.
- مفيش HTTP integration tests (supertest) — موجود في BACKLOG ticket #5 (Session 1.7) كـ infrastructure work منفصل؛ هذا الـ session service-layer فقط.
- مفيش UI/frontend changes.
- مفيش schema migration إلا لو ثغرة CRITICAL تستلزم — يتسجل في الـ hacker report ويتنفذ inline.

## تعريف النجاح (المخطط هيـ refine في الـ plan)
- [ ] Architecture review مكتمل + plan موافق عليه.
- [ ] كل fix منفذ + audit-inside-tx محفوظ.
- [ ] Hacker round: كل attack vector مفحوص + كل CVE مغلق (FIXED-BY-HACKER أو NEEDS-CODER returned-and-closed).
- [ ] MVT ≥20 spec جديد، كلها passing، literal jest stdout في `02-coder-report.md` و `04-tester-report.md`.
- [ ] Principal verdict = APPROVED (لو REJECTED → rework داخل الـ session).
- [ ] BACKLOG.md ما يحملش أي Updates-module debt عند الـ closure.

---
⏸️ AWAITING APPROVAL — رد بـ "approve" للمتابعة للدور الأول (🧠 المخطط).

✋ تم Scope — للدور التالي؟
