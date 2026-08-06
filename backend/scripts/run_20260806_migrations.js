require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const MIGRATIONS = [
  '../../database/migrations/20260806_master_bill_shift_based_settlement.sql',
  '../../database/migrations/20260806_po_cash_payment_stamp.sql',
];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set in backend/.env');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('Connected to DB');

  for (const rel of MIGRATIONS) {
    const file = path.join(__dirname, rel);
    const sql = fs.readFileSync(file, 'utf8');
    // Disable the pooler's statement timeout for this DDL and bound how long we
    // wait on a table lock (the running backend may hold locks on pos_shift_orders).
    await client.query('BEGIN');
    await client.query('SET LOCAL statement_timeout = 0');
    await client.query("SET LOCAL lock_timeout = '60s'");
    try {
      await client.query(sql);
      await client.query('COMMIT');
      console.log('Applied:', path.basename(file));
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  }

  // Make the new columns visible to the PostgREST / supabase-js layer.
  await client.query("NOTIFY pgrst, 'reload schema';");
  console.log('PostgREST schema reloaded');

  const check = await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE (table_name = 'pos_master_bill_settlements' AND column_name IN ('shift_id','responsible_cashier_id','receipt_printed_at'))
       OR (table_name = 'pos_shift_orders'           AND column_name IN ('externally_settled','externally_settled_by'))
       OR (table_name = 'purchase_orders'            AND column_name IN ('paid_by_cashier_id','paid_shift_id','paid_at'))
    ORDER BY table_name, column_name;`);
  console.log('Verified new columns:');
  for (const r of check.rows) console.log('  -', r.table_name + '.' + r.column_name);

  await client.end();
  console.log('DONE');
}

main().catch((err) => {
  console.error('Migration error:', err.message || err);
  process.exit(1);
});
