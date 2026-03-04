/**
 * Diagnostic script to check Kyogong payment processing
 * Checks the actual state of the bill after payment
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const BILL_NUMBER = 'SPA-20260220-5067';

async function diagnose() {
  console.log('='.repeat(80));
  console.log('KYOGONG PAYMENT DIAGNOSTIC');
  console.log('Bill:', BILL_NUMBER);
  console.log('='.repeat(80));

  // 1. Check current bill state
  console.log('\n[1] Checking bill state in shift_transactions...');
  const { data: bill, error: billError } = await supabase
    .from('shift_transactions')
    .select('*')
    .eq('transaction_number', BILL_NUMBER)
    .single();

  if (billError) {
    console.error('❌ Error fetching bill:', billError);
    return;
  }

  console.log('✓ Bill found');
  console.log('  ID:', bill.id);
  console.log('  payment_method:', bill.payment_method);
  console.log('  total_amount:', bill.total_amount);
  console.log('  cash_amount:', bill.cash_amount);
  console.log('  mpesa_amount:', bill.mpesa_amount);
  console.log('  card_amount:', bill.card_amount);
  console.log('  is_voided:', bill.is_voided);
  console.log('  status:', bill.status);

  // 2. Check payments table
  console.log('\n[2] Checking payments table...');
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('*')
    .eq('kyogong_transaction_id', bill.id)
    .order('created_at', { ascending: false });

  if (paymentsError) {
    console.error('❌ Error fetching payments:', paymentsError);
  } else {
    console.log(`✓ Found ${payments.length} payment(s)`);
    payments.forEach((p, i) => {
      console.log(`  Payment ${i + 1}:`);
      console.log(`    Amount: KES ${p.amount}`);
      console.log(`    Method: ${p.payment_method}`);
      console.log(`    Status: ${p.status}`);
      console.log(`    Reference: ${p.reference}`);
      console.log(`    Created: ${p.created_at}`);
    });
  }

  // 3. Check unpaid bills query
  console.log('\n[3] Checking if bill appears in unpaid bills query...');
  const { data: unpaidBills, error: unpaidError } = await supabase
    .from('shift_transactions')
    .select('transaction_number, payment_method, total_amount')
    .eq('payment_method', 'BILL')
    .eq('is_voided', false);

  if (unpaidError) {
    console.error('❌ Error querying unpaid bills:', unpaidError);
  } else {
    const isUnpaid = unpaidBills.find(b => b.transaction_number === BILL_NUMBER);
    if (isUnpaid) {
      console.log('❌ Bill STILL appears in unpaid bills list');
      console.log('  This is the problem - payment_method is still "BILL"');
    } else {
      console.log('✓ Bill does NOT appear in unpaid bills list');
      console.log('  Payment was processed correctly');
    }
  }

  // 4. Test update manually
  console.log('\n[4] Testing manual update...');
  const { error: updateError } = await supabase
    .from('shift_transactions')
    .update({
      payment_method: 'CASH',
      cash_amount: bill.total_amount
    })
    .eq('transaction_number', BILL_NUMBER);

  if (updateError) {
    console.error('❌ Manual update failed:', updateError);
    console.log('  This might be a permissions issue or schema issue');
  } else {
    console.log('✓ Manual update succeeded');
    
    // Verify the update
    const { data: updatedBill } = await supabase
      .from('shift_transactions')
      .select('payment_method, cash_amount')
      .eq('transaction_number', BILL_NUMBER)
      .single();
    
    console.log('  Updated payment_method:', updatedBill.payment_method);
    console.log('  Updated cash_amount:', updatedBill.cash_amount);
  }

  // 5. Check unpaid bills again
  console.log('\n[5] Checking unpaid bills again after manual update...');
  const { data: unpaidBills2 } = await supabase
    .from('shift_transactions')
    .select('transaction_number, payment_method')
    .eq('payment_method', 'BILL')
    .eq('is_voided', false);

  const isStillUnpaid = unpaidBills2.find(b => b.transaction_number === BILL_NUMBER);
  if (isStillUnpaid) {
    console.log('❌ Bill STILL in unpaid list after manual update');
    console.log('  This is very strange - the update might not be working');
  } else {
    console.log('✓ Bill removed from unpaid list after manual update');
    console.log('  The update works, so the issue is in the payment processing logic');
  }

  // Cleanup - reset to BILL
  console.log('\n[CLEANUP] Resetting bill to unpaid status...');
  await supabase
    .from('shift_transactions')
    .update({ payment_method: 'BILL', cash_amount: 0 })
    .eq('transaction_number', BILL_NUMBER);
  console.log('✓ Bill reset');

  console.log('\n' + '='.repeat(80));
  console.log('DIAGNOSIS COMPLETE');
  console.log('='.repeat(80));
}

diagnose()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Diagnostic failed:', error);
    process.exit(1);
  });
