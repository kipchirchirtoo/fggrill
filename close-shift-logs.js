require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function closeShiftLogs() {
  console.log('\n=== Closing Open Shift Logs ===\n');

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

  if (!openShifts || openShifts.length === 0) {
    console.log('✅ No open shifts found.');
    return;
  }

  console.log(`Found ${openShifts.length} open shift(s) to close\n`);

  for (const shift of openShifts) {
    console.log(`Closing shift ${shift.shift_number}...`);
    console.log(`  Cashier: ${shift.cashier_name || 'Unknown'}`);
    console.log(`  Started: ${new Date(shift.shift_start).toLocaleString()}`);
    console.log(`  Opening Float: KES ${shift.opening_float?.toLocaleString() || 0}`);

    const closingFloat = Number(shift.opening_float || 0);

    // Close the shift
    const { error: updateError } = await supabase
      .from('cashier_shift_logs')
      .update({
        status: 'closed',
        shift_end: new Date().toISOString(),
        closing_float: closingFloat,
        variance: 0,
        total_sales: 0
      })
      .eq('id', shift.id);

    if (updateError) {
      console.error(`  ❌ Failed to close shift: ${updateError.message}`);
    } else {
      console.log(`  ✅ Shift closed successfully!\n`);
    }
  }

  console.log('=== All Shifts Closed ===\n');
}

closeShiftLogs().catch(console.error);
