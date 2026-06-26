import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import db from '../../db';
import { logger } from '../../utils/logger';

// Store stocktake — storekeeper records physical counts for general store
// items (everything that isn't bar stock: foodstuffs, stationery,
// non_consumables) against the system quantity from branch_stock; the
// branch accountant reviews/approves/rejects. Mirrors bar-stocktake.controller.ts.
//
// KEY RELATIONSHIP:
//   inventory_items.sku  →  branch_stock.item_sku  (live store stock)
//   inventory_items.id   →  store_stocktake_records.item_id  (FK constraint)

const num = (v: any): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const NON_STORE_TYPES = ['bar_store'];

const loadRecord = async (id: string): Promise<Record<string, any> | null> => {
    const { data, error } = await supabase
        .from('store_stocktake_records')
        .select('*, item:inventory_items(id, item_name, unit, store_type, sku)')
        .eq('id', id)
        .maybeSingle();
    if (error) throw error;
    return data || null;
};

/**
 * Sync the store stocktake records for a branch/date into the unified
 * stock_counts / stock_count_items tables. This is the canonical source used
 * by the cashier shift opening gate (location = 'branch_store').
 */
const syncStoreStocktakeToStockCounts = async (
    branchId: number,
    stocktakeDate: string,
    status: string,
    reviewedBy: string | null = null,
    reviewedAt: string | null = null
): Promise<void> => {
    const { data: existing } = await supabase
        .from('stock_counts')
        .select('id')
        .eq('branch_id', branchId)
        .eq('count_date', stocktakeDate)
        .eq('location', 'branch_store')
        .eq('store_type', 'branch_store')
        .maybeSingle();

    let stockCountId: string;
    const now = new Date().toISOString();
    const headerData: any = {
        branch_id: branchId,
        count_date: stocktakeDate,
        count_type: 'daily',
        store_type: 'branch_store',
        location: 'branch_store',
        status,
        approved_by: reviewedBy,
        approved_at: reviewedAt
    };

    if (existing?.id) {
        stockCountId = existing.id;
        const { error } = await supabase
            .from('stock_counts')
            .update({ ...headerData, updated_at: now })
            .eq('id', stockCountId);
        if (error) throw error;
    } else {
        const { data: created, error } = await supabase
            .from('stock_counts')
            .insert({ ...headerData, created_at: now, updated_at: now })
            .select('id')
            .single();
        if (error) throw error;
        stockCountId = created!.id;
    }

    // Delete existing items so we can re-insert the latest set
    await supabase.from('stock_count_items').delete().eq('stock_count_id', stockCountId);

    const { data: records } = await supabase
        .from('store_stocktake_records')
        .select('*, item:inventory_items(id, item_name, sku)')
        .eq('branch_id', branchId)
        .eq('stocktake_date', stocktakeDate);

    const items = (records || []).map((r: any) => ({
        stock_count_id: stockCountId,
        item_id: r.item_id,
        item_sku: r.item?.sku || null,
        system_quantity: num(r.system_quantity),
        physical_quantity: num(r.physical_quantity),
        counted_quantity: num(r.physical_quantity),
        variance: num(r.variance),
        reason: r.notes || null,
        status,
        created_at: now,
        updated_at: now
    }));

    if (items.length > 0) {
        const { error } = await supabase.from('stock_count_items').insert(items);
        if (error) throw error;
    }
};

/**
 * @desc    List store stocktake records for a branch/date. Returns every
 *          non-bar store item merged with system stock and any previously
 *          recorded physical counts for the requested date.
 * @route   GET /api/storekeeping/store-stocktake?branch_id=&date=&status=
 * @access  Branch Storekeeper, Central Storekeeper, Branch Manager, Branch Accountant, Auditor, Super Admin
 */
