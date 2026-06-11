import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { recordAuditTrail } from '../../utils/audit';
import { generateGRNPDF } from '../../services/native-pdf-reports.service';

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

const toNumber = (value: any): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeText = (value: any): string | null => {
    const text = value == null ? '' : `${value}`.trim();
    return text.length > 0 ? text : null;
};

const updatePurchaseOrderReceipt = async (
    poId: string | undefined,
    grnItems: any[],
    userId: string | undefined
) => {
    if (!poId) return null;

    for (const item of grnItems) {
        const receivedQty = toNumber(item.quantity_accepted || item.quantity_received);
        if (receivedQty <= 0) continue;

        let poItemQuery = supabase
            .from('store_po_items')
            .select('id, quantity_ordered, quantity_pending')
            .eq('po_id', poId);

        if (item.po_item_id) {
            poItemQuery = poItemQuery.eq('id', item.po_item_id);
        } else {
            poItemQuery = poItemQuery.eq('item_id', item.item_id);
        }

        const { data: poItem, error: poItemError } = await poItemQuery.limit(1).maybeSingle();
        if (poItemError) throw poItemError;
        if (!poItem) continue;

        const currentPending = poItem.quantity_pending == null
            ? toNumber(poItem.quantity_ordered)
            : toNumber(poItem.quantity_pending);
        const nextPending = Math.max(0, currentPending - receivedQty);

        const { error: updateItemError } = await supabase
            .from('store_po_items')
            .update({ quantity_pending: nextPending })
            .eq('id', poItem.id);

        if (updateItemError) throw updateItemError;
    }

    const { data: allPoItems, error: allPoItemsError } = await supabase
        .from('store_po_items')
        .select('quantity_ordered, quantity_pending')
        .eq('po_id', poId);

    if (allPoItemsError) throw allPoItemsError;

    const totalOrdered = (allPoItems || []).reduce(
        (sum: number, item: any) => sum + toNumber(item.quantity_ordered),
        0
    );
    const totalPending = (allPoItems || []).reduce(
        (sum: number, item: any) => sum + toNumber(item.quantity_pending),
        0
    );
    const totalReceived = Math.max(0, totalOrdered - totalPending);

    const nextStatus = totalPending <= 0.0001 ? 'received' : 'partial_delivery';
    const updatePayload: any = {
        status: nextStatus,
        updated_at: new Date().toISOString()
    };

    if (totalPending <= 0.0001) {
        updatePayload.received_by_id = userId || null;
        updatePayload.received_at = new Date().toISOString();
    }

    const { data: updatedPo, error: updatePoError } = await supabase
        .from('store_purchase_orders')
        .update(updatePayload)
        .eq('id', poId)
        .select()
        .single();

    if (updatePoError) throw updatePoError;

    return {
        ...updatedPo,
        total_ordered: totalOrdered,
        total_received: totalReceived,
        total_pending: totalPending
    };
};

