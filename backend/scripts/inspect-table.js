const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function inspectTable() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'store_supplier_payments'
    `);
    console.log('Columns in store_supplier_payments:');
    res.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));
    
    const sample = await client.query('SELECT * FROM public.store_supplier_payments LIMIT 1');
    console.log('\nSample Row:', JSON.stringify(sample.rows[0], null, 2));
  } catch (err) {
    console.error('Inspection failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

inspectTable();
