const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();

async function applyMigration() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        const sql = fs.readFileSync('./migrations/20260422_add_batch_tracking_to_dispatch_items.sql', 'utf8');
        console.log('📝 Applying migration: 20260422_add_batch_tracking_to_dispatch_items.sql');
        console.log('');

        await client.query(sql);
        
        console.log('✅ Migration applied successfully!');
        console.log('');
        console.log('Added columns to dispatch_items:');
        console.log('  - batch_number (VARCHAR(50))');
        console.log('  - expiry_date (DATE)');
        console.log('  - bin_location (VARCHAR(50))');
        console.log('  - damaged_quantity (INTEGER)');
        console.log('  - missing_quantity (INTEGER)');
        console.log('  - discrepancy_reason (TEXT)');
        console.log('');
        console.log('🎉 Dispatch notes can now track batch numbers and expiry dates!');

    } catch (err) {
        console.error('❌ Error applying migration:', err.message);
        console.error(err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

applyMigration();
