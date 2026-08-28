require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const client = await pool.connect();
  try {
    console.log('=== kitchen_production_recipes (Food Control recipes) ===');
    const r1 = await client.query(`SELECT id, branch_id, raw_item_sku, raw_item_name, raw_quantity, raw_unit, produced_item_name, produced_quantity, is_active FROM kitchen_production_recipes ORDER BY branch_id, produced_item_name LIMIT 50`);
    console.log(r1.rows);

    console.log('\n=== recipes table (legacy BOM, priority-1 in Daily Control) ===');
    const r2 = await client.query(`SELECT id, branch_id, menu_item_name, output_quantity, is_active FROM recipes ORDER BY branch_id LIMIT 50`);
    console.log(r2.rows);

    console.log('\n=== recipe_items count ===');
    const r3 = await client.query(`SELECT count(*) FROM recipe_items`);
    console.log(r3.rows);

    console.log('\n=== distinct restaurant item names sold in last 14 days (pos_shift_orders.items, item_group=restaurant) ===');
    const r4 = await client.query(`
      SELECT branch_id, item->>'name' AS item_name, count(*) AS lines, sum((item->>'quantity')::numeric) AS qty
      FROM pos_shift_orders o, jsonb_array_elements(o.items) item
      WHERE o.created_at > now() - interval '14 days'
        AND item->>'item_group' = 'restaurant'
        AND (o.status IN ('paid','credit_bill') OR o.payment_status IN ('paid','credit_bill'))
      GROUP BY branch_id, item->>'name'
      ORDER BY branch_id, qty DESC
      LIMIT 60
    `);
    console.log(r4.rows);
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => { console.error(e); process.exit(1); });
