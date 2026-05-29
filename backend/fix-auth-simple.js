const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://utsvlihpudfraxzcmtle.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixAuth() {
  const email = 'kipchirchirtoo01@gmail.com';
  const password = 'kyogong2024!'; // Default password
  
  console.log('='.repeat(60));
  console.log('AUTH FIX - Simple Method');
  console.log('='.repeat(60));
  console.log(`\nFixing auth for: ${email}\n`);
  
  try {
    // Step 1: Get user from public.users
    console.log('Step 1: Checking user in database...');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (userError || !user) {
      console.error('❌ User not found in database');
      return;
    }
    
    console.log('✅ User found:');
    console.log(`   - ID: ${user.id}`);
    console.log(`   - Name: ${user.first_name} ${user.last_name}`);
    console.log(`   - Role: ${user.role}`);
    
    // Step 2: Try to create auth user
    console.log('\nStep 2: Creating/updating auth user...');
    
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      }
    });
    
    if (authError) {
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        console.log('⚠️  User already exists in auth, updating password...');
        
        // Update existing user
        const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
          user.id,
          { 
            password: password,
            email_confirm: true
          }
        );
        
        if (updateError) {
          console.error('❌ Failed to update password:', updateError.message);
          return;
        }
        
        console.log('✅ Password updated successfully');
      } else {
        console.error('❌ Error:', authError.message);
        return;
      }
    } else {
      console.log('✅ Auth user created successfully');
    }
    
    // Step 3: Test login
    console.log('\nStep 3: Testing login...');
    
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });
    
    if (loginError) {
      console.error('❌ Login failed:', loginError.message);
      console.log('\nPossible issues:');
      console.log('- Password might be different');
      console.log('- Email not confirmed');
      console.log('- Account might be disabled');
    } else {
      console.log('✅ LOGIN SUCCESSFUL!');
      console.log(`   - User: ${loginData.user.email}`);
      console.log(`   - Session valid until: ${new Date(loginData.session.expires_at * 1000).toLocaleString()}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('CREDENTIALS');
    console.log('='.repeat(60));
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log('\n⚠️  Change this password after logging in!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  }
}

fixAuth().catch(console.error);
