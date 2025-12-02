const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Connection string from apply_enhanced_migration.js
const client = new Client({
  connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    await client.connect();
    console.log('Connected to database.');
    
    const sqlPath = path.join(__dirname, 'database/migrations/007_create_hotel_management_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Applying migration: 007_create_hotel_management_tables.sql');
    await client.query(sql);
    console.log('Migration 007 applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

runMigration();
