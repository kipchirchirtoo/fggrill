import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

// @desc    Get all purchase orders
// @route   GET /api/purchase-orders
// @access  Private
export const getPurchaseOrders = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, status, from_date, to_date, supplier_id } = req.query;

        let query = supabase
            .from('store_purchase_orders')
            .select(`
        *,
        supplier:store_suppliers(id, name, supplier_code),
        created_by_user:users!created_by_id(id, first_name, last_name),
        approved_by_user:users!approved_by_id(id, first_name, last_name),
        received_by_user:users!received_by_id(id, first_name, last_name),
        items:store_po_items(
          *,
          item:store_items(id, name, item_code, unit)
        )
      `)
            .order('created_at', { ascending: false });

        // Apply filters
        /*
        if (branch_id) {
            query = query.eq('receiving_branch_id', branch_id);
        }
        */
        if (supplier_id) {
            query = query.eq('supplier_id', supplier_id);
        }
        if (status) {
            query = query.eq('status', status);
        }
        if (from_date) {
            query = query.gte('po_date', from_date);
        }
        if (to_date) {
            query = query.lte('po_date', to_date);
        }

        const { data: orders, error } = await query;

        if (error) throw error;

        res.status(200).json({
            success: true,
            count: orders?.length || 0,
            data: orders || []
        });
    } catch (error) {
        logger.error('Error fetching purchase orders:', error);
        next(new AppError('Failed to fetch purchase orders', 500));
    }
};

// @desc    Get single purchase order
// @route   GET /api/purchase-orders/:id
// @access  Private
export const getPurchaseOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        const { data: order, error } = await supabase
            .from('store_purchase_orders')
            .select(`
        *,
        supplier:store_suppliers(*),
        receiving_branch:branches!receiving_branch_id(id, name, code, contact_person),
        created_by_user:users!created_by_id(id, first_name, last_name, email),
        approved_by_user:users!approved_by_id(id, first_name, last_name, email),
        received_by_user:users!received_by_id(id, first_name, last_name, email),
        items:store_po_items(
          *,
          item:store_items(id, name, item_code, unit, category)
        )
      `)
            .eq('id', id)
            .single();

        if (error || !order) {
            throw new AppError('Purchase order not found', 404);
        }

        res.status(200).json({
            success: true,
            data: order
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new purchase order
// @route   POST /api/purchase-orders
// @access  Private (Central Ops)
export const createPurchaseOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            supplier_id,
            receiving_branch_id,
            po_date,
            expected_delivery_date,
            special_instructions,
            items,
            payment_terms,
            delivery_terms
        } = req.body;

        const userId = req.user?.id;

        if (!supplier_id || !receiving_branch_id || !items || items.length === 0) {
            throw new AppError('Supplier, receiving branch, and items are required', 400);
        }

        // Generate PO number using database function
        const { data: po_number, error: numberError } = await supabase
            .rpc('generate_po_number');

        if (numberError) {
            logger.error('Error generating PO number:', numberError);
            throw new AppError('Failed to generate PO number', 500);
        }

        // Calculate totals
        const subtotal = items.reduce((sum: number, item: any) =>
            sum + (item.quantity * item.unit_price), 0);
        const tax_amount = subtotal * 0.16; // 16% VAT
        const total_amount = subtotal + tax_amount;

        // Create purchase order
        const { data: newPO, error: poError } = await supabase
            .from('store_purchase_orders')
            .insert({
                po_number,
                supplier_id,
                receiving_branch_id,
                created_by_id: userId,
                po_date: po_date || new Date().toISOString().split('T')[0],
                expected_delivery_date,
                special_instructions,
                subtotal,
                tax_amount,
                total_amount,
                status: 'draft',
                payment_terms,
                delivery_terms
            })
            .select()
            .single();

        if (poError) throw poError;

        // Insert PO items
        const poItems = items.map((item: any) => ({
            po_id: newPO.id,
            item_id: item.item_id,
            quantity_ordered: item.quantity,
            quantity_pending: item.quantity,
            unit_price: item.unit_price,
            total_price: item.quantity * item.unit_price,
            tax_amount: (item.quantity * item.unit_price) * 0.16
        }));

        const { error: itemsError } = await supabase
            .from('store_po_items')
            .insert(poItems);

        if (itemsError) throw itemsError;

        res.status(201).json({
            success: true,
            data: newPO
        });
    } catch (error) {
        logger.error('Error creating purchase order:', error);
        next(error);
    }
};

