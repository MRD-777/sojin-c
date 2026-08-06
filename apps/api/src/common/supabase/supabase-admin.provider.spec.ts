// ============================================
// SupabaseAdminProvider (A9) — env validation + client config spec
//
// Covers:
//   - Session 1.5 A9: fail-fast at boot when env vars are missing.
//   - Session 1.6 TEST-009: createClient is invoked with the stateless
//     admin-client config (autoRefreshToken=false, persistSession=false).
//     Without this, a refactor that re-enables session persistence on
//     the service-role client would slip past — the existing
//     `expect(client.auth).toBeDefined()` assertions pass on ANY client
//     shape, including a misconfigured one.
//
// Mocking strategy:
//   - We mock `@supabase/supabase-js` at the module level so we can spy
//     on `createClient` calls. The mock returns `{ auth: {} }` — truthy
//     `.auth`, which keeps the existing "returns a SupabaseClient" test
//     valid (it only asserts `.auth` is defined, not its content).
//   - `beforeEach` clears call history so each test sees only its own
//     invocations.
// ============================================
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({ auth: {} }),
}));

import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from './supabase-admin.provider';

function configWith(values: Record<string, string | undefined>): ConfigService {
  // Minimal stub — only `.get(key)` is consumed by the factory.
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('createSupabaseAdminClient (A9 — env validation)', () => {
  beforeEach(() => {
    // Reset call history between tests so the "called with stateless
    // config" assertion only sees the calls from its own test.
    (createClient as jest.Mock).mockClear();
  });

  it('returns a SupabaseClient when both env vars are present', () => {
    const client = createSupabaseAdminClient(
      configWith({
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-xyz',
      }),
    );

    // We don't assert on internal client structure (private to the SDK).
    // The contract: returns a truthy object that has the `auth` namespace.
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();

    // CVE-TEST-014 (Session 1.6 hacker re-attack) — identity assertion.
    // `client.auth.toBeDefined()` passes for ANY object shaped `{auth: ?}` —
    // including a wrapper, a stub, or a memoized stale instance returned
    // by a future caching layer. The provider's contract is to return the
    // raw createClient result; assert identity so substitution is loud.
    const createdByMock = (createClient as jest.Mock).mock.results[0].value;
    expect(client).toBe(createdByMock);
  });

  it('throws when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
    expect(() =>
      createSupabaseAdminClient(
        configWith({ SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-xyz' }),
      ),
    ).toThrow(/FATAL: Missing Supabase configuration/);
  });

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    expect(() =>
      createSupabaseAdminClient(
        configWith({ NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }),
      ),
    ).toThrow(/FATAL: Missing Supabase configuration/);
  });

  it('throws when both env vars are missing', () => {
    expect(() => createSupabaseAdminClient(configWith({}))).toThrow(
      /FATAL: Missing Supabase configuration/,
    );
  });

  // TEST-009 (Session 1.6) — config-passthrough regression net.
  // The admin client MUST be stateless (no auto-refresh, no session
  // persistence) because it's service-role-keyed, not user-session-keyed.
  // A regression that re-enables either flag would silently change the
  // production behavior on key rotation / process restart — the prior
  // four specs would all keep passing.
  it('passes stateless config (autoRefreshToken=false, persistSession=false) to createClient', () => {
    createSupabaseAdminClient(
      configWith({
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-xyz',
      }),
    );

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role-key-xyz',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  });
});
