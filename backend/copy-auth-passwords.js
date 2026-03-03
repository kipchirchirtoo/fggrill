const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function copyAuthPasswords() {
  console.log('='.repeat(60));
  console.log('COPY PASSWORDS FROM auth.users TO users.password_hash');
  console.log('='.repeat(60));
  console.log('\nThis will copy existing password hashes from auth.users\n');
  
  try {
    // Get all users with their auth passwords
    console.log('Step 1: Fetching passwords from auth.users...');
    
    const query = `
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        au.encrypted_password
      FROM public.users u
      INNER JOIN auth.users au ON u.id = au.id
      WHERE au.encrypted_password IS NOT NULL
      ORDER BY u.email
    `;
    
    const result = await pool.query(query);
    
    console.log(`✅ Found ${result.rows.length} users with passwords in auth.users\n`);
    
    if (result.rows.length === 0) {
      console.log('⚠️  No users found with passwords in auth.users');
      console.log('This means passwords need to be set manually.');
      return;
    }
    
    console.log('Step 2: Copying passwords to users.password_hash...');
    let successCount = 0;
    let failCount = 0;
    
    for (const row of result.rows) {
      try {
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            password_hash: row.encrypted_password,
            updated_at: new Date().toISOString()
          })
          .eq('id', row.id);
        
        if (updateError) {
          console.error(`❌ Failed for ${row.email}:`, updateError.message);
          failCount++;
        } else {
          console.log(`✅ ${row.email} - password copied`);
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Error for ${row.email}:`, err.message);
        failCount++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total users with auth passwords: ${result.rows.length}`);
    console.log(`✅ Successfully copied: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log('\n✅ Users can now login with their EXISTING passwords!');
    console.log('The backend will use the password_hash from users table.');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

copyAuthPasswords().catch(console.error);
