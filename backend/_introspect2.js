require('dotenv').config();
require('dns').setDefaultResultOrder('ipv4first');
const { Client } = require('pg');

async function run() {
  const directUrl = process.env.DATABASE_URL.replace(':6543', ':5432');
  const client = new Client({ connectionString: directUrl });
  await client.connect();
  try {
    for (const t of ['kitchen_production_recipes', 'recipe_items', 'kitchen_shift_production', 'kitchen_shift_stock_take', 'kitchen_shift_approvals', 'kitchen_shift_liability_cases', 'staff_credit_bills', 'pos_outlet_items']) {
      const existsRes = await client.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) as exists`, [t]
      );
      if (!existsRes.rows[0].exists) { console.log(`\n${t}: DOES NOT EXIST`); continue; }
      const cols = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`, [t]);
      const countRes = await client.query(`SELECT COUNT(*) as c FROM "${t}"`);
      console.log(`\n=== ${t} (rows=${countRes.rows[0].c}) ===`);
      console.log(JSON.stringify(cols.rows));
    }
  } finally {
    await client.end();
  }
}
run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
