require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: barStocks } = await supabase
    .from('bar_stock')
    .select('id, branch_id, drink_id, item_name, current_stock, last_updated');

  const { data: posItems } = await supabase
    .from('pos_outlet_items')
    .select('id, outlet_id, source_table, source_item_id, name, current_stock, sku')
    .eq('source_table', 'bar_drinks');

  const { data: outlets } = await supabase
    .from('pos_outlets')
    .select('id, branch_id, outlet_type, name')
    .in('outlet_type', ['main_bar', 'executive_bar', 'kyogong_executive_bar', 'kyogong_sports_bar']);

  const outletById = new Map((outlets || []).map(o => [o.id, o]));

  // Group pos_outlet_items by source_item_id (drink_id) + branch
  const posByDrinkBranch = new Map();
  for (const p of posItems || []) {
    const outlet = outletById.get(p.outlet_id);
    if (!outlet) continue;
    const key = `${outlet.branch_id}::${p.source_item_id}`;
    if (!posByDrinkBranch.has(key)) posByDrinkBranch.set(key, []);
    posByDrinkBranch.get(key).push({ outlet: outlet.name, stock: p.current_stock, name: p.name });
  }

  const mismatches = [];
  for (const b of barStocks || []) {
    const key = `${b.branch_id}::${b.drink_id}`;
    const posMatches = posByDrinkBranch.get(key) || [];
    if (posMatches.length === 0) continue;
    // Compare against each matching pos_outlet_item (usually 1 per branch for a bar drink)
    for (const pm of posMatches) {
      if (Number(pm.stock) !== Number(b.current_stock)) {
        mismatches.push({
          branch_id: b.branch_id,
          drink: b.item_name,
          drink_id: b.drink_id,
          bar_stock_qty: b.current_stock,
          pos_outlet_qty: pm.stock,
          outlet: pm.outlet,
          last_updated: b.last_updated
        });
      }
    }
  }
  console.log('Total bar_stock rows:', (barStocks||[]).length);
  console.log('Total bar pos_outlet_items:', (posItems||[]).length);
  console.log('MISMATCHES found:', mismatches.length);
  console.log(JSON.stringify(mismatches, null, 2));
})();
