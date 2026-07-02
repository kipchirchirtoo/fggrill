require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: items, error: itemsErr } = await supabase
    .from('pos_outlet_items')
    .select('id, name, outlet_id, current_stock, track_stock, source_table, source_item_id, sku')
    .ilike('name', '%monster%');
  if (itemsErr) console.error('items error', itemsErr);
  console.log('OUTLET ITEMS named Monster:', JSON.stringify(items, null, 2));

  if (items && items.length) {
    for (const it of items) {
      if (it.source_item_id) {
        const { data: drink } = await supabase
          .from('bar_drinks')
          .select('id, name, branch_id, stock_quantity')
          .eq('id', it.source_item_id)
          .maybeSingle();
        console.log('LINKED bar_drinks row:', JSON.stringify(drink));

        const { data: barStock } = await supabase
          .from('bar_stock')
          .select('*')
          .eq('drink_id', it.source_item_id);
        console.log('bar_stock rows for this drink:', JSON.stringify(barStock, null, 2));

        const { data: ledger } = await supabase
          .from('bar_stock_ledger')
          .select('*')
          .eq('drink_id', it.source_item_id)
          .order('created_at', { ascending: false })
          .limit(10);
        console.log('bar_stock_ledger rows for this drink:', JSON.stringify(ledger, null, 2));

        const { data: orders } = await supabase
          .from('pos_shift_orders')
          .select('id, items, created_at, outlet_id, status')
          .eq('outlet_id', it.outlet_id)
          .order('created_at', { ascending: false })
          .limit(15);
        const matching = (orders || []).filter(o => JSON.stringify(o.items || '').toLowerCase().includes('monster'));
        console.log('RECENT orders containing Monster:', JSON.stringify(matching, null, 2));
      }
    }
  }
})();
