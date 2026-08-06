// ============================================
// TierLimitsService tests
// ============================================
import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import {
  TierLimitsService,
  PaymentRequiredException,
} from './tier-limits.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('TierLimitsService', () => {
  let service: TierLimitsService;
  let findCompany: jest.Mock;
  let countUsers: jest.Mock;
  let countProjects: jest.Mock;

  beforeEach(async () => {
    findCompany = jest.fn();
    countUsers = jest.fn();
    countProjects = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TierLimitsService,
        {
          provide: PrismaService,
          useValue: {
            company: { findUnique: findCompany },
            user: { count: countUsers },
            project: { count: countProjects },
          },
        },
      ],
    }).compile();

    service = module.get(TierLimitsService);
  });

  // ─── assertCanAddUser ──────────────────────────────────

  describe('assertCanAddUser', () => {
    it('allows up to the BASIC (Starter) limit of 10 users', async () => {
      findCompany.mockResolvedValue({ subscriptionPlan: 'BASIC', name: 'Co' });
      countUsers.mockResolvedValue(9); // already 9; 10th is the new one

      await expect(service.assertCanAddUser('co-1')).resolves.toBeUndefined();
    });

    it('throws 402 when BASIC has hit the cap of 10', async () => {
      findCompany.mockResolvedValue({ subscriptionPlan: 'BASIC', name: 'Co' });
      countUsers.mockResolvedValue(10);

      try {
        await service.assertCanAddUser('co-1');
        fail('expected PaymentRequiredException');
      } catch (err) {
        expect(err).toBeInstanceOf(PaymentRequiredException);
        const e = err as PaymentRequiredException;
        expect(e.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
        expect(e.upgradeTo).toBe('PRO'); // next tier
        const body = e.getResponse() as { code: string };
        expect(body.code).toBe('TIER_LIMIT_EXCEEDED');
      }
    });

    it('throws 402 on PRO when at cap of 50', async () => {
      findCompany.mockResolvedValue({ subscriptionPlan: 'PRO', name: 'Co' });
      countUsers.mockResolvedValue(50);

      try {
        await service.assertCanAddUser('co-1');
        fail('expected throw');
      } catch (err) {
        expect((err as PaymentRequiredException).upgradeTo).toBe('ENTERPRISE');
      }
    });

    it('ENTERPRISE has no user cap (allows any count)', async () => {
      findCompany.mockResolvedValue({ subscriptionPlan: 'ENTERPRISE' });
      countUsers.mockResolvedValue(99_999);

      await expect(service.assertCanAddUser('co-1')).resolves.toBeUndefined();
      // We didn't even need to count — early-exit on unlimited
      // (count IS called because the service queries after the limit check,
      // but allowing 99k must not throw)
    });

    it('does nothing when the company does not exist (caller will throw NotFound)', async () => {
      findCompany.mockResolvedValue(null);

      await expect(service.assertCanAddUser('missing')).resolves.toBeUndefined();
    });
  });

  // ─── assertCanAddProject ───────────────────────────────

  describe('assertCanAddProject', () => {
    it('counts only non-CANCELLED, non-deleted projects', async () => {
      findCompany.mockResolvedValue({ subscriptionPlan: 'BASIC' });
      countProjects.mockResolvedValue(2);

      await service.assertCanAddProject('co-1');

      expect(countProjects).toHaveBeenCalledWith({
        where: {
          companyId: 'co-1',
          deletedAt: null,
          status: { not: 'CANCELLED' },
        },
      });
    });

    it('throws 402 when BASIC has 3 active projects', async () => {
      findCompany.mockResolvedValue({ subscriptionPlan: 'BASIC' });
      countProjects.mockResolvedValue(3);

      await expect(service.assertCanAddProject('co-1')).rejects.toThrow(
        PaymentRequiredException,
      );
    });

    it('allows PRO up to 15 active projects', async () => {
      findCompany.mockResolvedValue({ subscriptionPlan: 'PRO' });
      countProjects.mockResolvedValue(14);

      await expect(service.assertCanAddProject('co-1')).resolves.toBeUndefined();
    });
  });

  // ─── assertCanUseStorage ───────────────────────────────

  describe('assertCanUseStorage', () => {
    it('returns immediately when incomingBytes is 0', async () => {
      await service.assertCanUseStorage('co-1', 0);
      expect(findCompany).not.toHaveBeenCalled();
    });

    it('returns immediately when incomingBytes is negative (defensive)', async () => {
      await service.assertCanUseStorage('co-1', -5);
      expect(findCompany).not.toHaveBeenCalled();
    });

    it('allows the upload when storage stays under quota', async () => {
      findCompany.mockResolvedValue({
        storageQuota: BigInt(10 * 1024 ** 3), // 10 GB
        storageUsed: BigInt(5 * 1024 ** 3),
        subscriptionPlan: 'BASIC',
      });

      await expect(
        service.assertCanUseStorage('co-1', 1024 * 1024), // 1 MB
      ).resolves.toBeUndefined();
    });

    it('throws 402 when the upload would cross the quota line', async () => {
      findCompany.mockResolvedValue({
        storageQuota: BigInt(10 * 1024 ** 3),
        storageUsed: BigInt(10 * 1024 ** 3) - BigInt(100), // 100 bytes left
        subscriptionPlan: 'BASIC',
      });

      try {
        await service.assertCanUseStorage('co-1', 1000); // 900 bytes over
        fail('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(PaymentRequiredException);
        expect((err as PaymentRequiredException).upgradeTo).toBe('PRO');
      }
    });

    it('exactly equals quota → allowed (boundary)', async () => {
      findCompany.mockResolvedValue({
        storageQuota: BigInt(10 * 1024 ** 3),
        storageUsed: BigInt(10 * 1024 ** 3) - BigInt(1000),
        subscriptionPlan: 'BASIC',
      });

      await expect(
        service.assertCanUseStorage('co-1', 1000),
      ).resolves.toBeUndefined();
    });
  });
});
