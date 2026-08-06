// ============================================
// 📸 Media Service
//
// Hardening pass (P0 Media Security):
//   - Upload paths are server-generated UUIDs scoped by companyId/userId
//   - Buckets are picked from MEDIA_TYPE_POLICY, not the client
//   - Magic-byte validation runs server-side BEFORE the DB row is created
//   - fileSize and mimeType are re-derived from the file, not trusted from
//     the client — quota is gated on the verified size only
//   - Failed verification deletes the orphan file from storage
//   - Reads expose only short-lived signed URLs (no public bucket reads)
//
// Persistence convention:
//   `Media.url` stores the Supabase Storage *path*, NOT a full HTTP URL.
//   The bucket is derived from `Media.type` via MEDIA_TYPE_POLICY[type].bucket.
//   This keeps the model thin while still letting us split buckets per type
//   in the future without a wire-format break.
// ============================================
import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { TierLimitsService } from '../companies/tier-limits.service';
import { CreateMediaDto, DeleteMediaDto } from './dto';
import { JwtPayload } from '../../common/decorators';
import { AuditAction, MediaType, Prisma } from '@prisma/client';
import { Request } from 'express';
import { MediaSecurityService } from './media-security.service';
import { MEDIA_TYPE_POLICY } from './media-security.constants';

/** Max media per update — defense against storage exhaustion per update. */
const MAX_MEDIA_PER_UPDATE = 20;

