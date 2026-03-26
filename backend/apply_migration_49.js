const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();

async function applyMigration() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        const sql = fs.readFileSync('supabase/migrations/49_add_uniform_enabled.sql', 'utf8');
        console.log('Applying migration 49...');
        await client.query(sql);
        console.log('Migration 49 applied successfully.');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await client.end();
    }
}

applyMigration();
