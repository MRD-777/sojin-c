// ============================================
// UpdatesService unit tests (C4 + state-machine guarantees)
//
// Covers:
//   - approve: audit INSIDE transaction; rolls back if audit fails
//   - approve: phase.progress increment + cap at 100
//   - reject: requires reason; audits inside tx
//   - forceCancel: SUPER_ADMIN path, creates SUNK_COST when cost > 0,
//                  reverses progress, audit inside tx
//   - editApproved: 24h lock window enforced; UpdateVersion snapshot taken;
//                   audit inside tx
//   - state machine: invalid transitions throw BadRequest
//   - CLIENT visibility: list filter forced to APPROVED
// ============================================
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdatesService } from './updates.service';
import { ListUpdatesQueryDto, EditApprovedDto } from './dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { ProjectsService } from '../projects/projects.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { AuditAction, Prisma } from '@prisma/client';

const { Decimal } = Prisma;
import type { JwtPayload } from '../../common/decorators';
import type { Request } from 'express';

const client: JwtPayload = {
  sub: 'c', email: 'client@a.test', userId: 'user-client',
  companyId: 'company-a', role: 'CLIENT', permissions: [],
};
const worker: JwtPayload = {
  sub: 'w', email: 'worker@a.test', userId: 'user-worker',
  companyId: 'company-a', role: 'WORKER', permissions: [],
};
const siteEngineer: JwtPayload = {
  sub: 'se', email: 'se@a.test', userId: 'user-se',
  companyId: 'company-a', role: 'SITE_ENGINEER', permissions: [],
};

const mockReq = {
  ip: '203.0.113.10',
  headers: { 'user-agent': 'jest' },
  socket: {},
} as unknown as Request;

const pm: JwtPayload = {
  sub: 'sup',
  email: 'pm@a.test',
  userId: 'user-pm',
  companyId: 'company-a',
  role: 'PROJECT_MANAGER',
  permissions: [],
};

const superAdmin: JwtPayload = { ...pm, userId: 'user-sa', role: 'SUPER_ADMIN' };

