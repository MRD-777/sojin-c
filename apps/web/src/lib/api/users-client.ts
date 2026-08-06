// ============================================
// users-client — thin data functions over the generic `client` (S3)
//
// Same contract as projects-client: go through the generic client (Bearer +
// refresh-on-401) and unwrap the success envelope. S3 only needs the CLIENT
// list to feed the Create form's client selector; broader users wiring lands
// with the Team pages (S6).
// ============================================
import { client } from "./client";
import { unwrap } from "./http-shared";
import type { ClientOption, Paginated } from "@/types/project";

/**
 * GET /users?role=CLIENT — CLIENT users for the Create-project selector.
 * SUPER_ADMIN / PROJECT_MANAGER only (backend enforces; those are also the
 * only roles allowed to POST /projects, so the selector is never shown to a
 * role that couldn't use it). limit is raised so the dropdown isn't truncated
 * by the default page size.
 */
export async function listClients(): Promise<ClientOption[]> {
  const res = await client.get("/users", {
    params: { role: "CLIENT", limit: 100 },
  });
  return unwrap<Paginated<ClientOption>>(res.data).items;
}
