// ============================================
// Prisma-backed IdempotencyStore.
//
// Replaces InMemoryIdempotencyStore as the default. Persistence here
// lets `IdempotencyService.saveInTransaction` join the caller's
// transaction so the cached response commits atomically with the
// side effects it guards (CVE-UPD-002, Session 2026-05-30).
//
// Lookup path stays cheap (single PK read by composite (tenant_id, key)).
// ============================================
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  IdempotencyRecord,
  IdempotencyStore,
} from './idempotency-store.interface';

@Injectable()
export class PrismaIdempotencyStore implements IdempotencyStore {
  private readonly logger = new Logger(PrismaIdempotencyStore.name);

  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string, key: string): Promise<IdempotencyRecord | null> {
    const row = await this.prisma.idempotencyRecord.findUnique({
      where: { tenantId_key: { tenantId, key } },
    });
    if (!row) return null;

    if (row.expiresAt.getTime() <= Date.now()) {
      // Lazy eviction. Don't await — best effort.
      this.prisma.idempotencyRecord
        .delete({ where: { tenantId_key: { tenantId, key } } })
        .catch(() => undefined);
      return null;
    }

    return {
      statusCode: row.statusCode,
      body: row.body,
      requestFingerprint: row.requestFingerprint,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async set(
    tenantId: string,
    key: string,
    record: IdempotencyRecord,
    ttlSeconds: number,
  ): Promise<void> {
    await this.setOn(this.prisma, tenantId, key, record, ttlSeconds);
  }

  /**
   * Tx-aware variant. Caller passes their `Prisma.TransactionClient` so the
   * idempotency record commits atomically with the protected side effects.
   * This is the path that closes CVE-UPD-002.
   */
  async setInTransaction(
    tx: Prisma.TransactionClient,
    tenantId: string,
    key: string,
    record: IdempotencyRecord,
    ttlSeconds: number,
  ): Promise<void> {
    await this.setOn(tx, tenantId, key, record, ttlSeconds);
  }

  private async setOn(
    client: PrismaService | Prisma.TransactionClient,
    tenantId: string,
    key: string,
    record: IdempotencyRecord,
    ttlSeconds: number,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    // upsert because a retry that reaches `save` twice (e.g. a duplicate
    // network packet) must not crash — same payload → same fingerprint →
    // overwrite is a no-op semantically.
    await client.idempotencyRecord.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: {
        tenantId,
        key,
        requestFingerprint: record.requestFingerprint,
        statusCode: record.statusCode,
        body: record.body as Prisma.InputJsonValue,
        expiresAt,
      },
      update: {
        requestFingerprint: record.requestFingerprint,
        statusCode: record.statusCode,
        body: record.body as Prisma.InputJsonValue,
        expiresAt,
      },
    });
  }
}
