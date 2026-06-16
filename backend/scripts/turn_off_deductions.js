require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query(`
      UPDATE staff_profiles
      SET nssf_enabled = false, shif_enabled = false, housing_fund_enabled = false
      WHERE nssf_enabled = true OR shif_enabled = true OR housing_fund_enabled = true;
    `);
    console.log('Updated', res.rowCount, 'staff records: all deductions turned OFF');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
