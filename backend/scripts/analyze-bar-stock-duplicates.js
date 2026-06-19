const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_NEW;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL or DATABASE_URL_NEW not found in .env');
  process.exit(1);
}

console.log('🔗 Connecting to database...');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Bar stock data from the migration script
const SCRIPT_BAR_ITEMS = [
  // WINES
  { sku: 'FGH-BAR-WINE-001', name: 'Cellar Cask', category: 'Wines', quantity: 6 },
  { sku: 'FGH-BAR-WINE-002', name: 'Heineken', category: 'Wines', quantity: 15 },
  { sku: 'FGH-BAR-WINE-003', name: '4th Street', category: 'Wines', quantity: 5 },
  { sku: 'FGH-BAR-WINE-004', name: 'Casabuena', category: 'Wines', quantity: 8 },
  { sku: 'FGH-BAR-WINE-005', name: 'Caprice', category: 'Wines', quantity: 5 },
  { sku: 'FGH-BAR-WINE-006', name: 'Four Cousins', category: 'Wines', quantity: 62 },
  { sku: 'FGH-BAR-WINE-007', name: 'Kingfisher', category: 'Wines', quantity: 1 },
  { sku: 'FGH-BAR-WINE-008', name: 'Amarula 1/2', category: 'Wines', quantity: 1 },
  { sku: 'FGH-BAR-WINE-009', name: 'Amarula 3/4', category: 'Wines', quantity: 5 },
  { sku: 'FGH-BAR-WINE-010', name: 'Baileys 1/2', category: 'Wines', quantity: 4 },
  { sku: 'FGH-BAR-WINE-011', name: 'Baileys 3/4', category: 'Wines', quantity: 2 },
  { sku: 'FGH-BAR-WINE-012', name: 'Asconi', category: 'Wines', quantity: 5 },
  { sku: 'FGH-BAR-WINE-013', name: 'Drotdy', category: 'Wines', quantity: 4 },
  { sku: 'FGH-BAR-WINE-014', name: 'Robertson', category: 'Wines', quantity: 2 },
  // COGNAC
  { sku: 'FGH-BAR-COG-001', name: 'Hennesy 750ml', category: 'Cognac', quantity: 2 },
  { sku: 'FGH-BAR-COG-002', name: 'Double Black 1L', category: 'Cognac', quantity: 2 },
  { sku: 'FGH-BAR-COG-003', name: 'Martel VS', category: 'Cognac', quantity: 2 },
  { sku: 'FGH-BAR-COG-004', name: 'Martel VSOP', category: 'Cognac', quantity: 1 },
  { sku: 'FGH-BAR-COG-005', name: 'Singletone 12yrs', category: 'Cognac', quantity: 2 },
  // ENERGY DRINKS
  { sku: 'FGH-BAR-ENG-001', name: 'Redbull', category: 'Energy Drinks', quantity: 16 },
  { sku: 'FGH-BAR-ENG-002', name: 'Monster', category: 'Energy Drinks', quantity: 12 },
  // OTHERS
  { sku: 'FGH-BAR-OTH-001', name: 'Camino', category: 'Others', quantity: 2 },
  { sku: 'FGH-BAR-OTH-002', name: 'Jagermeister', category: 'Others', quantity: 2 },
  { sku: 'FGH-BAR-OTH-003', name: 'Bullet Bourbon', category: 'Others', quantity: 1 },
  { sku: 'FGH-BAR-OTH-004', name: 'Trust Classic', category: 'Others', quantity: 19 },
  { sku: 'FGH-BAR-OTH-005', name: 'Trust Studded', category: 'Others', quantity: 15 },
  { sku: 'FGH-BAR-OTH-006', name: 'Pool Tokens', category: 'Others', quantity: 87 },
  // SOFT DRINKS
  { sku: 'FGH-BAR-SFT-001', name: 'Soda 500ml', category: 'Soft Drinks', quantity: 87 },
  { sku: 'FGH-BAR-SFT-002', name: 'H2O 1L', category: 'Soft Drinks', quantity: 52 },
  { sku: 'FGH-BAR-SFT-003', name: 'Alvaro Can', category: 'Soft Drinks', quantity: 6 },
  { sku: 'FGH-BAR-SFT-004', name: 'Delmonte', category: 'Soft Drinks', quantity: 14 },
  { sku: 'FGH-BAR-SFT-005', name: 'Lemonade', category: 'Soft Drinks', quantity: 0 },
  // BEERS
  { sku: 'FGH-BAR-BEER-001', name: 'T. Larger', category: 'Beers', quantity: 96 },
  { sku: 'FGH-BAR-BEER-002', name: 'T. Cider', category: 'Beers', quantity: 54 },
  { sku: 'FGH-BAR-BEER-003', name: 'T. Lite', category: 'Beers', quantity: 40 },
  { sku: 'FGH-BAR-BEER-004', name: 'T. Malt', category: 'Beers', quantity: 44 },
  { sku: 'FGH-BAR-BEER-005', name: 'Guiness', category: 'Beers', quantity: 132 },
  { sku: 'FGH-BAR-BEER-006', name: 'Balozi', category: 'Beers', quantity: 46 },
  { sku: 'FGH-BAR-BEER-007', name: 'Black Ice', category: 'Beers', quantity: 67 },
  { sku: 'FGH-BAR-BEER-008', name: 'Snapp', category: 'Beers', quantity: 33 },
  { sku: 'FGH-BAR-BEER-009', name: 'Plisner', category: 'Beers', quantity: 57 },
  { sku: 'FGH-BAR-BEER-010', name: 'Manyatta', category: 'Beers', quantity: 53 },
  { sku: 'FGH-BAR-BEER-011', name: 'Desparado', category: 'Beers', quantity: 10 },
  { sku: 'FGH-BAR-BEER-012', name: 'Hunters Beer', category: 'Beers', quantity: 2 },
  { sku: 'FGH-BAR-BEER-013', name: 'White Cap', category: 'Beers', quantity: 100 },
  // CANNED BEERS
  { sku: 'FGH-BAR-CAN-001', name: 'Guiness Can', category: 'Canned Beers', quantity: 27 },
  { sku: 'FGH-BAR-CAN-002', name: 'T. Can', category: 'Canned Beers', quantity: 14 },
  { sku: 'FGH-BAR-CAN-003', name: 'W.Cap Can', category: 'Canned Beers', quantity: 22 },
  { sku: 'FGH-BAR-CAN-004', name: 'Black Ice Can', category: 'Canned Beers', quantity: 14 },
  { sku: 'FGH-BAR-CAN-005', name: 'Guarana', category: 'Canned Beers', quantity: 125 },
  { sku: 'FGH-BAR-CAN-006', name: 'T.Lite Can', category: 'Canned Beers', quantity: 20 },
  { sku: 'FGH-BAR-CAN-007', name: 'T.Cider Can', category: 'Canned Beers', quantity: 22 },
  { sku: 'FGH-BAR-CAN-008', name: 'Manyatta Can', category: 'Canned Beers', quantity: 10 },
  { sku: 'FGH-BAR-CAN-009', name: 'Snapp Can', category: 'Canned Beers', quantity: 14 },
  { sku: 'FGH-BAR-CAN-010', name: 'Quarana Punch', category: 'Canned Beers', quantity: 15 },
  { sku: 'FGH-BAR-CAN-011', name: 'S/Raspberry Twist', category: 'Canned Beers', quantity: 0 },
  { sku: 'FGH-BAR-CAN-012', name: 'Gordons Can', category: 'Canned Beers', quantity: 8 },
  { sku: 'FGH-BAR-CAN-013', name: 'Faxe Can', category: 'Canned Beers', quantity: 13 },
  { sku: 'FGH-BAR-CAN-014', name: 'Balozi Can', category: 'Canned Beers', quantity: 10 },
  // SPIRITS
  { sku: 'FGH-BAR-SPI-001', name: 'KC 1/4', category: 'Spirits', quantity: 9 },
  { sku: 'FGH-BAR-SPI-002', name: 'KC 1/2', category: 'Spirits', quantity: 8 },
  { sku: 'FGH-BAR-SPI-003', name: 'KC 3/4', category: 'Spirits', quantity: 15 },
  { sku: 'FGH-BAR-SPI-004', name: 'Vodka 1/4', category: 'Spirits', quantity: 4 },
  { sku: 'FGH-BAR-SPI-005', name: 'Vodka 1/2', category: 'Spirits', quantity: 7 },
  { sku: 'FGH-BAR-SPI-006', name: 'Vodka 3/4', category: 'Spirits', quantity: 7 },
  { sku: 'FGH-BAR-SPI-007', name: 'Richot 1/4', category: 'Spirits', quantity: 21 },
  { sku: 'FGH-BAR-SPI-008', name: 'Richot 1/2', category: 'Spirits', quantity: 13 },
  { sku: 'FGH-BAR-SPI-009', name: 'Richot 3/4', category: 'Spirits', quantity: 22 },
  { sku: 'FGH-BAR-SPI-010', name: 'Gilbeys 1/4', category: 'Spirits', quantity: 22 },
  { sku: 'FGH-BAR-SPI-011', name: 'Gilbeys 1/2', category: 'Spirits', quantity: 20 },
  { sku: 'FGH-BAR-SPI-012', name: 'Gilbeys 3/4', category: 'Spirits', quantity: 19 },
  { sku: 'FGH-BAR-SPI-013', name: 'Viceroy 1/4', category: 'Spirits', quantity: 18 },
  { sku: 'FGH-BAR-SPI-014', name: 'Viceroy 1/2', category: 'Spirits', quantity: 17 },
  { sku: 'FGH-BAR-SPI-015', name: 'Viceroy 3/4', category: 'Spirits', quantity: 23 },
  // WHISKY
  { sku: 'FGH-BAR-WHK-001', name: 'B/Whisky 3/4', category: 'Whisky', quantity: 7 },
  { sku: 'FGH-BAR-WHK-002', name: 'B/Cream 750ml', category: 'Whisky', quantity: 2 },
  { sku: 'FGH-BAR-WHK-003', name: 'All Seasons 3/4', category: 'Whisky', quantity: 5 },
  { sku: 'FGH-BAR-WHK-004', name: 'Vat 69 1/2', category: 'Whisky', quantity: 5 },
  { sku: 'FGH-BAR-WHK-005', name: 'Vat 69 3/4', category: 'Whisky', quantity: 7 },
  { sku: 'FGH-BAR-WHK-006', name: 'Bond 7 1/4', category: 'Whisky', quantity: 12 },
  { sku: 'FGH-BAR-WHK-007', name: 'Bond 7 1/2', category: 'Whisky', quantity: 10 },
  { sku: 'FGH-BAR-WHK-008', name: 'Bond 7 3/4', category: 'Whisky', quantity: 6 },
  { sku: 'FGH-BAR-WHK-009', name: 'Grants 3/4', category: 'Whisky', quantity: 5 },
  { sku: 'FGH-BAR-WHK-010', name: 'Grants 1L', category: 'Whisky', quantity: 5 },
  { sku: 'FGH-BAR-WHK-011', name: 'Red Label 1/4', category: 'Whisky', quantity: 1 },
  { sku: 'FGH-BAR-WHK-012', name: 'Red Label 1/2', category: 'Whisky', quantity: 5 },
  { sku: 'FGH-BAR-WHK-013', name: 'Red Label 3/4', category: 'Whisky', quantity: 0 },
  { sku: 'FGH-BAR-WHK-014', name: 'Red Label 1L', category: 'Whisky', quantity: 10 },
  { sku: 'FGH-BAR-WHK-015', name: 'Black Label 1/2', category: 'Whisky', quantity: 4 },
  { sku: 'FGH-BAR-WHK-016', name: 'Black Label 3/4', category: 'Whisky', quantity: 5 },
  { sku: 'FGH-BAR-WHK-017', name: 'Black Label 1L', category: 'Whisky', quantity: 6 },
  { sku: 'FGH-BAR-WHK-018', name: 'JW Blonde', category: 'Whisky', quantity: 2 },
  { sku: 'FGH-BAR-WHK-019', name: 'Hunters 3/4', category: 'Whisky', quantity: 8 },
  { sku: 'FGH-BAR-WHK-020', name: 'Hunters 1/4', category: 'Whisky', quantity: 9 },
  { sku: 'FGH-BAR-WHK-021', name: 'Hunters 1/2', category: 'Whisky', quantity: 10 },
  { sku: 'FGH-BAR-WHK-022', name: 'Black&White 1/2', category: 'Whisky', quantity: 7 },
  { sku: 'FGH-BAR-WHK-023', name: 'Black &White 3/4', category: 'Whisky', quantity: 0 },
  { sku: 'FGH-BAR-WHK-024', name: 'Savanna', category: 'Whisky', quantity: 11 },
  { sku: 'FGH-BAR-WHK-025', name: 'Tang 10', category: 'Whisky', quantity: 1 },
  { sku: 'FGH-BAR-WHK-026', name: 'Gordons 1/2', category: 'Whisky', quantity: 2 },
  { sku: 'FGH-BAR-WHK-027', name: 'JD 3/4', category: 'Whisky', quantity: 3 },
  { sku: 'FGH-BAR-WHK-028', name: 'JD 1L', category: 'Whisky', quantity: 1 },
  { sku: 'FGH-BAR-WHK-029', name: 'JD 1/2', category: 'Whisky', quantity: 2 },
  { sku: 'FGH-BAR-WHK-030', name: 'Jameson 1L', category: 'Whisky', quantity: 2 },
  { sku: 'FGH-BAR-WHK-031', name: 'Jameson 3/4', category: 'Whisky', quantity: 2 },
  { sku: 'FGH-BAR-WHK-032', name: 'Jameson 1/2', category: 'Whisky', quantity: 2 },
  { sku: 'FGH-BAR-WHK-033', name: 'C/Morgan 1/4', category: 'Whisky', quantity: 6 },
  { sku: 'FGH-BAR-WHK-034', name: 'C/Morgan 3/4', category: 'Whisky', quantity: 14 },
  { sku: 'FGH-BAR-WHK-035', name: 'C/Morgan 3/4 Melon', category: 'Whisky', quantity: 6 },
  { sku: 'FGH-BAR-WHK-036', name: 'Famous Grouse', category: 'Whisky', quantity: 3 },
  { sku: 'FGH-BAR-WHK-037', name: 'William Lawsons 1/2', category: 'Whisky', quantity: 0 },
  { sku: 'FGH-BAR-WHK-038', name: 'William Lawsons 3/4', category: 'Whisky', quantity: 2 },
  { sku: 'FGH-BAR-WHK-039', name: 'William Lawsons 1ltr', category: 'Whisky', quantity: 2 },
  { sku: 'FGH-BAR-WHK-040', name: 'V&A 1/4', category: 'Whisky', quantity: 6 },
  { sku: 'FGH-BAR-WHK-041', name: 'V&A 3/4', category: 'Whisky', quantity: 4 },
  { sku: 'FGH-BAR-WHK-042', name: 'Gordons 3/4', category: 'Whisky', quantity: 3 }
];

