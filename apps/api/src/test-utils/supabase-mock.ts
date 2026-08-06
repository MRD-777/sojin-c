// ============================================
// Supabase admin client mock — Session 1.5 MVT infrastructure
//
// Surface = the subset of `@supabase/supabase-js` that auth + users
// services actually call. Keeping the surface tight on purpose: if a
// future spec needs a new method (e.g. storage.from), add it deliberately.
//
// Default behavior:
//   - createUser     → { data: { user: { id: 'sup-mock-id' } }, error: null }
//   - signInWithPassword → { data: { user, session }, error: null }
//   - refreshSession → { data: { session }, error: null }
//   - All others     → resolve with `{ data: null, error: null }`
//
// Override per-test with `.mockResolvedValueOnce(...)`.
//
// Usage:
//   const supabase = createMockSupabase();
//   new AuthService(..., supabase as unknown as SupabaseClient);
//   expect(supabase.auth.admin.updateUserById).toHaveBeenCalledWith(
//     'sup-id',
//     { ban_duration: '24h' },
//   );
// ============================================

export interface MockSupabaseAdmin {
  createUser: jest.Mock;
  deleteUser: jest.Mock;
  updateUserById: jest.Mock;
  signOut: jest.Mock;
}

export interface MockSupabaseAuth {
  admin: MockSupabaseAdmin;
  signInWithPassword: jest.Mock;
  refreshSession: jest.Mock;
}

export interface MockSupabase {
  auth: MockSupabaseAuth;
}

export function createMockSupabase(): MockSupabase {
  return {
    auth: {
      admin: {
        // The default `createUser` payload mirrors a successful signup —
        // most happy-path specs just need *some* user id, not a specific
        // one. Override per-test if the spec asserts the id value.
        createUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'sup-mock-id' } },
          error: null,
        }),
        deleteUser: jest.fn().mockResolvedValue({ data: null, error: null }),
        updateUserById: jest
          .fn()
          .mockResolvedValue({ data: null, error: null }),
        signOut: jest.fn().mockResolvedValue({ data: null, error: null }),
      },
      signInWithPassword: jest.fn().mockResolvedValue({
        data: {
          user: { id: 'sup-mock-id' },
          session: {
            access_token: 'access.jwt.mock',
            refresh_token: 'refresh.mock',
            expires_at: Math.floor(Date.now() / 1000) + 900,
          },
        },
        error: null,
      }),
      refreshSession: jest.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'access.jwt.rotated',
            refresh_token: 'refresh.rotated',
            expires_at: Math.floor(Date.now() / 1000) + 900,
          },
        },
        error: null,
      }),
    },
  };
}
