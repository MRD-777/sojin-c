// ============================================
// Error code registry.
//
// Format: <MODULE>_<TIER>_<NUM>
//
// Tiers (skill 06 §1):
//   VAL  — Validation (HTTP 400) — bad input from client
//   BIZ  — Business  (HTTP 4xx — varies) — input was OK, rule rejected it
//   SYS  — System    (HTTP 500) — infrastructure / unhandled bug
//
// Codes are STABLE. Frontends localize on the code, not the message. Adding
// new codes is safe; renaming or removing existing codes is a breaking
// change — never do it without a deprecation cycle.
// ============================================

export const ErrorCodes = {
  // ─── Auth (AUTH_*) ───────────────────────────────────────
  AUTH_VAL_001: 'AUTH_VAL_001', // Invalid email format
  AUTH_VAL_002: 'AUTH_VAL_002', // Weak password
  AUTH_BIZ_001: 'AUTH_BIZ_001', // Account locked (too many failures)
  AUTH_BIZ_002: 'AUTH_BIZ_002', // Email already registered
  AUTH_BIZ_003: 'AUTH_BIZ_003', // Subscription expired
  AUTH_BIZ_004: 'AUTH_BIZ_004', // Account deactivated
  AUTH_BIZ_005: 'AUTH_BIZ_005', // Refresh token expired / invalid
  AUTH_BIZ_006: 'AUTH_BIZ_006', // Invalid credentials (email or password)
  AUTH_BIZ_007: 'AUTH_BIZ_007', // Company unavailable (soft-deleted)
  AUTH_SYS_001: 'AUTH_SYS_001', // Supabase auth provider unavailable
  AUTH_SYS_002: 'AUTH_SYS_002', // Supabase ↔ DB inconsistency

  // ─── Projects (PROJ_*) ───────────────────────────────────
  PROJ_VAL_001: 'PROJ_VAL_001', // Bad input
  PROJ_BIZ_001: 'PROJ_BIZ_001', // Invalid status transition
  PROJ_BIZ_002: 'PROJ_BIZ_002', // No access to project (cross-tenant / not assigned)
  PROJ_BIZ_003: 'PROJ_BIZ_003', // Cannot delete project with active phases
  PROJ_BIZ_004: 'PROJ_BIZ_004', // Client role mismatch (not a CLIENT account)
  PROJ_SYS_001: 'PROJ_SYS_001', // Progress recalculation failed

  // ─── Updates (UPD_*) ─────────────────────────────────────
  UPD_VAL_001: 'UPD_VAL_001',
  UPD_BIZ_001: 'UPD_BIZ_001', // 24h lock window expired
  UPD_BIZ_002: 'UPD_BIZ_002', // Duplicate update for the day
  UPD_BIZ_003: 'UPD_BIZ_003', // Invalid state transition
  UPD_BIZ_004: 'UPD_BIZ_004', // Client cannot create updates
  UPD_BIZ_005: 'UPD_BIZ_005', // Not assigned to project
  UPD_BIZ_006: 'UPD_BIZ_006', // Cannot view non-APPROVED as CLIENT

  // ─── Payments (PAY_*) ────────────────────────────────────
  PAY_VAL_001: 'PAY_VAL_001', // Amount out of range
  PAY_BIZ_001: 'PAY_BIZ_001', // Duplicate Idempotency-Key with different body
  PAY_BIZ_002: 'PAY_BIZ_002', // Payment on a CANCELLED project
  PAY_BIZ_003: 'PAY_BIZ_003', // Already soft-deleted
  PAY_SYS_001: 'PAY_SYS_001', // Payment provider timeout (future)

  // ─── Files / Media (FILE_*) ──────────────────────────────
  FILE_VAL_001: 'FILE_VAL_001', // Invalid file type
  FILE_VAL_002: 'FILE_VAL_002', // File too large
  FILE_BIZ_001: 'FILE_BIZ_001', // Storage quota exceeded (tier)
  FILE_BIZ_002: 'FILE_BIZ_002', // Max-media-per-update cap
  FILE_SYS_001: 'FILE_SYS_001', // Storage upload failed
  FILE_SYS_002: 'FILE_SYS_002', // Malware scanner unreachable

  // ─── Tier / Billing (TIER_*) ─────────────────────────────
  TIER_BIZ_001: 'TIER_BIZ_001', // Limit reached (402 Payment Required)

  // ─── Common (COMMON_*) ───────────────────────────────────
  COMMON_SYS_001: 'COMMON_SYS_001', // DB connection error
  COMMON_SYS_002: 'COMMON_SYS_002', // Redis timeout
  COMMON_SYS_003: 'COMMON_SYS_003', // Circuit breaker open
  COMMON_SYS_999: 'COMMON_SYS_999', // Unclassified
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
