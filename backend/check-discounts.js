const { Client } = require('pg');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    await client.connect();
    const r = await client.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'restaurant_discounts' AND table_schema = 'public'");
    console.log('Exists:', r.rows.length > 0);
    await client.end();
}

check();
