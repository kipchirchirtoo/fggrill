const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    for (const table of ['credit_bills', 'staff_credit_bills', 'room_types']) {
      const res = await client.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
        [table]
      );
      console.log(`\n${table}:`);
      console.table(res.rows);
    }
  } catch (e) {
    console.error('❌', e);
  } finally {
    await client.end();
  }
}
run();
