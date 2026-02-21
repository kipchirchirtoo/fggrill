require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixKitchenUsageSchema() {
    console.log('🔧 Fixing kitchen_usage_records schema relationship...\n');

    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // 1. Drop existing constraint if it exists
        console.log('1️⃣ Dropping existing constraint (if any)...');
        await client.query(`
            DO $$ 
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.table_constraints 
                    WHERE constraint_name = 'kitchen_usage_records_recorded_by_fkey'
                    AND table_name = 'kitchen_usage_records'
                ) THEN
                    ALTER TABLE kitchen_usage_records DROP CONSTRAINT kitchen_usage_records_recorded_by_fkey;
                    RAISE NOTICE 'Dropped existing constraint';
                END IF;
            END $$;
        `);

        // 2. Clean up invalid references
        console.log('2️⃣ Cleaning up invalid user references...');
        const cleanupResult = await client.query(`
            UPDATE kitchen_usage_records k
            SET recorded_by = NULL
            WHERE recorded_by IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = k.recorded_by)
        `);
        console.log(`   Cleaned ${cleanupResult.rowCount} invalid references`);

        // 3. Add proper foreign key constraint
        console.log('3️⃣ Adding foreign key constraint...');
        await client.query(`
            ALTER TABLE kitchen_usage_records
            ADD CONSTRAINT kitchen_usage_records_recorded_by_fkey
            FOREIGN KEY (recorded_by) REFERENCES users(id)
            ON DELETE SET NULL
        `);

        // 4. Create index
        console.log('4️⃣ Creating performance index...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_kitchen_usage_records_recorded_by 
            ON kitchen_usage_records(recorded_by)
        `);

        await client.query('COMMIT');
        console.log('\n✅ Kitchen usage records schema fixed successfully!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n❌ Error fixing schema:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

fixKitchenUsageSchema()
    .then(() => {
        console.log('\n✅ Fix complete!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });
