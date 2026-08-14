const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();

    const rls = await client.query(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'notifications'`
    );
    console.log('RLS enabled on notifications:', rls.rows);

    const policies = await client.query(
      `SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE tablename = 'notifications'`
    );
    console.log('Policies on notifications:');
    console.table(policies.rows);

    // Also verify most-recent row order + our test row is actually there
    const recent = await client.query(
      `SELECT id, title, category, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
      ['de6d2c89-7913-42fc-b7ae-8f5dbabfa0f6']
    );
    console.log('5 most recent notifications for Jackline:');
    console.table(recent.rows);
  } catch (e) {
    console.error('❌', e);
  } finally {
    await client.end();
  }
}
run();
