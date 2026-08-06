"use client";
// ============================================
// useUpdate — GET /updates/:id detail (S4)
//
// One query hydrates the update-detail Dialog (phase + submitter + reviewer +
// media + comments bundled by the backend include). enabled:!!id guards the
// closed-dialog / empty-id render. retry:false — same reasoning as use-project:
// the interceptor owns 401→refresh, and a 404 (out-of-tenant / not-visible)
// reaches the caller as isError so the RouteGuard never redirects on it.
// ============================================
import { useQuery } from "@tanstack/react-query";
import { getUpdate } from "@/lib/api/updates-client";

/** Stable key factory so a single update can be invalidated after an action. */
export const updateQueryKey = (id: string) => ["update", id] as const;

export function useUpdate(id: string) {
  return useQuery({
    queryKey: updateQueryKey(id),
    queryFn: () => getUpdate(id),
    enabled: !!id,
    retry: false,
  });
}
