import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

/**
 * @desc    Get waiter sales analytics
 * @route   GET /api/restaurant/waiter-sales
 * @access  Private (Branch Manager, Restaurant Manager, Super Admin)
 */
export const getWaiterSales = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, date, period } = req.query;
        const periodDays = parseInt(period as string) || 1;
        const targetDate = (date as string) || new Date().toISOString().split('T')[0];
        const startDate = new Date(new Date(targetDate).getTime() - (periodDays - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        console.log('🔍 [Waiter Sales] Fetching sales:', { branch_id, startDate, targetDate, periodDays });

        // Fetch all active users with waiter_id references from pos_shift_orders
        // This ensures we only get staff who actually have POS sales
        let ordersQuery = supabase
            .from('pos_shift_orders')
            .select('waiter_id, waiter_name, total_amount, items, payment_status, status, created_at, branch_id')
            .not('waiter_id', 'is', null)
            .gte('created_at', `${startDate}T00:00:00`)
            .lte('created_at', `${targetDate}T23:59:59`);

        // Filter by branch if specified
        if (branch_id && branch_id !== '0') {
            ordersQuery = ordersQuery.eq('branch_id', parseInt(branch_id as string));
            console.log(`   - Filtering orders by branch_id: ${branch_id}`);
        }

        const { data: allOrders, error: ordersError } = await ordersQuery;

        if (ordersError) {
            console.error('❌ [Waiter Sales] Error fetching orders:', ordersError);
            throw ordersError;
        }

        console.log(`✅ [Waiter Sales] Found ${allOrders?.length || 0} total orders`);

        // Filter for completed/paid orders only
        const completedOrders = (allOrders || []).filter(order => 
            order.payment_status === 'paid' || order.status === 'paid'
        );

        console.log(`✅ [Waiter Sales] Found ${completedOrders.length} completed/paid orders`);

        // Group orders by waiter_id
        const waiterOrdersMap = new Map<string, typeof completedOrders>();
        
        completedOrders.forEach(order => {
            const waiterId = order.waiter_id;
            if (!waiterOrdersMap.has(waiterId)) {
                waiterOrdersMap.set(waiterId, []);
            }
            waiterOrdersMap.get(waiterId)!.push(order);
        });

        console.log(`✅ [Waiter Sales] Found ${waiterOrdersMap.size} unique waiters with sales`);

        // Fetch waiter details for all waiters who have orders
        const waiterIds = Array.from(waiterOrdersMap.keys());
        const { data: waitersData, error: waitersError } = await supabase
            .from('users')
            .select('id, first_name, last_name, email, branch_id, pos_pin, role')
            .in('id', waiterIds)
            .eq('status', 'active');

        if (waitersError) {
            console.error('❌ [Waiter Sales] Error fetching waiter details:', waitersError);
        }

        // Create waiter lookup map
        const waiterDetailsMap = new Map(
            (waitersData || []).map(w => [w.id, w])
        );

        // Calculate sales data for each waiter
        const waiterSales = Array.from(waiterOrdersMap.entries()).map(([waiterId, orders]) => {
            const waiterDetails = waiterDetailsMap.get(waiterId);
            const totalOrders = orders.length;
            const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
            const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

            // Calculate total items sold from order items array
            const totalItems = orders.reduce((sum, o) => {
                const items = o.items || [];
                return sum + items.reduce((itemSum: number, item: any) => itemSum + Number(item.quantity || 0), 0);
            }, 0);

            // Get waiter name from order data or user details
            const waiterName = orders[0]?.waiter_name || 
                               (waiterDetails ? `${waiterDetails.first_name} ${waiterDetails.last_name}` : 'Unknown');

            console.log(`   - ${waiterName}: ${totalOrders} orders, KES ${totalRevenue.toFixed(2)} revenue`);

            return {
                waiter_id: waiterId,
                waiter_name: waiterName,
                email: waiterDetails?.email || '',
                pos_pin: waiterDetails?.pos_pin || '',
                role: waiterDetails?.role || '',
                branch_id: waiterDetails?.branch_id || orders[0]?.branch_id || null,
                total_orders: totalOrders,
                completed_orders: totalOrders, // All orders in this list are completed
                total_revenue: totalRevenue,
                average_order_value: averageOrderValue,
                total_tips: 0, // Tips not tracked in current schema
                total_items_sold: totalItems,
                items_per_order: totalOrders > 0 ? totalItems / totalOrders : 0,
                period_days: periodDays
            };
        });

        // Sort by revenue (descending)
        waiterSales.sort((a, b) => b.total_revenue - a.total_revenue);

        // Calculate summary
        const summary = {
            total_waiters: waiterSales.length,
            total_orders: waiterSales.reduce((sum, w) => sum + w.total_orders, 0),
            total_revenue: waiterSales.reduce((sum, w) => sum + w.total_revenue, 0),
            total_tips: waiterSales.reduce((sum, w) => sum + w.total_tips, 0),
            average_order_value: waiterSales.length > 0 
                ? waiterSales.reduce((sum, w) => sum + w.average_order_value, 0) / waiterSales.length 
                : 0,
            top_performer: waiterSales[0] || null,
            period_days: periodDays
        };

        console.log('✅ [Waiter Sales] Sales data calculated successfully');
        console.log(`   - Total waiters: ${summary.total_waiters}`);
        console.log(`   - Total orders: ${summary.total_orders}`);
        console.log(`   - Total revenue: KES ${summary.total_revenue.toFixed(2)}`);
        console.log(`   - Branch filter: ${branch_id || 'ALL BRANCHES'}`);
        console.log(`   - Date range: ${startDate} to ${targetDate}`);

        res.status(200).json({
            success: true,
            data: {
                waiter_sales: waiterSales,
                summary,
                date: targetDate,
                period_days: periodDays
            }
        });
    } catch (error) {
        console.error('❌ [Waiter Sales] Error:', error);
        logger.error('Error fetching waiter sales:', error);
        next(error);
    }
};

