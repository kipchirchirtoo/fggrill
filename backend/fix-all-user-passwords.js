const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
  'https://utsvlihpudfraxzcmtle.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixAllPasswords() {
  console.log('='.repeat(60));
  console.log('FIX ALL USER PASSWORDS');
  console.log('='.repeat(60));
  console.log('\nThis will hash and store passwords for all users\n');
  
  try {
    // Get all users
    console.log('Step 1: Getting all users from database...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role')
      .order('email');
    
    if (usersError || !users) {
      console.error('❌ Failed to get users:', usersError?.message);
      return;
    }
    
    console.log(`✅ Found ${users.length} users\n`);
    
    // Default password for all users (from DATABASE_URL)
    const defaultPassword = 'Allan@13900';
    
    console.log('Step 2: Hashing password...');
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    console.log('✅ Password hashed\n');
    
    console.log('Step 3: Updating all users...');
    let successCount = 0;
    let failCount = 0;
    
    for (const user of users) {
      try {
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            password_hash: hashedPassword,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
        
        if (updateError) {
          console.error(`❌ Failed for ${user.email}:`, updateError.message);
          failCount++;
        } else {
          console.log(`✅ ${user.email} - password hash updated`);
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Error for ${user.email}:`, err.message);
        failCount++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total users: ${users.length}`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`\nDefault Password: ${defaultPassword}`);
    console.log('\n⚠️  All users can now login with this password!');
    console.log('Tell them to change it after first login.');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
  }
}

fixAllPasswords().catch(console.error);
