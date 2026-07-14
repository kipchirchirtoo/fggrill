import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: branches } = await supabase.from('branches').select('id, name, code, is_active');
  console.log('--- BRANCHES ---');
  console.log(branches);

  const { data: users } = await supabase.from('users').select('id, first_name, last_name, email, role, branch_id');
  const auditors = users?.filter(u => u.role === 'auditor' || u.role === 'super_admin');
  console.log('--- AUDITORS & ADMINS ---');
  console.log(auditors);
}
main();
