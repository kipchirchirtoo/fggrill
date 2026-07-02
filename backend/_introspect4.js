require('dotenv').config();
require('dns').setDefaultResultOrder('ipv4first');
const { Client } = require('pg');

async function run() {
  const directUrl = process.env.DATABASE_URL.replace(':6543', ':5432');
  const client = new Client({ connectionString: directUrl });
  await client.connect();
  try {
    const shifts = await client.query(`SELECT id, shift_number, branch_id, shift_type, shift_date, status, opened_at, closed_at, store_keeper_id, assigned_chef_ids FROM kitchen_shifts ORDER BY created_at DESC LIMIT 10`);
    console.log('kitchen_shifts sample:', JSON.stringify(shifts.rows, null, 2));

    const cashierStatuses = await client.query(`SELECT DISTINCT status FROM cashier_shift_logs`);
    console.log('cashier_shift_logs distinct statuses:', JSON.stringify(cashierStatuses.rows));

    const cashierSample = await client.query(`SELECT id, branch_id, status, shift_start, shift_end FROM cashier_shift_logs ORDER BY shift_start DESC LIMIT 5`);
    console.log('cashier_shift_logs sample:', JSON.stringify(cashierSample.rows, null, 2));

    const itemsSample = await client.query(`SELECT shift_id, item_sku, opening_stock, additions, sold_quantity, spoilage_quantity, system_closing_stock, physical_count, variance FROM kitchen_shift_items LIMIT 5`);
    console.log('kitchen_shift_items sample:', JSON.stringify(itemsSample.rows, null, 2));
  } finally {
    await client.end();
  }
}
run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
