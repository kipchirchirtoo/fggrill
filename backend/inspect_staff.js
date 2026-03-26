const { Client } = require('pg');

async function inspect() {
    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();

    // How many total?
    const total = await client.query("SELECT COUNT(*) FROM staff_profiles");
    console.log("TOTAL staff_profiles:", total.rows[0].count);

    // Group by branch
    const byBranch = await client.query("SELECT b.name, COUNT(s.id) FROM branches b JOIN staff_profiles s ON s.branch_id = b.id GROUP BY b.name");
    console.log("By Branch:", byBranch.rows);

    await client.end();
}
inspect().catch(console.error);
