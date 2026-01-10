const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function runMigration() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        console.log('Connecting to database...');
        await client.connect();

        // Execute migrations in order. 
        // First create tables, then add columns.
        const migrations = [
            '../supabase/migrations/20260107_credit_management.sql.txt',
            '../supabase/migrations/20260112_add_confirmation_to_credit_bills.sql'
        ];

        for (const migration of migrations) {
            const sqlPath = path.join(__dirname, migration);
            console.log(`Reading migration file: ${sqlPath}`);
            const sql = fs.readFileSync(sqlPath, 'utf8');

            console.log(`Running migration: ${migration}...`);
            await client.query(sql);
            console.log(`Check: ${migration} successful.`);
        }

        console.log('All migrations successful');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

runMigration();
