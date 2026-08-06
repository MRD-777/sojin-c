// ============================================
// 🏗️ Sub-Contractors Service
// Company-level subcontractor management + phase assignments
// ============================================
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { ProjectsService } from '../projects/projects.service';
import {
  CreateSubContractorDto,
  UpdateSubContractorDto,
  AssignToPhaseDto,
  UpdatePhaseAssignmentDto,
} from './dto';
import { JwtPayload } from '../../common/decorators';
import { AuditAction, SubContractorStatus } from '@prisma/client';
import { Request } from 'express';

@Injectable()
export class SubContractorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly projectsService: ProjectsService,
  ) {}

  // ─── List Company SubContractors ───────────
  async findAll(user: JwtPayload) {
    return this.prisma.subContractor.findMany({
      where: { companyId: user.companyId, ...this.prisma.softDeleteFilter },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        specialty: true,
        phone: true,
        email: true,
        rating: true,
        totalProjects: true,
        notes: true,
        createdAt: true,
        _count: { select: { phases: true } },
      },
    });
  }

  // ─── Get Single ────────────────────────────
  async findOne(user: JwtPayload, subId: string) {
    const sub = await this.prisma.subContractor.findFirst({
      where: { id: subId, companyId: user.companyId, ...this.prisma.softDeleteFilter },
      include: {
        phases: {
          include: {
            phase: {
              select: { id: true, name: true, projectId: true, project: { select: { name: true } } },
            },
          },
        },
      },
    });

    if (!sub) throw new NotFoundException('مقاول الباطن غير موجود');
    return sub;
  }

  // ─── Create SubContractor ──────────────────
  async create(user: JwtPayload, dto: CreateSubContractorDto, req: Request) {
    const sub = await this.prisma.subContractor.create({
      data: {
        companyId: user.companyId,
        name: dto.name,
        specialty: dto.specialty,
        phone: dto.phone,
        email: dto.email,
        notes: dto.notes,
      },
    });

    await this.auditLog.log({
      companyId: user.companyId,
      userId: user.userId,
      userRole: user.role,
      entityType: 'sub_contractor',
      entityId: sub.id,
      action: AuditAction.CREATE,
      newValues: { name: dto.name, specialty: dto.specialty },
      req,
    });

    return sub;
  }

  // ─── Update SubContractor ──────────────────
  async update(user: JwtPayload, subId: string, dto: UpdateSubContractorDto, req: Request) {
    const existing = await this.findOne(user, subId);

    const updated = await this.prisma.subContractor.update({
      where: { id: subId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.specialty !== undefined && { specialty: dto.specialty }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });

    await this.auditLog.log({
      companyId: user.companyId,
      userId: user.userId,
      userRole: user.role,
      entityType: 'sub_contractor',
      entityId: subId,
      action: AuditAction.UPDATE,
      oldValues: { name: existing.name },
      newValues: dto as unknown as Record<string, unknown>,
      req,
    });

    return updated;
  }

  // ─── Assign SubContractor to Phase ─────────
  async assignToPhase(
    user: JwtPayload,
    phaseId: string,
    dto: AssignToPhaseDto,
    req: Request,
  ) {
    // Verify phase access
    const phase = await this.prisma.phase.findFirst({
      where: { id: phaseId, ...this.prisma.softDeleteFilter },
      include: { project: { select: { id: true, companyId: true } } },
    });
    if (!phase) throw new NotFoundException('المرحلة غير موجودة');
    if (phase.project.companyId !== user.companyId) {
      throw new NotFoundException('المرحلة غير موجودة');
    }
    await this.projectsService.ensureProjectAccess(user, phase.projectId);

    // Verify subcontractor belongs to same company
    const sub = await this.findOne(user, dto.subContractorId);

    // Check not already assigned
    const existing = await this.prisma.phaseSubContractor.findUnique({
      where: {
        phaseId_subContractorId: { phaseId, subContractorId: dto.subContractorId },
      },
    });
    if (existing) {
      throw new ConflictException('مقاول الباطن مُعيّن بالفعل لهذه المرحلة');
    }

    const assignment = await this.prisma.$transaction(async (tx) => {
      const a = await tx.phaseSubContractor.create({
        data: {
          phaseId,
          subContractorId: dto.subContractorId,
          agreedCost: dto.agreedCost ?? 0,
        },
      });

      // Increment totalProjects on the subcontractor
      await tx.subContractor.update({
        where: { id: dto.subContractorId },
        data: { totalProjects: { increment: 1 } },
      });

      return a;
    });

    await this.auditLog.log({
      companyId: user.companyId,
      userId: user.userId,
      userRole: user.role,
      entityType: 'phase_sub_contractor',
      entityId: assignment.id,
      action: AuditAction.CREATE,
      newValues: { phaseId, subContractorName: sub.name, agreedCost: dto.agreedCost },
      req,
    });

    return assignment;
  }

  // ─── Update Phase Assignment ───────────────
  async updatePhaseAssignment(
    user: JwtPayload,
    assignmentId: string,
    dto: UpdatePhaseAssignmentDto,
    req: Request,
  ) {
    const assignment = await this.prisma.phaseSubContractor.findUnique({
      where: { id: assignmentId },
      include: {
        phase: { include: { project: { select: { companyId: true, id: true } } } },
      },
    });

    if (!assignment) throw new NotFoundException('التعيين غير موجود');
    if (assignment.phase.project.companyId !== user.companyId) {
      throw new NotFoundException('التعيين غير موجود');
    }

    const updated = await this.prisma.phaseSubContractor.update({
      where: { id: assignmentId },
      data: {
        ...(dto.agreedCost !== undefined && { agreedCost: dto.agreedCost }),
        ...(dto.actualCost !== undefined && { actualCost: dto.actualCost }),
        ...(dto.status !== undefined && { status: dto.status as SubContractorStatus }),
      },
    });

    await this.auditLog.log({
      companyId: user.companyId,
      userId: user.userId,
      userRole: user.role,
      entityType: 'phase_sub_contractor',
      entityId: assignmentId,
      action: AuditAction.UPDATE,
      oldValues: { status: assignment.status, agreedCost: Number(assignment.agreedCost) },
      newValues: dto as unknown as Record<string, unknown>,
      req,
    });

    return updated;
  }

  // ─── List SubContractors for Phase ─────────
  async findByPhase(user: JwtPayload, phaseId: string) {
    const phase = await this.prisma.phase.findFirst({
      where: { id: phaseId, ...this.prisma.softDeleteFilter },
      include: { project: { select: { companyId: true, id: true } } },
    });
    if (!phase) throw new NotFoundException('المرحلة غير موجودة');
    if (phase.project.companyId !== user.companyId) {
      throw new NotFoundException('المرحلة غير موجودة');
    }

    return this.prisma.phaseSubContractor.findMany({
      where: { phaseId },
      include: {
        subContractor: {
          select: { id: true, name: true, specialty: true, phone: true, rating: true },
        },
      },
    });
  }

  // ─── Soft Delete SubContractor ─────────────
  async softDelete(user: JwtPayload, subId: string, req: Request) {
    const sub = await this.findOne(user, subId);

    await this.prisma.subContractor.update({
      where: { id: subId },
      data: { deletedAt: new Date() },
    });

    await this.auditLog.log({
      companyId: user.companyId,
      userId: user.userId,
      userRole: user.role,
      entityType: 'sub_contractor',
      entityId: subId,
      action: AuditAction.DELETE,
      oldValues: { name: sub.name },
      req,
    });

    return { message: 'تم حذف مقاول الباطن بنجاح' };
  }
}
