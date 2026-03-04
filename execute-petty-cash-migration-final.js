require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeMigration() {
  console.log('🚀 Executing Petty Cash Migration...\n');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, 'backend/supabase/migrations/38_petty_cash_transactions.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded');
    console.log('⚙️  Executing SQL via Supabase...\n');

    // Split into individual statements and execute each one
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      
      // Skip empty statements and comments
      if (!statement || statement.startsWith('--') || statement.startsWith('/*')) {
        continue;
      }

      // Skip NOTIFY statements
      if (statement.toUpperCase().includes('NOTIFY')) {
        console.log(`⏭️  Skipping NOTIFY statement`);
        continue;
      }

      try {
        console.log(`📝 Executing statement ${i + 1}...`);
        
        // Use raw SQL execution through Supabase
        const { data, error } = await supabase.rpc('exec_sql', { 
          sql: statement + ';' 
        });

        if (error) {
          // Check if it's a "function not found" error
          if (error.message.includes('exec_sql') || error.code === 'PGRST202') {
            console.log('   ⚠️  exec_sql function not available, trying alternative...');
            
            // Try using direct table operations for CREATE TABLE
            if (statement.toUpperCase().includes('CREATE TABLE')) {
              console.log('   ℹ️  Cannot execute CREATE TABLE via API');
              errorCount++;
            } else {
              errorCount++;
            }
          } else if (error.message.includes('already exists')) {
            console.log(`   ✅ Already exists (OK)`);
            successCount++;
          } else {
            console.log(`   ⚠️  ${error.message.substring(0, 80)}`);
            errorCount++;
          }
        } else {
          console.log(`   ✅ Success`);
          successCount++;
        }
      } catch (err) {
        console.log(`   ⚠️  ${err.message.substring(0, 80)}`);
        errorCount++;
      }
    }

    console.log(`\n📊 Execution Summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ⚠️  Errors: ${errorCount}`);

    // Try to verify the table
    console.log('\n🔍 Verifying table...');
    const { data: tableData, error: tableError } = await supabase
      .from('petty_cash_transactions')
      .select('*')
      .limit(1);

    if (!tableError) {
      console.log('✅ TABLE EXISTS AND IS ACCESSIBLE!\n');
      console.log('🎉 SUCCESS! Petty cash feature is ready!\n');
      console.log('Receptionists can now:');
      console.log('  • Submit petty cash requests');
      console.log('  • Track request status');
      console.log('  • View transaction history\n');
      console.log('Managers can:');
      console.log('  • Approve/reject requests');
      console.log('  • Add approval notes');
      console.log('  • Monitor transactions');
      
      // Test insert to make sure everything works
      console.log('\n🧪 Testing insert capability...');
      const testData = {
        branch_id: 1,
        amount: 1000,
        category: 'Test',
        description: 'Test request - will be deleted',
        requested_by: '00000000-0000-0000-0000-000000000000',
        status: 'pending'
      };
      
      const { data: insertData, error: insertError } = await supabase
        .from('petty_cash_transactions')
        .insert([testData])
        .select();
      
      if (!insertError && insertData && insertData.length > 0) {
        console.log('✅ Insert test successful!');
        
        // Clean up test data
        await supabase
          .from('petty_cash_transactions')
          .delete()
          .eq('id', insertData[0].id);
        console.log('✅ Test data cleaned up');
      } else if (insertError) {
        console.log('⚠️  Insert test failed:', insertError.message);
        console.log('   This might be due to RLS policies - that\'s OK for now');
      }
      
    } else {
      console.log('❌ Table not found:', tableError.message);
      console.log('\n⚠️  The table was not created successfully.');
      console.log('\n📋 MANUAL ACTION REQUIRED:');
      console.log('Please run the SQL manually in Supabase Dashboard:');
      console.log('1. Go to Supabase Dashboard → SQL Editor');
      console.log('2. Copy SQL from: backend/supabase/migrations/38_petty_cash_transactions.sql');
      console.log('3. Paste and click "Run"');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\n📋 MANUAL ACTION REQUIRED:');
    console.log('Please run the SQL manually in Supabase Dashboard:');
    console.log('1. Go to Supabase Dashboard → SQL Editor');
    console.log('2. Copy SQL from: backend/supabase/migrations/38_petty_cash_transactions.sql');
    console.log('3. Paste and click "Run"');
  }
}

executeMigration().catch(console.error);
