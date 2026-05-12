import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import PDFDocument from 'pdfkit';

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

        // ─── Document Setup ──────────────────────────────────────────────────────
        const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'portrait', bufferPages: true });
        const filename = `Financial_Statement_${fiscal_year}_${String(fiscal_month).padStart(2, '0')}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        doc.pipe(res);

        const PW = doc.page.width;    // 595
        const PH = doc.page.height;   // 842
        const PM = 50;                // margin
        const colGap = 16;
        const colW = (PW - PM * 2 - colGap) / 2;
        const leftX  = PM;
        const rightX = PM + colW + colGap;
        const branchName = branchData?.name || `Branch ${branch_id}`;
        const monthYear = monthStart.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });

        // ─── Helper Functions ─────────────────────────────────────────────────
        const fmt = (n: number) => n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        const drawColHeader = (title: string, x: number, w: number, yPos: number): number => {
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a')
               .text(title, x, yPos, { width: w });
            doc.moveTo(x, yPos + 13).lineTo(x + w, yPos + 13).lineWidth(1.5).stroke('#0f172a');
            return yPos + 20;
        };

        const drawSubHeader = (title: string, x: number, w: number, yPos: number): number => {
            doc.font('Helvetica').fontSize(9).fillColor('#374151')
               .text(title, x, yPos, { width: w });
            return yPos + 15;
        };

        const drawRow = (label: string, amount: number, x: number, w: number, yPos: number, indent = 10): number => {
            doc.font('Helvetica').fontSize(9).fillColor('#1e293b')
               .text(label, x + indent, yPos, { width: w - indent - 80 });
            doc.text(fmt(amount), x + w - 80, yPos, { width: 80, align: 'right' });
            return yPos + 14;
        };

        const drawTotalRow = (label: string, amount: number, x: number, w: number, yPos: number, doubleUnderline = false): number => {
            doc.moveTo(x, yPos - 2).lineTo(x + w, yPos - 2).lineWidth(0.5).stroke('#94a3b8');
            doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a')
               .text(label, x, yPos + 3, { width: w - 80 });
            doc.text(fmt(amount), x + w - 80, yPos + 3, { width: 80, align: 'right' });
            if (doubleUnderline) {
                doc.moveTo(x + w - 80, yPos + 16).lineTo(x + w, yPos + 16).lineWidth(0.5).stroke('#0f172a');
                doc.moveTo(x + w - 80, yPos + 19).lineTo(x + w, yPos + 19).lineWidth(0.5).stroke('#0f172a');
            }
            return yPos + 24;
        };

        // ─── Blue Header Bar ──────────────────────────────────────────────────
        doc.rect(0, 0, PW, 88).fill('#1d4ed8');
        doc.fillColor('#ffffff')
           .font('Helvetica-Bold').fontSize(18)
           .text('FAMOUS GATE HOTELS', 0, 14, { align: 'center', width: PW });
        doc.font('Helvetica').fontSize(11)
           .text('MONTHLY FINANCIAL STATEMENT', 0, 38, { align: 'center', width: PW });
        doc.fontSize(9)
           .text(`${branchName}    ·    ${monthYear}`, 0, 60, { align: 'center', width: PW });
        doc.fillColor('#bfdbfe').fontSize(7)
           .text(`Generated: ${new Date().toLocaleString('en-KE')}`, PM, 74, { width: PW - PM * 2, align: 'right' });

        let y = 108;

        // ─── Column Headers ───────────────────────────────────────────────────
        let leftY  = drawColHeader('INCOME', leftX, colW, y);
        let rightY = drawColHeader('EXPENDITURE', rightX, colW, y);

        // ─── LEFT COLUMN: INCOME ──────────────────────────────────────────────
        leftY = drawSubHeader('Revenue Streams', leftX, colW, leftY);

        const revItems: Array<[string, number]> = [
            ['Restaurant',             revenueTotals.restaurant       || 0],
            ['Bar',                    revenueTotals.bar              || 0],
            ['Executive Bar',          revenueTotals.executive_bar    || 0],
            ['Sports Bar',             revenueTotals.sports_bar       || 0],
            ['Accommodation (Rooms)',  revenueTotals.rooms            || 0],
            ['Pool Table',             revenueTotals.pool_table       || 0],
            ['Spa & Sauna',            revenueTotals.spa_sauna        || 0],
            ['Swimming Pool',          revenueTotals.swimming_pool    || 0],
            ['Car Wash',               revenueTotals.carwash          || 0],
            ['Conferences',            revenueTotals.conferences      || 0],
            ['Outside Catering',       revenueTotals.outside_catering || 0],
            ['Paid Bills',             revenueTotals.paid_bills       || 0],
            ['Non-Consumables',        revenueTotals.non_consumables  || 0],
            ['Other Income',           revenueTotals.other            || 0],
        ];
        revItems.filter(([, v]) => v > 0).forEach(([label, val]) => {
            leftY = drawRow(label, val, leftX, colW, leftY);
        });
        leftY = drawTotalRow('Total Revenue', totalRevenue, leftX, colW, leftY, true);
        leftY += 10;

        leftY = drawSubHeader('Payment Methods', leftX, colW, leftY);
        leftY = drawRow('Cash Received', paymentTotals.cash  || 0, leftX, colW, leftY);
        leftY = drawRow('M-Pesa',        paymentTotals.mpesa || 0, leftX, colW, leftY);
        leftY = drawRow('Card / Swipe',  paymentTotals.swipe || 0, leftX, colW, leftY);
        if ((paymentTotals.other || 0) > 0) leftY = drawRow('Other', paymentTotals.other, leftX, colW, leftY);
        leftY += 10;

        leftY = drawSubHeader('Banking Position', leftX, colW, leftY);
        leftY = drawRow('Expected Cash to Bank', totalExpectedCash, leftX, colW, leftY);
        leftY = drawRow('Banked Cash',           totalBanked,        leftX, colW, leftY);
        const unbankedTextColor = totalUnbanked > 0 ? '#dc2626' : '#1e293b';
        doc.font('Helvetica').fontSize(9).fillColor(unbankedTextColor)
           .text('Unbanked Cash', leftX + 10, leftY, { width: colW - 10 - 80 });
        doc.text(fmt(totalUnbanked), leftX + colW - 80, leftY, { width: 80, align: 'right' });
        leftY += 14;
        doc.fillColor('#1e293b');

        // ─── RIGHT COLUMN: EXPENDITURE ────────────────────────────────────────
        rightY = drawSubHeader('Cost of Goods Sold (COGS)', rightX, colW, rightY);
        rightY = drawRow('Total COGS', totalCogs, rightX, colW, rightY);
        rightY = drawTotalRow('Gross Profit', totalRevenue - totalCogs, rightX, colW, rightY);
        rightY += 10;

        let totalFixedExpenses = 0;
        if (monthlyAdjustment) {
            rightY = drawSubHeader('Fixed Monthly Expenses', rightX, colW, rightY);
            const fixedItems: Array<[string, number]> = [
                ['Salaries',    toNumber(monthlyAdjustment.salaries)],
                ['Electricity', toNumber(monthlyAdjustment.electricity)],
                ['Water',       toNumber(monthlyAdjustment.water)],
                ['Rent',        toNumber(monthlyAdjustment.rent)],
                ['NSSF',        toNumber(monthlyAdjustment.nssf)],
                ['SHIF',        toNumber(monthlyAdjustment.shif)],
                ['Tax',         toNumber(monthlyAdjustment.tax)],
                ['Levy',        toNumber(monthlyAdjustment.levy)],
                ['Licenses',    toNumber(monthlyAdjustment.licenses)],
            ];
            fixedItems.filter(([, v]) => v > 0).forEach(([label, val]) => {
                rightY = drawRow(label, val, rightX, colW, rightY);
            });
            const subEntries: any[] = monthlyAdjustment.subscriptions?.entries || [];
            subEntries.filter((s: any) => s.description && toNumber(s.amount) > 0).forEach((s: any) => {
                rightY = drawRow(s.description, toNumber(s.amount), rightX, colW, rightY);
            });
            totalFixedExpenses = toNumber(monthlyAdjustment.total_monthly_expenses);
            rightY = drawTotalRow('Total Fixed Expenses', totalFixedExpenses, rightX, colW, rightY);
            rightY += 10;
        }

        rightY = drawSubHeader('Operating Expenses', rightX, colW, rightY);
        rightY = drawRow('Daily Operating Expenses', totalExpenses, rightX, colW, rightY);
        const totalExpenditure = totalCogs + totalFixedExpenses + totalExpenses;
        rightY = drawTotalRow('Total Expenditure', totalExpenditure, rightX, colW, rightY, true);

        // ─── Vertical Divider ─────────────────────────────────────────────────
        const dividerX = leftX + colW + colGap / 2;
        const dividerBottom = Math.max(leftY, rightY) + 10;
        doc.moveTo(dividerX, 108).lineTo(dividerX, dividerBottom).lineWidth(0.5).stroke('#cbd5e1');

        // ─── Net Profit / Loss Banner ─────────────────────────────────────────
        const summaryY = dividerBottom + 8;
        const netProfit = monthlyAdjustment ? toNumber(monthlyAdjustment.monthly_profit) : totalProfit;
        const isPositive = netProfit >= 0;
        doc.rect(PM, summaryY, PW - PM * 2, 38).fill(isPositive ? '#dcfce7' : '#fee2e2');
        doc.font('Helvetica-Bold').fontSize(13)
           .fillColor(isPositive ? '#15803d' : '#dc2626')
           .text(`NET ${isPositive ? 'PROFIT' : 'LOSS'} FOR ${monthYear.toUpperCase()}`, PM + 12, summaryY + 6, { width: (PW - PM * 2) * 0.55 });
        doc.text(`KES ${fmt(Math.abs(netProfit))}`, PM, summaryY + 6, { width: PW - PM * 2 - 12, align: 'right' });

        // ─── Page 2: Daily Records Table ──────────────────────────────────────
        doc.addPage();

        doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a')
           .text('DAILY RECORDS BREAKDOWN', PM, PM);
        doc.font('Helvetica').fontSize(8).fillColor('#64748b')
           .text(`${branchName}  ·  ${monthYear}  ·  ${records.length} record(s)`, PM, PM + 18);

        const tblTop = PM + 38;
        const tblCols = [
            { header: 'Date',       x: PM,       w: 58 },
            { header: 'Status',     x: PM + 58,  w: 60 },
            { header: 'Revenue',    x: PM + 118, w: 68 },
            { header: 'COGS',       x: PM + 186, w: 58 },
            { header: 'Expenses',   x: PM + 244, w: 60 },
            { header: 'Net Profit', x: PM + 304, w: 68 },
            { header: 'Cash',       x: PM + 372, w: 52 },
            { header: 'M-Pesa',     x: PM + 424, w: 52 },
            { header: 'Banked',     x: PM + 476, w: 52 },
            { header: 'Unbanked',   x: PM + 528, w: 57 },
        ];
        const tblW = PM + 528 + 57 - PM;

        const drawTableHeader = (topY: number) => {
            doc.rect(PM, topY, tblW, 18).fill('#1d4ed8');
            doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
            tblCols.forEach(col => {
                doc.text(col.header, col.x + 2, topY + 5, { width: col.w - 2 });
            });
        };

        drawTableHeader(tblTop);
        let tY = tblTop + 22;

        doc.font('Helvetica').fontSize(8);
        records.forEach((record: any, i: number) => {
            if (tY > PH - 60) {
                doc.addPage();
                drawTableHeader(PM);
                tY = PM + 22;
                doc.font('Helvetica').fontSize(8);
            }

            if (i % 2 === 0) {
                doc.rect(PM, tY - 3, tblW, 16).fill('#f8fafc');
            }
            doc.fillColor('#0f172a');

            const payment = normalizePaymentData(record.payment_data || {});
            const banking = normalizeBankingData(record.banking_data || {}, record.record_date);
            const dateStr = record.record_date.split('T')[0];
            const rowNP = toNumber(record.net_profit);
            const rowUB = toNumber(record.unbanked_cash);

            doc.text(dateStr,                                         tblCols[0].x + 2, tY, { width: tblCols[0].w - 2 });
            doc.text(record.status || 'DRAFT',                        tblCols[1].x + 2, tY, { width: tblCols[1].w - 2 });
            doc.text(fmt(toNumber(record.total_revenue)),              tblCols[2].x, tY, { width: tblCols[2].w, align: 'right' });
            doc.text(fmt(toNumber(record.total_cogs)),                 tblCols[3].x, tY, { width: tblCols[3].w, align: 'right' });
            doc.text(fmt(toNumber(record.total_expenses)),             tblCols[4].x, tY, { width: tblCols[4].w, align: 'right' });
            if (rowNP < 0) doc.fillColor('#dc2626');
            doc.text(fmt(rowNP),                                      tblCols[5].x, tY, { width: tblCols[5].w, align: 'right' });
            doc.fillColor('#0f172a');
            doc.text(fmt(toNumber(payment.cash)),                     tblCols[6].x, tY, { width: tblCols[6].w, align: 'right' });
            doc.text(fmt(toNumber(payment.mpesa)),                    tblCols[7].x, tY, { width: tblCols[7].w, align: 'right' });
            doc.text(fmt(toNumber(banking.banked)),                   tblCols[8].x, tY, { width: tblCols[8].w, align: 'right' });
            if (rowUB > 0) doc.fillColor('#dc2626');
            doc.text(fmt(rowUB),                                      tblCols[9].x, tY, { width: tblCols[9].w, align: 'right' });
            doc.fillColor('#0f172a');
            tY += 16;
        });

        // Totals row
        doc.moveTo(PM, tY).lineTo(PM + tblW, tY).lineWidth(0.5).stroke('#334155');
        tY += 4;
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a');
        doc.text('MONTHLY TOTALS',             tblCols[0].x + 2, tY, { width: 110 });
        doc.text(fmt(totalRevenue),            tblCols[2].x, tY, { width: tblCols[2].w, align: 'right' });
        doc.text(fmt(totalCogs),               tblCols[3].x, tY, { width: tblCols[3].w, align: 'right' });
        doc.text(fmt(totalExpenses),           tblCols[4].x, tY, { width: tblCols[4].w, align: 'right' });
        if (totalProfit < 0) doc.fillColor('#dc2626');
        doc.text(fmt(totalProfit),             tblCols[5].x, tY, { width: tblCols[5].w, align: 'right' });
        doc.fillColor('#0f172a');
        doc.text(fmt(paymentTotals.cash  || 0), tblCols[6].x, tY, { width: tblCols[6].w, align: 'right' });
        doc.text(fmt(paymentTotals.mpesa || 0), tblCols[7].x, tY, { width: tblCols[7].w, align: 'right' });
        doc.text(fmt(totalBanked),             tblCols[8].x, tY, { width: tblCols[8].w, align: 'right' });
        doc.text(fmt(totalUnbanked),           tblCols[9].x, tY, { width: tblCols[9].w, align: 'right' });

        // ─── Footer on All Pages ──────────────────────────────────────────────
        const pageRange = doc.bufferedPageRange();
        for (let i = pageRange.start; i < pageRange.start + pageRange.count; i++) {
            doc.switchToPage(i);
            doc.moveTo(PM, PH - 38).lineTo(PW - PM, PH - 38).lineWidth(0.5).stroke('#e2e8f0');
            doc.fontSize(7).fillColor('#94a3b8').font('Helvetica')
               .text(
                   `Famous Gate Hotels · Financial Management System · Page ${i + 1} of ${pageRange.count} · ${new Date().toLocaleString('en-KE')}`,
                   PM, PH - 30, { align: 'center', width: PW - PM * 2 }
               );
        }

        doc.end();
    } catch (error) {
        logger.error('Error exporting monthly statement:', error);
        next(error);
    }
};
