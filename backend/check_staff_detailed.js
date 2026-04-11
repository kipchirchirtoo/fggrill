const { Client } = require('pg');

async function check() {
    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();
    
    // Check total count
    const countRes = await client.query("SELECT COUNT(*) FROM staff_profiles");
    console.log(`\nTotal staff profiles: ${countRes.rows[0].count}\n`);
    
    // Check staff with national_id
    const withNationalId = await client.query("SELECT COUNT(*) FROM staff_profiles WHERE national_id IS NOT NULL");
    console.log(`Staff with national_id: ${withNationalId.rows[0].count}\n`);
    
    // Show sample with all relevant fields
    const res = await client.query(`
        SELECT first_name, last_name, id_number, national_id, status, branch_id, department, role 
        FROM staff_profiles 
        WHERE status = 'active'
        ORDER BY id_number 
        LIMIT 30
    `);
    console.log('Active staff members:');
    console.table(res.rows);
    
    // Check if FG-005 exists (with or without hyphen)
    const fg005 = await client.query(`
        SELECT * FROM staff_profiles 
        WHERE id_number IN ('FG-005', 'FG005', 'FGH005', 'FGH-005')
    `);
    console.log(`\nSearching for FG-005 variants: ${fg005.rows.length} found`);
    if (fg005.rows.length > 0) {
        console.table(fg005.rows);
    }
    
    await client.end();
}
check();
