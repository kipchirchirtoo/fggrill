require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data: items, error } = await supabase
    .from('pos_outlet_items')
    .select('id, name, sku, outlet_id, current_stock, source_table, source_item_id, track_stock, stock_pool_item_id')
    .eq('outlet_id', '145b570d-6d9b-46bb-9b75-614ab8fedb59')
    .ilike('name', '%monster%');
  console.log('pos_outlet_items Monster:', JSON.stringify(items, null, 2), error);
})();
