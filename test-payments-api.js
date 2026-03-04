require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPaymentsAPI() {
  console.log('Testing Payments API...\n');

  // Test 1: Simple query without joins
  console.log('1. Testing simple query without joins...');
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .limit(5);

    if (error) {
      console.error('❌ Simple query failed:', error.message);
    } else {
      console.log('✅ Simple query works! Found', data.length, 'payments');
      if (data.length > 0) {
        console.log('Sample payment:', JSON.stringify(data[0], null, 2));
      }
    }
  } catch (err) {
    console.error('❌ Exception:', err.message);
  }

  // Test 2: Query with joins (like the controller does)
  console.log('\n2. Testing query with joins...');
  try {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        recorded_by_user:users!payments_recorded_by_fkey(id, full_name, role),
        accountant_verified_by_user:users!payments_accountant_verified_by_fkey(id, full_name, role),
        auditor_verified_by_user:users!payments_auditor_verified_by_fkey(id, full_name, role),
        branch:branches(id, name)
      `)
      .limit(5);

    if (error) {
      console.error('❌ Query with joins failed:', error.message);
      console.error('Error details:', error);
    } else {
      console.log('✅ Query with joins works! Found', data.length, 'payments');
    }
  } catch (err) {
    console.error('❌ Exception:', err.message);
  }

  // Test 3: Check if foreign keys exist
  console.log('\n3. Checking foreign key constraints...');
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          conname AS constraint_name,
          conrelid::regclass AS table_name,
          a.attname AS column_name,
          confrelid::regclass AS foreign_table_name
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
        WHERE conrelid = 'payments'::regclass
        AND contype = 'f';
      `
    });

    if (error) {
      console.log('⚠️  Cannot check constraints (RPC might not exist)');
    } else {
      console.log('Foreign keys:', data);
    }
  } catch (err) {
    console.log('⚠️  Cannot check constraints:', err.message);
  }

  // Test 4: Try query without foreign key hints
  console.log('\n4. Testing query without foreign key hints...');
  try {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        recorded_by_user:users(id, full_name, role),
        branch:branches(id, name)
      `)
      .limit(5);

    if (error) {
      console.error('❌ Query without FK hints failed:', error.message);
    } else {
      console.log('✅ Query without FK hints works! Found', data.length, 'payments');
    }
  } catch (err) {
    console.error('❌ Exception:', err.message);
  }

  // Test 5: Check table structure
  console.log('\n5. Checking payments table structure...');
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .limit(0);

    if (error) {
      console.error('❌ Cannot check structure:', error.message);
    } else {
      console.log('✅ Table exists and is accessible');
    }
  } catch (err) {
    console.error('❌ Exception:', err.message);
  }
}

testPaymentsAPI().catch(console.error);
