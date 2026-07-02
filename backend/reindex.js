const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const parsedUrl = new URL(process.env.DATABASE_URL.replace(':6543', ':5432'));
  parsedUrl.hostname = '34.241.16.247';
  const connectionString = parsedUrl.toString();
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();

    console.log('--- REINDEXING ALL POS TABLES ---');
    const queries = [
      'REINDEX TABLE CONCURRENTLY pos_outlets;',
      'REINDEX TABLE CONCURRENTLY pos_outlet_items;',
      'REINDEX TABLE CONCURRENTLY pos_shift_orders;',
      'REINDEX TABLE CONCURRENTLY pos_shift_stock_counts;',
      'VACUUM ANALYZE pos_outlets;',
      'VACUUM ANALYZE pos_outlet_items;',
      'VACUUM ANALYZE pos_shift_orders;',
      'VACUUM ANALYZE pos_shift_stock_counts;',
      `NOTIFY pgrst, 'reload schema';`
    ];

    for (const sql of queries) {
      console.log('Executing:', sql);
      try {
        await client.query(sql);
      } catch(e) {
        console.error('Failed:', e.message);
      }
    }

    console.log('✅ Reindexing and VACUUM complete.');

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await client.end();
  }
}
run();
