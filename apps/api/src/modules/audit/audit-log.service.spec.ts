// ============================================
// AuditLogService unit tests
//
// Covers (skill 08):
//   - logInTransaction throws on failure (caller's tx rolls back)
//   - log() swallows failures
//   - Input validation (missing fields, bad entityType, missing reason)
//   - Secret redaction (passwords, tokens) — recursive
//   - IP extraction (X-Forwarded-For + direct)
//   - User-Agent capping at 500 chars
//   - Reason enforcement for negative actions
// ============================================
import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService, AuditLogEntry } from './audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditAction, Prisma } from '@prisma/client';
import type { Request } from 'express';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let prismaCreate: jest.Mock;
  let txCreate: jest.Mock;
  let tx: Prisma.TransactionClient;

  const baseEntry: AuditLogEntry = {
    companyId: '00000000-0000-0000-0000-000000000001',
    userId: '00000000-0000-0000-0000-000000000002',
    userRole: 'PROJECT_MANAGER',
    entityType: 'payment',
    entityId: '00000000-0000-0000-0000-000000000003',
    action: AuditAction.CREATE,
    newValues: { amount: '1000.00', type: 'CLIENT_PAYMENT' },
  };

  beforeEach(async () => {
    prismaCreate = jest.fn().mockResolvedValue({ id: 'log-1' });
    txCreate = jest.fn().mockResolvedValue({ id: 'log-1' });

    tx = { auditLog: { create: txCreate } } as unknown as Prisma.TransactionClient;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: PrismaService,
          useValue: {
            auditLog: { create: prismaCreate },
          },
        },
      ],
    }).compile();

    service = module.get(AuditLogService);
  });

  // ─── logInTransaction ──────────────────────────────────

  describe('logInTransaction', () => {
    it('persists the entry through the transaction client', async () => {
      await service.logInTransaction(tx, baseEntry);

      expect(txCreate).toHaveBeenCalledTimes(1);
      expect(prismaCreate).not.toHaveBeenCalled();

      const call = txCreate.mock.calls[0][0];
      expect(call.data).toMatchObject({
        companyId: baseEntry.companyId,
        userId: baseEntry.userId,
        userRole: baseEntry.userRole,
        entityType: 'payment',
        entityId: baseEntry.entityId,
        action: 'CREATE',
        newValues: { amount: '1000.00', type: 'CLIENT_PAYMENT' },
      });
    });

    it('THROWS on DB failure so the calling $transaction rolls back', async () => {
      txCreate.mockRejectedValueOnce(new Error('DB connection lost'));

      await expect(service.logInTransaction(tx, baseEntry)).rejects.toThrow(
        /Audit log write failed/,
      );
    });

    it('does NOT leak the underlying error message to the thrown error', async () => {
      txCreate.mockRejectedValueOnce(new Error('column "x" of relation "y" does not exist'));

      await expect(service.logInTransaction(tx, baseEntry)).rejects.toThrow(
        /Audit log write failed — operation rolled back/,
      );
      // The detailed message must NOT propagate (would leak schema details to client).
      await expect(service.logInTransaction(tx, baseEntry)).rejects.not.toThrow(
        /column .* of relation/,
      );
    });
  });

  // ─── log (best-effort) ─────────────────────────────────

  describe('log (best-effort)', () => {
    it('persists the entry via the regular prisma client', async () => {
      await service.log(baseEntry);
      expect(prismaCreate).toHaveBeenCalledTimes(1);
      expect(txCreate).not.toHaveBeenCalled();
    });

    it('SWALLOWS DB failures and does NOT throw', async () => {
      prismaCreate.mockRejectedValueOnce(new Error('DB down'));

      // Must NOT throw — the calling operation should proceed.
      await expect(service.log(baseEntry)).resolves.toBeUndefined();
    });
  });

  // ─── Input validation ──────────────────────────────────

  describe('input validation', () => {
    it.each([
      ['companyId', ''],
      ['userId', ''],
      ['userRole', ''],
      ['entityType', ''],
      ['entityId', ''],
    ])('throws when %s is empty', async (field, val) => {
      await expect(
        service.logInTransaction(tx, { ...baseEntry, [field]: val }),
      ).rejects.toThrow(new RegExp(field));
    });

    it('rejects entityType that is not lowercase snake_case', async () => {
      await expect(
        service.logInTransaction(tx, { ...baseEntry, entityType: 'Payment' }),
      ).rejects.toThrow(/lowercase snake_case/);

      await expect(
        service.logInTransaction(tx, { ...baseEntry, entityType: 'project-assignment' }),
      ).rejects.toThrow(/lowercase snake_case/);
    });

    it('accepts valid snake_case entityType', async () => {
      await expect(
        service.logInTransaction(tx, { ...baseEntry, entityType: 'project_assignment' }),
      ).resolves.toBeUndefined();
    });
  });

  // ─── Reason enforcement for negative actions ──────────

  describe('reason enforcement', () => {
    const negativeActions: AuditAction[] = [
      AuditAction.DELETE,
      AuditAction.REJECT,
      AuditAction.FORCE_CANCEL,
      AuditAction.PROGRESS_OVERRIDE,
    ];

    it.each(negativeActions)('requires reason >= 20 chars for action %s', async (action) => {
      await expect(
        service.logInTransaction(tx, { ...baseEntry, action }),
      ).rejects.toThrow(/requires a reason/);

      await expect(
        service.logInTransaction(tx, { ...baseEntry, action, reason: 'short' }),
      ).rejects.toThrow(/at least 20 characters/);
    });

    it('accepts negative actions with reason >= 20 chars', async () => {
      await expect(
        service.logInTransaction(tx, {
          ...baseEntry,
          action: AuditAction.FORCE_CANCEL,
          reason: 'Client requested cancellation due to scope change',
        }),
      ).resolves.toBeUndefined();
    });

    it('does NOT require reason for non-negative actions (CREATE, UPDATE, APPROVE)', async () => {
      for (const action of [AuditAction.CREATE, AuditAction.UPDATE, AuditAction.APPROVE]) {
        await expect(
          service.logInTransaction(tx, { ...baseEntry, action }),
        ).resolves.toBeUndefined();
      }
    });
  });

  // ─── Secret redaction ──────────────────────────────────

  describe('secret redaction', () => {
    it('redacts top-level password / token / secret / apiKey fields', async () => {
      await service.logInTransaction(tx, {
        ...baseEntry,
        newValues: {
          name: 'Alice',
          password: 'p@ssw0rd',
          accessToken: 'eyJhbGc...',
          refreshToken: 'rt_abc',
          apiKey: 'sk_live_xxx',
          secret: 'shh',
          email: 'alice@test.com',
        },
      });

      const data = txCreate.mock.calls[0][0].data;
      expect(data.newValues).toEqual({
        name: 'Alice',
        password: '[REDACTED]',
        accessToken: '[REDACTED]',
        refreshToken: '[REDACTED]',
        apiKey: '[REDACTED]',
        secret: '[REDACTED]',
        email: 'alice@test.com',
      });
    });

    it('redacts case-insensitively', async () => {
      await service.logInTransaction(tx, {
        ...baseEntry,
        newValues: { Password: 'x', PASSWORD: 'y', userPassword: 'z' },
      });

      const data = txCreate.mock.calls[0][0].data;
      expect(data.newValues).toEqual({
        Password: '[REDACTED]',
        PASSWORD: '[REDACTED]',
        userPassword: '[REDACTED]',
      });
    });

    it('redacts inside nested objects (recursive)', async () => {
      await service.logInTransaction(tx, {
        ...baseEntry,
        newValues: {
          user: {
            name: 'Bob',
            credentials: { password: 'p1', apiKey: 'k1' },
          },
        },
      });

      const data = txCreate.mock.calls[0][0].data;
      expect(data.newValues).toEqual({
        user: {
          name: 'Bob',
          credentials: { password: '[REDACTED]', apiKey: '[REDACTED]' },
        },
      });
    });

    it('does NOT recurse into arrays (preserves them as-is)', async () => {
      await service.logInTransaction(tx, {
        ...baseEntry,
        newValues: { items: [1, 2, 3] },
      });

      const data = txCreate.mock.calls[0][0].data;
      expect(data.newValues).toEqual({ items: [1, 2, 3] });
    });

    it('preserves null oldValues/newValues as Prisma DbNull', async () => {
      await service.logInTransaction(tx, {
        ...baseEntry,
        oldValues: null,
        newValues: null,
      });

      const data = txCreate.mock.calls[0][0].data;
      // Prisma needs DbNull sentinel for JSON columns
      expect(data.oldValues).toBe(Prisma.DbNull);
      expect(data.newValues).toBe(Prisma.DbNull);
    });
  });

  // ─── IP & User-Agent extraction ────────────────────────

  describe('IP extraction', () => {
    it('extracts ip from req.ip when no proxy header is set', async () => {
      const req = { ip: '203.0.113.42', headers: {}, socket: {} } as unknown as Request;
      await service.logInTransaction(tx, { ...baseEntry, req });

      expect(txCreate.mock.calls[0][0].data.ipAddress).toBe('203.0.113.42');
    });

    it('prefers the first entry in X-Forwarded-For (original client)', async () => {
      const req = {
        ip: '10.0.0.1',
        headers: { 'x-forwarded-for': '203.0.113.42, 10.0.0.1, 10.0.0.2' },
        socket: {},
      } as unknown as Request;

      await service.logInTransaction(tx, { ...baseEntry, req });
      expect(txCreate.mock.calls[0][0].data.ipAddress).toBe('203.0.113.42');
    });

    it('falls back to socket.remoteAddress', async () => {
      const req = {
        headers: {},
        socket: { remoteAddress: '198.51.100.5' },
      } as unknown as Request;

      await service.logInTransaction(tx, { ...baseEntry, req });
      expect(txCreate.mock.calls[0][0].data.ipAddress).toBe('198.51.100.5');
    });

    it('returns null when no IP is available', async () => {
      const req = { headers: {}, socket: {} } as unknown as Request;
      await service.logInTransaction(tx, { ...baseEntry, req });

      expect(txCreate.mock.calls[0][0].data.ipAddress).toBeNull();
    });

    it('returns null when req is undefined', async () => {
      await service.logInTransaction(tx, baseEntry);
      expect(txCreate.mock.calls[0][0].data.ipAddress).toBeNull();
    });

    it('caps IP at 45 chars (max IPv6 length)', async () => {
      const longString = 'a'.repeat(100);
      const req = { ip: longString, headers: {}, socket: {} } as unknown as Request;

      await service.logInTransaction(tx, { ...baseEntry, req });
      expect(txCreate.mock.calls[0][0].data.ipAddress).toHaveLength(45);
    });
  });

  describe('User-Agent extraction', () => {
    it('caps user-agent at 500 chars', async () => {
      const req = {
        headers: { 'user-agent': 'x'.repeat(1000) },
        socket: {},
      } as unknown as Request;

      await service.logInTransaction(tx, { ...baseEntry, req });
      expect(txCreate.mock.calls[0][0].data.userAgent).toHaveLength(500);
    });

    it('returns null when user-agent is missing', async () => {
      const req = { headers: {}, socket: {} } as unknown as Request;
      await service.logInTransaction(tx, { ...baseEntry, req });

      expect(txCreate.mock.calls[0][0].data.userAgent).toBeNull();
    });
  });
});
