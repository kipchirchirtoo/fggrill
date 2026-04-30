import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

const toNumber = (value: any): number => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
};

const sumObjectValues = (obj: Record<string, any>): number => {
    return Object.values(obj).reduce((sum, value) => {
        if (typeof value === 'number') return sum + value;
        if (typeof value === 'string') return sum + toNumber(value);
        return sum;
    }, 0);
};

const sanitizeString = (value: any): string => {
    return typeof value === 'string' ? value.trim() : '';
};

const normalizeRevenueData = (raw: any = {}) => {
    return {
        restaurant: toNumber(raw.restaurant),
        bar: toNumber(raw.bar),
        executive_bar: toNumber(raw.executive_bar),
        sports_bar: toNumber(raw.sports_bar),
        pool_table: toNumber(raw.pool_table ?? raw.pool),
        spa_sauna: toNumber(raw.spa_sauna ?? raw.spa),
        carwash: toNumber(raw.carwash ?? raw.wash),
        conferences: toNumber(raw.conferences ?? raw.conf),
        outside_catering: toNumber(raw.outside_catering ?? raw.catering),
        rooms: toNumber(raw.rooms),
        paid_bills: toNumber(raw.paid_bills ?? raw.bills),
        non_consumables: toNumber(raw.non_consumables),
        swimming_pool: toNumber(raw.swimming_pool),
        other: toNumber(raw.other)
    };
};

const normalizePaymentData = (raw: any = {}) => {
    const swipe = toNumber(raw.swipe ?? raw.card);
    return {
        cash: toNumber(raw.cash),
        mpesa: toNumber(raw.mpesa),
        swipe,
        card: swipe, // Backward compatibility for existing consumers
        other: toNumber(raw.other)
    };
};

const normalizeCogsData = (raw: any = {}) => {
    return {
        opening_balance: toNumber(raw.opening_balance ?? raw.opening),
        central_store_receipts: toNumber(raw.central_store_receipts ?? raw.central),
        weekly_supplier_receipts: toNumber(raw.weekly_supplier_receipts ?? raw.deliveries),
        closing_balance: toNumber(raw.closing_balance ?? raw.closing)
    };
};

const normalizeLineEntries = (entries: any): Array<{ description: string; amount: number }> => {
    if (!Array.isArray(entries)) return [];
    return entries
        .map((entry) => ({
            description: sanitizeString(entry?.description ?? entry?.item ?? entry?.name),
            amount: toNumber(entry?.amount ?? entry?.value)
        }))
        .filter((entry) => entry.description || entry.amount > 0);
};

const sumEntries = (entries: Array<{ description: string; amount: number }>): number => {
    return entries.reduce((sum, entry) => sum + toNumber(entry.amount), 0);
};

const normalizeExpenseData = (raw: any = {}) => {
    const pettyCashEntries = normalizeLineEntries(raw.petty_cash_entries ?? raw.petty_cash_breakdown);
    const transactionCostEntries = normalizeLineEntries(raw.transaction_cost_entries ?? raw.transaction_entries);
    const directSupplierEntries = normalizeLineEntries(raw.direct_supplier_entries ?? raw.suppliers_entries);
    const wastageEntries = normalizeLineEntries(raw.wastage_entries);
    const shortsEntries = normalizeLineEntries(raw.shorts_entries ?? raw.short_entries);
    const subscriptionsEntries = normalizeLineEntries(raw.subscriptions_entries);
    const otherEntries = normalizeLineEntries(raw.other_entries);
    const creditBillEntries = normalizeLineEntries(raw.credit_bill_entries ?? raw.credit_entries);

    const pettyCashTotal = toNumber(raw.petty_cash_total ?? raw.petty_cash) || sumEntries(pettyCashEntries);
    const transactionCostsTotal = toNumber(raw.transaction_costs_total ?? raw.transaction) || sumEntries(transactionCostEntries);
    const directSuppliersTotal = toNumber(raw.direct_suppliers_total ?? raw.suppliers) || sumEntries(directSupplierEntries);
    const wastageTotal = toNumber(raw.wastage_total ?? raw.wastage) || sumEntries(wastageEntries);
    const shortsTotal = toNumber(raw.shorts_total ?? raw.shorts) || sumEntries(shortsEntries);
    const creditBillsTotal = toNumber(raw.credit_bills_total ?? raw.credit) || sumEntries(creditBillEntries);
    const subscriptionsTotal = toNumber(raw.subscriptions_total) || sumEntries(subscriptionsEntries);
    const otherExpensesTotal = toNumber(raw.other_expenses_total ?? raw.other) || sumEntries(otherEntries);

    return {
        petty_cash_total: pettyCashTotal,
        petty_cash_entries: pettyCashEntries,
        transaction_costs_total: transactionCostsTotal,
        transaction_cost_entries: transactionCostEntries,
        direct_suppliers_total: directSuppliersTotal,
        direct_supplier_entries: directSupplierEntries,
        wastage_total: wastageTotal,
        wastage_entries: wastageEntries,
        shorts_total: shortsTotal,
        shorts_entries: shortsEntries,
        credit_bills_total: creditBillsTotal,
        credit_bill_entries: creditBillEntries,
        subscriptions_total: subscriptionsTotal,
        subscriptions_entries: subscriptionsEntries,
        other_expenses_total: otherExpensesTotal,
        other_entries: otherEntries
    };
};

