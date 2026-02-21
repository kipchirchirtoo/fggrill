/**
 * Test script to verify menu items auto-import functionality
 * Run this after starting the Electron app to check if menu items are cached
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Get the database path (same as Electron app)
const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'fg-pos-terminal');
const dbPath = path.join(userDataPath, 'pos-offline.db');

console.log('=== Menu Items Import Test ===');
console.log('Database path:', dbPath);
console.log('');

try {
    const db = new Database(dbPath, { readonly: true });

    // Check categories
    const categoryCount = db.prepare('SELECT COUNT(*) as count FROM restaurant_menu_categories').get();
    console.log(`✓ Menu Categories: ${categoryCount.count}`);

    if (categoryCount.count > 0) {
        const categories = db.prepare('SELECT id, name, is_active, is_bar FROM restaurant_menu_categories LIMIT 5').all();
        console.log('\nSample Categories:');
        categories.forEach(cat => {
            console.log(`  - ${cat.name} (${cat.is_bar ? 'Bar' : 'Restaurant'}) [${cat.is_active ? 'Active' : 'Inactive'}]`);
        });
    }

    // Check menu items
    const itemCount = db.prepare('SELECT COUNT(*) as count FROM restaurant_menu_items').get();
    console.log(`\n✓ Menu Items: ${itemCount.count}`);

    if (itemCount.count > 0) {
        const items = db.prepare(`
            SELECT 
                i.id, 
                i.name, 
                i.price, 
                i.branch_id,
                c.name as category_name
            FROM restaurant_menu_items i
            LEFT JOIN restaurant_menu_categories c ON i.category_id = c.id
            LIMIT 10
        `).all();
        
        console.log('\nSample Menu Items:');
        items.forEach(item => {
            const branchInfo = item.branch_id ? `Branch ${item.branch_id}` : 'All Branches';
            console.log(`  - ${item.name} - $${item.price} (${item.category_name || 'No Category'}) [${branchInfo}]`);
        });
    }

    // Check by branch
    const branchItems = db.prepare(`
        SELECT branch_id, COUNT(*) as count 
        FROM restaurant_menu_items 
        GROUP BY branch_id
    `).all();

    console.log('\nItems by Branch:');
    branchItems.forEach(b => {
        const branchLabel = b.branch_id === null ? 'All Branches' : `Branch ${b.branch_id}`;
        console.log(`  - ${branchLabel}: ${b.count} items`);
    });

    db.close();

    console.log('\n=== Test Complete ===');
    
    if (categoryCount.count === 0 || itemCount.count === 0) {
        console.log('\n⚠ WARNING: No menu items found!');
        console.log('Make sure the Electron app has started and the auto-import has run.');
        console.log('Check the app logs for "[Menu Auto-Import]" messages.');
    } else {
        console.log('\n✓ SUCCESS: Menu items are cached and ready for offline use!');
    }

} catch (err) {
    console.error('❌ Error:', err.message);
    console.log('\nMake sure:');
    console.log('1. The Electron app has been started at least once');
    console.log('2. The database file exists at:', dbPath);
    console.log('3. better-sqlite3 is installed: npm install better-sqlite3');
}
