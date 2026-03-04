require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPaymentUpdate() {
  console.log('\n=== Testing Kyogong Payment Update ===\n');

  // Get a specific unpaid bill
  const billNumber = 'SPA-20260220-5067';
  
  console.log(`1. Fetching bill: ${billNumber}...`);
  const { data: transaction, error: txError } = await supabase
    .from('shift_transactions')
    .select('*')
    .eq('transaction_number', billNumber)
    .single();

  if (txError || !transaction) {
    console.error('❌ Bill not found:', txError);
    return;
  }

  console.log(`✅ Found bill:`);
  console.log(`   ID: ${transaction.id}`);
  console.log(`   Customer: ${transaction.customer_name}`);
  console.log(`   Amount: KES ${transaction.total_amount}`);
  console.log(`   Current payment_method: ${transaction.payment_method}`);
  console.log(`   Is voided: ${transaction.is_voided}`);

  // Check if there are existing payments for this transaction
  console.log(`\n2. Checking existing payments...`);
  const { data: existingPayments, error: payError } = await supabase
    .from('payments')
    .select('*')
    .eq('kyogong_transaction_id', transaction.id);

  if (payError) {
    console.error('❌ Error checking payments:', payError);
  } else {
    console.log(`✅ Found ${existingPayments?.length || 0} existing payments`);
    if (existingPayments && existingPayments.length > 0) {
      existingPayments.forEach(p => {
        console.log(`   - ${p.reference}: KES ${p.amount} (${p.status}) at ${p.created_at}`);
      });
    }
  }

  // Try to manually update the payment_method
  console.log(`\n3. Testing manual update of payment_method...`);
  const { data: updated, error: updateError } = await supabase
    .from('shift_transactions')
    .update({
      payment_method: 'CASH',
      cash_amount: transaction.total_amount,
      updated_at: new Date().toISOString()
    })
    .eq('id', transaction.id)
    .select();

  if (updateError) {
    console.error('❌ Update failed:', updateError);
  } else {
    console.log('✅ Update successful!');
    console.log('   Updated record:', updated);
  }

  // Verify the update
  console.log(`\n4. Verifying update...`);
  const { data: verified, error: verifyError } = await supabase
    .from('shift_transactions')
    .select('*')
    .eq('transaction_number', billNumber)
    .single();

  if (verifyError) {
    console.error('❌ Verification failed:', verifyError);
  } else {
    console.log(`✅ Verified:`);
    console.log(`   payment_method: ${verified.payment_method}`);
    console.log(`   cash_amount: ${verified.cash_amount}`);
  }

  // Check if it now appears in unpaid bills query
  console.log(`\n5. Checking if bill still appears in unpaid query...`);
  const { data: unpaid, error: unpaidError } = await supabase
    .from('shift_transactions')
    .select('*')
    .eq('payment_method', 'BILL')
    .eq('transaction_number', billNumber);

  if (unpaidError) {
    console.error('❌ Query failed:', unpaidError);
  } else {
    if (unpaid && unpaid.length > 0) {
      console.log('⚠️  Bill STILL appears in unpaid query!');
    } else {
      console.log('✅ Bill NO LONGER appears in unpaid query!');
    }
  }

  console.log('\n=== Test Complete ===\n');
}

testPaymentUpdate().catch(console.error);
