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

        // Flatten labels for frontend
        const flattenedOrders = (orders || []).map(order => ({
            ...order,
            supplier_name: order.supplier?.name || 'N/A'
        }));

        res.status(200).json({
            success: true,
            count: flattenedOrders.length,
            data: flattenedOrders
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

        // Flatten data for frontend
        const flattenedOrder = {
            ...order,
            supplier_name: order.supplier?.name || 'N/A',
            receiving_branch_name: 'Central Stores', // Fallback as column is missing
            items: (order.items || []).map((item: any) => ({
                ...item,
                item_name: item.item?.name || 'Unknown Item'
            }))
        };

        res.status(200).json({
            success: true,
            data: flattenedOrder
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
            po_date,
            expected_delivery_date,
            special_instructions,
            items,
            payment_terms,
            delivery_terms
        } = req.body;

        const userId = req.user?.id;

        // Enhanced validation and logging
        console.log('=== CREATE PURCHASE ORDER DEBUG ===');
        console.log('User ID:', userId);
        console.log('Supplier ID:', supplier_id, 'Type:', typeof supplier_id);
        console.log('Items count:', items?.length);
        console.log('Items:', JSON.stringify(items, null, 2));

        if (!supplier_id || !items || items.length === 0) {
            throw new AppError('Supplier and items are required', 400);
        }

        // Validate UUID format for supplier_id
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(supplier_id)) {
            throw new AppError('Invalid supplier ID format', 400);
        }

        // Handle item IDs - could be UUID or SKU
        const resolvedItems = [...items];
        const skusToResolve = items
            .filter((item: any) => !uuidRegex.test(item.item_id))
            .map((item: any) => item.item_id);

        if (skusToResolve.length > 0) {
            console.log('Resolving SKUs to UUIDs:', skusToResolve);
            // Try to resolve from store_items using both sku and item_code fields
            const { data: storeItems, error: resolveError } = await supabase
                .from('store_items')
                .select('id, item_code, sku')
                .or(`item_code.in.(${skusToResolve.join(',')}),sku.in.(${skusToResolve.join(',')})`);

            if (resolveError) {
                console.error('Error resolving SKUs:', resolveError);
                throw new AppError('Error resolving item identifiers', 500);
            }

            // Build map using both item_code and sku as keys
            const skuToIdMap = (storeItems || []).reduce((acc: any, item: any) => {
                if (item.item_code) acc[item.item_code] = item.id;
                if (item.sku) acc[item.sku] = item.id;
                return acc;
            }, {});

            console.log('SKU to ID map:', skuToIdMap);

            for (const item of resolvedItems) {
                if (!uuidRegex.test(item.item_id)) {
                    const resolvedId = skuToIdMap[item.item_id];
                    if (!resolvedId) {
                        throw new AppError(`Item not found with SKU: ${item.item_id}`, 400);
                    }
                    item.item_id = resolvedId;
                }
            }
        }

        // Final validation to ensure all item_ids are now UUIDs
        for (const item of resolvedItems) {
            if (!uuidRegex.test(item.item_id)) {
                throw new AppError(`Invalid item ID format after resolution: ${item.item_id}`, 400);
            }
        }

        // Generate PO number using database function
        const { data: po_number, error: numberError } = await supabase
            .rpc('generate_po_number');

        if (numberError) {
            logger.error('Error generating PO number:', numberError);
            console.error('PO Number generation error:', JSON.stringify(numberError, null, 2));
            throw new AppError('Failed to generate PO number', 500);
        }

        console.log('Generated PO number:', po_number);

        // Calculate totals based on item-level VAT rates
        const subtotal = resolvedItems.reduce((sum: number, item: any) =>
            sum + (item.quantity * item.unit_price), 0);
        const tax_amount = resolvedItems.reduce((sum: number, item: any) =>
            sum + (item.quantity * item.unit_price * ((item.vat_rate || 0) / 100)), 0);
        const total_amount = subtotal + tax_amount;

        console.log('Calculated totals - Subtotal:', subtotal, 'Tax:', tax_amount, 'Total:', total_amount);

        // Prepare PO data
        const poData = {
            po_number,
            supplier_id,
            created_by_id: userId || null, // Allow null if user ID is not available
            po_date: po_date || new Date().toISOString().split('T')[0],
            expected_delivery_date: expected_delivery_date || null,
            special_instructions: special_instructions || null,
            subtotal,
            tax_amount,
            total_amount,
            status: 'draft',
            payment_terms: payment_terms || 'credit_30_days',
            delivery_terms: delivery_terms || null
        };

        console.log('PO Data to insert:', JSON.stringify(poData, null, 2));

        // Create purchase order
        const { data: newPO, error: poError } = await supabase
            .from('store_purchase_orders')
            .insert(poData)
            .select()
            .single();

        if (poError) {
            console.error('PO Insert error:', JSON.stringify(poError, null, 2));
            throw poError;
        }

        console.log('PO created successfully:', newPO.id);

        // Insert PO items with item-level VAT
        const poItems = resolvedItems.map((item: any) => ({
            po_id: newPO.id,
            item_id: item.item_id,
            quantity_ordered: item.quantity,
            quantity_pending: item.quantity,
            unit_price: item.unit_price,
            total_price: item.quantity * item.unit_price * (1 + (item.vat_rate || 0) / 100),
            tax_amount: (item.quantity * item.unit_price) * ((item.vat_rate || 0) / 100)
        }));

        console.log('PO Items to insert:', JSON.stringify(poItems, null, 2));

        const { error: itemsError } = await supabase
            .from('store_po_items')
            .insert(poItems);

        if (itemsError) {
            console.error('PO Items insert error:', JSON.stringify(itemsError, null, 2));
            throw itemsError;
        }

        console.log('PO Items inserted successfully');
        console.log('=== END DEBUG ===');

        res.status(201).json({
            success: true,
            data: newPO
        });
    } catch (error) {
        logger.error('Error creating purchase order:', error);
        console.error('FULL ERROR DETAILS:', JSON.stringify(error, null, 2));
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

        // Handle item IDs - could be UUID or SKU
        const resolvedItems = [...items];
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const skusToResolve = items
            .filter((item: any) => !uuidRegex.test(item.item_id))
            .map((item: any) => item.item_id);

        if (skusToResolve.length > 0) {
            const { data: storeItems, error: resolveError } = await supabase
                .from('store_items')
                .select('id, item_code')
                .in('item_code', skusToResolve);

            if (resolveError) throw new AppError('Error resolving item identifiers', 500);

            const skuToIdMap = (storeItems || []).reduce((acc: any, item: any) => {
                acc[item.item_code] = item.id;
                return acc;
            }, {});

            for (const item of resolvedItems) {
                if (!uuidRegex.test(item.item_id)) {
                    const resolvedId = skuToIdMap[item.item_id];
                    if (!resolvedId) throw new AppError(`Item not found with SKU: ${item.item_id}`, 400);
                    item.item_id = resolvedId;
                }
            }
        }

        // Calculate totals
        const subtotal = resolvedItems.reduce((sum: number, item: any) =>
            sum + (item.quantity * item.unit_price), 0);
        const tax_amount = subtotal * 0.16;
        const total_amount = subtotal + tax_amount;

        // Update PO
        const { data: updatedPO, error: updateError } = await supabase
            .from('store_purchase_orders')
            .update({
                supplier_id,
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
        const poItems = resolvedItems.map((item: any) => ({
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
