const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function runMigration() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Connecting to database...');
        await client.connect();

        const migrations = [
            '../supabase/migrations/20260117_fix_payments_fk_constraints.sql'
        ];

        for (const migration of migrations) {
            const sqlPath = path.join(__dirname, migration);
            console.log(`Reading migration file: ${sqlPath}`);
            const sql = fs.readFileSync(sqlPath, 'utf8');
            console.log(`Running migration: ${migration}...`);
            await client.query(sql);
            console.log(`✓ ${migration} successful.`);
        }

        console.log('\n✅ All migrations completed successfully');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
