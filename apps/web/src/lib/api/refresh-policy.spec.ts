import { describe, it, expect } from "vitest";
import { shouldRefresh } from "./refresh-policy";

describe("shouldRefresh (refresh-policy)", () => {
  // MVT #1 — a fresh 401 (not retried, not the refresh call) ⇒ refresh once.
  it("returns true for a fresh 401", () => {
    expect(
      shouldRefresh({
        status: 401,
        alreadyRetried: false,
        isRefreshCall: false,
      }),
    ).toBe(true);
  });

  // MVT #2 — deepest no-loop assertion (rule #4): EACH of the two guards must
  // independently force `false`, because either one alone is what breaks a
  // refresh → 401 → refresh infinite loop. We assert them separately so a
  // regression in one guard can't hide behind the other.
  it("returns false when the failing request IS the refresh call (no loop)", () => {
    expect(
      shouldRefresh({
        status: 401,
        alreadyRetried: false,
        isRefreshCall: true,
      }),
    ).toBe(false);
  });

  it("returns false when the request was already retried once (no loop)", () => {
    expect(
      shouldRefresh({
        status: 401,
        alreadyRetried: true,
        isRefreshCall: false,
      }),
    ).toBe(false);
  });

  // Boundary — only a 401 triggers a refresh; every other outcome is terminal.
  it("returns false for non-401 statuses and network errors", () => {
    expect(
      shouldRefresh({
        status: 403,
        alreadyRetried: false,
        isRefreshCall: false,
      }),
    ).toBe(false);
    expect(
      shouldRefresh({
        status: 500,
        alreadyRetried: false,
        isRefreshCall: false,
      }),
    ).toBe(false);
    expect(
      shouldRefresh({
        status: undefined,
        alreadyRetried: false,
        isRefreshCall: false,
      }),
    ).toBe(false);
  });
});
