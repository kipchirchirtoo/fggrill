const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

async function verify() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('--- VERIFYING USER-STAFF OVERLAP ---');
  const res = await client.query(`
    SELECT u.first_name, u.last_name, u.email, s.id as staff_id, s.user_id as staff_user_id
    FROM users u
    LEFT JOIN staff_profiles s ON 
      (u.id = s.user_id) OR
      (LOWER(u.email) = LOWER(s.email)) OR
      (LOWER(u.first_name) = LOWER(s.first_name) AND LOWER(u.last_name) = LOWER(s.last_name))
  `);

  const usersWithProfiles = res.rows.filter(r => r.staff_id);
  const usersWithoutProfiles = res.rows.filter(r => !r.staff_id);

  console.log(`Users total: ${res.rows.length}`);
  console.log(`Users with profile links: ${usersWithProfiles.length}`);
  console.log(`Users without profiles ( потенциальные duplicates?): ${usersWithoutProfiles.length}`);
  
  usersWithoutProfiles.forEach(u => {
    console.log(`- Missing profile: ${u.first_name} ${u.last_name} (${u.email})`);
  });

  console.log('\n--- VERIFYING Driver Redundancy ---');
  const dRes = await client.query('SELECT count(*) FROM drivers');
  console.log(`Total driver records in drivers table: ${dRes.rows[0].count}`);

  await client.end();
}

verify();
