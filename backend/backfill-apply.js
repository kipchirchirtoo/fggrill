require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: barStocks } = await supabase
    .from('bar_stock')
    .select('id, branch_id, drink_id, item_name, current_stock');

  const { data: posItems } = await supabase
    .from('pos_outlet_items')
    .select('id, outlet_id, source_table, source_item_id, name, current_stock')
    .eq('source_table', 'bar_drinks');

  const { data: outlets } = await supabase
    .from('pos_outlets')
    .select('id, branch_id, outlet_type')
    .in('outlet_type', ['main_bar', 'executive_bar', 'kyogong_executive_bar', 'kyogong_sports_bar']);

  const outletById = new Map((outlets || []).map(o => [o.id, o]));
  const posByDrinkBranch = new Map();
  for (const p of posItems || []) {
    const outlet = outletById.get(p.outlet_id);
    if (!outlet) continue;
    const key = `${outlet.branch_id}::${p.source_item_id}`;
    posByDrinkBranch.set(key, Number(p.current_stock));
  }

  let updated = 0;
  const errors = [];
  for (const b of barStocks || []) {
    const key = `${b.branch_id}::${b.drink_id}`;
    if (!posByDrinkBranch.has(key)) continue;
    const correctQty = posByDrinkBranch.get(key);
    if (Number(b.current_stock) === correctQty) continue;

    const { error } = await supabase
      .from('bar_stock')
      .update({ current_stock: correctQty, last_updated: new Date().toISOString() })
      .eq('id', b.id);
    if (error) {
      errors.push({ drink: b.item_name, error: error.message });
    } else {
      console.log(`Backfilled ${b.item_name}: ${b.current_stock} -> ${correctQty}`);
      updated++;
    }
  }
  console.log(`\nDone. Updated ${updated} rows.`);
  if (errors.length) console.log('ERRORS:', JSON.stringify(errors, null, 2));
})();
