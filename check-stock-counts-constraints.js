require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkConstraints() {
  try {
    const result = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition 
      FROM pg_constraint 
      WHERE conrelid = 'stock_counts'::regclass AND contype = 'c';
    `);
    
    console.log('Stock Counts Check Constraints:\n');
    result.rows.forEach(row => {
      console.log(`${row.conname}:`);
      console.log(`  ${row.definition}\n`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkConstraints();
