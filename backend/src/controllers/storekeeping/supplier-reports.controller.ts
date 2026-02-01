import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

// @desc    Get supplier aging analysis
// @route   GET /api/procurement/reports/aging
// @access  Private (Auditor/Finance)
export const getAgingAnalysis = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { supplier_id } = req.query;

        let query = supabase
            .from('store_supplier_balances')
            .select(`
                *,
                supplier:store_suppliers(id, name, supplier_code)
            `)
            .order('current_balance', { ascending: false });

        if (supplier_id) query = query.eq('supplier_id', supplier_id);

        const { data: aging, error } = await query;

        if (error) throw error;

        res.status(200).json({
            success: true,
            count: aging?.length || 0,
            data: aging || []
        });
    } catch (error) {
        logger.error('Error fetching aging analysis:', error);
        next(new AppError('Failed to fetch aging analysis', 500));
    }
};

// @desc    Get VAT report (Input VAT)
// @route   GET /api/procurement/reports/vat
// @access  Private (Auditor/Finance)
export const getVATReport = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { from_date, to_date, supplier_id } = req.query;

        if (!from_date || !to_date) {
            throw new AppError('From date and to date are required', 400);
        }

        let query = supabase
            .from('store_supplier_invoices')
            .select(`
                invoice_number,
                invoice_date,
                supplier:store_suppliers(id, name, pin, vat_number),
                subtotal,
                vat_amount,
                withholding_vat_amount,
                total_amount,
                status
            `)
            .eq('status', 'approved')
            .gte('invoice_date', from_date)
            .lte('invoice_date', to_date);

        if (supplier_id) query = query.eq('supplier_id', supplier_id);

        const { data: report, error } = await query;

        if (error) throw error;

        // Calculate totals
        const summary = report?.reduce((acc: any, inv: any) => ({
            total_subtotal: acc.total_subtotal + Number(inv.subtotal),
            total_vat: acc.total_vat + Number(inv.vat_amount),
            total_withholding: acc.total_withholding + Number(inv.withholding_vat_amount),
            total_combined: acc.total_combined + Number(inv.total_amount)
        }), { total_subtotal: 0, total_vat: 0, total_withholding: 0, total_combined: 0 });

        res.status(200).json({
            success: true,
            summary,
            count: report?.length || 0,
            data: report || []
        });
    } catch (error) {
        logger.error('Error fetching VAT report:', error);
        next(new AppError('Failed to fetch VAT report', 500));
    }
};

// @desc    Get GRNI (Goods Received Not Invoiced) report
// @route   GET /api/procurement/reports/grni
// @access  Private (Auditor)
export const getGRNIReport = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { status } = req.query;

        let query = supabase
            .from('store_grni_control_account')
            .select(`
                *,
                supplier:store_suppliers(id, name, supplier_code),
                grn:store_grn(id, grn_number, grn_date)
            `)
            .order('created_at', { ascending: false });

        if (status) query = query.eq('status', status);
        else query = query.eq('status', 'open');

        const { data: grni, error } = await query;

        if (error) throw error;

        res.status(200).json({
            success: true,
            count: grni?.length || 0,
            data: grni || []
        });
    } catch (error) {
        logger.error('Error fetching GRNI report:', error);
        next(new AppError('Failed to fetch GRNI report', 500));
    }
};

// @desc    Get Audit Trail for Procurement
// @route   GET /api/procurement/reports/audit-trail
// @access  Private (Auditor)
export const getAuditTrail = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { entity_type, entity_id, from_date, to_date } = req.query;

        let query = supabase
            .from('store_procurement_audit_logs')
            .select('*')
            .order('action_timestamp', { ascending: false });

        if (entity_type) query = query.eq('entity_type', entity_type);
        if (entity_id) query = query.eq('entity_id', entity_id);
        if (from_date) query = query.gte('action_timestamp', from_date);
        if (to_date) query = query.lte('action_timestamp', to_date);

        const { data: logs, error } = await query;

        if (error) throw error;

        res.status(200).json({
            success: true,
            count: logs?.length || 0,
            data: logs || []
        });
    } catch (error) {
        logger.error('Error fetching audit trail:', error);
        next(new AppError('Failed to fetch audit trail', 500));
    }
};
