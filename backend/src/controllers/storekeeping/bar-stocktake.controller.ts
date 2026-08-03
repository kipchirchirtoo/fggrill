import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import db from '../../db';
import { InventoryStocktakePostingService } from '../../modules/inventory';
import { logger } from '../../utils/logger';
import { getLastClosedCashierShiftWindow } from '../../utils/posStationAccess';
import { isGlobalRole } from '../../utils/branchIsolation';

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
const withPostingFields = (record: any) => ({
    ...record,
    additions: num(record.additions),
    document_id: record.document_id ?? null,
    document_number: record.document_number ?? null,
    issuance: num(record.issuance),
    physical_quantity: record.physical_quantity ?? null,
    posted_at: record.posted_at ?? null,
    posting_status: record.posting_status ?? null,
    reversal_of_document_id: record.reversal_of_document_id ?? null,
    sales: num(record.sales),
});

// Which cashier roles tend the till at each bar location — mirrors
// POS_STATION_CASHIER_ROLE_TYPES in utils/posStationAccess.ts (reversed: role -> location).
const BAR_CASHIER_ROLES_BY_LOCATION: Record<string, string[]> = {
    main_bar: ['main_bar_cashier', 'kyogong_sports_bar_cashier'],
    executive_bar: ['executive_bar_cashier', 'kyogong_executive_bar_cashier'],
};

const resolveScopedBranchId = (
    req: Request,
    requestedBranchId: unknown
): number | null => {
    const requested = Number(requestedBranchId);
    const userBranch = Number(req.user?.branch_id ?? (req.user as any)?.branchId);
    const globalUser = isGlobalRole(String(req.user?.role || ''));

    if (!globalUser) {
        return Number.isInteger(userBranch) && userBranch > 0 ? userBranch : null;
    }

    return Number.isInteger(requested) && requested > 0
        ? requested
        : (Number.isInteger(userBranch) && userBranch > 0 ? userBranch : 1);
};

const canAccessRecordBranch = (req: Request, recordBranchId: unknown): boolean => {
    if (isGlobalRole(String(req.user?.role || ''))) return true;
    const userBranch = Number(req.user?.branch_id ?? (req.user as any)?.branchId);
    return Number.isInteger(userBranch) &&
        userBranch > 0 &&
        userBranch === Number(recordBranchId);
};

const getLastClosedBarShiftWindow = (branchId: number, barLocation: string, stocktakeDate: string): Promise<any> =>
    getLastClosedCashierShiftWindow(supabase, branchId, BAR_CASHIER_ROLES_BY_LOCATION[barLocation] || [], stocktakeDate);

