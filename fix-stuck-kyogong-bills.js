require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixStuckBills() {
  console.log('\n=== Fixing Stuck Kyogong Bills ===\n');

  // Find all bills that have payments but payment_method is still 'BILL'
  console.log('1. Finding stuck bills...');
  const { data: unpaidBills, error: unpaidError } = await supabase
    .from('shift_transactions')
    .select('*')
    .eq('payment_method', 'BILL')
    .eq('is_voided', false);

  if (unpaidError) {
    console.error('❌ Error fetching bills:', unpaidError);
    return;
  }

  console.log(`✅ Found ${unpaidBills?.length || 0} bills with payment_method='BILL'`);

  let fixed = 0;
  let skipped = 0;

  for (const bill of unpaidBills || []) {
    // Check if this bill has payments
    const { data: payments, error: payError } = await supabase
      .from('payments')
      .select('*')
      .eq('kyogong_transaction_id', bill.id)
      .eq('status', 'completed');

    if (payError) {
      console.error(`❌ Error checking payments for ${bill.transaction_number}:`, payError);
      continue;
    }

    if (payments && payments.length > 0) {
      // This bill has payments but payment_method is still 'BILL' - it's stuck!
      console.log(`\n⚠️  Stuck bill found: ${bill.transaction_number}`);
      console.log(`   Customer: ${bill.customer_name}`);
      console.log(`   Amount: KES ${bill.total_amount}`);
      console.log(`   Payments: ${payments.length}`);

      // Get the most recent payment to determine the payment method
      const latestPayment = payments.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

      console.log(`   Latest payment: ${latestPayment.payment_method} - KES ${latestPayment.amount}`);

      // Update the bill
      const updateData = {
        payment_method: latestPayment.payment_method.toUpperCase()
      };

      // Set the appropriate amount field
      if (latestPayment.payment_method === 'cash') {
        updateData.cash_amount = bill.total_amount;
      } else if (latestPayment.payment_method === 'mpesa' || latestPayment.payment_method === 'mpesa_manual') {
        updateData.mpesa_amount = bill.total_amount;
      } else if (latestPayment.payment_method === 'card' || latestPayment.payment_method === 'card_manual') {
        updateData.card_amount = bill.total_amount;
      }

      const { error: updateError } = await supabase
        .from('shift_transactions')
        .update(updateData)
        .eq('id', bill.id);

      if (updateError) {
        console.error(`   ❌ Failed to update: ${updateError.message}`);
      } else {
        console.log(`   ✅ Fixed! Updated payment_method to ${updateData.payment_method}`);
        fixed++;
      }
    } else {
      skipped++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Fixed: ${fixed} bills`);
  console.log(`Skipped: ${skipped} bills (no payments found)`);
  console.log(`\n=== Complete ===\n`);
}

fixStuckBills().catch(console.error);
