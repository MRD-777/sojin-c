-- ============================================
-- Add request_id to audit_logs for correlation (I23)
-- This is an ADD-ONLY change — safe to run on production live.
-- ============================================

ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "request_id" VARCHAR(64);

-- Index for `find all audit entries from request X` (incident forensics)
CREATE INDEX IF NOT EXISTS "audit_logs_request_id_idx"
  ON "audit_logs" ("request_id");

COMMENT ON COLUMN "audit_logs"."request_id" IS
  'Correlates this audit entry with the HTTP request that triggered it. ' ||
  'Matches X-Request-Id header. Null for events created by background jobs.';
