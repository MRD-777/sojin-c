"use client";
// ============================================
// useProjects — GET /projects list (S3)
//
// retry:false mirrors use-me: the generic client's interceptor already owns
// refresh + a single retry on 401, so an extra React Query retry would only add
// latency before the guard's redirect. The query key includes the full query
// object so pagination/search/status/type each cache under their own key.
// ============================================
import { useQuery } from "@tanstack/react-query";
import { listProjects } from "@/lib/api/projects-client";
import type { ProjectsListQuery } from "@/types/project";

/** Stable base key so callers can invalidate the whole list on mutations. */
export const PROJECTS_QUERY_KEY = ["projects"] as const;

export function useProjects(query: ProjectsListQuery = {}) {
  return useQuery({
    queryKey: [...PROJECTS_QUERY_KEY, query],
    queryFn: () => listProjects(query),
    retry: false,
  });
}