const normalizeBankingData = (raw: any = {}, recordDate: string) => {
    const historyEntries = Array.isArray(raw.entries)
        ? raw.entries
        : Array.isArray(raw.history)
        ? raw.history
        : [];

    const normalizedHistory = historyEntries
        .map((entry: any, index: number) => ({
            id: sanitizeString(entry?.id) || `${recordDate}-${index + 1}`,
            method: sanitizeString(entry?.method) || 'cash',
            amount: toNumber(entry?.amount ?? entry?.banked),
            account: sanitizeString(entry?.account ?? entry?.bank_account),
            reference: sanitizeString(entry?.reference ?? entry?.ref),
            time: sanitizeString(entry?.time ?? entry?.date_time),
            notes: sanitizeString(entry?.notes)
        }))
        .filter((entry: any) => entry.amount > 0 || entry.account || entry.reference || entry.time);

    const fallbackBanked = toNumber(raw.banked);
    const fallbackAccount = sanitizeString(raw.account ?? raw.primary_account);
    const fallbackRef = sanitizeString(raw.ref ?? raw.reference ?? raw.primary_reference);
    const fallbackTime = sanitizeString(raw.time);

    const hasFallback = fallbackBanked > 0 || fallbackAccount || fallbackRef || fallbackTime;
    const mergedHistory = normalizedHistory.length > 0
        ? normalizedHistory
        : hasFallback
        ? [{
            id: `${recordDate}-1`,
            method: 'cash',
            amount: fallbackBanked,
            account: fallbackAccount,
            reference: fallbackRef,
            time: fallbackTime,
            notes: ''
        }]
        : [];

    const totalBanked = mergedHistory.reduce((sum: number, entry: any) => sum + toNumber(entry.amount), 0);

    return {
        banked: totalBanked > 0 ? totalBanked : fallbackBanked,
        primary_account: mergedHistory[0]?.account || fallbackAccount,
        primary_reference: mergedHistory[0]?.reference || fallbackRef,
        entries: mergedHistory,
        history: mergedHistory
    };
};

const normalizeStatementEntries = (raw: any = {}) => {
    const entries = normalizeLineEntries(raw.entries ?? raw.lines ?? raw.items ?? []);
    const notes = sanitizeString(raw.notes);
    return {
        entries,
        notes
    };
};

const csvEscape = (value: any) => {
    const str = String(value ?? '');
    return `"${str.replace(/"/g, '""')}"`;
};

/**
 * @desc    Get daily financial records for a period
 * @route   GET /api/finance/workspace/daily
 * @access  Private
 */
export const getDailyRecords = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, start_date, end_date } = req.query;

        if (!branch_id || branch_id === '0') {
            res.status(400).json({ success: false, error: 'Branch ID is required' });
            return;
        }

        let query = supabase
            .from('daily_financial_records')
            .select(`
                *,
                created_by_user:users!created_by(id, first_name, last_name),
                reviewed_by_user:users!reviewed_by(id, first_name, last_name)
            `)
            .eq('branch_id', branch_id)
            .order('record_date', { ascending: true });

        if (start_date) query = query.gte('record_date', start_date);
        if (end_date) query = query.lte('record_date', end_date);

        const { data, error } = await query;

        if (error) throw error;

        res.status(200).json({
            success: true,
            data: data || []
        });
    } catch (error) {
        logger.error('Error fetching daily financial records:', error);
        next(error);
    }
};

