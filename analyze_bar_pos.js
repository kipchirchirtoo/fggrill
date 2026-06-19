#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Load environment variables
const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeBarPOS() {
  console.log('='.repeat(80));
  console.log('BAR POS OUTLET ANALYSIS - FAMOUSGATE HOTEL SYSTEM');
  console.log('='.repeat(80));

  try {
    // 1. Get all POS outlets (focus on bar outlets)
    console.log('\n1. POS OUTLETS CONFIGURATION');
    console.log('-'.repeat(50));
    const { data: outlets, error: outletsError } = await supabase
      .from('pos_outlets')
      .select('*')
      .order('branch_id, outlet_type');
    
    if (outletsError) throw outletsError;
    
    outlets?.forEach(outlet => {
      console.log(`Branch ${outlet.branch_id}: ${outlet.name} (${outlet.outlet_type}) - Pin: ${outlet.pin_prefix}`);
    });

    // Filter main bar outlets
    const mainBarOutlets = outlets?.filter(o => o.outlet_type === 'main_bar') || [];
    console.log(`\nMain Bar Outlets Found: ${mainBarOutlets.length}`);
    
    // 2. Get POS outlet items for main bar
    console.log('\n2. MAIN BAR POS OUTLET ITEMS');
    console.log('-'.repeat(50));
    
    for (const outlet of mainBarOutlets) {
      console.log(`\nOutlet: ${outlet.name} (Branch ${outlet.branch_id})`);
      
      const { data: items, error: itemsError } = await supabase
        .from('pos_outlet_items')
        .select('*')
        .eq('outlet_id', outlet.id)
        .order('name');
      
      if (itemsError) throw itemsError;
      
      if (items && items.length > 0) {
        console.log(`Items: ${items.length}`);
        items.forEach(item => {
          console.log(`  - ${item.name}: Cost: ${item.cost_price || 'N/A'}, Selling: ${item.selling_price || 'N/A'}, Stock: ${item.current_stock || 'N/A'}`);
        });
      } else {
        console.log('  No items found in this outlet');
      }
    }

    // 3. Get bar drinks catalog
    console.log('\n3. BAR DRINKS CATALOG');
    console.log('-'.repeat(50));
    const { data: barDrinks, error: drinksError } = await supabase
      .from('bar_drinks')
      .select(`
        *,
        category:bar_drink_categories(name)
      `)
      .order('name');
    
    if (drinksError) throw drinksError;
    
    if (barDrinks && barDrinks.length > 0) {
      console.log(`Total Bar Drinks: ${barDrinks.length}`);
      barDrinks.forEach(drink => {
        console.log(`  - ${drink.name} (${drink.category?.name || 'No category'}): Cost: ${drink.cost_price || 'N/A'}, Price: ${drink.price || 'N/A'}`);
      });
    } else {
      console.log('No bar drinks found');
    }

    // 4. Get bar stock/inventory
    console.log('\n4. BAR STOCK INVENTORY');
    console.log('-'.repeat(50));
    const { data: barStock, error: stockError } = await supabase
      .from('bar_stock')
      .select(`
        *,
        drink:bar_drinks(name, price, cost_price)
      `)
      .order('branch_id');
    
    if (stockError) throw stockError;
    
    if (barStock && barStock.length > 0) {
      console.log(`Total Stock Items: ${barStock.length}`);
      barStock.forEach(stock => {
        console.log(`  - Branch ${stock.branch_id}: ${stock.drink?.name || 'Unknown'} - Qty: ${stock.quantity}, Min: ${stock.min_stock}, Cost/Unit: ${stock.cost_per_unit || 'N/A'}`);
      });
    } else {
      console.log('No bar stock found');
    }

    // 5. Get bar drink categories
    console.log('\n5. BAR DRINK CATEGORIES');
    console.log('-'.repeat(50));
    const { data: categories, error: categoriesError } = await supabase
      .from('bar_drink_categories')
      .select('*')
      .order('sort_order');
    
    if (categoriesError) throw categoriesError;
    
    if (categories && categories.length > 0) {
      categories.forEach(cat => {
        console.log(`  - ${cat.name} (Order: ${cat.sort_order})`);
      });
    } else {
      console.log('No categories found');
    }

    // 6. Check if old restaurant_bar_inventory exists
    console.log('\n6. LEGACY BAR INVENTORY (restaurant_bar_inventory)');
    console.log('-'.repeat(50));
    try {
      const { data: legacyInventory, error: legacyError } = await supabase
        .from('restaurant_bar_inventory')
        .select('*')
        .order('name')
        .limit(10);
      
      if (legacyError) {
        console.log('Legacy bar inventory table does not exist or no access');
      } else if (legacyInventory && legacyInventory.length > 0) {
        console.log(`Legacy inventory items found: ${legacyInventory.length} (showing first 10)`);
        legacyInventory.forEach(item => {
          console.log(`  - ${item.name}: Cost: ${item.cost_per_bottle || item.cost_price || 'N/A'}, Price: ${item.price_per_shot || item.selling_price || 'N/A'}`);
        });
      } else {
        console.log('No legacy inventory items');
      }
    } catch (err) {
      console.log('Cannot access restaurant_bar_inventory table');
    }

    // 7. Compare with Excel data structure
    console.log('\n7. EXCEL DATA STRUCTURE ANALYSIS');
    console.log('-'.repeat(50));
    
    const excelItems = [
      { name: 'SODA 500ML', unit_price: 100, buying_price: 50, stock: 87 },
      { name: 'WATER 1L', unit_price: 100, buying_price: 42, stock: 52 },
      { name: 'ALVARO CAN', unit_price: 200, buying_price: 122, stock: 6 },
      { name: 'TUSKER LARGER', unit_price: 250, buying_price: 169, stock: 96 },
      { name: 'GUINESS', unit_price: 300, buying_price: 204, stock: 132 }
      // ... more items
    ];
    
    console.log('Excel contains BOMET TOWN bar items with:');
    console.log('- Item names (e.g., SODA 500ML, TUSKER LARGER, GUINESS)');
    console.log('- Unit price (selling price)');
    console.log('- Buying price (cost price)');
    console.log('- Current stock levels');
    console.log('\nThis data needs to be matched with:');
    console.log('- pos_outlet_items for main bar outlets');
    console.log('- bar_drinks catalog');
    console.log('- bar_stock inventory levels');

  } catch (error) {
    console.error('Error analyzing bar POS:', error.message);
  }
}

// Run the analysis
analyzeBarPOS();