import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import db from '../../db';
import { logger } from '../../utils/logger';

// Bar stocktake (migration 20260622_kitchen_storekeeper_integration.sql,
// section 4) — storekeeper records physical counts for main_bar/executive_bar
// against the system quantity from the Bar Stock screen (bar_stock);
// the branch accountant reviews/approves/rejects.
//
// KEY RELATIONSHIP:
//   bar_stock.drink_id  →  bar_drinks.id
//   bar_drinks.inventory_item_id  →  inventory_items.id  →  bar_stocktake_records.item_id (FK)

const num = (v: any): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const BAR_LOCATIONS = ['main_bar', 'executive_bar'];

const loadRecord = async (id: string): Promise<Record<string, any> | null> => {
    const { data, error } = await supabase
        .from('bar_stocktake_records')
        .select('*, item:inventory_items(id, item_name, unit)')
        .eq('id', id)
        .maybeSingle();
    if (error) throw error;
    return data || null;
};

/**
 * Sync the bar stocktake records for a branch/date/location into the unified
 * stock_counts / stock_count_items tables. This is the canonical source used
 * by the cashier shift opening gate.
 */
const syncBarStocktakeToStockCounts = async (
    branchId: number,
    barLocation: string,
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
        .eq('location', barLocation)
        .eq('store_type', 'bar')
        .maybeSingle();

    let stockCountId: string;
    const now = new Date().toISOString();
    const headerData: any = {
        branch_id: branchId,
        count_date: stocktakeDate,
        count_type: 'daily',
        store_type: 'bar',
        location: barLocation,
        status,
        accountant_reviewed_by: reviewedBy,
        accountant_reviewed_at: reviewedAt
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
        .from('bar_stocktake_records')
        .select('*, item:inventory_items(id, item_name, sku)')
        .eq('branch_id', branchId)
        .eq('bar_location', barLocation)
        .eq('stocktake_date', stocktakeDate);

    const items = (records || []).map((r: any) => ({
        stock_count_id: stockCountId,
        item_id: r.item_id,
        item_sku: r.item?.sku || null,
        system_quantity: num(r.system_quantity),
        physical_quantity: num(r.physical_quantity),
        counted_quantity: num(r.physical_quantity),
        variance: num(r.variance),
        reason: r.reason_for_variance || null,
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
 * Ensure every bar_drink in the list has a corresponding inventory_items row
 * (upserted by SKU). Returns a Map<bar_drinks.id, inventory_items.id>.
 */
const ensureInventoryItems = async (
    drinks: Array<{ id: string; name: string; sku: string; unit: string; cost_price: number; selling_price: number }>
): Promise<Map<string, string>> => {
    const drinkIdToInvId = new Map<string, string>();
    if (drinks.length === 0) return drinkIdToInvId;

    const skus = drinks.map(d => d.sku).filter(Boolean);
    if (skus.length === 0) return drinkIdToInvId;

    // Check which already exist
    const { data: existing } = await supabase
        .from('inventory_items')
        .select('id, sku')
        .in('sku', skus);
    const existingBySku = new Map((existing || []).map((i: any) => [i.sku, i.id]));

    // Identify missing ones
    const toCreate = drinks.filter(d => d.sku && !existingBySku.has(d.sku));
    if (toCreate.length > 0) {
        const rows = toCreate.map(d => ({
            sku: d.sku,
            item_name: d.name,
            unit: d.unit || 'bottle',
            category: 'BAR DRINKS',
            item_type: 'stockable',
            default_unit_cost: num(d.cost_price),
            default_selling_price: num(d.selling_price),
            is_active: true,
        }));
        const { data: created, error } = await supabase
            .from('inventory_items')
            .upsert(rows, { onConflict: 'sku' })
            .select('id, sku');
        if (error) logger.warn('ensureInventoryItems upsert error:', error);
        for (const c of (created || [])) existingBySku.set(c.sku, c.id);
    }

    // Build the mapping
    for (const d of drinks) {
        if (d.sku && existingBySku.has(d.sku)) {
            drinkIdToInvId.set(d.id, existingBySku.get(d.sku)!);
        }
    }
    return drinkIdToInvId;
};

/**
 * @desc    List bar stocktake records for a branch/date.
 *          Returns every bar item in the Bar Stock catalog (restaurant_bar_inventory)
 *          merged with the current system stock and any previously-recorded
 *          physical counts for the requested date.
 * @route   GET /api/storekeeping/bar-stocktake?branch_id=&bar_location=&date=&status=
 * @access  Branch Storekeeper, Central Storekeeper, Branch Manager, Branch Accountant, Auditor, Super Admin
 */
export const listBarStocktakes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, bar_location, date, stocktake_date, status } = req.query;
        if (!branch_id) {
            res.status(400).json({ success: false, message: 'branch_id is required' });
            return;
        }
        const branchId = Number(branch_id);
        if (!Number.isInteger(branchId)) {
            res.status(400).json({ success: false, message: 'branch_id must be an integer' });
            return;
        }

        // A status filter with no explicit bar_location/date (the Branch
        // Accountant review queue: GET ?branch_id=&status=pending) means the
        // caller wants real submitted records across every location/date,
        // not a single day's count sheet. Answer it directly from
        // bar_stocktake_records and never fall through to the synthesized
        // "candidates" branch below — that branch returns un-submitted bar
        // catalog rows with no bar_location/stocktake_date/item_name/
        // system_quantity/variance, which is what rendered as "null"
        // everywhere on the review screen.
        if (status && !bar_location && !date && !stocktake_date) {
            const { data: reviewRecords, error: reviewErr } = await supabase
                .from('bar_stocktake_records')
                .select('*, item:inventory_items(id, item_name, unit)')
                .eq('branch_id', branchId)
                .eq('status', String(status))
                .order('stocktake_date', { ascending: false });
            if (reviewErr) throw reviewErr;

            const result = (reviewRecords || []).map((r: any) => ({
                ...r,
                item_name: r.item?.item_name || r.item_name || null,
            }));
            res.status(200).json({ success: true, data: result });
            return;
        }

        // Accept both "date" and "stocktake_date" query params (Flutter sends stocktake_date)
        const rawDate = (stocktake_date as string) || (date as string) || new Date().toISOString().split('T')[0];
        const locationFilter = bar_location ? String(bar_location) : 'main_bar';

        // 1. Use bar_drinks as the authoritative catalog — bar_stock only has rows
        //    for items the storekeeper has formally received, so using it as the
        //    source silently drops every item not yet restocked.  bar_drinks holds
        //    ALL items for the branch regardless of stock movement history.
        const [{ data: allDrinks, error: drinksErr }, { data: barStockRows, error: stockErr }] = await Promise.all([
            supabase
                .from('bar_drinks')
                .select('id, name, sku, unit, cost_price, selling_price, inventory_item_id')
                .eq('branch_id', branchId)
                .eq('is_active', true)
                .order('name'),
            supabase
                .from('bar_stock')
                .select('drink_id, current_stock')
                .eq('branch_id', branchId),
        ]);
        if (drinksErr) throw drinksErr;
        if (stockErr) throw stockErr;

        const drinkRows = (allDrinks || []) as Array<Record<string, any>>;
        // Build a quick lookup: drink_id → current_stock (0 if no bar_stock row yet)
        const stockByDrinkId = new Map<string, number>(
            (barStockRows || []).map((r: any) => [String(r.drink_id), num(r.current_stock)])
        );

        // inventory_item_id is populated by the unification migration.
        // If any drink is missing the link, fall back to the SKU-based bridge.
        const drinksNeedingLink = drinkRows
            .filter((d) => !d.inventory_item_id)
            .map((d) => ({
                id: String(d.id),
                name: String(d.name),
                sku: d.sku ? String(d.sku) : `bard-${d.id}`,
                unit: String(d.unit || 'bottle'),
                cost_price: num(d.cost_price),
                selling_price: num(d.selling_price),
            }));
        const fallbackInvIdByDrinkId = drinksNeedingLink.length > 0
            ? await ensureInventoryItems(drinksNeedingLink)
            : new Map<string, string>();
        const invItemIds = drinkRows
            .map((d) => d.inventory_item_id || fallbackInvIdByDrinkId.get(String(d.id)))
            .filter(Boolean) as string[];

        // 2. Check for existing bar_stocktake_records for this branch/date/location
        let recordsQuery = supabase
            .from('bar_stocktake_records')
            .select('*, item:inventory_items(id, item_name, unit)')
            .eq('branch_id', branchId)
            .eq('stocktake_date', rawDate)
            .eq('bar_location', locationFilter);
        if (status) recordsQuery = recordsQuery.eq('status', String(status));
        if (invItemIds.length > 0) recordsQuery = recordsQuery.in('item_id', invItemIds);

        const { data: existingRecords, error: recErr } = await recordsQuery;
        if (recErr) throw recErr;

        // If stocktake records exist, return them (submitted view)
        if (existingRecords && existingRecords.length > 0) {
            const result = existingRecords.map((r: any) => ({
                ...r,
                item_name: r.item?.item_name || r.item_name || null,
            }));
            res.status(200).json({ success: true, data: result });
            return;
        }

        // 3. No stocktake submitted yet — return ALL catalog items as candidates.
        //    current_stock comes from bar_stock if a row exists, otherwise 0
        //    (the item exists in the catalog but hasn't been formally received yet).
        const candidates = drinkRows.map((d: any) => {
            const invId = d.inventory_item_id || fallbackInvIdByDrinkId.get(String(d.id));
            if (!invId) return null;
            const currentStock = stockByDrinkId.get(String(d.id)) ?? 0;
            return {
                id: invId,
                name: d.name,
                quantity: currentStock,
                opening_stock: currentStock,
                additions: 0,
                sales: 0,
                unit: d.unit || 'bottle',
                sku: d.sku || `bard-${d.id}`,
                category: null,
            };
        }).filter(Boolean);

        res.status(200).json({ success: true, data: candidates });
    } catch (error) {
        logger.error('listBarStocktakes failed:', error);
        next(error);
    }
};

/**
 * @desc    Record a bar stocktake. The storekeeper only supplies the physical
 *          (closing) count. The system quantity is the live stock from the
 *          Bar Stock screen (restaurant_bar_inventory.current_bottles). Opening
 *          is the previous stocktake's physical count (or current stock for the
 *          first count). variance = physical - system. A reason is required for
 *          non-zero variance.
 * @route   POST /api/storekeeping/bar-stocktake
 *          body: {
 *            branch_id, bar_location, stocktake_date?,
 *            items: [{ item_id, physical_quantity, reason_for_variance? }]
 *          }
 *          item_id is a restaurant_bar_inventory.id
 * @access  Branch Storekeeper, Central Storekeeper, Super Admin
 */
export const recordBarStocktake = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, bar_location, items } = req.body || {};
        const stocktakeDate = req.body?.stocktake_date || new Date().toISOString().split('T')[0];
        const branchId = Number(branch_id);
        if (!Number.isInteger(branchId)) {
            res.status(400).json({ success: false, message: 'branch_id must be an integer' });
            return;
        }
        if (!BAR_LOCATIONS.includes(bar_location)) {
            res.status(400).json({ success: false, message: `bar_location must be one of ${BAR_LOCATIONS.join(', ')}` });
            return;
        }
        if (!Array.isArray(items) || !items.length) {
            res.status(400).json({ success: false, message: 'items must be a non-empty array' });
            return;
        }

        // item_id values from the Flutter client are now inventory_items UUIDs.
        const invIds = items.map((it: any) => String(it.item_id));
        const { data: invRows } = await supabase
            .from('inventory_items')
            .select('id, item_name, unit, sku')
            .in('id', invIds);
        const invById = new Map((invRows || []).map((i: any) => [i.id, i]));

        // Find the live bar_stock value for each inventory item via bar_drinks link.
        const { data: drinkRows } = await supabase
            .from('bar_drinks')
            .select('id, inventory_item_id, name, unit')
            .in('inventory_item_id', invIds);
        const drinkIds = (drinkRows || []).map((d: any) => d.id);

        const { data: stockRows } = await supabase
            .from('bar_stock')
            .select('drink_id, current_stock')
            .eq('branch_id', branchId)
            .in('drink_id', drinkIds);
        const stockByInvId = new Map<string, number>(
            (stockRows || [])
                .map((r: any) => {
                    const drink = (drinkRows || []).find((d: any) => d.id === r.drink_id);
                    return [drink?.inventory_item_id, num(r.current_stock)] as [string, number];
                })
                .filter(([k]) => Boolean(k))
        );

        const now = new Date().toISOString();
        const missingReasons: string[] = [];
        const rows = items.map((it: any) => {
            const invId = String(it.item_id);
            const invItem = invById.get(invId);
            const currentStock = stockByInvId.get(invId) ?? 0;
            const opening = currentStock;
            const sysQty = currentStock;

            const physQtyRaw = Number(it.physical_quantity);
            const physQty = Number.isFinite(physQtyRaw) ? physQtyRaw : NaN;
            const variance = physQty - sysQty;
            const hasVariance = Math.abs(variance) > 0.0001;

            if (!Number.isFinite(physQty)) {
                const itemName = invItem?.item_name || invId;
                missingReasons.push(`${itemName} (missing physical count)`);
                return null;
            }

            // Variance must be explained whenever it is non-zero.
            if (hasVariance && !String(it.reason_for_variance || '').trim()) {
                const itemName = invItem?.item_name || invId;
                missingReasons.push(`${itemName} (variance ${variance >= 0 ? '+' : ''}${variance})`);
                return null;
            }

            return {
                branch_id: branchId,
                bar_location,
                stocktake_date: stocktakeDate,
                shift_id: req.body?.shift_id || null,
                item_id: invId,  // inventory_items UUID (satisfies FK)
                opening_stock: opening,
                additions: 0,
                sales: 0,
                system_quantity: sysQty,
                physical_quantity: physQty,
                // variance is a GENERATED column — do NOT include it
                reason_for_variance: hasVariance ? String(it.reason_for_variance).trim() : null,
                recorded_by: req.user?.id || null,
                recorded_at: now,
                status: 'pending'
            };
        });

        const validRows = rows.filter(Boolean);
        if (missingReasons.length > 0) {
            res.status(400).json({
                success: false,
                message: 'Reason for variance is required for all items with a variance',
                items: missingReasons
            });
            return;
        }
        if (validRows.length === 0) {
            res.status(400).json({ success: false, message: 'Could not resolve any items for stocktake' });
            return;
        }

        const { data, error } = await supabase
            .from('bar_stocktake_records')
            .upsert(validRows, { onConflict: 'branch_id,bar_location,stocktake_date,item_id' })
            .select('*, item:inventory_items(id, item_name, unit)');
        if (error) throw error;

        // Sync into the unified stock_counts table so the cashier shift gate works.
        await syncBarStocktakeToStockCounts(branchId, bar_location, stocktakeDate, 'submitted');

        // Flatten item_name to top level for the Flutter UI
        const result = (data || []).map((r: any) => ({
            ...r,
            item_name: r.item?.item_name || r.item_name || null,
        }));

        res.status(201).json({ success: true, data: result });
    } catch (error) {
        logger.error('recordBarStocktake failed:', error);
        next(error);
    }
};

