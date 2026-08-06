import { describe, it, expect } from "vitest";
import { buildRegisterPayload } from "./register-payload";
import type { PendingRegistration } from "../../store/use-auth-store";

const PERSONAL: PendingRegistration = {
  firstName: "Mohamed",
  lastName: "Ali",
  phone: "+201234567890",
  email: "m@a.com",
  password: "Secret!12345",
};

describe("buildRegisterPayload", () => {
  // MVT #2 — exactly the 6 backend fields, and NO role channel (CVE vector #3)
  it("emits exactly the 6 RegisterCompanyDto fields and no role", () => {
    const out = buildRegisterPayload(PERSONAL, { companyName: "Acme" });

    expect(out).toEqual({
      companyName: "Acme",
      companyEmail: "m@a.com", // reuses admin email (no company-email field)
      companyPhone: "+201234567890",
      adminName: "Mohamed Ali",
      adminEmail: "m@a.com",
      adminPassword: "Secret!12345",
    });

    // deepest assertion: prove the whitelist-breaking field can never leak.
    expect("role" in out).toBe(false);
    expect(Object.keys(out).sort()).toEqual(
      [
        "adminEmail",
        "adminName",
        "adminPassword",
        "companyEmail",
        "companyName",
        "companyPhone",
      ].sort(),
    );
  });

  it("omits companyPhone entirely when no phone (no empty string sent)", () => {
    const out = buildRegisterPayload(
      { ...PERSONAL, phone: undefined },
      { companyName: "Acme" },
    );
    expect("companyPhone" in out).toBe(false);
    expect(Object.keys(out)).toHaveLength(5);
  });
});
