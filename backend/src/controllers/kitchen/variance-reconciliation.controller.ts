import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { applyBranchFilter } from '../../utils/branchIsolation';

// NOTE: Most tables don't exist in new database (kitchen_daily_variance, kitchen_portion_stock, kitchen_portion_ledger)
// Only kitchen_variance_reasons exists

/**
 * Get all variance reasons
 * GET /api/kitchen/variance-reasons
 */
export const getVarianceReasons = async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('kitchen_variance_reasons')
            .select('*')
            .eq('is_active', true)
            .order('reason');

        if (error) throw error;

        res.json({ success: true, data: data || [] });
    } catch (error: any) {
        console.error('Error fetching variance reasons:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get daily variance records
 * GET /api/kitchen/variance
 */
export const getDailyVariance = async (req: Request, res: Response) => {
    try {
        // Table kitchen_daily_variance doesn't exist in new DB
        res.json({ 
            success: true, 
            data: [],
            message: 'Daily variance feature not available - table does not exist in new database'
        });
    } catch (error: any) {
        console.error('Error fetching daily variance:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Submit reason for variance
 * POST /api/kitchen/variance/:id/reason
 */
export const submitVarianceReason = async (req: Request, res: Response) => {
    try {
        // Table kitchen_daily_variance doesn't exist in new DB
        res.status(501).json({ 
            success: false, 
            message: 'Daily variance feature not available - table does not exist in new database'
        });
    } catch (error: any) {
        console.error('Error submitting variance reason:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Approve variance
 * POST /api/kitchen/variance/:id/approve
 */
export const approveVariance = async (req: Request, res: Response) => {
    try {
        // Table kitchen_daily_variance doesn't exist in new DB
        res.status(501).json({ 
            success: false, 
            message: 'Daily variance feature not available - table does not exist in new database'
        });
    } catch (error: any) {
        console.error('Error approving variance:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get Kitchen Portion Stock
 * GET /api/kitchen/portion-stock
 */
export const getPortionStock = async (req: Request, res: Response) => {
    try {
        // Table kitchen_portion_stock doesn't exist in new DB
        res.json({ 
            success: true, 
            data: [],
            message: 'Portion stock feature not available - table does not exist in new database'
        });
    } catch (error: any) {
        console.error('Error fetching portion stock:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get Portion Ledger
 * GET /api/kitchen/portion-ledger
 */
export const getPortionLedger = async (req: Request, res: Response) => {
    try {
        // Table kitchen_portion_ledger doesn't exist in new DB
        res.json({ 
            success: true, 
            data: [],
            message: 'Portion ledger feature not available - table does not exist in new database'
        });
    } catch (error: any) {
        console.error('Error fetching portion ledger:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
