// ============================================
// 🏢 Companies Service
//
// Critical guarantees:
//   - All mutations wrap the DB write + audit in a single $transaction
//     (audit failure rolls back the company update).
//   - Whitelisted update fields — never pass dto as-is to Prisma data.
//     This prevents an admin from changing subscriptionPlan/storageQuota
//     via the UpdateCompanyDto (subscription is a separate flow).
//   - Tier-aware storage usage reporting (Q7 limits).
// ============================================
import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { UpdateCompanyDto, UpdateCompanySettingsDto } from './dto';
import { JwtPayload } from '../../common/decorators';
import { AuditAction, Prisma, SubscriptionPlan } from '@prisma/client';
import { Request } from 'express';

/**
 * Subscription tier limits (Q7 — confirmed product decision).
 * Stored here rather than in the DB so changes ship with code + tests.
 * The DB's `Company.storageQuota` is the authoritative quota — these are
 * the defaults applied when a plan changes.
 */
export const TIER_LIMITS: Record<
  SubscriptionPlan,
  { maxProjects: number; maxUsers: number; storageBytes: bigint }
> = {
  TRIAL: {
    maxProjects: 3,
    maxUsers: 10,
    storageBytes: BigInt(10 * 1024 ** 3), // 10 GB
  },
  BASIC: {
    // Starter tier
    maxProjects: 3,
    maxUsers: 10,
    storageBytes: BigInt(10 * 1024 ** 3),
  },
  PRO: {
    // Professional tier
    maxProjects: 15,
    maxUsers: 50,
    storageBytes: BigInt(50 * 1024 ** 3),
  },
  ENTERPRISE: {
    maxProjects: Number.MAX_SAFE_INTEGER,
    maxUsers: Number.MAX_SAFE_INTEGER,
    storageBytes: BigInt(200 * 1024 ** 3),
  },
};

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async getMyCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId, ...this.prisma.softDeleteFilter },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        phone: true,
        email: true,
        address: true,
        commercialRegister: true,
        taxId: true,
        employeeCount: true,
        specialization: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        storageQuota: true,
        storageUsed: true,
        currency: true,
        timezone: true,
        settings: true,
        createdAt: true,
      },
    });

    if (!company) throw new NotFoundException('الشركة غير موجودة');
    return company;
  }

  /**
   * Update company details — SUPER_ADMIN only (enforced by controller).
   *
   * The DTO has been validated already, but we still build the data payload
   * explicitly to avoid mass-assignment of restricted fields (subscriptionPlan,
   * storageQuota, slug). Those move via dedicated flows.
   */
  async updateCompany(
    user: JwtPayload,
    dto: UpdateCompanyDto,
    req: Request,
  ) {
    const old = await this.prisma.company.findUnique({
      where: { id: user.companyId, ...this.prisma.softDeleteFilter },
    });
    if (!old) throw new NotFoundException('الشركة غير موجودة');

    // Whitelist — never pass `dto` raw to Prisma.
    const data: Prisma.CompanyUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.logo !== undefined) data.logo = dto.logo;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.commercialRegister !== undefined) {
      data.commercialRegister = dto.commercialRegister;
    }
    if (dto.taxId !== undefined) data.taxId = dto.taxId;
    if (dto.employeeCount !== undefined) data.employeeCount = dto.employeeCount;
    if (dto.specialization !== undefined) data.specialization = dto.specialization;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    // Intentionally NOT writable here:
    //   subscriptionPlan / subscriptionStatus → billing webhook only
    //   storageQuota / storageUsed → derived from plan + media operations
    //   slug → immutable for URL stability

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.company.update({
        where: { id: user.companyId },
        data,
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: user.companyId,
        userId: user.userId,
        userRole: user.role,
        entityType: 'company',
        entityId: user.companyId,
        action: AuditAction.UPDATE,
        oldValues: this.pickOldValuesForChangedFields(
          old as unknown as Record<string, unknown>,
          data as unknown as Record<string, unknown>,
        ),
        newValues: data as unknown as Record<string, unknown>,
        req,
      });

      return updated;
    });
  }

  async updateSettings(
    user: JwtPayload,
    dto: UpdateCompanySettingsDto,
    req: Request,
  ) {
    const company = await this.prisma.company.findUnique({
      where: { id: user.companyId, ...this.prisma.softDeleteFilter },
    });
    if (!company) throw new NotFoundException('الشركة غير موجودة');

    const oldSettings = company.settings;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.company.update({
        where: { id: user.companyId },
        data: { settings: (dto.settings ?? {}) as Prisma.InputJsonValue },
      });

      await this.auditLog.logInTransaction(tx, {
        companyId: user.companyId,
        userId: user.userId,
        userRole: user.role,
        entityType: 'company',
        entityId: user.companyId,
        action: AuditAction.UPDATE,
        oldValues: { settings: oldSettings as unknown as Record<string, unknown> },
        newValues: { settings: dto.settings as unknown as Record<string, unknown> },
        req,
      });

      return updated;
    });
  }

  /**
   * Tier-aware storage usage report. Used by:
   *   - Dashboards (storage warning UI)
   *   - Media uploads (pre-flight quota check)
   *
   * Returns BigInt → string at the boundary because BigInt is not JSON-safe.
   */
  async getStorageUsage(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId, ...this.prisma.softDeleteFilter },
      select: {
        storageQuota: true,
        storageUsed: true,
        subscriptionPlan: true,
      },
    });

    if (!company) throw new NotFoundException('الشركة غير موجودة');

    const quota = company.storageQuota; // BigInt
    const used = company.storageUsed;   // BigInt
    const available = quota > used ? quota - used : BigInt(0);

    // Percentage as integer 0–100 — avoid float to keep behavior deterministic
    const percentage =
      quota === BigInt(0)
        ? 0
        : Number((used * BigInt(100)) / quota);

    return {
      quota: quota.toString(),
      used: used.toString(),
      available: available.toString(),
      percentage,
      plan: company.subscriptionPlan,
      tierLimits: {
        maxProjects: TIER_LIMITS[company.subscriptionPlan].maxProjects,
        maxUsers: TIER_LIMITS[company.subscriptionPlan].maxUsers,
        storageBytes: TIER_LIMITS[company.subscriptionPlan].storageBytes.toString(),
      },
      warning: percentage >= 80,
      critical: percentage >= 95,
    };
  }

  /**
   * Pick the OLD values of fields that are about to change.
   * Used for the audit log `oldValues` snapshot — only include fields
   * the caller is actually updating.
   */
  private pickOldValuesForChangedFields(
    original: Record<string, unknown>,
    updates: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(updates)) {
      if (updates[key] !== undefined && original[key] !== updates[key]) {
        out[key] = original[key];
      }
    }
    return out;
  }
}
