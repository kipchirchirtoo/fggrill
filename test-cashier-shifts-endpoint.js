require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testShiftsEndpoint() {
  console.log('\n=== Testing Cashier Shifts Endpoint ===\n');

  // Test 1: Get all shifts for branch 1
  console.log('Test 1: Fetching shifts for branch_id=1...');
  const { data: shifts, error: shiftsError } = await supabase
    .from('cashier_shift_logs')
    .select('*')
    .eq('branch_id', 1)
    .order('shift_start', { ascending: false });

  if (shiftsError) {
    console.error('❌ Error fetching shifts:', shiftsError.message);
  } else {
    console.log(`✅ Found ${shifts?.length || 0} shifts for branch 1`);
    if (shifts && shifts.length > 0) {
      console.log('\nSample shift:');
      const shift = shifts[0];
      console.log(`  ID: ${shift.id}`);
      console.log(`  Shift Number: ${shift.shift_number}`);
      console.log(`  Cashier ID: ${shift.cashier_id}`);
      console.log(`  Status: ${shift.status}`);
      console.log(`  Started: ${new Date(shift.shift_start).toLocaleString()}`);
    }
  }

  // Test 2: Get a specific shift by ID
  if (shifts && shifts.length > 0) {
    const shiftId = shifts[0].id;
    console.log(`\nTest 2: Fetching shift details for ID ${shiftId}...`);
    
    const { data: shift, error: shiftError } = await supabase
      .from('cashier_shift_logs')
      .select('*')
      .eq('id', shiftId)
      .single();

    if (shiftError) {
      console.error('❌ Error fetching shift:', shiftError.message);
    } else {
      console.log('✅ Successfully fetched shift details');
      console.log(`  Shift Number: ${shift.shift_number}`);
      console.log(`  Status: ${shift.status}`);
    }

    // Test 3: Get transactions for this shift
    console.log(`\nTest 3: Fetching transactions for shift ${shiftId}...`);
    const { data: transactions, error: txError } = await supabase
      .from('cashier_shift_transactions')
      .select('*')
      .eq('shift_id', shiftId)
      .order('transaction_time', { ascending: false });

    if (txError) {
      console.error('❌ Error fetching transactions:', txError.message);
    } else {
      console.log(`✅ Found ${transactions?.length || 0} transactions for this shift`);
    }
  }

  console.log('\n=== Test Complete ===\n');
}

testShiftsEndpoint().catch(console.error);
