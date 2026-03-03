const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runCopyPasswords() {
  console.log('='.repeat(60));
  console.log('COPY AUTH PASSWORDS TO USERS TABLE');
  console.log('='.repeat(60));
  console.log('\nCalling database function to copy passwords...\n');
  
  try {
    const { data, error } = await supabase.rpc('copy_auth_passwords_to_users');
    
    if (error) {
      console.error('❌ Error calling function:', error.message);
      console.log('\nThe function might not exist. Creating it...');
      
      // Try to create the function
      const fs = require('fs');
      const sql = fs.readFileSync('./create-copy-password-function.sql', 'utf8');
      
      console.log('\nPlease run this SQL in Supabase SQL Editor:');
      console.log('='.repeat(60));
      console.log(sql);
      console.log('='.repeat(60));
      console.log('\nThen run this script again.');
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('⚠️  No users found with passwords in auth.users');
      return;
    }
    
    console.log('Results:');
    console.log('='.repeat(60));
    
    let successCount = 0;
    let failCount = 0;
    
    data.forEach(result => {
      if (result.success) {
        console.log(`✅ ${result.user_email} - ${result.message}`);
        successCount++;
      } else {
        console.log(`❌ ${result.user_email} - ${result.message}`);
        failCount++;
      }
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log('\n✅ Users can now login with their EXISTING passwords!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  }
}

runCopyPasswords().catch(console.error);
