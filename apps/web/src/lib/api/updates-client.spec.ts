// MVT-1 (S4) — updates-client: envelope unwrap + method/URL/body per action,
// AND the paired assertion (rule #4): the EXACT key handed to approve /
// force-cancel is the one that reaches the transport `Idempotency-Key` header —
// not merely a well-formed key, but byte-for-byte the caller's key.
//
// Runs in the default `node` env. We mock ONLY the transport (axios adapter);
// real interceptors + real `unwrap` still run, so this exercises the actual
// data path. axios has already run transformRequest by adapter time, so the
// outgoing body is a JSON string — we parse it back to assert the shape.
import { describe, it, expect, vi, afterEach } from "vitest";
import { client } from "@/lib/api/client";
import {
  listPhaseUpdates,
  getUpdate,
  approveUpdate,
  rejectUpdate,
  forceCancelUpdate,
} from "@/lib/api/updates-client";
import { generateIdempotencyKey } from "@/lib/api/idempotency-key";

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

/** Read a header case-insensitively whether config.headers is AxiosHeaders or plain. */
function header(config: any, name: string): string | undefined {
  const h = config?.headers;
  if (!h) return undefined;
  return typeof h.get === "function" ? h.get(name) : h[name];
}

/** Parse the outgoing body (JSON string after transformRequest) back to an object. */
function body(config: any): unknown {
  const d = config?.data;
  if (d == null) return null;
  return typeof d === "string" ? JSON.parse(d) : d;
}

afterEach(() => {
  client.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("updates-client", () => {
  it("listPhaseUpdates unwraps { data } and forwards the status/page query as params", async () => {
    let seen: any;
    const envelope = {
      success: true,
      data: { items: [{ id: "u1", title: "Day 1" }], total: 1, page: 1, limit: 20, totalPages: 1 },
      meta: {},
    };
    mockTransport(envelope, (c) => (seen = c));

    const result = await listPhaseUpdates("ph1", { status: "PENDING", page: 1, limit: 20 });

    expect(result).toEqual(envelope.data);
    expect(result.items[0].id).toBe("u1");
    expect(seen.method).toBe("get");
    expect(seen.url).toContain("/phases/ph1/updates");
    expect(seen.params).toEqual({ status: "PENDING", page: 1, limit: 20 });
  });

  it("getUpdate puts the id in the URL and unwraps the detail", async () => {
    let seen: any;
    mockTransport({ success: true, data: { id: "u9", status: "PENDING" } }, (c) => (seen = c));

    const result = await getUpdate("u9");
    expect(result.id).toBe("u9");
    expect(seen.method).toBe("get");
    expect(seen.url).toContain("/updates/u9");
  });

  it("approveUpdate POSTs to /approve with NO body and forwards the EXACT key as the Idempotency-Key header (paired)", async () => {
    let seen: any;
    mockTransport({ success: true, data: { id: "u1", status: "APPROVED" } }, (c) => (seen = c));

    const key = generateIdempotencyKey(); // the exact key the caller (holder) supplies
    const result = await approveUpdate("u1", key);

    expect(result).toEqual({ id: "u1", status: "APPROVED" });
    expect(seen.method).toBe("post");
    expect(seen.url).toContain("/updates/u1/approve");
    expect(body(seen)).toBeNull(); // approve carries no body
    // PAIRED (rule #4): byte-for-byte the same key reached the wire.
    expect(header(seen, "Idempotency-Key")).toBe(key);
  });

  it("rejectUpdate POSTs the reason body and carries NO Idempotency-Key", async () => {
    let seen: any;
    mockTransport({ success: true, data: { id: "u1", status: "REJECTED" } }, (c) => (seen = c));

    const result = await rejectUpdate("u1", { reason: "insufficient evidence provided" });

    expect(result.status).toBe("REJECTED");
    expect(seen.method).toBe("post");
    expect(seen.url).toContain("/updates/u1/reject");
    expect(body(seen)).toEqual({ reason: "insufficient evidence provided" });
    expect(header(seen, "Idempotency-Key")).toBeUndefined();
  });

  it("forceCancelUpdate POSTs the reason body AND forwards the EXACT key as the Idempotency-Key header (paired)", async () => {
    let seen: any;
    mockTransport({ success: true, data: { id: "u1", status: "FORCE_CANCELLED" } }, (c) => (seen = c));

    const key = generateIdempotencyKey();
    const result = await forceCancelUpdate(
      "u1",
      { reason: "client cancelled the scope of works entirely" },
      key,
    );

    expect(result.status).toBe("FORCE_CANCELLED");
    expect(seen.method).toBe("post");
    expect(seen.url).toContain("/updates/u1/force-cancel");
    expect(body(seen)).toEqual({ reason: "client cancelled the scope of works entirely" });
    // PAIRED (rule #4): the money-moving action ships the caller's exact key.
    expect(header(seen, "Idempotency-Key")).toBe(key);
  });
});
