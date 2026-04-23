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
        console.log('');

        const sql = fs.readFileSync('./migrations/20260422_hybrid_dispatch_items.sql', 'utf8');
        console.log('📝 Applying hybrid dispatch_items migration...');
        console.log('');

        await client.query(sql);
        
        console.log('✅ Migration applied successfully!');
        console.log('');
        console.log('🎉 dispatch_items now supports BOTH systems:');
        console.log('');
        console.log('📱 MOBILE APP columns:');
        console.log('   - item_id (integer)');
        console.log('   - item_name (varchar)');
        console.log('   - quantity (integer)');
        console.log('   - unit (varchar)');
        console.log('');
        console.log('🌐 WEB API columns:');
        console.log('   - item_sku (varchar)');
        console.log('   - dispatched_quantity (integer)');
        console.log('   - received_quantity (integer)');
        console.log('   - status (varchar)');
        console.log('');
        console.log('📊 SHARED columns:');
        console.log('   - batch_number, expiry_date, bin_location');
        console.log('   - damaged_quantity, missing_quantity, discrepancy_reason');
        console.log('');
        console.log('✅ Both mobile app and web API can now work simultaneously!');
        console.log('');
        console.log('⚠️  CRITICAL NEXT STEP:');
        console.log('   Go to Supabase Dashboard → Settings → API');
        console.log('   Click "Reload Schema" to refresh the cache');
        console.log('');

    } catch (err) {
        console.error('❌ Error applying migration:', err.message);
        console.error(err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

applyMigration();
