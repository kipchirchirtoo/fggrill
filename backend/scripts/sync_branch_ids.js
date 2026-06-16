const fs = require('fs');
const { Pool } = require('pg');

const envContent = fs.readFileSync('.env', 'utf8');
const oldUrl = envContent.split('\n').find(l => l.startsWith('DATABASE_URL_OLD=')).substring('DATABASE_URL_OLD='.length).trim();
const newUrl = envContent.split('\n').find(l => l.startsWith('DATABASE_URL_NEW=')).substring('DATABASE_URL_NEW='.length).trim();

async function run() {
  const oldPool = new Pool({ connectionString: oldUrl, ssl: { rejectUnauthorized: false } });
  const newPool = new Pool({ connectionString: newUrl, ssl: { rejectUnauthorized: false } });

  try {
    // Get old users with branch_id
    const oldUsers = await oldPool.query(`SELECT id, email, branch_id, role FROM users WHERE branch_id IS NOT NULL`);
    console.log(`Old DB has ${oldUsers.rows.length} users with branch_id`);

    // Get new users
    const newUsers = await newPool.query(`SELECT id, email, branch_id, role FROM users`);
    console.log(`New DB has ${newUsers.rows.length} users`);

    const newByEmail = new Map(newUsers.rows.map(u => [u.email, u]));

    let updated = 0;
    let missing = 0;
    for (const oldUser of oldUsers.rows) {
      const newUser = newByEmail.get(oldUser.email);
      if (newUser) {
        if (newUser.branch_id !== oldUser.branch_id) {
          await newPool.query(`UPDATE users SET branch_id = $1 WHERE id = $2`, [oldUser.branch_id, newUser.id]);
          console.log(`Updated: ${oldUser.email} -> branch_id ${oldUser.branch_id}`);
          updated++;
        }
      } else {
        console.log(`User not found in new DB: ${oldUser.email}`);
        missing++;
      }
    }
    console.log(`\nUpdated ${updated} user branch_ids`);
    console.log(`Missing ${missing} users`);

    // Verify
    const verify = await newPool.query(`
      SELECT email, role, branch_id FROM users 
      WHERE branch_id IS NOT NULL 
      ORDER BY email
    `);
    console.log(`\nNew DB users with branch_id: ${verify.rows.length}`);
    verify.rows.forEach(u => console.log(` - ${u.email} | role: ${u.role} | branch: ${u.branch_id}`));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await oldPool.end();
    await newPool.end();
  }
}

run();
