const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

async function finalAudit() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('--- USER ACCOUNTS (with logins) ---');
  const userRes = await client.query(`
    SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.department, u.phone_number, ba.branch_id
    FROM users u
    LEFT JOIN user_branch_access ba ON u.id = ba.user_id
    ORDER BY u.email
  `);

  for (const u of userRes.rows) {
    const name = `${u.first_name || ''} ${u.last_name || ''}`.trim();
    console.log(`\nUSER: ${name} (${u.email})`);
    console.log(`  ID: ${u.id}, Role: ${u.role}, Branch: ${u.branch_id}`);
    
    // Find matching staff profiles by name
    const staffRes = await client.query(
      "SELECT id, first_name, last_name, role, department, id_number, branch_id, user_id FROM staff_profiles WHERE (first_name || ' ' || last_name) ILIKE $1",
      [`%${name}%`]
    );
    
    if (staffRes.rows.length > 0) {
      console.log(`  MATCHING STAFF PROFILES: ${staffRes.rows.length}`);
      staffRes.rows.forEach(s => {
        console.log(`    - Profile ID: ${s.id}, StaffID: ${s.id_number}, Role: ${s.role}, Dept: ${s.department}, UserID: ${s.user_id}, Branch: ${s.branch_id}`);
      });
    } else {
      console.log('  NO MATCHING STAFF PROFILE FOUND');
    }
  }

  console.log('\n--- ANALYZING THE THREE SPECIFIC DUPLICATES ---');
  const targets = [
    { name: 'CHRIS KIGEN', id: '3062b9ae-a04b-4a21-8f8d-eac36f8e52f3' },
    { name: 'FESTUS RIDER', id: '6dd8d12d-f607-4797-bdea-5098c8c7cf51' },
    { name: 'FELIX YEGON', id: '50b3aa31-7e66-4722-add0-50054955a7e4' }
  ];

  for (const t of targets) {
    console.log(`\nTarget: ${t.name}`);
    const res = await client.query(
      "SELECT * FROM staff_profiles WHERE (first_name || ' ' || last_name) ILIKE $1 OR id_number IN (SELECT id_number FROM staff_profiles WHERE id = $2)",
      [`%${t.name}%`, t.id]
    );
    res.rows.forEach(r => {
      console.log(`  - [STAFF] ID: ${r.id}, StaffID: ${r.id_number}, Role: ${r.role}, Dept: ${r.department}, Branch: ${r.branch_id}`);
    });
    
    // Check if they are in the users table by name
    const uRes = await client.query(
      "SELECT * FROM users WHERE (first_name || ' ' || last_name) ILIKE $1",
      [`%${t.name}%`]
    );
    uRes.rows.forEach(u => {
      console.log(`  - [USER] ID: ${u.id}, Email: ${u.email}, Role: ${u.role}`);
    });
  }

  await client.end();
}

finalAudit();
