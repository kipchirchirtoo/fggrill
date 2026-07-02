require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: barStocks } = await supabase.from('bar_stock').select('id, branch_id, drink_id, item_name, current_stock');
  const { data: posItems } = await supabase.from('pos_outlet_items').select('id, outlet_id, source_table, source_item_id, name, current_stock').eq('source_table', 'bar_drinks');
  const { data: outlets } = await supabase.from('pos_outlets').select('id, branch_id, outlet_type').in('outlet_type', ['main_bar', 'executive_bar', 'kyogong_executive_bar', 'kyogong_sports_bar']);

  const outletById = new Map((outlets || []).map(o => [o.id, o]));
  const posByDrinkBranch = new Map();
  for (const p of posItems || []) {
    const outlet = outletById.get(p.outlet_id);
    if (!outlet) continue;
    const key = `${outlet.branch_id}::${p.source_item_id}`;
    posByDrinkBranch.set(key, Number(p.current_stock));
  }

  console.log('barStocks loaded:', barStocks.length, 'map size:', posByDrinkBranch.size);

  let checked = 0, mismatchCount = 0, updated = 0;
  for (const b of barStocks || []) {
    checked++;
    const key = `${b.branch_id}::${b.drink_id}`;
    if (!posByDrinkBranch.has(key)) continue;
    const correctQty = posByDrinkBranch.get(key);
    const currentQty = Number(b.current_stock);
    if (currentQty === correctQty) continue;
    mismatchCount++;
    console.log(`MISMATCH: ${b.item_name} bar=${currentQty} pos=${correctQty}`);

    const { error, data } = await supabase
      .from('bar_stock')
      .update({ current_stock: correctQty, last_updated: new Date().toISOString() })
      .eq('id', b.id)
      .select();
    if (error) {
      console.log(`  UPDATE ERROR for ${b.item_name}:`, error.message);
    } else {
      console.log(`  Updated ${b.item_name} -> ${correctQty}, rows affected: ${data ? data.length : 0}`);
      updated++;
    }
  }
  console.log(`\nChecked ${checked}, mismatches ${mismatchCount}, updated ${updated}`);
})();
