// ============================================
// Boot-time environment validation.
//
// We don't use class-validator on env vars because the cost/benefit isn't
// there for ~10 vars. Instead, a single function that crashes the process
// with a clear message if anything critical is missing or implausible.
//
// Triggered from main.ts BEFORE Nest finishes booting — much better than
// failing on the first JWT-verifying request 30 minutes after deploy.
// ============================================
import { Logger } from '@nestjs/common';

const logger = new Logger('EnvValidation');

interface ValidationIssue {
  /** ERROR = crash the process. WARN = log + continue. */
  level: 'ERROR' | 'WARN';
  envVar: string;
  message: string;
}

/**
 * Validate all critical env vars. Throws on ERROR-level issues, logs WARN
 * for the rest. Designed to be called once at startup.
 */
export function validateEnvironment(): void {
  const issues: ValidationIssue[] = [];

  // ── DATABASE_URL ──────────────────────────────────────
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    issues.push({
      level: 'ERROR',
      envVar: 'DATABASE_URL',
      message: 'DATABASE_URL is required',
    });
  } else if (!/^postgres(ql)?:\/\//.test(dbUrl)) {
    issues.push({
      level: 'ERROR',
      envVar: 'DATABASE_URL',
      message: 'DATABASE_URL must start with postgresql:// or postgres://',
    });
  }

  // ── Supabase ──────────────────────────────────────────
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    issues.push({
      level: 'ERROR',
      envVar: 'NEXT_PUBLIC_SUPABASE_URL',
      message: 'Required for Supabase Auth + Storage clients',
    });
  } else {
    try {
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    } catch {
      issues.push({
        level: 'ERROR',
        envVar: 'NEXT_PUBLIC_SUPABASE_URL',
        message: 'Not a valid URL',
      });
    }
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    issues.push({
      level: 'ERROR',
      envVar: 'SUPABASE_SERVICE_ROLE_KEY',
      message: 'Required for admin operations (user invites, password resets)',
    });
  }

  // ── JWT_SECRET (I4) ───────────────────────────────────
  // The Supabase JWT secret is the long random string shown under
  // Settings → API in the Supabase dashboard. It's typically 64+ chars.
  // If this doesn't match the project's actual secret, EVERY JWT will be
  // rejected — but you only find out on the first request. Catch that
  // class of misconfig here.
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    issues.push({
      level: 'ERROR',
      envVar: 'JWT_SECRET',
      message:
        'Required. Get from Supabase: Settings → API → JWT Settings → JWT Secret',
    });
  } else {
    if (jwtSecret.length < 32) {
      issues.push({
        level: 'ERROR',
        envVar: 'JWT_SECRET',
        message:
          `Looks too short (${jwtSecret.length} chars). ` +
          'Supabase JWT secrets are typically 64+ chars. ' +
          'Verify against Supabase dashboard.',
      });
    }
    // Entropy sanity check — placeholder values like "your-secret-here"
    // should never reach production.
    if (
      /(your-secret|change-?me|placeholder|todo|example)/i.test(jwtSecret)
    ) {
      issues.push({
        level: 'ERROR',
        envVar: 'JWT_SECRET',
        message: 'Looks like a placeholder value — set the real Supabase JWT secret',
      });
    }
  }

  // ── COOKIE_SECRET (C11) ───────────────────────────────
  // Optional in dev (unsigned cookies still work), but a warning is right.
  // Required in production for signed cookies.
  const cookieSecret = process.env.COOKIE_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  if (!cookieSecret) {
    issues.push({
      level: isProd ? 'ERROR' : 'WARN',
      envVar: 'COOKIE_SECRET',
      message:
        (isProd ? 'Required in production. ' : 'Recommended even in dev. ') +
        'Generate with: openssl rand -hex 32',
    });
  } else if (cookieSecret.length < 32) {
    issues.push({
      level: 'WARN',
      envVar: 'COOKIE_SECRET',
      message: `Short (${cookieSecret.length} chars) — recommend 64+`,
    });
  }

  // ── CORS_ALLOWED_ORIGINS (I2) ─────────────────────────
  if (isProd && !process.env.CORS_ALLOWED_ORIGINS) {
    issues.push({
      level: 'ERROR',
      envVar: 'CORS_ALLOWED_ORIGINS',
      message:
        'Required in production. Comma-separated HTTPS origins (e.g. https://app.tampalets.com)',
    });
  }

  // ── Report ────────────────────────────────────────────
  const errors = issues.filter((i) => i.level === 'ERROR');
  const warnings = issues.filter((i) => i.level === 'WARN');

  for (const w of warnings) {
    logger.warn(`[${w.envVar}] ${w.message}`);
  }

  if (errors.length > 0) {
    logger.error('Environment validation FAILED:');
    for (const e of errors) {
      logger.error(`  [${e.envVar}] ${e.message}`);
    }
    throw new Error(
      `Environment validation failed: ${errors.length} critical issue(s). See logs above.`,
    );
  }

  logger.log(
    `Environment validation passed — ${warnings.length} warning(s), 0 errors`,
  );
}
