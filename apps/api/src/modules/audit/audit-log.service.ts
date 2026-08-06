// ============================================
// 🔍 Audit Log Service — Append-only audit trail
//
// Two write paths:
//
//   1. logInTransaction(tx, entry)
//      → For state-changing / financial operations.
//      → Runs inside the caller's $transaction.
//      → If the audit insert fails, the WHOLE transaction rolls back.
//      → This is the default for: payments, updates, projects, phases,
//        users (role change), companies (settings).
//
//   2. log(entry)
//      → For best-effort, non-critical events (access logs, exports).
//      → Logs the failure but does NOT throw.
//      → Use sparingly — when in doubt, use logInTransaction.
//
// Why two paths?
// Skill 07 (audit-compliance) is explicit:
//   "If it didn't get audited, it didn't happen."
// For financial actions, audit failure MUST roll back the action.
// For non-financial reads/exports, swallowing is acceptable
// (we lose visibility, not money).
// ============================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditAction, Prisma } from '@prisma/client';
import { Request } from 'express';
import { RequestContext } from '../../common/context/request-context';

/**
 * Shape of a single audit entry.
 *
 * @property companyId   The tenant. Required for multi-tenant queries.
 * @property userId      Who performed the action.
 * @property userRole    Snapshot of the role at the time of the action.
 *                       Stored as string because the user's role may change
 *                       later, but we need the historical record.
 * @property entityType  The kind of resource ('payment', 'update', etc.).
 *                       Lowercase, singular, snake_case.
 * @property entityId    The UUID of the resource.
 * @property action      One of the AuditAction enum values.
 * @property oldValues   Only the fields that changed (pre-state).
 * @property newValues   Only the fields that changed (post-state).
 *                       For CREATE: oldValues = null, newValues = full payload.
 *                       For DELETE: oldValues = snapshot, newValues = null.
 * @property reason      Mandatory for negative actions (REJECT, FORCE_CANCEL,
 *                       DELETE, status downgrades). Min 20 chars enforced by
 *                       the caller's DTO.
 * @property req         Express request — used to extract ip and user-agent.
 */
export interface AuditLogEntry {
  companyId: string;
  userId: string;
  userRole: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  reason?: string;
  req?: Request;
}

/**
 * Subset of fields that contain secrets. Their values are never persisted.
 * Check is case-insensitive and substring-based.
 */
const SENSITIVE_KEYS = [
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'apikey',
  'authorization',
  'cookie',
  'creditcard',
  'cardnumber',
  'cvv',
  'ssn',
  'pin',
];

