const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    const kSkus = await client.query(`SELECT item_sku, item_name, current_stock, quantity, unit_cost FROM branch_stock WHERE branch_id = 3`);
    const skus = kSkus.rows.map(r => r.item_sku);
    console.log(`Kaplong branch_stock items: ${skus.length}`);

    // Check which skus are in inventory_items
    const found = await client.query(`
      SELECT DISTINCT sku, id, item_name, category, store_type
      FROM inventory_items
      WHERE sku = ANY($1)
    `, [skus]);

    console.log(`Found in inventory_items: ${found.rows.length} / ${skus.length}`);
    const foundSkus = new Set(found.rows.map(r => r.sku));
    const missing = kSkus.rows.filter(r => !foundSkus.has(r.item_sku));
    console.log(`Missing from inventory_items: ${missing.length}`);
    console.log('Sample missing items:', missing.slice(0, 15));

  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(console.error);
