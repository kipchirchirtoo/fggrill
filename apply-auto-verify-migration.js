/**
 * Apply migration 37: Stock Take Auto-Verification
 * 
 * This script applies the migration that adds automatic status transition
 * from 'submitted' to 'verified' within the submit_stock_take_with_lock function.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
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
        const migrationPath = path.join(__dirname, 'backend', 'supabase', 'migrations', '37_stock_take_auto_verify.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('🚀 Applying migration: 37_stock_take_auto_verify.sql');
        console.log('   This updates submit_stock_take_with_lock to add auto-verification\n');

        // Execute migration
        await client.query(migrationSQL);

        console.log('✅ Migration 37 applied successfully!\n');
        console.log('📋 Changes made:');
        console.log('   ✓ Updated submit_stock_take_with_lock function');
        console.log('   ✓ Added automatic status transition: submitted → verified');
        console.log('   ✓ Added verified_at timestamp setting');
        console.log('   ✓ Added audit log entry for auto-verification');
        console.log('   ✓ All changes happen within same transaction\n');
        console.log('🎯 Requirements satisfied: 3.1, 3.2, 3.3, 3.4\n');
        console.log('✨ Stock-takes will now automatically transition to "verified" status after submission!');

    } catch (error) {
        console.error('❌ Error applying migration:', error.message);
        console.error('\n📝 Manual application required:');
        console.error('   1. Open Supabase Dashboard > SQL Editor');
        console.error('   2. Copy and run the SQL from: backend/supabase/migrations/37_stock_take_auto_verify.sql');
        console.error('\n💡 Troubleshooting:');
        console.error('   1. Verify DATABASE_URL is correct in backend/.env');
        console.error('   2. Ensure migration 36_stock_take_submit_with_locking.sql was applied first');
        console.error('   3. Check database connection and permissions\n');
        process.exit(1);
    } finally {
        await client.end();
    }
}

applyMigration();
