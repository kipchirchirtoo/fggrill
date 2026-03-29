import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { applyBranchFilter, isGlobalRole } from '../../utils/branchIsolation';

/**
 * Get current kitchen stock for a branch
 * GET /api/kitchen/stock
 */
export const getKitchenStock = async (req: Request, res: Response) => {
    try {
        const { branch_id, low_stock } = req.query;
        
        let query = supabase
            .from('kitchen_stock')
            .select('*')
            .order('item_name');

        query = applyBranchFilter(query, req);

        if (branch_id) {
            query = query.eq('branch_id', branch_id);
        }

        if (low_stock === 'true') {
            query = query.filter('current_balance', 'lte', 'reorder_level');
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching kitchen stock:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get kitchen stock ledger entries
 * GET /api/kitchen/stock/ledger
 */
export const getKitchenLedger = async (req: Request, res: Response) => {
    try {
        const { branch_id, item_sku, start_date, end_date, transaction_type, limit = 100 } = req.query;

        let query = supabase
            .from('kitchen_stock_ledger')
            .select('*')
            .order('transaction_date', { ascending: false })
            .limit(Number(limit));

        query = applyBranchFilter(query, req);

        if (branch_id) {
            query = query.eq('branch_id', branch_id);
        }

        if (item_sku) {
            query = query.eq('item_sku', item_sku);
        }

        if (transaction_type) {
            query = query.eq('transaction_type', transaction_type);
        }

        if (start_date) {
            query = query.gte('transaction_date', start_date);
        }

        if (end_date) {
            query = query.lte('transaction_date', end_date);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching kitchen ledger:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get stock history for a specific item
 * GET /api/kitchen/stock/:sku/history
 */
export const getItemHistory = async (req: Request, res: Response) => {
    try {
        const { sku } = req.params;
        const { branch_id } = req.query;

        let query = supabase
            .from('kitchen_stock_ledger')
            .select('*')
            .eq('item_sku', sku)
            .order('transaction_date', { ascending: false })
            .limit(50);

        query = applyBranchFilter(query, req);

        if (branch_id) {
            query = query.eq('branch_id', branch_id);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching item history:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Create ledger entry (internal helper)
 */
async function createLedgerEntry(params: {
    branch_id: number;
    item_sku: string;
    item_name: string;
    transaction_type: string;
    reference_type?: string;
    reference_id?: string;
    quantity_in?: number;
    quantity_out?: number;
    unit_of_measure: string;
    shift?: string;
    user_id?: string;
    notes?: string;
}) {
    const {
        branch_id,
        item_sku,
        item_name,
        transaction_type,
        reference_type,
        reference_id,
        quantity_in = 0,
        quantity_out = 0,
        unit_of_measure,
        shift,
        user_id,
        notes
    } = params;

    // Get current balance
    const { data: currentStock } = await supabase
        .from('kitchen_stock')
        .select('current_balance')
        .eq('branch_id', branch_id)
        .eq('item_sku', item_sku)
        .single();

    const opening_balance = currentStock?.current_balance || 0;
    const closing_balance = opening_balance + quantity_in - quantity_out;

    // Insert ledger entry
    const { data, error } = await supabase
        .from('kitchen_stock_ledger')
        .insert({
            branch_id,
            item_sku,
            item_name,
            transaction_type,
            reference_type,
            reference_id,
            opening_balance,
            quantity_in,
            quantity_out,
            closing_balance,
            unit_of_measure,
            shift,
            user_id,
            notes
        })
        .select()
        .single();

    if (error) throw error;

    return data;
}

/**
 * Get kitchen dashboard stats
 * GET /api/kitchen/dashboard/stats
 */
export const getKitchenDashboardStats = async (req: Request, res: Response) => {
    try {
        const { branch_id } = req.query;
        const userBranchId = (req as any).user?.branch_id;
        const isGlobal = isGlobalRole((req as any).user?.role);
        const effectiveBranchId = isGlobal && branch_id ? branch_id : userBranchId;

        if (!effectiveBranchId) {
            return res.status(400).json({ success: false, message: 'Branch ID is required' });
        }

        const today = new Date().toISOString().split('T')[0];

        // Get today's receipts
        const { data: receipts } = await supabase
            .from('kitchen_grn')
            .select('*, kitchen_grn_items(*)')
            .eq('branch_id', effectiveBranchId)
            .gte('received_at', today);

        // Get today's usage
        const { data: usage } = await supabase
            .from('kitchen_usage')
            .select('*')
            .eq('branch_id', effectiveBranchId)
            .eq('usage_date', today);

        // Get today's wastage
        const { data: wastage } = await supabase
            .from('kitchen_wastage')
            .select('*')
            .eq('branch_id', effectiveBranchId)
            .eq('wastage_date', today);

        // Get low stock items
        const { data: lowStock } = await supabase
            .from('kitchen_stock')
            .select('*')
            .eq('branch_id', effectiveBranchId)
            .filter('current_balance', 'lte', 'reorder_level');

        const stats = {
            receiptsToday: receipts?.length || 0,
            usageToday: usage?.reduce((sum, u) => sum + Number(u.quantity), 0) || 0,
            wastageToday: wastage?.reduce((sum, w) => sum + Number(w.quantity), 0) || 0,
            wastageValue: wastage?.reduce((sum, w) => sum + Number(w.estimated_value || 0), 0) || 0,
            lowStockCount: lowStock?.length || 0
        };

        res.json({ success: true, data: stats });
    } catch (error: any) {
        console.error('Error fetching kitchen stats:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Create portion ledger entry (internal helper)
 */
export async function createPortionLedgerEntry(params: {
    branch_id: number;
    item_sku: string;
    portion_name: string;
    transaction_type: string;
    reference_type?: string;
    reference_id?: string;
    quantity_in?: number;
    quantity_out?: number;
    user_id?: string;
    notes?: string;
}) {
    const {
        branch_id,
        item_sku,
        portion_name,
        transaction_type,
        reference_type,
        reference_id,
        quantity_in = 0,
        quantity_out = 0,
        user_id,
        notes
    } = params;

    // Get current portion balance
    const { data: currentPortion } = await supabase
        .from('kitchen_portion_stock')
        .select('expected_balance')
        .eq('branch_id', branch_id)
        .eq('item_sku', item_sku)
        .single();

    const opening_balance = currentPortion?.expected_balance || 0;
    const closing_balance = Number(opening_balance) + Number(quantity_in) - Number(quantity_out);

    // Insert portion ledger entry
    const { data, error } = await supabase
        .from('kitchen_portion_ledger')
        .insert({
            branch_id,
            item_sku,
            portion_name,
            transaction_type,
            reference_type,
            reference_id,
            opening_balance,
            quantity_in,
            quantity_out,
            closing_balance,
            user_id,
            notes
        })
        .select()
        .single();

    if (error) throw error;

    return data;
}

export { createLedgerEntry };