export const listStoreStocktakes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, date, stocktake_date, status } = req.query;
        if (!branch_id) {
            res.status(400).json({ success: false, message: 'branch_id is required' });
            return;
        }
        const branchId = Number(branch_id);
        if (!Number.isInteger(branchId)) {
            res.status(400).json({ success: false, message: 'branch_id must be an integer' });
            return;
        }
        const rawDate = (stocktake_date as string) || (date as string) || new Date().toISOString().split('T')[0];

        // 1. Check for existing store_stocktake_records for this branch/date
        let recordsQuery = supabase
            .from('store_stocktake_records')
            .select('*, item:inventory_items(id, item_name, unit, store_type, category)')
            .eq('branch_id', branchId)
            .eq('stocktake_date', rawDate);
        if (status) recordsQuery = recordsQuery.eq('status', String(status));

        const { data: existingRecords, error: recErr } = await recordsQuery;
        if (recErr) throw recErr;

        if (existingRecords && existingRecords.length > 0) {
            const result = existingRecords.map((r: any) => ({
                ...r,
                item_name: r.item?.item_name || r.item_name || null,
                category: r.item?.category || null,
            }));
            res.status(200).json({ success: true, data: result });
            return;
        }

        // 2. No stocktake submitted yet — source ONLY from branch_stock for this branch.
        //    This ensures only items actually received into the branch appear,
        //    not global/central catalog items. Exclude bar_store items.
        const { data: branchStockRows, error: bsErr } = await supabase
            .from('branch_stock')
            .select('item_sku, quantity')
            .eq('branch_id', branchId);
        if (bsErr) throw bsErr;

        const stockRows = (branchStockRows || []) as Array<{ item_sku: string; quantity: number }>;
        if (stockRows.length === 0) {
            res.status(200).json({ success: true, data: [] });
            return;
        }

        const allSkus = stockRows.map((r) => r.item_sku).filter(Boolean);
        const stockBySkuMap = new Map(stockRows.map((r) => [r.item_sku, num(r.quantity)]));

        // Resolve item details from inventory_items (provides UUID FK for store_stocktake_records)
        const { data: invItems, error: invErr } = await supabase
            .from('inventory_items')
            .select('id, sku, item_name, unit, category, store_type')
            .in('sku', allSkus);
        if (invErr) throw invErr;

        // Build map SKU → inventory_items row, excluding bar_store
        const invMap = new Map(
            (invItems || [])
                .filter((i: any) => !NON_STORE_TYPES.includes(i.store_type))
                .map((i: any) => [i.sku as string, i])
        );

        // Fallback: for SKUs not in inventory_items, check simple_items
        const missingSkus = allSkus.filter((sku) => !invMap.has(sku));
        if (missingSkus.length > 0) {
            const { data: simpleRows } = await supabase
                .from('simple_items')
                .select('sku, item_name, unit, category, store_type')
                .in('sku', missingSkus)
                .not('store_type', 'in', `(${NON_STORE_TYPES.join(',')})`);
            for (const s of (simpleRows || [])) {
                // No UUID — will be skipped at submit. Listed here for visibility.
                invMap.set(s.sku, { id: null, ...s });
            }
        }

        // 3. Compute today's movements for opening stock, sales, and additions (SDDS)
        const dayStart = `${rawDate}T00:00:00.000Z`;
        const dayEnd   = `${rawDate}T23:59:59.999Z`;
        const resolvedSkus = allSkus.filter((sku) => invMap.has(sku));

        const salesBySku:     Record<string, number> = {};
        const additionsBySku: Record<string, number> = {};

        if (resolvedSkus.length > 0) {
            const { data: movRows } = await supabase
                .from('branch_stock_movements')
                .select('item_sku, movement_type, quantity')
                .eq('branch_id', branchId)
                .in('item_sku', resolvedSkus)
                .gte('created_at', dayStart)
                .lte('created_at', dayEnd);

            for (const mv of (movRows || []) as Array<{ item_sku: string; movement_type: string; quantity: number }>) {
                const sku = mv.item_sku;
                const qty = Math.abs(num(mv.quantity));
                const t   = (mv.movement_type || '').toUpperCase();
                if (['SALE', 'KITCHEN_USE', 'HOUSEKEEPING_USE', 'DAMAGE', 'LOSS',
                     'TRANSFER_OUT', 'ADJUSTMENT_OUT', 'DISPATCH_OUT', 'ISSUE'].includes(t)) {
                    salesBySku[sku] = (salesBySku[sku] ?? 0) + qty;
                } else if (['DISPATCH_RECEIVE', 'PURCHASE', 'ADJUSTMENT_IN',
                            'TRANSFER_IN', 'RETURN', 'RESTOCK'].includes(t)) {
                    additionsBySku[sku] = (additionsBySku[sku] ?? 0) + qty;
                }
            }
        }

        // 4. Build candidates — only items with a UUID in inventory_items
        const candidates = resolvedSkus
            .map((sku) => {
                const inv          = invMap.get(sku)!;
                if (!inv.id) return null; // skip if no UUID FK
                const currentStock = stockBySkuMap.get(sku) ?? 0;
                const sales        = salesBySku[sku]        ?? 0;
                const additions    = additionsBySku[sku]    ?? 0;
                const opening      = Math.max(0, currentStock + sales - additions);
                return {
                    item_id:          inv.id,
                    id:               inv.id,
                    sku,
                    item_name:        inv.item_name || sku,
                    name:             inv.item_name || sku,
                    unit:             inv.unit       || 'unit',
                    category:         inv.category  || 'GENERAL',
                    store_type:       inv.store_type,
                    opening_stock:    opening,
                    sales,
                    additions,
                    sdds:             -additions,
                    system_quantity:  currentStock,
                    quantity:         currentStock,
                    physical_quantity: null,
                };
            })
            .filter(Boolean);

        res.status(200).json({ success: true, data: candidates });
    } catch (error) {
        logger.error('listStoreStocktakes failed:', error);
        next(error);
    }
};

