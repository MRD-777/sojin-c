import { describe, it, expect } from "vitest";
import { shouldRefresh, classifyFailure, type FailureDisposition } from "./refresh-policy";

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

// ============================================
// classifyFailure — the three-state core (Session 2026-08-08)
//
// The four specs above are UNTOUCHED by design: `shouldRefresh` was rewritten
// as a view over `classifyFailure`, so their still being green is the
// regression harness proving the refactor preserved the old meaning exactly.
// The specs below cover what the old boolean could not express — the third
// state — and are therefore additive, never edits.
// ============================================
describe("classifyFailure (three-state core)", () => {
  // ── MVT-1 — the state that did not exist before. ──
  //
  // PAIRED at the deepest layer (rule #4): asserting only `"indeterminate"`
  // would leave open the possibility that the new state was bolted on by
  // widening the refresh branch — i.e. that we now fire /auth/refresh at a
  // dead network. The second assertion pins the OLD contract on the SAME
  // input: still no refresh. Both halves must hold, on one stimulus.
  it("network failure (status undefined) ⇒ indeterminate, and still does NOT trigger a refresh", () => {
    const input = {
      status: undefined,
      alreadyRetried: false,
      isRefreshCall: false,
    };

    expect(classifyFailure(input)).toBe("indeterminate");
    expect(shouldRefresh(input)).toBe(false);
  });

  // ── MVT-2 — the whole domain in one table. ──
  //
  // The load-bearing claim is NEGATIVE and cannot be made by any single row:
  // "terminal" is reachable ONLY from a proven 401. So the table is asserted
  // row by row (a wrong row names itself) and then a second time as a SET —
  // the count of terminal outcomes. A future edit that quietly makes 500 or
  // 429 terminal — the exact regression that signs users out during an API
  // restart — flips that count even if someone also updates its row.
  it("maps the full status domain, and ONLY a proven 401 is terminal", () => {
    const cases: Array<{
      name: string;
      input: { status: number | undefined; alreadyRetried: boolean; isRefreshCall: boolean };
      expected: FailureDisposition;
    }> = [
      // Server answered, but said nothing about the session's validity.
      { name: "500", input: { status: 500, alreadyRetried: false, isRefreshCall: false }, expected: "indeterminate" },
      { name: "502 (gateway)", input: { status: 502, alreadyRetried: false, isRefreshCall: false }, expected: "indeterminate" },
      // 429 is the one the plan called out by name: /auth/refresh is throttled
      // at 30/min (auth.controller.ts), so a loop-storm rate-limits US. Calling
      // that terminal signs the user out over congestion we caused.
      { name: "429 (throttled)", input: { status: 429, alreadyRetried: false, isRefreshCall: false }, expected: "indeterminate" },
      // "authenticated but forbidden" is a statement about a REQUEST.
      { name: "403", input: { status: 403, alreadyRetried: false, isRefreshCall: false }, expected: "indeterminate" },
      { name: "404", input: { status: 404, alreadyRetried: false, isRefreshCall: false }, expected: "indeterminate" },
      { name: "no response", input: { status: undefined, alreadyRetried: false, isRefreshCall: false }, expected: "indeterminate" },
      // The only recoverable case.
      { name: "401 fresh", input: { status: 401, alreadyRetried: false, isRefreshCall: false }, expected: "refresh" },
      // The only two ways a session is provably dead.
      { name: "401 already retried", input: { status: 401, alreadyRetried: true, isRefreshCall: false }, expected: "terminal" },
      { name: "401 on the refresh call", input: { status: 401, alreadyRetried: false, isRefreshCall: true }, expected: "terminal" },
    ];

    for (const c of cases) {
      expect(classifyFailure(c.input), `case: ${c.name}`).toBe(c.expected);
    }

    // The set-level invariant: exactly two inputs in this domain are terminal,
    // and both carry status 401.
    const terminal = cases.filter((c) => classifyFailure(c.input) === "terminal");
    expect(terminal).toHaveLength(2);
    expect(terminal.every((c) => c.input.status === 401)).toBe(true);
  });
});
