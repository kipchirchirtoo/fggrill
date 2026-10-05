const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    const kRows = await client.query(`
      SELECT bs.id, bs.item_sku, bs.item_name, bs.current_stock, bs.quantity, bs.unit_cost
      FROM branch_stock bs
      WHERE bs.branch_id = 3
      ORDER BY bs.item_name
    `);

    // Check which ones already exist in inventory_items
    const skus = kRows.rows.map(r => r.item_sku);
    const iiRes = await client.query(`
      SELECT id, sku, item_name, category, store_type, unit
      FROM inventory_items
      WHERE sku = ANY($1)
    `, [skus]);

    const iiBySku = new Map();
    iiRes.rows.forEach(r => iiBySku.set(r.sku, r));

    const missing = [];
    const present = [];

    kRows.rows.forEach(r => {
      if (iiBySku.has(r.item_sku)) {
        present.push({
          sku: r.item_sku,
          name: r.item_name,
          ii_id: iiBySku.get(r.item_sku).id,
          category: iiBySku.get(r.item_sku).category,
          store_type: iiBySku.get(r.item_sku).store_type
        });
      } else {
        missing.push(r);
      }
    });

    console.log(`Present in inventory_items: ${present.length}`);
    console.log(`Missing from inventory_items: ${missing.length}`);
    console.log('\nMissing items:');
    console.table(missing.map(m => ({ sku: m.item_sku, name: m.item_name, cost: m.unit_cost })));

  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(console.error);
