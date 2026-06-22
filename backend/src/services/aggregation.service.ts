import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

interface AggregatedData {
    revenue: number;
    expenses: number;
    netProfit: number;
    revenueBySource: {
        bookings: number;
        restaurant: number;
        bar: number;
        other: number;
    };
    expensesByCategory: Record<string, number>;
}

interface DateRange {
    startDate: string;
    endDate: string;
}

export class AggregationService {
    /**
     * Branch revenue from the legacy `payments` table alone misses every sale
     * made through the outlet POS system (pos_shift_orders), which is the
     * primary sales path for restaurant/bar outlets. Without this, "Branch
     * Revenue" silently reads 0 while "Total Sales" (computed separately from
     * POS data) shows real figures, so the two numbers never reconcile.
     */
    private async getPosOutletRevenue(
        dateRange: DateRange,
        branchId?: number
    ): Promise<{ total: number; bySource: { bookings: number; restaurant: number; bar: number; other: number } }> {
        const sources = { bookings: 0, restaurant: 0, bar: 0, other: 0 };
        if (!branchId) return { total: 0, bySource: sources };

        const { startDate, endDate } = dateRange;
        const { data: outlets, error: outletsError } = await supabase
            .from('pos_outlets')
            .select('id, outlet_type')
            .eq('branch_id', branchId);
        if (outletsError) throw outletsError;

        const outletIds = (outlets || []).map((o: any) => o.id);
        if (outletIds.length === 0) return { total: 0, bySource: sources };

        const outletTypeById = new Map((outlets || []).map((o: any) => [String(o.id), o.outlet_type]));

        const { data: orders, error: ordersError } = await supabase
            .from('pos_shift_orders')
            .select('outlet_id, total_amount, status, payment_status')
            .in('outlet_id', outletIds)
            .or('status.in.(paid,credit_bill),payment_status.in.(paid,credit_bill)')
            .gte('created_at', startDate)
            .lte('created_at', endDate);
        if (ordersError) throw ordersError;

        for (const order of orders || []) {
            const amount = Number((order as any).total_amount) || 0;
            const outletType = outletTypeById.get(String((order as any).outlet_id));
            if (outletType === 'restaurant') sources.restaurant += amount;
            else if (['main_bar', 'executive_bar', 'sports_bar'].includes(String(outletType))) sources.bar += amount;
            else sources.other += amount;
        }

        const total = sources.bookings + sources.restaurant + sources.bar + sources.other;
        return { total, bySource: sources };
    }

    /**
     * Get aggregated revenue from all sources using the central payments table
     */
    async getAggregatedRevenue(
        dateRange: DateRange,
        branchId?: number
    ): Promise<{ total: number; bySource: { bookings: number; restaurant: number; bar: number; other: number } }> {
        try {
            const { startDate, endDate } = dateRange;
            const sources = {
                bookings: 0,
                restaurant: 0,
                bar: 0,
                other: 0,
            };

            // Query payments — only join reservations (has FK in schema cache).
            // restaurant_orders and bar_orders have no FK relationship to payments
            // in the schema cache (PGRST200), so we batch-fetch them separately.
            const { data: payments, error } = await supabase
                .from('payments')
                .select(`
                    amount,
                    payment_method,
                    booking_id,
                    restaurant_order_id,
                    bar_order_id,
                    metadata,
                    reservations (
                        room_id,
                        rooms ( branch_id )
                    )
                `)
                .eq('status', 'completed')
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            if (error) throw error;

            // Batch-fetch branch_ids for restaurant and bar orders
            const restaurantOrderIds = [...new Set(
                (payments || []).filter((p: any) => p.restaurant_order_id).map((p: any) => p.restaurant_order_id)
            )];
            const barOrderIds = [...new Set(
                (payments || []).filter((p: any) => p.bar_order_id).map((p: any) => p.bar_order_id)
            )];

            const restaurantBranchMap: Record<string, number> = {};
            const barBranchMap: Record<string, number> = {};

            if (restaurantOrderIds.length > 0) {
                const { data: restOrders } = await supabase
                    .from('restaurant_orders')
                    .select('id, branch_id')
                    .in('id', restaurantOrderIds);
                (restOrders || []).forEach((o: any) => {
                    if (o.branch_id) restaurantBranchMap[o.id] = o.branch_id;
                });
            }

            if (barOrderIds.length > 0) {
                const { data: barOrders } = await supabase
                    .from('bar_orders')
                    .select('id, branch_id')
                    .in('id', barOrderIds);
                (barOrders || []).forEach((o: any) => {
                    if (o.branch_id) barBranchMap[o.id] = o.branch_id;
                });
            }

            if (payments) {
                for (const payment of payments) {
                    const amount = Number(payment.amount) || 0;

                    // Determine branch_id for this payment
                    let paymentBranchId: number | undefined;

                    // @ts-ignore - Supabase types might be tricky with deep joins
                    if (Array.isArray(payment.reservations) && payment.reservations[0]?.rooms?.branch_id) {
                        // @ts-ignore
                        paymentBranchId = payment.reservations[0].rooms.branch_id;
                    } else if (payment.reservations && !Array.isArray(payment.reservations) && (payment.reservations as any).rooms?.branch_id) {
                        // @ts-ignore
                        paymentBranchId = (payment.reservations as any).rooms.branch_id;
                    }

                    if (!paymentBranchId && (payment as any).restaurant_order_id) {
                        paymentBranchId = restaurantBranchMap[(payment as any).restaurant_order_id];
                    }

                    if (!paymentBranchId && (payment as any).bar_order_id) {
                        paymentBranchId = barBranchMap[(payment as any).bar_order_id];
                    }

                    // Filter by branch if requested - STRICT FILTERING
                    if (branchId) {
                        if (!paymentBranchId || paymentBranchId !== branchId) {
                            continue;
                        }
                    }

                    // Categorize revenue
                    if (payment.booking_id) {
                        sources.bookings += amount;
                    } else if (payment.restaurant_order_id || (payment.metadata as any)?.order_number?.startsWith('ORD')) {
                        sources.restaurant += amount;
                    } else if (payment.bar_order_id) {
                        sources.bar += amount;
                    } else {
                        sources.other += amount;
                    }
                }
            }

            const posRevenue = await this.getPosOutletRevenue(dateRange, branchId);
            sources.bookings += posRevenue.bySource.bookings;
            sources.restaurant += posRevenue.bySource.restaurant;
            sources.bar += posRevenue.bySource.bar;
            sources.other += posRevenue.bySource.other;

            const total = sources.bookings + sources.restaurant + sources.bar + sources.other;

            return { total, bySource: sources };
        } catch (error) {
            logger.error('Error aggregating revenue:', error);
            return { total: 0, bySource: { bookings: 0, restaurant: 0, bar: 0, other: 0 } };
        }
    }

