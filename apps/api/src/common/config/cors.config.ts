// ============================================
// CORS Configuration — Strict multi-environment whitelist
//
// The previous implementation used a single `APP_URL` env var, which:
//   - couldn't serve staging + production simultaneously
//   - silently accepted any origin in dev if APP_URL wasn't set
//
// New behavior:
//   - Origins read from `CORS_ALLOWED_ORIGINS` (comma-separated, exact match)
//   - In development, localhost ports are auto-added
//   - Unknown origins are REJECTED with a clear log line (forensic value)
//   - credentials=true so refresh-token cookies can flow
// ============================================
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { Logger } from '@nestjs/common';

const logger = new Logger('CORS');

function buildAllowedOrigins(): Set<string> {
  const fromEnv = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Always include localhost in non-production for developer ergonomics.
  // In production, ONLY the env-supplied origins are accepted.
  const isProd = process.env.NODE_ENV === 'production';
  const devOrigins = isProd
    ? []
    : [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
      ];

  const all = new Set([...fromEnv, ...devOrigins]);

  if (all.size === 0) {
    logger.warn(
      'CORS_ALLOWED_ORIGINS is empty and NODE_ENV=production — every cross-origin request will be rejected. ' +
        'Set CORS_ALLOWED_ORIGINS to a comma-separated list of HTTPS origins.',
    );
  }

  return all;
}

export function buildCorsOptions(): CorsOptions {
  const allowed = buildAllowedOrigins();

  return {
    /**
     * Dynamic origin check. Reasons we don't use a static array:
     *   1. Logging — we want a log line for every rejected origin
     *   2. Wildcards if we ever need them (we don't, but the door is open)
     */
    origin: (origin: string | undefined, callback) => {
      // `origin` is undefined for same-origin requests, server-to-server,
      // and some health-check tooling. We always allow those.
      if (!origin) return callback(null, true);

      if (allowed.has(origin)) {
        return callback(null, true);
      }

      logger.warn(`Rejected CORS request from origin: ${origin}`);
      // Returning `false` (not an Error) yields a CORS-blocked response
      // without throwing on the server. Errors here propagate as 500s.
      return callback(null, false);
    },

    credentials: true, // needed for refresh-token httpOnly cookie

    // Keep the methods list explicit — accidentally enabling something
    // exotic (LINK, UNLINK) is a future foot-gun.
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Idempotency-Key',
      'X-Request-Id',
    ],

    // Browser caches the preflight result for an hour — fewer OPTIONS calls.
    maxAge: 3600,
  };
}
