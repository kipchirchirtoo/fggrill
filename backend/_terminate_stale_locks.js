require('dotenv').config();
require('dns').setDefaultResultOrder('ipv4first');
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  for (const pid of [1113601, 1119058]) {
    const res = await client.query('SELECT pg_terminate_backend($1) AS terminated', [pid]);
    console.log(`pid ${pid}:`, res.rows[0]);
  }

  await client.end();
}
run().catch(e => { console.error(e); process.exit(1); });
