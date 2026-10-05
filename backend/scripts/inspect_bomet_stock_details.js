require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    console.log('=== 1. branch_stock columns ===');
    const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'branch_stock'
      ORDER BY ordinal_position
    `);
    console.table(cols.rows);

    console.log('=== 2. inventory_items columns ===');
    const cols2 = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'inventory_items'
      ORDER BY ordinal_position
    `);
    console.table(cols2.rows);

    // Sample branch_stock
    const sampleBS = await client.query(`
      SELECT * FROM branch_stock WHERE branch_id = 2 LIMIT 5
    `);
    console.log('=== 3. branch_stock sample ===', sampleBS.rows);

    // Sample inventory_items
    const sampleII = await client.query(`
      SELECT * FROM inventory_items WHERE branch_id = 2 LIMIT 5
    `);
    console.log('=== 4. inventory_items sample ===', sampleII.rows);

  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(console.error);
