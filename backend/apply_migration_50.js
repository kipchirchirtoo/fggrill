const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();

async function applyMigration() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
        await client.connect();
        const sql = fs.readFileSync('./supabase/migrations/50_fix_payroll_records_shif_nssf.sql', 'utf8');
        console.log('Running migration: 50_fix_payroll_records_shif_nssf.sql');
        await client.query(sql);
        console.log('Migration 50 applied successfully.');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await client.end();
    }
}

applyMigration();
