require('dotenv').config();
const { Client } = require('pg');

async function run() {
  const parsedUrl = new URL(process.env.DATABASE_URL.replace(':6543', ':5432'));
  parsedUrl.hostname = '34.241.16.247';
  const connectionString = parsedUrl.toString();
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  await client.connect();
  const res = await client.query(`
    SELECT pid, state, query_start, query 
    FROM pg_stat_activity 
    WHERE state != 'idle' AND pid != pg_backend_pid();
  `);
  console.table(res.rows);
  await client.end();
}
run();
