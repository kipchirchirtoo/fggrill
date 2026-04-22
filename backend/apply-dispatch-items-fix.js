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

        // Check if there's existing data
        const checkData = await client.query('SELECT COUNT(*) FROM dispatch_items');
        const rowCount = parseInt(checkData.rows[0].count);
        
        if (rowCount > 0) {
            console.log(`⚠️  WARNING: Found ${rowCount} existing rows in dispatch_items`);
            console.log('   These will be backed up to dispatch_items_backup');
            console.log('');
        }

        const sql = fs.readFileSync('./migrations/20260422_fix_dispatch_items_schema.sql', 'utf8');
        console.log('📝 Applying migration: 20260422_fix_dispatch_items_schema.sql');
        console.log('');

        await client.query(sql);
        
        console.log('✅ Migration applied successfully!');
        console.log('');
        console.log('Fixed dispatch_items schema:');
        console.log('  OLD columns: item_id, item_name, quantity');
        console.log('  NEW columns: item_sku, dispatched_quantity, received_quantity');
        console.log('');
        console.log('Additional tracking columns:');
        console.log('  - batch_number');
        console.log('  - expiry_date');
        console.log('  - bin_location');
        console.log('  - damaged_quantity');
        console.log('  - missing_quantity');
        console.log('  - discrepancy_reason');
        console.log('  - status');
        console.log('');
        
        if (rowCount > 0) {
            console.log(`📦 Backup table created: dispatch_items_backup (${rowCount} rows)`);
            console.log('');
        }
        
        console.log('🎉 Schema now matches API expectations!');
        console.log('');
        console.log('⚠️  IMPORTANT NEXT STEP:');
        console.log('   Go to Supabase Dashboard → Settings → API');
        console.log('   Click "Reload Schema" to refresh the cache');

    } catch (err) {
        console.error('❌ Error applying migration:', err.message);
        console.error(err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

applyMigration();
