require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkColumns() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'cashier_logbooks'
      ORDER BY ordinal_position;
    `);

    console.log('\nColumns in cashier_logbooks table:');
    console.log('='.repeat(60));
    result.rows.forEach(row => {
      console.log(`${row.column_name.padEnd(30)} ${row.data_type.padEnd(15)} ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkColumns();
