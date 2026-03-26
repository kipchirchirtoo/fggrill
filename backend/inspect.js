const { Client } = require('pg');

async function inspect() {
    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();

    const tables = ['branches', 'departments', 'staff_profiles', 'users'];
    
    for (const table of tables) {
        console.log(`\n--- Schema for ${table} ---`);
        const res = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = $1
            ORDER BY ordinal_position;
        `, [table]);
        
        if (res.rows.length === 0) {
            console.log(`Table ${table} not found.`);
        } else {
            res.rows.forEach(col => {
                console.log(`${col.column_name} (${col.data_type}) [Nullable: ${col.is_nullable}] Default: ${col.column_default}`);
            });
        }
    }
    
    await client.end();
}
inspect().catch(console.error);
