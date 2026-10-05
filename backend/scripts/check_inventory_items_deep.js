const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    const total = await client.query(`SELECT count(*) FROM inventory_items`);
    console.log('Total rows in inventory_items:', total.rows[0].count);

    const byBranch = await client.query(`SELECT branch_id, count(*) FROM inventory_items GROUP BY branch_id`);
    console.log('By branch_id in inventory_items:');
    console.table(byBranch.rows);

    // Check if any SKUs match Kaplong branch_stock SKUs
    const kapSkus = await client.query(`SELECT item_sku FROM branch_stock WHERE branch_id = 3 LIMIT 10`);
    const skus = kapSkus.rows.map(r => r.item_sku);
    console.log('Sample Kaplong SKUs:', skus);

    const found = await client.query(`SELECT id, branch_id, sku, item_name, category, store_type FROM inventory_items WHERE sku = ANY($1)`, [skus]);
    console.log('Found in inventory_items for these SKUs:');
    console.table(found.rows);

  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(console.error);
