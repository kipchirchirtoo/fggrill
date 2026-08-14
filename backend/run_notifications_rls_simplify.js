const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const sqlPath = path.join(__dirname, 'database', 'migrations', '20260813b_notifications_rls_simplify.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Simplifying notifications RLS policy...');
    await client.query(sql);
    console.log('✅ Done.');
    const policies = await client.query(
      `SELECT policyname, cmd, roles, qual FROM pg_policies WHERE tablename = 'notifications'`
    );
    console.table(policies.rows);
  } catch (e) {
    console.error('❌', e);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
run();
