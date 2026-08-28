console.log('START');
const fs = require('fs');
const { Pool } = require('pg');
const envContent = fs.readFileSync('.env', 'utf8');
const oldUrl = envContent.split('\n').find(l => l.startsWith('DATABASE_URL_OLD=')).substring('DATABASE_URL_OLD='.length).trim();
console.log('URL parsed');
const pool = new Pool({ connectionString: oldUrl, ssl: { rejectUnauthorized: false } });
console.log('Pool created');
pool.query('SELECT 1 as test').then(res => {
  console.log('Query result:', res.rows[0].test);
  return pool.end();
}).then(() => {
  console.log('DONE');
}).catch(err => {
  console.error('ERR:', err.message);
  pool.end();
});
