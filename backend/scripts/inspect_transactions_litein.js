const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/user/OneDrive/Desktop/fggrill/backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('=== DEEP TRANSACTION INSPECTION FOR LITEIN BAR SHIFTS ===\n');

  // Shift 1: CHERONO AUGUSTICA (SHF-20261003-0008)
  const shiftCheronoId = '0d6049da-651e-4cba-bda1-a4c23a227ead';
  
  const { data: txCherono, error: errCherono } = await supabase
    .from('cashier_shift_transactions')
    .select('*')
    .eq('shift_id', shiftCheronoId)
    .order('transaction_time', { ascending: true });

  console.log(`CHERONO AUGUSTICA (SHF-20261003-0008):`);
  console.log(`Total transactions in cashier_shift_transactions: ${txCherono ? txCherono.length : 0}`);
  if (txCherono && txCherono.length > 0) {
    const firstTx = txCherono[0];
    const lastTx = txCherono[txCherono.length - 1];
    console.log(`First transaction: ${firstTx.transaction_time} | Amount: ${firstTx.amount} | Type: ${firstTx.payment_method} | Order: ${firstTx.order_id || firstTx.reference}`);
    console.log(`Last transaction:  ${lastTx.transaction_time} | Amount: ${lastTx.amount} | Type: ${lastTx.payment_method} | Order: ${lastTx.order_id || lastTx.reference}`);

    // Break down by day (Oct 3 vs Oct 4)
    const oct3Tx = txCherono.filter(t => t.transaction_time && t.transaction_time.startsWith('2026-10-03'));
    const oct4Tx = txCherono.filter(t => t.transaction_time && t.transaction_time.startsWith('2026-10-04'));
    console.log(`Transactions on 2026-10-03: ${oct3Tx.length}`);
    console.log(`Transactions on 2026-10-04: ${oct4Tx.length}`);

    // Summary of amounts
    let oct3Total = 0, oct4Total = 0;
    oct3Tx.forEach(t => oct3Total += Number(t.amount || 0));
    oct4Tx.forEach(t => oct4Total += Number(t.amount || 0));
    console.log(`Sales on Oct 3: KES ${oct3Total}`);
    console.log(`Sales on Oct 4: KES ${oct4Total}`);
  }

  // Shift 2: JUDY CHEROTICH today (SHF-20261004-0010)
  const shiftJudyTodayId = '4c0cdff5-581d-4714-a7eb-1fafd7778453';
  const { data: txJudyToday } = await supabase
    .from('cashier_shift_transactions')
    .select('*')
    .eq('shift_id', shiftJudyTodayId);

  console.log(`\nJUDY CHEROTICH today (SHF-20261004-0010):`);
  console.log(`Total transactions: ${txJudyToday ? txJudyToday.length : 0}`);

  // Shift 3: JUDY CHEROTICH yesterday (SHF-20261002-0011) - closed Oct 3 morning
  const shiftJudyYestId = 'd171a2a6-b37e-4a15-9c2a-bf544252f7c6';
  const { data: txJudyYest } = await supabase
    .from('cashier_shift_transactions')
    .select('*')
    .eq('shift_id', shiftJudyYestId)
    .order('transaction_time', { ascending: true });

  console.log(`\nJUDY CHEROTICH shift closed yesterday morning (SHF-20261002-0011):`);
  console.log(`Total transactions: ${txJudyYest ? txJudyYest.length : 0}`);
  if (txJudyYest && txJudyYest.length > 0) {
    const firstTx = txJudyYest[0];
    const lastTx = txJudyYest[txJudyYest.length - 1];
    console.log(`First transaction: ${firstTx.transaction_time}`);
    console.log(`Last transaction:  ${lastTx.transaction_time}`);
    const oct3Tx = txJudyYest.filter(t => t.transaction_time && t.transaction_time.startsWith('2026-10-03'));
    console.log(`Transactions that occurred on 2026-10-03 morning: ${oct3Tx.length}`);
  }

  // 4. Check active POS Outlet Shifts for Litein Main Bar right now
  const { data: outletShifts } = await supabase
    .from('pos_outlet_shifts')
    .select('*')
    .eq('branch_id', 7)
    .order('opened_at', { ascending: false })
    .limit(10);

  console.log('\npos_outlet_shifts for Litein:', outletShifts);

  // 5. Check all orders in Litein today (2026-10-04)
  const { data: todayOrders } = await supabase
    .from('orders')
    .select('id, order_number, outlet_id, cashier_id, status, payment_status, total_amount, payment_method, created_at')
    .eq('branch_id', 7)
    .gte('created_at', '2026-10-04T00:00:00Z')
    .order('created_at', { ascending: false });

  console.log(`\nTotal orders in Litein today (2026-10-04): ${todayOrders ? todayOrders.length : 0}`);
  if (todayOrders && todayOrders.length > 0) {
    console.log('Sample today orders:', todayOrders.slice(0, 5));
  }
}

main().catch(console.error);
