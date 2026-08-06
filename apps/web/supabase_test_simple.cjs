
/* eslint-disable @typescript-eslint/no-var-requires */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
    const envPath = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return {};
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value.length) {
            env[key.trim()] = value.join('=').trim().replace(/^['"]|['"]$/g, '');
        }
    });
    return env;
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAll() {
  console.log('--- Comprehensive Supabase Test ---');
  
  // 1. Auth
  const { error: authError } = await supabase.auth.getSession();
  console.log(authError ? `❌ Auth Error: ${authError.message}` : '✅ Auth Connection: OK');

  // 2. Companies Table
  const { error: compError } = await supabase.from('companies').select('id').limit(1);
  console.log(compError ? `❌ Companies Table Error: ${compError.message}` : '✅ Companies Table: Accessible');

  // 3. Users Table
  const { error: userError } = await supabase.from('users').select('id').limit(1);
  console.log(userError ? `❌ Users Table Error: ${userError.message}` : '✅ Users Table: Accessible');

  if (!compError && !userError) {
      console.log('\n🚀 ALL SYSTEMS NOMINAL: The project is correctly connected to Supabase.');
  } else {
      console.log('\n⚠️ ATTENTION: Some tables are not accessible. Check RLS policies.');
  }
}

testAll();
