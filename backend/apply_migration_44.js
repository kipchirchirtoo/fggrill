const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config();

async function runMigration() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        const sql = fs.readFileSync('./supabase/migrations/44_draft_payroll_system.sql', 'utf8');
        console.log('Running migration: 44_draft_payroll_system.sql');
        await client.query(sql);
        console.log('Migration applied successfully!');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await client.end();
    }
}

runMigration();
