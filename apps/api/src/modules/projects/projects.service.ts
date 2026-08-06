// ============================================
// 📋 Projects Service — Enterprise Business Logic
// Role-based visibility + state machine + progress calc
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
import { TierLimitsService } from '../companies/tier-limits.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  ChangeProjectStatusDto,
  AssignMemberDto,
  ListProjectsQueryDto,
} from './dto';
import { JwtPayload } from '../../common/decorators';
import { AuditAction, Prisma, ProjectStatus, ProjectType, ProjectRole } from '@prisma/client';
import { Request } from 'express';

/** Valid status transitions */
const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
  ON_HOLD: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED: [], // Terminal state
  CANCELLED: [], // Terminal state
};

/** Safe project fields for API response */
const PROJECT_SELECT = {
  id: true,
  name: true,
  description: true,
  location: true,
  type: true,
  status: true,
  startDate: true,
  expectedEndDate: true,
  actualEndDate: true,
  totalBudget: true,
  overallProgress: true,
  dailyUpdateDeadline: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true, email: true, avatar: true } },
} satisfies Prisma.ProjectSelect;

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly tierLimits: TierLimitsService,
  ) {}

  // ─── List Projects (role-based visibility) ──
  async findAll(user: JwtPayload, query: ListProjectsQueryDto) {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = query;

    const where: Prisma.ProjectWhereInput = {
      companyId: user.companyId,
      ...this.prisma.softDeleteFilter,
    };

    if (query.status) where.status = query.status as ProjectStatus;
    if (query.type) where.type = query.type as ProjectType;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { location: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Role-based visibility
    if (user.role === 'CLIENT') {
      where.clientId = user.userId;
    } else if (!['SUPER_ADMIN', 'PROJECT_MANAGER'].includes(user.role)) {
      // Engineers, Supervisors, Accountants, Workers → only assigned projects
      where.assignments = {
        some: { userId: user.userId, removedAt: null },
      };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        select: {
          ...PROJECT_SELECT,
          _count: { select: { phases: true, assignments: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.project.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Get Single Project ────────────────────
  async findOne(user: JwtPayload, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        companyId: user.companyId,
        ...this.prisma.softDeleteFilter,
      },
      select: {
        ...PROJECT_SELECT,
        phases: {
          where: this.prisma.softDeleteFilter,
          orderBy: { order: 'asc' },
          select: {
            id: true, name: true, order: true, weight: true,
            status: true, progress: true, budget: true, actualCost: true,
          },
        },
        assignments: {
          where: { removedAt: null },
          select: {
            id: true,
            roleInProject: true,
            isRequiredDailyUpdate: true,
            assignedAt: true,
            user: { select: { id: true, name: true, email: true, role: true, avatar: true } },
          },
        },
        _count: { select: { payments: true, chatRooms: true } },
      },
    });

    if (!project) throw new NotFoundException('المشروع غير موجود');

    // Visibility check
    await this.ensureProjectAccess(user, project.id);

    return project;
  }

  // ─── Create Project ────────────────────────
  async create(user: JwtPayload, dto: CreateProjectDto, req: Request) {
    // Plan limit gate (Q7 tier limits) — Starter 3, Pro 15, Enterprise ∞.
    // CANCELLED projects don't consume slots (see TierLimitsService).
    await this.tierLimits.assertCanAddProject(user.companyId);

    // Validate client exists and belongs to company
    const client = await this.prisma.user.findFirst({
      where: {
        id: dto.clientId,
        companyId: user.companyId,
        role: 'CLIENT',
        ...this.prisma.softDeleteFilter,
      },
    });

    if (!client) {
      throw new BadRequestException('العميل غير موجود أو ليس بدور عميل');
    }

    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          companyId: user.companyId,
          clientId: dto.clientId,
          name: dto.name,
          description: dto.description,
          location: dto.location,
          type: (dto.type as ProjectType) ?? 'FULL_FINISHING',
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          expectedEndDate: dto.expectedEndDate ? new Date(dto.expectedEndDate) : undefined,
          totalBudget: dto.totalBudget ?? 0,
          dailyUpdateDeadline: dto.dailyUpdateDeadline ?? '17:00',
        },
        select: PROJECT_SELECT,
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: user.companyId,
        userId: user.userId,
        userRole: user.role,
        entityType: 'project',
        entityId: project.id,
        action: AuditAction.CREATE,
        oldValues: null,
        newValues: { name: dto.name, clientId: dto.clientId, type: project.type },
        req,
      });

      return project;
    });
  }

  // ─── Update Project ────────────────────────
  async update(user: JwtPayload, projectId: string, dto: UpdateProjectDto, req: Request) {
    const existing = await this.getOwnedProject(user.companyId, projectId);

    // Whitelist updatable fields — DO NOT pass dto as data directly
    // (mass assignment / unintended status mutation).
    const data: Prisma.ProjectUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.type !== undefined) data.type = dto.type as ProjectType;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.expectedEndDate !== undefined) data.expectedEndDate = new Date(dto.expectedEndDate);
    if (dto.totalBudget !== undefined) data.totalBudget = dto.totalBudget;
    if (dto.dailyUpdateDeadline !== undefined) data.dailyUpdateDeadline = dto.dailyUpdateDeadline;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id: projectId },
        data,
        select: PROJECT_SELECT,
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: user.companyId,
        userId: user.userId,
        userRole: user.role,
        entityType: 'project',
        entityId: projectId,
        action: AuditAction.UPDATE,
        oldValues: { name: existing.name, status: existing.status },
        newValues: dto as Record<string, unknown>,
        req,
      });

      return updated;
    });
  }

  // ─── Change Status (State Machine) ─────────
  async changeStatus(
    user: JwtPayload,
    projectId: string,
    dto: ChangeProjectStatusDto,
    req: Request,
  ) {
    const project = await this.getOwnedProject(user.companyId, projectId);

    const allowed = STATUS_TRANSITIONS[project.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `لا يمكن الانتقال من "${project.status}" إلى "${dto.status}". الانتقالات المسموحة: ${allowed.join(', ') || 'لا يوجد'}`,
      );
    }

    // Reason mandatory for negative transitions (skill 04 + 07)
    const NEGATIVE_TRANSITIONS = ['ON_HOLD', 'CANCELLED'];
    if (NEGATIVE_TRANSITIONS.includes(dto.status)) {
      if (!dto.reason || dto.reason.trim().length < 20) {
        throw new BadRequestException(
          'سبب التغيير مطلوب (20 حرف على الأقل) لهذه العملية',
        );
      }
    }

    const data: Prisma.ProjectUpdateInput = {
      status: dto.status as ProjectStatus,
    };
    if (dto.status === 'COMPLETED') {
      data.actualEndDate = new Date();
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id: projectId },
        data,
        select: PROJECT_SELECT,
      });

      // Map the transition to an appropriate audit action — UPDATE for
      // normal moves, DELETE-like for CANCELLED (terminal negative).
      const auditAction =
        dto.status === 'CANCELLED'
          ? AuditAction.DELETE
          : AuditAction.UPDATE;

      // Reason is REQUIRED by the audit service for DELETE-class actions,
      // so we always pass it for negative transitions.
      await this.auditLog.logInTransaction(tx, {
        companyId: user.companyId,
        userId: user.userId,
        userRole: user.role,
        entityType: 'project',
        entityId: projectId,
        action: auditAction,
        oldValues: { status: project.status },
        newValues: { status: dto.status },
        reason: dto.reason,
        req,
      });

      return updated;
    });
  }

  // ─── Assign Member ─────────────────────────
  async assignMember(
    user: JwtPayload,
    projectId: string,
    dto: AssignMemberDto,
    req: Request,
  ) {
    await this.getOwnedProject(user.companyId, projectId);

    // Restricted to staff roles — CLIENT is the customer; PROJECT_MANAGER
    // and SUPER_ADMIN already see all projects via the visibility filter
    // so they don't need explicit assignments.
    const member = await this.prisma.user.findFirst({
      where: {
        id: dto.userId,
        companyId: user.companyId,
        role: { in: ['SITE_ENGINEER', 'SUPERVISOR', 'ACCOUNTANT', 'WORKER'] },
        ...this.prisma.softDeleteFilter,
      },
    });
    if (!member) throw new NotFoundException('الموظف غير موجود');

    // Check not already assigned
    const existing = await this.prisma.projectAssignment.findUnique({
      where: { projectId_userId: { projectId, userId: dto.userId } },
    });

    if (existing && !existing.removedAt) {
      throw new ConflictException('الموظف مُعيّن بالفعل على هذا المشروع');
    }

    return this.prisma.$transaction(async (tx) => {
      // Upsert — if previously removed, reassign
      const assignment = existing
        ? await tx.projectAssignment.update({
            where: { id: existing.id },
            data: {
              roleInProject: dto.roleInProject as ProjectRole,
              isRequiredDailyUpdate: dto.isRequiredDailyUpdate ?? false,
              removedAt: null,
              assignedAt: new Date(),
            },
          })
        : await tx.projectAssignment.create({
            data: {
              projectId,
              userId: dto.userId,
              roleInProject: dto.roleInProject as ProjectRole,
              isRequiredDailyUpdate: dto.isRequiredDailyUpdate ?? false,
            },
          });

      await this.auditLog.logInTransaction(tx, {
        companyId: user.companyId,
        userId: user.userId,
        userRole: user.role,
        entityType: 'project_assignment',
        entityId: assignment.id,
        action: AuditAction.CREATE,
        oldValues: existing ? { removedAt: existing.removedAt } : null,
        newValues: { projectId, memberId: dto.userId, role: dto.roleInProject },
        req,
      });

      return assignment;
    });
  }

  // ─── Remove Member ─────────────────────────
  async removeMember(
    user: JwtPayload,
    projectId: string,
    targetUserId: string,
    reason: string,
    req: Request,
  ) {
    await this.getOwnedProject(user.companyId, projectId);

    if (!reason || reason.trim().length < 20) {
      throw new BadRequestException(
        'سبب إزالة الموظف مطلوب (20 حرف على الأقل)',
      );
    }

    const assignment = await this.prisma.projectAssignment.findUnique({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    });

    if (!assignment || assignment.removedAt) {
      throw new NotFoundException('الموظف غير معيّن على هذا المشروع');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.projectAssignment.update({
        where: { id: assignment.id },
        data: { removedAt: new Date() },
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: user.companyId,
        userId: user.userId,
        userRole: user.role,
        entityType: 'project_assignment',
        entityId: assignment.id,
        action: AuditAction.DELETE,
        oldValues: {
          projectId,
          memberId: targetUserId,
          role: assignment.roleInProject,
        },
        newValues: null,
        reason,
        req,
      });

      return { message: 'تم إزالة الموظف من المشروع' };
    });
  }

  // ─── Soft Delete Project ───────────────────
  async softDelete(
    user: JwtPayload,
    projectId: string,
    reason: string,
    req: Request,
  ) {
    const project = await this.getOwnedProject(user.companyId, projectId);

    if (!reason || reason.trim().length < 20) {
      throw new BadRequestException(
        'سبب حذف المشروع مطلوب (20 حرف على الأقل)',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: projectId },
        data: { deletedAt: new Date() },
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: user.companyId,
        userId: user.userId,
        userRole: user.role,
        entityType: 'project',
        entityId: projectId,
        action: AuditAction.DELETE,
        oldValues: {
          name: project.name,
          status: project.status,
          totalBudget: project.totalBudget.toFixed(2),
        },
        newValues: null,
        reason,
        req,
      });

      return { message: 'تم حذف المشروع بنجاح' };
    });
  }

  // ─── Recalculate Overall Progress (in-tx only) ─────
  /**
   * Recalculate the project's overall progress (weighted avg of phase
   * progress by phase weight) and write it back, inside the caller's
   * transaction client.
   *
   * Why "InTx" (C28): previously a non-tx variant ran AFTER the parent
   * `approve`/`forceCancel` transaction committed, leaving a stale-state
   * window if the process crashed between the two writes. The signature
   * is now restricted to `Prisma.TransactionClient` so the "outside a tx"
   * mistake is impossible at compile time — no PrismaService overload.
   *
   * The Serializable isolation set on the parent transaction guarantees no
   * race with concurrent phase updates.
   */
  async recalculateProgressInTx(
    tx: Prisma.TransactionClient,
    projectId: string,
  ): Promise<number> {
    const phases = await tx.phase.findMany({
      where: { projectId, deletedAt: null },
      select: { progress: true, weight: true },
    });

    if (phases.length === 0) {
      await tx.project.update({
        where: { id: projectId },
        data: { overallProgress: 0 },
      });
      return 0;
    }

    const totalWeight = phases.reduce((sum, p) => sum + p.weight, 0);
    if (totalWeight === 0) {
      await tx.project.update({
        where: { id: projectId },
        data: { overallProgress: 0 },
      });
      return 0;
    }

    const weightedProgress = phases.reduce(
      (sum, p) => sum + p.progress * p.weight,
      0,
    );

    const progress = Math.min(100, Math.round(weightedProgress / totalWeight));

    await tx.project.update({
      where: { id: projectId },
      data: { overallProgress: progress },
    });

    return progress;
  }

  // ─── Helpers ───────────────────────────────

  /** Verify project belongs to company + not deleted. */
  private async getOwnedProject(companyId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId, ...this.prisma.softDeleteFilter },
    });
    if (!project) throw new NotFoundException('المشروع غير موجود');
    return project;
  }

  /**
   * Verify user has access to this project based on role.
   *
   * Tenant + soft-delete gate runs FIRST for every role, including admins.
   * Previously (pre-CVE-PROJ-001) admins short-circuited before any DB
   * lookup, which allowed a SUPER_ADMIN/PROJECT_MANAGER from company A to
   * pass any company B projectId through this check — downstream callers
   * that trusted the contract (e.g. chat.findRooms) then returned cross-
   * tenant data.
   *
   * Always throw `ForbiddenException` on failure (not `NotFoundException`)
   * because the resource may exist in another tenant; the existence/non-
   * existence distinction itself is privileged information.
   */
  async ensureProjectAccess(user: JwtPayload, projectId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        companyId: user.companyId,
        ...this.prisma.softDeleteFilter,
      },
      select: { id: true, clientId: true },
    });
    if (!project) throw new ForbiddenException('ليس لديك صلاحية الوصول لهذا المشروع');

    // ACCOUNTANT is trusted company-wide for financial oversight (S7): the
    // finance system (settings/summary/BOQ) requires the accountant to read
    // any project in their company without an explicit assignment. This gate
    // is shared by payments/comments/updates/chat/media — the widening is
    // company-scoped only (companyId already enforced above), never
    // cross-tenant. See S7 00-plan.md المرحلة 2 (blast-radius documented).
    if (['SUPER_ADMIN', 'PROJECT_MANAGER', 'ACCOUNTANT'].includes(user.role))
      return;

    if (user.role === 'CLIENT') {
      if (project.clientId !== user.userId) {
        throw new ForbiddenException('ليس لديك صلاحية الوصول لهذا المشروع');
      }
      return;
    }

    // Other roles — must be assigned. The project lookup above already
    // confirmed companyId + not-deleted, so the assignment check is now
    // a pure role/membership gate.
    const assignment = await this.prisma.projectAssignment.findFirst({
      where: { projectId, userId: user.userId, removedAt: null },
    });
    if (!assignment) throw new ForbiddenException('ليس لديك صلاحية الوصول لهذا المشروع');
  }
}
