// ============================================
// Helmet configuration — Security headers
//
// References:
//   - https://helmetjs.github.io/
//   - skill 03 §7 (security-headers)
//
// What this adds (beyond Helmet's defaults):
//   - CSP tuned for our actual sources (Supabase storage, our own domain)
//   - HSTS with preload (1-year max-age) — production only
//   - Cross-Origin-Embedder-Policy disabled (would break Supabase image embeds)
//   - Referrer-Policy: strict-origin-when-cross-origin
//
// What this intentionally does NOT add:
//   - X-Frame-Options: handled per-route via Next.js middleware on the frontend
//   - X-XSS-Protection: deprecated, Helmet sets `0` automatically
// ============================================
import type { HelmetOptions } from 'helmet';

export function buildHelmetOptions(): HelmetOptions {
  const isProd = process.env.NODE_ENV === 'production';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  // Derive the Supabase host once so CSP can list it explicitly.
  // If the URL is misconfigured at boot, we degrade gracefully — Helmet
  // just won't allow Supabase images, which is visible in logs.
  let supabaseHost = '';
  try {
    supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : '';
  } catch {
    supabaseHost = '';
  }

  return {
    contentSecurityPolicy: {
      // Use a strict CSP — block everything we don't explicitly allow.
      // The frontend (Next.js) has its own CSP; this one applies to the
      // API itself (e.g. Swagger UI at /docs).
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Swagger UI inlines scripts
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          ...(supabaseHost ? [`https://${supabaseHost}`] : []),
        ],
        connectSrc: [
          "'self'",
          ...(supabaseHost ? [`https://${supabaseHost}`] : []),
        ],
        fontSrc: ["'self'", 'data:'],
        frameAncestors: ["'none'"], // can't be iframed
        objectSrc: ["'none'"], // no <object>/<embed>/<applet>
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },

    // Cross-Origin policies — disable COEP because Supabase image URLs
    // would fail otherwise (they don't send the required CORP header).
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },

    // HSTS — only set the preload header in production.
    // 1 year max-age is the de-facto industry standard.
    hsts: isProd
      ? {
          maxAge: 31_536_000, // 1 year
          includeSubDomains: true,
          preload: true,
        }
      : false,

    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

    // Hide framework fingerprints — small win against opportunistic scans.
    hidePoweredBy: true,
  };
}