/**
 * @desc    Record physical counts for a store stocktake.
 * @route   POST /api/storekeeping/store-stocktake
 *          body: { branch_id, stocktake_date?, items: [{ item_id, physical_quantity }] }
 * @access  Branch Storekeeper, Central Storekeeper, Super Admin
 */
export const recordStoreStocktake = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, items } = req.body || {};
        const stocktakeDate = req.body?.stocktake_date || new Date().toISOString().split('T')[0];
        const branchId = Number(branch_id);
        if (!Number.isInteger(branchId)) {
            res.status(400).json({ success: false, message: 'branch_id must be an integer' });
            return;
        }
        if (!Array.isArray(items) || !items.length) {
            res.status(400).json({ success: false, message: 'items must be a non-empty array' });
            return;
        }

        const itemIds = items.map((it: any) => String(it.item_id));
        const { data: invRows } = await supabase
            .from('inventory_items')
            .select('id, sku')
            .in('id', itemIds);
        const skuById = new Map((invRows || []).map((i: any) => [i.id, i.sku]));

        const skus = Array.from(skuById.values()).filter(Boolean) as string[];
        let stockBySku: Record<string, number> = {};
        if (skus.length > 0) {
            const { data: stockRows } = await supabase
                .from('branch_stock')
                .select('item_sku, quantity')
                .eq('branch_id', branchId)
                .in('item_sku', skus);
            stockBySku = Object.fromEntries((stockRows || []).map((s: any) => [s.item_sku, num(s.quantity)]));
        }

        const now = new Date().toISOString();
        const rows = items
            .map((it: any) => {
                const itemId = String(it.item_id);
                const sku = skuById.get(itemId);
                if (!sku) {
                    logger.warn(`recordStoreStocktake: no inventory_items mapping for ${itemId}`);
                    return null;
                }
                return {
                    branch_id: branchId,
                    stocktake_date: stocktakeDate,
                    shift_id: req.body?.shift_id || null,
                    item_id: itemId,
                    system_quantity: stockBySku[sku] ?? 0,
                    physical_quantity: num(it.physical_quantity),
                    // variance is a GENERATED column — do NOT include it
                    recorded_by: req.user?.id || null,
                    recorded_at: now,
                    status: 'pending',
                };
            })
            .filter(Boolean);

        if (rows.length === 0) {
            res.status(400).json({ success: false, message: 'Could not resolve any items for stocktake' });
            return;
        }

        const { data, error } = await supabase
            .from('store_stocktake_records')
            .upsert(rows, { onConflict: 'branch_id,stocktake_date,item_id' })
            .select('*, item:inventory_items(id, item_name, unit, category, store_type)');
        if (error) throw error;

        // Sync into the unified stock_counts table so the cashier shift gate works.
        await syncStoreStocktakeToStockCounts(branchId, stocktakeDate, 'submitted');

        // Update branch_stock with the physical count so inventory stays live.
        // Each row: set quantity = physical_quantity, log a STOCKTAKE_ADJUSTMENT movement.
        const now2 = new Date().toISOString();
        for (const row of rows as Array<Record<string, any>>) {
            if (!row) continue;
            const sku = skuById.get(row.item_id);
            if (!sku) continue;
            const physQty = num(row.physical_quantity);
            const systemQty = num(row.system_quantity);

            // Update branch_stock
            await supabase
                .from('branch_stock')
                .upsert({
                    branch_id: branchId,
                    item_sku: sku,
                    quantity: physQty,
                    updated_at: now2,
                }, { onConflict: 'branch_id,item_sku' });

            // Log adjustment movement only when there's a variance
            const variance = physQty - systemQty;
            if (variance !== 0) {
                await supabase
                    .from('branch_stock_movements')
                    .insert({
                        branch_id: branchId,
                        item_sku: sku,
                        movement_type: variance > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
                        quantity: Math.abs(variance),
                        previous_stock: systemQty,
                        new_stock: physQty,
                        reference_type: 'STOCKTAKE',
                        reference_number: `ST-${stocktakeDate}-${branchId}`,
                        performed_by: req.user?.id || null,
                        notes: `Daily store stocktake adjustment ${stocktakeDate}`,
                    });
            }
        }

        const result = (data || []).map((r: any) => ({
            ...r,
            item_name: r.item?.item_name || r.item_name || null,
        }));

        res.status(201).json({ success: true, data: result });
    } catch (error) {
        logger.error('recordStoreStocktake failed:', error);
        next(error);
    }
};