/**
 * @desc    Accountant marks a bar stocktake record reviewed.
 * @route   PATCH /api/storekeeping/bar-stocktake/:id/review
 *          body: { notes? }
 * @access  Branch Accountant, Super Admin
 */
export const reviewBarStocktake = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
            .from('bar_stocktake_records')
            .update({
                status: 'reviewed',
                reviewed_by: req.user?.id || null,
                reviewed_at: now,
                notes: req.body?.notes ?? existing.notes
            })
            .eq('id', req.params.id)
            .select('*, item:inventory_items(id, item_name, unit)')
            .single();
        if (error) throw error;

        await syncBarStocktakeToStockCounts(
            existing.branch_id,
            existing.bar_location,
            existing.stocktake_date,
            'reviewed',
            req.user?.id || null,
            now
        );

        res.status(200).json({ success: true, data: { ...data, item_name: data?.item?.item_name || null } });
    } catch (error) {
        logger.error('reviewBarStocktake failed:', error);
        next(error);
    }
};

/**
 * @desc    Accountant approves a bar stocktake record. Writes the physical
 *          count back into stock_balance_ledger as actual_closing/variance
 *          (feeding the get_branch_profit_loss() bar_stock_variance line —
 *          see migration 20260622_kitchen_storekeeper_integration.sql).
 * @route   PATCH /api/storekeeping/bar-stocktake/:id/approve
 * @access  Branch Accountant, Super Admin
 */
