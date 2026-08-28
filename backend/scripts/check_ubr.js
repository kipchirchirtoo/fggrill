require('dotenv').config();
const { Pool } = require('pg');

async function check() {
  const oldPool = new Pool({
    connectionString: process.env.DATABASE_URL_OLD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
  });
  const newPool = new Pool({
    connectionString: process.env.DATABASE_URL_NEW,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
  });

  try {
    console.log('=== OLD DB user_branch_roles ===');
    const oldUbr = await oldPool.query(`SELECT COUNT(*) as cnt FROM user_branch_roles`);
    console.log('Count:', oldUbr.rows[0].cnt);

    const oldUsers = await oldPool.query(`SELECT DISTINCT role FROM users WHERE role IS NOT NULL ORDER BY role`);
    console.log('User roles:', oldUsers.rows.map(r => r.role));

    console.log('\n=== NEW DB user_branch_roles ===');
    const newUbr = await newPool.query(`SELECT COUNT(*) as cnt FROM user_branch_roles`);
    console.log('Count:', newUbr.rows[0].cnt);

    const newUsers = await newPool.query(`SELECT DISTINCT role FROM users WHERE role IS NOT NULL ORDER BY role`);
    console.log('User roles:', newUsers.rows.map(r => r.role));

    // Check for missing roles in new DB users
    const oldRoleSet = new Set(oldUsers.rows.map(r => r.role));
    const newRoleSet = new Set(newUsers.rows.map(r => r.role));
    const missing = [...oldRoleSet].filter(r => !newRoleSet.has(r));
    console.log('\nMissing roles in new DB:', missing);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await oldPool.end();
    await newPool.end();
  }
}

check();
