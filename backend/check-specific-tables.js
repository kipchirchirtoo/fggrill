const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
    await client.connect();
    const tables = ['staff', 'staff_profiles', 'users', 'branches', 'inventory_items'];
    for (const t of tables) {
        const r = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1 AND table_schema = 'public')", [t]);
        console.log(`${t} exists:`, r.rows[0].exists);
    }
    await client.end();
}

check();
