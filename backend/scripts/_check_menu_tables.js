require('dotenv').config();
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const cols1 = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='restaurant_menu_items' ORDER BY ordinal_position`);
  console.log('restaurant_menu_items columns:', cols1.rows);
  const cols2 = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='pos_outlet_items' ORDER BY ordinal_position`);
  console.log('pos_outlet_items columns:', cols2.rows.slice(0,6));
  const cnt1 = await client.query(`SELECT count(*) FROM restaurant_menu_items`);
  console.log('restaurant_menu_items count:', cnt1.rows[0]);
  const sample1 = await client.query(`SELECT id, name FROM restaurant_menu_items LIMIT 5`);
  console.log('restaurant_menu_items sample:', sample1.rows);
  const cnt2 = await client.query(`SELECT count(*) FROM pos_outlet_items WHERE branch_id=2`);
  console.log('pos_outlet_items (branch 2) count:', cnt2.rows[0]);
  const sample2 = await client.query(`SELECT id, name FROM pos_outlet_items WHERE branch_id=2 LIMIT 5`);
  console.log('pos_outlet_items sample:', sample2.rows);
  await client.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
