const { Client } = require('pg');
require('dotenv').config();

async function fixSchema() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('✅ Connected to database');
        console.log('');

        // Check which parent tables exist
        const tablesCheck = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name IN ('dispatch_notes', 'dispatches')
        `);
        
        const tables = tablesCheck.rows.map(r => r.table_name);
        console.log('📋 Found dispatch parent tables:', tables.join(', '));
        console.log('');

        // Check if backup exists
        const backupCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'dispatch_items_backup'
            )
        `);
        
        const hasBackup = backupCheck.rows[0].exists;

        if (hasBackup) {
            console.log('📦 Found backup table, restoring original schema...');
            
            // Drop current table
            await client.query('DROP TABLE IF EXISTS dispatch_items CASCADE');
            
            // Restore from backup
            await client.query('ALTER TABLE dispatch_items_backup RENAME TO dispatch_items');
            
            console.log('✅ Restored original dispatch_items table');
            console.log('');
        }

        // Now check what we have
        const schemaCheck = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'dispatch_items'
            ORDER BY ordinal_position
        `);
        
        const columns = schemaCheck.rows.map(r => r.column_name);
        console.log('📋 Current columns:', columns.join(', '));
        console.log('');

        // Determine which system this is
        const hasItemId = columns.includes('item_id');
        const hasInventoryItemId = columns.includes('inventory_item_id');
        const hasItemSku = columns.includes('item_sku');

        if (hasItemId || hasInventoryItemId) {
            console.log('🔍 Detected: BARCODE/MOBILE system (item_id/inventory_item_id)');
            console.log('');
            console.log('⚠️  PROBLEM: Web API expects item_sku, but table has item_id');
            console.log('');
            console.log('SOLUTION OPTIONS:');
            console.log('');
            console.log('Option 1: Add item_sku column alongside item_id');
            console.log('  - Keeps mobile app working');
            console.log('  - Requires populating item_sku from inventory_items');
            console.log('  - Both systems can coexist');
            console.log('');
            console.log('Option 2: Separate tables (dispatch_items_mobile vs dispatch_items_store)');
            console.log('  - Clean separation');
            console.log('  - Requires code changes in both apps');
            console.log('');
            console.log('Option 3: Update web API to use item_id instead of item_sku');
            console.log('  - Minimal DB changes');
            console.log('  - Requires updating backend controller');
            console.log('');
        } else if (hasItemSku) {
            console.log('🔍 Detected: STORE/WEB system (item_sku)');
            console.log('✅ Schema matches web API expectations');
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

fixSchema();
