const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function applyMigration() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        let sql = '';
        const migrationFile = process.argv[2];
        
        if (migrationFile) {
            const fs = require('fs');
            const filePath = migrationFile.includes(':') ? migrationFile : path.join(__dirname, 'supabase', 'migrations', migrationFile);
            if (!fs.existsSync(filePath)) {
                throw new Error(`Migration file not found: ${filePath}`);
            }
            sql = fs.readFileSync(filePath, 'utf8');
            console.log(`Applying migration from file: ${migrationFile}`);
        } else {
            sql = `
            -- Add columns for detailed bill tracking in cashier shifts
            ALTER TABLE public.cashier_shift_logs
            ADD COLUMN IF NOT EXISTS credit_bills_details JSONB DEFAULT '[]'::jsonb,
            ADD COLUMN IF NOT EXISTS paid_bills_details JSONB DEFAULT '[]'::jsonb,
            ADD COLUMN IF NOT EXISTS paid_bills_value DECIMAL(12, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS paid_bills_count INTEGER DEFAULT 0;

            COMMENT ON COLUMN public.cashier_shift_logs.credit_bills_details IS 'List of credit bills with staff_id, name, amount';
            COMMENT ON COLUMN public.cashier_shift_logs.paid_bills_details IS 'List of paid bills with name, amount';
            `;
            console.log('Applying default hardcoded migration.');
        }

        await client.query(sql);
        console.log('Migration applied successfully.');

    } catch (err) {
        console.error('Error applying migration:', err.message);
    } finally {
        await client.end();
    }
}

applyMigration();
