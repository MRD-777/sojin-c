// ============================================
// 📊 BOQ Service — S7 (Stage 6) — جدول الكميات
//
// Critical guarantees:
//   1. `prisma.bOQItem.delete()` is NEVER called — soft-delete only.
//   2. Every write + its audit entry share ONE serializable transaction,
//      and every pre-state read happens INSIDE it (a read outside would let
//      a concurrent write make `oldValues` describe a state that never
//      immediately preceded the write — same reasoning as Stage 4).
//   3. Cross-project linking is impossible BY CONSTRUCTION: the update is
//      looked up scoped to the BOQ item's own project, so an update from
//      another project (or another tenant) simply does not exist for this
//      query. See `linkUpdate` for the full defense stack.
//   4. completedPct counts APPROVED, non-deleted updates under non-deleted
//      phases only — the exact same population FinancialSummaryService sums
//      into totalCompleted, so the two endpoints can never disagree.
//   5. Decimal-only arithmetic; values cross the boundary as strings.
//
// See: .claude/skills/02-database.md, 07-audit-compliance.md
// ============================================
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { ProjectsService } from '../projects/projects.service';
import {
  CreateBOQItemDto,
  UpdateBOQItemDto,
  DeleteBOQItemDto,
  LinkUpdateDto,
} from './dto';
import { JwtPayload } from '../../common/decorators';
import { AuditAction, Prisma, UpdateStatus } from '@prisma/client';
import { Request } from 'express';

const { Decimal } = Prisma;

const ZERO = new Decimal(0);
const HUNDRED = new Decimal(100);

const BOQ_SELECT = {
  id: true,
  projectId: true,
  parentId: true,
  name: true,
  contractValue: true,
  order: true,
} satisfies Prisma.BOQItemSelect;

type BOQRow = Prisma.BOQItemGetPayload<{ select: typeof BOQ_SELECT }>;

/**
 * `AuditLogService.assertEntryValid` requires a reason of ≥20 chars for
 * DELETE, but plan decision #3 made `DeleteBOQItemDto.reason` optional (a BOQ
 * item is a planning artifact, not a cash movement). Without this the audit
 * validator throws a raw Error on every reason-less delete and the caller
 * sees a 500.
 *
 * Resolution: the item's own `deletionReason` column stores EXACTLY what the
 * user typed (or null). Only the audit `reason` gets this prefix, and it
 * states plainly that no reason was required — an auditor reading the log is
 * told the truth, never shown an invented justification.
 */
const AUDIT_DELETE_PREFIX =
  'حذف بند من جدول الكميات (السبب اختياري لبنود المقايسة)';

/**
 * [CVE-S7-005] Maximum ancestors above a new sub-item.
 *
 * Nothing bounded the tree depth: each POST /boq/:id/sub-items added a level,
 * and while the tree is ASSEMBLED iteratively, the response is SERIALIZED
 * recursively (JSON.stringify) — a deep enough chain turns every subsequent
 * GET /boq into a stack overflow, i.e. a self-inflicted denial of service on
 * a project's own BOQ that no read-side fix can undo. Bounding it at write
 * time is the only place the damage is preventable.
 */
const MAX_BOQ_ANCESTORS = 10;

const buildAuditDeleteReason = (userReason?: string): string => {
  const trimmed = userReason?.trim();
  if (trimmed && trimmed.length >= 20) return trimmed;
  return trimmed
    ? `${AUDIT_DELETE_PREFIX} | سبب المستخدم: ${trimmed}`
    : AUDIT_DELETE_PREFIX;
};

@Injectable()
export class BOQService {
  private readonly logger = new Logger(BOQService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly projectsService: ProjectsService,
  ) {}

