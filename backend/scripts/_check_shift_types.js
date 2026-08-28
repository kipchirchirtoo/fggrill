require('dotenv').config();
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const r = await client.query(`SELECT DISTINCT shift_type, status, count(*) FROM kitchen_shifts GROUP BY shift_type, status ORDER BY 1,2`);
  console.log(r.rows);
  await client.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
