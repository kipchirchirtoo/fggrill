const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './backend/.env' });

// Use DATABASE_URL from .env
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Missing DATABASE_URL in backend/.env');
  process.exit(1);
}

async function applyMigration() {
  const client = new Client({ connectionString });
  
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!');

    console.log('📦 Reading migration file...');
    const migrationPath = path.join(__dirname, 'backend/supabase/migrations/32_kyogong_cash_float_tracking.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('🚀 Applying migration: 32_kyogong_cash_float_tracking.sql');
    await client.query(sql);

    console.log('✅ Migration applied successfully!');
    console.log('\n📋 Changes applied:');
    console.log('  - Enhanced cashier_shifts table with float tracking columns');
    console.log('  - Created float_history table for audit trail');
    console.log('  - Added indexes for performance');
    console.log('  - Configured RLS policies');
    console.log('  - Initialized existing open shifts');
    
  } catch (err) {
    console.error('❌ Error applying migration:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
