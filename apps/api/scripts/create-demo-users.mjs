import { createClient } from '@supabase/supabase-js';

const URL = 'https://tbezbzlsuerjlohaoawy.supabase.co';
const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiZXpiemxzdWVyamxvaGFvYXd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjAyOTg0OSwiZXhwIjoyMDkxNjA1ODQ5fQ.Zc9Dkzc0Eb8kImHp05X-4TvejqWm8rPa3w2xHKCAZ_k';

const supa = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const targets = [
  { email: 'admin@demo.com', password: 'Admin123!', name: 'مدير النظام' },
  { email: 'client@demo.com', password: 'Client123!', name: 'العميل' },
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
