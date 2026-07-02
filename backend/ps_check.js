const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.rvoaowhxyweswwuxbrzm:uj8dR3hPZmhwcEUf@aws-0-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false },
});
const tables = ['branches','users','notifications','pos_outlets','pos_outlet_assignments','pos_outlet_items','branch_stock','branch_stock_movements','staff_credit_bills','pos_outlet_shifts','pos_shift_orders','pos_shift_payments','pos_shift_stock_counts','pos_void_requests','pos_item_void_requests','pos_item_exchange_requests'];
(async () => {
  await client.connect();
  const pub = await client.query("SELECT pubname FROM pg_publication WHERE pubname = 'powersync'");
  console.log('publication exists:', pub.rows.length > 0);
  if (pub.rows.length > 0) {
    const tabs = await client.query("SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'powersync'");
    console.log('tables already in publication:', tabs.rows.map(r => r.tablename));
  }
  const ri = await client.query(`SELECT relname, relreplident FROM pg_class WHERE relname = ANY($1)`, [tables]);
  console.log('replica identity (d=default/pkey, f=full, n=none, i=index):');
  ri.rows.forEach(r => console.log(' ', r.relname, '->', r.relreplident));
  const missing = tables.filter(t => !ri.rows.some(r => r.relname === t));
  if (missing.length) console.log('TABLES NOT FOUND IN DB:', missing);
  await client.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
