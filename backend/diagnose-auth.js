const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function diagnose() {
  const email = 'kipchirchirtoo01@gmail.com';
  const password = 'kyogong2024!';
  
  console.log('='.repeat(60));
  console.log('AUTH DIAGNOSIS');
  console.log('='.repeat(60));
  
  try {
    // Test 1: Check Supabase connection
    console.log('\n1. Testing Supabase connection...');
    const { data: testData, error: testError } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ Supabase connection failed:', testError.message);
    } else {
      console.log('✅ Supabase connected');
    }
    
    // Test 2: Get user from Supabase
    console.log('\n2. Getting user from Supabase...');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (userError || !user) {
      console.error('❌ User not found:', userError?.message);
      return;
    }
    
    console.log('✅ User found:');
    console.log(`   - ID: ${user.id}`);
    console.log(`   - Email: ${user.email}`);
    console.log(`   - Name: ${user.first_name} ${user.last_name}`);
    console.log(`   - Role: ${user.role}`);
    console.log(`   - Has password_hash: ${user.password_hash ? 'Yes' : 'No'}`);
    
    if (user.password_hash) {
      console.log(`   - Password hash length: ${user.password_hash.length}`);
      
      // Test password match
      const isMatch = await bcrypt.compare(password, user.password_hash);
      console.log(`   - Password matches: ${isMatch ? '✅ Yes' : '❌ No'}`);
    }
    
    // Test 3: Try direct database query
    console.log('\n3. Testing direct database query...');
    try {
      const result = await pool.query(
        `SELECT 
          u.id, u.email, u.first_name, u.last_name, u.role, u.branch_id, u.status,
          u.password_hash,
          au.encrypted_password
        FROM public.users u
        LEFT JOIN auth.users au ON u.id = au.id
        WHERE u.email = $1`,
        [email]
      );
      
      if (result.rows.length > 0) {
        const row = result.rows[0];
        console.log('✅ Direct DB query successful:');
        console.log(`   - ID: ${row.id}`);
        console.log(`   - Email: ${row.email}`);
        console.log(`   - Has password_hash: ${row.password_hash ? 'Yes' : 'No'}`);
        console.log(`   - Has encrypted_password: ${row.encrypted_password ? 'Yes' : 'No'}`);
        
        const storedHash = row.password_hash || row.encrypted_password;
        if (storedHash) {
          const isMatch = await bcrypt.compare(password, storedHash);
          console.log(`   - Password matches: ${isMatch ? '✅ Yes' : '❌ No'}`);
        }
      } else {
        console.error('❌ No rows returned from direct query');
      }
    } catch (dbError) {
      console.error('❌ Direct DB query failed:', dbError.message);
    }
    
    // Test 4: Try Supabase Auth
    console.log('\n4. Testing Supabase Auth login...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });
    
    if (authError) {
      console.log('❌ Supabase Auth failed:', authError.message);
    } else {
      console.log('✅ Supabase Auth successful!');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log('If password_hash exists and matches, the backend');
    console.log('should be able to authenticate via direct DB auth.');
    console.log('\nMake sure the backend server is restarted after');
    console.log('the code changes.');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

diagnose().catch(console.error);
