const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function diagnose() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('--- DATABASE DIAGNOSIS ---');

  const tables = ['staff_profiles', 'drivers', 'users', 'restaurant_delivery_drivers'];
  
  for (const table of tables) {
    try {
      const res = await client.query(`SELECT count(*) FROM ${table}`);
      console.log(`${table}: ${res.rows[0].count} records`);
    } catch (e) {
      console.log(`${table}: Table not found or error: ${e.message}`);
    }
  }

  console.log('\n--- SEARCHING FOR SPECIFIC NAMES ---');
  const names = ['Chris Kigen', 'Festus Rider', 'Felix Yegon'];
  
  for (const name of names) {
    console.log(`\nSearching for: ${name}`);
    const parts = name.split(' ');
    const first = parts[0];
    const last = parts[1] || '';

    // Search staff_profiles
    const staffRes = await client.query(
      "SELECT id, first_name, last_name, role, department, phone, id_number FROM staff_profiles WHERE (first_name ILIKE $1 AND last_name ILIKE $2) OR (first_name ILIKE $3)",
      [`%${first}%`, `%${last}%`, `%${name}%`]
    );
    console.log(`  staff_profiles: ${staffRes.rows.length} matches`);
    staffRes.rows.forEach(r => console.log(`    - ID: ${r.id}, Role: ${r.role}, Dept: ${r.department}, StaffID: ${r.id_number}`));

    // Search drivers
    const driverRes = await client.query(
      "SELECT id, name, phone, status FROM drivers WHERE name ILIKE $1",
      [`%${first}%`]
    );
    console.log(`  drivers: ${driverRes.rows.length} matches`);
    driverRes.rows.forEach(r => console.log(`    - ID: ${r.id}, Name: ${r.name}, Phone: ${r.phone}`));

    // Search users
    const userRes = await client.query(
      "SELECT id, email, first_name, last_name, role FROM users WHERE (first_name ILIKE $1 AND last_name ILIKE $2) OR (first_name ILIKE $3)",
      [`%${first}%`, `%${last}%`, `%${name}%`]
    );
    console.log(`  users: ${userRes.rows.length} matches`);
    userRes.rows.forEach(r => console.log(`    - ID: ${r.id}, Email: ${r.email}, Role: ${r.role}`));
  }

  await client.end();
}

diagnose();
