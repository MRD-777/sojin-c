// ============================================
// 💬 Comments Service
// Threaded comments on updates — change/review request tracking
// ============================================
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateCommentDto, EditCommentDto, ResolveCommentDto } from './dto';
import { JwtPayload } from '../../common/decorators';
import { AuditAction, CommentType, CommentStatus } from '@prisma/client';
import { Request } from 'express';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly projectsService: ProjectsService,
  ) {}

  // ─── List Comments for Update ──────────────
  async findByUpdate(user: JwtPayload, updateId: string) {
    await this.verifyUpdateAccess(user, updateId);

    return this.prisma.comment.findMany({
      where: {
        updateId,
        parentId: null, // Top-level only
        ...this.prisma.softDeleteFilter,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        content: true,
        type: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, name: true, role: true, avatar: true } },
        replies: {
          where: this.prisma.softDeleteFilter,
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            content: true,
            type: true,
            status: true,
            createdAt: true,
            user: { select: { id: true, name: true, role: true, avatar: true } },
          },
        },
      },
    });
  }

  // ─── Create Comment ────────────────────────
  async create(
    user: JwtPayload,
    updateId: string,
    dto: CreateCommentDto,
    req: Request,
  ) {
    await this.verifyUpdateAccess(user, updateId);

    // If replying, verify parent exists and belongs to same update
    if (dto.parentId) {
      const parent = await this.prisma.comment.findFirst({
        where: {
          id: dto.parentId,
          updateId,
          parentId: null, // Can only reply to top-level
          ...this.prisma.softDeleteFilter,
        },
      });
      if (!parent) {
        throw new BadRequestException('التعليق الأصلي غير موجود أو لا يمكن الرد عليه');
      }
    }

    // Only admins/PMs can post REVIEW_REQUEST or CHANGE_REQUEST
    const commentType: CommentType = (dto.type as CommentType) ?? CommentType.COMMENT;
    if (
      commentType !== CommentType.COMMENT &&
      !['SUPER_ADMIN', 'PROJECT_MANAGER'].includes(user.role)
    ) {
      throw new ForbiddenException('طلبات المراجعة والتغيير مسموحة للمديرين فقط');
    }

    // Set initial status based on type
    const initialStatus =
      commentType === CommentType.COMMENT ? CommentStatus.RESOLVED : CommentStatus.OPEN;

    const comment = await this.prisma.comment.create({
      data: {
        updateId,
        userId: user.userId,
        content: dto.content,
        type: commentType,
        parentId: dto.parentId,
        status: initialStatus,
      },
      select: {
        id: true,
        content: true,
        type: true,
        status: true,
        createdAt: true,
        user: { select: { id: true, name: true, role: true, avatar: true } },
      },
    });

    await this.auditLog.log({
      companyId: user.companyId,
      userId: user.userId,
      userRole: user.role,
      entityType: 'comment',
      entityId: comment.id,
      action: AuditAction.CREATE,
      newValues: { updateId, type: commentType, hasParent: !!dto.parentId },
      req,
    });

    return comment;
  }

  // ─── Edit Own Comment ──────────────────────
  async edit(user: JwtPayload, commentId: string, dto: EditCommentDto, req: Request) {
    const comment = await this.getOwnedComment(user, commentId);

    // Can only edit within 30 minutes
    const thirtyMin = 30 * 60 * 1000;
    if (Date.now() - comment.createdAt.getTime() > thirtyMin) {
      throw new ForbiddenException('يمكن تعديل التعليق خلال 30 دقيقة فقط');
    }

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { content: dto.content },
      select: {
        id: true,
        content: true,
        type: true,
        status: true,
        updatedAt: true,
      },
    });

    await this.auditLog.log({
      companyId: user.companyId,
      userId: user.userId,
      userRole: user.role,
      entityType: 'comment',
      entityId: commentId,
      action: AuditAction.UPDATE,
      oldValues: { content: comment.content },
      newValues: { content: dto.content },
      req,
    });

    return updated;
  }

  // ─── Resolve / Reopen Request ──────────────
  async changeStatus(
    user: JwtPayload,
    commentId: string,
    dto: ResolveCommentDto,
    req: Request,
  ) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, ...this.prisma.softDeleteFilter },
      include: {
        update: {
          include: {
            phase: { select: { project: { select: { companyId: true } } } },
          },
        },
      },
    });

    if (!comment) throw new NotFoundException('التعليق غير موجود');
    if (comment.update.phase.project.companyId !== user.companyId) {
      throw new NotFoundException('التعليق غير موجود');
    }
    if (comment.type === CommentType.COMMENT) {
      throw new BadRequestException('يمكن تغيير حالة طلبات المراجعة والتغيير فقط');
    }

    const newStatus = dto.status as CommentStatus;
    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { status: newStatus },
    });

    await this.auditLog.log({
      companyId: user.companyId,
      userId: user.userId,
      userRole: user.role,
      entityType: 'comment',
      entityId: commentId,
      action: AuditAction.UPDATE,
      oldValues: { status: comment.status },
      newValues: { status: newStatus },
      req,
    });

    return updated;
  }

  // ─── Soft Delete Comment ───────────────────
  async softDelete(user: JwtPayload, commentId: string, req: Request) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, ...this.prisma.softDeleteFilter },
      include: {
        update: {
          include: {
            phase: { select: { project: { select: { companyId: true } } } },
          },
        },
      },
    });

    if (!comment) throw new NotFoundException('التعليق غير موجود');
    if (comment.update.phase.project.companyId !== user.companyId) {
      throw new NotFoundException('التعليق غير موجود');
    }

    // Owner or admin can delete
    if (
      comment.userId !== user.userId &&
      !['SUPER_ADMIN', 'PROJECT_MANAGER'].includes(user.role)
    ) {
      throw new ForbiddenException('لا يمكنك حذف هذا التعليق');
    }

    // Also soft-delete replies
    await this.prisma.$transaction([
      this.prisma.comment.updateMany({
        where: { parentId: commentId },
        data: { deletedAt: new Date() },
      }),
      this.prisma.comment.update({
        where: { id: commentId },
        data: { deletedAt: new Date() },
      }),
    ]);

    await this.auditLog.log({
      companyId: user.companyId,
      userId: user.userId,
      userRole: user.role,
      entityType: 'comment',
      entityId: commentId,
      action: AuditAction.DELETE,
      oldValues: { content: comment.content.substring(0, 100) },
      req,
    });

    return { message: 'تم حذف التعليق بنجاح' };
  }

  // ─── Helpers ───────────────────────────────

  private async verifyUpdateAccess(user: JwtPayload, updateId: string) {
    const update = await this.prisma.update.findFirst({
      where: { id: updateId, ...this.prisma.softDeleteFilter },
      include: {
        phase: { select: { projectId: true, project: { select: { companyId: true } } } },
      },
    });

    if (!update) throw new NotFoundException('التحديث غير موجود');
    if (update.phase.project.companyId !== user.companyId) {
      throw new NotFoundException('التحديث غير موجود');
    }

    await this.projectsService.ensureProjectAccess(user, update.phase.projectId);
    return update;
  }

  private async getOwnedComment(user: JwtPayload, commentId: string) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, userId: user.userId, ...this.prisma.softDeleteFilter },
      include: {
        update: {
          include: {
            phase: { select: { project: { select: { companyId: true } } } },
          },
        },
      },
    });

    if (!comment) throw new NotFoundException('التعليق غير موجود');
    if (comment.update.phase.project.companyId !== user.companyId) {
      throw new NotFoundException('التعليق غير موجود');
    }

    return comment;
  }
}