    /**
     * Get aggregated expenses from all sources
     */
    async getAggregatedExpenses(
        dateRange: DateRange,
        branchId?: number
    ): Promise<{ total: number; byCategory: Record<string, number> }> {
        try {
            const { startDate, endDate } = dateRange;
            const categories: Record<string, number> = {};

            // 1. Expenses Table
            let expenseQuery = supabase
                .from('expenses')
                .select('amount, category, branch_id')
                .in('status', ['approved', 'paid'])
                .gte('expense_date', startDate)
                .lte('expense_date', endDate);

            if (branchId) {
                expenseQuery = expenseQuery.eq('branch_id', branchId);
            }

            const { data: expenses } = await expenseQuery;
            expenses?.forEach((e) => {
                const cat = e.category || 'Other';
                categories[cat] = (categories[cat] || 0) + (e.amount || 0);
            });

            // 2. Finance Transactions (Expenses)
            let financeExpQuery = supabase
                .from('finance_transactions')
                .select('amount, category, branch_id')
                .eq('transaction_type', 'expense')
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            if (branchId) {
                financeExpQuery = financeExpQuery.eq('branch_id', branchId);
            }

            const { data: financeExpenses } = await financeExpQuery;
            financeExpenses?.forEach((e) => {
                const cat = e.category || 'Other';
                categories[cat] = (categories[cat] || 0) + (e.amount || 0);
            });

            const total = Object.values(categories).reduce((sum, val) => sum + val, 0);

            return { total, byCategory: categories };
        } catch (error) {
            logger.error('Error aggregating expenses:', error);
            return { total: 0, byCategory: {} };
        }
    }

    /**
     * Get complete aggregated financial data
     */
    async getAggregatedData(
        dateRange: DateRange,
        branchId?: number
    ): Promise<AggregatedData> {
        try {
            const [revenueData, expenseData] = await Promise.all([
                this.getAggregatedRevenue(dateRange, branchId),
                this.getAggregatedExpenses(dateRange, branchId),
            ]);

            return {
                revenue: revenueData.total,
                expenses: expenseData.total,
                netProfit: revenueData.total - expenseData.total,
                revenueBySource: revenueData.bySource,
                expensesByCategory: expenseData.byCategory,
            };
        } catch (error) {
            logger.error('Error getting aggregated data:', error);
            return {
                revenue: 0,
                expenses: 0,
                netProfit: 0,
                revenueBySource: { bookings: 0, restaurant: 0, bar: 0, other: 0 },
                expensesByCategory: {},
            };
        }
    }

