const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.argv[1], ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== pos_void_requests constraints ===');
  const c1 = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint WHERE conrelid = 'pos_void_requests'::regclass
  `);
  c1.rows.forEach(r => console.log(r.conname, ':', r.def));

  console.log('\n=== pos_item_void_requests constraints ===');
  const c2 = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint WHERE conrelid = 'pos_item_void_requests'::regclass
  `);
  c2.rows.forEach(r => console.log(r.conname, ':', r.def));

  console.log('\n=== pos_shift_orders columns ===');
  const cols = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='pos_shift_orders' ORDER BY ordinal_position`);
  cols.rows.forEach(c => console.log(' ', c.column_name, ':', c.data_type));

  console.log('\n=== cashier_shift_logs id vs shift_id sample ===');
  const sample = await client.query(`SELECT id, shift_id, action, cashier_id, status FROM cashier_shift_logs ORDER BY created_at DESC LIMIT 3`);
  console.log(sample.rows);

  await client.end();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
