const fs = require('fs');
const { Pool } = require('pg');
const envContent = fs.readFileSync('.env', 'utf8');
const oldUrl = envContent.split('\n').find(l => l.startsWith('DATABASE_URL_OLD=')).substring('DATABASE_URL_OLD='.length).trim();
console.log('Creating pool...');
const pool = new Pool({ connectionString: oldUrl, ssl: { rejectUnauthorized: false } });
console.log('Querying users...');
pool.query('SELECT id, email, role FROM users ORDER BY email LIMIT 5').then(res => {
  console.log('Got', res.rows.length, 'users');
  res.rows.forEach(r => console.log(r.email, r.role));
  return pool.end();
}).then(() => console.log('Done')).catch(err => { console.error('ERR:', err.message); pool.end(); });
