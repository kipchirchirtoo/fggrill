/**
 * Fix Driver Role
 * Updates the driver user's role from 'guest' to 'driver'
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixDriverRole() {
  try {
    console.log('🔧 Fixing driver role...\n');

    const email = 'driver@famousgate.com';

    // Update the user role
    const { data, error } = await supabase
      .from('users')
      .update({ role: 'driver' })
      .eq('email', email)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating role:', error.message);
      return;
    }

    console.log('✅ Role updated successfully!\n');
    console.log('📧 Email:', email);
    console.log('👤 User ID:', data.id);
    console.log('🎭 Old Role: guest');
    console.log('🎭 New Role:', data.role);
    console.log('\n🎯 Driver can now access the mobile app');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

fixDriverRole();
