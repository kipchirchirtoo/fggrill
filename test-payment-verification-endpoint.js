require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testEndpoint() {
  console.log('Testing payment_verifications table and queries...\n');

  // Test 1: Simple select
  console.log('1. Testing simple select...');
  const { data: simpleData, error: simpleError } = await supabase
    .from('payment_verifications')
    .select('*')
    .limit(5);

  if (simpleError) {
    console.error('❌ Simple select failed:', simpleError.message);
    return;
  }
  console.log('✅ Simple select works! Found', simpleData.length, 'records');

  // Test 2: Select with joins (without FK hints)
  console.log('\n2. Testing select with joins (no FK hints)...');
  const { data: joinData, error: joinError } = await supabase
    .from('payment_verifications')
    .select(`
      *,
      recorded_by_user:users(id, full_name, role),
      accountant_verified_by_user:users(id, full_name, role),
      auditor_verified_by_user:users(id, full_name, role),
      branch:branches(id, name)
    `)
    .limit(5);

  if (joinError) {
    console.error('❌ Join query failed:', joinError.message);
    console.error('Error details:', joinError);
  } else {
    console.log('✅ Join query works! Found', joinData.length, 'records');
  }

  // Test 3: Test with filters (like the actual API call)
  console.log('\n3. Testing with filters (branch_id=2, status=pending)...');
  const { data: filterData, error: filterError } = await supabase
    .from('payment_verifications')
    .select(`
      *,
      recorded_by_user:users(id, full_name, role),
      accountant_verified_by_user:users(id, full_name, role),
      auditor_verified_by_user:users(id, full_name, role),
      branch:branches(id, name)
    `)
    .eq('branch_id', 2)
    .eq('status', 'pending')
    .order('recorded_at', { ascending: false });

  if (filterError) {
    console.error('❌ Filter query failed:', filterError.message);
    console.error('Error details:', filterError);
  } else {
    console.log('✅ Filter query works! Found', filterData.length, 'records');
  }

  // Test 4: Test stats query
  console.log('\n4. Testing stats query...');
  const { data: statsData, error: statsError } = await supabase
    .from('payment_verifications')
    .select('*')
    .eq('branch_id', 2);

  if (statsError) {
    console.error('❌ Stats query failed:', statsError.message);
  } else {
    console.log('✅ Stats query works! Found', statsData.length, 'records');
    const stats = {
      total: statsData.length,
      pending: statsData.filter(p => p.status === 'pending').length,
      accountant_verified: statsData.filter(p => p.status === 'accountant_verified').length,
      auditor_verified: statsData.filter(p => p.status === 'auditor_verified').length,
    };
    console.log('Stats:', stats);
  }

  // Test 5: Check if users and branches tables exist
  console.log('\n5. Checking related tables...');
  
  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('id, full_name, role')
    .limit(1);
  
  if (usersError) {
    console.error('⚠️  Users table issue:', usersError.message);
  } else {
    console.log('✅ Users table accessible');
  }

  const { data: branchesData, error: branchesError } = await supabase
    .from('branches')
    .select('id, name')
    .limit(1);
  
  if (branchesError) {
    console.error('⚠️  Branches table issue:', branchesError.message);
  } else {
    console.log('✅ Branches table accessible');
  }

  console.log('\n✅ All tests completed!');
}

testEndpoint().catch(console.error);
