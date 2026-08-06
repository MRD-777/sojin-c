// ============================================
// In-memory IdempotencyStore — single-instance fallback.
//
// Suitable for:
//   - Development (no Redis dependency)
//   - Single-replica deployments
//
// NOT suitable for:
//   - Multi-replica production (cache is per-instance — same key handled
//     on different instances would BOTH execute). Use RedisIdempotencyStore
//     once F5 (BullMQ/Redis) is wired up.
//
// Memory bounds:
//   - Evicts entries past TTL on every get/set (lazy cleanup).
//   - Hard cap of MAX_ENTRIES — when reached, oldest 10% is evicted to
//     bound memory under sustained load.
// ============================================
import { Injectable, Logger } from '@nestjs/common';
import type {
  IdempotencyRecord,
  IdempotencyStore,
} from './idempotency-store.interface';

interface Entry {
  record: IdempotencyRecord;
  expiresAt: number; // epoch ms
}

const MAX_ENTRIES = 10_000;
const EVICT_BATCH_RATIO = 0.1;

@Injectable()
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly logger = new Logger(InMemoryIdempotencyStore.name);
  // Key format: `${tenantId}:${idempotencyKey}` — tenant-scoped so two
  // companies could theoretically use the same UUID without colliding.
  private readonly entries = new Map<string, Entry>();

  async get(tenantId: string, key: string): Promise<IdempotencyRecord | null> {
    const composite = this.composite(tenantId, key);
    const entry = this.entries.get(composite);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(composite);
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
    this.evictIfFull();
    this.entries.set(this.composite(tenantId, key), {
      record,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  private composite(tenantId: string, key: string): string {
    return `${tenantId}:${key}`;
  }

  /**
   * If the map is at capacity, drop the oldest 10% by insertion order
   * (Map preserves insertion order in spec). Better than rejecting writes.
   */
  private evictIfFull(): void {
    if (this.entries.size < MAX_ENTRIES) return;

    const toEvict = Math.floor(MAX_ENTRIES * EVICT_BATCH_RATIO);
    const iterator = this.entries.keys();
    for (let i = 0; i < toEvict; i++) {
      const next = iterator.next();
      if (next.done) break;
      this.entries.delete(next.value);
    }
    this.logger.debug(`Evicted ${toEvict} idempotency entries (cache full)`);
  }
}
