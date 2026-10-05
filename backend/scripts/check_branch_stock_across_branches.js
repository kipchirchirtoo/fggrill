const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT b.id, b.name, b.code, count(ii.id) as inventory_items_count, count(bs.id) as branch_stock_count
      FROM branches b
      LEFT JOIN inventory_items ii ON ii.branch_id = b.id
      LEFT JOIN branch_stock bs ON bs.branch_id = b.id
      GROUP BY b.id, b.name, b.code
      ORDER BY b.id
    `);
    console.table(res.rows);
  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(console.error);
