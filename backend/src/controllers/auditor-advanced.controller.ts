import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

// ============================================================
// CONSUMPTION CONFIGURATION (MAPPING)
// ============================================================

/**
 * Get all consumption mappings (Menu Item -> Inventory SKU)
 */
export const getConsumptionConfigs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { data, error } = await supabase
            .from('audit_config_consumption')
            .select(`
                *,
                menu_item:restaurant_menu_items(id, name),
                inventory_item:simple_items!inner(sku, item_name)
            `);

        if (error) throw error;

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * Create or Update a consumption mapping
 */
export const updateConsumptionConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { menu_item_id, inventory_item_sku, quantity, branch_id } = req.body;

        const { data, error } = await supabase
            .from('audit_config_consumption')
            .upsert({
                menu_item_id,
                inventory_item_sku,
                quantity,
                branch_id,
                updated_at: new Date().toISOString()
            }, { onConflict: 'menu_item_id,inventory_item_sku,branch_id' })
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

// ============================================================
// THEORETICAL CONSUMPTION LOGIC
// ============================================================

/**
 * Calculate theoretical vs actual consumption for a period
 */
export const getConsumptionVariances = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, from_date, to_date } = req.query;

        if (!branch_id || !from_date || !to_date) {
            res.status(400).json({ success: false, message: 'branch_id, from_date, and to_date are required' });
            return;
        }

        // 1. Get all menu item sales for the period at this branch
        const { data: sales, error: salesError } = await supabase
            .from('restaurant_order_items')
            .select(`
                menu_item_id,
                quantity,
                orders!inner(branch_id, created_at, status)
            `)
            .eq('orders.branch_id', branch_id)
            .eq('orders.status', 'completed')
            .gte('orders.created_at', from_date)
            .lte('orders.created_at', to_date);

        if (salesError) throw salesError;

        // 2. Get consumption mapping
        const { data: mappings, error: mappingError } = await supabase
            .from('audit_config_consumption')
            .select('*');

        if (mappingError) throw mappingError;

        // 3. Aggregate mapping
        const theoretical: Record<string, number> = {};
        sales?.forEach(sale => {
            const itemMappings = mappings?.filter(m => m.menu_item_id === sale.menu_item_id);
            itemMappings?.forEach(m => {
                const totalConsumed = m.quantity * sale.quantity;
                theoretical[m.inventory_item_sku] = (theoretical[m.inventory_item_sku] || 0) + totalConsumed;
            });
        });

        // 4. Get actual stock movements for the same period (STOCK_OUT only)
        const { data: movements, error: movementError } = await supabase
            .from('branch_stock_movements')
            .select('*')
            .eq('branch_id', branch_id)
            .eq('movement_type', 'STOCK_OUT')
            .gte('created_at', from_date)
            .lte('created_at', to_date);

        if (movementError) throw movementError;

        const actual: Record<string, number> = {};
        movements?.forEach(m => {
            actual[m.item_sku] = (actual[m.item_sku] || 0) + m.quantity;
        });

        // 5. Build response
        const result = Object.keys(theoretical).map(sku => ({
            item_sku: sku,
            theoretical: theoretical[sku],
            actual: actual[sku] || 0,
            variance: (actual[sku] || 0) - theoretical[sku]
        }));

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

// ============================================================
// AUDITOR APPROVALS
// ============================================================

/**
 * Submit an approval for a transaction/process
 */
export const submitApproval = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { entity_type, entity_id, status, comments } = req.body;
        const auditor_id = req.user?.id;

        const { data, error } = await supabase
            .from('audit_approvals')
            .insert({
                entity_type,
                entity_id,
                auditor_id,
                status,
                comments,
                performed_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        // If it's a stock request, update its status
        if (entity_type === 'STOCK_REQUEST' && status === 'APPROVED') {
            await supabase.from('stock_requests').update({ status: 'AUDITED_APPROVED' }).eq('id', entity_id);
        }

        res.status(201).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * Get approval history
 */
export const getApprovalHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { entity_type, entity_id } = req.query;

        let query = supabase.from('audit_approvals').select('*, auditor:users(first_name, last_name)');

        if (entity_type) query = query.eq('entity_type', entity_type);
        if (entity_id) query = query.eq('entity_id', entity_id);

        const { data, error } = await query.order('performed_at', { ascending: false });

        if (error) throw error;

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};
