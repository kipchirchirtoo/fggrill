require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function closeOpenShifts() {
  console.log('\n=== Closing Kyogong Open Shifts ===\n');

  // Find all open shifts
  const { data: openShifts, error } = await supabase
    .from('cashier_shifts')
    .select('*')
    .eq('status', 'open')
    .order('start_time', { ascending: false });

  if (error) {
    console.error('❌ Error fetching shifts:', error.message);
    return;
  }

  if (!openShifts || openShifts.length === 0) {
    console.log('✅ No open shifts found.');
    return;
  }

  console.log(`Found ${openShifts.length} open shift(s) to close\n`);

  for (const shift of openShifts) {
    console.log(`Closing shift ${shift.shift_number}...`);
    console.log(`  Cashier ID: ${shift.cashier_id}`);
    console.log(`  Sales Point ID: ${shift.sales_point_id}`);
    console.log(`  Started: ${new Date(shift.start_time).toLocaleString()}`);
    console.log(`  Opening Float: KES ${shift.opening_float?.toLocaleString() || 0}`);

    const closingFloat = Number(shift.opening_float || 0);
    const now = new Date().toISOString();

    // Close the shift
    const { error: updateError } = await supabase
      .from('cashier_shifts')
      .update({
        status: 'closed',
        end_time: now,
        closing_float: closingFloat,
        expected_cash: closingFloat,
        actual_cash: closingFloat,
        cash_variance: 0,
        total_transactions: 0,
        total_cash_in: 0,
        total_mpesa_in: 0,
        total_card_in: 0,
        total_revenue: 0,
        closed_at: now,
        submitted_at: now
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

closeOpenShifts().catch(console.error);
