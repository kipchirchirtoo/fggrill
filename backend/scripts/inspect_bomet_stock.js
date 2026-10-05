require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (table_name ILIKE '%inventory%' OR table_name ILIKE '%stock%' OR table_name ILIKE '%store%')
      ORDER BY table_name
    `);
    console.log('Stock/Inventory tables:', tables.rows.map(r => r.table_name));

    // Check row counts for branch 2 in each table
    for (const t of tables.rows) {
      const tName = t.table_name;
      // Check if table has branch_id column
      const colCheck = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = 'branch_id'
      `, [tName]);

      if (colCheck.rows.length > 0) {
        const countRes = await client.query(`SELECT count(*) FROM "${tName}" WHERE branch_id = 2`);
        console.log(`Table: ${tName} -> branch_id = 2 has ${countRes.rows[0].count} rows`);
      } else {
        const countRes = await client.query(`SELECT count(*) FROM "${tName}"`);
        console.log(`Table: ${tName} (no branch_id col) -> total rows: ${countRes.rows[0].count}`);
      }
    }

  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(console.error);
