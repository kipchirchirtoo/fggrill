require('dotenv').config({ path: './backend/.env' });
const { Client } = require('pg');
const fs = require('fs');

async function restoreSimpleItemsFull() {
  console.log('🔄 RESTORING SIMPLE ITEMS DATA (FULL)\n');
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
    
    // Load inventory data from the user's JSON
    const inventoryData = JSON.parse(fs.readFileSync('/home/allansamuel/Desktop/fggrill/inventory-data.json', 'utf8'));
    
    // Item name corrections
    const nameCorrections = {
      "13KG GAS": "Gas Cylinder 13KG",
      "50KG GAS": "Gas Cylinder 50KG",
      "6KG GAS": "Gas Cylinder 6KG",
      "6KGS": "Gas Cylinder 6KG",
      "DANIA": "Coriander (Dania)",
      "DORMANTS": "Dormants Coffee",
      "DOWNY": "Downy Liquid Soap",
      "EGG YELLOW": "Egg Yellow",
      "EGGS KIENYEJI*": "Eggs Kienyeji",
      "HOHO": "Green Pepper (Hoho)",
      "KAMANDE*": "Kamande (Cereal)",
      "LEMON SQUEEZER": "Lemon Squeezer Tool",
      "COCONUT CREAM": "Coconut Cream",
      "COURGETSY": "Courgettes",
      "CUCUMBERY": "Cucumbers",
      "DHANIAY": "Dhania (Coriander)",
      "KIENYEJI EGGS*": "Kienyeji Eggs",
      "KUKU KIENYEJI*": "Kuku Kienyeji"
    };
    
    // Category corrections
    const categoryCorrections = {
      "COCONUT CREAM": { category: "Food & Beverage", subcategory: "Restaurant Items" },
      "DOWNY": { category: "Housekeeping", subcategory: "Cleaning Supplies" },
      "LEMON SQUEEZER": { category: "Maintenance", subcategory: "Maintenance Supplies" }
    };
    
    // Items to skip (take away soda items with zero price)
    const itemsToSkip = ["SODA CH", "TAKE AWAY SODA"];
    
    let insertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    console.log(`Processing ${inventoryData.inventory.length} items...\n`);
    
    for (const item of inventoryData.inventory) {
      const originalName = item.item_name;
      
      // Skip items with zero price or take away soda
      if (itemsToSkip.includes(originalName) || item.unit_price_kes === 0) {
        skippedCount++;
        continue;
      }
      
      // Apply name correction
      let correctedName = nameCorrections[originalName] || originalName;
      
      // Apply category correction if exists
      let category = item.main_category;
      let subcategory = item.subcategory;
      
      if (categoryCorrections[originalName]) {
        category = categoryCorrections[originalName].category;
        subcategory = categoryCorrections[originalName].subcategory;
      }
      
      // Generate SKU from item name
      const sku = `SIM-${correctedName.substring(0, 8).toUpperCase().replace(/\s+/g, '')}-${item.code}`;
      
      try {
        await client.query(`
          INSERT INTO simple_items (
            sku, item_name, description, retail_price, cost_price, 
            category, unit_of_measure, quantity, reorder_level, 
            is_active, branch_id, last_updated
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, 0, $8, true, $9, NOW()
          )
        `, [
          sku,
          correctedName,
          `${category} - ${subcategory}`,
          item.unit_price_kes,
          item.unit_price_kes * 0.8, // Assuming 20% margin for cost
          subcategory,
          item.reorder_level_unit || 'pcs',
          item.reorder_level_qty || 0,
          branchId
        ]);
        insertedCount++;
        
        if (insertedCount % 50 === 0) {
          console.log(`  Progress: ${insertedCount} items inserted...`);
        }
      } catch (e) {
        console.log(`  ❌ Error inserting ${correctedName}: ${e.message.substring(0, 80)}`);
        errorCount++;
      }
    }
    
    await client.query('COMMIT');
    console.log('\n✅ Transaction committed');
    
    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Inserted: ${insertedCount} records`);
    console.log(`  ⚠️ Skipped: ${skippedCount} records`);
    console.log(`  ❌ Errors: ${errorCount} records`);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ SIMPLE ITEMS RESTORATION COMPLETE!');
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

restoreSimpleItemsFull();
