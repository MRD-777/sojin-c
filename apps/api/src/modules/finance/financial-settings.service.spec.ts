// ============================================
// FinancialSettingsService — MVT (S7)
//
// Covers:
//   MVT-1  GET with no row → documented defaults, and NOTHING is written.
//   MVT-2  PATCH audit: oldValues derived from the ACTUAL row + the exact
//          submitted value reaches `upsert` (rule #4 — the deepest layer
//          representable in the mock is the upsert argument, not "the audit
//          service was called").
//   MVT-2b First PATCH (no row) → action CREATE with oldValues = defaults.
//   MVT-3  No-op PATCH ({} and same-value) → zero write, zero audit.
//   MVT-15 CVE-S7-003 — calendar-impossible dates rejected; a valid date is
//          stored EXACTLY as sent (no silent rollover).
// ============================================
import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FinancialSettingsService } from './financial-settings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { ProjectsService } from '../projects/projects.service';
import type { JwtPayload } from '../../common/decorators';
import type { Request } from 'express';

const { Decimal } = Prisma;

const mockReq = {
  ip: '203.0.113.7',
  headers: { 'user-agent': 'jest' },
} as unknown as Request;

const accountant: JwtPayload = {
  sub: 'sup-acc',
  email: 'acc@co.test',
  userId: 'user-acc',
  companyId: 'co-A',
  role: 'ACCOUNTANT',
  permissions: [],
};

interface SettingsRowShape {
  id: string;
  projectId: string;
  contractValue: Prisma.Decimal;
  retentionPct: Prisma.Decimal;
  advanceAmount: Prisma.Decimal;
  advancePct: Prisma.Decimal;
  warrantyMonths: number;
  warrantyStartDate: Date | null;
}

const row = (over: Partial<SettingsRowShape> = {}): SettingsRowShape => ({
  id: 'set-1',
  projectId: 'proj-1',
  contractValue: new Decimal('1000.00'),
  retentionPct: new Decimal('5'),
  advanceAmount: new Decimal('0'),
  advancePct: new Decimal('0'),
  warrantyMonths: 0,
  warrantyStartDate: null,
  ...over,
});

function buildHarness() {
  const settings = {
    findFirst: jest.fn(),
    upsert: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const project = { findFirst: jest.fn().mockResolvedValue({ id: 'proj-1' }) };

  const prisma: Record<string, unknown> = {
    projectFinancialSettings: settings,
    project,
    softDeleteFilter: { deletedAt: null },
  };
  // The callback receives the same mock as `tx`, so assertions on
  // `settings.upsert` match calls made through `tx`.
  prisma.runSerializable = jest.fn(
    async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  );

  const audit = {
    logInTransaction: jest.fn().mockResolvedValue(undefined),
    log: jest.fn(),
  };
  const ensureProjectAccess = jest.fn().mockResolvedValue(undefined);

  const service = new FinancialSettingsService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditLogService,
    { ensureProjectAccess } as unknown as ProjectsService,
  );

  return { service, settings, project, audit, ensureProjectAccess, prisma };
}

