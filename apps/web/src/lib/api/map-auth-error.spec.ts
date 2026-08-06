import { describe, it, expect } from "vitest";
import { mapAuthError } from "./map-auth-error";

describe("mapAuthError", () => {
  // MVT #4 — extract {code,message} from the backend envelope + NETWORK fallback
  it("extracts code + message (+ requestId) from the backend error envelope", () => {
    const err = {
      response: {
        data: {
          success: false,
          code: "AUTH_ACCOUNT_LOCKED",
          message: "تم قفل الحساب مؤقتاً، حاول لاحقاً",
          requestId: "req-123",
        },
      },
    };

    const out = mapAuthError(err);
    expect(out.code).toBe("AUTH_ACCOUNT_LOCKED");
    expect(out.message).toBe("تم قفل الحساب مؤقتاً، حاول لاحقاً");
    expect(out.requestId).toBe("req-123");
  });

  it("maps a request-made-but-no-response error to NETWORK", () => {
    const err = { request: {}, message: "Network Error" }; // response === undefined
    const out = mapAuthError(err);
    expect(out.code).toBe("NETWORK");
    expect(out.message.length).toBeGreaterThan(0);
  });

  it("maps anything else to UNKNOWN", () => {
    expect(mapAuthError("boom").code).toBe("UNKNOWN");
    expect(mapAuthError({}).code).toBe("UNKNOWN");
  });
});
