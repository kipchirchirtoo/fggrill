/**
 * Fix Driver Password
 * Updates the driver user's password hash
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixDriverPassword() {
  try {
    console.log('🔧 Fixing driver password...\n');

    const email = 'driver@famousgate.com';
    const password = 'Driver@123';

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);
    console.log('✅ Password hashed');

    // Update the user
    const { data, error } = await supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('email', email)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating password:', error.message);
      return;
    }

    console.log('✅ Password updated successfully!\n');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('👤 User ID:', data.id);
    console.log('\n🎯 You can now login with these credentials');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

fixDriverPassword();