async function analyzeDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('\n📊 ANALYZING DATABASE FOR BAR STOCK DUPLICATES\n');
    console.log('=' .repeat(80));

    // 1. Fetch existing bar items from simple_items
    console.log('\n1️⃣ Fetching existing bar items from simple_items...');
    const existingItemsResult = await client.query(`
      SELECT sku, item_name, category, store_type, quantity 
      FROM simple_items 
      WHERE store_type = 'bar_store' OR sku LIKE 'FGH-BAR-%'
      ORDER BY sku
    `);
    
    const existingItems = existingItemsResult.rows;
    console.log(`   Found ${existingItems.length} existing bar items in simple_items`);

    // 2. Fetch existing branch_stock for branch 2
    console.log('\n2️⃣ Fetching existing branch_stock for branch 2 (Bomet Town)...');
    const branchStockResult = await client.query(`
      SELECT branch_id, item_sku, quantity, reorder_level, max_stock_level 
      FROM branch_stock 
      WHERE branch_id = 2
      ORDER BY item_sku
    `);
    
    const branchStock = branchStockResult.rows;
    console.log(`   Found ${branchStock.length} existing stock records for branch 2`);

    // 3. Fetch POS outlets for branch 2
    console.log('\n3️⃣ Fetching POS outlets for branch 2...');
    const posOutletsResult = await client.query(`
      SELECT id, branch_id, outlet_type, name, pin_prefix, is_active 
      FROM pos_outlets 
      WHERE branch_id = 2
      ORDER BY outlet_type, name
    `);
    
    const posOutlets = posOutletsResult.rows;
    console.log(`   Found ${posOutlets.length} POS outlets for branch 2`);
    
    // Find main bar outlet
    const mainBarOutlet = posOutlets.find(o => 
      (o.outlet_type === 'bar' || o.outlet_type === 'main_bar') && 
      (o.name.toLowerCase().includes('main') || o.name.toLowerCase().includes('bar'))
    );
    
    if (mainBarOutlet) {
      console.log(`   ✅ Main Bar Outlet found: ${mainBarOutlet.name} (ID: ${mainBarOutlet.id})`);
    } else {
      console.log(`   ⚠️  No Main Bar Outlet found for branch 2`);
    }

    // 4. Compare script data with existing data
    console.log('\n4️⃣ Comparing script data with existing database...');
    
    const scriptSkus = new Set(SCRIPT_BAR_ITEMS.map(item => item.sku));
    const existingSkus = new Set(existingItems.map(item => item.sku));
    
    // Find duplicates (SKUs that exist in both)
    const duplicateSkus = [...scriptSkus].filter(sku => existingSkus.has(sku));
    console.log(`   🔍 Found ${duplicateSkus.length} duplicate SKUs`);
    
    if (duplicateSkus.length > 0) {
      console.log('\n   Duplicate SKUs:');
      duplicateSkus.forEach(sku => {
        const scriptItem = SCRIPT_BAR_ITEMS.find(i => i.sku === sku);
        const existingItem = existingItems.find(i => i.sku === sku);
        console.log(`      ${sku}: Script qty=${scriptItem.quantity}, DB qty=${existingItem.quantity}, DB name="${existingItem.item_name}"`);
      });
    }

    // Find new items (in script but not in DB)
    const newSkus = [...scriptSkus].filter(sku => !existingSkus.has(sku));
    console.log(`   ➕ Found ${newSkus.length} new items to add`);
    
    if (newSkus.length > 0) {
      console.log('\n   New items to add:');
      newSkus.forEach(sku => {
        const scriptItem = SCRIPT_BAR_ITEMS.find(i => i.sku === sku);
        console.log(`      ${sku}: ${scriptItem.name} (qty=${scriptItem.quantity})`);
      });
    }

    // Check branch_stock for duplicates
    const branchStockSkus = new Set(branchStock.map(item => item.item_sku));
    const branchStockDuplicates = [...scriptSkus].filter(sku => branchStockSkus.has(sku));
    console.log(`   📦 Found ${branchStockDuplicates.length} items already in branch_stock for branch 2`);

    // 5. Generate summary report
    console.log('\n' + '='.repeat(80));
    console.log('📋 SUMMARY REPORT');
    console.log('='.repeat(80));
    console.log(`Total items in script: ${SCRIPT_BAR_ITEMS.length}`);
    console.log(`Existing bar items in DB: ${existingItems.length}`);
    console.log(`Duplicate SKUs: ${duplicateSkus.length}`);
    console.log(`New items to add: ${newSkus.length}`);
    console.log(`Existing branch_stock for branch 2: ${branchStock.length}`);
    console.log(`Main Bar Outlet ID: ${mainBarOutlet ? mainBarOutlet.id : 'NOT FOUND'}`);
    
    // Save analysis to JSON file
    const analysisData = {
      timestamp: new Date().toISOString(),
      scriptItems: SCRIPT_BAR_ITEMS,
      existingItems: existingItems,
      branchStock: branchStock,
      posOutlets: posOutlets,
      mainBarOutlet: mainBarOutlet || null,
      duplicateSkus: duplicateSkus,
      newSkus: newSkus,
      branchStockDuplicates: branchStockDuplicates
    };
    
    const outputPath = path.join(__dirname, 'bar-stock-analysis.json');
    fs.writeFileSync(outputPath, JSON.stringify(analysisData, null, 2));
    console.log(`\n💾 Analysis saved to: ${outputPath}`);

    // 6. Generate updated migration script
    console.log('\n5️⃣ Generating updated migration script...');
    const updatedScript = generateUpdatedMigrationScript(analysisData);
    
    const scriptPath = path.join(__dirname, '../../database/migrations/20260619_branch_2_bomet_bar_initial_stock.sql');
    fs.writeFileSync(scriptPath, updatedScript);
    console.log(`✅ Updated migration script saved to: ${scriptPath}`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ ANALYSIS COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error during analysis:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function generateUpdatedMigrationScript(data) {
  const { scriptItems, existingItems, branchStock, mainBarOutlet, duplicateSkus, newSkus } = data;
  
  let script = `-- Initial Bar Stock for Branch 2 (Bomet Town)
-- This script sets up the opening stock for the bar POS outlet at Bomet Town branch
-- Categories: WINES, COGNAC, ENERGY DRINKS, OTHERS, SOFT DRINKS, BEERS, CANNED BEERS, SPIRITS, WHISKY
-- Generated: ${new Date().toISOString()}
-- Analysis: ${scriptItems.length} total items, ${newSkus.length} new, ${duplicateSkus.length} duplicates

BEGIN;

-- Set the branch ID for Bomet Town (Branch 2)
DO $$
DECLARE
  v_branch_id INTEGER := 2;
  v_reference TEXT := 'STKIN-BOMET-20260619';
  v_created_at TIMESTAMPTZ := NOW();
  v_main_bar_outlet_id UUID := ${mainBarOutlet ? `'${mainBarOutlet.id}'::uuid` : 'NULL'};
BEGIN

  RAISE NOTICE 'Branch ID: %', v_branch_id;
  RAISE NOTICE 'Reference: %', v_reference;
  RAISE NOTICE 'Main Bar Outlet ID: %', v_main_bar_outlet_id;

`;

  // Only insert new items (not duplicates)
  const newItems = scriptItems.filter(item => newSkus.includes(item.sku));
  
  if (newItems.length > 0) {
    script += `  -- ============================================
  -- INSERT NEW ITEMS (skipping ${duplicateSkus.length} existing duplicates)
  -- ============================================
  
`;
    
    // Group by category
    const categories = [...new Set(newItems.map(item => item.category))];
    
    categories.forEach(category => {
      const categoryItems = newItems.filter(item => item.category === category);
      
      script += `  -- ${category.toUpperCase()}\n  INSERT INTO simple_items (sku, item_name, category, store_type, quantity, unit, updated_at) VALUES\n`;
      
      categoryItems.forEach((item, index) => {
        const unit = item.category === 'Canned Beers' || item.category === 'Energy Drinks' ? 'cans' : 
                     item.name === 'Pool Tokens' ? 'tokens' : 'bottles';
        const isLast = index === categoryItems.length - 1;
        script += `    ('${item.sku}', '${item.name}', '${item.category}', 'bar_store', ${item.quantity}, '${unit}', v_created_at)${isLast ? ';' : ','}\n`;
      });
      
      script += `  ON CONFLICT (sku) DO UPDATE SET
    quantity = EXCLUDED.quantity,
    updated_at = v_created_at;

`;
    });
  } else {
    script += `  -- No new items to add (all ${scriptItems.length} items already exist in database)\n\n`;
  }

  // Update branch_stock for all items (both new and existing)
  script += `  -- ============================================
  -- Set up branch_stock for Branch 2 (Bomet Town)
  -- This will update existing records and insert new ones
  -- ============================================
  
  INSERT INTO branch_stock (branch_id, item_sku, quantity, reorder_level, max_stock_level, last_stock_in, updated_at)
  SELECT 
    v_branch_id,
    sku,
    quantity,
    CASE 
      WHEN quantity <= 5 THEN 5
      WHEN quantity <= 10 THEN 10
      ELSE 20
    END as reorder_level,
    CASE 
      WHEN quantity <= 10 THEN 20
      WHEN quantity <= 50 THEN 50
      ELSE 100
    END as max_stock_level,
    v_created_at as last_stock_in,
    v_created_at as updated_at
  FROM simple_items
  WHERE store_type = 'bar_store'
    AND sku LIKE 'FGH-BAR-%'
  ON CONFLICT (branch_id, item_sku) DO UPDATE SET
    quantity = EXCLUDED.quantity,
    reorder_level = EXCLUDED.reorder_level,
    max_stock_level = EXCLUDED.max_stock_level,
    last_stock_in = EXCLUDED.last_stock_in,
    updated_at = EXCLUDED.updated_at;

`;

  // Link to POS outlet if available
  if (mainBarOutlet) {
    script += `  -- ============================================
  -- Link items to Main Bar POS Outlet
  -- ============================================
  
  -- First, ensure outlet items exist for the main bar outlet
  INSERT INTO pos_outlet_items (outlet_id, item_name, category, cost_price, selling_price, is_active, updated_at)
  SELECT 
    v_main_bar_outlet_id,
    si.item_name,
    si.category,
    0.00 as cost_price,
    0.00 as selling_price,
    TRUE as is_active,
    v_created_at as updated_at
  FROM simple_items si
  WHERE si.store_type = 'bar_store'
    AND si.sku LIKE 'FGH-BAR-%'
    AND NOT EXISTS (
      SELECT 1 FROM pos_outlet_items poi 
      WHERE poi.outlet_id = v_main_bar_outlet_id 
        AND poi.item_name = si.item_name
    )
  ON CONFLICT (outlet_id, item_name) DO NOTHING;

  -- Create inventory mappings
  INSERT INTO pos_inventory_mappings (branch_id, outlet_id, outlet_item_id, item_sku, quantity_per_sale, is_active, created_at, updated_at)
  SELECT 
    v_branch_id,
    v_main_bar_outlet_id,
    poi.id as outlet_item_id,
    si.sku as item_sku,
    1.0 as quantity_per_sale,
    TRUE as is_active,
    v_created_at as created_at,
    v_created_at as updated_at
  FROM simple_items si
  JOIN pos_outlet_items poi ON poi.item_name = si.item_name AND poi.outlet_id = v_main_bar_outlet_id
  WHERE si.store_type = 'bar_store'
    AND si.sku LIKE 'FGH-BAR-%'
    AND NOT EXISTS (
      SELECT 1 FROM pos_inventory_mappings pim 
      WHERE pim.outlet_id = v_main_bar_outlet_id 
        AND pim.item_sku = si.sku
    )
  ON CONFLICT (outlet_item_id, item_sku) DO NOTHING;

`;
  }

  // Record stock history
  script += `  -- ============================================
  -- Record stock history for initial stock
  -- ============================================
  
  INSERT INTO stock_history (item_sku, quantity, reason, reference, created_at)
  SELECT 
    sku,
    quantity,
    'INITIAL_STOCK',
    v_reference,
    v_created_at
  FROM simple_items
  WHERE store_type = 'bar_store'
    AND sku LIKE 'FGH-BAR-%'
    AND quantity > 0
    AND NOT EXISTS (
      SELECT 1 FROM stock_history sh 
      WHERE sh.item_sku = simple_items.sku 
        AND sh.reason = 'INITIAL_STOCK' 
        AND sh.reference = v_reference
    );

  RAISE NOTICE 'Initial bar stock for Branch 2 (Bomet Town) has been set up successfully';
  RAISE NOTICE 'Total items processed: %', (SELECT COUNT(*) FROM simple_items WHERE store_type = 'bar_store' AND sku LIKE 'FGH-BAR-%');
  RAISE NOTICE 'New items added: %', ${newItems.length};
  RAISE NOTICE 'Existing items updated: %', ${duplicateSkus.length};

END $$;

COMMIT;

-- Documentation
COMMENT ON MIGRATION IS 'Initial bar stock setup for Branch 2 (Bomet Town). 
This migration creates bar inventory items across 9 categories (Wines, Cognac, Energy Drinks, Others, Soft Drinks, Beers, Canned Beers, Spirits, Whisky) 
with opening stock quantities. Items are tagged with store_type=bar_store and SKU prefix FGH-BAR-. 
Stock is recorded in simple_items, branch_stock (for branch 2), and stock_history with reason=INITIAL_STOCK.
${mainBarOutlet ? `Items are linked to Main Bar POS Outlet (ID: ${mainBarOutlet.id}).` : 'No Main Bar POS Outlet found - items not linked to POS.'}
Analysis: ${scriptItems.length} total items, ${newItems.length} new items added, ${duplicateSkus.length} existing items updated.';
`;

  return script;
}

// Run the analysis
analyzeDatabase().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