/**
 * @desc    Accountant marks a store stocktake record reviewed.
 * @route   PATCH /api/storekeeping/store-stocktake/:id/review
 * @access  Branch Accountant, Super Admin
 */
export const reviewStoreStocktake = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const existing = await loadRecord(req.params.id);
        if (!existing) {
            res.status(404).json({ success: false, message: 'Stocktake record not found' });
            return;
        }
        if (existing.status !== 'pending') {
            res.status(400).json({ success: false, message: `Cannot review a record that is ${existing.status}` });
            return;
        }

        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from('store_stocktake_records')
            .update({
                status: 'reviewed',
                reviewed_by: req.user?.id || null,
                reviewed_at: now,
                notes: req.body?.notes ?? existing.notes,
            })
            .eq('id', req.params.id)
            .select('*, item:inventory_items(id, item_name, unit)')
            .single();
        if (error) throw error;

        await syncStoreStocktakeToStockCounts(
            existing.branch_id,
            existing.stocktake_date,
            'reviewed',
            req.user?.id || null,
            now
        );

        res.status(200).json({ success: true, data: { ...data, item_name: data?.item?.item_name || null } });
    } catch (error) {
        logger.error('reviewStoreStocktake failed:', error);
        next(error);
    }
};

/**
 * @desc    Accountant approves a store stocktake record. Writes the physical
 *          count back into stock_balance_ledger as actual_closing/variance.
 * @route   PATCH /api/storekeeping/store-stocktake/:id/approve
 * @access  Branch Accountant, Super Admin
 */
export const approveStoreStocktake = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const existing = await loadRecord(req.params.id);
        if (!existing) {
            res.status(404).json({ success: false, message: 'Stocktake record not found' });
            return;
        }
        if (!['pending', 'reviewed'].includes(existing.status)) {
            res.status(400).json({ success: false, message: `Cannot approve a record that is ${existing.status}` });
            return;
        }

        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from('store_stocktake_records')
            .update({
                status: 'approved',
                reviewed_by: existing.reviewed_by || req.user?.id || null,
                reviewed_at: existing.reviewed_at || now,
            })
            .eq('id', req.params.id)
            .select('*, item:inventory_items(id, item_name, unit)')
            .single();
        if (error) throw error;

        await supabase
            .from('stock_balance_ledger')
            .update({ actual_closing: num(existing.physical_quantity), variance: num(existing.variance) })
            .eq('branch_id', existing.branch_id)
            .eq('item_id', existing.item_id)
            .eq('ledger_date', existing.stocktake_date);

        // Batch-approve all remaining reviewed/pending records for the same
        // branch + date so approving any one record approves the whole session.
        await supabase
            .from('store_stocktake_records')
            .update({
                status: 'approved',
                reviewed_by: existing.reviewed_by || req.user?.id || null,
                reviewed_at: existing.reviewed_at || now,
            })
            .eq('branch_id', existing.branch_id)
            .eq('stocktake_date', existing.stocktake_date)
            .in('status', ['pending', 'reviewed']);

        // Bulk-update branch_stock for ALL approved records in this session —
        // physical count becomes the live store quantity for the branch.
        await db.query(
            `UPDATE public.branch_stock bs
             SET quantity   = ssr.physical_quantity::numeric,
                 updated_at = NOW()
             FROM public.store_stocktake_records ssr
             JOIN public.inventory_items ii ON ii.id = ssr.item_id
             WHERE bs.branch_id   = ssr.branch_id
               AND bs.item_sku    = ii.sku
               AND ssr.branch_id  = $1
               AND ssr.stocktake_date = $2
               AND ssr.status     = 'approved'`,
            [existing.branch_id, existing.stocktake_date]
        );

        await syncStoreStocktakeToStockCounts(
            existing.branch_id,
            existing.stocktake_date,
            'approved',
            existing.reviewed_by || req.user?.id || null,
            existing.reviewed_at || now
        );

        res.status(200).json({ success: true, data: { ...data, item_name: data?.item?.item_name || null } });
    } catch (error) {
        logger.error('approveStoreStocktake failed:', error);
        next(error);
    }
};

