const { supabase } = require('../dist/config/database');

async function main() {
  const { data: branchStock } = await supabase
    .from('branch_stock')
    .select('item_sku, quantity')
    .eq('branch_id', 3);

  const skus = branchStock.map(b => b.item_sku);
  const { data: invItems } = await supabase
    .from('inventory_items')
    .select('sku, item_name, category, store_type')
    .in('sku', skus);

  const invBySku = new Map(invItems.map(i => [i.sku, i]));

  const storeItems = [];
  const barItems = [];

  for (const b of branchStock) {
    const inv = invBySku.get(b.item_sku);
    const cat = inv?.category || '';
    const name = inv?.item_name || b.item_sku;
    const isStore = ['DRY GOODS', 'CLEANING MATERIALS', 'KITCHEN STAPLES', 'FOODSTUFFS'].includes(cat) ||
                    (!b.item_sku.startsWith('FGB-') && !b.item_sku.startsWith('FG-') && !b.item_sku.includes('DRINKS') && !b.item_sku.includes('BEERS') && !b.item_sku.includes('WINES') && !b.item_sku.includes('SPIRITS') && !b.item_sku.includes('TOTS'));
    
    if (cat === 'DRY GOODS' || cat === 'CLEANING MATERIALS' || cat === 'FOODSTUFFS') {
      storeItems.push({ sku: b.item_sku, name, cat });
    } else {
      barItems.push({ sku: b.item_sku, name, cat });
    }
  }

  console.log(`Total Kaplong items: ${branchStock.length}`);
  console.log(`Store items count: ${storeItems.length}`);
  console.log('Store items:', storeItems);
  console.log(`Bar items count: ${barItems.length}`);
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
