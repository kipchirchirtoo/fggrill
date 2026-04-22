import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

/**
 * @desc    Get profit & loss statement
 * @route   GET /api/finance/profit-loss
 * @access  Private (Branch Manager, Auditor, Super Admin)
 */
export const getProfitLossStatement = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, from_date, to_date } = req.query;

        console.log('🔍 [P&L] Fetching profit & loss statement:', { branch_id, from_date, to_date });

        // Calculate date range (default: current month)
        const now = new Date();
        const endDate = (to_date as string) || now.toISOString().split('T')[0];
        const startDate = (from_date as string) || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

        if (!branch_id || branch_id === '0') {
            res.status(400).json({
                success: false,
                error: 'Branch ID is required'
            });
            return;
        }

        // ===== REVENUE CALCULATION =====
        console.log('📊 [P&L] Calculating revenue...');

        // 1. Room Revenue (from bookings)
        const { data: bookings, error: bookingsError } = await supabase
            .from('bookings')
            .select('total_amount, status')
            .eq('branch_id', branch_id)
            .gte('check_in_date', startDate)
            .lte('check_in_date', endDate)
            .in('status', ['confirmed', 'checked_in', 'checked_out']);

        if (bookingsError) {
            console.error('❌ [P&L] Error fetching bookings:', bookingsError);
        }

        const roomRevenue = (bookings || []).reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

        // 2. F&B Revenue (restaurant + bar)
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('total_amount, order_type, status')
            .eq('branch_id', branch_id)
            .gte('created_at', `${startDate}T00:00:00`)
            .lte('created_at', `${endDate}T23:59:59`)
            .eq('status', 'completed');

        if (ordersError) {
            console.error('❌ [P&L] Error fetching orders:', ordersError);
        }

        const restaurantRevenue = (orders || [])
            .filter(o => o.order_type === 'restaurant' || o.order_type === 'dine_in')
            .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

        const barRevenue = (orders || [])
            .filter(o => o.order_type === 'bar')
            .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

        // 3. Additional Services Revenue
        const { data: services, error: servicesError } = await supabase
            .from('additional_services')
            .select('amount, status')
            .eq('branch_id', branch_id)
            .gte('created_at', `${startDate}T00:00:00`)
            .lte('created_at', `${endDate}T23:59:59`)
            .eq('status', 'completed');

        if (servicesError) {
            console.error('❌ [P&L] Error fetching services:', servicesError);
        }

        const servicesRevenue = (services || []).reduce((sum, s) => sum + Number(s.amount || 0), 0);

        // 4. Conference Revenue
        const { data: conferences, error: conferencesError } = await supabase
            .from('conference_bookings')
            .select('total_amount, status')
            .eq('branch_id', branch_id)
            .gte('booking_date', startDate)
            .lte('booking_date', endDate)
            .in('status', ['confirmed', 'completed']);

        if (conferencesError) {
            console.error('❌ [P&L] Error fetching conferences:', conferencesError);
        }

        const conferenceRevenue = (conferences || []).reduce((sum, c) => sum + Number(c.total_amount || 0), 0);

        const totalRevenue = roomRevenue + restaurantRevenue + barRevenue + servicesRevenue + conferenceRevenue;

        console.log('✅ [P&L] Revenue calculated:', {
            room: roomRevenue,
            restaurant: restaurantRevenue,
            bar: barRevenue,
            services: servicesRevenue,
            conference: conferenceRevenue,
            total: totalRevenue
        });

        // ===== EXPENSES CALCULATION =====
        console.log('📊 [P&L] Calculating expenses...');

        // 1. Cost of Goods Sold (COGS) - Stock purchases
        const { data: purchases, error: purchasesError } = await supabase
            .from('purchases')
            .select('total_amount, status')
            .eq('branch_id', branch_id)
            .gte('purchase_date', startDate)
            .lte('purchase_date', endDate)
            .in('status', ['approved', 'completed']);

        if (purchasesError) {
            console.error('❌ [P&L] Error fetching purchases:', purchasesError);
        }

        const cogs = (purchases || []).reduce((sum, p) => sum + Number(p.total_amount || 0), 0);

        // 2. Payroll Expenses
        const { data: payroll, error: payrollError } = await supabase
            .from('payroll')
            .select('net_salary, status')
            .eq('branch_id', branch_id)
            .gte('pay_period_start', startDate)
            .lte('pay_period_end', endDate)
            .eq('status', 'paid');

        if (payrollError) {
            console.error('❌ [P&L] Error fetching payroll:', payrollError);
        }

        const payrollExpenses = (payroll || []).reduce((sum, p) => sum + Number(p.net_salary || 0), 0);

        // 3. Petty Cash Expenses
        const { data: pettyCash, error: pettyCashError } = await supabase
            .from('petty_cash_transactions')
            .select('amount, transaction_type')
            .eq('branch_id', branch_id)
            .gte('transaction_date', startDate)
            .lte('transaction_date', endDate)
            .eq('transaction_type', 'expense');

        if (pettyCashError) {
            console.error('❌ [P&L] Error fetching petty cash:', pettyCashError);
        }

        const pettyCashExpenses = (pettyCash || []).reduce((sum, pc) => sum + Number(pc.amount || 0), 0);

        // 4. Maintenance Expenses
        const { data: maintenance, error: maintenanceError } = await supabase
            .from('maintenance_requests')
            .select('estimated_cost, status')
            .eq('branch_id', branch_id)
            .gte('created_at', `${startDate}T00:00:00`)
            .lte('created_at', `${endDate}T23:59:59`)
            .eq('status', 'completed');

        if (maintenanceError) {
            console.error('❌ [P&L] Error fetching maintenance:', maintenanceError);
        }

        const maintenanceExpenses = (maintenance || []).reduce((sum, m) => sum + Number(m.estimated_cost || 0), 0);

        // 5. Utilities & Other Operating Expenses (from expenses table if exists)
        const { data: otherExpenses, error: otherExpensesError } = await supabase
            .from('expenses')
            .select('amount, status')
            .eq('branch_id', branch_id)
            .gte('expense_date', startDate)
            .lte('expense_date', endDate)
            .eq('status', 'approved');

        if (otherExpensesError) {
            console.error('❌ [P&L] Error fetching other expenses:', otherExpensesError);
        }

        const otherOperatingExpenses = (otherExpenses || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);

        const totalExpenses = cogs + payrollExpenses + pettyCashExpenses + maintenanceExpenses + otherOperatingExpenses;

        console.log('✅ [P&L] Expenses calculated:', {
            cogs,
            payroll: payrollExpenses,
            pettyCash: pettyCashExpenses,
            maintenance: maintenanceExpenses,
            other: otherOperatingExpenses,
            total: totalExpenses
        });

        // ===== PROFIT CALCULATION =====
        const grossProfit = totalRevenue - cogs;
        const operatingExpenses = payrollExpenses + pettyCashExpenses + maintenanceExpenses + otherOperatingExpenses;
        const operatingProfit = grossProfit - operatingExpenses;
        const netProfit = totalRevenue - totalExpenses;

        const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
        const operatingMargin = totalRevenue > 0 ? (operatingProfit / totalRevenue) * 100 : 0;
        const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        console.log('✅ [P&L] Profit calculated:', {
            gross: grossProfit,
            operating: operatingProfit,
            net: netProfit
        });

        // ===== RESPONSE =====
        res.status(200).json({
            success: true,
            data: {
                period: {
                    from: startDate,
                    to: endDate
                },
                revenue: {
                    rooms: roomRevenue,
                    restaurant: restaurantRevenue,
                    bar: barRevenue,
                    services: servicesRevenue,
                    conference: conferenceRevenue,
                    total: totalRevenue
                },
                expenses: {
                    cogs,
                    payroll: payrollExpenses,
                    petty_cash: pettyCashExpenses,
                    maintenance: maintenanceExpenses,
                    other_operating: otherOperatingExpenses,
                    total: totalExpenses
                },
                profit: {
                    gross_profit: grossProfit,
                    operating_profit: operatingProfit,
                    net_profit: netProfit
                },
                margins: {
                    gross_margin: grossMargin,
                    operating_margin: operatingMargin,
                    net_margin: netMargin
                }
            }
        });
    } catch (error) {
        console.error('❌ [P&L] Error:', error);
        logger.error('Error generating profit & loss statement:', error);
        next(error);
    }
};

