const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
  'https://utsvlihpudfraxzcmtle.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY'
);

async function fixUserPassword() {
  const email = 'kipchirchirtoo01@gmail.com';
  const password = 'kyogong2024!'; // Default password
  
  console.log('='.repeat(60));
  console.log('FIX USER PASSWORD - Direct Database Method');
  console.log('='.repeat(60));
  console.log(`\nTarget: ${email}\n`);
  
  try {
    // Step 1: Get user
    console.log('Step 1: Finding user...');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (userError || !user) {
      console.error('❌ User not found');
      return;
    }
    
    console.log('✅ User found:');
    console.log(`   - ID: ${user.id}`);
    console.log(`   - Name: ${user.first_name} ${user.last_name}`);
    console.log(`   - Role: ${user.role}`);
    
    // Step 2: Hash the password
    console.log('\nStep 2: Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('✅ Password hashed');
    
    // Step 3: Store password hash in users table
    console.log('\nStep 3: Storing password hash in users table...');
    const { data: updateData, error: updateError } = await supabase
      .from('users')
      .update({ 
        password_hash: hashedPassword,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select();
    
    if (updateError) {
      console.error('❌ Failed to update:', updateError.message);
      
      // Try using RPC function if direct update fails
      console.log('\nTrying alternative method with RPC...');
      const { data: rpcData, error: rpcError } = await supabase.rpc('update_user_password', {
        user_id: user.id,
        new_password_hash: hashedPassword
      });
      
      if (rpcError) {
        console.error('❌ RPC also failed:', rpcError.message);
      } else {
        console.log('✅ Password updated via RPC');
      }
    } else {
      console.log('✅ Password hash stored in users table');
    }
    
    // Step 4: Verify the update
    console.log('\nStep 4: Verifying update...');
    const { data: verifyUser, error: verifyError } = await supabase
      .from('users')
      .select('id, email, password_hash')
      .eq('id', user.id)
      .single();
    
    if (verifyError) {
      console.error('❌ Verification failed:', verifyError.message);
    } else {
      console.log('✅ Verification successful:');
      console.log(`   - Has password_hash: ${verifyUser.password_hash ? 'Yes' : 'No'}`);
      
      if (verifyUser.password_hash) {
        // Test the hash
        const isMatch = await bcrypt.compare(password, verifyUser.password_hash);
        console.log(`   - Password matches: ${isMatch ? 'Yes' : 'No'}`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('DONE!');
    console.log('='.repeat(60));
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log('\nThe backend login controller will use this password');
    console.log('from the users table when Supabase Auth fails.');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
  }
}

fixUserPassword().catch(console.error);
