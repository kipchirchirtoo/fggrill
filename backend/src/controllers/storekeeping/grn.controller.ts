import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { recordAuditTrail } from '../../utils/audit';
import { generateGRNPDF } from '../../services/native-pdf-reports.service';
import { ensureInventoryLocation } from './items.controller';
import { postGrnFoundationMovements } from '../../services/branch-inventory.service';

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

const sameNormalizedText = (left: any, right: any): boolean => {
    const normalizedLeft = normalizeText(left)?.toLowerCase() || null;
    const normalizedRight = normalizeText(right)?.toLowerCase() || null;
    return !!normalizedLeft && normalizedLeft === normalizedRight;
};

const resolveReceivingBranchId = async (req: Request): Promise<number | null> => {
    const userBranchId = req.user?.branch_id ? Number(req.user.branch_id) : null;
    if (req.user?.role !== 'central_storekeeper') {
        return Number.isFinite(userBranchId) ? userBranchId : null;
    }

    const { data: kyogong, error: kyogongError } = await supabase
        .from('branches')
        .select('id, code, name')
        .eq('id', 1)
        .limit(1)
        .maybeSingle();

    if (kyogongError) throw kyogongError;

    if (kyogong && (kyogong.code === 'KYO' || String(kyogong.name || '').toLowerCase() === 'kyogong')) {
        if (Number(kyogong.id) !== userBranchId) {
            logger.warn(`Central GRN branch remapped from user branch ${userBranchId || 'none'} to Kyogong central branch ${kyogong.id}`);
        }
        return Number(kyogong.id);
    }

    const { data: central, error } = await supabase
        .from('branches')
        .select('id')
        .eq('is_central_warehouse', true)
        .limit(1)
        .maybeSingle();

    if (error) throw error;

    if (central?.id && Number(central.id) !== userBranchId) {
        logger.warn(`Central GRN branch remapped from user branch ${userBranchId || 'none'} to central warehouse ${central.id}`);
    }

    return central?.id ? Number(central.id) : (Number.isFinite(userBranchId) ? userBranchId : null);
};

const findExistingMatchingGRN = async (params: {
    poId?: string;
    supplierId: string;
    invoiceNumber: string | null;
    deliveryNoteNumber: string | null;
    totalItems: number;
    totalQuantity: number;
    totalValue: number;
}) => {
    if (!params.poId) return null;

    const { data: candidates, error } = await supabase
        .from('store_grn')
        .select('*')
        .eq('purchase_order_id', params.poId)
        .eq('supplier_id', params.supplierId)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) throw error;

    const retryWindowStart = Date.now() - 15 * 60 * 1000;
    return (candidates || []).find((grn: any) => {
        if (sameNormalizedText(grn.invoice_number, params.invoiceNumber)) return true;
        if (sameNormalizedText(grn.delivery_note_number, params.deliveryNoteNumber)) return true;

        const createdAt = Date.parse(grn.created_at || '');
        const isRecentRetry = Number.isFinite(createdAt) && createdAt >= retryWindowStart;
        if (!isRecentRetry) return false;

        const sameTotals =
            toNumber(grn.total_items) === params.totalItems &&
            Math.abs(toNumber(grn.total_quantity) - params.totalQuantity) < 0.0001 &&
            Math.abs(toNumber(grn.total_value) - params.totalValue) < 0.0001;

        return sameTotals;
    }) || null;
};

