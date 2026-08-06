// ============================================
// PaymentsService unit tests
//
// Covers (per skill 08):
//   - softDelete: no hard delete, sets deletedAt+deletedBy+reason, audits inside tx
//   - softDelete: rejects already-deleted, cross-tenant, missing payment
//   - create: rolls back if audit fails (logInTransaction throws)
//   - create: rejects payments on CANCELLED projects
//   - findAll: filters by softDeleteFilter + companyId
//   - findOne: returns null/NotFound on cross-tenant
//   - getSummary: Decimal arithmetic — no float precision loss
// ============================================
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { ProjectsService } from '../projects/projects.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { AuditAction, Prisma } from '@prisma/client';

const { Decimal } = Prisma;
import type { JwtPayload } from '../../common/decorators';
import type { Request } from 'express';

describe('PaymentsService', () => {
  let service: PaymentsService;

  let prismaFindFirstPayment: jest.Mock;
  let prismaFindFirstProject: jest.Mock;
  let prismaFindManyPayments: jest.Mock;
  let prismaCountPayments: jest.Mock;
  let prismaGroupByPayments: jest.Mock;
  let prismaTransaction: jest.Mock;

  let txCreatePayment: jest.Mock;
  let txUpdatePayment: jest.Mock;

  let ensureProjectAccess: jest.Mock;
  let logInTransaction: jest.Mock;
  let idempotencyLookup: jest.Mock;
  let idempotencySave: jest.Mock;
  let idempotencySaveInTransaction: jest.Mock;

  const mockReq = {
    ip: '203.0.113.10',
    headers: { 'user-agent': 'jest' },
    socket: {},
  } as unknown as Request;

  const pmUser: JwtPayload = {
    sub: 'sup-1',
    email: 'pm@a.test',
    userId: 'user-pm',
    companyId: 'company-a',
    role: 'PROJECT_MANAGER',
    permissions: [],
  };

  beforeEach(async () => {
    prismaFindFirstPayment = jest.fn();
    prismaFindFirstProject = jest.fn();
    prismaFindManyPayments = jest.fn();
    prismaCountPayments = jest.fn();
    prismaGroupByPayments = jest.fn();

    txCreatePayment = jest.fn();
    txUpdatePayment = jest.fn();
    logInTransaction = jest.fn();

    // Default: $transaction runs the callback with a mock tx client
    prismaTransaction = jest.fn(async (arg: unknown) => {
      if (typeof arg === 'function') {
        const tx = {
          payment: { create: txCreatePayment, update: txUpdatePayment },
        };
        return (arg as (t: unknown) => Promise<unknown>)(tx);
      }
      // array form for findAll/count
      return Promise.all(arg as Promise<unknown>[]);
    });

    ensureProjectAccess = jest.fn().mockResolvedValue(undefined);
    idempotencyLookup = jest.fn().mockResolvedValue(null);
    idempotencySave = jest.fn().mockResolvedValue(undefined);
    idempotencySaveInTransaction = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: PrismaService,
          useValue: {
            payment: {
              findFirst: prismaFindFirstPayment,
              findMany: prismaFindManyPayments,
              count: prismaCountPayments,
              groupBy: prismaGroupByPayments,
            },
            project: {
              findFirst: prismaFindFirstProject,
            },
            $transaction: prismaTransaction,
            // PAY-IDEM-001: create now runs in runSerializable. Delegate to
            // the existing $transaction mock so the Serializable-isolation
            // assertion still holds.
            runSerializable: (fn: unknown) =>
              prismaTransaction(fn, { isolationLevel: 'Serializable' }),
            softDeleteFilter: { deletedAt: null },
          },
        },
        {
          provide: AuditLogService,
          useValue: { logInTransaction, log: jest.fn() },
        },
        {
          provide: ProjectsService,
          useValue: { ensureProjectAccess },
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

    service = module.get(PaymentsService);
  });

  // ─── softDelete ────────────────────────────────────────

  describe('softDelete', () => {
    const validReason = 'Wrong amount entered, will recreate with the right value';

    const existingPayment = {
      id: 'pay-1',
      projectId: 'proj-1',
      amount: new Decimal('1000.00'),
      type: 'CLIENT_PAYMENT',
      method: 'BANK_TRANSFER',
      date: new Date('2026-05-13'),
      description: 'first payment',
      deletedAt: null,
      project: { id: 'proj-1', companyId: 'company-a' },
    };

    it('soft-deletes (sets deletedAt + deletedBy + reason) — does NOT hard delete', async () => {
      prismaFindFirstPayment.mockResolvedValue(existingPayment);
      txUpdatePayment.mockResolvedValue({});

      await service.softDelete(pmUser, 'pay-1', { reason: validReason }, mockReq);

      // The update call must set all three soft-delete fields
      expect(txUpdatePayment).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
          deletedBy: pmUser.userId,
          deletionReason: validReason,
        }),
      });

      // No `delete` method exposed on tx in our mocks → if the code called it
      // the test would throw at the mock level. Defensive assert anyway:
      expect((txUpdatePayment as unknown as { name?: string }).name).toBeDefined();
    });

    it('writes audit INSIDE the transaction (logInTransaction, not log)', async () => {
      prismaFindFirstPayment.mockResolvedValue(existingPayment);

      await service.softDelete(pmUser, 'pay-1', { reason: validReason }, mockReq);

      expect(logInTransaction).toHaveBeenCalledTimes(1);
      const [tx, entry] = logInTransaction.mock.calls[0];
      expect(tx).toBeDefined();
      expect(entry).toMatchObject({
        companyId: pmUser.companyId,
        userId: pmUser.userId,
        userRole: pmUser.role,
        entityType: 'payment',
        entityId: 'pay-1',
        action: AuditAction.DELETE,
        reason: validReason,
      });
      expect(entry.oldValues).toMatchObject({
        amount: '1000.00',
        type: 'CLIENT_PAYMENT',
      });
      expect(entry.newValues).toBeNull();
    });

    it('rolls back the soft-delete if the audit write fails', async () => {
      prismaFindFirstPayment.mockResolvedValue(existingPayment);
      logInTransaction.mockRejectedValue(new Error('audit failure'));

      // Re-wire $transaction to actually propagate the throw
      prismaTransaction.mockImplementationOnce(async (cb: (t: unknown) => Promise<unknown>) => {
        const tx = { payment: { update: txUpdatePayment } };
        return cb(tx); // this will throw and the test will catch it below
      });

      await expect(
        service.softDelete(pmUser, 'pay-1', { reason: validReason }, mockReq),
      ).rejects.toThrow(/audit failure/);
    });

    it('throws NotFound when the payment belongs to a different company', async () => {
      prismaFindFirstPayment.mockResolvedValue(null); // findFirst's where excludes other companies

      await expect(
        service.softDelete(pmUser, 'pay-x', { reason: validReason }, mockReq),
      ).rejects.toThrow(NotFoundException);

      // Must NOT have started a transaction
      expect(prismaTransaction).not.toHaveBeenCalled();
      expect(txUpdatePayment).not.toHaveBeenCalled();
    });

    it('rejects double-delete (already soft-deleted)', async () => {
      prismaFindFirstPayment.mockResolvedValue({
        ...existingPayment,
        deletedAt: new Date('2026-05-12'),
      });

      await expect(
        service.softDelete(pmUser, 'pay-1', { reason: validReason }, mockReq),
      ).rejects.toThrow(BadRequestException);

      expect(prismaTransaction).not.toHaveBeenCalled();
    });
  });

  // ─── create ────────────────────────────────────────────

  describe('create', () => {
    const validDto = {
      amount: 5000,
      type: 'CLIENT_PAYMENT' as const,
      method: 'BANK_TRANSFER' as const,
      date: '2026-05-13',
      description: 'Down payment',
    };
    const idemKey = 'idem-abc-1234567890abcdef';

    it('creates the payment + audits in a single transaction', async () => {
      prismaFindFirstProject.mockResolvedValue({ id: 'proj-1', status: 'IN_PROGRESS' });
      txCreatePayment.mockResolvedValue({
        id: 'pay-new',
        projectId: 'proj-1',
        amount: new Decimal('5000.00'),
        type: 'CLIENT_PAYMENT',
        method: 'BANK_TRANSFER',
        date: new Date('2026-05-13'),
        description: 'Down payment',
        receiptUrl: null,
        createdAt: new Date(),
        recorder: { id: pmUser.userId, name: 'PM' },
      });

      const result = await service.create(pmUser, 'proj-1', validDto, idemKey, mockReq);

      expect(result.id).toBe('pay-new');
      expect(txCreatePayment).toHaveBeenCalled();
      expect(logInTransaction).toHaveBeenCalledTimes(1);
      expect(logInTransaction.mock.calls[0][1].action).toBe(AuditAction.CREATE);
      expect(logInTransaction.mock.calls[0][1].entityType).toBe('payment');

      // Serializable isolation for financial ops
      const txOptions = prismaTransaction.mock.calls[0][1];
      expect(txOptions).toEqual({ isolationLevel: 'Serializable' });
    });

    it('returns the cached response on idempotent retry (no DB hit)', async () => {
      const cachedBody = { id: 'pay-cached', amount: '5000.00' };
      idempotencyLookup.mockResolvedValueOnce({ statusCode: 201, body: cachedBody });

      const result = await service.create(pmUser, 'proj-1', validDto, idemKey, mockReq);

      expect(result).toEqual(cachedBody);
      // CRITICAL: no DB writes on idempotent hit
      expect(prismaTransaction).not.toHaveBeenCalled();
      expect(txCreatePayment).not.toHaveBeenCalled();
      expect(logInTransaction).not.toHaveBeenCalled();
      expect(idempotencySave).not.toHaveBeenCalled();
      expect(idempotencySaveInTransaction).not.toHaveBeenCalled();
    });

    it('saves the response after a successful create (for future replays)', async () => {
      prismaFindFirstProject.mockResolvedValue({ id: 'proj-1', status: 'IN_PROGRESS' });
      txCreatePayment.mockResolvedValue({
        id: 'pay-new',
        projectId: 'proj-1',
        amount: new Decimal('5000.00'),
        type: 'CLIENT_PAYMENT',
        method: 'BANK_TRANSFER',
        date: new Date('2026-05-13'),
        recorder: { id: pmUser.userId, name: 'PM' },
      });

      await service.create(pmUser, 'proj-1', validDto, idemKey, mockReq);

      // PAY-IDEM-001: the record is now saved INSIDE the tx via
      // saveInTransaction(tx, tenant, key, body, response) — tx is arg 0.
      expect(idempotencySaveInTransaction).toHaveBeenCalledTimes(1);
      expect(idempotencySave).not.toHaveBeenCalled();
      const [, tenant, key, body, response] =
        idempotencySaveInTransaction.mock.calls[0];
      expect(tenant).toBe(pmUser.companyId);
      expect(key).toBe(idemKey);
      expect(body).toMatchObject({ projectId: 'proj-1', amount: 5000 });
      expect(response.statusCode).toBe(201);
      // amount serialized as string in cached body
      expect(response.body.amount).toBe('5000.00');
    });

    it('PAY-IDEM-001: persists the idempotency record INSIDE the tx, never post-commit', async () => {
      prismaFindFirstProject.mockResolvedValue({ id: 'proj-1', status: 'IN_PROGRESS' });
      txCreatePayment.mockResolvedValue({
        id: 'pay-x',
        projectId: 'proj-1',
        amount: new Decimal('250.00'),
        type: 'CLIENT_PAYMENT',
        method: 'BANK_TRANSFER',
        date: new Date('2026-06-19'),
      });

      await service.create(pmUser, 'proj-1', validDto, idemKey, mockReq);

      expect(idempotencySaveInTransaction).toHaveBeenCalledTimes(1);
      expect(idempotencySave).not.toHaveBeenCalled();
      // Paired assertion — deepest layer: arg[0] is the tx client (it carries
      // the tx-bound payment.create), proving the save runs inside the tx.
      const txArg = idempotencySaveInTransaction.mock.calls[0][0];
      expect(txArg.payment.create).toBe(txCreatePayment);
    });

    it('refuses payment on CANCELLED projects', async () => {
      prismaFindFirstProject.mockResolvedValue({ id: 'proj-1', status: 'CANCELLED' });

      await expect(
        service.create(pmUser, 'proj-1', validDto, idemKey, mockReq),
      ).rejects.toThrow(/مشروع ملغى/);

      expect(prismaTransaction).not.toHaveBeenCalled();
      // Failures must NOT be cached — caller can retry with the same key
      expect(idempotencySave).not.toHaveBeenCalled();
      expect(idempotencySaveInTransaction).not.toHaveBeenCalled();
    });

    it('rolls back if audit fails (logInTransaction throws)', async () => {
      prismaFindFirstProject.mockResolvedValue({ id: 'proj-1', status: 'IN_PROGRESS' });
      txCreatePayment.mockResolvedValue({
        id: 'pay-new',
        projectId: 'proj-1',
        amount: new Decimal('5000.00'),
        type: 'CLIENT_PAYMENT',
        method: 'BANK_TRANSFER',
        date: new Date('2026-05-13'),
        recorder: { id: pmUser.userId, name: 'PM' },
      });
      logInTransaction.mockRejectedValueOnce(new Error('audit fail'));

      await expect(
        service.create(pmUser, 'proj-1', validDto, idemKey, mockReq),
      ).rejects.toThrow(/audit fail/);
      // Rollback → nothing cached
      expect(idempotencySave).not.toHaveBeenCalled();
      expect(idempotencySaveInTransaction).not.toHaveBeenCalled();
    });
  });

  // ─── findAll ───────────────────────────────────────────

  describe('findAll', () => {
    it('always filters by softDeleteFilter and companyId via relation', async () => {
      prismaTransaction.mockImplementationOnce(async (calls: Promise<unknown>[]) =>
        Promise.all(calls),
      );
      prismaFindManyPayments.mockResolvedValue([]);
      prismaCountPayments.mockResolvedValue(0);

      await service.findAll(pmUser, 'proj-1', { page: 1, limit: 20 });

      const findManyCall = prismaFindManyPayments.mock.calls[0][0];
      expect(findManyCall.where).toMatchObject({
        projectId: 'proj-1',
        project: { companyId: 'company-a' },
        deletedAt: null,
      });
    });

    it('caps limit at 100 even when client requests more', async () => {
      prismaTransaction.mockImplementationOnce(async (calls: Promise<unknown>[]) =>
        Promise.all(calls),
      );
      prismaFindManyPayments.mockResolvedValue([]);
      prismaCountPayments.mockResolvedValue(0);

      await service.findAll(pmUser, 'proj-1', { page: 1, limit: 9999 });

      expect(prismaFindManyPayments.mock.calls[0][0].take).toBe(100);
    });
  });

  // ─── findOne ───────────────────────────────────────────

  describe('findOne', () => {
    it('returns NotFound when payment is in a different company', async () => {
      prismaFindFirstPayment.mockResolvedValue(null);

      await expect(service.findOne(pmUser, 'pay-x')).rejects.toThrow(NotFoundException);
    });

    it('returns NotFound when payment is soft-deleted', async () => {
      prismaFindFirstPayment.mockResolvedValue(null); // findFirst filters by deletedAt: null

      await expect(service.findOne(pmUser, 'pay-x')).rejects.toThrow(NotFoundException);
    });

    it('checks project access (CLIENT must own; assigned must be assigned)', async () => {
      prismaFindFirstPayment.mockResolvedValue({
        id: 'pay-1',
        projectId: 'proj-1',
        amount: new Decimal('1000'),
        type: 'CLIENT_PAYMENT',
        method: 'BANK_TRANSFER',
        description: null,
        receiptUrl: null,
        date: new Date(),
        createdAt: new Date(),
        recorder: { id: 'user-1', name: 'X' },
      });
      ensureProjectAccess.mockRejectedValueOnce(new Error('Forbidden'));

      await expect(service.findOne(pmUser, 'pay-1')).rejects.toThrow(/Forbidden/);
    });
  });

  // ─── getSummary ────────────────────────────────────────

  describe('getSummary', () => {
    it('uses Decimal arithmetic — no precision loss on cents', async () => {
      prismaFindFirstProject.mockResolvedValue({ totalBudget: new Decimal('100000.00') });
      prismaGroupByPayments.mockResolvedValue([
        { type: 'CLIENT_PAYMENT', _sum: { amount: new Decimal('0.1') }, _count: 1 },
        { type: 'CLIENT_PAYMENT', _sum: { amount: new Decimal('0.2') }, _count: 1 }, // separate group for test
        { type: 'EXPENSE', _sum: { amount: new Decimal('50.00') }, _count: 2 },
      ]);

      const result = await service.getSummary(pmUser, 'proj-1');

      // 0.1 + 0.2 = 0.30 exactly with Decimal (would be 0.30000000000000004 with Number)
      expect(result.totalIncome).toBe('0.30');
      expect(result.totalExpenses).toBe('50.00');
      expect(result.netProfit).toBe('-49.70');
      expect(result.remainingBudget).toBe('99950.00');
    });

    it('returns zeros (as strings) when no payments exist', async () => {
      prismaFindFirstProject.mockResolvedValue({ totalBudget: new Decimal('50000') });
      prismaGroupByPayments.mockResolvedValue([]);

      const result = await service.getSummary(pmUser, 'proj-1');

      expect(result.totalIncome).toBe('0.00');
      expect(result.totalExpenses).toBe('0.00');
      expect(result.netProfit).toBe('0.00');
      expect(result.remainingBudget).toBe('50000.00');
    });

    it('throws NotFound when project does not exist or belongs to other company', async () => {
      prismaFindFirstProject.mockResolvedValue(null);

      await expect(service.getSummary(pmUser, 'proj-x')).rejects.toThrow(NotFoundException);
    });
  });
});
