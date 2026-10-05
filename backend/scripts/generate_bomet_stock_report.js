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
    // basic CSV line parse
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
  console.log('Loading master stock dictionaries...');
  const cleanedFile = fs.readFileSync(path.join(__dirname, 'FGH_Cleaned_Stock_Master.csv'), 'utf-8');
  const cleanedRows = parseCSV(cleanedFile);

  const mappingFile = fs.readFileSync(path.join(__dirname, 'FGH_SKU_Mapping_Corrected.csv'), 'utf-8');
  const mappingRows = parseCSV(mappingFile);

  // Build lookup maps: by new_sku, old_sku, and merged_old_skus
  const skuLookup = new Map();

  // Populate from cleaned master
  for (const r of cleanedRows) {
    const entry = {
      name: r.item_name,
      category: r.category,
      unit: r.unit,
      cost: parseFloat(r.cost) || 0,
      retail: parseFloat(r.retail) || 0,
      store_type: r.store_type
    };
    if (r.new_sku) skuLookup.set(r.new_sku, entry);
    if (r.selected_old_sku) skuLookup.set(r.selected_old_sku, entry);
    if (r.merged_old_skus) {
      r.merged_old_skus.split('|').forEach(s => {
        const trimmed = s.trim();
        if (trimmed && !skuLookup.has(trimmed)) skuLookup.set(trimmed, entry);
      });
    }
  }

  // Supplement from mapping corrected
  for (const r of mappingRows) {
    const entry = {
      name: r.new_item_name || r.old_item_name,
      category: r.new_category || r.old_category,
      unit: r.old_unit,
      cost: parseFloat(r.old_cost) || 0,
      retail: parseFloat(r.new_retail || r.old_retail) || 0
    };
    if (r.old_sku && !skuLookup.has(r.old_sku)) skuLookup.set(r.old_sku, entry);
    if (r.new_sku && !skuLookup.has(r.new_sku)) skuLookup.set(r.new_sku, entry);
  }

  console.log(`Loaded ${skuLookup.size} distinct SKU mappings into lookup.`);

  const client = await pool.connect();
  try {
    console.log('Querying Bomet Town (branch_id = 2)...');

    // 1. branch_stock
    const bsRes = await client.query(`
      SELECT id, branch_id, item_sku, item_name, current_stock, quantity, reorder_level, minimum_stock, unit_cost, updated_at
      FROM branch_stock
      WHERE branch_id = 2
      ORDER BY item_sku
    `);
    console.log(`Fetched ${bsRes.rows.length} rows from branch_stock`);

    // 2. inventory_items
    const iiRes = await client.query(`
      SELECT id, sku, item_name, category, unit, cost_price, retail_price, quantity, reorder_level, is_active, description
      FROM inventory_items
      WHERE branch_id = 2
      ORDER BY category, item_name
    `);
    console.log(`Fetched ${iiRes.rows.length} rows from inventory_items`);

    // 3. bar_stock
    const barRes = await client.query(`
      SELECT id, outlet_id, drink_id, item_sku, item_name, current_stock, par_level, unit, low_stock, updated_at
      FROM bar_stock
      WHERE branch_id = 2
      ORDER BY item_name
    `);
    console.log(`Fetched ${barRes.rows.length} rows from bar_stock`);

    // Loaded 1225 SKU mappings directly from master dictionary

    // Merge & resolve branch_stock items
    let resolvedCount = 0;
    let unresolvedCount = 0;
    const resolvedBS = bsRes.rows.map(b => {
      const match = skuLookup.get(b.item_sku);
      if (match) {
        resolvedCount++;
        return {
          sku: b.item_sku,
          name: match.name || b.item_name,
          category: match.category || 'GENERAL_STORE',
          unit: match.unit || 'pcs',
          current_stock: parseFloat(b.current_stock) || 0,
          store_quantity: parseFloat(b.quantity) || 0,
          reorder_level: parseFloat(b.reorder_level) || 0,
          unit_cost: parseFloat(b.unit_cost) || match.cost || 0,
          retail_price: match.retail || 0
        };
      } else {
        unresolvedCount++;
        return {
          sku: b.item_sku,
          name: b.item_name,
          category: 'UNCATEGORIZED',
          unit: 'pcs',
          current_stock: parseFloat(b.current_stock) || 0,
          store_quantity: parseFloat(b.quantity) || 0,
          reorder_level: parseFloat(b.reorder_level) || 0,
          unit_cost: parseFloat(b.unit_cost) || 0,
          retail_price: 0
        };
      }
    });

    console.log(`branch_stock: resolved = ${resolvedCount}, unresolved = ${unresolvedCount}`);

    // Save full JSON for inspection
    const reportData = {
      branch_id: 2,
      branch_name: 'Bomet Town (BTN)',
      generated_at: new Date().toISOString(),
      summary: {
        total_branch_stock_registered: bsRes.rows.length,
        branch_stock_with_positive_quantity: resolvedBS.filter(r => r.current_stock > 0 || r.store_quantity > 0).length,
        total_inventory_items_registered: iiRes.rows.length,
        total_bar_stock_registered: barRes.rows.length
      },
      branch_stock: resolvedBS,
      inventory_items: iiRes.rows,
      bar_stock: barRes.rows
    };

    fs.writeFileSync(path.join(__dirname, 'bomet_stock_full_report.json'), JSON.stringify(reportData, null, 2));
    console.log('Saved bomet_stock_full_report.json successfully.');

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
