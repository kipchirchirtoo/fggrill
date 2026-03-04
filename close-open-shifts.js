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
  console.log('\n=== Closing Open Cashier Shifts ===\n');

  // Find all open shifts
  const { data: openShifts, error } = await supabase
    .from('cashier_shifts')
    .select('*')
    .eq('status', 'open')
    .order('start_time', { ascending: false });

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
    console.log(`Closing shift ${shift.id}...`);
    console.log(`  Cashier ID: ${shift.cashier_id}`);
    console.log(`  Started: ${new Date(shift.start_time).toLocaleString()}`);
    console.log(`  Opening Float: KES ${shift.opening_float?.toLocaleString() || 0}`);

    // Calculate totals from cashier_transactions for this shift
    const { data: transactions } = await supabase
      .from('cashier_transactions')
      .select('amount, payment_method, transaction_type')
      .eq('shift_id', shift.id);

    let totalCash = 0;
    let totalMpesa = 0;
    let totalCard = 0;
    let totalRevenue = 0;

    if (transactions) {
      transactions.forEach(tx => {
        const amount = Number(tx.amount) || 0;
        if (tx.transaction_type === 'payment') {
          totalRevenue += amount;
          if (tx.payment_method === 'cash') totalCash += amount;
          else if (tx.payment_method === 'mpesa' || tx.payment_method === 'mpesa_manual') totalMpesa += amount;
          else if (tx.payment_method === 'card' || tx.payment_method === 'card_manual') totalCard += amount;
        }
      });
    }

    const closingFloat = Number(shift.opening_float || 0) + totalCash;

    console.log(`  Transactions: ${transactions?.length || 0}`);
    console.log(`  Total Revenue: KES ${totalRevenue.toLocaleString()}`);
    console.log(`  Cash: KES ${totalCash.toLocaleString()}`);
    console.log(`  M-Pesa: KES ${totalMpesa.toLocaleString()}`);
    console.log(`  Card: KES ${totalCard.toLocaleString()}`);
    console.log(`  Closing Float: KES ${closingFloat.toLocaleString()}`);

    // Close the shift
    const { error: updateError } = await supabase
      .from('cashier_shifts')
      .update({
        status: 'closed',
        end_time: new Date().toISOString(),
        closed_at: new Date().toISOString(),
        closing_float: closingFloat,
        actual_cash: closingFloat,
        expected_cash: closingFloat,
        cash_variance: 0,
        total_cash_in: totalCash,
        total_mpesa_in: totalMpesa,
        total_card_in: totalCard,
        total_revenue: totalRevenue,
        total_transactions: transactions?.length || 0
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
