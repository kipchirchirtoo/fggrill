require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data: outlet, error } = await supabase
    .from('pos_outlets')
    .select('id, name, outlet_type, branch_id, inventory_location_id')
    .eq('id', '145b570d-6d9b-46bb-9b75-614ab8fedb59')
    .maybeSingle();
  console.log('OUTLET:', JSON.stringify(outlet), 'err:', error);

  const { data: locs, error: locErr } = await supabase
    .from('inventory_locations')
    .select('id, branch_id, location_type')
    .eq('branch_id', 2);
  console.log('INVENTORY_LOCATIONS for branch 2:', JSON.stringify(locs), 'err:', locErr);

  const { data: invItem, error: invErr } = await supabase
    .from('inventory_items')
    .select('id, sku')
    .eq('sku', 'FGB-ENR-0002')
    .maybeSingle();
  console.log('inventory_items FGB-ENR-0002:', JSON.stringify(invItem), 'err:', invErr);
})();
