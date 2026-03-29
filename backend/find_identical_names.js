const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

async function findIdenticalNames() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('--- SEARCHING FOR IDENTICAL NAMES IN staff_profiles ---');

  const query = `
    SELECT UPPER(TRIM(first_name)) as fn, UPPER(TRIM(last_name)) as ln, COUNT(*)
    FROM staff_profiles
    GROUP BY fn, ln
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `;

  const res = await client.query(query);
  console.log(`Found ${res.rows.length} names with multiple records.\n`);

  for (const row of res.rows) {
    console.log(`Name: ${row.fn} ${row.ln} (${row.count} records)`);
    const details = await client.query(
      "SELECT id, first_name, last_name, role, department, id_number, branch_id, updated_at FROM staff_profiles WHERE UPPER(TRIM(first_name)) = $1 AND UPPER(TRIM(last_name)) = $2",
      [row.fn, row.ln]
    );
    details.rows.forEach(r => {
      console.log(`  - ID: ${r.id}, Branch: ${r.branch_id}, StaffID: ${r.id_number}, Role: ${r.role}, Dept: ${r.department}, Updated: ${r.updated_at}`);
    });
  }

  console.log('\n--- SEARCHING FOR CROSS-TABLE IDENTICAL NAMES (staff_profiles vs drivers) ---');
  const crossQuery = `
    SELECT UPPER(TRIM(s.first_name || ' ' || s.last_name)) as name
    FROM staff_profiles s
    JOIN drivers d ON UPPER(TRIM(s.first_name || ' ' || s.last_name)) = UPPER(TRIM(d.name))
  `;
  const crossRes = await client.query(crossQuery);
  console.log(`Found ${crossRes.rows.length} names that exist in both tables.`);
  crossRes.rows.forEach(r => console.log(`  - ${r.name}`));

  await client.end();
}

findIdenticalNames();
