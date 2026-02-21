/**
 * Fix Orders Not Showing - Complete Diagnostic and Fix
 * 
 * This script will:
 * 1. Check if user is logged in
 * 2. Check if orders exist in cache
 * 3. Trigger orders sync from Supabase
 * 4. Verify orders are fetched correctly
 * 
 * Run this in Developer Console (Ctrl+Shift+I)
 */

(async function fixOrdersNotShowing() {
    console.log('🔧 Fixing Orders Not Showing Issue...\n');
    
    // Step 1: Check user
    console.log('📋 Step 1: Checking user authentication...');
    const userStr = localStorage.getItem('user');
    if (!userStr) {
        console.error('❌ No user found in localStorage!');
        console.log('💡 You need to log in first.');
        return;
    }
    
    const user = JSON.parse(userStr);
    console.log('✅ User found:', {
        id: user.id,
        name: `${user.firstName || user.first_name || ''} ${user.lastName || user.last_name || ''}`.trim(),
        role: user.role,
        branch_id: user.branch_id
    });
    
    // Step 2: Check branch
    console.log('\n📋 Step 2: Checking active branch...');
    const branchId = localStorage.getItem('activeBranchId') || user.branch_id;
    console.log('✅ Branch ID:', branchId);
    
    // Step 3: Check if orders exist in cache
    console.log('\n📋 Step 3: Checking orders in cache...');
    try {
        const allOrders = await window.electronAPI.invoke('db:get', 'restaurant_orders', {});
        console.log(`📦 Total orders in cache: ${allOrders?.length || 0}`);
        
        if (allOrders && allOrders.length > 0) {
            // Show breakdown
            const today = new Date().toISOString().split('T')[0];
            const todayOrders = allOrders.filter(o => o.created_at && o.created_at.startsWith(today));
            const userOrders = allOrders.filter(o => o.created_by === user.id || o.waiter_id === user.id);
            const branchOrders = allOrders.filter(o => o.branch_id === Number(branchId));
            
            console.log(`  📅 Today's orders: ${todayOrders.length}`);
            console.log(`  👤 Your orders: ${userOrders.length}`);
            console.log(`  🏢 Branch orders: ${branchOrders.length}`);
            
            if (todayOrders.length > 0) {
                console.log('\n  Sample order:', {
                    id: todayOrders[0].id,
                    order_number: todayOrders[0].order_number,
                    status: todayOrders[0].status,
                    created_by: todayOrders[0].created_by,
                    waiter_id: todayOrders[0].waiter_id,
                    created_at: todayOrders[0].created_at
                });
            }
        } else {
            console.log('⚠️  No orders in cache - will sync from Supabase');
        }
    } catch (error) {
        console.error('❌ Error checking cache:', error);
    }
    
    // Step 4: Trigger orders sync
    console.log('\n📋 Step 4: Syncing orders from Supabase...');
    try {
        const syncResult = await window.electronAPI.invoke('autosync:syncOrdersNow');
        if (syncResult.success) {
            console.log(`✅ Synced ${syncResult.ordersCount} orders and ${syncResult.itemsCount} items`);
        } else {
            console.error('❌ Sync failed:', syncResult.error);
        }
    } catch (error) {
        console.error('❌ Error triggering sync:', error);
    }
    
    // Step 5: Test cache:getOrders handler
    console.log('\n📋 Step 5: Testing cache:getOrders handler...');
    try {
        const today = new Date().toISOString().split('T')[0];
        console.log(`  Parameters: userId=${user.id}, branchId=${branchId}, from=${today}, to=${today}`);
        
        const orders = await window.electronAPI.invoke('cache:getOrders', user.id, Number(branchId), today, today);
        console.log(`✅ Handler returned ${orders?.length || 0} orders`);
        
        if (orders && orders.length > 0) {
            console.log('\n  Sample order from handler:', {
                id: orders[0].id,
                order_number: orders[0].order_number,
                status: orders[0].status,
                total_amount: orders[0].total_amount,
                items_count: orders[0].items?.length || 0
            });
            
            // Show status breakdown
            const statusCounts = orders.reduce((acc: any, order: any) => {
                acc[order.status] = (acc[order.status] || 0) + 1;
                return acc;
            }, {});
            console.log('\n  Status breakdown:', statusCounts);
        }
    } catch (error) {
        console.error('❌ Error calling cache:getOrders:', error);
    }
    
    // Step 6: Check online status
    console.log('\n📋 Step 6: Checking online status...');
    try {
        const isOnline = await window.electronAPI.invoke('net:isOnline');
        console.log(`📡 Online status: ${isOnline ? '✅ ONLINE' : '❌ OFFLINE'}`);
        
        if (!isOnline) {
            console.log('💡 App is offline - orders will only show from cache');
        }
    } catch (error) {
        console.error('❌ Error checking online status:', error);
    }
    
    // Step 7: Final instructions
    console.log('\n' + '='.repeat(60));
    console.log('✅ Diagnostic complete!');
    console.log('='.repeat(60));
    console.log('\n📝 Next steps:');
    console.log('1. If orders were synced, refresh the page: window.location.reload()');
    console.log('2. Open "My Orders" modal and check if orders appear');
    console.log('3. If still no orders, check the logs above for issues');
    console.log('\n💡 Common issues:');
    console.log('  - No orders in Supabase for today');
    console.log('  - Orders not created by current user');
    console.log('  - Orders in different branch');
    console.log('  - Date filter excluding orders');
    
    // Auto-reload after 3 seconds
    console.log('\n🔄 Reloading page in 3 seconds...');
    setTimeout(() => {
        window.location.reload();
    }, 3000);
})();
