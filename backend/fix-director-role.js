/**
 * Fix Director Role - Assigns director role to a user
 * 
 * Usage: node backend/fix-director-role.js <email>
 * Example: node backend/fix-director-role.js admin@famousgate.com
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixDirectorRole() {
  const email = process.argv[2];

  if (!email) {
    console.log('\n❌ Please provide an email address');
    console.log('Usage: node backend/fix-director-role.js <email>');
    console.log('Example: node backend/fix-director-role.js admin@famousgate.com\n');
    process.exit(1);
  }

  console.log(`\n🔍 Looking for user: ${email}...`);

  try {
    // Find user
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('id, email, role, first_name, last_name')
      .eq('email', email)
      .single();

    if (findError || !user) {
      console.error(`❌ User not found: ${email}`);
      console.log('\nAvailable users:');
      
      const { data: allUsers } = await supabase
        .from('users')
        .select('email, role, first_name, last_name')
        .limit(10);
      
      if (allUsers && allUsers.length > 0) {
        allUsers.forEach(u => {
          console.log(`  - ${u.email} (${u.role})`);
        });
      }
      
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.first_name} ${user.last_name}`);
    console.log(`   Current role: ${user.role}`);

    if (user.role === 'director') {
      console.log('\n✅ User already has director role!');
      process.exit(0);
    }

    // Update role
    console.log(`\n🔄 Updating role to 'director'...`);
    
    const { error: updateError } = await supabase
      .from('users')
      .update({ role: 'director' })
      .eq('id', user.id);

    if (updateError) {
      console.error('❌ Failed to update role:', updateError.message);
      process.exit(1);
    }

    console.log('✅ Successfully updated role to director!');
    console.log('\n📋 Next steps:');
    console.log('1. Log out and log back in with this account');
    console.log('2. Navigate to /dashboard/director');
    console.log('3. The director dashboard should now be accessible\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

fixDirectorRole();
