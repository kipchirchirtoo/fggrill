require('dotenv').config({ path: './backend/.env' });
const { Client } = require('pg');

async function restoreMasterData() {
  console.log('🔄 RESTORING MASTER DATA\n');
  console.log('='.repeat(80));
  
  const connectionString = process.env.DATABASE_URL;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    await client.query('BEGIN');
    console.log('✅ Transaction started\n');
    
    // Get branch ID
    const branchResult = await client.query('SELECT id FROM branches LIMIT 1');
    const branchId = branchResult.rows[0]?.id;
    console.log(`Using branch_id: ${branchId}\n`);
    
    // Restore inventory_items
    console.log('Restoring inventory_items...');
    const inventoryItems = [
      { item_code: 'INV-001', name: 'Rice 50kg Bag', category: 'Food & Beverage', subcategory: 'Kitchen Supplies', unit: 'bag', unit_cost: 4500, minimum_stock: 5, maximum_stock: 50 },
      { item_code: 'INV-002', name: 'Cooking Oil 20L', category: 'Food & Beverage', subcategory: 'Kitchen Supplies', unit: 'litre', unit_cost: 3500, minimum_stock: 5, maximum_stock: 50 },
      { item_code: 'INV-003', name: 'Sugar 50kg', category: 'Food & Beverage', subcategory: 'Kitchen Supplies', unit: 'kg', unit_cost: 6000, minimum_stock: 5, maximum_stock: 50 },
      { item_code: 'INV-004', name: 'Wheat Flour 50kg', category: 'Food & Beverage', subcategory: 'Kitchen Supplies', unit: 'kg', unit_cost: 2800, minimum_stock: 5, maximum_stock: 50 },
      { item_code: 'INV-005', name: 'Salt 25kg', category: 'Food & Beverage', subcategory: 'Kitchen Supplies', unit: 'kg', unit_cost: 800, minimum_stock: 5, maximum_stock: 50 },
      { item_code: 'INV-006', name: 'Tomato Paste', category: 'Food & Beverage', subcategory: 'Kitchen Supplies', unit: 'tin', unit_cost: 150, minimum_stock: 20, maximum_stock: 200 },
      { item_code: 'INV-007', name: 'Beef Fresh', category: 'Food & Beverage', subcategory: 'Kitchen Supplies', unit: 'kg', unit_cost: 600, minimum_stock: 10, maximum_stock: 100 },
      { item_code: 'INV-008', name: 'Chicken Whole', category: 'Food & Beverage', subcategory: 'Kitchen Supplies', unit: 'kg', unit_cost: 450, minimum_stock: 10, maximum_stock: 100 },
      { item_code: 'INV-009', name: 'Fish Nile Perch', category: 'Food & Beverage', subcategory: 'Kitchen Supplies', unit: 'kg', unit_cost: 500, minimum_stock: 10, maximum_stock: 100 },
      { item_code: 'INV-010', name: 'Onions 50kg', category: 'Food & Beverage', subcategory: 'Kitchen Supplies', unit: 'kg', unit_cost: 1500, minimum_stock: 5, maximum_stock: 50 },
      { item_code: 'INV-011', name: 'Tomatoes 50kg', category: 'Food & Beverage', subcategory: 'Kitchen Supplies', unit: 'kg', unit_cost: 2000, minimum_stock: 5, maximum_stock: 50 },
      { item_code: 'INV-012', name: 'Potatoes 50kg', category: 'Food & Beverage', subcategory: 'Kitchen Supplies', unit: 'kg', unit_cost: 1800, minimum_stock: 5, maximum_stock: 50 },
      { item_code: 'INV-013', name: 'Carrots 50kg', category: 'Food & Beverage', subcategory: 'Kitchen Supplies', unit: 'kg', unit_cost: 1200, minimum_stock: 5, maximum_stock: 50 },
      { item_code: 'INV-014', name: 'Cabbages 50kg', category: 'Food & Beverage', subcategory: 'Kitchen Supplies', unit: 'kg', unit_cost: 800, minimum_stock: 5, maximum_stock: 50 },
      { item_code: 'INV-015', name: 'Milk 500ml', category: 'Food & Beverage', subcategory: 'Bar Stock-Non-alcoholic', unit: 'carton', unit_cost: 60, minimum_stock: 50, maximum_stock: 500 },
      { item_code: 'INV-016', name: 'Butter 500g', category: 'Food & Beverage', subcategory: 'Kitchen Supplies', unit: 'pack', unit_cost: 400, minimum_stock: 20, maximum_stock: 200 },
      { item_code: 'INV-017', name: 'Cheese 1kg', category: 'Food & Beverage', subcategory: 'Kitchen Supplies', unit: 'kg', unit_cost: 1200, minimum_stock: 10, maximum_stock: 100 },
      { item_code: 'INV-018', name: 'Eggs Tray (30)', category: 'Food & Beverage', subcategory: 'Kitchen Supplies', unit: 'tray', unit_cost: 400, minimum_stock: 20, maximum_stock: 200 },
      { item_code: 'INV-019', name: 'Bread Loaf', category: 'Food & Beverage', subcategory: 'Kitchen Supplies', unit: 'loaf', unit_cost: 60, minimum_stock: 50, maximum_stock: 500 },
      { item_code: 'INV-020', name: 'Maize Flour 2kg', category: 'Food & Beverage', subcategory: 'Kitchen Supplies', unit: 'packet', unit_cost: 120, minimum_stock: 50, maximum_stock: 500 },
    ];
    
    let inventoryCount = 0;
    for (const item of inventoryItems) {
      try {
        await client.query(`
          INSERT INTO inventory_items (item_code, name, category, subcategory, unit, unit_cost, minimum_stock, maximum_stock, reorder_point, is_active, branch_id, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, NOW(), NOW())
        `, [item.item_code, item.name, item.category, item.subcategory, item.unit, item.unit_cost, item.minimum_stock, item.maximum_stock, Math.floor(item.minimum_stock / 2), branchId]);
        inventoryCount++;
      } catch (e) {
        console.log(`  ❌ ${item.name}: ${e.message}`);
      }
    }
    console.log(`  ✅ inventory_items: ${inventoryCount} records inserted\n`);
    
    // Restore sku_registry
    console.log('Restoring sku_registry...');
    const skuItems = [
      { sku: 'SKU-001', barcode: '1001', category_code: 'FOOD', product_code: 'RICE' },
      { sku: 'SKU-002', barcode: '1002', category_code: 'FOOD', product_code: 'OIL' },
      { sku: 'SKU-003', barcode: '1003', category_code: 'FOOD', product_code: 'SUGAR' },
      { sku: 'SKU-004', barcode: '1004', category_code: 'FOOD', product_code: 'FLOUR' },
      { sku: 'SKU-005', barcode: '1005', category_code: 'FOOD', product_code: 'SALT' },
      { sku: 'SKU-006', barcode: '1006', category_code: 'FOOD', product_code: 'TOMATO' },
      { sku: 'SKU-007', barcode: '1007', category_code: 'MEAT', product_code: 'BEEF' },
      { sku: 'SKU-008', barcode: '1008', category_code: 'MEAT', product_code: 'CHICKEN' },
      { sku: 'SKU-009', barcode: '1009', category_code: 'MEAT', product_code: 'FISH' },
      { sku: 'SKU-010', barcode: '1010', category_code: 'VEG', product_code: 'ONION' },
    ];
    
    let skuCount = 0;
    for (const item of skuItems) {
      try {
        await client.query(`
          INSERT INTO sku_registry (sku, barcode, category_code, product_code, is_auto_generated, created_at)
          VALUES ($1, $2, $3, $4, false, NOW())
        `, [item.sku, item.barcode, item.category_code, item.product_code]);
        skuCount++;
      } catch (e) {
        // Skip if already exists
      }
    }
    console.log(`  ✅ sku_registry: ${skuCount} records inserted\n`);
    
    // Restore simple_items
    console.log('Restoring simple_items...');
    const simpleItems = [
      { sku: 'SIM-001', item_name: 'Simple Rice', description: 'Steamed rice', retail_price: 150, cost_price: 100, category: 'Food', unit_of_measure: 'plate', quantity: 100 },
      { sku: 'SIM-002', item_name: 'Simple Chicken', description: 'Grilled chicken', retail_price: 300, cost_price: 200, category: 'Food', unit_of_measure: 'piece', quantity: 50 },
      { sku: 'SIM-003', item_name: 'Simple Beef', description: 'Beef steak', retail_price: 400, cost_price: 280, category: 'Food', unit_of_measure: 'piece', quantity: 40 },
      { sku: 'SIM-004', item_name: 'Simple Fish', description: 'Fish fillet', retail_price: 350, cost_price: 250, category: 'Food', unit_of_measure: 'piece', quantity: 45 },
      { sku: 'SIM-005', item_name: 'Simple Ugali', description: 'Maize meal', retail_price: 50, cost_price: 30, category: 'Food', unit_of_measure: 'plate', quantity: 200 },
      { sku: 'SIM-006', item_name: 'Simple Chapati', description: 'Flatbread', retail_price: 30, cost_price: 20, category: 'Food', unit_of_measure: 'piece', quantity: 300 },
      { sku: 'SIM-007', item_name: 'Simple Tea', description: 'Hot tea', retail_price: 100, cost_price: 50, category: 'Beverages', unit_of_measure: 'cup', quantity: 150 },
      { sku: 'SIM-008', item_name: 'Simple Coffee', description: 'Hot coffee', retail_price: 150, cost_price: 80, category: 'Beverages', unit_of_measure: 'cup', quantity: 100 },
      { sku: 'SIM-009', item_name: 'Simple Soda', description: 'Soft drink', retail_price: 80, cost_price: 50, category: 'Beverages', unit_of_measure: 'bottle', quantity: 200 },
      { sku: 'SIM-010', item_name: 'Simple Water', description: 'Bottled water', retail_price: 50, cost_price: 20, category: 'Beverages', unit_of_measure: 'bottle', quantity: 300 },
    ];
    
    let simpleCount = 0;
    for (const item of simpleItems) {
      try {
        await client.query(`
          INSERT INTO simple_items (sku, item_name, description, retail_price, cost_price, category, unit_of_measure, quantity, is_active, branch_id, last_updated)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, NOW())
        `, [item.sku, item.item_name, item.description, item.retail_price, item.cost_price, item.category, item.unit_of_measure, item.quantity, branchId]);
        simpleCount++;
      } catch (e) {
        // Skip if already exists
      }
    }
    console.log(`  ✅ simple_items: ${simpleCount} records inserted\n`);
    
    // Restore menu_items
    console.log('Restoring menu_items...');
    const menuItems = [
      { name: 'Grilled Chicken', category: 'Main Course', price: 800, description: 'Grilled chicken breast with herbs', preparation_time: 20 },
      { name: 'Beef Steak', category: 'Main Course', price: 1200, description: 'Premium beef steak with sauce', preparation_time: 25 },
      { name: 'Fish Fillet', category: 'Main Course', price: 900, description: 'Fresh fish fillet with vegetables', preparation_time: 20 },
      { name: 'Vegetable Curry', category: 'Main Course', price: 600, description: 'Mixed vegetable curry', preparation_time: 15 },
      { name: 'Chicken Burger', category: 'Fast Food', price: 450, description: 'Chicken burger with fries', preparation_time: 15 },
      { name: 'Beef Burger', category: 'Fast Food', price: 500, description: 'Beef burger with fries', preparation_time: 15 },
      { name: 'Pizza Margherita', category: 'Fast Food', price: 800, description: 'Classic cheese pizza', preparation_time: 20 },
      { name: 'Pizza Pepperoni', category: 'Fast Food', price: 900, description: 'Pizza with pepperoni', preparation_time: 20 },
      { name: 'Caesar Salad', category: 'Salads', price: 400, description: 'Fresh caesar salad', preparation_time: 10 },
      { name: 'Greek Salad', category: 'Salads', price: 450, description: 'Greek salad with feta cheese', preparation_time: 10 },
    ];
    
    let menuCount = 0;
    for (const item of menuItems) {
      try {
        await client.query(`
          INSERT INTO menu_items (name, category, price, description, preparation_time, is_available, branch_id, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, true, $6, NOW(), NOW())
        `, [item.name, item.category, item.price, item.description, item.preparation_time, branchId]);
        menuCount++;
      } catch (e) {
        // Skip if already exists
      }
    }
    console.log(`  ✅ menu_items: ${menuCount} records inserted\n`);
    
    await client.query('COMMIT');
    console.log('✅ Transaction committed');
    
    const totalInserted = inventoryCount + skuCount + simpleCount + menuCount;
    console.log(`\n📊 Total records inserted: ${totalInserted}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ MASTER DATA RESTORATION COMPLETE!');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await client.query('ROLLBACK');
    console.log('✅ Rollback successful');
    process.exit(1);
  } finally {
    await client.end();
  }
}

restoreMasterData();
