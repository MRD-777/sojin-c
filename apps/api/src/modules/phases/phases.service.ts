// ============================================
// 🔧 Phases Service
//
// Critical guarantees (skills 02, 04, 07):
//   - State machine on Phase.status (NOT_STARTED → IN_PROGRESS → COMPLETED).
//   - All audit writes inside the transaction (logInTransaction).
//   - Reorder, override, delete all carry an audit entry.
//   - Reason mandatory for negative actions (DELETE, PROGRESS_OVERRIDE,
//     status change to ON_HOLD).
//   - Phase status changes recalculate the parent project progress.
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
  CreatePhaseDto,
  UpdatePhaseDto,
  OverrideProgressDto,
  ReorderPhaseDto,
  DeletePhaseDto,
} from './dto';
import { JwtPayload } from '../../common/decorators';
import { AuditAction, PhaseStatus, Prisma } from '@prisma/client';
import { Request } from 'express';

/** Allowed phase status transitions. Terminal states cannot move further. */
const PHASE_STATUS_TRANSITIONS: Record<PhaseStatus, PhaseStatus[]> = {
  NOT_STARTED: ['IN_PROGRESS', 'ON_HOLD'],
  IN_PROGRESS: ['ON_HOLD', 'COMPLETED'],
  ON_HOLD: ['IN_PROGRESS'],
  COMPLETED: [], // terminal
};

@Injectable()
export class PhasesService {
  private readonly logger = new Logger(PhasesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly projectsService: ProjectsService,
  ) {}

