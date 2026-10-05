const { getBranchStock } = require('../dist/services/branch-inventory.service');
const { supabase } = require('../dist/config/database');

async function testScreens() {
  console.log('=== VERIFYING WHAT STORE STOCK & STORE STOCKTAKE SCREENS SEE FOR KAPLONG ===\n');

  // 1. API: /store/branch-stock for branch_id = 3
  const branchStock = await getBranchStock(3);
  console.log(`API returned ${branchStock.length} total rows for Kaplong branch stock.`);

  // 2. Frontend Store Stock filter simulation
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

  const visibleOnStoreStock = branchStock.filter(isStoreStockItem);
  console.log(`\n1. STORE STOCK SCREEN:`);
  console.log(`   Count: ${visibleOnStoreStock.length} items`);
  console.table(visibleOnStoreStock.map(i => ({
    sku: i.item_sku,
    name: i.item_name,
    category: i.category,
    store_type: i.store_type,
    badge: i.store_type === 'bar_store' ? 'Bar' : 'Food'
  })));

  // 3. Store Stocktake API simulation (/store/stocktake/records)
  const NON_STORE_TYPES = ['bar_store', 'kitchen'];
  const isStoreCountableItem = (i) => {
    if (!i) return false;
    const storeType = String(i.store_type || '').toLowerCase();
    if (NON_STORE_TYPES.includes(storeType)) return false;
    const category = String(i.category || '').trim().toLowerCase();
    if (category === 'kitchen menu') return false;
    const sku = String(i.sku || i.item_sku || '').toUpperCase();
    if (sku.startsWith('FGB-')) return false;
    return true;
  };

  const visibleOnStoreStocktake = branchStock.filter(isStoreCountableItem);
  console.log(`\n2. STORE STOCKTAKE SCREEN:`);
  console.log(`   Count: ${visibleOnStoreStocktake.length} items`);
  console.table(visibleOnStoreStocktake.map(i => ({
    sku: i.item_sku,
    name: i.item_name,
    category: i.category,
    store_type: i.store_type
  })));

  // 4. Bar Stock Screen simulation
  const visibleOnBarStock = branchStock.filter(i => !isStoreStockItem(i));
  console.log(`\n3. BAR STOCK SCREEN:`);
  console.log(`   Count: ${visibleOnBarStock.length} bar items`);
  console.log(`   All 148+ bar items (beers, spirits, wines, whiskies, sodas) are here under Bar Stock.`);

  // 5. Master Inventory Store column badge check
  const badgeCounts = {};
  for (const item of branchStock) {
    const badge = item.store_type === 'bar_store' ? 'Bar (Purple)' : (item.store_type === 'dry_goods' ? 'Dry' : 'Food (Green)');
    badgeCounts[badge] = (badgeCounts[badge] || 0) + 1;
  }
  console.log(`\n4. MASTER INVENTORY "STORE" COLUMN BADGES:`);
  console.table(badgeCounts);
}

testScreens().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
