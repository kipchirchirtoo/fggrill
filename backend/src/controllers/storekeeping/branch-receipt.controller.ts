import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { StoreReceivingPostingService } from '../../modules/inventory';
import { logger } from '../../utils/logger';
import { ensureInventoryLocation } from './items.controller';
import { postGrnFoundationMovements } from '../../services/branch-inventory.service';

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

    // Only count GRNs that have actually been posted/completed (not aborted/draft receipts)
    const activeGrns = (grns || []).filter((grn: any) => {
        const status = String(grn.status || '').toLowerCase();
        return status === 'posted' || status === 'completed' || status === 'approved';
    });
    const grnIds = activeGrns.map((grn: any) => grn.id).filter(Boolean);
    const { data: grnItems, error: grnItemsError } = grnIds.length > 0
        ? await supabase
            .from('store_grn_items')
            .select('po_item_id, item_id, sku, quantity_accepted, quantity_received')
            .in('grn_id', grnIds)
        : { data: [], error: null } as any;

    if (grnItemsError) throw grnItemsError;

    const receivedByPOItem = new Map<string, number>();
    const receivedBySku = new Map<string, number>();
    const receivedById = new Map<string, number>();
    for (const item of grnItems || []) {
        const qty = toNumber(item.quantity_accepted ?? item.quantity_received);
        const poItemId = normalizeText(item.po_item_id);
        const sku = normalizeText(item.sku ?? item.item_id)?.toLowerCase();
        const itemId = normalizeText(item.item_id)?.toLowerCase();
        if (poItemId) {
            receivedByPOItem.set(poItemId, (receivedByPOItem.get(poItemId) || 0) + qty);
        }
        if (sku) {
            receivedBySku.set(sku, (receivedBySku.get(sku) || 0) + qty);
        }
        if (itemId) {
            receivedById.set(itemId, (receivedById.get(itemId) || 0) + qty);
        }
    }

    const reconciled = [];
    for (const item of poItems || []) {
        const ordered = toNumber(item.quantity_ordered);
        const sku = normalizeText(item.sku)?.toLowerCase();
        const itemId = normalizeText(item.item_id)?.toLowerCase();
        const actualReceived = receivedByPOItem.get(String(item.id)) ??
            (sku ? receivedBySku.get(sku) : undefined) ??
            (itemId ? receivedById.get(itemId) : undefined) ??
            0;
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
        .select('id, item_id, sku, item_name, quantity_ordered, quantity_received, quantity_pending')
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

    const { data: candidateItems, error: candidateError } = await supabase
        .from('store_po_items')
        .select('id, item_id, sku, item_name, quantity_ordered, quantity_received, quantity_pending')
        .eq('purchase_order_id', poId);

    if (candidateError) throw candidateError;

    for (const item of grnItems) {
        const receivedQty = toNumber(item.quantity_accepted || item.quantity_received);
        if (receivedQty <= 0) continue;

        const itemSku = firstPresent(item.sku, item.item_sku, item.item_id)?.toLowerCase();
        const itemId = firstPresent(item.item_id)?.toLowerCase();
        const poItemId = normalizeText(item.po_item_id);

        const poItem = (candidateItems || []).find((candidate: any) => {
            if (poItemId && String(candidate.id) === poItemId) return true;
            if (item.id && String(candidate.id) === String(item.id)) return true;
            const candSku = firstPresent(candidate.sku)?.toLowerCase();
            const candItemId = firstPresent(candidate.item_id)?.toLowerCase();
            if (candSku && itemSku && candSku === itemSku) return true;
            if (candItemId && itemId && candItemId === itemId) return true;
            if (candItemId && itemSku && candItemId === itemSku) return true;
            return false;
        });

        if (!poItem) continue;

        const currentOrdered = toNumber(poItem.quantity_ordered);
        const currentPending = poItem.quantity_pending == null
            ? Math.max(0, currentOrdered - toNumber(poItem.quantity_received))
            : toNumber(poItem.quantity_pending);
        const currentReceived = toNumber(poItem.quantity_received);

        const nextPending = Math.max(0, currentPending - receivedQty);
        const nextReceived = currentReceived + receivedQty;

        const { error } = await supabase
            .from('store_po_items')
            .update({
                quantity_pending: nextPending,
                quantity_received: nextReceived,
                updated_at: new Date().toISOString()
            })
            .eq('id', poItem.id);

        if (error) throw error;
    }

    const { data: allItems, error: allError } = await supabase
        .from('store_po_items')
        .select('quantity_ordered, quantity_pending, quantity_received')
        .eq('purchase_order_id', poId);

    if (allError) throw allError;

    const totalOrdered = (allItems || []).reduce((sum: number, item: any) => sum + toNumber(item.quantity_ordered), 0);
    const totalPending = (allItems || []).reduce((sum: number, item: any) => sum + toNumber(item.quantity_pending), 0);
    const totalReceived = (allItems || []).reduce((sum: number, item: any) => sum + toNumber(item.quantity_received), 0);
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
        total_received: totalReceived,
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
        const detail = params.itemDetails.get(item.item_id) || params.itemDetails.get(item.sku);
        return {
            supplier_invoice_id: invoice.id,
            item_id: item.item_id,
            goods_receipt_line_id: item.id || null,
            description: detail?.item_name || detail?.description || item.item_name || item.sku || item.item_id,
            quantity: qty,
            unit: detail?.unit_of_measure || detail?.unit || item.unit || 'units',
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
 * @route   POST /api/store/branch-stock/receive-supplier
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
            const rawSku = normalizeText(item.sku ?? item.item_sku ?? item.item_id);
            const rawItemId = normalizeText(item.item_id ?? item.id ?? item.sku ?? item.item_sku);
            const qty = toNumber(item.quantity_received ?? item.quantity ?? item.received_quantity);
            const accepted = toNumber(item.quantity_accepted ?? item.accepted_quantity ?? qty);
            return {
                ...item,
                item_id: rawItemId,
                item_sku: rawSku,
                sku: rawSku,
                po_item_id: normalizeText(item.po_item_id),
                quantity_ordered: toNumber(item.quantity_ordered ?? item.ordered_quantity ?? qty),
                quantity_received: qty,
                quantity_accepted: accepted,
                unit_price: toNumber(item.unit_price),
                unit_of_measure: normalizeText(item.unit_of_measure ?? item.unit) || 'units'
            };
        });

        const invalidItem = normalizedItems.find((item: any) => (!item.item_id && !item.item_sku) || item.quantity_received <= 0);
        if (invalidItem) {
            throw new AppError('Every receipt item must have a valid SKU and received quantity above zero', 400);
        }

        const identifierKeys = [...new Set(normalizedItems.flatMap((item: any) => [
            item.item_id,
            item.item_sku,
            item.sku
        ]).filter(Boolean).map(String))];

        const uuids = identifierKeys.filter(s => isUUID(s));
        const skuCodes = identifierKeys.filter(s => !isUUID(s));

        let query = supabase
            .from('simple_items')
            .select('id, sku, item_sku, item_name, description, quantity, unit_of_measure, category, cost_price');

        if (uuids.length > 0 && skuCodes.length > 0) {
            query = query.or(`id.in.(${uuids.join(',')}),sku.in.(${skuCodes.map(s => `"${s}"`).join(',')}),item_sku.in.(${skuCodes.map(s => `"${s}"`).join(',')})`);
        } else if (uuids.length > 0) {
            query = query.in('id', uuids);
        } else {
            query = query.or(`sku.in.(${skuCodes.map(s => `"${s}"`).join(',')}),item_sku.in.(${skuCodes.map(s => `"${s}"`).join(',')})`);
        }

        const { data: storeItems, error: storeItemsError } = await query;

        if (storeItemsError) throw storeItemsError;
        const itemDetails = new Map<string, any>();
        for (const item of storeItems || []) {
            if (item.sku) {
                itemDetails.set(String(item.sku).toLowerCase(), item);
            }
            if (item.item_sku) {
                itemDetails.set(String(item.item_sku).toLowerCase(), item);
            }
            if (item.id) {
                itemDetails.set(String(item.id).toLowerCase(), item);
            }
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

        if (duplicate && duplicate.status === 'posted') {
            res.status(200).json({
                success: true,
                duplicate: true,
                message: `Matching GRN ${duplicate.grn_number} already exists and is posted`,
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
                    ? `Purchase order is fully received. Existing GRN ${existingGrn.grn_number} is on record.`
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
                branch_id: branchId,
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
            const details = itemDetails.get(String(item.sku || '').toLowerCase()) ||
                itemDetails.get(String(item.item_sku || '').toLowerCase()) ||
                itemDetails.get(String(item.item_id || '').toLowerCase());
            const resolvedSku = details?.sku || details?.item_sku || item.sku || item.item_sku || '';
            const resolvedItemId = details?.id || (isUUID(item.item_id) ? item.item_id : null);
            return {
                grn_id: grn.id,
                goods_receipt_id: grn.id,
                purchase_order_line_id: item.po_item_id || null,
                po_item_id: item.po_item_id || null,
                item_id: resolvedItemId,
                item_name: details?.item_name || item.item_name || 'Item',
                sku: resolvedSku,
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

        // 1. Resolve / ensure branch inventory location
        let locationId: string | null = null;
        try {
            locationId = await ensureInventoryLocation(supabase, branchId);
        } catch (locErr: any) {
            logger.warn(`Could not resolve inventory location for branch ${branchId}: ${locErr?.message}`);
        }

        // 2. Prepare items for bulk stock update
        const bulkItems = (savedItems || grnItems).map((item: any) => ({
            item_id: item.item_id,
            sku: item.sku,
            qty: Number(item.quantity_accepted || item.quantity_received),
            unit_price: Number(item.unit_price || 0)
        }));

        // 3. Atomically update inventory_balances, branch_stock, and branch_stock_movements via database RPC
        logger.info(`Posting GRN ${grnNumber} stock updates via bulk_post_grn_stock_update...`);
        let stockResults: any[] = [];
        try {
            const { data: rpcData, error: bulkStockError } = await supabase
                .rpc('bulk_post_grn_stock_update', {
                    p_branch_id: branchId,
                    p_location_id: locationId,
                    p_items: bulkItems,
                    p_user_id: userId,
                    p_reference_id: grn.id,
                    p_reference_number: grnNumber,
                    p_remarks: remarks || `Supplier receipt ${grnNumber}`
                });

            if (bulkStockError) {
                logger.error('Bulk stock update RPC error:', bulkStockError);
                throw bulkStockError;
            }
            stockResults = Array.isArray(rpcData) ? rpcData : [];
        } catch (stockErr: any) {
            logger.error('Error during bulk_post_grn_stock_update:', stockErr);
            // Fallback: direct branch_stock upsert if RPC was unreachable
            for (const it of bulkItems) {
                if (!it.sku || it.qty <= 0) continue;
                const { data: curBs } = await supabase
                    .from('branch_stock')
                    .select('quantity')
                    .eq('branch_id', branchId)
                    .eq('item_sku', it.sku)
                    .maybeSingle();
                const prevQty = Number(curBs?.quantity || 0);
                const nextQty = prevQty + it.qty;
                await supabase
                    .from('branch_stock')
                    .upsert({
                        branch_id: branchId,
                        item_sku: it.sku,
                        quantity: nextQty,
                        last_stock_in: receivedAt,
                        updated_at: receivedAt
                    }, { onConflict: 'branch_id,item_sku' });
                stockResults.push({ sku: it.sku, quantity: it.qty, prev_qty: prevQty, new_qty: nextQty });
            }
        }

        // 4. Update simple_items quantity & cost price for catalog coherence
        for (const it of bulkItems) {
            if (it.sku) {
                try {
                    const { data: curSimple } = await supabase
                        .from('simple_items')
                        .select('id, quantity')
                        .or(`sku.eq.${it.sku},item_sku.eq.${it.sku}`)
                        .maybeSingle();

                    if (curSimple) {
                        await supabase
                            .from('simple_items')
                            .update({
                                quantity: Math.max(0, (Number(curSimple.quantity) || 0) + it.qty),
                                cost_price: it.unit_price > 0 ? it.unit_price : undefined,
                                last_updated: receivedAt,
                                updated_at: receivedAt
                            })
                            .eq('id', curSimple.id);
                    }
                } catch (err: any) {
                    logger.warn(`Failed to update simple_items for ${it.sku}: ${err?.message}`);
                }
            }
        }

        // 5. Update purchase order lines and header status
        const purchaseOrder = await updatePurchaseOrderReceipt(po_id, savedItems || grnItems, userId);

        // 6. Touch and mark store_grn as posted
        const { error: touchError } = await supabase
            .from('store_grn')
            .update({
                status: 'posted',
                updated_at: receivedAt
            })
            .eq('id', grn.id);

        if (touchError) throw touchError;

        // 7. Best-effort foundation movement & posting service logging (non-blocking)
        try {
            postGrnFoundationMovements({
                branchId,
                actorId: userId || '',
                grnNumber,
                grnId: grn.id,
                items: bulkItems.map((it: any) => ({
                    sku: it.sku,
                    item_name: itemDetails.get(it.sku?.toLowerCase())?.item_name || it.sku,
                    qty: it.qty,
                    unit_price: it.unit_price
                }))
            }).catch((err: any) => logger.warn('postGrnFoundationMovements background error:', err?.message));
        } catch (err: any) {
            logger.warn('Non-blocking foundation movement trigger error:', err?.message);
        }

        // 8. Auto-create draft supplier invoice if invoice number was provided
        let supplierInvoice = null;
        if (resolvedInvoiceNumber) {
            try {
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
            } catch (invErr: any) {
                logger.error('Failed to create supplier invoice from GRN:', invErr);
            }
        }

        logger.info(`Branch ${branchId} posted GRN ${grnNumber} from supplier ${supplier.name} with ${bulkItems.length} items`);

        res.status(201).json({
            success: true,
            message: `GRN ${grnNumber} posted, branch stock updated, and purchase order updated`,
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
