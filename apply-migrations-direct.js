const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './backend/.env' });

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function applyMigrations() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Migration 35: Stock-take audit log
    console.log('📦 Applying migration 35: stock_take_audit_log...');
    const migration35 = fs.readFileSync(
      path.join(__dirname, 'backend/supabase/migrations/35_stock_take_audit_log.sql'),
      'utf8'
    );
    await client.query(migration35);
    console.log('✅ Migration 35 applied\n');
    
    // Migration 36: Submit with locking
    console.log('📦 Applying migration 36: stock_take_submit_with_locking...');
    const migration36 = fs.readFileSync(
      path.join(__dirname, 'backend/supabase/migrations/36_stock_take_submit_with_locking.sql'),
      'utf8'
    );
    await client.query(migration36);
    console.log('✅ Migration 36 applied\n');
    
    // Verify
    console.log('🔍 Verifying migrations...');
    const columns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'stock_takes' 
      AND column_name IN ('submitted_at', 'submitted_by', 'verified_at')
    `);
    console.log('✅ Columns added:', columns.rows.map(r => r.column_name).join(', '));
    
    const funcExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_proc 
        WHERE proname = 'submit_stock_take_with_lock'
      )
    `);
    console.log('✅ RPC function exists:', funcExists.rows[0].exists);
    
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'stock_take_audit_log'
      )
    `);
    console.log('✅ Audit log table exists:', tableExists.rows[0].exists);
    
    console.log('\n🎉 All migrations applied successfully!');
    
    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

applyMigrations();
