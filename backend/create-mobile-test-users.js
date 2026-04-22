/**
 * Create test users for mobile app testing
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEST_USERS = [
  {
    email: 'cashier@famousgate.com',
    password: 'password123',
    first_name: 'Test',
    last_name: 'Cashier',
    role: 'cashier',
    branch_id: null, // Will be set to first branch
  },
  {
    email: 'branch@famousgate.com',
    password: 'password123',
    first_name: 'Test',
    last_name: 'Branch Storekeeper',
    role: 'branch_storekeeper',
    branch_id: null,
  },
  {
    email: 'central@famousgate.com',
    password: 'password123',
    first_name: 'Test',
    last_name: 'Central Storekeeper',
    role: 'central_storekeeper',
    branch_id: null,
  },
  {
    email: 'admin@famousgate.com',
    password: 'password123',
    first_name: 'Test',
    last_name: 'Admin',
    role: 'super_admin',
    branch_id: null,
  },
];

async function createTestUsers() {
  console.log('🔧 Creating mobile app test users...\n');

  // Get first branch
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .limit(1)
    .single();

  if (!branches) {
    console.error('❌ No branches found. Please create a branch first.');
    return;
  }

  console.log(`📍 Using branch: ${branches.name} (${branches.id})\n`);

  for (const user of TEST_USERS) {
    try {
      // Check if user exists
      const { data: existing } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', user.email)
        .single();

      if (existing) {
        console.log(`⚠️  User ${user.email} already exists, updating...`);
        
        // Update existing user
        const passwordHash = await bcrypt.hash(user.password, 10);
        const { error: updateError } = await supabase
          .from('users')
          .update({
            password_hash: passwordHash,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role,
            branch_id: user.role !== 'super_admin' ? branches.id : null,
          })
          .eq('id', existing.id);

        if (updateError) {
          console.error(`❌ Error updating ${user.email}:`, updateError.message);
        } else {
          console.log(`✅ Updated ${user.email} (${user.role})`);
        }
      } else {
        // Create new user
        const passwordHash = await bcrypt.hash(user.password, 10);
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            email: user.email,
            password_hash: passwordHash,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role,
            branch_id: user.role !== 'super_admin' ? branches.id : null,
          });

        if (insertError) {
          console.error(`❌ Error creating ${user.email}:`, insertError.message);
        } else {
          console.log(`✅ Created ${user.email} (${user.role})`);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing ${user.email}:`, error.message);
    }
  }

  console.log('\n✅ Test users setup complete!');
  console.log('\n📱 Mobile App Test Credentials:');
  console.log('─'.repeat(50));
  TEST_USERS.forEach(user => {
    console.log(`${user.role.padEnd(25)} | ${user.email}`);
    console.log(`${''.padEnd(25)} | password: ${user.password}`);
    console.log('─'.repeat(50));
  });
}

createTestUsers().catch(console.error);
