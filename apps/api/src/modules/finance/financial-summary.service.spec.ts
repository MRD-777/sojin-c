// ============================================
// FinancialSummaryService — MVT (S7)
//
// Covers:
//   MVT-4 Full calculation against known numbers, INCLUDING reconciliation
//         (the four displayed strings must subtract exactly to the displayed
//         netDue) and the Update → Phase → Project join path.
//   MVT-5 CLIENT projection — the four internal inputs are ABSENT
//         (`not.toHaveProperty`), asserted from both sides.
//   MVT-6 retentionReleased boundaries + month-end clamping.
// ============================================
import 'reflect-metadata';
import { Prisma } from '@prisma/client';
import { FinancialSummaryService } from './financial-summary.service';
import {
  FinancialSettingsService,
  type SettingsState,
} from './financial-settings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import type { JwtPayload } from '../../common/decorators';

const { Decimal } = Prisma;

const accountant: JwtPayload = {
  sub: 'sup-acc',
  email: 'acc@co.test',
  userId: 'user-acc',
  companyId: 'co-A',
  role: 'ACCOUNTANT',
  permissions: [],
};

const client: JwtPayload = { ...accountant, role: 'CLIENT', userId: 'user-cli' };

const state = (over: Partial<SettingsState> = {}): SettingsState => ({
  contractValue: new Decimal('0'),
  retentionPct: new Decimal('5'),
  advanceAmount: new Decimal('0'),
  advancePct: new Decimal('0'),
  warrantyMonths: 0,
  warrantyStartDate: null,
  ...over,
});

