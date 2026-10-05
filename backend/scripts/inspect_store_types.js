const { supabase } = require('../dist/config/database');

async function main() {
  const { data: invItems, error } = await supabase
    .from('inventory_items')
    .select('sku, item_name, category, store_type')
    .ilike('sku', 'FGB-%')
    .limit(20);
  console.log('Sample FGB items in inventory_items:', invItems);

  const { data: branchStock } = await supabase
    .from('branch_stock')
    .select('item_sku, store_type')
    .eq('branch_id', 3)
    .limit(20);
  console.log('Sample branch_stock rows in Kaplong:', branchStock);
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
