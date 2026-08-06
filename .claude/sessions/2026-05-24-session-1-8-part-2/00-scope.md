# Scope

## Mode: Quick
السبب: 4 تذاكر cleanup صغيرة surgical — كل واحدة تغيير محدود (≤15 سطر) في ملف واحد أو تنظيف data، ومش محتاجة معمارية جديدة. الـ batch منطقي لأنهم كلهم follow-ups من Session 2 / Session 1.8 Part 1.

## المهمة
تطبيق 4 إصلاحات صغيرة من الـ BACKLOG كـ batch واحد:
1. **CHAT-FOLLOWUP-001** — defense-in-depth على chat findRooms (tenant filter في chatRoom query).
2. **A1** — tightening signature لـ `recalculateProgressInTx` من `Prisma.TransactionClient | PrismaService` لـ `Prisma.TransactionClient` فقط (compile-time guarantee لـ C28).
3. **PROJ-NOTE-002** — orphan data audit + cleanup migration لـ ProjectAssignment rows عندها user role IN (CLIENT/PROJECT_MANAGER/SUPER_ADMIN) مع removedAt IS NULL.
4. **A3** — tightening `JwtPayload.role` من `string` لـ `UserRole` enum (typo safety).

## الملفات المتأثرة

### 1. CHAT-FOLLOWUP-001
- `apps/api/src/modules/chat/chat.service.ts` (findRooms — admin branch + non-admin branch)
  - إضافة `project: { companyId: user.companyId, deletedAt: null }` في `where` clause في الـ chatRoom.findMany (سطرين، السطر 33-44 و47-60).
  - **createRoom** ليه chatRoom.create (write) — الـ projectId fully validated بـ ensureProjectAccess قبلها، فمفيش query على chatRoom محتاج defense-in-depth إضافي. مش هنغيره.

### 2. A1 — recalculateProgressInTx
- `apps/api/src/modules/projects/projects.service.ts:484-487`
  - signature: من `(tx: Prisma.TransactionClient | PrismaService, projectId: string)` لـ `(tx: Prisma.TransactionClient, projectId: string)`.
  - JSDoc يـ update يـ remove ذكر `PrismaService for read-only contexts`.
- التحقق: كل الـ callsites الحالية في `phases.service.ts` (4 callsites) و`updates.service.ts` (2 callsites) بتـ pass `tx` بالفعل — verified بـ grep. مفيش callsite بـ `this.prisma`. تـ tightening آمن.

### 3. PROJ-NOTE-002 — assignMember orphan audit
- `apps/api/prisma/migrations/<timestamp>_cleanup_orphan_project_assignments/migration.sql` (جديد)
  - SELECT audit query (commented) — يطلع الـ rows اللي عندها user.role ∈ {CLIENT, PROJECT_MANAGER, SUPER_ADMIN} و ProjectAssignment.removedAt IS NULL.
  - UPDATE statement — يـ SET `removedAt = NOW()`, مع reason note في النية (CLEANUP-PROJ-NOTE-002).
  - **NOTE**: مفيش audit log entry — ده data hygiene migration، الـ migration file نفسه هو الـ audit trail.
- ملف توثيقي مصغّر داخل الـ migration SQL كـ comments (المبرر + الـ rollback نقطة لو لزم).

### 4. A3 — JwtPayload.role typing
- `apps/api/src/common/decorators/current-user.decorator.ts:8-15`
  - `role: string;` → `role: UserRole;`
  - إضافة `import type { UserRole } from '@prisma/client';`.
- **Cascade risk**: 32 ملف يستورد `JwtPayload`. الـ tightening من `string` لـ `UserRole` enum يعني الـ literals الموجودة (`'SUPER_ADMIN'`, `'PROJECT_MANAGER'`, `'CLIENT'`, etc.) لازم تكون assignable لـ `UserRole`. بما إن الـ literals كلها valid enum values، الـ tsc هيـ pass. لو ظهر error في `.includes([...])` checks (TypeScript بيشتكي أحياناً من narrowing على enum array literals)، الإصلاح بسيط: cast الـ array كـ `readonly UserRole[]` أو استخدم `(user.role as UserRole) === UserRole.X`.

