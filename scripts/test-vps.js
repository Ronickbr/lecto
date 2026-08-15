import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://api-supa.rnbconsultoria.tech'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODY3NDU4NzIsImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlzcyI6InN1cGFiYXNlIn0.OnO-Z25EbQRT3jt2JpB80r0iHVOyPW5k5YRCUpQDntc'

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function checkVPS() {
  console.log('Testing connection to VPS Supabase API:', supabaseUrl)
  try {
    const { data: plans, error } = await supabase.from('plans').select('*')
    if (error) {
      console.log('Error querying plans table:', error.message)
    } else {
      console.log('✅ Successfully connected! Plans count:', plans?.length)
    }

    const { data: users, error: userErr } = await supabase.auth.admin.listUsers()
    if (userErr) {
      console.error('Error listing auth users:', userErr.message)
    } else {
      console.log('✅ Auth Users in VPS count:', users?.users?.length)
    }
  } catch (err) {
    console.error('Connection exception:', err)
  }
}

checkVPS()
