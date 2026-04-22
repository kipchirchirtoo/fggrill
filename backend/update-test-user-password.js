/**
 * Update an existing user's password to password123 for testing
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateUserPassword() {
  const email = process.argv[2];
  const password = process.argv[3] || 'password123';

  if (!email) {
    console.log('Usage: node update-test-user-password.js <email> [password]');
    console.log('Example: node update-test-user-password.js chepkemoigloria@famousgate.com password123');
    return;
  }

  console.log(`🔧 Updating password for ${email}...`);

  // Get user
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (fetchError || !user) {
    console.error(`❌ User not found: ${email}`);
    return;
  }

  console.log(`✅ Found user: ${user.first_name} ${user.last_name} (${user.role})`);

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Update password
  const { error: updateError } = await supabase
    .from('users')
    .update({ password_hash: passwordHash })
    .eq('id', user.id);

  if (updateError) {
    console.error(`❌ Error updating password:`, updateError.message);
    return;
  }

  console.log(`✅ Password updated successfully!`);
  console.log(`\n📱 Test Credentials:`);
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Role: ${user.role}`);
  console.log(`   Branch: ${user.branch_id || 'N/A'}`);
}

updateUserPassword().catch(console.error);
