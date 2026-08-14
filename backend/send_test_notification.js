const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const userId = 'de6d2c89-7913-42fc-b7ae-8f5dbabfa0f6'; // Jackline Chepkirui, restaurant, Bomet Town (branch_id 2)
    const res = await client.query(
      `INSERT INTO notifications (user_id, title, message, type, category, priority, is_read, metadata, module, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, false, $7, $5, NOW())
       RETURNING id, user_id, title, category, type, created_at`,
      [
        userId,
        'Order ready',
        'Test notification — Order #TEST-001 (Table 4) is ready to serve.',
        'success',
        'kds_ready',
        'high',
        JSON.stringify({ target: 'active_orders', source: 'test', order_id: null }),
      ]
    );
    console.log('✅ Sent:');
    console.table(res.rows);
  } catch (e) {
    console.error('❌', e);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
run();
