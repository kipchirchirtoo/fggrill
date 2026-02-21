// Test script to verify orders sync functionality
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.env.APPDATA || process.env.HOME, 'fggrill-pos', 'pos-cache.db');
console.log('Database path:', dbPath);

try {
    const db = new Database(dbPath);
    
    console.log('\n========== ORDERS SYNC TEST ==========\n');
    
    // Check if restaurant_orders table exists
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='restaurant_orders'`).all();
    console.log('restaurant_orders table exists:', tables.length > 0);
    
    if (tables.length > 0) {
        // Get today's date
        const today = new Date().toISOString().split('T')[0];
        console.log('Checking orders for date:', today);
        
        // Count total orders
        const totalOrders = db.prepare(`SELECT COUNT(*) as count FROM restaurant_orders`).get();
        console.log('Total orders in cache:', totalOrders.count);
        
        // Count today's orders
        const todayOrders = db.prepare(`SELECT COUNT(*) as count FROM restaurant_orders WHERE DATE(created_at) = ?`).get(today);
        console.log("Today's orders:", todayOrders.count);
        
        // Show recent orders
        const recentOrders = db.prepare(`
            SELECT id, order_number, status, total_amount, waiter_name, created_at 
            FROM restaurant_orders 
            ORDER BY created_at DESC 
            LIMIT 10
        `).all();
        
        console.log('\nRecent orders:');
        recentOrders.forEach(order => {
            console.log(`  - Order #${order.order_number}: ${order.status}, KES ${order.total_amount}, Waiter: ${order.waiter_name || 'N/A'}, Created: ${order.created_at}`);
        });
        
        // Check order items
        const itemsCount = db.prepare(`SELECT COUNT(*) as count FROM restaurant_order_items`).get();
        console.log('\nTotal order items in cache:', itemsCount.count);
    }
    
    db.close();
    console.log('\n========== TEST COMPLETE ==========\n');
} catch (err) {
    console.error('Error:', err.message);
}
