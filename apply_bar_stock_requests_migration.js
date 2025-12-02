const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

async function applyMigration() {
  const pool = new Pool({ connectionString });
  
  try {
    console.log('🔄 Connecting to database...');
    const client = await pool.connect();
    
    console.log('✅ Connected successfully!');
    console.log('📋 Reading migration file...');
    
    const migrationPath = path.join(__dirname, 'backend/src/database/migrations/15_bar_stock_requests.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🚀 Applying bar stock requests migration...');
    await client.query(migrationSQL);
    
    console.log('✅ Migration applied successfully!');
    console.log('');
    console.log('📊 Created tables:');
    console.log('   - bar_stock_requests');
    console.log('   - bar_stock_request_items');
    console.log('');
    console.log('🔧 Created functions:');
    console.log('   - generate_bar_stock_request_number()');
    console.log('   - set_bar_stock_request_number()');
    console.log('   - update_bar_stock_request_timestamp()');
    console.log('   - update_bar_stock_request_status()');
    console.log('');
    console.log('✨ Bar stock request system is ready!');
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Details:', error);
    process.exit(1);
  }
}

applyMigration();
