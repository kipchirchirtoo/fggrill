const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const res = await client.query(
      `SELECT id, email, first_name, last_name, role, branch_id FROM users WHERE LOWER(first_name) LIKE '%jackline%' OR LOWER(last_name) LIKE '%chepkirui%'`
    );
    console.table(res.rows);
  } catch (e) {
    console.error('❌', e);
  } finally {
    await client.end();
  }
}
run();
