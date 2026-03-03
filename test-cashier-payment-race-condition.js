/**
 * Bug Condition Exploration Test
 * Property 1: Fault Condition - Kyogong Bill Remains in Unpaid List After Payment
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * 
 * This test demonstrates the race condition where:
 * 1. Backend successfully processes Kyogong bill payment
 * 2. Backend updates shift_transactions.payment_method from 'BILL' to 'CASH'/'MPESA'/'CARD'
 * 3. Frontend immediately queries unpaid bills
 * 4. Database replication lag causes query to return stale data
 * 5. Bill still appears in unpaid list with payment_method = 'BILL'
 * 
 * EXPECTED OUTCOME: Test FAILS (this proves the race condition bug exists)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Test configuration
const TEST_BILL_NUMBERS = [
  'SPA-20260220-5067',
  'BAR-20260220-1234',
  'RES-20260220-9876'
];

const PAYMENT_METHODS = ['CASH', 'MPESA', 'CARD'];

/**
 * Simulate payment processing for a Kyogong bill
 */
async function simulatePayment(billNumber, paymentMethod) {
  console.log(`\n[TEST] Simulating ${paymentMethod} payment for bill: ${billNumber}`);
  
  // 1. Fetch the bill from shift_transactions
  const { data: bill, error: fetchError } = await supabase
    .from('shift_transactions')
    .select('*')
    .eq('transaction_number', billNumber)
    .single();
  
  if (fetchError || !bill) {
    console.log(`[TEST] Bill not found: ${billNumber} - Creating test bill`);
    // Create a test bill for exploration
    const { data: newBill, error: createError } = await supabase
      .from('shift_transactions')
      .insert({
        transaction_number: billNumber,
        branch_id: 2, // Kyogong branch
        sales_point_id: 1,
        shift_id: '00000000-0000-0000-0000-000000000000', // Dummy shift
        transaction_type: 'SALE',
        service_category: 'SPA',
        subtotal: 500,
        total_amount: 500,
        payment_method: 'BILL', // Unpaid
        customer_name: 'Test Customer'
      })
      .select()
      .single();
    
    if (createError) {
      console.error(`[TEST] Failed to create test bill:`, createError);
      return null;
    }
    
    console.log(`[TEST] Created test bill: ${billNumber}`);
    return newBill;
  }
  
  console.log(`[TEST] Found existing bill: ${billNumber}, payment_method: ${bill.payment_method}`);
  
  // 2. Simulate backend payment processing - update payment_method
  const { error: updateError } = await supabase
    .from('shift_transactions')
    .update({
      payment_method: paymentMethod,
      cash_amount: paymentMethod === 'CASH' ? bill.total_amount : 0,
      mpesa_amount: paymentMethod === 'MPESA' ? bill.total_amount : 0,
      card_amount: paymentMethod === 'CARD' ? bill.total_amount : 0,
      updated_at: new Date().toISOString()
    })
    .eq('transaction_number', billNumber);
  
  if (updateError) {
    console.error(`[TEST] Failed to update payment_method:`, updateError);
    return null;
  }
  
  console.log(`[TEST] ✓ Backend updated payment_method to: ${paymentMethod}`);
  return bill;
}

/**
 * Query unpaid bills immediately after payment (simulating frontend behavior)
 */
async function queryUnpaidBillsImmediately() {
  console.log(`[TEST] Querying unpaid bills immediately (within 100ms)...`);
  
  // This simulates the frontend's fetchUnpaidBills() call
  const { data: unpaidBills, error } = await supabase
    .from('shift_transactions')
    .select('*')
    .eq('payment_method', 'BILL')
    .eq('is_voided', false)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error(`[TEST] Failed to query unpaid bills:`, error);
    return [];
  }
  
  console.log(`[TEST] Found ${unpaidBills.length} unpaid bills`);
  return unpaidBills;
}

/**
 * Check if a specific bill still appears in unpaid list
 */
