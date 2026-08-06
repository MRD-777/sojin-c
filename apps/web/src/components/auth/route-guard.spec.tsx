// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// The i18n router needs Next context, so it's mocked at the module boundary
// (per DP4) — we only capture the redirect target. vi.hoisted makes the spy
// exist before vi.mock's hoisted factory runs.
const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("@/i18n/routing", () => ({
  useRouter: () => ({ replace, push: vi.fn(), prefetch: vi.fn() }),
}));

import { RouteGuard } from "@/components/auth/route-guard";
import { client } from "@/lib/api/client";
import { authClient } from "@/lib/api/auth-client";
import { useAuthStore, type AuthUser } from "@/store/use-auth-store";

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

function renderGuard(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouteGuard>{children}</RouteGuard>
    </QueryClientProvider>,
  );
}

const originalAdapter = client.defaults.adapter;

describe("RouteGuard (terminal 401)", () => {
  beforeEach(() => {
    replace.mockClear();
    useAuthStore.getState().clear();
  });

  afterEach(() => {
    cleanup();
    client.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
  });

  // MVT #3 — paired assertion at the DEEPEST layer (rule #4).
  //
  // We deliberately do NOT shallow-mock useMe to just return {isError:true} —
  // that would let the "session cleared" assertion pass without the real
  // teardown ever running (exactly the false-confidence pattern rule #4 warns
  // against). Instead we drive the REAL chain: /users/me 401 → real client
  // interceptor → silent refresh also fails → interceptor performs the terminal
  // teardown (store.clear + clearAuthHint) → useMe surfaces isError → guard
  // redirects. Only the transport, the router, and refresh are mocked.
  it("terminal 401 ⇒ session really cleared + redirect to /login + children hidden", async () => {
    // Seed a live session so we can prove it is actually wiped (not just null).
    useAuthStore.getState().setSession({ accessToken: "tok", user: USER });
    expect(useAuthStore.getState().accessToken).toBe("tok");

    // /users/me → 401 at the transport level.
    client.defaults.adapter = vi.fn((config) =>
      Promise.reject(
        Object.assign(new Error("Request failed with status code 401"), {
          isAxiosError: true,
          config,
          response: {
            status: 401,
            data: { success: false, code: "UNAUTHORIZED", message: "unauth" },
          },
        }),
      ),
    );
    // The silent refresh also fails ⇒ interceptor takes the terminal path.
    vi.spyOn(authClient, "refresh").mockRejectedValue(
      new Error("refresh failed"),
    );

    renderGuard(<div data-testid="protected">SECRET</div>);

    // 1) Redirect fired — the guard's only responsibility (DP1).
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));

    // 2) DEEPEST paired assertion: the session was genuinely torn down by the
    //    interceptor (token 'tok' → null, user → null), not merely a redirect.
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();

    // 3) Protected content never rendered.
    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
  });
});
