// ============================================
// Rate limiting policy
//
// Three named profiles — pick one per endpoint with @Throttle({ name: ... }).
//
//   - default: catch-all for any authenticated API request.
//     100 req / minute / client. Protects against runaway frontends
//     and trivial scrapers. Most real users stay well under this.
//
//   - auth: login, register, refresh, password reset.
//     5 req / minute / client. Combined with the brute-force counter
//     in auth.service.login (see I5), this blocks credential stuffing.
//
//   - heavy: exports, audit-trail listing, large list queries.
//     10 req / minute / client. CPU/IO intensive — we don't want
//     a SUPER_ADMIN accidentally DOSing the DB with audit exports.
//
// The throttler key is derived from `req.ip` by default, which honors
// the trust-proxy setting we configure in main.ts (so we rate-limit by
// real client IP, not the proxy IP).
// ============================================
import type { ThrottlerModuleOptions } from '@nestjs/throttler';

export const throttlerConfig: ThrottlerModuleOptions = [
  { name: 'default', ttl: 60_000, limit: 100 },
  { name: 'auth', ttl: 60_000, limit: 5 },
  { name: 'heavy', ttl: 60_000, limit: 10 },
];
