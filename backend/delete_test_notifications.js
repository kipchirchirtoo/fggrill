const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    // Only the ones this session actually inserted as tests — identified by
    // metadata.source = 'test' (set by send_test_notification.js), not real
    // "Order ready" notifications from actual kitchen activity (those use
    // source: 'pos_shift_order' / 'restaurant_order').
    const res = await client.query(
      `DELETE FROM notifications WHERE metadata->>'source' = 'test' RETURNING id, title, created_at`
    );
    console.log(`✅ Deleted ${res.rowCount} test notification(s):`);
    console.table(res.rows);
  } catch (e) {
    console.error('❌', e);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
run();
