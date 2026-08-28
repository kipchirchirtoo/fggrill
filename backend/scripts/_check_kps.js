require('dotenv').config();
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const cols = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='kitchen_production_sessions' ORDER BY ordinal_position`);
  console.log('kitchen_production_sessions columns:', cols.rows);
  await client.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
