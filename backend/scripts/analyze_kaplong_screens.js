const { supabase } = require('../dist/config/database');
const { getBranchStock } = require('../dist/services/branch-inventory.service');

async function analyze() {
  console.log('=== KAPLONG BRANCH (ID: 3) STORE STOCK & BAR STOCK AUDIT ===\n');

  // 1. Branch Stock rows in Kaplong
  const { data: branchStock, error: bsErr } = await supabase
    .from('branch_stock')
    .select('*')
    .eq('branch_id', 3);

  console.log(`1. Total rows in branch_stock for Kaplong: ${branchStock?.length || 0}`);

  // 2. Bar stock rows in Kaplong
  const { data: barStock, error: barErr } = await supabase
    .from('bar_stock')
    .select('sku, item_name, quantity, selling_price, category')
    .eq('branch_id', 3);
  console.log(`2. Total rows in bar_stock for Kaplong: ${barStock?.length || 0}`);

  // 3. Bar drinks (menu items) in Kaplong
  const { data: barDrinks, error: bdErr } = await supabase
    .from('bar_drinks')
    .select('sku, name, price, category')
    .eq('branch_id', 3);
  console.log(`3. Total rows in bar_drinks for Kaplong: ${barDrinks?.length || 0}`);

  // 4. POS outlet items for Kaplong Main Bar
  const { data: outletItems } = await supabase
    .from('pos_outlet_items')
    .select('id, name, sku, category, current_stock, selling_price')
    .eq('outlet_id', '7a69ab32-6594-47d6-ad92-b576301ec201');
  console.log(`4. Total rows in pos_outlet_items (KAPLONG Main Bar POS): ${outletItems?.length || 0}`);

  // 5. Check what getBranchStock returns and classify store vs bar
  const stock = await getBranchStock(3);
  console.log(`\n5. Total items returned by API getBranchStock(3): ${stock.length}`);

  // Check store_type breakdown
  const storeTypes = {};
  for (const item of stock) {
    const st = item.store_type || 'null';
    storeTypes[st] = (storeTypes[st] || 0) + 1;
  }
  console.log('Store types breakdown:', storeTypes);

  // Check categories breakdown
  const categories = {};
  for (const item of stock) {
    const cat = item.category || 'Uncategorised';
    categories[cat] = (categories[cat] || 0) + 1;
  }
  console.log('Categories breakdown:', categories);

  // 6. Simulate Flutter _isStoreStockItem (Store Stock Screen)
  const barKeywords = [
    'bar drinks', 'soft drink', 'soft drinks', 'energy drink', 'energy drinks',
    'beer', 'beers', 'cider', 'ciders', 'wine', 'wines', 'cognac', 'whisky',
    'whiskey', 'vodka', 'gin', 'rum', 'tequila', 'brandy', 'condom', 'condoms',
    'tots', 'liqueur', 'spirits', 'champagne', 'cocktail', 'bar stock'
  ];

  function isStoreStockItem(item) {
    const storeType = String(item.store_type || '').toLowerCase().trim();
    const category = String(item.category || '').toLowerCase().trim();
    const sku = String(item.item_sku || item.sku || '').toLowerCase().trim();
    const name = String(item.item_name || item.name || '').toLowerCase().trim();

    if (storeType === 'bar_store') return false;
    if (storeType && storeType !== 'foodstuffs') return false;
    if (category.includes('kitchen menu')) return false;
    if (sku.startsWith('fgb')) return false;
    if (barKeywords.some(k => category.includes(k) || sku.includes(k) || name.includes(k))) {
      return false;
    }
    return true;
  }

  const storeStockItems = stock.filter(isStoreStockItem);
  const barStockItems = stock.filter(i => !isStoreStockItem(i));

  console.log(`\n6. STORE STOCK SCREEN:`);
  console.log(`   Items visible on Store Stock screen: ${storeStockItems.length}`);
  console.log('   Store Stock items list:', storeStockItems.map(i => ({
    sku: i.item_sku,
    name: i.item_name,
    category: i.category,
    store_type: i.store_type,
    quantity: i.quantity
  })));

  console.log(`\n7. BAR STOCK SCREEN:`);
  console.log(`   Bar items remaining in Bar Stock screen: ${barStockItems.length}`);
  console.log('   Sample Bar items:', barStockItems.slice(0, 10).map(i => ({
    sku: i.item_sku,
    name: i.item_name,
    category: i.category,
    store_type: i.store_type
  })));

  // 8. Also check Master Catalogue items in DB for food & dry goods across company
  const { data: dryGoodsAll } = await supabase
    .from('inventory_items')
    .select('sku, item_name, category, store_type')
    .in('category', ['DRY GOODS', 'CLEANING MATERIALS', 'KITCHEN STAPLES', 'FOODSTUFFS'])
    .limit(20);
  console.log(`\n8. Master Catalog Dry Goods / Cleaning sample:`, dryGoodsAll?.slice(0, 10));
}

analyze().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
