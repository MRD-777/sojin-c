// MVT #1 (S3) — projects-client: envelope unwrap + query params reach the wire.
//
// These are plain async functions over the generic `client`; no DOM needed, so
// this runs in the default `node` env. We mock ONLY the transport (axios
// adapter) — the real interceptors + real `unwrap` still run, so the test
// exercises the actual data path, not a stub of it.
import { describe, it, expect, vi, afterEach } from "vitest";
import { client } from "@/lib/api/client";
import {
  listProjects,
  getProject,
  createProject,
} from "@/lib/api/projects-client";
import type { ProjectsListQuery, CreateProjectInput } from "@/types/project";

const originalAdapter = client.defaults.adapter;

/** Mock the transport to return `data`, capturing the outgoing config. */
function mockTransport(data: unknown, capture?: (config: any) => void) {
  const adapter = vi.fn(async (config: any) => {
    capture?.(config);
    return { data, status: 200, statusText: "OK", headers: {}, config };
  });
  client.defaults.adapter = adapter as any;
  return adapter;
}

afterEach(() => {
  client.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("projects-client", () => {
  it("listProjects unwraps the { data } envelope AND forwards the query as transport params", async () => {
    let seen: any;
    const envelope = {
      success: true,
      data: {
        items: [{ id: "p1", name: "Tower A" }],
        total: 1,
        page: 2,
        limit: 10,
        totalPages: 1,
      },
      meta: {},
    };
    mockTransport(envelope, (c) => {
      seen = c;
    });

    const query: ProjectsListQuery = {
      page: 2,
      limit: 10,
      search: "tower",
      status: "IN_PROGRESS",
    };
    const result = await listProjects(query);

    // unwrap: caller receives the INNER data, never the envelope.
    expect(result).toEqual(envelope.data);
    expect(result.items[0].id).toBe("p1");
    // params were handed to the transport verbatim (pagination/search cache key).
    expect(seen.params).toEqual(query);
    expect(seen.url).toContain("/projects");
    expect(seen.method).toBe("get");
  });

  it("getProject puts the id in the URL and unwraps the detail", async () => {
    let seen: any;
    mockTransport(
      { success: true, data: { id: "p1", name: "Tower A", phases: [], assignments: [] } },
      (c) => {
        seen = c;
      },
    );

    const result = await getProject("p1");
    expect(result.id).toBe("p1");
    expect(seen.url).toContain("/projects/p1");
  });

  it("createProject posts the body and unwraps the created project", async () => {
    let seen: any;
    mockTransport({ success: true, data: { id: "new-1", name: "Tower Z" } }, (c) => {
      seen = c;
    });

    const input: CreateProjectInput = { name: "Tower Z", clientId: "client-1" };
    const result = await createProject(input);

    expect(result.id).toBe("new-1");
    expect(seen.method).toBe("post");
    expect(seen.url).toContain("/projects");
  });
});
