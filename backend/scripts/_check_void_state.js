require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT id, status, item_name, qty_to_void, unit_price, created_at
       FROM pos_item_void_requests
       WHERE status IN ('pending','kitchen_acknowledged')
       ORDER BY created_at DESC LIMIT 5`
    );
    console.log('Non-terminal item void requests:', r.rows);
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => { console.error(e); process.exit(1); });
