/**
 * Debug Orders Fetch - Check what's happening with order fetching
 * 
 * Run this in the Developer Console to see:
 * 1. If orders auto-sync is working
 * 2. If orders are in the cache
 * 3. What user ID is being used
 * 4. What the getMyOrders function is returning
 */

(async function debugOrdersFetch() {
    console.log('🔍 Debugging Orders Fetch...\n');
    
    // 1. Check current user
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    console.log('👤 Current User:', {
        id: user.id,
        firstName: user.firstName || user.first_name,
        lastName: user.lastName || user.last_name,
        role: user.role
    });
    
    // 2. Check branch
    const branchId = localStorage.getItem('activeBranchId');
    console.log('🏢 Active Branch ID:', branchId);
    
    // 3. Check if orders are in cache
    try {
        const allOrders = await window.electronAPI.invoke('db:get', 'restaurant_orders', {});
        console.log(`\n📦 Total orders in cache: ${allOrders?.length || 0}`);
        
        if (allOrders && allOrders.length > 0) {
            console.log('Sample order:', allOrders[0]);
            
            // Check orders for current user
            const userOrders = allOrders.filter(o => 
                o.created_by === user.id || o.waiter_id === user.id
            );
            console.log(`📋 Orders for current user: ${userOrders.length}`);
            
            // Check orders for current branch
            const branchOrders = allOrders.filter(o => 
                o.branch_id === Number(branchId)
            );
            console.log(`🏢 Orders for current branch: ${branchOrders.length}`);
            
            // Check today's orders
            const today = new Date().toISOString().split('T')[0];
            const todayOrders = allOrders.filter(o => 
                o.created_at && o.created_at.startsWith(today)
            );
            console.log(`📅 Orders for today (${today}): ${todayOrders.length}`);
        }
    } catch (error) {
        console.error('❌ Error checking cache:', error);
    }
    
    // 4. Test the cache:getOrders handler
    try {
        const today = new Date().toISOString().split('T')[0];
        console.log(`\n🔍 Testing cache:getOrders handler...`);
        console.log(`Parameters: userId=${user.id}, branchId=${branchId}, from=${today}, to=${today}`);
        
        const orders = await window.electronAPI.invoke('cache:getOrders', user.id, Number(branchId), today, today);
        console.log(`✅ cache:getOrders returned ${orders?.length || 0} orders`);
        
        if (orders && orders.length > 0) {
            console.log('Sample order from handler:', orders[0]);
        }
    } catch (error) {
        console.error('❌ Error calling cache:getOrders:', error);
    }
    
    // 5. Check sync status
    try {
        const syncStatus = await window.electronAPI.invoke('sync:status');
        console.log('\n📊 Sync Status:', syncStatus);
    } catch (error) {
        console.error('❌ Error checking sync status:', error);
    }
    
    // 6. Trigger orders sync manually
    console.log('\n🔄 Triggering manual orders sync...');
    try {
        const result = await window.electronAPI.invoke('autosync:syncOrdersNow');
        console.log('✅ Sync result:', result);
    } catch (error) {
        console.error('❌ Error triggering sync:', error);
    }
    
    console.log('\n✅ Debug complete! Check the logs above for issues.');
})();
