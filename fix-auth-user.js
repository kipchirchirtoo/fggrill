const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
  'https://utsvlihpudfraxzcmtle.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY'
);

async function fixAuthUser() {
  const email = 'kipchirchirtoo01@gmail.com';
  const password = 'your_password_here'; // You'll need to provide the actual password
  
  console.log('Fixing auth for user:', email);
  
  // 1. Check if user exists in users table
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  
  if (userError || !user) {
    console.error('User not found in users table:', userError);
    return;
  }
  
  console.log('User found in users table:', user.id);
  
  // 2. Try to create user in Supabase Auth using admin API
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
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
    console.error('Error creating auth user:', authError);
    
    // If user already exists in auth, try to update password
    if (authError.message.includes('already registered')) {
      console.log('User already exists in auth, updating password...');
      
      const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        { password: password }
      );
      
      if (updateError) {
        console.error('Error updating password:', updateError);
      } else {
        console.log('Password updated successfully!');
      }
    }
  } else {
    console.log('Auth user created successfully:', authUser);
  }
  
  console.log('\nDone! Try logging in now.');
}

fixAuthUser().catch(console.error);
