const fs = require('fs');
const { Pool } = require('pg');
const oldUrl = fs.readFileSync('.env', 'utf8').split('\n').find(l => l.startsWith('DATABASE_URL_OLD=')).substring('DATABASE_URL_OLD='.length).trim();
const pool = new Pool({ connectionString: oldUrl, ssl: { rejectUnauthorized: false } });

async function check() {
  console.log('=== OLD DB: users with branch_id ===');
  const usersWithBranch = await pool.query(`
    SELECT id, email, role, branch_id FROM users 
    WHERE branch_id IS NOT NULL 
    ORDER BY email
  `);
  console.log(`Found ${usersWithBranch.rows.length} users with branch_id`);
  usersWithBranch.rows.forEach(u => console.log(` - ${u.email} | role: ${u.role} | branch: ${u.branch_id}`));

  console.log('\n=== OLD DB: users without branch_id ===');
  const usersNoBranch = await pool.query(`
    SELECT id, email, role, branch_id FROM users 
    WHERE branch_id IS NULL 
    ORDER BY email
  `);
  console.log(`Found ${usersNoBranch.rows.length} users without branch_id`);
  usersNoBranch.rows.forEach(u => console.log(` - ${u.email} | role: ${u.role}`));

  console.log('\n=== OLD DB: staff_profiles emails ===');
  const spEmails = await pool.query(`
    SELECT id, email, first_name, last_name, branch_id, user_id 
    FROM staff_profiles 
    WHERE email IS NOT NULL 
    ORDER BY email
  `);
  console.log(`Found ${spEmails.rows.length} staff_profiles with email`);
  spEmails.rows.slice(0, 10).forEach(s => {
    console.log(` - ${s.email} | user_id: ${s.user_id} | branch: ${s.branch_id}`);
  });

  console.log('\n=== OLD DB: staff_profiles matching users ===');
  const matching = await pool.query(`
    SELECT u.id as user_id, u.email, u.role, u.branch_id as user_branch,
           sp.id as staff_id, sp.branch_id as staff_branch, sp.user_id
    FROM users u
    LEFT JOIN staff_profiles sp ON sp.email = u.email
    WHERE sp.id IS NOT NULL
    ORDER BY u.email
  `);
  console.log(`Found ${matching.rows.length} users with matching staff_profile`);
  matching.rows.forEach(r => {
    console.log(` - ${r.email} | user_branch: ${r.user_branch} | staff_branch: ${r.staff_branch}`);
  });

  await pool.end();
}

check().catch(err => { console.error('ERR:', err.message); pool.end(); });
