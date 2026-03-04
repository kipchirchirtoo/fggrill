require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkStructure() {
  try {
    console.log('Checking staff_credit_bills structure...\n');
    
    // Get all columns
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'staff_credit_bills'
      ORDER BY ordinal_position;
    `);

    console.log('All columns:');
    columns.rows.forEach(row => {
      console.log(`  ${row.column_name.padEnd(25)} ${row.data_type.padEnd(20)} ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Get sample data
    console.log('\nSample data (first 5 records):');
    const sample = await pool.query(`
      SELECT *
      FROM staff_credit_bills
      ORDER BY date DESC
      LIMIT 5;
    `);

    sample.rows.forEach((row, idx) => {
      console.log(`\nRecord ${idx + 1}:`);
      Object.keys(row).forEach(key => {
        if (row[key] !== null) {
          console.log(`  ${key}: ${row[key]}`);
        }
      });
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkStructure();