/**
 * @desc    Accountant rejects a store stocktake record — requires notes.
 * @route   PATCH /api/storekeeping/store-stocktake/:id/reject
 * @access  Branch Accountant, Super Admin
 */
export const rejectStoreStocktake = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const existing = await loadRecord(req.params.id);
        if (!existing) {
            res.status(404).json({ success: false, message: 'Stocktake record not found' });
            return;
        }
        if (!String(req.body?.notes || '').trim()) {
            res.status(400).json({ success: false, message: 'notes are required when rejecting a stocktake record' });
            return;
        }
        if (['approved', 'rejected'].includes(existing.status)) {
            res.status(400).json({ success: false, message: `Cannot reject a record that is ${existing.status}` });
            return;
        }

        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from('store_stocktake_records')
            .update({
                status: 'rejected',
                reviewed_by: req.user?.id || null,
                reviewed_at: now,
                notes: req.body.notes,
            })
            .eq('id', req.params.id)
            .select('*, item:inventory_items(id, item_name, unit)')
            .single();
        if (error) throw error;

        await syncStoreStocktakeToStockCounts(
            existing.branch_id,
            existing.stocktake_date,
            'rejected',
            req.user?.id || null,
            now
        );

        res.status(200).json({ success: true, data: { ...data, item_name: data?.item?.item_name || null } });
    } catch (error) {
        logger.error('rejectStoreStocktake failed:', error);
        next(error);
    }
};

/**
 * @desc    Daily store variance summary (total variance value per day) —
 *          used by the accountant P&L view.
 * @route   GET /api/storekeeping/store-stocktake/summary?branch_id=&from_date=&to_date=
 * @access  Branch Manager, Branch Accountant, Auditor, Super Admin
 */
export const getStoreStocktakeSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, from_date, to_date } = req.query;
        if (!branch_id) {
            res.status(400).json({ success: false, message: 'branch_id is required' });
            return;
        }
        const branchId = Number(branch_id);
        if (!Number.isInteger(branchId)) {
            res.status(400).json({ success: false, message: 'branch_id must be an integer' });
            return;
        }

        let query = supabase
            .from('store_stocktake_records')
            .select('stocktake_date, variance, status, item:inventory_items(default_unit_cost)')
            .eq('branch_id', branchId)
            .eq('status', 'approved');
        if (from_date) query = query.gte('stocktake_date', String(from_date));
        if (to_date) query = query.lte('stocktake_date', String(to_date));

        const { data, error } = await query.limit(2000);
        if (error) throw error;

        const byDate = new Map<string, { date: string; variance_value: number }>();
        (data || []).forEach((row: any) => {
            const key = row.stocktake_date;
            const unitCost = num(row.item?.default_unit_cost);
            const entry = byDate.get(key) || { date: row.stocktake_date, variance_value: 0 };
            entry.variance_value += num(row.variance) * unitCost;
            byDate.set(key, entry);
        });

        res.status(200).json({ success: true, data: Array.from(byDate.values()) });
    } catch (error) {
        logger.error('getStoreStocktakeSummary failed:', error);
        next(error);
    }
};
