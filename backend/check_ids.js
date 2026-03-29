const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function check() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const ids = ['FGH008', 'FGH081', 'FGH073'];
  for (const id of ids) {
    console.log(`\nChecking ID: ${id}`);
    const res = await client.query('SELECT * FROM staff_profiles WHERE id_number = $1', [id]);
    console.log(`  Matches: ${res.rows.length}`);
    res.rows.forEach(r => console.log(`    - Profile ID: ${r.id}, Name: ${r.first_name} ${r.last_name}, Role: ${r.role}, Dept: ${r.department}`));
  }

  await client.end();
}

check();
