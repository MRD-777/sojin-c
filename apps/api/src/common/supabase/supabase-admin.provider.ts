// ============================================
// SupabaseAdminProvider (A9)
//
// Single source of truth for the Supabase admin client (service-role key).
//
// Why centralize:
//   - Two modules used to build their own client from ConfigService — auth
//     and users. Any future tweak (e.g. switching SDK version, adjusting
//     `autoRefreshToken`) had to be made in both places.
//   - The service-role key is sensitive; concentrating its handling in one
//     provider makes audit and rotation easier (one place to grep, one
//     place to swap to a secrets manager later).
//   - Unit tests can substitute a mock by overriding this single token.
//
// Design notes:
//   - `autoRefreshToken: false` + `persistSession: false` — the admin client
//     never holds a user session. Each call uses the service-role key
//     directly.
//   - The client is created once at module init and reused. The Supabase
//     JS client is internally stateless for admin operations.
//   - We export `SUPABASE_ADMIN_CLIENT` as an InjectionToken so consumers
//     get strong typing via the `@Inject(SUPABASE_ADMIN_CLIENT)` decorator.
// ============================================
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * DI token for the shared Supabase admin client.
 * Use:  constructor(@Inject(SUPABASE_ADMIN_CLIENT) private readonly supabase: SupabaseClient) {}
 */
export const SUPABASE_ADMIN_CLIENT = Symbol('SUPABASE_ADMIN_CLIENT');

/**
 * Builds the admin client from a ConfigService instance.
 *
 * Extracted from the inline `useFactory` (Session 1.5, D4) so that the
 * env-validation behavior can be unit-tested without bootstrapping a
 * NestJS TestingModule. Behavior is unchanged — the provider below
 * delegates to this function.
 *
 * Throws if either env var is missing — fail-fast on boot is safer than
 * a runtime null-pointer on the first admin call.
 */
export function createSupabaseAdminClient(config: ConfigService): SupabaseClient {
  const url = config.get<string>('NEXT_PUBLIC_SUPABASE_URL');
  const key = config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !key) {
    throw new Error(
      'FATAL: Missing Supabase configuration (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)',
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: SUPABASE_ADMIN_CLIENT,
      inject: [ConfigService],
      useFactory: createSupabaseAdminClient,
    },
  ],
  exports: [SUPABASE_ADMIN_CLIENT],
})
export class SupabaseAdminModule {}
