require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data: orders, error } = await supabase
    .from('pos_shift_orders')
    .select('id, items, created_at, outlet_id, status')
    .eq('outlet_id', '145b570d-6d9b-46bb-9b75-614ab8fedb59')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log('RECENT Main Bar orders (any item):', JSON.stringify(orders, null, 2));
})();
