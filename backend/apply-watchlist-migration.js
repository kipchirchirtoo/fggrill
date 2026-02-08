const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function start() {
    const filePath = path.join(__dirname, 'supabase/migrations/20260208_create_auditor_watchlist.sql');
    console.log(`Executing ${filePath}...`);
    const sql = fs.readFileSync(filePath, 'utf8');

    await client.connect();
    try {
        await client.query(sql);
        console.log('✅ Migration applied successfully.');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        await client.end();
    }
}

start();
