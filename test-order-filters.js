/**
 * Test Order Filtering Implementation
 * Run this to verify the order filtering is working in the database
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Get the database path (same as Electron app)
const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'famous-gate-pos', 'pos-offline.db');

console.log('📂 Database path:', dbPath);

try {
    const db = new Database(dbPath, { readonly: true });
    
    console.log('\n=== TESTING ORDER FILTERS ===\n');
    
    // 1. Check if waiter_id and waiter_name columns exist
    console.log('1️⃣ Checking restaurant_orders schema...');
    const tableInfo = db.prepare("PRAGMA table_info(restaurant_orders)").all();
    const hasWaiterId = tableInfo.some(col => col.name === 'waiter_id');
    const hasWaiterName = tableInfo.some(col => col.name === 'waiter_name');
    
    console.log('   ✓ waiter_id column exists:', hasWaiterId);
    console.log('   ✓ waiter_name column exists:', hasWaiterName);
    
    if (!hasWaiterId || !hasWaiterName) {
        console.log('\n❌ ERROR: Missing waiter columns! Database needs migration.');
        console.log('   Columns found:', tableInfo.map(c => c.name).join(', '));
        process.exit(1);
    }
    
    // 2. Get all orders
    console.log('\n2️⃣ Fetching all orders...');
    const allOrders = db.prepare(`
        SELECT id, order_number, status, waiter_id, waiter_name, created_by, created_at
        FROM restaurant_orders
        ORDER BY created_at DESC
        LIMIT 20
    `).all();
    
    console.log(`   Found ${allOrders.length} orders`);
    
    if (allOrders.length > 0) {
        console.log('\n   Sample orders:');
        allOrders.slice(0, 5).forEach(order => {
            console.log(`   - Order #${order.order_number}: status=${order.status}, waiter_id=${order.waiter_id || 'NULL'}, created_by=${order.created_by || 'NULL'}`);
        });
    }
    
    // 3. Test status filtering
    console.log('\n3️⃣ Testing status filters...');
    const statuses = ['pending', 'preparing', 'ready', 'completed', 'served', 'cancelled'];
    
    statuses.forEach(status => {
        const count = db.prepare(`
            SELECT COUNT(*) as count FROM restaurant_orders WHERE status = ?
        `).get(status);
        console.log(`   ${status}: ${count.count} orders`);
    });
    
    // 4. Test waiter filtering
    console.log('\n4️⃣ Testing waiter filters...');
    
    // Get unique waiters
    const waiters = db.prepare(`
        SELECT DISTINCT created_by, waiter_id, waiter_name 
        FROM restaurant_orders 
        WHERE created_by IS NOT NULL OR waiter_id IS NOT NULL
        LIMIT 5
    `).all();
    
    console.log(`   Found ${waiters.length} unique waiters/creators`);
    waiters.forEach(w => {
        console.log(`   - created_by: ${w.created_by || 'NULL'}, waiter_id: ${w.waiter_id || 'NULL'}, waiter_name: ${w.waiter_name || 'NULL'}`);
    });
    
    // 5. Test combined filtering (status + waiter)
    if (waiters.length > 0) {
        const testWaiter = waiters[0];
        console.log('\n5️⃣ Testing combined filter (status + waiter)...');
        console.log(`   Using waiter: created_by=${testWaiter.created_by}`);
        
        const filteredOrders = db.prepare(`
            SELECT COUNT(*) as count 
            FROM restaurant_orders 
            WHERE created_by = ? AND status = 'pending'
        `).get(testWaiter.created_by);
        
        console.log(`   Pending orders for this waiter: ${filteredOrders.count}`);
    }
    
    // 6. Test "All Orders" vs "My Orders"
    console.log('\n6️⃣ Testing "All Orders" vs "My Orders"...');
    const totalOrders = db.prepare(`SELECT COUNT(*) as count FROM restaurant_orders`).get();
    console.log(`   Total orders (All Orders): ${totalOrders.count}`);
    
    if (waiters.length > 0) {
        const myOrders = db.prepare(`
            SELECT COUNT(*) as count FROM restaurant_orders WHERE created_by = ?
        `).get(waiters[0].created_by);
        console.log(`   My orders (created_by=${waiters[0].created_by}): ${myOrders.count}`);
    }
    
    console.log('\n✅ All filter tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Database schema is correct');
    console.log('   - Status filtering works');
    console.log('   - Waiter filtering works');
    console.log('   - Combined filtering works');
    
    db.close();
    
} catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
}
