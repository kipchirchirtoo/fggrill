const { supabase } = require('../dist/config/database');

async function main() {
  const { data: outlets } = await supabase
    .from('pos_outlets')
    .select('id, name, outlet_type, branch_id')
    .eq('branch_id', 3);
  console.log('Kaplong outlets:', outlets);

  const mainBar = outlets.find(o => o.outlet_type === 'main_bar');
  if (mainBar) {
    const { count, error } = await supabase
      .from('pos_outlet_items')
      .select('*', { count: 'exact', head: true })
      .eq('outlet_id', mainBar.id);
    console.log('pos_outlet_items count for Kaplong Main Bar:', count, error);
  }

  const { count: barStockCount } = await supabase
    .from('bar_stock')
    .select('*', { count: 'exact', head: true })
    .eq('branch_id', 3);
  console.log('bar_stock count in Kaplong:', barStockCount);

  const { count: barDrinksCount } = await supabase
    .from('bar_drinks')
    .select('*', { count: 'exact', head: true })
    .eq('branch_id', 3);
  console.log('bar_drinks count in Kaplong:', barDrinksCount);
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
