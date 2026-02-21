const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testTrackableItemsLogic() {
  console.log('=== Testing Trackable Items API Logic ===\n');

  const branchId = 2; // KIPKEMOI's branch

  try {
    // Step 1: Get branch stock items
    console.log('1. Fetching branch stock...');
    const { data: branchStock, error: stockError } = await supabase
      .from('branch_stock')
      .select('*')
      .eq('branch_id', branchId)
      .gt('quantity', 0);

    if (stockError) {
      console.error('Error:', stockError);
      return;
    }

    console.log(`Found ${branchStock?.length || 0} items in branch stock`);
    
    if (!branchStock || branchStock.length === 0) {
      console.log('\n⚠️  NO ITEMS IN BRANCH STOCK!');
      console.log('This is why the dropdown is empty.');
      return;
    }

    // Step 2: Get item details
    console.log('\n2. Fetching item details from simple_items...');
    const skus = branchStock.map(s => s.item_sku);
    
    const { data: items, error: itemsError } = await supabase
      .from('simple_items')
      .select('sku, item_name, category, cost_price, retail_price')
      .in('sku', skus);

    if (itemsError) {
      console.error('Error:', itemsError);
      return;
    }

    console.log(`Found ${items?.length || 0} item details`);

    // Step 3: Build the map
    const itemsMap = (items || []).reduce((acc, item) => {
      acc[item.sku] = item;
      return acc;
    }, {});

    // Step 4: Enrich the data (same as controller)
    const enrichedData = branchStock.map(stock => ({
      item_sku: stock.item_sku,
      item_name: itemsMap[stock.item_sku]?.item_name || stock.item_sku,
      quantity: stock.quantity,
      category: itemsMap[stock.item_sku]?.category || 'General',
      unit: stock.unit || 'units',
      cost_price: itemsMap[stock.item_sku]?.cost_price,
      retail_price: itemsMap[stock.item_sku]?.retail_price
    }));

    console.log('\n3. Enriched data (what API should return):');
    console.log(`Total items: ${enrichedData.length}`);
    
    console.log('\nFirst 5 items:');
    enrichedData.slice(0, 5).forEach((item, idx) => {
      console.log(`\n${idx + 1}. ${item.item_name}`);
      console.log(`   SKU: ${item.item_sku}`);
      console.log(`   Quantity: ${item.quantity} ${item.unit}`);
      console.log(`   Category: ${item.category}`);
      console.log(`   Has item_name: ${!!item.item_name}`);
    });

    // Step 5: Check for items without names
    const itemsWithoutNames = enrichedData.filter(item => item.item_name === item.item_sku);
    if (itemsWithoutNames.length > 0) {
      console.log(`\n⚠️  ${itemsWithoutNames.length} items don't have names in simple_items:`);
      itemsWithoutNames.slice(0, 5).forEach(item => {
        console.log(`   - ${item.item_sku} (${item.quantity} ${item.unit})`);
      });
    }

    console.log('\n=== Summary ===');
    console.log(`✓ Branch stock items: ${branchStock.length}`);
    console.log(`✓ Items with names: ${enrichedData.filter(i => i.item_name !== i.item_sku).length}`);
    console.log(`✓ Items without names: ${itemsWithoutNames.length}`);
    console.log(`✓ API should return: ${enrichedData.length} items`);

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testTrackableItemsLogic();
