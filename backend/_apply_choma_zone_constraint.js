require('dotenv').config();
require('dns').setDefaultResultOrder('ipv4first');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const sql = fs.readFileSync(
    path.join(__dirname, 'src/database/migrations/20260629_add_choma_zone_outlet_type.sql'),
    'utf8'
  );
  await client.query(sql);
  console.log('Migration applied.');

  const res = await client.query(
    `SELECT conname, pg_get_constraintdef(oid) AS def
     FROM pg_constraint
     WHERE conrelid = 'pos_outlets'::regclass AND conname = 'pos_outlets_outlet_type_check'`
  );
  console.log(res.rows);

  await client.end();
}
run().catch(e => { console.error(e); process.exit(1); });
