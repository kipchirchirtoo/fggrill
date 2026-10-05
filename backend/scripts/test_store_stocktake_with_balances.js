const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/user/OneDrive/Desktop/fggrill/backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const branchId = 3;
  console.log('=== TESTING STORE STOCKTAKE FOR KAPLONG (branch_id = 3) ===');

  // 1. Get branch location
  const { data: loc } = await supabase
    .from('inventory_locations')
    .select('id')
    .eq('branch_id', branchId)
    .eq('location_type', 'branch_store')
    .eq('is_active', true)
    .maybeSingle();

  console.log('Branch Store location for Kaplong:', loc?.id);

  // 2. Balances in this location
  let balanceSkus = [];
  if (loc?.id) {
    const { data: balances } = await supabase
      .from('inventory_balances')
      .select('item_id, current_quantity, item:inventory_items(sku, item_name, category, store_type)')
      .eq('location_id', loc.id);

    console.log('Balances in Branch Store:', balances);
    balanceSkus = (balances || []).map(b => b.item?.sku).filter(Boolean);
  }

  // 3. Branch stock
  const { data: stockRows } = await supabase
    .from('branch_stock')
    .select('item_sku, quantity')
    .eq('branch_id', branchId);

  // 4. Simple items
  const { data: simpleItems } = await supabase
    .from('simple_items')
    .select('sku, item_sku, quantity')
    .eq('branch_id', branchId)
    .eq('is_active', true);

  // Combined branch registered SKUs
  const branchRegisteredSkus = new Set([
    ...(stockRows || []).map(r => r.item_sku).filter(Boolean),
    ...(simpleItems || []).map(s => s.sku || s.item_sku).filter(Boolean),
    ...balanceSkus
  ]);

  console.log('Total registered SKUs in Kaplong:', branchRegisteredSkus.size);
  console.log('Has FGH-DRY-GOODS-037?:', branchRegisteredSkus.has('FGH-DRY-GOODS-037'));
}

test().catch(console.error);