  // ─── GET /projects/:projectId/boq ──────────────────────
  /**
   * The whole tree in TWO queries — items and links — never one query per
   * item. Nesting is assembled in memory.
   */
  async findTree(user: JwtPayload, projectId: string) {
    await this.projectsService.ensureProjectAccess(user, projectId);

    // One snapshot: a link created between the two reads must not be able to
    // reference an item this response never saw.
    const [items, links] = await this.prisma.$transaction([
      this.prisma.bOQItem.findMany({
        where: {
          projectId,
          ...this.prisma.softDeleteFilter,
          project: { companyId: user.companyId, deletedAt: null },
        },
        select: BOQ_SELECT,
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.bOQItemUpdate.findMany({
        where: {
          boqItem: {
            projectId,
            deletedAt: null,
            project: { companyId: user.companyId, deletedAt: null },
          },
          // Same population as FinancialSummaryService.totalCompleted:
          // APPROVED only, live update, live phase, this project, this tenant.
          // A link that predates a fix (or was written by a bug) contributes
          // ZERO here rather than inflating progress.
          update: {
            status: UpdateStatus.APPROVED,
            deletedAt: null,
            phase: {
              deletedAt: null,
              project: {
                id: projectId,
                companyId: user.companyId,
                deletedAt: null,
              },
            },
          },
        },
        select: { boqItemId: true, update: { select: { cost: true } } },
      }),
    ]);

    // Σ approved cost per item — one pass, no N+1.
    const completedByItem = new Map<string, Prisma.Decimal>();
    for (const link of links) {
      const current = completedByItem.get(link.boqItemId) ?? ZERO;
      completedByItem.set(link.boqItemId, current.plus(link.update.cost));
    }

    return { projectId, items: this.buildTree(items, completedByItem) };
  }

  // ─── POST /projects/:projectId/boq ─────────────────────
  /** Root item (parentId = null). */
  async create(
    user: JwtPayload,
    projectId: string,
    dto: CreateBOQItemDto,
    req: Request,
  ) {
    await this.projectsService.ensureProjectAccess(user, projectId);

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        companyId: user.companyId,
        ...this.prisma.softDeleteFilter,
      },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('المشروع غير موجود');

    return this.persistNew(user, projectId, null, dto, req);
  }

  // ─── POST /boq/:id/sub-items ───────────────────────────
  /**
   * The project is taken from the PARENT item, never from the caller — there
   * is no request field through which a sub-item could be planted into a
   * different project.
   */
  async createSubItem(
    user: JwtPayload,
    parentId: string,
    dto: CreateBOQItemDto,
    req: Request,
  ) {
    const parent = await this.readItem(user, parentId);
    // Layer 3 on the PARENT's project (a SUPER_ADMIN of another company never
    // gets this far — readItem is already company-scoped).
    await this.projectsService.ensureProjectAccess(user, parent.projectId);

    return this.persistNew(user, parent.projectId, parent.id, dto, req);
  }

  // ─── PATCH /boq/:id ────────────────────────────────────
  async update(
    user: JwtPayload,
    id: string,
    dto: UpdateBOQItemDto,
    req: Request,
  ) {
    const item = await this.readItem(user, id);
    await this.projectsService.ensureProjectAccess(user, item.projectId);

    const outcome = await this.prisma.runSerializable(async (tx) => {
      // Re-read inside the transaction: the pre-state that lands in the audit
      // must be the state this write actually replaced.
      const current = await this.readItemIn(tx, user, id);
      const { patch, oldValues, newValues } = this.buildDiff(dto, current);

      // Same no-op rule as financial settings: nothing changed ⇒ no write,
      // no audit entry (an oldValues == newValues row is noise).
      if (Object.keys(patch).length === 0) {
        return { row: current, changed: false };
      }

      const saved = await tx.bOQItem.update({
        where: { id: current.id },
        data: patch,
        select: BOQ_SELECT,
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: user.companyId,
        userId: user.userId,
        userRole: user.role,
        entityType: 'boq_item',
        entityId: saved.id,
        action: AuditAction.UPDATE,
        oldValues,
        newValues: { ...newValues, projectId: saved.projectId },
        req,
      });

      return { row: saved, changed: true };
    });

    if (!outcome.changed) {
      this.logger.log(
        `BOQ item PATCH no-op: item=${id} by=${user.userId} (no field changed — no audit entry written)`,
      );
    }

    return this.serialize(outcome.row);
  }

  // ─── DELETE /boq/:id ───────────────────────────────────
  /**
   * SOFT delete. Blocked while the item still has ACTIVE children
   * (plan decision #3) — deleting a parent out from under live sub-items
   * would orphan them and silently drop their value from the tree.
   *
   * The children check runs INSIDE the serializable transaction: checked
   * outside, a sub-item created a millisecond later would be orphaned by a
   * delete that had already "passed" the check.
   */
  async softDelete(
    user: JwtPayload,
    id: string,
    dto: DeleteBOQItemDto,
    req: Request,
  ) {
    const item = await this.readItem(user, id);
    await this.projectsService.ensureProjectAccess(user, item.projectId);

    const deleted = await this.prisma.runSerializable(async (tx) => {
      // Re-read under the transaction — a concurrent delete must not produce
      // a second audit entry for the same removal.
      const current = await this.readItemIn(tx, user, id);

      // [CVE-S7-004] `projectId` is asserted here too. Children are created
      // through `sub-items`, which derives projectId from the parent, so a
      // cross-project child cannot exist today — but the FK does not enforce
      // it, and this guard is the one query in the module that decided
      // something WITHOUT the project constraint inside its own where-clause.
      // That is exactly the pattern this session exists to close.
      const activeChildren = await tx.bOQItem.count({
        where: {
          parentId: current.id,
          projectId: current.projectId,
          deletedAt: null,
        },
      });
      if (activeChildren > 0) {
        throw new BadRequestException('لا يمكن حذف بند له تفريعات نشطة');
      }

      // ⚠️ update(), never delete(). The row stays queryable for audit.
      const row = await tx.bOQItem.update({
        where: { id: current.id },
        data: {
          deletedAt: new Date(),
          deletedBy: user.userId,
          // Exactly what the user typed, or null — never the synthetic
          // audit text.
          deletionReason: dto.reason?.trim() || null,
        },
        select: { ...BOQ_SELECT, deletedAt: true, deletionReason: true },
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: user.companyId,
        userId: user.userId,
        userRole: user.role,
        entityType: 'boq_item',
        entityId: row.id,
        action: AuditAction.DELETE,
        // DELETE ⇒ oldValues = snapshot, newValues = null (audit convention).
        oldValues: {
          name: current.name,
          contractValue: current.contractValue.toFixed(2),
          order: current.order,
          parentId: current.parentId,
          projectId: current.projectId,
        },
        newValues: null,
        reason: buildAuditDeleteReason(dto.reason),
        req,
      });

      return row;
    });

    this.logger.log(
      `BOQ item soft-deleted: item=${deleted.id} project=${deleted.projectId} by=${user.userId}`,
    );

    return {
      ...this.serialize(deleted),
      deletedAt: deleted.deletedAt ? deleted.deletedAt.toISOString() : null,
      deletionReason: deleted.deletionReason,
    };
  }

  // ─── PATCH /boq/:id/link-update ────────────────────────
  /**
   * 🔴 The sharpest IDOR surface in the module: linking an approved update
   * from ANOTHER project (or another tenant) to this BOQ item would import
   * foreign money into this project's progress figures.
   *
   * Defense stack, outermost first:
   *   1. @Roles           — Layer 2, which roles may call at all.
   *   2. readItem         — the BOQ item is fetched scoped to the caller's
   *                         company; another tenant's item is a 404.
   *   3. ensureProjectAccess — Layer 3 on the item's own project (an assigned
   *                         SITE_ENGINEER/SUPERVISOR, a CLIENT owner, etc.).
   *   4. THE LOOKUP ITSELF — the update is queried with
   *      `phase.project.id = boqItem.projectId AND companyId = caller's`.
   *      A foreign update is not "rejected"; it does not EXIST for this
   *      query. This is deliberate: a post-fetch `if (a !== b)` comparison
   *      is one forgotten line away from being dropped in a refactor,
   *      whereas a constraint inside the where-clause cannot be bypassed
   *      without rewriting the query.
   *   5. A redundant runtime assertion on the returned row (below) — belt
   *      and braces, so that a future loosening of step 4 fails loudly
   *      instead of silently importing foreign costs.
   *
   * Duplicate links are idempotent (the unique index is the backstop): the
   * second call returns the existing link and writes NO audit entry.
   */
  async linkUpdate(
    user: JwtPayload,
    id: string,
    dto: LinkUpdateDto,
    req: Request,
  ) {
    const item = await this.readItem(user, id);
    await this.projectsService.ensureProjectAccess(user, item.projectId);

    const outcome = await this.prisma
      .runSerializable(async (tx) => {
        const boqItem = await this.readItemIn(tx, user, id);

        // ── Step 4: the scoped lookup ──────────────────────
        const update = await tx.update.findFirst({
          where: {
            id: dto.updateId,
            deletedAt: null,
            phase: {
              deletedAt: null,
              project: {
                id: boqItem.projectId, // ⚠️ THE cross-project gate
                companyId: user.companyId, // ⚠️ THE cross-tenant gate
                deletedAt: null,
              },
            },
          },
          select: {
            id: true,
            status: true,
            cost: true,
            phase: { select: { projectId: true } },
          },
        });

        // Same 404 for "does not exist", "belongs to another project" and
        // "belongs to another tenant" — the distinction is itself privileged.
        if (!update) throw new NotFoundException('التقرير غير موجود');

        // ── Step 5: redundant assertion ────────────────────
        if (update.phase.projectId !== boqItem.projectId) {
          throw new BadRequestException(
            'لا يمكن ربط تقرير من مشروع آخر بهذا البند',
          );
        }

        // Status is checked AFTER the scoping, not inside it: at this point
        // the caller provably has access to this update, so telling them
        // "not approved" leaks nothing — and a generic 404 here would send
        // a legitimate engineer hunting for a report that is right there.
        if (update.status !== UpdateStatus.APPROVED) {
          throw new BadRequestException(
            'لا يمكن ربط تقرير غير معتمد بالبند',
          );
        }

        const existing = await tx.bOQItemUpdate.findUnique({
          where: {
            boqItemId_updateId: { boqItemId: boqItem.id, updateId: update.id },
          },
          select: { id: true },
        });
        if (existing) {
          return { linkId: existing.id, updateId: update.id, created: false };
        }

        const link = await tx.bOQItemUpdate.create({
          data: { boqItemId: boqItem.id, updateId: update.id },
          select: { id: true },
        });

        await this.auditLog.logInTransaction(tx, {
          companyId: user.companyId,
          userId: user.userId,
          userRole: user.role,
          entityType: 'boq_item_update',
          entityId: link.id,
          action: AuditAction.CREATE,
          oldValues: null,
          newValues: {
            boqItemId: boqItem.id,
            updateId: update.id,
            projectId: boqItem.projectId,
            // The money this link pulls into the item's completed value.
            updateCost: update.cost.toFixed(2),
          },
          req,
        });

        return { linkId: link.id, updateId: update.id, created: true };
      })
      .catch((err: unknown) => {
        // Two identical link requests racing: the unique index rejects the
        // loser. Idempotent from the caller's side, not a 500.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          return { linkId: null, updateId: dto.updateId, created: false };
        }
        throw err;
      });

    if (outcome.created) {
      this.logger.log(
        `BOQ link created: item=${id} update=${outcome.updateId} by=${user.userId}`,
      );
    }

    return {
      id: outcome.linkId,
      boqItemId: id,
      updateId: outcome.updateId,
      alreadyLinked: !outcome.created,
    };
  }

