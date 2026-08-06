// ============================================
// TierLimitsService — single source of truth for plan enforcement.
//
// Why a dedicated service (not inline checks):
//   1. Plan limits change with marketing (Pro: 50 → 100 users? trivial).
//   2. The same check runs in 3+ services (users, projects, media). DRY.
//   3. Centralized observability — when a tenant hits a limit, we log it
//      once with the right context for upsell analytics.
//   4. The "next tier" hint in errors is the same everywhere → consistent
//      upgrade-prompt UX.
//
// Error policy:
//   - Throws `PaymentRequiredException` (HTTP 402) — the semantically
//     correct status. Frontend can intercept 402 to show the upgrade
//     modal regardless of which limit was hit.
//   - The message includes:
//       • The current plan name (so the user knows what they're on)
//       • The exceeded resource name
//       • The next tier that would solve it
// ============================================
import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TIER_LIMITS } from './companies.service';

/** 402 Payment Required — used by frontend to trigger upgrade flow. */
export class PaymentRequiredException extends HttpException {
  constructor(message: string, public readonly upgradeTo: SubscriptionPlan | null) {
    super(
      { statusCode: 402, message, code: 'TIER_LIMIT_EXCEEDED', upgradeTo },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}

/**
 * The hierarchical ordering used to suggest the next tier on a limit hit.
 * BASIC = Starter (Q7).
 */
const TIER_ORDER: SubscriptionPlan[] = ['TRIAL', 'BASIC', 'PRO', 'ENTERPRISE'];

function nextTier(current: SubscriptionPlan): SubscriptionPlan | null {
  const idx = TIER_ORDER.indexOf(current);
  if (idx < 0 || idx === TIER_ORDER.length - 1) return null;
  return TIER_ORDER[idx + 1];
}

@Injectable()
export class TierLimitsService {
  private readonly logger = new Logger(TierLimitsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Throws PaymentRequired if the company has reached its user cap.
   * Counts active, non-deleted users only.
   */
  async assertCanAddUser(companyId: string): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { subscriptionPlan: true, name: true },
    });
    if (!company) return; // let the caller surface its own NotFound

    const limit = TIER_LIMITS[company.subscriptionPlan].maxUsers;
    if (limit === Number.MAX_SAFE_INTEGER) return; // unlimited

    const count = await this.prisma.user.count({
      where: { companyId, deletedAt: null },
    });

    if (count >= limit) {
      const upgrade = nextTier(company.subscriptionPlan);
      this.logger.warn(
        `Tier limit hit: company=${companyId} plan=${company.subscriptionPlan} resource=users at=${count}/${limit}`,
      );
      throw new PaymentRequiredException(
        `وصلت لحد المستخدمين في باقتك (${limit} مستخدم). ` +
          (upgrade
            ? `قم بالترقية إلى ${upgrade} للمزيد.`
            : 'تواصل معنا لخطة مخصصة.'),
        upgrade,
      );
    }
  }

  /**
   * Throws PaymentRequired if the company has reached its project cap.
   * Counts non-CANCELLED, non-deleted projects. CANCELLED don't consume slots.
   */
  async assertCanAddProject(companyId: string): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { subscriptionPlan: true },
    });
    if (!company) return;

    const limit = TIER_LIMITS[company.subscriptionPlan].maxProjects;
    if (limit === Number.MAX_SAFE_INTEGER) return;

    const count = await this.prisma.project.count({
      where: {
        companyId,
        deletedAt: null,
        status: { not: 'CANCELLED' },
      },
    });

    if (count >= limit) {
      const upgrade = nextTier(company.subscriptionPlan);
      this.logger.warn(
        `Tier limit hit: company=${companyId} plan=${company.subscriptionPlan} resource=projects at=${count}/${limit}`,
      );
      throw new PaymentRequiredException(
        `وصلت لحد المشاريع في باقتك (${limit} مشروع). ` +
          (upgrade
            ? `قم بالترقية إلى ${upgrade} للمزيد.`
            : 'تواصل معنا لخطة مخصصة.'),
        upgrade,
      );
    }
  }

  /**
   * Throws PaymentRequired if adding `incomingBytes` would exceed the
   * storage quota. The actual decrement-on-delete behavior lives in
   * MediaService — this only gate-keeps writes.
   *
   * @param companyId
   * @param incomingBytes — bytes about to be added. 0 is a no-op (returns).
   */
  async assertCanUseStorage(
    companyId: string,
    incomingBytes: number,
  ): Promise<void> {
    if (incomingBytes <= 0) return;

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { storageQuota: true, storageUsed: true, subscriptionPlan: true },
    });
    if (!company) return;

    const wouldUse = company.storageUsed + BigInt(incomingBytes);
    if (wouldUse <= company.storageQuota) return;

    const upgrade = nextTier(company.subscriptionPlan);
    const quotaGB = Number(company.storageQuota / BigInt(1024 ** 3));
    this.logger.warn(
      `Tier limit hit: company=${companyId} plan=${company.subscriptionPlan} resource=storage at=${company.storageUsed}/${company.storageQuota}`,
    );
    throw new PaymentRequiredException(
      `تجاوزت سعة التخزين في باقتك (${quotaGB} GB). ` +
        (upgrade
          ? `قم بالترقية إلى ${upgrade} للمزيد.`
          : 'تواصل معنا لخطة مخصصة.'),
      upgrade,
    );
  }
}
