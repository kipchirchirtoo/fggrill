const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cols(table) {
  const { data, error } = await supabase.from(table).select('*').limit(1);
  if (error) return `ERROR: ${JSON.stringify(error)}`;
  if (!data || data.length === 0) return `(empty table)`;
  return Object.keys(data[0]).join(', ');
}

async function sample(table, limit = 2) {
  const { data, error } = await supabase.from(table).select('*').limit(limit);
  if (error) return { error: error.message || JSON.stringify(error) };
  return data;
}

async function main() {
  console.log('\n=== CASHIER_LOGBOOKS ===');
  console.log('Columns:', await cols('cashier_logbooks'));
  const logbooks = await sample('cashier_logbooks');
  console.log('Sample:', JSON.stringify(logbooks, null, 2));

  console.log('\n=== CASHIER_LOGBOOKS pending_audit ===');
  const { data: pending, error: pe } = await supabase
    .from('cashier_logbooks')
    .select('id, cashier_id, branch_id, log_date, type, status, total_sales, total_cash, closing_float, submitted_at, created_at')
    .in('status', ['pending_audit', 'pending_accountant_review'])
    .limit(3);
  if (pe) console.log('Error:', pe.message);
  else console.log('Pending logbooks:', JSON.stringify(pending, null, 2));

  console.log('\n=== PAYMENTS (for financial reconciliation) ===');
  console.log('Columns:', await cols('payments'));

  console.log('\n=== CASHIER_LOGBOOK_LINES ===');
  console.log('Columns:', await cols('cashier_logbook_lines'));

  console.log('\n=== BRANCHES ===');
  console.log('Columns:', await cols('branches'));
  const { data: branches } = await supabase.from('branches').select('id, name').limit(5);
  console.log('Branches:', JSON.stringify(branches));

  console.log('\n=== USERS (cashier users) ===');
  const { data: users } = await supabase.from('users').select('id, first_name, last_name, role').eq('role', 'cashier').limit(3);
  console.log('Cashier users:', JSON.stringify(users));

  console.log('\n=== CASHIER_SHIFTS ===');
  console.log('Columns:', await cols('cashier_shifts'));

  console.log('\n=== SHIFT_ACTUAL_COLLECTIONS ===');
  console.log('Columns:', await cols('shift_actual_collections'));

  console.log('\n=== BAR_STOCK_TAKES / BAR_STOCK_AUDITS ===');
  const { data: bst, error: bste } = await supabase.from('bar_stock_takes').select('*').limit(1);
  if (bste) console.log('bar_stock_takes error:', bste.message);
  else console.log('bar_stock_takes cols:', bst && bst[0] ? Object.keys(bst[0]).join(', ') : '(empty)');

  console.log('\n=== VOID BILLS TABLE ===');
  // Try different possible table names
  for (const t of ['void_bills', 'voided_bills', 'restaurant_void_bills', 'bar_void_bills']) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (!error) {
      console.log(`${t} columns:`, data && data[0] ? Object.keys(data[0]).join(', ') : '(empty)');
    } else {
      console.log(`${t}: ${error.message}`);
    }
  }

  console.log('\n=== DAILY_LOGS / FINANCE_DAILY_LOGS ===');
  for (const t of ['daily_logs', 'finance_daily_logs', 'branch_daily_logs']) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (!error) {
      console.log(`${t} columns:`, data && data[0] ? Object.keys(data[0]).join(', ') : '(empty)');
      if (data && data[0]) console.log(`${t} sample:`, JSON.stringify(data[0], null, 2));
    } else {
      console.log(`${t}: ${error.message}`);
    }
  }

  console.log('\n=== AUDIT EXCEPTIONS ===');
  console.log('Columns:', await cols('audit_exceptions'));
  const exc = await sample('audit_exceptions');
  console.log('Sample:', JSON.stringify(exc, null, 2));

  console.log('\n=== BANKING_TRANSACTIONS ===');
  for (const t of ['banking_transactions', 'bank_transactions', 'banking_transaction']) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (!error) {
      console.log(`${t} columns:`, data && data[0] ? Object.keys(data[0]).join(', ') : '(empty)');
    } else {
      console.log(`${t}: ${error.message}`);
    }
  }

  console.log('\n=== SHIFT_PNL / SHIFT_PNL_REPORTS ===');
  for (const t of ['shift_pnl', 'shift_pnl_reports', 'shift_p_n_l']) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (!error) {
      console.log(`${t} columns:`, data && data[0] ? Object.keys(data[0]).join(', ') : '(empty)');
      if (data && data[0]) console.log(`${t} sample:`, JSON.stringify(data[0], null, 2));
    } else {
      console.log(`${t}: ${error.message}`);
    }
  }

  console.log('\n=== KITCHEN_REQUISITIONS ===');
  console.log('Columns:', await cols('kitchen_requisitions'));
  const kreq = await sample('kitchen_requisitions');
  console.log('Sample:', JSON.stringify(kreq, null, 2));

  console.log('\n=== KITCHEN_USAGE / KITCHEN_USAGE_LOGS ===');
  for (const t of ['kitchen_usage', 'kitchen_usage_logs', 'kitchen_usage_tracking']) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (!error) {
      console.log(`${t} columns:`, data && data[0] ? Object.keys(data[0]).join(', ') : '(empty)');
    } else {
      console.log(`${t}: ${error.message}`);
    }
  }

  console.log('\n=== KITCHEN_WASTAGE ===');
  console.log('Columns:', await cols('kitchen_wastage'));

  console.log('\n=== STOCK_REQUESTS ===');
  console.log('Columns:', await cols('stock_requests'));
  const sreq = await sample('stock_requests');
  console.log('Sample:', JSON.stringify(sreq, null, 2));

  console.log('\n=== CREDIT_BILLS (guest credit bills) ===');
  console.log('Columns:', await cols('credit_bills'));

  console.log('\n=== STAFF_CREDIT_BILLS ===');
  console.log('Columns:', await cols('staff_credit_bills'));

  console.log('\n=== DISPATCH_NOTES ===');
  console.log('Columns:', await cols('dispatch_notes'));
  const dn = await sample('dispatch_notes');
  console.log('Sample:', JSON.stringify(dn, null, 2));
}

main().catch(console.error);
