// @vitest-environment jsdom
// MVT #3 (S3) — useProject returns detail (phases + assignments) AND the
// negative case: enabled:false means an empty id NEVER fires the transport.
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { client } from "@/lib/api/client";
import { useProject } from "@/lib/hooks/use-project";

const originalAdapter = client.defaults.adapter;

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
  client.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("useProject", () => {
  it("returns the detail with phases[] + assignments[] bundled in", async () => {
    const detail = {
      id: "p1",
      name: "Tower A",
      phases: [{ id: "ph1", name: "Foundation" }],
      assignments: [{ id: "a1", roleInProject: "SITE_ENGINEER" }],
    };
    client.defaults.adapter = vi.fn(async (config: any) => ({
      data: { success: true, data: detail },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    })) as any;

    const { result } = renderHook(() => useProject("p1"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe("p1");
    expect(result.current.data?.phases).toHaveLength(1);
    expect(result.current.data?.assignments).toHaveLength(1);
  });

  it("stays disabled (transport never called) when id is empty", async () => {
    const adapter = vi.fn(async (config: any) => ({
      data: { success: true, data: {} },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    }));
    client.defaults.adapter = adapter as any;

    const { result } = renderHook(() => useProject(""), {
      wrapper: makeWrapper(),
    });

    // enabled:!!id ⇒ the query is idle and no request is ever made.
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
    expect(adapter).not.toHaveBeenCalled();
  });
});
