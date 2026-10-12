import { createClient } from '@supabase/supabase-js';

// ============================================================
// Smoke test: real login -> ES256 token -> guarded API endpoint.
//
// 🔴 SUPABASE_SMOKE_KEY must be the PUBLISHABLE key (sb_publishable_…),
// NOT a secret key. signInWithPassword is an ordinary end-user path: it
// needs no service-role privilege whatsoever. Putting a secret key here
// would hand admin rights to a test script for zero benefit — and this
// script's whole point is to exercise what a real user hits.
//
// No value is defaulted on purpose: a missing variable must fail loudly,
// never silently fall back to a baked-in key (see SEC-ROTATE-001).
// ============================================================

const REQUIRED = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SMOKE_KEY', 'DEMO_ADMIN_PASSWORD'];

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(
    `FATAL: missing required environment variable(s): ${missing.join(', ')}\n` +
      `SUPABASE_SMOKE_KEY must be the publishable key (sb_publishable_…), not a secret key.`,
  );
  process.exit(1);
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SMOKE_KEY = process.env.SUPABASE_SMOKE_KEY;
const api = process.env.API_URL ?? 'http://localhost:4000';

const s = createClient(URL, SMOKE_KEY, { auth: { persistSession: false } });
const { data, error } = await s.auth.signInWithPassword({
  email: 'admin@demo.com',
  password: process.env.DEMO_ADMIN_PASSWORD,
});
if (error) {
  console.log('LOGIN FAIL', error.message);
  process.exit(1);
}
const tok = data.session.access_token;

async function hit(path, token) {
  const r = await fetch(api + path, { headers: token ? { Authorization: 'Bearer ' + token } : {} });
  let body = '';
  try {
    body = JSON.stringify(await r.json()).slice(0, 300);
  } catch {}
  return `${r.status}  ${body}`;
}

console.log('1) valid ES256 token  -> GET /api/v1/projects :', await hit('/api/v1/projects', tok));
console.log('2) no token           -> GET /api/v1/projects :', await hit('/api/v1/projects', null));
console.log('3) garbage token      -> GET /api/v1/projects :', await hit('/api/v1/projects', 'not.a.jwt'));
