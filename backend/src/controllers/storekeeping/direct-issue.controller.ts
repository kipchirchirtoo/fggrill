import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { updateBranchStock } from '../../services/branch-inventory.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const normalizeSku = (sku: unknown): string => {
    if (sku === null || sku === undefined) return '';
    return String(sku).trim();
};

const SIMPLE_ITEM_SELECT = 'sku, item_name, description, quantity, store_type, is_active';

// ---------------------------------------------------------------------------
// POST /api/storekeeping/direct-issues
// Creates a Direct Issue by reusing stock_requests with request_type='DIRECT_ISSUE'
// Body: { branch_id, reason, items: [{item_sku, qty, unit_cost?, linked_requisition_item_id?}] }
// ---------------------------------------------------------------------------
export const createDirectIssue = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, reason, items } = req.body;
        const userId = req.user?.id;

        // --- Validate input ---
        if (!branch_id) {
            throw new AppError('branch_id is required', 400);
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            throw new AppError('items array is required and must not be empty', 400);
        }
        for (const item of items) {
            if (!item.item_sku) {
                throw new AppError('Each item must have an item_sku', 400);
            }
            if (item.qty === undefined || item.qty === null || isNaN(Number(item.qty)) || Number(item.qty) <= 0) {
                throw new AppError(`Item ${item.item_sku}: qty must be a positive number`, 400);
            }
        }

        // --- Resolve branch code for issue number ---
        const { data: branchData, error: branchError } = await supabase
            .from('branches')
            .select('id, code, name')
            .eq('id', branch_id)
            .maybeSingle();

        if (branchError) throw branchError;
        if (!branchData) {
            throw new AppError('Branch not found', 404);
        }

        const branchCode = branchData.code || `BR${branch_id}`;
        const branchName = branchData.name || `Branch ${branch_id}`;
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const seq = Date.now().toString().slice(-4);
        const issueNumber = `DIS-${branchCode}-${dateStr}-${seq}`;

        const now = new Date().toISOString();

        // --- Create stock_request record with request_type='DIRECT_ISSUE' ---
        const { data: newRequest, error: requestError } = await supabase
            .from('stock_requests')
            .insert({
                request_number: issueNumber,
                document_number: issueNumber,
                barcode_value: issueNumber,
                branch_id,
                requesting_branch_id: branch_id,
                requested_by: userId,
                request_type: 'DIRECT_ISSUE',
                priority: 'normal',
                reason: reason || 'Direct issue from central store',
                status: 'DISPATCHED',
                workflow_status: 'dispatched',
                dispatched_at: now,
                submitted_to_auditor_at: now
            })
            .select()
            .single();

        if (requestError) throw requestError;

        // --- Resolve inventory_items.id and unit, and catalog names for movement records ---
        const skusToResolve = [...new Set(items.map((i: any) => normalizeSku(i.item_sku)).filter(Boolean))];
        const { data: invItems } = await supabase
            .from('inventory_items')
            .select('id, sku, unit')
            .in('sku', skusToResolve);
        const invBySkuUpper = new Map(
            (invItems || []).map((ii: any) => [String(ii.sku).trim().toUpperCase(), ii])
        );
        const resolveInv = (sku: string) =>
            invBySkuUpper.get(sku.trim().toUpperCase());

        // Pre-load catalog names for movement audit rows
        const { data: catalogForMovements } = await supabase
            .from('simple_items')
            .select(SIMPLE_ITEM_SELECT)
            .in('sku', skusToResolve);
        const catalogBySku = new Map(
            (catalogForMovements || []).map((ci: any) => [normalizeSku(ci.sku), ci])
        );

        // --- Insert stock_request_items ---
        const itemRows = items.map((item: any) => {
            const sku = normalizeSku(item.item_sku);
            const inv = resolveInv(sku);
            if (!inv) {
                throw new AppError(`Item SKU "${sku}" not found in inventory catalog`, 400);
            }
            return {
                request_id: newRequest.id,
                branch_requisition_id: newRequest.id,
                item_id: inv.id,
                item_sku: sku,
                unit: inv.unit || 'Unit',
                requested_quantity: Number(item.qty),
                approved_quantity: Number(item.qty),
                issued_qty: Number(item.qty),
                issue_status: 'issued',
                status: 'APPROVED',
                workflow_status: 'dispatched',
                reason: item.reason || reason || null,
                unit_cost: item.unit_cost ? Number(item.unit_cost) : null,
            };
        });

        const { error: itemsInsertError } = await supabase
            .from('stock_request_items')
            .insert(itemRows);

        if (itemsInsertError) throw itemsInsertError;

        // --- Deduct from central store, increase branch stock, write movement records ---
        const deductionErrors: string[] = [];

        for (const item of items) {
            const issuedQty = Number(item.qty);
            const sku = normalizeSku(item.item_sku);
            const catalogItem = catalogBySku.get(sku);
            const itemName = catalogItem?.item_name || sku;

            // 1. Deduct from simple_items (central store)
            const { data: currentItem } = await supabase
                .from('simple_items')
                .select('quantity')
                .eq('sku', sku)
                .maybeSingle();

            let previousCentralQty = 0;
            let newCentralQty = 0;

            if (currentItem) {
                previousCentralQty = Number(currentItem.quantity || 0);
                newCentralQty = Math.max(0, previousCentralQty - issuedQty);
                const { error: deductError } = await supabase
                    .from('simple_items')
                    .update({ quantity: newCentralQty, updated_at: now })
                    .eq('sku', sku);

                if (deductError) {
                    logger.warn(`Direct issue: failed to deduct central stock for SKU ${sku}:`, deductError);
                    deductionErrors.push(sku);
                }
            } else {
                logger.warn(`Direct issue: SKU ${sku} not found in simple_items — skipping deduction`);
            }

            // 2. Write central store STOCK_OUT movement record
            supabase.from('branch_stock_movements').insert({
                branch_id: 1, // central store (branch 1)
                item_sku: sku,
                movement_type: 'STOCK_OUT',
                quantity: issuedQty,
                reference: issueNumber,
                reference_type: 'direct_issue',
                reference_id: newRequest.id,
                notes: `Direct Issue ${issueNumber} to ${branchName}: ${itemName}`,
                performed_by: userId || null,
                created_by: userId || null,
                previous_stock: previousCentralQty,
                new_stock: newCentralQty,
            }).then(({ error: mvErr }) => {
                if (mvErr) logger.warn('branch_stock_movements insert failed (direct issue OUT):', mvErr.message);
            });

            // 3. Increase branch stock at receiving branch
            try {
                await updateBranchStock(
                    Number(branch_id),
                    sku,
                    issuedQty,           // positive = add stock
                    'DIRECT_ISSUE_IN',   // movementType
                    userId || '',        // userId
                    'direct_issue',      // referenceType
                    newRequest.id,       // referenceId
                    issueNumber,         // referenceNumber
                    `Direct Issue ${issueNumber} from Central Store: ${itemName}`
                );

                // 4. Write branch STOCK_IN movement record
                const { data: branchStockRow } = await supabase
                    .from('branch_stock')
                    .select('quantity')
                    .eq('branch_id', branch_id)
                    .eq('item_sku', sku)
                    .maybeSingle();

                supabase.from('branch_stock_movements').insert({
                    branch_id: Number(branch_id),
                    item_sku: sku,
                    movement_type: 'STOCK_IN',
                    quantity: issuedQty,
                    reference: issueNumber,
                    reference_type: 'direct_issue',
                    reference_id: newRequest.id,
                    notes: `Received via Direct Issue ${issueNumber} from Central Store: ${itemName}`,
                    performed_by: userId || null,
                    created_by: userId || null,
                    new_stock: Number(branchStockRow?.quantity || 0),
                }).then(({ error: mvErr }) => {
                    if (mvErr) logger.warn('branch_stock_movements insert failed (direct issue IN):', mvErr.message);
                });
            } catch (branchStockErr: any) {
                logger.warn(`Direct issue: failed to increase branch stock for SKU ${sku}:`, branchStockErr.message);
                deductionErrors.push(`branch_stock:${sku}`);
            }

            // 5. If linked to a requisition item, mark it as issued
            if (item.linked_requisition_item_id) {
                await supabase
                    .from('stock_request_items')
                    .update({
                        issue_status: 'issued',
                        issued_qty: issuedQty,
                        updated_at: now
                    })
                    .eq('id', item.linked_requisition_item_id);
            }
        }

        // --- Fetch complete record with items ---
        const { data: completeRequest } = await supabase
            .from('stock_requests')
            .select('*')
            .eq('id', newRequest.id)
            .single();

        const { data: createdItems } = await supabase
            .from('stock_request_items')
            .select('*')
            .eq('request_id', newRequest.id)
            .order('created_at', { ascending: true });

        // Enrich items with catalog data
        const skus = (createdItems || []).map((i: any) => normalizeSku(i.item_sku)).filter(Boolean);
        const enrichedItems = (createdItems || []).map((item: any) => {
            const sku = normalizeSku(item.item_sku);
            const catalog = catalogBySku.get(sku);
            return {
                ...item,
                item_name: catalog?.item_name || sku,
                item: catalog ? { ...catalog, category: catalog.store_type || null, unit: 'Unit' } : {
                    sku,
                    item_name: sku || 'Unknown item',
                    description: null,
                    category: null,
                    unit: 'Unit',
                    quantity: null
                }
            };
        });
        void skus; // used only for catalog lookup above

        logger.info(`Direct issue created: ${issueNumber} for branch ${branchName} (${branch_id}), items: ${items.length}, deduction errors: ${deductionErrors.length}`);

        res.status(201).json({
            success: true,
            data: {
                ...completeRequest,
                issue_number: issueNumber,
                request_number: issueNumber,
                branch_name: branchName,
                to_branch_name: branchName,
                branch_id: Number(branch_id),
                items: enrichedItems,
                deduction_errors: deductionErrors
            }
        });
    } catch (error) {
        logger.error('Error creating direct issue:', error);
        next(error);
    }
};

