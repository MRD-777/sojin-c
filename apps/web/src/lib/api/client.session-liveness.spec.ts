// @vitest-environment jsdom
// ============================================
// client.session-liveness.spec — does a failed request KILL the session?
//
// This is the spec file for the third state (Session 2026-08-08). client.spec
// covers the refresh-SUCCESS path (R-1); this one covers what happens when the
// request — or the refresh itself — fails, and answers the only question that
// matters for the /dashboard ⇄ /login loop: *was the session torn down?*
//
// ── Why jsdom and not node (plan, MVT-3 note) ──
// The teardown is `store.clear()` + `clearAuthHint()`. Under the node
// environment `document` does not exist, so clearAuthHint is a NO-OP
// (auth-hint.ts:38) and a spy on it would assert a call that changes nothing.
// The cookie is not a detail here: it is the input the Next middleware reads,
// i.e. the OTHER leg of the loop. So every teardown claim below is asserted on
// `document.cookie` itself — the deepest representable layer (rule #4) — and
// the hint is seeded through the real `setAuthHint()`, never hand-written.
//
// What is mocked, and what is NOT (DP4):
//   mocked → the transport (client.defaults.adapter) + authClient.refresh
//   REAL   → both interceptors, the real store, the real mapAuthError, the real
//            classifyFailure, the real refreshInFlight singleton, the real
//            auth-hint cookie helpers.
//
// 🔴 Rejections from `authClient.refresh` are built by running the REAL
// `mapAuthError` over a real axios-shaped error. auth-client.ts:78 throws
// `mapAuthError(e)` on every failure and nothing else, so any hand-written
// literal — or a bare `new Error()` — would be a stimulus production cannot
// produce. A spec fed an impossible stimulus documents the bug, not the
// behaviour (this file's ancestor did exactly that; see 02-coder-report.md
// انحراف (هـ)).
// ============================================
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { InternalAxiosRequestConfig } from "axios";
import { client } from "./client";
import { authClient } from "./auth-client";
import { mapAuthError } from "./map-auth-error";
import { setAuthHint, clearAuthHint, AUTH_HINT_NAME } from "@/lib/auth/auth-hint";
import { useAuthStore, type AuthUser } from "@/store/use-auth-store";

const OLD = "OLD_TOKEN";
const NEW = "NEW_TOKEN";

const USER: AuthUser = {
  id: "u1",
  name: "Mohamed Ali",
  email: "m@a.com",
  role: "SUPER_ADMIN",
  specialty: null,
  avatar: null,
  preferredLanguage: "ar",
  company: { id: "c1", name: "Acme", slug: "acme", logo: null },
};

const originalAdapter = client.defaults.adapter;

type SeenConfig = InternalAxiosRequestConfig & { _retry?: boolean };

/** True iff the middleware would still see a session hint on this origin. */
function hasAuthHint(): boolean {
  return document.cookie.includes(`${AUTH_HINT_NAME}=1`);
}

/** An axios-shaped rejection WITH a response (the server answered). */
function httpError(status: number, envelope: Record<string, unknown>, config?: SeenConfig) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    config,
    response: { status, statusText: "", headers: {}, config, data: envelope },
  });
}

/**
 * An axios-shaped rejection with NO response — the request left, nothing came
 * back. `request` present + `response` absent is precisely how axios reports a
 * dead network, and precisely what mapAuthError reads as NETWORK.
 */
function networkError(config?: SeenConfig) {
  return Object.assign(new Error("Network Error"), {
    isAxiosError: true,
    config,
    request: {},
  });
}

/** Transport recorder — counts wire traffic so "no retry" is a hard number. */
function recordingAdapter(handler: (config: SeenConfig, callIndex: number) => Promise<unknown>) {
  const configs: SeenConfig[] = [];
  const adapter = vi.fn((config: SeenConfig) => {
    const index = configs.length;
    configs.push(config);
    return handler(config, index);
  });
  client.defaults.adapter = adapter as never;
  return {
    adapter,
    get count() {
      return configs.length;
    },
  };
}

/** Drive the promise-only interceptor chain to a stable point. */
async function flushMicrotasks(ticks = 20): Promise<void> {
  for (let i = 0; i < ticks; i += 1) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  // A LIVE session, seeded through the real APIs: token + user in the store,
  // hint cookie written by the real setAuthHint. Everything below asserts a
  // CHANGE from this state, so "cleared" can never be confused with "absent".
  useAuthStore.getState().clear();
  useAuthStore.getState().setSession({ accessToken: OLD, user: USER });
  clearAuthHint();
  setAuthHint();
  expect(hasAuthHint()).toBe(true);
});

afterEach(async () => {
  // refreshInFlight (client.ts) is module-level: let any pending chain reach
  // its `.finally` so it cannot leak into the next spec.
  await flushMicrotasks();
  client.defaults.adapter = originalAdapter;
  useAuthStore.getState().clear();
  clearAuthHint();
  vi.restoreAllMocks();
});

