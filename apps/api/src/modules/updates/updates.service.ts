// ============================================
// 📝 Updates Service — Heart of the system
//
// Critical guarantees (skills 04, 07):
//   - State machine: DRAFT → PENDING → APPROVED → FORCE_CANCELLED
//                   DRAFT/REJECTED ↔ editable; APPROVED is locked after 24h
//   - Every state transition + every edit-after-approval lands in audit_logs
//     INSIDE the same transaction (auditLog.logInTransaction).
//   - 24-hour edit window on APPROVED — hard-enforced server-side.
//   - Force cancel reverses progress + creates SUNK_COST payment + audit.
//   - Reason is mandatory on REJECT / FORCE_CANCEL / edit-after-approval.
//   - Client-visible status is hard-coded to APPROVED — never trust query.
// ============================================
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { ProjectsService } from '../projects/projects.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import {
  CreateUpdateDto,
  EditUpdateDto,
  RejectUpdateDto,
  ForceCancelDto,
  EditApprovedDto,
  ListUpdatesQueryDto,
} from './dto';
import { JwtPayload } from '../../common/decorators';
import { AuditAction, Prisma, UpdateStatus } from '@prisma/client';
import { Request } from 'express';

const { Decimal } = Prisma;

/** Edit-after-approval window. After this, an update is permanently locked. */
const LOCK_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Roles that see all updates regardless of submitter. ACCOUNTANT lives here
 * (D2=A in session 2026-05-30) because cost line-items + materialsUsed
 * inform accounting decisions BEFORE approval — narrowing to "own ∪ APPROVED"
 * would hide the data they need.
 */
const ADMIN_TIER_ROLES: ReadonlyArray<JwtPayload['role']> = [
  'SUPER_ADMIN',
  'PROJECT_MANAGER',
  'ACCOUNTANT',
];

@Injectable()
export class UpdatesService {
  private readonly logger = new Logger(UpdatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly projectsService: ProjectsService,
    private readonly idempotency: IdempotencyService,
  ) {}

