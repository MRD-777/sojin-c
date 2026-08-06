-- ============================================================
-- CVE-UPD-002 — Idempotency persistence (Session 2026-05-30)
-- ============================================================
--
-- Adds the `idempotency_records` table backing the Prisma-aware
-- IdempotencyService. Replaces the in-memory store so that
-- `saveInTransaction` can persist the cached response in the SAME
-- transaction as the side effects it guards (approve, force-cancel).
--
-- Why this matters
-- ----------------
-- Pre-fix: the in-memory store's `save` ran AFTER the $transaction
-- commit. If the store call failed (transient memory pressure / OOM /
-- process restart between commit and save), the side effects were
-- committed but no key was cached. The next retry with the same
-- Idempotency-Key would re-run the transaction → double approval /
-- double progress mutation / double SUNK_COST payment.
--
-- With this table, `save` participates in the caller's tx; if the
-- side effects roll back, the cached record rolls back with them,
-- and if they commit, the cached record commits atomically.
--
-- Composite PK (tenant_id, key)
-- -----------------------------
-- Tenant-scoped so different companies can independently use the
-- same Idempotency-Key UUID. The same key inside one tenant must
-- be unique — the composite PK enforces this at the DB level.
-- ------------------------------------------------------------

CREATE TABLE "idempotency_records" (
  "tenant_id"           UUID        NOT NULL,
  "key"                 TEXT        NOT NULL,
  "request_fingerprint" TEXT        NOT NULL,
  "status_code"         INTEGER     NOT NULL,
  "body"                JSONB       NOT NULL,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at"          TIMESTAMP(3) NOT NULL,

  CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("tenant_id", "key")
);

-- Background sweeper / cleanup join uses expires_at.
CREATE INDEX "idempotency_records_expires_at_idx"
  ON "idempotency_records" ("expires_at");
