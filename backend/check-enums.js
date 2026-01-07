const { Client } = require('pg');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    await client.connect();
    const r = await client.query(`
        SELECT t.typname as enum_name, e.enumlabel as enum_value
        FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid  
        JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
        ORDER BY enum_name, e.enumsortorder
    `);

    const enums = {};
    r.rows.forEach(row => {
        if (!enums[row.enum_name]) enums[row.enum_name] = [];
        enums[row.enum_name].push(row.enum_value);
    });

    console.log('Current Enums:', JSON.stringify(enums, null, 2));
    await client.end();
}

check();
