require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const res = await client.query(`
    SELECT pg_terminate_backend(pid) 
    FROM pg_stat_activity 
    WHERE state = 'idle in transaction' AND pid <> pg_backend_pid();
  `);
  console.log('Terminated idle in transaction connections:', res.rows.length);

  await client.query(`
    ALTER TABLE public.pos_shift_orders
      ADD COLUMN IF NOT EXISTS master_bill_id  uuid,
      ADD COLUMN IF NOT EXISTS sub_bill_status text NOT NULL DEFAULT 'open';
    CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_master_bill
      ON public.pos_shift_orders (master_bill_id) WHERE master_bill_id IS NOT NULL;
  `);
  console.log('ALTER TABLE pos_shift_orders succeeded!');

  await client.query("NOTIFY pgrst, 'reload schema';");
  console.log('PostgREST schema reloaded!');

  await client.end();
}

main().catch(console.error);