function buildHarness(opts: {
  settings?: SettingsState;
  completed?: string | null;
  paid?: string | null;
}) {
  const update = {
    aggregate: jest.fn().mockResolvedValue({
      _sum: { cost: opts.completed === null ? null : new Decimal(opts.completed ?? '0') },
    }),
  };
  const payment = {
    aggregate: jest.fn().mockResolvedValue({
      _sum: { amount: opts.paid === null ? null : new Decimal(opts.paid ?? '0') },
    }),
  };
  const project = { findFirst: jest.fn().mockResolvedValue({ id: 'proj-1' }) };

  const prisma: Record<string, unknown> = {
    update,
    payment,
    project,
    softDeleteFilter: { deletedAt: null },
    $transaction: jest.fn(async (arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : arg,
    ),
  };

  const ensureProjectAccess = jest.fn().mockResolvedValue(undefined);
  const getEffectiveState = jest.fn().mockResolvedValue({
    state: opts.settings ?? state(),
    isConfigured: true,
  });

  const service = new FinancialSummaryService(
    prisma as unknown as PrismaService,
    { ensureProjectAccess } as unknown as ProjectsService,
    { getEffectiveState } as unknown as FinancialSettingsService,
  );

  return { service, update, payment, project, prisma, ensureProjectAccess };
}

/** The response must be self-consistent, not merely plausible. */
const reconciles = (r: Record<string, string>): boolean =>
  new Decimal(r.totalCompleted)
    .minus(r.retention)
    .minus(r.advanceRecovered)
    .minus(r.totalPaid)
    .toFixed(2) === r.netDue;

describe('FinancialSummaryService', () => {
  // ─── MVT-4 ───────────────────────────────────────────────
  describe('MVT-4 — calculation against known numbers', () => {
    it('computes the five figures and reconciles exactly', async () => {
      const h = buildHarness({
        completed: '1000000.00',
        paid: '300000.00',
        settings: state({
          retentionPct: new Decimal('5'),
          advanceAmount: new Decimal('200000'),
          advancePct: new Decimal('20'),
        }),
      });

      const res = (await h.service.get(accountant, 'proj-1')) as unknown as Record<
        string,
        string
      >;

      expect(res.totalCompleted).toBe('1000000.00');
      expect(res.retention).toBe('50000.00');
      expect(res.advanceRecovered).toBe('200000.00');
      expect(res.totalPaid).toBe('300000.00');
      expect(res.netDue).toBe('450000.00');
      expect(reconciles(res)).toBe(true);
    });

    it('sums approved updates through Phase → Project, never a direct projectId', async () => {
      const h = buildHarness({ completed: '100.00', paid: '0' });

      await h.service.get(accountant, 'proj-1');

      const where = h.update.aggregate.mock.calls[0][0].where;
      // Update has NO projectId column — the join must go through the phase.
      expect(where).not.toHaveProperty('projectId');
      expect(where.status).toBe('APPROVED');
      expect(where.deletedAt).toBeNull();
      expect(where.phase.deletedAt).toBeNull();
      expect(where.phase.project).toEqual({
        id: 'proj-1',
        companyId: 'co-A',
        deletedAt: null,
      });

      const payWhere = h.payment.aggregate.mock.calls[0][0].where;
      expect(payWhere.type).toBe('CLIENT_PAYMENT');
      expect(payWhere.projectId).toBe('proj-1');
      expect(payWhere.deletedAt).toBeNull();
      expect(payWhere.project).toEqual({
        companyId: 'co-A',
        deletedAt: null,
      });
    });

    it('caps advanceRecovered at the amount actually advanced', async () => {
      const h = buildHarness({
        completed: '1000000.00',
        paid: '0',
        settings: state({
          advanceAmount: new Decimal('50000'),
          advancePct: new Decimal('20'), // proportional = 200,000
        }),
      });

      const res = (await h.service.get(accountant, 'proj-1')) as unknown as Record<
        string,
        string
      >;

      expect(res.advanceRecovered).toBe('50000.00');
      expect(reconciles(res)).toBe(true);
    });

    it('rounds every component to piasters and still reconciles (7.5% of 333.33)', async () => {
      const h = buildHarness({
        completed: '333.33',
        paid: '0',
        settings: state({
          retentionPct: new Decimal('7.5'),
          advanceAmount: new Decimal('1000'),
          advancePct: new Decimal('10'),
        }),
      });

      const res = (await h.service.get(accountant, 'proj-1')) as unknown as Record<
        string,
        string
      >;

      expect(res.retention).toBe('25.00'); // 24.99975 → 25.00
      expect(res.advanceRecovered).toBe('33.33'); // 33.333 → 33.33
      expect(res.netDue).toBe('275.00');
      expect(reconciles(res)).toBe(true);
    });

    it('treats an empty project as zeros, not a crash', async () => {
      const h = buildHarness({ completed: null, paid: null });

      const res = (await h.service.get(accountant, 'proj-1')) as unknown as Record<
        string,
        string
      >;

      expect(res.totalCompleted).toBe('0.00');
      expect(res.totalPaid).toBe('0.00');
      expect(res.netDue).toBe('0.00');
    });

    it('reports an over-payment as a NEGATIVE netDue (never clamped to zero)', async () => {
      const h = buildHarness({ completed: '100000.00', paid: '150000.00' });

      const res = (await h.service.get(accountant, 'proj-1')) as unknown as Record<
        string,
        string
      >;

      expect(res.netDue).toBe('-55000.00');
      expect(reconciles(res)).toBe(true);
    });
  });

  // ─── MVT-5 ───────────────────────────────────────────────
  describe('MVT-5 — CLIENT projection', () => {
    const internals = [
      'contractValue',
      'retentionPct',
      'advanceAmount',
      'advancePct',
    ];

    it('withholds every internal pricing input from a CLIENT', async () => {
      const h = buildHarness({
        completed: '1000.00',
        paid: '0',
        settings: state({
          contractValue: new Decimal('999999'),
          retentionPct: new Decimal('7'),
          advanceAmount: new Decimal('500'),
          advancePct: new Decimal('9'),
        }),
      });

      const res = await h.service.get(client, 'proj-1');

      for (const key of internals) {
        expect(res).not.toHaveProperty(key);
      }
      // …while still returning the results the client is entitled to.
      expect(res).toHaveProperty('netDue');
      expect(res).toHaveProperty('retention');
      expect(res).toHaveProperty('totalCompleted');
      expect(res).toHaveProperty('totalPaid');
      expect(res).toHaveProperty('advanceRecovered');
      expect(res).toHaveProperty('retentionReleased');
    });

    it('and returns those same inputs to a non-CLIENT (two-sided proof)', async () => {
      const h = buildHarness({ completed: '1000.00', paid: '0' });

      const res = await h.service.get(accountant, 'proj-1');

      for (const key of internals) {
        expect(res).toHaveProperty(key);
      }
    });

    it('gives the CLIENT identical money figures — the numbers are not altered, only the inputs hidden', async () => {
      const settings = state({
        retentionPct: new Decimal('5'),
        advanceAmount: new Decimal('100'),
        advancePct: new Decimal('10'),
      });
      const asClient = (await buildHarness({
        completed: '1000.00',
        paid: '200.00',
        settings,
      }).service.get(client, 'proj-1')) as unknown as Record<string, string>;
      const asAccountant = (await buildHarness({
        completed: '1000.00',
        paid: '200.00',
        settings,
      }).service.get(accountant, 'proj-1')) as unknown as Record<string, string>;

      expect(asClient.netDue).toBe(asAccountant.netDue);
      expect(asClient.retention).toBe(asAccountant.retention);
      expect(asClient.advanceRecovered).toBe(asAccountant.advanceRecovered);
    });
  });

  // ─── MVT-6 ───────────────────────────────────────────────
  describe('MVT-6 — retentionReleased', () => {
    afterEach(() => jest.useRealTimers());

    const at = (iso: string) => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(iso));
    };

    const released = async (
      startDate: string | null,
      months: number,
    ): Promise<boolean> => {
      const h = buildHarness({
        completed: '0',
        paid: '0',
        settings: state({
          warrantyMonths: months,
          warrantyStartDate: startDate ? new Date(startDate) : null,
        }),
      });
      const res = (await h.service.get(accountant, 'proj-1')) as unknown as {
        retentionReleased: boolean;
      };
      return res.retentionReleased;
    };

    it('is false when the project was never handed over (no start date)', async () => {
      at('2026-08-03T09:00:00.000Z');
      expect(await released(null, 0)).toBe(false);
      expect(await released(null, 12)).toBe(false);
    });

    it('is true once the warranty has fully elapsed', async () => {
      at('2026-08-03T09:00:00.000Z');
      expect(await released('2025-01-01T00:00:00.000Z', 12)).toBe(true);
    });

    it('is false while the warranty is still running', async () => {
      at('2026-08-03T09:00:00.000Z');
      expect(await released('2026-01-01T00:00:00.000Z', 12)).toBe(false);
    });

    it('is false ON the final day and true the day after (strict <)', async () => {
      at('2026-08-03T09:00:00.000Z');
      expect(await released('2026-08-03T00:00:00.000Z', 0)).toBe(false);
      expect(await released('2026-08-02T00:00:00.000Z', 0)).toBe(true);
    });

    it('clamps month-end instead of rolling over: 31 Jan + 1 month = 28 Feb', async () => {
      // Discriminating date: on 1 March, a CLAMPED end (28 Feb) is already
      // past ⇒ true. A rolled-over end (3 March) would still be future ⇒
      // false. This test fails if the clamping is ever removed.
      at('2026-03-01T09:00:00.000Z');
      expect(await released('2026-01-31T00:00:00.000Z', 1)).toBe(true);
    });

    it('handles a leap-day start: 29 Feb 2024 + 12 months = 28 Feb 2025', async () => {
      at('2025-03-01T09:00:00.000Z');
      expect(await released('2024-02-29T00:00:00.000Z', 12)).toBe(true);
      at('2025-02-27T09:00:00.000Z');
      expect(await released('2024-02-29T00:00:00.000Z', 12)).toBe(false);
    });
  });
});
