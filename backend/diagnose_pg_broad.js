const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function diagnose() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const searchTerms = ['Kigen', 'Rider', 'Yegon'];
  
  for (const term of searchTerms) {
    console.log(`\nSearching for: ${term}`);
    
    // Search staff_profiles
    const staffRes = await client.query(
      "SELECT id, first_name, last_name, role, department, phone, id_number, branch_id FROM staff_profiles WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR id_number ILIKE $1",
      [`%${term}%`]
    );
    console.log(`  staff_profiles: ${staffRes.rows.length} matches`);
    staffRes.rows.forEach(r => console.log(`    - ID: ${r.id}, Name: ${r.first_name} ${r.last_name}, Role: ${r.role}, Dept: ${r.department}, ID: ${r.id_number}, Branch: ${r.branch_id}`));

    // Search users
    const userRes = await client.query(
      "SELECT id, email, first_name, last_name, role FROM users WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1",
      [`%${term}%`]
    );
    console.log(`  users: ${userRes.rows.length} matches`);
    userRes.rows.forEach(r => console.log(`    - ID: ${r.id}, Name: ${r.first_name} ${r.last_name}, Email: ${r.email}, Role: ${r.role}`));
  }

  await client.end();
}

diagnose();
