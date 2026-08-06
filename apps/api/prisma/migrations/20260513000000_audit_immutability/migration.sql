-- ============================================
-- Audit Logs Immutability (C24)
-- Make audit_logs append-only at the database level.
-- Prevents UPDATE, DELETE, TRUNCATE — even SUPER_ADMIN cannot tamper.
-- ============================================

-- Function that raises an exception for any modification attempt
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'audit_logs is append-only — % operations are forbidden', TG_OP
    USING ERRCODE = 'insufficient_privilege',
          HINT    = 'Audit records must be preserved for legal/compliance reasons. If a correction is needed, write a new audit entry referencing the original.';
END;
$$;

-- Trigger on UPDATE
DROP TRIGGER IF EXISTS audit_logs_prevent_update ON audit_logs;
CREATE TRIGGER audit_logs_prevent_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

-- Trigger on DELETE
DROP TRIGGER IF EXISTS audit_logs_prevent_delete ON audit_logs;
CREATE TRIGGER audit_logs_prevent_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

-- Trigger on TRUNCATE (statement-level)
DROP TRIGGER IF EXISTS audit_logs_prevent_truncate ON audit_logs;
CREATE TRIGGER audit_logs_prevent_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION prevent_audit_log_modification();

-- Document the intent at the table level
COMMENT ON TABLE audit_logs IS
  'Append-only audit log. UPDATE/DELETE/TRUNCATE are prevented by triggers. Retention: 7 years (Egyptian Commercial Law Art. 24).';
