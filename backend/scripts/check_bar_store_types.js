const { supabase } = require('../dist/config/database');

async function main() {
  const { data: branchStock } = await supabase
    .from('branch_stock')
    .select('item_sku')
    .eq('branch_id', 3);

  const skus = branchStock.map(b => b.item_sku);

  const { data: items } = await supabase
    .from('inventory_items')
    .select('sku, item_name, category, store_type')
    .in('sku', skus);

  console.log(`Found ${items.length} items in inventory_items for Kaplong`);

  const barCategories = [
    'BAR DRINKS',
    'BEERS',
    'CANNED BEERS',
    'ENERGY DRINKS',
    'SOFT DRINKS',
    'TOTS',
    'SPIRITS',
    'LIQUEURS',
    'WINES',
    'WHISKY',
    'GIN',
    'COGNAC',
    'VODKA'
  ];

  const toUpdate = items.filter(i => 
    barCategories.includes(i.category) ||
    i.sku.startsWith('FGB-') ||
    i.sku.includes('BEER') ||
    i.sku.includes('WINE') ||
    i.sku.includes('DRINK') ||
    i.sku.includes('SPIRIT')
  );

  console.log(`Items to set to store_type = 'bar_store': ${toUpdate.length}`);
  console.log('Sample items to update:', toUpdate.slice(0, 10).map(i => ({ sku: i.sku, name: i.item_name, cat: i.category, current_store_type: i.store_type })));

  const remaining = items.filter(i => !toUpdate.includes(i));
  console.log('Non-bar store items:', remaining.map(i => ({ sku: i.sku, name: i.item_name, cat: i.category, store_type: i.store_type })));
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
