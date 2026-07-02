const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cols(table) {
  const { data, error } = await supabase.from(table).select('*').limit(1);
  if (error) return `ERROR: ${error.message}`;
  if (!data || data.length === 0) return `(empty)`;
  return Object.keys(data[0]).join(', ');
}

async function main() {
  // void_bills
  console.log('=== void_bills ===');
  console.log('cols:', await cols('void_bills'));
  const { data: vb } = await supabase.from('void_bills').select('*').limit(2);
  console.log('sample:', JSON.stringify(vb, null, 2));

  // watchlist
  console.log('\n=== auditor watchlist tables ===');
  for (const t of ['auditor_watchlist', 'audit_watchlist', 'watchlist']) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (!error) console.log(t, 'cols:', data && data[0] ? Object.keys(data[0]).join(', ') : '(empty)');
    else console.log(t + ':', error.message);
  }

  // stock_levels verify - what does the controller actually query?
  console.log('\n=== inventory_items (for stock levels) ===');
  const { data: inv } = await supabase.from('inventory_items').select('id, sku, item_name, quantity, branch_id, unit, reorder_level').limit(3);
  console.log('inventory_items sample:', JSON.stringify(inv, null, 2));

  // bar_stock for bar-stock verify
  console.log('\n=== bar_stock ===');
  const { data: bs } = await supabase.from('bar_stock').select('*').limit(2);
  console.log('bar_stock sample:', JSON.stringify(bs, null, 2));

  // purchase_orders for expenditure
  console.log('\n=== purchase_orders sample ===');
  const { data: po } = await supabase.from('purchase_orders').select('id, branch_id, po_number, supplier_id, status, total_amount, created_at').limit(2);
  console.log('sample:', JSON.stringify(po, null, 2));

  // cashier logbooks - pending_audit specifically
  console.log('\n=== cashier_logbooks pending_audit ===');
  const { data: lb, error: lbe } = await supabase.from('cashier_logbooks')
    .select('id, branch_id, cashier_id, logbook_number, log_date, period_start, type, status, total_sales, total_cash, total_mpesa, total_card, closing_float, cashier_shift_id, submitted_at, auditor_id, audited_at')
    .in('status', ['pending_audit', 'pending_accountant_review'])
    .limit(3);
  if (lbe) console.log('Error:', lbe.message);
  else console.log(JSON.stringify(lb, null, 2));

  // cashier_logbooks full columns
  console.log('\n=== cashier_logbooks FULL COLUMNS ===');
  const { data: lbfull } = await supabase.from('cashier_logbooks').select('*').limit(1);
  if (lbfull && lbfull[0]) console.log(Object.keys(lbfull[0]).join(', '));

  // kitchen_requisitions columns
  console.log('\n=== kitchen_requisitions ===');
  const { data: kr } = await supabase.from('kitchen_requisitions').select('*').limit(1);
  if (kr && kr[0]) {
    console.log('cols:', Object.keys(kr[0]).join(', '));
    console.log('sample:', JSON.stringify(kr[0], null, 2));
  } else console.log('(empty or error)');

  // kitchen_usage
  console.log('\n=== kitchen_usage ===');
  const { data: ku } = await supabase.from('kitchen_usage').select('*').limit(1);
  if (ku && ku[0]) {
    console.log('cols:', Object.keys(ku[0]).join(', '));
    console.log('sample:', JSON.stringify(ku[0], null, 2));
  } else console.log('(empty or error)');

  // finance_daily_logs - check if it exists with status
  console.log('\n=== finance_daily_logs (check all statuses) ===');
  const { data: fdl, error: fdle } = await supabase.from('finance_daily_logs').select('*').limit(2);
  if (fdle) console.log('Error:', fdle.message);
  else console.log(JSON.stringify(fdl, null, 2));

  // daily_logs route actually queries what?
  // Check auditor daily-logs controller
  console.log('\n=== Check getDailyLogsStatus - finance_daily_logs vs cashier_logbooks ===');
  const { data: fdl2 } = await supabase.from('finance_daily_logs').select('id, branch_id, log_date, status').limit(3);
  console.log('finance_daily_logs rows:', JSON.stringify(fdl2, null, 2));

  // approval_requests - maybe under different schema
  console.log('\n=== approval_requests (any status) ===');
  const { data: ar, error: are } = await supabase.from('approval_requests').select('*').limit(2);
  if (are) console.log('Error:', are.message);
  else console.log(JSON.stringify(ar, null, 2));

  // staff_credit_bills with user join info
  console.log('\n=== staff_credit_bills with users ===');
  const { data: scb } = await supabase.from('staff_credit_bills').select('id, staff_id, branch_id, bill_number, amount, balance, status, bill_date, description').limit(3);
  console.log(JSON.stringify(scb, null, 2));

  // users to cross-ref staff names
  console.log('\n=== users (staff) ===');
  const { data: usr } = await supabase.from('users').select('id, first_name, last_name, role, branch_id').limit(5);
  console.log(JSON.stringify(usr, null, 2));

  // payroll_records sample
  console.log('\n=== payroll_records sample ===');
  const { data: pr } = await supabase.from('payroll_records').select('id, run_id, staff_id, branch_id, status, net_pay, pay_period_from, pay_period_to').limit(2);
  console.log(JSON.stringify(pr, null, 2));
}
main().catch(console.error);
