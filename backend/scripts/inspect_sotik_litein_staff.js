require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data: staff, error: sErr } = await supabase
    .from('staff_profiles')
    .select('id, full_name, role, branch_id, is_active')
    .in('branch_id', [4, 7]);

  if (sErr) console.error('staff_profiles error:', sErr);
  else {
    console.log(`Found ${staff.length} staff_profiles for Sotik & Litein:`);
    staff.forEach(s => console.log(`  [Branch ${s.branch_id}] ${s.full_name} (${s.id}) -> Role: ${s.role}`));
  }

  // Also check pos_assigned_outlets or similar assignment tables
  const { data: assignments, error: aErr } = await supabase
    .from('pos_user_assigned_outlets')
    .select('*')
    .limit(10);
  if (!aErr) console.log('\npos_user_assigned_outlets:', assignments);
  else {
    const { data: a2, error: a2Err } = await supabase
      .from('user_assigned_pos_outlets')
      .select('*')
      .limit(10);
    if (!a2Err) console.log('\nuser_assigned_pos_outlets:', a2);
    else console.log('No user assigned pos outlets table found:', aErr.message);
  }
}
check().catch(console.error);