/**
 * @desc    Get expense breakdown by category
 * @route   GET /api/finance/expense-breakdown
 * @access  Private
 */
export const getExpenseBreakdown = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, from_date, to_date } = req.query;

        console.log('🔍 [P&L] Fetching expense breakdown:', { branch_id, from_date, to_date });

        const now = new Date();
        const endDate = (to_date as string) || now.toISOString().split('T')[0];
        const startDate = (from_date as string) || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

        if (!branch_id || branch_id === '0') {
            res.status(400).json({
                success: false,
                error: 'Branch ID is required'
            });
            return;
        }

        // Get expenses by category
        const { data: expenses, error } = await supabase
            .from('expenses')
            .select('amount, category, description, expense_date')
            .eq('branch_id', branch_id)
            .gte('expense_date', startDate)
            .lte('expense_date', endDate)
            .eq('status', 'approved')
            .order('expense_date', { ascending: false });

        if (error) throw error;

        // Group by category
        const breakdown: Record<string, { total: number; count: number; items: any[] }> = {};

        (expenses || []).forEach(expense => {
            const category = expense.category || 'Uncategorized';
            if (!breakdown[category]) {
                breakdown[category] = { total: 0, count: 0, items: [] };
            }
            breakdown[category].total += Number(expense.amount || 0);
            breakdown[category].count += 1;
            breakdown[category].items.push(expense);
        });

        res.status(200).json({
            success: true,
            data: {
                breakdown,
                period: { from: startDate, to: endDate }
            }
        });
    } catch (error) {
        logger.error('Error fetching expense breakdown:', error);
        next(error);
    }
};
