// ============================================
// 💵 Financial Summary Service — S7 (Stage 5)
//
// NOTHING here is stored. Every figure is recomputed from the DB on each
// request, so there is no `net_due` column anyone could tamper with — the
// only writable inputs are the audited ProjectFinancialSettings.
//
// The formulas (00-plan.md المرحلة 5):
//   totalCompleted    = Σ Update.cost   (APPROVED, not deleted, through
//                       Phase → Project — Update has NO direct projectId)
//   retention         = totalCompleted × retentionPct / 100
//   advanceRecovered  = min(advanceAmount, totalCompleted × advancePct / 100)
//   totalPaid         = Σ Payment.amount (CLIENT_PAYMENT, not deleted)
//   netDue            = totalCompleted − retention − advanceRecovered − totalPaid
//   retentionReleased = warrantyStartDate != null
//                       AND addMonths(warrantyStartDate, warrantyMonths) < today
//
// Decimal-only: no Number() cast touches money. Output crosses the boundary
// as toFixed(2) strings — the frontend must parse with a Decimal library.
// ============================================
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import {
  FinancialSettingsService,
  SettingsState,
} from './financial-settings.service';
import { JwtPayload } from '../../common/decorators';
import { Prisma, UpdateStatus, PaymentType } from '@prisma/client';

const { Decimal } = Prisma;

const ZERO = new Decimal(0);
const HUNDRED = new Decimal(100);

/**
 * Money is rounded to piasters (2dp) at every intermediate step, NOT only on
 * output. Reason: the response must reconcile — a client computing
 * `totalCompleted − retention − advanceRecovered − totalPaid` from the four
 * displayed strings has to land exactly on the displayed `netDue`. Rounding
 * only at the boundary leaves sub-piaster residue that makes the numbers
 * visibly "not add up" and turns every reconciliation into a support ticket.
 */
const money = (d: Prisma.Decimal): Prisma.Decimal =>
  d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

/** UTC midnight of a date — the DATE column has no time component. */
const startOfUtcDay = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * Add whole months, clamping to the last day of the target month
 * (31 Jan + 1 month = 28/29 Feb, never 3 March). This is the standard
 * calendar convention (date-fns `addMonths`) and the one a warranty clause
 * means by "12 months from handover".
 */
const addMonths = (start: Date, months: number): Date => {
  const day = start.getUTCDate();
  const target = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 1),
  );
  const lastDayOfTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDayOfTargetMonth));
  return target;
};

@Injectable()
export class FinancialSummaryService {
  private readonly logger = new Logger(FinancialSummaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly settingsService: FinancialSettingsService,
  ) {}

  // ─── GET /projects/:projectId/financial-summary ────────
  async get(user: JwtPayload, projectId: string) {
    // Layer 3 — cross-tenant and unassigned access die here.
    await this.projectsService.ensureProjectAccess(user, projectId);

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        companyId: user.companyId,
        ...this.prisma.softDeleteFilter,
      },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('المشروع غير موجود');

    const { state } = await this.settingsService.getEffectiveState(
      user,
      projectId,
    );

    // Both sums in ONE transaction: netDue subtracts one from the other, so
    // they must describe the same instant. Read separately, a payment landing
    // between the two queries would produce a netDue that never existed.
    const [completedAgg, paidAgg] = await this.prisma.$transaction([
      this.prisma.update.aggregate({
        _sum: { cost: true },
        where: {
          status: UpdateStatus.APPROVED,
          ...this.prisma.softDeleteFilter,
          // ⚠️ Update has no projectId column — the ONLY correct path to the
          // project is through Phase. companyId is re-asserted here even
          // though ensureProjectAccess passed: this query is what actually
          // decides which rows are summed (defense-in-depth).
          phase: {
            deletedAt: null,
            project: {
              id: projectId,
              companyId: user.companyId,
              deletedAt: null,
            },
          },
        },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          projectId,
          type: PaymentType.CLIENT_PAYMENT,
          ...this.prisma.softDeleteFilter,
          project: { companyId: user.companyId, deletedAt: null },
        },
      }),
    ]);

    const totalCompleted = money(completedAgg._sum.cost ?? ZERO);
    const totalPaid = money(paidAgg._sum.amount ?? ZERO);

    const retention = money(
      totalCompleted.mul(state.retentionPct).div(HUNDRED),
    );

    // The advance is recovered proportionally to progress, but never more
    // than what was actually advanced.
    const advanceRecovered = money(
      Decimal.min(
        state.advanceAmount,
        totalCompleted.mul(state.advancePct).div(HUNDRED),
      ),
    );

    // Computed from the ALREADY-ROUNDED components so the four displayed
    // figures subtract exactly to the displayed netDue.
    // netDue may legitimately be negative (client overpaid / retention and
    // advance exceed the work approved so far) — it is NOT clamped to zero:
    // hiding an over-payment behind a 0.00 would be a financial lie.
    const netDue = totalCompleted
      .minus(retention)
      .minus(advanceRecovered)
      .minus(totalPaid);

    const retentionReleased = this.isRetentionReleased(state);

    // Shared by every role — results only.
    const base = {
      projectId,
      totalCompleted: totalCompleted.toFixed(2),
      retention: retention.toFixed(2),
      advanceRecovered: advanceRecovered.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      netDue: netDue.toFixed(2),
      retentionReleased,
      // Warranty terms are the client's own contract terms and are what makes
      // `retentionReleased` intelligible — they are not internal pricing
      // inputs, so they are NOT withheld from CLIENT.
      warrantyStartDate: state.warrantyStartDate
        ? state.warrantyStartDate.toISOString().slice(0, 10)
        : null,
      warrantyMonths: state.warrantyMonths,
    };

    // CLIENT sees the RESULTS, never the internal inputs that produced them
    // (contract value and the retention/advance percentages are commercial
    // configuration). Built as an explicit branch rather than by deleting
    // keys — a field added later defaults to hidden, not leaked.
    if (user.role === 'CLIENT') return base;

    return {
      ...base,
      contractValue: state.contractValue.toFixed(2),
      retentionPct: state.retentionPct.toFixed(2),
      advanceAmount: state.advanceAmount.toFixed(2),
      advancePct: state.advancePct.toFixed(2),
    };
  }

  /**
   * Retention is released once the warranty period has fully elapsed.
   * No warranty start date ⇒ not handed over yet ⇒ never released.
   * Strict `<`: the last day of the warranty is still inside it.
   */
  private isRetentionReleased(state: SettingsState): boolean {
    if (!state.warrantyStartDate) return false;
    const end = addMonths(
      startOfUtcDay(state.warrantyStartDate),
      state.warrantyMonths,
    );
    return end.getTime() < startOfUtcDay(new Date()).getTime();
  }
}
