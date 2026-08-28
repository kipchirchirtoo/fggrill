require('dotenv').config();
const { Pool } = require('pg');

async function exportRoles() {
  const oldPool = new Pool({
    connectionString: process.env.DATABASE_URL_OLD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Check if roles table exists
    const tableCheck = await oldPool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'roles'
    `);

    if (tableCheck.rows.length === 0) {
      console.log('No roles table found in old DB');
      // Check users table for distinct roles
      const rolesRes = await oldPool.query(`
        SELECT DISTINCT role FROM users WHERE role IS NOT NULL ORDER BY role
      `);
      console.log('Roles from users table:', rolesRes.rows.map(r => r.role));
      return;
    }

    const res = await oldPool.query(`SELECT * FROM roles ORDER BY id`);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await oldPool.end();
  }
}

exportRoles();
