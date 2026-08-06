// ============================================
// phases-client — thin data functions over the generic `client` (S4)
//
// Only the two S4 phase mutations live here: progress override + reorder. The
// project detail response (GET /projects/:id) already bundles phases[], so we
// do NOT need a listProjectPhases fetch — the detail query is the source of
// phase ids. Both actions trigger a backend recalc of project.overallProgress
// (override always; reorder does not, but its consumer still invalidates the
// detail to reflect the new order). UI consumers invalidate + refetch, so the
// action return is typed to the minimal guaranteed shape (id).
// ============================================
import { client } from "./client";
import { unwrap } from "./http-shared";
import type { OverrideProgressBody, ReorderPhaseBody } from "@/types/update";

/** Minimal, always-present slice of a phase-action response. Full data comes
 *  from the invalidated project-detail query, not this body. */
export interface PhaseActionResult {
  id: string;
}

/**
 * PATCH /phases/:id/progress — manual progress override (recalcs project).
 * progress 0–100, reason 20–2000 (backend enforces).
 */
export async function overridePhaseProgress(
  id: string,
  body: OverrideProgressBody,
): Promise<PhaseActionResult> {
  const res = await client.patch(`/phases/${id}/progress`, body);
  return unwrap<PhaseActionResult>(res.data);
}

/** PATCH /phases/:id/reorder — set display order. order 0–1000 (backend). */
export async function reorderPhase(
  id: string,
  body: ReorderPhaseBody,
): Promise<PhaseActionResult> {
  const res = await client.patch(`/phases/${id}/reorder`, body);
  return unwrap<PhaseActionResult>(res.data);
}