// @desc    Approve purchase order
// @route   PUT /api/purchase-orders/:id/approve
// @access  Private (Manager)
export const approvePurchaseOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        const { data: order, error } = await supabase
            .from('store_purchase_orders')
            .update({
                status: 'approved',
                approved_by_id: userId,
                approved_at: new Date().toISOString(),
                sent_to_supplier: true,
                sent_at: new Date().toISOString(),
                sent_by_id: userId,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({
            success: true,
            message: 'Purchase order approved and sent',
            data: order
        });
    } catch (error) {
        logger.error('Error approving purchase order:', error);
        next(error);
    }
};

// @desc    Receive purchase order (Legacy - replaced by GRN)
// @route   PUT /api/purchase-orders/:id/receive
// @access  Private
export const receivePurchaseOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // This endpoint will eventually be deprecated in favor of GRN controller
        // For now, it will redirect to or simulate GRN creation if needed, 
        // but it's better to keep it simple or throw an error to use the new GRN workflow.
        throw new AppError('Please use the GRN (Goods Received Note) workflow for receiving goods', 400);
    } catch (error) {
        next(error);
    }
};

// @desc    Cancel purchase order
// @route   PUT /api/purchase-orders/:id/cancel
// @access  Private
export const cancelPurchaseOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        const { data: order, error } = await supabase
            .from('store_purchase_orders')
            .update({
                status: 'cancelled',
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({
            success: true,
            message: 'Purchase order cancelled',
            data: order
        });
    } catch (error) {
        logger.error('Error cancelling purchase order:', error);
        next(error);
    }
};

// @desc    Update purchase order
// @route   PUT /api/purchase-orders/:id
// @access  Private
export const updatePurchaseOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const {
            supplier_id,
            receiving_branch_id,
            po_date,
            expected_delivery_date,
            special_instructions,
            items,
            payment_terms,
            delivery_terms
        } = req.body;

        // Check if PO exists and is in draft/pending status
        const { data: order, error: fetchError } = await supabase
            .from('store_purchase_orders')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !order) {
            throw new AppError('Purchase order not found', 404);
        }

        if (order.status !== 'draft' && order.status !== 'pending_approval') {
            throw new AppError('Only draft or pending purchase orders can be updated', 400);
        }

        // Calculate totals
        const subtotal = items.reduce((sum: number, item: any) =>
            sum + (item.quantity * item.unit_price), 0);
        const tax_amount = subtotal * 0.16;
        const total_amount = subtotal + tax_amount;

        // Update PO
        const { data: updatedPO, error: updateError } = await supabase
            .from('store_purchase_orders')
            .update({
                supplier_id,
                receiving_branch_id,
                po_date,
                expected_delivery_date,
                special_instructions,
                subtotal,
                tax_amount,
                total_amount,
                payment_terms,
                delivery_terms,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Delete old items
        await supabase
            .from('store_po_items')
            .delete()
            .eq('po_id', id);

        // Insert new items
        const poItems = items.map((item: any) => ({
            po_id: id,
            item_id: item.item_id,
            quantity_ordered: item.quantity,
            quantity_pending: item.quantity,
            unit_price: item.unit_price,
            total_price: item.quantity * item.unit_price,
            tax_amount: (item.quantity * item.unit_price) * 0.16
        }));

        const { error: itemsError } = await supabase
            .from('store_po_items')
            .insert(poItems);

        if (itemsError) throw itemsError;

        res.status(200).json({
            success: true,
            message: 'Purchase order updated successfully',
            data: updatedPO
        });
    } catch (error) {
        logger.error('Error updating purchase order:', error);
        next(error);
    }
};

// @desc    Delete purchase order
// @route   DELETE /api/purchase-orders/:id
// @access  Private
export const deletePurchaseOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        // Check if PO exists and is in draft status
        const { data: order, error: fetchError } = await supabase
            .from('store_purchase_orders')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !order) {
            throw new AppError('Purchase order not found', 404);
        }

        if (order.status !== 'draft') {
            throw new AppError('Only draft purchase orders can be deleted', 400);
        }

        // Delete items first
        await supabase
            .from('store_po_items')
            .delete()
            .eq('po_id', id);

        // Delete PO
        const { error: deleteError } = await supabase
            .from('store_purchase_orders')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        res.status(200).json({
            success: true,
            message: 'Purchase order deleted successfully'
        });
    } catch (error) {
        logger.error('Error deleting purchase order:', error);
        next(error);
    }
};
