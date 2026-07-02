const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Client } = require('pg');
const fs = require('fs');

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('No DATABASE_URL found in .env');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    const migrationPath = path.join(__dirname, '../database/migrations/20260626_kitchen_pos_consumption_and_alerts.sql');
    console.log(`Reading migration from: ${migrationPath}`);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Executing SQL migration...');
    await client.query(sql);
    console.log('✅ Migration applied successfully.');
  } catch (error) {
    console.error('❌ Error applying migration:', error);
  } finally {
    await client.end();
  }
}

run();
