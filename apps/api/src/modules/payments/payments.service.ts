// ============================================
// 💰 Payments Service — Enterprise-grade
//
// Critical guarantees:
//   1. Soft-delete only — `prisma.payment.delete()` is NEVER called.
//   2. Audit log writes happen INSIDE the transaction (logInTransaction).
//      If the audit fails, the financial operation rolls back.
//   3. Money arithmetic uses Prisma Decimal — no Number(...) casts in sums.
//   4. All queries filter by soft-delete flag AND multi-tenant companyId.
//   5. Reason is mandatory for soft-deletes (DTO-enforced + skill 07).
//
// See:
//   .claude/skills/02-database.md       (soft delete, transactions, Decimal)
//   .claude/skills/07-audit-compliance.md (logInTransaction, reasons)
// ============================================
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { ProjectsService } from '../projects/projects.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { CreatePaymentDto, DeletePaymentDto, ListPaymentsQueryDto } from './dto';
import { JwtPayload } from '../../common/decorators';
import { AuditAction, Prisma, PaymentType } from '@prisma/client';
import { Request } from 'express';

const { Decimal } = Prisma;

/**
 * Safe payment projection — never include relations not needed by the caller.
 * Centralized so all reads use the same shape (consistency + no leaks).
 */
const PAYMENT_SELECT = {
  id: true,
  projectId: true,
  amount: true,
  type: true,
  method: true,
  description: true,
  receiptUrl: true,
  date: true,
  createdAt: true,
  recorder: { select: { id: true, name: true } },
} satisfies Prisma.PaymentSelect;

