require('dotenv').config();
require('dns').setDefaultResultOrder('ipv4first');
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const cols = await client.query(
    "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'pos_outlets' ORDER BY ordinal_position"
  );
  console.log('pos_outlets columns:');
  console.log(cols.rows);

  const rows = await client.query(
    "SELECT id, branch_id, name, outlet_type, outlet_code, is_active FROM pos_outlets WHERE branch_id = 1 ORDER BY id"
  );
  console.log('\nKyogong (branch_id=1) pos_outlets rows:');
  console.log(rows.rows);

  await client.end();
}
run().catch(e => { console.error(e); process.exit(1); });
