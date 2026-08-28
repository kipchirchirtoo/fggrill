const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'verify_live_shift_mode.env') });

const connectionString = process.env.DATABASE_URL_PRODUCTION_POOLER_APPROVED;

if (!connectionString) {
  console.error('Missing DATABASE_URL_PRODUCTION_POOLER_APPROVED in .env');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function main() {
  try {
    const client = await pool.connect();
    
    // Check users
    console.log('Querying users...');
    const usersRes = await client.query('SELECT id, email, role, branch_id FROM users LIMIT 10');
    console.log('Users:', usersRes.rows);

    // Check branch settings
    console.log('Querying branch shift configs...');
    const shiftConfigs = await client.query('SELECT * FROM branch_shift_config');
    console.log('Shift Configs:', shiftConfigs.rows);

    client.release();
  } catch (err) {
    console.error('Database query error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
