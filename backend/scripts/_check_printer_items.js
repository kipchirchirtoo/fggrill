require('dotenv').config();
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const printerTables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name ILIKE '%printer%'
  `);
  console.log('printer-related tables:', printerTables.rows);
  const itemCounts = await client.query(`SELECT branch_id, count(*) FROM pos_outlet_items GROUP BY branch_id ORDER BY branch_id`);
  console.log('pos_outlet_items count per branch:', itemCounts.rows);
  const choma = await client.query(`SELECT id, name, outlet_type FROM pos_outlets WHERE name ILIKE '%choma%' OR outlet_code ILIKE '%choma%'`);
  console.log('any existing choma outlet anywhere:', choma.rows);
  await client.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
