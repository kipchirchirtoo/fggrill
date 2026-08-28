const fs = require('fs');
const { Pool } = require('pg');

const envContent = fs.readFileSync('.env', 'utf8');
const newUrlLine = envContent.split('\n').find(l => l.startsWith('DATABASE_URL_NEW='));
const newUrl = newUrlLine.substring('DATABASE_URL_NEW='.length).trim();
console.log('New URL:', newUrl.substring(0, 50) + '...');

const pool = new Pool({
  connectionString: newUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000
});

pool.query('SELECT 1 as test').then(res => {
  console.log('New DB Connected! Test:', res.rows[0].test);
  return pool.end();
}).catch(err => {
  console.error('Error:', err.message);
  pool.end();
});