export const approveBarStocktake = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
            .from('bar_stocktake_records')
            .update({
                status: 'approved',
                reviewed_by: existing.reviewed_by || req.user?.id || null,
                reviewed_at: existing.reviewed_at || now
            })
            .eq('id', req.params.id)
            .select('*, item:inventory_items(id, item_name, unit)')
            .single();
        if (error) throw error;

        // Best-effort: sync the ledger row for this item/branch/date with the
        // approved physical count, so future ledger reads reflect reality.
        await supabase
            .from('stock_balance_ledger')
            .update({ actual_closing: num(existing.physical_quantity), variance: num(existing.variance) })
            .eq('branch_id', existing.branch_id)
            .eq('item_id', existing.item_id)
            .eq('ledger_date', existing.stocktake_date);

        // Correct the live bar_stock so the next stocktake starts from the
        // approved physical count (closing the loop between stocktake and inventory).
        await db.query(
            `UPDATE public.bar_stock bs
             SET current_stock = GREATEST(0, $1),
                 updated_at = NOW()
             FROM public.bar_drinks bd
             WHERE bs.drink_id = bd.id
               AND bd.inventory_item_id = $2::uuid
               AND bs.branch_id = $3`,
            [num(existing.physical_quantity), existing.item_id, existing.branch_id]
        );

        // Also sync into pos_outlet_items so the Bar POS outlet reflects the
        // approved count — bar_stock and pos_outlet_items track the same physical
        // goods but are queried by different screens.
        await db.query(
            `UPDATE public.pos_outlet_items poi
             SET current_stock = GREATEST(0, $1),
                 updated_at = NOW()
             FROM public.bar_drinks bd
             JOIN public.pos_outlets po ON po.branch_id = $3
                                       AND po.outlet_type = $4
             WHERE bd.inventory_item_id = $2::uuid
               AND poi.outlet_id = po.id
               AND poi.source_item_id = bd.id::text`,
            [num(existing.physical_quantity), existing.item_id, existing.branch_id, existing.bar_location]
        );

        // Batch-approve all remaining reviewed/pending records for the same
        // session (same branch + location + date) in one shot, so the accountant
        // approving any one record approves the whole submission automatically.
        // The Flutter app already loops through all IDs but 116 sequential calls
        // are unreliable — this makes a single call sufficient.
        await supabase
            .from('bar_stocktake_records')
            .update({
                status: 'approved',
                reviewed_by: existing.reviewed_by || req.user?.id || null,
                reviewed_at: existing.reviewed_at || now
            })
            .eq('branch_id', existing.branch_id)
            .eq('bar_location', existing.bar_location)
            .eq('stocktake_date', existing.stocktake_date)
            .in('status', ['pending', 'reviewed']);

        // Bulk-update bar_stock and pos_outlet_items for ALL approved records in
        // this session (covers both the record just approved and the batch above).
        await db.query(
            `UPDATE public.bar_stock bs
             SET current_stock = GREATEST(0, btr.physical_quantity::numeric),
                 updated_at    = NOW()
             FROM public.bar_stocktake_records btr
             JOIN public.bar_drinks bd ON bd.inventory_item_id = btr.item_id
             WHERE bs.drink_id        = bd.id
               AND bs.branch_id       = btr.branch_id
               AND btr.branch_id      = $1
               AND btr.bar_location   = $2
               AND btr.stocktake_date = $3
               AND btr.status         = 'approved'`,
            [existing.branch_id, existing.bar_location, existing.stocktake_date]
        );

        await db.query(
            `UPDATE public.pos_outlet_items poi
             SET current_stock = GREATEST(0, btr.physical_quantity::numeric),
                 updated_at    = NOW()
             FROM public.bar_stocktake_records btr
             JOIN public.bar_drinks bd ON bd.inventory_item_id = btr.item_id
             JOIN public.pos_outlets po ON po.branch_id  = btr.branch_id
                                       AND po.outlet_type = btr.bar_location
             WHERE poi.outlet_id      = po.id
               AND poi.source_item_id = bd.id::text
               AND btr.branch_id      = $1
               AND btr.bar_location   = $2
               AND btr.stocktake_date = $3
               AND btr.status         = 'approved'`,
            [existing.branch_id, existing.bar_location, existing.stocktake_date]
        );

        // Sync into the unified stock_counts table.
        await syncBarStocktakeToStockCounts(
            existing.branch_id,
            existing.bar_location,
            existing.stocktake_date,
            'approved',
            existing.reviewed_by || req.user?.id || null,
            existing.reviewed_at || now
        );

        res.status(200).json({ success: true, data: { ...data, item_name: data?.item?.item_name || null } });
    } catch (error) {
        logger.error('approveBarStocktake failed:', error);
        next(error);
    }
};

