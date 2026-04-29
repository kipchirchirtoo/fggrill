/**
 * Test script to diagnose director dashboard 403 errors
 * 
 * Usage: node test-director-auth.js
 */

const { supabase } = require('./dist/config/database');

async function testDirectorAuth() {
  console.log('\n=== Director Dashboard Auth Diagnostic ===\n');

  try {
    // 1. Check if director role exists in users table
    console.log('1. Checking for users with director role...');
    const { data: directors, error: directorError } = await supabase
      .from('users')
      .select('id, email, role, first_name, last_name')
      .eq('role', 'director');

    if (directorError) {
      console.error('❌ Error querying directors:', directorError.message);
    } else if (!directors || directors.length === 0) {
      console.log('⚠️  No users with director role found!');
      console.log('   To fix: Update a user\'s role to "director" in the database');
    } else {
      console.log(`✅ Found ${directors.length} director(s):`);
      directors.forEach(d => {
        console.log(`   - ${d.first_name} ${d.last_name} (${d.email})`);
      });
    }

    // 2. Check if daily_financial_records table exists
    console.log('\n2. Checking daily_financial_records table...');
    const { data: records, error: recordsError } = await supabase
      .from('daily_financial_records')
      .select('id')
      .limit(1);

    if (recordsError) {
      console.error('❌ Error accessing daily_financial_records:', recordsError.message);
      console.log('   To fix: Run migration 72_financial_workspace_tables.sql');
    } else {
      console.log('✅ daily_financial_records table exists');
    }

    // 3. Check if discrepancy_flags table exists
    console.log('\n3. Checking discrepancy_flags table...');
    const { data: flags, error: flagsError } = await supabase
      .from('discrepancy_flags')
      .select('id')
      .limit(1);

    if (flagsError) {
      console.error('❌ Error accessing discrepancy_flags:', flagsError.message);
      console.log('   To fix: Run migration 73_discrepancy_system.sql');
    } else {
      console.log('✅ discrepancy_flags table exists');
    }

    // 4. Check branches table
    console.log('\n4. Checking branches table...');
    const { data: branches, error: branchesError } = await supabase
      .from('branches')
      .select('id, name')
      .limit(5);

    if (branchesError) {
      console.error('❌ Error accessing branches:', branchesError.message);
    } else {
      console.log(`✅ Found ${branches?.length || 0} branches`);
      if (branches && branches.length > 0) {
        branches.forEach(b => console.log(`   - ${b.name}`));
      }
    }

    // 5. Sample data check
    console.log('\n5. Checking for sample financial data...');
    const { data: sampleData, error: sampleError } = await supabase
      .from('daily_financial_records')
      .select('id, branch_id, record_date, total_revenue')
      .limit(5);

    if (sampleError) {
      console.error('❌ Error:', sampleError.message);
    } else if (!sampleData || sampleData.length === 0) {
      console.log('⚠️  No financial records found');
      console.log('   The director dashboard will show zero values until data is entered');
    } else {
      console.log(`✅ Found ${sampleData.length} financial records`);
    }

    console.log('\n=== Diagnostic Complete ===\n');
    console.log('Common fixes for 403 errors:');
    console.log('1. Ensure your user has role="director" in the users table');
    console.log('2. Check that you\'re logged in with a director account');
    console.log('3. Verify JWT token is being sent in Authorization header');
    console.log('4. Check backend logs for detailed RBAC messages\n');

  } catch (error) {
    console.error('Fatal error:', error);
  }

  process.exit(0);
}

testDirectorAuth();