/**
 * @desc    Get a single daily financial record by date
 * @route   GET /api/finance/workspace/daily/:date
 * @access  Private
 */
export const getDailyRecordByDate = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { date } = req.params;
        const { branch_id } = req.query;

        if (!branch_id || branch_id === '0') {
            res.status(400).json({ success: false, error: 'Branch ID is required' });
            return;
        }

        const { data, error } = await supabase
            .from('daily_financial_records')
            .select('*')
            .eq('branch_id', branch_id)
            .eq('record_date', date)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is not found
            throw error;
        }

        res.status(200).json({
            success: true,
            data: data || null
        });
    } catch (error) {
        logger.error('Error fetching daily financial record:', error);
        next(error);
    }
};

/**
 * @desc    Save or update a daily financial record
 * @route   POST /api/finance/workspace/daily
 * @access  Private
 */
export const saveDailyRecord = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            branch_id,
            record_date,
            status,
            revenue_data,
            total_revenue,
            payment_data,
            total_payments,
            banking_data,
            expected_cash,
            unbanked_cash,
            cogs_data,
            total_cogs,
            expense_data,
            total_expenses,
            net_profit,
            notes
        } = req.body;

        if (!branch_id || !record_date) {
            res.status(400).json({ success: false, error: 'Branch ID and Record Date are required' });
            return;
        }

        const normalizedRevenueData = normalizeRevenueData(revenue_data);
        const normalizedPaymentData = normalizePaymentData(payment_data);
        const normalizedCogsData = normalizeCogsData(cogs_data);
        const normalizedExpenseData = normalizeExpenseData(expense_data);
        const normalizedBankingData = normalizeBankingData(banking_data, record_date);

        const computedTotalRevenue = total_revenue !== undefined ? toNumber(total_revenue) : sumObjectValues(normalizedRevenueData);
        const computedTotalPayments = total_payments !== undefined ? toNumber(total_payments) : sumObjectValues(normalizedPaymentData);
        const computedTotalCogs = total_cogs !== undefined
            ? toNumber(total_cogs)
            : toNumber(normalizedCogsData.opening_balance) +
              toNumber(normalizedCogsData.central_store_receipts) +
              toNumber(normalizedCogsData.weekly_supplier_receipts) -
              toNumber(normalizedCogsData.closing_balance);
        const computedTotalExpenses = total_expenses !== undefined
            ? toNumber(total_expenses)
            : toNumber(normalizedExpenseData.petty_cash_total) +
              toNumber(normalizedExpenseData.transaction_costs_total) +
              toNumber(normalizedExpenseData.direct_suppliers_total) +
              toNumber(normalizedExpenseData.wastage_total) +
              toNumber(normalizedExpenseData.shorts_total) +
              toNumber(normalizedExpenseData.credit_bills_total) +
              toNumber(normalizedExpenseData.other_expenses_total);

        const computedExpectedCash = expected_cash !== undefined
            ? toNumber(expected_cash)
            : Math.max(0, toNumber(normalizedPaymentData.cash) - toNumber(normalizedExpenseData.petty_cash_total));
        const computedUnbankedCash = unbanked_cash !== undefined
            ? toNumber(unbanked_cash)
            : computedExpectedCash - toNumber(normalizedBankingData.banked);
        const computedNetProfit = net_profit !== undefined
            ? toNumber(net_profit)
            : computedTotalRevenue - (computedTotalCogs + computedTotalExpenses);

        const record = {
            branch_id,
            record_date,
            status: status || 'DRAFT',
            revenue_data: normalizedRevenueData,
            total_revenue: computedTotalRevenue,
            payment_data: normalizedPaymentData,
            total_payments: computedTotalPayments,
            banking_data: normalizedBankingData,
            expected_cash: computedExpectedCash,
            unbanked_cash: computedUnbankedCash,
            cogs_data: normalizedCogsData,
            total_cogs: computedTotalCogs,
            expense_data: normalizedExpenseData,
            total_expenses: computedTotalExpenses,
            net_profit: computedNetProfit,
            notes,
            created_by: req.user?.id,
            updated_at: new Date().toISOString()
        };

        if (status === 'SUBMITTED') {
            (record as any).submitted_at = new Date().toISOString();
        } else if (status === 'REVIEWED') {
            (record as any).reviewed_by = req.user?.id;
            (record as any).reviewed_at = new Date().toISOString();
        }

        const { data, error } = await supabase
            .from('daily_financial_records')
            .upsert(record, { onConflict: 'branch_id,record_date' })
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        logger.error('Error saving daily financial record:', error);
        next(error);
    }
};

