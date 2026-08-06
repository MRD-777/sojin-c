// @vitest-environment jsdom
// MVT #4 (S3) — useCreateProject, paired assertion at the DEEPEST layer (rule #4).
//
// The false-confidence trap rule #4 warns about would be asserting only that the
// mutation "resolved". Instead we capture the ACTUAL request body that reached
// the axios adapter and prove it is the full CreateProjectInput INCLUDING the
// clientId — the one field the whole Create flow exists to supply. We also prove
// the real side-effect (list invalidation) fired, by spying on the real
// QueryClient the hook consumes via useQueryClient().
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { client } from "@/lib/api/client";
import { useCreateProject } from "@/lib/hooks/use-create-project";
import { PROJECTS_QUERY_KEY } from "@/lib/hooks/use-projects";
import type { CreateProjectInput } from "@/types/project";

const originalAdapter = client.defaults.adapter;

afterEach(() => {
  cleanup();
  client.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("useCreateProject", () => {
  it("sends the FULL CreateProjectInput (with clientId) to the transport AND invalidates the list", async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    let sentBody: any;
    const created = { id: "new-1", name: "Tower Z" };
    client.defaults.adapter = vi.fn(async (config: any) => {
      sentBody =
        typeof config.data === "string" ? JSON.parse(config.data) : config.data;
      return {
        data: { success: true, data: created },
        status: 201,
        statusText: "Created",
        headers: {},
        config,
      };
    }) as any;

    const input: CreateProjectInput = {
      name: "Tower Z",
      clientId: "client-uuid-1",
      type: "CONSTRUCTION",
      totalBudget: 5000,
    };

    const { result } = renderHook(() => useCreateProject(), { wrapper });
    result.current.mutate(input);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // DEEPEST paired assertion (rule #4): the body ON THE WIRE equals the whole
    // input — clientId included — not merely "the promise resolved".
    expect(sentBody).toEqual(input);
    expect(sentBody.clientId).toBe("client-uuid-1");

    // Side-effect: the projects list is invalidated so the new row shows up
    // without a manual refetch.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: PROJECTS_QUERY_KEY });

    // And the unwrapped created project is what the caller receives.
    expect(result.current.data).toEqual(created);
  });
});
