// Run fix migration for restaurant_orders and receipts
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './backend/.env' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Missing DATABASE_URL in .env');
  process.exit(1);
}

async function runMigration() {
  const client = new Client({ connectionString });
  
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected!');
    
    const migrationPath = path.join(__dirname, 'backend/migrations/versions/20251202_fix_restaurant_orders_and_receipts.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running migration...');
    await client.query(sql);
    
    console.log('Migration completed successfully!');
    
    // Verify the changes
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'restaurant_orders' 
      ORDER BY ordinal_position
    `);
    console.log('\nrestaurant_orders columns:');
    result.rows.forEach(row => console.log(`  - ${row.column_name}: ${row.data_type}`));
    
    // Check receipts table
    const receiptsResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'receipts'
      ) as exists
    `);
    console.log('\nreceipts table exists:', receiptsResult.rows[0].exists);
    
  } catch (error) {
    console.error('Migration error:', error.message);
  } finally {
    await client.end();
  }
}

runMigration();
