require('dotenv').config();
const { Pool } = require('pg');

async function getRoles() {
  const oldPool = new Pool({
    connectionString: process.env.DATABASE_URL_OLD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
  });

  try {
    const res = await oldPool.query(`SELECT id, role_name::text as role_name, description FROM roles ORDER BY id`);
    console.log('Old DB roles count:', res.rows.length);
    res.rows.forEach(r => {
      console.log(r.id, r.role_name);
    });
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await oldPool.end();
  }
}

getRoles();
