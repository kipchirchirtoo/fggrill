const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/user/OneDrive/Desktop/fggrill/backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testController() {
  const branchId = 3;
  const rawDate = '2026-10-04';

  const { data: branchStoreLoc } = await supabase
    .from('inventory_locations')
    .select('id')
    .eq('branch_id', branchId)
    .eq('location_type', 'branch_store')
    .eq('is_active', true)
    .maybeSingle();

  const branchStoreLocId = branchStoreLoc?.id;

  const [{ data: branchStockRows }, { data: branchSimpleItems }, { data: branchBalances }, { data: invItems }] = await Promise.all([
    supabase.from('branch_stock').select('item_sku, quantity').eq('branch_id', branchId),
    supabase.from('simple_items').select('id, sku, item_sku, item_name, unit, unit_of_measure, category, store_type, quantity, cost_price').eq('branch_id', branchId).eq('is_active', true),
    branchStoreLocId
      ? supabase.from('inventory_balances').select('item_id, current_quantity').eq('location_id', branchStoreLocId)
      : Promise.resolve({ data: [] }),
    supabase.from('inventory_items').select('id, sku, item_name, unit, category, store_type, default_unit_cost').eq('is_active', true)
  ]);

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
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
    const name = String(i.item_name || i.name || '').toUpperCase();
    if (name.includes('BEER') || name.includes('WINE') || name.includes('WHISKY') || name.includes('VODKA') || name.includes('GIN') || name.includes('BRANDY') || name.includes('RUM') || name.includes('TEQUILA') || name.includes('CIDER') || name.includes('TOTS') || name.includes('LIQUEUR')) {
      return false;
    }
    return true;
  };

  const stockRows = branchStockRows || [];
  const stockBySkuMap = new Map();
  for (const r of stockRows) {
    if (r.item_sku) stockBySkuMap.set(r.item_sku, num(r.quantity));
  }

  const branchRegisteredSkus = new Set();
  for (const r of stockRows) {
    if (r.item_sku) branchRegisteredSkus.add(r.item_sku);
  }
  for (const s of (branchSimpleItems || [])) {
    const sku = s.sku || s.item_sku;
    if (sku) {
      branchRegisteredSkus.add(sku);
      if (!stockBySkuMap.has(sku)) stockBySkuMap.set(sku, num(s.quantity));
    }
  }

  const itemIdToSku = new Map();
  for (const item of (invItems || [])) {
    if (item.id && item.sku) itemIdToSku.set(String(item.id), String(item.sku));
  }
  for (const b of (branchBalances || [])) {
    const sku = itemIdToSku.get(String(b.item_id));
    if (sku) {
      branchRegisteredSkus.add(sku);
      if (!stockBySkuMap.has(sku)) stockBySkuMap.set(sku, num(b.current_quantity));
    }
  }

  const invMap = new Map();
  for (const item of (invItems || []).filter(isStoreCountableItem)) {
    if (item.sku && branchRegisteredSkus.has(item.sku)) {
      invMap.set(item.sku, item);
    }
  }

  console.log('Final invMap SKUs:', Array.from(invMap.keys()));
  console.log('InvMap entries:', Array.from(invMap.values()));
}

testController().catch(console.error);
