const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Connection string for the pooler (using the one from the previous attempt)
// If this fails, the user will need to run it manually, but we try to automate.
const client = new Client({
  connectionString: 'postgres://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-0-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    await client.connect();
    console.log('Connected to database.');
    
    const sqlPath = path.join(__dirname, '../backend/src/database/migrations/20231127_enhanced_inventory.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await client.query(sql);
    console.log('Enhanced Inventory Migration applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    console.log('Please run the migratio
      n manually in Supabase SQL Editor.');
  } finally {
    await client.end();
  }
}

runMigration();