/**
 * @desc    Get monthly financial adjustments for a period
 * @route   GET /api/finance/workspace/monthly
 * @access  Private
 */
export const getMonthlyAdjustments = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, fiscal_year, fiscal_month } = req.query;

        if (!branch_id || branch_id === '0') {
            res.status(400).json({ success: false, error: 'Branch ID is required' });
            return;
        }

        let query = supabase
            .from('monthly_financial_adjustments')
            .select('*')
            .eq('branch_id', branch_id);

        if (fiscal_year) query = query.eq('fiscal_year', fiscal_year);
        if (fiscal_month) query = query.eq('fiscal_month', fiscal_month);

        const { data, error } = await query;

        if (error) throw error;

        res.status(200).json({
            success: true,
            data: data || []
        });
    } catch (error) {
        logger.error('Error fetching monthly adjustments:', error);
        next(error);
    }
};

/**
 * @desc    Save or update a monthly financial adjustment
 * @route   POST /api/finance/workspace/monthly
 * @access  Private
 */
export const saveMonthlyAdjustment = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            branch_id,
            fiscal_year,
            fiscal_month,
            electricity,
            salaries,
            water,
            subscriptions,
            rent,
            nssf,
            shif,
            tax,
            levy,
            licenses,
            subscription_entries,
            other_monthly_expenses,
            monthly_revenue_data,
            monthly_cogs_data,
            monthly_expense_data,
            statement_entries,
            total_monthly_expenses,
            monthly_profit,
            cash_flow_data,
            balance_sheet_data,
            notes
        } = req.body;

        if (!branch_id || !fiscal_year || !fiscal_month) {
            res.status(400).json({ success: false, error: 'Branch ID, Fiscal Year, and Fiscal Month are required' });
            return;
        }

        const normalizedRevenueData = normalizeRevenueData(monthly_revenue_data || {});
        const normalizedCogsData = normalizeCogsData(monthly_cogs_data || {});
        const normalizedExpenseData = normalizeExpenseData(monthly_expense_data || {});
        const normalizedSubscriptionEntries = normalizeLineEntries(subscription_entries || subscriptions?.entries || subscriptions || []);
        const normalizedOtherMonthlyExpenses = normalizeLineEntries(other_monthly_expenses || []);

        const normalizedCashFlow = normalizeStatementEntries(cash_flow_data || {});
        const normalizedBalanceSheet = normalizeStatementEntries(balance_sheet_data || {});
        const normalizedStatementEntries = normalizeStatementEntries(statement_entries || {});

        const fixedExpenseTotal =
            toNumber(electricity) +
            toNumber(salaries) +
            toNumber(water) +
            toNumber(rent) +
            toNumber(nssf) +
            toNumber(shif) +
            toNumber(tax) +
            toNumber(levy) +
            toNumber(licenses);

        const variableMonthlyExpenseTotal =
            sumEntries(normalizedSubscriptionEntries) +
            sumEntries(normalizedOtherMonthlyExpenses) +
            toNumber(normalizedExpenseData.petty_cash_total) +
            toNumber(normalizedExpenseData.transaction_costs_total) +
            toNumber(normalizedExpenseData.direct_suppliers_total) +
            toNumber(normalizedExpenseData.wastage_total) +
            toNumber(normalizedExpenseData.shorts_total) +
            toNumber(normalizedExpenseData.credit_bills_total) +
            toNumber(normalizedExpenseData.other_expenses_total);

        const computedTotalMonthlyExpenses = total_monthly_expenses !== undefined
            ? toNumber(total_monthly_expenses)
            : fixedExpenseTotal + variableMonthlyExpenseTotal;

        const computedRevenue = sumObjectValues(normalizedRevenueData);
        const computedCogs =
            toNumber(normalizedCogsData.opening_balance) +
            toNumber(normalizedCogsData.central_store_receipts) +
            toNumber(normalizedCogsData.weekly_supplier_receipts) -
            toNumber(normalizedCogsData.closing_balance);
        const computedMonthlyProfit = monthly_profit !== undefined
            ? toNumber(monthly_profit)
            : computedRevenue - (computedCogs + computedTotalMonthlyExpenses);

        const adjustment = {
            branch_id,
            fiscal_year,
            fiscal_month,
            electricity,
            salaries,
            water,
            rent,
            nssf,
            shif,
            tax,
            levy,
            licenses,
            subscriptions: {
                entries: normalizedSubscriptionEntries,
                total: sumEntries(normalizedSubscriptionEntries)
            },
            total_monthly_expenses: computedTotalMonthlyExpenses,
            monthly_profit: computedMonthlyProfit,
            cash_flow_data: {
                ...normalizedCashFlow,
                monthly_revenue_data: normalizedRevenueData,
                monthly_cogs_data: normalizedCogsData,
                monthly_expense_data: normalizedExpenseData,
                other_monthly_expenses: normalizedOtherMonthlyExpenses,
                statement_entries: normalizedStatementEntries
            },
            balance_sheet_data: {
                ...normalizedBalanceSheet,
                statement_entries: normalizedStatementEntries,
                notes: sanitizeString(notes) || normalizedBalanceSheet.notes
            },
            created_by: req.user?.id,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('monthly_financial_adjustments')
            .upsert(adjustment, { onConflict: 'branch_id,fiscal_year,fiscal_month' })
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        logger.error('Error saving monthly adjustment:', error);
        next(error);
    }
};

