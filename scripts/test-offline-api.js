const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Manually construct the path since we're not in Electron context
const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'fggrill-central');
const dbPath = path.join(userDataPath, 'powersync.db');

console.log('--- Testing Offline API Data Queries ---');
console.log('Database Path:', dbPath);

const fs = require('fs');
if (!fs.existsSync(dbPath)) {
    console.error('ERROR: PowerSync database not found at:', dbPath);
    console.log('Please ensure the Electron app has been run at least once to create the database.');
    process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

console.log('\n=== Testing Restaurant Menu Items Query ===');
try {
    // Simulate restaurantAPI.getMenuItems with client-side join
    const items = db.prepare('SELECT * FROM restaurant_menu_items WHERE is_available = ?').all(1);
    const categories = db.prepare('SELECT * FROM restaurant_menu_categories').all();

    console.log(`Found ${items.length} menu items`);
    console.log(`Found ${categories.length} categories`);

    // Perform client-side join
    const catMap = new Map(categories.map(c => [c.id, c]));
    const enrichedItems = items.map(item => ({
        ...item,
        is_available: item.is_available === 1 || item.is_available === true,
        category: catMap.get(item.category_id) || { name: 'Unknown' }
    }));

    console.log('Sample enriched item:', enrichedItems[0] || 'No items found');
} catch (err) {
    console.error('ERROR:', err.message);
}

console.log('\n=== Testing Restaurant Categories Query ===');
try {
    const categories = db.prepare('SELECT * FROM restaurant_menu_categories WHERE is_active = ?').all(1);
    console.log(`Found ${categories.length} active categories`);
    console.log('Sample category:', categories[0] || 'No categories found');
} catch (err) {
    console.error('ERROR:', err.message);
}

console.log('\n=== Testing Bar Drinks Query ===');
try {
    // Simulate barAPI.getDrinks with category filtering
    const barCategories = db.prepare('SELECT * FROM restaurant_menu_categories WHERE is_bar = ?').all(1);
    const barCatIds = new Set(barCategories.map(c => c.id));

    console.log(`Found ${barCategories.length} bar categories`);

    const items = db.prepare('SELECT * FROM restaurant_menu_items WHERE is_available = ?').all(1);
    const filteredItems = items.filter(item => barCatIds.has(item.category_id));

    // Join category data
    const catMap = new Map(barCategories.map(c => [c.id, c]));
    const enrichedItems = filteredItems.map(item => ({
        ...item,
        is_available: item.is_available === 1 || item.is_available === true,
        category: catMap.get(item.category_id) || { name: 'Unknown' }
    }));

    console.log(`Found ${enrichedItems.length} bar drinks`);
    console.log('Sample drink:', enrichedItems[0] || 'No drinks found');
} catch (err) {
    console.error('ERROR:', err.message);
}

console.log('\n=== Testing Restaurant Orders Query ===');
try {
    const orders = db.prepare('SELECT * FROM restaurant_orders').all();
    console.log(`Found ${orders.length} restaurant orders`);
    console.log('Sample order:', orders[0] || 'No orders found');
} catch (err) {
    console.error('ERROR:', err.message);
}

console.log('\n=== Testing Bar Orders Query ===');
try {
    const orders = db.prepare('SELECT * FROM bar_orders').all();
    console.log(`Found ${orders.length} bar orders`);
    console.log('Sample order:', orders[0] || 'No orders found');
} catch (err) {
    console.error('ERROR:', err.message);
}

db.close();
console.log('\n--- Verification Complete ---');
