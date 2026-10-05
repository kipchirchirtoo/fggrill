require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    const q = await client.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND data_type IN ('text', 'character varying')
    `);
    
    for (const row of q.rows) {
      try {
        const res = await client.query(`SELECT 1 FROM "${row.table_name}" WHERE "${row.column_name}" = 'FG-417' LIMIT 1`);
        if (res.rows.length > 0) {
          console.log(`Found FG-417 in ${row.table_name}.${row.column_name}`);
        }
      } catch (e) {}
    }
  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(console.error);
