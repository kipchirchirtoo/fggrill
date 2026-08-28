require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');

async function run() {
  const connectionString = process.env.DATABASE_URL_NEW || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('No DATABASE_URL found');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const sql = fs.readFileSync('/home/john/fggrill-1/database/migrations/20260614_branch_accountant_schema_alignment.sql', 'utf8');
    await client.query(sql);
    console.log('Migration applied successfully.');
  } catch (error) {
    console.error('Error applying migration:', error);
  } finally {
    await client.end();
  }
}

run();
