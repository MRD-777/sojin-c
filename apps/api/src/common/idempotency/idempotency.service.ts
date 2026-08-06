// ============================================
// IdempotencyService — high-level wrapper for the store.
//
// Contract for callers:
//   const cached = await idempotency.lookup(user.companyId, key, requestBody);
//   if (cached) return cached.body;
//   const response = await doTheWork(...);
//   // Inside a $transaction for state-changing endpoints (CVE-UPD-002):
//   await idempotency.saveInTransaction(tx, user.companyId, key, requestBody, response);
//   // Or outside, for non-tx contexts:
//   await idempotency.save(user.companyId, key, requestBody, response);
//   return response;
//
// Mismatched-body handling:
//   If a client retries the same key with a different body, we throw 422.
//   This catches developer bugs early (e.g., regenerating the body but
//   reusing the key).
//
// TTL:
//   24 hours by default. Stripe uses the same window. Long enough to
//   tolerate retry storms after a network blip; short enough that we
//   don't carry stale state forever.
// ============================================
import {
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaIdempotencyStore } from './prisma-store';
import type { IdempotencyRecord } from './idempotency-store.interface';

const DEFAULT_TTL_SECONDS = 24 * 60 * 60; // 24h

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly store: PrismaIdempotencyStore) {}

  /**
   * Look up a cached response. If the same key exists with a DIFFERENT
   * request fingerprint, throws 422 — the client has a bug.
   */
  async lookup<T>(
    tenantId: string,
    key: string,
    requestBody: unknown,
  ): Promise<{ statusCode: number; body: T } | null> {
    const existing = await this.store.get(tenantId, key);
    if (!existing) return null;

    const fingerprint = this.fingerprint(requestBody);
    if (existing.requestFingerprint !== fingerprint) {
      this.logger.warn(
        `Idempotency-Key reused with different payload: tenant=${tenantId} key=${key}`,
      );
      throw new UnprocessableEntityException(
        'تم استخدام نفس الـ Idempotency-Key مع بيانات مختلفة — استخدم مفتاح جديد',
      );
    }

    return { statusCode: existing.statusCode, body: existing.body as T };
  }

  /**
   * Persist the response for future replays.
   *
   * Prefer `saveInTransaction` for endpoints whose side effects are
   * wrapped in `$transaction` — saving outside the tx (this method) is
   * the bug that CVE-UPD-002 closed for approve/forceCancel.
   */
  async save(
    tenantId: string,
    key: string,
    requestBody: unknown,
    response: { statusCode: number; body: unknown },
    ttlSeconds: number = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    const record = this.buildRecord(requestBody, response);
    await this.store.set(tenantId, key, record, ttlSeconds);
  }

  /**
   * Same as `save`, but runs inside the caller's transaction so the
   * cached record commits atomically with the side effects it guards.
   *
   * Use this from any handler whose `idempotency.save` happens after a
   * `$transaction` body — without it, a transient store failure leaves
   * the side effects committed but the key uncached, and a retry will
   * re-run the protected work (double approve, double SUNK_COST, etc.).
   */
  async saveInTransaction(
    tx: Prisma.TransactionClient,
    tenantId: string,
    key: string,
    requestBody: unknown,
    response: { statusCode: number; body: unknown },
    ttlSeconds: number = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    const record = this.buildRecord(requestBody, response);
    await this.store.setInTransaction(tx, tenantId, key, record, ttlSeconds);
  }

  private buildRecord(
    requestBody: unknown,
    response: { statusCode: number; body: unknown },
  ): IdempotencyRecord {
    return {
      statusCode: response.statusCode,
      body: response.body,
      requestFingerprint: this.fingerprint(requestBody),
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * SHA-256 fingerprint of the JSON-stringified body. Stable across
   * key ordering for plain objects (since we sort keys here).
   */
  private fingerprint(body: unknown): string {
    const canonical = JSON.stringify(body, this.sortKeys);
    return createHash('sha256').update(canonical).digest('hex');
  }

  /** JSON.stringify replacer that sorts object keys. */
  private sortKeys = (_key: string, value: unknown): unknown => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (value as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return value;
  };
}
