// ============================================
// MVT-5 — who may author a report (Session A)
//
// Paired assertion (rule #4): the two roles that must NOT see the control are
// asserted false, AND the five that must see it are asserted true. All SEVEN
// roles of the Prisma enum are enumerated, so a role added or renamed upstream
// lands here as a failure instead of silently widening the gate.
//
// The authority is the backend (@Roles(...FIELD_ROLES) on create/editDraft/
// submit — updates.controller.ts:87,102,117). This spec guards the UI copy
// against drifting from it, nothing more.
// ============================================
import { describe, it, expect } from "vitest";
import { canSubmitReport } from "./can-submit-report";
import type { UserRole } from "@/types/project";

/** Every member of UserRole (types/project.ts:49-56) — the list is exhaustive
 *  by construction: the annotation fails to compile if a member disappears. */
const ALL_ROLES: Record<UserRole, boolean> = {
  SUPER_ADMIN: true,
  PROJECT_MANAGER: true,
  SITE_ENGINEER: true,
  SUPERVISOR: true,
  WORKER: true,
  ACCOUNTANT: false,
  CLIENT: false,
};

describe("MVT-5 — canSubmitReport mirrors backend FIELD_ROLES", () => {
  it("CLIENT cannot author a report", () => {
    expect(canSubmitReport("CLIENT")).toBe(false);
  });

  it("ACCOUNTANT cannot author a report (viewer only)", () => {
    expect(canSubmitReport("ACCOUNTANT")).toBe(false);
  });

  it.each(
    (Object.keys(ALL_ROLES) as UserRole[]).filter((r) => ALL_ROLES[r]),
  )("%s can author a report", (role) => {
    expect(canSubmitReport(role)).toBe(true);
  });

  it("covers all seven roles — no member left unasserted", () => {
    expect(Object.keys(ALL_ROLES)).toHaveLength(7);
    for (const [role, allowed] of Object.entries(ALL_ROLES)) {
      expect(canSubmitReport(role)).toBe(allowed);
    }
  });

  it("missing / unknown role is denied, never defaulted open", () => {
    expect(canSubmitReport(undefined)).toBe(false);
    expect(canSubmitReport(null)).toBe(false);
    expect(canSubmitReport("")).toBe(false);
    expect(canSubmitReport("SUPER_ADMINN")).toBe(false);
    expect(canSubmitReport("super_admin")).toBe(false);
  });
});
