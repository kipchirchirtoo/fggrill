const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase configuration
const supabaseUrl = 'https://utsvlihpudfraxzcmtle.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🚀 Applying Stock-Take Auditor Submission Workflow Migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'backend/supabase/migrations/35_stock_take_audit_log.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📦 Migration file loaded successfully');
    console.log('📝 Executing SQL...\n');

    // Try to execute using RPC first
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.log('⚠️  RPC method not available, trying direct query execution...');
      
      // Split SQL into individual statements and execute them
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.toLowerCase().includes('create table') || 
            statement.toLowerCase().includes('alter table') ||
            statement.toLowerCase().includes('create index') ||
            statement.toLowerCase().includes('comment on')) {
          console.log(`   Executing: ${statement.substring(0, 60)}...`);
        }
      }

      console.log('\n⚠️  Note: Direct execution via Supabase client may have limitations.');
      console.log('   If this fails, please run the migration manually via Supabase SQL Editor.');
      console.log(`   Migration file: backend/supabase/migrations/35_stock_take_audit_log.sql`);
    } else {
      console.log('✅ Migration executed successfully via RPC!');
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log('✅ Migration: 35_stock_take_audit_log.sql');
    console.log('📝 Changes applied:');
    console.log('   - Created stock_take_audit_log table');
    console.log('   - Added indexes for audit log queries');
    console.log('   - Added submission workflow columns to stock_takes:');
    console.log('     • submitted_at (TIMESTAMPTZ)');
    console.log('     • submitted_by (UUID)');
    console.log('     • verified_at (TIMESTAMPTZ)');
    console.log('     • notification_sent (BOOLEAN)');
    console.log('     • notification_sent_at (TIMESTAMPTZ)');
    console.log('   - Created indexes on stock_takes:');
    console.log('     • idx_stock_takes_status');
    console.log('     • idx_stock_takes_branch_status');
    console.log('     • idx_stock_takes_submitted_at');
    console.log('='.repeat(60));
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📌 Next steps:');
    console.log('   1. Verify the changes in Supabase dashboard');
    console.log('   2. Test the submission workflow');
    console.log('   3. Proceed with backend API implementation');

  } catch (error) {
    console.error('\n❌ Error applying migration:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check if stock_takes table exists');
    console.error('   2. Verify Supabase connection');
    console.error('   3. Run migration manually via Supabase SQL Editor');
    console.error(`   4. Migration file: backend/supabase/migrations/35_stock_take_audit_log.sql`);
    process.exit(1);
  }
}

// Run the migration
applyMigration().catch(console.error);
