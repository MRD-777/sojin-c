-- ============================================
-- Soft Delete Enhancements (C1, C2)
-- Add deletedBy + deletionReason to payments
-- Add deletedAt + deletedBy + deletionReason to media
-- ============================================

-- ─── Payments: add deleter tracking ────────────────────────
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "deleted_by"      UUID,
  ADD COLUMN IF NOT EXISTS "deletion_reason" TEXT;

-- Foreign key for the deleter (nullable — not all payments are deleted)
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_deleted_by_fkey"
  FOREIGN KEY ("deleted_by") REFERENCES "users"("id")
  ON DELETE SET NULL;

-- Composite index for company-wide soft-deleted queries
CREATE INDEX IF NOT EXISTS "payments_project_id_deleted_at_idx"
  ON "payments" ("project_id", "deleted_at");

-- ─── Media: add full soft-delete support ───────────────────
ALTER TABLE "media"
  ADD COLUMN IF NOT EXISTS "deleted_at"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deleted_by"      UUID,
  ADD COLUMN IF NOT EXISTS "deletion_reason" TEXT;

ALTER TABLE "media"
  ADD CONSTRAINT "media_deleted_by_fkey"
  FOREIGN KEY ("deleted_by") REFERENCES "users"("id")
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "media_update_id_deleted_at_idx"
  ON "media" ("update_id", "deleted_at");

-- ─── Comments at table level ───────────────────────────────
COMMENT ON COLUMN "payments"."deleted_at" IS
  'Soft-delete timestamp. Hard deletes are forbidden for financial records.';
COMMENT ON COLUMN "payments"."deleted_by" IS
  'User who soft-deleted this payment. Required when deleted_at is set.';
COMMENT ON COLUMN "payments"."deletion_reason" IS
  'Mandatory reason for soft-deletion (audit/legal requirement).';

COMMENT ON COLUMN "media"."deleted_at" IS
  'Soft-delete timestamp. The underlying storage file is preserved for audit.';
COMMENT ON COLUMN "media"."deleted_by" IS
  'User who soft-deleted this media. Required when deleted_at is set.';
COMMENT ON COLUMN "media"."deletion_reason" IS
  'Mandatory reason for soft-deletion (audit/legal requirement).';
