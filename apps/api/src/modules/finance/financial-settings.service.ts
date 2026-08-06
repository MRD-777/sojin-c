// ============================================
// 💵 Financial Settings Service — S7 (Stage 4)
//
// Critical guarantees:
//   1. Decimal-only arithmetic — no Number() casts anywhere. Values leave
//      the boundary as `toFixed(2)` strings (same posture as payments).
//   2. Audit is written INSIDE the transaction (logInTransaction) — if the
//      audit insert fails, the settings write rolls back.
//   3. `oldValues` is DERIVED from the row that was read INSIDE the same
//      transaction — never hardcoded, never read outside it (lesson
//      CVE-TEST-016 + a stale-read race would make the audit lie).
//   4. Only the fields that ACTUALLY changed land in old/new values.
//      A PATCH that changes nothing is a no-op: no write, no audit entry.
//   5. GET never writes — a missing row returns the documented defaults.
//
// See:
//   .claude/skills/02-database.md        (transactions, Decimal)
//   .claude/skills/07-audit-compliance.md (logInTransaction, derived oldValues)
// ============================================
import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { ProjectsService } from '../projects/projects.service';
import { UpdateFinancialSettingsDto } from './dto';
import { JwtPayload } from '../../common/decorators';
import { AuditAction, Prisma } from '@prisma/client';
import { Request } from 'express';

const { Decimal } = Prisma;

/** Read shape — never select more than the caller needs. */
const SETTINGS_SELECT = {
  id: true,
  projectId: true,
  contractValue: true,
  retentionPct: true,
  advanceAmount: true,
  advancePct: true,
  warrantyMonths: true,
  warrantyStartDate: true,
} satisfies Prisma.ProjectFinancialSettingsSelect;

type SettingsRow = Prisma.ProjectFinancialSettingsGetPayload<{
  select: typeof SETTINGS_SELECT;
}>;

/** The effective state of a project's settings, row or no row. */
export interface SettingsState {
  contractValue: Prisma.Decimal;
  retentionPct: Prisma.Decimal;
  advanceAmount: Prisma.Decimal;
  advancePct: Prisma.Decimal;
  warrantyMonths: number;
  warrantyStartDate: Date | null;
}

/**
 * ⚠️ MUST mirror the @default values in schema.prisma:566 exactly.
 * These are what GET returns when no row exists, AND the `oldValues` baseline
 * for the very first PATCH — so a drift here would silently produce a lying
 * audit entry, not just a wrong read.
 */
const SETTINGS_DEFAULTS: SettingsState = {
  contractValue: new Decimal(0),
  retentionPct: new Decimal(5),
  advanceAmount: new Decimal(0),
  advancePct: new Decimal(0),
  warrantyMonths: 0,
  warrantyStartDate: null,
};

/** The four Decimal-typed settings fields. */
type DecimalField =
  | 'contractValue'
  | 'retentionPct'
  | 'advanceAmount'
  | 'advancePct';

/** Postgres DATE column → 'YYYY-MM-DD' (no time, no timezone drift). */
const toDateOnly = (d: Date): string => d.toISOString().slice(0, 10);

@Injectable()
export class FinancialSettingsService {
  private readonly logger = new Logger(FinancialSettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly projectsService: ProjectsService,
  ) {}

  // ─── GET /projects/:projectId/financial-settings ───────
  /**
   * Read-only. A project with no settings row yet is NOT an error and does
   * NOT get a row created (no upsert-on-read, plan decision #2) — it returns
   * the schema defaults with `isConfigured: false`.
   */
  async get(user: JwtPayload, projectId: string) {
    // Layer 3 — throws ForbiddenException on cross-tenant / unassigned access.
    await this.projectsService.ensureProjectAccess(user, projectId);

    const { state, isConfigured } = await this.getEffectiveState(user, projectId);

    return this.serialize(projectId, state, isConfigured);
  }

  /**
   * The effective settings as RAW Decimals — the row if it exists, otherwise
   * the documented defaults. Shared with FinancialSummaryService so that
   * SETTINGS_DEFAULTS stays a single source of truth: a second copy of these
   * numbers in the summary would let the two endpoints disagree about the
   * same project's retention.
   *
   * ⚠️ Performs NO authorization — the caller MUST have already run
   * `ensureProjectAccess`. The query is still tenant-scoped through the
   * project relation (defense-in-depth), but that is not an access check.
   */
  async getEffectiveState(
    user: JwtPayload,
    projectId: string,
  ): Promise<{ state: SettingsState; isConfigured: boolean }> {
    const row = await this.readSettings(this.prisma, user, projectId);
    return {
      state: row ? this.toState(row) : SETTINGS_DEFAULTS,
      isConfigured: row !== null,
    };
  }

