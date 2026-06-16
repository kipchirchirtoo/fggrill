require('dotenv').config();
const { Pool } = require('pg');

async function exportData() {
  const oldPool = new Pool({
    connectionString: process.env.DATABASE_URL_OLD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Export roles
    const rolesRes = await oldPool.query(`SELECT * FROM roles ORDER BY id`);
    console.log('=== ROLES ===');
    console.log(JSON.stringify(rolesRes.rows, null, 2));

    // Export permissions
    const permRes = await oldPool.query(`SELECT * FROM permissions ORDER BY id`);
    console.log('=== PERMISSIONS ===');
    console.log(JSON.stringify(permRes.rows, null, 2));

    // Export user_branch_roles
    const ubrRes = await oldPool.query(`SELECT * FROM user_branch_roles ORDER BY id LIMIT 100`);
    console.log('=== USER_BRANCH_ROLES (first 100) ===');
    console.log(JSON.stringify(ubrRes.rows, null, 2));

    // Check roles schema
    const schemaRes = await oldPool.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'roles'
      ORDER BY ordinal_position
    `);
    console.log('=== ROLES SCHEMA ===');
    console.log(JSON.stringify(schemaRes.rows, null, 2));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await oldPool.end();
  }
}

exportData();
