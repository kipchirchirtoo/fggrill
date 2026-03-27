const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres'
});

async function run() {
  await client.connect();
  console.log('Connected.\n');

  // Check all departments in staff_profiles
  const deptResult = await client.query(`SELECT department, count(*) FROM staff_profiles GROUP BY department ORDER BY department`);
  console.log('=== ALL DEPARTMENTS ===');
  deptResult.rows.forEach(r => console.log(` department="${r.department}"  count=${r.count}`));

  // Check for Chris, Festus, Felix
  const nameResult = await client.query(`
    SELECT id, first_name, last_name, department, position, status, phone
    FROM staff_profiles 
    WHERE LOWER(first_name) IN ('chris','festus','felix')
       OR LOWER(last_name) IN ('kigen','yegon','rider')
    ORDER BY first_name
  `);
  console.log('\n=== CHRIS/FESTUS/FELIX RECORDS ===', nameResult.rows.length);
  nameResult.rows.forEach(r => console.log(JSON.stringify(r)));

  // Check for any 'driver' or 'Driver' values
  const driverResult = await client.query(`
    SELECT id, first_name, last_name, department, position FROM staff_profiles 
    WHERE department ILIKE 'driver%' OR department ILIKE 'transport%'
    LIMIT 20
  `);
  console.log('\n=== DRIVER DEPARTMENT RECORDS ===', driverResult.rows.length);
  driverResult.rows.forEach(r => console.log(JSON.stringify(r)));

  await client.end();
}
run().catch(e => { console.error(e.message); client.end(); });
