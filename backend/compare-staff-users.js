const { Client } = require('pg');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    await client.connect();
    const tables = ['staff_profiles', 'users'];
    for (const t of tables) {
        const r = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = $1 AND table_schema = 'public'
        `, [t]);
        console.log(`Columns for ${t}:`, r.rows.map(c => `${c.column_name} (${c.data_type})`));
    }
    await client.end();
}

check();
