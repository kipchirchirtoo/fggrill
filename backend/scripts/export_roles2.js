require('dotenv').config();
const { Pool } = require('pg');

async function exportRoles() {
  const oldPool = new Pool({
    connectionString: process.env.DATABASE_URL_OLD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Check what tables exist
    const tablesRes = await oldPool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE '%role%'
    `);
    console.log('Role-related tables:', tablesRes.rows.map(r => r.table_name));

    // Check users table roles
    const rolesRes = await oldPool.query(`
      SELECT DISTINCT role FROM users WHERE role IS NOT NULL ORDER BY role
    `);
    console.log('Roles from users table:', rolesRes.rows.map(r => r.role));

    // Check if there's a permissions or user_roles table
    const permRes = await oldPool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('permissions', 'user_roles', 'role_permissions')
    `);
    console.log('Permission tables:', permRes.rows.map(r => r.table_name));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await oldPool.end();
  }
}

exportRoles();
