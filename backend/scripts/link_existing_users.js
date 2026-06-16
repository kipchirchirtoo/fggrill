const fs = require('fs');
const { Pool } = require('pg');
const newUrl = fs.readFileSync('.env', 'utf8').split('\n').find(l => l.startsWith('DATABASE_URL_NEW=')).substring('DATABASE_URL_NEW='.length).trim();
const pool = new Pool({ connectionString: newUrl, ssl: { rejectUnauthorized: false } });

async function linkUsers() {
  try {
    // Get all users
    const users = await pool.query(`SELECT id, email, first_name, last_name, branch_id FROM users ORDER BY email`);
    console.log(`Found ${users.rows.length} users`);

    // Get all staff_profiles
    const staff = await pool.query(`SELECT id, first_name, last_name, email, branch_id, user_id FROM staff_profiles ORDER BY first_name`);
    console.log(`Found ${staff.rows.length} staff_profiles`);

    let linked = 0;
    let updatedBranch = 0;

    for (const user of users.rows) {
      // Try to match by email first
      let match = staff.rows.find(s => s.email && s.email.toLowerCase() === user.email.toLowerCase());

      // Then try by first_name + last_name
      if (!match && user.first_name && user.last_name) {
        match = staff.rows.find(s => {
          const sFirst = (s.first_name || '').toLowerCase().trim();
          const sLast = (s.last_name || '').toLowerCase().trim();
          const uFirst = (user.first_name || '').toLowerCase().trim();
          const uLast = (user.last_name || '').toLowerCase().trim();
          return sFirst === uFirst && sLast === uLast;
        });
      }

      if (match) {
        // Update staff_profiles.user_id
        await pool.query(`UPDATE staff_profiles SET user_id = $1, email = $2 WHERE id = $3`,
          [user.id, user.email, match.id]);

        // Update user's branch_id from staff profile if user has none and staff has one
        if (!user.branch_id && match.branch_id) {
          await pool.query(`UPDATE users SET branch_id = $1 WHERE id = $2`, [match.branch_id, user.id]);
          updatedBranch++;
        }

        linked++;
        console.log(`Linked: ${user.email} -> ${match.first_name} ${match.last_name} (staff_id: ${match.id})`);
      } else {
        console.log(`No match for: ${user.email} (${user.first_name} ${user.last_name})`);
      }
    }

    console.log(`\nLinked ${linked} users to staff profiles`);
    console.log(`Updated ${updatedBranch} user branch_ids from staff profiles`);

    // Report remaining unlinked users
    const remaining = await pool.query(`
      SELECT id, email, first_name, last_name, branch_id
      FROM users
      WHERE id NOT IN (SELECT user_id FROM staff_profiles WHERE user_id IS NOT NULL)
      ORDER BY email
    `);
    console.log(`\nRemaining unlinked users: ${remaining.rows.length}`);
    remaining.rows.forEach(u => console.log(` - ${u.email} | branch: ${u.branch_id}`));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

linkUsers();
