const fs = require('fs');
const { Pool } = require('pg');
const envContent = fs.readFileSync('.env', 'utf8');
const line = envContent.split('\n').find(l => l.startsWith('DATABASE_URL_NEW='));
const url = line.substring('DATABASE_URL_NEW='.length).trim();
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
pool.query(`SELECT DISTINCT role FROM users WHERE role IS NOT NULL ORDER BY role`).then(res => {
  console.log('NEW_DB_ROLES_START');
  res.rows.forEach(r => console.log(r.role));
  console.log('NEW_DB_ROLES_END');
  return pool.query(`SELECT COUNT(*) as cnt FROM user_branch_roles`);
}).then(res => {
  console.log('NEW_UBR_COUNT:', res.rows[0].cnt);
  return pool.end();
}).catch(err => { console.error('ERR:', err.message); pool.end(); });
