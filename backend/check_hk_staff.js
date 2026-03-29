const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

async function checkHK() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const searchTerms = ['Kigen', 'Rider', 'Yegon'];
  for (const term of searchTerms) {
    console.log(`\nSearching for: ${term} in hk_staff_profiles`);
    const res = await client.query(
      "SELECT * FROM hk_staff_profiles WHERE first_name ILIKE $1 OR last_name ILIKE $1",
      [`%${term}%`]
    );
    console.log(`  Matches: ${res.rows.length}`);
    res.rows.forEach(r => console.log(`    - HK ID: ${r.id}, Name: ${r.first_name} ${r.last_name}`));
  }

  await client.end();
}

checkHK();
