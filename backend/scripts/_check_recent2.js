require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT id, status, item_name, requested_by, created_at
       FROM pos_item_void_requests
       WHERE created_at > now() - interval '4 hours'
       ORDER BY created_at DESC`
    );
    console.log(r.rows);
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => { console.error(e); process.exit(1); });
