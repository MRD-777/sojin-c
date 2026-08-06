// ============================================
// IdempotencyService tests
//
// The store is now Prisma-backed (CVE-UPD-002), but these unit tests
// don't need a real DB — we run them against an in-memory fake that
// implements the same `get` / `set` / `setInTransaction` contract.
// The Prisma-store integration is covered in the updates.service spec
// via the `saveInTransaction` paired assertion.
// ============================================
import { UnprocessableEntityException } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { PrismaIdempotencyStore } from './prisma-store';
import type { IdempotencyRecord } from './idempotency-store.interface';

interface Entry {
  record: IdempotencyRecord;
  expiresAt: number;
}

class FakeStore {
  private readonly entries = new Map<string, Entry>();

  async get(tenantId: string, key: string): Promise<IdempotencyRecord | null> {
    const entry = this.entries.get(`${tenantId}:${key}`);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(`${tenantId}:${key}`);
      return null;
    }
    return entry.record;
  }

  async set(
    tenantId: string,
    key: string,
    record: IdempotencyRecord,
    ttlSeconds: number,
  ): Promise<void> {
    this.entries.set(`${tenantId}:${key}`, {
      record,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async setInTransaction(
    _tx: unknown,
    tenantId: string,
    key: string,
    record: IdempotencyRecord,
    ttlSeconds: number,
  ): Promise<void> {
    return this.set(tenantId, key, record, ttlSeconds);
  }
}

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let store: FakeStore;

  const tenant = 'company-a';
  const key = 'a1b2c3d4e5f6a7b8c9d0e1f2'; // 24 chars

  beforeEach(() => {
    store = new FakeStore();
    service = new IdempotencyService(store as unknown as PrismaIdempotencyStore);
  });

  it('returns null on first lookup', async () => {
    const cached = await service.lookup(tenant, key, { foo: 'bar' });
    expect(cached).toBeNull();
  });

  it('replays the cached response when called with the same body', async () => {
    const body = { amount: 1000, type: 'CLIENT_PAYMENT' };

    await service.save(tenant, key, body, {
      statusCode: 201,
      body: { id: 'pay-1', amount: '1000.00' },
    });

    const cached = await service.lookup(tenant, key, body);
    expect(cached).toEqual({
      statusCode: 201,
      body: { id: 'pay-1', amount: '1000.00' },
    });
  });

  it('treats reordered keys as the SAME body (canonical JSON)', async () => {
    await service.save(
      tenant,
      key,
      { amount: 1000, type: 'CLIENT_PAYMENT' },
      { statusCode: 201, body: { id: 'pay-1' } },
    );

    // Same data, different key order
    const cached = await service.lookup(tenant, key, {
      type: 'CLIENT_PAYMENT',
      amount: 1000,
    });

    expect(cached?.body).toEqual({ id: 'pay-1' });
  });

  it('rejects (422) when the same key is reused with a different body', async () => {
    await service.save(
      tenant,
      key,
      { amount: 1000 },
      { statusCode: 201, body: { id: 'pay-1' } },
    );

    await expect(
      service.lookup(tenant, key, { amount: 9999 }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('scopes by tenant — same key in different companies is independent', async () => {
    await service.save(tenant, key, { x: 1 }, { statusCode: 201, body: { id: 'a' } });

    const cachedOtherTenant = await service.lookup('company-b', key, { x: 1 });
    expect(cachedOtherTenant).toBeNull();
  });

  it('returns null after the TTL has elapsed', async () => {
    await service.save(
      tenant,
      key,
      { x: 1 },
      { statusCode: 201, body: { id: 'a' } },
      0, // expire immediately
    );

    // Tiny wait to let the expiry pass even on a fast clock
    await new Promise((r) => setTimeout(r, 5));

    const cached = await service.lookup(tenant, key, { x: 1 });
    expect(cached).toBeNull();
  });

  it('caches both 2xx and non-2xx responses identically (no special-casing)', async () => {
    // The service is dumb — if the caller wants to skip caching errors,
    // they shouldn't call save(). We test that whatever you save comes back.
    await service.save(
      tenant,
      key,
      { x: 1 },
      { statusCode: 409, body: { error: 'conflict' } },
    );

    const cached = await service.lookup(tenant, key, { x: 1 });
    expect(cached?.statusCode).toBe(409);
    expect(cached?.body).toEqual({ error: 'conflict' });
  });
});
