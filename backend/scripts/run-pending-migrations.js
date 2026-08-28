const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function runMigration() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Required for Supabase in some envs
    });

    try {
        console.log('Connecting to database...');
        await client.connect();

        const migrations = [
            '../supabase/migrations/20260113_advanced_features.sql',
            '../supabase/migrations/20260117_add_pos_transaction_to_payments.sql'
        ];

        for (const migration of migrations) {
            const sqlPath = path.join(__dirname, migration);
            console.log(`Reading migration file: ${sqlPath}`);
            try {
                const sql = fs.readFileSync(sqlPath, 'utf8');
                console.log(`Running migration: ${migration}...`);
                await client.query(sql);
                console.log(`Check: ${migration} successful.`);
            } catch (fileErr) {
                console.error(`Failed to read/run ${migration}:`, fileErr.message);
            }
        }

        console.log('Migration execution completed');
    } catch (err) {
        console.error('Database connection failed:', err);
    } finally {
        await client.end();
    }
}

runMigration();
