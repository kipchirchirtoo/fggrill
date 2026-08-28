const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'verify_live_shift_mode.env') });

const connectionString = process.env.DATABASE_URL_DEV_DEMO;

if (!connectionString) {
  console.error('Missing DATABASE_URL_DEV_DEMO in .env');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function main() {
  try {
    const client = await pool.connect();
    
    // Check users
    console.log('Querying users from DEV...');
    const usersRes = await client.query('SELECT id, email, role, branch_id FROM users LIMIT 10');
    console.log('Users:', usersRes.rows);

    client.release();
  } catch (err) {
    console.error('Database query error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
