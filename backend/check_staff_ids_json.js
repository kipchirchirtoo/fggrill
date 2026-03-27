const { Client } = require('pg');
const fs = require('fs');

async function check() {
    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();
    
    const res = await client.query("SELECT first_name, last_name, id_number, national_id, branch_id FROM staff_profiles LIMIT 20;");
    fs.writeFileSync('staff_ids_dump.json', JSON.stringify(res.rows, null, 2));
    console.log('staff_ids_dump.json written');
    await client.end();
}
check();
