
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
    try {
        const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20260206_create_drivers_table.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Running migration: 20260206_create_drivers_table.sql');
        await pool.query(sql);
        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await pool.end();
    }
}

runMigration();
