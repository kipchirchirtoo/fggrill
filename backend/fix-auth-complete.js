const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const supabase = createClient(
  'https://utsvlihpudfraxzcmtle.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:kyogong2024!@aws-0-eu-central-1.pooler.supabase.com:6543/postgres'
});

async function fixAuthIssue() {
  const email = 'kipchirchirtoo01@gmail.com';
  const defaultPassword = 'kyogong2024!'; // Default password - user should change after login
  
  console.log('='.repeat(60));
  console.log('AUTH FIX SCRIPT - Comprehensive Diagnosis & Repair');
  console.log('='.repeat(60));
  console.log(`\nTarget User: ${email}\n`);
  
  try {
    // Step 1: Check if user exists in public.users table
    console.log('Step 1: Checking public.users table...');
    const { data: publicUser, error: publicError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (publicError || !publicUser) {
      console.error('❌ User NOT found in public.users table');
      console.log('\nSolution: Create the user first in the system');
      return;
    }
    
    console.log('✅ User found in public.users:');
    console.log(`   - ID: ${publicUser.id}`);
    console.log(`   - Name: ${publicUser.first_name} ${publicUser.last_name}`);
    console.log(`   - Role: ${publicUser.role}`);
    console.log(`   - Branch ID: ${publicUser.branch_id}`);
    
    // Step 2: Check if user exists in auth.users table
    console.log('\nStep 2: Checking auth.users table...');
    const authCheckQuery = `
      SELECT id, email, encrypted_password, email_confirmed_at, created_at
      FROM auth.users
      WHERE id = $1
    `;
    
    const authResult = await pool.query(authCheckQuery, [publicUser.id]);
    
    if (authResult.rows.length === 0) {
      console.log('❌ User NOT found in auth.users table');
      console.log('\nStep 3: Creating auth user...');
      
      // Create auth user using Supabase Admin API
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: {
          first_name: publicUser.first_name,
          last_name: publicUser.last_name,
          role: publicUser.role
        }
      });
      
      if (authError) {
        console.error('❌ Error creating auth user:', authError.message);
        
        // Try alternative method: Direct database insert
        console.log('\nStep 4: Trying direct database method...');
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        
        const insertQuery = `
          INSERT INTO auth.users (
            id, email, encrypted_password, email_confirmed_at, 
            created_at, updated_at, raw_user_meta_data, aud, role
          ) VALUES (
            $1, $2, $3, NOW(), NOW(), NOW(), 
            $4::jsonb, 'authenticated', 'authenticated'
          )
          ON CONFLICT (id) DO UPDATE SET
            encrypted_password = EXCLUDED.encrypted_password,
            email_confirmed_at = NOW(),
            updated_at = NOW()
          RETURNING id, email
        `;
        
        const metadata = JSON.stringify({
          first_name: publicUser.first_name,
          last_name: publicUser.last_name,
          role: publicUser.role
        });
        
        const insertResult = await pool.query(insertQuery, [
          publicUser.id,
          email,
          hashedPassword,
          metadata
        ]);
        
        if (insertResult.rows.length > 0) {
          console.log('✅ Auth user created via direct database insert');
          console.log(`   - ID: ${insertResult.rows[0].id}`);
          console.log(`   - Email: ${insertResult.rows[0].email}`);
        }
      } else {
        console.log('✅ Auth user created successfully');
        console.log(`   - ID: ${authUser.user.id}`);
        console.log(`   - Email: ${authUser.user.email}`);
      }
    } else {
      const authUser = authResult.rows[0];
      console.log('✅ User found in auth.users:');
      console.log(`   - ID: ${authUser.id}`);
      console.log(`   - Email: ${authUser.email}`);
      console.log(`   - Email Confirmed: ${authUser.email_confirmed_at ? 'Yes' : 'No'}`);
      console.log(`   - Has Password: ${authUser.encrypted_password ? 'Yes' : 'No'}`);
      
      if (!authUser.encrypted_password) {
        console.log('\n❌ Password is missing! Updating...');
        
        // Update password
        const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
          publicUser.id,
          { password: defaultPassword }
        );
        
        if (updateError) {
          console.error('❌ Error updating password:', updateError.message);
          
          // Try direct database update
          console.log('\nTrying direct database password update...');
          const hashedPassword = await bcrypt.hash(defaultPassword, 10);
          
          const updateQuery = `
            UPDATE auth.users 
            SET encrypted_password = $1, updated_at = NOW()
            WHERE id = $2
            RETURNING id
          `;
          
          const updateResult = await pool.query(updateQuery, [hashedPassword, publicUser.id]);
          
          if (updateResult.rows.length > 0) {
            console.log('✅ Password updated via direct database');
          }
        } else {
          console.log('✅ Password updated successfully');
        }
      }
      
      if (!authUser.email_confirmed_at) {
        console.log('\n⚠️  Email not confirmed. Confirming...');
        
        const confirmQuery = `
          UPDATE auth.users 
          SET email_confirmed_at = NOW(), updated_at = NOW()
          WHERE id = $1
          RETURNING id
        `;
        
        await pool.query(confirmQuery, [publicUser.id]);
        console.log('✅ Email confirmed');
      }
    }
    
    // Step 5: Test login
    console.log('\n' + '='.repeat(60));
    console.log('Step 5: Testing login...');
    console.log('='.repeat(60));
    
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: email,
      password: defaultPassword
    });
    
    if (loginError) {
      console.error('❌ Login test failed:', loginError.message);
      console.log('\nTroubleshooting:');
      console.log('1. Check if the password is correct');
      console.log('2. Verify email is confirmed in auth.users');
      console.log('3. Check database connection');
    } else {
      console.log('✅ LOGIN TEST SUCCESSFUL!');
      console.log(`   - User ID: ${loginData.user.id}`);
      console.log(`   - Email: ${loginData.user.email}`);
      console.log(`   - Session expires: ${new Date(loginData.session.expires_at * 1000).toLocaleString()}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Email: ${email}`);
    console.log(`Default Password: ${defaultPassword}`);
    console.log('\n⚠️  IMPORTANT: Change this password after first login!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

fixAuthIssue().catch(console.error);
