require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT id, status, item_name, kitchen_id, kitchen_action, cashier_id, cashier_action, branch_id, outlet_id, updated_at
       FROM pos_item_void_requests
       WHERE id = '13111192-beb3-4b1f-b50c-c61bd45f24ee'`
    );
    console.log(r.rows);
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => { console.error(e); process.exit(1); });
