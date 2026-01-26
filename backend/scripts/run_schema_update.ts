
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from backend root .env
// dotenv.config({ path: path.join(__dirname, '../.env') });

const dbUrl = "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres";

const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('🚀 Connecting to database...');

        const sqlPath = path.join(__dirname, '../src/database/migrations/add_user_profile_fields.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

        console.log('📝 Executing migration SQL...');
        console.log(sqlContent);

        await client.query('BEGIN');
        await client.query(sqlContent);
        await client.query('COMMIT');

        console.log('✅ Migration executed successfully!');
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