describe('FinancialSettingsService', () => {
  // ─── MVT-1 ───────────────────────────────────────────────
  describe('MVT-1 — GET with no settings row', () => {
    it('returns the documented defaults and writes NOTHING', async () => {
      const h = buildHarness();
      h.settings.findFirst.mockResolvedValue(null);

      const res = await h.service.get(accountant, 'proj-1');

      expect(res).toEqual({
        projectId: 'proj-1',
        contractValue: '0.00',
        retentionPct: '5.00', // mirrors schema.prisma @default(5)
        advanceAmount: '0.00',
        advancePct: '0.00',
        warrantyMonths: 0,
        warrantyStartDate: null,
        isConfigured: false,
      });

      // PAIRED: "returns defaults" is worthless unless nothing was persisted.
      expect(h.settings.upsert).not.toHaveBeenCalled();
      expect(h.settings.create).not.toHaveBeenCalled();
      expect(h.settings.update).not.toHaveBeenCalled();
      expect(h.prisma.runSerializable).not.toHaveBeenCalled();
    });

    it('scopes the read through the project (tenant + soft-delete)', async () => {
      const h = buildHarness();
      h.settings.findFirst.mockResolvedValue(null);

      await h.service.get(accountant, 'proj-1');

      const where = h.settings.findFirst.mock.calls[0][0].where;
      expect(where.projectId).toBe('proj-1');
      expect(where.project).toEqual({ companyId: 'co-A', deletedAt: null });
      expect(h.ensureProjectAccess).toHaveBeenCalledWith(accountant, 'proj-1');
    });
  });

  // ─── MVT-2 ───────────────────────────────────────────────
  describe('MVT-2 — PATCH writes audit with derived oldValues', () => {
    it('sends the EXACT submitted value to upsert and audits old→new', async () => {
      const h = buildHarness();
      h.settings.findFirst.mockResolvedValue(row());
      h.settings.upsert.mockResolvedValue(
        row({ contractValue: new Decimal('2500.50') }),
      );

      const res = await h.service.update(
        accountant,
        'proj-1',
        { contractValue: 2500.5 },
        mockReq,
      );

      // PAIRED (deepest representable): the value that actually reached Prisma.
      const args = h.settings.upsert.mock.calls[0][0];
      expect(args.where).toEqual({ projectId: 'proj-1' });
      expect(args.update.contractValue.toFixed(2)).toBe('2500.50');
      expect(args.create.contractValue.toFixed(2)).toBe('2500.50');
      expect(args.create.projectId).toBe('proj-1');
      // ONLY the changed field is written — untouched fields are not echoed.
      expect(Object.keys(args.update)).toEqual(['contractValue']);

      const entry = h.audit.logInTransaction.mock.calls[0][1];
      expect(entry.entityType).toBe('project_financial_settings');
      expect(entry.action).toBe('UPDATE');
      expect(entry.entityId).toBe('set-1');
      // oldValues derived from the row that was read, not hardcoded.
      expect(entry.oldValues).toEqual({ contractValue: '1000.00' });
      expect(entry.newValues).toEqual({
        contractValue: '2500.50',
        projectId: 'proj-1',
      });

      expect(res.contractValue).toBe('2500.50');
      expect(res.isConfigured).toBe(true);
    });

    it('MVT-2b — first PATCH (no row) audits CREATE with defaults as oldValues', async () => {
      const h = buildHarness();
      h.settings.findFirst.mockResolvedValue(null);
      h.settings.upsert.mockResolvedValue(
        row({ retentionPct: new Decimal('10') }),
      );

      await h.service.update(
        accountant,
        'proj-1',
        { retentionPct: 10 },
        mockReq,
      );

      const entry = h.audit.logInTransaction.mock.calls[0][1];
      expect(entry.action).toBe('CREATE');
      // The pre-state was real and observable via GET — recorded, not null.
      expect(entry.oldValues).toEqual({ retentionPct: '5.00' });
      expect(entry.newValues).toEqual({
        retentionPct: '10.00',
        projectId: 'proj-1',
      });
    });

    it('reads the pre-state INSIDE the transaction (not before it)', async () => {
      const h = buildHarness();
      h.settings.findFirst.mockResolvedValue(row());
      h.settings.upsert.mockResolvedValue(row({ warrantyMonths: 24 }));

      await h.service.update(
        accountant,
        'proj-1',
        { warrantyMonths: 24 },
        mockReq,
      );

      // The only settings read happens through the tx client handed to
      // runSerializable — a read before it would make oldValues stale.
      expect(h.prisma.runSerializable).toHaveBeenCalledTimes(1);
      expect(h.settings.findFirst).toHaveBeenCalledTimes(1);
    });
  });

  // ─── MVT-3 ───────────────────────────────────────────────
  describe('MVT-3 — no-op PATCH', () => {
    it('empty body {} → no write, no audit entry', async () => {
      const h = buildHarness();
      h.settings.findFirst.mockResolvedValue(row());

      const res = await h.service.update(accountant, 'proj-1', {}, mockReq);

      expect(h.settings.upsert).not.toHaveBeenCalled();
      expect(h.audit.logInTransaction).not.toHaveBeenCalled();
      expect(res.contractValue).toBe('1000.00');
      expect(res.isConfigured).toBe(true);
    });

    it('same values re-sent → no write, no audit entry (2 vs 2.00 are equal)', async () => {
      const h = buildHarness();
      h.settings.findFirst.mockResolvedValue(row());

      await h.service.update(
        accountant,
        'proj-1',
        { contractValue: 1000, retentionPct: 5, warrantyMonths: 0 },
        mockReq,
      );

      expect(h.settings.upsert).not.toHaveBeenCalled();
      expect(h.audit.logInTransaction).not.toHaveBeenCalled();
    });

    it('a real change alongside unchanged fields writes ONLY the change', async () => {
      const h = buildHarness();
      h.settings.findFirst.mockResolvedValue(row());
      h.settings.upsert.mockResolvedValue(row({ advancePct: new Decimal('20') }));

      await h.service.update(
        accountant,
        'proj-1',
        { contractValue: 1000, advancePct: 20 }, // contractValue unchanged
        mockReq,
      );

      const args = h.settings.upsert.mock.calls[0][0];
      expect(Object.keys(args.update)).toEqual(['advancePct']);
      const entry = h.audit.logInTransaction.mock.calls[0][1];
      expect(entry.oldValues).toEqual({ advancePct: '0.00' });
    });
  });

  // ─── MVT-15 (CVE-S7-003) ─────────────────────────────────
  describe('MVT-15 — CVE-S7-003 calendar-impossible warrantyStartDate', () => {
    it.each(['2026-02-30', '2026-04-31', '2026-02-29'])(
      'rejects %s with 400 and writes nothing',
      async (bad) => {
        const h = buildHarness();
        h.settings.findFirst.mockResolvedValue(row());

        await expect(
          h.service.update(
            accountant,
            'proj-1',
            { warrantyStartDate: bad },
            mockReq,
          ),
        ).rejects.toBeInstanceOf(BadRequestException);

        // PAIRED: rejection is only meaningful if nothing was persisted.
        expect(h.settings.upsert).not.toHaveBeenCalled();
        expect(h.audit.logInTransaction).not.toHaveBeenCalled();
      },
    );

    it('stores a real date EXACTLY as sent — no rollover, no timezone drift', async () => {
      const h = buildHarness();
      h.settings.findFirst.mockResolvedValue(row());
      h.settings.upsert.mockResolvedValue(
        row({ warrantyStartDate: new Date('2026-02-28T00:00:00.000Z') }),
      );

      const res = await h.service.update(
        accountant,
        'proj-1',
        { warrantyStartDate: '2026-02-28' },
        mockReq,
      );

      // PAIRED (deepest): the Date object handed to Prisma, not the response.
      const stored: Date =
        h.settings.upsert.mock.calls[0][0].update.warrantyStartDate;
      expect(stored.toISOString()).toBe('2026-02-28T00:00:00.000Z');
      expect(res.warrantyStartDate).toBe('2026-02-28');
    });

    it('a +03:00 timestamp cannot shift the stored calendar day', async () => {
      const h = buildHarness();
      h.settings.findFirst.mockResolvedValue(row());
      h.settings.upsert.mockResolvedValue(
        row({ warrantyStartDate: new Date('2026-02-28T00:00:00.000Z') }),
      );

      await h.service.update(
        accountant,
        'proj-1',
        { warrantyStartDate: '2026-02-28T23:30:00+03:00' },
        mockReq,
      );

      const stored: Date =
        h.settings.upsert.mock.calls[0][0].update.warrantyStartDate;
      expect(stored.toISOString().slice(0, 10)).toBe('2026-02-28');
    });
  });
});
