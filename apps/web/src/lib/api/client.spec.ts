// ============================================
// client.spec — R-1: the refresh-SUCCESS path of the response interceptor
//
// Until this file, the interceptor in lib/api/client.ts was covered for its
// FAILURE branch only (route-guard.spec.tsx: 401 → refresh rejects → terminal
// teardown). The success branch — 401 → refresh resolves → retry with the new
// token → caller gets its data — had zero coverage, despite being the common
// path in production (S2 success criterion #3, never verified).
//
// What is mocked, and what is NOT (DP4):
//   mocked   → the transport (client.defaults.adapter) + authClient.refresh
//   REAL     → both interceptors, the real auth store, the real mapAuthError,
//              the real refreshInFlight singleton, real axios mergeConfig.
// So these specs exercise the actual data path, not a stub of it.
//
// Assertion discipline (rule #4): every claim is checked on the ARGUMENT that
// reached the transport (the outgoing config), never on the returned value
// alone. A spec that only asserts `resolves` would stay green even if the
// retry re-sent the OLD token — which is the entire bug class R-1 is about.
// ============================================
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { InternalAxiosRequestConfig } from "axios";
import { client } from "./client";
import { authClient } from "./auth-client";
import { useAuthStore } from "@/store/use-auth-store";

const OLD = "OLD_TOKEN";
const NEW = "NEW_TOKEN";

const originalAdapter = client.defaults.adapter;

/** Config as it reaches the transport, plus the `_retry` marker under test. */
type SeenConfig = InternalAxiosRequestConfig & { _retry?: boolean };

/**
 * Read the Authorization header off a transport-bound config.
 * axios may hand the adapter either a plain object or an AxiosHeaders
 * instance, so we support both rather than assuming one shape.
 */
function authHeaderOf(config: SeenConfig): string | undefined {
  const headers = config.headers as unknown as {
    get?: (name: string) => unknown;
    Authorization?: unknown;
  };
  const viaGetter =
    typeof headers?.get === "function" ? headers.get("Authorization") : undefined;
  const value = viaGetter ?? headers?.Authorization;
  return typeof value === "string" ? value : undefined;
}

/** An axios-shaped 401 rejection carrying the backend error envelope. */
function reject401(config: SeenConfig) {
  return Promise.reject(
    Object.assign(new Error("Request failed with status code 401"), {
      isAxiosError: true,
      config,
      response: {
        status: 401,
        statusText: "Unauthorized",
        headers: {},
        config,
        data: { success: false, code: "UNAUTHORIZED", message: "غير مصرح" },
      },
    }),
  );
}

function ok(config: SeenConfig, data: unknown) {
  return Promise.resolve({
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  });
}

/**
 * Transport recorder. `handler` decides each response by call index.
 *
 * Everything we assert on is snapshotted BY VALUE at call time. Keeping only
 * object references would be wrong here: the interceptor mutates the very
 * config it received (`config._retry = true` on client.ts:100 lands on
 * `error.config`, i.e. the object the transport was handed for attempt #1),
 * so a later read would report post-hoc state and describe the wrong moment.
 */
function recordingAdapter(
  handler: (config: SeenConfig, callIndex: number) => Promise<unknown>,
) {
  const configs: SeenConfig[] = [];
  const authHeaders: (string | undefined)[] = [];
  const retryFlags: (boolean | undefined)[] = [];

  const adapter = vi.fn((config: SeenConfig) => {
    const index = configs.length;
    configs.push(config);
    authHeaders.push(authHeaderOf(config));
    retryFlags.push(config._retry);
    return handler(config, index);
  });

  client.defaults.adapter = adapter as never;
  return {
    adapter,
    configs,
    authHeaders,
    retryFlags,
    get count() {
      return configs.length;
    },
  };
}

/**
 * Advance the microtask queue without timers. The interceptor chain is
 * promise-only, so N microtask ticks are enough to drive it to a stable
 * point — and unlike setTimeout this stays deterministic under fake clocks.
 */
async function flushMicrotasks(ticks = 20): Promise<void> {
  for (let i = 0; i < ticks; i += 1) {
    await Promise.resolve();
  }
}