  // ─── Internals ─────────────────────────────────────────

  /**
   * Fetch a live BOQ item scoped to the caller's company.
   *
   * 404 (not 403) for another tenant's id: whether that id exists at all is
   * privileged information. This mirrors `payments.findOne`.
   */
  private async readItem(user: JwtPayload, id: string): Promise<BOQRow> {
    const item = await this.readItemIn(this.prisma, user, id);
    return item;
  }

  /** Same read, usable inside a transaction. Throws 404 when absent. */
  private async readItemIn(
    client: PrismaService | Prisma.TransactionClient,
    user: JwtPayload,
    id: string,
  ): Promise<BOQRow> {
    const item = await client.bOQItem.findFirst({
      where: {
        id,
        deletedAt: null,
        project: { companyId: user.companyId, deletedAt: null },
      },
      select: BOQ_SELECT,
    });
    if (!item) throw new NotFoundException('البند غير موجود');
    return item;
  }

  /** Shared by create + createSubItem — one transaction, one audit entry. */
  private async persistNew(
    user: JwtPayload,
    projectId: string,
    parentId: string | null,
    dto: CreateBOQItemDto,
    req: Request,
  ) {
    const created = await this.prisma.runSerializable(async (tx) => {
      if (parentId) {
        // Re-assert the parent inside the transaction: a parent soft-deleted
        // between the check and the insert would leave a live child hanging
        // off a dead node.
        await this.readItemIn(tx, user, parentId);
        await this.assertDepthWithinLimit(tx, parentId);
      }

      const row = await tx.bOQItem.create({
        data: {
          projectId,
          parentId,
          name: dto.name.trim(),
          contractValue: new Decimal(dto.contractValue),
          order: dto.order ?? 0,
        },
        select: BOQ_SELECT,
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: user.companyId,
        userId: user.userId,
        userRole: user.role,
        entityType: 'boq_item',
        entityId: row.id,
        action: AuditAction.CREATE,
        oldValues: null,
        newValues: {
          name: row.name,
          contractValue: row.contractValue.toFixed(2),
          order: row.order,
          parentId: row.parentId,
          projectId: row.projectId,
        },
        req,
      });

      return row;
    });

    this.logger.log(
      `BOQ item created: item=${created.id} project=${projectId} parent=${parentId ?? 'root'} by=${user.userId}`,
    );

    return this.serialize(created);
  }

