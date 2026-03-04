/**
 * Diagnose Authentication Issues
 * Run this to check what's happening with auth
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log('🔍 Diagnosing Authentication Issues...\n');

  // 1. Check if users table exists and has data
  console.log('1️⃣ Checking users table...');
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, role, status, password_hash')
    .limit(5);

  if (usersError) {
    console.error('❌ Error fetching users:', usersError.message);
  } else {
    console.log(`✅ Found ${users.length} users`);
    users.forEach(user => {
      console.log(`   - ${user.email} (${user.role}) - Has password: ${!!user.password_hash}`);
    });
  }

  // 2. Check Supabase Auth users
  console.log('\n2️⃣ Checking Supabase Auth users...');
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error('❌ Error fetching auth users:', authError.message);
  } else {
    console.log(`✅ Found ${authUsers.users.length} auth users`);
    authUsers.users.slice(0, 5).forEach(user => {
      console.log(`   - ${user.email} (ID: ${user.id})`);
    });
  }

  // 3. Test a sample login
  console.log('\n3️⃣ Testing sample login...');
  if (users && users.length > 0) {
    const testUser = users[0];
    console.log(`   Testing with: ${testUser.email}`);
    
    // Try to get this user's profile
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', testUser.id)
      .single();

    if (profileError) {
      console.error('❌ Error fetching profile:', profileError.message);
    } else {
      console.log('✅ Profile fetch successful');
      console.log(`   Name: ${profile.first_name} ${profile.last_name}`);
      console.log(`   Role: ${profile.role}`);
      console.log(`   Branch: ${profile.branch_id}`);
    }
  }

  // 4. Check backend server status
  console.log('\n4️⃣ Checking backend server...');
  try {
    const response = await fetch('https://api.hirall.com/api/auth/me', {
      headers: {
        'Authorization': 'Bearer invalid-token-test'
      }
    });
    console.log(`✅ Backend is responding (Status: ${response.status})`);
    if (response.status === 401) {
      console.log('   ✅ Correctly rejecting invalid tokens');
    }
  } catch (error) {
    console.error('❌ Backend server not reachable:', error.message);
  }

  console.log('\n✅ Diagnosis complete!');
  console.log('\n📋 RECOMMENDATIONS:');
  console.log('   1. Clear browser localStorage and cookies');
  console.log('   2. Try logging in with a fresh session');
  console.log('   3. Check if the backend server is running');
  console.log('   4. Verify database connectivity');
}

diagnose().catch(console.error);
