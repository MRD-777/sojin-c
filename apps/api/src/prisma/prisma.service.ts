// ============================================
// Prisma Service — Database Connection
// ============================================
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/** Postgres serialization_failure surfaced by Prisma as P2034. */
const SERIALIZATION_FAILURE = 'P2034';
const DEFAULT_SERIALIZABLE_RETRIES = 3;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // Prisma 7 client engine requires a driver adapter. PrismaPg opens a pg
    // pool against DATABASE_URL (validated at bootstrap by env-validation).
    super({
      adapter: new PrismaPg(process.env.DATABASE_URL as string),
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Soft delete filter helper
   * Use this to filter out soft-deleted records
   */
  get softDeleteFilter() {
    return { deletedAt: null };
  }

  /**
   * Run an interactive transaction at SERIALIZABLE isolation with
   * automatic retry on serialization failures (P2034 / Postgres 40001).
   *
   * Defense-in-depth for the TOCTOU guards in updates/payments
   * (CVE-UPD-003/005/007/008, PAY-IDEM-001): SERIALIZABLE makes Postgres
   * abort the loser of two overlapping transactions, but Prisma does NOT
   * auto-retry — without this wrapper the loser surfaces a raw 500 instead
   * of transparently re-running. The retried attempt re-reads fresh state,
   * so the in-tx guards (e.g. status re-checks) still hold on each try.
   *
   * Non-serialization errors propagate immediately (no retry).
   */
  async runSerializable<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    retries: number = DEFAULT_SERIALIZABLE_RETRIES,
  ): Promise<T> {
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        return await this.$transaction(fn, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (err) {
        const isSerializationFailure =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === SERIALIZATION_FAILURE;
        if (isSerializationFailure && attempt < retries) {
          attempt += 1;
          this.logger.warn(
            `Serialization failure (P2034) — retry ${attempt}/${retries}`,
          );
          // Small jittered backoff to break up contending retries.
          await new Promise((r) => setTimeout(r, 10 * attempt + Math.random() * 10));
          continue;
        }
        throw err;
      }
    }
  }
}
