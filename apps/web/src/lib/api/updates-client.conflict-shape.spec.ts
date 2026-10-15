// @vitest-environment jsdom
// ============================================
// What does a 409 ACTUALLY look like by the time the dialog sees it? (Session A)
//
// The authoring dialog branches on `err.status === 409` to turn the duplicate
// guard into continue-mode. Its own specs reject with a hand-written literal,
// and a hand-written literal is only as good as its resemblance to production:
// if the real pipeline produced, say, `{ code: "COMMON_BIZ_409" }` with no
// `status`, those specs would stay green while the feature was dead — the exact
// failure mode recorded as انحراف (هـ) in session 2026-08-08, where a spec
// mocked a rejection the real layer can never emit.
//
// So this file asserts the shape at its source instead of assuming it:
//   mocked → the transport only (client.defaults.adapter)
//   REAL   → both client interceptors, the real mapAuthError, the real
//            classifyFailure, the real createUpdate/submitUpdate wrappers.
// ============================================
import { describe, it, expect, vi, afterEach } from "vitest";
import type { InternalAxiosRequestConfig } from "axios";
import { client } from "./client";
import { mapAuthError } from "./map-auth-error";
import { createUpdate, submitUpdate } from "./updates-client";

const originalAdapter = client.defaults.adapter;

/** The error axios itself hands the interceptor for an HTTP error response. */
function axiosHttpError(status: number, data: unknown, config: InternalAxiosRequestConfig) {
  return Promise.reject({
    isAxiosError: true,
    response: { status, data, headers: {}, config, statusText: "" },
    config,
    request: {},
    message: `Request failed with status code ${status}`,
  });
}

/** The real envelope GlobalExceptionFilter sends for the duplicate guard. */
const CONFLICT_ENVELOPE = {
  success: false,
  code: "COMMON_BIZ_409",
  message:
    "لديك تحديث مسودة على هذه المرحلة اليوم. عدّل المسودة أو انتظر مراجعة المعلّق.",
  requestId: "req-conflict-1",
  timestamp: "2026-10-15T08:00:00.000Z",
  path: "/api/v1/phases/phase-1/updates",
};

afterEach(() => {
  client.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("the real 409 rejection shape", () => {
  it("carries status:409 — so the dialog's branch condition is sound", async () => {
    client.defaults.adapter = vi.fn((config: InternalAxiosRequestConfig) =>
      axiosHttpError(409, CONFLICT_ENVELOPE, config),
    ) as never;

    const err = await createUpdate("phase-1", { title: "عنوان صالح للاختبار" }).then(
      () => null,
      (e: unknown) => e as Record<string, unknown>,
    );

    expect(err).not.toBeNull();
    // The exact predicate report-form-dialog.tsx uses:
    expect((err as { status?: number }).status).toBe(409);
    // …and the backend's Arabic sentence survives for display.
    expect((err as { message?: string }).message).toBe(CONFLICT_ENVELOPE.message);
    expect((err as { code?: string }).code).toBe("COMMON_BIZ_409");
    // Stamped by the response interceptor (client.ts:96) — present in
    // production, unread by the dialog. Recorded so the delta against the
    // dialog's lighter literal is explicit rather than assumed.
    expect(err).toHaveProperty("sessionDisposition");
  });

  it("a 409 is NOT treated as a dead session (no refresh, no retry)", async () => {
    const adapter = vi.fn((config: InternalAxiosRequestConfig) =>
      axiosHttpError(409, CONFLICT_ENVELOPE, config),
    );
    client.defaults.adapter = adapter as never;

    await createUpdate("phase-1", { title: "عنوان صالح للاختبار" }).catch(() => null);

    // One wire call: the interceptor's refresh+retry branch is 401-only, so a
    // duplicate-guard conflict must never cost a second create.
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it("mapAuthError alone yields the same status/message the dialog reads", () => {
    const mapped = mapAuthError({
      isAxiosError: true,
      response: { status: 409, data: CONFLICT_ENVELOPE },
      request: {},
    });

    expect(mapped.status).toBe(409);
    expect(mapped.message).toBe(CONFLICT_ENVELOPE.message);
    expect(mapped.code).toBe("COMMON_BIZ_409");
  });

  it("a transport failure (no response) yields NO status — the transient branch", async () => {
    // submitUpdate failing this way is exactly MVT-3's stimulus: the dialog must
    // fall through to 'ask the server what the row is now', not to the 409 path.
    client.defaults.adapter = vi.fn(() =>
      Promise.reject({ isAxiosError: true, request: {}, message: "Network Error" }),
    ) as never;

    const err = await submitUpdate("upd-1").then(
      () => null,
      (e: unknown) => e as Record<string, unknown>,
    );

    expect((err as { status?: number }).status).toBeUndefined();
    expect((err as { code?: string }).code).toBe("NETWORK");
  });
});
