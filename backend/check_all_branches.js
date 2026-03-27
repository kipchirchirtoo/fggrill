const { Client } = require('pg');

async function check() {
    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();
    
    // Get stats from all branches
    const res = await client.query(`
        SELECT b.name as branch_name, sp.first_name, sp.last_name, sp.id_number, sp.national_id 
        FROM staff_profiles sp
        JOIN branches b ON sp.branch_id = b.id
        WHERE sp.id_number IS NOT NULL
        LIMIT 50;
    `);
    require('fs').writeFileSync('staff_ids_all_branches.json', JSON.stringify(res.rows, null, 2));
    console.log('staff_ids_all_branches.json written');
    
    await client.end();
}
check();
