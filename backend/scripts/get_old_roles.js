const fs = require('fs');
const { Pool } = require('pg');

const envContent = fs.readFileSync('.env', 'utf8');
const oldUrlLine = envContent.split('\n').find(l => l.startsWith('DATABASE_URL_OLD='));
const newUrlLine = envContent.split('\n').find(l => l.startsWith('DATABASE_URL_NEW='));
const oldUrl = oldUrlLine.substring('DATABASE_URL_OLD='.length).trim();
const newUrl = newUrlLine.substring('DATABASE_URL_NEW='.length).trim();

async function getRoles() {
  const oldPool = new Pool({ connectionString: oldUrl, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 30000 });
  const newPool = new Pool({ connectionString: newUrl, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 30000 });

  try {
    // Get roles from old users table
    const oldUsers = await oldPool.query(`SELECT DISTINCT role FROM users WHERE role IS NOT NULL ORDER BY role`);
    console.log('=== OLD DB user roles ===');
    console.log(oldUsers.rows.map(r => r.role));

    // Get roles from new users table
    const newUsers = await newPool.query(`SELECT DISTINCT role FROM users WHERE role IS NOT NULL ORDER BY role`);
    console.log('\n=== NEW DB user roles ===');
    console.log(newUsers.rows.map(r => r.role));

    // Get user_branch_roles counts
    const oldUbr = await oldPool.query(`SELECT COUNT(*) as cnt FROM user_branch_roles`);
    const newUbr = await newPool.query(`SELECT COUNT(*) as cnt FROM user_branch_roles`);
    console.log('\nOld user_branch_roles:', oldUbr.rows[0].cnt);
    console.log('New user_branch_roles:', newUbr.rows[0].cnt);

    // Get all user_branch_roles from old DB
    const oldUbrData = await oldPool.query(`SELECT * FROM user_branch_roles ORDER BY created_at`);
    fs.writeFileSync('/tmp/old_ubr.json', JSON.stringify(oldUbrData.rows, null, 2));
    console.log('\nExported old user_branch_roles to /tmp/old_ubr.json');

    // Get users that exist in old but not in new
    const oldUserIds = await oldPool.query(`SELECT id, email, role FROM users ORDER BY email`);
    const newUserIds = await newPool.query(`SELECT id, email, role FROM users ORDER BY email`);
    const newEmails = new Set(newUserIds.rows.map(r => r.email));
    const missingUsers = oldUserIds.rows.filter(r => !newEmails.has(r.email));
    console.log('\nUsers in old DB but not in new DB:', missingUsers.length);
    if (missingUsers.length > 0) {
      missingUsers.forEach(u => console.log(' -', u.email, u.role));
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await oldPool.end();
    await newPool.end();
  }
}

getRoles();
