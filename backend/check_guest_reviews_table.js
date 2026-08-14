const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    const res = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'guest_reviews' ORDER BY ordinal_position`
    );
    console.log(`guest_reviews has ${res.rows.length} columns`);
    console.table(res.rows);

    const branches = await client.query(`SELECT id, name, code FROM branches ORDER BY id`);
    console.log('branches:');
    console.table(branches.rows);
  } catch (e) {
    console.error('❌', e);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
run();