## الـ Services المتأثرة (Rule #6)
- **ChatService**: 1 method changed (findRooms). 0 specs الآن، 0 specs مضافة (deferred — full chat coverage outside scope).
- **ProjectsService**: 1 method signature changed (recalculateProgressInTx). الـ existing specs في `projects.service.spec.ts` لازم تفضل passing.
- **PhasesService + UpdatesService**: consumers لـ recalculateProgressInTx — لازم يـ compile صح بعد الـ signature tightening. الـ specs في `phases.service.spec.ts` و`updates.service.spec.ts` لازم تفضل passing.
- **Database**: ProjectAssignment table — migration واحد UPDATE statement.
- **JwtPayload type**: 32 consumer files — لازم كلهم يـ compile.

## تعريف النجاح
- [ ] **CHAT-FOLLOWUP-001**: الـ chatRoom.findMany في findRooms (admin + non-admin) يحتوي على `project: { companyId, deletedAt: null }` filter.
- [ ] **A1**: recalculateProgressInTx signature = `tx: Prisma.TransactionClient` فقط (مش union). JSDoc محدّث.
- [ ] **PROJ-NOTE-002**: migration SQL file مكتوبة، تحتوي على SELECT (commented) + UPDATE statement مع inline comments للمبرر.
- [ ] **A3**: JwtPayload.role = UserRole. الـ import مضاف.
- [ ] **tsc**: `pnpm --filter @saas-one/api typecheck` (أو tsc --noEmit) يـ pass على الكامل.
- [ ] **Tests**: الـ existing test suite يـ pass — `pnpm --filter @saas-one/api test` يـ pass كله. (Rule #4 paired assertions: لو فيه tests جديدة في الـ session نـ apply الـ rule. حالياً مفيش tests جديدة planned — كل التغييرات إما type-only، query filter بسيط، أو data migration. الـ existing regression suite كافي.)
- [ ] **Migration safety**: الـ migration ما يـ crash لو الـ DB فاضي (UPDATE على 0 rows OK).
- [ ] **Literal verification**: tsc + jest stdout يـ نسخوا حرفياً في 02-coder-report.md.

## الحدود (خارج النطاق)
- مفيش tests جديدة لـ ChatService (defense-in-depth الموجود غير قابل للـ exploit at-source — الـ existing tenant gate في ensureProjectAccess كافي functional).
- مفيش refactor للـ chat.service.ts الـ getRoomWithAccess (الـ tenant check موجود already سطر 206).
- مفيش audit log entries للـ orphan cleanup migration (data hygiene، مش user action).
- مفيش تغيير لـ JwtPayload fields غير `role` (الـ `permissions: string[]` deferred — separate ticket A7).

## Risk Assessment (Quick mode triage)
| Ticket | Risk | Mitigation |
|---|---|---|
| CHAT-FOLLOWUP-001 | LOW — query filter addition، لا تغيير في الـ shape | Existing tests يـ regress لو حصل break |
| A1 | LOW — signature tightening، grep أكّد مفيش PrismaService callsite | tsc يقبض أي callsite ناقص |
| PROJ-NOTE-002 | MEDIUM — direct DB UPDATE. ممكن يمس rows غلط لو الـ WHERE clause مش دقيق | SELECT audit في الـ migration نفسها كـ comment + WHERE clause محدد بدقة |
| A3 | LOW-MEDIUM — type tightening عابرة 32 ملف. tsc هيقبض أي mismatch | لو فيه errors widespread، نرجع للـ `string` ونـ defer (escalate لـ Standard mode) |

## Escalation Trigger (Rule #3 implicit)
لو ظهر:
- أكثر من 5 tsc errors بعد A3 → نوقف، نـ defer A3 لـ session منفصلة، ونـ commit الـ 3 الأخرى.
- migration SQL لا يـ apply نظيف → نـ defer PROJ-NOTE-002.
- chat findRooms test يـ regress → نـ investigate قبل ما نـ proceed.

---

⏸️ AWAITING APPROVAL — رد بـ "approve" للبداية.

✋ تم Scope — للدور التالي؟
