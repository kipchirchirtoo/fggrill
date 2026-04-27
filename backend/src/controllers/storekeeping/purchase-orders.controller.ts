import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { emailService } from '../../services/email.service';
import { applyModuleBranchFilter, setModuleBranchOnCreate } from '../../middleware/moduleAccess';

// @desc    Get all purchase orders
// @route   GET /api/purchase-orders
// @access  Private
export const getPurchaseOrders = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { status, from_date, to_date, supplier_id } = req.query;
        const user = (req as any).user;
        const sourceModule = (req as any).sourceModule;
        const enforcedBranchId = (req as any).enforcedBranchId;

        let query = supabase
            .from('store_purchase_orders')
            .select(`
                *,
                supplier:store_suppliers(id, name, supplier_code, branch_id)
            `)
            .order('created_at', { ascending: false });

        // CRITICAL: Apply module and branch filters at query level
        query = applyModuleBranchFilter(query, req);

        // Apply additional filters
        if (supplier_id) query = query.eq('supplier_id', supplier_id);
        if (status) query = query.eq('status', (status as string).toLowerCase());
        if (from_date) query = query.gte('po_date', from_date);
        if (to_date) query = query.lte('po_date', to_date);

        const { data: orders, error: ordersError } = await query;
        if (ordersError) throw ordersError;

        if (!orders || orders.length === 0) {
            res.status(200).json({ success: true, count: 0, data: [] });
            return;
        }

        // No post-fetch filtering needed - database query handles it
        let filteredOrders = orders;

        // 1. Get all items for these orders
        const orderIds = filteredOrders.map(o => o.id);
        const { data: allItems, error: itemsError } = await supabase
            .from('store_po_items')
            .select('*')
            .in('po_id', orderIds);

        if (itemsError) throw itemsError;

        // 2. Get simple_items details for these items
        const skus = [...new Set(allItems?.map(i => i.item_id) || [])];
        const { data: itemDetails, error: detailsError } = await supabase
            .from('simple_items')
            .select('sku, description, unit_of_measure')
            .in('sku', skus);

        if (detailsError) throw detailsError;

        // 3. Merge data
        const enrichedOrders = filteredOrders.map(order => {
            const orderItems = (allItems || [])
                .filter(i => i.po_id === order.id)
                .map(i => {
                    const detail = (itemDetails || []).find(d => d.sku === i.item_id);
                    const resolvedName = detail?.description || (detail as any)?.name || i.item_id;
                    return {
                        ...i,
                        item: detail ? {
                            ...detail,
                            name: resolvedName
                        } : null,
                        item_name: resolvedName,
                        unit_of_measure: detail?.unit_of_measure || i.unit_of_measure || null
                    };
                });

            return {
                ...order,
                supplier_name: order.supplier?.name || 'N/A',
                items: orderItems
            };
        });

        res.status(200).json({
            success: true,
            count: enrichedOrders.length,
            data: enrichedOrders
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

        const { data: order, error: orderError } = await supabase
            .from('store_purchase_orders')
            .select('*, supplier:store_suppliers(*)')
            .eq('id', id)
            .single();

        if (orderError || !order) {
            throw new AppError('Purchase order not found', 404);
        }

        // Fetch items separately
        const { data: items, error: itemsError } = await supabase
            .from('store_po_items')
            .select('*')
            .eq('po_id', id);

        if (itemsError) throw itemsError;

        // Fetch item details
        const skus = items?.map(i => i.item_id) || [];
        const { data: itemDetails } = await supabase
            .from('simple_items')
            .select('sku, description, unit_of_measure, category')
            .in('sku', skus);

        // Merge
        const enrichedItems = (items || []).map(item => {
            const detail = itemDetails?.find(d => d.sku === item.item_id);
            const resolvedName = detail?.description || (detail as any)?.name || item.item_id;
            return {
                ...item,
                item_name: resolvedName,
                item: detail ? {
                    ...detail,
                    name: resolvedName
                } : null,
                unit_of_measure: detail?.unit_of_measure || item.unit_of_measure || null
            };
        });

        const flattenedOrder = {
            ...order,
            supplier_name: (order as any).supplier?.name || 'N/A',
            receiving_branch_name: 'Central Stores',
            items: enrichedItems
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
            delivery_terms,
            auto_approve
        } = req.body;

        const userId = req.user?.id;

        // Enhanced validation and logging
        console.log('=== CREATE PURCHASE ORDER DEBUG ===');
        console.log('User ID:', userId);
        console.log('Supplier ID:', supplier_id, 'Type:', typeof supplier_id);
        console.log('Items count:', items?.length);
        console.log('Items:', JSON.stringify(items, null, 2));
        console.log('Auto-approve:', auto_approve);

        if (!supplier_id || !items || items.length === 0) {
            throw new AppError('Supplier and items are required', 400);
        }

        // Validate dates to avoid constraint violations
        const resolvedPoDate = po_date || new Date().toISOString().split('T')[0];
        if (expected_delivery_date && expected_delivery_date < resolvedPoDate) {
            throw new AppError('Expected delivery date cannot be before the purchase order date', 400);
        }

        // Validate UUID format for supplier_id
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(supplier_id)) {
            throw new AppError('Invalid supplier ID format', 400);
        }

        // Handle item IDs - we use SKU directly in the new logic
        const resolvedItems = [...items];
        const skusToResolve = items.map((item: any) => item.item_id);

        if (skusToResolve.length > 0) {
            console.log('Resolving SKUs from simple_items:', skusToResolve);
            
            // Try to resolve from simple_items
            const { data: storeItems, error: resolveError } = await supabase
                .from('simple_items')
                .select('sku')
                .in('sku', skusToResolve);

            if (resolveError) {
                console.error('CRITICAL: SKU Resolution Error:', JSON.stringify(resolveError, null, 2));
                throw new AppError(`Error resolving item identifiers: ${resolveError.message}`, 500);
            }

            // Build map (SKU maps to itself)
            const skuToIdMap = (storeItems || []).reduce((acc: any, item: any) => {
                if (item.sku) acc[item.sku] = item.sku;
                return acc;
            }, {});

            console.log('SKU resolution map:', skuToIdMap);

            for (const item of resolvedItems) {
                const resolvedId = skuToIdMap[item.item_id];
                if (!resolvedId) {
                    throw new AppError(`Item not found with SKU: ${item.item_id}`, 400);
                }
                item.item_id = resolvedId;
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

        // Calculate totals WITHOUT VAT
        const subtotal = resolvedItems.reduce((sum: number, item: any) =>
            sum + (Number(item.quantity) * Number(item.unit_price)), 0);
            
        const tax_amount = 0; // No VAT
        const total_amount = subtotal; // Total equals subtotal (no tax)

        console.log('Calculated totals - Subtotal:', subtotal, 'Tax:', tax_amount, 'Total:', total_amount);

        // Prepare PO data - set status based on auto_approve flag
        // CRITICAL: Apply module and branch scoping
        const poData = setModuleBranchOnCreate({
            po_number,
            supplier_id,
            po_date: po_date || new Date().toISOString().split('T')[0],
            expected_delivery_date: expected_delivery_date || null,
            special_instructions: special_instructions || null,
            subtotal,
            tax_amount,
            total_amount,
            status: auto_approve ? 'approved' : 'draft',
            payment_terms: payment_terms || 'credit_30_days',
            delivery_terms: delivery_terms || null,
            // If auto-approving, set approval fields
            ...(auto_approve && {
                approved_by_id: userId,
                approved_at: new Date().toISOString(),
                sent_to_supplier: true,
                sent_at: new Date().toISOString(),
                sent_by_id: userId
            })
        }, req);

        // Override created_by_id with the correct field name
        poData.created_by_id = userId || null;
        delete (poData as any).created_by;

        console.log('PO Data to insert:', JSON.stringify(poData, null, 2));

        try {
            // Create purchase order
            const { data: newPO, error: poError } = await supabase
                .from('store_purchase_orders')
                .insert(poData)
                .select()
                .single();

            if (poError) {
                console.error('CRITICAL: PO Header Insert Error:', JSON.stringify(poError, null, 2));
                throw new AppError(`Error creating PO header: ${poError.message}`, 500);
            }

            console.log('PO header created successfully:', newPO.id);

            // Insert PO items WITHOUT VAT
            const poItems = resolvedItems.map((item: any) => {
                const lineSubtotal = Number(item.quantity) * Number(item.unit_price);
                
                return {
                    po_id: newPO.id,
                    item_id: item.item_id, // Passing SKU string
                    quantity_ordered: item.quantity,
                    quantity_pending: item.quantity,
                    unit_price: item.unit_price,
                    tax_amount: 0, // No VAT
                    total_price: lineSubtotal // No tax added
                };
            });

            console.log('PO Items to insert (prepared):', JSON.stringify(poItems, null, 2));

            const { error: itemsError } = await supabase
                .from('store_po_items')
                .insert(poItems);

            if (itemsError) {
                console.error('CRITICAL: PO Items Insert Error:', JSON.stringify(itemsError, null, 2));
                // Cleanup: Delete the PO header if items failed
                const { error } = await supabase.from('store_purchase_orders').delete().eq('id', newPO.id);
                if (error) {
                  console.error('Database error:', error);
                  throw error;
                }
                throw new AppError(`Error adding items to PO: ${itemsError.message}`, 500);
            }

            console.log('PO Items inserted successfully');
            console.log('=== END DEBUG ===');

            res.status(201).json({
                success: true,
                data: newPO,
                message: auto_approve ? 'Purchase order created and approved automatically' : 'Purchase order created successfully'
            });
        } catch (dbError: any) {
            console.error('FULL DATABASE ERROR:', JSON.stringify(dbError, null, 2));
            if (dbError instanceof AppError) throw dbError;
            throw new AppError(dbError.message || 'Database execution error', 500);
        }
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
        const { id } = req.params;
        const userId = req.user?.id;
        
        // Find PO
        const { data: po, error: fetchError } = await supabase
            .from('store_purchase_orders')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !po) {
            throw new AppError('Purchase order not found', 404);
        }

        if (po.status === 'RECEIVED' || po.status === 'received') {
            throw new AppError('Purchase order is already received', 400);
        }

        // Get po items
        const { data: items, error: itemsError } = await supabase
            .from('store_po_items')
            .select('*')
            .eq('po_id', id);

        if (itemsError || !items) {
            throw new AppError('Could not fetch po items', 500);
        }

        // Determine destination branch.
        let targetBranchId = req.user?.branch_id;
        if (!targetBranchId) {
            const { data: central , error } = await supabase.from('branches').select('id').eq('is_central_store', true).single();
            if (error) {
              console.error('Database error:', error);
              throw error;
            }
            if (central) {
                targetBranchId = central.id;
            } else {
                throw new AppError('User has no branch, and no central store is configured', 400);
            }
        }

        // Update items and branch stock
        for (const item of items) {
            const qty = item.quantity_ordered || item.quantity;
            if (!qty) continue;
            
            // Add to receiving branch stock
            const { data: existing } = await supabase
                .from('branch_stock')
                .select('quantity')
                .eq('branch_id', targetBranchId)
                .eq('item_sku', item.item_id)
                .maybeSingle();

            const currentQty = (existing && typeof existing.quantity === 'number') ? existing.quantity : 0;
            const newQty = currentQty + qty;

            await supabase
                .from('branch_stock')
                .upsert({
                    branch_id: targetBranchId,
                    item_sku: item.item_id,
                    quantity: newQty,
                    last_stock_in: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }, { onConflict: 'branch_id,item_sku' });

            // Log stock movement
            await supabase
                .from('branch_stock_movements')
                .insert({
                    branch_id: targetBranchId,
                    item_sku: item.item_id,
                    movement_type: 'PO_RECEIVE',
                    quantity: qty,
                    reference_type: 'PURCHASE_ORDER',
                    reference_id: id,
                    reference_number: po.po_number,
                    performed_by: userId,
                    notes: `Directly received PO ${po.po_number}`
                });
        }

        // Update PO status to RECEIVED
        const { data: updatedPO, error: updateError } = await supabase
            .from('store_purchase_orders')
            .update({
                status: 'RECEIVED',
                received_by_id: userId,
                received_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        res.status(200).json({
            success: true,
            message: 'Purchase order received',
            data: updatedPO
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

        // Handle item IDs - use SKU directly
        const resolvedItems = [...items];
        const skusToResolve = items.map((item: any) => item.item_id);

        if (skusToResolve.length > 0) {
            const { data: storeItems, error: resolveError } = await supabase
                .from('simple_items')
                .select('sku')
                .in('sku', skusToResolve);

            if (resolveError) {
                console.error('CRITICAL: SKU Resolution Error (Update):', JSON.stringify(resolveError, null, 2));
                throw new AppError(`Error resolving item identifiers: ${resolveError.message}`, 500);
            }

            const skuToIdMap = (storeItems || []).reduce((acc: any, item: any) => {
                if (item.sku) acc[item.sku] = item.sku;
                return acc;
            }, {});

            for (const item of resolvedItems) {
                const resolvedId = skuToIdMap[item.item_id];
                if (!resolvedId) throw new AppError(`Item not found with SKU: ${item.item_id}`, 400);
                item.item_id = resolvedId;
            }
        }

        // Calculate totals WITHOUT VAT
        const subtotal = resolvedItems.reduce((sum: number, item: any) =>
            sum + (Number(item.quantity) * Number(item.unit_price)), 0);
            
        const tax_amount = 0; // No VAT
        const total_amount = subtotal; // Total equals subtotal (no tax)

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

        // Insert new items WITHOUT VAT
        const poItems = resolvedItems.map((item: any) => {
            const lineSubtotal = Number(item.quantity) * Number(item.unit_price);

            return {
                po_id: id,
                item_id: item.item_id,
                quantity_ordered: item.quantity,
                quantity_pending: item.quantity,
                unit_price: item.unit_price,
                tax_amount: 0, // No VAT
                total_price: lineSubtotal // No tax added
            };
        });

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

// @desc    Send purchase order to supplier via email
// @route   POST /api/purchase-orders/:id/send
// @access  Private
export const sendPurchaseOrderToSupplier = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        // Fetch PO with items and supplier
        const { data: order, error: orderError } = await supabase
            .from('store_purchase_orders')
            .select('*, supplier:store_suppliers(*)')
            .eq('id', id)
            .single();

        if (orderError || !order) {
            throw new AppError('Purchase order not found', 404);
        }

        if (!order.supplier?.email) {
            throw new AppError('Supplier does not have an email address configured', 400);
        }

        // Fetch items
        const { data: items, error: itemsError } = await supabase
            .from('store_po_items')
            .select('*')
            .eq('po_id', id);

        if (itemsError) throw itemsError;

        // Fetch item names/descriptions
        const skus = items?.map(i => i.item_id) || [];
        const { data: itemDetails } = await supabase
            .from('simple_items')
            .select('sku, description, unit_of_measure')
            .in('sku', skus);

        const enrichedItems = (items || []).map(item => {
            const detail = itemDetails?.find(d => d.sku === item.item_id);
            return {
                ...item,
                item_name: detail?.description || item.item_id
            };
        });

        const fullOrderDetails = {
            ...order,
            items: enrichedItems
        };

        // Send email
        await emailService.sendPurchaseOrderEmail(order.supplier.email, fullOrderDetails);

        // Update PO status
        await supabase
            .from('store_purchase_orders')
            .update({
                sent_to_supplier: true,
                sent_at: new Date().toISOString(),
                sent_by_id: userId,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        res.status(200).json({
            success: true,
            message: `Purchase order sent to ${order.supplier.email}`
        });
    } catch (error) {
        logger.error('Error sending purchase order:', error);
        next(error);
    }
};
