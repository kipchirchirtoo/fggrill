const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();

async function applyMigration() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
        await client.connect();
        const sql = fs.readFileSync('./supabase/migrations/51_fix_payroll_staff_fk.sql', 'utf8');
        console.log('Running migration: 51_fix_payroll_staff_fk.sql');
        await client.query(sql);
        console.log('Migration 51 applied successfully.');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await client.end();
    }
}

applyMigration();