// ---------------------------------------------------------------------------
// GET /api/storekeeping/direct-issues?branch_id=
// ---------------------------------------------------------------------------
export const getDirectIssues = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, from_date, to_date } = req.query;

        let query = supabase
            .from('stock_requests')
            .select(`
                *,
                requested_by_user:users!requested_by(id, first_name, last_name, email)
            `)
            .eq('request_type', 'DIRECT_ISSUE')
            .order('created_at', { ascending: false })
            .limit(100);

        if (branch_id) {
            query = query.eq('branch_id', branch_id as string);
        }
        if (from_date) {
            query = query.gte('created_at', from_date as string);
        }
        if (to_date) {
            query = query.lte('created_at', to_date as string);
        }

        const { data: directIssues, error } = await query;
        if (error) throw error;

        if (!directIssues || directIssues.length === 0) {
            res.status(200).json({ success: true, count: 0, data: [] });
            return;
        }

        // Resolve branch names via a direct query (avoids FK join issues)
        const branchIds = [...new Set(
            directIssues.map((r: any) => r.branch_id).filter(Boolean)
        )];
        const branchById: Map<number | string, string> = new Map();
        if (branchIds.length > 0) {
            const { data: branchRows } = await supabase
                .from('branches')
                .select('id, name')
                .in('id', branchIds);
            (branchRows || []).forEach((b: any) => {
                branchById.set(b.id, b.name);
                branchById.set(String(b.id), b.name);
            });
        }

        // Fetch items for all direct issues
        const requestIds = directIssues.map((r: any) => r.id);
        const { data: allItems } = await supabase
            .from('stock_request_items')
            .select('*')
            .in('request_id', requestIds)
            .order('created_at', { ascending: true });

        // Build item map by request
        const itemsByRequest: Record<string, any[]> = {};
        (allItems || []).forEach((item: any) => {
            const rid = String(item.request_id);
            if (!itemsByRequest[rid]) itemsByRequest[rid] = [];
            itemsByRequest[rid].push(item);
        });

        // Enrich with catalog item names
        const skus = [...new Set((allItems || []).map((i: any) => normalizeSku(i.item_sku)).filter(Boolean))];
        let itemMap: Map<string, any> = new Map();
        if (skus.length > 0) {
            const { data: catalogItems } = await supabase
                .from('simple_items')
                .select(SIMPLE_ITEM_SELECT)
                .in('sku', skus);
            itemMap = new Map((catalogItems || []).map((ci: any) => [normalizeSku(ci.sku), ci]));
        }

        const result = directIssues.map((r: any) => {
            // Resolve branch name from the explicit branches lookup
            const branchName = branchById.get(r.branch_id)
                || branchById.get(String(r.branch_id))
                || r.branch_name
                || r.to_branch_name
                || r.requesting_branch_name
                || null;

            // Resolve requester name
            const requester = r.requested_by_user as any;
            const requesterName = requester
                ? `${requester.first_name || ''} ${requester.last_name || ''}`.trim() || requester.email || null
                : null;

            // issue_number: use request_number (stored as DIS-...) if issue_number not in DB
            const issueNumber = r.issue_number || r.request_number || r.document_number || r.id;

            const enrichedItems = (itemsByRequest[String(r.id)] || []).map((item: any) => {
                const sku = normalizeSku(item.item_sku);
                const catalog = itemMap.get(sku);
                return {
                    ...item,
                    item_name: catalog?.item_name || item.item_name || sku,
                    item: catalog
                        ? { ...catalog, category: catalog.store_type || null, unit: 'Unit' }
                        : { sku, item_name: sku || 'Unknown item', description: null, category: null, unit: 'Unit', quantity: null }
                };
            });

            return {
                ...r,
                // Display-safe computed fields
                issue_number: issueNumber,
                request_number: r.request_number || r.document_number || r.id,
                branch_name: branchName,
                to_branch_name: branchName,
                requester_name: requesterName,
                items: enrichedItems,
                items_count: enrichedItems.length,
                total_value: enrichedItems.reduce((sum: number, it: any) => {
                    return sum + (Number(it.issued_qty || it.approved_quantity || 0) * Number(it.unit_cost || 0));
                }, 0),
            };
        });

        res.status(200).json({
            success: true,
            count: result.length,
            data: result
        });
    } catch (error) {
        logger.error('Error fetching direct issues:', error);
        next(error);
    }
};