  /**
   * [CVE-S7-005] Walk up the ancestor chain and refuse a sub-item that would
   * sit deeper than MAX_BOQ_ANCESTORS levels.
   *
   * The loop is bounded by the limit itself, so it terminates even if a
   * cyclic parent chain ever became possible (it is not today — `parentId` is
   * set at creation and no endpoint can change it).
   */
  private async assertDepthWithinLimit(
    tx: Prisma.TransactionClient,
    parentId: string,
  ): Promise<void> {
    let cursor: string | null = parentId;

    for (let level = 1; level <= MAX_BOQ_ANCESTORS; level++) {
      const row: { parentId: string | null } | null =
        await tx.bOQItem.findUnique({
          where: { id: cursor! },
          select: { parentId: true },
        });
      // Reached a root within the limit.
      if (!row?.parentId) return;
      cursor = row.parentId;
    }

    throw new BadRequestException(
      `لا يمكن تجاوز ${MAX_BOQ_ANCESTORS} مستويات في شجرة البنود`,
    );
  }

  /** Diff a PATCH against the row — only genuinely changed fields survive. */
  private buildDiff(dto: UpdateBOQItemDto, current: BOQRow) {
    const patch: Partial<{
      name: string;
      contractValue: Prisma.Decimal;
      order: number;
    }> = {};
    const oldValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      const next = dto.name.trim();
      if (next !== current.name) {
        patch.name = next;
        oldValues.name = current.name;
        newValues.name = next;
      }
    }

