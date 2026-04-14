const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function applyMigration() {
    console.log('========================================');
    console.log(' APPLYING GRN STOCK UPDATE FIX');
    console.log('========================================\n');

    const client = await pool.connect();
    
    try {
        const migrationPath = path.join(__dirname, 'supabase', 'migrations', '32_fix_grn_stock_update.sql');
        console.log('📄 Reading migration file...');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('🔄 Applying migration to database...\n');

        await client.query(sql);

        console.log('\n✅ Migration applied successfully!\n');
        console.log('The GRN approval process will now update simple_items stock.\n');
        console.log('WORKFLOW:');
        console.log('1. Receive goods at /dashboard/central-store/receiving');
        console.log('2. APPROVE the GRN at /dashboard/central-store/procurement/grn');
        console.log('3. Stock will be updated automatically!\n');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('\nPlease apply manually using Supabase SQL Editor:');
        console.error('File: backend/supabase/migrations/32_fix_grn_stock_update.sql\n');
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

applyMigration();
