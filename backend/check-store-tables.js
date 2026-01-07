const { Client } = require('pg');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    await client.connect();
    const r = await client.query("SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'store_%' AND table_schema = 'public'");
    console.log('Store tables:', r.rows.map(r => r.table_name));
    await client.end();
}

check();