describe("client — session liveness on failure", () => {
  // ── MVT-3 — THE loop killer: an unreachable API must change nothing. ──
  it("network failure on a protected call ⇒ session SURVIVES intact (no teardown, no refresh attempt)", async () => {
    const refreshSpy = vi.spyOn(authClient, "refresh");
    const t = recordingAdapter((config) => Promise.reject(networkError(config)));

    await expect(client.get("/users/me")).rejects.toMatchObject({
      code: "NETWORK",
      sessionDisposition: "indeterminate",
    });

    // (1) The store is untouched — token AND identity, not just one of them.
    expect(useAuthStore.getState().accessToken).toBe(OLD);
    expect(useAuthStore.getState().user).toEqual(USER);

    // (2) DEEPEST assertion (rule #4): the cookie the MIDDLEWARE reads is still
    //     there. This is the half that turned a redirect into a loop — the
    //     guard called the session dead while the middleware called it alive.
    expect(hasAuthHint()).toBe(true);

    // (3) Paired negative: we did not even ATTEMPT a refresh. Asserting only
    //     "no teardown" would still pass if we had started hammering
    //     /auth/refresh at a network that is down.
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(t.count).toBe(1);
  });

  // ── MVT-4 — the control for MVT-3: a proven 401 MUST still tear down. ──
  //
  // Without this spec, MVT-3 going green would be ambiguous: teardown might
  // simply be broken everywhere. Here the refresh SUCCEEDS and the retry is
  // still 401 ⇒ alreadyRetried ⇒ terminal.
  it("401 that survives the single retry ⇒ session is really WIPED (store + hint cookie)", async () => {
    const refreshSpy = vi.spyOn(authClient, "refresh").mockResolvedValue({ accessToken: NEW });

    const t = recordingAdapter((config) =>
      Promise.reject(
        httpError(401, { success: false, code: "UNAUTHORIZED", message: "غير مصرح" }, config),
      ),
    );

    await expect(client.get("/users/me")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      sessionDisposition: "terminal",
    });

    // (1) The token was NEW when the teardown ran (the refresh had succeeded),
    //     so `null` here proves an actual wipe rather than an absent value.
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();

    // (2) The hint was removed from the real cookie jar — the middleware will
    //     now agree with the guard, which is what lets /login stick.
    expect(hasAuthHint()).toBe(false);

    // (3) Exactly one refresh and exactly one retry — no loop.
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(t.count).toBe(2);
  });

  // ══ MVT-6 / MVT-7 — the pair. Same stimulus shape, ONE difference: status. ══
  //
  // They are mandatory as a pair (architect §5). Alone, MVT-6 green could mean
  // the refresh-failure teardown is dead in all cases; alone, MVT-7 green could
  // mean it fires in all cases. Together, they pin the discriminator to the
  // HTTP status the refresh came back with — which is the whole point of
  // carrying `status` on AuthError (Stage 2د).

  // ── MVT-6 — a THROTTLED refresh must not sign anyone out. ──
  it("refresh fails with 429 (full envelope) ⇒ session SURVIVES, and the real code/message reach the caller", async () => {
    const refreshSpy = vi.spyOn(authClient, "refresh").mockRejectedValue(
      mapAuthError(
        httpError(429, {
          success: false,
          code: "TOO_MANY_REQUESTS",
          message: "عدد كبير من المحاولات — انتظر قليلاً",
        }),
      ),
    );

    // A second transport call would mean we retried after a failed refresh.
    const t = recordingAdapter((config, i) => {
      if (i === 0) {
        return Promise.reject(
          httpError(401, { success: false, code: "UNAUTHORIZED", message: "غير مصرح" }, config),
        );
      }
      throw new Error(`unexpected retry: transport called ${i + 1} times`);
    });

    const rejection = await client.get("/users/me").then(
      () => {
        throw new Error("expected the request to reject");
      },
      (e: unknown) => e,
    );

    // (1) The verdict: we learned NOTHING, so nothing is decided.
    expect(rejection).toMatchObject({ sessionDisposition: "indeterminate" });

    // (2) DEEPEST assertion on the double-mapping bug (§2ب): the code and
    //     message that survive the interceptor are the SERVER's, not the
    //     "UNKNOWN" a second mapAuthError pass would have produced over an
    //     already-mapped AuthError. `status` proves the field Stage 2د added
    //     actually made the trip — it is what the classification read.
    expect(rejection).toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: "عدد كبير من المحاولات — انتظر قليلاً",
      status: 429,
    });
    expect((rejection as { code: string }).code).not.toBe("UNKNOWN");

    // (3) The session is fully intact — store AND the middleware's cookie.
    expect(useAuthStore.getState().accessToken).toBe(OLD);
    expect(useAuthStore.getState().user).toEqual(USER);
    expect(hasAuthHint()).toBe(true);

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(t.count).toBe(1);
  });

  // ── MVT-7 — the control: a 401 from the refresh itself IS proof. ──
  it("refresh fails with 401 ⇒ session is WIPED (store + hint cookie) and UNAUTHORIZED is preserved", async () => {
    const refreshSpy = vi.spyOn(authClient, "refresh").mockRejectedValue(
      mapAuthError(
        httpError(401, { success: false, code: "UNAUTHORIZED", message: "غير مصرح" }),
      ),
    );

    const t = recordingAdapter((config, i) => {
      if (i === 0) {
        return Promise.reject(
          httpError(401, { success: false, code: "UNAUTHORIZED", message: "غير مصرح" }, config),
        );
      }
      throw new Error(`unexpected retry: transport called ${i + 1} times`);
    });

    await expect(client.get("/users/me")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
      sessionDisposition: "terminal",
    });

    // The teardown really ran, on both halves of the session state.
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(hasAuthHint()).toBe(false);

    // The refresh cookie is dead ⇒ retrying the original request is pointless.
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(t.count).toBe(1);
  });
});