  // ─── List Updates for a Phase ──────────────────────────
  async findAll(
    user: JwtPayload,
    phaseId: string,
    query: ListUpdatesQueryDto,
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const sortOrder = query.sortOrder ?? 'desc';

    await this.getPhaseWithAccess(user, phaseId);

    const where: Prisma.UpdateWhereInput = {
      phaseId,
      ...this.prisma.softDeleteFilter,
    };

    // Status filter — three role tiers:
    //   CLIENT      → hardcoded APPROVED, query.status ignored (skill 04 rule 5)
    //   ADMIN_TIER  → free filter (PM/SUPER_ADMIN/ACCOUNTANT see everything)
    //   FIELD ROLES → narrowed: own ∪ APPROVED, never broader
    //
    // CVE-UPD-001: previously a FIELD role could pass ?status=PENDING and
    // bypass the "own ∪ APPROVED" narrow, exposing every PENDING update in
    // the phase. The query.status now refines the narrow instead of
    // replacing it.
    if (user.role === 'CLIENT') {
      where.status = UpdateStatus.APPROVED;
    } else if (ADMIN_TIER_ROLES.includes(user.role)) {
      if (query.status) where.status = query.status;
    } else {
      if (!query.status) {
        where.OR = [
          { submittedBy: user.userId },
          { status: UpdateStatus.APPROVED },
        ];
      } else if (query.status === UpdateStatus.APPROVED) {
        // APPROVED is universally visible — no submitter narrow needed.
        where.status = UpdateStatus.APPROVED;
      } else {
        // DRAFT / PENDING / REJECTED / FORCE_CANCELLED — own only.
        where.status = query.status;
        where.submittedBy = user.userId;
      }
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.update.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          workDone: true,
          workersCount: true,
          workHours: true,
          cost: true,
          progressIncrement: true,
          status: true,
          rejectionReason: true,
          isLocked: true,
          submittedAt: true,
          reviewedAt: true,
          createdAt: true,
          submitter: { select: { id: true, name: true, role: true, avatar: true } },
          reviewer: { select: { id: true, name: true } },
          _count: { select: { media: { where: { deletedAt: null } }, comments: true } },
        },
        orderBy: { createdAt: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.update.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Get Single Update ─────────────────────────────────
  async findOne(user: JwtPayload, updateId: string) {
    const update = await this.prisma.update.findFirst({
      where: { id: updateId, ...this.prisma.softDeleteFilter },
      include: {
        phase: {
          select: {
            id: true,
            name: true,
            projectId: true,
            project: { select: { id: true, companyId: true, name: true, clientId: true } },
          },
        },
        submitter: { select: { id: true, name: true, role: true, avatar: true } },
        reviewer: { select: { id: true, name: true } },
        media: {
          where: { deletedAt: null },
          orderBy: { order: 'asc' },
        },
        comments: {
          where: this.prisma.softDeleteFilter,
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, content: true, type: true, status: true, createdAt: true,
            user: { select: { id: true, name: true, role: true, avatar: true } },
          },
        },
      },
    });

    if (!update) throw new NotFoundException('التحديث غير موجود');
    if (update.phase.project.companyId !== user.companyId) {
      throw new NotFoundException('التحديث غير موجود');
    }

    // Visibility checks — CVE-UPD-006: every denial path returns
    // NotFoundException so an attacker can't enumerate existence by
    // diffing 403 vs 404 responses. Same posture as findFirst's tenant
    // check above (consistent with CVE-PROJ-001 / Session 2).
    if (user.role === 'CLIENT') {
      if (update.phase.project.clientId !== user.userId) {
        throw new NotFoundException('التحديث غير موجود');
      }
      if (update.status !== 'APPROVED') {
        throw new NotFoundException('التحديث غير موجود');
      }
    } else if (
      !ADMIN_TIER_ROLES.includes(user.role) &&
      update.submittedBy !== user.userId &&
      update.status !== 'APPROVED'
    ) {
      throw new NotFoundException('التحديث غير موجود');
    }

    return update;
  }

  // ─── Create Update (DRAFT) ─────────────────────────────
  async create(
    user: JwtPayload,
    phaseId: string,
    dto: CreateUpdateDto,
    req: Request,
  ) {
    if (user.role === 'CLIENT') {
      throw new ForbiddenException('العملاء لا يمكنهم إنشاء تحديثات');
    }

    const phase = await this.getPhaseWithAccess(user, phaseId);

    // Non-admins must be assigned to the project
    if (!['SUPER_ADMIN', 'PROJECT_MANAGER'].includes(user.role)) {
      const assignment = await this.prisma.projectAssignment.findFirst({
        where: { projectId: phase.projectId, userId: user.userId, removedAt: null },
      });
      if (!assignment) {
        throw new ForbiddenException('أنت غير معيّن على هذا المشروع');
      }
    }

    // ── Duplicate-submission guard (I9) ───────────────────
    // Business rule (skill 04): one user × one phase × one calendar day =
    // at most one ACTIVE update. We don't enforce this via a DB unique
    // index because the "active" definition (DRAFT/PENDING/APPROVED but
    // NOT FORCE_CANCELLED/REJECTED) is application-level AND the day
    // boundary is tenant-tz-relative (the index would have to know the
    // company timezone, which lives in another row).
    //
    // Day boundary is computed in the company's timezone — using server
    // UTC would create surprise edge cases at midnight for AR users
    // (default timezone Africa/Cairo). We fetch the company tz once.
    const company = await this.prisma.company.findUnique({
      where: { id: user.companyId },
      select: { timezone: true },
    });
    const tz = company?.timezone ?? 'UTC';
    const { dayStart, dayEnd } = this.computeDayBounds(new Date(), tz);

    // CVE-UPD-003: the duplicate check + the create must run inside the
    // SAME tx with Serializable isolation so two parallel POSTs can't
    // both pass the check and both insert. Postgres Serializable
    // detects the write-skew between read (findFirst) and write
    // (create) across concurrent tx's and aborts one — the client
    // retries and the second attempt sees the existing row.
    const update = await this.prisma.runSerializable(
      async (tx) => {
        const existingToday = await tx.update.findFirst({
          where: {
            phaseId,
            submittedBy: user.userId,
            status: { in: ['DRAFT', 'PENDING', 'APPROVED'] },
            createdAt: { gte: dayStart, lt: dayEnd },
            ...this.prisma.softDeleteFilter,
          },
          select: { id: true, status: true },
        });

        if (existingToday) {
          const label =
            existingToday.status === 'DRAFT'
              ? 'مسودة'
              : existingToday.status === 'PENDING'
                ? 'قيد المراجعة'
                : 'معتمد';
          throw new ConflictException(
            `لديك تحديث ${label} على هذه المرحلة اليوم. عدّل المسودة أو انتظر مراجعة المعلّق.`,
          );
        }

        const created = await tx.update.create({
          data: {
            phaseId,
            submittedBy: user.userId,
            title: dto.title,
            description: dto.description,
            workDone: dto.workDone,
            workRemaining: dto.workRemaining,
            workersCount: dto.workersCount ?? 0,
            workHours: dto.workHours ?? 0,
            materialsUsed: (dto.materialsUsed ?? []) as Prisma.InputJsonValue,
            cost: dto.cost ?? 0,
            progressIncrement: dto.progressIncrement ?? 0,
            status: 'DRAFT',
          },
        });

        await this.auditLog.logInTransaction(tx, {
          companyId: user.companyId,
          userId: user.userId,
          userRole: user.role,
          entityType: 'update',
          entityId: created.id,
          action: AuditAction.CREATE,
          oldValues: null,
          newValues: { title: dto.title, phaseId, status: 'DRAFT' },
          req,
        });

        return created;
      },
    );

    return update;
  }

  // ─── Edit Draft (also handles REJECTED → DRAFT cycle) ──
  async editDraft(
    user: JwtPayload,
    updateId: string,
    dto: EditUpdateDto,
    req: Request,
  ) {
    const update = await this.getOwnedUpdate(user, updateId);

    if (update.status !== 'DRAFT' && update.status !== 'REJECTED') {
      throw new BadRequestException('يمكن تعديل المسودة أو المرفوض فقط');
    }

    const wasRejected = update.status === 'REJECTED';

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.update.update({
        where: { id: updateId },
        data: {
          title: dto.title,
          description: dto.description,
          workDone: dto.workDone,
          workRemaining: dto.workRemaining,
          workersCount: dto.workersCount,
          workHours: dto.workHours,
          materialsUsed: (dto.materialsUsed ?? undefined) as Prisma.InputJsonValue | undefined,
          cost: dto.cost,
          progressIncrement: dto.progressIncrement,
          // REJECTED → back to DRAFT on edit, and clear the rejection
          // metadata (BUG-UPD-009). Previously the rejectionReason +
          // reviewer fields stuck around: a subsequent approve left the
          // row showing a stale "rejected because X" payload, and the
          // audit trail conflated the past rejection with the current
          // approval.
          status: 'DRAFT',
          ...(wasRejected
            ? { rejectionReason: null, reviewedBy: null, reviewedAt: null }
            : {}),
        },
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: user.companyId,
        userId: user.userId,
        userRole: user.role,
        entityType: 'update',
        entityId: updateId,
        action: AuditAction.UPDATE,
        oldValues: wasRejected
          ? {
              status: 'REJECTED',
              title: update.title,
              // Keep the rejection reason in the trail — the row no
              // longer carries it, but auditors must be able to see
              // why the previous review failed.
              rejectionReason: update.rejectionReason,
            }
          : { title: update.title },
        newValues: { ...(dto as Record<string, unknown>), status: 'DRAFT' },
        req,
      });

      return updated;
    });
  }

  // ─── Submit for Review (DRAFT → PENDING) ───────────────
  async submit(user: JwtPayload, updateId: string, req: Request) {
    const update = await this.getOwnedUpdate(user, updateId);

    if (update.status !== 'DRAFT') {
      throw new BadRequestException('يمكن إرسال المسودات فقط للمراجعة');
    }
    if (!update.title?.trim()) {
      throw new BadRequestException('عنوان التحديث مطلوب قبل الإرسال');
    }

    return this.prisma.$transaction(async (tx) => {
      const submitted = await tx.update.update({
        where: { id: updateId },
        data: { status: 'PENDING', submittedAt: new Date() },
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: user.companyId,
        userId: user.userId,
        userRole: user.role,
        entityType: 'update',
        entityId: updateId,
        action: AuditAction.UPDATE,
        oldValues: { status: 'DRAFT' },
        newValues: { status: 'PENDING', submittedAt: submitted.submittedAt?.toISOString() },
        req,
      });

      return submitted;
    });
  }

  // ─── Approve (PENDING → APPROVED) — idempotent ─────────
  async approve(
    user: JwtPayload,
    updateId: string,
    idempotencyKey: string,
    req: Request,
  ) {
    // Idempotency: approval moves money (progress %, completion-based payments).
    // A double-click must NOT increment phase.progress twice.
    const fingerprintBody = { updateId, action: 'approve' };
    const cached = await this.idempotency.lookup(
      user.companyId,
      idempotencyKey,
      fingerprintBody,
    );
    if (cached) return cached.body;

    const update = await this.prisma.update.findFirst({
      where: { id: updateId, ...this.prisma.softDeleteFilter },
      include: {
        phase: {
          select: {
            projectId: true,
            project: { select: { companyId: true } },
          },
        },
      },
    });

    if (!update) throw new NotFoundException('التحديث غير موجود');
    if (update.phase.project.companyId !== user.companyId) {
      throw new NotFoundException('التحديث غير موجود');
    }
    if (update.status !== 'PENDING') {
      throw new BadRequestException('يمكن اعتماد التحديثات المعلّقة فقط');
    }

    const approved = await this.prisma.runSerializable(
      async (tx) => {
        // CVE-UPD-008: re-read the status INSIDE the tx before mutating.
        // The pre-tx PENDING check above is a TOCTOU window: a concurrent
        // approve that committed first leaves Serializable unable to abort
        // us (no tx overlap in the staggered case), so without this guard
        // phase.progress would double-increment. forceCancel already had
        // this guard (CVE-UPD-005); approve was missing it.
        const fresh = await tx.update.findFirst({
          where: { id: updateId, ...this.prisma.softDeleteFilter },
          select: { id: true, status: true },
        });
        if (!fresh || fresh.status !== 'PENDING') {
          throw new ConflictException(
            'تم تغيير حالة التحديث أثناء المعالجة — أعد التحميل',
          );
        }

        const updated = await tx.update.update({
          where: { id: updateId },
          data: {
            status: 'APPROVED',
            reviewedBy: user.userId,
            reviewedAt: new Date(),
          },
        });

        // Increment phase progress, capped at 100
        await tx.phase.update({
          where: { id: update.phaseId },
          data: { progress: { increment: update.progressIncrement } },
        });
        await tx.phase.updateMany({
          where: { id: update.phaseId, progress: { gt: 100 } },
          data: { progress: 100 },
        });

        // Recalc parent project progress INSIDE the transaction (C28).
        // Previously this ran after commit, allowing a stale-state window
        // if the process crashed between the two writes.
        await this.projectsService.recalculateProgressInTx(
          tx,
          update.phase.projectId,
        );

        await this.auditLog.logInTransaction(tx, {
          companyId: user.companyId,
          userId: user.userId,
          userRole: user.role,
          entityType: 'update',
          entityId: updateId,
          action: AuditAction.APPROVE,
          oldValues: { status: 'PENDING' },
          newValues: {
            status: 'APPROVED',
            progressIncrement: update.progressIncrement,
            reviewedAt: updated.reviewedAt?.toISOString(),
          },
          req,
        });

        // CVE-UPD-009: normalize the cached body ONCE and use it for both
        // the return value and the idempotency record. Caching the raw
        // Prisma entity (Decimal cost + Date fields) made the replay body
        // (JSON-coerced: cost as string, dates as ISO strings) differ in
        // shape from the first-call body. Now first-call and replay match.
        const responseBody = {
          ...updated,
          cost: updated.cost.toFixed(2),
          progressIncrement: updated.progressIncrement,
          workHours: Number(updated.workHours),
          submittedAt: updated.submittedAt?.toISOString() ?? null,
          reviewedAt: updated.reviewedAt?.toISOString() ?? null,
          lockedAt: updated.lockedAt?.toISOString() ?? null,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        };

        // Cache the response INSIDE the tx so the key + side effects
        // commit (or roll back) atomically. CVE-UPD-002: saving after
        // commit allowed a transient store failure to leave the key
        // uncached, letting a retry double-approve.
        await this.idempotency.saveInTransaction(
          tx,
          user.companyId,
          idempotencyKey,
          fingerprintBody,
          { statusCode: 200, body: responseBody },
        );

        return responseBody;
      },
    );

    return approved;
  }

  // ─── Reject (PENDING → REJECTED) ───────────────────────
  async reject(
    user: JwtPayload,
    updateId: string,
    dto: RejectUpdateDto,
    req: Request,
  ) {
    const update = await this.prisma.update.findFirst({
      where: { id: updateId, ...this.prisma.softDeleteFilter },
      include: {
        phase: { select: { project: { select: { companyId: true } } } },
      },
    });

    if (!update) throw new NotFoundException('التحديث غير موجود');
    if (update.phase.project.companyId !== user.companyId) {
      throw new NotFoundException('التحديث غير موجود');
    }
    if (update.status !== 'PENDING') {
      throw new BadRequestException('يمكن رفض التحديثات المعلّقة فقط');
    }

    return this.prisma.$transaction(async (tx) => {
      const rejected = await tx.update.update({
        where: { id: updateId },
        data: {
          status: 'REJECTED',
          rejectionReason: dto.reason,
          reviewedBy: user.userId,
          reviewedAt: new Date(),
        },
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: user.companyId,
        userId: user.userId,
        userRole: user.role,
        entityType: 'update',
        entityId: updateId,
        action: AuditAction.REJECT,
        oldValues: { status: 'PENDING' },
        newValues: { status: 'REJECTED' },
        reason: dto.reason,
        req,
      });

      return rejected;
    });
  }

  // ─── Force Cancel (APPROVED → FORCE_CANCELLED) — idempotent ──
  async forceCancel(
    user: JwtPayload,
    updateId: string,
    dto: ForceCancelDto,
    idempotencyKey: string,
    req: Request,
  ) {
    // Force-cancel can create a SUNK_COST payment AND reverse progress.
    // A retry on a transient client-side network error must not double-reverse.
    const fingerprintBody = {
      updateId,
      action: 'force_cancel',
      reason: dto.reason,
    };
    const cached = await this.idempotency.lookup(
      user.companyId,
      idempotencyKey,
      fingerprintBody,
    );
    if (cached) return cached.body;

    // Pre-tx read: fast-fail on existence / tenant / non-APPROVED status.
    // The in-tx re-read below is the authoritative source for the actual
    // mutation (CVE-UPD-005) — a concurrent editApproved could change
    // cost or progressIncrement between this read and the tx body.
    const preUpdate = await this.prisma.update.findFirst({
      where: { id: updateId, ...this.prisma.softDeleteFilter },
      include: {
        phase: {
          select: {
            projectId: true,
            project: { select: { companyId: true } },
          },
        },
      },
    });

    if (!preUpdate) throw new NotFoundException('التحديث غير موجود');
    if (preUpdate.phase.project.companyId !== user.companyId) {
      throw new NotFoundException('التحديث غير موجود');
    }
    if (preUpdate.status !== 'APPROVED') {
      throw new BadRequestException(
        'الإلغاء القسري متاح للتحديثات المعتمدة فقط',
      );
    }

    const responseBody = {
      message: 'تم الإلغاء القسري — تم تسجيل التكلفة الغارقة',
    };

    await this.prisma.runSerializable(
      async (tx) => {
        // CVE-UPD-005: re-read inside the tx with Serializable isolation
        // so cost / progressIncrement / status reflect the committed
        // state at this moment. A concurrent editApproved that ran
        // between the pre-read and this tx would either have committed
        // (we see new values) or be aborted by Postgres on commit.
        const update = await tx.update.findFirst({
          where: { id: updateId, ...this.prisma.softDeleteFilter },
          select: {
            id: true,
            title: true,
            phaseId: true,
            status: true,
            cost: true,
            progressIncrement: true,
            phase: { select: { projectId: true } },
          },
        });

        if (!update || update.status !== 'APPROVED') {
          // Someone else mutated the row out from under us — bail and
          // let the client refresh + retry instead of force-cancelling
          // an unexpected state.
          throw new ConflictException(
            'تم تعديل حالة التحديث أثناء المعالجة — أعد المحاولة',
          );
        }

        const cost = new Decimal(update.cost ?? 0);

        // 1. Mark the update as FORCE_CANCELLED
        await tx.update.update({
          where: { id: updateId },
          data: {
            status: 'FORCE_CANCELLED',
            forceCancelReason: dto.reason,
            forceCancelledBy: user.userId,
          },
        });

        // 2. Reverse the progress increment (floor at 0)
        await tx.phase.update({
          where: { id: update.phaseId },
          data: { progress: { decrement: update.progressIncrement } },
        });
        await tx.phase.updateMany({
          where: { id: update.phaseId, progress: { lt: 0 } },
          data: { progress: 0 },
        });

        // 3. If the cancelled update had a cost, record it as SUNK_COST
        if (cost.greaterThan(0)) {
          const sunk = await tx.payment.create({
            data: {
              projectId: update.phase.projectId,
              amount: cost,
              type: 'SUNK_COST',
              method: 'OTHER',
              description: `تكلفة غارقة من تحديث ملغي: ${update.title}`,
              date: new Date(),
              recordedBy: user.userId,
            },
          });

          await this.auditLog.logInTransaction(tx, {
            companyId: user.companyId,
            userId: user.userId,
            userRole: user.role,
            entityType: 'payment',
            entityId: sunk.id,
            action: AuditAction.CREATE,
            oldValues: null,
            newValues: {
              amount: cost.toFixed(2),
              type: 'SUNK_COST',
              reversedUpdateId: updateId,
            },
            reason: dto.reason,
            req,
          });
        }

        // 4. Audit the FORCE_CANCEL itself
        await this.auditLog.logInTransaction(tx, {
          companyId: user.companyId,
          userId: user.userId,
          userRole: user.role,
          entityType: 'update',
          entityId: updateId,
          action: AuditAction.FORCE_CANCEL,
          oldValues: { status: 'APPROVED', cost: cost.toFixed(2) },
          newValues: { status: 'FORCE_CANCELLED' },
          reason: dto.reason,
          req,
        });

        // 5. Recalc project progress INSIDE the same tx (C28).
        await this.projectsService.recalculateProgressInTx(
          tx,
          update.phase.projectId,
        );

        // 6. Cache the response INSIDE the tx so the key + side effects
        // (status flip, progress reversal, SUNK_COST payment, audits)
        // commit or roll back atomically. CVE-UPD-002.
        await this.idempotency.saveInTransaction(
          tx,
          user.companyId,
          idempotencyKey,
          fingerprintBody,
          { statusCode: 200, body: responseBody },
        );
      },
    );

    return responseBody;
  }

  // ─── Edit Approved (within 24h window) ─────────────────
  async editApproved(
    user: JwtPayload,
    updateId: string,
    dto: EditApprovedDto,
    req: Request,
  ) {
    const update = await this.prisma.update.findFirst({
      where: { id: updateId, ...this.prisma.softDeleteFilter },
      include: {
        phase: { select: { project: { select: { companyId: true } } } },
      },
    });

    if (!update) throw new NotFoundException('التحديث غير موجود');
    if (update.phase.project.companyId !== user.companyId) {
      throw new NotFoundException('التحديث غير موجود');
    }
    if (update.status !== 'APPROVED') {
      throw new BadRequestException('يمكن تعديل التحديثات المعتمدة فقط');
    }
    if (update.isLocked) {
      throw new ForbiddenException('التحديث مقفل — انتهت فترة التعديل (24 ساعة)');
    }

    const approvedAt = update.reviewedAt?.getTime() ?? 0;
    if (Date.now() - approvedAt > LOCK_WINDOW_MS) {
      // Auto-lock + reject the edit
      await this.prisma.update.update({
        where: { id: updateId },
        data: { isLocked: true, lockedAt: new Date() },
      });
      throw new ForbiddenException(
        'التحديث مقفل — انتهت فترة التعديل (24 ساعة)',
      );
    }

    return this.prisma.runSerializable(
      async (tx) => {
        // Snapshot the pre-edit state into UpdateVersion (immutable history).
        // CVE-UPD-007: Serializable isolation + the new
        // (updateId, versionNumber) unique constraint means two parallel
        // edits can't both insert versionNumber = N+1 — Postgres aborts
        // the second tx so the client retries with a fresh count.
        const versionCount = await tx.updateVersion.count({
          where: { updateId },
        });
        await tx.updateVersion.create({
          data: {
            updateId,
            versionNumber: versionCount + 1,
            // Snapshot captures the money-moving fields too because we
            // immortalize what was APPROVED, even though D3=A locks
            // those fields against post-approval edits.
            snapshot: {
              title: update.title,
              description: update.description,
              workDone: update.workDone,
              workRemaining: update.workRemaining,
              workersCount: update.workersCount,
              workHours: Number(update.workHours),
              materialsUsed: update.materialsUsed as Prisma.InputJsonValue,
              cost: update.cost.toFixed(2),
              progressIncrement: update.progressIncrement,
            },
            changedBy: user.userId,
            changeReason: dto.changeReason,
          },
        });

        // D3=A (Session 2026-05-30): money-moving fields (cost,
        // progressIncrement, materialsUsed) are LOCKED after approval.
        // To change any of them, use force-cancel + create a fresh update.
        // The DTO no longer accepts those fields, but we keep the
        // mutation list narrow here as a second line of defence.
        const edited = await tx.update.update({
          where: { id: updateId },
          data: {
            title: dto.title ?? undefined,
            description: dto.description ?? undefined,
            workDone: dto.workDone ?? undefined,
            workRemaining: dto.workRemaining ?? undefined,
            workersCount: dto.workersCount ?? undefined,
            workHours: dto.workHours ?? undefined,
          },
        });

        await this.auditLog.logInTransaction(tx, {
          companyId: user.companyId,
          userId: user.userId,
          userRole: user.role,
          entityType: 'update',
          entityId: updateId,
          action: AuditAction.UPDATE,
          oldValues: {
            title: update.title,
            description: update.description,
            workDone: update.workDone,
            workRemaining: update.workRemaining,
            workersCount: update.workersCount,
            workHours: Number(update.workHours),
          },
          newValues: { ...dto } as Record<string, unknown>,
          reason: dto.changeReason,
          req,
        });

        return edited;
      },
    );
  }

  // ─── Version History ───────────────────────────────────
  async getVersions(user: JwtPayload, updateId: string) {
    await this.findOne(user, updateId); // ownership + visibility check

    return this.prisma.updateVersion.findMany({
      where: { updateId },
      orderBy: { versionNumber: 'desc' },
      include: {
        changer: { select: { id: true, name: true, role: true } },
      },
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Helpers
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  private async getPhaseWithAccess(user: JwtPayload, phaseId: string) {
    const phase = await this.prisma.phase.findFirst({
      where: { id: phaseId, ...this.prisma.softDeleteFilter },
      include: { project: { select: { id: true, companyId: true } } },
    });

    if (!phase) throw new NotFoundException('المرحلة غير موجودة');
    if (phase.project.companyId !== user.companyId) {
      throw new NotFoundException('المرحلة غير موجودة');
    }

    await this.projectsService.ensureProjectAccess(user, phase.projectId);
    return phase;
  }

  /**
   * Compute the [start, end) UTC instants for the *calendar day* in the
   * given IANA timezone. Used by the duplicate-update guard so users in
   * Cairo don't get caught by the UTC midnight rollover.
   *
   * Implementation note: we lean on `Intl.DateTimeFormat` instead of pulling
   * in date-fns-tz. It's the same accuracy with no dependency.
   */
  private computeDayBounds(
    now: Date,
    timezone: string,
  ): { dayStart: Date; dayEnd: Date } {
    // BUG-UPD-012 (tester-found, Session 2026-05-30): the invalid-tz
    // fallback must cover BOTH formatters. Previously only this first
    // formatToParts fell back to UTC while the original (invalid) `timezone`
    // was still passed to toUtcFromLocal below — whose own DateTimeFormat
    // then threw RangeError, turning an invalid Company.timezone into a 500
    // on create instead of a clean UTC fallback. Track an effectiveTz and
    // use it for the offset conversion too.
    let effectiveTz = timezone;
    let parts: Intl.DateTimeFormatPart[];
    try {
      parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(now);
    } catch {
      // Invalid timezone string — fall back to UTC. Surfaces in tests; in
      // prod, the Company.timezone column should be IANA-validated on write.
      this.logger.warn(`Invalid timezone "${timezone}" — falling back to UTC`);
      effectiveTz = 'UTC';
      parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(now);
    }

    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? '00';
    const isoDate = `${get('year')}-${get('month')}-${get('day')}`;

    // Build the day-start and day-end instants by anchoring at the local
    // midnight in `effectiveTz` and converting back to UTC. We use the
    // formatToParts of a known instant to derive the offset.
    const dayStart = this.toUtcFromLocal(isoDate, '00:00:00', effectiveTz);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    return { dayStart, dayEnd };
  }

  /**
   * Convert "YYYY-MM-DD" + "HH:mm:ss" interpreted in `timezone` to a UTC Date.
   * Iterative offset adjustment — accurate even across DST boundaries.
   */
  private toUtcFromLocal(
    dateIso: string,
    timeIso: string,
    timezone: string,
  ): Date {
    // First-pass guess assuming the local string == UTC string
    const naive = new Date(`${dateIso}T${timeIso}Z`);
    // Compute the offset between this UTC instant and the same wall clock
    // in the target zone, then subtract to align.
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const wall = formatter.formatToParts(naive).reduce<Record<string, string>>(
      (acc, p) => {
        if (p.type !== 'literal') acc[p.type] = p.value;
        return acc;
      },
      {},
    );
    const reconstructed = Date.UTC(
      Number(wall.year),
      Number(wall.month) - 1,
      Number(wall.day),
      Number(wall.hour) === 24 ? 0 : Number(wall.hour),
      Number(wall.minute),
      Number(wall.second),
    );
    const offsetMs = reconstructed - naive.getTime();
    return new Date(naive.getTime() - offsetMs);
  }

  private async getOwnedUpdate(user: JwtPayload, updateId: string) {
    const update = await this.prisma.update.findFirst({
      where: { id: updateId, ...this.prisma.softDeleteFilter },
      include: {
        phase: {
          select: {
            projectId: true,
            project: { select: { companyId: true } },
          },
        },
      },
    });

    if (!update) throw new NotFoundException('التحديث غير موجود');
    if (update.phase.project.companyId !== user.companyId) {
      throw new NotFoundException('التحديث غير موجود');
    }
    if (update.submittedBy !== user.userId) {
      // BUG-UPD-011: 403 here used to reveal that the update existed
      // under a different submitter — same enumeration risk as
      // CVE-UPD-006. Treat the resource as not-found.
      throw new NotFoundException('التحديث غير موجود');
    }

    return update;
  }
}
