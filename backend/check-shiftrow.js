require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data: shifts, error } = await supabase
    .from('pos_outlet_shifts')
    .select('id, branch_id, outlet_id, status, opened_at, closed_at')
    .eq('outlet_id', '145b570d-6d9b-46bb-9b75-614ab8fedb59')
    .order('opened_at', { ascending: false })
    .limit(5);
  console.log('Main Bar pos_outlet_shifts rows:', JSON.stringify(shifts, null, 2), error);

  const { data: drink } = await supabase.from('bar_drinks').select('id, name, sku').ilike('name', '%monster%').limit(5);
  console.log('Monster drink rows:', JSON.stringify(drink, null, 2));

  if (drink && drink[0]) {
    const { data: bs } = await supabase.from('bar_stock').select('*').eq('drink_id', drink[0].id);
    console.log('bar_stock for Monster:', JSON.stringify(bs, null, 2));
    const { data: led } = await supabase.from('bar_stock_ledger').select('*').eq('drink_id', drink[0].id);
    console.log('bar_stock_ledger for Monster:', JSON.stringify(led, null, 2));
  }
})();
