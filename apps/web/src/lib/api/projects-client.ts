// ============================================
// projects-client — thin data functions over the generic `client` (S3)
//
// Same contract as use-me's data path: go through the GENERIC client (Bearer +
// silent refresh-on-401 interceptors) and unwrap the { success, data, meta }
// success envelope via the shared helper. No React here — these are plain
// async functions the React Query hooks (Stage 2) wrap.
// ============================================
import { client } from "./client";
import { unwrap } from "./http-shared";
import type {
  CreateProjectInput,
  Paginated,
  ProjectDetail,
  ProjectListItem,
  ProjectsListQuery,
} from "@/types/project";

/** GET /projects — role-filtered list with pagination/search/status/type. */
export async function listProjects(
  query: ProjectsListQuery = {},
): Promise<Paginated<ProjectListItem>> {
  const res = await client.get("/projects", { params: query });
  return unwrap<Paginated<ProjectListItem>>(res.data);
}

/** GET /projects/:id — detail with phases[] + assignments[] bundled in. */
export async function getProject(id: string): Promise<ProjectDetail> {
  const res = await client.get(`/projects/${id}`);
  return unwrap<ProjectDetail>(res.data);
}

/** POST /projects — SUPER_ADMIN / PROJECT_MANAGER only (backend enforces). */
export async function createProject(
  input: CreateProjectInput,
): Promise<ProjectDetail> {
  const res = await client.post("/projects", input);
  return unwrap<ProjectDetail>(res.data);
}
