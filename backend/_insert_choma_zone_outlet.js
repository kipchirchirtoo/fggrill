require('dotenv').config();
require('dns').setDefaultResultOrder('ipv4first');
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const res = await client.query(
    `INSERT INTO pos_outlets (branch_id, outlet_code, name, outlet_type, is_active)
     VALUES (1, 'CHOMA_ZONE', 'Kyogong Choma Zone POS', 'choma_zone', true)
     RETURNING id, branch_id, name, outlet_type, outlet_code, is_active`
  );
  console.log('Inserted:', res.rows[0]);

  await client.end();
}
run().catch(e => { console.error(e); process.exit(1); });
