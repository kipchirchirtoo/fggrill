const fs = require('fs');
const { Pool } = require('pg');

const envContent = fs.readFileSync('.env', 'utf8');
const oldUrl = envContent.split('\n').find(l => l.startsWith('DATABASE_URL_OLD=')).substring('DATABASE_URL_OLD='.length).trim();
const newUrl = envContent.split('\n').find(l => l.startsWith('DATABASE_URL_NEW=')).substring('DATABASE_URL_NEW='.length).trim();

async function sync() {
  console.log('Connecting to old DB...');
  const oldPool = new Pool({ connectionString: oldUrl, ssl: { rejectUnauthorized: false } });
  console.log('Connecting to new DB...');
  const newPool = new Pool({ connectionString: newUrl, ssl: { rejectUnauthorized: false } });

  try {
    // 1. Get all users from old DB with their roles
    console.log('Fetching old users...');
    const oldUsers = await oldPool.query(`SELECT id, email, role, first_name, last_name FROM users ORDER BY email`);
    console.log('Old DB users:', oldUsers.rows.length);

    // 2. Get all users from new DB
    console.log('Fetching new users...');
    const newUsers = await newPool.query(`SELECT id, email, role FROM users ORDER BY email`);
    console.log('New DB users:', newUsers.rows.length);

    // 3. Map new DB users by email
    const newByEmail = new Map(newUsers.rows.map(u => [u.email, u]));

    // 4. Update roles for users that exist in both
    let updated = 0;
    for (const oldUser of oldUsers.rows) {
      const newUser = newByEmail.get(oldUser.email);
      if (newUser && newUser.role !== oldUser.role) {
        await newPool.query(`UPDATE users SET role = $1 WHERE id = $2`, [oldUser.role, newUser.id]);
        console.log(`Updated role for ${oldUser.email}: ${newUser.role} -> ${oldUser.role}`);
        updated++;
      }
    }
    console.log(`\nUpdated ${updated} user roles`);

    // 5. Get old user_branch_roles
    console.log('Fetching old user_branch_roles...');
    const oldUbr = await oldPool.query(`SELECT id, user_id, branch_id, role, is_primary, created_at, updated_at FROM user_branch_roles ORDER BY created_at`);
    console.log(`Old DB user_branch_roles: ${oldUbr.rows.length}`);

    // 6. Insert missing user_branch_roles into new DB
    console.log('Fetching new user_branch_roles...');
    const newUbr = await newPool.query(`SELECT user_id, branch_id, role FROM user_branch_roles`);
    const newUbrKey = new Set(newUbr.rows.map(r => `${r.user_id}:${r.branch_id}:${r.role}`));

    let inserted = 0;
    let skipped = 0;
    for (const ubr of oldUbr.rows) {
      const key = `${ubr.user_id}:${ubr.branch_id}:${ubr.role}`;
      if (!newUbrKey.has(key)) {
        try {
          await newPool.query(`
            INSERT INTO user_branch_roles (id, user_id, branch_id, role, is_primary, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO NOTHING
          `, [ubr.id, ubr.user_id, ubr.branch_id, ubr.role, ubr.is_primary, ubr.created_at, ubr.updated_at]);
          inserted++;
        } catch (e) {
          skipped++;
        }
      }
    }
    console.log(`Inserted ${inserted} user_branch_roles`);
    console.log(`Skipped ${skipped} (user not found or conflict)`);

    // 7. Verify
    const verifyRoles = await newPool.query(`SELECT DISTINCT role FROM users WHERE role IS NOT NULL ORDER BY role`);
    console.log('\nNew DB roles after sync:');
    verifyRoles.rows.forEach(r => console.log(' -', r.role));

    const verifyUbr = await newPool.query(`SELECT COUNT(*) as cnt FROM user_branch_roles`);
    console.log('\nNew DB user_branch_roles after sync:', verifyUbr.rows[0].cnt);

  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  } finally {
    await oldPool.end();
    await newPool.end();
  }
}

sync();