// Today's OPENING stock for each item is the PHYSICAL count from the previous
// stocktake (what was actually on the shelf at last close), so the chain is
// continuous: if yesterday had no variance, opening == yesterday's closing; if
// it did, opening is the real counted stock, not a drifted system figure.
//
// IMPORTANT: the previous count is used whether it is already 'approved' by the
// accountant OR still 'pending'/'submitted'. Storekeepers submit daily and the
// opening for the next day must reflect the last SUBMITTED count immediately —
// waiting for accountant approval left every following day's opening stuck at a
// reverse-computed (drifting) figure, which is the "not fetching all the
// submitted stock" bug. Returns item_id -> previous physical count. Empty for
// the first count. When a prior date somehow has both a pending and an approved
// row for the same item, the later-recorded one wins.
const COUNTED_STATUSES = ['approved'];
const loadPreviousStocktakeCounts = async (
    branchId: number,
    barLocation: string,
    stocktakeDate: string
): Promise<Map<string, number>> => {
    const map = new Map<string, number>();
    const { data: prev } = await supabase
        .from('bar_stocktake_records')
        .select('stocktake_date')
        .eq('branch_id', branchId)
        .eq('bar_location', barLocation)
        .in('status', COUNTED_STATUSES)
        .lt('stocktake_date', stocktakeDate)
        .order('stocktake_date', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (!prev?.stocktake_date) return map;
    const { data: rows } = await supabase
        .from('bar_stocktake_records')
        .select('item_id, physical_quantity, recorded_at')
        .eq('branch_id', branchId)
        .eq('bar_location', barLocation)
        .in('status', COUNTED_STATUSES)
        .eq('stocktake_date', prev.stocktake_date)
        .order('recorded_at', { ascending: true });
    for (const r of (rows || [])) {
        if ((r as any).item_id != null && (r as any).physical_quantity != null) {
            map.set(String((r as any).item_id), num((r as any).physical_quantity));
        }
    }
    return map;
};

// Additions/sales must be summed over everything since opening_stock was last
// reset — i.e. since the last APPROVED stocktake for this branch/location —
// not just "the last closed shift". A single shift window misses restocks/
// sales from earlier shifts on days with no stocktake, and silently re-counts
// old restocks against a later stocktake once a newer shift closes, which is
// what showed up as "additions that were never made" and stale opening
// figures. shift_id tagging on the record is unaffected — that still comes
// from getLastClosedBarShiftWindow above.
const getSinceLastApprovalWindow = async (
    branchId: number,
    barLocation: string,
    stocktakeDate: string
): Promise<{ from: string; to: string }> => {
    const dayEnd = new Date(new Date(`${stocktakeDate}T00:00:00.000Z`).getTime() + 86400000).toISOString();
    const { data: lastApproved } = await supabase
        .from('bar_stocktake_records')
        .select('recorded_at')
        .eq('branch_id', branchId)
        .eq('bar_location', barLocation)
        .in('status', COUNTED_STATUSES)
        .lt('stocktake_date', stocktakeDate)
        .order('stocktake_date', { ascending: false })
        .limit(1)
        .maybeSingle();
    const from = lastApproved?.recorded_at || '1970-01-01T00:00:00.000Z';
    return { from, to: dayEnd };
};

const resolveBarOutlet = async (branchId: number, barLocation: string) => {
    const outletTypes =
        barLocation === 'executive_bar'
            ? ['executive_bar', 'kyogong_executive_bar']
            : ['main_bar', 'sports_bar', 'kyogong_sports_bar'];

    const { data, error } = await supabase
        .from('pos_outlets')
        .select('id, branch_id, outlet_type, name')
        .eq('branch_id', branchId)
        .in('outlet_type', outletTypes)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    return data || null;
};

const approveBarSession = async (
    branchId: number,
    barLocation: string,
    stocktakeDate: string,
    actorId: string | null | undefined,
    idempotencyKey: string,
) => {
    const { data: rows, error } = await supabase
        .from('bar_stocktake_records')
        .select('*, item:inventory_items(id, item_name, unit, sku, default_unit_cost)')
        .eq('branch_id', branchId)
        .eq('bar_location', barLocation)
        .eq('stocktake_date', stocktakeDate)
        .in('status', ['pending', 'reviewed', 'approved'])
        .order('recorded_at', { ascending: true });
    if (error) throw error;
    const sessionRows = rows || [];
    if (!sessionRows.length) return { posting: null, rows: [] as any[] };

    const targetOutlet = await resolveBarOutlet(branchId, barLocation);
    if (!targetOutlet?.id) {
        const err: any = new Error(`No POS outlet configured for ${barLocation}`);
        err.statusCode = 400;
        throw err;
    }

    const alreadyApprovedWithDocument = sessionRows.find((row: any) => row.status === 'approved' && row.document_id);
    const reviewedBy = alreadyApprovedWithDocument?.reviewed_by || actorId || null;
    const reviewedAt = alreadyApprovedWithDocument?.reviewed_at || new Date().toISOString();

    let posting = null;
    if (!alreadyApprovedWithDocument) {
        posting = await InventoryStocktakePostingService.postApproval({
            actorId: actorId || '',
            branchId,
            documentReason: `Bar stocktake approval ${barLocation} ${stocktakeDate}`,
            idempotencyKey,
            lines: sessionRows.map((row: any) => ({
                itemName: row.item?.item_name || row.item_name || row.item?.sku,
                itemSku: row.item?.sku,
                metadata: { bar_location: barLocation, stocktake_record_id: row.id },
                physicalQuantity: num(row.physical_quantity),
                systemQuantity: num(row.system_quantity),
                unitCost: num(row.item?.default_unit_cost),
            })).filter((row: any) => row.itemSku),
            location: {
                branchId,
                locationCode: `OUTLET-${branchId}-${String(targetOutlet.id).toUpperCase()}`,
                locationName: targetOutlet.name || barLocation,
                locationType: 'pos_outlet',
                outletId: String(targetOutlet.id),
            },
            metadata: { bar_location: barLocation, branch_id: branchId, stocktake_date: stocktakeDate },
            scope: 'bar',
            sourceId: String(sessionRows[0].id),
            sourceTable: 'bar_stocktake_records',
            stocktakeDate,
        });
    }

    const documentFields = posting ? {
        document_id: posting.document.document_id,
        document_number: posting.document.document_number,
        posted_at: posting.document.posted_at,
        posting_status: posting.document.posting_status,
        reversal_of_document_id: posting.document.reversal_of_document_id,
    } : {
        document_id: alreadyApprovedWithDocument?.document_id ?? null,
        document_number: alreadyApprovedWithDocument?.document_number ?? null,
        posted_at: alreadyApprovedWithDocument?.posted_at ?? null,
        posting_status: alreadyApprovedWithDocument?.posting_status ?? null,
        reversal_of_document_id: alreadyApprovedWithDocument?.reversal_of_document_id ?? null,
    };

    const { error: updateError } = await supabase
        .from('bar_stocktake_records')
        .update({
            status: 'approved',
            reviewed_at: reviewedAt,
            reviewed_by: reviewedBy,
            ...documentFields,
        })
        .eq('branch_id', branchId)
        .eq('bar_location', barLocation)
        .eq('stocktake_date', stocktakeDate)
        .in('status', ['pending', 'reviewed', 'approved']);
    if (updateError) throw updateError;

    await db.query(
        `UPDATE public.stock_balance_ledger sbl
         SET actual_closing = btr.physical_quantity::numeric,
             variance = COALESCE(btr.variance, btr.physical_quantity::numeric - btr.system_quantity::numeric)
         FROM public.bar_stocktake_records btr
         WHERE sbl.branch_id = btr.branch_id
           AND sbl.item_id = btr.item_id
           AND sbl.ledger_date = btr.stocktake_date
           AND btr.branch_id = $1
           AND btr.bar_location = $2
           AND btr.stocktake_date = $3`,
        [branchId, barLocation, stocktakeDate],
    );

    const targetOutletTypes = barLocation === 'executive_bar'
        ? ['executive_bar', 'kyogong_executive_bar']
        : ['main_bar', 'sports_bar', 'kyogong_sports_bar'];

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
        [branchId, barLocation, stocktakeDate],
    );

    await db.query(
        `UPDATE public.pos_outlet_items poi
         SET current_stock = GREATEST(0, btr.physical_quantity::numeric),
             updated_at    = NOW()
         FROM public.bar_stocktake_records btr
         JOIN public.bar_drinks bd ON bd.inventory_item_id = btr.item_id
         JOIN public.pos_outlets po ON po.branch_id  = btr.branch_id
                                   AND po.outlet_type = ANY($4::text[])
         WHERE poi.outlet_id      = po.id
           AND poi.source_item_id = bd.id::text
           AND btr.branch_id      = $1
           AND btr.bar_location   = $2
           AND btr.stocktake_date = $3
           AND btr.status         = 'approved'`,
        [branchId, barLocation, stocktakeDate, targetOutletTypes],
    );

    await syncBarStocktakeToStockCounts(branchId, barLocation, stocktakeDate, 'approved', reviewedBy, reviewedAt);

    const { data: refreshed, error: refreshedError } = await supabase
        .from('bar_stocktake_records')
        .select('*, item:inventory_items(id, item_name, unit, sku)')
        .eq('branch_id', branchId)
        .eq('bar_location', barLocation)
        .eq('stocktake_date', stocktakeDate)
        .order('recorded_at', { ascending: true });
    if (refreshedError) throw refreshedError;

    return { posting, rows: refreshed || [] };
};

