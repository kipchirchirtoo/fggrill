require('dotenv').config();
const { Pool } = require('pg');

async function check() {
  const newPool = new Pool({
    connectionString: process.env.DATABASE_URL_NEW,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const tables = ['roles', 'permissions', 'user_branch_roles'];
    for (const t of tables) {
      const res = await newPool.query(`
        SELECT COUNT(*) as cnt FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      `, [t]);
      console.log(t, 'exists:', res.rows[0].cnt > 0);
    }

    // Check if roles table has data
    try {
      const r = await newPool.query(`SELECT COUNT(*) as cnt FROM roles`);
      console.log('roles rows:', r.rows[0].cnt);
    } catch (e) {
      console.log('roles query error:', e.message);
    }

    try {
      const r = await newPool.query(`SELECT COUNT(*) as cnt FROM permissions`);
      console.log('permissions rows:', r.rows[0].cnt);
    } catch (e) {
      console.log('permissions query error:', e.message);
    }

    try {
      const r = await newPool.query(`SELECT COUNT(*) as cnt FROM user_branch_roles`);
      console.log('user_branch_roles rows:', r.rows[0].cnt);
    } catch (e) {
      console.log('user_branch_roles query error:', e.message);
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await newPool.end();
  }
}

check();
