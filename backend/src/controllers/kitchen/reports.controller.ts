import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';

/**
 * Get Kitchen Yield Report
 * raw -> expected -> sold -> variance
 */
export const getYieldReport = async (req: Request, res: Response) => {
    try {
        const { branch_id, start_date, end_date } = req.query;

        // This report joins portion stock, ledger and sales
        const { data, error } = await supabase
            .from('kitchen_portion_ledger')
            .select(`
                item_sku,
                portion_name,
                transaction_type,
                quantity_in,
                quantity_out,
                transaction_date
            `)
            .eq('branch_id', branch_id)
            .gte('transaction_date', start_date)
            .lte('transaction_date', end_date);

        if (error) throw error;

        // Process data into summary
        const summary: any = {};
        data?.forEach(entry => {
            const key = `${entry.item_sku}-${entry.portion_name}`;
            if (!summary[key]) {
                summary[key] = {
                    sku: entry.item_sku,
                    name: entry.portion_name,
                    expected: 0,
                    sold: 0,
                    variance: 0
                };
            }
            if (entry.transaction_type === 'ISSUE') summary[key].expected += Number(entry.quantity_in);
            if (entry.transaction_type === 'POS_SALE') summary[key].sold += Number(entry.quantity_out);
        });

        res.json({ success: true, data: Object.values(summary) });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get Loss Value Report (KES)
 */
export const getLossReport = async (req: Request, res: Response) => {
    try {
        const { branch_id, start_date, end_date } = req.query;
        const { data, error } = await supabase
            .from('kitchen_daily_variance')
            .select('*, reason:kitchen_variance_reasons(reason)')
            .eq('branch_id', branch_id)
            .gte('variance_date', start_date)
            .lte('variance_date', end_date)
            .neq('variance', 0);

        if (error) throw error;

        const totalLoss = data?.reduce((sum, v) => sum + Math.abs(Number(v.cost_value || 0)), 0);

        res.json({ success: true, data, totalLoss });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get Staff Accountability Report (chef, cashier, shift)
 */
export const getAccountabilityReport = async (req: Request, res: Response) => {
    try {
        const { branch_id, start_date, end_date } = req.query;
        const { data, error } = await supabase
            .from('kitchen_daily_variance')
            .select('*, reason:kitchen_variance_reasons(reason), approved_by_user:users!approved_by(full_name)')
            .eq('branch_id', branch_id)
            .gte('variance_date', start_date)
            .lte('variance_date', end_date);

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
