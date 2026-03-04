require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseKyogongBills() {
  console.log('\n=== Kyogong Bills Clearing Diagnosis ===\n');

  // 1. Check for bills with payment_method = 'BILL' (unpaid)
  console.log('1. Checking unpaid Kyogong bills (payment_method = BILL)...');
  const { data: unpaidBills, error: unpaidError } = await supabase
    .from('shift_transactions')
    .select('*')
    .eq('payment_method', 'BILL')
    .eq('is_voided', false)
    .order('created_at', { ascending: false })
    .limit(10);

  if (unpaidError) {
    console.error('❌ Error fetching unpaid bills:', unpaidError);
  } else {
    console.log(`✅ Found ${unpaidBills?.length || 0} unpaid bills`);
    if (unpaidBills && unpaidBills.length > 0) {
      console.log('\nSample unpaid bills:');
      unpaidBills.slice(0, 3).forEach(bill => {
        console.log(`  - ${bill.transaction_number}: KES ${bill.total_amount} (${bill.customer_name || 'Guest'})`);
      });
    }
  }

  // 2. Check for bills that have been paid (payment_method != 'BILL')
  console.log('\n2. Checking paid Kyogong bills (payment_method != BILL)...');
  const { data: paidBills, error: paidError } = await supabase
    .from('shift_transactions')
    .select('*')
    .neq('payment_method', 'BILL')
    .eq('is_voided', false)
    .order('created_at', { ascending: false})
    .limit(10);

  if (paidError) {
    console.error('❌ Error fetching paid bills:', paidError);
  } else {
    console.log(`✅ Found ${paidBills?.length || 0} paid bills`);
    if (paidBills && paidBills.length > 0) {
      console.log('\nSample paid bills:');
      paidBills.slice(0, 3).forEach(bill => {
        console.log(`  - ${bill.transaction_number}: KES ${bill.total_amount} (${bill.payment_method})`);
      });
    }
  }

  // 3. Check for payments linked to Kyogong transactions
  console.log('\n3. Checking payments table for Kyogong transactions...');
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('*')
    .not('kyogong_transaction_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (paymentsError) {
    console.error('❌ Error fetching payments:', paymentsError);
  } else {
    console.log(`✅ Found ${payments?.length || 0} Kyogong payments`);
    if (payments && payments.length > 0) {
      console.log('\nSample payments:');
      payments.slice(0, 3).forEach(payment => {
        console.log(`  - ${payment.reference}: KES ${payment.amount} (${payment.status}) - Transaction ID: ${payment.kyogong_transaction_id}`);
      });
    }
  }

  // 4. Check for orphaned bills (payment_method changed but no payment record)
  console.log('\n4. Checking for potential orphaned bills...');
  if (paidBills && paidBills.length > 0) {
    for (const bill of paidBills.slice(0, 5)) {
      const { data: payment } = await supabase
        .from('payments')
        .select('*')
        .eq('kyogong_transaction_id', bill.id)
        .single();

      if (!payment) {
        console.log(`⚠️  Bill ${bill.transaction_number} has payment_method=${bill.payment_method} but NO payment record!`);
      }
    }
  }

  // 5. Test the unpaid bills query (same as frontend)
  console.log('\n5. Testing unpaid bills API query...');
  const { data: apiUnpaid, error: apiError } = await supabase
    .from('shift_transactions')
    .select(`
      *,
      branch:branches!shift_transactions_branch_id_fkey(name)
    `)
    .eq('payment_method', 'BILL')
    .eq('is_voided', false)
    .order('created_at', { ascending: false });

  if (apiError) {
    console.error('❌ API query error:', apiError);
  } else {
    console.log(`✅ API query returned ${apiUnpaid?.length || 0} unpaid bills`);
  }

  console.log('\n=== Diagnosis Complete ===\n');
}

diagnoseKyogongBills().catch(console.error);
