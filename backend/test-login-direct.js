const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testLogin(email, password) {
  console.log(`\n🔐 Testing login for: ${email}`);
  console.log(`   Password: ${password}`);
  console.log('─'.repeat(80));

  try {
    // Get user from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, password_hash, role, status')
      .eq('email', email)
      .single();

    if (userError || !user) {
      console.log('❌ User not found in database');
      console.log('   Error:', userError?.message || 'No user data');
      return;
    }

    console.log('✅ User found in database:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Status: ${user.status}`);
    console.log(`   Has password_hash: ${user.password_hash ? 'YES' : 'NO'}`);

    if (user.password_hash) {
      console.log(`   Hash preview: ${user.password_hash.substring(0, 30)}...`);
      console.log(`   Hash length: ${user.password_hash.length}`);
    }

    if (!user.password_hash) {
      console.log('\n❌ No password_hash in users table!');
      return;
    }

    // Test password comparison
    console.log('\n🔍 Testing password comparison...');
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (passwordMatch) {
      console.log('✅ PASSWORD MATCHES! Login should work.');
    } else {
      console.log('❌ PASSWORD DOES NOT MATCH!');
      console.log('   The password_hash in the database does not match the provided password.');
      console.log('   This means either:');
      console.log('   1. The password is incorrect');
      console.log('   2. The hash was not copied correctly from auth.users');
      console.log('   3. The user needs to reset their password');
    }

  } catch (error) {
    console.error('❌ Error during test:', error);
  }
}

// Test with the user's credentials
const testEmail = 'kipchirchirtoo01@gmail.com';
const testPassword = 'Allan@13900';

console.log('🧪 LOGIN TEST');
console.log('═'.repeat(80));

testLogin(testEmail, testPassword).then(() => {
  console.log('\n═'.repeat(80));
  console.log('Test complete\n');
});
