const { supabase } = require('../dist/config/database');

async function testBranchRegisteredSkus(branchId) {
  const [{ data: stockRows }, { data: simpleItems }, { data: movements }] = await Promise.all([
    supabase.from('branch_stock').select('item_sku, quantity').eq('branch_id', branchId),
    supabase.from('simple_items').select('sku, item_sku').eq('branch_id', branchId).eq('is_active', true),
    supabase.from('branch_stock_movements').select('item_sku').eq('branch_id', branchId).limit(500)
  ]);

  const registeredSkus = new Set();
  (stockRows || []).forEach(r => { if (r.item_sku) registeredSkus.add(r.item_sku); });
  (simpleItems || []).forEach(r => {
    const s = r.sku || r.item_sku;
    if (s) registeredSkus.add(s);
  });
  (movements || []).forEach(m => {
    if (m.item_sku) registeredSkus.add(m.item_sku);
  });

  console.log(`Branch ${branchId} total registered SKUs:`, registeredSkus.size);

  const { data: invItems } = await supabase
    .from('inventory_items')
    .select('id, sku, item_name, unit, category, store_type')
    .eq('is_active', true);

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

  const storeCountableRegistered = (invItems || [])
    .filter(isStoreCountableItem)
    .filter(i => registeredSkus.has(i.sku));

  console.log(`Store-countable items registered to Branch ${branchId}:`, storeCountableRegistered.length);
  console.table(storeCountableRegistered.map(i => ({
    sku: i.sku,
    name: i.item_name,
    category: i.category,
    store_type: i.store_type
  })));
}

testBranchRegisteredSkus(3).then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
