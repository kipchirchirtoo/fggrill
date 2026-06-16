const fs = require('fs');
const { Pool } = require('pg');

const envContent = fs.readFileSync('.env', 'utf8');
const oldUrl = envContent.split('\n').find(l => l.startsWith('DATABASE_URL_OLD=')).substring('DATABASE_URL_OLD='.length).trim();
const newUrl = envContent.split('\n').find(l => l.startsWith('DATABASE_URL_NEW=')).substring('DATABASE_URL_NEW='.length).trim();

async function run() {
  console.log('=== PHASE 1: Read from Old DB ===');
  const oldPool = new Pool({ connectionString: oldUrl, ssl: { rejectUnauthorized: false } });

  const oldUsers = await oldPool.query(`SELECT id, email, role FROM users ORDER BY email`);
  console.log('Old users:', oldUsers.rows.length);

  const oldUbr = await oldPool.query(`SELECT id, user_id, branch_id, role, is_primary, created_at, updated_at FROM user_branch_roles`);
  console.log('Old UBR:', oldUbr.rows.length);

  await oldPool.end();

  console.log('\n=== PHASE 2: Read from New DB ===');
  const newPool = new Pool({ connectionString: newUrl, ssl: { rejectUnauthorized: false } });

  const newUsers = await newPool.query(`SELECT id, email, role FROM users ORDER BY email`);
  console.log('New users:', newUsers.rows.length);

  const newUbr = await newPool.query(`SELECT user_id, branch_id, role FROM user_branch_roles`);
  console.log('New UBR:', newUbr.rows.length);

  console.log('\n=== PHASE 3: Sync ===');
  const newByEmail = new Map(newUsers.rows.map(u => [u.email, u]));
  let updated = 0;
  for (const oldUser of oldUsers.rows) {
    const newUser = newByEmail.get(oldUser.email);
    if (newUser && newUser.role !== oldUser.role) {
      await newPool.query(`UPDATE users SET role = $1 WHERE id = $2`, [oldUser.role, newUser.id]);
      console.log(`Updated: ${oldUser.email} -> ${oldUser.role}`);
      updated++;
    }
  }
  console.log(`Updated ${updated} roles`);

  const newUbrKey = new Set(newUbr.rows.map(r => `${r.user_id}:${r.branch_id}:${r.role}`));
  let inserted = 0;
  let skipped = 0;
  for (const ubr of oldUbr.rows) {
    const key = `${ubr.user_id}:${ubr.branch_id}:${ubr.role}`;
    if (!newUbrKey.has(key)) {
      try {
        await newPool.query(`INSERT INTO user_branch_roles (id, user_id, branch_id, role, is_primary, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`, [ubr.id, ubr.user_id, ubr.branch_id, ubr.role, ubr.is_primary, ubr.created_at, ubr.updated_at]);
        inserted++;
      } catch (e) {
        skipped++;
      }
    }
  }
  console.log(`Inserted ${inserted} UBR, skipped ${skipped}`);

  const verify = await newPool.query(`SELECT DISTINCT role FROM users WHERE role IS NOT NULL ORDER BY role`);
  console.log('\nRoles in new DB:');
  verify.rows.forEach(r => console.log(' -', r.role));

  await newPool.end();
  console.log('\nDONE!');
}

run().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
