import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';
import * as BranchInventoryService from '../../services/branch-inventory.service';

/**
 * Stock Conversion Controller
 * Handles converting raw items to processed items (e.g. Flour -> Ugali)
 */

// @desc    Convert stock (Yield Control)
// @route   POST /api/store/conversions
// @access  Private (Storekeeper, Manager)
export const convertStock = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const branchId = (req as any).user?.branch_id;
        const userId = (req as any).user?.id;
        const { items, notes } = req.body; // items: [{ raw_sku, raw_quantity, produced_sku, produced_quantity }]

        if (!branchId) {
            res.status(400).json({ success: false, message: 'Branch ID is required' });
            return;
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            res.status(400).json({ success: false, message: 'Conversion items are required' });
            return;
        }

        const results = [];
        const errors = [];

        // Process conversions sequentially to ensure atomicity per item
        for (const item of items) {
            try {
                if (!item.raw_sku || !item.raw_quantity || !item.produced_sku || !item.produced_quantity) {
                    throw new Error('Missing required conversion fields (raw_sku, raw_quantity, produced_sku, produced_quantity)');
                }

                const result = await BranchInventoryService.recordConversion(
                    branchId,
                    userId,
                    item.raw_sku,
                    item.raw_quantity,
                    item.produced_sku,
                    item.produced_quantity,
                    notes
                );
                results.push(result);
            } catch (error: any) {
                logger.error(`Conversion failed for ${item.raw_sku} -> ${item.produced_sku}`, error);
                errors.push({ item, error: error.message });
            }
        }

        if (errors.length > 0 && results.length === 0) {
            // All failed
            res.status(400).json({ success: false, message: 'All conversions failed', errors });
            return;
        }

        res.status(200).json({
            success: true,
            message: `Processed ${results.length} conversions. ${errors.length} failed.`,
            data: { results, errors }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get available yield rules (reusing kitchen food controls)
// @route   GET /api/store/yield-rules
// @access  Private
export const getYieldRules = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const branchId = (req as any).user?.branch_id;

        let query = supabase
            .from('kitchen_food_controls')
            .select('*')
            .order('raw_item_name', { ascending: true });

        if (branchId) {
            // Optionally filter by branch, though rules might be global or copied
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};