/** A promise whose settlement we control, to pin the concurrency window. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  useAuthStore.getState().clear();
  useAuthStore.getState().setAccessToken(OLD);
});

afterEach(async () => {
  // The refreshInFlight singleton (client.ts:58) is module-level state: a spec
  // that leaves a refresh pending would leak it into the next one. Draining
  // the microtask queue lets any in-flight chain reach its `.finally`, which
  // is what resets the singleton.
  await flushMicrotasks();
  client.defaults.adapter = originalAdapter;
  useAuthStore.getState().clear();
  vi.restoreAllMocks();
});

describe("client — refresh-on-401 interceptor (R-1)", () => {
  // ── MVT-1 — the success path, end to end. The core of R-1. ──
  it("401 ⇒ refresh succeeds ⇒ the ORIGINAL request is retried with the NEW token and the caller gets its data", async () => {
    const refreshSpy = vi
      .spyOn(authClient, "refresh")
      .mockResolvedValue({ accessToken: NEW });

    const t = recordingAdapter((config, i) =>
      i === 0
        ? reject401(config)
        : ok(config, { success: true, data: { id: "p1", name: "Tower A" } }),
    );

    const response = await client.get("/projects/p1");

    // (1) The caller really received the payload — the 401 was invisible to it.
    expect(response.data).toEqual({
      success: true,
      data: { id: "p1", name: "Tower A" },
    });

    // (2) Exactly one retry reached the wire.
    expect(t.count).toBe(2);

    // (3)+(4) DEEPEST assertion (rule #4): the token actually SENT on each
    // attempt, byte-for-byte, as the transport saw it. Asserting only that the
    // promise resolved would pass even if the retry re-sent OLD — the precise
    // false-confidence pattern this session exists to close.
    expect(t.authHeaders[0]).toBe(`Bearer ${OLD}`);
    expect(t.authHeaders[1]).toBe(`Bearer ${NEW}`);

    // (5) Paired assertion on the store: the new token was persisted, so the
    //     NEXT request starts authenticated too (not just this retry).
    expect(useAuthStore.getState().accessToken).toBe(NEW);

    // (6) One refresh, not several.
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  // ── MVT-2 — canary over axios internals, not over our own logic. ──
  //
  // 🔴 IF THIS SPEC FAILS AFTER AN AXIOS UPGRADE: axios stopped propagating
  // unknown config keys through mergeConfig, so `_retry` no longer survives
  // `client(config)`. Consequence in production: every failed retry looks
  // "fresh" to the interceptor ⇒ unbounded refresh loop. Read
  // node_modules/axios/lib/core/mergeConfig.js (the unknown-key branch,
  // ~line 101 in 1.15.0) BEFORE touching this spec — do not "fix" it by
  // relaxing the assertion.
  //
  // Why separate from MVT-3: this pins the MECHANISM (an axios implementation
  // detail we depend on, reachable via a caret range), while MVT-3 pins the
  // BEHAVIOUR. Split, the failure message tells us which one broke.
  it("marks the retried request with _retry=true, and that flag survives axios mergeConfig all the way to the transport", async () => {
    vi.spyOn(authClient, "refresh").mockResolvedValue({ accessToken: NEW });

    const t = recordingAdapter((config, i) =>
      i === 0 ? reject401(config) : ok(config, { success: true, data: {} }),
    );

    await client.get("/projects");

    expect(t.count).toBe(2);
    // Read off the config the TRANSPORT received, snapshotted at call time —
    // not from a local variable, and not by reference (attempt #1's config is
    // mutated in place by the interceptor after the transport returns it).
    expect(t.retryFlags[0]).toBeFalsy();
    expect(t.retryFlags[1]).toBe(true);
  });

  // ── MVT-3 — one retry, exactly. No loop. ──
  it("retries only ONCE: a 401 on the retry is terminal — no second refresh, and the session is torn down", async () => {
    const refreshSpy = vi
      .spyOn(authClient, "refresh")
      .mockResolvedValue({ accessToken: NEW });

    // A third transport call would mean the retry was itself retried. Fail
    // loudly and immediately rather than hanging until the test times out.
    const t = recordingAdapter((config, i) => {
      if (i < 2) return reject401(config);
      throw new Error(`LOOP: transport called ${i + 1} times, expected 2`);
    });

    await expect(client.get("/projects")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    // (1) The loop guard: refresh ran once, not once per 401.
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    // (2) Hard numeric ceiling on wire traffic.
    expect(t.count).toBe(2);
    // (3) Terminal teardown really happened (token was NEW after the refresh,
    //     so `null` here proves a wipe, not merely an absent value).
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  // ── MVT-4 — no refresh stampede under concurrency. ──
  it("N concurrent 401s share ONE refresh call, and each request still resolves with its own response", async () => {
    // Deferred, NOT pre-resolved: an immediately-resolved refresh could let the
    // three requests pass by timing luck rather than because the singleton
    // works. Holding it open pins the window — all three provably reach the
    // 401 branch before any refresh settles.
    const gate = deferred<{ accessToken: string }>();
    const refreshSpy = vi
      .spyOn(authClient, "refresh")
      .mockReturnValue(gate.promise as ReturnType<typeof authClient.refresh>);

    // First three calls (the initial requests) 401; the rest succeed, keyed by
    // URL so a crossed config would surface as a wrong payload.
    const t = recordingAdapter((config, i) =>
      i < 3
        ? reject401(config)
        : ok(config, { success: true, data: { url: config.url } }),
    );

    const inFlight = Promise.all([
      client.get("/a"),
      client.get("/b"),
      client.get("/c"),
    ]);

    // Let all three reach the interceptor's refresh branch before releasing.
    await flushMicrotasks();
    expect(t.count).toBe(3);
    expect(refreshSpy).toHaveBeenCalledTimes(1);

    gate.resolve({ accessToken: NEW });
    const [a, b, c] = await inFlight;

    // (1) THE anti-stampede assertion: still exactly one refresh after all
    //     three resumed — N 401s did not become N /auth/refresh calls.
    expect(refreshSpy).toHaveBeenCalledTimes(1);

    // (2) Every request was retried and got ITS OWN response back.
    expect(t.count).toBe(6);
    expect(a.data).toEqual({ success: true, data: { url: "/a" } });
    expect(b.data).toEqual({ success: true, data: { url: "/b" } });
    expect(c.data).toEqual({ success: true, data: { url: "/c" } });

    // (3) All three retries carried the refreshed token (transport-level).
    expect(t.authHeaders.slice(0, 3)).toEqual([
      `Bearer ${OLD}`,
      `Bearer ${OLD}`,
      `Bearer ${OLD}`,
    ]);
    expect(t.authHeaders.slice(3)).toEqual([
      `Bearer ${NEW}`,
      `Bearer ${NEW}`,
      `Bearer ${NEW}`,
    ]);
  });
});
