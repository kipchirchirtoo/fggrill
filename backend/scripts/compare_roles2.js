require('dotenv').config();
const { Pool } = require('pg');

async function compare() {
  console.log('Connecting to OLD DB...');
  const oldPool = new Pool({
    connectionString: process.env.DATABASE_URL_OLD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
  });

  console.log('Connecting to NEW DB...');
  const newPool = new Pool({
    connectionString: process.env.DATABASE_URL_NEW,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
  });

  try {
    console.log('Querying OLD DB roles...');
    const oldRoles = await oldPool.query(`SELECT id, role_name::text as role_name, description FROM roles ORDER BY id`);
    console.log('Old roles:', oldRoles.rows.length);

    console.log('Querying NEW DB roles...');
    const newRoles = await newPool.query(`SELECT id, role_name, description FROM roles ORDER BY id`);
    console.log('New roles:', newRoles.rows.length);

    console.log('\n=== OLD DB ROLES ===');
    oldRoles.rows.forEach(r => console.log(r.id, r.role_name));

    console.log('\n=== NEW DB ROLES ===');
    newRoles.rows.forEach(r => console.log(r.id, r.role_name));

    // Check user_branch_roles counts
    console.log('Querying user_branch_roles...');
    const oldUbr = await oldPool.query(`SELECT COUNT(*) as cnt FROM user_branch_roles`);
    const newUbr = await newPool.query(`SELECT COUNT(*) as cnt FROM user_branch_roles`);
    console.log('\nOld user_branch_roles:', oldUbr.rows[0].cnt);
    console.log('New user_branch_roles:', newUbr.rows[0].cnt);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await oldPool.end();
    await newPool.end();
  }
}

compare();
