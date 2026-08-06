// ============================================
// MediaService unit tests
//
// Covers (P0 hardened):
//   - softDelete: soft-delete only (no hard delete), audit inside tx
//   - softDelete: cross-tenant → NotFound, double-delete → BadRequest
//   - softDelete: ownership (only submitter or admins)
//   - softDelete: rolls back if audit fails
//   - findByUpdate: filters soft-deleted, enforces companyId + client visibility
//   - addToUpdate: tenant-scoped path required
//   - addToUpdate: max-20-per-update enforced; audit inside tx
//   - addToUpdate: verified size + mime are persisted (NOT client-supplied)
//   - addToUpdate: orphan storage file is deleted on rejection
//   - addToUpdate: quota check uses VERIFIED size
//   - getSignedReadUrl: ownership/role checks before signing
// ============================================
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MediaService } from './media.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { TierLimitsService } from '../companies/tier-limits.service';
import { MediaSecurityService } from './media-security.service';
import { AuditAction } from '@prisma/client';
import type { JwtPayload } from '../../common/decorators';
import type { Request } from 'express';

describe('MediaService', () => {
  let service: MediaService;

  let findFirstUpdate: jest.Mock;
  let findFirstMedia: jest.Mock;
  let findManyMedia: jest.Mock;
  let prismaTransaction: jest.Mock;
  let txCreateMedia: jest.Mock;
  let txUpdateMedia: jest.Mock;
  let txUpdateCompany: jest.Mock;
  let logInTransaction: jest.Mock;

  let assertPath: jest.Mock;
  let verifyUploadedFile: jest.Mock;
  let deleteOrphan: jest.Mock;
  let createSignedUploadUrl: jest.Mock;
  let createSignedReadUrl: jest.Mock;
  let assertCanUseStorage: jest.Mock;

  const mockReq = {
    ip: '203.0.113.5',
    headers: { 'user-agent': 'jest' },
    socket: {},
  } as unknown as Request;

  const submitter: JwtPayload = {
    sub: 'sup-1',
    email: 'eng@a.test',
    userId: 'user-eng',
    companyId: 'company-a',
    role: 'SITE_ENGINEER',
    permissions: [],
  };

  const pm: JwtPayload = {
    ...submitter,
    userId: 'user-pm',
    role: 'PROJECT_MANAGER',
  };

  const client: JwtPayload = {
    ...submitter,
    userId: 'user-client',
    role: 'CLIENT',
  };

  const otherCompanyUser: JwtPayload = {
    ...submitter,
    companyId: 'company-b',
  };

  /** A path the server would have issued for `submitter`. */
  const tenantPath =
    'company-a/user-eng/00000000-0000-0000-0000-000000000001.jpg';

  beforeEach(async () => {
    findFirstUpdate = jest.fn();
    findFirstMedia = jest.fn();
    findManyMedia = jest.fn().mockResolvedValue([]);
    txCreateMedia = jest.fn();
    txUpdateMedia = jest.fn();
    txUpdateCompany = jest.fn();
    logInTransaction = jest.fn();

    prismaTransaction = jest.fn(async (arg: unknown) => {
      if (typeof arg === 'function') {
        const tx = {
          media: { create: txCreateMedia, update: txUpdateMedia },
          company: { update: txUpdateCompany },
        };
        return (arg as (t: unknown) => Promise<unknown>)(tx);
      }
      return Promise.all(arg as Promise<unknown>[]);
    });

    // MediaSecurityService — every method is mockable. By default the
    // happy path: path passes scoping, verify succeeds, no orphan to delete.
    assertPath = jest.fn();
    verifyUploadedFile = jest.fn().mockResolvedValue({
      bucket: 'updates-media',
      path: tenantPath,
      mime: 'image/jpeg',
      size: 50_000,
      extension: 'jpg',
    });
    deleteOrphan = jest.fn().mockResolvedValue(undefined);
    createSignedUploadUrl = jest.fn().mockResolvedValue({
      bucket: 'updates-media',
      path: tenantPath,
      signedUrl: 'https://supabase.test/upload/x',
      token: 'token-x',
      maxSize: 10 * 1024 * 1024,
      allowedMimes: ['image/jpeg'],
    });
    createSignedReadUrl = jest.fn().mockResolvedValue({
      url: 'https://supabase.test/signed/x',
      expiresAt: new Date('2030-01-01'),
    });

    assertCanUseStorage = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        {
          provide: PrismaService,
          useValue: {
            update: { findFirst: findFirstUpdate },
            media: { findFirst: findFirstMedia, findMany: findManyMedia },
            $transaction: prismaTransaction,
            softDeleteFilter: { deletedAt: null },
          },
        },
        { provide: AuditLogService, useValue: { logInTransaction, log: jest.fn() } },
        { provide: TierLimitsService, useValue: { assertCanUseStorage } },
        {
          provide: MediaSecurityService,
          useValue: {
            assertPathBelongsToTenant: assertPath,
            verifyUploadedFile,
            deleteOrphan,
            createSignedUploadUrl,
            createSignedReadUrl,
          },
        },
      ],
    }).compile();

    service = module.get(MediaService);
  });

  // ─── softDelete ────────────────────────────────────────

  describe('softDelete', () => {
    const validReason = 'Wrong photo attached — uploading correct one separately';
    const existingMedia = {
      id: 'media-1',
      url: tenantPath,
      type: 'IMAGE',
      fileSize: 12345,
      deletedAt: null,
      update: {
        id: 'upd-1',
        submittedBy: submitter.userId,
        phase: { project: { companyId: 'company-a' } },
      },
    };

    it('soft-deletes via update() — does NOT call delete()', async () => {
      findFirstMedia.mockResolvedValue(existingMedia);

      await service.softDelete(submitter, 'media-1', { reason: validReason }, mockReq);

      expect(txUpdateMedia).toHaveBeenCalledWith({
        where: { id: 'media-1' },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
          deletedBy: submitter.userId,
          deletionReason: validReason,
        }),
      });
    });

    it('writes audit INSIDE the transaction', async () => {
      findFirstMedia.mockResolvedValue(existingMedia);

      await service.softDelete(pm, 'media-1', { reason: validReason }, mockReq);

      expect(logInTransaction).toHaveBeenCalledTimes(1);
      const [tx, entry] = logInTransaction.mock.calls[0];
      expect(tx).toBeDefined();
      expect(entry).toMatchObject({
        companyId: pm.companyId,
        userId: pm.userId,
        entityType: 'media',
        entityId: 'media-1',
        action: AuditAction.DELETE,
        reason: validReason,
      });
      expect(entry.oldValues).toMatchObject({
        url: existingMedia.url,
        type: 'IMAGE',
      });
      expect(entry.newValues).toBeNull();
    });

    it('throws NotFound when media is in a different company', async () => {
      findFirstMedia.mockResolvedValue(existingMedia);

      await expect(
        service.softDelete(otherCompanyUser, 'media-1', { reason: validReason }, mockReq),
      ).rejects.toThrow(NotFoundException);

      expect(prismaTransaction).not.toHaveBeenCalled();
    });

    it('rejects when media is already soft-deleted', async () => {
      findFirstMedia.mockResolvedValue({
        ...existingMedia,
        deletedAt: new Date(),
      });

      await expect(
        service.softDelete(submitter, 'media-1', { reason: validReason }, mockReq),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks non-submitter non-admin users', async () => {
      const otherEngineer: JwtPayload = { ...submitter, userId: 'user-other' };
      findFirstMedia.mockResolvedValue(existingMedia);

      await expect(
        service.softDelete(otherEngineer, 'media-1', { reason: validReason }, mockReq),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows the original submitter even if they are not an admin', async () => {
      findFirstMedia.mockResolvedValue(existingMedia);

      await expect(
        service.softDelete(submitter, 'media-1', { reason: validReason }, mockReq),
      ).resolves.toEqual({ message: 'تم حذف الملف' });
    });

    it('allows PROJECT_MANAGER even if not the submitter', async () => {
      findFirstMedia.mockResolvedValue(existingMedia);

      await expect(
        service.softDelete(pm, 'media-1', { reason: validReason }, mockReq),
      ).resolves.toEqual({ message: 'تم حذف الملف' });
    });

    it('rolls back the update when the audit insert throws', async () => {
      findFirstMedia.mockResolvedValue(existingMedia);
      logInTransaction.mockRejectedValueOnce(new Error('audit broke'));

      await expect(
        service.softDelete(submitter, 'media-1', { reason: validReason }, mockReq),
      ).rejects.toThrow(/audit broke/);
    });
  });

  // ─── findByUpdate ──────────────────────────────────────

  describe('findByUpdate', () => {
    const baseUpdate = {
      id: 'upd-1',
      status: 'APPROVED',
      phase: {
        projectId: 'proj-1',
        project: { companyId: 'company-a', clientId: 'user-client' },
      },
    };

    it('filters out soft-deleted media', async () => {
      findFirstUpdate.mockResolvedValue(baseUpdate);

      await service.findByUpdate(submitter, 'upd-1');

      expect(findManyMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ updateId: 'upd-1', deletedAt: null }),
        }),
      );
    });

    it('returns NotFound when the parent update is in another company', async () => {
      findFirstUpdate.mockResolvedValue({
        ...baseUpdate,
        phase: { projectId: 'proj-1', project: { companyId: 'other', clientId: '...' } },
      });

      await expect(service.findByUpdate(submitter, 'upd-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lets CLIENT see media of APPROVED updates on their own project', async () => {
      findFirstUpdate.mockResolvedValue(baseUpdate);

      await expect(service.findByUpdate(client, 'upd-1')).resolves.toEqual([]);
    });

    it('forbids CLIENT from seeing media of non-APPROVED updates', async () => {
      findFirstUpdate.mockResolvedValue({ ...baseUpdate, status: 'PENDING' });

      await expect(service.findByUpdate(client, 'upd-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns NotFound when CLIENT is not the owner of the project', async () => {
      findFirstUpdate.mockResolvedValue({
        ...baseUpdate,
        phase: {
          projectId: 'proj-1',
          project: { companyId: 'company-a', clientId: 'other-client' },
        },
      });

      await expect(service.findByUpdate(client, 'upd-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── addToUpdate ───────────────────────────────────────

  describe('addToUpdate', () => {
    const update = {
      id: 'upd-1',
      submittedBy: submitter.userId,
      phase: { project: { companyId: 'company-a' } },
      _count: { media: 2 },
    };

    const createdRow = {
      id: 'media-new',
      updateId: 'upd-1',
      url: tenantPath,
      type: 'IMAGE',
      fileSize: 50_000,
      mimeType: 'image/jpeg',
      caption: null,
      order: 2,
      uploadedAt: new Date(),
      thumbnailUrl: null,
    };

    it('runs tenant scoping on the path BEFORE touching storage', async () => {
      findFirstUpdate.mockResolvedValue(update);
      txCreateMedia.mockResolvedValue(createdRow);

      await service.addToUpdate(
        submitter,
        'upd-1',
        { path: tenantPath, type: 'IMAGE' as const },
        mockReq,
      );

      expect(assertPath).toHaveBeenCalledWith(submitter, tenantPath);
      // Order check: assert path → then verify
      expect(assertPath.mock.invocationCallOrder[0]).toBeLessThan(
        verifyUploadedFile.mock.invocationCallOrder[0],
      );
    });

    it('persists server-verified mime + size, ignoring client values', async () => {
      findFirstUpdate.mockResolvedValue(update);
      txCreateMedia.mockResolvedValue(createdRow);

      await service.addToUpdate(
        submitter,
        'upd-1',
        { path: tenantPath, type: 'IMAGE' as const },
        mockReq,
      );

      // The DB row carries the size + mime that came from verifyUploadedFile,
      // not anything the client could have set on the DTO.
      expect(txCreateMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fileSize: 50_000,
            originalFileSize: 50_000,
            mimeType: 'image/jpeg',
            url: tenantPath,
          }),
        }),
      );
    });

    it('passes the VERIFIED size to the quota gate', async () => {
      findFirstUpdate.mockResolvedValue(update);
      txCreateMedia.mockResolvedValue(createdRow);

      await service.addToUpdate(
        submitter,
        'upd-1',
        { path: tenantPath, type: 'IMAGE' as const },
        mockReq,
      );

      expect(assertCanUseStorage).toHaveBeenCalledWith('company-a', 50_000);
    });

    it('increments company.storageUsed with the verified size', async () => {
      findFirstUpdate.mockResolvedValue(update);
      txCreateMedia.mockResolvedValue(createdRow);

      await service.addToUpdate(
        submitter,
        'upd-1',
        { path: tenantPath, type: 'IMAGE' as const },
        mockReq,
      );

      expect(txUpdateCompany).toHaveBeenCalledWith({
        where: { id: 'company-a' },
        data: { storageUsed: { increment: BigInt(50_000) } },
      });
    });

    it('deletes the orphan file when verification fails (non-NotFound)', async () => {
      findFirstUpdate.mockResolvedValue(update);
      verifyUploadedFile.mockRejectedValueOnce(
        new BadRequestException('نوع الملف غير معروف أو تالف'),
      );

      await expect(
        service.addToUpdate(
          submitter,
          'upd-1',
          { path: tenantPath, type: 'IMAGE' as const },
          mockReq,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(deleteOrphan).toHaveBeenCalledWith('updates-media', tenantPath);
      // The DB transaction never runs on a rejected verification.
      expect(prismaTransaction).not.toHaveBeenCalled();
    });

    it('does NOT try to delete an orphan when storage said NotFound', async () => {
      findFirstUpdate.mockResolvedValue(update);
      verifyUploadedFile.mockRejectedValueOnce(
        new NotFoundException('لم يتم العثور على الملف المرفوع'),
      );

      await expect(
        service.addToUpdate(
          submitter,
          'upd-1',
          { path: tenantPath, type: 'IMAGE' as const },
          mockReq,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(deleteOrphan).not.toHaveBeenCalled();
    });

    it('rejects when the per-update cap is reached', async () => {
      findFirstUpdate.mockResolvedValue({ ...update, _count: { media: 20 } });

      await expect(
        service.addToUpdate(
          submitter,
          'upd-1',
          { path: tenantPath, type: 'IMAGE' as const },
          mockReq,
        ),
      ).rejects.toThrow(/الحد الأقصى/);

      // Cap is enforced before verification — saves a storage round-trip.
      expect(verifyUploadedFile).not.toHaveBeenCalled();
    });

    it('rejects cross-tenant path via assertPathBelongsToTenant', async () => {
      assertPath.mockImplementationOnce(() => {
        throw new BadRequestException('مسار الملف غير صالح');
      });

      await expect(
        service.addToUpdate(
          submitter,
          'upd-1',
          { path: 'company-b/user-z/abc.jpg', type: 'IMAGE' as const },
          mockReq,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(findFirstUpdate).not.toHaveBeenCalled();
      expect(verifyUploadedFile).not.toHaveBeenCalled();
    });

    it('audits a CREATE action inside the transaction', async () => {
      findFirstUpdate.mockResolvedValue(update);
      txCreateMedia.mockResolvedValue(createdRow);

      await service.addToUpdate(
        submitter,
        'upd-1',
        { path: tenantPath, type: 'IMAGE' as const },
        mockReq,
      );

      expect(logInTransaction).toHaveBeenCalledTimes(1);
      expect(logInTransaction.mock.calls[0][1].action).toBe(AuditAction.CREATE);
      expect(logInTransaction.mock.calls[0][1].entityType).toBe('media');
    });
  });

  // ─── getSignedReadUrl ──────────────────────────────────

  describe('getSignedReadUrl', () => {
    const baseMedia = {
      id: 'media-1',
      url: tenantPath,
      type: 'IMAGE' as const,
      deletedAt: null,
      update: {
        id: 'upd-1',
        status: 'APPROVED' as const,
        phase: {
          project: { companyId: 'company-a', clientId: 'user-client' },
        },
      },
    };

    it('returns a signed URL for an in-tenant authorized user', async () => {
      findFirstMedia.mockResolvedValue(baseMedia);

      const result = await service.getSignedReadUrl(submitter, 'media-1');

      expect(createSignedReadUrl).toHaveBeenCalledWith(
        'updates-media',
        tenantPath,
        'IMAGE',
      );
      expect(result).toEqual({
        url: 'https://supabase.test/signed/x',
        expiresAt: expect.any(Date),
      });
    });

    it('returns NotFound when media is in another company', async () => {
      findFirstMedia.mockResolvedValue({
        ...baseMedia,
        update: {
          ...baseMedia.update,
          phase: { project: { companyId: 'other', clientId: 'x' } },
        },
      });

      await expect(
        service.getSignedReadUrl(submitter, 'media-1'),
      ).rejects.toThrow(NotFoundException);
      expect(createSignedReadUrl).not.toHaveBeenCalled();
    });

    it('forbids CLIENT from reading non-APPROVED update media', async () => {
      findFirstMedia.mockResolvedValue({
        ...baseMedia,
        update: { ...baseMedia.update, status: 'PENDING' },
      });

      await expect(
        service.getSignedReadUrl(client, 'media-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns NotFound when CLIENT is not the project owner', async () => {
      findFirstMedia.mockResolvedValue({
        ...baseMedia,
        update: {
          ...baseMedia.update,
          phase: {
            project: { companyId: 'company-a', clientId: 'someone-else' },
          },
        },
      });

      await expect(
        service.getSignedReadUrl(client, 'media-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
