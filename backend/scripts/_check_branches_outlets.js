require('dotenv').config();
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const branches = await client.query(`SELECT id, name, branch_type FROM branches ORDER BY id`).catch(e => ({rows:[], err:e.message}));
  console.log('branches:', branches.rows, branches.err);
  const outlets = await client.query(`SELECT id, branch_id, name, outlet_type, outlet_code, is_active FROM pos_outlets ORDER BY branch_id, outlet_type`);
  console.log('pos_outlets:', outlets.rows);
  await client.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
