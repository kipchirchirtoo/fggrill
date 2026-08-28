require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT id, status, item_name, qty_to_void, unit_price, kitchen_id, kitchen_action, cashier_id, cashier_action, created_at, updated_at
       FROM pos_item_void_requests
       ORDER BY created_at DESC
       LIMIT 10`
    );
    console.log(r.rows);
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => { console.error(e); process.exit(1); });
