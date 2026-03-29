const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findDuplicates() {
  console.log('--- AUDITING EMPLOYEE DUPLICATES ---');

  // 1. Get all staff profiles
  const { data: staff, error: staffError } = await supabase
    .from('staff_profiles')
    .select('id, first_name, last_name, national_id, email, phone, branch_id, id_number, updated_at')
    .order('updated_at', { ascending: false });

  if (staffError) {
    console.error('Error fetching staff profiles:', staffError.message);
    return;
  }

  // 2. Get all drivers
  const { data: drivers, error: driverError } = await supabase
    .from('drivers')
    .select('*')
    .order('updated_at', { ascending: false });

  if (driverError) {
    console.error('Error fetching drivers:', driverError.message);
  }

  // 3. Get all users
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, email, first_name, last_name, phone_number, role')
    .order('email');

  if (userError) {
    console.error('Error fetching users:', userError.message);
  }

  console.log(`Total staff records: ${staff.length}`);
  console.log(`Total driver records: ${drivers?.length || 0}`);
  console.log(`Total user records: ${users?.length || 0}`);

  const duplicatesByNationalId = {};
  const duplicatesByEmail = {};
  const duplicatesByPhone = {};
  const specificCases = {
    'Chris Kigen': { staff: [], driver: [], user: [] },
    'Festus Rider': { staff: [], driver: [], user: [] },
    'Felix Yegon': { staff: [], driver: [], user: [] }
  };

  // Process Staff
  staff.forEach(s => {
    const fullName = `${s.first_name || ''} ${s.last_name || ''}`.trim().toLowerCase();
    
    Object.keys(specificCases).forEach(name => {
      if (fullName.includes(name.toLowerCase()) || name.toLowerCase().includes(fullName)) {
        specificCases[name].staff.push(s);
      }
    });

    // Group by National ID
    if (s.national_id && s.national_id !== '—' && s.national_id !== 'pending') {
      if (!duplicatesByNationalId[s.national_id]) duplicatesByNationalId[s.national_id] = [];
      duplicatesByNationalId[s.national_id].push(s);
    }

    // Group by Email
    if (s.email && s.email !== '') {
      if (!duplicatesByEmail[s.email]) duplicatesByEmail[s.email] = [];
      duplicatesByEmail[s.email].push(s);
    }

    // Group by Phone
    if (s.phone && s.phone !== '' && s.phone !== '—') {
      const p = s.phone.replace(/\D/g, '').slice(-9); // Normalize phone
      if (!duplicatesByPhone[p]) duplicatesByPhone[p] = { staff: [], driver: [], user: [] };
      duplicatesByPhone[p].staff.push(s);
    }
  });

  // Process Drivers
  if (drivers) {
    drivers.forEach(d => {
      const name = d.name.toLowerCase();
      Object.keys(specificCases).forEach(caseName => {
        if (name.includes(caseName.toLowerCase()) || caseName.toLowerCase().includes(name)) {
          specificCases[caseName].driver.push(d);
        }
      });

      if (d.phone) {
        const p = d.phone.replace(/\D/g, '').slice(-9);
        if (!duplicatesByPhone[p]) duplicatesByPhone[p] = { staff: [], driver: [], user: [] };
        duplicatesByPhone[p].driver.push(d);
      }
    });
  }

  // Process Users
  if (users) {
    users.forEach(u => {
      const name = `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase();
      Object.keys(specificCases).forEach(caseName => {
        if (name.includes(caseName.toLowerCase()) || caseName.toLowerCase().includes(name)) {
          specificCases[caseName].user.push(u);
        }
      });

      if (u.phone_number) {
        const p = u.phone_number.replace(/\D/g, '').slice(-9);
        if (!duplicatesByPhone[p]) duplicatesByPhone[p] = { staff: [], driver: [], user: [] };
        duplicatesByPhone[p].user.push(u);
      }
      
      if (u.email) {
        if (!duplicatesByEmail[u.email]) duplicatesByEmail[u.email] = { staff: [], user: [] };
        duplicatesByEmail[u.email].user.push(u);
      }
    });
  }

  console.log('\n--- SPECIFIC CASES ---');
  Object.entries(specificCases).forEach(([name, data]) => {
    console.log(`${name}:`);
    console.log(`  Staff: ${data.staff.length} records`);
    data.staff.forEach(r => console.log(`    - [STAFF] ID: ${r.id}, StaffID: ${r.id_number}, Phone: ${r.phone}`));
    console.log(`  Driver: ${data.driver.length} records`);
    data.driver.forEach(r => console.log(`    - [DRIVER] ID: ${r.id}, Phone: ${r.phone}, Status: ${r.status}`));
    console.log(`  User: ${data.user.length} records`);
    data.user.forEach(r => console.log(`    - [USER] ID: ${r.id}, Email: ${r.email}, Role: ${r.role}`));
  });

  console.log('\n--- DUPLICATES BY PHONE (Normalized) ---');
  let phoneDupCount = 0;
  Object.entries(duplicatesByPhone).forEach(([phone, records]) => {
    const total = records.staff.length + records.driver.length;
    if (total > 1) {
      phoneDupCount++;
      console.log(`Phone suffix: ${phone} (Staff: ${records.staff.length}, Driver: ${records.driver.length})`);
      records.staff.forEach(r => console.log(`  - [STAFF] ${r.first_name} ${r.last_name} (ID: ${r.id})`));
      records.driver.forEach(r => console.log(`  - [DRIVER] ${r.name} (ID: ${r.id})`));
    }
  });
  console.log(`Total duplicate Phones: ${phoneDupCount}`);

  // Summary
  console.log('\n--- SUMMARY ---');
  console.log('Duplicates exist if any of the above counts are > 0.');
}

findDuplicates();
