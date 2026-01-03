require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createKitchenUser() {
  try {
    console.log('Creating kitchen user in Supabase Auth...');
    
    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'kitchen@famousgate.com',
      password: 'Allan@13900',
      email_confirm: true,
      user_metadata: {
        first_name: 'Kitchen',
        last_name: 'Staff'
      }
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      throw authError;
    }

    console.log('✓ Auth user created:', authData.user.id);

    // Create user profile in public.users table
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .insert([
        {
          id: authData.user.id,
          email: 'kitchen@famousgate.com',
          first_name: 'Kitchen',
          last_name: 'Staff',
          role: 'kitchen',
          branch_id: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (profileError) {
      console.error('Error creating user profile:', profileError);
      // Try to clean up auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    console.log('✓ User profile created');
    console.log('\n=== Kitchen User Created Successfully ===');
    console.log('Email: kitchen@famousgate.com');
    console.log('Password: Allan@13900');
    console.log('Role: kitchen');
    console.log('Branch ID: 1');
    console.log('User ID:', authData.user.id);
    console.log('=========================================\n');

  } catch (error) {
    console.error('Failed to create kitchen user:', error);
    process.exit(1);
  }
}

createKitchenUser();
