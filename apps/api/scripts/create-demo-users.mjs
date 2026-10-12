import { createClient } from '@supabase/supabase-js';

// ============================================================
// Seeds / resets the demo auth users.
//
// Every credential comes from the environment — nothing is hardcoded.
// A key committed here once leaked a live service_role key into a public
// repo (see SEC-ROTATE-001), so this script fails loudly rather than
// falling back to any baked-in default.
//
// Needs SUPABASE_SERVICE_ROLE_KEY (not a publishable key): it calls
// auth.admin.* to create and update users, which requires service-role.
// ============================================================

const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DEMO_ADMIN_PASSWORD',
  'DEMO_CLIENT_PASSWORD',
];

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(
    `FATAL: missing required environment variable(s): ${missing.join(', ')}\n` +
      `Set them in apps/api/.env (git-ignored) before running this script.`,
  );
  process.exit(1);
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supa = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const targets = [
  { email: 'admin@demo.com', password: process.env.DEMO_ADMIN_PASSWORD, name: 'مدير النظام' },
  { email: 'client@demo.com', password: process.env.DEMO_CLIENT_PASSWORD, name: 'العميل' },
];

async function findByEmail(email) {
  let page = 1;
  for (;;) {
    const { data, error } = await supa.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
    page++;
  }
}

for (const t of targets) {
  const existing = await findByEmail(t.email);
  if (existing) {
    const { data, error } = await supa.auth.admin.updateUserById(existing.id, {
      password: t.password,
      email_confirm: true,
    });
    if (error) {
      console.log(`UPDATE FAIL ${t.email}: ${error.message}`);
      continue;
    }
    console.log(`EXISTS  ${t.email} -> ${data.user.id} (password reset, confirmed)`);
  } else {
    const { data, error } = await supa.auth.admin.createUser({
      email: t.email,
      password: t.password,
      email_confirm: true,
      user_metadata: { name: t.name },
    });
    if (error) {
      console.log(`CREATE FAIL ${t.email}: ${error.message}`);
      continue;
    }
    console.log(`CREATED ${t.email} -> ${data.user.id}`);
  }
}
