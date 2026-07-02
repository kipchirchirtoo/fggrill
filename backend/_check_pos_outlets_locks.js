require('dotenv').config();
require('dns').setDefaultResultOrder('ipv4first');
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const res = await client.query(`
    SELECT a.pid, a.state, a.query, a.query_start, l.mode, l.granted
    FROM pg_locks l
    JOIN pg_stat_activity a ON a.pid = l.pid
    WHERE l.relation = 'pos_outlets'::regclass
    ORDER BY a.query_start
  `);
  console.log(res.rows);

  await client.end();
}
run().catch(e => { console.error(e); process.exit(1); });