function billStillInUnpaidList(unpaidBills, billNumber) {
  const found = unpaidBills.find(bill => bill.transaction_number === billNumber);
  return !!found;
}

/**
 * Main test function - explores the bug condition
 */
async function runBugExplorationTest() {
  console.log('='.repeat(80));
  console.log('BUG CONDITION EXPLORATION TEST');
  console.log('Property 1: Fault Condition - Kyogong Bill Remains in Unpaid List After Payment');
  console.log('='.repeat(80));
  
  const results = [];
  
  for (const billNumber of TEST_BILL_NUMBERS) {
    for (const paymentMethod of PAYMENT_METHODS) {
      console.log('\n' + '-'.repeat(80));
      
      // Step 1: Simulate payment processing
      const bill = await simulatePayment(billNumber, paymentMethod);
      if (!bill) {
        console.log(`[TEST] ⚠️  Skipping test - failed to process payment`);
        continue;
      }
      
      // Step 2: Immediately query unpaid bills (race condition window)
      const unpaidBills = await queryUnpaidBillsImmediately();
      
      // Step 3: Check if bill still appears in unpaid list
      const stillUnpaid = billStillInUnpaidList(unpaidBills, billNumber);
      
      // Step 4: Record result
      const result = {
        billNumber,
        paymentMethod,
        stillUnpaid,
        timestamp: new Date().toISOString()
      };
      
      results.push(result);
      
      if (stillUnpaid) {
        console.log(`[TEST] ❌ BUG CONFIRMED: Bill ${billNumber} still shows as unpaid after ${paymentMethod} payment`);
        console.log(`[TEST]    This demonstrates the race condition - database update hasn't propagated yet`);
      } else {
        console.log(`[TEST] ✓ Bill ${billNumber} correctly removed from unpaid list`);
      }
      
      // Wait a bit before next test to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  
  const bugCases = results.filter(r => r.stillUnpaid);
  const successCases = results.filter(r => !r.stillUnpaid);
  
  console.log(`\nTotal tests: ${results.length}`);
  console.log(`Bug cases (bill still unpaid): ${bugCases.length}`);
  console.log(`Success cases (bill removed): ${successCases.length}`);
  
  if (bugCases.length > 0) {
    console.log(`\n❌ BUG CONDITION CONFIRMED - Race condition exists`);
    console.log(`\nCounterexamples found:`);
    bugCases.forEach(r => {
      console.log(`  - Bill ${r.billNumber} paid with ${r.paymentMethod} still shows as unpaid`);
    });
    console.log(`\nThis confirms the race condition bug where frontend queries`);
    console.log(`return stale data before database updates propagate.`);
  } else {
    console.log(`\n✓ No race condition detected in this test run`);
    console.log(`  (May need to run multiple times or under load to reproduce)`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('EXPECTED OUTCOME: Test should FAIL (find bug cases)');
  console.log('This proves the race condition exists and needs to be fixed');
  console.log('='.repeat(80));
  
  // Cleanup - reset test bills to BILL status for next run
  console.log(`\n[CLEANUP] Resetting test bills to unpaid status...`);
  for (const billNumber of TEST_BILL_NUMBERS) {
    await supabase
      .from('shift_transactions')
      .update({ payment_method: 'BILL' })
      .eq('transaction_number', billNumber);
  }
  console.log(`[CLEANUP] ✓ Test bills reset`);
  
  return {
    totalTests: results.length,
    bugCases: bugCases.length,
    successCases: successCases.length,
    hasBug: bugCases.length > 0
  };
}

// Run the test
runBugExplorationTest()
  .then(summary => {
    console.log(`\n[TEST] Exploration complete`);
    process.exit(summary.hasBug ? 1 : 0); // Exit with error code if bug found
  })
  .catch(error => {
    console.error(`\n[TEST] Test failed with error:`, error);
    process.exit(1);
  });
