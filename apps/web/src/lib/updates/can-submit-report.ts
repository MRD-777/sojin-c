// ============================================
// can-submit-report — who may author a daily report (Session A)
//
// This is a COPY of the backend's gate, kept deliberately literal:
//
//   apps/api/src/modules/updates/updates.controller.ts:38-44
//     const FIELD_ROLES = ['SUPER_ADMIN','PROJECT_MANAGER','SITE_ENGINEER',
//                          'SUPERVISOR','WORKER'] as const;
//
// applied via @Roles(...FIELD_ROLES) to create (:87), editDraft (:102) and
// submit (:117). ACCOUNTANT and CLIENT are viewers only (VIEWER_ROLES, :47-55).
//
// 🔴 UX ONLY. The backend is the authority — it re-checks the role AND, for
// non-admins, an active ProjectAssignment (updates.service.ts:214-222). Hiding
// the button is courtesy, never protection.
//
// Being a copy, it can drift from the source. The spec enumerates ALL SEVEN
// roles so that adding or renaming a role in the Prisma enum fails here loudly
// instead of silently widening the UI.
// ============================================
import type { UserRole } from "@/types/project";

const FIELD_ROLES: readonly UserRole[] = [
  "SUPER_ADMIN",
  "PROJECT_MANAGER",
  "SITE_ENGINEER",
  "SUPERVISOR",
  "WORKER",
];

/**
 * True when this role may create / edit / submit a daily report.
 *
 * The parameter is a plain string on purpose: the role reaches the UI as a free
 * string (AuthUser.role), so this function is the place that narrows it. The
 * list above stays typed as UserRole[] so a renamed/removed role fails to
 * COMPILE here rather than silently widening the gate — the same two-layer
 * trick types/project.ts uses for isProjectType.
 */
export function canSubmitReport(role: string | undefined | null): boolean {
  return role != null && (FIELD_ROLES as readonly string[]).includes(role);
}
