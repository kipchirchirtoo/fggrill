const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function chk(table) {
  const { data, error } = await supabase.from(table).select('*').limit(1);
  if (error) return `ERROR: ${error.message}`;
  if (!data || data.length === 0) return `(empty)`;
  return Object.keys(data[0]).join(', ');
}

async function main() {
  const tables = [
    'branch_stock', 'branch_stock_movements', 'simple_items',
    'stock_counts', 'stock_count_items', 'cashier_credit_bills',
    'accounting_ar_invoices', 'accounting_ap_bills', 'supplier_invoices',
    'goods_received_notes', 'audit_night_sessions', 'audit_approvals',
    'restaurant_orders', 'bar_orders', 'pos_transactions',
    'daily_revenue_summaries', 'shift_summaries', 'cashier_shift_logs',
  ];
  for (const t of tables) {
    const r = await chk(t);
    console.log(`${t}: ${r}`);
  }

  // cashier_credit_bills
  console.log('\n=== cashier_credit_bills sample ===');
  const { data: ccb, error: ccbe } = await supabase.from('cashier_credit_bills').select('*').limit(2);
  if (ccbe) console.log('Error:', ccbe.message);
  else console.log(JSON.stringify(ccb, null, 2));

  // stock_counts
  console.log('\n=== stock_counts sample (bar store_type) ===');
  const { data: sc, error: sce } = await supabase.from('stock_counts').select('*').eq('store_type', 'bar').limit(2);
  if (sce) console.log('Error:', sce.message);
  else console.log(JSON.stringify(sc, null, 2));

  // branch_stock
  console.log('\n=== branch_stock sample ===');
  const { data: bs, error: bse } = await supabase.from('branch_stock').select('*').limit(2);
  if (bse) console.log('Error:', bse.message);
  else console.log(JSON.stringify(bs, null, 2));

  // accounting AR invoices
  console.log('\n=== accounting_ar_invoices sample ===');
  const { data: ai, error: aie } = await supabase.from('accounting_ar_invoices').select('*').limit(1);
  if (aie) console.log('Error:', aie.message);
  else console.log(JSON.stringify(ai, null, 2));

  // void_bills current count
  console.log('\n=== void_bills count ===');
  const { count, error: vbe } = await supabase.from('void_bills').select('id', { count: 'exact', head: true });
  console.log('void_bills count:', count, 'error:', vbe?.message);

  // cashier_logbooks - all statuses
  console.log('\n=== cashier_logbooks status distribution ===');
  const { data: lbs } = await supabase.from('cashier_logbooks').select('status').limit(100);
  const statusMap = {};
  lbs?.forEach(l => { statusMap[l.status] = (statusMap[l.status] || 0) + 1; });
  console.log(JSON.stringify(statusMap, null, 2));

  // credit_bills all statuses
  console.log('\n=== credit_bills status distribution ===');
  const { data: cbs } = await supabase.from('credit_bills').select('status').limit(100);
  const cbMap = {};
  cbs?.forEach(c => { cbMap[c.status] = (cbMap[c.status] || 0) + 1; });
  console.log(JSON.stringify(cbMap, null, 2));

  // staff_credit_bills statuses
  console.log('\n=== staff_credit_bills status distribution ===');
  const { data: scbs } = await supabase.from('staff_credit_bills').select('status').limit(100);
  const scbMap = {};
  scbs?.forEach(s => { scbMap[s.status] = (scbMap[s.status] || 0) + 1; });
  console.log(JSON.stringify(scbMap, null, 2));

  // approval_requests statuses
  console.log('\n=== approval_requests all ===');
  const { data: ar, error: are } = await supabase.from('approval_requests').select('status').limit(100);
  if (are) console.log('Error:', are.message);
  else {
    const arMap = {};
    ar?.forEach(a => { arMap[a.status] = (arMap[a.status] || 0) + 1; });
    console.log(JSON.stringify(arMap, null, 2));
  }

  // stock_requests statuses
  console.log('\n=== stock_requests status distribution ===');
  const { data: srs } = await supabase.from('stock_requests').select('status, workflow_status').limit(100);
  const srMap = {};
  srs?.forEach(s => { const k = `${s.status}/${s.workflow_status}`; srMap[k] = (srMap[k] || 0) + 1; });
  console.log(JSON.stringify(srMap, null, 2));

  // dispatch_notes statuses
  console.log('\n=== dispatch_notes status distribution ===');
  const { data: dns } = await supabase.from('dispatch_notes').select('status, workflow_status').limit(100);
  const dnMap = {};
  dns?.forEach(d => { const k = `${d.status}/${d.workflow_status}`; dnMap[k] = (dnMap[k] || 0) + 1; });
  console.log(JSON.stringify(dnMap, null, 2));

  // payroll_runs statuses
  console.log('\n=== payroll_runs statuses ===');
  const { data: prs } = await supabase.from('payroll_runs').select('status').limit(100);
  const prsMap = {};
  prs?.forEach(p => { prsMap[p.status] = (prsMap[p.status] || 0) + 1; });
  console.log(JSON.stringify(prsMap, null, 2));

  // restaurant_orders sample (for sold items)
  console.log('\n=== restaurant_orders sample ===');
  const { data: ro, error: roe } = await supabase.from('restaurant_orders').select('id, branch_id, status, total_amount, created_at').limit(2);
  if (roe) console.log('Error:', roe.message);
  else console.log(JSON.stringify(ro, null, 2));

  // purchase_orders statuses
  console.log('\n=== purchase_orders statuses ===');
  const { data: pos } = await supabase.from('purchase_orders').select('status').limit(100);
  const posMap = {};
  pos?.forEach(p => { posMap[p.status] = (posMap[p.status] || 0) + 1; });
  console.log(JSON.stringify(posMap, null, 2));
}
main().catch(console.error);
