import { describe, it, expect, afterEach } from "vitest";
import { decideAuthRedirect } from "./decide-redirect";

const CFG = { locales: ["en", "ar"] as const, defaultLocale: "ar" };

describe("decideAuthRedirect", () => {
  const prevEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = prevEnv;
  });

  // MVT #3 — unauthenticated dashboard hit redirects to login in EVERY env.
  // The loop is the deepest assertion: it proves there is NO NODE_ENV branch
  // (the old middleware bypassed this in development) — not merely "returns a
  // string", but "returns the SAME string regardless of NODE_ENV".
  it("no hint + dashboard -> /{locale}/login in every environment", () => {
    for (const env of ["development", "production", "test"]) {
      process.env.NODE_ENV = env;
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
