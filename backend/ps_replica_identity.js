const { Client } = require('pg');
const tables = ['branches','users','pos_outlets','pos_outlet_assignments','pos_outlet_items','branch_stock','branch_stock_movements','staff_credit_bills','pos_outlet_shifts','pos_shift_orders','pos_shift_payments','pos_shift_stock_counts','pos_void_requests','pos_item_void_requests','pos_item_exchange_requests'];
(async () => {
  const client = new Client({ connectionString: process.argv[2], ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query("SET lock_timeout = '4s'");
  await client.query("SET statement_timeout = '10s'");
  const ok = [], failed = [];
  for (const t of tables) {
    try {
      await client.query(`ALTER TABLE public.${t} REPLICA IDENTITY FULL`);
      ok.push(t);
    } catch (e) {
      failed.push(t + ' (' + e.message + ')');
    }
  }
  console.log('OK:', ok.join(', ') || 'none');
  console.log('FAILED (lock contention, live traffic):', failed.join(', ') || 'none');
  await client.end();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
