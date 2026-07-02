require('dotenv').config();
const fs = require('fs');
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const before = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='kitchen_production_sessions' AND column_name='shift_type'`);
  console.log('shift_type exists before:', before.rows.length > 0);
  const sql = fs.readFileSync('migrations/20260628_fix_kitchen_production_sessions_shift_type.sql', 'utf8');
  await client.query(sql);
  const after = await client.query(`SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='kitchen_production_sessions' AND column_name='shift_type'`);
  console.log('shift_type after:', after.rows);
  await client.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
