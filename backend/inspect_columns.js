const { Client } = require('pg');

async function check() {
    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();
    
    // Get columns for staff_profiles
    const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'staff_profiles'");
    console.log("Columns in staff_profiles:");
    res.rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));
    
    await client.end();
}
check();
