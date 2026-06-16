const fs = require('fs');
const { Pool } = require('pg');

const envContent = fs.readFileSync('.env', 'utf8');
const oldUrlLine = envContent.split('\n').find(l => l.startsWith('DATABASE_URL_OLD='));
if (!oldUrlLine) {
  console.error('DATABASE_URL_OLD not found');
  process.exit(1);
}
const oldUrl = oldUrlLine.substring('DATABASE_URL_OLD='.length).trim();
console.log('Old URL found, connecting...');

const pool = new Pool({
  connectionString: oldUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000
});

pool.query('SELECT 1 as test').then(res => {
  console.log('Connected! Test:', res.rows[0].test);
  return pool.query(`SELECT COUNT(*) as cnt FROM users`);
}).then(res => {
  console.log('Users count:', res.rows[0].cnt);
  return pool.end();
}).catch(err => {
  console.error('Error:', err.message);
  pool.end();
});
