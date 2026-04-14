import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

const generateGRNNumber = async (): Promise<string> => {
    const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const prefix = `GRN${datePart}`;

    const { data: existingNumbers, error } = await supabase
        .from('store_grn')
        .select('grn_number')
        .like('grn_number', `${prefix}%`)
        .order('grn_number', { ascending: false })
        .limit(1);

    if (error) {
        logger.error('Error generating GRN number from store_grn:', error);
        throw new AppError('Failed to generate GRN number', 500);
    }

    const lastNumber = existingNumbers?.[0]?.grn_number;
    const lastSequence = lastNumber ? Number(lastNumber.slice(prefix.length)) || 0 : 0;

    return `${prefix}${String(lastSequence + 1).padStart(4, '0')}`;
};

// @desc    Get all Goods Received Notes
// @route   GET /api/storekeeping/grn
// @access  Private
export const getGRNs = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { supplier_id, status, from_date, to_date, po_id } = req.query;

        let query = supabase
            .from('store_grn')
            .select(`
                *,
                supplier:store_suppliers(id, name, supplier_code),
                purchase_order:store_purchase_orders(id, po_number)
            `)
            .order('grn_date', { ascending: false });

        if (supplier_id) query = query.eq('supplier_id', supplier_id);
        if (status) query = query.eq('status', status);
        if (po_id) query = query.eq('po_id', po_id);
        if (from_date) query = query.gte('grn_date', from_date);
        if (to_date) query = query.lte('grn_date', to_date);

        const { data: grns, error } = await query;

        if (error) throw error;

        res.status(200).json({
            success: true,
            count: grns?.length || 0,
            data: grns || []
        });
    } catch (error) {
        logger.error('Error fetching GRNs:', error);
        next(new AppError('Failed to fetch GRNs', 500));
    }
};

// @desc    Get single GRN
// @route   GET /api/storekeeping/grn/:id
// @access  Private
export const getGRN = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        const { data: grn, error } = await supabase
            .from('store_grn')
            .select(`
                *,
                supplier:store_suppliers(*),
                purchase_order:store_purchase_orders(*)
            `)
            .eq('id', id)
            .single();

        if (error) {
            logger.error('Supabase error fetching GRN header:', error);
            throw new AppError(`Database error: ${error.message}`, 500);
        }
        
        if (!grn) {
            throw new AppError('GRN not found', 404);
        }

        // Fetch GRN items separately
        const { data: items, error: itemsError } = await supabase
            .from('store_grn_items')
            .select('*')
            .eq('grn_id', id);

        if (itemsError) {
            logger.error('Supabase error fetching GRN items:', itemsError);
            throw new AppError(`Database error fetching items: ${itemsError.message}`, 500);
        }

        // Fetch item details from simple_items using the item_id as SKU
        const skus = items?.map(i => i.item_id) || [];
        let enrichedItems = items || [];

        if (skus.length > 0) {
            const { data: itemDetails, error: detailsError } = await supabase
                .from('simple_items')
                .select('sku, description, unit_of_measure, category')
                .in('sku', skus);

            if (detailsError) {
                logger.warn('Could not fetch simple_items for GRN:', detailsError.message);
            }

            // Map standard keys expected by the frontend
            enrichedItems = (items || []).map(item => {
                const detail = itemDetails?.find(d => d.sku === item.item_id);
                return {
                    ...item,
                    item: detail ? {
                        id: item.item_id,
                        name: detail.description || item.item_id,
                        item_code: detail.sku || item.item_id,
                        unit: detail.unit_of_measure || 'units',
                        category: detail.category || 'other'
                    } : null
                };
            });
        }

        res.status(200).json({
            success: true,
            data: {
                ...grn,
                items: enrichedItems
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new GRN
// @route   POST /api/storekeeping/grn
// @access  Private (Storekeeper)
export const createGRN = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            po_id,
            supplier_id,
            grn_date,
            delivery_note_number,
            invoice_number,
            vehicle_number,
            driver_name,
            driver_phone,
            items,
            remarks,
            attachments
        } = req.body;

        const userId = req.user?.id;

        if (!supplier_id || !items || items.length === 0) {
            throw new AppError('Supplier and items are required', 400);
        }

        const grn_number = await generateGRNNumber();

        // Calculate totals
        const total_items = items.length;
        const total_quantity = items.reduce((sum: number, item: any) => sum + Number(item.quantity_received), 0);
        const total_value = items.reduce((sum: number, item: any) => sum + (Number(item.quantity_received) * Number(item.unit_price)), 0);

        // Start transaction (manual handling via separate calls as Supabase JS doesn't support transactions directly)
        // Note: For production, using a PostgreSQL RPC for the whole transaction is safer.

        // 1. Create GRN header
        const { data: newGRN, error: grnError } = await supabase
            .from('store_grn')
            .insert({
                grn_number,
                po_id,
                supplier_id,
                grn_date: grn_date || new Date().toISOString().split('T')[0],
                delivery_note_number,
                invoice_number,
                vehicle_number,
                driver_name,
                driver_phone,
                total_items,
                total_quantity,
                total_value,
                received_by_id: userId,
                status: 'draft',
                remarks,
                attachments
            })
            .select()
            .single();

        if (grnError) throw grnError;

        // 2. Create GRN items
        const grnItems = items.map((item: any) => ({
            grn_id: newGRN.id,
            po_item_id: item.po_item_id,
            item_id: item.item_id,
            quantity_ordered: item.quantity_ordered,
            quantity_received: item.quantity_received,
            quantity_accepted: item.quantity_accepted || item.quantity_received,
            quantity_rejected: item.quantity_rejected || 0,
            quantity_damaged: item.quantity_damaged || 0,
            unit_price: item.unit_price,
            total_value: Number(item.quantity_received) * Number(item.unit_price),
            batch_number: item.batch_number,
            expiry_date: item.expiry_date,
            quality_status: item.quality_status || 'accepted',
            notes: item.notes
        }));

        const { error: itemsError } = await supabase
            .from('store_grn_items')
            .insert(grnItems);

        if (itemsError) {
            // Cleanup on error (manual rollback)
            await supabase.from('store_grn').delete().eq('id', newGRN.id);
            throw itemsError;
        }

        res.status(201).json({
            success: true,
            data: newGRN
        });
    } catch (error) {
        logger.error('Error creating GRN:', error);
        next(error);
    }
};

// @desc    Approve/Verify GRN
// @route   PUT /api/storekeeping/grn/:id/approve
// @access  Private (Auditor/Manager)
export const approveGRN = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        // Use the database function for approval to ensure atomic inventory and accounting updates
        const { data, error } = await supabase
            .rpc('approve_grn_and_update_all', {
                p_grn_id: id,
                p_approved_by: userId
            });

        if (error) {
            logger.error('Error approving GRN:', error);
            throw new AppError(error.message, 400);
        }

        res.status(200).json({
            success: true,
            message: 'GRN approved, inventory updated and GRNI entry created',
            data
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Cancel/Reject GRN
// @route   PUT /api/storekeeping/grn/:id/cancel
// @access  Private
export const cancelGRN = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const { data, error } = await supabase
            .from('store_grn')
            .update({
                status: 'rejected',
                remarks: reason ? `Rejected: ${reason}` : 'Rejected',
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({
            success: true,
            message: 'GRN rejected',
            data
        });
    } catch (error) {
        next(error);
    }
};
