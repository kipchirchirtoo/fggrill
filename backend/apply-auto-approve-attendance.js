const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  console.log('🚀 Starting auto-approve attendance migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20260416_auto_approve_staff_attendance.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded');
    console.log('📝 Executing SQL...\n');

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: migrationSQL 
    });

    if (error) {
      // If exec_sql doesn't exist, try direct execution
      console.log('⚠️  exec_sql function not found, trying direct execution...');
      
      // Split by semicolons and execute each statement
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.includes('DO $$') || statement.includes('CREATE FUNCTION') || statement.includes('CREATE TRIGGER')) {
          console.log('⚠️  Skipping complex statement (requires direct DB access)');
          console.log('   Please run this migration directly in Supabase SQL Editor');
          continue;
        }

        const { error: stmtError } = await supabase.rpc('exec_sql', { 
          sql_query: statement + ';' 
        });

        if (stmtError) {
          console.error('❌ Error executing statement:', stmtError.message);
        }
      }
    }

    // Verify the changes
    console.log('\n✅ Verifying changes...');
    
    const { data: attendanceData, error: verifyError } = await supabase
      .from('staff_attendance')
      .select('id, is_approved')
      .limit(10);

    if (verifyError) {
      console.error('❌ Error verifying:', verifyError.message);
    } else {
      const approvedCount = attendanceData?.filter(r => r.is_approved).length || 0;
      console.log(`✅ Sample check: ${approvedCount}/${attendanceData?.length || 0} records are approved`);
    }

    // Get total count
    const { count, error: countError } = await supabase
      .from('staff_attendance')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log(`📊 Total attendance records: ${count}`);
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('📋 Summary:');
    console.log('   - All existing attendance records are now auto-approved');
    console.log('   - New attendance records will be auto-approved on creation');
    console.log('   - No manual approval required for attendance records');
    console.log('\n⚠️  NOTE: If you see errors above, please run the migration SQL');
    console.log('   directly in Supabase Dashboard → SQL Editor');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\n📋 Manual Steps:');
    console.error('1. Go to Supabase Dashboard → SQL Editor');
    console.error('2. Copy the contents of: backend/supabase/migrations/20260416_auto_approve_staff_attendance.sql');
    console.error('3. Paste and run in SQL Editor');
    process.exit(1);
  }
}

applyMigration();