const reconcilePOItemsFromGRNs = async (poId: string, poItems: any[]) => {
    const { data: grns, error: grnError } = await supabase
        .from('goods_receipts')
        .select('id, status')
        .eq('purchase_order_id', poId);

    if (grnError) throw grnError;

    const activeGrns = (grns || []).filter((grn: any) => String(grn.status || '').toLowerCase() !== 'cancelled');
    const grnIds = activeGrns.map((grn: any) => grn.id).filter(Boolean);
    const { data: grnItems, error: grnItemsError } = grnIds.length > 0
        ? await supabase
            .from('store_grn_items')
            .select('po_item_id, item_id, accepted_quantity, quantity_accepted, quantity_received')
            .in('grn_id', grnIds)
        : { data: [], error: null } as any;

    if (grnItemsError) throw grnItemsError;

    const receivedByPOItem = new Map<string, number>();
    const receivedBySku = new Map<string, number>();
    for (const item of grnItems || []) {
        const qty = toNumber(item.accepted_quantity ?? item.quantity_accepted ?? item.quantity_received);
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

const assertPurchaseOrderCanReceive = async (poId?: string) => {
    if (!poId) return;

    const { data: po, error: poError } = await supabase
        .from('store_purchase_orders')
        .select('id, status, sent_to_supplier')
        .eq('id', poId)
        .maybeSingle();

    if (poError) throw poError;
    if (!po) throw new AppError('Purchase order not found', 404);

    const { data: poItems, error: poItemsError } = await supabase
        .from('store_po_items')
        .select('id, item_id, quantity_ordered, quantity_received, quantity_pending')
        .eq('purchase_order_id', poId);

    if (poItemsError) throw poItemsError;

    const reconciledItems = await reconcilePOItemsFromGRNs(poId, poItems || []);
    const totalPending = reconciledItems.reduce((sum: number, item: any) => {
        const ordered = toNumber(item.quantity_ordered);
        const received = toNumber(item.quantity_received);
        const pending = item.quantity_pending == null
            ? Math.max(0, ordered - received)
            : toNumber(item.quantity_pending);
        return sum + pending;
    }, 0);
    const totalReceived = reconciledItems.reduce((sum: number, item: any) => {
        return sum + toNumber(item.quantity_received);
    }, 0);

    if (totalPending <= 0.0001) {
        throw new AppError('Purchase order has already been fully received. Open the existing GRN instead of posting again.', 409);
    }

    if (po.status === 'fully_received') {
        const repairedStatus = totalReceived > 0
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
        logger.warn(`Repaired stale fully_received PO ${poId} to ${repairedStatus}; ${totalPending} units still pending.`);
    }
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
            .eq('purchase_order_id', poId);

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
        .eq('purchase_order_id', poId);

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

    const nextStatus = totalPending <= 0.0001 ? 'fully_received' : 'partially_received';
    const updatePayload: any = {
        status: nextStatus,
        updated_at: new Date().toISOString()
    };

    if (totalPending <= 0.0001) {
        updatePayload.approved_by_id = userId || null;
        updatePayload.approved_at = new Date().toISOString();
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
            supplier_invoice_id: invoice.id,
            item_id: item.item_id,
            goods_receipt_line_id: item.id || null,
            description: detail?.item_name || detail?.description || item.item_id,
            quantity: qty,
            unit: detail?.unit || 'units',
            unit_price: unitPrice,
            line_total: qty * unitPrice
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
        if (po_id) query = query.eq('purchase_order_id', po_id);
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

        // Fetch item details from inventory_items using UUID
        const itemUuids = items?.map((i: any) => i.item_id).filter(Boolean) || [];
        let enrichedItems = items || [];

        if (itemUuids.length > 0) {
            const { data: itemDetails, error: detailsError } = await supabase
                .from('inventory_items')
                .select('id, sku, item_name, unit, category')
                .in('id', itemUuids);

            if (detailsError) {
                logger.warn('Could not fetch inventory_items for GRN:', detailsError.message);
            }

            enrichedItems = (items || []).map((item: any) => {
                const detail = (itemDetails || []).find((d: any) => d.id === item.item_id);
                return {
                    ...item,
                    item: detail ? {
                        id: detail.id,
                        name: detail.item_name,
                        item_code: detail.sku,
                        unit: detail.unit || 'units',
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
                purchase_order:store_purchase_orders(*)
            `)
            .eq('id', id)
            .single();

        if (grnError) {
            logger.error('Supabase error fetching GRN for PDF:', grnError);
            throw new AppError(`Failed to fetch GRN: ${grnError.message}`, 500);
        }

        if (!grn) {
            throw new AppError('GRN not found', 404);
        }

        let receivedBy = null;
        const receiverId = grn.received_by || grn.received_by_id;
        if (receiverId) {
            const { data: authUser, error: authUserError } =
                await supabase.auth.admin.getUserById(receiverId);

            if (authUserError) {
                logger.warn(`Could not load auth user for GRN receiver ${receiverId}: ${authUserError.message}`);
            } else if (authUser?.user) {
                const metadata = authUser.user.user_metadata || {};
                const fullName = [metadata.first_name, metadata.last_name]
                    .map((part: any) => normalizeText(part))
                    .filter(Boolean)
                    .join(' ');
                receivedBy = {
                    id: authUser.user.id,
                    name: fullName || metadata.name || null,
                    email: authUser.user.email || null
                };
            }
        }

        const { data: items, error: itemsError } = await supabase
            .from('goods_receipt_lines')
            .select('*')
            .eq('goods_receipt_id', id);

        if (itemsError) throw itemsError;

        const itemUuids = [...new Set((items || []).map((item: any) => item.item_id).filter(Boolean))];
        const { data: itemDetails, error: detailsError } = itemUuids.length
            ? await supabase
                .from('inventory_items')
                .select('id, sku, item_name, unit, category')
                .in('id', itemUuids)
            : { data: [], error: null } as any;

        if (detailsError) throw detailsError;

        const itemMap = new Map<string, any>(
            (itemDetails || []).map((item: any) => [item.id, item] as [string, any])
        );
        const enrichedItems = (items || []).map((item: any) => ({
            ...item,
            item: itemMap.get(item.item_id) || null
        }));

        const pdfBuffer = await generateGRNPDF({ ...grn, received_by: receivedBy }, enrichedItems);
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
        const receivingBranchId = await resolveReceivingBranchId(req);

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

        const itemUuids: string[] = [...new Set<string>(normalizedItems.map((item: any) => String(item.item_id)))];
        const { data: inventoryItems, error: storeItemsError } = await supabase
            .from('inventory_items')
            .select('id, sku, item_name, unit')
            .in('id', itemUuids);

        if (storeItemsError) throw storeItemsError;

        const itemDetails = new Map<string, any>(
            (inventoryItems || []).map((item: any) => [item.id, item] as [string, any])
        );
        const missingItems = itemUuids.filter((uuid: string) => !itemDetails.has(uuid));
        if (missingItems.length > 0) {
            throw new AppError(`Cannot post GRN. Missing inventory items: ${missingItems.join(', ')}`, 400);
        }

        const grn_number = await generateGRNNumber();
        const resolvedGrnDate = grn_date || new Date().toISOString().split('T')[0];

        // Calculate totals
        const total_items = normalizedItems.length;
        const total_quantity = normalizedItems.reduce((sum: number, item: any) => sum + Number(item.quantity_received), 0);
        const total_value = normalizedItems.reduce((sum: number, item: any) => sum + (Number(item.quantity_received) * Number(item.unit_price)), 0);
        const resolvedInvoiceNumber = normalizeText(invoice_number);
        const resolvedDeliveryNoteNumber = normalizeText(delivery_note_number);

        const existingGRN = await findExistingMatchingGRN({
            poId: po_id,
            supplierId: supplier_id,
            invoiceNumber: resolvedInvoiceNumber,
            deliveryNoteNumber: resolvedDeliveryNoteNumber,
            totalItems: total_items,
            totalQuantity: total_quantity,
            totalValue: total_value
        });

        if (existingGRN) {
            logger.warn(`Duplicate GRN post ignored for PO ${po_id}. Returning existing GRN ${existingGRN.grn_number}`);
            res.status(200).json({
                success: true,
                duplicate: true,
                message: `Matching GRN ${existingGRN.grn_number} already exists`,
                data: {
                    ...existingGRN,
                    duplicate: true
                }
            });
            return;
        }

        await assertPurchaseOrderCanReceive(po_id);

        // Start transaction (manual handling via separate calls as Supabase JS doesn't support transactions directly)
        // Note: For production, using a PostgreSQL RPC for the whole transaction is safer.

        // 1. Create GRN header
        const { data: newGRN, error: grnError } = await supabase
            .from('goods_receipts')
            .insert({
                grn_number,
                purchase_order_id: po_id || null,
                supplier_id,
                branch_id: receivingBranchId,
                delivery_note_number: resolvedDeliveryNoteNumber,
                invoice_number: resolvedInvoiceNumber,
                total_quantity,
                total_value,
                received_by: userId || null,
                status: 'draft',
                notes: remarks || null
            })
            .select()
            .single();

        if (grnError) throw grnError;

        // 2. Create GRN items
        const grnItems = normalizedItems.map((item: any) => {
            const detail = itemDetails.get(String(item.item_id));
            return {
                goods_receipt_id: newGRN.id,
                purchase_order_line_id: item.po_item_id || null,
                item_id: item.item_id,
                item_name: detail?.item_name || String(item.item_id),
                sku: detail?.sku || '',
                quantity_ordered: item.quantity_ordered,
                quantity_received: item.quantity_received,
                quantity_accepted: item.quantity_accepted || item.quantity_received,
                quantity_rejected: item.quantity_rejected || 0,
                unit: item.unit_of_measure || detail?.unit || 'units',
                unit_price: item.unit_price,
                line_total: Number(item.quantity_received) * Number(item.unit_price),
                quality_status: item.quality_status || 'accepted',
            };
        });

        const { data: savedGrnItems, error: itemsError } = await supabase
            .from('goods_receipt_lines')
            .insert(grnItems)
            .select();

        if (itemsError) {
            // Cleanup on error (manual rollback)
            const { error } = await supabase.from('goods_receipts').delete().eq('id', newGRN.id);
            if (error) {
              console.error('Database error:', error);
              throw error;
            }
            throw itemsError;
        }

        // 3. AUTO-APPROVE GRN and update stock immediately
        logger.info(`Auto-approving GRN ${grn_number}...`);

        // Find (or auto-create) the branch's inventory location
        const branchId = receivingBranchId;
        let locationId: string | null = null;
        try {
            locationId = await ensureInventoryLocation(supabase, branchId || undefined);
        } catch (locErr: any) {
            logger.warn(`Could not resolve inventory location for branch ${branchId}: ${locErr.message}`);
        }

        // Prepare items array for the bulk stored procedure
        const bulkItems = (savedGrnItems || grnItems).map((item: any) => ({
            item_id: item.item_id,
            sku: item.sku,
            qty: Number(item.quantity_accepted || item.quantity_received),
            unit_price: Number(item.unit_price || 0)
        }));

        logger.info(`Executing bulk stock updates for GRN ${grn_number} via database RPC...`);
        const { error: bulkStockError } = await supabase
            .rpc('bulk_post_grn_stock_update', {
                p_branch_id: branchId || null,
                p_location_id: locationId,
                p_items: bulkItems,
                p_user_id: userId || null,
                p_reference_id: newGRN.id,
                p_reference_number: grn_number,
                p_remarks: remarks || ''
            });

        if (bulkStockError) {
            logger.error('Bulk stock update RPC failed:', bulkStockError);
            throw bulkStockError;
        }

        // Update master item catalog default cost price
        for (const it of bulkItems) {
            if (it.item_id && it.unit_price > 0) {
                try {
                    const { error: syncCostError } = await supabase
                        .from('inventory_items')
                        .update({ default_unit_cost: it.unit_price, updated_at: new Date().toISOString() })
                        .eq('id', it.item_id);
                    if (syncCostError) {
                        logger.warn(`Failed to update standard catalog price for item ${it.sku}: ${syncCostError.message}`);
                    }
                } catch (err: any) {
                    logger.warn(`Failed to update standard catalog price for item ${it.sku}: ${err?.message}`);
                }
            }
        }

        // Log each item into the Foundation Service inventory_movements audit
        // trail (best-effort — never blocks the GRN response if this fails).
        postGrnFoundationMovements({
            branchId: branchId || 0,
            actorId: userId || '',
            grnNumber: grn_number,
            grnId: newGRN.id,
            items: bulkItems.map((it: any) => ({
                sku: it.sku,
                item_name: (itemDetails instanceof Map ? itemDetails.get(it.sku)?.item_name : (itemDetails as any)?.[it.sku]?.item_name) || it.sku,
                qty: it.qty,
                unit_price: it.unit_price
            }))
        }).catch((err: any) => logger.warn('postGrnFoundationMovements failed:', err?.message));

        const updatedPurchaseOrder = await updatePurchaseOrderReceipt(po_id, (savedGrnItems || grnItems), userId);
        
        // Mark GRN as posted (auto-approved)
        await supabase
            .from('goods_receipts')
            .update({ status: 'posted' })
            .eq('id', newGRN.id);

        logger.info(`GRN ${grn_number} auto-approved and stock updated`);

        let supplierInvoice = null;
        // 4. Create a DRAFT Supplier Invoice automatically if invoice_number is provided
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
            .from('goods_receipts')
            .update({
                status: 'rejected',
                notes: reason ? `Rejected: ${reason}` : 'Rejected',
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

// @desc    Backfill inventory_balances from all posted GRNs (idempotent)
// @route   POST /api/procurement/grn/backfill-stock
// @access  Private (Admin/GM)
export const backfillGRNStock = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const result = await runGRNStockBackfill();
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        logger.error('Error in GRN stock backfill:', error);
        next(error);
    }
};

/**
 * Reconcile inventory_balances from all posted GRNs.
 * Idempotent — safe to call on startup or multiple times.
 * Only increases balances; never reduces them.
 */
export async function runGRNStockBackfill(): Promise<{ updated: number; created: number; branches: number }> {
    const { data: grns, error: grnsError } = await supabase
        .from('goods_receipts')
        .select('id, branch_id, status')
        .eq('status', 'posted');

    if (grnsError) throw grnsError;
    if (!grns || grns.length === 0) return { updated: 0, created: 0, branches: 0 };

    const grnIds = grns.map((g: any) => g.id);
    const grnBranchMap = new Map<string, number>(grns.map((g: any) => [g.id, g.branch_id]));

    const { data: lines, error: linesError } = await supabase
        .from('goods_receipt_lines')
        .select('goods_receipt_id, item_id, quantity_accepted, quantity_received, unit_price')
        .in('goods_receipt_id', grnIds);

    if (linesError) throw linesError;

    // Sum quantities per (branch_id, item_id)
    const sums = new Map<string, { qty: number; unitPrice: number; branchId: number; itemId: string }>();
    for (const line of lines || []) {
        const branchId = grnBranchMap.get(line.goods_receipt_id);
        if (!branchId || !line.item_id) continue;
        const qty = toNumber(line.quantity_accepted ?? line.quantity_received);
        const key = `${branchId}::${line.item_id}`;
        const existing = sums.get(key);
        if (existing) {
            existing.qty += qty;
        } else {
            sums.set(key, { qty, unitPrice: toNumber(line.unit_price), branchId, itemId: line.item_id });
        }
    }

    const branchIds = [...new Set([...sums.values()].map(v => v.branchId))];
    const locationMap = new Map<number, string>();
    for (const branchId of branchIds) {
        try {
            const locId = await ensureInventoryLocation(supabase, branchId);
            locationMap.set(branchId, locId);
        } catch (err: any) {
            logger.warn(`Backfill: could not resolve location for branch ${branchId}: ${err.message}`);
        }
    }

    let created = 0;
    let updated = 0;

    for (const { qty, unitPrice, branchId, itemId } of sums.values()) {
        const locationId = locationMap.get(branchId);
        if (!locationId || qty <= 0) continue;

        const { data: existing } = await supabase
            .from('inventory_balances')
            .select('id, current_quantity')
            .eq('item_id', itemId)
            .eq('location_id', locationId)
            .is('batch_id', null)
            .maybeSingle();

        if (existing) {
            const current = toNumber(existing.current_quantity);
            if (qty > current) {
                await supabase
                    .from('inventory_balances')
                    .update({ current_quantity: qty, unit_cost: unitPrice })
                    .eq('id', existing.id);
                updated++;
                logger.info(`Backfill: item ${itemId} branch ${branchId} ${current} → ${qty}`);
            }
        } else {
            await supabase
                .from('inventory_balances')
                .insert({ item_id: itemId, location_id: locationId, current_quantity: qty, unit_cost: unitPrice });
            created++;
            logger.info(`Backfill: item ${itemId} branch ${branchId} created qty=${qty}`);
        }
    }

    logger.info(`GRN stock backfill complete: ${created} created, ${updated} updated across ${branchIds.length} branches`);
    return { created, updated, branches: branchIds.length };
}
