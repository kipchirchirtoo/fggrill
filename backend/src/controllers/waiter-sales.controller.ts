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

        // Fetch all waiters for the branch
        let waitersQuery = supabase
            .from('users')
            .select('id, first_name, last_name, email, branch_id')
            .eq('role', 'restaurant')
            .eq('status', 'active');

        if (branch_id && branch_id !== '0') {
            waitersQuery = waitersQuery.eq('branch_id', branch_id);
        }

        const { data: waiters, error: waitersError } = await waitersQuery;

        if (waitersError) {
            console.error('❌ [Waiter Sales] Error fetching waiters:', waitersError);
            throw waitersError;
        }

        console.log(`✅ [Waiter Sales] Found ${waiters?.length || 0} waiters`);

        // Fetch sales data for each waiter
        const waiterSales = await Promise.all(
            (waiters || []).map(async (waiter) => {
                // Fetch orders
                const { data: orders } = await supabase
                    .from('restaurant_orders')
                    .select('*')
                    .eq('staff_id', waiter.id)
                    .gte('created_at', `${startDate}T00:00:00`)
                    .lte('created_at', `${targetDate}T23:59:59`)
                    .in('status', ['completed', 'paid', 'delivered']);

                const totalOrders = orders?.length || 0;
                const totalRevenue = orders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
                const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

                // Calculate tips if available
                const totalTips = orders?.reduce((sum, o) => sum + Number(o.tip_amount || 0), 0) || 0;

                // Get order items for analysis
                const orderIds = orders?.map(o => o.id) || [];
                let totalItems = 0;
                if (orderIds.length > 0) {
                    const { data: items } = await supabase
                        .from('restaurant_order_items')
                        .select('quantity')
                        .in('order_id', orderIds);
                    
                    totalItems = items?.reduce((sum, i) => sum + Number(i.quantity || 0), 0) || 0;
                }

                return {
                    waiter_id: waiter.id,
                    waiter_name: `${waiter.first_name} ${waiter.last_name}`,
                    email: waiter.email,
                    total_orders: totalOrders,
                    total_revenue: totalRevenue,
                    average_order_value: averageOrderValue,
                    total_tips: totalTips,
                    total_items_sold: totalItems,
                    items_per_order: totalOrders > 0 ? totalItems / totalOrders : 0,
                    period_days: periodDays
                };
            })
        );

        // Sort by revenue
        waiterSales.sort((a, b) => b.total_revenue - a.total_revenue);

        // Calculate summary
        const summary = {
            total_waiters: waiterSales.length,
            total_orders: waiterSales.reduce((sum, w) => sum + w.total_orders, 0),
            total_revenue: waiterSales.reduce((sum, w) => sum + w.total_revenue, 0),
            total_tips: waiterSales.reduce((sum, w) => sum + w.total_tips, 0),
            average_order_value: waiterSales.reduce((sum, w) => sum + w.average_order_value, 0) / waiterSales.length || 0,
            top_performer: waiterSales[0] || null,
            period_days: periodDays
        };

        console.log('✅ [Waiter Sales] Sales data calculated successfully');

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

        // Fetch orders
        const { data: orders } = await supabase
            .from('restaurant_orders')
            .select('*')
            .eq('staff_id', id)
            .gte('created_at', startDate)
            .order('created_at', { ascending: false });

        const completedOrders = orders?.filter(o => ['completed', 'paid', 'delivered'].includes(o.status)) || [];
        const totalRevenue = completedOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
        const totalTips = completedOrders.reduce((sum, o) => sum + Number(o.tip_amount || 0), 0);
        const averageOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

        // Daily breakdown
        const dailyBreakdown: Record<string, any> = {};
        completedOrders.forEach(order => {
            const date = order.created_at.split('T')[0];
            if (!dailyBreakdown[date]) {
                dailyBreakdown[date] = {
                    date,
                    orders: 0,
                    revenue: 0,
                    tips: 0
                };
            }
            dailyBreakdown[date].orders += 1;
            dailyBreakdown[date].revenue += Number(order.total_amount || 0);
            dailyBreakdown[date].tips += Number(order.tip_amount || 0);
        });

        const performance = {
            waiter_info: {
                id: waiter.id,
                name: `${waiter.first_name} ${waiter.last_name}`,
                email: waiter.email,
                role: waiter.role,
                branch_id: waiter.branch_id
            },
            summary: {
                total_orders: completedOrders.length,
                total_revenue: totalRevenue,
                total_tips: totalTips,
                average_order_value: averageOrderValue,
                period_days: periodDays
            },
            daily_breakdown: Object.values(dailyBreakdown).sort((a: any, b: any) => 
                new Date(b.date).getTime() - new Date(a.date).getTime()
            ),
            recent_orders: completedOrders.slice(0, 20)
        };

        console.log('✅ [Waiter Performance] Performance calculated successfully');

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