const loadShiftCountMaps = async (
    branchId: number,
    barLocation: string,
    fromIso: string,
    toIso: string
): Promise<{ additionsByDrinkId: Map<string, number>; salesByDrinkId: Map<string, number> }> => {
    const additionsByDrinkId = new Map<string, number>();
    const salesByDrinkId = new Map<string, number>();
    if (!branchId) {
        return { additionsByDrinkId, salesByDrinkId };
    }

    // Two joins were silently broken here, so additions/sales always summed to
    // zero and every bar sale reduced stock with no Sales figure:
    //   1. pos_shift_stock_counts.shift_id references pos_outlet_shifts.id (the
    //      POS shift), NOT cashier_shift_logs.id — the old code matched the
    //      latter, which never intersects.
    //   2. count rows are keyed to a POS outlet item (sku 'M-<uuid>'), NOT the
    //      bar_drinks sku — matching by sku found nothing. The reliable bridge
    //      is outlet_item_id -> pos_outlet_items.source_item_id (= bar_drinks.id).
    // Resolve the bar outlet(s), their POS shifts opened in the window, and the
    // outlet-item -> drink map, then aggregate counts onto the right drink id.
    const outletTypes =
        barLocation === 'executive_bar'
            ? ['executive_bar', 'kyogong_executive_bar']
            : ['main_bar', 'sports_bar', 'kyogong_sports_bar'];

    const { data: outlets, error: outletsError } = await supabase
        .from('pos_outlets')
        .select('id')
        .eq('branch_id', branchId)
        .in('outlet_type', outletTypes);
    if (outletsError) throw outletsError;
    const outletIds = (outlets || []).map((o: any) => String(o.id)).filter(Boolean);
    if (outletIds.length === 0) {
        return { additionsByDrinkId, salesByDrinkId };
    }

    const [
        { data: posShifts, error: posShiftsError },
        { data: outletItems, error: itemsError },
    ] = await Promise.all([
        supabase
            .from('pos_outlet_shifts')
            .select('id')
            .in('outlet_id', outletIds)
            .gte('opened_at', fromIso)
            .lt('opened_at', toIso),
        supabase
            .from('pos_outlet_items')
            .select('id, source_item_id')
            .in('outlet_id', outletIds)
            .eq('source_table', 'bar_drinks'),
    ]);
    if (posShiftsError) throw posShiftsError;
    if (itemsError) throw itemsError;

    const shiftIds = (posShifts || []).map((row: any) => String(row.id)).filter(Boolean);
    if (shiftIds.length === 0) {
        return { additionsByDrinkId, salesByDrinkId };
    }

    const drinkIdByOutletItemId = new Map<string, string>();
    for (const it of (outletItems || [])) {
        if ((it as any)?.id && (it as any)?.source_item_id) {
            drinkIdByOutletItemId.set(String((it as any).id), String((it as any).source_item_id));
        }
    }

    const { data: countRows, error: countError } = await supabase
        .from('pos_shift_stock_counts')
        .select('outlet_item_id, additions, sold_quantity')
        .in('shift_id', shiftIds);
    if (countError) throw countError;

    for (const row of (countRows || [])) {
        const drinkId = drinkIdByOutletItemId.get(String((row as any).outlet_item_id || ''));
        if (!drinkId) continue;
        additionsByDrinkId.set(drinkId, (additionsByDrinkId.get(drinkId) ?? 0) + num(row.additions));
        salesByDrinkId.set(drinkId, (salesByDrinkId.get(drinkId) ?? 0) + num(row.sold_quantity));
    }

    return { additionsByDrinkId, salesByDrinkId };
};

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
 * Enrich a list of bar_stocktake_records with cashier shift metadata by
 * looking up cashier_shift_logs for each distinct shift_id in the records.
 */
const enrichWithShiftInfo = async (records: any[]): Promise<any[]> => {
    const shiftIds = Array.from(
        new Set(records.map((r: any) => r.shift_id).filter(Boolean))
    ) as string[];
    if (shiftIds.length === 0) return records;
    const { data: shifts } = await supabase
        .from('cashier_shift_logs')
        .select('id, shift_number, cashier_name, shift_start, shift_end, status')
        .in('id', shiftIds);
    const shiftMap = new Map((shifts || []).map((s: any) => [s.id, s]));
    return records.map((r: any) => {
        const shift = shiftMap.get(r.shift_id);
        return {
            ...r,
            shift_number: shift?.shift_number ?? null,
            cashier_name: shift?.cashier_name ?? null,
            shift_opened_at: shift?.shift_start ?? null,
            shift_closed_at: shift?.shift_end ?? null,
            shift_status: shift?.status ?? null,
        };
    });
};


/**
 * Sync the bar stocktake records for a branch/date/location into the unified
 * stock_counts / stock_count_items tables. This is the canonical source used
 * by the cashier shift opening gate.
 */
// stock_counts.status has a CHECK constraint that does NOT allow 'pending'
// (which is the bar_stocktake_records status used on submission). Writing
// 'pending' made the header insert throw, and because the sync is called
// non-fatally the failure was swallowed — so on SUBMISSION no stock_counts row
// was ever created and the cashier shift-open gate (which reads stock_counts)
// kept reporting the stocktake as not done until the accountant approved it.
// Map any incoming status to the nearest VALID stock_counts status.
const VALID_STOCK_COUNT_STATUSES = new Set<string>([
    'draft', 'started', 'counting', 'submitted', 'submitted_to_accountant',
    'under_review', 'reviewed', 'accountant_review', 'accountant_approved',
    'accountant_rejected', 'auditor_review', 'auditor_approved', 'auditor_flagged',
    'approved', 'posted', 'closed', 'rejected', 'cancelled'
]);
const mapStockCountStatus = (s: string): string => {
    const v = String(s || '').trim().toLowerCase();
    if (v === 'pending' || v === '') return 'submitted';
    return VALID_STOCK_COUNT_STATUSES.has(v) ? v : 'submitted';
};

