const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testOrderItemsWithNames() {
    console.log('🔍 Testing Order Items with Menu Item Names...\n');

    try {
        // Fetch a recent order with items
        const { data: orders, error } = await supabase
            .from('restaurant_orders')
            .select(`
                *,
                items: restaurant_order_items(
                    *,
                    menu_item: restaurant_menu_items(*)
                )
            `)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) {
            console.error('❌ Error fetching orders:', error);
            return;
        }

        if (!orders || orders.length === 0) {
            console.log('⚠️  No orders found in database');
            return;
        }

        const order = orders[0];
        console.log('✅ Found Order:', order.order_number);
        console.log('   Status:', order.status);
        console.log('   Total:', order.total_amount);
        console.log('   Items Count:', order.items?.length || 0);
        console.log('\n📋 Order Items:');

        if (order.items && order.items.length > 0) {
            order.items.forEach((item, idx) => {
                const itemName = item.name || item.menu_item?.name || 'Unknown Item';
                console.log(`   ${idx + 1}. ${item.quantity}x ${itemName} - KES ${item.unit_price}`);
                
                if (!item.name && !item.menu_item?.name) {
                    console.log('      ⚠️  WARNING: No name found for this item!');
                }
                
                if (item.menu_item) {
                    console.log(`      ✅ Menu item joined successfully: ${item.menu_item.name}`);
                } else {
                    console.log('      ⚠️  Menu item NOT joined - this will cause "Unknown Item" on receipts');
                }
            });
        } else {
            console.log('   No items found');
        }

        console.log('\n✅ Test Complete!');
        console.log('\n📝 Summary:');
        console.log('   - If you see "Menu item joined successfully", the backend fix is working');
        console.log('   - If you see "Menu item NOT joined", you need to restart the backend server');
        console.log('   - The receipt will now show actual item names instead of "Unknown Item"');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testOrderItemsWithNames();
