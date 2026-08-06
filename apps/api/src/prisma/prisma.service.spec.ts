// ============================================
// PrismaService.runSerializable — P2034 retry wrapper
// (Session 2026-05-30, Fix 4 / defense-in-depth for CVE-UPD-008,
//  CVE-UPD-003/005/007, PAY-IDEM-001).
//
// Prisma does NOT auto-retry serialization failures. This helper does,
// so the loser of two overlapping Serializable transactions re-runs
// transparently instead of surfacing a raw 500.
// ============================================
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

describe('PrismaService.runSerializable', () => {
  let service: PrismaService;

  const p2034 = () =>
    new Prisma.PrismaClientKnownRequestError('serialization failure', {
      code: 'P2034',
      clientVersion: 'test',
    });

  const stubTransaction = (mock: jest.Mock) => {
    (service as unknown as { $transaction: jest.Mock }).$transaction = mock;
  };

  beforeEach(() => {
    // Build the instance without invoking the PrismaClient constructor
    // (Prisma 7 requires an adapter/accelerateUrl). runSerializable only
    // touches `this.$transaction` and `this.logger`, both stubbed here.
    service = Object.create(PrismaService.prototype) as PrismaService;
    (service as unknown as { logger: { warn: jest.Mock } }).logger = {
      warn: jest.fn(),
    };
  });

  it('retries on P2034 then succeeds — each attempt uses Serializable isolation', async () => {
    const tx = jest
      .fn()
      .mockRejectedValueOnce(p2034())
      .mockRejectedValueOnce(p2034())
      .mockResolvedValueOnce('ok');
    stubTransaction(tx);

    const result = await service.runSerializable(async () => 'ok');

    expect(result).toBe('ok');
    expect(tx).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    // Paired assertion — deepest layer: every attempt is Serializable.
    expect(tx.mock.calls[0][1]).toEqual({ isolationLevel: 'Serializable' });
    expect(tx.mock.calls[2][1]).toEqual({ isolationLevel: 'Serializable' });
  });

  it('does NOT retry a non-serialization error — propagates immediately', async () => {
    const tx = jest.fn().mockRejectedValue(new Error('boom'));
    stubTransaction(tx);

    await expect(service.runSerializable(async () => 'x')).rejects.toThrow('boom');
    expect(tx).toHaveBeenCalledTimes(1);
  });

  it('gives up after the retry budget and rethrows the P2034', async () => {
    const tx = jest.fn().mockRejectedValue(p2034());
    stubTransaction(tx);

    await expect(service.runSerializable(async () => 'x', 2)).rejects.toMatchObject({
      code: 'P2034',
    });
    expect(tx).toHaveBeenCalledTimes(3); // initial + 2 retries, then give up
  });
});
