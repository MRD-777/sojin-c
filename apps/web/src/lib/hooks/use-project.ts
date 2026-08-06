"use client";
// ============================================
// useProject — GET /projects/:id detail (S3)
//
// The detail response bundles phases[] + assignments[] in the same call, so
// one query hydrates the whole page. enabled:!!id guards against firing with an
// empty route param on first render. retry:false — same reasoning as use-me /
// useProjects (the interceptor owns 401→refresh).
//
// A 404 (deleted / out-of-tenant) reaches the caller as isError, NOT a 401, so
// the RouteGuard never redirects on it — the detail page renders a not-found
// state instead (plan Stage 4).
// ============================================
import { useQuery } from "@tanstack/react-query";
import { getProject } from "@/lib/api/projects-client";

/** Stable key factory so a single project can be invalidated after edits. */
export const projectQueryKey = (id: string) => ["project", id] as const;

export function useProject(id: string) {
  return useQuery({
    queryKey: projectQueryKey(id),
    queryFn: () => getProject(id),
    enabled: !!id,
    retry: false,
  });
}