// ---------------------------------------------------------------------------
// GET /api/storekeeping/backorders?branch_id=
// Returns stock_request_items where issue_status='backordered'
// ---------------------------------------------------------------------------
export const getBackorders = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id } = req.query;

        // Fetch backordered items joined to parent requests
        let requestQuery = supabase
            .from('stock_requests')
            .select('id, request_number, branch_id, requesting_branch_id, status, workflow_status, created_at, needed_by_date, priority')
            .neq('request_type', 'DIRECT_ISSUE'); // Exclude direct issues from backorder tracking

        if (branch_id) {
            requestQuery = requestQuery.eq('branch_id', branch_id as string);
        }

        const { data: requests, error: requestsError } = await requestQuery;
        if (requestsError) throw requestsError;

        if (!requests || requests.length === 0) {
            res.status(200).json({ success: true, count: 0, data: [] });
            return;
        }

        const requestIds = requests.map((r: any) => r.id);

        // Fetch backordered items
        const { data: backorderedItems, error: itemsError } = await supabase
            .from('stock_request_items')
            .select('*')
            .in('request_id', requestIds)
            .eq('issue_status', 'backordered')
            .order('created_at', { ascending: true });

        if (itemsError) throw itemsError;

        if (!backorderedItems || backorderedItems.length === 0) {
            res.status(200).json({ success: true, count: 0, data: [] });
            return;
        }

        // Build request lookup
        const requestMap: Record<string, any> = {};
        requests.forEach((r: any) => { requestMap[String(r.id)] = r; });

        // Enrich with catalog data
        const skus = [...new Set(backorderedItems.map((i: any) => normalizeSku(i.item_sku)).filter(Boolean))];
        let itemMap: Map<string, any> = new Map();
        if (skus.length > 0) {
            const { data: catalogItems } = await supabase
                .from('simple_items')
                .select(SIMPLE_ITEM_SELECT)
                .in('sku', skus);
            itemMap = new Map((catalogItems || []).map((ci: any) => [normalizeSku(ci.sku), ci]));
        }

        const result = backorderedItems.map((item: any) => {
            const sku = normalizeSku(item.item_sku);
            const catalog = itemMap.get(sku);
            const parentRequest = requestMap[String(item.request_id)];

            return {
                ...item,
                item: catalog
                    ? { ...catalog, category: catalog.store_type || null, unit: 'Unit' }
                    : { sku, item_name: sku || 'Unknown item', description: null, category: null, unit: 'Unit', quantity: null },
                stock_request: parentRequest || null,
                backorder_qty: Number(item.approved_quantity || item.requested_quantity || 0) - Number(item.issued_qty || 0)
            };
        });

        res.status(200).json({
            success: true,
            count: result.length,
            data: result
        });
    } catch (error) {
        logger.error('Error fetching backorders:', error);
        next(error);
    }
};
