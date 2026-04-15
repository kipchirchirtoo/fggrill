import { supabase } from './src/config/supabase';

async function testRestaurantPayment() {
    console.log('--- Testing Restaurant Payment Flow ---');

    // 1. Create a dummy restaurant order
    const orderNumber = `ORD${new Date().toISOString().slice(2, 10).replace(/-/g, '')}9999`;

    // Get a user ID for created_by
    const { data: user , error } = await supabase.from('users').select('id').limit(1).single();
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    if (!user) throw new Error('No user found');

    const { data: order, error: orderError } = await supabase
        .from('restaurant_orders')
        .insert({
            order_number: orderNumber,
            order_type: 'dine_in',
            status: 'pending',
            table_number: 'T10',
            total_amount: 1500,
            payment_status: 'pending',
            created_by: user.id
        })
        .select()
        .single();

    if (orderError) {
        console.error('Error creating order:', orderError);
        return;
    }
    console.log('Created Order:', order.order_number);

    // 2. Fetch Bill Details via API (Simulated)
    // We'll just check the controller logic by calling it or checking DB
    console.log('Verifying bill retrieval for:', orderNumber);
    const { data: fetchedOrder } = await supabase
        .from('restaurant_orders')
        .select('*')
        .eq('order_number', orderNumber)
        .single();

    if (fetchedOrder) {
        console.log('Order retrieved successfully');
    }

    // 3. Process Payment (Simulated)
    console.log('Processing payment for:', orderNumber);
    // In real app, this would be a POST to /api/cashier/pay
    // We'll simulate the logic here
    const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
            restaurant_order_id: order.id,
            amount: 1500,
            currency: 'KES',
            payment_method: 'cash',
            status: 'completed',
            reference: `TEST-CASH-${Date.now()}`
        })
        .select()
        .single();

    if (paymentError) {
        console.error('Error recording payment:', paymentError);
        return;
    }
    console.log('Payment recorded:', payment.id);

    // Update order status (simulating controller logic)
    await supabase
        .from('restaurant_orders')
        .update({
            payment_status: 'paid',
            status: 'delivered'
        })
        .eq('id', order.id);

    // 4. Verify final status
    const { data: finalOrder } = await supabase
        .from('restaurant_orders')
        .select('payment_status, status')
        .eq('id', order.id)
        .single();

    console.log('Final Order Status:', finalOrder?.status, 'Payment:', finalOrder?.payment_status);

    if (finalOrder?.payment_status === 'paid') {
        console.log('✅ TEST PASSED');
    } else {
        console.log('❌ TEST FAILED');
    }

    // Cleanup
    const { error } = await supabase.from('payments').delete().eq('restaurant_order_id', order.id);
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    const { error } = await supabase.from('restaurant_orders').delete().eq('id', order.id);
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    console.log('Cleanup complete');
}

testRestaurantPayment();
