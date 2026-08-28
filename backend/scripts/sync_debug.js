const fs = require('fs');
const { Pool } = require('pg');

const envContent = fs.readFileSync('.env', 'utf8');
const oldUrl = envContent.split('\n').find(l => l.startsWith('DATABASE_URL_OLD=')).substring('DATABASE_URL_OLD='.length).trim();
const newUrl = envContent.split('\n').find(l => l.startsWith('DATABASE_URL_NEW=')).substring('DATABASE_URL_NEW='.length).trim();

console.log('Script started');
console.log('Old URL length:', oldUrl.length);
console.log('New URL length:', newUrl.length);

async function run() {
  console.log('Phase 1: Connect to old DB');
  const oldPool = new Pool({ connectionString: oldUrl, ssl: { rejectUnauthorized: false } });
  console.log('Old pool created');

  console.log('Querying old users...');
  const oldUsers = await oldPool.query(`SELECT id, email, role FROM users ORDER BY email`);
  console.log('Old users:', oldUsers.rows.length);

  console.log('Querying old UBR...');
  const oldUbr = await oldPool.query(`SELECT id, user_id, branch_id, role FROM user_branch_roles`);
  console.log('Old UBR:', oldUbr.rows.length);

  console.log('Closing old pool...');
  await oldPool.end();
  console.log('Old pool closed');

  console.log('Phase 2: Connect to new DB');
  const newPool = new Pool({ connectionString: newUrl, ssl: { rejectUnauthorized: false } });
  console.log('New pool created');

  console.log('Querying new users...');
  const newUsers = await newPool.query(`SELECT id, email, role FROM users ORDER BY email`);
  console.log('New users:', newUsers.rows.length);

  console.log('Querying new UBR...');
  const newUbr = await newPool.query(`SELECT user_id, branch_id, role FROM user_branch_roles`);
  console.log('New UBR:', newUbr.rows.length);

  console.log('Closing new pool...');
  await newPool.end();
  console.log('Done!');
}

run().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
