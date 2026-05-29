/**
 * Fix all users:
 * 1. Show all existing public.users rows
 * 2. Upsert known missing users (famousgate.com etc)
 * 3. Set password_hash on anyone missing it
 */
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
  'https://utsvlihpudfraxzcmtle.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Users that need to exist in public.users but may be missing.
// Add any others you know about here.
const USERS_TO_ENSURE = [
  { email: 'auditor@famousgate.com',      first_name: 'Auditor',      last_name: 'FamousGate', role: 'auditor' },
  { email: 'accountant@famousgate.com',   first_name: 'Accountant',   last_name: 'FamousGate', role: 'accountant' },
  { email: 'manager@famousgate.com',      first_name: 'Manager',      last_name: 'FamousGate', role: 'manager' },
  { email: 'pos@famousgate.com',          first_name: 'POS',          last_name: 'FamousGate', role: 'cashier' },
  { email: 'branchstore@famousgate.com',  first_name: 'BranchStore',  last_name: 'FamousGate', role: 'storekeeper' },
  { email: 'reception@famousgate.com',    first_name: 'Reception',    last_name: 'FamousGate', role: 'receptionist' },
  { email: 'storekeeper@gmail.com',       first_name: 'Storekeeper',  last_name: 'User',       role: 'storekeeper' },
  { email: 'tooallan91@gmail.com',        first_name: 'Allan',        last_name: 'Too',        role: 'super_admin' },
  { email: 'allansamuel571@gmail.com',    first_name: 'Allan',        last_name: 'Samuel',     role: 'super_admin' },
  { email: 'kipchirchirtoo01@gmail.com',  first_name: 'Kip',          last_name: 'Chirchir',   role: 'super_admin' },
];

const DEFAULT_PASSWORD = 'Allan@13900';

async function fixAllUsers() {
  console.log('='.repeat(60));
  console.log('FIX ALL USERS - public.users ROWS + PASSWORD HASHES');
  console.log('='.repeat(60));

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // 1. Show all current users
  const { data: allUsers, error: listErr } = await supabase
    .from('users')
    .select('id, email, role, password_hash')
    .order('email');

  if (listErr) {
    console.error('❌ Cannot read public.users:', listErr.message);
    console.error('   This means the service role key is wrong or the table does not exist.');
    process.exit(1);
  }

  console.log(`\nCurrent public.users (${allUsers.length} rows):`);
  allUsers.forEach(u => {
    const hasHash = u.password_hash ? '✅ hash' : '❌ NO HASH';
    console.log(`  ${hasHash} | ${u.role?.padEnd(20)} | ${u.email}`);
  });

  const existingEmails = new Set(allUsers.map(u => u.email));

  // 2. Insert any missing users
  console.log('\nChecking for missing users...');
  for (const u of USERS_TO_ENSURE) {
    if (existingEmails.has(u.email)) {
      console.log(`  already exists: ${u.email}`);
      continue;
    }
    const { error } = await supabase.from('users').insert({
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
      email:         u.email,
      first_name:    u.first_name,
      last_name:     u.last_name,
      role:          u.role,
      status:        'active',
      password_hash: hashedPassword,
      created_at:    new Date().toISOString(),
    });
    if (error) {
      console.error(`  ❌ Insert failed for ${u.email}: ${error.message}`);
    } else {
      console.log(`  ✅ Inserted ${u.email} (${u.role})`);
    }
  }

  // 3. Set password_hash on anyone missing it
  console.log('\nFixing missing password_hash...');
  const { data: noHash } = await supabase
    .from('users')
    .select('id, email')
    .is('password_hash', null);

  if (!noHash || noHash.length === 0) {
    console.log('  All users already have a password_hash.');
  } else {
    for (const u of noHash) {
      const { error } = await supabase
        .from('users')
        .update({ password_hash: hashedPassword, updated_at: new Date().toISOString() })
        .eq('id', u.id);
      if (error) {
        console.error(`  ❌ Failed for ${u.email}: ${error.message}`);
      } else {
        console.log(`  ✅ password_hash set for ${u.email}`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('DONE. Login password for all users: ' + DEFAULT_PASSWORD);
  console.log('='.repeat(60));
}

fixAllUsers().catch(console.error);
