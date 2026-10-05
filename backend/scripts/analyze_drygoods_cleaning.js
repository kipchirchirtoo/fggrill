const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Parse CSV helper
function parseCSV(content) {
  const lines = content.split('\r\n').join('\n').split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    let inQuotes = false;
    let current = '';
    const cols = [];
    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cols.push(current.trim());
    
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] !== undefined ? cols[idx].replace(/^"|"$/g, '').trim() : '';
    });
    rows.push(obj);
  }
  return rows;
}

async function run() {
  const cleanedFile = fs.readFileSync(path.join(__dirname, 'FGH_Cleaned_Stock_Master.csv'), 'utf-8');
  const cleanedRows = parseCSV(cleanedFile);

  const mappingFile = fs.readFileSync(path.join(__dirname, 'FGH_SKU_Mapping_Corrected.csv'), 'utf-8');
  const mappingRows = parseCSV(mappingFile);

  // Filter master items for DRY GOODS and CLEANING MATERIALS
  const targetCategories = ['DRY GOODS', 'CLEANING MATERIALS'];
  
  const masterItemsMap = new Map();

  for (const r of cleanedRows) {
    const cat = (r.category || '').toUpperCase().trim();
    if (targetCategories.includes(cat)) {
      masterItemsMap.set(r.new_sku, {
        master_sku: r.new_sku,
        name: r.item_name,
        category: cat,
        unit: r.unit,
        cost: parseFloat(r.cost) || 0,
        retail: parseFloat(r.retail) || 0,
        store_type: r.store_type,
        old_sku: r.selected_old_sku,
        merged_old_skus: r.merged_old_skus
      });
    }
  }

  // Also check mappingRows for any extra in these categories
  for (const r of mappingRows) {
    const cat = (r.new_category || r.old_category || '').toUpperCase().trim();
    if (targetCategories.includes(cat) && r.new_sku && !masterItemsMap.has(r.new_sku)) {
      masterItemsMap.set(r.new_sku, {
        master_sku: r.new_sku,
        name: r.new_item_name || r.old_item_name,
        category: cat,
        unit: r.old_unit,
        cost: parseFloat(r.old_cost) || 0,
        retail: parseFloat(r.new_retail || r.old_retail) || 0,
        old_sku: r.old_sku
      });
    }
  }

  console.log(`Master Catalogue has:`);
  console.log(`- DRY GOODS: ${[...masterItemsMap.values()].filter(i => i.category === 'DRY GOODS').length} items`);
  console.log(`- CLEANING MATERIALS: ${[...masterItemsMap.values()].filter(i => i.category === 'CLEANING MATERIALS').length} items`);

  // Now connect to DB and check Bomet Town (branch_id = 2)
  const client = await pool.connect();
  try {
    const bsRes = await client.query(`
      SELECT id, branch_id, item_sku, item_name, current_stock, quantity, reorder_level, minimum_stock, unit_cost, updated_at
      FROM branch_stock
      WHERE branch_id = 2
    `);
    const bometBS = bsRes.rows;
    console.log(`Total Bomet Town branch_stock items: ${bometBS.length}`);

    // Map Bomet items by sku
    const bometMap = new Map();
    for (const b of bometBS) {
      bometMap.set(b.item_sku, b);
    }

    // Also check inventory_items for branch 2
    const iiRes = await client.query(`
      SELECT id, sku, item_name, category, unit, cost_price, retail_price, quantity, is_active
      FROM inventory_items
      WHERE branch_id = 2
    `);
    const bometII = new Map();
    for (const i of iiRes.rows) {
      bometII.set(i.sku, i);
    }

    // Match master items against Bomet Town
    const analysis = [];
    for (const [sku, m] of masterItemsMap.entries()) {
      // Check if sku or old_sku or any merged old skus match Bomet branch_stock
      let bsMatch = bometMap.get(sku);
      if (!bsMatch && m.old_sku) {
        bsMatch = bometMap.get(m.old_sku);
      }
      if (!bsMatch && m.merged_old_skus) {
        const parts = m.merged_old_skus.split('|').map(s => s.trim());
        for (const p of parts) {
          if (bometMap.has(p)) {
            bsMatch = bometMap.get(p);
            break;
          }
        }
      }

      // Check inventory_items
      let iiMatch = bometII.get(sku) || (m.old_sku ? bometII.get(m.old_sku) : null);

      analysis.push({
        master_sku: sku,
        name: m.name,
        category: m.category,
        unit: m.unit,
        master_cost: m.cost,
        master_retail: m.retail,
        registered_in_bomet_store: !!bsMatch,
        bomet_item_sku: bsMatch ? bsMatch.item_sku : null,
        current_stock: bsMatch ? parseFloat(bsMatch.current_stock) || 0 : 0,
        store_quantity: bsMatch ? parseFloat(bsMatch.quantity) || 0 : 0,
        unit_cost: bsMatch ? parseFloat(bsMatch.unit_cost) || m.cost : m.cost,
        registered_in_bomet_pos: !!iiMatch
      });
    }

    console.log(`Analysis complete for ${analysis.length} master items.`);
    
    // Check registration counts
    const dryGoods = analysis.filter(a => a.category === 'DRY GOODS');
    const cleaning = analysis.filter(a => a.category === 'CLEANING MATERIALS');

    console.log(`\nDRY GOODS in Master: ${dryGoods.length}`);
    console.log(`- Registered in Bomet Store: ${dryGoods.filter(d => d.registered_in_bomet_store).length}`);
    console.log(`- With Stock > 0: ${dryGoods.filter(d => d.current_stock > 0 || d.store_quantity > 0).length}`);

    console.log(`\nCLEANING MATERIALS in Master: ${cleaning.length}`);
    console.log(`- Registered in Bomet Store: ${cleaning.filter(c => c.registered_in_bomet_store).length}`);
    console.log(`- With Stock > 0: ${cleaning.filter(c => c.current_stock > 0 || c.store_quantity > 0).length}`);

    // Check if there are items in Bomet branch_stock that are NOT in master list but belong to DRY GOODS / CLEANING
    const masterSkusSet = new Set();
    for (const [sku, m] of masterItemsMap.entries()) {
      masterSkusSet.add(sku);
      if (m.old_sku) masterSkusSet.add(m.old_sku);
      if (m.merged_old_skus) {
        m.merged_old_skus.split('|').forEach(s => masterSkusSet.add(s.trim()));
      }
    }

    fs.writeFileSync(path.join(__dirname, 'bomet_drygoods_cleaning_analysis.json'), JSON.stringify({
      summary: {
        total_master_dry_goods: dryGoods.length,
        bomet_registered_dry_goods: dryGoods.filter(d => d.registered_in_bomet_store).length,
        bomet_active_stock_dry_goods: dryGoods.filter(d => d.current_stock > 0 || d.store_quantity > 0).length,
        total_master_cleaning: cleaning.length,
        bomet_registered_cleaning: cleaning.filter(c => c.registered_in_bomet_store).length,
        bomet_active_stock_cleaning: cleaning.filter(c => c.current_stock > 0 || c.store_quantity > 0).length
      },
      dry_goods: dryGoods,
      cleaning_materials: cleaning
    }, null, 2));

    console.log('Saved bomet_drygoods_cleaning_analysis.json successfully.');

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
