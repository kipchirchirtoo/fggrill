import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { updateBranchStock } from '../../services/branch-inventory.service';

/**
 * @desc    Receive goods directly from a branch-specific supplier
 * @route   POST /api/store/branch/receive-supplier
 * @access  Private (Branch Storekeeper)
 */
export const receiveFromSupplier = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            supplier_id,
            items,
            delivery_note_number,
            invoice_number,
            remarks
        } = req.body;

        const userId = req.user?.id;
        const branchId = req.user?.branch_id || req.user?.branchId;

        if (!branchId) {
            throw new AppError('Branch identification failed. Only branch staff can receive direct goods.', 403);
        }

        if (!supplier_id || !items || !Array.isArray(items) || items.length === 0) {
            throw new AppError('Supplier and items are required', 400);
        }

        // 1. Verify the supplier belongs to this branch (or is global)
        const { data: supplier, error: supplierError } = await supabase
            .from('suppliers')
            .select('id, name, branch_id')
            .eq('id', supplier_id)
            .single();

        if (supplierError || !supplier) {
            throw new AppError('Supplier not found or inaccessible', 404);
        }

        if (supplier.branch_id && supplier.branch_id !== branchId) {
            throw new AppError('You do not have permission to receive from this supplier', 403);
        }

        // 2. Process items and update stock
        const results = [];
        const receivedAt = new Date().toISOString();

        for (const item of items) {
            const { item_sku, quantity, unit_price, batch_number, expiry_date } = item;

            if (!item_sku || quantity <= 0) {
                logger.warn(`Skipping invalid item in branch receipt: ${item_sku}`);
                continue;
            }

            // Update branch stock and log movement
            const stockUpdate = await updateBranchStock(
                branchId,
                item_sku,
                quantity,
                'SUPPLIER_RECEIPT',
                userId,
                'SUPPLIER_DN', // Reference Type
                delivery_note_number || 'N/A', // Reference ID/Number placeholder
                delivery_note_number,
                `Direct receipt from ${supplier.name}. ${remarks || ''}`
            );

            results.push({
                item_sku,
                quantity,
                previous_stock: stockUpdate.previousStock,
                new_stock: stockUpdate.newStock
            });
        }

        logger.info(`Branch ${branchId} received ${items.length} items from supplier ${supplier.name}`);

        res.status(200).json({
            success: true,
            message: `Successfully received ${results.length} items from ${supplier.name}`,
            data: {
                supplier_name: supplier.name,
                received_at: receivedAt,
                items_processed: results
            }
        });

    } catch (error) {
        logger.error('Error in direct branch receipt:', error);
        next(error);
    }
};
