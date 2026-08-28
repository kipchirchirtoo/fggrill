require('dotenv').config();
const fs = require('fs');
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const sql = fs.readFileSync('migrations/20260628_backfill_recipe_pos_outlet_links.sql', 'utf8');
  const before = await client.query(`SELECT count(*) FROM kitchen_production_recipes WHERE pos_outlet_item_id IS NOT NULL`);
  console.log('Linked before:', before.rows[0].count);
  await client.query(sql);
  const after = await client.query(`SELECT id, branch_id, produced_item_name, pos_outlet_item_id FROM kitchen_production_recipes WHERE pos_outlet_item_id IS NOT NULL ORDER BY updated_at DESC LIMIT 10`);
  console.log('Linked after:', after.rowCount >= 0 ? 'see rows below' : '');
  console.log(after.rows);
  await client.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
