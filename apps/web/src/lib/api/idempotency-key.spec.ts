// MVT-3/4/5 (S4) — the idempotency-key module: the pure, node-testable heart of
// the whole session's threat model. React-free by design (idempotency-key.ts
// header), so the stability + freshness contracts are asserted algorithmically
// without any render (hook/page render is infra-blocked — WEB-S1-004).
//
//   MVT-3 (test أ) — generateIdempotencyKey: format, distinctness, crypto policy.
//   MVT-4 (test ب — rule #4, the DEEPEST) — holder: SAME key across N calls.
//   MVT-5 (test ج — CVE-S4-001, rule #5) — reset mints a NEW key (reason-edit =
//          new intent) while an un-reset key stays stable (replay preserved),
//          re-attacked against the closing pattern "stable key + changed data".
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  generateIdempotencyKey,
  isValidIdempotencyKey,
  createIdempotencyKeyHolder,
} from "@/lib/api/idempotency-key";

/** The exact contract the backend enforces (idempotency-key.decorator.ts:19). */
const SAFE_KEY = /^[A-Za-z0-9_-]{16,64}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MVT-3 — generateIdempotencyKey (test أ)", () => {
  it("every generated key satisfies the backend SAFE_KEY format", () => {
    for (let i = 0; i < 50; i++) {
      const key = generateIdempotencyKey();
      expect(SAFE_KEY.test(key)).toBe(true);
      // client validator agrees with the backend regex (single source of truth).
      expect(isValidIdempotencyKey(key)).toBe(true);
    }
  });

  it("produces distinct values across many calls (no reuse)", () => {
    const keys = new Set(Array.from({ length: 300 }, () => generateIdempotencyKey()));
    expect(keys.size).toBe(300);
  });

  it("uses the getRandomValues fallback (48 hex chars, still SAFE) when randomUUID is absent", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = (i * 7 + 3) & 0xff;
        return arr;
      },
    });
    const key = generateIdempotencyKey();
    expect(key).toHaveLength(48);
    expect(SAFE_KEY.test(key)).toBe(true);
  });

  it("THROWS rather than emit a weak key when Web Crypto is unavailable", () => {
    vi.stubGlobal("crypto", {}); // no randomUUID, no getRandomValues
    expect(() => generateIdempotencyKey()).toThrow(/Web Crypto/);
  });
});

describe("MVT-4 — holder stability (test ب, rule #4)", () => {
  it("current() returns the SAME key across N invocations without reset (double-click / retry guarantee)", () => {
    const holder = createIdempotencyKeyHolder();
    const first = holder.current();
    const reads = Array.from({ length: 10 }, () => holder.current());

    expect(new Set(reads).size).toBe(1);
    expect(reads.every((k) => k === first)).toBe(true);
    expect(isValidIdempotencyKey(first)).toBe(true);
  });

  it("each holder owns an independent key (lazy, generated on first current())", () => {
    const a = createIdempotencyKeyHolder().current();
    const b = createIdempotencyKeyHolder().current();
    expect(a).not.toBe(b);
  });
});

describe("MVT-5 — freshness on new intent (test ج, CVE-S4-001, rule #5)", () => {
  it("reset() mints a NEW distinct key — a reason edit is a new logical action", () => {
    const holder = createIdempotencyKeyHolder();
    const k1 = holder.current();
    holder.reset();
    const k2 = holder.current();

    expect(k2).not.toBe(k1);
    expect(isValidIdempotencyKey(k2)).toBe(true);
  });

  it("PAIRED — WITHOUT reset the key stays stable (idempotent replay of an unchanged action)", () => {
    const holder = createIdempotencyKeyHolder();
    const k1 = holder.current();
    const k2 = holder.current(); // no reset between → same intent
    expect(k2).toBe(k1);
  });

  // rule #5 re-attack: the pattern this session closes is "stable key + changed
  // data → mint a NEW key". Guard the INVERSE regression — the fix must NOT make
  // the key perpetually fresh (that would defeat idempotency: every retry a new
  // key → double-apply / double SUNK_COST). Only an explicit reset() may rotate.
  it("re-attack: current() is NOT perpetually fresh — ONLY reset() rotates the key", () => {
    const holder = createIdempotencyKeyHolder();
    const before = holder.current();
    for (let i = 0; i < 25; i++) {
      expect(holder.current()).toBe(before); // 25 retries, no reset → identical
    }
    holder.reset(); // new intent (e.g. reason edited after a failure)
    expect(holder.current()).not.toBe(before);
  });
});
