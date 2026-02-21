/**
 * Test script to verify offline database and cached PINs
 * 
 * Run this after starting the Electron app to verify:
 * 1. Database was created
 * 2. Tables exist
 * 3. PINs are cached
 * 4. User data is correct
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Database path (same as Electron app uses)
const dbPath = path.join(
    os.homedir(),
    'AppData',
    'Roaming',
    'fggrill-central',
    'pos-offline.db'
);

console.log('='.repeat(60));
console.log('OFFLINE DATABASE TEST');
console.log('='.repeat(60));
console.log('Database path:', dbPath);
console.log('');

try {
    const db = new Database(dbPath, { readonly: true });
    
    // Check tables
    console.log('📋 TABLES:');
    const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' 
        ORDER BY name
    `).all();
    
    tables.forEach(t => console.log(`  - ${t.name}`));
    console.log('');
    
    // Check cached PINs
    console.log('🔐 CACHED PINS:');
    const pins = db.prepare('SELECT * FROM cached_pins').all();
    console.log(`  Total: ${pins.length}`);
    console.log('');
    
    if (pins.length > 0) {
        console.log('📝 PIN DETAILS:');
        pins.forEach((pin, index) => {
            try {
                const userData = JSON.parse(pin.user_data);
                console.log(`  ${index + 1}. PIN: ${pin.id}`);
                console.log(`     User: ${userData.first_name} ${userData.last_name}`);
                console.log(`     Role: ${userData.role}`);
                console.log(`     Branch: ${userData.branch_id || 'N/A'}`);
                console.log(`     Cached: ${pin.cached_at}`);
                console.log('');
            } catch (err) {
                console.log(`  ${index + 1}. PIN: ${pin.id} - ERROR parsing user data`);
            }
        });
    } else {
        console.log('  ⚠️  No PINs cached yet!');
        console.log('  Run the app and wait for auto-import to complete.');
        console.log('');
    }
    
    // Check sync queue
    console.log('🔄 SYNC QUEUE:');
    const syncStats = db.prepare(`
        SELECT status, COUNT(*) as count 
        FROM sync_queue 
        GROUP BY status
    `).all();
    
    if (syncStats.length > 0) {
        syncStats.forEach(s => console.log(`  ${s.status}: ${s.count}`));
    } else {
        console.log('  Empty (no pending syncs)');
    }
    console.log('');
    
    // Check menu items
    console.log('🍽️  MENU ITEMS:');
    const menuCount = db.prepare('SELECT COUNT(*) as count FROM menu_items').get();
    console.log(`  Total: ${menuCount.count}`);
    console.log('');
    
    // Database info
    console.log('💾 DATABASE INFO:');
    const pageCount = db.prepare('PRAGMA page_count').get();
    const pageSize = db.prepare('PRAGMA page_size').get();
    const sizeKB = (pageCount.page_count * pageSize.page_size) / 1024;
    console.log(`  Size: ${sizeKB.toFixed(2)} KB`);
    console.log(`  Pages: ${pageCount.page_count}`);
    console.log('');
    
    db.close();
    
    console.log('='.repeat(60));
    console.log('✅ TEST COMPLETE');
    console.log('='.repeat(60));
    
} catch (error) {
    console.error('❌ ERROR:', error.message);
    console.log('');
    console.log('Possible causes:');
    console.log('  1. App has not been started yet (database not created)');
    console.log('  2. Database path is incorrect');
    console.log('  3. Database is locked (app is running)');
    console.log('');
    console.log('Try:');
    console.log('  1. Start the app: npm run electron:dev');
    console.log('  2. Wait for auto-import to complete');
    console.log('  3. Close the app');
    console.log('  4. Run this test again');
}
