const { Client } = require('pg');
const fs = require('fs');

async function run() {
  const connectionString = "postgresql://postgres.rvoaowhxyweswwuxbrzm:uj8dR3hPZmhwcEUf@aws-0-eu-west-1.pooler.supabase.com:6543/postgres";
  if (!connectionString) {
    console.error('No DATABASE_URL found');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const sql = fs.readFileSync('/home/john/fggrill-1/database/migrations/20260614_auth_fixes.sql', 'utf8');
    await client.query(sql);
    console.log('Migration applied successfully.');
  } catch (error) {
    console.error('Error applying migration:', error);
  } finally {
    await client.end();
  }
}

run();