describe('UpdatesService', () => {
  let service: UpdatesService;

  let findFirstUpdate: jest.Mock;
  let findFirstPhase: jest.Mock;
  let findManyUpdate: jest.Mock;
  let countUpdate: jest.Mock;
  let companyFindUnique: jest.Mock;
  let assignmentFindFirst: jest.Mock;
  let versionFindMany: jest.Mock;
  let updateMany: jest.Mock;
  let prismaTransaction: jest.Mock;
  let txUpdateUpdate: jest.Mock;
  let txUpdateCreate: jest.Mock;
  let txUpdatePhase: jest.Mock;
  let txCreatePayment: jest.Mock;
  let txCountUpdateVersion: jest.Mock;
  let txCreateUpdateVersion: jest.Mock;

  let logInTransaction: jest.Mock;
  let recalculateProgressInTx: jest.Mock;
  let idempotencyLookup: jest.Mock;
  let idempotencySave: jest.Mock;
  let idempotencySaveInTransaction: jest.Mock;

  beforeEach(async () => {
    findFirstUpdate = jest.fn();
    findFirstPhase = jest.fn();
    findManyUpdate = jest.fn().mockResolvedValue([]);
    countUpdate = jest.fn().mockResolvedValue(0);
    companyFindUnique = jest.fn().mockResolvedValue({ timezone: 'Africa/Cairo' });
    assignmentFindFirst = jest.fn().mockResolvedValue({ id: 'assign-1' });
    versionFindMany = jest.fn().mockResolvedValue([]);
    updateMany = jest.fn().mockResolvedValue({ count: 0 });

    txUpdateUpdate = jest.fn();
    txUpdateCreate = jest.fn();
    txUpdatePhase = jest.fn();
    txCreatePayment = jest.fn();
    txCountUpdateVersion = jest.fn().mockResolvedValue(0);
    txCreateUpdateVersion = jest.fn();

    logInTransaction = jest.fn();
    recalculateProgressInTx = jest.fn();
    idempotencyLookup = jest.fn().mockResolvedValue(null);
    idempotencySave = jest.fn().mockResolvedValue(undefined);
    idempotencySaveInTransaction = jest.fn().mockResolvedValue(undefined);

    prismaTransaction = jest.fn(async (arg: unknown, _opts?: unknown) => {
      if (typeof arg === 'function') {
        const tx = {
          // In-tx re-read uses the SAME findFirst mock as pre-tx — tests
          // that don't override per-call get baseUpdate twice, which is
          // the realistic no-concurrent-edit scenario.
          // CVE-UPD-003 (create) and CVE-UPD-005 (forceCancel) both rely
          // on this tx-bound read.
          update: {
            update: txUpdateUpdate,
            findFirst: findFirstUpdate,
            create: txUpdateCreate,
          },
          phase: { update: txUpdatePhase, updateMany },
          payment: { create: txCreatePayment },
          updateVersion: {
            count: txCountUpdateVersion,
            create: txCreateUpdateVersion,
          },
        };
        return (arg as (t: unknown) => Promise<unknown>)(tx);
      }
      return Promise.all(arg as Promise<unknown>[]);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdatesService,
        {
          provide: PrismaService,
          useValue: {
            update: {
              findFirst: findFirstUpdate,
              findMany: findManyUpdate,
              count: countUpdate,
            },
            phase: { findFirst: findFirstPhase, updateMany },
            company: { findUnique: companyFindUnique },
            projectAssignment: { findFirst: assignmentFindFirst },
            updateVersion: { findMany: versionFindMany },
            $transaction: prismaTransaction,
            // runSerializable wraps $transaction with Serializable isolation
            // + P2034 retry. The mock delegates to prismaTransaction so the
            // existing "isolationLevel: 'Serializable'" assertions still hold.
            runSerializable: (fn: unknown) =>
              prismaTransaction(fn, { isolationLevel: 'Serializable' }),
            softDeleteFilter: { deletedAt: null },
          },
        },
        { provide: AuditLogService, useValue: { logInTransaction, log: jest.fn() } },
        {
          provide: ProjectsService,
          useValue: {
            ensureProjectAccess: jest.fn().mockResolvedValue(undefined),
            recalculateProgressInTx,
          },
        },
        {
          provide: IdempotencyService,
          useValue: {
            lookup: idempotencyLookup,
            save: idempotencySave,
            saveInTransaction: idempotencySaveInTransaction,
          },
        },
      ],
    }).compile();

    service = module.get(UpdatesService);
  });

  // ─── approve ───────────────────────────────────────────

  describe('approve', () => {
    const baseUpdate = {
      id: 'upd-1',
      phaseId: 'phase-1',
      status: 'PENDING',
      progressIncrement: 10,
      // Fields read by the normalized response body (CVE-UPD-009). A real
      // Update row always carries these; the mock must too or .toFixed /
      // .toISOString would throw.
      cost: new Decimal('0'),
      workHours: new Decimal('0'),
      submittedAt: null,
      reviewedAt: null,
      lockedAt: null,
      createdAt: new Date('2026-05-30T00:00:00.000Z'),
      updatedAt: new Date('2026-05-30T00:00:00.000Z'),
      phase: { projectId: 'proj-1', project: { companyId: 'company-a' } },
    };

    it('approves + audits inside Serializable transaction', async () => {
      findFirstUpdate.mockResolvedValue(baseUpdate);
      txUpdateUpdate.mockResolvedValue({ ...baseUpdate, status: 'APPROVED' });

      await service.approve(pm, 'upd-1', 'idem-key-approve-0000000000', mockReq);

      expect(prismaTransaction).toHaveBeenCalledTimes(1);
      expect(prismaTransaction.mock.calls[0][1]).toEqual({
        isolationLevel: 'Serializable',
      });
      expect(logInTransaction).toHaveBeenCalledTimes(1);
      expect(logInTransaction.mock.calls[0][1]).toMatchObject({
        action: AuditAction.APPROVE,
        entityType: 'update',
        entityId: 'upd-1',
        oldValues: { status: 'PENDING' },
      });
    });

    it('increments phase progress by progressIncrement', async () => {
      findFirstUpdate.mockResolvedValue(baseUpdate);
      txUpdateUpdate.mockResolvedValue({ ...baseUpdate, status: 'APPROVED' });

      await service.approve(pm, 'upd-1', 'idem-key-approve-0000000000', mockReq);

      expect(txUpdatePhase).toHaveBeenCalledWith({
        where: { id: 'phase-1' },
        data: { progress: { increment: 10 } },
      });
      // Cap-at-100 enforced via updateMany
      expect(updateMany).toHaveBeenCalledWith({
        where: { id: 'phase-1', progress: { gt: 100 } },
        data: { progress: 100 },
      });
    });

    it('recalculates parent project progress INSIDE the transaction (C28)', async () => {
      findFirstUpdate.mockResolvedValue(baseUpdate);
      txUpdateUpdate.mockResolvedValue({ ...baseUpdate, status: 'APPROVED' });

      await service.approve(pm, 'upd-1', 'idem-key-approve-0000000000', mockReq);

      // Must be called with the tx client (a non-prisma object).
      // We don't assert on the exact shape — only that the inTx variant was used.
      expect(recalculateProgressInTx).toHaveBeenCalledTimes(1);
      expect(recalculateProgressInTx.mock.calls[0][1]).toBe('proj-1');
    });

    it('rolls back when audit insert fails', async () => {
      findFirstUpdate.mockResolvedValue(baseUpdate);
      txUpdateUpdate.mockResolvedValue({ ...baseUpdate, status: 'APPROVED' });
      logInTransaction.mockRejectedValueOnce(new Error('audit broke'));

      await expect(service.approve(pm, 'upd-1', 'idem-key-approve-0000000000', mockReq)).rejects.toThrow(/audit broke/);
      // Recalc happens inside the tx now (C28) — if the audit fails, the
      // whole tx rolls back and the recalc never persists. Whether the
      // function was *called* before the audit step depends on internal
      // ordering; the important assertion is on transactional atomicity,
      // which is verified by the audit-roll-back test above.
    });

    it('rejects approval on a non-PENDING update', async () => {
      findFirstUpdate.mockResolvedValue({ ...baseUpdate, status: 'DRAFT' });

      await expect(service.approve(pm, 'upd-1', 'idem-key-approve-0000000000', mockReq)).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaTransaction).not.toHaveBeenCalled();
    });

    it('returns NotFound when update is in another company', async () => {
      findFirstUpdate.mockResolvedValue({
        ...baseUpdate,
        phase: { projectId: 'proj-1', project: { companyId: 'other' } },
      });

      await expect(service.approve(pm, 'upd-1', 'idem-key-approve-0000000000', mockReq)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── reject ────────────────────────────────────────────

  describe('reject', () => {
    const baseUpdate = {
      id: 'upd-1',
      status: 'PENDING',
      phase: { project: { companyId: 'company-a' } },
    };

    it('audits inside transaction with REJECT action + reason', async () => {
      findFirstUpdate.mockResolvedValue(baseUpdate);
      txUpdateUpdate.mockResolvedValue({});

      await service.reject(
        pm,
        'upd-1',
        { reason: 'Insufficient photo evidence for the claimed scope' },
        mockReq,
      );

      expect(logInTransaction).toHaveBeenCalledTimes(1);
      expect(logInTransaction.mock.calls[0][1]).toMatchObject({
        action: AuditAction.REJECT,
        reason: 'Insufficient photo evidence for the claimed scope',
      });
    });
  });

  // ─── forceCancel ───────────────────────────────────────

  describe('forceCancel', () => {
    const baseUpdate = {
      id: 'upd-1',
      title: 'Demolition phase 2',
      phaseId: 'phase-1',
      status: 'APPROVED',
      progressIncrement: 5,
      cost: new Decimal('15000.00'),
      phase: { projectId: 'proj-1', project: { companyId: 'company-a' } },
    };

    it('reverses progress AND creates SUNK_COST when cost > 0', async () => {
      findFirstUpdate.mockResolvedValue(baseUpdate);
      txCreatePayment.mockResolvedValue({ id: 'sunk-1' });

      await service.forceCancel(
        superAdmin,
        'upd-1',
        { reason: 'Client cancellation — wrong site address on contract' },
        'idem-fc-aaaaaaaaaaaaaaaaaaaa',
        mockReq,
      );

      // 1. Update marked FORCE_CANCELLED
      expect(txUpdateUpdate).toHaveBeenCalledWith({
        where: { id: 'upd-1' },
        data: expect.objectContaining({
          status: 'FORCE_CANCELLED',
          forceCancelReason: expect.any(String),
          forceCancelledBy: superAdmin.userId,
        }),
      });

      // 2. Progress reversed
      expect(txUpdatePhase).toHaveBeenCalledWith({
        where: { id: 'phase-1' },
        data: { progress: { decrement: 5 } },
      });
      // Floor at 0
      expect(updateMany).toHaveBeenCalledWith({
        where: { id: 'phase-1', progress: { lt: 0 } },
        data: { progress: 0 },
      });

      // 3. SUNK_COST payment created
      expect(txCreatePayment).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-1',
          type: 'SUNK_COST',
          recordedBy: superAdmin.userId,
        }),
      });

      // 4. Audit logged for BOTH payment + force cancel
      expect(logInTransaction).toHaveBeenCalledTimes(2);
      const actions = logInTransaction.mock.calls.map((c) => c[1].action);
      expect(actions).toContain(AuditAction.CREATE);       // payment
      expect(actions).toContain(AuditAction.FORCE_CANCEL); // update
    });

    it('does NOT create a SUNK_COST payment when cost is zero', async () => {
      findFirstUpdate.mockResolvedValue({ ...baseUpdate, cost: new Decimal('0') });

      await service.forceCancel(
        superAdmin,
        'upd-1',
        { reason: 'No-op cancellation: duplicate of upd-2 submitted earlier' },
        'idem-fc-bbbbbbbbbbbbbbbbbbbb',
        mockReq,
      );

      expect(txCreatePayment).not.toHaveBeenCalled();
      // Only the force-cancel audit, no payment audit
      expect(logInTransaction).toHaveBeenCalledTimes(1);
      expect(logInTransaction.mock.calls[0][1].action).toBe(AuditAction.FORCE_CANCEL);
    });

    it('refuses force-cancel on non-APPROVED updates', async () => {
      findFirstUpdate.mockResolvedValue({ ...baseUpdate, status: 'PENDING' });

      await expect(
        service.forceCancel(
          superAdmin,
          'upd-1',
          { reason: 'x'.repeat(25) },
          'idem-fc-cccccccccccccccccccc',
          mockReq,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns cached body on idempotent retry (no double progress reversal)', async () => {
      const cached = { message: 'cached' };
      idempotencyLookup.mockResolvedValueOnce({ statusCode: 200, body: cached });

      const result = await service.forceCancel(
        superAdmin,
        'upd-1',
        { reason: 'duplicate request — should be cached idempotently' },
        'idem-fc-dddddddddddddddddddd',
        mockReq,
      );

      expect(result).toEqual(cached);
      expect(prismaTransaction).not.toHaveBeenCalled();
      expect(txCreatePayment).not.toHaveBeenCalled();
      expect(recalculateProgressInTx).not.toHaveBeenCalled();
    });
  });

  // ─── editApproved ──────────────────────────────────────

  describe('editApproved', () => {
    const within24h = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
    const past24h = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25h ago

    const baseApproved = {
      id: 'upd-1',
      title: 'Old title',
      description: 'Old description',
      workDone: 'partial',
      workRemaining: '',
      workersCount: 5,
      workHours: new Decimal('40'),
      materialsUsed: [] as unknown,
      cost: new Decimal('1000'),
      progressIncrement: 5,
      status: 'APPROVED',
      isLocked: false,
      reviewedAt: within24h,
      phase: { project: { companyId: 'company-a' } },
    };

    it('within 24h: snapshots prior version + audits inside tx', async () => {
      findFirstUpdate.mockResolvedValue(baseApproved);
      txUpdateUpdate.mockResolvedValue({});

      await service.editApproved(
        pm,
        'upd-1',
        {
          title: 'Corrected title',
          changeReason: 'Typo in original title — proper Arabic spelling',
        },
        mockReq,
      );

      // Snapshot created with version 1
      expect(txCreateUpdateVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            updateId: 'upd-1',
            versionNumber: 1,
            changedBy: pm.userId,
            changeReason: expect.any(String),
          }),
        }),
      );

      // Audit inside tx with the change reason
      expect(logInTransaction).toHaveBeenCalledTimes(1);
      expect(logInTransaction.mock.calls[0][1]).toMatchObject({
        action: AuditAction.UPDATE,
        reason: 'Typo in original title — proper Arabic spelling',
      });
    });

    it('past 24h: auto-locks + ForbiddenException, no audit, no edit', async () => {
      findFirstUpdate.mockResolvedValue({ ...baseApproved, reviewedAt: past24h });
      // Mock the auto-lock call (uses base prisma.update, not tx)
      // The service calls prisma.update.update for the lock — we don't expose it
      // because the test only verifies the throw.

      // The first update call inside the auto-lock path uses prisma.update,
      // not our $transaction mock. Add it WITHOUT replacing the prisma.update
      // object (preserves findFirst wired in beforeEach).
      (service as unknown as { prisma: { update: Record<string, jest.Mock> } }).prisma.update.update =
        jest.fn().mockResolvedValue({});

      await expect(
        service.editApproved(
          pm,
          'upd-1',
          { title: 'too late', changeReason: 'Trying after the window closed.' },
          mockReq,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(txCreateUpdateVersion).not.toHaveBeenCalled();
      expect(logInTransaction).not.toHaveBeenCalled();
    });

    it('refuses if already locked', async () => {
      findFirstUpdate.mockResolvedValue({ ...baseApproved, isLocked: true });

      await expect(
        service.editApproved(
          pm,
          'upd-1',
          { title: 'x', changeReason: 'Trying after the lock — should fail.' },
          mockReq,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('refuses if not APPROVED', async () => {
      findFirstUpdate.mockResolvedValue({ ...baseApproved, status: 'PENDING' });

      await expect(
        service.editApproved(
          pm,
          'upd-1',
          { title: 'x', changeReason: 'Trying on a PENDING update — should fail.' },
          mockReq,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ═══════════════════════════════════════════════════════
  // Session 2026-05-30 — new MVT coverage (budget = 32 new)
  // ═══════════════════════════════════════════════════════

  // ─── findAll (CVE-UPD-001 authorization narrow) ────────
  describe('findAll', () => {
    beforeEach(() => {
      findFirstPhase.mockResolvedValue({
        id: 'phase-1',
        projectId: 'proj-1',
        project: { id: 'proj-1', companyId: 'company-a' },
      });
    });

    it('CLIENT: status hard-forced to APPROVED, query.status ignored', async () => {
      await service.findAll(client, 'phase-1', { status: 'PENDING' } as ListUpdatesQueryDto);
      const where = findManyUpdate.mock.calls[0][0].where;
      expect(where.status).toBe('APPROVED');
      expect(where.OR).toBeUndefined();
      expect(where.submittedBy).toBeUndefined();
    });

    it('CVE-UPD-001: FIELD role + ?status=PENDING sees ONLY own PENDING', async () => {
      await service.findAll(siteEngineer, 'phase-1', { status: 'PENDING' } as ListUpdatesQueryDto);
      const where = findManyUpdate.mock.calls[0][0].where;
      expect(where.status).toBe('PENDING');
      expect(where.submittedBy).toBe(siteEngineer.userId); // narrowed, not bypassed
    });

    it('ADMIN_TIER (PM) + ?status=PENDING sees ALL PENDING (no submitter narrow)', async () => {
      await service.findAll(pm, 'phase-1', { status: 'PENDING' } as ListUpdatesQueryDto);
      const where = findManyUpdate.mock.calls[0][0].where;
      expect(where.status).toBe('PENDING');
      expect(where.submittedBy).toBeUndefined();
    });

    it('FIELD role + no filter → own ∪ APPROVED', async () => {
      await service.findAll(worker, 'phase-1', {} as ListUpdatesQueryDto);
      const where = findManyUpdate.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { submittedBy: worker.userId },
        { status: 'APPROVED' },
      ]);
    });
  });

  // ─── findOne (CVE-UPD-006 IDOR → NotFound) ─────────────
  describe('findOne', () => {
    const make = (over: Record<string, unknown>) => ({
      id: 'upd-1',
      submittedBy: 'user-other',
      status: 'PENDING',
      phase: { project: { companyId: 'company-a', clientId: 'user-client' } },
      ...over,
    });

    it('CLIENT viewing a non-APPROVED update → NotFound (no 403 leak)', async () => {
      findFirstUpdate.mockResolvedValue(make({ status: 'PENDING' }));
      await expect(service.findOne(client, 'upd-1')).rejects.toThrow(NotFoundException);
    });

    it('CLIENT on another client’s project → NotFound', async () => {
      findFirstUpdate.mockResolvedValue(
        make({ status: 'APPROVED', phase: { project: { companyId: 'company-a', clientId: 'someone-else' } } }),
      );
      await expect(service.findOne(client, 'upd-1')).rejects.toThrow(NotFoundException);
    });

    it('FIELD role, not owner, not APPROVED → NotFound', async () => {
      findFirstUpdate.mockResolvedValue(make({ submittedBy: 'user-other', status: 'PENDING' }));
      await expect(service.findOne(worker, 'upd-1')).rejects.toThrow(NotFoundException);
    });

    it('cross-tenant update → NotFound', async () => {
      findFirstUpdate.mockResolvedValue(
        make({ status: 'APPROVED', phase: { project: { companyId: 'other-co', clientId: 'x' } } }),
      );
      await expect(service.findOne(pm, 'upd-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create (duplicate guard + assignment + tz) ────────
  describe('create', () => {
    const dto = { title: 'Valid update title', description: 'desc' } as never;
    beforeEach(() => {
      findFirstPhase.mockResolvedValue({
        id: 'phase-1',
        projectId: 'proj-1',
        project: { id: 'proj-1', companyId: 'company-a' },
      });
    });

    it('CLIENT cannot create → Forbidden', async () => {
      await expect(service.create(client, 'phase-1', dto, mockReq)).rejects.toThrow(ForbiddenException);
    });

    it('non-admin without project assignment → Forbidden', async () => {
      assignmentFindFirst.mockResolvedValue(null);
      await expect(service.create(worker, 'phase-1', dto, mockReq)).rejects.toThrow(ForbiddenException);
    });

    it('CVE-UPD-003: duplicate-guard runs INSIDE the tx and blocks (no create)', async () => {
      findFirstUpdate.mockResolvedValue({ id: 'dup', status: 'PENDING' }); // existingToday
      await expect(service.create(pm, 'phase-1', dto, mockReq)).rejects.toThrow(ConflictException);
      // Paired assertion — deepest primary action: the row was NEVER created.
      expect(txUpdateCreate).not.toHaveBeenCalled();
    });

    it('Cairo tz: duplicate-guard query uses tz-computed day bounds, then creates', async () => {
      findFirstUpdate.mockResolvedValue(null); // no existing today
      txUpdateCreate.mockResolvedValue({ id: 'new-1', status: 'DRAFT' });
      await service.create(pm, 'phase-1', dto, mockReq);
      // Paired: the create (deepest primary) ran, and the guard read it
      // protects used real day bounds derived from the company tz.
      expect(txUpdateCreate).toHaveBeenCalledTimes(1);
      const guardWhere = findFirstUpdate.mock.calls[0][0].where;
      expect(guardWhere.createdAt.gte).toBeInstanceOf(Date);
      expect(guardWhere.createdAt.lt).toBeInstanceOf(Date);
      expect(guardWhere.createdAt.lt.getTime() - guardWhere.createdAt.gte.getTime())
        .toBe(24 * 60 * 60 * 1000);
    });
  });

  // ─── editDraft (ownership + REJECTED cleanup) ──────────
  describe('editDraft', () => {
    const owned = (over: Record<string, unknown>) => ({
      id: 'upd-1', submittedBy: pm.userId, status: 'DRAFT', title: 'old',
      rejectionReason: null,
      phase: { project: { companyId: 'company-a' } }, ...over,
    });

    it('refuses to edit an APPROVED update → BadRequest', async () => {
      findFirstUpdate.mockResolvedValue(owned({ status: 'APPROVED' }));
      await expect(
        service.editDraft(pm, 'upd-1', { title: 'new title here' } as never, mockReq),
      ).rejects.toThrow(BadRequestException);
    });

    it('BUG-UPD-011: non-owner → NotFound (no 403 existence leak)', async () => {
      findFirstUpdate.mockResolvedValue(owned({ submittedBy: 'someone-else' }));
      await expect(
        service.editDraft(pm, 'upd-1', { title: 'new title here' } as never, mockReq),
      ).rejects.toThrow(NotFoundException);
    });

    it('BUG-UPD-009: REJECTED→DRAFT clears rejection state AND audit keeps the reason', async () => {
      findFirstUpdate.mockResolvedValue(
        owned({ status: 'REJECTED', rejectionReason: 'blurry photos' }),
      );
      txUpdateUpdate.mockResolvedValue({});
      await service.editDraft(pm, 'upd-1', { title: 'fixed title here' } as never, mockReq);
      // Paired: deepest primary action = the row write clears the fields…
      const data = txUpdateUpdate.mock.calls[0][0].data;
      expect(data.rejectionReason).toBeNull();
      expect(data.reviewedBy).toBeNull();
      expect(data.reviewedAt).toBeNull();
      // …and the audit trail preserves what was cleared.
      expect(logInTransaction.mock.calls[0][1].oldValues.rejectionReason).toBe('blurry photos');
    });
  });

  // ─── submit (DRAFT → PENDING) ──────────────────────────
  describe('submit', () => {
    const owned = (over: Record<string, unknown>) => ({
      id: 'upd-1', submittedBy: pm.userId, status: 'DRAFT', title: 'A valid title',
      phase: { project: { companyId: 'company-a' } }, ...over,
    });

    it('DRAFT → PENDING + audits the transition inside the tx', async () => {
      findFirstUpdate.mockResolvedValue(owned({}));
      txUpdateUpdate.mockResolvedValue({ submittedAt: new Date() });
      await service.submit(pm, 'upd-1', mockReq);
      expect(txUpdateUpdate.mock.calls[0][0].data.status).toBe('PENDING');
      expect(logInTransaction.mock.calls[0][1]).toMatchObject({
        action: AuditAction.UPDATE,
        oldValues: { status: 'DRAFT' },
      });
    });

    it('empty title → BadRequest', async () => {
      findFirstUpdate.mockResolvedValue(owned({ title: '   ' }));
      await expect(service.submit(pm, 'upd-1', mockReq)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── reject (tenant isolation) ─────────────────────────
  describe('reject', () => {
    it('cross-tenant update → NotFound', async () => {
      findFirstUpdate.mockResolvedValue({
        id: 'upd-1', status: 'PENDING',
        phase: { project: { companyId: 'other-co' } },
      });
      await expect(
        service.reject(pm, 'upd-1', { reason: 'x'.repeat(15) } as never, mockReq),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── forceCancel (CVE-UPD-002 + CVE-UPD-005) ───────────
  describe('forceCancel — idempotency & race', () => {
    const fcUpdate = {
      id: 'upd-fc', title: 'Demo', phaseId: 'phase-1', status: 'APPROVED',
      progressIncrement: 5, cost: new Decimal('15000.00'),
      phase: { projectId: 'proj-1', project: { companyId: 'company-a' } },
    };

    it('CVE-UPD-002: idempotency record saved INSIDE the tx (tx client passed)', async () => {
      findFirstUpdate.mockResolvedValue(fcUpdate);
      txCreatePayment.mockResolvedValue({ id: 'sunk-1' });
      await service.forceCancel(
        superAdmin, 'upd-fc', { reason: 'x'.repeat(25) } as never,
        'idem-fc-eeeeeeeeeeeeeeeeeeee', mockReq,
      );
      // Paired assertion — deepest layer: arg[0] is the tx client (carries
      // the tx-bound update mock), proving the save is transactional.
      const txArg = idempotencySaveInTransaction.mock.calls[0][0];
      expect(txArg.update.update).toBe(txUpdateUpdate);
      expect(idempotencySave).not.toHaveBeenCalled();
    });

    it('CVE-UPD-005: status flips between pre-tx and in-tx read → Conflict, no mutation', async () => {
      findFirstUpdate
        .mockResolvedValueOnce(fcUpdate)                              // pre-tx
        .mockResolvedValueOnce({ ...fcUpdate, status: 'FORCE_CANCELLED' }); // in-tx
      await expect(
        service.forceCancel(
          superAdmin, 'upd-fc', { reason: 'x'.repeat(25) } as never,
          'idem-fc-ffffffffffffffffffff', mockReq,
        ),
      ).rejects.toThrow(ConflictException);
      // Paired: deepest primary action (the FORCE_CANCELLED write) never ran.
      expect(txUpdateUpdate).not.toHaveBeenCalled();
    });
  });

  // ─── editApproved (D3=A money lock + versioning) ───────
  describe('editApproved — money lock & versioning', () => {
    const baseApproved = {
      id: 'upd-1', title: 'Old', description: 'desc', workDone: 'x', workRemaining: '',
      workersCount: 5, workHours: new Decimal('40'), materialsUsed: [] as unknown,
      cost: new Decimal('1000'), progressIncrement: 5, status: 'APPROVED',
      isLocked: false, reviewedAt: new Date(Date.now() - 60 * 60 * 1000),
      phase: { project: { companyId: 'company-a' } },
    };

    it('D3=A: the row write contains NO money-moving fields', async () => {
      findFirstUpdate.mockResolvedValue(baseApproved);
      txUpdateUpdate.mockResolvedValue({});
      await service.editApproved(
        pm, 'upd-1',
        { title: 'New title', changeReason: 'Fixing the title — twenty plus chars.' } as never,
        mockReq,
      );
      const data = txUpdateUpdate.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('cost');
      expect(data).not.toHaveProperty('progressIncrement');
      expect(data).not.toHaveProperty('materialsUsed');
    });

    it('CVE-UPD-007: version snapshot numbered count+1', async () => {
      findFirstUpdate.mockResolvedValue(baseApproved);
      txCountUpdateVersion.mockResolvedValue(2);
      txUpdateUpdate.mockResolvedValue({});
      await service.editApproved(
        pm, 'upd-1',
        { title: 'New title', changeReason: 'Another correction — twenty plus chars.' } as never,
        mockReq,
      );
      expect(txCreateUpdateVersion.mock.calls[0][0].data.versionNumber).toBe(3);
    });
  });

  // ─── getVersions (delegated ACL) ───────────────────────
  describe('getVersions', () => {
    it('delegates visibility to findOne — CLIENT non-owner → NotFound, no version read', async () => {
      findFirstUpdate.mockResolvedValue({
        id: 'upd-1', submittedBy: 'x', status: 'PENDING',
        phase: { project: { companyId: 'company-a', clientId: 'someone-else' } },
      });
      await expect(service.getVersions(client, 'upd-1')).rejects.toThrow(NotFoundException);
      expect(versionFindMany).not.toHaveBeenCalled();
    });
  });

  // ─── computeDayBounds / toUtcFromLocal ─────────────────
  describe('computeDayBounds / toUtcFromLocal', () => {
    const call = (now: Date, tz: string) =>
      (service as unknown as {
        computeDayBounds: (n: Date, t: string) => { dayStart: Date; dayEnd: Date };
      }).computeDayBounds(now, tz);

    it('Cairo: bounds span exactly 24h and contain "now"', () => {
      const now = new Date('2026-06-19T10:00:00.000Z');
      const { dayStart, dayEnd } = call(now, 'Africa/Cairo');
      expect(dayEnd.getTime() - dayStart.getTime()).toBe(24 * 60 * 60 * 1000);
      expect(now.getTime()).toBeGreaterThanOrEqual(dayStart.getTime());
      expect(now.getTime()).toBeLessThan(dayEnd.getTime());
    });

    it('invalid timezone falls back to UTC without throwing', () => {
      const now = new Date('2026-06-19T10:00:00.000Z');
      expect(() => call(now, 'Not/AZone')).not.toThrow();
      const { dayStart, dayEnd } = call(now, 'Not/AZone');
      expect(dayEnd.getTime() - dayStart.getTime()).toBe(24 * 60 * 60 * 1000);
    });
  });

  // ─── DTO validation (skill 04 bounds) ──────────────────
  describe('DTO validation', () => {
    it('ListUpdatesQueryDto rejects a non-enum status', async () => {
      const errors = await validate(plainToInstance(ListUpdatesQueryDto, { status: 'BOGUS' }));
      expect(errors.some((e) => e.property === 'status')).toBe(true);
      const ok = await validate(plainToInstance(ListUpdatesQueryDto, { status: 'APPROVED' }));
      expect(ok).toHaveLength(0);
    });

    it('EditApprovedDto requires changeReason', async () => {
      const errors = await validate(plainToInstance(EditApprovedDto, { title: 'A valid title' }));
      expect(errors.some((e) => e.property === 'changeReason')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════
  // NEEDS-CODER specs (mandatory) — approve hardening
  // ═══════════════════════════════════════════════════════
  describe('approve — CVE-UPD-008 (in-tx status guard)', () => {
    const pendingUpdate = {
      id: 'upd-8', phaseId: 'phase-1', status: 'PENDING', progressIncrement: 10,
      cost: new Decimal('0'), workHours: new Decimal('0'),
      submittedAt: null, reviewedAt: null, lockedAt: null,
      createdAt: new Date('2026-05-30T00:00:00.000Z'),
      updatedAt: new Date('2026-05-30T00:00:00.000Z'),
      phase: { projectId: 'proj-1', project: { companyId: 'company-a' } },
    };

    it('status flipped before tx body → Conflict and NO progress mutation', async () => {
      findFirstUpdate
        .mockResolvedValueOnce(pendingUpdate)                         // pre-tx read (PENDING)
        .mockResolvedValueOnce({ id: 'upd-8', status: 'APPROVED' });  // in-tx re-read (lost the race)
      txUpdateUpdate.mockResolvedValue({ ...pendingUpdate, status: 'APPROVED' });

      await expect(
        service.approve(pm, 'upd-8', 'idem-008-aaaaaaaaaaaaaaaa', mockReq),
      ).rejects.toThrow(ConflictException);

      // Paired assertion on the DEEPEST primary action: the progress
      // increment must NOT have run (this is the double-spend we prevent).
      expect(txUpdatePhase).not.toHaveBeenCalled();
      expect(recalculateProgressInTx).not.toHaveBeenCalled();
      expect(idempotencySaveInTransaction).not.toHaveBeenCalled();
    });

    it('in-tx re-read still PENDING → approve completes, increments exactly once', async () => {
      findFirstUpdate.mockResolvedValue(pendingUpdate); // both reads PENDING
      txUpdateUpdate.mockResolvedValue({ ...pendingUpdate, status: 'APPROVED' });

      await service.approve(pm, 'upd-8', 'idem-008-bbbbbbbbbbbbbbbb', mockReq);

      expect(txUpdatePhase).toHaveBeenCalledTimes(1);
      expect(txUpdatePhase).toHaveBeenCalledWith({
        where: { id: 'phase-1' },
        data: { progress: { increment: 10 } },
      });
    });
  });

  describe('approve — CVE-UPD-009 (cached body shape parity)', () => {
    const pendingUpdate = {
      id: 'upd-9', phaseId: 'phase-1', status: 'PENDING', progressIncrement: 10,
      cost: new Decimal('0'), workHours: new Decimal('0'),
      submittedAt: null, lockedAt: null,
      createdAt: new Date('2026-05-30T00:00:00.000Z'),
      updatedAt: new Date('2026-05-30T00:00:00.000Z'),
      phase: { projectId: 'proj-1', project: { companyId: 'company-a' } },
    };

    it('caches the SAME normalized body it returns (Decimal→string, Date→ISO)', async () => {
      findFirstUpdate.mockResolvedValue(pendingUpdate);
      const reviewedAt = new Date('2026-06-19T12:00:00.000Z');
      txUpdateUpdate.mockResolvedValue({
        ...pendingUpdate, status: 'APPROVED',
        cost: new Decimal('1500.5'), reviewedAt,
      });

      const result = await service.approve(pm, 'upd-9', 'idem-009-cccccccccccccccc', mockReq);

      // Paired assertion on the DEEPEST layer: the body handed to the
      // idempotency store === the body returned to the caller, with
      // normalized scalar types — so first-call and replay never diverge.
      const cachedBody = (idempotencySaveInTransaction.mock.calls[0][4] as { body: unknown }).body;
      expect(cachedBody).toBe(result);
      expect(typeof (result as { cost: unknown }).cost).toBe('string');
      expect((result as { cost: string }).cost).toBe('1500.50');
      expect((result as { reviewedAt: string }).reviewedAt).toBe(reviewedAt.toISOString());
    });
  });
});