/** Max page size — defense against malicious clients asking for huge pages. */
const MAX_PAGE_SIZE = 100;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly projectsService: ProjectsService,
    private readonly idempotency: IdempotencyService,
  ) {}

  // ─── List Payments for a Project ───────────────────────
  async findAll(
    user: JwtPayload,
    projectId: string,
    query: ListPaymentsQueryDto,
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, query.limit ?? 20));
    const sortBy = query.sortBy ?? 'date';
    const sortOrder = query.sortOrder ?? 'desc';

    // Layer 3 authorization — ensures the user can access this project.
    // Throws ForbiddenException / NotFoundException on cross-tenant access.
    await this.projectsService.ensureProjectAccess(user, projectId);

    // Defense-in-depth: filter by company AND soft-delete, even though
    // ensureProjectAccess already validated the project.
    const where: Prisma.PaymentWhereInput = {
      projectId,
      project: { companyId: user.companyId },
      ...this.prisma.softDeleteFilter, // { deletedAt: null }
    };

    if (query.type) where.type = query.type;
    if (query.method) where.method = query.method;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        select: PAYMENT_SELECT,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Get Single Payment ────────────────────────────────
  async findOne(user: JwtPayload, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        project: { companyId: user.companyId },
        ...this.prisma.softDeleteFilter,
      },
      select: { ...PAYMENT_SELECT },
    });

    if (!payment) throw new NotFoundException('الدفعة غير موجودة');

    // Layer 3: ensure the user has access to the parent project
    // (e.g., a CLIENT must own the project; assigned engineers OK).
    await this.projectsService.ensureProjectAccess(user, payment.projectId);

    return payment;
  }

  // ─── Get Financial Summary ─────────────────────────────
  /**
   * Returns totals for a project. All sums use Decimal — NO float arithmetic.
   * Soft-deleted payments are excluded.
   */
  async getSummary(user: JwtPayload, projectId: string) {
    await this.projectsService.ensureProjectAccess(user, projectId);

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        companyId: user.companyId,
        ...this.prisma.softDeleteFilter,
      },
      select: { totalBudget: true },
    });

    if (!project) throw new NotFoundException('المشروع غير موجود');

    const payments = await this.prisma.payment.groupBy({
      by: ['type'],
      where: {
        projectId,
        project: { companyId: user.companyId },
        ...this.prisma.softDeleteFilter,
      },
      _sum: { amount: true },
      _count: true,
    });

    // ⚠️ DO NOT use Number(_sum.amount). Decimal arithmetic only — financial precision.
    const zero = new Decimal(0);

    const totalIncome = payments
      .filter((p) => p.type === PaymentType.CLIENT_PAYMENT)
      .reduce((sum, p) => sum.plus(p._sum.amount ?? zero), zero);

    const totalExpenses = payments
      .filter((p) => p.type !== PaymentType.CLIENT_PAYMENT)
      .reduce((sum, p) => sum.plus(p._sum.amount ?? zero), zero);

    const budget = project.totalBudget; // already Decimal
    const netProfit = totalIncome.minus(totalExpenses);
    const remainingBudget = budget.minus(totalExpenses);

    // Serialize as strings at the boundary — preserves precision over JSON.
    // The Frontend should parse with a Decimal library; never JS Number.
    return {
      budget: budget.toFixed(2),
      totalIncome: totalIncome.toFixed(2),
      totalExpenses: totalExpenses.toFixed(2),
      netProfit: netProfit.toFixed(2),
      remainingBudget: remainingBudget.toFixed(2),
      breakdown: payments.map((p) => ({
        type: p.type,
        total: (p._sum.amount ?? zero).toFixed(2),
        count: p._count,
      })),
    };
  }

  // ─── Create Payment (idempotent) ───────────────────────
  /**
   * Creates a payment. Idempotent on `Idempotency-Key` header:
   *   - First call: runs the transaction, caches the response 24h.
   *   - Retry with same key + same body: returns the cached response.
   *   - Retry with same key + DIFFERENT body: 422 (caller bug).
   *
   * Why idempotency matters here:
   *   Double-clicked "save" button on slow connection = 2 identical
   *   payment rows = client over-billed. Stripe-style Idempotency-Key
   *   eliminates that class of bug.
   */
  async create(
    user: JwtPayload,
    projectId: string,
    dto: CreatePaymentDto,
    idempotencyKey: string,
    req: Request,
  ) {
    // 1. Idempotency check — fingerprint includes projectId so the same key
    //    used across two different projects is treated as a developer bug.
    const fingerprintBody = { projectId, ...dto };
    const cached = await this.idempotency.lookup<Record<string, unknown>>(
      user.companyId,
      idempotencyKey,
      fingerprintBody,
    );
    if (cached) {
      this.logger.log(
        `Payment create idempotent hit: key=${idempotencyKey} user=${user.userId}`,
      );
      return cached.body;
    }

    // 2. Authorization
    await this.projectsService.ensureProjectAccess(user, projectId);

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        companyId: user.companyId,
        ...this.prisma.softDeleteFilter,
      },
      select: { id: true, status: true },
    });
    if (!project) throw new NotFoundException('المشروع غير موجود');

    if (project.status === 'CANCELLED') {
      throw new BadRequestException(
        'لا يمكن تسجيل مدفوعات على مشروع ملغى',
      );
    }

    // 3. Persist + audit + cache the idempotency record in ONE Serializable
    //    transaction. PAY-IDEM-001 (Session 2026-05-30): the old
    //    `idempotency.save` ran AFTER commit — the exact CVE-UPD-002 race on
    //    a money endpoint. If the save failed (or the process crashed)
    //    between commit and save, the payment was committed but the key was
    //    left uncached, so a retry with the same Idempotency-Key created a
    //    SECOND payment row (double-billing). saveInTransaction commits the
    //    cached record atomically with the payment. runSerializable adds
    //    P2034 retry so a serialization abort re-runs transparently.
    const responseBody = await this.prisma.runSerializable(async (tx) => {
      const created = await tx.payment.create({
        data: {
          projectId,
          amount: new Decimal(dto.amount),
          type: dto.type,
          method: dto.method,
          description: dto.description,
          receiptUrl: dto.receiptUrl,
          date: dto.date ? new Date(dto.date) : new Date(),
          recordedBy: user.userId,
        },
        select: PAYMENT_SELECT,
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: user.companyId,
        userId: user.userId,
        userRole: user.role,
        entityType: 'payment',
        entityId: created.id,
        action: AuditAction.CREATE,
        oldValues: null,
        newValues: {
          amount: created.amount.toFixed(2),
          type: created.type,
          method: created.method,
          projectId: created.projectId,
          date: created.date.toISOString(),
          idempotencyKey,
        },
        req,
      });

      // Normalize the body (Decimal → string, Date → ISO) so the first-call
      // response and the cached replay share an identical shape (the
      // CVE-UPD-009 posture). Cache it INSIDE the tx via saveInTransaction.
      const body = {
        ...created,
        amount: created.amount.toFixed(2),
        date: created.date.toISOString(),
      };

      await this.idempotency.saveInTransaction(
        tx,
        user.companyId,
        idempotencyKey,
        fingerprintBody,
        { statusCode: 201, body },
      );

      return body;
    });

    this.logger.log(
      `Payment created: ${responseBody.id} project=${projectId} amount=${responseBody.amount} by=${user.userId}`,
    );

    return responseBody;
  }

  // ─── Soft-Delete Payment ───────────────────────────────
  /**
   * SOFT-DELETE — replaces the previous `prisma.payment.delete()` (C1).
   *
   * Hard delete on financial records is forbidden:
   *   - Tax/audit obligation: 7-year retention (Egyptian Commercial Law).
   *   - Dispute defensibility: the row must survive for evidence.
   *   - Reversal accounting: a deleted payment leaves a hole in totals;
   *     a soft-deleted one is still queryable for forensic reconstruction.
   *
   * The reason is mandatory and lands in BOTH:
   *   - payment.deletionReason (queryable)
   *   - audit_logs.reason (legally protected via DB trigger)
   */
  async softDelete(
    user: JwtPayload,
    paymentId: string,
    dto: DeletePaymentDto,
    req: Request,
  ) {
    // First, fetch + ownership check OUTSIDE the transaction. This avoids
    // wasting a transaction slot on a NotFound case.
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        project: { companyId: user.companyId },
      },
      include: {
        project: { select: { id: true, companyId: true } },
      },
    });

    if (!payment) throw new NotFoundException('الدفعة غير موجودة');

    if (payment.deletedAt) {
      throw new BadRequestException('الدفعة محذوفة بالفعل');
    }

    // Soft delete + audit in a single Serializable transaction.
    await this.prisma.$transaction(
      async (tx) => {
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            deletedAt: new Date(),
            deletedBy: user.userId,
            deletionReason: dto.reason,
          },
        });

        // If this throws, the soft-delete rolls back.
        await this.auditLog.logInTransaction(tx, {
          companyId: user.companyId,
          userId: user.userId,
          userRole: user.role,
          entityType: 'payment',
          entityId: paymentId,
          action: AuditAction.DELETE,
          oldValues: {
            amount: payment.amount.toFixed(2),
            type: payment.type,
            method: payment.method,
            date: payment.date.toISOString(),
            description: payment.description,
          },
          newValues: null,
          reason: dto.reason,
          req,
        });
      },
      { isolationLevel: 'Serializable' },
    );

    this.logger.log(
      `Payment soft-deleted: ${paymentId} by=${user.userId} reason="${dto.reason.substring(0, 60)}..."`,
    );

    return { message: 'تم حذف الدفعة' };
  }
}
