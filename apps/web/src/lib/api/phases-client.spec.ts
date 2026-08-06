// MVT-2 (S4) — phases-client: the two phase-action functions put the id in the
// URL, use PATCH, and forward the exact body. This is the transport-level
// contract behind phase 8's progress-override + reorder UI (the swap fires this
// same reorderPhase twice — the two-write behaviour is a component concern; here
// we pin the single-call contract).
//
// node env; mock ONLY the transport, real `unwrap` still runs. axios has already
// run transformRequest by adapter time, so the body is a JSON string.
import { describe, it, expect, vi, afterEach } from "vitest";
import { client } from "@/lib/api/client";
import { overridePhaseProgress, reorderPhase } from "@/lib/api/phases-client";

const originalAdapter = client.defaults.adapter;

function mockTransport(data: unknown, capture?: (config: any) => void) {
  const adapter = vi.fn(async (config: any) => {
    capture?.(config);
    return { data, status: 200, statusText: "OK", headers: {}, config };
  });
  client.defaults.adapter = adapter as any;
  return adapter;
}

function body(config: any): unknown {
  const d = config?.data;
  if (d == null) return null;
  return typeof d === "string" ? JSON.parse(d) : d;
}

afterEach(() => {
  client.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("phases-client", () => {
  it("overridePhaseProgress PATCHes /phases/:id/progress with { progress, reason } and unwraps { id }", async () => {
    let seen: any;
    mockTransport({ success: true, data: { id: "ph1" } }, (c) => (seen = c));

    const result = await overridePhaseProgress("ph1", {
      progress: 60,
      reason: "site inspection confirmed 60% structural completion",
    });

    expect(result).toEqual({ id: "ph1" });
    expect(seen.method).toBe("patch");
    expect(seen.url).toContain("/phases/ph1/progress");
    expect(body(seen)).toEqual({
      progress: 60,
      reason: "site inspection confirmed 60% structural completion",
    });
  });

  it("reorderPhase PATCHes /phases/:id/reorder with { order } and unwraps { id }", async () => {
    let seen: any;
    mockTransport({ success: true, data: { id: "ph2" } }, (c) => (seen = c));

    const result = await reorderPhase("ph2", { order: 3 });

    expect(result).toEqual({ id: "ph2" });
    expect(seen.method).toBe("patch");
    expect(seen.url).toContain("/phases/ph2/reorder");
    expect(body(seen)).toEqual({ order: 3 });
  });
});
