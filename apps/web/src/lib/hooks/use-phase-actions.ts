"use client";
// ============================================
// Phase mutations — progress override / reorder (S4)
//
// Both invalidate ONLY the project detail: override recalcs project.
// overallProgress server-side, and reorder changes phase order — both are
// reflected by refetching GET /projects/:id (which bundles phases[]). Neither
// touches update lists, so we don't invalidate PHASE_UPDATES_QUERY_KEY.
//
// retry:false: these are state changes; a retry after a lost-but-committed
// response would re-apply (override) or 400. NO optimistic updates — the new
// progress/order must come from the server recalc, not a client guess.
// ============================================
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  overridePhaseProgress,
  reorderPhase,
  type PhaseActionResult,
} from "@/lib/api/phases-client";
import { projectQueryKey } from "./use-project";

interface OverrideProgressVars {
  phaseId: string;
  projectId: string;
  progress: number;
  reason: string;
}
interface ReorderVars {
  phaseId: string;
  projectId: string;
  order: number;
}

/** PATCH /phases/:id/progress — manual override + project recalc. */
export function useOverridePhaseProgress() {
  const queryClient = useQueryClient();
  return useMutation<PhaseActionResult, unknown, OverrideProgressVars>({
    mutationFn: ({ phaseId, progress, reason }) =>
      overridePhaseProgress(phaseId, { progress, reason }),
    retry: false,
    onSuccess: (_data, { projectId }) =>
      queryClient.invalidateQueries({ queryKey: projectQueryKey(projectId) }),
  });
}

/** PATCH /phases/:id/reorder — set display order. */
export function useReorderPhase() {
  const queryClient = useQueryClient();
  return useMutation<PhaseActionResult, unknown, ReorderVars>({
    mutationFn: ({ phaseId, order }) => reorderPhase(phaseId, { order }),
    retry: false,
    onSuccess: (_data, { projectId }) =>
      queryClient.invalidateQueries({ queryKey: projectQueryKey(projectId) }),
  });
}
