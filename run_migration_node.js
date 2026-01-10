const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: 'backend/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    try {
        const migrationPath = path.join(__dirname, 'backend', 'supabase', 'migrations', '20260114_fix_branch_id_types_and_permissions.sql');
        console.log(`Reading migration file from: ${migrationPath}`);

        const sql = fs.readFileSync(migrationPath, 'utf8');
        console.log('Migration file read successfully. Executing SQL...');

        await pool.query(sql);
        console.log('Migration executed successfully!');

    } catch (err) {
        console.error('Error executing migration:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
