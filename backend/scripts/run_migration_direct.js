const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const dbUrl = 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('🚀 Connecting to database...');

        const sqlPath = path.join(__dirname, '../src/database/migrations/20260128_add_rfid_tag.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

        console.log('📝 Executing migration SQL...');
        console.log(sqlContent);

        await client.query('BEGIN');
        await client.query(sqlContent);
        await client.query('COMMIT');

        console.log('✅ Migration executed successfully!');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