const createSupplierInvoiceFromGRN = async (
    params: {
        invoiceNumber: string;
        supplierId: string;
        poId?: string;
        grnId: string;
        grnNumber: string;
        grnDate: string;
        totalValue: number;
        userId?: string;
        grnItems: any[];
        itemDetails: Map<string, any>;
    }
) => {
    const dueDate = new Date(params.grnDate);
    dueDate.setDate(dueDate.getDate() + 30);

    const { data: invoice, error: invError } = await supabase
        .from('store_supplier_invoices')
        .insert({
            invoice_number: params.invoiceNumber,
            supplier_id: params.supplierId,
            grn_id: params.grnId,
            po_id: params.poId,
            invoice_date: params.grnDate,
            due_date: dueDate.toISOString().split('T')[0],
            subtotal: params.totalValue,
            vat_rate_type: 'zero',
            vat_amount: 0,
            total_amount: params.totalValue,
            balance_due: params.totalValue,
            created_by_id: params.userId,
            status: 'draft',
            notes: `Automatically generated from GRN ${params.grnNumber}`
        })
        .select()
        .single();

    if (invError) throw invError;

    const invoiceItems = params.grnItems.map((item: any) => {
        const qty = toNumber(item.quantity_accepted || item.quantity_received);
        const unitPrice = toNumber(item.unit_price);
        const detail = params.itemDetails.get(item.item_id);
        return {
            invoice_id: invoice.id,
            item_id: item.item_id,
            grn_item_id: item.id || null,
            po_item_id: item.po_item_id || null,
            description: detail?.item_name || detail?.description || item.item_id,
            quantity: qty,
            unit_price: unitPrice,
            subtotal: qty * unitPrice,
            vat_rate: 0,
            vat_amount: 0,
            total_amount: qty * unitPrice
        };
    });

    if (invoiceItems.length > 0) {
        const { error: invoiceItemsError } = await supabase
            .from('store_supplier_invoice_items')
            .insert(invoiceItems);

        if (invoiceItemsError) throw invoiceItemsError;
    }

    return invoice;
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

        // Transform data to flatten supplier and PO info for consistency
        const transformedGrns = (grns || []).map(grn => ({
            ...grn,
            supplier_name: grn.supplier?.name || 'N/A',
            po_number: grn.purchase_order?.po_number || null,
            delivery_date: grn.grn_date
        }));

        res.status(200).json({
            success: true,
            count: transformedGrns.length,
            data: transformedGrns
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
                supplier_name: grn.supplier?.name || 'N/A',
                po_number: grn.purchase_order?.po_number || null,
                delivery_date: grn.grn_date,
                items: enrichedItems
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Download/print branded GRN PDF
// @route   GET /api/storekeeping/grn/:id/pdf
// @access  Private
export const printGRN = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        const { data: grn, error: grnError } = await supabase
            .from('store_grn')
            .select(`
                *,
                supplier:store_suppliers(*),
                purchase_order:store_purchase_orders(*),
                received_by:users(id, name, email)
            `)
            .eq('id', id)
            .single();

        if (grnError || !grn) {
            throw new AppError('GRN not found', 404);
        }

        const { data: items, error: itemsError } = await supabase
            .from('store_grn_items')
            .select('*')
            .eq('grn_id', id);

        if (itemsError) throw itemsError;

        const skus = [...new Set((items || []).map((item: any) => item.item_id).filter(Boolean))];
        const { data: itemDetails, error: detailsError } = skus.length
            ? await supabase
                .from('simple_items')
                .select('sku, item_name, description, unit_of_measure, category')
                .in('sku', skus)
            : { data: [], error: null } as any;

        if (detailsError) throw detailsError;

        const itemMap = new Map<string, any>(
            (itemDetails || []).map((item: any) => [item.sku, item] as [string, any])
        );
        const enrichedItems = (items || []).map((item: any) => ({
            ...item,
            item: itemMap.get(item.item_id) || null
        }));

        const pdfBuffer = await generateGRNPDF(grn, enrichedItems);
        const filename = `${grn.grn_number || 'GRN'}.pdf`.replace(/[^A-Za-z0-9._-]/g, '_');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.send(pdfBuffer);
    } catch (error) {
        logger.error('Error generating GRN PDF:', error);
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

        const normalizedItems = (items || []).map((item: any) => ({
            ...item,
            item_id: normalizeText(item.item_id),
            po_item_id: normalizeText(item.po_item_id),
            quantity_received: toNumber(item.quantity_received),
            quantity_accepted: toNumber(item.quantity_accepted ?? item.quantity_received),
            quantity_ordered: toNumber(item.quantity_ordered),
            unit_price: toNumber(item.unit_price),
            unit_of_measure: normalizeText(item.unit_of_measure) || 'units'
        }));

        const invalidItem = normalizedItems.find((item: any) => !item.item_id || item.quantity_received <= 0);
        if (invalidItem) {
            throw new AppError('Every GRN item must have a valid SKU and received quantity above zero', 400);
        }

        const skus: string[] = [...new Set<string>(normalizedItems.map((item: any) => String(item.item_id)))];
        const { data: storeItems, error: storeItemsError } = await supabase
            .from('simple_items')
            .select('sku, item_name, description, quantity, unit_of_measure, category')
            .in('sku', skus);

        if (storeItemsError) throw storeItemsError;

        const itemDetails = new Map<string, any>(
            (storeItems || []).map((item: any) => [item.sku, item] as [string, any])
        );
        const missingSkus = skus.filter((sku: string) => !itemDetails.has(sku));
        if (missingSkus.length > 0) {
            throw new AppError(`Cannot post GRN. Missing inventory SKU(s): ${missingSkus.join(', ')}`, 400);
        }

        const grn_number = await generateGRNNumber();
        const resolvedGrnDate = grn_date || new Date().toISOString().split('T')[0];

        // Calculate totals
        const total_items = normalizedItems.length;
        const total_quantity = normalizedItems.reduce((sum: number, item: any) => sum + Number(item.quantity_received), 0);
        const total_value = normalizedItems.reduce((sum: number, item: any) => sum + (Number(item.quantity_received) * Number(item.unit_price)), 0);

        // Start transaction (manual handling via separate calls as Supabase JS doesn't support transactions directly)
        // Note: For production, using a PostgreSQL RPC for the whole transaction is safer.

        // 1. Create GRN header
        const { data: newGRN, error: grnError } = await supabase
            .from('store_grn')
            .insert({
                grn_number,
                po_id,
                supplier_id,
                grn_date: resolvedGrnDate,
                delivery_note_number: normalizeText(delivery_note_number),
                invoice_number: normalizeText(invoice_number),
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
        const grnItems = normalizedItems.map((item: any) => ({
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

        const { data: savedGrnItems, error: itemsError } = await supabase
            .from('store_grn_items')
            .insert(grnItems)
            .select();

        if (itemsError) {
            // Cleanup on error (manual rollback)
            const { error } = await supabase.from('store_grn').delete().eq('id', newGRN.id);
            if (error) {
              console.error('Database error:', error);
              throw error;
            }
            throw itemsError;
        }

        // 3. AUTO-APPROVE GRN and update stock immediately
        logger.info(`Auto-approving GRN ${grn_number}...`);
        
        // Update each item's stock in simple_items
        for (const item of (savedGrnItems || grnItems)) {
            const sku = item.item_id;
            const qty = Number(item.quantity_accepted || item.quantity_received);
            
            if (qty > 0) {
                // Get current stock
                const currentItem = itemDetails.get(sku);
                
                const currentQty = Number(currentItem?.quantity || 0);
                const newQty = currentQty + qty;
                
                // Update stock
                const { error: stockUpdateError } = await supabase
                    .from('simple_items')
                    .update({
                        quantity: newQty,
                        cost_price: item.unit_price || currentItem?.cost_price || 0,
                        last_updated: new Date().toISOString()
                    })
                    .eq('sku', sku);

                if (stockUpdateError) throw stockUpdateError;

                const { error: historyError } = await supabase.from('stock_history').insert({
                    item_sku: sku,
                    change_type: 'IN',
                    quantity_change: qty,
                    previous_quantity: currentQty,
                    new_quantity: newQty,
                    reason: 'GRN',
                    reference: grn_number,
                    notes: `Goods received from supplier via GRN ${grn_number}`,
                    user_id: userId
                });

                if (historyError) {
                    logger.warn(`Failed to log stock history for GRN ${grn_number}/${sku}: ${historyError.message}`);
                }
                
                logger.info(`Updated ${sku}: ${currentQty} + ${qty} = ${newQty}`);
            }
        }

        const updatedPurchaseOrder = await updatePurchaseOrderReceipt(po_id, (savedGrnItems || grnItems), userId);
        
        // Mark GRN as approved
        await supabase
            .from('store_grn')
            .update({
                grn_approved: true,
                approved_by_id: userId,
                approved_at: new Date().toISOString(),
                status: 'completed'
            })
            .eq('id', newGRN.id);

        logger.info(`GRN ${grn_number} auto-approved and stock updated`);

        let supplierInvoice = null;
        // 4. Create a DRAFT Supplier Invoice automatically if invoice_number is provided
        const resolvedInvoiceNumber = normalizeText(invoice_number);
        if (resolvedInvoiceNumber) {
            try {
                logger.info(`Creating draft invoice ${resolvedInvoiceNumber} for GRN ${grn_number}...`);
                supplierInvoice = await createSupplierInvoiceFromGRN({
                    invoiceNumber: resolvedInvoiceNumber,
                    supplierId: supplier_id,
                    poId: po_id,
                    grnId: newGRN.id,
                    grnNumber: grn_number,
                    grnDate: resolvedGrnDate,
                    totalValue: total_value,
                    userId,
                    grnItems: (savedGrnItems || grnItems),
                    itemDetails
                });
                logger.info(`Automatic draft invoice ${resolvedInvoiceNumber} created.`);
            } catch (err) {
                logger.error('Error in automatic invoice creation:', err);
                throw err;
            }
        }

        if (userId) {
            await recordAuditTrail({
                userId,
                action: 'CREATE_GRN',
                entityType: 'store_grn',
                entityId: newGRN.id,
                newValues: {
                    grn_number,
                    supplier_id,
                    po_id,
                    invoice_number: resolvedInvoiceNumber,
                    delivery_note_number: normalizeText(delivery_note_number),
                    total_items,
                    total_quantity,
                    total_value,
                    stock_updated: true,
                    purchase_order_status: updatedPurchaseOrder?.status,
                    supplier_invoice_id: supplierInvoice?.id
                },
                req
            });
        }

        res.status(201).json({
            success: true,
            message: 'Goods received and stock updated successfully',
            data: {
                ...newGRN,
                grn_approved: true,
                status: 'completed',
                items: savedGrnItems || grnItems,
                purchase_order: updatedPurchaseOrder,
                supplier_invoice: supplierInvoice
            }
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
