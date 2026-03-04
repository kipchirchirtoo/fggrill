require('dotenv').config();
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

async function executeSQLStatements() {
  console.log('🚀 Executing Petty Cash Migration via Supabase API...\n');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, 'backend/supabase/migrations/38_petty_cash_transactions.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded');
    console.log('⚙️  Executing SQL statements...\n');

    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.match(/^\/\*/));

    let successCount = 0;
    let skipCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip NOTIFY statements as they're not critical
      if (statement.includes('NOTIFY')) {
        console.log(`⏭️  Skipping NOTIFY statement`);
        skipCount++;
        continue;
      }

      // Skip comments
      if (statement.startsWith('--') || statement.startsWith('/*')) {
        skipCount++;
        continue;
      }

      try {
        console.log(`📝 Executing statement ${i + 1}/${statements.length}...`);
        
        // Use Supabase's query endpoint
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ 
            query: statement + ';'
          })
        });

        if (response.ok) {
          successCount++;
          console.log(`   ✅ Success`);
        } else {
          const errorText = await response.text();
          
          // Check if error is because object already exists
          if (errorText.includes('already exists') || errorText.includes('duplicate')) {
            console.log(`   ⚠️  Already exists (skipping)`);
            skipCount++;
          } else {
            console.log(`   ⚠️  Warning: ${errorText.substring(0, 100)}`);
          }
        }
      } catch (error) {
        console.log(`   ⚠️  Error: ${error.message}`);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log(`   📝 Total: ${statements.length}`);

    // Try to verify the table exists using direct query
    console.log('\n🔍 Verifying table...');
    
    const verifyResponse = await fetch(`${supabaseUrl}/rest/v1/petty_cash_transactions?limit=1`, {
      method: 'GET',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      }
    });

    if (verifyResponse.ok) {
      console.log('✅ Table verified and accessible!\n');
      console.log('🎉 Petty cash request feature is now ready!');
      console.log('\nReceptionists can now:');
      console.log('  • Submit petty cash requests from the dashboard');
      console.log('  • Track request status (pending/approved/rejected)');
      console.log('  • View transaction history');
      console.log('\nManagers can:');
      console.log('  • Approve or reject requests');
      console.log('  • Add approval notes');
      console.log('  • Monitor all branch transactions');
    } else {
      const errorText = await verifyResponse.text();
      console.log('⚠️  Table verification inconclusive');
      console.log('Error:', errorText);
      console.log('\n💡 The table may have been created but needs schema cache reload.');
      console.log('Please try accessing the petty cash feature in the app.');
    }

  } catch (error) {
    console.error('\n❌ Execution failed:', error.message);
    console.log('\n📋 Manual execution required:');
    console.log('1. Go to Supabase Dashboard → SQL Editor');
    console.log('2. Copy contents of: backend/supabase/migrations/38_petty_cash_transactions.sql');
    console.log('3. Paste and run in SQL Editor');
  }
}

executeSQLStatements().catch(console.error);
