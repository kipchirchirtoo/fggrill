import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { updateBranchStock, postGrnFoundationMovements } from '../../services/branch-inventory.service';
import { recordBarStockMovement } from '../../services/unified-bar-stock.service';

const toNumber = (value: any): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeText = (value: any): string | null => {
    const text = value == null ? '' : `${value}`.trim();
    return text.length > 0 && text.toLowerCase() !== 'null' ? text : null;
};

const generateGRNNumber = async (): Promise<string> => {
    const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const prefix = `GRN${datePart}`;

    const { data, error } = await supabase
        .from('store_grn')
        .select('grn_number')
        .like('grn_number', `${prefix}%`)
        .order('grn_number', { ascending: false })
        .limit(1);

    if (error) throw error;
    const last = data?.[0]?.grn_number;
    const next = last ? Number(String(last).slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(Number.isFinite(next) ? next : 1).padStart(4, '0')}`;
};

const sameText = (left: any, right: any): boolean => {
    const a = normalizeText(left)?.toLowerCase();
    const b = normalizeText(right)?.toLowerCase();
    return !!a && a === b;
};

const isUUID = (value: any): boolean => {
    if (typeof value !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
};

const firstPresent = (...values: any[]): string | null => {
    for (const value of values) {
        const text = normalizeText(value);
        if (text) return text;
    }
    return null;
};

const findExistingMatchingGRN = async (params: {
    poId?: string | null;
    supplierId: string;
    invoiceNumber: string | null;
    deliveryNoteNumber: string | null;
    totalItems: number;
    totalQuantity: number;
    totalValue: number;
}) => {
    if (!params.poId) return null;

    const { data, error } = await supabase
        .from('store_grn')
        .select('*')
        .eq('purchase_order_id', params.poId)
        .eq('supplier_id', params.supplierId)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) throw error;

    const retryWindowStart = Date.now() - 15 * 60 * 1000;
    return (data || []).find((grn: any) => {
        if (sameText(grn.invoice_number, params.invoiceNumber)) return true;
        if (sameText(grn.delivery_note_number, params.deliveryNoteNumber)) return true;

        const createdAt = Date.parse(grn.created_at || '');
        const isRecentRetry = Number.isFinite(createdAt) && createdAt >= retryWindowStart;
        if (!isRecentRetry) return false;

        return toNumber(grn.total_items) === params.totalItems &&
            Math.abs(toNumber(grn.total_quantity) - params.totalQuantity) < 0.0001 &&
            Math.abs(toNumber(grn.total_value) - params.totalValue) < 0.0001;
    }) || null;
};

const reconcilePOItemsFromGRNs = async (poId: string, poItems: any[]) => {
    const { data: grns, error: grnError } = await supabase
        .from('store_grn')
        .select('id, status')
        .eq('purchase_order_id', poId);

    if (grnError) throw grnError;

    const activeGrns = (grns || []).filter((grn: any) => String(grn.status || '').toLowerCase() !== 'cancelled');
    const grnIds = activeGrns.map((grn: any) => grn.id).filter(Boolean);
    const { data: grnItems, error: grnItemsError } = grnIds.length > 0
        ? await supabase
            .from('store_grn_items')
            .select('po_item_id, item_id, quantity_accepted, quantity_received')
            .in('grn_id', grnIds)
        : { data: [], error: null } as any;

    if (grnItemsError) throw grnItemsError;

    const receivedByPOItem = new Map<string, number>();
    const receivedBySku = new Map<string, number>();
    for (const item of grnItems || []) {
        const qty = toNumber(item.quantity_accepted ?? item.quantity_received);
        const poItemId = normalizeText(item.po_item_id);
        const sku = normalizeText(item.item_id)?.toLowerCase();
        if (poItemId) {
            receivedByPOItem.set(poItemId, (receivedByPOItem.get(poItemId) || 0) + qty);
        } else if (sku) {
            receivedBySku.set(sku, (receivedBySku.get(sku) || 0) + qty);
        }
    }

    const reconciled = [];
    for (const item of poItems || []) {
        const ordered = toNumber(item.quantity_ordered);
        const sku = normalizeText(item.item_id)?.toLowerCase();
        const actualReceived = receivedByPOItem.get(String(item.id)) ?? (sku ? receivedBySku.get(sku) : 0) ?? 0;
        const actualPending = Math.max(0, ordered - actualReceived);
        const storedReceived = toNumber(item.quantity_received);
        const storedPending = item.quantity_pending == null
            ? Math.max(0, ordered - storedReceived)
            : toNumber(item.quantity_pending);

        if (
            Math.abs(storedReceived - actualReceived) > 0.0001 ||
            Math.abs(storedPending - actualPending) > 0.0001
        ) {
            const { error: updateError } = await supabase
                .from('store_po_items')
                .update({
                    quantity_received: actualReceived,
                    quantity_pending: actualPending,
                    updated_at: new Date().toISOString()
                })
                .eq('id', item.id);
            if (updateError) throw updateError;
        }

        reconciled.push({
            ...item,
            quantity_received: actualReceived,
            quantity_pending: actualPending
        });
    }

    return reconciled;
};

const assertPurchaseOrderCanReceive = async (poId?: string | null): Promise<{ fullyReceived: boolean }> => {
    if (!poId) return { fullyReceived: false };

    const { data: po, error: poError } = await supabase
        .from('store_purchase_orders')
        .select('id, status, sent_to_supplier')
        .eq('id', poId)
        .maybeSingle();

    if (poError) throw poError;
    if (!po) throw new AppError('Purchase order not found', 404);

    const { data: items, error: itemsError } = await supabase
        .from('store_po_items')
        .select('id, item_id, quantity_ordered, quantity_received, quantity_pending')
        .eq('purchase_order_id', poId);

    if (itemsError) throw itemsError;
    const reconciledItems = await reconcilePOItemsFromGRNs(poId, items || []);
    const pending = reconciledItems.reduce((sum: number, item: any) => {
        const ordered = toNumber(item.quantity_ordered);
        const received = toNumber(item.quantity_received);
        const itemPending = item.quantity_pending == null
            ? Math.max(0, ordered - received)
            : toNumber(item.quantity_pending);
        return sum + itemPending;
    }, 0);
    const received = reconciledItems.reduce((sum: number, item: any) => {
        return sum + toNumber(item.quantity_received);
    }, 0);

    // PO is genuinely fully received — signal the caller to redirect to the existing GRN
    if (pending <= 0.0001) {
        return { fullyReceived: true };
    }

    // PO status is stale as fully_received but items are still pending — repair it
    if (String(po.status).toLowerCase() === 'fully_received') {
        const repairedStatus = received > 0
            ? 'partially_received'
            : (po.sent_to_supplier ? 'sent_to_supplier' : 'approved');
        const { error: repairError } = await supabase
            .from('store_purchase_orders')
            .update({
                status: repairedStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', poId);
        if (repairError) throw repairError;
        logger.warn(`Repaired stale fully_received PO ${poId} to ${repairedStatus}; ${pending} units still pending.`);
    }

    return { fullyReceived: false };
};

const updatePurchaseOrderReceipt = async (
    poId: string | null | undefined,
    grnItems: any[],
    userId: string | undefined
) => {
    if (!poId) return null;

    for (const item of grnItems) {
        const receivedQty = toNumber(item.quantity_accepted || item.quantity_received);
        if (receivedQty <= 0) continue;

        const { data: candidateItems, error: candidateError } = await supabase
            .from('store_po_items')
            .select('id, item_id, quantity_ordered, quantity_pending')
            .eq('purchase_order_id', poId);

        if (candidateError) throw candidateError;

        const itemSku = firstPresent(item.item_sku, item.item_id, item.sku);
        const poItemId = normalizeText(item.po_item_id);
        const poItem = (candidateItems || []).find((candidate: any) => {
            if (poItemId && String(candidate.id) === poItemId) return true;
            const candidateSku = firstPresent(candidate.item_id);
            return !!itemSku && !!candidateSku && candidateSku === itemSku;
        });
        if (!poItem) continue;

        const currentPending = toNumber(poItem.quantity_pending ?? poItem.quantity_ordered);
        const nextPending = Math.max(0, currentPending - receivedQty);
        const { error } = await supabase
            .from('store_po_items')
            .update({ quantity_pending: nextPending })
            .eq('id', poItem.id);

        if (error) throw error;
    }

    const { data: allItems, error: allError } = await supabase
        .from('store_po_items')
        .select('quantity_ordered, quantity_pending')
        .eq('purchase_order_id', poId);

    if (allError) throw allError;

    const totalOrdered = (allItems || []).reduce((sum: number, item: any) => sum + toNumber(item.quantity_ordered), 0);
    const totalPending = (allItems || []).reduce((sum: number, item: any) => sum + toNumber(item.quantity_pending), 0);
    const nextStatus = totalPending <= 0.0001 ? 'fully_received' : 'partially_received';
    const updatePayload: any = {
        status: nextStatus,
        updated_at: new Date().toISOString()
    };

    if (nextStatus === 'fully_received') {
        updatePayload.received_by_id = userId || null;
        updatePayload.received_at = new Date().toISOString();
    }

    const { data: po, error } = await supabase
        .from('store_purchase_orders')
        .update(updatePayload)
        .eq('id', poId)
        .select('*, supplier:store_suppliers(*)')
        .single();

    if (error) throw error;
    return {
        ...po,
        total_ordered: totalOrdered,
        total_received: Math.max(0, totalOrdered - totalPending),
        total_pending: totalPending
    };
};

const createSupplierInvoiceFromGRN = async (params: {
    invoiceNumber: string;
    supplier: any;
    poId?: string | null;
    grnId: string;
    grnNumber: string;
    grnDate: string;
    totalValue: number;
    userId?: string;
    grnItems: any[];
    itemDetails: Map<string, any>;
}) => {
    const dueDate = new Date(params.grnDate);
    dueDate.setDate(dueDate.getDate() + toNumber(params.supplier.payment_terms_days || params.supplier.payment_terms || 30));

    const { data: invoice, error: invoiceError } = await supabase
        .from('store_supplier_invoices')
        .insert({
            invoice_number: params.invoiceNumber,
            supplier_id: params.supplier.id,
            po_id: params.poId || null,
            grn_id: params.grnId,
            invoice_date: params.grnDate,
            due_date: dueDate.toISOString().split('T')[0],
            payment_terms_days: toNumber(params.supplier.payment_terms_days || params.supplier.payment_terms || 30),
            supplier_pin: params.supplier.tax_id || params.supplier.kra_pin || 'N/A',
            supplier_vat_registered: !!params.supplier.vat_registered,
            supplier_vat_number: params.supplier.vat_number || null,
            subtotal: params.totalValue,
            vat_rate_type: 'zero',
            vat_rate: 0,
            vat_amount: 0,
            total_amount: params.totalValue,
            balance_due: params.totalValue,
            created_by_id: params.userId,
            status: 'draft',
            notes: `Automatically generated from GRN ${params.grnNumber}`
        })
        .select()
        .single();

    if (invoiceError) throw invoiceError;

    const invoiceItems = params.grnItems.map((item: any) => {
        const qty = toNumber(item.quantity_accepted || item.quantity_received);
        const unitPrice = toNumber(item.unit_price);
        const detail = params.itemDetails.get(item.item_id);
        return {
            supplier_invoice_id: invoice.id,
            item_id: item.item_id,
            goods_receipt_line_id: item.id || null,
            description: detail?.item_name || detail?.description || item.item_id,
            quantity: qty,
            unit: detail?.unit_of_measure || detail?.unit || 'units',
            unit_price: unitPrice,
            line_total: qty * unitPrice
        };
    });

    if (invoiceItems.length > 0) {
        const { error } = await supabase
            .from('store_supplier_invoice_items')
            .insert(invoiceItems);
        if (error) throw error;
    }

    return invoice;
};

/**
 * @desc    Receive goods from a branch supplier through a real GRN
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
            po_id,
            items,
            delivery_note_number,
            invoice_number,
            remarks,
            attachments
        } = req.body;

        const userId = req.user?.id;
        const branchId = Number(req.user?.branch_id || req.user?.branchId);
        const receivedAt = new Date().toISOString();

        if (!branchId) {
            throw new AppError('Branch identification failed. Only branch staff can receive direct goods.', 403);
        }
        if (!userId) {
            throw new AppError('Authenticated user is required to post a GRN', 401);
        }

        if (!supplier_id || !items || !Array.isArray(items) || items.length === 0) {
            throw new AppError('Supplier and items are required', 400);
        }

        const { data: supplier, error: supplierError } = await supabase
            .from('store_suppliers')
            .select('*')
            .eq('id', supplier_id)
            .single();

        if (supplierError || !supplier) {
            throw new AppError('Supplier not found or inaccessible', 404);
        }

        if (supplier.branch_id && Number(supplier.branch_id) !== branchId) {
            throw new AppError('You do not have permission to receive from this supplier', 403);
        }

        const normalizedItems = items.map((item: any) => {
            const sku = normalizeText(item.item_sku ?? item.item_id ?? item.sku);
            const qty = toNumber(item.quantity_received ?? item.quantity ?? item.received_quantity);
            const accepted = toNumber(item.quantity_accepted ?? item.accepted_quantity ?? qty);
            return {
                ...item,
                item_id: sku,
                item_sku: sku,
                po_item_id: normalizeText(item.po_item_id),
                quantity_ordered: toNumber(item.quantity_ordered ?? item.ordered_quantity ?? qty),
                quantity_received: qty,
                quantity_accepted: accepted,
                unit_price: toNumber(item.unit_price),
                unit_of_measure: normalizeText(item.unit_of_measure ?? item.unit) || 'units'
            };
        });

        const invalidItem = normalizedItems.find((item: any) => !item.item_id || item.quantity_received <= 0);
        if (invalidItem) {
            throw new AppError('Every receipt item must have a valid SKU and received quantity above zero', 400);
        }

        const skus = [...new Set(normalizedItems.map((item: any) => String(item.item_id)))];
        const uuids = skus.filter(s => isUUID(s));
        const skuCodes = skus.filter(s => !isUUID(s));

        let query = supabase
            .from('simple_items')
            .select('id, sku, item_name, description, quantity, unit_of_measure, category, cost_price');

        if (uuids.length > 0 && skuCodes.length > 0) {
            query = query.or(`id.in.(${uuids.join(',')}),sku.in.(${skuCodes.map(s => `"${s}"`).join(',')})`);
        } else if (uuids.length > 0) {
            query = query.in('id', uuids);
        } else {
            query = query.in('sku', skuCodes);
        }

        const { data: storeItems, error: storeItemsError } = await query;

        if (storeItemsError) throw storeItemsError;
        const itemDetails = new Map<string, any>();
        for (const item of storeItems || []) {
            if (item.sku) {
                itemDetails.set(String(item.sku).toLowerCase(), item);
            }
            if (item.id) {
                itemDetails.set(String(item.id).toLowerCase(), item);
            }
        }
        const missingSkus = skus.filter((sku) => !itemDetails.has(sku.toLowerCase()));
        if (missingSkus.length > 0) {
            throw new AppError(`Cannot post receipt. Missing inventory SKU(s): ${missingSkus.join(', ')}`, 400);
        }

        const totalItems = normalizedItems.length;
        const totalQuantity = normalizedItems.reduce((sum: number, item: any) => sum + toNumber(item.quantity_received), 0);
        const totalValue = normalizedItems.reduce((sum: number, item: any) => sum + toNumber(item.quantity_received) * toNumber(item.unit_price), 0);
        const resolvedInvoiceNumber = normalizeText(invoice_number);
        const resolvedDeliveryNote = normalizeText(delivery_note_number);

        const duplicate = await findExistingMatchingGRN({
            poId: po_id,
            supplierId: supplier_id,
            invoiceNumber: resolvedInvoiceNumber,
            deliveryNoteNumber: resolvedDeliveryNote,
            totalItems,
            totalQuantity,
            totalValue
        });

        if (duplicate) {
            res.status(200).json({
                success: true,
                duplicate: true,
                message: `Matching GRN ${duplicate.grn_number} already exists`,
                data: {
                    grn: duplicate,
                    ...duplicate,
                    duplicate: true
                }
            });
            return;
        }

        const poCheck = await assertPurchaseOrderCanReceive(po_id);
        if (poCheck.fullyReceived) {
            // PO is fully received — return the most recent GRN so the client can open it
            const { data: existingGrns } = await supabase
                .from('store_grn')
                .select('*')
                .eq('purchase_order_id', po_id)
                .order('created_at', { ascending: false })
                .limit(1);
            const existingGrn = existingGrns?.[0] || null;
            res.status(200).json({
                success: true,
                duplicate: true,
                fullyReceived: true,
                message: existingGrn
                    ? `Purchase order is fully received. Opening existing GRN ${existingGrn.grn_number}.`
                    : 'Purchase order has already been fully received.',
                data: existingGrn
                    ? { grn: existingGrn, ...existingGrn, duplicate: true }
                    : null
            });
            return;
        }

        const grnNumber = await generateGRNNumber();
        const grnDate = new Date().toISOString().split('T')[0];

        const { data: grn, error: grnError } = await supabase
            .from('store_grn')
            .insert({
                grn_number: grnNumber,
                purchase_order_id: po_id || null,
                supplier_id,
                grn_date: grnDate,
                invoice_number: resolvedInvoiceNumber,
                delivery_note_number: resolvedDeliveryNote,
                status: 'draft',
                received_by_id: userId,
                grn_approved: true,
                approved_by_id: userId,
                received_at: receivedAt,
                total_items: totalItems,
                total_quantity: totalQuantity,
                total_value: totalValue,
                notes: remarks,
                attachments: attachments || null
            })
            .select()
            .single();

        if (grnError) throw grnError;

        const grnItems = normalizedItems.map((item: any) => {
            const details = itemDetails.get(String(item.item_id).toLowerCase());
            return {
                grn_id: grn.id,
                goods_receipt_id: grn.id,
                purchase_order_line_id: item.po_item_id || null,
                po_item_id: item.po_item_id || null,
                item_id: details?.id || item.item_id,
                item_name: details?.item_name || item.item_name || 'Item',
                sku: details?.sku || item.item_sku || '',
                quantity_ordered: item.quantity_ordered,
                quantity_received: item.quantity_received,
                quantity_accepted: item.quantity_accepted,
                quantity_rejected: toNumber(item.quantity_rejected),
                quantity_damaged: toNumber(item.quantity_damaged),
                unit: item.unit_of_measure || details?.unit_of_measure || 'units',
                unit_price: item.unit_price,
                line_total: item.quantity_received * item.unit_price,
                total_value: item.quantity_received * item.unit_price,
                batch_number: normalizeText(item.batch_number),
                expiry_date: normalizeText(item.expiry_date),
                quality_status: item.quality_status || 'accepted'
            };
        });

        const { data: savedItems, error: itemError } = await supabase
            .from('store_grn_items')
            .insert(grnItems)
            .select();

        if (itemError) {
            await supabase.from('store_grn').delete().eq('id', grn.id);
            throw itemError;
        }

        // Resolve primary store location for this branch
        const { data: storeLocation } = await supabase
            .from('inventory_locations')
            .select('id')
            .eq('branch_id', branchId)
            .eq('location_type', 'store')
            .maybeSingle();
        let locationId = storeLocation?.id || null;

        if (!locationId) {
            // Fallback: get any location for this branch
            const { data: anyLocation } = await supabase
                .from('inventory_locations')
                .select('id')
                .eq('branch_id', branchId)
                .limit(1)
                .maybeSingle();
            locationId = anyLocation?.id || null;
        }

        // Prepare items array for the bulk stored procedure
        const bulkItems = (savedItems || grnItems).map((item: any) => ({
            item_id: item.item_id,
            sku: item.sku,
            qty: Number(item.quantity_accepted || item.quantity_received),
            unit_price: Number(item.unit_price || 0)
        }));

        logger.info(`Executing bulk branch stock updates for GRN ${grnNumber} via database RPC...`);
        const { data: rpcResult, error: bulkStockError } = await supabase
            .rpc('bulk_post_grn_stock_update', {
                p_branch_id: branchId,
                p_location_id: locationId,
                p_items: bulkItems,
                p_user_id: userId || null,
                p_reference_id: grn.id,
                p_reference_number: grnNumber,
                p_remarks: remarks || ''
            });

        if (bulkStockError) {
            logger.error('Branch bulk stock update RPC failed:', bulkStockError);
            throw bulkStockError;
        }

        // Log each item into the Foundation Service inventory_movements audit
        // trail (best-effort — never blocks the GRN response if this fails).
        postGrnFoundationMovements({
            branchId: branchId || 0,
            actorId: userId || '',
            grnNumber,
            grnId: grn.id,
            items: bulkItems.map((it: any) => ({
                sku: it.sku,
                item_name: it.sku,
                qty: it.qty,
                unit_price: it.unit_price
            }))
        }).catch((err: any) => logger.warn('postGrnFoundationMovements (branch) failed:', err?.message));

        const stockResults = (rpcResult || []).map((r: any) => ({
            item_sku: r.sku,
            quantity: r.quantity,
            previous_stock: Number(r.prev_qty || 0),
            new_stock: Number(r.new_qty || 0)
        }));

        const purchaseOrder = await updatePurchaseOrderReceipt(po_id, savedItems || grnItems, userId);

        const { error: touchError } = await supabase
            .from('store_grn')
            .update({
                status: 'posted',
                updated_at: receivedAt
            })
            .eq('id', grn.id);

        if (touchError) throw touchError;

        let supplierInvoice = null;
        if (resolvedInvoiceNumber) {
            supplierInvoice = await createSupplierInvoiceFromGRN({
                invoiceNumber: resolvedInvoiceNumber,
                supplier,
                poId: po_id || null,
                grnId: grn.id,
                grnNumber,
                grnDate,
                totalValue,
                userId,
                grnItems: savedItems || grnItems,
                itemDetails
            });
        }

        logger.info(`Branch ${branchId} posted GRN ${grnNumber} from supplier ${supplier.name}`);

        res.status(201).json({
            success: true,
            message: `GRN ${grnNumber} posted and branch stock updated`,
            data: {
                ...grn,
                status: 'completed',
                grn_approved: true,
                supplier_name: supplier.name,
                received_at: receivedAt,
                items: savedItems || grnItems,
                items_processed: stockResults,
                purchase_order: purchaseOrder,
                supplier_invoice: supplierInvoice,
                finance_status: supplierInvoice ? 'Billed' : 'Pending Bill',
                grn
            }
        });
    } catch (error) {
        logger.error('Error in branch supplier GRN receipt:', error);
        next(error);
    }
};
