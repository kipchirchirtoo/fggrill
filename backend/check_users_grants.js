const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const grants = await client.query(
      `SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name = 'users' AND grantee IN ('anon','authenticated','public')`
    );
    console.log('Grants on users for anon/authenticated:');
    console.table(grants.rows);

    const usersRls = await client.query(
      `SELECT relrowsecurity FROM pg_class WHERE relname = 'users'`
    );
    console.log('RLS enabled on users:', usersRls.rows);

    const usersPolicies = await client.query(
      `SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'users'`
    );
    console.log('Policies on users:');
    console.table(usersPolicies.rows);
  } catch (e) {
    console.error('❌', e);
  } finally {
    await client.end();
  }
}
run();
