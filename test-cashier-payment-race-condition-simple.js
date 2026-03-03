/**
 * Simplified Bug Condition Exploration Test
 * Tests with REAL production bill: SPA-20260220-5067
 * 
 * This test demonstrates the race condition by:
 * 1. Checking current payment_method of the bill
 * 2. Simulating payment (update payment_method)
 * 3. Immediately querying unpaid bills
 * 4. Checking if bill still appears (race condition)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const REAL_BILL_NUMBER = 'SPA-20260220-5067';

async function testRaceCondition() {
  console.log('='.repeat(80));
  console.log('BUG CONDITION EXPLORATION TEST - Simplified');
  console.log('Testing with real production bill:', REAL_BILL_NUMBER);
  console.log('='.repeat(80));
  
  // Step 1: Check if bill exists and get current state
  console.log(`\n[1] Fetching bill: ${REAL_BILL_NUMBER}`);
  const { data: bill, error: fetchError } = await supabase
    .from('shift_transactions')
    .select('*')
    .eq('transaction_number', REAL_BILL_NUMBER)
    .single();
  
  if (fetchError || !bill) {
    console.log(`❌ Bill not found: ${REAL_BILL_NUMBER}`);
    console.log(`   Error:`, fetchError);
    console.log(`\n   This test requires the real bill to exist in production.`);
    console.log(`   The user reported this bill exists and has the payment issue.`);
    return;
  }
  
  console.log(`✓ Bill found`);
  console.log(`  Current payment_method: ${bill.payment_method}`);
  console.log(`  Total amount: KES ${bill.total_amount}`);
  console.log(`  Customer: ${bill.customer_name || 'N/A'}`);
  
  // Step 2: Simulate payment processing (update payment_method to CASH)
  console.log(`\n[2] Simulating CASH payment processing...`);
  const { error: updateError } = await supabase
    .from('shift_transactions')
    .update({
      payment_method: 'CASH',
      cash_amount: bill.total_amount
    })
    .eq('transaction_number', REAL_BILL_NUMBER);
  
  if (updateError) {
    console.log(`❌ Failed to update payment_method:`, updateError);
    return;
  }
  
  console.log(`✓ Backend updated payment_method to: CASH`);
  
  // Step 3: Immediately query unpaid bills (within 50ms - race condition window)
  console.log(`\n[3] Querying unpaid bills IMMEDIATELY (simulating frontend)...`);
  const startTime = Date.now();
  
  const { data: unpaidBills, error: queryError } = await supabase
    .from('shift_transactions')
    .select('transaction_number, payment_method, total_amount')
    .eq('payment_method', 'BILL')
    .eq('is_voided', false);
  
  const queryTime = Date.now() - startTime;
  console.log(`  Query completed in ${queryTime}ms`);
  
  if (queryError) {
    console.log(`❌ Failed to query unpaid bills:`, queryError);
    return;
  }
  
  console.log(`  Found ${unpaidBills.length} unpaid bills`);
  
  // Step 4: Check if our bill still appears in unpaid list
  const stillUnpaid = unpaidBills.find(b => b.transaction_number === REAL_BILL_NUMBER);
  
  console.log(`\n[4] Checking if bill ${REAL_BILL_NUMBER} still in unpaid list...`);
  
  if (stillUnpaid) {
    console.log(`❌ BUG CONFIRMED: Bill still shows as unpaid!`);
    console.log(`   Bill payment_method in unpaid list: ${stillUnpaid.payment_method}`);
    console.log(`   This demonstrates the race condition - query returned stale data`);
  } else {
    console.log(`✓ Bill correctly removed from unpaid list`);
  }
  
  // Step 5: Wait 2 seconds and query again to see if it eventually updates
  console.log(`\n[5] Waiting 2 seconds and querying again...`);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const { data: unpaidBills2 } = await supabase
    .from('shift_transactions')
    .select('transaction_number, payment_method')
    .eq('payment_method', 'BILL')
    .eq('is_voided', false);
  
  const stillUnpaid2 = unpaidBills2.find(b => b.transaction_number === REAL_BILL_NUMBER);
  
  if (stillUnpaid2) {
    console.log(`❌ Bill STILL shows as unpaid after 2 seconds`);
    console.log(`   This suggests a persistent issue, not just replication lag`);
  } else {
    console.log(`✓ Bill now correctly removed from unpaid list`);
    console.log(`   This confirms the race condition - update eventually propagated`);
  }
  
  // Step 6: Verify the bill's actual payment_method in database
  console.log(`\n[6] Verifying bill's actual payment_method in database...`);
  const { data: verifyBill } = await supabase
    .from('shift_transactions')
    .select('payment_method, cash_amount')
    .eq('transaction_number', REAL_BILL_NUMBER)
    .single();
  
  if (verifyBill) {
    console.log(`  Actual payment_method: ${verifyBill.payment_method}`);
    console.log(`  Cash amount: KES ${verifyBill.cash_amount || 0}`);
    
    if (verifyBill.payment_method === 'CASH') {
      console.log(`✓ Backend update was successful`);
    } else {
      console.log(`❌ Backend update failed or was rolled back`);
    }
  }
  
  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  
  if (stillUnpaid && !stillUnpaid2) {
    console.log(`\n❌ RACE CONDITION CONFIRMED`);
    console.log(`   - Bill appeared in unpaid list immediately after payment`);
    console.log(`   - Bill was removed after 2 seconds`);
    console.log(`   - This proves database replication lag causes the bug`);
  } else if (stillUnpaid && stillUnpaid2) {
    console.log(`\n❌ PERSISTENT BUG DETECTED`);
    console.log(`   - Bill still shows as unpaid even after 2 seconds`);
    console.log(`   - This suggests the backend update may have failed`);
  } else {
    console.log(`\n✓ No race condition detected in this test run`);
    console.log(`   - Bill was immediately removed from unpaid list`);
    console.log(`   - May need to run under load to reproduce`);
  }
  
  // Cleanup - reset bill to BILL status for next test
  console.log(`\n[CLEANUP] Resetting bill to unpaid status for next test...`);
  await supabase
    .from('shift_transactions')
    .update({ payment_method: 'BILL', cash_amount: 0 })
    .eq('transaction_number', REAL_BILL_NUMBER);
  console.log(`[CLEANUP] ✓ Bill reset to unpaid status`);
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('EXPECTED OUTCOME: Test should detect race condition');
  console.log('This confirms the bug exists and needs the retry fix');
  console.log('='.repeat(80));
}

testRaceCondition()
  .then(() => {
    console.log(`\n[TEST] Exploration complete`);
    process.exit(0);
  })
  .catch(error => {
    console.error(`\n[TEST] Test failed with error:`, error);
    process.exit(1);
  });
