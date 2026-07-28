const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: 'backend/.env' });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to PostgreSQL DB.');

  const migrationPath = path.join(__dirname, '../database/migrations/20260727_pos_master_bills.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Running migration 20260727_pos_master_bills.sql...');
  await client.query(sql);
  console.log('Migration 20260727_pos_master_bills.sql executed successfully!');

  // Check if table pos_master_bills exists
  const res = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_name = 'pos_master_bills';`);
  console.log('Table check result:', res.rows);

  await client.end();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
