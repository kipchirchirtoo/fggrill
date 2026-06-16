const fs = require('fs');
const { Pool } = require('pg');
const newUrl = fs.readFileSync('.env', 'utf8').split('\n').find(l => l.startsWith('DATABASE_URL_NEW=')).substring('DATABASE_URL_NEW='.length).trim();
const pool = new Pool({ connectionString: newUrl, ssl: { rejectUnauthorized: false } });

async function run() {
  const missingEmails = [
    'alvinkim@famousgate.com',
    'auditor@famousgate.com',
    'brendah@famousgate.com',
    'chelsea@famousgate.com',
    'display@famousgate.com',
    'kentonui@famousgates.com',
    'koskei@famousgate.com',
    'sharonchepkemoi@famousgate.com'
  ];

  for (const email of missingEmails) {
    const user = await pool.query('SELECT first_name, last_name FROM users WHERE email = $1', [email]);
    const name = user.rows[0];
    console.log(`\n${email} -> ${name ? name.first_name + ' ' + name.last_name : 'NOT FOUND'}`);

    // Search staff by first name
    if (name && name.first_name) {
      const staff = await pool.query(
        "SELECT id, first_name, last_name, email, branch_id FROM staff_profiles WHERE first_name ILIKE $1 OR last_name ILIKE $2 LIMIT 5",
        [name.first_name, name.last_name]
      );
      if (staff.rows.length > 0) {
        staff.rows.forEach(s => console.log('  candidate:', s.first_name, s.last_name, '| email:', s.email, '| branch:', s.branch_id));
      } else {
        console.log('  No matching staff found');
      }
    }
  }

  await pool.end();
}

run().catch(err => { console.error('FATAL:', err.message); pool.end(); });
