require('dotenv').config();
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const cnt = await client.query(`SELECT count(*) total, count(kitchen_shift_id) linked FROM kitchen_production_sessions`);
  console.log('kitchen_production_sessions counts:', cnt.rows[0]);
  const sample = await client.query(`SELECT id, branch_id, session_date, status, kitchen_shift_id FROM kitchen_production_sessions ORDER BY created_at DESC LIMIT 5`);
  console.log('sample:', sample.rows);
  await client.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
