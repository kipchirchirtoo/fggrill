const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // Check expenses table
  const { data: exp, error: expe } = await supabase.from('expenses').select('*').limit(1);
  if (expe) console.log('expenses table:', expe.message);
  else console.log('expenses cols:', exp && exp[0] ? Object.keys(exp[0]).join(', ') : '(empty)');

  // purchase_orders full columns + supplier join
  const { data: po } = await supabase.from('purchase_orders').select('*').limit(1);
  if (po && po[0]) console.log('purchase_orders cols:', Object.keys(po[0]).join(', '));

  // suppliers table
  const { data: sup, error: supe } = await supabase.from('suppliers').select('id, name').limit(3);
  if (supe) console.log('suppliers:', supe.message);
  else console.log('suppliers:', JSON.stringify(sup));

  // cashier_shift_logs columns for banking review  
  const { data: csl } = await supabase.from('cashier_shift_logs').select('*').limit(1);
  if (csl && csl[0]) console.log('\ncashier_shift_logs cols:', Object.keys(csl[0]).join(', '));

  // Check dispatch controller response shape
  const { data: dn } = await supabase.from('dispatch_notes')
    .select('id, dispatch_number, from_branch_id, to_branch_id, status, workflow_status, vehicle_number, dispatched_at, delivered_at, receipt_status, created_at')
    .limit(2);
  console.log('\ndispatch_notes sample:', JSON.stringify(dn, null, 2));

  // Check what the dispatch auditor controller enriches
  // It joins branches for to_branch_id
  const { data: branches } = await supabase.from('branches').select('id, name').limit(5);
  console.log('\nbranches:', JSON.stringify(branches));
}
main().catch(console.error);
