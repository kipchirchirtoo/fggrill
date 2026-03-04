const { Client } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function checkTriggers() {
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT 
        t.tgname AS trigger_name,
        p.proname AS function_name
      FROM pg_trigger t
      JOIN pg_proc p ON t.tgfoid = p.oid
      WHERE t.tgrelid = 'stock_takes'::regclass
    `);
    
    console.log('Stock-takes table triggers:');
    result.rows.forEach(row => {
      console.log(`  ${row.trigger_name} -> ${row.function_name}()`);
    });
    
    // Check if updated_at column exists
    const colResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'stock_takes' AND column_name = 'updated_at'
    `);
    
    console.log('\nupdated_at column exists:', colResult.rows.length > 0);
    
    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkTriggers();
