const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('No DATABASE_URL found in .env');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const sqlPath = path.join(__dirname, 'database', 'migrations', '20260813_create_guest_reviews.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Running guest_reviews migration...');
    await client.query(sql);
    console.log('✅ Migration completed successfully.');
  } catch (e) {
    console.error('❌ Migration failed:', e);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
run();
