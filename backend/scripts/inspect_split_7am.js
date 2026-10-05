const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/user/OneDrive/Desktop/fggrill/backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('=== INSPECTION OF ORDERS & TRANSACTIONS AROUND 7:00 AM EAT (04:00 UTC) ===\n');

  const cheronoCashierShiftId = '0d6049da-651e-4cba-bda1-a4c23a227ead';
  const cheronoOutletShiftId = 'a9d4d2c8-7940-4253-98bd-c3f78e59a787';
  const judyCashierShiftId = '4c0cdff5-581d-4714-a7eb-1fafd7778453';
  const cutoffTime = '2026-10-04T04:00:00Z'; // 7:00 AM EAT (Africa/Nairobi UTC+3)

  // 1. Transactions in cashier_shift_transactions for Cherono
  const { data: allTxs } = await supabase
    .from('cashier_shift_transactions')
    .select('*')
    .eq('shift_id', cheronoCashierShiftId)
    .order('transaction_time', { ascending: true });

  const pre7amTxs = (allTxs || []).filter(t => t.transaction_time < cutoffTime);
  const post7amTxs = (allTxs || []).filter(t => t.transaction_time >= cutoffTime);

  console.log(`Total transactions on Cherono shift: ${allTxs?.length || 0}`);
  console.log(`Transactions BEFORE 7:00 AM EAT (< 04:00 UTC): ${pre7amTxs.length}`);
  console.log(`Transactions AFTER 7:00 AM EAT (>= 04:00 UTC):  ${post7amTxs.length}`);

  let preCash = 0, preMpesa = 0, preCard = 0, preCredit = 0;
  pre7amTxs.forEach(t => {
    if (t.is_voided) return;
    const m = (t.payment_method || '').toLowerCase();
    const a = Number(t.amount || 0);
    if (m === 'cash') preCash += a;
    else if (m === 'mpesa') preMpesa += a;
    else if (m === 'card') preCard += a;
    else preCredit += a;
  });

  let postCash = 0, postMpesa = 0, postCard = 0, postCredit = 0;
  post7amTxs.forEach(t => {
    if (t.is_voided) return;
    const m = (t.payment_method || '').toLowerCase();
    const a = Number(t.amount || 0);
    if (m === 'cash') postCash += a;
    else if (m === 'mpesa') postMpesa += a;
    else if (m === 'card') postCard += a;
    else postCredit += a;
  });

  console.log('\nPre-7am Collections (Cherono retained):');
  console.log(`Cash: KES ${preCash}, M-Pesa: KES ${preMpesa}, Card: KES ${preCard}, Credit: KES ${preCredit}, Total: KES ${preCash + preMpesa + preCard + preCredit}`);

  console.log('\nPost-7am Collections (Moving to Judy):');
  console.log(`Cash: KES ${postCash}, M-Pesa: KES ${postMpesa}, Card: KES ${postCard}, Credit: KES ${postCredit}, Total: KES ${postCash + postMpesa + postCard + postCredit}`);

  if (post7amTxs.length > 0) {
    console.log('\nSample Post-7am Transactions:');
    post7amTxs.slice(0, 5).forEach(t => {
      console.log(` ${t.transaction_time} | ${t.payment_method} | KES ${t.amount} | Ref: ${t.transaction_ref}`);
    });
  }

  // 2. Orders in pos_shift_orders on Cherono outlet shift
  const { data: allOrders } = await supabase
    .from('pos_shift_orders')
    .select('id, order_number, status, payment_status, total_amount, amount_paid, waiter_name, created_at')
    .eq('shift_id', cheronoOutletShiftId)
    .order('created_at', { ascending: true });

  const pre7amOrders = (allOrders || []).filter(o => o.created_at < cutoffTime);
  const post7amOrders = (allOrders || []).filter(o => o.created_at >= cutoffTime);

  console.log(`\nTotal orders on Cherono outlet shift: ${allOrders?.length || 0}`);
  console.log(`Orders BEFORE 7:00 AM EAT (< 04:00 UTC): ${pre7amOrders.length}`);
  console.log(`Orders AFTER 7:00 AM EAT (>= 04:00 UTC):  ${post7amOrders.length}`);

  let preOrderTotal = 0, postOrderTotal = 0;
  pre7amOrders.forEach(o => preOrderTotal += Number(o.total_amount || 0));
  post7amOrders.forEach(o => postOrderTotal += Number(o.total_amount || 0));
  console.log(`Pre-7am Orders total: KES ${preOrderTotal}`);
  console.log(`Post-7am Orders total: KES ${postOrderTotal}`);

  if (post7amOrders.length > 0) {
    console.log('\nFirst 3 Post-7am Orders:');
    post7amOrders.slice(0, 3).forEach(o => {
      console.log(` ${o.created_at} | ${o.order_number} | KES ${o.total_amount} | ${o.payment_status} | Waiter: ${o.waiter_name}`);
    });
    console.log('Last 3 Post-7am Orders:');
    post7amOrders.slice(-3).forEach(o => {
      console.log(` ${o.created_at} | ${o.order_number} | KES ${o.total_amount} | ${o.payment_status} | Waiter: ${o.waiter_name}`);
    });
  }
}

main().catch(console.error);
