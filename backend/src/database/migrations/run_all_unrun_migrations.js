const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DATABASE_URL = 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMigrations() {
    const client = await pool.connect();
    try {
        // console.log('🚀 Starting automated migration runner...');

        // 1. Ensure schema_migrations table exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) UNIQUE NOT NULL,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // 2. Get list of applied migrations
        const { rows: appliedMigrations } = await client.query('SELECT filename FROM schema_migrations');
        const appliedFilenames = new Set(appliedMigrations.map(m => m.filename));

        // 3. Scan migrations directory
        const migrationsDir = path.join(__dirname);
        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort(); // Sort alphabetically (00, 01, ..., 2023, 2024, ...)

        // console.log(`Found ${files.length} SQL migration files.`);

        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        for (const file of files) {
            // Skip 00_drop_existing.sql unless specifically requested (too dangerous for 'run all')
            if (file === '00_drop_existing.sql') {
                // console.log(`- Skipping ${file} (protection)`);
                skipCount++;
                continue;
            }

            if (appliedFilenames.has(file)) {
                // console.log(`- Skipping ${file} (already applied)`);
                skipCount++;
                continue;
            }

            // console.log(`Executing ${file}...`);
            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

            try {
                await client.query('BEGIN');
                await client.query(sql);
                await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
                await client.query('COMMIT');

                // console.log(`✅ Applied ${file}`);
                successCount++;
            } catch (err) {
                await client.query('ROLLBACK');

                if (err.message.includes('already exists')) {
                    // console.log(`- Marking ${file} as applied (objects already exist)`);
                    try {
                        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
                        successCount++;
                    } catch (trackErr) {
                        // Record might already be there if we ran partially
                    }
                } else {
                    console.error(`❌ Error in ${file}:`, err.message);
                    errorCount++;
                    // Stop on first fatal error
                    // console.log('Migration stopped due to fatal error.');
                    break;
                }
            }
        }

        // console.log('\nMigration Summary:');
        // console.log(`- Applied: ${successCount}`);
        // console.log(`- Skipped: ${skipCount}`);
        // console.log(`- Errors:  ${errorCount}`);

    } catch (error) {
        console.error('Fatal Migration Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigrations();