    if (dto.contractValue !== undefined) {
      const next = new Decimal(dto.contractValue);
      // .equals(), not === : 100 and 100.00 are the same amount.
      if (!next.equals(current.contractValue)) {
        patch.contractValue = next;
        oldValues.contractValue = current.contractValue.toFixed(2);
        newValues.contractValue = next.toFixed(2);
      }
    }

    if (dto.order !== undefined && dto.order !== current.order) {
      patch.order = dto.order;
      oldValues.order = current.order;
      newValues.order = dto.order;
    }

    return { patch, oldValues, newValues };
  }

  /**
   * Assemble parent/child nesting in memory.
   *
   * Iterative, not recursive: the depth of a BOQ tree is caller-controlled
   * (every sub-item adds a level), so a recursive builder would be a stack
   * overflow waiting for a deep enough tree.
   *
   * An item whose parent is missing from this set (parent soft-deleted while
   * the child lived — currently impossible through the API, since deleting a
   * parent with active children is blocked) is surfaced as a ROOT rather than
   * silently dropped: losing a priced item from the tree would understate the
   * BOQ total.
   */
  private buildTree(
    items: BOQRow[],
    completedByItem: Map<string, Prisma.Decimal>,
  ) {
    type Node = ReturnType<BOQService['serializeNode']> & { children: Node[] };

    const nodes = new Map<string, Node>();
    for (const item of items) {
      nodes.set(item.id, {
        ...this.serializeNode(item, completedByItem.get(item.id) ?? ZERO),
        children: [],
      });
    }

    const roots: Node[] = [];
    for (const item of items) {
      const node = nodes.get(item.id)!;
      const parent = item.parentId ? nodes.get(item.parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }

    return roots;
  }

  private serializeNode(item: BOQRow, completedValue: Prisma.Decimal) {
    // contractValue = 0 ⇒ 0%, never a division by zero.
    // Capped at 100: over-delivery is real, but a 143% progress bar is not
    // a number anyone can act on.
    const pct = item.contractValue.gt(0)
      ? Decimal.min(
          HUNDRED,
          completedValue.div(item.contractValue).mul(HUNDRED),
        )
      : ZERO;

    return {
      ...this.serialize(item),
      completedValue: completedValue.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
      completedPct: pct.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
    };
  }

  private serialize(item: BOQRow) {
    return {
      id: item.id,
      projectId: item.projectId,
      parentId: item.parentId,
      name: item.name,
      contractValue: item.contractValue.toFixed(2),
      order: item.order,
    };
  }
}
