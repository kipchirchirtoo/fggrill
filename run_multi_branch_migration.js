// Run multi-branch and menu images migration
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './backend/.env' });

// Use URL-encoded password
const connectionString = 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

async function runMigration() {
  const client = new Client({ connectionString });
  
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected!');
    
    const migrationPath = path.join(__dirname, 'backend/migrations/versions/20251202_multi_branch_and_menu_images.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running multi-branch migration...');
    await client.query(sql);
    
    console.log('Migration completed successfully!');
    
    // Verify the changes
    const menuItemsResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'restaurant_menu_items' 
      ORDER BY ordinal_position
    `);
    console.log('\nrestaurant_menu_items columns:');
    menuItemsResult.rows.forEach(row => console.log(`  - ${row.column_name}: ${row.data_type}`));
    
  } catch (error) {
    console.error('Migration error:', error.message);
  } finally {
    await client.end();
  }
}

runMigration();
