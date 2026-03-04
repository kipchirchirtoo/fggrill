require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOpenShifts() {
  console.log('\n=== Checking Open Cashier Shifts ===\n');

  // Find all open shifts
  const { data: openShifts, error } = await supabase
    .from('cashier_shifts')
    .select('*')
    .eq('status', 'open')
    .order('start_time', { ascending: false });

  if (error) {
    console.error('❌ Error fetching shifts:', error);
    return;
  }

  console.log(`Found ${openShifts?.length || 0} open shifts\n`);

  if (openShifts && openShifts.length > 0) {
    openShifts.forEach((shift, index) => {
      console.log(`${index + 1}. Shift ID: ${shift.id}`);
      console.log(`   Cashier ID: ${shift.cashier_id}`);
      console.log(`   Branch ID: ${shift.branch_id || 'Unknown'}`);
      console.log(`   Started: ${new Date(shift.start_time).toLocaleString()}`);
      console.log(`   Opening Float: KES ${shift.opening_float?.toLocaleString() || 0}`);
      console.log(`   Status: ${shift.status}`);
      console.log('');
    });

    console.log('\n⚠️  To close these shifts, you can either:');
    console.log('1. Use the cashier logbook UI to close them properly');
    console.log('2. Run: node close-open-shifts.js (will create this script)');
  } else {
    console.log('✅ No open shifts found. You can start a new shift.');
  }

  console.log('\n=== Check Complete ===\n');
}

checkOpenShifts().catch(console.error);