/**
 * @desc    Accountant rejects a bar stocktake record — requires notes.
 * @route   PATCH /api/storekeeping/bar-stocktake/:id/reject
 *          body: { notes }
 * @access  Branch Accountant, Super Admin
 */
export const rejectBarStocktake = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
            .from('bar_stocktake_records')
            .update({
                status: 'rejected',
                reviewed_by: req.user?.id || null,
                reviewed_at: now,
                notes: req.body.notes
            })
            .eq('id', req.params.id)
            .select('*, item:inventory_items(id, item_name, unit)')
            .single();
        if (error) throw error;

        await syncBarStocktakeToStockCounts(
            existing.branch_id,
            existing.bar_location,
            existing.stocktake_date,
            'rejected',
            req.user?.id || null,
            now
        );

        res.status(200).json({ success: true, data: { ...data, item_name: data?.item?.item_name || null } });
    } catch (error) {
        logger.error('rejectBarStocktake failed:', error);
        next(error);
    }
};

/**
 * @desc    Daily bar variance summary (total variance value per bar/day) —
 *          used by the accountant P&L view.
 * @route   GET /api/storekeeping/bar-stocktake/summary?branch_id=&from_date=&to_date=
 * @access  Branch Manager, Branch Accountant, Auditor, Super Admin
 */
export const getBarStocktakeSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
            .from('bar_stocktake_records')
            .select('bar_location, stocktake_date, variance, status, item:inventory_items(default_unit_cost)')
            .eq('branch_id', branchId)
            .eq('status', 'approved');
        if (from_date) query = query.gte('stocktake_date', String(from_date));
        if (to_date) query = query.lte('stocktake_date', String(to_date));

        const { data, error } = await query.limit(2000);
        if (error) throw error;

        const byBarDate = new Map<string, { bar_location: string; date: string; variance_value: number }>();
        (data || []).forEach((row: any) => {
            const key = `${row.bar_location}|${row.stocktake_date}`;
            const unitCost = num(row.item?.default_unit_cost);
            const entry = byBarDate.get(key) || { bar_location: row.bar_location, date: row.stocktake_date, variance_value: 0 };
            entry.variance_value += num(row.variance) * unitCost;
            byBarDate.set(key, entry);
        });

        res.status(200).json({ success: true, data: Array.from(byBarDate.values()) });
    } catch (error) {
        logger.error('getBarStocktakeSummary failed:', error);
        next(error);
    }
};
