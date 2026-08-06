import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore, type AuthUser } from "./use-auth-store";

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

describe("useAuthStore", () => {
  beforeEach(() => {
    // isolate each test — zustand store is a module singleton.
    useAuthStore.getState().clear();
  });

  // MVT #1 — CVE-S1-001 (hacker re-attack, rule #5 + paired/deepest assertion rule #4)
  it("setSession wipes a lingering pendingRegistration, bound to the same session set", () => {
    useAuthStore.getState().setPendingRegistration({
      firstName: "X",
      lastName: "Y",
      email: "x@y.com",
      password: "Secret!12345",
    });
    // precondition: the plaintext password really is in memory.
    expect(useAuthStore.getState().pendingRegistration?.password).toBe(
      "Secret!12345",
    );

    useAuthStore.getState().setSession({ accessToken: "tok", user: USER });

    const after = useAuthStore.getState();
    // deepest assertion: the secret is gone *as a side-effect of* establishing
    // the session (not via a separate clearPendingRegistration call), AND the
    // session itself was set in the same operation.
    expect(after.pendingRegistration).toBeNull();
    expect(after.accessToken).toBe("tok");
    expect(after.user).toEqual(USER);
  });

  // MVT #5 — setSession then clear zeroes everything
  it("clear() zeroes accessToken, user and pendingRegistration", () => {
    useAuthStore.getState().setSession({ accessToken: "tok", user: USER });
    useAuthStore.getState().setPendingRegistration({
      firstName: "X",
      lastName: "Y",
      email: "x@y.com",
      password: "p",
    });
    expect(useAuthStore.getState().accessToken).toBe("tok");

    useAuthStore.getState().clear();

    const after = useAuthStore.getState();
    expect(after.accessToken).toBeNull();
    expect(after.user).toBeNull();
    expect(after.pendingRegistration).toBeNull();
  });
});
