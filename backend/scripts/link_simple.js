const fs = require('fs');
const { Pool } = require('pg');
const newUrl = fs.readFileSync('.env', 'utf8').split('\n').find(l => l.startsWith('DATABASE_URL_NEW=')).substring('DATABASE_URL_NEW='.length).trim();
const pool = new Pool({ connectionString: newUrl, ssl: { rejectUnauthorized: false } });

async function run() {
  console.log('Fetching users...');
  const users = await pool.query('SELECT id, email, first_name, last_name, branch_id FROM users ORDER BY email');
  console.log('Users:', users.rows.length);

  console.log('Fetching staff...');
  const staff = await pool.query('SELECT id, first_name, last_name, email, branch_id, user_id FROM staff_profiles ORDER BY first_name');
  console.log('Staff:', staff.rows.length);

  let linked = 0;
  let updatedBranch = 0;

  for (const user of users.rows) {
    let match = staff.rows.find(s => s.email && s.email.toLowerCase() === user.email.toLowerCase());

    if (!match && user.first_name && user.last_name) {
      const uFirst = (user.first_name || '').toLowerCase().trim();
      const uLast = (user.last_name || '').toLowerCase().trim();
      match = staff.rows.find(s => {
        const sFirst = (s.first_name || '').toLowerCase().trim();
        const sLast = (s.last_name || '').toLowerCase().trim();
        return sFirst === uFirst && sLast === uLast;
      });
    }

    if (match) {
      await pool.query('UPDATE staff_profiles SET user_id = $1, email = $2 WHERE id = $3', [user.id, user.email, match.id]);
      if (!user.branch_id && match.branch_id) {
        await pool.query('UPDATE users SET branch_id = $1 WHERE id = $2', [match.branch_id, user.id]);
        updatedBranch++;
      }
      linked++;
      console.log('Linked:', user.email, '->', match.first_name, match.last_name);
    } else {
      console.log('No match:', user.email);
    }
  }

  console.log('\nLinked:', linked);
  console.log('Updated branch:', updatedBranch);

  const remaining = await pool.query('SELECT id, email, branch_id FROM users WHERE id NOT IN (SELECT user_id FROM staff_profiles WHERE user_id IS NOT NULL) ORDER BY email');
  console.log('Remaining unlinked:', remaining.rows.length);
  remaining.rows.forEach(u => console.log(' -', u.email, 'branch:', u.branch_id));

  await pool.end();
}

run().catch(err => { console.error('FATAL:', err.message); pool.end(); });
