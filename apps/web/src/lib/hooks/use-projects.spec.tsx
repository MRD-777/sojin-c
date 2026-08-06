// @vitest-environment jsdom
// MVT #2 (S3) — useProjects surfaces items from the (mocked) transport.
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { client } from "@/lib/api/client";
import { useProjects } from "@/lib/hooks/use-projects";

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

describe("useProjects", () => {
  it("returns the unwrapped items from the transport", async () => {
    const envelope = {
      success: true,
      data: {
        items: [
          { id: "p1", name: "Tower A" },
          { id: "p2", name: "Villa B" },
        ],
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    };
    client.defaults.adapter = vi.fn(async (config: any) => ({
      data: envelope,
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    })) as any;

    const { result } = renderHook(() => useProjects(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(2);
    expect(result.current.data?.items[0].name).toBe("Tower A");
    expect(result.current.data?.total).toBe(2);
  });
});
