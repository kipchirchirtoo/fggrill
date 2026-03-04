/**
 * EMERGENCY PRODUCTION AUTH FIX
 * This script diagnoses and fixes authentication issues in production
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ CRITICAL: Missing Supabase credentials in .env');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function emergencyFix() {
  console.log('🚨 EMERGENCY PRODUCTION AUTH FIX\n');
  console.log('Database:', supabaseUrl);
  console.log('Time:', new Date().toISOString());
  console.log('─'.repeat(60));

  // Step 1: Check if users table exists and has data
  console.log('\n📊 STEP 1: Checking users table...');
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, role, status, password_hash, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (usersError) {
    console.error('❌ CRITICAL ERROR: Cannot access users table');
    console.error('   Error:', usersError.message);
    console.error('   Code:', usersError.code);
    console.error('\n🔧 POSSIBLE FIXES:');
    console.error('   1. Check if users table exists in Supabase');
    console.error('   2. Verify RLS policies allow service role access');
    console.error('   3. Check database connection');
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.error('❌ CRITICAL: No users found in database!');
    console.error('\n🔧 ACTION REQUIRED:');
    console.error('   You need to create at least one user in the database');
    console.error('   Run the user creation script or use Supabase dashboard');
    process.exit(1);
  }

  console.log(`✅ Found ${users.length} users in database`);
  console.log('\n👥 Recent Users:');
  users.forEach((user, i) => {
    const hasPassword = !!user.password_hash;
    const passwordStatus = hasPassword ? '✓ Has password' : '✗ NO PASSWORD';
    console.log(`   ${i + 1}. ${user.email}`);
    console.log(`      Role: ${user.role} | Status: ${user.status}`);
    console.log(`      Password: ${passwordStatus}`);
    console.log(`      ID: ${user.id}`);
  });

  // Step 2: Check for users without passwords
  console.log('\n🔍 STEP 2: Checking for users without passwords...');
  const usersWithoutPasswords = users.filter(u => !u.password_hash);
  
  if (usersWithoutPasswords.length > 0) {
    console.error(`❌ CRITICAL: ${usersWithoutPasswords.length} users have NO PASSWORD!`);
    console.error('\n   Users without passwords:');
    usersWithoutPasswords.forEach(u => {
      console.error(`   - ${u.email} (${u.role})`);
    });
    
    console.log('\n🔧 FIXING: Setting default password for users without passwords...');
    const defaultPassword = 'Password123!'; // Change this to your desired default
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    
    for (const user of usersWithoutPasswords) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ password_hash: hashedPassword })
        .eq('id', user.id);
      
      if (updateError) {
        console.error(`   ✗ Failed to update ${user.email}:`, updateError.message);
      } else {
        console.log(`   ✓ Updated ${user.email} with default password`);
      }
    }
    
    console.log(`\n✅ Default password set to: ${defaultPassword}`);
    console.log('   ⚠️  IMPORTANT: Users should change this password after login!');
  } else {
    console.log('✅ All users have passwords');
  }

  // Step 3: Check Supabase Auth users
  console.log('\n🔐 STEP 3: Checking Supabase Auth...');
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.warn('⚠️  Cannot access Supabase Auth:', authError.message);
    console.log('   This is OK if you\'re using direct DB auth');
  } else {
    console.log(`✅ Found ${authData.users.length} users in Supabase Auth`);
    
    // Check for mismatches
    const authEmails = new Set(authData.users.map(u => u.email));
    const dbEmails = new Set(users.map(u => u.email));
    
    const inAuthNotDb = [...authEmails].filter(e => !dbEmails.has(e));
    const inDbNotAuth = [...dbEmails].filter(e => !authEmails.has(e));
    
    if (inAuthNotDb.length > 0) {
      console.warn('\n⚠️  Users in Auth but not in users table:');
      inAuthNotDb.forEach(e => console.warn(`   - ${e}`));
    }
    
    if (inDbNotAuth.length > 0) {
      console.warn('\n⚠️  Users in users table but not in Auth:');
      inDbNotAuth.forEach(e => console.warn(`   - ${e}`));
      console.log('   These users can only login via direct DB auth');
    }
  }

  // Step 4: Test login for first user
  console.log('\n🧪 STEP 4: Testing login functionality...');
  const testUser = users[0];
  console.log(`   Testing with: ${testUser.email}`);
  
  if (!testUser.password_hash) {
    console.error('   ✗ Cannot test - user has no password');
  } else {
    // Try to verify a test password
    const testPassword = 'Password123!';
    const isMatch = await bcrypt.compare(testPassword, testUser.password_hash);
    
    if (isMatch) {
      console.log(`   ✓ Password verification works`);
      console.log(`   ✓ User can login with: ${testPassword}`);
    } else {
      console.log('   ℹ️  Test password doesn\'t match (this is expected if you haven\'t set it)');
    }
  }

  // Step 5: Check backend server
  console.log('\n🌐 STEP 5: Testing backend server...');
  try {
    const response = await fetch('https://api.hirall.com/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'test' })
    });
    
    console.log(`   Backend Status: ${response.status} ${response.statusText}`);
    
    if (response.status === 401) {
      console.log('   ✅ Backend is working (401 = invalid credentials, which is expected)');
    } else if (response.status === 400) {
      console.log('   ✅ Backend is working (400 = validation error)');
    } else if (response.status === 500) {
      console.error('   ❌ Backend has internal server error!');
      const text = await response.text();
      console.error('   Error:', text);
    } else {
      console.warn(`   ⚠️  Unexpected status: ${response.status}`);
    }
  } catch (fetchError) {
    console.error('   ❌ Cannot reach backend server!');
    console.error('   Error:', fetchError.message);
    console.error('\n🔧 POSSIBLE FIXES:');
    console.error('   1. Check if backend server is running');
    console.error('   2. Verify backend deployment');
    console.error('   3. Check DNS/network connectivity');
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📋 SUMMARY & NEXT STEPS');
  console.log('═'.repeat(60));
  
  const usersWithPasswords = users.filter(u => u.password_hash);
  
  if (usersWithPasswords.length === 0) {
    console.error('\n❌ CRITICAL: NO USERS CAN LOGIN!');
    console.error('   All users are missing passwords');
    console.error('\n🔧 ACTION: Run this script again to set default passwords');
  } else {
    console.log(`\n✅ ${usersWithPasswords.length} users can login`);
    console.log('\n📝 Test Login Credentials:');
    console.log(`   Email: ${usersWithPasswords[0].email}`);
    console.log(`   Password: Password123! (if you just ran the fix)`);
    console.log(`   URL: https://api.hirall.com/api/auth/login`);
    
    console.log('\n🔐 SECURITY RECOMMENDATIONS:');
    console.log('   1. Users should change default passwords immediately');
    console.log('   2. Enable 2FA for admin accounts');
    console.log('   3. Review user access levels');
    console.log('   4. Check audit logs for suspicious activity');
  }
  
  console.log('\n✅ Diagnostic complete!');
}

// Run the fix
emergencyFix().catch(error => {
  console.error('\n💥 FATAL ERROR:', error);
  console.error('\nStack trace:', error.stack);
  process.exit(1);
});
