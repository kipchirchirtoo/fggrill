require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Find James Pkemoi's branch (assume branch via outlet name match later); first find Main Bar outlets
  const { data: outlets, error: outletsErr } = await supabase
    .from('pos_outlets')
    .select('id, name, outlet_type, branch_id, is_active')
    .eq('outlet_type', 'main_bar');
  if (outletsErr) console.error('outlets error', outletsErr);
  console.log('MAIN BAR OUTLETS:', JSON.stringify(outlets, null, 2));

  if (outlets && outlets.length) {
    const outletIds = outlets.map(o => o.id);
    const { data: shifts, error: shiftsErr } = await supabase
      .from('pos_outlet_shifts')
      .select('id, outlet_id, status, opened_at, closed_at, branch_id')
      .in('outlet_id', outletIds)
      .order('opened_at', { ascending: false })
      .limit(10);
    if (shiftsErr) console.error('shifts error', shiftsErr);
    console.log('RECENT MAIN BAR pos_outlet_shifts:', JSON.stringify(shifts, null, 2));
  }

  // Check bar_stock_ledger recent rows for sale entries
  const { data: ledger, error: ledgerErr } = await supabase
    .from('bar_stock_ledger')
    .select('drink_id, branch_id, transaction_type, quantity, created_at')
    .order('created_at', { ascending: false })
    .limit(15);
  if (ledgerErr) console.error('ledger error', ledgerErr);
  console.log('RECENT bar_stock_ledger ROWS:', JSON.stringify(ledger, null, 2));
})();
