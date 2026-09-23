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

import { NextIntlClientProvider } from "next-intl";
import { RouteGuard } from "@/components/auth/route-guard";
import { client } from "@/lib/api/client";
import { authClient } from "@/lib/api/auth-client";
import { mapAuthError } from "@/lib/api/map-auth-error";
import { setAuthHint, clearAuthHint, AUTH_HINT_NAME } from "@/lib/auth/auth-hint";
import { useAuthStore, type AuthUser } from "@/store/use-auth-store";
import messages from "../../../messages/en.json";

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

/**
 * The guard's `indeterminate` branch renders <SessionUnavailable/>, which calls
 * useTranslations — so every render needs a next-intl provider or the component
 * throws for a reason that has nothing to do with what is being tested
 * (architect §3, handed to the tester). The REAL en.json is used, not a stub:
 * a stub would keep passing after someone deletes the keys from the message
 * catalogue, and the retry screen would ship broken.
 */
function renderGuard(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <QueryClientProvider client={queryClient}>
        <RouteGuard>{children}</RouteGuard>
      </QueryClientProvider>
    </NextIntlClientProvider>,
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
    // The silent refresh also comes back 401 ⇒ interceptor takes the terminal
    // path.
    //
    // 🔴 The rejection is built with the REAL mapAuthError because that is the
    // only shape production can produce: authClient.refresh() normalizes every
    // failure through it (auth-client.ts:78) — it never throws a bare Error.
    // This spec used to reject with `new Error("refresh failed")`, which passed
    // only because the interceptor treated ANY refresh failure as terminal.
    // That is the two-state behaviour Stage 2د removed, so the old stimulus was
    // asserting the bug, not the title of this test. Hand-writing the AuthError
    // literal instead would let this spec drift the moment the normalizer does.
    vi.spyOn(authClient, "refresh").mockRejectedValue(
      mapAuthError(
        Object.assign(new Error("Request failed with status code 401"), {
          isAxiosError: true,
          response: {
            status: 401,
            data: { success: false, code: "UNAUTHORIZED", message: "unauth" },
          },
        }),
      ),
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

// ============================================
// MVT-5 — the loop killer, asserted at the layer where the loop was BUILT.
//
// The /dashboard ⇄ /login ping-pong needed exactly one ingredient: a
// navigation on an event that proved nothing. The guard supplied it
// (`if (isError) replace("/login")`) while the middleware, still seeing an
// intact auth_hint, bounced the user straight back. Neither half is wrong on
// its own — the DISAGREEMENT is the loop.
//
// So this spec asserts BOTH halves on one stimulus (rule #4): the guard does
// not move (leg 1) AND the cookie the middleware reads is untouched (leg 2).
// Asserting only "replace was not called" would leave the loop reconstructible
// from a future teardown that quietly clears the hint on network errors.
// ============================================
describe("RouteGuard (indeterminate — API unreachable)", () => {
  beforeEach(() => {
    replace.mockClear();
    useAuthStore.getState().clear();
    useAuthStore.getState().setSession({ accessToken: "tok", user: USER });
    clearAuthHint();
    setAuthHint();
  });

  afterEach(() => {
    cleanup();
    client.defaults.adapter = originalAdapter;
    useAuthStore.getState().clear();
    clearAuthHint();
    vi.restoreAllMocks();
  });

  it("API unreachable ⇒ NO navigation, session + hint intact, retry UI shown, children hidden", async () => {
    const refreshSpy = vi.spyOn(authClient, "refresh");

    // No response ever comes back: `request` present, `response` absent — the
    // real axios shape for a dead network, and the one mapAuthError reads as
    // NETWORK ⇒ classifyFailure ⇒ "indeterminate".
    client.defaults.adapter = vi.fn((config) =>
      Promise.reject(
        Object.assign(new Error("Network Error"), {
          isAxiosError: true,
          config,
          request: {},
        }),
      ),
    );

    renderGuard(<div data-testid="protected">SECRET</div>);

    // Wait on the retry surface, not on a timer: its presence is proof the
    // query actually settled into the error branch, so the assertions below
    // are made AFTER the moment a redirect would have fired — not before it.
    expect(
      await screen.findByRole("heading", { name: messages.Common.sessionUnavailable.title }),
    ).toBeInTheDocument();

    // (1) Leg one of the loop: the guard did not navigate. Not once.
    expect(replace).not.toHaveBeenCalled();

    // (2) Leg two: the middleware still sees a session, so it has nothing to
    //     disagree with. Read off document.cookie itself — the actual input.
    expect(document.cookie).toContain(`${AUTH_HINT_NAME}=1`);

    // (3) The session survived in memory too (this is the whole promise made
    //     to the user by the on-screen text: "You are still signed in").
    expect(useAuthStore.getState().accessToken).toBe("tok");
    expect(useAuthStore.getState().user).toEqual(USER);

    // (4) A network failure is not a 401 — we never even tried to refresh.
    expect(refreshSpy).not.toHaveBeenCalled();

    // (5) The user is not stranded on a blank screen: both honest exits exist.
    expect(
      screen.getByRole("button", { name: messages.Common.sessionUnavailable.retry }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: messages.Common.sessionUnavailable.signIn }),
    ).toBeInTheDocument();

    // (6) And protected content never leaked while unverified.
    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
  });
});