/** Stable read projection — never includes update.* or project.* relations. */
const MEDIA_SELECT = {
  id: true,
  updateId: true,
  type: true,
  url: true,
  thumbnailUrl: true,
  fileSize: true,
  mimeType: true,
  caption: true,
  order: true,
  uploadedAt: true,
} satisfies Prisma.MediaSelect;

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly tierLimits: TierLimitsService,
    private readonly security: MediaSecurityService,
  ) {}

  // ─── Issue signed upload URL ───────────────────────────
  /**
   * Returns a signed Supabase upload URL bound to a server-generated path.
   * The client must hand the same `path` back to `addToUpdate` once the
   * upload to storage finishes. The bucket is chosen from policy — the
   * client cannot influence it.
   */
  async createUploadUrl(user: JwtPayload, type: MediaType) {
    return this.security.createSignedUploadUrl(user, type);
  }

  // ─── Add Media to Update ───────────────────────────────
  async addToUpdate(
    user: JwtPayload,
    updateId: string,
    dto: CreateMediaDto,
    req: Request,
  ) {
    // Tenant scoping on the path BEFORE we touch storage — fast reject
    // if a foreign-tenant path slipped past DTO validation.
    this.security.assertPathBelongsToTenant(user, dto.path);

    const update = await this.prisma.update.findFirst({
      where: { id: updateId, ...this.prisma.softDeleteFilter },
      include: {
        phase: { select: { project: { select: { companyId: true } } } },
        _count: { select: { media: { where: { deletedAt: null } } } },
      },
    });

    if (!update) throw new NotFoundException('التحديث غير موجود');
    if (update.phase.project.companyId !== user.companyId) {
      throw new NotFoundException('التحديث غير موجود');
    }

    // Only the submitter or platform admins can add media to an update
    if (
      update.submittedBy !== user.userId &&
      !['SUPER_ADMIN', 'PROJECT_MANAGER'].includes(user.role)
    ) {
      throw new ForbiddenException('لا يمكنك إضافة وسائط لهذا التحديث');
    }

    if (update._count.media >= MAX_MEDIA_PER_UPDATE) {
      throw new BadRequestException(
        `الحد الأقصى ${MAX_MEDIA_PER_UPDATE} ملف لكل تحديث`,
      );
    }

    // Server-side verification: existence + magic-byte + real size.
    // On any rejection inside verifyUploadedFile we still own the orphan
    // file — delete it best-effort before re-throwing so storage doesn't
    // accumulate rejected uploads.
    const bucket = MEDIA_TYPE_POLICY[dto.type].bucket;
    let verified;
    try {
      verified = await this.security.verifyUploadedFile(
        bucket,
        dto.path,
        dto.type,
      );
    } catch (err) {
      // NotFound = the upload never landed; nothing to clean.
      if (!(err instanceof NotFoundException)) {
        await this.security.deleteOrphan(bucket, dto.path);
      }
      throw err;
    }

    // Quota gate uses the VERIFIED size — the client cannot lie its way
    // past this anymore.
    await this.tierLimits.assertCanUseStorage(user.companyId, verified.size);

    const media = await this.prisma.$transaction(async (tx) => {
      const created = await tx.media.create({
        data: {
          updateId,
          // url holds the storage path; the bucket is derived from type.
          url: verified.path,
          type: dto.type,
          caption: dto.caption,
          fileSize: verified.size,
          originalFileSize: verified.size,
          mimeType: verified.mime,
          order: dto.order ?? update._count.media,
        },
        select: MEDIA_SELECT,
      });

      // Storage quota tracking — verified size only, BigInt-safe.
      await tx.company.update({
        where: { id: user.companyId },
        data: { storageUsed: { increment: BigInt(verified.size) } },
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: user.companyId,
        userId: user.userId,
        userRole: user.role,
        entityType: 'media',
        entityId: created.id,
        action: AuditAction.CREATE,
        oldValues: null,
        newValues: {
          type: created.type,
          updateId: created.updateId,
          path: created.url,
          fileSize: created.fileSize,
          mimeType: created.mimeType,
        },
        req,
      });

      return created;
    });

    return media;
  }

  // ─── List Media for Update ─────────────────────────────
  /**
   * Returns all NON-deleted media for an update, after verifying the caller
   * has access to the parent project. Replaces the previous unscoped lookup
   * which allowed cross-tenant data leakage.
   */
  async findByUpdate(user: JwtPayload, updateId: string) {
    // Verify the caller can see this update at all
    const update = await this.prisma.update.findFirst({
      where: { id: updateId, ...this.prisma.softDeleteFilter },
      include: {
        phase: {
          select: {
            projectId: true,
            project: { select: { companyId: true, clientId: true } },
          },
        },
      },
    });

    if (!update) throw new NotFoundException('التحديث غير موجود');
    if (update.phase.project.companyId !== user.companyId) {
      throw new NotFoundException('التحديث غير موجود');
    }

    // Client visibility: only APPROVED updates from their own projects
    if (user.role === 'CLIENT') {
      if (update.phase.project.clientId !== user.userId) {
        throw new NotFoundException('التحديث غير موجود');
      }
      if (update.status !== 'APPROVED') {
        throw new ForbiddenException('غير متاح للعرض');
      }
    }

    return this.prisma.media.findMany({
      where: {
        updateId,
        ...this.prisma.softDeleteFilter,
      },
      select: MEDIA_SELECT,
      orderBy: { order: 'asc' },
    });
  }

  // ─── Soft-Delete Media ─────────────────────────────────
  /**
   * Soft-delete only. The underlying file in Supabase Storage is PRESERVED:
   *   - Legal evidence: media is proof of work — must survive disputes.
   *   - Restore: an admin can revive a soft-deleted record without re-upload.
   *   - Quota: see PLAN — eventual cron archives + frees quota after retention.
   */
  async softDelete(
    user: JwtPayload,
    mediaId: string,
    dto: DeleteMediaDto,
    req: Request,
  ) {
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId },
      include: {
        update: {
          select: {
            id: true,
            submittedBy: true,
            phase: { select: { project: { select: { companyId: true } } } },
          },
        },
      },
    });

    if (!media) throw new NotFoundException('الملف غير موجود');
    if (media.update.phase.project.companyId !== user.companyId) {
      throw new NotFoundException('الملف غير موجود');
    }

    if (media.deletedAt) {
      throw new BadRequestException('الملف محذوف بالفعل');
    }

    // Only the update's submitter or platform admins can delete media
    if (
      media.update.submittedBy !== user.userId &&
      !['SUPER_ADMIN', 'PROJECT_MANAGER'].includes(user.role)
    ) {
      throw new ForbiddenException('لا يمكنك حذف هذا الملف');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.media.update({
        where: { id: mediaId },
        data: {
          deletedAt: new Date(),
          deletedBy: user.userId,
          deletionReason: dto.reason,
        },
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: user.companyId,
        userId: user.userId,
        userRole: user.role,
        entityType: 'media',
        entityId: mediaId,
        action: AuditAction.DELETE,
        oldValues: {
          url: media.url,
          type: media.type,
          fileSize: media.fileSize,
          updateId: media.update.id,
        },
        newValues: null,
        reason: dto.reason,
        req,
      });
    });

    this.logger.log(
      `Media soft-deleted: ${mediaId} update=${media.update.id} by=${user.userId}`,
    );

    return { message: 'تم حذف الملف' };
  }

  // ─── Signed Read URL ───────────────────────────────────
  /**
   * Issues a short-lived signed URL for downloading the file. Performs the
   * same ownership/role checks as findByUpdate before signing:
   *   - The caller must be in the same company.
   *   - CLIENT may only read media on APPROVED updates of their own project.
   *   - Soft-deleted media is invisible.
   *
   * Failure modes are deliberately collapsed to NotFound so a probing
   * attacker cannot tell "wrong tenant" from "wrong status".
   */
  async getSignedReadUrl(user: JwtPayload, mediaId: string) {
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, ...this.prisma.softDeleteFilter },
      include: {
        update: {
          select: {
            id: true,
            status: true,
            phase: {
              select: { project: { select: { companyId: true, clientId: true } } },
            },
          },
        },
      },
    });

    if (!media) throw new NotFoundException('الملف غير موجود');
    if (media.update.phase.project.companyId !== user.companyId) {
      throw new NotFoundException('الملف غير موجود');
    }

    if (user.role === 'CLIENT') {
      if (media.update.phase.project.clientId !== user.userId) {
        throw new NotFoundException('الملف غير موجود');
      }
      if (media.update.status !== 'APPROVED') {
        throw new ForbiddenException('غير متاح للعرض');
      }
    }

    const bucket = MEDIA_TYPE_POLICY[media.type].bucket;
    return this.security.createSignedReadUrl(bucket, media.url, media.type);
  }

  // ─── Helper used by MediaType validation ───────────────
  static isValidMediaType(value: unknown): value is MediaType {
    return Object.values(MediaType).includes(value as MediaType);
  }
}
