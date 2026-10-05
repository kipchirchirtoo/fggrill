const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    const kRows = await client.query('SELECT item_sku, item_name, unit_cost FROM branch_stock WHERE branch_id = 3');
    const iiRes = await client.query('SELECT sku, item_name, category FROM inventory_items');
    const iiMap = new Map();
    iiRes.rows.forEach(r => iiMap.set(r.sku, r));

    const notInII = kRows.rows.filter(r => !iiMap.has(r.item_sku));
    console.log(`Still not in inventory_items: ${notInII.length}`);
    console.table(notInII.map(r => ({ sku: r.item_sku, name: r.item_name, cost: r.unit_cost })));
  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(console.error);