const syncBarStocktakeToStockCounts = async (
    branchId: number,
    barLocation: string,
    stocktakeDate: string,
    status: string,
    reviewedBy: string | null = null,
    reviewedAt: string | null = null
): Promise<void> => {
    const scStatus = mapStockCountStatus(status);
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
        status: scStatus,
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
        status: scStatus,
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

    // FIRST: look up existing inventory_items by name (case-insensitive).
    // This reuses the central catalog's FG-xxx rows (e.g. "4TH STREET SWEET RED")
    // instead of creating duplicate FGB-xxx shadow rows for the same physical item.
    const drinkIdToInvIdByName = new Map<string, string>();
    const names = drinks.map(d => d.name).filter(Boolean);
    if (names.length > 0) {
        const { rows: nameRows } = await db.query(
            `SELECT id, item_name FROM public.inventory_items
             WHERE LOWER(TRIM(item_name)) = ANY($1) AND is_active = true`,
            [names.map((n: string) => n.toLowerCase().trim())]
        ).catch(() => ({ rows: [] }));
        const nameToInvId = new Map((nameRows as any[]).map((r: any) => [r.item_name.toLowerCase().trim(), r.id]));
        for (const d of drinks) {
            const invId = nameToInvId.get(d.name.toLowerCase().trim());
            if (invId) drinkIdToInvIdByName.set(d.id, invId);
        }
    }

    // Check which already exist by SKU (original path)
    const { data: existing } = await supabase
        .from('inventory_items')
        .select('id, sku')
        .in('sku', skus);
    const existingBySku = new Map((existing || []).map((i: any) => [i.sku, i.id]));

    // Only create new rows for drinks that have neither a name match nor a SKU match
    const toCreate = drinks.filter(d => d.sku && !existingBySku.has(d.sku) && !drinkIdToInvIdByName.has(d.id));
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

    // Build the mapping — name match (FG-xxx central catalog) takes priority
    for (const d of drinks) {
        const nameMatchId = drinkIdToInvIdByName.get(d.id);
        const skuMatchId = d.sku ? existingBySku.get(d.sku) : undefined;
        const resolvedId = nameMatchId || skuMatchId;
        if (resolvedId) drinkIdToInvId.set(d.id, resolvedId);
    }

    // Stamp inventory_item_id back onto bar_drinks rows that were missing it,
    // using the SAME resolved UUID returned in the candidate list (name-match takes priority
    // over SKU-match, so we must stamp the resolved id — not just existingBySku — or the
    // GET and POST will use different UUIDs for the same drink).
    for (const d of drinks) {
        const resolvedId = drinkIdToInvId.get(d.id);
        if (!resolvedId) continue;
        await supabase
            .from('bar_drinks')
            .update({ inventory_item_id: resolvedId })
            .eq('id', d.id)
            .is('inventory_item_id', null);
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
        const { branch_id, bar_location, date, stocktake_date, status, history } = req.query;
        const branchId = resolveScopedBranchId(req, branch_id);
        if (!branchId) {
            res.status(400).json({ success: false, message: 'branch_id is required' });
            return;
        }

        let largePct = 3.0;
        let extremePct = 10.0;
        const { data: settings } = await supabase
            .from('branch_settings')
            .select('stocktake_variance_large_pct, stocktake_variance_extreme_pct')
            .eq('branch_id', branchId)
            .maybeSingle();
        if (settings) {
            if (settings.stocktake_variance_large_pct !== null && settings.stocktake_variance_large_pct !== undefined) {
                largePct = Number(settings.stocktake_variance_large_pct);
            }
            if (settings.stocktake_variance_extreme_pct !== null && settings.stocktake_variance_extreme_pct !== undefined) {
                extremePct = Number(settings.stocktake_variance_extreme_pct);
            }
        }

        // A status filter or history=true with no explicit bar_location/date means
        // the caller wants real submitted records across every location/date,
        // not a single day's count sheet. Answer it directly from
        // bar_stocktake_records and never fall through to the synthesized
        // "candidates" branch below — that branch returns un-submitted bar
        // catalog rows with no bar_location/stocktake_date/item_name/
        // system_quantity/variance, which is what rendered as "null"
        // everywhere on the review screen.
        if ((status || history === 'true') && !bar_location && !date && !stocktake_date) {
            const shiftIdFilter = req.query.shift_id as string | undefined;
            let reviewQuery = supabase
                .from('bar_stocktake_records')
                .select('*, item:inventory_items(id, item_name, unit)')
                .eq('branch_id', branchId)
                .order('stocktake_date', { ascending: false });
            if (status && String(status).toLowerCase() !== 'all') {
                reviewQuery = reviewQuery.eq('status', String(status));
            }
            if (shiftIdFilter) reviewQuery = reviewQuery.eq('shift_id', shiftIdFilter);
            const { data: reviewRecords, error: reviewErr } = await reviewQuery;
            if (reviewErr) throw reviewErr;

            const rawResult = (reviewRecords || []).map((r: any) => ({
                ...r,
                item_name: r.item?.item_name || r.item_name || null,
            }));
            const result = await enrichWithShiftInfo(rawResult);
            res.status(200).json({ success: true, data: result, stocktake_variance_large_pct: largePct, stocktake_variance_extreme_pct: extremePct });
            return;
        }

        // Accept both "date" and "stocktake_date" query params (Flutter sends stocktake_date)
        const rawDate = (stocktake_date as string) || (date as string) || new Date().toISOString().split('T')[0];
        const locationFilter = bar_location ? String(bar_location) : 'main_bar';

        // The stocktake items come straight from THIS bar's own POS outlet —
        // the Kyogong (or any branch) Main Bar / Executive Bar POS. Name, SKU,
        // unit, price and current stock all read from that outlet's
        // pos_outlet_items; the drink catalog (bar_drinks) is used ONLY to
        // resolve the inventory_item_id the stocktake ledger keys on, never for
        // display. So a branch whose bar POS reuses another branch's drink
        // catalog still lists exactly what its own POS sells.
        const outlet = await resolveBarOutlet(branchId, locationFilter);
        const { data: outletItems, error: oiErr } = await supabase
            .from('pos_outlet_items')
            .select('id, name, sku, unit, current_stock, cost_price, selling_price, source_item_id')
            .eq('outlet_id', outlet?.id || '00000000-0000-0000-0000-000000000000')
            .eq('source_table', 'bar_drinks')
            .eq('is_active', true)
            .order('name');
        if (oiErr) throw oiErr;

        // Resolve inventory_item_id per drink (linkage only) from bar_drinks.
        const posDrinkIds = Array.from(new Set(
            (outletItems || [])
                .map((r: any) => String(r.source_item_id || '').trim())
                .filter(Boolean)
        ));
        const invIdFromCatalog = new Map<string, string>();
        if (posDrinkIds.length > 0) {
            const { data: bd } = await supabase
                .from('bar_drinks')
                .select('id, inventory_item_id')
                .in('id', posDrinkIds);
            for (const d of (bd || [])) {
                if ((d as any).inventory_item_id) {
                    invIdFromCatalog.set(String((d as any).id), String((d as any).inventory_item_id));
                }
            }
        }

        // One stocktake row per drink (keyed by drink id = source_item_id), with
        // POS-sourced display fields; stock is summed if a drink is exposed under
        // more than one POS item in the outlet.
        const drinkByDrinkId = new Map<string, Record<string, any>>();
        for (const oi of ((outletItems || []) as Array<Record<string, any>>)) {
            const did = String(oi.source_item_id || '').trim();
            if (!did) continue;
            const existing = drinkByDrinkId.get(did);
            if (existing) {
                existing.current_stock = num(existing.current_stock) + num(oi.current_stock);
                continue;
            }
            drinkByDrinkId.set(did, {
                id: did,
                name: oi.name,
                sku: oi.sku,
                unit: oi.unit || 'bottle',
                cost_price: num(oi.cost_price),
                selling_price: num(oi.selling_price),
                inventory_item_id: invIdFromCatalog.get(did) || null,
                current_stock: num(oi.current_stock),
            });
        }
        let drinkRows = Array.from(drinkByDrinkId.values());

        // Fallback only if this outlet has no POS items yet: use the branch's
        // own bar_drinks catalog so the stocktake still isn't empty.
        if (drinkRows.length === 0) {
            const { data: catalog } = await supabase
                .from('bar_drinks')
                .select('id, name, sku, unit, cost_price, selling_price, inventory_item_id, stock_quantity')
                .eq('branch_id', branchId)
                .eq('is_active', true)
                .order('name');
            drinkRows = ((catalog || []) as Array<Record<string, any>>).map((d) => ({
                id: String(d.id),
                name: d.name,
                sku: d.sku,
                unit: d.unit || 'bottle',
                cost_price: num(d.cost_price),
                selling_price: num(d.selling_price),
                inventory_item_id: d.inventory_item_id || null,
                current_stock: num(d.stock_quantity),
            }));
        }

        // drink_id → current_stock (straight from the POS outlet item).
        const stockByDrinkId = new Map<string, number>(
            drinkRows.map((d) => [String(d.id), num(d.current_stock)])
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

        const shiftWindow = await getLastClosedBarShiftWindow(branchId, locationFilter, rawDate);
        const sumWindow = await getSinceLastApprovalWindow(branchId, locationFilter, rawDate);

        // Build map of drink_id -> inventory_item_id
        const invIdByDrinkId = new Map<string, string>();
        for (const d of drinkRows) {
            const invId = d.inventory_item_id || fallbackInvIdByDrinkId.get(String(d.id));
            if (invId) {
                invIdByDrinkId.set(String(d.id), String(invId));
            }
        }

        const { additionsByDrinkId, salesByDrinkId } = await loadShiftCountMaps(
            branchId,
            locationFilter,
            sumWindow.from,
            sumWindow.to
        );
        // Previous stocktake's physical counts → today's opening (submitted or
        // approved — see loadPreviousStocktakeCounts).
        const prevCountByInvId = await loadPreviousStocktakeCounts(branchId, locationFilter, rawDate);
        const salesByInvId = new Map<string, number>();
        // Shift-count additions are only used to seed opening for the FIRST-EVER
        // count (no prior stocktake). For every later count, additions is DERIVED
        // from the outlet's authoritative current/system stock so that stock
        // issued to the bar shows up even when no cashier shift was open at issue
        // time — additions = closing − opening + sales.
        const shiftAdditionsByInvId = new Map<string, number>();
        // Live POS current_stock per inventory item — used to repair the displayed
        // system quantity for records that were stored with system_quantity=0
        // (POS-driven branches before the outlet-sourcing fix).
        const liveStockByInvId = new Map<string, number>();
        for (const d of drinkRows) {
            const invId = invIdByDrinkId.get(String(d.id));
            if (!invId) continue;
            salesByInvId.set(invId, salesByDrinkId.get(String(d.id)) ?? 0);
            shiftAdditionsByInvId.set(invId, additionsByDrinkId.get(String(d.id)) ?? 0);
            liveStockByInvId.set(invId, stockByDrinkId.get(String(d.id)) ?? 0);
        }

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

        // If stocktake records exist, return them (submitted view) enriched with shift metadata
        if (existingRecords && existingRecords.length > 0) {
            const rawResult = existingRecords.map((r: any) => {
                const invId = String(r.item_id);
                const sales = salesByInvId.get(invId) ?? 0;
                // Stored system_quantity is authoritative, but fall back to the
                // live POS stock when it's 0 — POS-driven branches (Kyogong) saved
                // 0 before the outlet-sourcing fix, which made every count a false
                // +variance. A genuinely 0-stock drink has ~0 live stock too, so
                // this only repairs the broken-zero case.
                const storedSys = num(r.system_quantity);
                const sysQty = storedSys > 0 ? storedSys : (liveStockByInvId.get(invId) ?? 0);
                // Opening = previous stocktake's physical count; only reverse-
                // compute (using shift additions) for the very first count.
                const opening = prevCountByInvId.has(invId)
                    ? prevCountByInvId.get(invId)!
                    : Math.max(0, sysQty - (shiftAdditionsByInvId.get(invId) ?? 0) + sales);
                // Additions DERIVED from the identity closing = opening + adds −
                // sales, so every unit issued into the bar is reflected even if
                // no shift was open when it was issued.
                const additions = Math.max(0, sysQty - opening + sales);
                return withPostingFields({
                    ...r,
                    item_name: r.item?.item_name || r.item_name || null,
                    additions,
                    issuance: 0,
                    sales,
                    opening_stock: opening,
                    system_quantity: sysQty,
                });
            });
            const result = await enrichWithShiftInfo(rawResult);
            res.status(200).json({ success: true, data: result, shift_id: shiftWindow.shiftId, stocktake_variance_large_pct: largePct, stocktake_variance_extreme_pct: extremePct });
            return;
        }

        const candidates = drinkRows.map((d: any) => {
            const invId = d.inventory_item_id || fallbackInvIdByDrinkId.get(String(d.id));
            if (!invId) return null;
            const did = String(d.id);
            const currentStock = stockByDrinkId.get(did) ?? 0;
            const sales = salesByInvId.get(invId) ?? 0;
            // Opening = previous stocktake's physical count; reverse-compute
            // (using shift additions) only for the very first count.
            const opening = prevCountByInvId.has(invId)
                ? prevCountByInvId.get(invId)!
                : Math.max(0, currentStock - (shiftAdditionsByInvId.get(invId) ?? 0) + sales);
            // Additions DERIVED from live outlet stock so issues into the bar are
            // always reflected: additions = current − opening + sales.
            const additions = Math.max(0, currentStock - opening + sales);
            const system = currentStock;
            return withPostingFields({
                id: invId,
                name: d.name,
                quantity: system,
                opening_stock: opening,
                additions,
                issuance: 0,
                sales,
                shift_id: shiftWindow.shiftId,
                unit: d.unit || 'bottle',
                sku: d.sku || `bard-${d.id}`,
                category: null,
            });
        }).filter(Boolean);

        res.status(200).json({ success: true, data: candidates, shift_id: shiftWindow.shiftId, stocktake_variance_large_pct: largePct, stocktake_variance_extreme_pct: extremePct });
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
 *          first count). variance = physical - system. Variances are flagged
 *          and sent to the accountant for review — no reason required at submission.
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
        const branchId = resolveScopedBranchId(req, branch_id);
        logger.info(`recordBarStocktake: branch_id=${branch_id} bar_location=${bar_location} date=${stocktakeDate} items=${Array.isArray(items) ? items.length : 'non-array'}`);
        if (!branchId) {
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

        // Source the drinks straight from THIS bar's own POS outlet, exactly like
        // the GET (listBarStocktakes). The outlet's pos_outlet_items define what
        // the bar actually sells and carry the live current_stock; bar_drinks is
        // used ONLY to resolve inventory_item_id, looked up by the POS item's
        // source_item_id REGARDLESS of branch. POS-driven branches (e.g. Kyogong)
        // reuse another branch's drink catalog and have ZERO bar_drinks of their
        // own — the old `bar_drinks WHERE branch_id` query returned nothing, so
        // system/opening/additions all stored as 0 and every count looked like a
        // full +variance. Sourcing from the outlet fixes that.
        const outlet = await resolveBarOutlet(branchId, bar_location);
        const { data: outletItemRows } = outlet?.id
            ? await supabase
                .from('pos_outlet_items')
                .select('id, name, sku, unit, current_stock, cost_price, selling_price, source_item_id')
                .eq('outlet_id', outlet.id)
                .eq('source_table', 'bar_drinks')
                .eq('is_active', true)
            : { data: [] as any[] };
        const outletItems = (outletItemRows || []) as Array<Record<string, any>>;

        // current_stock summed per drink id (a drink may sit under >1 POS item).
        const posStockByDrinkId = new Map<string, number>();
        const posDrinkIdSet = new Set<string>();
        for (const oi of outletItems) {
            const did = String(oi.source_item_id || '').trim();
            if (!did) continue;
            posDrinkIdSet.add(did);
            posStockByDrinkId.set(did, num(posStockByDrinkId.get(did)) + num(oi.current_stock));
        }
        const posDrinkIds = Array.from(posDrinkIdSet);

        // Resolve those drinks (inventory_item_id/name/sku) by id — NOT by branch.
        const { data: outletDrinkRows } = posDrinkIds.length > 0
            ? await supabase
                .from('bar_drinks')
                .select('id, inventory_item_id, name, unit, sku, cost_price, selling_price')
                .in('id', posDrinkIds)
            : { data: [] as any[] };
        let branchDrinks = (outletDrinkRows || []) as Array<Record<string, any>>;

        // Fallback to the branch's own catalog only if the outlet has no POS items.
        if (branchDrinks.length === 0) {
            const { data: allBranchDrinks } = await supabase
                .from('bar_drinks')
                .select('id, inventory_item_id, name, unit, sku, cost_price, selling_price')
                .eq('branch_id', branchId)
                .eq('is_active', true);
            branchDrinks = (allBranchDrinks || []) as Array<Record<string, any>>;
        }

        // Resolve inventory_item_id for drinks that are missing it.
        const drinksNeedingLink = branchDrinks
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

        // Build invId → drinkId map (covers both stamped and fallback drinks).
        const drinkIdByInvId = new Map<string, string>();
        for (const d of branchDrinks) {
            const invId = d.inventory_item_id || fallbackInvIdByDrinkId.get(String(d.id));
            if (invId && invIds.includes(String(invId))) {
                drinkIdByInvId.set(String(invId), String(d.id));
            }
        }
        const shiftWindow = await getLastClosedBarShiftWindow(branchId, bar_location, stocktakeDate);
        const sumWindow = await getSinceLastApprovalWindow(branchId, bar_location, stocktakeDate);
        const { additionsByDrinkId, salesByDrinkId } = await loadShiftCountMaps(
            branchId,
            bar_location,
            sumWindow.from,
            sumWindow.to
        );

        // current_stock per drink comes straight from the outlet's POS items.
        const stockByDrinkId = posStockByDrinkId;
        // Shift additions only seed opening for the first-ever count; later
        // additions are derived from stock so shift-less issues still show.
        const shiftAdditionsByInvId = new Map<string, number>();
        const salesByInvId = new Map<string, number>();
        for (const [invId, drinkId] of Array.from(drinkIdByInvId.entries())) {
            shiftAdditionsByInvId.set(invId, additionsByDrinkId.get(String(drinkId)) ?? 0);
            salesByInvId.set(invId, salesByDrinkId.get(String(drinkId)) ?? 0);
        }
        // Previous stocktake's physical count → today's opening (submitted too).
        const prevCountByInvId = await loadPreviousStocktakeCounts(branchId, bar_location, stocktakeDate);

        const stockByInvId = new Map<string, number>();
        for (const [invId, drinkId] of Array.from(drinkIdByInvId.entries())) {
            stockByInvId.set(invId, stockByDrinkId.get(drinkId) ?? 0);
        }

        const now = new Date().toISOString();
        const missingReasons: string[] = [];
        const rows = items.map((it: any) => {
            const invId = String(it.item_id);
            const invItem = invById.get(invId);
            const currentStock = stockByInvId.get(invId) ?? 0;
            const sales = salesByInvId.get(invId) ?? 0;
            // Opening = previous stocktake's physical count; reverse-compute with
            // shift additions only for the first-ever count.
            const opening = prevCountByInvId.has(invId)
                ? prevCountByInvId.get(invId)!
                : Math.max(0, currentStock - (shiftAdditionsByInvId.get(invId) ?? 0) + sales);
            // Additions derived so bar issues are reflected even without a shift.
            const additions = Math.max(0, currentStock - opening + sales);
            // Must match the candidate-list formula (which resolves to currentStock)
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

            return {
                branch_id: branchId,
                bar_location,
                stocktake_date: stocktakeDate,
                shift_id: shiftWindow.shiftId || null,
                item_id: invId,  // inventory_items UUID (satisfies FK)
                opening_stock: opening,
                additions,
                sales,
                system_quantity: sysQty,
                physical_quantity: physQty,
                // variance is a GENERATED column — do NOT include it
                reason_for_variance: hasVariance && it.reason_for_variance ? String(it.reason_for_variance).trim() : null,
                explanation: hasVariance && it.explanation ? String(it.explanation).trim() : null,
                action_taken: hasVariance && it.action_taken ? String(it.action_taken).trim() : null,
                recorded_by: req.user?.id || null,
                recorded_at: now,
                status: 'pending'
            };
        });

        const validRows = rows.filter(Boolean);
        if (missingReasons.length > 0) {
            res.status(400).json({
                success: false,
                message: 'Some items are missing a valid physical count',
                items: missingReasons
            });
            return;
        }
        if (validRows.length === 0) {
            res.status(400).json({ success: false, message: 'Could not resolve any items for stocktake' });
            return;
        }

        // Prevent "ON CONFLICT DO UPDATE command cannot affect row a second time"
        // by deduplicating rows based on item_id (keeping the last occurrence if duplicates exist).
        const uniqueRowsMap = new Map();
* @access  Branch Storekeeper, Central Storekeeper, Super Admin
 */
export const recordBarStocktake = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, bar_location, items } = req.body || {};
        const stocktakeDate = req.body?.stocktake_date || new Date().toISOString().split('T')[0];
        const branchId = resolveScopedBranchId(req, branch_id);
        logger.info(`recordBarStocktake: branch_id=${branch_id} bar_location=${bar_location} date=${stocktakeDate} items=${Array.isArray(items) ? items.length : 'non-array'}`);
        if (!branchId) {
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

        // Source the drinks straight from THIS bar's own POS outlet, exactly like
        // the GET (listBarStocktakes). The outlet's pos_outlet_items define what
        // the bar actually sells and carry the live current_stock; bar_drinks is
        // used ONLY to resolve inventory_item_id, looked up by the POS item's
        // source_item_id REGARDLESS of branch. POS-driven branches (e.g. Kyogong)
        // reuse another branch's drink catalog and have ZERO bar_drinks of their
        // own — the old `bar_drinks WHERE branch_id` query returned nothing, so
        // system/opening/additions all stored as 0 and every count looked like a
        // full +variance. Sourcing from the outlet fixes that.
        const outlet = await resolveBarOutlet(branchId, bar_location);
        const { data: outletItemRows } = outlet?.id
            ? await supabase
                .from('pos_outlet_items')
                .select('id, name, sku, unit, current_stock, cost_price, selling_price, source_item_id')
                .eq('outlet_id', outlet.id)
                .eq('source_table', 'bar_drinks')
                .eq('is_active', true)
            : { data: [] as any[] };
        const outletItems = (outletItemRows || []) as Array<Record<string, any>>;

        // current_stock summed per drink id (a drink may sit under >1 POS item).
        const posStockByDrinkId = new Map<string, number>();
        const posDrinkIdSet = new Set<string>();
        for (const oi of outletItems) {
            const did = String(oi.source_item_id || '').trim();
            if (!did) continue;
            posDrinkIdSet.add(did);
            posStockByDrinkId.set(did, num(posStockByDrinkId.get(did)) + num(oi.current_stock));
        }
        const posDrinkIds = Array.from(posDrinkIdSet);

        // Resolve those drinks (inventory_item_id/name/sku) by id — NOT by branch.
        const { data: outletDrinkRows } = posDrinkIds.length > 0
            ? await supabase
                .from('bar_drinks')
                .select('id, inventory_item_id, name, unit, sku, cost_price, selling_price')
                .in('id', posDrinkIds)
            : { data: [] as any[] };
        let branchDrinks = (outletDrinkRows || []) as Array<Record<string, any>>;

        // Fallback to the branch's own catalog only if the outlet has no POS items.
        if (branchDrinks.length === 0) {
            const { data: allBranchDrinks } = await supabase
                .from('bar_drinks')
                .select('id, inventory_item_id, name, unit, sku, cost_price, selling_price')
                .eq('branch_id', branchId)
                .eq('is_active', true);
            branchDrinks = (allBranchDrinks || []) as Array<Record<string, any>>;
        }

        // Resolve inventory_item_id for drinks that are missing it.
        const drinksNeedingLink = branchDrinks
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

        // Build invId → drinkId map (covers both stamped and fallback drinks).
        const drinkIdByInvId = new Map<string, string>();
        for (const d of branchDrinks) {
            const invId = d.inventory_item_id || fallbackInvIdByDrinkId.get(String(d.id));
            if (invId && invIds.includes(String(invId))) {
                drinkIdByInvId.set(String(invId), String(d.id));
            }
        }
        const shiftWindow = await getLastClosedBarShiftWindow(branchId, bar_location, stocktakeDate);
        const sumWindow = await getSinceLastApprovalWindow(branchId, bar_location, stocktakeDate);
        const { additionsByDrinkId, salesByDrinkId } = await loadShiftCountMaps(
            branchId,
            bar_location,
            sumWindow.from,
            sumWindow.to
        );

        // current_stock per drink comes straight from the outlet's POS items.
        const stockByDrinkId = posStockByDrinkId;
        // Shift additions only seed opening for the first-ever count; later
        // additions are derived from stock so shift-less issues still show.
        const shiftAdditionsByInvId = new Map<string, number>();
        const salesByInvId = new Map<string, number>();
        for (const [invId, drinkId] of Array.from(drinkIdByInvId.entries())) {
            shiftAdditionsByInvId.set(invId, additionsByDrinkId.get(String(drinkId)) ?? 0);
            salesByInvId.set(invId, salesByDrinkId.get(String(drinkId)) ?? 0);
        }
        // Previous stocktake's physical count → today's opening (submitted too).
        const prevCountByInvId = await loadPreviousStocktakeCounts(branchId, bar_location, stocktakeDate);

        const stockByInvId = new Map<string, number>();
        for (const [invId, drinkId] of Array.from(drinkIdByInvId.entries())) {
            stockByInvId.set(invId, stockByDrinkId.get(drinkId) ?? 0);
        }

        const now = new Date().toISOString();
        const missingReasons: string[] = [];
        const rows = items.map((it: any) => {
            const invId = String(it.item_id);
            const invItem = invById.get(invId);
            const currentStock = stockByInvId.get(invId) ?? 0;
            const sales = salesByInvId.get(invId) ?? 0;
            // Opening = previous stocktake's physical count; reverse-compute with
            // shift additions only for the first-ever count.
            const opening = prevCountByInvId.has(invId)
                ? prevCountByInvId.get(invId)!
                : Math.max(0, currentStock - (shiftAdditionsByInvId.get(invId) ?? 0) + sales);
            // Additions derived so bar issues are reflected even without a shift.
            const additions = Math.max(0, currentStock - opening + sales);
            // Must match the candidate-list formula (which resolves to currentStock)
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

            return {
                branch_id: branchId,
                bar_location,
                stocktake_date: stocktakeDate,
                shift_id: shiftWindow.shiftId || null,
                item_id: invId,  // inventory_items UUID (satisfies FK)
                opening_stock: opening,
                additions,
                sales,
                system_quantity: sysQty,
                physical_quantity: physQty,
                // variance is a GENERATED column — do NOT include it
                reason_for_variance: hasVariance && it.reason_for_variance ? String(it.reason_for_variance).trim() : null,
                explanation: hasVariance && it.explanation ? String(it.explanation).trim() : null,
                action_taken: hasVariance && it.action_taken ? String(it.action_taken).trim() : null,
                recorded_by: req.user?.id || null,
                recorded_at: now,
                status: 'pending'
            };
        });

        const validRows = rows.filter(Boolean);
        if (missingReasons.length > 0) {
            res.status(400).json({
                success: false,
                message: 'Some items are missing a valid physical count',
                items: missingReasons
            });
            return;
        }
        if (validRows.length === 0) {
            res.status(400).json({ success: false, message: 'Could not resolve any items for stocktake' });
            return;
        }

        // Prevent "ON CONFLICT DO UPDATE command cannot affect row a second time"
        // by deduplicating rows based on item_id (keeping the last occurrence if duplicates exist).
        const uniqueRowsMap = new Map();
        for (const row of validRows) {
            if (row) {
                uniqueRowsMap.set(row.item_id, row);
            }
        }
        const finalRows = Array.from(uniqueRowsMap.values());

        const { data, error } = await supabase
            .from('bar_stocktake_records')
            .upsert(finalRows, { onConflict: 'branch_id,bar_location,stocktake_date,item_id' })
            .select('*, item:inventory_items(id, item_name, unit)');
        if (error) throw error;

        // Immediately update live bar_stock & pos_outlet_items so subsequent shift openings use physical count as baseline
        const targetOutletTypes = bar_location === 'executive_bar'
            ? ['executive_bar', 'kyogong_executive_bar']
            : ['main_bar', 'sports_bar', 'kyogong_sports_bar'];

        await Promise.all([
            db.query(
                `UPDATE public.bar_stock bs
                 SET current_stock = GREATEST(0, btr.physical_quantity::numeric),
                     updated_at    = NOW()
                 FROM public.bar_stocktake_records btr
                 JOIN public.bar_drinks bd ON bd.inventory_item_id = btr.item_id
                 WHERE bs.drink_id        = bd.id
                   AND bs.branch_id       = btr.branch_id
                   AND btr.branch_id      = $1
                   AND btr.bar_location   = $2
                   AND btr.stocktake_date = $3`,
                [branchId, bar_location, stocktakeDate]
            ).catch((e: any) => logger.warn('recordBarStocktake: bar_stock live update non-fatal:', e?.message || e)),
            db.query(
                `UPDATE public.pos_outlet_items poi
                 SET current_stock = GREATEST(0, btr.physical_quantity::numeric),
                     updated_at    = NOW()
                 FROM public.bar_stocktake_records btr
                 JOIN public.bar_drinks bd ON bd.inventory_item_id = btr.item_id
                 JOIN public.pos_outlets po ON po.branch_id  = btr.branch_id
                                           AND po.outlet_type = ANY($4::text[])
                 WHERE poi.outlet_id      = po.id
                   AND poi.source_item_id = bd.id::text
                   AND btr.branch_id      = $1
                   AND btr.bar_location   = $2
                   AND btr.stocktake_date = $3`,
                [branchId, bar_location, stocktakeDate, targetOutletTypes]
            ).catch((e: any) => logger.warn('recordBarStocktake: pos_outlet_items live update non-fatal:', e?.message || e))
        ]);

        // Sync into the unified stock_counts table so the cashier shift gate works.
        // Non-fatal: a constraint or schema error in stock_counts must not block the stocktake submission itself.
        syncBarStocktakeToStockCounts(branchId, bar_location, stocktakeDate, 'pending')
            .catch((syncErr: any) => logger.warn('recordBarStocktake: stock_counts sync failed (non-fatal):', syncErr?.message || syncErr));

        // Flatten item_name to top level for the Flutter UI
        const result = (data || []).map((r: any) => withPostingFields({
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
 */
export const reviewBarStocktake = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const existing = await loadRecord(req.params.id);
        if (!existing) {
            res.status(404).json({ success: false, message: 'Stocktake record not found' });
            return;
        }
        if (!canAccessRecordBranch(req, existing.branch_id)) {
            res.status(403).json({ success: false, message: 'Forbidden: stocktake record belongs to another branch' });
            return;
        }

        const { data, error } = await supabase
            .from('bar_stocktake_records')
            .update({
                status: 'reviewed',
                reviewed_by: req.user?.id || null,
                reviewed_at: new Date().toISOString()
            })
            .eq('id', req.params.id)
            .select('*, item:inventory_items(id, item_name, unit)')
            .single();
        if (error) throw error;

        res.status(200).json({ success: true, data: { ...data, item_name: data?.item?.item_name || null } });
    } catch (error) {
        logger.error('reviewBarStocktake failed:', error);
        next(error);
    }
};

/**
 * @desc    Accountant approves a bar stocktake record (or all records for the date/location).
 * @route   PATCH /api/storekeeping/bar-stocktake/:id/approve
 */
export const approveBarStocktake = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const existing = await loadRecord(req.params.id);
        if (!existing) {
            res.status(404).json({ success: false, message: 'Stocktake record not found' });
            return;
        }
        if (!canAccessRecordBranch(req, existing.branch_id)) {
            res.status(403).json({ success: false, message: 'Forbidden: stocktake record belongs to another branch' });
            return;
        }
        if (existing.status === 'approved') {
            res.status(200).json({
                success: true,
                message: 'Stocktake record already approved',
                data: {
                    ...existing,
                    item_name: existing.item?.item_name || existing.item_name || null,
                }
            });
            return;
        }
        if (!['pending', 'reviewed'].includes(existing.status)) {
            res.status(400).json({ success: false, message: `Cannot approve a record that is ${existing.status}` });
            return;
        }

        const { rows } = await approveBarSession(
            existing.branch_id,
            existing.bar_location,
            existing.stocktake_date,
            req.user?.id || null,
            req.header('Idempotency-Key') || `bar-stocktake-approve-${existing.branch_id}-${existing.bar_location}-${existing.stocktake_date}`,
        );
        const approved = rows.find((row: any) => row.id === req.params.id) || rows[0] || existing;
        res.status(200).json({ success: true, data: withPostingFields({ ...approved, item_name: approved.item?.item_name || approved.item_name || null }) });
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
        if (!canAccessRecordBranch(req, existing.branch_id)) {
            res.status(403).json({ success: false, message: 'Forbidden: stocktake record belongs to another branch' });
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
        const branchId = resolveScopedBranchId(req, branch_id);
        if (!branchId) {
            res.status(400).json({ success: false, message: 'branch_id is required' });
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
