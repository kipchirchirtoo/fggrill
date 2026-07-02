require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const client = await pool.connect();
  try {
    console.log('=== pos_shift_orders relevant columns ===');
    const cols = await client.query(
      `SELECT column_name, data_type, column_default, is_nullable
       FROM information_schema.columns WHERE table_schema='public' AND table_name='pos_shift_orders'
       AND column_name IN ('void_request_status','kitchen_status','status','payment_status','inventory_posted_at','inventory_reversed_at','inventory_reversed_by','voided_at','voided_by','void_reason')
       ORDER BY ordinal_position`
    );
    console.table(cols.rows);

    console.log('=== pos_shift_orders CHECK constraints mentioning void/kitchen/status ===');
    const checks = await client.query(
      `SELECT conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
       WHERE conrelid = 'pos_shift_orders'::regclass AND contype = 'c'`
    );
    for (const row of checks.rows) {
      if (/void|kitchen_status|payment_status|^status/i.test(row.def) || /void|kitchen|status/i.test(row.conname)) {
        console.log(row);
      }
    }

    console.log('=== distinct void_request_status / kitchen_status values in use ===');
    const r1 = await client.query(`SELECT void_request_status, count(*) FROM pos_shift_orders GROUP BY void_request_status`);
    console.log('void_request_status', r1.rows);
    const r2 = await client.query(`SELECT kitchen_status, count(*) FROM pos_shift_orders GROUP BY kitchen_status`);
    console.log('kitchen_status', r2.rows);

    console.log('=== UserRole-ish role names referenced (sanity check kitchen/cashier role strings) ===');
    const roles = await client.query(`SELECT DISTINCT role FROM users ORDER BY role`);
    console.log(roles.rows.map(r => r.role));
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => { console.error(e); process.exit(1); });