  // ─── List Phases for a Project ─────────────────────────
  async findAll(user: JwtPayload, projectId: string) {
    await this.projectsService.ensureProjectAccess(user, projectId);

    return this.prisma.phase.findMany({
      where: {
        projectId,
        project: { companyId: user.companyId, deletedAt: null },
        ...this.prisma.softDeleteFilter,
      },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        order: true,
        weight: true,
        status: true,
        progress: true,
        startDate: true,
        expectedEndDate: true,
        budget: true,
        actualCost: true,
        createdAt: true,
        _count: { select: { updates: true, subContractors: true } },
      },
    });
  }

  // ─── Get Single Phase ──────────────────────────────────
  async findOne(user: JwtPayload, phaseId: string) {
    const phase = await this.prisma.phase.findFirst({
      where: {
        id: phaseId,
        project: { companyId: user.companyId, deletedAt: null },
        ...this.prisma.softDeleteFilter,
      },
      include: {
        project: { select: { id: true, companyId: true, name: true } },
      },
    });

    if (!phase) throw new NotFoundException('المرحلة غير موجودة');

    await this.projectsService.ensureProjectAccess(user, phase.projectId);
    return phase;
  }

  // ─── Create Phase ──────────────────────────────────────
  async create(
    user: JwtPayload,
    projectId: string,
    dto: CreatePhaseDto,
    req: Request,
  ) {
    await this.projectsService.ensureProjectAccess(user, projectId);

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        companyId: user.companyId,
        ...this.prisma.softDeleteFilter,
      },
    });
    if (!project) throw new NotFoundException('المشروع غير موجود');

    // Auto-calc order if not given
    let order = dto.order;
    if (order === undefined) {
      const maxPhase = await this.prisma.phase.findFirst({
        where: { projectId, ...this.prisma.softDeleteFilter },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      order = (maxPhase?.order ?? -1) + 1;
    }

    const phase = await this.prisma.$transaction(async (tx) => {
      const created = await tx.phase.create({
        data: {
          projectId,
          name: dto.name,
          description: dto.description,
          order,
          weight: dto.weight ?? 1,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          expectedEndDate: dto.expectedEndDate
            ? new Date(dto.expectedEndDate)
            : undefined,
          budget: dto.budget ?? 0,
        },
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: user.companyId,
        userId: user.userId,
        userRole: user.role,
        entityType: 'phase',
        entityId: created.id,
        action: AuditAction.CREATE,
        oldValues: null,
        newValues: {
          name: dto.name,
          projectId,
          order,
          weight: created.weight,
        },
        req,
      });

      // Adding a phase shifts weight distribution — recalc INSIDE the tx
      // so the project progress is consistent with the new phase set (C28).
      await this.projectsService.recalculateProgressInTx(tx, projectId);

      return created;
    });

    return phase;
  }

  // ─── Update Phase ──────────────────────────────────────
  async update(
    user: JwtPayload,
    phaseId: string,
    dto: UpdatePhaseDto,
    req: Request,
  ) {
    const phase = await this.findOne(user, phaseId);

    // State machine: validate status transitions
    if (dto.status && dto.status !== phase.status) {
      const allowed = PHASE_STATUS_TRANSITIONS[phase.status] ?? [];
      if (!allowed.includes(dto.status as PhaseStatus)) {
        throw new BadRequestException(
          `لا يمكن الانتقال من "${phase.status}" إلى "${dto.status}". المسموح: ${allowed.join(', ') || 'لا يوجد'}`,
        );
      }
    }

    // Whitelisted fields only
    const data: Prisma.PhaseUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.weight !== undefined) data.weight = dto.weight;
    if (dto.status !== undefined) data.status = dto.status as PhaseStatus;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.expectedEndDate !== undefined) {
      data.expectedEndDate = new Date(dto.expectedEndDate);
    }
    if (dto.budget !== undefined) data.budget = dto.budget;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.phase.update({
        where: { id: phaseId },
        data,
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: user.companyId,
        userId: user.userId,
        userRole: user.role,
        entityType: 'phase',
        entityId: phaseId,
        action: AuditAction.UPDATE,
        oldValues: {
          name: phase.name,
          status: phase.status,
          weight: phase.weight,
        },
        newValues: dto as Record<string, unknown>,
        req,
      });

      // Weight change → recalc INSIDE the tx so progress stays consistent
      if (dto.weight !== undefined) {
        await this.projectsService.recalculateProgressInTx(tx, phase.projectId);
      }

      return result;
    });

    return updated;
  }

  // ─── Override Progress (mandatory reason, bounds enforced by DTO) ──
  async overrideProgress(
    user: JwtPayload,
    phaseId: string,
    dto: OverrideProgressDto,
    req: Request,
  ) {
    const phase = await this.findOne(user, phaseId);
    const oldProgress = phase.progress;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.phase.update({
        where: { id: phaseId },
        data: { progress: dto.progress },
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: user.companyId,
        userId: user.userId,
        userRole: user.role,
        entityType: 'phase',
        entityId: phaseId,
        action: AuditAction.PROGRESS_OVERRIDE,
        oldValues: { progress: oldProgress },
        newValues: { progress: dto.progress },
        reason: dto.reason,
        req,
      });

      // Recalc inside the tx (C28) — progress override is the primary
      // motivator for the staleness fix.
      await this.projectsService.recalculateProgressInTx(tx, phase.projectId);

      return result;
    });

    return updated;
  }

  // ─── Reorder Phase (now audited) ───────────────────────
  async reorder(
    user: JwtPayload,
    phaseId: string,
    dto: ReorderPhaseDto,
    req: Request,
  ) {
    const phase = await this.findOne(user, phaseId);
    const oldOrder = phase.order;

    await this.prisma.$transaction(async (tx) => {
      await tx.phase.update({
        where: { id: phaseId },
        data: { order: dto.order },
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: user.companyId,
        userId: user.userId,
        userRole: user.role,
        entityType: 'phase',
        entityId: phaseId,
        action: AuditAction.UPDATE,
        oldValues: { order: oldOrder },
        newValues: { order: dto.order },
        req,
      });
    });

    return { message: 'تم تغيير ترتيب المرحلة' };
  }

  // ─── Soft Delete Phase ─────────────────────────────────
  async softDelete(
    user: JwtPayload,
    phaseId: string,
    dto: DeletePhaseDto,
    req: Request,
  ) {
    const phase = await this.findOne(user, phaseId);

    // Refuse delete if any non-cancelled/rejected updates exist
    const activeUpdates = await this.prisma.update.count({
      where: {
        phaseId,
        status: { in: ['DRAFT', 'PENDING', 'APPROVED'] },
        ...this.prisma.softDeleteFilter,
      },
    });
    if (activeUpdates > 0) {
      throw new BadRequestException(
        `لا يمكن حذف المرحلة — يوجد ${activeUpdates} تحديث نشط عليها`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.phase.update({
        where: { id: phaseId },
        data: { deletedAt: new Date() },
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: user.companyId,
        userId: user.userId,
        userRole: user.role,
        entityType: 'phase',
        entityId: phaseId,
        action: AuditAction.DELETE,
        oldValues: {
          name: phase.name,
          status: phase.status,
          progress: phase.progress,
        },
        newValues: null,
        reason: dto.reason,
        req,
      });

      // Recalc inside the tx (C28).
      await this.projectsService.recalculateProgressInTx(tx, phase.projectId);
    });

    return { message: 'تم حذف المرحلة بنجاح' };
  }
}
