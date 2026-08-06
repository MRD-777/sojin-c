"use client";
// ============================================
// useCreateProject — POST /projects mutation (S3)
//
// onSuccess invalidates the projects list so the new project shows without a
// manual refetch. We deliberately do NOT set retry here: a create is not
// idempotent at this endpoint (no Idempotency-Key like payments), so a blind
// retry could double-create. The caller reads isPending to disable submit and
// error to surface the backend 400/403 (already mapped by the interceptor).
// ============================================
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createProject } from "@/lib/api/projects-client";
import { PROJECTS_QUERY_KEY } from "./use-projects";
import type { CreateProjectInput, ProjectDetail } from "@/types/project";

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation<ProjectDetail, unknown, CreateProjectInput>({
    mutationFn: (input) => createProject(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
    },
  });
}
