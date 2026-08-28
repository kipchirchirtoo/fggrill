
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

// Use the provided credentials
const dbUrl = "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres";

const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('❌ Please provide the SQL filename as an argument.');
        process.exit(1);
    }

    const filename = args[0];
    const sqlPath = path.join(__dirname, '../src/database/migrations', filename);

    if (!fs.existsSync(sqlPath)) {
        console.error(`❌ SQL file not found: ${sqlPath}`);
        process.exit(1);
    }

    const client = await pool.connect();
    try {
        console.log(`🚀 Connecting to database to run ${filename}...`);
        const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

        console.log('📝 Executing migration SQL...');
        // Split by semicolon to handle multiple statements better if needed, 
        // but pg usually handles blocks well. 
        // For distinct separate commands that can't be in one block, simple exec might fail usually if transaction control is inside.
        // We'll trust the SQL file integrity for now.

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
