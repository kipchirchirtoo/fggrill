require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserShifts() {
  console.log('\n=== Checking Open Shifts by User ===\n');

  // Get all users with cashier-related roles
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, first_name, last_name, email, role');

  if (usersError) {
    console.error('❌ Error fetching users:', usersError);
    return;
  }

  console.log(`Found ${users?.length || 0} cashier users\n`);

  let totalOpenShifts = 0;

  for (const user of users || []) {
    const { data: openShifts, error } = await supabase
      .from('cashier_shifts')
      .select('*')
      .eq('cashier_id', user.id)
      .eq('status', 'open');

    if (error) {
      console.error(`❌ Error checking shifts for ${user.email}:`, error);
      continue;
    }

    if (openShifts && openShifts.length > 0) {
      console.log(`⚠️  ${user.first_name} ${user.last_name} (${user.email})`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Open Shifts: ${openShifts.length}`);
      openShifts.forEach(shift => {
        console.log(`   - Shift ${shift.shift_number}: Started ${new Date(shift.start_time).toLocaleString()}`);
      });
      console.log('');
      totalOpenShifts += openShifts.length;
    }
  }

  if (totalOpenShifts === 0) {
    console.log('✅ No open shifts found for any cashier user');
  } else {
    console.log(`\nTotal open shifts: ${totalOpenShifts}`);
    console.log('\nTo close these shifts, run: node close-open-shifts.js');
  }

  console.log('\n=== Check Complete ===\n');
}

checkUserShifts().catch(console.error);
