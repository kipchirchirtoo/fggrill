const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const sqlPath = path.join(__dirname, 'database', 'migrations', '20260813_enable_notifications_realtime.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Enabling realtime on notifications table...');
    await client.query(sql);
    console.log('✅ Done.');

    const check = await client.query(
      `SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename`
    );
    console.log('Tables currently in supabase_realtime publication:');
    console.table(check.rows);
  } catch (e) {
    console.error('❌', e);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
run();
