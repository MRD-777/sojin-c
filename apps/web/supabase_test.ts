
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testConnection() {
  console.log('Testing connection to:', supabaseUrl)
  
  // 1. Test Auth
  const { error: authError } = await supabase.auth.getSession()
  if (authError) {
    console.error('Auth connection error:', authError.message)
  } else {
    console.log('✅ Auth connection successful')
  }

  // 2. Test DB (try to reach companies table)
  const { count, error: dbError } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })

  if (dbError) {
    // If it's a 401/403, it might be RLS. If it's something else, it might be connection.
    console.error('❌ DB connection error:', dbError.message)
    console.log('Hint: If the error is about permissions, you might need to disable RLS or add policies.')
  } else {
    console.log('✅ DB connection successful')
    console.log('Table "companies" accessible. Company count:', count)
  }
}

testConnection()
