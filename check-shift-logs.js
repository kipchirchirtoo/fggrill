require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkShiftLogs() {
  console.log('\n=== Checking cashier_shift_logs Table ===\n');

  // Find all open shifts
  const { data: openShifts, error } = await supabase
    .from('cashier_shift_logs')
    .select('*')
    .eq('status', 'open')
    .order('shift_start', { ascending: false });

  if (error) {
    console.error('❌ Error fetching shifts:', error);
    return;
  }

  console.log(`Found ${openShifts?.length || 0} open shifts\n`);

  if (openShifts && openShifts.length > 0) {
    openShifts.forEach((shift, index) => {
      console.log(`${index + 1}. Shift ID: ${shift.id}`);
      console.log(`   Shift Number: ${shift.shift_number}`);
      console.log(`   Cashier ID: ${shift.cashier_id}`);
      console.log(`   Cashier Name: ${shift.cashier_name}`);
      console.log(`   Branch ID: ${shift.branch_id}`);
      console.log(`   Started: ${new Date(shift.shift_start).toLocaleString()}`);
      console.log(`   Opening Float: KES ${shift.opening_float?.toLocaleString() || 0}`);
      console.log(`   Status: ${shift.status}`);
      console.log('');
    });

    console.log('\n⚠️  To close these shifts, run: node close-shift-logs.js');
  } else {
    console.log('✅ No open shifts found. You can start a new shift.');
  }

  console.log('\n=== Check Complete ===\n');
}

checkShiftLogs().catch(console.error);
