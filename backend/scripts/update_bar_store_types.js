const { supabase } = require('../dist/config/database');

async function main() {
  // 1. Find all SKUs that belong to bar stock / bar drinks
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

  // Get all items in inventory_items that are bar items
  const { data: invItems, error: invErr } = await supabase
    .from('inventory_items')
    .select('id, sku, item_name, category, store_type');

  if (invErr) throw invErr;

  const barInvItems = invItems.filter(i => {
    const cat = String(i.category || '').toUpperCase().trim();
    const sku = String(i.sku || '').toUpperCase().trim();
    if (sku.startsWith('FGB-')) return true;
    if (barCategories.includes(cat)) return true;
    if (sku.includes('BEER') || sku.includes('WINE') || sku.includes('WHK') || sku.includes('DRINKS')) return true;
    return false;
  });

  console.log(`Total bar items identified in inventory_items: ${barInvItems.length}`);

  const barSkus = barInvItems.map(i => i.sku);

  // Update inventory_items to store_type = 'bar_store'
  const { data: updatedInv, error: upInvErr } = await supabase
    .from('inventory_items')
    .update({ store_type: 'bar_store', updated_at: new Date().toISOString() })
    .in('sku', barSkus)
    .select('sku, store_type');

  if (upInvErr) console.error('Error updating inventory_items:', upInvErr);
  else console.log(`Updated ${updatedInv?.length || 0} items in inventory_items to store_type = 'bar_store'`);

  // Update simple_items to store_type = 'bar_store'
  const { data: updatedSmp, error: upSmpErr } = await supabase
    .from('simple_items')
    .update({ store_type: 'bar_store' })
    .in('sku', barSkus)
    .select('sku, store_type');

  if (upSmpErr) console.error('Error updating simple_items:', upSmpErr);
  else console.log(`Updated ${updatedSmp?.length || 0} items in simple_items to store_type = 'bar_store'`);

  // Check Kaplong branch stock specifically
  const { data: kplStock } = await supabase
    .from('branch_stock')
    .select('item_sku')
    .eq('branch_id', 3);

  const kplSkus = (kplStock || []).map(r => r.item_sku);
  const { data: kplInv } = await supabase
    .from('inventory_items')
    .select('sku, item_name, category, store_type')
    .in('sku', kplSkus);

  const breakdown = {};
  for (const item of (kplInv || [])) {
    const st = item.store_type || 'null';
    breakdown[st] = (breakdown[st] || 0) + 1;
  }
  console.log('Kaplong branch items store_type breakdown:', breakdown);
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
