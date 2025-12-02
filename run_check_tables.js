// Check table structures
const { Client } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const connectionString = 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

async function checkTables() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    
    // Check branches table
    const branchesResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'branches' 
      ORDER BY ordinal_position
    `);
    console.log('branches table columns:');
    branchesResult.rows.forEach(row => console.log(`  - ${row.column_name}: ${row.data_type}`));
    
    // Check restaurant_menu_items
    const menuResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'restaurant_menu_items' 
      ORDER BY ordinal_position
    `);
    console.log('\nrestaurant_menu_items columns:');
    menuResult.rows.forEach(row => console.log(`  - ${row.column_name}: ${row.data_type}`));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkTables();
