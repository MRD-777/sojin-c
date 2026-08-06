import { Global, Module } from '@nestjs/common';
import { PrismaIdempotencyStore } from './prisma-store';
import { IdempotencyService } from './idempotency.service';

/**
 * Provided globally so any module can inject IdempotencyService without
 * importing IdempotencyModule explicitly.
 *
 * Backed by Prisma (CVE-UPD-002, Session 2026-05-30) so
 * `IdempotencyService.saveInTransaction` can write the cached response
 * inside the caller's `$transaction` — keeping the cached key atomic
 * with the side effects it guards.
 *
 * The legacy `InMemoryIdempotencyStore` is retained in this directory
 * for reference and unit-test fixtures but is no longer wired.
 */
@Global()
@Module({
  providers: [PrismaIdempotencyStore, IdempotencyService],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
