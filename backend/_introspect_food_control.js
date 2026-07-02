require('dotenv').config();
require('dns').setDefaultResultOrder('ipv4first');
const { Client } = require('pg');

async function run() {
  const directUrl = process.env.DATABASE_URL.replace(':6543', ':5432');
  const client = new Client({ connectionString: directUrl });
  await client.connect();
  try {
    for (const t of ['kitchen_shifts', 'kitchen_shift_items', 'recipes', 'cashier_shift_logs', 'pos_outlet_shifts', 'inventory_items']) {
      const cols = await client.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`,
        [t]
      );
      console.log(`\n=== ${t} ===`);
      console.log(JSON.stringify(cols.rows));
    }
  } finally {
    await client.end();
  }
}
run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
