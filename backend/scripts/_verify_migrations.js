require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const client = await pool.connect();
  try {
    const checks = await client.query(
      `SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
       WHERE conname IN ('pos_item_void_requests_status_check', 'pos_void_requests_status_check')`
    );
    console.log('=== status CHECK constraints ===');
    console.log(checks.rows);

    const cols = await client.query(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema='public'
         AND (table_name='pos_item_void_requests' AND column_name LIKE 'kitchen_%')
          OR (table_name='pos_void_requests' AND column_name IN ('kitchen_id','kitchen_acknowledged_at','kitchen_action','cashier_id','cashier_acknowledged_at','cashier_action'))
          OR (table_name='cashier_shift_logs' AND column_name IN ('expense_total','expense_details'))
          OR (table_name='kitchen_shift_pos_consumption' AND column_name='item_index')
          OR (table_name='cashier_shift_void_audits')
       ORDER BY table_name, column_name`
    );
    console.log('=== new columns/tables present ===');
    console.log(cols.rows);

    const fn = await client.query(
      `SELECT pg_get_functiondef(oid) LIKE '%kitchen_acknowledged%' AS uses_new_precondition
       FROM pg_proc WHERE proname = 'cashier_acknowledge_item_void'`
    );
    console.log('=== cashier_acknowledge_item_void RPC updated ===');
    console.log(fn.rows);
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => { console.error(e); process.exit(1); });
