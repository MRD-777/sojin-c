-- ============================================================
-- CLEANUP-PROJ-NOTE-002 — Orphan ProjectAssignment rows
-- ============================================================
--
-- Background
-- ----------
-- Session 2 introduced fix F1 in projects.service.ts:assignMember
-- restricting NEW assignments to staff-only roles:
--   role IN ('SITE_ENGINEER', 'SUPERVISOR', 'ACCOUNTANT', 'WORKER')
--
-- However, ProjectAssignment rows created BEFORE F1 may exist where
-- the user.role is in the now-forbidden set:
--   ('CLIENT', 'PROJECT_MANAGER', 'SUPER_ADMIN')
-- with removed_at IS NULL. These rows continue to pollute the
-- visibility filter in projects.service.ts:findAll (the assignments-
-- some clause), giving CLIENT/PM/SUPER_ADMIN users a duplicate path
-- to projects they already see via role-based filters.
--
-- This migration soft-removes those orphan assignments by setting
-- removed_at = NOW(). The data is preserved (audit-friendly soft
-- delete), and the visibility filter then ignores them via the
-- `removedAt: null` predicate.
--
-- ------------------------------------------------------------
-- Audit query (commented — run manually if you want a pre-flight
-- count before applying):
--
--   SELECT
--     pa.id              AS assignment_id,
--     pa.project_id,
--     pa.user_id,
--     u.role             AS user_role,
--     pa.role_in_project,
--     pa.assigned_at
--   FROM project_assignments pa
--   JOIN users u ON u.id = pa.user_id
--   WHERE pa.removed_at IS NULL
--     AND u.role IN ('CLIENT', 'PROJECT_MANAGER', 'SUPER_ADMIN');
--
-- ------------------------------------------------------------
-- Rollback note
-- -------------
-- If a row is mis-flagged, restore via:
--   UPDATE project_assignments SET removed_at = NULL WHERE id = '<assignment-id>';
-- The cleanup is non-destructive; no rows are deleted.
-- ============================================================

UPDATE project_assignments AS pa
SET removed_at = NOW()
FROM users AS u
WHERE pa.user_id = u.id
  AND pa.removed_at IS NULL
  AND u.role IN ('CLIENT', 'PROJECT_MANAGER', 'SUPER_ADMIN');
