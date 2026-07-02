require('dotenv').config();
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const fk = await client.query(`
    SELECT conname, conrelid::regclass AS table_from, confrelid::regclass AS table_to
    FROM pg_constraint WHERE conrelid = 'staff_credit_bills'::regclass AND contype='f'
  `);
  console.log('staff_credit_bills FKs:', fk.rows);
  const sample = await client.query(`SELECT id, name, full_name, username FROM users LIMIT 1`).catch(e => ({rows: [], err: e.message}));
  console.log('users sample attempt:', sample.rows, sample.err);
  const userCols = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position`);
  console.log('users columns:', userCols.rows);
  await client.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
