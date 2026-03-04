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
  console.log('\n=== Checking Kyogong Open Shifts (cashier_shifts table) ===\n');

  // Check for open shifts
  const { data: openShifts, error } = await supabase
    .from('cashier_shifts')
    .select('*')
    .eq('status', 'open')
    .order('start_time', { ascending: false });

  if (error) {
    console.error('❌ Error fetching shifts:', error.message);
    return;
  }

  console.log(`Found ${openShifts?.length || 0} open shifts\n`);

  if (openShifts && openShifts.length > 0) {
    openShifts.forEach((shift, index) => {
      console.log(`${index + 1}. Shift ID: ${shift.id}`);
      console.log(`   Shift Number: ${shift.shift_number}`);
      console.log(`   Cashier ID: ${shift.cashier_id}`);
      console.log(`   Sales Point ID: ${shift.sales_point_id}`);
      console.log(`   Branch ID: ${shift.branch_id}`);
      console.log(`   Started: ${new Date(shift.start_time).toLocaleString()}`);
      console.log(`   Opening Float: KES ${shift.opening_float?.toLocaleString() || 0}`);
      console.log(`   Status: ${shift.status}`);
      console.log('');
    });

    console.log('\n⚠️  These shifts need to be closed before opening a new one.');
  } else {
    console.log('✅ No open shifts found. You can open a new shift.');
  }

  console.log('\n=== Check Complete ===\n');
}

checkOpenShifts().catch(console.error);