    /**
     * Get daily cash flow data
     */
    async getDailyCashFlow(
        dateRange: DateRange,
        branchId?: number
    ): Promise<Array<{ date: string; inflow: number; outflow: number; net: number }>> {
        try {
            const { startDate, endDate } = dateRange;
            const dailyData: Record<string, { inflow: number; outflow: number }> = {};

            // Get inflows from payments table
            const { data: payments } = await supabase
                .from('payments')
                .select(`
                    amount,
                    created_at,
                    reservations ( rooms ( branch_id ) ),
                    restaurant_orders ( branch_id ),
                    bar_orders ( branch_id )
                `)
                .eq('status', 'completed')
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            // Process inflows
            payments?.forEach((payment) => {
                // Check branch if needed
                let paymentBranchId: number | undefined;

                // @ts-ignore
                if (Array.isArray(payment.reservations) && payment.reservations[0]?.rooms?.branch_id) {
                    // @ts-ignore
                    paymentBranchId = payment.reservations[0].rooms.branch_id;
                } else if (payment.reservations && !Array.isArray(payment.reservations) && (payment.reservations as any).rooms?.branch_id) {
                    // @ts-ignore
                    paymentBranchId = (payment.reservations as any).rooms.branch_id;
                }

                if (!paymentBranchId) {
                    // @ts-ignore
                    if (Array.isArray(payment.restaurant_orders) && payment.restaurant_orders[0]?.branch_id) {
                        // @ts-ignore
                        paymentBranchId = payment.restaurant_orders[0].branch_id;
                    } else if (payment.restaurant_orders && !Array.isArray(payment.restaurant_orders) && (payment.restaurant_orders as any).branch_id) {
                        // @ts-ignore
                        paymentBranchId = (payment.restaurant_orders as any).branch_id;
                    }
                }

                if (!paymentBranchId) {
                    // @ts-ignore
                    if (Array.isArray(payment.bar_orders) && payment.bar_orders[0]?.branch_id) {
                        // @ts-ignore
                        paymentBranchId = payment.bar_orders[0].branch_id;
                    } else if (payment.bar_orders && !Array.isArray(payment.bar_orders) && (payment.bar_orders as any).branch_id) {
                        // @ts-ignore
                        paymentBranchId = (payment.bar_orders as any).branch_id;
                    }
                }

                if (branchId) {
                    if (!paymentBranchId || paymentBranchId !== branchId) return;
                }

                const date = new Date(payment.created_at).toISOString().split('T')[0];
                if (!dailyData[date]) dailyData[date] = { inflow: 0, outflow: 0 };
                dailyData[date].inflow += Number(payment.amount) || 0;
            });

            // POS shift orders are the primary sales path for outlet POS and
            // aren't in the `payments` table at all, so add them as inflows too.
            const posInflows = await this.getPosOutletInflowsByDate(dateRange, branchId);
            posInflows.forEach((item) => {
                const date = item.date.split('T')[0];
                if (!dailyData[date]) dailyData[date] = { inflow: 0, outflow: 0 };
                dailyData[date].inflow += item.amount;
            });

            // Get outflows from expenses
            const [expenses, financeExpenses] = await Promise.all([
                this.getExpensesByDate(dateRange, branchId),
                this.getFinanceExpensesByDate(dateRange, branchId),
            ]);

            // Aggregate outflows
            [...expenses, ...financeExpenses].forEach((item) => {
                const date = item.date.split('T')[0];
                if (!dailyData[date]) dailyData[date] = { inflow: 0, outflow: 0 };
                dailyData[date].outflow += item.amount;
            });

            // Convert to array and sort
            return Object.entries(dailyData)
                .map(([date, data]) => ({
                    date,
                    inflow: data.inflow,
                    outflow: data.outflow,
                    net: data.inflow - data.outflow,
                }))
                .sort((a, b) => a.date.localeCompare(b.date));
        } catch (error) {
            logger.error('Error getting daily cash flow:', error);
            return [];
        }
    }

    private async getPosOutletInflowsByDate(dateRange: DateRange, branchId?: number) {
        if (!branchId) return [];
        const { data: outlets } = await supabase
            .from('pos_outlets')
            .select('id')
            .eq('branch_id', branchId);
        const outletIds = (outlets || []).map((o: any) => o.id);
        if (outletIds.length === 0) return [];

        const { data: orders } = await supabase
            .from('pos_shift_orders')
            .select('total_amount, created_at')
            .in('outlet_id', outletIds)
            .or('status.in.(paid,credit_bill),payment_status.in.(paid,credit_bill)')
            .gte('created_at', dateRange.startDate)
            .lte('created_at', dateRange.endDate);

        return (orders || []).map((o: any) => ({ amount: Number(o.total_amount) || 0, date: o.created_at }));
    }

    // Helper methods to get data by date (only for expenses now)
    private async getExpensesByDate(dateRange: DateRange, branchId?: number) {
        let query = supabase
            .from('expenses')
            .select('amount, expense_date, branch_id')
            .in('status', ['approved', 'paid'])
            .gte('expense_date', dateRange.startDate)
            .lte('expense_date', dateRange.endDate);

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data } = await query;
        return data?.map((e) => ({ amount: e.amount || 0, date: e.expense_date })) || [];
    }

    private async getFinanceExpensesByDate(dateRange: DateRange, branchId?: number) {
        let query = supabase
            .from('finance_transactions')
            .select('amount, created_at, branch_id')
            .eq('transaction_type', 'expense')
            .gte('created_at', dateRange.startDate)
            .lte('created_at', dateRange.endDate);

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data } = await query;
        return data?.map((t) => ({ amount: t.amount || 0, date: t.created_at })) || [];
    }
}

export const aggregationService = new AggregationService();
