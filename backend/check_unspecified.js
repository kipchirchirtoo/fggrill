const { Client } = require('pg');

async function checkUnspecified() {
    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();
    try {
        const res = await client.query("SELECT b.name as branch, s.id_number, s.first_name, s.last_name, s.role, s.department FROM staff_profiles s JOIN branches b ON s.branch_id = b.id WHERE s.role = 'UNSPECIFIED' OR s.role IS NULL");
        console.table(res.rows);
    } finally {
        await client.end();
    }
}
checkUnspecified();
