import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import { applyBranchFilter } from '../utils/branchIsolation';

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

        const record = {
            branch_id,
            record_date,
            status: status || 'DRAFT',
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
            total_monthly_expenses,
            monthly_profit,
            cash_flow_data,
            balance_sheet_data
        } = req.body;

        if (!branch_id || !fiscal_year || !fiscal_month) {
            res.status(400).json({ success: false, error: 'Branch ID, Fiscal Year, and Fiscal Month are required' });
            return;
        }

        const adjustment = {
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
            total_monthly_expenses,
            monthly_profit,
            cash_flow_data,
            balance_sheet_data,
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
