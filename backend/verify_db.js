const { Client } = require('pg');

async function verify() {
    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();

    console.log('--- VERIFICATION ---');
    let fail = false;

    // 1. Check users count
    const uRes = await client.query("SELECT COUNT(*)::int as count FROM users");
    if (uRes.rows[0].count !== 1) {
        console.error(`FAIL: Users count is ${uRes.rows[0].count}, expected 1.`);
        fail = true;
    } else {
        console.log(`PASS: Users count is exactly 1.`);
    }

    // 3. Check all other tables
    const res = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('users', 'schema_migrations')");
    const tables = res.rows.map(r => r.tablename);

    for (const table of tables) {
        console.log(`Checking ${table}...`);
        const tReq = await client.query(`SELECT COUNT(*)::int as count FROM "${table}"`);
        if (tReq.rows[0].count > 0) {
            console.error(`FAIL: Table ${table} is NOT empty! Count: ${tReq.rows[0].count}`);
            fail = true;
        }
    }

    if (!fail) {
        console.log('PASS: All other tables verified completely empty.');
        console.log('SYSTEM IS CLEAN AND PRODUCTION-READY.');
        process.exit(0);
    } else {
        console.error('SYSTEM VERIFICATION FAILED.');
        process.exit(1);
    }
}
verify().catch(e => { console.error(e); process.exit(1); });
