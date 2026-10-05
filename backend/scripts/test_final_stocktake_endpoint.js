const { supabase } = require('../dist/config/database');

async function testStoreStocktakeEndpoint(branchId) {
  console.log(`Testing Store Stocktake query for Branch ${branchId}...`);

  const NON_STORE_TYPES = ['bar_store', 'kitchen'];
  const isStoreCountableItem = (i) => {
    if (!i) return false;
    const storeType = String(i.store_type || '').toLowerCase();
    if (NON_STORE_TYPES.includes(storeType)) return false;
    const category = String(i.category || '').trim().toLowerCase();
    if (category === 'kitchen menu') return false;
    const sku = String(i.sku || i.item_sku || '').toUpperCase();
    if (sku.startsWith('FGB-') || sku.startsWith('FG-')) return false;
    if (sku.includes('BEER') || sku.includes('WINE') || sku.includes('WHISKY') || sku.includes('SPIRIT') || sku.includes('TOTS') || sku.includes('DRINKS')) return false;
    return true;
  };

  const [{ data: branchStockRows }, { data: branchSimpleItems }, { data: invItems }] = await Promise.all([
    supabase.from('branch_stock').select('item_sku, quantity').eq('branch_id', branchId),
    supabase.from('simple_items').select('id, sku, item_sku, item_name, unit, unit_of_measure, category, store_type, quantity, cost_price').eq('branch_id', branchId).eq('is_active', true),
    supabase.from('inventory_items').select('id, sku, item_name, unit, category, store_type, default_unit_cost').eq('is_active', true)
  ]);

  const stockRows = branchStockRows || [];
  const stockBySkuMap = new Map();
  for (const r of stockRows) {
    if (r.item_sku) stockBySkuMap.set(r.item_sku, Number(r.quantity || 0));
  }

  const branchRegisteredSkus = new Set();
  for (const r of stockRows) {
    if (r.item_sku) branchRegisteredSkus.add(r.item_sku);
  }
  for (const s of (branchSimpleItems || [])) {
    const sku = s.sku || s.item_sku;
    if (sku) {
      branchRegisteredSkus.add(sku);
      if (!stockBySkuMap.has(sku)) stockBySkuMap.set(sku, Number(s.quantity || 0));
    }
  }

  const allInvBySku = new Map();
  for (const item of (invItems || [])) {
    if (item.sku) allInvBySku.set(item.sku, item);
  }
  for (const item of (branchSimpleItems || [])) {
    const sku = item.sku || item.item_sku;
    if (sku && !allInvBySku.has(sku)) allInvBySku.set(sku, item);
  }

  const invMap = new Map();
  for (const item of (invItems || []).filter(isStoreCountableItem)) {
    if (item.sku && branchRegisteredSkus.has(item.sku)) {
      invMap.set(item.sku, item);
    }
  }

  for (const item of (branchSimpleItems || []).filter(isStoreCountableItem)) {
    const sku = item.sku || item.item_sku;
    if (sku && !invMap.has(sku)) {
      invMap.set(sku, item);
    }
  }

  for (const r of stockRows) {
    if (r.item_sku && branchRegisteredSkus.has(r.item_sku) && !invMap.has(r.item_sku)) {
      const known = allInvBySku.get(r.item_sku);
      if (known && !isStoreCountableItem(known)) {
        continue;
      }
      const candidate = { item_sku: r.item_sku, store_type: known?.store_type || 'general_store', category: known?.category };
      if (isStoreCountableItem(candidate)) {
        invMap.set(r.item_sku, {
          id: r.item_sku,
          sku: r.item_sku,
          item_name: known?.item_name || r.item_sku,
          unit: known?.unit || 'units',
          category: known?.category || 'GENERAL',
          store_type: known?.store_type || 'general_store',
          quantity: Number(r.quantity || 0)
        });
      }
    }
  }

  console.log(`Total store stocktake items for Branch ${branchId}:`, invMap.size);
  const items = Array.from(invMap.values());
  console.table(items.map(i => ({
    sku: i.sku,
    name: i.item_name,
    category: i.category,
    store_type: i.store_type
  })));
}

testStoreStocktakeEndpoint(3).then(() => testStoreStocktakeEndpoint(2)).then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
