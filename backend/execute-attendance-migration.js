
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
    try {
        const filePath = path.join(__dirname, 'supabase/migrations', '20260205_add_branch_to_attendance.sql');
        const sql = fs.readFileSync(filePath, 'utf8');

        console.log('Running migration...');
        await pool.query(sql);
        console.log('✅ Migration completed successfully.');

    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        await pool.end();
    }
}

runMigration();
