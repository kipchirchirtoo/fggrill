const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.argv[2], ssl: { rejectUnauthorized: false } });
  await client.connect();

  const candidateTables = [
    'shift_void_ledger','cashier_shift_void_audits','branch_accountant_actions',
    'pos_item_void_requests','pos_item_void_log','pos_void_requests','void_bills_audit',
    'cashier_shift_logs','pos_outlet_shifts','pos_shift_orders','pos_outlets','branches','users'
  ];

  console.log('=== TABLE EXISTENCE ===');
  const existsRes = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1)`,
    [candidateTables]
  );
  const existing = new Set(existsRes.rows.map(r => r.table_name));
  for (const t of candidateTables) {
    console.log(t, '->', existing.has(t) ? 'EXISTS' : 'MISSING');
  }

  console.log('\n=== COLUMNS FOR EXISTING RELEVANT TABLES ===');
  for (const t of ['pos_item_void_requests','pos_item_void_log','pos_void_requests','void_bills_audit','cashier_shift_logs']) {
    if (!existing.has(t)) continue;
    const cols = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
      [t]
    );
    console.log(`\n-- ${t} --`);
    cols.rows.forEach(c => console.log(' ', c.column_name, ':', c.data_type));
  }

  console.log('\n=== pos_outlets outlet_type distinct values ===');
  try {
    const ot = await client.query(`SELECT DISTINCT outlet_type FROM pos_outlets`);
    console.log(ot.rows.map(r => r.outlet_type));
  } catch (e) { console.log('error:', e.message); }

  console.log('\n=== users.role distinct values ===');
  try {
    const roles = await client.query(`SELECT DISTINCT role FROM users WHERE role IS NOT NULL ORDER BY role`);
    console.log(roles.rows.map(r => r.role));
  } catch (e) { console.log('error:', e.message); }

  console.log('\n=== branches.id / branch_id type check ===');
  try {
    const bcol = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='branches' AND column_name='id'`);
    console.log(bcol.rows);
  } catch (e) { console.log('error:', e.message); }

  await client.end();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
