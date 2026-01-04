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
        const { branch_id, status, from_date, to_date } = req.query;

        let query = supabase
            .from('purchase_orders')
            .select(`
        *,
        supplier:suppliers(id, name, code),
        receiving_branch:branches!receiving_branch_id(id, name, code),
        created_by_user:users!created_by(id, first_name, last_name),
        approved_by_user:users!approved_by(id, first_name, last_name),
        received_by_user:users!received_by(id, first_name, last_name),
        items:purchase_order_items(
          *,
          item:simple_items!item_sku(sku, item_name, description, unit)
        )
      `)
            .order('created_at', { ascending: false });

        // Apply filters
        if (branch_id) {
            query = query.eq('receiving_branch_id', branch_id);
        }
        if (status) {
            query = query.eq('status', status);
        }
        if (from_date) {
            query = query.gte('created_at', from_date);
        }
        if (to_date) {
            query = query.lte('created_at', to_date);
        }

        const { data: orders, error } = await query;

        if (error) throw error;

        // Map supplier_name for frontend compatibility if needed, though frontend should use supplier object
        const mappedOrders = orders?.map(order => ({
            ...order,
            supplier_name: order.supplier?.name
        }));

        res.status(200).json({
            success: true,
            count: mappedOrders?.length || 0,
            data: mappedOrders || []
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
            .from('purchase_orders')
            .select(`
        *,
        supplier:suppliers(id, name, code, contact_person, email, phone, address),
        receiving_branch:branches!receiving_branch_id(id, name, code, contact_person),
        created_by_user:users!created_by(id, first_name, last_name, email),
        approved_by_user:users!approved_by(id, first_name, last_name, email),
        received_by_user:users!received_by(id, first_name, last_name, email),
        items:purchase_order_items(
          *,
          item:simple_items!item_sku(sku, item_name, description, unit, category)
        )
      `)
            .eq('id', id)
            .single();

        if (error || !order) {
            throw new AppError('Purchase order not found', 404);
        }

        const mappedOrder = {
            ...order,
            supplier_name: order.supplier?.name
        };

        res.status(200).json({
            success: true,
            data: mappedOrder
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
            expected_delivery,
            order_notes,
            items
        } = req.body;

        const userId = req.user?.id;

        if (!supplier_id || !receiving_branch_id || !items || items.length === 0) {
            throw new AppError('Supplier, receiving branch, and items are required', 400);
        }

        // Generate PO number using database function
        const { data: poNumberData, error: numberError } = await supabase
            .rpc('get_next_po_number');

        if (numberError) {
            logger.error('Error generating PO number:', numberError);
            throw new AppError('Failed to generate PO number', 500);
        }

        const po_number = poNumberData;

        // Calculate totals
        const subtotal = items.reduce((sum: number, item: any) =>
            sum + (item.quantity * item.unit_price), 0); // Note: frontend sends quantity/unit_price
        const tax_amount = subtotal * 0.16; // 16% VAT
        const total_amount = subtotal + tax_amount;

        // Create purchase order
        const { data: newPO, error: poError } = await supabase
            .from('purchase_orders')
            .insert({
                po_number,
                supplier_id,
                receiving_branch_id,
                created_by: userId,
                expected_delivery,
                order_notes,
                subtotal,
                tax_amount,
                total_amount,
                status: 'PENDING' // Changed to PENDING to match frontend expectation
            })
            .select()
            .single();

        if (poError) throw poError;

        // Insert PO items
        const poItems = items.map((item: any) => ({
            po_id: newPO.id,
            item_sku: item.item_sku,
            ordered_quantity: item.quantity,
            unit_cost: item.unit_price,
            total_cost: item.quantity * item.unit_price,
            status: 'PENDING'
        }));

        const { error: itemsError } = await supabase
            .from('purchase_order_items')
            .insert(poItems);

        if (itemsError) throw itemsError;

        // Fetch complete PO with items
        const { data: completePO } = await supabase
            .from('purchase_orders')
            .select(`
        *,
        supplier:suppliers(id, name, code),
        receiving_branch:branches!receiving_branch_id(id, name, code),
        items:purchase_order_items(
          *,
          item:simple_items!item_sku(sku, item_name, description, unit)
        )
      `)
            .eq('id', newPO.id)
            .single();

        res.status(201).json({
            success: true,
            data: completePO
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
            .from('purchase_orders')
            .update({
                status: 'SENT',
                approved_by: userId,
                approved_at: new Date().toISOString(),
                sent_at: new Date().toISOString(),
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

// @desc    Receive purchase order and update stock
// @route   PUT /api/purchase-orders/:id/receive
// @access  Private
export const receivePurchaseOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { items_received, actual_delivery, delivery_notes } = req.body;
        const userId = req.user?.id;

        // Get PO details
        const { data: po, error: fetchError } = await supabase
            .from('purchase_orders')
            .select(`
        *,
        items:purchase_order_items(*)
      `)
            .eq('id', id)
            .single();

        if (fetchError || !po) {
            throw new AppError('Purchase order not found', 404);
        }

        // Update PO status
        await supabase
            .from('purchase_orders')
            .update({
                status: 'RECEIVED',
                received_by: userId,
                received_at: new Date().toISOString(),
                actual_delivery: actual_delivery || new Date().toISOString(),
                delivery_notes,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        // Update PO items with received quantities
        for (const receivedItem of items_received) {
            await supabase
                .from('purchase_order_items')
                .update({
                    received_quantity: receivedItem.received_quantity,
                    status: receivedItem.received_quantity >= receivedItem.ordered_quantity ? 'RECEIVED' : 'PARTIAL'
                })
                .eq('id', receivedItem.item_id);

            // Find original item
            const originalItem = po.items.find((i: any) => i.id === receivedItem.item_id);

            if (originalItem && receivedItem.received_quantity > 0) {
                // Add to branch stock
                await supabase.rpc('update_branch_stock', {
                    p_branch_id: po.receiving_branch_id,
                    p_item_sku: originalItem.item_sku,
                    p_quantity_change: receivedItem.received_quantity
                });

                // Log stock movement
                await supabase
                    .from('branch_stock_movements')
                    .insert({
                        branch_id: po.receiving_branch_id,
                        item_sku: originalItem.item_sku,
                        movement_type: 'PURCHASE',
                        quantity: receivedItem.received_quantity,
                        reference_type: 'PO',
                        reference_id: id,
                        reference_number: po.po_number,
                        performed_by: userId,
                        notes: `Received from PO ${po.po_number} - ${po.supplier_name}`
                    });
            }
        }

        // Check if all items received
        const allReceived = items_received.every((item: any) =>
            item.received_quantity >= item.ordered_quantity
        );

        if (allReceived) {
            await supabase
                .from('purchase_orders')
                .update({ status: 'COMPLETED' })
                .eq('id', id);
        }

        res.status(200).json({
            success: true,
            message: 'Purchase order received and stock updated'
        });
    } catch (error) {
        logger.error('Error receiving purchase order:', error);
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
            .from('purchase_orders')
            .update({
                status: 'CANCELLED',
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
        const { supplier_id, receiving_branch_id, expected_delivery, order_notes, items } = req.body;

        // Check if PO exists and is in PENDING status
        const { data: order, error: fetchError } = await supabase
            .from('purchase_orders')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !order) {
            throw new AppError('Purchase order not found', 404);
        }

        if (order.status !== 'PENDING') {
            throw new AppError('Only pending purchase orders can be updated', 400);
        }

        // Calculate totals
        const subtotal = items.reduce((sum: number, item: any) =>
            sum + (item.quantity * item.unit_price), 0);
        const tax_amount = subtotal * 0.16;
        const total_amount = subtotal + tax_amount;

        // Update PO
        const { data: updatedPO, error: updateError } = await supabase
            .from('purchase_orders')
            .update({
                supplier_id,
                receiving_branch_id,
                expected_delivery,
                order_notes,
                subtotal,
                tax_amount,
                total_amount,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Delete old items
        await supabase
            .from('purchase_order_items')
            .delete()
            .eq('po_id', id);

        // Insert new items
        const poItems = items.map((item: any) => ({
            po_id: id,
            item_sku: item.item_sku,
            ordered_quantity: item.quantity,
            unit_cost: item.unit_price,
            total_cost: item.quantity * item.unit_price,
            status: 'PENDING'
        }));

        const { error: itemsError } = await supabase
            .from('purchase_order_items')
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

        // Check if PO exists and is in PENDING status
        const { data: order, error: fetchError } = await supabase
            .from('purchase_orders')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !order) {
            throw new AppError('Purchase order not found', 404);
        }

        if (order.status !== 'PENDING') {
            throw new AppError('Only pending purchase orders can be deleted', 400);
        }

        // Delete items first
        await supabase
            .from('purchase_order_items')
            .delete()
            .eq('po_id', id);

        // Delete PO
        const { error: deleteError } = await supabase
            .from('purchase_orders')
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
