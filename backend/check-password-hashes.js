const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL/SUPABASE_PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkPasswordHashes() {
  console.log('🔍 Checking password hashes in users table...\n');

  try {
    // Get all users
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, password_hash')
      .order('email');

    if (error) {
      console.error('❌ Error fetching users:', error);
      return;
    }

    console.log(`📊 Total users: ${users.length}\n`);

    let withHash = 0;
    let withoutHash = 0;

    console.log('User Status:');
    console.log('─'.repeat(80));

    for (const user of users) {
      const hasHash = user.password_hash && user.password_hash.length > 0;
      const status = hasHash ? '✅ HAS HASH' : '❌ NO HASH';
      const hashPreview = hasHash ? user.password_hash.substring(0, 20) + '...' : 'NULL';
      
      console.log(`${status} | ${user.email.padEnd(40)} | ${hashPreview}`);
      
      if (hasHash) {
        withHash++;
      } else {
        withoutHash++;
      }
    }

    console.log('─'.repeat(80));
    console.log(`\n📈 Summary:`);
    console.log(`   ✅ Users with password_hash: ${withHash}`);
    console.log(`   ❌ Users without password_hash: ${withoutHash}`);

    if (withoutHash > 0) {
      console.log('\n⚠️  Some users are missing password hashes!');
      console.log('   Run the SQL query in Supabase SQL Editor:');
      console.log('   See: RUN_THIS_SQL_NOW.md\n');
    } else {
      console.log('\n✅ All users have password hashes! Authentication should work.\n');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkPasswordHashes();
