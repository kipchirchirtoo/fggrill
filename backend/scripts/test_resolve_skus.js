const fs = require('fs');
const readline = require('readline');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    // 1. Get all branch_stock items for branch 2
    const bsRes = await client.query(`
      SELECT item_sku, item_name, current_stock, quantity, reorder_level, minimum_stock, unit_cost
      FROM branch_stock
      WHERE branch_id = 2
    `);
    const bsItems = bsRes.rows;
    console.log(`Bomet Town (branch 2) branch_stock total rows: ${bsItems.length}`);

    // Build lookup from FGH_Cleaned_Stock_Master.csv
    const cleanedMaster = {};
    const lines1 = fs.readFileSync('scripts/FGH_Cleaned_Stock_Master.csv', 'utf-8').split('\n');
    for (const l of lines1.slice(1)) {
      if (!l.trim()) continue;
      const parts = l.split(',');
      const newSku = parts[0]?.trim();
      const itemName = parts[1]?.trim();
      const cat = parts[2]?.trim();
      const unit = parts[3]?.trim();
      const cost = parts[4]?.trim();
      const retail = parts[5]?.trim();
      const oldSku = parts[8]?.trim();
      const mergedOld = parts[9]?.trim();

      if (newSku) {
        cleanedMaster[newSku] = { name: itemName, category: cat, unit, cost, retail };
      }
      if (oldSku) {
        cleanedMaster[oldSku] = { name: itemName, category: cat, unit, cost, retail };
      }
      if (mergedOld) {
        mergedOld.split('|').forEach(s => {
          const trimmed = s.trim();
          if (trimmed && !cleanedMaster[trimmed]) {
            cleanedMaster[trimmed] = { name: itemName, category: cat, unit, cost, retail };
          }
        });
      }
    }

    // Build lookup from FGH_SKU_Mapping_Corrected.csv
    const mappingCorrected = {};
    const lines2 = fs.readFileSync('scripts/FGH_SKU_Mapping_Corrected.csv', 'utf-8').split('\n');
    for (const l of lines2.slice(1)) {
      if (!l.trim()) continue;
      const parts = l.split(',');
      const oldSku = parts[0]?.trim();
      const oldName = parts[1]?.trim();
      const oldCat = parts[2]?.trim();
      const newSku = parts[7]?.trim();
      const newName = parts[8]?.trim();
      const newCat = parts[9]?.trim();
      if (oldSku) {
        mappingCorrected[oldSku] = { name: newName || oldName, category: newCat || oldCat };
      }
      if (newSku) {
        mappingCorrected[newSku] = { name: newName || oldName, category: newCat || oldCat };
      }
    }

    // Build lookup from DB
    const dbLookup = {};
    try {
      const kpr = await client.query(`SELECT DISTINCT raw_item_name, produced_item_name FROM kitchen_production_recipes`);
      // check columns of recipes
      const rec = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'recipes'`);
      console.log('recipes columns:', rec.rows.map(r => r.column_name).join(', '));
      const recRows = await client.query(`SELECT * FROM recipes LIMIT 5`);
      console.log('recipes sample:', recRows.rows);
    } catch(e) {
      console.log('recipe query err:', e.message);
    }

    const po = await client.query(`SELECT DISTINCT item_sku, item_name FROM store_purchase_order_items WHERE item_sku IS NOT NULL`);
    po.rows.forEach(r => {
      if (!dbLookup[r.item_sku]) dbLookup[r.item_sku] = { name: r.item_name, category: 'STORE_PURCHASE' };
    });

    const ii = await client.query(`SELECT sku, item_name, category, unit, cost_price, retail_price FROM inventory_items WHERE branch_id = 2`);
    ii.rows.forEach(r => {
      dbLookup[r.sku] = { name: r.item_name, category: r.category, unit: r.unit, cost: r.cost_price, retail: r.retail_price };
    });

    // Check how many bs items can be resolved
    let resolved = 0;
    let unresolved = [];
    for (const b of bsItems) {
      const match = cleanedMaster[b.item_sku] || mappingCorrected[b.item_sku] || dbLookup[b.item_sku];
      if (match) {
        resolved++;
      } else {
        unresolved.push(b.item_sku);
      }
    }

    console.log(`Resolved: ${resolved} / ${bsItems.length}`);
    console.log(`Unresolved count: ${unresolved.length}`);
    if (unresolved.length > 0) {
      console.log('Unresolved samples:', unresolved.slice(0, 30));
    }

  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(console.error);
