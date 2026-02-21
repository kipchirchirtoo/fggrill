const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testStockTakeAPI() {
  console.log('=== Testing Stock Take API ===\n');

  const stockTakeId = '36053b04-1fc4-475f-a286-049fec61ad26';

  try {
    // Test the updated query logic
    console.log('1. Fetching stock take header...');
    const { data: stockTake, error: takeError } = await supabase
      .from('stock_takes')
      .select('*')
      .eq('id', stockTakeId)
      .single();

    if (takeError) {
      console.error('Error fetching stock take:', takeError);
      return;
    }

    console.log('Stock take found:', stockTake);

    // Fetch branch name separately
    if (stockTake.branch_id) {
      console.log('\n2. Fetching branch name...');
      const { data: branch } = await supabase
        .from('branches')
        .select('name')
        .eq('id', stockTake.branch_id)
        .single();
      
      if (branch) {
        stockTake.branch = branch;
        console.log('Branch:', branch);
      }
    }

    console.log('\n3. Fetching stock take items...');
    const { data: items, error: itemsError } = await supabase
      .from('stock_take_items')
      .select('*')
      .eq('stock_take_id', stockTakeId)
      .order('item_sku');

    if (itemsError) {
      console.error('Error fetching items:', itemsError);
      return;
    }

    console.log(`Found ${items?.length || 0} items`);

    // Fetch item names separately
    if (items && items.length > 0) {
      console.log('\n4. Fetching item details...');
      const skus = items.map(i => i.item_sku);
      const { data: inventoryItems } = await supabase
        .from('inventory_items')
        .select('item_code, name, unit')
        .in('item_code', skus);

      console.log(`Found ${inventoryItems?.length || 0} inventory items`);

      const itemsMap = (inventoryItems || []).reduce((acc, item) => {
        acc[item.item_code] = item;
        return acc;
      }, {});

      // Enrich items
      items.forEach(item => {
        const invItem = itemsMap[item.item_sku];
        if (invItem) {
          item.item = {
            name: invItem.name,
            unit: invItem.unit
          };
        }
      });

      console.log('\nFirst enriched item:', items[0]);
    }

    console.log('\n=== API Response Structure ===');
    const response = {
      success: true,
      data: { ...stockTake, items }
    };
    console.log(JSON.stringify(response, null, 2));

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testStockTakeAPI();
