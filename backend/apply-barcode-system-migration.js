/**
 * Apply Barcode System Migration
 * 
 * This script applies the Central Store Scanning & Inventory Workflow migration
 * which creates tables for:
 * - Item barcodes
 * - Dispatches with dual OTP system (D-XXXX for driver, B-XXXX for branch)
 * - Document storage
 * - Audit logs
 * - POS barcode integration
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function applyMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting Barcode System Migration...\n');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '20260417_create_barcode_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded:', migrationPath);
    console.log('📊 Migration size:', (migrationSQL.length / 1024).toFixed(2), 'KB\n');
    
    // Begin transaction
    await client.query('BEGIN');
    console.log('✅ Transaction started\n');
    
    // Execute migration
    console.log('⚙️  Executing migration SQL...');
    await client.query(migrationSQL);
    console.log('✅ Migration SQL executed successfully\n');
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('✅ Transaction committed\n');
    
    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'item_barcodes',
        'dispatches',
        'dispatch_items',
        'dispatch_otps',
        'dispatch_documents',
        'dispatch_audit_log',
        'auditor_reviews',
        'pos_barcodes'
      )
      ORDER BY table_name;
    `);
    
    console.log('\n📋 Tables created:');
    tableCheck.rows.forEach(row => {
      console.log('  ✓', row.table_name);
    });
    
    // Verify functions were created
    console.log('\n🔍 Verifying functions...');
    const functionCheck = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name IN (
        'generate_barcode',
        'generate_otp',
        'generate_dispatch_number',
        'set_dispatch_number',
        'log_dispatch_status_change'
      )
      ORDER BY routine_name;
    `);
    
    console.log('\n⚙️  Functions created:');
    functionCheck.rows.forEach(row => {
      console.log('  ✓', row.routine_name);
    });
    
    // Verify RLS is enabled
    console.log('\n🔍 Verifying Row Level Security...');
    const rlsCheck = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN (
        'item_barcodes',
        'dispatches',
        'dispatch_items',
        'dispatch_otps',
        'dispatch_documents',
        'dispatch_audit_log',
        'auditor_reviews',
        'pos_barcodes'
      )
      ORDER BY tablename;
    `);
    
    console.log('\n🔒 RLS Status:');
    rlsCheck.rows.forEach(row => {
      const status = row.rowsecurity ? '✓ Enabled' : '✗ Disabled';
      console.log(`  ${status}`, row.tablename);
    });
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('  1. Create Supabase Storage bucket: dispatch-documents');
    console.log('  2. Set bucket size limit to 5MB');
    console.log('  3. Configure bucket permissions for authenticated users');
    console.log('  4. Test barcode generation: SELECT generate_barcode(\'ITEM\');');
    console.log('  5. Test OTP generation: SELECT generate_otp(\'D\'), generate_otp(\'B\');');
    console.log('  6. Test dispatch number generation: SELECT generate_dispatch_number();');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed!');
    console.error('Error:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
applyMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
