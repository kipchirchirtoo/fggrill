const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('🚀 Connecting to database...');

        const sqlPath = path.join(__dirname, 'add_status_to_ledger.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

        console.log('📝 Executing migration SQL...');
        console.log(sqlContent);

        await client.query('BEGIN');
        await client.query(sqlContent);
        await client.query('COMMIT');

        console.log('✅ Migration executed successfully!');
        process.exit(0);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
