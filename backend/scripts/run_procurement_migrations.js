const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runProcurementMigrations() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting Procurement Migration Runner...');

        // Ensure schema_migrations exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) UNIQUE NOT NULL,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        const { rows: appliedMigrations } = await client.query('SELECT filename FROM schema_migrations');
        const appliedFilenames = new Set(appliedMigrations.map(m => m.filename));

        // Point to the correct migrations folder
        const migrationsDir = path.join(__dirname, '../supabase/migrations');

        // Only run files 20-29 as specified in the enhancement task
        const filesToRun = [
            '20_supplier_vat_enhancements.sql',
            '21_grn_enhancements.sql',
            '22_grni_control_account.sql',
            '23_supplier_invoices.sql',
            '24_supplier_payments.sql',
            '25_supplier_ledger.sql',
            '26_vat_control_accounts.sql',
            '27_procurement_audit_logs.sql',
            '28_grn_inventory_logic.sql',
            '29_supplier_invoice_integration.sql'
        ];

        console.log(`Scanning for ${filesToRun.length} procurement migration files in ${migrationsDir}...`);

        for (const file of filesToRun) {
            if (appliedFilenames.has(file)) {
                console.log(`- Skipping ${file} (already applied)`);
                continue;
            }

            const filePath = path.join(migrationsDir, file);
            if (!fs.existsSync(filePath)) {
                console.warn(`⚠️ Warning: ${file} not found in ${migrationsDir}`);
                continue;
            }

            console.log(`Executing ${file}...`);
            const sql = fs.readFileSync(filePath, 'utf-8');

            try {
                await client.query('BEGIN');
                await client.query(sql);
                await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
                await client.query('COMMIT');
                console.log(`✅ Applied ${file}`);
            } catch (err) {
                await client.query('ROLLBACK');
                if (err.message.includes('already exists')) {
                    console.log(`- Marking ${file} as applied (objects already exist)`);
                    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]).catch(() => { });
                } else {
                    console.error(`❌ Error in ${file}:`, err.message);
                    throw err; // Stop on first major error
                }
            }
        }

        console.log('\n✅ All procurement migrations processed.');

    } catch (error) {
        console.error('Fatal Migration Error:', error.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runProcurementMigrations();