/**
 * @desc    Get individual waiter performance
 * @route   GET /api/restaurant/waiter/:id/performance
 * @access  Private
 */
export const getWaiterPerformance = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { period } = req.query;
        const periodDays = parseInt(period as string) || 30;
        const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

        console.log('🔍 [Waiter Performance] Fetching performance for waiter:', id);

        // Fetch waiter details
        const { data: waiter, error: waiterError } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single();

        if (waiterError || !waiter) {
            res.status(404).json({
                success: false,
                message: 'Waiter not found'
            });
            return;
        }

        // Fetch ALL orders from pos_shift_orders using waiter_id
        const { data: allOrders } = await supabase
            .from('pos_shift_orders')
            .select('*')
            .eq('waiter_id', id)
            .gte('created_at', startDate)
            .order('created_at', { ascending: false });

        // Filter for completed/paid orders
        const completedOrders = (allOrders || []).filter(o => 
            o.payment_status === 'paid' || o.status === 'paid'
        );
        
        const totalRevenue = completedOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
        const totalTips = 0; // Tips not tracked in current schema
        const averageOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

        // Calculate total items sold
        const totalItems = completedOrders.reduce((sum, o) => {
            const items = o.items || [];
            return sum + items.reduce((itemSum: number, item: any) => itemSum + Number(item.quantity || 0), 0);
        }, 0);

        // Daily breakdown
        const dailyBreakdown: Record<string, any> = {};
        completedOrders.forEach(order => {
            const date = order.created_at.split('T')[0];
            if (!dailyBreakdown[date]) {
                dailyBreakdown[date] = {
                    date,
                    orders: 0,
                    revenue: 0,
                    tips: 0,
                    items_sold: 0
                };
            }
            dailyBreakdown[date].orders += 1;
            dailyBreakdown[date].revenue += Number(order.total_amount || 0);
            dailyBreakdown[date].tips += 0; // Tips not tracked
            
            // Add items count for this order
            const items = order.items || [];
            const orderItems = items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
            dailyBreakdown[date].items_sold += orderItems;
        });

        const performance = {
            waiter_info: {
                id: waiter.id,
                name: `${waiter.first_name} ${waiter.last_name}`,
                email: waiter.email,
                role: waiter.role,
                branch_id: waiter.branch_id,
                pos_pin: waiter.pos_pin
            },
            summary: {
                total_orders: completedOrders.length,
                total_revenue: totalRevenue,
                total_tips: totalTips,
                total_items_sold: totalItems,
                average_order_value: averageOrderValue,
                items_per_order: completedOrders.length > 0 ? totalItems / completedOrders.length : 0,
                period_days: periodDays
            },
            daily_breakdown: Object.values(dailyBreakdown).sort((a: any, b: any) => 
                new Date(b.date).getTime() - new Date(a.date).getTime()
            ),
            recent_orders: completedOrders.slice(0, 20).map(order => ({
                id: order.id,
                order_number: order.order_number,
                short_code: order.short_code,
                customer_name: order.customer_name,
                order_type: order.order_type,
                table_number: order.table_number,
                room_number: order.room_number,
                total_amount: order.total_amount,
                payment_method: order.payment_method,
                payment_status: order.payment_status,
                status: order.status,
                items: order.items,
                created_at: order.created_at,
                branch_id: order.branch_id
            }))
        };

        console.log('✅ [Waiter Performance] Performance calculated successfully');
        console.log(`   - Total orders: ${performance.summary.total_orders}`);
        console.log(`   - Total revenue: KES ${performance.summary.total_revenue.toFixed(2)}`);
        console.log(`   - Total items sold: ${performance.summary.total_items_sold}`);

        res.status(200).json({
            success: true,
            data: performance
        });
    } catch (error) {
        console.error('❌ [Waiter Performance] Error:', error);
        logger.error('Error fetching waiter performance:', error);
        next(error);
    }
};