/**
 * @desc    Export monthly financial statement CSV
 * @route   GET /api/finance/workspace/export
 * @access  Private
 */
export const exportMonthlyStatement = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, fiscal_year, fiscal_month } = req.query as Record<string, string>;

        if (!branch_id || branch_id === '0' || !fiscal_year || !fiscal_month) {
            res.status(400).json({ success: false, error: 'Branch ID, fiscal year, and fiscal month are required' });
            return;
        }

        const year = Number(fiscal_year);
        const month = Number(fiscal_month);
        const monthStart = new Date(Date.UTC(year, month - 1, 1));
        const monthEnd = new Date(Date.UTC(year, month, 0));
        const startDate = monthStart.toISOString().split('T')[0];
        const endDate = monthEnd.toISOString().split('T')[0];

        const [{ data: dailyRecords, error: dailyError }, { data: monthlyAdjustment, error: monthlyError }, { data: branchData }] = await Promise.all([
            supabase
                .from('daily_financial_records')
                .select('*')
                .eq('branch_id', branch_id)
                .gte('record_date', startDate)
                .lte('record_date', endDate)
                .order('record_date', { ascending: true }),
            supabase
                .from('monthly_financial_adjustments')
                .select('*')
                .eq('branch_id', branch_id)
                .eq('fiscal_year', fiscal_year)
                .eq('fiscal_month', fiscal_month)
                .maybeSingle(),
            supabase
                .from('branches')
                .select('name')
                .eq('id', branch_id)
                .maybeSingle()
        ]);

        if (dailyError) throw dailyError;
        if (monthlyError) throw monthlyError;

        const records = dailyRecords || [];
        const revenueTotals: Record<string, number> = {};
        const paymentTotals: Record<string, number> = {};
        let totalRevenue = 0;
        let totalCogs = 0;
        let totalExpenses = 0;
        let totalProfit = 0;
        let totalExpectedCash = 0;
        let totalBanked = 0;
        let totalUnbanked = 0;

        records.forEach((record: any) => {
            const revenue = normalizeRevenueData(record.revenue_data || {});
            const payment = normalizePaymentData(record.payment_data || {});
            const banking = normalizeBankingData(record.banking_data || {}, record.record_date);

            Object.entries(revenue).forEach(([key, value]) => {
                revenueTotals[key] = (revenueTotals[key] || 0) + toNumber(value);
            });
            Object.entries(payment).forEach(([key, value]) => {
                paymentTotals[key] = (paymentTotals[key] || 0) + toNumber(value);
            });

            totalRevenue += toNumber(record.total_revenue);
            totalCogs += toNumber(record.total_cogs);
            totalExpenses += toNumber(record.total_expenses);
            totalProfit += toNumber(record.net_profit);
            totalExpectedCash += toNumber(record.expected_cash);
            totalBanked += toNumber(banking.banked);
            totalUnbanked += toNumber(record.unbanked_cash);
        });

        const rows: any[][] = [];
        rows.push(['Monthly Financial Statement']);
        rows.push(['Branch', branchData?.name || `Branch ${branch_id}`]);
        rows.push(['Period', `${fiscal_year}-${String(fiscal_month).padStart(2, '0')}`]);
        rows.push([]);
        rows.push(['Daily Records']);
        rows.push(['Date', 'Status', 'Revenue', 'COGS', 'Expenses', 'Net Profit', 'Cash', 'MPESA', 'Swipe', 'Expected Cash', 'Banked', 'Unbanked']);

        records.forEach((record: any) => {
            const payment = normalizePaymentData(record.payment_data || {});
            const banking = normalizeBankingData(record.banking_data || {}, record.record_date);
            rows.push([
                record.record_date,
                record.status,
                toNumber(record.total_revenue).toFixed(2),
                toNumber(record.total_cogs).toFixed(2),
                toNumber(record.total_expenses).toFixed(2),
                toNumber(record.net_profit).toFixed(2),
                toNumber(payment.cash).toFixed(2),
                toNumber(payment.mpesa).toFixed(2),
                toNumber(payment.swipe).toFixed(2),
                toNumber(record.expected_cash).toFixed(2),
                toNumber(banking.banked).toFixed(2),
                toNumber(record.unbanked_cash).toFixed(2)
            ]);
        });

        rows.push([]);
        rows.push(['Revenue Stream Totals']);
        rows.push(['Stream', 'Amount']);
        Object.entries(revenueTotals).forEach(([key, value]) => {
            rows.push([key, toNumber(value).toFixed(2)]);
        });

        rows.push([]);
        rows.push(['Payment Method Totals']);
        rows.push(['Method', 'Amount']);
        Object.entries(paymentTotals).forEach(([key, value]) => {
            rows.push([key, toNumber(value).toFixed(2)]);
        });

        rows.push([]);
        rows.push(['Monthly Summary']);
        rows.push(['Total Revenue', totalRevenue.toFixed(2)]);
        rows.push(['Total COGS', totalCogs.toFixed(2)]);
        rows.push(['Total Expenses', totalExpenses.toFixed(2)]);
        rows.push(['Total Net Profit', totalProfit.toFixed(2)]);
        rows.push(['Expected Cash to Bank', totalExpectedCash.toFixed(2)]);
        rows.push(['Banked Cash', totalBanked.toFixed(2)]);
        rows.push(['Unbanked Cash', totalUnbanked.toFixed(2)]);

        if (monthlyAdjustment) {
            rows.push([]);
            rows.push(['Monthly Fixed/Additional Expenses']);
            rows.push(['Electricity', toNumber(monthlyAdjustment.electricity).toFixed(2)]);
            rows.push(['Salaries', toNumber(monthlyAdjustment.salaries).toFixed(2)]);
            rows.push(['Water', toNumber(monthlyAdjustment.water).toFixed(2)]);
            rows.push(['Rent', toNumber(monthlyAdjustment.rent).toFixed(2)]);
            rows.push(['NSSF', toNumber(monthlyAdjustment.nssf).toFixed(2)]);
            rows.push(['SHIF', toNumber(monthlyAdjustment.shif).toFixed(2)]);
            rows.push(['Tax', toNumber(monthlyAdjustment.tax).toFixed(2)]);
            rows.push(['Levy', toNumber(monthlyAdjustment.levy).toFixed(2)]);
            rows.push(['Licenses', toNumber(monthlyAdjustment.licenses).toFixed(2)]);
            rows.push(['Total Monthly Expenses', toNumber(monthlyAdjustment.total_monthly_expenses).toFixed(2)]);
            rows.push(['Monthly Profit', toNumber(monthlyAdjustment.monthly_profit).toFixed(2)]);
        }

        const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
        const filename = `financial_statement_branch_${branch_id}_${fiscal_year}_${String(fiscal_month).padStart(2, '0')}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.status(200).send(csv);
    } catch (error) {
        logger.error('Error exporting monthly statement:', error);
        next(error);
    }
};
