const { Client } = require('pg');

async function wipe() {
    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();
    
    // Check superadmin before we wipe
    const preCheck = await client.query("SELECT * FROM users WHERE email = 'kipchirchirtoo01@gmail.com'");
    if (preCheck.rows.length === 0) {
        console.error('Superadmin kipchirchirtoo01@gmail.com not found before wiping. We cannot safely wipe. Check users table!');
        process.exit(1);
    }

    // 1. Get all tables in public schema except 'users'
    // Exclude Supabase internal views or migrations table if needed, wait Supabase pg_tables public schema has migrations.
    // 'supabase_migrations'
    const res = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('users', 'schema_migrations')");
    const tables = res.rows.map(r => r.tablename);
    
    // 2. Start transaction
    await client.query('BEGIN');
    try {
        console.log('Truncating tables with CASCADE...');
        if (tables.length > 0) {
            const tableList = tables.map(t => '"' + t + '"').join(', ');
            await client.query('TRUNCATE TABLE ' + tableList + ' RESTART IDENTITY CASCADE');
        }
        
        console.log('Cleaning users table...');
        await client.query("DELETE FROM users WHERE email != 'kipchirchirtoo01@gmail.com'");
        
        console.log('Resetting sequence for users table (assuming id is serial/identity)...');
        try {
            const seqRes = await client.query("SELECT pg_get_serial_sequence('users', 'id') as seq");
            if (seqRes.rows[0].seq) {
                const maxRes = await client.query("SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM users");
                const nextId = maxRes.rows[0].next_id;
                await client.query(`ALTER SEQUENCE ${seqRes.rows[0].seq} RESTART WITH ${nextId}`);
                console.log('Users sequence reset to ' + nextId);
            }
        } catch(e) { /* UUID or no sequence */ console.log('No integer sequence on users table or error resetting it.'); }

        await client.query('COMMIT');
        console.log('Wipe successful.');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Wipe failed, rolled back.', e);
        process.exit(1);
    }
    
    // VERIFICATION
    console.log('--- VERIFICATION ---');
    const uRes = await client.query("SELECT COUNT(*)::int as count FROM users");
    console.log(`Users count: ${uRes.rows[0].count} (must be 1)`);
    const adminCheck = await client.query("SELECT email FROM users");
    console.log(`Users email: ${adminCheck.rows.map(r => r.email).join(', ')} (must be kipchirchirtoo01@gmail.com)`);

    let anyNotEmpty = false;
    for (const table of tables) {
        const tReq = await client.query(`SELECT COUNT(*)::int as count FROM "${table}"`);
        if (tReq.rows[0].count > 0) {
            console.error(`Table ${table} is NOT empty! Count: ${tReq.rows[0].count}`);
            anyNotEmpty = true;
        }
    }
    if (!anyNotEmpty) {
        console.log('All other tables verified empty.');
    }
    await client.end();
}

wipe().catch(console.error);
