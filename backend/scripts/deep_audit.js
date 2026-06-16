const fs = require('fs');
const { Pool } = require('pg');
const newUrl = fs.readFileSync('.env', 'utf8').split('\n').find(l => l.startsWith('DATABASE_URL_NEW=')).substring('DATABASE_URL_NEW='.length).trim();
const pool = new Pool({ connectionString: newUrl, ssl: { rejectUnauthorized: false } });

async function audit() {
  console.log('=== CASHIER ROLES ===');
  const cashierRoles = await pool.query(`
    SELECT DISTINCT role FROM users 
    WHERE role LIKE '%cashier%' OR role IN ('restaurant_cashier','main_bar_cashier','kyogong_spa_cashier','kyogong_sports_bar_cashier')
    ORDER BY role
  `);
  cashierRoles.rows.forEach(r => console.log(' -', r.role));

  console.log('\n=== USERS WITHOUT branch_id ===');
  const noBranch = await pool.query(`
    SELECT id, email, role, branch_id FROM users 
    WHERE branch_id IS NULL 
    ORDER BY email
  `);
  console.log(`Found ${noBranch.rows.length} users without branch_id`);
  noBranch.rows.forEach(u => console.log(` - ${u.email} | role: ${u.role} | branch_id: ${u.branch_id}`));

  console.log('\n=== USERS WITH branch_id ===');
  const withBranch = await pool.query(`
    SELECT id, email, role, branch_id FROM users 
    WHERE branch_id IS NOT NULL 
    ORDER BY email
  `);
  console.log(`Found ${withBranch.rows.length} users with branch_id`);
  withBranch.rows.forEach(u => console.log(` - ${u.email} | role: ${u.role} | branch_id: ${u.branch_id}`));

  console.log('\n=== STAFF_PROFILES WITH branch_id ===');
  const staffProfiles = await pool.query(`
    SELECT sp.id, sp.email, sp.branch_id, sp.role, u.id as user_id, u.email as user_email
    FROM staff_profiles sp
    LEFT JOIN users u ON u.email = sp.email
    WHERE sp.status = 'active'
    ORDER BY sp.email
  `);
  console.log(`Found ${staffProfiles.rows.length} active staff_profiles`);
  staffProfiles.rows.slice(0, 10).forEach(s => {
    console.log(` - ${s.email} | staff branch: ${s.branch_id} | user_id: ${s.user_id}`);
  });

  console.log('\n=== STAFF WITHOUT MATCHING USER ===');
  const orphanedStaff = await pool.query(`
    SELECT sp.id, sp.email, sp.branch_id, sp.role, sp.employee_number
    FROM staff_profiles sp
    LEFT JOIN users u ON u.email = sp.email
    WHERE u.id IS NULL AND sp.status = 'active'
    ORDER BY sp.email
  `);
  console.log(`Found ${orphanedStaff.rows.length} staff without matching user account`);
  orphanedStaff.rows.forEach(s => console.log(` - ${s.email} | branch: ${s.branch_id} | role: ${s.role}`));

  console.log('\n=== USERS WITHOUT MATCHING STAFF ===');
  const orphanedUsers = await pool.query(`
    SELECT u.id, u.email, u.role, u.branch_id
    FROM users u
    LEFT JOIN staff_profiles sp ON sp.email = u.email
    WHERE sp.id IS NULL
    ORDER BY u.email
  `);
  console.log(`Found ${orphanedUsers.rows.length} users without matching staff_profile`);
  orphanedUsers.rows.forEach(u => console.log(` - ${u.email} | role: ${u.role} | branch: ${u.branch_id}`));

  await pool.end();
}

audit().catch(err => { console.error('ERR:', err.message); pool.end(); });
