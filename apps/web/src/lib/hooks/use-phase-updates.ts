"use client";
// ============================================
// usePhaseUpdates — GET /phases/:phaseId/updates list (S4)
//
// retry:false mirrors use-projects/use-me: the generic client's interceptor
// owns refresh + a single retry on 401, so an extra React Query retry only adds
// latency before the guard's redirect. The key includes phaseId + the full
// query object so each (phase, status) pair caches independently.
//
// phaseUpdatesQueryOptions is exported so the Review panel (Stage 5) can fan out
// across a project's phases with useQueries using the SAME keys/queryFn — no key
// drift between the single-phase hook and the aggregated view.
// ============================================
import { useQuery } from "@tanstack/react-query";
import { listPhaseUpdates } from "@/lib/api/updates-client";
import type { PhaseUpdatesQuery } from "@/types/update";

/** Stable base key so any (phase, status) list can be invalidated by prefix. */
export const PHASE_UPDATES_QUERY_KEY = ["phase-updates"] as const;

/** Shared query options — single source of truth for key + fetch + retry. */
export function phaseUpdatesQueryOptions(
  phaseId: string,
  query: PhaseUpdatesQuery = {},
  enabled = true,
) {
  return {
    queryKey: [...PHASE_UPDATES_QUERY_KEY, phaseId, query] as const,
    queryFn: () => listPhaseUpdates(phaseId, query),
    enabled: enabled && !!phaseId,
    retry: false as const,
  };
}

export function usePhaseUpdates(phaseId: string, query: PhaseUpdatesQuery = {}) {
  return useQuery(phaseUpdatesQueryOptions(phaseId, query));
}
