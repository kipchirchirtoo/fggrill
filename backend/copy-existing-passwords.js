const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL/SUPABASE_PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function copyExistingPasswords() {
  console.log('🔐 Starting password hash copy from auth.users to users table...\n');

  try {
    // Get all users from auth.users with their encrypted passwords
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return;
    }

    console.log(`📊 Found ${authUsers.users.length} users in auth.users\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const authUser of authUsers.users) {
      const userId = authUser.id;
      const email = authUser.email;

      // Note: The admin API doesn't expose encrypted_password directly
      // We need to use SQL to copy the passwords
      console.log(`⚠️  Cannot access encrypted_password via API for ${email}`);
      console.log(`   You must run the SQL query directly in Supabase SQL Editor\n`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('❌ CANNOT COPY PASSWORDS VIA API');
    console.log('='.repeat(60));
    console.log('\nThe Supabase Admin API does NOT expose encrypted_password field.');
    console.log('You MUST run this SQL query in Supabase SQL Editor:\n');
    console.log('─'.repeat(60));
    console.log(`
UPDATE public.users u
SET password_hash = au.encrypted_password,
    updated_at = NOW()
FROM auth.users au
WHERE u.id = au.id 
  AND au.encrypted_password IS NOT NULL
  AND (u.password_hash IS NULL OR u.password_hash = '');
`);
    console.log('─'.repeat(60));
    console.log('\nThis will copy ALL existing password hashes from auth.users');
    console.log('to the users table, preserving everyone\'s current passwords.\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

copyExistingPasswords();
