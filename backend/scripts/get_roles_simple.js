const fs = require('fs');
const { Pool } = require('pg');

const envContent = fs.readFileSync('.env', 'utf8');
const oldUrlLine = envContent.split('\n').find(l => l.startsWith('DATABASE_URL_OLD='));
const newUrlLine = envContent.split('\n').find(l => l.startsWith('DATABASE_URL_NEW='));
const oldUrl = oldUrlLine.substring('DATABASE_URL_OLD='.length).trim();
const newUrl = newUrlLine.substring('DATABASE_URL_NEW='.length).trim();

async function getOldRoles() {
  const oldPool = new Pool({ connectionString: oldUrl, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 30000 });
  try {
    const oldUsers = await oldPool.query(`SELECT DISTINCT role FROM users WHERE role IS NOT NULL ORDER BY role`);
    console.log('=== OLD DB user roles ===');
    oldUsers.rows.forEach(r => console.log(r.role));

    const oldUbr = await oldPool.query(`SELECT COUNT(*) as cnt FROM user_branch_roles`);
    console.log('\nOld user_branch_roles count:', oldUbr.rows[0].cnt);
  } finally {
    await oldPool.end();
  }
}

async function getNewRoles() {
  const newPool = new Pool({ connectionString: newUrl, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 30000 });
  try {
    const newUsers = await newPool.query(`SELECT DISTINCT role FROM users WHERE role IS NOT NULL ORDER BY role`);
    console.log('\n=== NEW DB user roles ===');
    newUsers.rows.forEach(r => console.log(r.role));

    const newUbr = await newPool.query(`SELECT COUNT(*) as cnt FROM user_branch_roles`);
    console.log('\nNew user_branch_roles count:', newUbr.rows[0].cnt);
  } finally {
    await newPool.end();
  }
}

async function main() {
  await getOldRoles();
  await getNewRoles();
}

main().catch(err => console.error('Error:', err.message));