@Injectable()
export class AuditLogService implements OnModuleInit {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.logger.log('AuditLogService initialized — append-only writes enabled');
  }

  /**
   * Write an audit entry INSIDE the caller's transaction.
   *
   * Use this for any operation that mutates business state — payments,
   * status transitions, role changes, soft deletes, subcontractor contracts.
   *
   * Throws on failure so the caller's $transaction rolls back. The exception
   * deliberately leaks no internal detail to the client; the GlobalExceptionFilter
   * converts it to a generic InternalServerError.
   *
   * @throws Error  if the audit insert fails. Caller's transaction will roll back.
   */
  async logInTransaction(
    tx: Prisma.TransactionClient,
    entry: AuditLogEntry,
  ): Promise<void> {
    this.assertEntryValid(entry);

    try {
      await tx.auditLog.create({
        data: this.buildData(entry),
      });
    } catch (error) {
      // ⚠️ Critical — this rolls back the caller's transaction.
      this.logger.error(
        {
          msg: 'Audit log write failed inside transaction — caller will roll back',
          entityType: entry.entityType,
          entityId: entry.entityId,
          action: entry.action,
          userId: entry.userId,
          companyId: entry.companyId,
          err: error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : String(error),
        },
        'AuditLogService',
      );

      // Re-throw with a generic message — the GlobalExceptionFilter
      // will translate this to a 500 without leaking internals.
      throw new Error('Audit log write failed — operation rolled back');
    }
  }

  /**
   * Best-effort audit write — does NOT throw, does NOT roll back.
   *
   * Use only for non-financial, non-state-changing events:
   *   - Sensitive read access (contract view, receipt download)
   *   - Audit export (meta-audit)
   *   - Authentication events that succeed (the main flow is already done)
   *
   * On failure: logs an error and continues. The operation completes
   * even without an audit record. Acceptable trade-off because the loss is
   * "we don't know who viewed X", not "we lost X".
   */
  async log(entry: AuditLogEntry): Promise<void> {
    this.assertEntryValid(entry);

    try {
      await this.prisma.auditLog.create({
        data: this.buildData(entry),
      });
    } catch (error) {
      // Don't throw — but make the failure VERY visible.
      this.logger.error(
        {
          msg: 'Best-effort audit log write failed — operation will continue without audit',
          entityType: entry.entityType,
          entityId: entry.entityId,
          action: entry.action,
          userId: entry.userId,
          companyId: entry.companyId,
          err: error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : String(error),
        },
        'AuditLogService',
      );
      // TODO: emit metric `audit.log.best_effort_failed` for alerting.
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Internals
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  private buildData(entry: AuditLogEntry): Prisma.AuditLogUncheckedCreateInput {
    // Correlate every audit row with the HTTP request that produced it.
    // Falls back to undefined for background jobs (cron, BullMQ workers).
    const requestId = RequestContext.requestId() ?? null;

    return {
      companyId: entry.companyId,
      userId: entry.userId,
      userRole: entry.userRole,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      // Prisma 7 narrowed JSON-column inputs to a structural InputJsonValue
      // that excludes a plain `Record<string, unknown>`. The sanitized value
      // IS valid JSON by construction (only primitives, arrays, and nested
      // objects come out of `sanitize`) so the cast is sound.
      oldValues:
        (this.sanitize(entry.oldValues) as Prisma.InputJsonValue | null) ??
        Prisma.DbNull,
      newValues:
        (this.sanitize(entry.newValues) as Prisma.InputJsonValue | null) ??
        Prisma.DbNull,
      reason: entry.reason ?? null,
      ipAddress: this.extractIp(entry.req),
      userAgent: this.extractUserAgent(entry.req),
      requestId,
    };
  }

  /**
   * Defense-in-depth validation. The DB has its own constraints, but
   * surfacing a clear error here is faster than parsing a Postgres
   * unique-violation message.
   */
  private assertEntryValid(entry: AuditLogEntry): void {
    if (!entry.companyId) throw new Error('audit: companyId is required');
    if (!entry.userId) throw new Error('audit: userId is required');
    if (!entry.userRole) throw new Error('audit: userRole is required');
    if (!entry.entityType) throw new Error('audit: entityType is required');
    if (!entry.entityId) throw new Error('audit: entityId is required');
    if (!entry.action) throw new Error('audit: action is required');

    // entityType convention: lowercase snake_case singular
    if (!/^[a-z][a-z_]*$/.test(entry.entityType)) {
      throw new Error(
        `audit: entityType "${entry.entityType}" must be lowercase snake_case (e.g. "payment", "project_assignment")`,
      );
    }

    // Reason required for "negative" actions
    const NEGATIVE_ACTIONS: AuditAction[] = [
      'DELETE',
      'REJECT',
      'FORCE_CANCEL',
      'PROGRESS_OVERRIDE',
    ];
    if (NEGATIVE_ACTIONS.includes(entry.action)) {
      if (!entry.reason || entry.reason.trim().length < 20) {
        throw new Error(
          `audit: action "${entry.action}" requires a reason of at least 20 characters`,
        );
      }
    }
  }

  /**
   * Remove keys that look like secrets before persisting. Recursive — handles
   * nested objects (e.g., user metadata).
   *
   * Returns `null` if input is null/undefined — Prisma needs explicit DbNull
   * for JSON columns; the caller maps null → Prisma.DbNull.
   */
  private sanitize(
    value: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> | null {
    if (value == null) return null;

    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      const keyLower = key.toLowerCase();
      const isSensitive = SENSITIVE_KEYS.some((s) => keyLower.includes(s));

      if (isSensitive) {
        out[key] = '[REDACTED]';
      } else if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        out[key] = this.sanitize(val as Record<string, unknown>);
      } else {
        out[key] = val;
      }
    }
    return out;
  }

  /**
   * Extract client IP, respecting trusted proxies.
   * Returns null if no IP is available (e.g., internal jobs).
   */
  private extractIp(req?: Request): string | null {
    if (!req) return null;

    // X-Forwarded-For can be a comma-separated list — take the first (the original client).
    const forwarded = req.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      const first = forwarded.split(',')[0]?.trim();
      if (first) return first.substring(0, 45); // max IPv6 length
    }

    const ip = req.ip ?? req.socket?.remoteAddress ?? null;
    return ip ? ip.substring(0, 45) : null;
  }

  /**
   * Extract User-Agent, capped at 500 chars (DB column safety).
   */
  private extractUserAgent(req?: Request): string | null {
    if (!req) return null;
    const ua = req.headers?.['user-agent'];
    if (typeof ua !== 'string' || ua.length === 0) return null;
    return ua.substring(0, 500);
  }
}
