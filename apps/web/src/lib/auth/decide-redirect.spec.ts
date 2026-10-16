import { describe, it, expect, afterEach, vi } from "vitest";
import { decideAuthRedirect } from "./decide-redirect";

const CFG = { locales: ["en", "ar"] as const, defaultLocale: "ar" };

describe("decideAuthRedirect", () => {
  // NODE_ENV is typed read-only, so assigning to it directly failed type-check
  // and blocked `next build` (WEB-TSC-002). vi.stubEnv sets it through vitest's
  // own env handling and unstubAllEnvs restores whatever was there before —
  // same stimulus, same restoration, no cast and no ts-expect-error.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // MVT #3 — unauthenticated dashboard hit redirects to login in EVERY env.
  // The loop is the deepest assertion: it proves there is NO NODE_ENV branch
  // (the old middleware bypassed this in development) — not merely "returns a
  // string", but "returns the SAME string regardless of NODE_ENV".
  it("no hint + dashboard -> /{locale}/login in every environment", () => {
    for (const env of ["development", "production", "test"]) {
      vi.stubEnv("NODE_ENV", env);
      expect(
        decideAuthRedirect({
          pathname: "/ar/dashboard",
          hasHint: false,
          ...CFG,
        }),
      ).toBe("/ar/login");
    }
  });

  it("hint + auth page -> /{locale}/dashboard", () => {
    expect(
      decideAuthRedirect({ pathname: "/en/login", hasHint: true, ...CFG }),
    ).toBe("/en/dashboard");
  });

  it("unknown locale segment falls back to defaultLocale", () => {
    expect(
      decideAuthRedirect({ pathname: "/fr/dashboard", hasHint: false, ...CFG }),
    ).toBe("/ar/login");
  });

  it("returns null when no redirect is needed (dashboard with hint)", () => {
    expect(
      decideAuthRedirect({ pathname: "/ar/dashboard", hasHint: true, ...CFG }),
    ).toBeNull();
  });
});
