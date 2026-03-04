require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPettyCashRequest() {
  console.log('Testing Petty Cash Request...\n');

  // 1. Check if petty_cash_transactions table exists
  console.log('1. Checking petty_cash_transactions table...');
  const { data: tableCheck, error: tableError } = await supabase
    .from('petty_cash_transactions')
    .select('*')
    .limit(1);

  if (tableError) {
    console.error('❌ Table check failed:', tableError.message);
    console.log('\nTable might not exist or have permission issues.');
    return;
  }
  console.log('✅ Table exists and is accessible\n');

  // 2. Get a test user (receptionist)
  console.log('2. Finding a receptionist user...');
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, email, role, branch_id, first_name, last_name')
    .eq('role', 'receptionist')
    .limit(1);

  if (userError || !users || users.length === 0) {
    console.error('❌ No receptionist user found');
    return;
  }

  const testUser = users[0];
  console.log('✅ Found user:', {
    id: testUser.id,
    email: testUser.email,
    role: testUser.role,
    branch_id: testUser.branch_id
  });
  console.log('');

  // 3. Try to insert a test petty cash request
  console.log('3. Attempting to insert petty cash request...');
  const testRequest = {
    branch_id: testUser.branch_id,
    amount: 5000,
    category: 'Office Stationery',
    description: 'Test request for office supplies',
    requested_by: testUser.id,
    date: new Date().toISOString(),
    status: 'pending'
  };

  console.log('Request data:', testRequest);

  const { data: insertedRequest, error: insertError } = await supabase
    .from('petty_cash_transactions')
    .insert([testRequest])
    .select()
    .single();

  if (insertError) {
    console.error('❌ Insert failed:', insertError.message);
    console.error('Error details:', insertError);
    
    // Check table structure
    console.log('\n4. Checking table structure...');
    const { data: columns } = await supabase
      .rpc('get_table_columns', { table_name: 'petty_cash_transactions' })
      .catch(() => ({ data: null }));
    
    if (columns) {
      console.log('Table columns:', columns);
    } else {
      console.log('Could not retrieve table structure');
    }
    
    return;
  }

  console.log('✅ Request inserted successfully!');
  console.log('Inserted request:', insertedRequest);
  console.log('');

  // 4. Clean up - delete the test request
  console.log('4. Cleaning up test data...');
  const { error: deleteError } = await supabase
    .from('petty_cash_transactions')
    .delete()
    .eq('id', insertedRequest.id);

  if (deleteError) {
    console.error('⚠️  Could not delete test request:', deleteError.message);
  } else {
    console.log('✅ Test data cleaned up');
  }

  console.log('\n✅ All tests passed! Petty cash request functionality is working.');
}

testPettyCashRequest().catch(console.error);
