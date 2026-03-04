/**
 * Apply Stock-Take Submit with Locking Migration
 * Creates RPC function for atomic stock-take submission with row locking
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './backend/.env' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL not found in backend/.env');
  process.exit(1);
}

async function applyMigration() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'backend', 'supabase', 'migrations', '36_stock_take_submit_with_locking.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('🚀 Applying migration: 36_stock_take_submit_with_locking.sql');
    console.log('   This creates the submit_stock_take_with_lock RPC function\n');
    
    await client.query(sql);

    console.log('✅ Migration applied successfully!\n');
    console.log('📋 Summary:');
    console.log('   - Created submit_stock_take_with_lock() RPC function');
    console.log('   - Function uses SELECT FOR UPDATE for row locking');
    console.log('   - Prevents race conditions during submission');
    console.log('   - Creates audit log entries automatically\n');
    
  } catch (err) {
    console.error('❌ Error applying migration:', err.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Verify DATABASE_URL is correct');
    console.error('   2. Ensure migration 35_stock_take_audit_log.sql was applied first');
    console.error('   3. Check database connection and permissions\n');
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