  // ─── PATCH /projects/:projectId/financial-settings ─────
  /**
   * Upsert + mandatory audit, atomically.
   *
   * No-op rule (user decision, Stage 4): a PATCH whose effective diff is
   * empty — either an empty body `{}` or fields re-sent with their current
   * values — performs NO write and writes NO audit entry, and returns the
   * current state with 200. Rationale: an audit row with oldValues == newValues
   * is noise that buries the real changes it sits between.
   */
  async update(
    user: JwtPayload,
    projectId: string,
    dto: UpdateFinancialSettingsDto,
    req: Request,
  ) {
    await this.projectsService.ensureProjectAccess(user, projectId);

    // Defense-in-depth: ensureProjectAccess already proved the project exists
    // in this company and is not soft-deleted (it throws Forbidden otherwise).
    // This second check keeps the guarantee local — if that gate is ever
    // widened again (it was, for ACCOUNTANT in Stage 2), this service still
    // refuses to write settings onto a deleted / foreign project.
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        companyId: user.companyId,
        ...this.prisma.softDeleteFilter,
      },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('المشروع غير موجود');

    // Everything below runs in ONE serializable transaction: the pre-state
    // read, the diff, the write and the audit. Reading the pre-state outside
    // would let a concurrent PATCH slip in between and make `oldValues`
    // describe a state that never immediately preceded this write.
    const outcome = await this.prisma
      .runSerializable(async (tx) => {
        const existing = await this.readSettings(tx, user, projectId);
        const current = existing ? this.toState(existing) : SETTINGS_DEFAULTS;

        const { patch, oldValues, newValues } = this.buildDiff(dto, current);

        // Nothing actually changes ⇒ no write, no audit.
        if (Object.keys(patch).length === 0) {
          return {
            state: current,
            isConfigured: existing !== null,
            changed: false,
          };
        }

        const saved = await tx.projectFinancialSettings.upsert({
          where: { projectId },
          create: { projectId, ...patch },
          update: patch,
          select: SETTINGS_SELECT,
        });

        await this.auditLog.logInTransaction(tx, {
          companyId: user.companyId,
          userId: user.userId,
          userRole: user.role,
          entityType: 'project_financial_settings',
          entityId: saved.id,
          // CREATE when this PATCH brought the row into existence, UPDATE
          // otherwise. Unlike the generic convention (CREATE ⇒ oldValues
          // null) we DO record oldValues on CREATE: the pre-state was real
          // and observable via GET (the defaults), so "retentionPct 5 → 10"
          // is the truthful record; null would hide it.
          action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
          oldValues,
          newValues: { ...newValues, projectId },
          req,
        });

        return {
          state: this.toState(saved),
          isConfigured: true,
          changed: true,
        };
      })
      .catch((err: unknown) => {
        // Two concurrent FIRST-time PATCHes on the same project: one insert
        // loses the unique index on project_id. runSerializable only retries
        // serialization failures (P2034), so translate this into a retryable
        // 409 instead of leaking a 500.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          throw new ConflictException(
            'تم تعديل الإعدادات المالية من جلسة أخرى — أعد المحاولة',
          );
        }
        throw err;
      });

    if (!outcome.changed) {
      this.logger.log(
        `Financial settings PATCH no-op: project=${projectId} by=${user.userId} (no field changed — no audit entry written)`,
      );
    } else {
      this.logger.log(
        `Financial settings updated: project=${projectId} by=${user.userId}`,
      );
    }

    return this.serialize(projectId, outcome.state, outcome.isConfigured);
  }

  // ─── Internals ─────────────────────────────────────────

  /**
   * Reads the settings row through the project, so companyId + soft-delete
   * are enforced by the query itself (not only by the caller's gate).
   * Works on both PrismaService and a TransactionClient.
   */
  private readSettings(
    client: PrismaService | Prisma.TransactionClient,
    user: JwtPayload,
    projectId: string,
  ): Promise<SettingsRow | null> {
    return client.projectFinancialSettings.findFirst({
      where: {
        projectId,
        project: { companyId: user.companyId, deletedAt: null },
      },
      select: SETTINGS_SELECT,
    });
  }

  private toState(row: SettingsRow): SettingsState {
    return {
      contractValue: row.contractValue,
      retentionPct: row.retentionPct,
      advanceAmount: row.advanceAmount,
      advancePct: row.advancePct,
      warrantyMonths: row.warrantyMonths,
      warrantyStartDate: row.warrantyStartDate,
    };
  }

  /**
   * Diff the DTO against the current effective state.
   *
   * Returns only genuinely changed fields — a field re-sent with its current
   * value contributes nothing to the patch, to `oldValues` or to `newValues`.
   * Decimal comparison uses `.equals()`, never `===` (2 vs 2.00 are equal
   * numbers but different objects).
   */
  private buildDiff(dto: UpdateFinancialSettingsDto, current: SettingsState) {
    const patch: Partial<{
      contractValue: Prisma.Decimal;
      retentionPct: Prisma.Decimal;
      advanceAmount: Prisma.Decimal;
      advancePct: Prisma.Decimal;
      warrantyMonths: number;
      warrantyStartDate: Date;
    }> = {};
    const oldValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    const applyDecimal = (field: DecimalField, input: number | undefined) => {
      if (input === undefined) return;
      const next = new Decimal(input);
      if (next.equals(current[field])) return;
      patch[field] = next;
      oldValues[field] = current[field].toFixed(2);
      newValues[field] = next.toFixed(2);
    };

    applyDecimal('contractValue', dto.contractValue);
    applyDecimal('retentionPct', dto.retentionPct);
    applyDecimal('advanceAmount', dto.advanceAmount);
    applyDecimal('advancePct', dto.advancePct);

    if (
      dto.warrantyMonths !== undefined &&
      dto.warrantyMonths !== current.warrantyMonths
    ) {
      patch.warrantyMonths = dto.warrantyMonths;
      oldValues.warrantyMonths = current.warrantyMonths;
      newValues.warrantyMonths = dto.warrantyMonths;
    }

    if (dto.warrantyStartDate !== undefined) {
      // The column is DATE — pin to UTC midnight of the calendar day the
      // caller sent, so a client in +03:00 cannot shift the warranty by a day.
      const dateOnly = dto.warrantyStartDate.slice(0, 10);
      const next = new Date(`${dateOnly}T00:00:00.000Z`);

      // [CVE-S7-003] `@IsDateString` accepts calendar-impossible dates whose
      // digits are in range — '2026-02-30', '2026-04-31', '2026-02-29' in a
      // non-leap year all pass. `new Date` then rolls them FORWARD silently
      // (2026-02-30 → 2026-03-02), so the stored warranty start — and every
      // retentionReleased decision built on it — is a date the accountant
      // never entered. Round-trip check: what we parsed must be what was sent.
      if (
        Number.isNaN(next.getTime()) ||
        next.toISOString().slice(0, 10) !== dateOnly
      ) {
        throw new BadRequestException('تاريخ بداية الضمان غير صالح');
      }
      const currentDateOnly = current.warrantyStartDate
        ? toDateOnly(current.warrantyStartDate)
        : null;

      if (dateOnly !== currentDateOnly) {
        patch.warrantyStartDate = next;
        oldValues.warrantyStartDate = currentDateOnly;
        newValues.warrantyStartDate = dateOnly;
      }
    }

    return { patch, oldValues, newValues };
  }

  /**
   * Boundary serialization: Decimal → fixed-2 strings, DATE → 'YYYY-MM-DD'.
   * `isConfigured: false` tells the client these are defaults nobody chose —
   * a 5% retention shown as if the accountant had set it would be a lie.
   */
  private serialize(
    projectId: string,
    state: SettingsState,
    isConfigured: boolean,
  ) {
    return {
      projectId,
      contractValue: state.contractValue.toFixed(2),
      retentionPct: state.retentionPct.toFixed(2),
      advanceAmount: state.advanceAmount.toFixed(2),
      advancePct: state.advancePct.toFixed(2),
      warrantyMonths: state.warrantyMonths,
      warrantyStartDate: state.warrantyStartDate
        ? toDateOnly(state.warrantyStartDate)
        : null,
      isConfigured,
    };
  }
}
