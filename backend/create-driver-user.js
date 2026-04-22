/**
 * Create Driver User Script
 * 
 * Creates a driver user account for mobile app access
 * Usage: node create-driver-user.js
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createDriverUser() {
  try {
    console.log('🚗 Creating driver user...\n');

    // Driver details
    const driverData = {
      email: 'driver@famousgate.com',
      password: 'Driver@123',
      first_name: 'John',
      last_name: 'Driver',
      phone: '+254700000001',
      role: 'driver',
    };

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', driverData.email)
      .single();

    if (existingUser) {
      console.log('❌ Driver user already exists:', existingUser.email);
      console.log('   User ID:', existingUser.id);
      return;
    }

    // Create auth user first
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: driverData.email,
      password: driverData.password,
      email_confirm: true,
      user_metadata: {
        first_name: driverData.first_name,
        last_name: driverData.last_name,
        role: driverData.role,
      },
    });

    if (authError) {
      console.error('❌ Error creating auth user:', authError.message);
      return;
    }

    console.log('✅ Auth user created:', authData.user.id);

    // Hash password for users table
    const passwordHash = await bcrypt.hash(driverData.password, 10);

    // Create user in users table
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .upsert({
        id: authData.user.id,
        email: driverData.email,
        password_hash: passwordHash,
        first_name: driverData.first_name,
        last_name: driverData.last_name,
        phone_number: driverData.phone,
        role: driverData.role,
        status: 'active',
        employee_id: 'DRV-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      })
      .select()
      .single();

    if (userError) {
      console.error('❌ Error creating user:', userError.message);
      return;
    }

    console.log('✅ Driver user created successfully!\n');
    console.log('📧 Email:', driverData.email);
    console.log('🔑 Password:', driverData.password);
    console.log('👤 User ID:', newUser.id);
    console.log('📱 Role:', newUser.role);
    console.log('\n🎯 Use these credentials to login to the mobile app');

    // Create driver record
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .insert({
        name: `${driverData.first_name} ${driverData.last_name}`,
        phone: driverData.phone,
        license_number: 'DL-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        user_id: newUser.id,
        status: 'active',
      })
      .select()
      .single();

    if (driverError) {
      console.log('\n⚠️  Warning: Could not create driver record:', driverError.message);
    } else {
      console.log('\n✅ Driver record created');
      console.log('🚗 Driver ID:', driver.id);
      console.log('🪪  License:', driver.license_number);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

createDriverUser();
