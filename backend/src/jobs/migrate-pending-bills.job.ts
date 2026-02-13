import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

/**
 * Migrate pending orders older than 8 hours to staff credit bills
 * Also record void bills to audit table
 * Runs every hour via cron
 */
export const migratePendingBills = async () => {
    try {
        logger.info('Starting pending bills migration job...');

        // 1. Find pending orders older than 8 hours that haven't been migrated
        const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();

        const { data: pendingOrders, error: fetchError } = await supabase
            .from('restaurant_orders')
            .select(`
                id,
                order_number,
                waiter_id,
                table_number,
                room_number,
                total_amount,
                created_at,
                waiter:staff_profiles!waiter_id(
                    id,
                    first_name,
                    last_name,
                    user:users!user_id(id)
                )
            `)
            .eq('status', 'pending')
            .eq('migrated_to_credit_bill', false)
            .not('waiter_id', 'is', null)
            .lt('created_at', eightHoursAgo);

        if (fetchError) {
            logger.error('Error fetching pending orders:', fetchError);
            return;
        }

        if (!pendingOrders || pendingOrders.length === 0) {
            logger.info('No pending orders to migrate');
        } else {
            logger.info(`Found ${pendingOrders.length} pending orders to migrate`);

            // 2. Create credit bills for each pending order
            for (const order of pendingOrders) {
                try {
                    const orderWaiter = Array.isArray(order.waiter) ? order.waiter[0] : order.waiter;
                    const waiterName = orderWaiter
                        ? `${orderWaiter.first_name} ${orderWaiter.last_name}`.trim()
                        : 'Unknown Waiter';

                    const location = order.table_number
                        ? `Table ${order.table_number}`
                        : order.room_number
                            ? `Room ${order.room_number}`
                            : 'Unknown';

                    // Create credit bill
                    const { data: creditBill, error: creditError } = await supabase
                        .from('staff_credit_bills')
                        .insert({
                            staff_id: order.waiter_id,
                            amount: order.total_amount,
                            balance: order.total_amount,
                            description: `Unsettled Order - ${order.order_number} - ${location}`,
                            date: new Date().toISOString().split('T')[0],
                            is_paid: false
                        })
                        .select()
                        .single();

                    if (creditError) {
                        logger.error(`Error creating credit bill for order ${order.order_number}:`, creditError);
                        continue;
                    }

                    // Update order to mark as migrated
                    const { error: updateError } = await supabase
                        .from('restaurant_orders')
                        .update({
                            migrated_to_credit_bill: true,
                            migrated_at: new Date().toISOString(),
                            credit_bill_id: creditBill.id
                        })
                        .eq('id', order.id);

                    if (updateError) {
                        logger.error(`Error updating order ${order.order_number}:`, updateError);
                        continue;
                    }

                    // Send notification to waiter
                    const notifyWaiter = Array.isArray(order.waiter) ? order.waiter[0] : order.waiter;
                    const waiterUser = notifyWaiter?.user ? (Array.isArray(notifyWaiter.user) ? notifyWaiter.user[0] : notifyWaiter.user) : null;

                    if (waiterUser?.id) {
                        await supabase.from('notifications').insert({
                            user_id: waiterUser.id,
                            type: 'pending_bill_migrated',
                            title: 'Order Migrated to Unpaid Bills',
                            message: `Order ${order.order_number} (${location}) has been migrated to unpaid bills - KES ${order.total_amount?.toLocaleString()}`,
                            link: '/dashboard/staff/credit-bills',
                            is_read: false
                        });
                    }

                    logger.info(`Successfully migrated order ${order.order_number} to credit bill`);
                } catch (err) {
                    logger.error(`Error processing order ${order.order_number}:`, err);
                }
            }
        }

        // 3. Find void orders that haven't been recorded in audit table
        const { data: voidOrders, error: voidFetchError } = await supabase
            .from('restaurant_orders')
            .select(`
                id,
                order_number,
                waiter_id,
                table_number,
                room_number,
                total_amount,
                cancelled_at,
                cancelled_by,
                cancellation_reason,
                waiter:staff_profiles!waiter_id(first_name, last_name)
            `)
            .eq('status', 'cancelled')
            .not('cancelled_at', 'is', null);

        if (voidFetchError) {
            logger.error('Error fetching void orders:', voidFetchError);
            return;
        }

        if (voidOrders && voidOrders.length > 0) {
            // Check which ones are not yet in audit table
            const { data: existingAudits } = await supabase
                .from('void_bills_audit')
                .select('order_id')
                .in('order_id', voidOrders.map(o => o.id));

            const existingOrderIds = new Set(existingAudits?.map(a => a.order_id) || []);
            const newVoidOrders = voidOrders.filter(o => !existingOrderIds.has(o.id));

            if (newVoidOrders.length > 0) {
                logger.info(`Found ${newVoidOrders.length} new void orders to record`);

                const auditRecords = newVoidOrders.map(order => {
                    const waiter = Array.isArray(order.waiter) ? order.waiter[0] : order.waiter;
                    return {
                        order_id: order.id,
                        order_number: order.order_number,
                        waiter_id: order.waiter_id,
                        waiter_name: waiter
                            ? `${waiter.first_name} ${waiter.last_name}`.trim()
                            : null,
                        table_number: order.table_number,
                        room_number: order.room_number,
                        total_amount: order.total_amount,
                        voided_at: order.cancelled_at,
                        voided_by: order.cancelled_by,
                        void_reason: order.cancellation_reason,
                        reviewed_by_auditor: false
                    };
                });

                const { error: auditError } = await supabase
                    .from('void_bills_audit')
                    .insert(auditRecords);

                if (auditError) {
                    logger.error('Error inserting void bills audit records:', auditError);
                } else {
                    logger.info(`Successfully recorded ${newVoidOrders.length} void bills to audit table`);
                }
            } else {
                logger.info('No new void orders to record');
            }
        }

        logger.info('Pending bills migration job completed');
    } catch (error) {
        logger.error('Error in pending bills migration job:', error);
    }
};
