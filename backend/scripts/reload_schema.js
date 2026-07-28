require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('Connected to DB');

  try {
    await client.query("SET lock_timeout = '3s';");
    await client.query("ALTER TABLE public.pos_shift_orders ADD COLUMN IF NOT EXISTS master_bill_id uuid, ADD COLUMN IF NOT EXISTS sub_bill_status text NOT NULL DEFAULT 'open';");
    console.log('ALTER TABLE pos_shift_orders succeeded!');
  } catch (err) {
    console.log('ALTER TABLE pos_shift_orders note:', err.message);
  }

  // Reload PostgREST schema cache
  await client.query("NOTIFY pgrst, 'reload schema';");
  console.log('PostgREST schema cache reloaded!');

  await client.end();
}

main().catch(console.error);
