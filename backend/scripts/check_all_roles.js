const fs = require('fs');
const { Pool } = require('pg');
const oldUrl = fs.readFileSync('.env', 'utf8').split('\n').find(l => l.startsWith('DATABASE_URL_OLD=')).substring('DATABASE_URL_OLD='.length).trim();
const newUrl = fs.readFileSync('.env', 'utf8').split('\n').find(l => l.startsWith('DATABASE_URL_NEW=')).substring('DATABASE_URL_NEW='.length).trim();

async function check() {
  const oldPool = new Pool({ connectionString: oldUrl, ssl: { rejectUnauthorized: false } });
  const newPool = new Pool({ connectionString: newUrl, ssl: { rejectUnauthorized: false } });

  try {
    // All roles from old DB users
    const oldRoles = await oldPool.query(`SELECT DISTINCT role FROM users WHERE role IS NOT NULL ORDER BY role`);
    // All roles from new DB users
    const newRoles = await newPool.query(`SELECT DISTINCT role FROM users WHERE role IS NOT NULL ORDER BY role`);

    const oldSet = new Set(oldRoles.rows.map(r => r.role));
    const newSet = new Set(newRoles.rows.map(r => r.role));

    console.log('=== OLD DB ROLES ===');
    oldRoles.rows.forEach(r => console.log(' -', r.role));

    console.log('\n=== NEW DB ROLES ===');
    newRoles.rows.forEach(r => console.log(' -', r.role));

    console.log('\n=== ROLES IN OLD BUT NOT NEW ===');
    const missingInNew = [...oldSet].filter(r => !newSet.has(r));
    missingInNew.forEach(r => console.log(' -', r));

    console.log('\n=== ROLES IN NEW BUT NOT OLD ===');
    const missingInOld = [...newSet].filter(r => !oldSet.has(r));
    missingInOld.forEach(r => console.log(' -', r));

    // All roles from user_branch_roles
    const oldUbrRoles = await oldPool.query(`SELECT DISTINCT role FROM user_branch_roles ORDER BY role`);
    const newUbrRoles = await newPool.query(`SELECT DISTINCT role FROM user_branch_roles ORDER BY role`);

    console.log('\n=== OLD DB user_branch_roles roles ===');
    oldUbrRoles.rows.forEach(r => console.log(' -', r.role));

    console.log('\n=== NEW DB user_branch_roles roles ===');
    newUbrRoles.rows.forEach(r => console.log(' -', r.role));

    const oldUbrSet = new Set(oldUbrRoles.rows.map(r => r.role));
    const newUbrSet = new Set(newUbrRoles.rows.map(r => r.role));

    console.log('\n=== UBR ROLES IN OLD BUT NOT NEW ===');
    const missingUbr = [...oldUbrSet].filter(r => !newUbrSet.has(r));
    missingUbr.forEach(r => console.log(' -', r));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await oldPool.end();
    await newPool.end();
  }
}

check();
