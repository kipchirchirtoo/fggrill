const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT item_sku, item_name, current_stock, quantity, unit_cost
      FROM branch_stock
      WHERE branch_id = 3
      ORDER BY item_name
    `);
    console.log(`Total branch_stock items for Kaplong: ${res.rows.length}`);
    console.table(res.rows);
  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(console.error);
