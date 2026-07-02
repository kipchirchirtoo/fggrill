require('dotenv').config();
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const cols = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='kitchen_shifts' ORDER BY ordinal_position`);
  console.log('kitchen_shifts columns:', cols.rows);
  const scb = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='staff_credit_bills' ORDER BY ordinal_position`);
  console.log('staff_credit_bills columns:', scb.rows);
  const sp = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='staff_profiles' ORDER BY ordinal_position LIMIT 20`);
  console.log('staff_profiles columns (first 20):', sp.rows);
  const fk = await client.query(`
    SELECT conname, conrelid::regclass AS table_from, confrelid::regclass AS table_to
    FROM pg_constraint WHERE conrelid = 'kitchen_shifts'::regclass AND contype='f'
  `);
  console.log('kitchen_shifts FKs:', fk.rows);
  await client.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
