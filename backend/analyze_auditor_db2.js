const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cols(table) {
  const { data, error } = await supabase.from(table).select('*').limit(1);
  if (error) return `ERROR: ${error.message}`;
  if (!data || data.length === 0) return `(empty)`;
  return Object.keys(data[0]).join(', ');
}
async function sample(table, limit=1) {
  const { data, error } = await supabase.from(table).select('*').limit(limit);
  if (error) return { error: error.message };
  return data;
}

async function main() {
  // 1. cashier_logbooks - what does pending_audit look like?
  console.log('=== cashier_logbooks columns ===');
  console.log(await cols('cashier_logbooks'));
  const { data: lb } = await supabase.from('cashier_logbooks').select('*').limit(2);
  console.log('sample:', JSON.stringify(lb, null, 2));

  // 2. cashier_logbook_lines
  console.log('\n=== cashier_logbook_lines columns ===');
  console.log(await cols('cashier_logbook_lines'));

  // 3. What tables have "void" related data?
  console.log('\n=== void_bills search ===');
  for (const t of ['void_bills', 'voided_bills', 'voided_orders', 'restaurant_voided_bills']) {
    const { data, error } = await supabase.from(t).select('id').limit(1);
    console.log(t + ':', error ? error.message : 'EXISTS, count check ok');
  }

  // 4. finance_daily_logs
  console.log('\n=== finance_daily_logs columns ===');
  console.log(await cols('finance_daily_logs'));
  const { data: dl } = await supabase.from('finance_daily_logs').select('*').limit(1);
  console.log('sample:', JSON.stringify(dl, null, 2));

  // 5. shift_pnl
  console.log('\n=== shift_summaries / cashier_shifts ===');
  console.log('cashier_shifts:', await cols('cashier_shifts'));
  const { data: cs } = await supabase.from('cashier_shifts').select('*').limit(1);
  console.log('cashier_shifts sample:', JSON.stringify(cs, null, 2));

  // 6. bar-related tables
  console.log('\n=== bar_stock_takes ===');
  console.log(await cols('bar_stock_takes'));
  const { data: bst } = await supabase.from('bar_stock_takes').select('*').limit(1);
  console.log('sample:', JSON.stringify(bst, null, 2));

  // 7. audit_exceptions
  console.log('\n=== audit_exceptions columns ===');
  console.log(await cols('audit_exceptions'));
  const { data: ae } = await supabase.from('audit_exceptions').select('*').limit(1);
  console.log('sample:', JSON.stringify(ae, null, 2));

  // 8. banking
  console.log('\n=== banking_transactions ===');
  console.log(await cols('banking_transactions'));
  const { data: bt } = await supabase.from('banking_transactions').select('*').limit(1);
  console.log('sample:', JSON.stringify(bt, null, 2));

  // 9. kitchen tables
  console.log('\n=== kitchen_usage columns ===');
  console.log(await cols('kitchen_usage'));
  console.log('\n=== kitchen_wastage columns ===');
  console.log(await cols('kitchen_wastage'));
  const { data: kw } = await supabase.from('kitchen_wastage').select('*').limit(1);
  console.log('kitchen_wastage sample:', JSON.stringify(kw, null, 2));

  // 10. purchase orders / expenditure
  console.log('\n=== purchase_orders columns ===');
  for (const t of ['purchase_orders', 'supplier_invoices', 'procurement_orders']) {
    console.log(t + ':', await cols(t));
  }

  // 11. bar_stock (for bar stock verify)
  console.log('\n=== bar_stock ===');
  console.log(await cols('bar_stock'));
  
  // 12. inventory/stock for stock-levels verify
  console.log('\n=== branch_inventory / inventory_items ===');
  for (const t of ['branch_inventory', 'inventory_items', 'stock_items', 'inventory']) {
    console.log(t + ':', await cols(t));
  }

  // 13. staff credit bills join with users
  console.log('\n=== staff_credit_bills pending ===');
  const { data: scb } = await supabase.from('staff_credit_bills').select('id, staff_id, branch_id, bill_number, amount, balance, status, bill_date').in('status', ['pending', 'pending_auditor', 'auditor_pending']).limit(3);
  console.log('staff_credit_bills pending:', JSON.stringify(scb, null, 2));

  // 14. credit_bills pending  
  console.log('\n=== credit_bills pending ===');
  const { data: gcb } = await supabase.from('credit_bills').select('id, branch_id, bill_number, customer_name, amount, balance, status, credit_date, bill_date').in('status', ['pending', 'pending_auditor', 'auditor_pending', 'approved']).limit(3);
  console.log('credit_bills pending:', JSON.stringify(gcb, null, 2));

  // 15. what does approvals table look like?
  console.log('\n=== approval_requests / approvals ===');
  for (const t of ['approval_requests', 'approvals', 'auditor_approvals']) {
    console.log(t + ':', await cols(t));
  }

  // 16. staff_profiles for staff audit
  console.log('\n=== staff_profiles columns ===');
  console.log(await cols('staff_profiles'));

  // 17. payroll
  console.log('\n=== payroll_records / payroll_runs ===');
  for (const t of ['payroll_records', 'payroll_runs', 'payroll']) {
    console.log(t + ':', await cols(t));
  }

  // 18. audit_watchlist
  console.log('\n=== audit_watchlist columns ===');
  console.log(await cols('audit_watchlist'));
}

main().catch(console.error);
