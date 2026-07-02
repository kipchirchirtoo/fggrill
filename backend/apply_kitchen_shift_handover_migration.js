require('dotenv').config();
require('dns').setDefaultResultOrder('ipv4first');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const directUrl = process.env.DATABASE_URL.replace(':6543', ':5432');
  const client = new Client({ connectionString: directUrl });
  try {
    await client.connect();
    console.log('Connected to DB directly on 5432!');

    const migrationPath = path.join(__dirname, 'src', 'database', 'migrations', '20260629_kitchen_shift_handover.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    await client.query(sql);
    console.log('Migration applied successfully.');

    try {
      await client.query("NOTIFY pgrst, 'reload schema'");
      console.log('PostgREST schema cache reload triggered.');
    } catch (e) {
      console.error('Failed to reload schema cache:', e.message);
    }
  } catch (e) {
    console.error('Migration Error:', e);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
run();
