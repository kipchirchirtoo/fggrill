import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

// @desc    Get Branch Performance Report
// @route   GET /api/reports/auditor/performance
// @access  Private (Auditor)
export const getBranchPerformanceReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { branch_id, start_date, end_date } = req.query;

        const queryInfo = `Branch: ${branch_id}, Date: ${start_date} to ${end_date}`;
        logger.info(`Generating Branch Performance Report (${queryInfo})`);

        // 1. Sales (Restaurant & Bar)
        const { data: restSales } = await supabase
            .from('restaurant_orders')
            .select('total_amount, created_at')
            .eq('branch_id', branch_id)
            .gte('created_at', start_date)
            .lte('created_at', end_date)
            .neq('status', 'cancelled');

        const { data: barSales } = await supabase
            .from('bar_orders')
            .select('total, created_at') // Check schema if 'total' or 'total_amount'
            .eq('branch_id', branch_id)
            .gte('created_at', start_date)
            .lte('created_at', end_date)
            .neq('status', 'cancelled');

        // 2. Expenses
        const { data: expenses } = await supabase
            .from('expenses')
            .select('amount, category, expense_date')
            .eq('branch_id', branch_id)
            .gte('expense_date', start_date)
            .lte('expense_date', end_date);

        // Calculate Totals
        const totalRestSales = restSales?.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0) || 0;
        const totalBarSales = barSales?.reduce((sum, order) => sum + (Number(order.total) || 0), 0) || 0;
        const totalSales = totalRestSales + totalBarSales;

        const totalExpenses = expenses?.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0) || 0;
        const netProfit = totalSales - totalExpenses;

        const expenseBreakdown = expenses?.reduce((acc: any, exp) => {
            acc[exp.category] = (acc[exp.category] || 0) + Number(exp.amount);
            return acc;
        }, {});

        res.status(200).json({
            success: true,
            data: {
                period: { start: start_date, end: end_date },
                sales: {
                    restaurant: totalRestSales,
                    bar: totalBarSales,
                    total: totalSales
                },
                expenses: {
                    total: totalExpenses,
                    breakdown: expenseBreakdown || {}
                },
                netProfit,
                profitMargin: totalSales > 0 ? (netProfit / totalSales) * 100 : 0
            }
        });

    } catch (error) {
        next(error);
    }
};

// @desc    Get Stock Usage vs Requested Report
// @route   GET /api/reports/auditor/stock-usage
// @access  Private (Auditor)
export const getStockUsageReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { branch_id, start_date, end_date } = req.query;

        // 1. Get Stock Requests (Approved)
        const { data: requests } = await supabase
            .from('stock_requests')
            .select('*, items:stock_request_items(item_sku, approved_quantity)')
            .eq('requesting_branch_id', branch_id)
            .eq('status', 'APPROVED')
            .gte('created_at', start_date)
            .lte('created_at', end_date);

        // 2. Get Usage (Stock Movements - 'USAGE' or 'SALE')
        // Assuming 'branch_stock_movements' tracks usage
        const { data: movements } = await supabase
            .from('branch_stock_movements')
            .select('item_sku, quantity, movement_type')
            .eq('branch_id', branch_id)
            .in('movement_type', ['USAGE', 'SALE', 'WASTAGE']) // Adjust based on actual types
            .gte('created_at', start_date)
            .lte('created_at', end_date);

        // Aggregation Logic (Simplified for MVP)
        const requestedMap: Record<string, number> = {};
        requests?.forEach(req => {
            req.items.forEach((item: any) => {
                requestedMap[item.item_sku] = (requestedMap[item.item_sku] || 0) + item.approved_quantity;
            });
        });

        const usageMap: Record<string, number> = {};
        movements?.forEach(mov => {
            usageMap[mov.item_sku] = (usageMap[mov.item_sku] || 0) + mov.quantity;
        });

        const reportData = Object.keys({ ...requestedMap, ...usageMap }).map(sku => ({
            sku,
            requested: requestedMap[sku] || 0,
            used: usageMap[sku] || 0,
            variance: (requestedMap[sku] || 0) - (usageMap[sku] || 0)
        }));

        res.status(200).json({
            success: true,
            data: reportData
        });

    } catch (error) {
        next(error);
    }
};

// @desc    Get Employee Credit Report
// @route   GET /api/reports/auditor/employee-credit
// @access  Private (Auditor)
export const getEmployeeCreditReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Fetch all unpaid or partial employee bills
        const { data: bills, error } = await supabase
            .from('employee_credit_bills')
            .select(`
        *,
        employee:staff_profiles(id, first_name, last_name, employee_id),
        branch:branches(name)
      `)
            .neq('status', 'paid')
            .order('bill_date', { ascending: false });

        if (error) throw error;

        // Aging Analysis
        const today = new Date();
        const buckets = {
            current: 0,
            overdue_30: 0,
            overdue_60: 0,
            overdue_90: 0,
            total_outstanding: 0
        };

        const analyzedBills = bills?.map(bill => {
            const daysOverdue = Math.floor((today.getTime() - new Date(bill.due_date || bill.bill_date).getTime()) / (1000 * 60 * 60 * 24));

            buckets.total_outstanding += Number(bill.balance);

            if (daysOverdue <= 0) buckets.current += Number(bill.balance);
            else if (daysOverdue <= 30) buckets.overdue_30 += Number(bill.balance);
            else if (daysOverdue <= 60) buckets.overdue_60 += Number(bill.balance);
            else buckets.overdue_90 += Number(bill.balance);

            return { ...bill, daysOverdue: Math.max(0, daysOverdue) };
        });

        res.status(200).json({
            success: true,
            data: {
                summary: buckets,
                bills: analyzedBills
            }
        });

    } catch (error) {
        next(error);
    }
};
