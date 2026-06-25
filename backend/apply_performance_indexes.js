const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const parsedUrl = new URL(process.env.DATABASE_URL.replace(':6543', ':5432'));
  parsedUrl.hostname = '34.241.16.247';
  const connectionString = parsedUrl.toString();
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();

    console.log('Creating index on notifications...');
    // Cannot run CONCURRENTLY inside a transaction block, so we just run them sequentially
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_fetch 
      ON notifications (branch_id, role, category, is_read);
    `);
    console.log('Created idx_notifications_fetch');

    console.log('Creating indexes on pos_shift_orders...');
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pos_shift_orders_branch_created 
      ON pos_shift_orders (branch_id, created_at DESC);
    `);
    console.log('Created idx_pos_shift_orders_branch_created');

    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pos_shift_orders_status 
      ON pos_shift_orders (status);
    `);
    console.log('Created idx_pos_shift_orders_status');

    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pos_item_void_requests_branch 
      ON pos_item_void_requests (branch_id, status);
    `);
    console.log('Created idx_pos_item_void_requests_branch');

    console.log('✅ Performance indexes applied.');
  } catch (e) {
    console.error('Error applying indexes:', e);
  } finally {
    await client.end();
  }
}
run();
