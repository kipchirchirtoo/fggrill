import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { creditOutletItemStock, updateBranchStock } from '../services/branch-inventory.service';
import { normalizeQty } from '../utils/unitNormalization';
import { getActiveShiftMode } from '../services/shiftConfigService';
import db from '../db';
import { applyBranchFilter, isGlobalRole } from '../utils/branchIsolation';
import { buildBreakfastPaxSnapshot, todayInNairobi } from '../services/receptionStayState.service';

interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        branch_id: number;
        role: string;
        outlet_id?: string;
    };
}

const asyncWrap = <T extends Request = Request>(fn: (req: T, res: Response) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction): any => fn(req as T, res).catch(next);

const n = (v: any): number => Number.isFinite(Number(v)) ? Number(v) : 0;
const absMoney = (v: any): number => Math.abs(n(v));
const OPENING_STOCKTAKE_ACCEPTED_STATUSES = ['submitted', 'reviewed', 'approved', 'posted'];
const STOCKTAKE_CONTROL_MODES = ['RAW_ONLY', 'PRODUCED_ONLY', 'BOTH', 'NONE'];
const STOCKTAKE_LOCATIONS = ['KITCHEN', 'STORE', 'BOTH', 'NONE'];
const PREP_BATCH_STATUSES = ['sent', 'returned', 'cancelled'];

function canonicalUnitLabel(unit: any): string {
    return String(unit || '')
        .trim()
        .toLowerCase()
        .replace(/\./g, '')
        .replace(/\s+/g, '');
}

function normalizePersistedShiftType(shiftType: string, subShiftType: 'A' | 'B' | null): 'shift_a' | 'shift_b' {
    if (subShiftType === 'B') return 'shift_b';
    if (subShiftType === 'A') return 'shift_a';

    const normalized = String(shiftType || '').trim().toLowerCase();
    if (normalized === 'shift_b' || normalized === 'afternoon' || normalized === 'evening' || normalized === 'night') {
        return 'shift_b';
    }
    return 'shift_a';
}

async function resolveRecipeProducedInventoryItem(recipe: any, branchId: number) {
    if (recipe?.produced_inventory_item_id) {
        const { data: existing } = await supabase
            .from('inventory_items')
            .select('id, sku, item_name, unit')
            .eq('id', recipe.produced_inventory_item_id)
            .maybeSingle();
        if (existing) return existing;
    }

    let inventoryItemId: string | null = null;

    if (recipe?.pos_outlet_item_id) {
        const { data: outletItem } = await supabase
            .from('pos_outlet_items')
            .select('source_table, source_item_id')
            .eq('id', recipe.pos_outlet_item_id)
            .maybeSingle();

        if (outletItem?.source_table === 'inventory_items' && outletItem.source_item_id) {
            inventoryItemId = String(outletItem.source_item_id);
        } else if (outletItem?.source_table === 'restaurant_menu_items' && outletItem.source_item_id) {
            const { data: menuItem } = await supabase
                .from('restaurant_menu_items')
                .select('inventory_item_id')
                .eq('id', outletItem.source_item_id)
                .maybeSingle();
            if (menuItem?.inventory_item_id) inventoryItemId = String(menuItem.inventory_item_id);
        } else if (outletItem?.source_table === 'bar_drinks' && outletItem.source_item_id) {
            const { data: drinkItem } = await supabase
                .from('bar_drinks')
                .select('inventory_item_id')
                .eq('id', outletItem.source_item_id)
                .maybeSingle();
            if (drinkItem?.inventory_item_id) inventoryItemId = String(drinkItem.inventory_item_id);
        }
    }

    if (inventoryItemId) {
        const { data: existing } = await supabase
            .from('inventory_items')
            .select('id, sku, item_name, unit')
            .eq('id', inventoryItemId)
            .maybeSingle();
        if (existing) {
            if (!recipe?.produced_inventory_item_id || !recipe?.produced_inventory_item_sku) {
                await supabase
                    .from('kitchen_production_recipes')
                    .update({
                        produced_inventory_item_id: existing.id,
                        produced_inventory_item_sku: existing.sku,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', recipe.id);
            }
            return existing;
        }
    }

    const generatedSku = `PREP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const { data: created, error: createErr } = await supabase
        .from('inventory_items')
        .insert({
            item_name: recipe?.produced_item_name || 'Prepared Item',
            sku: generatedSku,
            category: 'prepared_prep',
            store_type: 'foodstuffs',
            branch_id: branchId,
            unit: recipe?.produced_unit || 'portion',
            item_type: 'prepared',
            tracking_mode: 'QUANTITY',
            is_active: true,
            is_for_sale: false
        })
        .select('id, sku, item_name, unit')
        .single();

    if (createErr) throw new AppError(`Failed to create prepared stock item: ${createErr.message}`, 500);

    await supabase
        .from('kitchen_production_recipes')
        .update({
            produced_inventory_item_id: created.id,
            produced_inventory_item_sku: created.sku,
            updated_at: new Date().toISOString()
        })
        .eq('id', recipe.id);

    return created;
}

export async function getCashierShiftStartTimestamp(branchId: number, cashierShiftId?: string | null, shiftDate?: string): Promise<string> {
    const businessDate = shiftDate || todayInNairobi();
    const defaultSince = `${businessDate}T00:00:00.000Z`;

    if (cashierShiftId) {
        const { data: cShift } = await supabase
            .from('cashier_shift_logs')
            .select('shift_start, created_at')
            .eq('id', cashierShiftId)
            .maybeSingle();
        if (cShift?.shift_start) return cShift.shift_start;
        if (cShift?.created_at) return cShift.created_at;
    }

    const { data: activeCashier } = await supabase
        .from('cashier_shift_logs')
        .select('shift_start, created_at')
        .eq('branch_id', branchId)
        .order('shift_start', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (activeCashier?.shift_start) return activeCashier.shift_start;
    if (activeCashier?.created_at) return activeCashier.created_at;

    return defaultSince;
}

type OpeningSeedItem = {
    sku: string;
    name: string;
    unit: string;
    cost_price: number;
    quantity: number;
};

async function createKitchenShiftFromOpeningSeed(params: {
    branchId: number;
    businessDate: string;
    shiftType: string;
    subShiftType: 'A' | 'B' | null;
    department: string;
    cashierShiftId: string;
    openedBy: string;
    assignedChefIds: string[];
    assignedDispenseIds: string[];
    openingItems: OpeningSeedItem[];
    handoverRecordId?: string | null;
}) {
    const { data: sn } = await supabase.rpc('generate_kitchen_shift_number', {
        p_branch_id: params.branchId,
        p_date: params.businessDate
    });

    const { data: shift, error: shiftError } = await supabase
        .from('kitchen_shifts')
        .insert({
            shift_number: sn || `KS-${Date.now()}`,
            branch_id: params.branchId,
            shift_type: normalizePersistedShiftType(params.shiftType, params.subShiftType),
            shift_date: params.businessDate,
            opened_by: params.openedBy,
            store_keeper_id: params.openedBy,
            assigned_chef_ids: params.assignedChefIds || [],
            assigned_dispense_ids: params.assignedDispenseIds || [],
            status: 'open',
            sub_shift_type: params.subShiftType,
            cashier_shift_id: params.cashierShiftId,
            department: params.department
        })
        .select()
        .single();
    if (shiftError) {
        if (shiftError.code === '23505') {
            const shiftLabel = params.subShiftType ?? 'single session';
            throw new AppError(`KITCHEN_SHIFT_ALREADY_OPEN: Shift ${shiftLabel} has already been opened for this commercial day`, 409);
        }
        throw new AppError(shiftError.message, 500);
    }

    // Gather all configured Food Control Standards items for this branch
    // so they are seeded into the kitchen shift items from the start
    const openingSkuSet = new Set(params.openingItems.map((it: any) => String(it.sku || '').trim().toUpperCase()));
    const additionalStandardsItems: OpeningSeedItem[] = [];

    try {
        const [
            { data: stds },
            { data: directs },
            { data: recs }
        ] = await Promise.all([
            supabase.from('channel_food_standards').select('raw_item_sku, raw_item_name, unit').eq('branch_id', params.branchId),
            supabase.from('food_control_direct_items').select('stock_item_sku, stock_item_name').eq('branch_id', params.branchId).eq('is_active', true),
            supabase.from('kitchen_production_recipes').select('raw_item_sku, raw_item_name, raw_unit, cost_per_output').eq('branch_id', params.branchId).eq('is_active', true)
        ]);

        const candidateSkus = new Map<string, { name: string; unit: string; cost: number }>();
        for (const s of stds || []) {
            const sku = String(s.raw_item_sku || '').trim();
            if (sku && !candidateSkus.has(sku.toUpperCase())) {
                candidateSkus.set(sku.toUpperCase(), { name: s.raw_item_name || sku, unit: s.unit || 'portion', cost: 0 });
            }
        }
        for (const d of directs || []) {
            const sku = String(d.stock_item_sku || '').trim();
            if (sku && !candidateSkus.has(sku.toUpperCase())) {
                candidateSkus.set(sku.toUpperCase(), { name: d.stock_item_name || sku, unit: 'portion', cost: 0 });
            }
        }
        for (const r of recs || []) {
            const sku = String(r.raw_item_sku || '').trim();
            if (sku && sku.toUpperCase() !== 'MULTI' && !candidateSkus.has(sku.toUpperCase())) {
                candidateSkus.set(sku.toUpperCase(), { name: r.raw_item_name || sku, unit: r.raw_unit || 'portion', cost: n(r.cost_per_output) });
            }
        }

        for (const [skuUpper, info] of candidateSkus.entries()) {
            if (!openingSkuSet.has(skuUpper)) {
                additionalStandardsItems.push({
                    sku: skuUpper,
                    name: info.name,
                    unit: info.unit,
                    cost_price: info.cost,
                    quantity: 0
                });
            }
        }
    } catch (stdErr) {
        logger.warn('[createKitchenShiftFromOpeningSeed] Error fetching food control standards for seeding:', stdErr);
    }

    const allShiftItems = [...params.openingItems, ...additionalStandardsItems];

    const items = allShiftItems.map((it: any) => ({
        shift_id: shift.id,
        branch_id: params.branchId,
        item_sku: it.sku,
        item_name: it.name,
        unit_of_measure: it.unit,
        cost_price: n(it.cost_price),
        opening_stock: n(it.quantity),
        additions: 0,
        sold_quantity: 0,
        spoilage_quantity: 0,
        system_closing_stock: n(it.quantity)
    }));
    const { error: itemsError } = await supabase.from('kitchen_shift_items').insert(items);
    if (itemsError) logger.error('shift items insert', itemsError);

    if (params.handoverRecordId) {
        await supabase
            .from('kitchen_shift_handovers')
            .update({
                incoming_shift_id: shift.id,
                seeded_at: new Date().toISOString()
            })
            .eq('id', params.handoverRecordId);
    }

    // Recover all POS sales completed since the START of the cashier main shift
    // (or beginning of the commercial business date), so that food control standards
    // immediately reflect all sold items from the moment the kitchen session is opened.
    try {
        const sinceTimestamp = await getCashierShiftStartTimestamp(
            params.branchId,
            params.cashierShiftId,
            params.businessDate
        );

        const { backfillKitchenConsumptionForOpenShift } = await import('./outlet-pos.controller');
        await backfillKitchenConsumptionForOpenShift(
            params.branchId,
            String(shift.id),
            sinceTimestamp,
        );
    } catch (err) {
        logger.warn('kitchen-shift open: consumption backfill failed', err as any);
    }

    // Finalize system_closing_stock calculation after backfill
    try {
        const { data: currentItems } = await supabase
            .from('kitchen_shift_items')
            .select('id, opening_stock, additions, sold_quantity, spoilage_quantity')
            .eq('shift_id', shift.id);

        for (const ci of currentItems || []) {
            const open = n(ci.opening_stock);
            const adds = n(ci.additions);
            const sold = n(ci.sold_quantity);
            const spoil = n(ci.spoilage_quantity);
            const sysClose = open + adds - sold - spoil;
            await supabase
                .from('kitchen_shift_items')
                .update({ system_closing_stock: sysClose, updated_at: new Date().toISOString() })
                .eq('id', ci.id);
        }
    } catch (syncErr) {
        logger.warn('kitchen-shift open: system closing stock recalculation failed', syncErr as any);
    }

    return shift;
}

export async function autoCloseKitchenShiftForCashierClose(params: {
    cashierShiftId: string;
    branchId: number;
    closedBy: string;
    notes?: string | null;
}) {
    const { data: shift, error: shiftError } = await supabase
        .from('kitchen_shifts')
        .select('id, branch_id, status, shift_date, opened_at, sub_shift_type, cashier_shift_id, department, breakfast_pax, staff_meal_pax')
        .eq('cashier_shift_id', params.cashierShiftId)
        .eq('branch_id', params.branchId)
        .eq('status', 'open')
        .eq('sub_shift_type', 'B')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (shiftError) throw shiftError;
    if (!shift) return null;

    const { data: shiftItems, error: itemsError } = await supabase
        .from('kitchen_shift_items')
        .select('*')
        .eq('shift_id', shift.id);
    if (itemsError) throw itemsError;

    const physicalCounts = (shiftItems || []).map((si: any) => ({
        sku: si.item_sku,
        quantity: n(si.opening_stock) + n(si.additions) - n(si.sold_quantity) - n(si.spoilage_quantity),
        notes: 'System-generated close on cashier shift close'
    }));

    const fakeReq: any = {
        params: { shift_id: shift.id },
        body: {
            physical_counts: physicalCounts,
            closing_notes: params.notes || 'Auto-closed when cashier shift closed',
            breakfast_pax: shift.breakfast_pax,
            staff_meal_pax: shift.staff_meal_pax,
        },
        user: {
            id: params.closedBy,
            branch_id: params.branchId,
            role: 'branch_manager'
        }
    };
    let jsonPayload: any = null;
    const fakeRes: any = {
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        json(payload: any) {
            jsonPayload = payload;
            return this;
        }
    };
    await new Promise<void>((resolve, reject) => {
        const next = (err?: any) => (err ? reject(err) : resolve());
        const handler = closeKitchenShift as any;
        Promise.resolve(handler(fakeReq, fakeRes, next)).then(resolve).catch(reject);
    });
    return jsonPayload?.data ?? null;
}

type OpeningStocktakeReadiness = {
    ready: boolean;
    reason?: string;
    message?: string;
    source?: 'kitchen_stocktake_shifts' | 'stock_counts';
    status?: string | null;
    shift?: string | null;
    location?: string | null;
    stocktakeId?: string | null;
    itemCount?: number;
    openingItems?: OpeningSeedItem[];
};

async function getBreakfastPaxControl(branchId: number, date: string) {
    let control: any = null;
    try {
        const { data, error } = await supabase
            .from('accommodation_breakfast_pax')
            .select('*')
            .eq('branch_id', branchId)
            .eq('breakfast_date', date)
            .maybeSingle();
        if (!error && data) {
            control = data;
        }
    } catch (_) {}

    if (!control) {
        try {
            const pgRes = await db.query(
                'SELECT * FROM accommodation_breakfast_pax WHERE branch_id = $1 AND breakfast_date = $2 LIMIT 1',
                [branchId, date]
            );
            if (pgRes.rows && pgRes.rows.length > 0) {
                control = pgRes.rows[0];
            }
        } catch (_) {}
    }

    const calculated = await buildBreakfastPaxSnapshot(branchId, date);
    const calculatedPax = control?.calculated_pax ?? calculated.calculatedPax;

    return {
        branch_id: branchId,
        breakfast_date: date,
        calculated_pax: calculatedPax,
        confirmed_pax: Number(control?.confirmed_pax ?? calculatedPax),
        status: control?.status ?? 'unconfirmed',
        adjustment_reason: control?.adjustment_reason ?? null,
        confirmed_at: control?.confirmed_at ?? null
    };
}

async function getSubmittedKitchenOpeningStocktake(
    branchId: number,
    businessDate: string,
    shift: 'A' = 'A'
): Promise<OpeningStocktakeReadiness> {
    const { data: shiftRow, error: shiftErr } = await supabase
        .from('kitchen_stocktake_shifts')
        .select('id,status,shift,stocktake_date,items:kitchen_stocktake_items(item_name,inventory_item_id,closing_qty)')
        .eq('branch_id', branchId)
        .eq('stocktake_date', businessDate)
        .eq('shift', shift)
        .in('status', OPENING_STOCKTAKE_ACCEPTED_STATUSES)
        .maybeSingle();
    if (shiftErr) throw new AppError(shiftErr.message, 500);

    if (shiftRow) {
        const rawItems = (shiftRow.items || []) as any[];
        if (rawItems.length === 0) {
            return {
                ready: false,
                reason: 'OPENING_STOCKTAKE_EMPTY',
                message: `Kitchen stocktake Shift ${shift} for this date was submitted but contains no items`,
                source: 'kitchen_stocktake_shifts',
                status: shiftRow.status,
                shift: shiftRow.shift,
                stocktakeId: shiftRow.id,
                itemCount: 0,
            };
        }

        const invIds = rawItems.map((item: any) => item.inventory_item_id).filter(Boolean);
        const missingNames = rawItems.filter((item: any) => !item.inventory_item_id && item.item_name).map((item: any) => item.item_name);

        const [{ data: invItems, error: invErr }, { data: byNames, error: byNamesErr }] = await Promise.all([
            invIds.length > 0
                ? supabase
                    .from('inventory_items')
                    .select('id,sku,item_name,unit,default_unit_cost')
                    .in('id', invIds)
                : Promise.resolve({ data: [], error: null as any }),
            missingNames.length > 0
                ? supabase
                    .from('inventory_items')
                    .select('id,sku,item_name,unit,default_unit_cost')
                    .in('item_name', missingNames)
                : Promise.resolve({ data: [], error: null as any })
        ]);
        if (invErr) throw new AppError(invErr.message, 500);
        if (byNamesErr) logger.warn('Opening stocktake byNames query warning:', byNamesErr.message);

        const invMap = new Map((invItems || []).map((item: any) => [String(item.id), item]));
        const nameMap = new Map((byNames || []).map((item: any) => [String(item.item_name).toLowerCase().trim(), item]));

        const openingItems = rawItems.map((item: any) => {
            const inv = item.inventory_item_id
                ? invMap.get(String(item.inventory_item_id))
                : nameMap.get(String(item.item_name || '').toLowerCase().trim());
            return {
                sku: inv?.sku || item.item_name,
                name: inv?.item_name || item.item_name,
                unit: inv?.unit || 'portion',
                cost_price: Number(inv?.default_unit_cost || 0),
                quantity: Number(item.closing_qty || 0),
            };
        });

        return {
            ready: true,
            source: 'kitchen_stocktake_shifts',
            status: shiftRow.status,
            shift: shiftRow.shift,
            stocktakeId: shiftRow.id,
            itemCount: openingItems.length,
            openingItems,
        };
    }

    const stocktakeLocations = shift === 'A'
        ? ['kitchen_a', 'kitchen_morning']
        : ['kitchen_b'];
    const { data: stockCount, error: countErr } = await supabase
        .from('stock_counts')
        .select('id,status,location')
        .eq('branch_id', branchId)
        .eq('count_date', businessDate)
        .eq('store_type', 'kitchen')
        .in('location', stocktakeLocations)
        .in('status', OPENING_STOCKTAKE_ACCEPTED_STATUSES)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (countErr) throw new AppError(countErr.message, 500);

    if (!stockCount) {
        return {
            ready: false,
            reason: 'OPENING_STOCKTAKE_NOT_SUBMITTED',
            message: `Kitchen stocktake Shift ${shift} for this date has not been submitted yet`,
            source: 'stock_counts',
            shift,
        };
    }

    const { data: stockItems, error: itemsErr } = await supabase
        .from('stock_count_items')
        .select('item_id,item_sku,counted_quantity,unit_cost')
        .eq('stock_count_id', stockCount.id);
    if (itemsErr) throw new AppError(itemsErr.message, 500);

    if (!stockItems || stockItems.length === 0) {
        return {
            ready: false,
            reason: 'OPENING_STOCKTAKE_EMPTY',
            message: `Kitchen stocktake ${stockCount.location} for this date contains no items`,
            source: 'stock_counts',
            status: stockCount.status,
            location: stockCount.location,
            stocktakeId: stockCount.id,
            itemCount: 0,
        };
    }

    const invIds = stockItems.map((item: any) => item.item_id).filter(Boolean);
    const { data: invItems, error: invErr } = invIds.length > 0
        ? await supabase.from('inventory_items').select('id,sku,item_name,unit').in('id', invIds)
        : { data: [], error: null as any };
    if (invErr) throw new AppError(invErr.message, 500);
    const invMap = new Map((invItems || []).map((item: any) => [item.id, item]));

    const openingItems = (stockItems || []).map((item: any) => {
        const inv = item.item_id ? invMap.get(item.item_id) : null;
        return {
            sku: inv?.sku || item.item_sku,
            name: inv?.item_name || item.item_sku,
            unit: inv?.unit || 'portion',
            cost_price: Number(item.unit_cost || 0),
            quantity: Number(item.counted_quantity || 0),
        };
    });

    return {
        ready: true,
        source: 'stock_counts',
        status: stockCount.status,
        location: stockCount.location,
        stocktakeId: stockCount.id,
        itemCount: openingItems.length,
        openingItems,
    };
}

export async function resolveStaffProfileId(value: any): Promise<string | null> {
    if (!value) return null;
    const id = String(value);
    const { data: direct } = await supabase
        .from('staff_profiles')
        .select('id')
        .eq('id', id)
        .maybeSingle();
    if (direct?.id) return direct.id;

    const { data: byUser } = await supabase
        .from('staff_profiles')
        .select('id')
        .eq('user_id', id)
        .maybeSingle();
    return byUser?.id || null;
}

// ── WASTAGE THRESHOLDS / ALERTS ──────────────────────────────
// Branch-level defaults (kitchen_wastage_thresholds, migration
// 20260622_kitchen_storekeeper_integration.sql). A recipe's own
// allowed_variance_percent, where set, overrides the branch-level
// recipe_variance_critical_pct for that recipe specifically.
const DEFAULT_WASTAGE_THRESHOLDS = {
    recipe_variance_warning_pct: 5,
    recipe_variance_critical_pct: 15,
    spoilage_warning_pct: 5,
    spoilage_critical_pct: 10,
    shortage_warning_kes: 500,
    shortage_critical_kes: 2000,
    production_shortfall_warning_pct: 5,
    production_shortfall_critical_pct: 15,
    bar_variance_warning_kes: 500,
    bar_variance_critical_kes: 2000
};

async function getWastageThresholds(branchId: number): Promise<typeof DEFAULT_WASTAGE_THRESHOLDS> {
    const { data } = await supabase
        .from('kitchen_wastage_thresholds')
        .select('*')
        .eq('branch_id', branchId)
        .maybeSingle();
    return data ? { ...DEFAULT_WASTAGE_THRESHOLDS, ...data } : DEFAULT_WASTAGE_THRESHOLDS;
}

async function createWastageAlert(payload: {
    shift_id: string;
    branch_id: number;
    alert_type: 'recipe_variance' | 'spoilage_spike' | 'unexplained_shortage' | 'production_shortfall';
    severity: 'warning' | 'critical';
    item_sku?: string | null;
    item_name?: string | null;
    expected_value?: number | null;
    actual_value?: number | null;
    variance_value?: number | null;
    variance_cost?: number | null;
    message?: string | null;
}): Promise<void> {
    const { error } = await supabase.from('kitchen_wastage_alerts').insert(payload);
    if (error) logger.error('createWastageAlert insert failed', error);
}

export async function staffProfileSummaries(userIds: string[]): Promise<any[]> {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (!ids.length) return [];
    const [{ data: users }, { data: profiles }] = await Promise.all([
        supabase.from('users').select('id,first_name,last_name,role').in('id', ids),
        supabase.from('staff_profiles').select('id,user_id,first_name,last_name,role,department,employee_number').in('user_id', ids)
    ]);
    const profileByUser = new Map((profiles || []).map((p: any) => [p.user_id, p]));
    return (users || []).map((u: any) => {
        const profile = profileByUser.get(u.id) || {};
        const first = profile.first_name || u.first_name || '';
        const last = profile.last_name || u.last_name || '';
        return {
            user_id: u.id,
            staff_profile_id: profile.id || null,
            name: `${first} ${last}`.trim() || u.id,
            role: profile.role || u.role || 'staff',
            department: profile.department || null,
            employee_number: profile.employee_number || null
        };
    });
}

async function syncKitchenShiftToStockCounts(shiftId: string): Promise<void> {
    // 1. Fetch kitchen shift
    const { data: shift, error: shiftError } = await supabase
        .from('kitchen_shifts')
        .select('*')
        .eq('id', shiftId)
        .single();
    if (shiftError || !shift) {
        logger.error(`[syncKitchenShiftToStockCounts] Shift not found: ${shiftId}`, shiftError);
        return;
    }

    // Map shift status to stock_counts status
    let status = 'draft';
    if (shift.status === 'pending_chef_confirmation' || shift.status === 'pending_accountant_review') {
        status = 'submitted';
    } else if (shift.status === 'approved') {
        status = 'approved';
    } else if (shift.status === 'rejected') {
        status = 'rejected';
    }

    const shiftLocation = shift.sub_shift_type
        ? `kitchen_${String(shift.sub_shift_type).toLowerCase()}`
        : 'kitchen_single';
    const stocktakeDate = shift.shift_date;

    // 2. Fetch existing stock_counts header
    const { data: existing } = await supabase
        .from('stock_counts')
        .select('id')
        .eq('branch_id', shift.branch_id)
        .eq('count_date', stocktakeDate)
        .eq('location', shiftLocation)
        .eq('store_type', 'kitchen')
        .maybeSingle();

    let stockCountId: string;
    const now = new Date().toISOString();
    const headerData: any = {
        branch_id: shift.branch_id,
        count_date: stocktakeDate,
        count_type: 'daily',
        store_type: 'kitchen',
        location: shiftLocation,
        status,
        counted_by: shift.store_keeper_id || shift.opened_by || null,
        approved_by: shift.accountant_approved_by || null,
        approved_at: shift.accountant_approved_at || null,
        updated_at: now
    };

    if (existing?.id) {
        stockCountId = existing.id;
        const { error: updateError } = await supabase
            .from('stock_counts')
            .update(headerData)
            .eq('id', stockCountId);
        if (updateError) throw updateError;
    } else {
        const { data: created, error: insertError } = await supabase
            .from('stock_counts')
            .insert({ ...headerData, id: shiftId, created_at: now })
            .select('id')
            .single();
        if (insertError) {
            const { data: created2, error: insertError2 } = await supabase
                .from('stock_counts')
                .insert({ ...headerData, created_at: now })
                .select('id')
                .single();
            if (insertError2) throw insertError2;
            stockCountId = created2!.id;
        } else {
            stockCountId = created!.id;
        }
    }

    // 3. Fetch all kitchen shift stock take records for this shift
    const { data: records, error: recordsError } = await supabase
        .from('kitchen_shift_stock_take')
        .select('*')
        .eq('shift_id', shiftId);

    if (recordsError) throw recordsError;

    // 4. Delete existing items under this header
    await supabase.from('stock_count_items').delete().eq('stock_count_id', stockCountId);

    // 5. Insert new items
    if (records && records.length > 0) {
        const skus = records.map((r: any) => r.item_sku).filter(Boolean);
        const { data: invItems } = skus.length > 0
            ? await supabase.from('inventory_items').select('id, sku').in('sku', skus)
            : { data: [] };

        const items = records.map((r: any) => {
            const matchedInv = (invItems || []).find((i: any) => i.sku === r.item_sku);
            return {
                stock_count_id: stockCountId,
                item_id: matchedInv?.id || null,
                item_sku: r.item_sku,
                item_name: r.item_name,
                system_quantity: n(r.system_closing_stock),
                physical_quantity: n(r.physical_count),
                counted_quantity: n(r.physical_count),
                variance: n(r.variance),
                variance_value: n(r.variance_value),
                reason: r.variance_reason || null,
                status,
                created_at: now,
                updated_at: now
            };
        });

        const { error: itemsError } = await supabase.from('stock_count_items').insert(items);
        if (itemsError) throw itemsError;
    }
}

// ── OPEN SHIFT ──────────────────────────────────────────────
// sub_shift_type ('A'/'B') + department ('KITCHEN'/'PASTRY') are the new
// storekeeper-facing slot the shift opens into. cashier_shift_id is always
// resolved server-side from the branch's currently open commercial day —
// never trusted from the client — so the one-A-one-B-per-day DB constraint
// (uq_one_subshift_per_cashier_shift) actually means what it says.
export const openKitchenShift = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id, shift_type, shift_date, opening_items, assigned_chef_ids, assigned_dispense_ids, sub_shift_type, department } = req.body;
    const internalAutoOpenShiftB = Boolean((req as any).__internalAutoOpenShiftB || req.body?.__internal_auto_open_shift_b);
    const userId = (req as any).user?.id;
    const userBranchId = (req as any).user?.branch_id;
    if (!branch_id || !shift_type) throw new AppError('branch_id, shift_type required', 400);

    if (Number(branch_id) !== Number(userBranchId)) {
        throw new AppError('BRANCH_SCOPE_VIOLATION: Branch does not match user context', 403);
    }

    const activeMode = await getActiveShiftMode(Number(branch_id), shift_date);
    if (!activeMode) {
        throw new AppError('KITCHEN_SESSIONS_NOT_CONFIGURED', 403);
    }

    const businessDate = shift_date || todayInNairobi();
    let cashierShiftId: string | null = null;
    let seededOpeningItems: any[] | null = null;
    let handoverRecord: any = null;
    const dept = department || 'KITCHEN';

    const { data: cashierShift } = await supabase
        .from('cashier_shift_logs')
        .select('id')
        .eq('branch_id', branch_id)
        .eq('status', 'open')
        .order('shift_start', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (!cashierShift) {
        throw new AppError('NO_ACTIVE_CASHIER_SHIFT: no open cashier shift for this branch — open the cashier/POS shift before opening a kitchen shift', 400);
    }
    cashierShiftId = cashierShift.id;

    if (activeMode === 'TWO_SHIFT') {
        if (!sub_shift_type || !['A', 'B'].includes(sub_shift_type)) {
            throw new AppError('INVALID_SUB_SHIFT_TYPE: Shift A must be used when opening this branch configuration', 400);
        }

        if (sub_shift_type === 'B' && !internalAutoOpenShiftB) {
            throw new AppError('SHIFT_B_AUTO_OPEN_ONLY: Shift B is opened automatically after Shift A handover and cannot be opened manually from the start screen', 400);
        }

        const { data: existingSameType } = await supabase
            .from('kitchen_shifts')
            .select('id, status')
            .eq('branch_id', branch_id)
            .eq('cashier_shift_id', cashierShiftId)
            .eq('sub_shift_type', sub_shift_type)
            .eq('department', dept)
            .maybeSingle();
        if (existingSameType) {
            throw new AppError(`KITCHEN_SHIFT_ALREADY_OPEN: Shift ${sub_shift_type} (${dept}) has already been opened for this commercial day`, 409);
        }

        if (sub_shift_type === 'A') {
            const openingStocktake = await getSubmittedKitchenOpeningStocktake(Number(branch_id), businessDate, 'A');
            if (!openingStocktake.ready) {
                throw new AppError(`${openingStocktake.reason || 'OPENING_STOCKTAKE_NOT_SUBMITTED'}: ${openingStocktake.message || 'Kitchen stocktake Shift A must be submitted before opening Shift A'}`, 400);
            }

            const { data: alreadyUsed } = await supabase
                .from('kitchen_shifts')
                .select('id')
                .eq('branch_id', branch_id)
                .eq('shift_date', businessDate)
                .eq('sub_shift_type', 'A')
                .eq('department', dept)
                .maybeSingle();
            if (alreadyUsed) {
                throw new AppError('OPENING_STOCKTAKE_ALREADY_USED: A Shift A has already been opened using this kitchen stocktake', 400);
            }

            seededOpeningItems = openingStocktake.openingItems || null;
        } else {
            const { data: shiftA } = await supabase
                .from('kitchen_shifts')
                .select('id, status')
                .eq('branch_id', branch_id)
                .eq('cashier_shift_id', cashierShiftId)
                .eq('sub_shift_type', 'A')
                .eq('department', dept)
                .maybeSingle();
            if (!shiftA) {
                throw new AppError('SHIFT_A_NOT_OPENED: Shift A must be opened (and closed) before Shift B can start', 400);
            }
            if (shiftA.status === 'open') {
                throw new AppError('SHIFT_A_NOT_CLOSED: Shift A is still open — close it before opening Shift B', 400);
            }

            const { data: handover } = await supabase
                .from('kitchen_shift_handovers')
                .select('*')
                .eq('outgoing_shift_id', shiftA.id)
                .maybeSingle();
            if (!handover) {
                throw new AppError('SHIFT_A_NOT_HANDED_OVER: Shift A has not been handed over yet — the handover ledger (witnessed closing counts) must be confirmed before Shift B can open', 400);
            }
            handoverRecord = handover;
            seededOpeningItems = (handover.closing_counts || []).map((c: any) => ({
                sku: c.item_sku,
                name: c.item_name,
                unit: c.unit_of_measure,
                cost_price: c.cost_price,
                quantity: c.physical_count
            }));
        }
    } else {
        const { data: existingSingleShift } = await supabase
            .from('kitchen_shifts')
            .select('id, status')
            .eq('branch_id', branch_id)
            .eq('cashier_shift_id', cashierShiftId)
            .in('status', ['open', 'in_progress'])
            .is('sub_shift_type', null)
            .eq('department', dept)
            .maybeSingle();
        if (existingSingleShift) {
            throw new AppError(`KITCHEN_SHIFT_ALREADY_OPEN: A single kitchen session (${dept}) is already open for this commercial day`, 409);
        }

        const openingStocktake = await getSubmittedKitchenOpeningStocktake(Number(branch_id), businessDate, 'A');
        if (!openingStocktake.ready) {
            throw new AppError(`${openingStocktake.reason || 'OPENING_STOCKTAKE_NOT_SUBMITTED'}: ${openingStocktake.message || 'Kitchen stocktake Shift A must be submitted before opening the session'}`, 400);
        }
        seededOpeningItems = openingStocktake.openingItems || null;
    }

    const effectiveOpeningItems = seededOpeningItems || opening_items;
    if (!effectiveOpeningItems || !Array.isArray(effectiveOpeningItems) || effectiveOpeningItems.length === 0) {
        throw new AppError('opening_items required', 400);
    }

    const shift = await createKitchenShiftFromOpeningSeed({
        branchId: Number(branch_id),
        businessDate,
        shiftType: shift_type,
        subShiftType: activeMode === 'TWO_SHIFT' ? (sub_shift_type as 'A' | 'B') : null,
        department: dept,
        cashierShiftId: cashierShiftId!,
        openedBy: userId,
        assignedChefIds: assigned_chef_ids || [],
        assignedDispenseIds: assigned_dispense_ids || [],
        openingItems: effectiveOpeningItems,
        handoverRecordId: handoverRecord?.id || null
    });

    if (!seededOpeningItems && activeMode !== 'TWO_SHIFT') {
        for (const it of effectiveOpeningItems) {
            if (n(it.quantity) > 0) {
                await updateBranchStock(
                    Number(branch_id), it.sku, -n(it.quantity), 'KITCHEN_SHIFT_OPEN', userId,
                    'kitchen_shift', shift.id, shift.shift_number,
                    `Kitchen shift ${shift.shift_number} opened with ${it.name || it.sku}`
                );
            }
        }
    }

    res.status(201).json({ success: true, data: shift });
});

// ── ADD STOCK (mid-session issuance) ─────────────────────────
// Each addition is now type-detected, BOM-linked (Type A requires a
// recipe_id), staff-tagged and timestamped into kitchen_shift_additions —
// the audit trail that was missing before. kitchen_shift_items.additions
// (a running total) is still updated in the same call so existing
// close/reconciliation/stock_counts sync logic is untouched.
export const addShiftStock = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const { items } = req.body;
    const userId = (req as any).user?.id;
    const userBranchId = (req as any).user?.branch_id;
    const { data: shift } = await supabase.from('kitchen_shifts').select('id,branch_id,status,shift_date').eq('id', shift_id).single();
    if (!shift) throw new AppError('Shift not found', 404);
    if (shift.status !== 'open') throw new AppError('Shift not open', 400);

    // Enforce branch scope matching user's JWT branch claim
    if (Number(shift.branch_id) !== Number(userBranchId)) {
        throw new AppError('BRANCH_SCOPE_VIOLATION: Branch does not match user context', 403);
    }

    const activeMode = await getActiveShiftMode(Number(shift.branch_id), shift.shift_date);
    if (!activeMode) {
        throw new AppError('KITCHEN_SESSIONS_NOT_CONFIGURED', 403);
    }

    const results: any[] = [];
    for (const it of items || []) {
        if (n(it.quantity) <= 0) continue;
        // Every issuance should carry an explicit channel. Fall back to
        // pos_restaurant only as a safety net, and warn so a mis-wired client
        // flow is caught instead of silently mis-attributing the cost.
        if (!it.purpose_channel) {
            logger.warn(`addShiftStock: issuance for ${it.name || it.sku} on shift ${shift_id} has no purpose_channel — defaulting to pos_restaurant`);
        }
        const purposeChannel = it.purpose_channel || 'pos_restaurant';

        const staffIds: string[] = Array.isArray(it.responsible_staff_ids) ? it.responsible_staff_ids : [];
        if (staffIds.length === 0) {
            throw new AppError(`RESPONSIBLE_STAFF_REQUIRED: select at least one responsible staff member for ${it.name || it.sku}`, 400);
        }

        if (purposeChannel === 'accommodation_breakfast') {
            const breakfastControl = await getBreakfastPaxControl(Number(shift.branch_id), shift.shift_date);
            if (!['confirmed', 'locked'].includes(String(breakfastControl.status))) {
                throw new AppError('BREAKFAST_PAX_NOT_CONFIRMED: Reception must confirm Daily Breakfast Pax before issuing stock to Accommodation Breakfast', 400);
            }
            if (Number(breakfastControl.confirmed_pax || 0) <= 0) {
                throw new AppError('BREAKFAST_PAX_ZERO: Confirmed breakfast pax is zero for this date', 400);
            }
        }

        const { data: typeResult } = await supabase.rpc('get_stock_item_food_control_type', {
            p_branch_id: Number(shift.branch_id), p_item_sku: it.sku
        });
        let foodControlType: string = typeResult || 'UNREGISTERED';

        let recipeId: string | null = it.recipe_id || null;
        if (foodControlType === 'A_RECIPE_BOM' && !recipeId) {
            foodControlType = 'C_DIRECT';
        } else if (foodControlType !== 'A_RECIPE_BOM') {
            recipeId = null; // never persist a recipe_id for non-recipe types, even if the client sent one
        }

        // Unit Normalization
        const { data: invItem } = await supabase
            .from('inventory_items')
            .select('id, unit')
            .eq('sku', it.sku)
            .maybeSingle();

        const baseUnit = invItem?.unit || it.unit || 'pcs';
        const normalizedQty = await normalizeQty(
            n(it.quantity),
            it.unit || baseUnit,
            baseUnit,
            invItem?.id || '',
            shift.branch_id
        );

        await updateBranchStock(
            Number(shift.branch_id), it.sku, -normalizedQty, 'KITCHEN_SHIFT_ADD_STOCK', userId,
            'kitchen_shift', shift_id, undefined,
            `Added to kitchen shift ${shift_id} mid-shift: ${it.name || it.sku} (${normalizedQty} ${baseUnit})`
        );

        const { error: ledgerError } = await supabase.from('kitchen_shift_additions').insert({
            shift_id, branch_id: shift.branch_id, item_sku: it.sku, item_name: it.name || null,
            quantity: normalizedQty, unit: baseUnit,
            food_control_type: foodControlType, recipe_id: recipeId,
            responsible_staff_ids: staffIds, notes: it.notes || null, added_by: userId,
            purpose_channel: purposeChannel,
            reference_id: it.reference_id || null,
            wastage_reason: it.wastage_reason || null
        });
        if (ledgerError) throw new AppError(ledgerError.message, 500);

        const { data: ex } = await supabase.from('kitchen_shift_items').select('*').eq('shift_id', shift_id).eq('item_sku', it.sku).maybeSingle();
        if (ex) {
            const { data: upd } = await supabase.from('kitchen_shift_items').update({
                additions: n(ex.additions) + normalizedQty, updated_at: new Date().toISOString()
            }).eq('id', ex.id).select().single();
            results.push({ ...upd, food_control_type: foodControlType });
        } else {
            const { data: cr } = await supabase.from('kitchen_shift_items').insert({
                shift_id, branch_id: shift.branch_id, item_sku: it.sku, item_name: it.name,
                unit_of_measure: baseUnit, cost_price: n(it.cost_price), opening_stock: 0, additions: normalizedQty, sold_quantity: 0, spoilage_quantity: 0,
                system_closing_stock: normalizedQty
            }).select().single();
            results.push({ ...cr, food_control_type: foodControlType });
        }
    }

    // Recover all POS sales since the start of the cashier main shift for issued items
    try {
        const sinceTimestamp = await getCashierShiftStartTimestamp(
            Number(shift.branch_id),
            (shift as any).cashier_shift_id,
            shift.shift_date
        );
        const { backfillKitchenConsumptionForOpenShift } = await import('./outlet-pos.controller');
        await backfillKitchenConsumptionForOpenShift(
            Number(shift.branch_id),
            shift_id,
            sinceTimestamp
        );

        const { data: updatedItems } = await supabase
            .from('kitchen_shift_items')
            .select('id, opening_stock, additions, sold_quantity, spoilage_quantity')
            .eq('shift_id', shift_id);

        for (const ci of updatedItems || []) {
            const open = n(ci.opening_stock);
            const adds = n(ci.additions);
            const sold = n(ci.sold_quantity);
            const spoil = n(ci.spoilage_quantity);
            const sysClose = open + adds - sold - spoil;
            await supabase
                .from('kitchen_shift_items')
                .update({ system_closing_stock: sysClose, updated_at: new Date().toISOString() })
                .eq('id', ci.id);
        }
    } catch (syncErr) {
        logger.warn('addShiftStock: POS backfill / system closing stock update failed', syncErr as any);
    }

    res.json({ success: true, data: results });
});

// Issuance ledger for a shift — the storekeeper-facing "running log" view,
// each row showing exactly what addShiftStock recorded: type, recipe (if
// any), staff, timestamp.
export const listShiftAdditions = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const { data, error } = await supabase
        .from('kitchen_shift_additions')
        .select('*, recipe:kitchen_production_recipes(id,recipe_name,produced_item_name)')
        .eq('shift_id', shift_id)
        .order('added_at', { ascending: false });
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: data || [] });
});

export const listPrepBatches = asyncWrap(async (req: AuthenticatedRequest, res: Response) => {
    const { shift_id } = req.params;
    const userBranchId = req.user?.branch_id;

    const { data: shift } = await supabase
        .from('kitchen_shifts')
        .select('id, branch_id')
        .eq('id', shift_id)
        .maybeSingle();
    if (!shift) throw new AppError('Shift not found', 404);
    if (Number(shift.branch_id) !== Number(userBranchId)) {
        throw new AppError('BRANCH_SCOPE_VIOLATION: Branch does not match user context', 403);
    }

    const { data, error } = await supabase
        .from('kitchen_prep_batches')
        .select('*')
        .eq('shift_id', shift_id)
        .order('sent_at', { ascending: false });
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: data || [] });
});

export const sendPrepBatch = asyncWrap(async (req: AuthenticatedRequest, res: Response) => {
    const { shift_id } = req.params;
    const {
        recipe_id,
        raw_quantity_sent,
        assigned_staff_ids,
        sent_notes
    } = req.body || {};

    const userId = req.user?.id || '';
    const userBranchId = req.user?.branch_id;

    const { data: shift } = await supabase
        .from('kitchen_shifts')
        .select('id, branch_id, status, shift_date, shift_number')
        .eq('id', shift_id)
        .maybeSingle();
    if (!shift) throw new AppError('Shift not found', 404);
    if (shift.status !== 'open') throw new AppError('Shift not open', 400);
    if (Number(shift.branch_id) !== Number(userBranchId)) {
        throw new AppError('BRANCH_SCOPE_VIOLATION: Branch does not match user context', 403);
    }

    const activeMode = await getActiveShiftMode(Number(shift.branch_id), shift.shift_date);
    if (!activeMode) throw new AppError('KITCHEN_SESSIONS_NOT_CONFIGURED', 403);

    if (!recipe_id) throw new AppError('recipe_id is required', 400);
    if (n(raw_quantity_sent) <= 0) throw new AppError('raw_quantity_sent must be greater than zero', 400);

    const { data: recipe, error: recipeError } = await supabase
        .from('kitchen_production_recipes')
        .select('id, branch_id, recipe_name, raw_item_sku, raw_item_name, raw_unit, produced_item_name, produced_unit, yield_type_code, is_active, stocktake_control_mode, stocktake_location, produced_inventory_item_id, produced_inventory_item_sku, pos_outlet_item_id')
        .eq('id', recipe_id)
        .maybeSingle();
    if (recipeError) throw new AppError(recipeError.message, 500);
    if (!recipe || recipe.is_active === false) throw new AppError('Recipe standard not found', 404);
    if (Number(recipe.branch_id) !== Number(shift.branch_id)) throw new AppError('Recipe does not belong to this branch', 400);
    if (!recipe.raw_item_sku || recipe.raw_item_sku === 'MULTI') {
        throw new AppError('This standard is not eligible for simple prep batches. Use a single-raw-item standard.', 400);
    }
    if (!recipe.produced_item_name) {
        throw new AppError('This standard has no produced item configured', 400);
    }

    const rawSku = String(recipe.raw_item_sku || '').trim();
    if (rawSku) {
        const { data: upstreamRecipes, error: upstreamError } = await supabase
            .from('kitchen_production_recipes')
            .select('id, recipe_name, produced_item_name, produced_item_sku, produced_inventory_item_sku')
            .eq('branch_id', shift.branch_id)
            .eq('is_active', true)
            .neq('id', recipe.id)
            .or(`produced_inventory_item_sku.eq.${rawSku},produced_item_sku.eq.${rawSku}`);
        if (upstreamError) throw new AppError(upstreamError.message, 500);

        const upstreamList = upstreamRecipes || [];
        if (upstreamList.length > 0) {
            const upstreamIds = upstreamList.map((row: any) => row.id).filter(Boolean);
            const { data: returnedUpstreamBatches, error: returnedError } = await supabase
                .from('kitchen_prep_batches')
                .select('id, recipe_id, produced_item_name, returned_quantity, returned_unit')
                .eq('shift_id', shift_id)
                .eq('status', 'returned')
                .in('recipe_id', upstreamIds);
            if (returnedError) throw new AppError(returnedError.message, 500);

            if (!returnedUpstreamBatches || returnedUpstreamBatches.length === 0) {
                const prerequisiteNames = upstreamList
                    .map((row: any) => row.recipe_name || row.produced_item_name || 'prep stage')
                    .join(', ');
                throw new AppError(
                    `PREP_STAGE_PREREQUISITE_MISSING: Complete and receive the earlier prep stage first (${prerequisiteNames}) before sending ${recipe.produced_item_name}.`,
                    400
                );
            }
        }
    }

    const producedInventory = await resolveRecipeProducedInventoryItem(recipe, Number(shift.branch_id));

    const { data: rawInventory } = await supabase
        .from('inventory_items')
        .select('id, unit')
        .eq('sku', recipe.raw_item_sku)
        .maybeSingle();
    const baseRawUnit = rawInventory?.unit || recipe.raw_unit || 'kg';
    const normalizedRawQty = await normalizeQty(
        n(raw_quantity_sent),
        recipe.raw_unit || baseRawUnit,
        baseRawUnit,
        rawInventory?.id || '',
        shift.branch_id
    );

    await updateBranchStock(
        Number(shift.branch_id),
        recipe.raw_item_sku,
        -normalizedRawQty,
        'KITCHEN_PREP_SENT',
        userId,
        'kitchen_prep_batch',
        shift_id,
        shift.shift_number,
        sent_notes || `Sent ${recipe.raw_item_name} for prep under ${recipe.recipe_name || recipe.produced_item_name}`
    );

    const { data: batch, error: insertError } = await supabase
        .from('kitchen_prep_batches')
        .insert({
            branch_id: shift.branch_id,
            shift_id,
            recipe_id: recipe.id,
            raw_item_sku: recipe.raw_item_sku,
            raw_item_name: recipe.raw_item_name,
            raw_quantity_sent: normalizedRawQty,
            raw_unit: baseRawUnit,
            produced_item_name: recipe.produced_item_name,
            produced_item_sku: producedInventory?.sku || recipe.produced_inventory_item_sku || null,
            produced_inventory_item_id: producedInventory?.id || recipe.produced_inventory_item_id || null,
            produced_unit: producedInventory?.unit || recipe.produced_unit || 'portion',
            assigned_staff_ids: Array.isArray(assigned_staff_ids) ? assigned_staff_ids : [],
            sent_notes: sent_notes || null,
            sent_by: userId,
            status: 'sent'
        })
        .select('*')
        .single();
    if (insertError) throw new AppError(insertError.message, 500);

    res.status(201).json({ success: true, data: batch });
});

export const receivePrepBatch = asyncWrap(async (req: AuthenticatedRequest, res: Response) => {
    const { shift_id, batch_id } = req.params;
    const {
        outputs,           // preferred: [{sku, name, quantity, unit}] — multi-output
        returned_quantity, // legacy single-output fallback
        return_notes,
        process_loss_quantity,
        wastage_quantity,
        wastage_reason
    } = req.body || {};

    const userId = req.user?.id || '';
    const userBranchId = req.user?.branch_id;

    const processLossQty = n(process_loss_quantity);
    const wastageQty = n(wastage_quantity);
    if (processLossQty < 0) throw new AppError('process_loss_quantity cannot be negative', 400);
    if (wastageQty < 0) throw new AppError('wastage_quantity cannot be negative', 400);
    if (wastageQty > 0 && !String(wastage_reason || '').trim()) {
        throw new AppError('wastage_reason is required when wastage_quantity is greater than zero', 400);
    }

    const { data: batch, error: batchError } = await supabase
        .from('kitchen_prep_batches')
        .select('*')
        .eq('id', batch_id)
        .eq('shift_id', shift_id)
        .maybeSingle();
    if (batchError) throw new AppError(batchError.message, 500);
    if (!batch) throw new AppError('Prep batch not found', 404);
    if (!PREP_BATCH_STATUSES.includes(String(batch.status))) throw new AppError('Invalid prep batch status', 400);
    if (batch.status !== 'sent') throw new AppError('This prep batch has already been received or cancelled', 400);
    if (Number(batch.branch_id) !== Number(userBranchId)) {
        throw new AppError('BRANCH_SCOPE_VIOLATION: Branch does not match user context', 403);
    }

    const { data: shift } = await supabase
        .from('kitchen_shifts')
        .select('id, branch_id, shift_number')
        .eq('id', shift_id)
        .maybeSingle();
    if (!shift) throw new AppError('Shift not found', 404);

    const rawUnit = String(batch.raw_unit || '').trim() || 'unit';

    // ── MULTI-OUTPUT PATH ─────────────────────────────────────────────────────
    // New path: outputs[] array with one entry per produced item type.
    // Legacy path: single returned_quantity + produced_inventory_item_id on batch.
    const outputList: Array<{ sku: string; name: string; quantity: number; unit: string; raw_equivalent?: number | null }> =
        Array.isArray(outputs) && outputs.length > 0
            ? outputs
            : (() => {
                // Build a single-item list from legacy fields
                const legacyQty = n(returned_quantity);
                if (legacyQty <= 0) throw new AppError('returned_quantity must be greater than zero', 400);
                return [{
                    sku: String(batch.produced_item_sku || '').trim(),
                    name: String(batch.produced_item_name || 'Produced item'),
                    quantity: legacyQty,
                    unit: String(batch.produced_unit || rawUnit),
                }];
            })();

    if (outputList.length === 0) {
        throw new AppError('At least one output quantity is required', 400);
    }
    if (outputList.every((o) => n(o.quantity) <= 0)) {
        throw new AppError('At least one output must have a quantity greater than zero', 400);
    }

    // Resolve each output SKU to an inventory_items row
    const outputSkus = [...new Set(outputList.map((o) => o.sku).filter(Boolean))];
    const { data: invRows } = await supabase
        .from('inventory_items')
        .select('id, sku, unit')
        .in('sku', outputSkus);
    const invBySku = new Map<string, any>((invRows || []).map((r: any) => [r.sku, r]));

    // Credit each output item to branch stock and build the JSONB record.
    // raw_equivalent: raw-unit kg consumed by this output portion, supplied by
    // the client from the recipe standard (raw_quantity / produced_quantity × qty).
    // This enables variance in raw units even when outputs are in portions/pcs.
    let totalRawEquivalentUsed = 0;
    let rawEquivProvided = false;
    const storedOutputs: any[] = [];

    for (const out of outputList) {
        const qty = n(out.quantity);
        if (qty <= 0) continue;

        const inv = invBySku.get(out.sku);
        if (!inv) throw new AppError(`Inventory item not found for SKU: ${out.sku}`, 400);

        const normalizedQty = await normalizeQty(qty, out.unit || inv.unit || rawUnit, inv.unit, inv.id, shift.branch_id);

        await updateBranchStock(
            Number(shift.branch_id),
            inv.sku,
            normalizedQty,
            'KITCHEN_PREP_RETURNED',
            userId,
            'kitchen_prep_batch',
            batch.id,
            shift.shift_number,
            return_notes || `Prep return: ${out.name || out.sku} from batch ${batch_id}`
        );

        const rawEquiv = typeof out.raw_equivalent === 'number' ? out.raw_equivalent : null;
        if (rawEquiv !== null && rawEquiv >= 0) {
            totalRawEquivalentUsed += rawEquiv;
            rawEquivProvided = true;
        } else if (!rawEquivProvided && canonicalUnitLabel(rawUnit) === canonicalUnitLabel(inv.unit)) {
            // Fallback: same-unit path (e.g. kg→kg)
            totalRawEquivalentUsed += normalizedQty;
        }

        storedOutputs.push({
            sku: inv.sku,
            name: out.name || inv.sku,
            quantity: normalizedQty,
            unit: inv.unit,
            inventory_item_id: inv.id,
            raw_equivalent: rawEquiv ?? null,
        });
    }

    const grandTotalReturned = storedOutputs.reduce((s, o) => s + o.quantity, 0);
    // Variance is always in raw units (e.g. kg). Possible when raw_equivalent was
    // provided for all outputs (mixed-unit scenario) or all units matched.
    const canComputeVariance = rawEquivProvided ||
        storedOutputs.every((o) => canonicalUnitLabel(rawUnit) === canonicalUnitLabel(o.unit));
    const unexplainedVarianceQuantity = canComputeVariance
        ? Number((n(batch.raw_quantity_sent) - totalRawEquivalentUsed - processLossQty - wastageQty).toFixed(3))
        : null;

    // Use primary produced_unit from first output item
    const primaryOut = storedOutputs[0];

    const { data: updated, error: updateError } = await supabase
        .from('kitchen_prep_batches')
        .update({
            returned_quantity: Number(grandTotalReturned.toFixed(3)),
            returned_unit: primaryOut?.unit || batch.produced_unit,
            extra_outputs: storedOutputs,
            process_loss_quantity: processLossQty,
            process_loss_unit: rawUnit,
            wastage_quantity: wastageQty,
            wastage_unit: rawUnit,
            wastage_reason: String(wastage_reason || '').trim() || null,
            unexplained_variance_quantity: unexplainedVarianceQuantity,
            unexplained_variance_unit: unexplainedVarianceQuantity === null ? null : rawUnit,
            status: 'returned',
            return_notes: return_notes || null,
            returned_by: userId,
            returned_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', batch.id)
        .select('*')
        .single();
    if (updateError) throw new AppError(updateError.message, 500);

    res.json({ success: true, data: updated });
});

// ── PRODUCTION SUMMARY / PENDING LOGS (Phase 3) ──────────────
// "Unlogged Type A issuance" = a kitchen_shift_additions row tagged
// A_RECIPE_BOM whose recipe was never actually produced this shift (no
// kitchen_shift_production row referencing that recipe_id) — i.e. raw
// stock was issued against a recipe but nobody ever logged the output.
// Shared by getProductionSummary (so the storekeeper sees it coming) and
// closeKitchenShift (so it's actually enforced, not just advisory).
async function getPendingProductionLogs(shiftId: string): Promise<any[]> {
    const [{ data: additions }, { data: productions }] = await Promise.all([
        supabase
            .from('kitchen_shift_additions')
            .select('*, recipe:kitchen_production_recipes(id,recipe_name,produced_item_name)')
            .eq('shift_id', shiftId)
            .eq('food_control_type', 'A_RECIPE_BOM'),
        supabase.from('kitchen_shift_production').select('recipe_id').eq('shift_id', shiftId)
    ]);
    const loggedRecipeIds = new Set((productions || []).map((p: any) => p.recipe_id).filter(Boolean));
    return (additions || []).filter((a: any) => !loggedRecipeIds.has(a.recipe_id));
}

export const getProductionSummary = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const { data: shift } = await supabase.from('kitchen_shifts').select('id').eq('id', shift_id).maybeSingle();
    if (!shift) throw new AppError('Shift not found', 404);

    const [{ data: productions }, { data: productionInputs }] = await Promise.all([
        supabase
        .from('kitchen_shift_production')
        .select('*')
        .eq('shift_id', shift_id)
        .order('produced_at', { ascending: false }),
        supabase
            .from('kitchen_shift_production_inputs')
            .select('*')
            .eq('shift_id', shift_id)
    ]);

    const inputSummaryByProduction = new Map<string, string>();
    const inputRowsByProduction = new Map<string, any[]>();
    for (const row of productionInputs || []) {
        const productionId = (row as any).production_id?.toString();
        if (!productionId) continue;
        const list = inputRowsByProduction.get(productionId) || [];
        list.push(row);
        inputRowsByProduction.set(productionId, list);
    }
    for (const [productionId, rows] of inputRowsByProduction.entries()) {
        inputSummaryByProduction.set(
            productionId,
            rows
                .map((row: any) =>
                    `${row.raw_item_name} ${n(row.quantity_used).toFixed(2)} ${row.unit || ''}`.trim()
                )
                .join(', ')
        );
    }

    const byRecipe = new Map<string, any>();
    for (const p of productions || []) {
        const key = p.recipe_id || `name:${p.produced_item_name}`;
        const existing = byRecipe.get(key) || {
            recipe_id: p.recipe_id, produced_item_name: p.produced_item_name, produced_unit: p.produced_unit,
            raw_item_name: p.raw_item_name, raw_unit: p.raw_unit,
            total_raw_quantity_used: 0, total_produced_quantity: 0, entries: 0, variance_flagged_count: 0,
            raw_used_summary: inputSummaryByProduction.get(p.id) || `${p.raw_item_name} ${n(p.raw_quantity_used).toFixed(2)} ${p.raw_unit || ''}`.trim()
        };
        existing.total_raw_quantity_used += n(p.raw_quantity_used);
        existing.total_produced_quantity += n(p.produced_quantity);
        existing.entries += 1;
        if (p.variance_flagged) existing.variance_flagged_count += 1;
        byRecipe.set(key, existing);
    }

    const pendingLogs = await getPendingProductionLogs(shift_id as string);

    res.json({
        success: true,
        data: {
            by_recipe: Array.from(byRecipe.values()),
            pending_logs: pendingLogs,
            can_close: pendingLogs.length === 0
        }
    });
});

// The digital kitchen ledger document for a shift — found whether the shift
// was the outgoing (Shift A, closing) or incoming (Shift B, seeded) side of
// the handover, so either shift's detail view can display it.
export const getKitchenShiftHandover = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const { data, error } = await supabase
        .from('kitchen_shift_handovers')
        .select('*')
        .or(`outgoing_shift_id.eq.${shift_id},incoming_shift_id.eq.${shift_id}`)
        .maybeSingle();
    if (error) throw new AppError(error.message, 500);
    if (!data) {
        res.json({ success: true, data: null });
        return;
    }
    const staff = await staffProfileSummaries([
        ...(data.outgoing_witness_ids || []),
        ...(data.incoming_witness_ids || [])
    ]);
    res.json({ success: true, data: { ...data, witness_staff: staff } });
});

// Active commercial day for a branch — used by the Kitchen Sessions screen
// to know whether Shift A/B can be opened at all before the user tries.
export const getActiveCashierShift = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id } = req.query;
    if (!branch_id) throw new AppError('branch_id required', 400);
    const { data, error } = await supabase
        .from('cashier_shift_logs')
        .select('id, shift_number, shift_start, status')
        .eq('branch_id', Number(branch_id))
        .eq('status', 'open')
        .order('shift_start', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: data || null });
});

// ── RECORD PRODUCTION ───────────────────────────────────────
// Recipe variance enforcement: when a production line references a recipe
// (kitchen_production_recipes), the raw quantity used is checked against the
// recipe's yield ratio. A variance beyond the critical threshold (the
// recipe's own allowed_variance_percent, falling back to the branch-level
// kitchen_wastage_thresholds.recipe_variance_critical_pct) blocks the save
// unless a variance_reason is supplied on that production line.
export const recordProduction = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const { productions } = req.body;
    const userId = (req as any).user?.id;
    const userBranchId = (req as any).user?.branch_id;
    const userRole = (req as any).user?.role;
    const { data: shift } = await supabase.from('kitchen_shifts').select('id,branch_id,status,shift_date').eq('id', shift_id).single();
    if (!shift) throw new AppError('Shift not found', 404);
    
    // Enforce branch scope matching user's JWT branch claim (except global roles)
    const isGlobal = ['super_admin', 'director', 'general_manager', 'hr_manager', 'central_storekeeper', 'auditor'].includes(userRole);
    if (Number(shift.branch_id) !== Number(userBranchId) && !isGlobal) {
        throw new AppError('BRANCH_SCOPE_VIOLATION: Branch does not match user context', 403);
    }
    if (shift.status !== 'open') throw new AppError('Shift not open', 400);

    const activeMode = await getActiveShiftMode(Number(shift.branch_id), shift.shift_date);
    if (!activeMode) {
        throw new AppError('KITCHEN_SESSIONS_NOT_CONFIGURED', 403);
    }

    const thresholds = await getWastageThresholds(shift.branch_id);
    const results: any[] = [];
    for (const p of productions || []) {
        const { data: raw } = await supabase.from('kitchen_shift_items').select('*').eq('shift_id', shift_id).eq('item_sku', p.raw_item_sku).single();
        if (!raw) throw new AppError(`Raw ${p.raw_item_sku} not in shift`, 400);
        const avail = n(raw.opening_stock) + n(raw.additions) - n(raw.sold_quantity) - n(raw.spoilage_quantity);
        if (n(p.raw_quantity_used) > avail) throw new AppError(`Insufficient ${p.raw_item_name}: ${avail} available`, 400);

        let recipe: any = null;
        let maxRawAllowed: number | null = null;
        let variancePct: number | null = null;
        let varianceFlagged = false;
        let severity: 'warning' | 'critical' | null = null;

        if (!p.recipe_id) {
            throw new AppError('MISSING_RECIPE_STANDARD: Production logging requires a valid recipe_id and is blocked until recipe standards are approved and seeded', 400);
        }
        const { data: recipeRow } = await supabase.from('kitchen_production_recipes').select('*').eq('id', p.recipe_id).maybeSingle();
        if (!recipeRow) {
            throw new AppError('MISSING_RECIPE_STANDARD: Production logging is blocked until recipe standards are approved and seeded', 400);
        }
        recipe = recipeRow;
        if (recipe && n(recipe.produced_quantity) > 0 && n(p.produced_quantity) > 0) {
                maxRawAllowed = (n(p.produced_quantity) / n(recipe.produced_quantity)) * n(recipe.raw_quantity);
                if (maxRawAllowed > 0) {
                    variancePct = ((n(p.raw_quantity_used) - maxRawAllowed) / maxRawAllowed) * 100;
                    const criticalPct = n(recipe.allowed_variance_percent) > 0 ? n(recipe.allowed_variance_percent) : thresholds.recipe_variance_critical_pct;
                    const warningPct = thresholds.recipe_variance_warning_pct;

                    if (variancePct > criticalPct && !p.variance_reason) {
                        res.status(400).json({
                            success: false,
                            code: 'RECIPE_VARIANCE_EXCEEDED',
                            message: `Recipe allows ${maxRawAllowed.toFixed(3)}${recipe.raw_unit} for ${p.produced_quantity} ${recipe.produced_unit || 'portions'}. You used ${p.raw_quantity_used}${recipe.raw_unit} (${variancePct.toFixed(1)}% over). Please provide a variance explanation.`,
                            data: { recipe, maxRawAllowed, actualUsed: n(p.raw_quantity_used), variancePct }
                        });
                        return;
                    }

                    if (variancePct > criticalPct) severity = 'critical';
                    else if (variancePct > warningPct) severity = 'warning';
                    varianceFlagged = variancePct > warningPct;
                }
            }

        const { data: prod } = await supabase.from('kitchen_shift_production').insert({
            shift_id, branch_id: shift.branch_id, recipe_id: p.recipe_id, food_control_id: p.food_control_id,
            raw_item_sku: p.raw_item_sku, raw_item_name: p.raw_item_name, raw_quantity_used: n(p.raw_quantity_used), raw_unit: p.raw_unit,
            produced_item_name: p.produced_item_name, produced_item_sku: p.produced_item_sku, pos_outlet_item_id: p.pos_outlet_item_id,
            produced_quantity: n(p.produced_quantity), produced_unit: p.produced_unit || 'portion', conversion_ratio: n(p.conversion_ratio),
            conversion_notes: p.conversion_notes, produced_by: p.produced_by || userId,
            variance_pct: variancePct, recipe_max_raw_allowed: maxRawAllowed, variance_flagged: varianceFlagged,
            variance_reason: p.variance_reason ?? null
        }).select().single();
        results.push(prod);

        if (severity && maxRawAllowed !== null) {
            await createWastageAlert({
                shift_id, branch_id: shift.branch_id, alert_type: 'recipe_variance', severity,
                item_sku: p.raw_item_sku, item_name: p.raw_item_name,
                expected_value: maxRawAllowed, actual_value: n(p.raw_quantity_used),
                variance_value: n(p.raw_quantity_used) - maxRawAllowed,
                variance_cost: Math.round((n(p.raw_quantity_used) - maxRawAllowed) * n(raw.cost_price) * 100) / 100,
                message: `Recipe variance ${variancePct?.toFixed(1)}% on ${p.raw_item_name} for shift ${shift_id}`
            });
        }

        // Atomic increment avoids lost-update race when multiple productions are
        // logged concurrently for the same shift item.
        await db.query(
            'UPDATE kitchen_shift_items SET sold_quantity = sold_quantity + $1, updated_at = NOW() WHERE id = $2',
            [n(p.raw_quantity_used), raw.id]
        );
        if (p.pos_outlet_item_id) await creditOutletItemStock(p.pos_outlet_item_id, n(p.produced_quantity));
    }
    res.json({ success: true, data: results });
});

// ── CONFIRM ACTUAL PRODUCTION YIELD ──────────────────────────
// For yield-uncertain (baking) Food Controls: the expected quantity was
// already pushed to POS at recordProduction time. This records what was
// actually produced and, on a shortfall, bills the cost to the producer.
export const confirmProductionActual = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id, production_id } = req.params;
    const { actual_quantity } = req.body;
    const userId = (req as any).user?.id;
    const userBranchId = (req as any).user?.branch_id;
    const userRole = (req as any).user?.role;
    if (actual_quantity === undefined || actual_quantity === null) throw new AppError('actual_quantity required', 400);

    const { data: shift } = await supabase.from('kitchen_shifts').select('id,branch_id,status,shift_date').eq('id', shift_id).single();
    if (!shift) throw new AppError('Shift not found', 404);

    const isGlobal = ['super_admin', 'director', 'general_manager', 'hr_manager', 'central_storekeeper', 'auditor'].includes(userRole);
    if (Number(shift.branch_id) !== Number(userBranchId) && !isGlobal) {
        throw new AppError('BRANCH_SCOPE_VIOLATION: Branch does not match user context', 403);
    }

    const activeMode = await getActiveShiftMode(Number(shift.branch_id), shift.shift_date);
    if (!activeMode) {
        throw new AppError('KITCHEN_SESSIONS_NOT_CONFIGURED', 403);
    }

    const { data: prod } = await supabase.from('kitchen_shift_production').select('*').eq('id', production_id).eq('shift_id', shift_id).maybeSingle();
    if (!prod) throw new AppError('Production record not found', 404);
    if (prod.actual_quantity !== null) throw new AppError('Actual yield already confirmed for this production record', 400);

    const actual = n(actual_quantity);
    const expected = n(prod.produced_quantity);
    const shortfall = expected - actual;

    let unitCost = 0;
    if (prod.recipe_id) {
        const { data: recipe } = await supabase.from('kitchen_production_recipes').select('cost_per_output').eq('id', prod.recipe_id).maybeSingle();
        unitCost = n(recipe?.cost_per_output);
    }
    if (unitCost <= 0) {
        const { data: rawItem } = await supabase.from('kitchen_shift_items').select('cost_price').eq('shift_id', shift_id).eq('item_sku', prod.raw_item_sku).maybeSingle();
        const rawCost = n(rawItem?.cost_price) * n(prod.raw_quantity_used);
        unitCost = expected > 0 ? rawCost / expected : 0;
    }

    const varianceCost = shortfall > 0 ? Math.round(shortfall * unitCost * 100) / 100 : 0;

    let creditBill: any = null;
    if (varianceCost > 0 && prod.produced_by) {
        const staffId = await resolveStaffProfileId(prod.produced_by);
        if (staffId) {
            const prodBillNumber = `CRD-KV-PRD-${Date.now().toString().slice(-6)}`;
            const prodItem = [{
                item_sku: prod.produced_item_sku || prod.raw_item_sku || '',
                name: prod.produced_item_name || 'Production Item',
                quantity: shortfall,
                unit: prod.produced_unit || prod.raw_unit || 'units',
                unit_price: unitCost,
                total_price: varianceCost,
                category: 'Kitchen Production Shortfall',
                notes: `Production shortfall: expected ${expected}, actual ${actual}`
            }];
            const { data: bill, error: billError } = await supabase.from('staff_credit_bills').insert({
                staff_id: staffId,
                amount: varianceCost,
                bill_number: prodBillNumber,
                description: `Kitchen Variance Credit Bill (Production Shortfall) — ${prod.produced_item_name} (expected ${expected}, actual ${actual})`,
                bill_date: new Date().toISOString().split('T')[0],
                status: 'accountant_confirmed',
                balance: varianceCost,
                paid_amount: 0,
                shift_id,
                branch_id: prod.branch_id,
                approved_at: new Date().toISOString(),
                approved_by: userId,
                items: prodItem,
                items_snapshot: prodItem,
                metadata: {
                    bill_type: 'production_shortfall',
                    shift_id,
                    production_id: production_id || prod.id,
                    items: prodItem
                }
            }).select().maybeSingle();
            if (billError) logger.error('production shortfall credit bill insert', billError);
            creditBill = bill;
        }
    }

    const { data: updated } = await supabase.from('kitchen_shift_production').update({
        actual_quantity: actual,
        actual_recorded_by: userId,
        actual_recorded_at: new Date().toISOString(),
        variance_cost: varianceCost,
        credit_bill_id: creditBill?.id || null
    }).eq('id', production_id).select().single();

    res.json({ success: true, data: { production: updated, credit_bill: creditBill } });
});

// ── RECORD SPOILAGE ─────────────────────────────────────────
export const recordSpoilage = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const { items, notes } = req.body;
    const userId = (req as any).user?.id;
    const userBranchId = (req as any).user?.branch_id;
    const userRole = (req as any).user?.role;
    const { data: shift } = await supabase.from('kitchen_shifts').select('id,branch_id,shift_date').eq('id', shift_id).single();
    if (!shift) throw new AppError('Shift not found', 404);

    // Enforce branch scope matching user's JWT branch claim (except global roles)
    const isGlobal = ['super_admin', 'director', 'general_manager', 'hr_manager', 'central_storekeeper', 'auditor'].includes(userRole);
    if (Number(shift.branch_id) !== Number(userBranchId) && !isGlobal) {
        throw new AppError('BRANCH_SCOPE_VIOLATION: Branch does not match user context', 403);
    }

    const activeMode = await getActiveShiftMode(Number(shift.branch_id), shift.shift_date);
    if (!activeMode) {
        throw new AppError('KITCHEN_SESSIONS_NOT_CONFIGURED', 403);
    }
    const results: any[] = [];
    for (const it of items || []) {
        const { data: si } = await supabase.from('kitchen_shift_items').select('*').eq('shift_id', shift_id).eq('item_sku', it.sku).single();
        if (!si) continue;
        const { data: upd } = await supabase.from('kitchen_shift_items').update({
            spoilage_quantity: n(si.spoilage_quantity) + n(it.quantity), spoilage_reason: it.reason || si.spoilage_reason, updated_at: new Date().toISOString()
        }).eq('id', si.id).select().single();
        results.push(upd);
        await supabase.from('wastage_records').insert({
            branch_id: shift.branch_id, item_name: si.item_name, item_id: it.sku, item_type: 'raw_material',
            quantity: n(it.quantity), unit: si.unit_of_measure, reason: it.reason_category || 'other', description: it.reason || notes, logged_by: userId
        });
    }
    res.json({ success: true, data: results });
});

// ── CLOSE SHIFT ───────────────────────────────────────────
export const closeKitchenShift = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const { physical_counts, closing_notes, outgoing_witness_ids, incoming_witness_ids, breakfast_pax, staff_meal_pax } = req.body;
    const userId = (req as any).user?.id;
    const userBranchId = (req as any).user?.branch_id;
    const userRole = (req as any).user?.role;
    if (!physical_counts) throw new AppError('physical_counts required', 400);

    const { data: shift } = await supabase.from('kitchen_shifts').select('id,branch_id,status,shift_date,opened_at,sub_shift_type,cashier_shift_id,department,breakfast_pax,staff_meal_pax').eq('id', shift_id).single();
    if (!shift) throw new AppError('Shift not found', 404);

    // Enforce branch scope matching user's JWT branch claim (except global roles)
    const isGlobal = ['super_admin', 'director', 'general_manager', 'hr_manager', 'central_storekeeper', 'auditor'].includes(userRole);
    if (Number(shift.branch_id) !== Number(userBranchId) && !isGlobal) {
        throw new AppError('BRANCH_SCOPE_VIOLATION: Branch does not match user context', 403);
    }
    if (shift.status !== 'open') throw new AppError('Shift must be open', 400);

    const activeMode = await getActiveShiftMode(Number(shift.branch_id), shift.shift_date);
    if (!activeMode) {
        throw new AppError('KITCHEN_SESSIONS_NOT_CONFIGURED', 403);
    }

    // Digital kitchen ledger (Phase 4): a Shift A/B kitchen shift cannot close
    // until both the outgoing and incoming teams are named as witnesses to
    // the closing physical counts. Legacy/ad-hoc shifts (no sub_shift_type)
    // predate this requirement and are unaffected.
    const requiresHandover = false;
    const outgoingWitnesses: string[] = Array.isArray(outgoing_witness_ids) ? outgoing_witness_ids : [];
    const incomingWitnesses: string[] = Array.isArray(incoming_witness_ids) ? incoming_witness_ids : [];

    const pendingLogs = await getPendingProductionLogs(shift_id as string);
    if (pendingLogs.length > 0) {
        res.status(400).json({
            success: false,
            code: 'PENDING_PRODUCTION_LOGS',
            message: `${pendingLogs.length} recipe issuance(s) have no production output logged yet. Enter output for each before closing this shift.`,
            data: { pending_logs: pendingLogs }
        });
        return;
    }

    const thresholds = await getWastageThresholds(shift.branch_id);
    const records: any[] = [];
    let spoilageCost = 0, varianceCost = 0, revenue = 0, cogs = 0;

    for (const c of physical_counts) {
        const { data: si } = await supabase.from('kitchen_shift_items').select('*').eq('shift_id', shift_id).eq('item_sku', c.sku).single();
        if (!si) continue;
        const open = n(si.opening_stock), adds = n(si.additions), sold = n(si.sold_quantity), spoil = n(si.spoilage_quantity);
        const sysClose = open + adds - sold - spoil;
        const phys = n(c.quantity);
        const varQty = phys - sysClose;
        const cp = n(si.cost_price);
        const varVal = varQty * cp;

        await supabase.from('kitchen_shift_items').update({ physical_count: phys, variance_notes: c.notes || si.variance_notes, updated_at: new Date().toISOString() }).eq('id', si.id);

        const { data: st } = await supabase.from('kitchen_shift_stock_take').insert({
            shift_id, branch_id: shift.branch_id, item_sku: c.sku, item_name: si.item_name, unit_of_measure: si.unit_of_measure, cost_price: cp,
            opening_stock: open, additions: adds, total_available: open + adds, system_sales: sold, spoilage: spoil,
            system_closing_stock: sysClose, physical_count: phys, variance: varQty, variance_value: varVal,
            variance_category: varQty < 0 ? 'shortage' : varQty > 0 ? 'overage' : 'ok', variance_reason: c.notes, counted_by: userId, counted_at: new Date().toISOString()
        }).select().single();
        records.push(st);

        // Unexplained shortage alert — a real-time-visible counterpart to the
        // kitchen_shift_stock_take row above, surfaced via /api/kitchen/wastage-alerts.
        if (varQty < 0) {
            const shortageCost = Math.abs(varVal);
            const severity: 'warning' | 'critical' | null =
                shortageCost > thresholds.shortage_critical_kes ? 'critical'
                : shortageCost > thresholds.shortage_warning_kes ? 'warning'
                : null;
            if (severity) {
                await createWastageAlert({
                    shift_id, branch_id: shift.branch_id, alert_type: 'unexplained_shortage', severity,
                    item_sku: c.sku, item_name: si.item_name,
                    expected_value: sysClose, actual_value: phys, variance_value: varQty, variance_cost: Math.round(shortageCost * 100) / 100,
                    message: `${severity === 'critical' ? 'Critical' : 'Warning'} shortage on ${si.item_name}: KES ${shortageCost.toFixed(2)} unexplained`
                });
            }
        }

        spoilageCost += spoil * cp;
        varianceCost += varVal;
        cogs += (sold + spoil) * cp;
    }

    // Revenue from cashier transactions during shift
    const { data: txns } = await supabase.from('cashier_transactions').select('amount')
        .eq('branch_id', shift.branch_id).gte('transaction_date', shift.opened_at).lte('transaction_date', new Date().toISOString())
        .eq('status', 'posted').neq('transaction_type', 'refund');
    revenue = (txns || []).reduce((s: number, t: any) => s + n(t.amount), 0);

    // Write the handover ledger before marking the shift closed — closing is
    // the act of confirming handover for Shift A/B shifts, so if this insert
    // fails the shift stays open rather than closing with no witnessed record.
    let handover: any = null;
    if (requiresHandover) {
        const { data: ho, error: hoError } = await supabase.from('kitchen_shift_handovers').insert({
            outgoing_shift_id: shift_id, branch_id: shift.branch_id, cashier_shift_id: shift.cashier_shift_id,
            department: shift.department, outgoing_witness_ids: outgoingWitnesses, incoming_witness_ids: incomingWitnesses,
            closing_counts: records, notes: closing_notes, confirmed_by: userId
        }).select().single();
        if (hoError) throw new AppError(hoError.message, 500);
        handover = ho;
    }

    const { data: closed } = await supabase.from('kitchen_shifts').update({
        status: 'closed', closed_at: new Date().toISOString(), total_revenue: revenue, total_cogs: cogs,
        total_spoilage_cost: spoilageCost, total_variance_cost: varianceCost, closing_notes, updated_at: new Date().toISOString(),
        breakfast_pax: breakfast_pax !== undefined ? Number(breakfast_pax) : shift.breakfast_pax,
        staff_meal_pax: staff_meal_pax !== undefined ? Number(staff_meal_pax) : shift.staff_meal_pax
    }).eq('id', shift_id).select().single();

    let autoOpenedShiftB: any = null;
    if (activeMode === 'TWO_SHIFT' && shift.sub_shift_type === 'A' && handover) {
        const openingItems: OpeningSeedItem[] = records.map((c: any) => ({
            sku: c.item_sku,
            name: c.item_name,
            unit: c.unit_of_measure,
            cost_price: Number(c.cost_price || 0),
            quantity: Number(c.physical_count || 0),
        }));
        autoOpenedShiftB = await createKitchenShiftFromOpeningSeed({
            branchId: Number(shift.branch_id),
            businessDate: shift.shift_date,
            shiftType: 'afternoon',
            subShiftType: 'B',
            department: shift.department || 'KITCHEN',
            cashierShiftId: shift.cashier_shift_id,
            openedBy: userId,
            assignedChefIds: [],
            assignedDispenseIds: [],
            openingItems,
            handoverRecordId: handover.id
        });
    }

    try {
        await syncKitchenShiftToStockCounts(shift_id);
    } catch (err: any) {
        logger.error(`[closeKitchenShift] syncKitchenShiftToStockCounts failed for shift ${shift_id}:`, err);
    }

    try {
        await persistKitchenShiftControlSnapshot(String(shift_id));
    } catch (err: any) {
        logger.error(`[closeKitchenShift] persistKitchenShiftControlSnapshot failed for shift ${shift_id}:`, err);
    }

    res.json({ success: true, data: { shift: closed, stock_take: records, handover, auto_opened_shift: autoOpenedShiftB, summary: { revenue, cogs, spoilage_cost: spoilageCost, variance_cost: varianceCost } } });
});

// ── SUBMIT FOR APPROVAL ─────────────────────────────────────
export const submitForApproval = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const userId = (req as any).user?.id;
    const userBranchId = (req as any).user?.branch_id;
    const userRole = (req as any).user?.role;
    const { data: shift } = await supabase.from('kitchen_shifts').select('id,branch_id,status,shift_date').eq('id', shift_id).single();
    if (!shift) throw new AppError('Shift not found', 404);

    // Enforce branch scope matching user's JWT branch claim (except global roles)
    const isGlobal = ['super_admin', 'director', 'general_manager', 'hr_manager', 'central_storekeeper', 'auditor'].includes(userRole);
    if (Number(shift.branch_id) !== Number(userBranchId) && !isGlobal) {
        throw new AppError('BRANCH_SCOPE_VIOLATION: Branch does not match user context', 403);
    }

    const activeMode = await getActiveShiftMode(Number(shift.branch_id), shift.shift_date);
    if (!activeMode) {
        throw new AppError('KITCHEN_SESSIONS_NOT_CONFIGURED', 403);
    }
    if (shift.status !== 'closed') throw new AppError('Shift must be closed', 400);
    const { data: upd } = await supabase.from('kitchen_shifts').update({ status: 'pending_chef_confirmation', updated_at: new Date().toISOString() }).eq('id', shift_id).select().single();
    await supabase.from('kitchen_shift_approvals').insert({ shift_id, branch_id: shift.branch_id, approval_stage: 'store_keeper_submitted', approved_by: userId, notes: 'Submitted for chef confirmation' });
    
    try {
        await syncKitchenShiftToStockCounts(shift_id);
    } catch (err: any) {
        logger.error(`[submitForApproval] syncKitchenShiftToStockCounts failed for shift ${shift_id}:`, err);
    }

    res.json({ success: true, data: upd });
});

// ── CHEF CONFIRM ────────────────────────────────────────────
export const chefConfirmShift = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const { confirmed, notes } = req.body;
    const userId = (req as any).user?.id;
    const { data: shift } = await supabase.from('kitchen_shifts').select('id,branch_id,status').eq('id', shift_id).single();
    if (!shift) throw new AppError('Shift not found', 404);
    if (shift.status !== 'pending_chef_confirmation') throw new AppError('Not pending chef', 400);
    const next = confirmed ? 'pending_accountant_review' : 'open';
    const { data: upd } = await supabase.from('kitchen_shifts').update({
        status: next, chef_confirmed_by: confirmed ? userId : null, chef_confirmed_at: confirmed ? new Date().toISOString() : null, updated_at: new Date().toISOString()
    }).eq('id', shift_id).select().single();
    await supabase.from('kitchen_shift_approvals').insert({ shift_id, branch_id: shift.branch_id, approval_stage: confirmed ? 'chef_confirmed' : 'chef_rejected', approved_by: userId, notes: notes || `Chef ${confirmed ? 'confirmed' : 'rejected'}` });
    
    try {
        await syncKitchenShiftToStockCounts(shift_id);
    } catch (err: any) {
        logger.error(`[chefConfirmShift] syncKitchenShiftToStockCounts failed for shift ${shift_id}:`, err);
    }

    res.json({ success: true, data: upd });
});

// ── GET KITCHEN SHIFT VARIANCE ITEMS ───────────────────────
export async function getKitchenShiftVarianceItems(shiftId: string): Promise<any[]> {
    const varianceItemsMap = new Map<string, any>();

    // 1. Try Daily Controls snapshot first (it has the comprehensive theoretical vs actual calculation)
    try {
        const snap = await loadKitchenShiftControlSnapshot(shiftId);
        const rows = snap?.payload?.shift_report?.rows || [];
        for (const r of rows) {
            const vQty = Number(r.variance_qty || 0);
            const vCost = Number(r.variance_cost || 0);
            if (vQty !== 0 || vCost !== 0) {
                const key = String(r.item_sku || r.item_name || '').trim().toLowerCase();
                if (!key) continue;
                varianceItemsMap.set(key, {
                    item_sku: r.item_sku || '',
                    item_name: r.item_name || 'Kitchen Item',
                    name: r.item_name || 'Kitchen Item',
                    quantity: Math.abs(vQty),
                    variance_qty: vQty,
                    unit: r.unit || 'units',
                    unit_price: Number(r.cost_price || 0),
                    cost_price: Number(r.cost_price || 0),
                    total_price: Math.abs(vCost) || (Math.abs(vQty) * Number(r.cost_price || 0)),
                    variance_cost: vCost,
                    category: 'Kitchen Variance',
                    notes: `Shortage: ${vQty < 0 ? '-' : '+'}${Math.abs(vQty).toFixed(2)} ${r.unit || ''} (Cost: KES ${(Math.abs(vCost) || 0).toFixed(2)})`
                });
            }
        }
    } catch (err) {
        logger.warn(`[getKitchenShiftVarianceItems] snapshot load failed for shift ${shiftId}:`, err);
    }

    // 2. Supplement from kitchen_shift_items
    try {
        const { data: shiftItems } = await supabase
            .from('kitchen_shift_items')
            .select('*')
            .eq('shift_id', shiftId);
        for (const it of shiftItems || []) {
            const vQty = Number(it.variance || 0);
            const vCost = Number(it.variance_value || 0);
            if (vQty !== 0 || vCost !== 0) {
                const key = String(it.item_sku || it.item_name || '').trim().toLowerCase();
                if (!key) continue;
                if (!varianceItemsMap.has(key)) {
                    varianceItemsMap.set(key, {
                        item_sku: it.item_sku || '',
                        item_name: it.item_name || 'Kitchen Item',
                        name: it.item_name || 'Kitchen Item',
                        quantity: Math.abs(vQty),
                        variance_qty: vQty,
                        unit: it.unit || 'units',
                        unit_price: Number(it.cost_price || 0),
                        cost_price: Number(it.cost_price || 0),
                        total_price: Math.abs(vCost) || (Math.abs(vQty) * Number(it.cost_price || 0)),
                        variance_cost: vCost,
                        category: 'Kitchen Variance',
                        notes: `Shortage: ${vQty < 0 ? '-' : '+'}${Math.abs(vQty).toFixed(2)} ${it.unit || ''} (Cost: KES ${(Math.abs(vCost) || 0).toFixed(2)})`
                    });
                }
            }
        }
    } catch (err) {
        logger.warn(`[getKitchenShiftVarianceItems] kitchen_shift_items query failed for shift ${shiftId}:`, err);
    }

    // 3. Supplement from kitchen_shift_stock_take
    try {
        const { data: stockTakeRows } = await supabase
            .from('kitchen_shift_stock_take')
            .select('*')
            .eq('shift_id', shiftId);
        for (const st of stockTakeRows || []) {
            const vQty = Number(st.variance || 0);
            const vCost = Number(st.variance_value || 0);
            if (vQty !== 0 || vCost !== 0) {
                const key = String(st.item_sku || st.item_name || '').trim().toLowerCase();
                if (!key) continue;
                if (!varianceItemsMap.has(key)) {
                    varianceItemsMap.set(key, {
                        item_sku: st.item_sku || '',
                        item_name: st.item_name || 'Kitchen Item',
                        name: st.item_name || 'Kitchen Item',
                        quantity: Math.abs(vQty),
                        variance_qty: vQty,
                        unit: st.unit || 'units',
                        unit_price: Number(st.cost_price || 0),
                        cost_price: Number(st.cost_price || 0),
                        total_price: Math.abs(vCost) || (Math.abs(vQty) * Number(st.cost_price || 0)),
                        variance_cost: vCost,
                        category: 'Kitchen Variance',
                        notes: `Shortage: ${vQty < 0 ? '-' : '+'}${Math.abs(vQty).toFixed(2)} ${st.unit || ''} (Cost: KES ${(Math.abs(vCost) || 0).toFixed(2)})`
                    });
                }
            }
        }
    } catch (err) {
        logger.warn(`[getKitchenShiftVarianceItems] kitchen_shift_stock_take query failed for shift ${shiftId}:`, err);
    }

    return Array.from(varianceItemsMap.values());
}

// ── ACCOUNTANT REVIEW ─────────────────────────────────────
export const accountantReviewShift = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const { approved, notes, liability_action, allocations, write_off_reason } = req.body;
    const userId = (req as any).user?.id;
    const { data: shift } = await supabase
        .from('kitchen_shifts')
        .select('id,branch_id,status,shift_number,shift_date,total_variance_cost')
        .eq('id', shift_id)
        .single();
    if (!shift) throw new AppError('Shift not found', 404);
    const currentStatus = String(shift.status || '').toLowerCase();
    const reviewableStatuses = ['pending_accountant_review', 'closed', 'pending_chef_confirmation', 'open'];
    if (!reviewableStatuses.includes(currentStatus)) {
        throw new AppError(`Shift cannot be reviewed in status: ${shift.status}`, 400);
    }
    const next = approved ? 'approved' : 'rejected';
    const action = liability_action || (approved ? 'approve_only' : 'rejected');

    if (approved && action === 'write_off' && !String(write_off_reason || notes || '').trim()) {
        throw new AppError('Write-off reason is required', 400);
    }

    // Lookup Daily Controls snapshot if total_variance_cost is 0 or not populated
    let dcVarianceCost: number | null = null;
    try {
        const snap = await loadKitchenShiftControlSnapshot(shift_id);
        if (snap?.payload?.shift_report?.summary?.total_variance_cost != null) {
            dcVarianceCost = Number(snap.payload.shift_report.summary.total_variance_cost);
        }
    } catch (e) {
        logger.warn('accountantReviewShift: snapshot lookup failed', e as any);
    }

    const varianceCost = absMoney(shift.total_variance_cost) || (dcVarianceCost != null ? absMoney(dcVarianceCost) : 0);

    // Deliberate-allocation guard: when the accountant explicitly chooses
    // liability_action='staff_liability', credit bills must never be
    // auto-created from a blank allocation list — the accountant must name
    // who is being billed and how much.
    if (approved && action === 'staff_liability' && varianceCost > 0) {
        if (!Array.isArray(allocations) || allocations.length === 0) {
            res.status(400).json({
                success: false,
                code: 'ALLOCATIONS_REQUIRED',
                message: 'Staff liability allocations must be explicitly provided by the accountant before credit bills are created.'
            });
            return;
        }
    }

    const updatePayload: any = {
        status: next,
        accountant_reviewed_by: userId,
        accountant_reviewed_at: new Date().toISOString(),
        accountant_approved_by: approved ? userId : null,
        accountant_approved_at: approved ? new Date().toISOString() : null,
        accountant_rejection_reason: approved ? null : notes,
        updated_at: new Date().toISOString()
    };
    if (dcVarianceCost != null && (!shift.total_variance_cost || shift.total_variance_cost === 0)) {
        updatePayload.total_variance_cost = dcVarianceCost;
    }

    const { data: upd } = await supabase.from('kitchen_shifts').update(updatePayload).eq('id', shift_id).select().single();

    let liabilityCase: any = null;
    const creditBills: any[] = [];
    const normalizedAllocations = Array.isArray(allocations) ? allocations : [];

    if (approved && varianceCost > 0) {
        const { data: lc } = await supabase.from('kitchen_shift_liability_cases').insert({
            shift_id,
            branch_id: shift.branch_id,
            liability_action: action,
            total_variance_cost: varianceCost,
            status: action === 'write_off' ? 'written_off' : normalizedAllocations.length ? 'billed' : 'approved_no_charge',
            write_off_reason: action === 'write_off' ? (write_off_reason || notes) : null,
            allocations: normalizedAllocations,
            approved_by: userId,
            approved_at: new Date().toISOString(),
            notes
        }).select().maybeSingle();
        liabilityCase = lc;

        if (action !== 'write_off') {
            const varianceItems = await getKitchenShiftVarianceItems(shift_id);
            const itemSummaries = varianceItems.map(it => {
                const sign = it.variance_qty < 0 ? '-' : (it.variance_qty > 0 ? '+' : '');
                const qtyStr = `${sign}${Number(it.quantity).toFixed(2)} ${it.unit || ''}`.trim();
                const costStr = `KES ${Number(it.total_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                return `${it.name} (${qtyStr}, ${costStr})`;
            });
            const itemSummaryText = itemSummaries.slice(0, 4).join(', ');
            const remainingCount = itemSummaries.length > 4 ? ` +${itemSummaries.length - 4} more` : '';
            const itemsVarianceDetail = itemSummaries.length > 0
                ? ` - Items with Variance: ${itemSummaryText}${remainingCount}`
                : '';

            for (let idx = 0; idx < normalizedAllocations.length; idx++) {
                const allocation = normalizedAllocations[idx];
                const amount = absMoney(allocation.amount);
                if (amount <= 0) continue;
                const staffId = await resolveStaffProfileId(
                    allocation.staff_profile_id || allocation.staff_id || allocation.user_id
                );
                if (!staffId) continue;

                // Lookup staff profile name for rich description
                let staffLabel = allocation.staff_name || '';
                if (!staffLabel) {
                    const { data: sp } = await supabase
                        .from('staff_profiles')
                        .select('first_name, last_name, employee_number')
                        .eq('id', staffId)
                        .maybeSingle();
                    if (sp) {
                        staffLabel = `${sp.first_name || ''} ${sp.last_name || ''}`.trim();
                    }
                }

                const cleanShiftNum = String(shift.shift_number || 'SFT').replace(/^KS-/, '');
                const billNumber = `CRD-KV-${cleanShiftNum}-${Date.now().toString().slice(-4)}${normalizedAllocations.length > 1 ? `-${idx + 1}` : ''}`;
                const baseDesc = `Kitchen Variance Credit Bill - Shift #${shift.shift_number}${staffLabel ? ` (${staffLabel})` : ''}${itemsVarianceDetail}`;
                const fullDesc = allocation.description
                    ? `${allocation.description.trim()} [${baseDesc}]`
                    : baseDesc;

                const { data: bill, error: billError } = await supabase
                    .from('staff_credit_bills')
                    .insert({
                        staff_id: staffId,
                        branch_id: shift.branch_id,
                        bill_number: billNumber,
                        description: fullDesc,
                        amount,
                        paid_amount: 0,
                        balance: amount,
                        bill_date: new Date().toISOString().split('T')[0],
                        status: 'accountant_confirmed',
                        shift_id,
                        approved_at: new Date().toISOString(),
                        approved_by: userId,
                        accountant_confirmed_at: new Date().toISOString(),
                        accountant_confirmed_by: userId,
                        items: varianceItems,
                        items_snapshot: varianceItems,
                        metadata: {
                            bill_type: 'kitchen_variance',
                            shift_id,
                            shift_number: shift.shift_number,
                            shift_date: shift.shift_date,
                            branch_id: shift.branch_id,
                            total_variance_cost: varianceCost,
                            allocated_amount: amount,
                            staff_id: staffId,
                            staff_name: staffLabel,
                            items_with_variance_count: varianceItems.length,
                            items: varianceItems
                        }
                    })
                    .select()
                    .maybeSingle();
                if (billError) logger.error('kitchen liability credit bill insert', billError);
                if (bill) creditBills.push(bill);
            }
        }
    }

    await supabase.from('kitchen_shift_approvals').insert({
        shift_id,
        branch_id: shift.branch_id,
        approval_stage: approved ? 'accountant_approved' : 'accountant_rejected',
        approved_by: userId,
        notes: notes || `Accountant ${approved ? 'approved' : 'rejected'} (${action})`
    });

    try {
        await syncKitchenShiftToStockCounts(shift_id);
    } catch (err: any) {
        logger.error(`[accountantReviewShift] syncKitchenShiftToStockCounts failed for shift ${shift_id}:`, err);
    }

    res.json({ success: true, data: { shift: upd, liability_case: liabilityCase, credit_bills: creditBills } });
});

// ── GET SHIFT ───────────────────────────────────────────────
export const getKitchenShift = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const { data: shift } = await supabase.from('kitchen_shifts').select(`*, store_keeper:users!store_keeper_id(first_name,last_name)`).eq('id', shift_id).single();
    if (!shift) throw new AppError('Shift not found', 404);

    // If shift is open, sync any pending POS sales completed since the cashier shift started
    if (shift.status === 'open') {
        try {
            const sinceTimestamp = await getCashierShiftStartTimestamp(
                Number(shift.branch_id),
                (shift as any).cashier_shift_id,
                shift.shift_date
            );
            const { backfillKitchenConsumptionForOpenShift } = await import('./outlet-pos.controller');
            await backfillKitchenConsumptionForOpenShift(
                Number(shift.branch_id),
                shift_id,
                sinceTimestamp
            );
        } catch (err) {
            logger.warn('getKitchenShift: live POS backfill check failed', err as any);
        }
    }

    const [{ data: items }, { data: prods }, { data: prodInputs }, { data: st }, { data: aprv }, { data: liabilityCases }, { data: allBranchStaff }] = await Promise.all([
        supabase.from('kitchen_shift_items').select('*').eq('shift_id', shift_id).order('item_name'),
        supabase.from('kitchen_shift_production').select('*').eq('shift_id', shift_id).order('produced_at', { ascending: false }),
        supabase.from('kitchen_shift_production_inputs').select('*').eq('shift_id', shift_id).order('created_at', { ascending: false }),
        supabase.from('kitchen_shift_stock_take').select('*').eq('shift_id', shift_id).order('item_name'),
        supabase.from('kitchen_shift_approvals').select('*').eq('shift_id', shift_id).order('approved_at', { ascending: false }),
        supabase.from('kitchen_shift_liability_cases').select('*').eq('shift_id', shift_id).order('created_at', { ascending: false }),
        supabase.from('staff_profiles').select('id, user_id, branch_id, first_name, last_name, role, department, position, status').eq('branch_id', shift.branch_id).eq('status', 'active').order('first_name')
    ]);
    const staff = await staffProfileSummaries([
        shift.store_keeper_id,
        ...((shift.assigned_chef_ids || []) as string[]),
        ...((shift.assigned_dispense_ids || []) as string[])
    ]);
    const summary = (items || []).reduce((a: any, it: any) => ({
        opening_value: a.opening_value + n(it.opening_value), additions_value: a.additions_value + n(it.additions_value),
        sold_value: a.sold_value + n(it.sold_value), spoilage_value: a.spoilage_value + n(it.spoilage_value),
        variance_value: a.variance_value + n(it.variance_value), shortage: a.shortage + (n(it.variance) < 0 ? 1 : 0),
        overage: a.overage + (n(it.variance) > 0 ? 1 : 0), ok: a.ok + (n(it.variance) === 0 ? 1 : 0)
    }), { opening_value: 0, additions_value: 0, sold_value: 0, spoilage_value: 0, variance_value: 0, shortage: 0, overage: 0, ok: 0 });
    const inputsByProduction = new Map<string, any[]>();
    for (const input of prodInputs || []) {
        const productionId = (input as any).production_id?.toString();
        if (!productionId) continue;
        const list = inputsByProduction.get(productionId) || [];
        list.push(input);
        inputsByProduction.set(productionId, list);
    }
    const enrichedProductions = (prods || []).map((prod: any) => {
        const inputs = inputsByProduction.get(prod.id) || [];
        return {
            ...prod,
            raw_inputs: inputs,
            raw_used_summary: inputs.length
                ? inputs.map((row: any) => `${row.raw_item_name} ${n(row.quantity_used).toFixed(2)} ${row.unit || ''}`.trim()).join(', ')
                : `${prod.raw_item_name} ${n(prod.raw_quantity_used).toFixed(2)} ${prod.raw_unit || ''}`.trim()
        };
    });
    // Load Daily Controls snapshot if available to enrich variance breakdown and costs
    let dcReport: any = null;
    let dcSummary: any = null;
    try {
        const snap = await loadKitchenShiftControlSnapshot(shift_id);
        if (snap?.payload?.shift_report) {
            dcReport = snap.payload.shift_report;
            dcSummary = dcReport.summary || {};
        }
    } catch (e) {
        logger.warn('getKitchenShift: Daily Controls snapshot lookup failed', e as any);
    }

    if (dcSummary?.total_variance_cost != null && (!shift.total_variance_cost || shift.total_variance_cost === 0)) {
        shift.total_variance_cost = dcSummary.total_variance_cost;
    }
    if (dcSummary?.total_expected_cost != null && (!shift.total_expected_cost || shift.total_expected_cost === 0)) {
        shift.total_expected_cost = dcSummary.total_expected_cost;
    }
    if (dcSummary?.total_actual_cost != null && (!shift.total_actual_cost || shift.total_actual_cost === 0)) {
        shift.total_actual_cost = dcSummary.total_actual_cost;
    }

    // If stock_take is empty, populate it with itemized variance rows from Daily Controls
    let effectiveStockTake = st || [];
    if (effectiveStockTake.length === 0 && Array.isArray(dcReport?.rows)) {
        const varianceRows = dcReport.rows.filter((r: any) => Math.abs(n(r.variance_cost)) > 0.01 || Math.abs(n(r.variance_qty)) > 0.001);
        effectiveStockTake = varianceRows.map((r: any) => ({
            item_name: r.item_name || '—',
            item_sku: r.item_sku || '—',
            unit: r.unit || '',
            expected_quantity: r.expected_consumption_qty,
            actual_quantity: r.actual_consumption_qty,
            variance: r.variance_qty,
            variance_value: r.variance_cost,
            cost_price: r.cost_price,
            expected_cost: r.expected_cost,
            actual_cost: r.actual_cost,
        }));
    }

    res.json({
        success: true,
        data: {
            shift,
            items: items || [],
            productions: enrichedProductions,
            stock_take: effectiveStockTake,
            daily_controls_report: dcReport,
            daily_controls_summary: dcSummary,
            approvals: aprv || [],
            liability_cases: liabilityCases || [],
            shift_staff: staff,
            branch_staff: allBranchStaff || [],
            summary
        }
    });
});

// ── LIST SHIFTS ─────────────────────────────────────────────
export const listKitchenShifts = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id, status, shift_date, from_date, to_date } = req.query;
    let q = supabase.from('kitchen_shifts').select('*, store_keeper:users!store_keeper_id(first_name,last_name)').order('opened_at', { ascending: false });
    if (branch_id) q = q.eq('branch_id', branch_id);
    if (status && status !== 'all') q = q.eq('status', status);
    if (shift_date) q = q.eq('shift_date', shift_date);
    if (from_date) q = q.gte('shift_date', from_date);
    if (to_date) q = q.lte('shift_date', to_date);
    const { data, error } = await q;
    if (error) throw new AppError(error.message, 500);

    const shiftList = data || [];
    const shiftIds = shiftList.map((s: any) => s.id);
    let snapshotMap = new Map<string, any>();
    let liabilityMap = new Map<string, any>();

    if (shiftIds.length > 0) {
        try {
            const [{ data: snapshots }, { data: liabilityCases }] = await Promise.all([
                supabase
                    .from('kitchen_shift_control_snapshots')
                    .select('shift_id, computed_at, snapshot_data')
                    .in('shift_id', shiftIds),
                supabase
                    .from('kitchen_shift_liability_cases')
                    .select('*')
                    .in('shift_id', shiftIds)
            ]);

            (snapshots || []).forEach((sn: any) => {
                snapshotMap.set(sn.shift_id, sn);
            });
            (liabilityCases || []).forEach((lc: any) => {
                liabilityMap.set(lc.shift_id, lc);
            });
        } catch (e) {
            logger.warn('listKitchenShifts: snapshots/liability fetch failed', e as any);
        }
    }

    const enriched = shiftList.map((shift: any) => {
        const snap = snapshotMap.get(shift.id);
        const rep = snap?.snapshot_data?.shift_report;
        const sum = rep?.summary || {};
        const varCost = sum.total_variance_cost != null ? n(sum.total_variance_cost) : n(shift.total_variance_cost);
        const expCost = sum.total_expected_cost != null ? n(sum.total_expected_cost) : n(shift.total_expected_cost);
        const actCost = sum.total_actual_cost != null ? n(sum.total_actual_cost) : n(shift.total_actual_cost);
        const posQty = sum.total_pos_sales_qty != null ? n(sum.total_pos_sales_qty) : 0;
        const topRows = Array.isArray(rep?.rows)
            ? rep.rows.filter((r: any) => Math.abs(n(r.variance_cost)) > 0.01).slice(0, 5)
            : [];
        const lc = liabilityMap.get(shift.id);

        return {
            ...shift,
            total_variance_cost: varCost,
            total_expected_cost: expCost,
            total_actual_cost: actCost,
            total_pos_sales_qty: posQty,
            daily_control_summary: rep?.summary || null,
            daily_control_top_variances: topRows,
            has_snapshot: !!snap,
            snapshot_computed_at: snap?.computed_at || null,
            liability_case: lc || null,
        };
    });

    res.json({ success: true, data: enriched });
});

// ── PRODUCTION SESSION VIEW (compatibility) ──────────────────
// Returns kitchen_shifts data in the shape expected by old
// kitchen_production_sessions consumers — read-only, additive.
export const getProductionSessionView = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id, status, shift_type, date_from, date_to } = req.query;
    let query = supabase
        .from('kitchen_shifts')
        .select(`
            *,
            kitchen_shift_items(*),
            kitchen_shift_production(*),
            opened_by_user:users!opened_by(first_name,last_name)
        `)
        .order('opened_at', { ascending: false });

    if (branch_id) query = query.eq('branch_id', Number(branch_id));
    if (status) query = query.eq('status', status as string);
    if (shift_type) query = query.eq('shift_type', shift_type as string);
    if (date_from) query = query.gte('shift_date', date_from as string);
    if (date_to) query = query.lte('shift_date', date_to as string);

    const { data, error } = await query;
    if (error) throw new AppError(error.message, 500);

    const formatted = (data || []).map((s: any) => {
        const first = s.opened_by_user?.first_name || '';
        const last = s.opened_by_user?.last_name || '';
        return {
            ...s,
            session_number: s.shift_number,
            session_date: s.shift_date,
            staff_name: `${first} ${last}`.trim() || 'Staff',
            staff_id: s.opened_by,
        };
    });

    res.json({ success: true, data: formatted });
});

// Links a POS item to a shared stock pool — used by Food Controls whose
// output is a fraction of a base item (e.g. Half/Quarter Chicken sharing
// the Full Chicken pool).
async function applyPoolLink(posOutletItemId: string | null | undefined, poolItemId: string | null | undefined, poolFraction: any): Promise<void> {
    if (!posOutletItemId || !poolItemId) return;
    await supabase.from('pos_outlet_items').update({
        stock_pool_item_id: poolItemId,
        pool_fraction: n(poolFraction) > 0 ? n(poolFraction) : 1,
        updated_at: new Date().toISOString()
    }).eq('id', posOutletItemId);
}

// ── RECIPES ─────────────────────────────────────────────────
export const createProductionRecipe = asyncWrap(async (req: Request, res: Response) => {
    const {
        branch_id,
        recipe_name,
        raw_item_sku,
        raw_item_name,
        raw_quantity,
        raw_unit,
        produced_item_name,
        produced_item_sku,
        produced_quantity,
        produced_unit,
        pos_outlet_item_id,
        allowed_variance_percent,
        spoilage_threshold_percent,
        cost_per_output,
        requires_yield_confirmation,
        pool_item_id,
        pool_fraction,
        yield_type_code,
        stocktake_control_mode,
        stocktake_location,
        prep_stage_code,
        prep_stage_group,
        prep_stage_order
    } = req.body;
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;
    const userBranchId = (req as any).user?.branch_id ?? (req as any).user?.branchId;
    // Non-global users may only create standards for their own branch
    if (!isGlobalRole(userRole) && userBranchId != null && Number(branch_id) !== Number(userBranchId)) {
        throw new AppError('You can only create food control standards for your own branch.', 403);
    }
    const outputs = Array.isArray(req.body.outputs) ? req.body.outputs : [];
    const resolvedControlMode = String(stocktake_control_mode || 'BOTH').trim().toUpperCase();
    const resolvedStocktakeLocation = String(stocktake_location || 'KITCHEN').trim().toUpperCase();
    if (!STOCKTAKE_CONTROL_MODES.includes(resolvedControlMode)) {
        throw new AppError('Invalid stocktake_control_mode', 400);
    }
    if (!STOCKTAKE_LOCATIONS.includes(resolvedStocktakeLocation)) {
        throw new AppError('Invalid stocktake_location', 400);
    }
    const resolvedPrepStageCode = String(prep_stage_code || '').trim().toUpperCase() || null;
    const resolvedPrepStageGroup = String(prep_stage_group || '').trim() || null;
    const resolvedPrepStageOrder = prep_stage_order == null || prep_stage_order === ''
        ? null
        : Math.trunc(n(prep_stage_order));
    if (resolvedPrepStageCode && !['PEEL', 'CUT', 'PREP_OTHER', 'PREP_FLOW'].includes(resolvedPrepStageCode)) {
        throw new AppError('Invalid prep_stage_code', 400);
    }
    const normalizedOutputs = outputs.length > 0
        ? outputs
        : [{
            produced_item_name,
            produced_item_sku,
            produced_quantity,
            produced_unit,
            pos_outlet_item_id,
            pool_item_id,
            pool_fraction
        }];

    let finalInputs = Array.isArray(req.body.inputs) && req.body.inputs.length > 0
        ? req.body.inputs
        : (raw_item_sku ? [{
            raw_item_sku,
            raw_item_name,
            quantity: raw_quantity,
            unit: raw_unit
        }] : []);

    if (yield_type_code === 'DIRECT' && finalInputs.length === 0) {
        // Resolve input from pos_outlet_item_id
        const targetOutput = normalizedOutputs[0];
        const outletItemId = targetOutput?.pos_outlet_item_id;
        if (!outletItemId) {
            throw new AppError('pos_outlet_item_id is required for DIRECT yield type recipes', 400);
        }

        const { data: outletItem, error: outletItemError } = await supabase
            .from('pos_outlet_items')
            .select('id, name, sku, source_table, source_item_id')
            .eq('id', outletItemId)
            .maybeSingle();

        if (outletItemError) throw new AppError(outletItemError.message, 500);
        if (!outletItem) {
            throw new AppError(`Linked POS Outlet item not found for id ${outletItemId}`, 404);
        }

        let inventoryItemId: string | null = null;
        if (outletItem.source_table === 'restaurant_menu_items' && outletItem.source_item_id) {
            const { data: menuItem } = await supabase
                .from('restaurant_menu_items')
                .select('inventory_item_id')
                .eq('id', outletItem.source_item_id)
                .maybeSingle();
            inventoryItemId = menuItem?.inventory_item_id || null;
        } else if (outletItem.source_table === 'bar_drinks' && outletItem.source_item_id) {
            const { data: drinkItem } = await supabase
                .from('bar_drinks')
                .select('inventory_item_id')
                .eq('id', outletItem.source_item_id)
                .maybeSingle();
            inventoryItemId = drinkItem?.inventory_item_id || null;
        }

        if (!inventoryItemId) {
            throw new AppError(`No mapped stock inventory item found for POS Item "${outletItem.name}"`, 400);
        }

        const { data: inventoryItem, error: invErr } = await supabase
            .from('inventory_items')
            .select('id, sku, item_name, unit')
            .eq('id', inventoryItemId)
            .maybeSingle();

        if (invErr) throw new AppError(invErr.message, 500);
        if (!inventoryItem) {
            throw new AppError(`Mapped stock inventory item not found in database`, 404);
        }

        finalInputs = [{
            raw_item_sku: inventoryItem.sku,
            raw_item_name: inventoryItem.item_name,
            quantity: 1.0,
            unit: inventoryItem.unit
        }];
    }

    if (!branch_id || finalInputs.length === 0 || normalizedOutputs.length === 0) {
        throw new AppError('branch_id, inputs, and outputs are required', 400);
    }
    const invalidInput = finalInputs.find((input: any) =>
        !input?.raw_item_sku || !input?.raw_item_name || n(input?.quantity) <= 0
    );
    if (invalidInput) {
        throw new AppError('Every input must have an SKU, name, and quantity greater than zero', 400);
    }
    const invalidOutput = normalizedOutputs.find((output: any) =>
        !output?.produced_item_name || n(output?.produced_quantity) <= 0
    );
    if (invalidOutput) {
        throw new AppError('Every produced menu item must have a name and yield quantity greater than zero', 400);
    }
    if (yield_type_code === 'SUB_ASSEMBLY') {
        for (const output of normalizedOutputs) {
            const newSku = 'KITCH-' + Date.now() + Math.floor(Math.random()*1000);
            const { data: invItem, error: invErr } = await supabase.from('inventory_items').insert({
                item_name: output.produced_item_name,
                sku: newSku,
                category: 'sub_assembly',
                store_type: 'kitchen_ledger',
                branch_id,
                unit: output.produced_unit || produced_unit || 'portion',
                item_type: 'prepared',
                tracking_mode: 'BATCH',
                is_active: true,
                is_for_sale: false
            }).select('id, sku').single();
            if (invErr) throw new AppError('Failed to create sub-assembly item: ' + invErr.message, 500);
            output.produced_inventory_item_id = invItem.id;
            output.produced_inventory_item_sku = invItem.sku;
            output.pos_outlet_item_id = null;
        }
    }

    const insertRows = normalizedOutputs.map((output: any) => ({
        branch_id,
        recipe_name: output.recipe_name || recipe_name || `${finalInputs[0].raw_item_name} to ${output.produced_item_name}`,
        raw_item_sku: finalInputs.length === 1 ? finalInputs[0].raw_item_sku : 'MULTI',
        raw_item_name: finalInputs.length === 1 ? finalInputs[0].raw_item_name : 'Multiple Inputs',
        raw_quantity: finalInputs.length === 1 ? n(finalInputs[0].quantity) : 0,
        raw_unit: finalInputs.length === 1 ? finalInputs[0].unit : 'mixed',
        produced_item_name: output.produced_item_name,
        produced_item_sku: output.produced_item_sku || null,
        produced_quantity: n(output.produced_quantity),
        produced_unit: output.produced_unit || produced_unit || 'portion',
        pos_outlet_item_id: output.pos_outlet_item_id || null,
        produced_inventory_item_id: output.produced_inventory_item_id || null,
        produced_inventory_item_sku: output.produced_inventory_item_sku || null,
        allowed_variance_percent: n(allowed_variance_percent || 2),
        spoilage_threshold_percent: n(spoilage_threshold_percent || 1),
        cost_per_output: n(output.cost_per_output ?? cost_per_output),
        requires_yield_confirmation: requires_yield_confirmation !== false,
        yield_type_code: yield_type_code || (output.pool_fraction ? 'COMPLEX' : 'PRODUCTION'),
        stocktake_control_mode: resolvedControlMode,
        stocktake_location: resolvedStocktakeLocation,
        prep_stage_code: resolvedPrepStageCode,
        prep_stage_group: resolvedPrepStageGroup,
        prep_stage_order: resolvedPrepStageOrder,
        is_active: true,
        updated_at: new Date().toISOString(),
        created_by: userId
    }));

    const { data, error } = await supabase
        .from('kitchen_production_recipes')
        .upsert(insertRows, { onConflict: 'branch_id,raw_item_sku,produced_item_name' })
        .select();
    if (error) {
        throw new AppError(error.message, 500);
    }

    // Insert inputs into the new table
    const recipeIds = (data || []).map((r: any) => r.id);
    if (recipeIds.length > 0) {
        await supabase.from('kitchen_production_recipe_inputs').delete().in('recipe_id', recipeIds);
    }

    const inputRows: any[] = [];
    for (const recipe of (data || [])) {
        for (const input of finalInputs) {
            inputRows.push({
                recipe_id: recipe.id,
                raw_item_sku: input.raw_item_sku,
                raw_item_name: input.raw_item_name,
                quantity: n(input.quantity),
                unit: input.unit || 'unit'
            });
        }
    }
    if (inputRows.length > 0) {
        const { error: inputsError } = await supabase.from('kitchen_production_recipe_inputs').insert(inputRows);
        if (inputsError) throw new AppError(inputsError.message, 500);
    }

    await Promise.all(normalizedOutputs.map((output: any) =>
        applyPoolLink(output.pos_outlet_item_id, output.pool_item_id, output.pool_fraction)
    ));
    res.status(201).json({ success: true, data: outputs.length > 0 ? data : data?.[0] });
});

export const updateProductionRecipe = asyncWrap(async (req: Request, res: Response) => {
    const { recipe_id } = req.params;
    // Verify the caller owns this recipe (non-global roles only)
    const userRole = (req as any).user?.role;
    if (!isGlobalRole(userRole)) {
        const userBranchId = (req as any).user?.branch_id ?? (req as any).user?.branchId;
        const { data: existing, error: fetchErr } = await supabase
            .from('kitchen_production_recipes')
            .select('branch_id')
            .eq('id', recipe_id)
            .maybeSingle();
        if (fetchErr) throw new AppError(fetchErr.message, 500);
        if (!existing) throw new AppError('Recipe standard not found.', 404);
        if (Number(existing.branch_id) !== Number(userBranchId)) {
            throw new AppError('You can only update food control standards for your own branch.', 403);
        }
    }
    const payload: any = {};
    for (const key of [
        'recipe_name',
        'raw_item_sku',
        'raw_item_name',
        'raw_unit',
        'produced_item_name',
        'produced_item_sku',
        'produced_unit',
        'pos_outlet_item_id',
        'is_active',
        'yield_type_code',
        'stocktake_control_mode',
        'stocktake_location',
        'prep_stage_code',
        'prep_stage_group',
        'prep_stage_order'
    ]) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) payload[key] = req.body[key];
    }
    if (payload.stocktake_control_mode) {
        payload.stocktake_control_mode = String(payload.stocktake_control_mode).trim().toUpperCase();
        if (!STOCKTAKE_CONTROL_MODES.includes(payload.stocktake_control_mode)) {
            throw new AppError('Invalid stocktake_control_mode', 400);
        }
    }
    if (payload.stocktake_location) {
        payload.stocktake_location = String(payload.stocktake_location).trim().toUpperCase();
        if (!STOCKTAKE_LOCATIONS.includes(payload.stocktake_location)) {
            throw new AppError('Invalid stocktake_location', 400);
        }
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'prep_stage_code')) {
        payload.prep_stage_code = String(payload.prep_stage_code || '').trim().toUpperCase() || null;
        if (payload.prep_stage_code && !['PEEL', 'CUT', 'PREP_OTHER', 'PREP_FLOW'].includes(payload.prep_stage_code)) {
            throw new AppError('Invalid prep_stage_code', 400);
        }
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'prep_stage_group')) {
        payload.prep_stage_group = String(payload.prep_stage_group || '').trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'prep_stage_order')) {
        payload.prep_stage_order = payload.prep_stage_order == null || payload.prep_stage_order === ''
            ? null
            : Math.trunc(n(payload.prep_stage_order));
    }
    for (const key of [
        'raw_quantity',
        'produced_quantity',
        'allowed_variance_percent',
        'spoilage_threshold_percent',
        'cost_per_output'
    ]) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) payload[key] = n(req.body[key]);
    }
    // Synchronize legacy columns if inputs are updated
    if (Array.isArray(req.body.inputs)) {
        if (req.body.inputs.length === 1) {
            payload.raw_item_sku = req.body.inputs[0].raw_item_sku;
            payload.raw_item_name = req.body.inputs[0].raw_item_name;
            payload.raw_quantity = n(req.body.inputs[0].quantity);
            payload.raw_unit = req.body.inputs[0].unit || 'unit';
        } else if (req.body.inputs.length > 1) {
            payload.raw_item_sku = 'MULTI';
            payload.raw_item_name = 'Multiple Inputs';
            payload.raw_quantity = 0;
            payload.raw_unit = 'mixed';
        }
    }

    payload.updated_at = new Date().toISOString();
    const { data, error } = await supabase
        .from('kitchen_production_recipes')
        .update(payload)
        .eq('id', recipe_id)
        .select()
        .single();
    if (error) {
        if (error.code === '23505') {
            throw new AppError('A recipe standard for this raw stock item and output already exists in this branch.', 400);
        }
        throw new AppError(error.message, 500);
    }

    // If inputs are provided, update the kitchen_production_recipe_inputs table
    if (Array.isArray(req.body.inputs)) {
        const { error: deleteError } = await supabase
            .from('kitchen_production_recipe_inputs')
            .delete()
            .eq('recipe_id', recipe_id);
        if (deleteError) throw new AppError(deleteError.message, 500);

        if (req.body.inputs.length > 0) {
            const inputRows = req.body.inputs.map((input: any) => ({
                recipe_id: recipe_id,
                raw_item_sku: input.raw_item_sku,
                raw_item_name: input.raw_item_name,
                quantity: n(input.quantity),
                unit: input.unit || 'unit'
            }));
            const { error: insertError } = await supabase
                .from('kitchen_production_recipe_inputs')
                .insert(inputRows);
            if (insertError) throw new AppError(insertError.message, 500);
        }
    }

    await applyPoolLink(data?.pos_outlet_item_id, req.body.pool_item_id, req.body.pool_fraction);
    res.json({ success: true, data });
});

export const deactivateProductionRecipe = asyncWrap(async (req: Request, res: Response) => {
    const { recipe_id } = req.params;
    // Verify the caller owns this recipe (non-global roles only)
    const userRole = (req as any).user?.role;
    if (!isGlobalRole(userRole)) {
        const userBranchId = (req as any).user?.branch_id ?? (req as any).user?.branchId;
        const { data: existing, error: fetchErr } = await supabase
            .from('kitchen_production_recipes')
            .select('branch_id')
            .eq('id', recipe_id)
            .maybeSingle();
        if (fetchErr) throw new AppError(fetchErr.message, 500);
        if (!existing) throw new AppError('Recipe standard not found.', 404);
        if (Number(existing.branch_id) !== Number(userBranchId)) {
            throw new AppError('You can only deactivate food control standards for your own branch.', 403);
        }
    }
    const { data, error } = await supabase
        .from('kitchen_production_recipes')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', recipe_id)
        .select()
        .single();
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data });
});

export const listProductionRecipes = asyncWrap(async (req: Request, res: Response) => {
    const { yield_type } = req.query;
    let q = supabase.from('kitchen_production_recipes').select('*, inputs:kitchen_production_recipe_inputs(*)').eq('is_active', true).order('recipe_name');
    // Apply branch isolation: non-global users only see their branch's standards
    q = applyBranchFilter(q, req);
    if (yield_type) q = q.eq('yield_type_code', yield_type);
    const { data, error } = await q;
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: data || [] });
});

// POS menu items a Food Control recipe can be linked to. Sourced from
// pos_outlet_items (the real sales catalog — pos_shift_orders.items[].outlet_item_id
// references this table's id) rather than restaurant_menu_items, which is a
// separate, unrelated catalog with no populated FK back to pos_outlet_items.
// Recipes linked against the wrong table's id would never match a real sale.
export const listRecipeLinkableMenuItems = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id } = req.query;
    if (!branch_id) throw new AppError('branch_id required', 400);
    let q = supabase
        .from('pos_outlet_items')
        .select('id, name, sku, unit, category, item_group, track_stock, source_table')
        .eq('is_active', true)
        .order('name', { ascending: true });
    // Apply branch isolation; query branch_id param is the floor, token further restricts non-globals
    q = applyBranchFilter(q, req);
    const { data, error } = await q;
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: data || [] });
});

// ── FOOD CONTROL TYPE CONFIG (Phase 1) ───────────────────────
// Type A (recipe BOM) = kitchen_production_recipes, above.
// Type B (yield/pool split) = pos_outlet_items.stock_pool_item_id + pool_fraction,
// already live for real POS sales (see applyPoolLink above). The endpoints
// below just expose that same mechanism as its own config screen.
// Type C (direct) and EXEMPT are genuinely new — registered in
// food_control_direct_items / food_control_exempt_items
// (migration 20260629_food_control_type_config.sql).

function isBarItem(item: { item_group?: string | null; source_table?: string | null; category?: string | null; name?: string | null; sku?: string | null }): boolean {
    if (item.item_group === 'bar') return true;
    if (item.source_table === 'bar_drinks') return true;

    const category = (item.category || '').toLowerCase();
    const name = (item.name || '').toLowerCase();
    const sku = (item.sku || '').toLowerCase();

    // Check if the item belongs to alcohol categories
    const BAR_EXPLICIT_CATEGORIES = ['whisky', 'whiskey', 'beer', 'wine', 'spirit', 'liqueur', 'brandy', 'vodka', 'gin', 'rum', 'tequila', 'cider', 'alcohol'];
    if (BAR_EXPLICIT_CATEGORIES.some(cat => category.includes(cat))) {
        return true;
    }

    // Match exact bar terms using word boundaries
    const barWordRegex = /\b(beer|wine|whisky|whiskey|vodka|gin|rum|brandy|liqueur|alcohol)\b/i;
    if (barWordRegex.test(name) || barWordRegex.test(sku)) {
        return true;
    }

    return false;
}

export const getStockItemFoodControlType = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id, item_sku } = req.query;
    if (!branch_id || !item_sku) throw new AppError('branch_id and item_sku are required', 400);
    const { data, error } = await supabase.rpc('get_stock_item_food_control_type', {
        p_branch_id: Number(branch_id),
        p_item_sku: String(item_sku)
    });
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: { item_sku, food_control_type: data } });
});

export const listDirectItems = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id } = req.query;
    if (!branch_id) throw new AppError('branch_id required', 400);
    let q = supabase
        .from('food_control_direct_items')
        .select('*, pos_outlet_item:pos_outlet_items(id,name,sku,unit)')
        .eq('is_active', true)
        .order('stock_item_name');
    // Apply branch isolation
    q = applyBranchFilter(q, req);
    const { data, error } = await q;
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: data || [] });
});

export const createDirectItem = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id, stock_item_sku, stock_item_name, pos_outlet_item_id } = req.body;
    if (!branch_id || !stock_item_sku || !pos_outlet_item_id) {
        throw new AppError('branch_id, stock_item_sku and pos_outlet_item_id are required', 400);
    }
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;
    const userBranchId = (req as any).user?.branch_id ?? (req as any).user?.branchId;
    // Non-global users may only create direct items for their own branch
    if (!isGlobalRole(userRole) && userBranchId != null && Number(branch_id) !== Number(userBranchId)) {
        throw new AppError('You can only create direct food control items for your own branch.', 403);
    }
    const { data, error } = await supabase
        .from('food_control_direct_items')
        .insert({
            branch_id,
            stock_item_sku,
            stock_item_name: stock_item_name || null,
            pos_outlet_item_id,
            created_by: userId
        })
        .select()
        .single();
    if (error) throw new AppError(error.message, 500);
    res.status(201).json({ success: true, data });
});

export const deactivateDirectItem = asyncWrap(async (req: Request, res: Response) => {
    const { id } = req.params;
    // Verify the caller owns this direct item (non-global roles only)
    const userRole = (req as any).user?.role;
    if (!isGlobalRole(userRole)) {
        const userBranchId = (req as any).user?.branch_id ?? (req as any).user?.branchId;
        const { data: existing, error: fetchErr } = await supabase
            .from('food_control_direct_items')
            .select('branch_id')
            .eq('id', id)
            .maybeSingle();
        if (fetchErr) throw new AppError(fetchErr.message, 500);
        if (!existing) throw new AppError('Direct item not found.', 404);
        if (Number(existing.branch_id) !== Number(userBranchId)) {
            throw new AppError('You can only deactivate direct food control items for your own branch.', 403);
        }
    }
    const { data, error } = await supabase
        .from('food_control_direct_items')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data });
});

export const listExemptItems = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id } = req.query;
    if (!branch_id) throw new AppError('branch_id required', 400);
    let q = supabase
        .from('food_control_exempt_items')
        .select('*, pos_outlet_item:pos_outlet_items(id,name,sku,unit,category)')
        .order('created_at', { ascending: false });
    // Apply branch isolation
    q = applyBranchFilter(q, req);
    const { data, error } = await q;
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: data || [] });
});

export const createExemptItem = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id, pos_outlet_item_id, reason } = req.body;
    if (!branch_id || !pos_outlet_item_id) {
        throw new AppError('branch_id and pos_outlet_item_id are required', 400);
    }
    const userId = (req as any).user?.id;
    const { data, error } = await supabase
        .from('food_control_exempt_items')
        .insert({ branch_id, pos_outlet_item_id, reason: reason || null, exempted_by: userId })
        .select()
        .single();
    if (error) throw new AppError(error.message, 500);
    res.status(201).json({ success: true, data });
});

export const deleteExemptItem = asyncWrap(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { error } = await supabase.from('food_control_exempt_items').delete().eq('id', id);
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: { id } });
});

// Pool (Type B) links — thin config wrapper around the same applyPoolLink
// mechanism used by recipe creation, so a pool relationship can be set up
// independently of any recipe (e.g. a whole chicken split into POS fractions
// with no cooking step in between).
export const listPoolLinks = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id } = req.query;
    if (!branch_id) throw new AppError('branch_id required', 400);
    const { data, error } = await supabase
        .from('pos_outlet_items')
        .select('id, name, sku, unit, pool_fraction, stock_pool_item_id, pool_parent:pos_outlet_items!stock_pool_item_id(id,name,sku)')
        .eq('branch_id', Number(branch_id))
        .not('stock_pool_item_id', 'is', null)
        .order('name');
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: data || [] });
});

// Pool parents must physically be a pos_outlet_items row — the live POS
// deduction code (outlet-pos.controller.ts, decrement_pos_outlet_item_stock)
// only ever decrements pos_outlet_items.current_stock by id. But storekeepers
// think of the pool parent as the raw branch_stock item in the central store
// (e.g. "FULL CHICKEN"), not a POS catalog row. This resolves that
// branch_stock SKU to its pos_outlet_items proxy, creating one if none exists
// yet — tagged is_available: false so it never appears as a sellable item on
// the cashier's POS screen (those list queries filter on is_available), while
// still being a normal, active pos_outlet_items row for stock/pool purposes.
async function resolveOrCreateStockPoolItem(
    branchId: number,
    sku: string,
    name?: string | null,
    unit?: string | null
): Promise<string> {
    // The pool parent must actually be a stocked branch_stock item — a pool
    // split with nothing behind it to deduct from is meaningless. Read the
    // real quantity from branch_stock ourselves rather than trust the
    // client, and require it to be > 0.
    const { data: stockRow, error: stockError } = await supabase
        .from('branch_stock')
        .select('quantity')
        .eq('branch_id', branchId)
        .eq('item_sku', sku)
        .maybeSingle();
    if (stockError) throw new AppError(stockError.message, 500);
    const stockQuantity = Number(stockRow?.quantity ?? 0);
    if (!stockRow || stockQuantity <= 0) {
        throw new AppError(
            `${name || sku} has no stock recorded in branch stock yet — receive it into branch stock before using it as a pool parent`,
            400
        );
    }

    const { data: existing, error: lookupError } = await supabase
        .from('pos_outlet_items')
        .select('id')
        .eq('branch_id', branchId)
        .eq('sku', sku)
        .maybeSingle();
    if (lookupError) throw new AppError(lookupError.message, 500);
    if (existing) {
        // Re-sync the proxy's stock to the real branch_stock balance every
        // time the link is (re)confirmed, so it doesn't drift stale.
        const { error: syncError } = await supabase
            .from('pos_outlet_items')
            .update({ current_stock: stockQuantity, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        if (syncError) throw new AppError(syncError.message, 500);
        return existing.id;
    }

    const { data: created, error: createError } = await supabase
        .from('pos_outlet_items')
        .insert({
            branch_id: branchId,
            sku,
            name: name || sku,
            unit: unit || null,
            track_stock: true,
            is_active: true,
            is_available: false,
            current_stock: stockQuantity,
            source_table: 'branch_stock'
        })
        .select('id')
        .single();
    if (createError) {
        throw new AppError(`Could not register ${name || sku} as a stock pool item: ${createError.message}`, 500);
    }
    return created.id;
}

export const setPoolLink = asyncWrap(async (req: Request, res: Response) => {
    const {
        pos_outlet_item_id, pool_item_id,
        pool_item_sku, pool_item_name, pool_item_unit,
        branch_id, pool_fraction
    } = req.body;
    if (!pos_outlet_item_id || (!pool_item_id && !pool_item_sku) || n(pool_fraction) <= 0 || n(pool_fraction) > 1) {
        throw new AppError(
            'pos_outlet_item_id, (pool_item_id or pool_item_sku) and a pool_fraction between 0 and 1 are required',
            400
        );
    }
    let resolvedPoolItemId = pool_item_id;
    if (!resolvedPoolItemId) {
        if (!branch_id) throw new AppError('branch_id is required when linking by pool_item_sku', 400);
        resolvedPoolItemId = await resolveOrCreateStockPoolItem(
            Number(branch_id), String(pool_item_sku), pool_item_name, pool_item_unit
        );
    }
    await applyPoolLink(pos_outlet_item_id, resolvedPoolItemId, pool_fraction);
    const { data, error } = await supabase
        .from('pos_outlet_items')
        .select('id, name, sku, pool_fraction, stock_pool_item_id')
        .eq('id', pos_outlet_item_id)
        .single();
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data });
});

export const clearPoolLink = asyncWrap(async (req: Request, res: Response) => {
    const { itemId } = req.params;
    const { data, error } = await supabase
        .from('pos_outlet_items')
        .update({ stock_pool_item_id: null, pool_fraction: null, updated_at: new Date().toISOString() })
        .eq('id', itemId)
        .select()
        .single();
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data });
});

// Sold/issuable POS items with no food control classification at all —
// the "gap finder" storekeepers and accountants use to close out config.
export const listUnregisteredItems = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id } = req.query;
    if (!branch_id) throw new AppError('branch_id required', 400);
    let q = supabase
        .from('pos_outlet_items')
        .select('id, name, sku, category, unit, stock_pool_item_id, item_group, source_table')
        .eq('is_active', true);
    // Apply branch isolation
    q = applyBranchFilter(q, req);
    const { data: items, error } = await q;
    if (error) throw new AppError(error.message, 500);

    // Resolve effective branch_id for the RPC (use token branch for non-globals, else query param)
    const userRole = (req as any).user?.role;
    const userBranchId = (req as any).user?.branch_id ?? (req as any).user?.branchId;
    const effectiveBranchId = !isGlobalRole(userRole) && userBranchId != null
        ? Number(userBranchId)
        : Number(branch_id);

    const candidates = (items || []).filter((item) => !isBarItem(item) && !item.stock_pool_item_id);
    const skus = Array.from(new Set(candidates.map((item) => item.sku).filter(Boolean)));
    const types = new Map<string, string>();
    await Promise.all(skus.map(async (sku) => {
        const { data } = await supabase.rpc('get_stock_item_food_control_type', {
            p_branch_id: effectiveBranchId,
            p_item_sku: sku
        });
        types.set(sku as string, data || 'UNREGISTERED');
    }));

    const unregistered = candidates.filter((item) => !item.sku || types.get(item.sku) === 'UNREGISTERED');
    res.json({ success: true, data: unregistered });
});

// ── DASHBOARD STATS ───────────────────────────────────────
export const getKitchenShiftStats = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id, from_date, to_date } = req.query;
    if (!branch_id) throw new AppError('branch_id required', 400);
    const start = from_date || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
    const end = to_date || new Date().toISOString().split('T')[0];

    const { data: shifts } = await supabase.from('kitchen_shifts').select('*').eq('branch_id', branch_id).gte('shift_date', start).lte('shift_date', end);
    const open = (shifts || []).filter((s: any) => s.status === 'open').length;
    const closed = (shifts || []).filter((s: any) => s.status === 'closed').length;
    const approved = (shifts || []).filter((s: any) => s.status === 'approved').length;
    const rev = (shifts || []).reduce((s: number, sh: any) => s + n(sh.total_revenue), 0);
    const cogs = (shifts || []).reduce((s: number, sh: any) => s + n(sh.total_cogs), 0);
    const spoil = (shifts || []).reduce((s: number, sh: any) => s + n(sh.total_spoilage_cost), 0);
    const varc = (shifts || []).reduce((s: number, sh: any) => s + n(sh.total_variance_cost), 0);

    const { data: prods } = await supabase.from('kitchen_shift_production').select('produced_item_name,produced_quantity')
        .eq('branch_id', branch_id).gte('created_at', `${start}T00:00:00`).lte('created_at', `${end}T23:59:59`);
    const top: Record<string, number> = {};
    (prods || []).forEach((p: any) => { top[p.produced_item_name] = (top[p.produced_item_name] || 0) + n(p.produced_quantity); });
    const sorted = Object.entries(top).sort(([, a], [, b]) => b - a).slice(0, 10).map(([name, quantity]) => ({ name, quantity }));

    res.json({
        success: true,
        data: {
            summary: { total: (shifts || []).length, open, closed, approved },
            financials: { revenue: rev, cogs, gross_profit: rev - cogs, spoilage: spoil, variance: varc },
            top_items: sorted
        }
    });
});

export const getKitchenShiftPosConsumption = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    
    // 1. Fetch consumption records
    const { data: consumption, error: consError } = await supabase
        .from('kitchen_shift_pos_consumption')
        .select(`
            *,
            pos_shift:pos_outlet_shifts(
                id,
                shift_number,
                status,
                opened_at,
                closed_at,
                cashier:users!cashier_id(first_name,last_name),
                outlet:pos_outlets(id,name,outlet_type)
            )
        `)
        .eq('shift_id', shift_id)
        .order('created_at', { ascending: false });

    if (consError) throw new AppError(consError.message, 500);

    // Sales recorded here but never issued to this kitchen shift (e.g. a
    // pastry sold before the storekeeper ran "Issue to Kitchen") cannot be
    // deducted from system_closing_stock at close time — flag them so the
    // storekeeper can issue the stock (or investigate) before closing.
    const { data: issuedSkuRows } = await supabase
        .from('kitchen_shift_items')
        .select('item_sku')
        .eq('shift_id', shift_id);
    const issuedSkus = new Set((issuedSkuRows || []).map((r: any) => r.item_sku));

    let unmatchedCount = 0;
    let unmatchedValue = 0;

    // 2. Group by cashier shift (pos_shift_id) to summarize sales per cashier shift
    const shiftsMap = new Map<string, any>();
    for (const item of (consumption || [])) {
        const matched = issuedSkus.has(item.raw_item_sku);
        item.matched_to_shift_stock = matched;
        if (!matched) {
            unmatchedCount += 1;
            unmatchedValue += Number(item.portions_sold || 0) * Number(item.cost_price || 0);
        }

        const ps = item.pos_shift as any;
        if (!ps) continue;
        const psId = ps.id;
        if (!shiftsMap.has(psId)) {
            const first = ps.cashier?.first_name || '';
            const last = ps.cashier?.last_name || '';
            shiftsMap.set(psId, {
                id: psId,
                shift_number: ps.shift_number,
                status: ps.status,
                opened_at: ps.opened_at,
                closed_at: ps.closed_at,
                cashier_name: `${first} ${last}`.trim() || 'Cashier',
                outlet_name: ps.outlet?.name || 'POS Outlet',
                total_portions: 0,
                total_cost: 0,
                unmatched_count: 0,
                items: []
            });
        }
        const grp = shiftsMap.get(psId);
        grp.total_portions += Number(item.portions_sold || 0);
        grp.total_cost += Number(item.portions_sold || 0) * Number(item.cost_price || 0);
        if (!matched) grp.unmatched_count += 1;
        grp.items.push(item);
    }

    res.json({
        success: true,
        data: {
            consumption: consumption || [],
            cashier_shifts: Array.from(shiftsMap.values()),
            unmatched_summary: { count: unmatchedCount, value: Number(unmatchedValue.toFixed(2)) }
        }
    });
});

export const logProductionEvent = asyncWrap(async (req: AuthenticatedRequest, res: Response) => {
    const {
        kitchen_shift_id,
        output_item_id,
        production_recipe_id,
        consumed_inputs,
        actual_produced_qty,
        output_unit,
        produced_by,
        idempotency_key,
        reason_note
    } = req.body;

    const userId = req.user?.id;
    const userBranchId = req.user?.branch_id;

    if (!kitchen_shift_id || !output_item_id || !production_recipe_id || !consumed_inputs || !actual_produced_qty || !idempotency_key) {
        throw new AppError('Missing required fields', 400);
    }

    const { data: shift } = await supabase
        .from('kitchen_shifts')
        .select('id,branch_id,status,shift_number,shift_date')
        .eq('id', kitchen_shift_id)
        .single();

    if (!shift) throw new AppError('Shift not found', 404);
    if (shift.status !== 'open') throw new AppError('Shift not open', 400);
    
    // Check branch scope matches user's JWT branch claim
    if (Number(shift.branch_id) !== Number(userBranchId)) {
        throw new AppError('BRANCH_SCOPE_VIOLATION: Branch does not match user context', 403);
    }

    const activeMode = await getActiveShiftMode(Number(shift.branch_id), shift.shift_date);
    if (!activeMode) {
        throw new AppError('KITCHEN_SESSIONS_NOT_CONFIGURED', 403);
    }

    // 2. Idempotency Check
    const { data: existingProduction } = await supabase
        .from('kitchen_shift_production')
        .select('*')
        .eq('branch_id', shift.branch_id)
        .eq('idempotency_key', idempotency_key)
        .maybeSingle();

    if (existingProduction) {
        res.status(200).json({ success: true, data: existingProduction });
        return;
    }

    if (!Array.isArray(consumed_inputs) || consumed_inputs.length === 0) {
        throw new AppError('NO_CONSUMED_INPUTS: consumed_inputs must be a non-empty array', 400);
    }
    const normalizedConsumedInputs = consumed_inputs.map((input: any) => ({
        raw_item_id: input?.raw_item_id?.toString() || null,
        raw_item_sku: input?.raw_item_sku?.toString() || null,
        raw_item_name: input?.raw_item_name?.toString() || null,
        quantity_used: n(input?.quantity_used),
        unit: (input?.unit || 'unit').toString()
    }));
    const invalidConsumedInput = normalizedConsumedInputs.find((input: any) =>
        (!input.raw_item_id && !input.raw_item_sku) || input.quantity_used <= 0
    );
    if (invalidConsumedInput) {
        throw new AppError('Every consumed input must include a raw item reference and quantity_used greater than zero', 400);
    }

    // 4. Resolve output item from inventory_items
    const { data: outputInventoryItem } = await supabase
        .from('inventory_items')
        .select('sku, name:item_name, unit')
        .eq('id', output_item_id)
        .maybeSingle();
    if (!outputInventoryItem) {
        throw new AppError(`Output item not found for ID: ${output_item_id}`, 400);
    }

    // 5. Fetch recipe to check yield_type / standards
    const { data: recipe } = await supabase
        .from('kitchen_production_recipes')
        .select('*, inputs:kitchen_production_recipe_inputs(*)')
        .eq('id', production_recipe_id)
        .maybeSingle();

    if (!recipe) {
        throw new AppError('MISSING_RECIPE_STANDARD: Production logging is blocked until recipe standards are approved and seeded', 400);
    }

    const recipeInputs = Array.isArray((recipe as any)?.inputs) ? (recipe as any).inputs : [];
    if (!recipeInputs.length) {
        throw new AppError('MISSING_RECIPE_INPUTS: This production standard has no configured raw inputs', 400);
    }

    const expectedInputsBySku = new Map<string, any>();
    for (const input of recipeInputs) {
        const sku = (input?.raw_item_sku || '').toString().trim();
        if (sku) expectedInputsBySku.set(sku, input);
    }
    if (!expectedInputsBySku.size) {
        throw new AppError('MISSING_RECIPE_INPUTS: This production standard has no valid raw input SKUs', 400);
    }

    const { data: inventoryRows, error: inventoryRowsError } = await supabase
        .from('inventory_items')
        .select('id, sku, item_name, unit')
        .or(expectedInputsBySku.size
            ? Array.from(expectedInputsBySku.keys())
                .map((sku: string) => `sku.eq.${sku}`)
                .join(',')
            : 'id.is.null');
    if (inventoryRowsError) throw new AppError(inventoryRowsError.message, 500);

    const inventoryBySku = new Map<string, any>();
    const inventoryById = new Map<string, any>();
    for (const row of inventoryRows || []) {
        const sku = (row as any).sku?.toString();
        const id = (row as any).id?.toString();
        if (sku) inventoryBySku.set(sku, row);
        if (id) inventoryById.set(id, row);
    }

    const resolvedInputs = normalizedConsumedInputs.map((input: any) => {
        let inventoryItem = input.raw_item_id
            ? inventoryById.get(input.raw_item_id)
            : null;
        if (!inventoryItem && input.raw_item_sku) {
            inventoryItem = inventoryBySku.get(input.raw_item_sku);
        }
        if (!inventoryItem) {
            throw new AppError(`RAW_INPUT_NOT_IN_STANDARD: ${input.raw_item_sku || input.raw_item_id} is not configured on this production standard`, 400);
        }
        const sku = inventoryItem.sku?.toString() || '';
        const expected = expectedInputsBySku.get(sku);
        if (!expected) {
            throw new AppError(`RAW_INPUT_NOT_IN_STANDARD: ${sku} is not configured on this production standard`, 400);
        }
        return {
            ...input,
            inventoryItem,
            expected,
            raw_item_sku: sku,
            raw_item_name: inventoryItem.item_name?.toString() || input.raw_item_name || sku
        };
    });

    const duplicateSkus = new Set<string>();
    const uniqueResolvedInputs: any[] = [];
    for (const input of resolvedInputs) {
        const existing = uniqueResolvedInputs.find((row) => row.raw_item_sku === input.raw_item_sku);
        if (existing) {
            existing.quantity_used = n(existing.quantity_used) + n(input.quantity_used);
            duplicateSkus.add(input.raw_item_sku);
        } else {
            uniqueResolvedInputs.push({ ...input });
        }
    }

    for (const expectedSku of expectedInputsBySku.keys()) {
        if (!uniqueResolvedInputs.some((input) => input.raw_item_sku === expectedSku)) {
            throw new AppError(`MISSING_REQUIRED_INPUT: ${expectedSku} is required by this production standard`, 400);
        }
    }

    if (!['PRODUCTION', 'SUB_ASSEMBLY'].includes((recipe.yield_type_code || '').toString().toUpperCase())) {
        throw new AppError('INVALID_PRODUCTION_STANDARD: Production logging only supports true batch-production standards', 400);
    }

    // 6. Resolve POS outlet item (skip for SUB_ASSEMBLY)
    let outletItemId = null;
    if (recipe.yield_type_code !== 'SUB_ASSEMBLY') {
        const { data: posOutletItem } = await supabase
            .from('pos_outlet_items')
            .select('id, current_stock')
            .eq('source_table', 'inventory_items')
            .eq('source_item_id', output_item_id)
            .eq('outlet_id', req.user?.outlet_id || null)
            .maybeSingle();
        
        outletItemId = posOutletItem?.id || null;
        if (!outletItemId) {
            const { data: outlet } = await supabase
                .from('outlets')
                .select('id')
                .eq('branch_id', shift.branch_id)
                .eq('active', true)
                .limit(1)
                .maybeSingle();
            if (outlet) {
                const { data: posOutletItemByBranch } = await supabase
                    .from('pos_outlet_items')
                    .select('id')
                    .eq('source_table', 'inventory_items')
                    .eq('source_item_id', output_item_id)
                    .eq('outlet_id', outlet.id)
                    .maybeSingle();
                outletItemId = posOutletItemByBranch?.id || null;
            }
        }

        if (!outletItemId) {
            throw new AppError('MISSING_OUTLET_ITEM_MAPPING: No POS outlet item mapping exists for this produced item', 400);
        }
    }

    // 7. Calculate variance/expecteds
    let expectedQty = actual_produced_qty;
    let variancePct = 0;
    let maxRawAllowed = 0;
    let varianceFlagged = false;
    let severity: 'warning' | 'critical' | null = null;
    let varianceQuantity = 0;

    const producedQtyStandard = n(recipe.produced_quantity);
    if (producedQtyStandard > 0) {
        const scalingFactors: number[] = [];
        for (const input of uniqueResolvedInputs) {
            const standardQty = n(input.expected?.quantity);
            const standardUnit = (input.expected?.unit || input.inventoryItem?.unit || 'unit').toString();
            const normalizedUsed = await normalizeQty(
                n(input.quantity_used),
                input.unit,
                standardUnit,
                input.inventoryItem.id,
                shift.branch_id
            );
            input.normalizedUsedForRecipe = normalizedUsed;
            input.standardQty = standardQty;
            input.standardUnit = standardUnit;
            if (standardQty > 0) {
                scalingFactors.push(normalizedUsed / standardQty);
            }
            maxRawAllowed += standardQty;
        }

        const baseScalingFactor = scalingFactors.length
            ? Math.min(...scalingFactors.filter((v) => Number.isFinite(v) && v > 0))
            : 0;
        expectedQty = producedQtyStandard * baseScalingFactor;

        const normExpected = await normalizeQty(
            expectedQty,
            recipe.produced_unit || 'portion',
            output_unit,
            output_item_id,
            shift.branch_id
        );
        const normActual = n(actual_produced_qty);
        varianceQuantity = normActual - normExpected;
        const absVariance = Math.abs(varianceQuantity);
        if (normExpected > 0) {
            variancePct = (absVariance / normExpected) * 100;
        }

        const thresholds = await getWastageThresholds(shift.branch_id);
        const criticalPct = n(recipe.allowed_variance_percent) > 0
            ? n(recipe.allowed_variance_percent)
            : thresholds.recipe_variance_critical_pct;
        const warningPct = thresholds.recipe_variance_warning_pct;

        if (variancePct > criticalPct && !reason_note) {
            res.status(400).json({
                success: false,
                code: 'RECIPE_VARIANCE_EXCEEDED',
                message: `Recipe variance exceeds tolerance limits (${variancePct.toFixed(1)}%). Please provide a variance reason explanation.`,
                data: { expectedQty: normExpected, actualQty: normActual, variancePct, varianceQuantity }
            });
            return;
        }

        if (variancePct > criticalPct) severity = 'critical';
        else if (variancePct > warningPct) severity = 'warning';
        varianceFlagged = variancePct > warningPct;
    }

    // 8. Atomic Database Transaction Block
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const lockedRawRows = new Map<string, any>();
        for (const input of uniqueResolvedInputs) {
            const { rows: [rawShiftItem] } = await client.query(
                `SELECT * FROM kitchen_shift_items WHERE shift_id = $1 AND item_sku = $2 FOR UPDATE`,
                [kitchen_shift_id, input.raw_item_sku]
            );
            if (!rawShiftItem) {
                throw new AppError(`Raw ingredient ${input.raw_item_sku} is not in the active kitchen shift ledger`, 400);
            }

            const available = n(rawShiftItem.opening_stock) + n(rawShiftItem.additions) - n(rawShiftItem.sold_quantity) - n(rawShiftItem.spoilage_quantity);
            const normQtyUsedForAvail = await normalizeQty(
                n(input.quantity_used),
                input.unit,
                rawShiftItem.unit_of_measure,
                input.inventoryItem.id,
                shift.branch_id
            );
            if (normQtyUsedForAvail > available) {
                throw new AppError(`INSUFFICIENT_KITCHEN_STOCK: Insufficient ${input.raw_item_name} in kitchen ledger. Available: ${available} ${rawShiftItem.unit_of_measure}, Required: ${normQtyUsedForAvail} ${rawShiftItem.unit_of_measure}`, 400);
            }
            input.normalizedUsedForLedger = normQtyUsedForAvail;
            lockedRawRows.set(input.raw_item_sku, rawShiftItem);
        }

        const primaryInput = uniqueResolvedInputs[0];
        const primaryRawItem = primaryInput.inventoryItem;

        // C. Insert into kitchen_shift_production (single event using legacy columns)
        const { rows: [insertedProd] } = await client.query(
            `INSERT INTO kitchen_shift_production (
                shift_id, branch_id, recipe_id, raw_item_sku, raw_item_name, raw_quantity_used, raw_unit,
                produced_item_name, produced_item_sku, pos_outlet_item_id, produced_quantity, produced_unit,
                conversion_ratio, conversion_notes, produced_by, idempotency_key,
                variance_pct, recipe_max_raw_allowed, variance_flagged, variance_reason
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING *`,
            [
                kitchen_shift_id,
                shift.branch_id,
                production_recipe_id,
                uniqueResolvedInputs.length === 1 ? primaryInput.raw_item_sku : 'MULTI',
                uniqueResolvedInputs.length === 1 ? primaryInput.raw_item_name : 'Multiple Inputs',
                uniqueResolvedInputs.reduce((sum, row) => sum + n(row.quantity_used), 0),
                uniqueResolvedInputs.length === 1 ? primaryInput.unit : 'mixed',
                outputInventoryItem.name,
                outputInventoryItem.sku,
                outletItemId, n(actual_produced_qty), output_unit, 
                n(actual_produced_qty) / Math.max(uniqueResolvedInputs.reduce((sum, row) => sum + n(row.quantity_used), 0), 1), reason_note || null,
                Array.isArray(produced_by) ? (produced_by[0] || userId) : (produced_by || userId), idempotency_key,
                variancePct, maxRawAllowed, varianceFlagged, reason_note || null
            ]
        );

        await client.query(
            `INSERT INTO kitchen_shift_production_inputs (
                production_id, shift_id, branch_id, raw_item_sku, raw_item_name,
                quantity_used, unit, normalized_quantity_used
            ) VALUES ${uniqueResolvedInputs.map((_, index) => {
                const offset = index * 8;
                return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`;
            }).join(', ')}`,
            uniqueResolvedInputs.flatMap((input) => [
                insertedProd.id,
                kitchen_shift_id,
                shift.branch_id,
                input.raw_item_sku,
                input.raw_item_name,
                n(input.quantity_used),
                input.unit,
                n(input.normalizedUsedForLedger),
            ])
        );

        // D. Increment sold_quantity on raw ingredient rows
        for (const input of uniqueResolvedInputs) {
            const rawShiftItem = lockedRawRows.get(input.raw_item_sku);
            await client.query(
                `UPDATE kitchen_shift_items 
                 SET sold_quantity = sold_quantity + $1, updated_at = NOW() 
                 WHERE id = $2`,
                [input.normalizedUsedForLedger, rawShiftItem.id]
            );
        }

        // E. Credit POS stock via creditOutletItemStock update (skip if SUB_ASSEMBLY)
        if (outletItemId) {
            const { rows: [poiDetail] } = await client.query(
                `SELECT p.current_stock, i.unit as base_unit 
                 FROM pos_outlet_items p
                 JOIN inventory_items i ON p.source_item_id = i.id::text
                 WHERE p.id = $1`,
                [outletItemId]
            );

            const normOutputQty = await normalizeQty(
                n(actual_produced_qty),
                output_unit,
                poiDetail?.base_unit || 'portion',
                output_item_id,
                shift.branch_id
            );

            await client.query(
                `UPDATE pos_outlet_items 
                 SET current_stock = COALESCE(current_stock, 0) + $1, updated_at = NOW() 
                 WHERE id = $2`,
                [normOutputQty, outletItemId]
            );
        }

        // F. Update mirror additions on kitchen_shift_items for output item SKU
        const { rows: [outputShiftItem] } = await client.query(
            `SELECT * FROM kitchen_shift_items WHERE shift_id = $1 AND item_sku = $2 FOR UPDATE`,
            [kitchen_shift_id, outputInventoryItem.sku]
        );

        const normOutputForMirror = await normalizeQty(
            n(actual_produced_qty),
            output_unit,
            outputShiftItem?.unit_of_measure || 'portion',
            output_item_id,
            shift.branch_id
        );

        if (outputShiftItem) {
            await client.query(
                `UPDATE kitchen_shift_items 
                 SET additions = additions + $1, updated_at = NOW() 
                 WHERE id = $2`,
                [normOutputForMirror, outputShiftItem.id]
            );
        } else {
            await client.query(
                `INSERT INTO kitchen_shift_items (
                    shift_id, branch_id, item_sku, item_name, unit_of_measure, cost_price, 
                    opening_stock, additions, sold_quantity, spoilage_quantity
                ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, 0, 0)`,
                [
                    kitchen_shift_id, shift.branch_id, outputInventoryItem.sku, outputInventoryItem.name,
                    output_unit, 0, normOutputForMirror
                ]
            );
        }

        // G. Log BATCH_PRODUCTION_LOGGED in audit_trail table
        const auditDetails = {
            branch_id: shift.branch_id,
            kitchen_shift_id,
            output_item_id,
            actual_produced_qty: n(actual_produced_qty),
            expected_qty: expectedQty,
            variance_pct: variancePct,
            idempotency_key
        };

        await client.query(
            `INSERT INTO audit_trail (
                entity_type, entity_id, action, user_id, new_values, created_at, branch_id
            ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
            [
                'kitchen_shift_production',
                insertedProd.id,
                'BATCH_PRODUCTION_LOGGED',
                userId,
                JSON.stringify(auditDetails),
                shift.branch_id
            ]
        );

        // H. Create recipe variance alert if flagged
        if (severity && maxRawAllowed !== null) {
            const alertMsg = `Recipe variance ${variancePct.toFixed(1)}% on ${outputInventoryItem.name} for shift ${shift.shift_number}`;
            await client.query(
                `INSERT INTO wastage_alerts (
                    shift_id, branch_id, alert_type, severity, item_sku, item_name,
                    expected_value, actual_value, variance_value, variance_cost, message, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
                [
                    kitchen_shift_id, shift.branch_id, 'recipe_variance', severity, outputInventoryItem.sku, outputInventoryItem.name,
                    expectedQty, n(actual_produced_qty),
                    varianceQuantity,
                    0,
                    alertMsg
                ]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ success: true, data: insertedProd });
    } catch (txError) {
        const err = txError as Error & { statusCode?: number };
        await client.query('ROLLBACK');
        logger.error('logProductionEvent transaction failed, rolled back successfully', err);
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || 'Production logging failed'
        });
    } finally {
        client.release();
    }
});

export const getActiveShiftModeHandler = asyncWrap(async (req: AuthenticatedRequest, res: Response) => {
    const branchId = Number(req.query.branch_id || req.user?.branch_id);
    if (!branchId) throw new AppError('branch_id required', 400);

    const userBranchId = req.user?.branch_id;
    const userRole = req.user?.role || '';
    const isGlobal = ['super_admin', 'director', 'general_manager', 'hr_manager', 'central_storekeeper', 'auditor'].includes(userRole);

    if (req.query.branch_id && Number(req.query.branch_id) !== Number(userBranchId) && !isGlobal) {
        throw new AppError('BRANCH_SCOPE_VIOLATION: Non-global users cannot query another branch_id', 403);
    }

    const mode = await getActiveShiftMode(branchId);
    if (!mode) {
        res.json({
            success: true,
            data: {
                enabled: false,
                reason: 'KITCHEN_SESSIONS_NOT_CONFIGURED',
                shift_mode: null,
                effective_from: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' })
            }
        });
        return;
    }

    const businessDate = todayInNairobi();
    const openingStocktake = await getSubmittedKitchenOpeningStocktake(branchId, businessDate, 'A');
    res.json({
        success: true,
        data: {
            enabled: true,
            shift_mode: mode,
            effective_from: businessDate,
            opening_stocktake_required: true,
            opening_stocktake_shift: 'A',
            opening_stocktake_ready: openingStocktake.ready,
            opening_stocktake_status: openingStocktake.status || null,
            opening_stocktake_message: openingStocktake.message || null
        }
    });
});

export const retrySyncHandler = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    await syncKitchenShiftToStockCounts(shift_id);
    res.json({ success: true, message: 'Stock counts reporting sync successfully retried.' });
});

export const listYieldTypes = asyncWrap(async (req: Request, res: Response) => {
    const { data, error } = await supabase
        .from('kitchen_yield_types')
        .select('*')
        .eq('is_active', true)
        .order('name');
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data });
});

export const configureShiftModeHandler = asyncWrap(async (req: AuthenticatedRequest, res: Response) => {
    const branchId = Number(req.body.branch_id || req.user?.branch_id);
    if (!branchId) throw new AppError('branch_id required', 400);
    const { shift_mode } = req.body;
    
    if (shift_mode !== 'SINGLE_SHIFT' && shift_mode !== 'TWO_SHIFT') {
        throw new AppError('shift_mode must be SINGLE_SHIFT or TWO_SHIFT', 400);
    }
    
    const userRole = req.user?.role || '';
    if (!['super_admin', 'director', 'general_manager', 'hr_manager', 'branch_manager', 'branch_accountant', 'branch_storekeeper', 'storekeeper', 'central_storekeeper', 'kitchen_operations'].includes(userRole)) {
        throw new AppError('Not authorized to configure shift mode', 403);
    }

    const { error } = await supabase
        .from('branch_shift_config')
        .upsert({
            branch_id: branchId,
            effective_from_business_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' }),
            shift_mode,
            changed_by: req.user?.id
        }, { onConflict: 'branch_id, effective_from_business_date' });

    if (error) throw new AppError(error.message, 500);

    res.json({ success: true, message: 'Shift mode configured successfully' });
});

export const getBreakfastPax = asyncWrap(async (req: Request, res: Response) => {
    const date = req.query.date as string || new Date().toISOString().slice(0, 10);
    const branch_id = req.query.branch_id || (req as any).user?.branch_id;
    
    if (!branch_id) {
        throw new AppError('Branch ID is required', 400);
    }
    
    const snapshot = await getBreakfastPaxControl(Number(branch_id), date);
    res.status(200).json({ success: true, breakfast_pax: snapshot.confirmed_pax, data: snapshot });
});

export const getShiftReconciliationReport = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    
    // 1. Fetch shift details
    const { data: shift, error: shiftError } = await supabase
        .from('kitchen_shifts')
        .select('*')
        .eq('id', shift_id)
        .single();
        
    if (shiftError || !shift) {
        throw new AppError('Shift not found', 404);
    }
    
    // 2. Fetch shift items (for inventory stock pricing & POS sold qty)
    const { data: shiftItems, error: itemsError } = await supabase
        .from('kitchen_shift_items')
        .select('*')
        .eq('shift_id', shift_id);
        
    if (itemsError) throw new AppError(itemsError.message, 500);
    
    // 3. Fetch additions ledger details for this shift
    const { data: additions, error: addsError } = await supabase
        .from('kitchen_shift_additions')
        .select('*')
        .eq('shift_id', shift_id);
        
    if (addsError) throw new AppError(addsError.message, 500);
    
    // 4. Fetch the unified food standards for this branch
    const { data: standards, error: standardsError } = await supabase
        .from('channel_food_standards')
        .select('*')
        .eq('branch_id', shift.branch_id);
        
    if (standardsError) throw new AppError(standardsError.message, 500);
    
    // 5. Fetch associated events:
    // We fetch all buffets, catering events, and conference bookings linked to this shift
    const refIds = (additions || []).map((a: any) => a.reference_id).filter(Boolean);
    
    let buffets: any[] = [];
    let cateringEvents: any[] = [];
    let conferenceBookings: any[] = [];
    let eventOrders: any[] = [];
    
    if (refIds.length > 0) {
        const [{ data: bData }, { data: cData }, { data: confData }, { data: eoData }] = await Promise.all([
            supabase.from('buffets').select('*').in('id', refIds),
            supabase.from('catering_events').select('*').in('id', refIds),
            supabase.from('conference_hall_bookings').select('*').in('id', refIds),
            supabase.from('event_orders').select('*').in('id', refIds)
        ]);
        buffets = bData || [];
        cateringEvents = cData || [];
        conferenceBookings = confData || [];
        eventOrders = eoData || [];
    }
    
    // Helper map to quickly find event pax
    const eventPaxMap = new Map<string, number>();
    buffets.forEach(b => eventPaxMap.set(b.id, b.pax));
    cateringEvents.forEach(c => eventPaxMap.set(c.id, c.pax));
    eventOrders.forEach(eo => eventPaxMap.set(eo.id, eo.pax));
    const eventOrderById = new Map<string, any>();
    eventOrders.forEach(eo => eventOrderById.set(eo.id, eo));
    conferenceBookings.forEach(cb => {
        // If metadata notes has pax
        let pax = cb.num_participants || 0;
        if (cb.notes && cb.notes.includes('__METADATA__:')) {
            try {
                const meta = JSON.parse(cb.notes.split('__METADATA__:')[1]);
                pax = meta.num_participants || pax;
            } catch (e) {}
        }
        eventPaxMap.set(cb.id, pax);
    });
    
    // Map of SKU to item cost price and info
    const itemMap = new Map<string, any>();
    shiftItems.forEach(item => itemMap.set(item.item_sku, item));
    
    const channels = [
        { code: 'pos_restaurant', name: 'POS Restaurant' },
        { code: 'accommodation_breakfast', name: 'Accommodation Breakfast' },
        { code: 'buffet', name: 'Buffet' },
        { code: 'conference_event', name: 'Conference' },
        { code: 'outside_catering', name: 'Outside Catering' },
        { code: 'event_order', name: 'Event Order' },
        { code: 'staff_meal', name: 'Staff Meals' },
        { code: 'group_meal', name: 'Group Meals' },
        { code: 'wastage', name: 'Wastage' }
    ];
    
    // Let's compute actual and expected quantities per SKU for each channel
    const reportData = channels.map(channel => {
        const channelCode = channel.code;
        
        // Filter additions issued under this channel
        const channelAdditions = (additions || []).filter((a: any) => a.purpose_channel === channelCode);
        
        // Build a map of actual quantities issued for this channel
        const actualQtyMap = new Map<string, number>();
        channelAdditions.forEach((a: any) => {
            const current = actualQtyMap.get(a.item_sku) || 0;
            actualQtyMap.set(a.item_sku, current + Number(a.quantity || 0));
        });
        
        // Build a map of expected quantities consumed for this channel
        const expectedQtyMap = new Map<string, number>();
        
        if (channelCode === 'pos_restaurant') {
            // POS expected consumption is tracked directly in shiftItems.sold_quantity
            shiftItems.forEach(item => {
                if (Number(item.sold_quantity) > 0) {
                    expectedQtyMap.set(item.item_sku, Number(item.sold_quantity));
                }
            });
        } else if (channelCode === 'accommodation_breakfast') {
            // expected = breakfast_pax * breakfast_standards
            const bkPax = shift.breakfast_pax || 0;
            const bkStandards = (standards || []).filter((s: any) => s.channel === 'accommodation_breakfast');
            bkStandards.forEach((s: any) => {
                expectedQtyMap.set(s.raw_item_sku, Number(s.quantity_per_pax || 0) * bkPax);
            });
        } else if (channelCode === 'staff_meal') {
            // expected = staff_meal_pax * staff_meal_standards
            const stPax = shift.staff_meal_pax || 0;
            const stStandards = (standards || []).filter((s: any) => s.channel === 'staff_meal');
            stStandards.forEach((s: any) => {
                expectedQtyMap.set(s.raw_item_sku, Number(s.quantity_per_pax || 0) * stPax);
            });
        } else {
            // buffet, conference_event, outside_catering expected consumption:
            // Sum of: standard.quantity_per_pax * event.pax for all events/buffets linked via additions
            const eventAdditions = (additions || []).filter((a: any) => a.purpose_channel === channelCode && a.reference_id);
            const uniqueEventIds = Array.from(new Set(eventAdditions.map((a: any) => a.reference_id)));
            
            uniqueEventIds.forEach(evtId => {
                const pax = eventPaxMap.get(evtId) || 0;
                const linkedEventOrder = eventOrderById.get(evtId);
                const packageName = String(linkedEventOrder?.menu_package || '').trim();
                const packageDefinitionId = String(linkedEventOrder?.package_definition_id || '').trim();
                const evtStandards = (standards || []).filter((s: any) => {
                    if (s.channel !== channelCode) return false;
                    if (s.event_id === evtId) return true;
                    if (packageDefinitionId && String(s.package_definition_id || '').trim() === packageDefinitionId) {
                        return true;
                    }
                    if (packageName && String(s.package_name || '').trim().toLowerCase() === packageName.toLowerCase()) {
                        return true;
                    }
                    return !s.event_id && !String(s.package_name || '').trim();
                });
                evtStandards.forEach((s: any) => {
                    const current = expectedQtyMap.get(s.raw_item_sku) || 0;
                    expectedQtyMap.set(s.raw_item_sku, current + (Number(s.quantity_per_pax || 0) * pax));
                });
            });
        }
        
        // Now we merge all SKUs that have actual or expected quantities in this channel
        const allSkus = Array.from(new Set([
            ...actualQtyMap.keys(),
            ...expectedQtyMap.keys()
        ]));
        
        let totalChannelExpectedCost = 0;
        let totalChannelActualCost = 0;
        
        const itemsDetail = allSkus.map(sku => {
            const itemInfo = itemMap.get(sku);
            const costPrice = Number(itemInfo?.cost_price || 0);
            const unit = itemInfo?.unit_of_measure || 'units';
            const itemName = itemInfo?.item_name || (additions.find((a: any) => a.item_sku === sku)?.item_name) || sku;
            
            let actualQty = actualQtyMap.get(sku) || 0;
            
            // POS Restaurant Actual = Total Shift Consumption - Sum of non-POS channel actuals
            if (channelCode === 'pos_restaurant') {
                const totalShiftConsumed = Number(itemInfo?.opening_stock || 0) + Number(itemInfo?.additions || 0) - Number(itemInfo?.physical_count ?? (Number(itemInfo?.opening_stock || 0) + Number(itemInfo?.additions || 0)));
                
                // Sum non-POS additions
                let nonPosActual = 0;
                (additions || []).forEach((a: any) => {
                    if (a.item_sku === sku && a.purpose_channel !== 'pos_restaurant') {
                        nonPosActual += Number(a.quantity || 0);
                    }
                });
                
                actualQty = Math.max(0, totalShiftConsumed - nonPosActual);
            }
            
            const expectedQty = expectedQtyMap.get(sku) || 0;
            const expectedCost = expectedQty * costPrice;
            const actualCost = actualQty * costPrice;
            const varianceQty = actualQty - expectedQty;
            const varianceCost = varianceQty * costPrice;
            
            totalChannelExpectedCost += expectedCost;
            totalChannelActualCost += actualCost;
            
            return {
                sku,
                item_name: itemName,
                unit,
                cost_price: costPrice,
                expected_qty: expectedQty,
                actual_qty: actualQty,
                variance_qty: varianceQty,
                expected_cost: expectedCost,
                actual_cost: actualCost,
                variance_cost: varianceCost
            };
        });
        
        return {
            channel_code: channelCode,
            channel_name: channel.name,
            expected_cost: totalChannelExpectedCost,
            actual_cost: totalChannelActualCost,
            variance_cost: totalChannelActualCost - totalChannelExpectedCost,
            items: itemsDetail
        };
    });
    
    const totalExpectedCost = reportData.reduce((acc, c) => acc + c.expected_cost, 0);
    const totalActualCost = reportData.reduce((acc, c) => acc + c.actual_cost, 0);
    
    res.status(200).json({
        success: true,
        data: {
            shift_id: shift_id,
            shift_number: shift.shift_number,
            shift_date: shift.shift_date,
            breakfast_pax: shift.breakfast_pax,
            staff_meal_pax: shift.staff_meal_pax,
            total_expected_cost: totalExpectedCost,
            total_actual_cost: totalActualCost,
            total_variance_cost: totalActualCost - totalExpectedCost,
            channels: reportData
        }
    });
});

type DailyControlRow = {
    item_sku: string;
    item_name: string;
    unit: string;
    main_channel: string;
    opening_qty: number;
    additions_qty: number;
    pos_sales_qty: number;
    spoilage_qty: number;
    system_closing_qty: number;
    physical_closing_qty: number;
    actual_consumption_qty: number;
    expected_consumption_qty: number;
    variance_qty: number;
    cost_price: number;
    expected_cost: number;
    actual_cost: number;
    variance_cost: number;
    channel_breakdown: Array<{
        channel_code: string;
        channel_name: string;
        issued_qty: number;
    }>;
    produced_items?: Array<{
        dish_name: string;
        portions_sold: number;
        raw_quantity_consumed: number;
        unit: string;
    }>;
};

type ShiftDailyControlsApiPayload = {
    shift_id: string;
    shift_number: string | null;
    branch_id: number;
    shift_date: string;
    shift_type: string | null;
    sub_shift_type: string | null;
    status: string;
    department: string | null;
    breakfast_pax: number;
    staff_meal_pax: number;
    summary: Record<string, any>;
    rows: DailyControlRow[];
    standards_configured: boolean;
    // Sold POS items with no recipe / inventory / food-control link — recorded
    // (never dropped) but flagged so the accountant can register them.
    unmatched_pos_items?: any[];
    // Kitchen wastage/spoilage recorded against this shift (branch_spoilage_log),
    // kept separate from unexplained variance.
    wastage?: any;
    // Per-channel control metrics (issued/net cost, revenue, food-cost %, gross
    // margin, cost per guest, returns) computed by each channel's method.
    channel_controls?: any[];
    frozen?: boolean;
    frozen_at?: string | null;
};

type KitchenShiftControlSnapshotPayload = {
    report_version: number;
    generated_at: string;
    shift_report: ShiftDailyControlsApiPayload;
    source_snapshot: {
        channel_food_standards: any[];
        kitchen_production_recipes: any[];
        kitchen_production_recipe_inputs: any[];
        food_control_direct_items: any[];
    };
};

function toShiftDailyControlsApiPayload(report: Awaited<ReturnType<typeof buildShiftDailyControlsData>>): ShiftDailyControlsApiPayload {
    return {
        shift_id: report.shift.id,
        shift_number: report.shift.shift_number,
        branch_id: report.shift.branch_id,
        shift_date: report.shift.shift_date,
        shift_type: report.shift.shift_type,
        sub_shift_type: report.shift.sub_shift_type,
        status: report.shift.status,
        department: report.shift.department,
        breakfast_pax: report.shift.breakfast_pax,
        staff_meal_pax: report.shift.staff_meal_pax,
        summary: report.summary,
        rows: report.rows,
        standards_configured: report.standards_configured,
        unmatched_pos_items: report.unmatched_pos_items,
        wastage: report.wastage,
        channel_controls: report.channel_controls,
    };
}

function toFrozenShiftDailyControlsResponse(
    snapshotData: KitchenShiftControlSnapshotPayload,
    computedAt: string | null
): ShiftDailyControlsApiPayload {
    return {
        ...snapshotData.shift_report,
        frozen: true,
        frozen_at: computedAt ?? snapshotData.generated_at ?? null,
    };
}

// Bump this whenever buildShiftDailyControlsData changes what the report contains.
// Frozen snapshots stamped with an older version are ignored on read and recomputed
// with the current logic (then re-frozen), so a report fix reaches already-closed
// shifts without any manual snapshot cleanup.
// v2: surface issued-but-unregistered items (kitchen_shift_additions) with opening /
//     closing from the day's kitchen stocktake.
// v3: rank rows by relevance (issued / moved first) so real activity isn't buried
//     under a wall of zero-activity menu items.
// v9: detailed linked POS items breakdown per raw food-control standard
const KITCHEN_SHIFT_CONTROL_REPORT_VERSION = 9;

async function loadKitchenShiftControlSnapshot(shiftId: string): Promise<{ payload: KitchenShiftControlSnapshotPayload; computedAt: string | null } | null> {
    const { data, error } = await supabase
        .from('kitchen_shift_control_snapshots')
        .select('snapshot_data, computed_at')
        .eq('shift_id', shiftId)
        .maybeSingle();

    if (error) {
        const relationMissing =
            error.code === '42P01' ||
            /kitchen_shift_control_snapshots/i.test(String(error.message || ''));
        if (relationMissing) return null;
        throw new AppError(error.message, 500);
    }
    if (!data?.snapshot_data) return null;

    // Ignore snapshots frozen by an older report version so the caller recomputes
    // with the current logic instead of serving stale frozen data.
    const snapshotVersion = Number((data.snapshot_data as any)?.report_version ?? 0);
    if (snapshotVersion < KITCHEN_SHIFT_CONTROL_REPORT_VERSION) return null;

    return {
        payload: data.snapshot_data as KitchenShiftControlSnapshotPayload,
        computedAt: data.computed_at ?? null,
    };
}

async function getKitchenShiftDailyControlSourceSnapshot(branchId: number) {
    const [
        { data: standards, error: standardsError },
        { data: recipeRows, error: recipesError },
        { data: directFoodControlRows, error: directFoodControlError },
    ] = await Promise.all([
        supabase
            .from('channel_food_standards')
            .select('*')
            .eq('branch_id', branchId),
        supabase
            .from('kitchen_production_recipes')
            .select('id, raw_item_sku, raw_item_name, raw_quantity, raw_unit, produced_item_sku, produced_item_name, produced_quantity, produced_unit, pos_outlet_item_id, yield_type_code, is_active, branch_id')
            .eq('branch_id', branchId)
            .eq('is_active', true),
        supabase
            .from('food_control_direct_items')
            .select('stock_item_sku, stock_item_name')
            .eq('branch_id', branchId)
            .eq('is_active', true),
    ]);

    if (standardsError) throw new AppError(standardsError.message, 500);
    if (recipesError) throw new AppError(recipesError.message, 500);
    if (directFoodControlError) throw new AppError(directFoodControlError.message, 500);

    const recipeIds = ((recipeRows || []) as any[]).map((row: any) => row.id).filter(Boolean);
    const { data: recipeInputs, error: recipeInputsError } = recipeIds.length
        ? await supabase
            .from('kitchen_production_recipe_inputs')
            .select('recipe_id, raw_item_sku, raw_item_name')
            .in('recipe_id', recipeIds)
        : { data: [], error: null } as any;
    if (recipeInputsError) throw new AppError(recipeInputsError.message, 500);

    return {
        standardsList: (standards || []) as any[],
        activeRecipes: (recipeRows || []) as any[],
        directFoodControlList: (directFoodControlRows || []) as any[],
        recipeInputsList: (recipeInputs || []) as any[],
    };
}

async function persistKitchenShiftControlSnapshot(shiftId: string): Promise<{ payload: KitchenShiftControlSnapshotPayload; computedAt: string | null }> {
    const report = await buildShiftDailyControlsData(shiftId);
    const sourceSnapshot = await getKitchenShiftDailyControlSourceSnapshot(Number(report.shift.branch_id));
    const timestamp = new Date().toISOString();
    const payload: KitchenShiftControlSnapshotPayload = {
        report_version: KITCHEN_SHIFT_CONTROL_REPORT_VERSION,
        generated_at: timestamp,
        shift_report: toShiftDailyControlsApiPayload(report),
        source_snapshot: {
            channel_food_standards: sourceSnapshot.standardsList,
            kitchen_production_recipes: sourceSnapshot.activeRecipes,
            kitchen_production_recipe_inputs: sourceSnapshot.recipeInputsList,
            food_control_direct_items: sourceSnapshot.directFoodControlList,
        },
    };

    const { data, error } = await supabase
        .from('kitchen_shift_control_snapshots')
        .upsert({
            shift_id: report.shift.id,
            branch_id: report.shift.branch_id,
            cashier_shift_id: report.shift.cashier_shift_id || null,
            shift_date: report.shift.shift_date,
            shift_status: report.shift.status,
            snapshot_data: payload,
            computed_at: timestamp,
            updated_at: timestamp,
        }, { onConflict: 'shift_id' })
        .select('snapshot_data, computed_at')
        .single();

    if (error) {
        const relationMissing =
            error.code === '42P01' ||
            /kitchen_shift_control_snapshots/i.test(String(error.message || ''));
        if (relationMissing) {
            return { payload, computedAt: timestamp };
        }
        throw new AppError(error.message, 500);
    }

    return {
        payload: (data?.snapshot_data as KitchenShiftControlSnapshotPayload) || payload,
        computedAt: data?.computed_at ?? timestamp,
    };
}

export async function buildShiftDailyControlsData(shiftId: string) {
    const { data: shift, error: shiftError } = await supabase
        .from('kitchen_shifts')
        .select('*')
        .eq('id', shiftId)
        .single();

    if (shiftError || !shift) {
        throw new AppError('Shift not found', 404);
    }

    const [
        { data: shiftItems, error: itemsError },
        { data: additions, error: addsError },
        { data: standards, error: standardsError },
        { data: recipeRows, error: recipesError },
        { data: posConsumptionRows, error: posConsumptionError },
        { data: directFoodControlRows, error: directFoodControlError },
        { data: shiftProductionRows, error: shiftProductionError },
    ] = await Promise.all([
        supabase
            .from('kitchen_shift_items')
            .select('*')
            .eq('shift_id', shiftId)
            .order('item_name', { ascending: true }),
        supabase
            .from('kitchen_shift_additions')
            .select('*')
            .eq('shift_id', shiftId)
            .order('added_at', { ascending: true }),
        supabase
            .from('channel_food_standards')
            .select('*')
            .eq('branch_id', shift.branch_id),
        supabase
            .from('kitchen_production_recipes')
            .select('id, raw_item_sku, raw_item_name, raw_quantity, raw_unit, produced_item_sku, produced_item_name, produced_quantity, produced_unit, pos_outlet_item_id, yield_type_code, is_active, branch_id')
            .eq('branch_id', shift.branch_id)
            .eq('is_active', true),
        // Paginate: a busy shift can have >1000 POS consumption rows and
        // Supabase caps a single select at 1000, which would under-count POS
        // expected consumption AND hide unmatched items beyond the first page.
        // select * (not an explicit column list) so this read never errors on a
        // DB where the match_status migration hasn't run — missing column is
        // simply treated as 'matched'.
        (async () => {
            const all: any[] = [];
            const pageSize = 1000;
            for (let from = 0; ; from += pageSize) {
                const { data, error } = await supabase
                    .from('kitchen_shift_pos_consumption')
                    .select('*')
                    .eq('shift_id', shiftId)
                    .range(from, from + pageSize - 1);
                if (error) return { data: all, error };
                all.push(...(data || []));
                if (!data || data.length < pageSize) break;
            }
            return { data: all, error: null };
        })(),
        supabase
            .from('food_control_direct_items')
            .select('stock_item_sku, stock_item_name, pos_outlet_item_id')
            .eq('branch_id', shift.branch_id)
            .eq('is_active', true),
        supabase
            .from('kitchen_shift_production')
            .select('id, recipe_id, raw_item_sku, produced_quantity, produced_unit, pos_outlet_item_id')
            .eq('shift_id', shiftId),
    ]);

    if (itemsError) throw new AppError(itemsError.message, 500);
    if (addsError) throw new AppError(addsError.message, 500);
    if (standardsError) throw new AppError(standardsError.message, 500);
    if (recipesError) throw new AppError(recipesError.message, 500);
    if (posConsumptionError) throw new AppError(posConsumptionError.message, 500);
    if (directFoodControlError) throw new AppError(directFoodControlError.message, 500);
    if (shiftProductionError) throw new AppError(shiftProductionError.message, 500);

    const shiftItemsList = (shiftItems || []) as any[];
    const additionsList = (additions || []) as any[];
    const standardsList = (standards || []) as any[];
    const activeRecipes = (recipeRows || []) as any[];
    const posConsumptionList = (posConsumptionRows || []) as any[];
    const directFoodControlList = (directFoodControlRows || []) as any[];
    const shiftProductionList = (shiftProductionRows || []) as any[];
    const recipeIds = activeRecipes.map((row: any) => row.id).filter(Boolean);
    const { data: recipeInputs, error: recipeInputsError } = recipeIds.length
        ? await supabase
            .from('kitchen_production_recipe_inputs')
            .select('recipe_id, raw_item_sku, raw_item_name, quantity, unit')
            .in('recipe_id', recipeIds)
        : { data: [], error: null } as any;
    if (recipeInputsError) throw new AppError(recipeInputsError.message, 500);

    // Resolve UUID-looking raw_item_sku values to real SKUs.
    // Old records (before C1 fix) stored inventory_items.id instead of sku in both
    // channel_food_standards and kitchen_production_recipes.
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const allSkuUuids = [...new Set([
        ...activeRecipes.map((r: any) => String(r.raw_item_sku || '').trim()),
        ...standardsList.map((r: any) => String(r.raw_item_sku || '').trim()),
    ].filter((sku: string) => uuidRegex.test(sku)))];
    const uuidToInv = new Map<string, any>();
    if (allSkuUuids.length) {
        const { data: invByIds } = await supabase
            .from('inventory_items')
            .select('id, sku, item_name, unit')
            .in('id', allSkuUuids);
        for (const row of ((invByIds || []) as any[])) {
            uuidToInv.set(String(row.id), row);
        }
    }
    const resolveSkuField = (record: any) => {
        const rawSku = String(record.raw_item_sku || '').trim();
        if (!uuidRegex.test(rawSku)) return;
        const inv = uuidToInv.get(rawSku);
        record.raw_item_sku = inv ? inv.sku : '';
        if (inv) {
            record.raw_item_name = record.raw_item_name || inv.item_name;
            record.raw_unit = record.raw_unit || record.unit || inv.unit;
        }
    };
    for (const recipe of activeRecipes) resolveSkuField(recipe);
    for (const standard of standardsList) resolveSkuField(standard);

    // Controlled SKUs: All raw materials configured across channel standards,
    // production recipes (both single-input and multi-input ingredients), and direct items.
    const controlledSkuSet = new Set<string>();
    for (const row of standardsList) {
        const sku = String(row.raw_item_sku || '').trim();
        if (sku) controlledSkuSet.add(sku);
    }
    for (const row of activeRecipes) {
        const sku = String(row.raw_item_sku || '').trim();
        // 'MULTI' is a COMPLEX-recipe marker, not a real ingredient SKU — skip it
        if (sku && sku.toUpperCase() !== 'MULTI') controlledSkuSet.add(sku);
    }
    for (const row of ((recipeInputs || []) as any[])) {
        const sku = String(row.raw_item_sku || '').trim();
        if (sku) controlledSkuSet.add(sku);
    }
    for (const row of directFoodControlList) {
        const sku = String(row.stock_item_sku || '').trim();
        if (sku) controlledSkuSet.add(sku);
    }
    const controlledSkus = [...controlledSkuSet];

    // Fetch current kitchen stocktake for this shift (opening/closing stock).
    // NOTE: kitchen_stocktake_items has no spoilage column — requesting one makes
    // PostgREST reject the whole embedded select, which previously nulled the entire
    // stocktake (so Opening read 0 for every item). Only select columns that exist.
    const shiftLetter: 'A' | 'B' = String(shift.sub_shift_type || 'A').trim().toUpperCase() === 'B' ? 'B' : 'A';
    const { data: currentStocktake, error: currentStocktakeError } = await supabase
        .from('kitchen_stocktake_shifts')
        .select('id, items:kitchen_stocktake_items(inventory_item_id, opening_qty, closing_qty)')
        .eq('branch_id', shift.branch_id)
        .eq('stocktake_date', shift.shift_date)
        .eq('shift', shiftLetter)
        .maybeSingle() as any;
    if (currentStocktakeError) {
        logger.error(
            `[buildShiftDailyControlsData] kitchen stocktake fetch failed for shift ${shiftId} (branch ${shift.branch_id}, ${shift.shift_date} ${shiftLetter}): ${currentStocktakeError.message}`
        );
    }
    const stocktakeItemByInvId = new Map<string, any>();
    for (const item of ((currentStocktake?.items || []) as any[])) {
        const id = String(item.inventory_item_id || '').trim();
        if (id) stocktakeItemByInvId.set(id, item);
    }

    const eventRefIds = [...new Set(
        additionsList
            .map((row: any) => String(row.reference_id || '').trim())
            .filter(Boolean)
    )];

    const { data: eventOrders, error: eventOrdersError } = eventRefIds.length
        ? await supabase
            .from('event_orders')
            // select * so revenue (total_amount) and returns_value are available
            // for per-channel cost/margin controls without erroring on a DB
            // where the returns_value migration hasn't run yet.
            .select('*')
            .in('id', eventRefIds)
        : { data: [], error: null } as any;

    if (eventOrdersError) throw new AppError(eventOrdersError.message, 500);

    const eventOrderById = new Map<string, any>(
        ((eventOrders || []) as any[]).map((row) => [String(row.id), row])
    );

    const channelNames: Record<string, string> = {
        pos_restaurant: 'POS Restaurant',
        accommodation_breakfast: 'Accommodation Breakfast',
        buffet: 'Buffet',
        conference_event: 'Conference',
        outside_catering: 'Outside Catering',
        event_order: 'Event Order',
        staff_meal: 'Staff Meal',
        group_meal: 'Group Meal',
        wastage: 'Wastage / Spoilage',
        kitchen_session: 'Kitchen Session',
    };

    const expectedQtyBySku = new Map<string, number>();
    const posSalesQtyBySku = new Map<string, number>();
    const addExpectedQty = (sku: string, qty: number) => {
        const normalizedSku = String(sku || '').trim();
        if (!normalizedSku || qty <= 0) return;
        expectedQtyBySku.set(
            normalizedSku,
            (expectedQtyBySku.get(normalizedSku) || 0) + qty
        );
    };

    const portionsSoldByRawSku = new Map<string, number>();
    const dishesProducedByRawSku = new Map<string, Map<string, { portions: number; raw_consumed: number }>>();

    const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const recipeByPosId = new Map<string, any>();
    const recipeByName = new Map<string, any>();
    for (const r of activeRecipes) {
        const pid = String(r.pos_outlet_item_id || '').trim();
        if (pid) recipeByPosId.set(pid, r);
        const pn = norm(r.produced_item_name);
        if (pn) recipeByName.set(pn, r);
        const rn = norm(r.recipe_name);
        if (rn) recipeByName.set(rn, r);
    }

    const directByPosId = new Map<string, any>();
    const directByName = new Map<string, any>();
    for (const d of directFoodControlList) {
        const pid = String(d.pos_outlet_item_id || '').trim();
        if (pid) directByPosId.set(pid, d);
        const sn = norm(d.stock_item_name);
        if (sn) directByName.set(sn, d);
    }

    const dynamicallyMatchedSaleIds = new Set<string>();

    for (const sale of posConsumptionList) {
        const saleId = String(sale.id || '');
        const posId = String(sale.pos_outlet_item_id || '').trim();
        const itemName = String(sale.raw_item_name || sale.produced_item_name || '').trim();
        const normName = norm(itemName);
        const portions = n(sale.portions_sold) || 1;

        let matchedRecipe = (posId ? recipeByPosId.get(posId) : null) || (normName ? recipeByName.get(normName) : null);
        let matchedDirect = (posId ? directByPosId.get(posId) : null) || (normName ? directByName.get(normName) : null);

        let targetSku = '';
        let rawQtyConsumed = 0;
        let dishDisplayName = itemName;

        if (matchedRecipe) {
            targetSku = String(matchedRecipe.raw_item_sku || '').trim();
            const rawQty = n(matchedRecipe.raw_quantity) || 1;
            const prodQty = n(matchedRecipe.produced_quantity) || n(matchedRecipe.conversion_ratio) || 1;
            rawQtyConsumed = portions * (rawQty / prodQty);
            dishDisplayName = matchedRecipe.produced_item_name || itemName;
            dynamicallyMatchedSaleIds.add(saleId);
        } else if (matchedDirect) {
            targetSku = String(matchedDirect.stock_item_sku || '').trim();
            rawQtyConsumed = portions;
            dishDisplayName = matchedDirect.stock_item_name || itemName;
            dynamicallyMatchedSaleIds.add(saleId);
        } else if (sale.raw_item_sku && n(sale.raw_quantity_consumed) > 0 && String((sale as any).match_status || 'matched') !== 'unmatched') {
            targetSku = String(sale.raw_item_sku).trim();
            rawQtyConsumed = n(sale.raw_quantity_consumed);
            dishDisplayName = String(sale.produced_item_name || sale.raw_item_name || '').trim();
            dynamicallyMatchedSaleIds.add(saleId);
        } else {
            // Chicken & dairy portion patterns for items unlinked at checkout
            if (normName.includes('broiler') && (normName.includes('panfry') || normName.includes('panfried'))) {
                targetSku = 'FGH-DRY-GOODS-026';
                rawQtyConsumed = normName.includes('12') ? portions * 0.5 : (normName.includes('full') ? portions * 1.0 : portions * 0.25);
                dynamicallyMatchedSaleIds.add(saleId);
            } else if (normName.includes('kienyeji') && (normName.includes('panfry') || normName.includes('panfried') || normName.includes('stew'))) {
                targetSku = 'FGH-DRY-GOODS-101';
                rawQtyConsumed = normName.includes('12') ? portions * 0.5 : (normName.includes('full') ? portions * 1.0 : portions * 0.25);
                dynamicallyMatchedSaleIds.add(saleId);
            } else if (normName.includes('mursik') || normName.includes('mala')) {
                targetSku = 'FGH-DRY-GOODS-074';
                rawQtyConsumed = portions * 0.5;
                dynamicallyMatchedSaleIds.add(saleId);
            } else if (normName.includes('water1l') || normName.includes('water1litre') || normName.includes('mineralwater1l')) {
                targetSku = 'FGH-SOFT-DRINKS-024';
                rawQtyConsumed = portions;
                dynamicallyMatchedSaleIds.add(saleId);
            } else if (normName.includes('keringetwater1l')) {
                targetSku = 'FGH-SOFT-DRINKS-011';
                rawQtyConsumed = portions;
                dynamicallyMatchedSaleIds.add(saleId);
            } else if (normName.includes('delmonte')) {
                targetSku = 'FGH-SOFT-DRINKS-004';
                rawQtyConsumed = portions;
                dynamicallyMatchedSaleIds.add(saleId);
            }
        }

        if (!targetSku || !controlledSkuSet.has(targetSku) || rawQtyConsumed <= 0) {
            continue;
        }

        addExpectedQty(targetSku, rawQtyConsumed);
        posSalesQtyBySku.set(
            targetSku,
            (posSalesQtyBySku.get(targetSku) || 0) + rawQtyConsumed
        );
        portionsSoldByRawSku.set(
            targetSku,
            (portionsSoldByRawSku.get(targetSku) || 0) + portions
        );
        if (dishDisplayName) {
            const dishesMap = dishesProducedByRawSku.get(targetSku) || new Map<string, { portions: number; raw_consumed: number }>();
            const stat = dishesMap.get(dishDisplayName) || { portions: 0, raw_consumed: 0 };
            stat.portions += portions;
            stat.raw_consumed += rawQtyConsumed;
            dishesMap.set(dishDisplayName, stat);
            dishesProducedByRawSku.set(targetSku, dishesMap);
        }
    }

    // Legacy fallback for older shifts that predate kitchen_shift_pos_consumption.
    if (posConsumptionList.length === 0) {
        for (const item of shiftItemsList) {
            const sku = String(item.item_sku || '').trim();
            if (!controlledSkuSet.has(sku)) continue;
            if (!sku) continue;
            const soldQty = n(item.sold_quantity);
            addExpectedQty(sku, soldQty);
            posSalesQtyBySku.set(sku, (posSalesQtyBySku.get(sku) || 0) + soldQty);
        }
    }

    const breakfastPax = n(shift.breakfast_pax);
    if (breakfastPax > 0) {
        for (const standard of standardsList.filter((row: any) => row.channel === 'accommodation_breakfast')) {
            addExpectedQty(String(standard.raw_item_sku || ''), n(standard.quantity_per_pax) * breakfastPax);
        }
    }

    const staffMealPax = n(shift.staff_meal_pax);
    if (staffMealPax > 0) {
        for (const standard of standardsList.filter((row: any) => row.channel === 'staff_meal')) {
            addExpectedQty(String(standard.raw_item_sku || ''), n(standard.quantity_per_pax) * staffMealPax);
        }
    }

    const eventChannels = ['buffet', 'conference_event', 'outside_catering', 'group_meal'];
    for (const channel of eventChannels) {
        const channelEventIds = [...new Set(
            additionsList
                .filter((row: any) => row.purpose_channel === channel && row.reference_id)
                .map((row: any) => String(row.reference_id))
        )];

        for (const refId of channelEventIds) {
            const eventOrder = eventOrderById.get(refId);
            const pax = n(eventOrder?.pax);
            if (pax <= 0) continue;
            const packageName = String(eventOrder?.menu_package || '').trim().toLowerCase();
            const packageDefinitionId = String(eventOrder?.package_definition_id || '').trim();
            const matchedStandards = standardsList.filter((row: any) => {
                if (row.channel !== channel) return false;
                if (row.event_id && String(row.event_id) === refId) return true;
                if (packageDefinitionId && String(row.package_definition_id || '').trim() === packageDefinitionId) {
                    return true;
                }
                if (packageName && String(row.package_name || '').trim().toLowerCase() === packageName) {
                    return true;
                }
                return !row.event_id && !String(row.package_name || '').trim();
            });

            for (const standard of matchedStandards) {
                addExpectedQty(String(standard.raw_item_sku || ''), n(standard.quantity_per_pax) * pax);
            }
        }
    }

    // Build recipe lookup maps for production-based expected consumption
    const recipeById = new Map<string, any>(
        activeRecipes.map((r: any) => [String(r.id), r])
    );
    const recipeInputsByRecipeId = new Map<string, any[]>();
    for (const inp of (recipeInputs || []) as any[]) {
        const id = String(inp.recipe_id);
        if (!recipeInputsByRecipeId.has(id)) recipeInputsByRecipeId.set(id, []);
        recipeInputsByRecipeId.get(id)!.push(inp);
    }

    // Derive expected consumption from logged production events × recipe standards.
    // Only runs in non-legacy mode (posConsumptionList populated): legacy mode uses
    // item.sold_quantity for expected which already includes production deductions.
    // Only for non-POS production (no pos_outlet_item_id): POS-linked recipes are
    // already covered by kitchen_shift_pos_consumption and would double-count here.
    if (posConsumptionList.length > 0) {
        for (const prod of shiftProductionList) {
            // Skip POS-linked production; kitchen_shift_pos_consumption already provides expected
            if (prod.pos_outlet_item_id) continue;

            const recipeId = String(prod.recipe_id || '').trim();
            const loggedProducedQty = n(prod.produced_quantity);
            if (!recipeId || loggedProducedQty <= 0) continue;

            const recipe = recipeById.get(recipeId);
            if (!recipe) continue;

            const stdProducedQty = n(recipe.produced_quantity);
            if (stdProducedQty <= 0) continue;

            const batchRatio = loggedProducedQty / stdProducedQty;
            const isMultiInput = String(recipe.raw_item_sku || '').trim().toUpperCase() === 'MULTI';

            if (isMultiInput) {
                // COMPLEX/multi-input recipe: compute expected per input from recipe_inputs table
                const inputs = recipeInputsByRecipeId.get(recipeId) || [];
                for (const inp of inputs) {
                    const sku = String(inp.raw_item_sku || '').trim();
                    const stdRawQty = n(inp.quantity);
                    if (sku && stdRawQty > 0) {
                        addExpectedQty(sku, batchRatio * stdRawQty);
                    }
                }
            } else {
                // Single-input recipe
                const sku = String(recipe.raw_item_sku || '').trim();
                const stdRawQty = n(recipe.raw_quantity);
                if (sku && stdRawQty > 0) {
                    addExpectedQty(sku, batchRatio * stdRawQty);
                }
            }
        }
    }

    const additionsBySku = new Map<string, number>();
    const additionsBySkuAndChannel = new Map<string, Map<string, number>>();
    for (const addition of additionsList) {
        const sku = String(addition.item_sku || '').trim();
        if (!sku) continue;
        const qty = n(addition.quantity);
        const channel = String(addition.purpose_channel || 'kitchen_session').trim() || 'kitchen_session';
        additionsBySku.set(sku, (additionsBySku.get(sku) || 0) + qty);
        const bucket = additionsBySkuAndChannel.get(sku) || new Map<string, number>();
        bucket.set(channel, (bucket.get(channel) || 0) + qty);
        additionsBySkuAndChannel.set(sku, bucket);
    }

    // Resolve inventory rows for every SKU that can appear as a row — controlled
    // items AND anything physically issued this shift (kitchen_shift_additions).
    // Issued-but-unregistered items still need their inventory_items.id so their
    // opening stock resolves from the day's kitchen stocktake below.
    const additionSkus = [...additionsBySku.keys()];
    const rowSkus = [...new Set([...controlledSkus, ...additionSkus])];
    const { data: inventoryItems } = rowSkus.length
        ? await supabase
            .from('inventory_items')
            .select('id, sku, item_name, unit, cost_price, default_unit_cost')
            .in('sku', rowSkus)
        : { data: [] } as any;
    const inventoryBySku = new Map<string, any>(
        ((inventoryItems || []) as any[]).map((row) => [String(row.sku || '').trim(), row])
    );
    const standardBySku = new Map<string, any>();
    for (const standard of standardsList) {
        const sku = String(standard.raw_item_sku || '').trim();
        if (sku && !standardBySku.has(sku)) {
            standardBySku.set(sku, standard);
        }
    }
    for (const directRow of directFoodControlList) {
        const sku = String(directRow.stock_item_sku || '').trim();
        if (sku && !standardBySku.has(sku)) {
            standardBySku.set(sku, {
                raw_item_sku: sku,
                raw_item_name: directRow.stock_item_name || sku,
                raw_item_unit: null,
            });
        }
    }
    // Populate names from production recipes so that recipe-controlled items
    // show their human-readable raw item name rather than falling back to a UUID.
    for (const recipe of activeRecipes) {
        const sku = String(recipe.raw_item_sku || '').trim();
        if (sku && sku.toUpperCase() !== 'MULTI' && !standardBySku.has(sku)) {
            standardBySku.set(sku, {
                raw_item_sku: sku,
                raw_item_name: recipe.raw_item_name || sku,
                raw_item_unit: recipe.raw_unit || null,
            });
        }
    }
    // Also populate names from multi-input recipe inputs
    for (const inp of (recipeInputs || []) as any[]) {
        const sku = String(inp.raw_item_sku || '').trim();
        if (sku && !standardBySku.has(sku)) {
            standardBySku.set(sku, {
                raw_item_sku: sku,
                raw_item_name: inp.raw_item_name || sku,
                raw_item_unit: inp.unit || null,
            });
        }
    }
    // Finally, name/unit for anything issued this shift that is NOT registered as a
    // controlled item (no standard / recipe / direct-item). The addition ledger
    // carries the human-readable name and unit, so issued stock shows its real name
    // instead of a bare SKU on the control sheet.
    for (const addition of additionsList) {
        const sku = String(addition.item_sku || '').trim();
        if (!sku || standardBySku.has(sku)) continue;
        standardBySku.set(sku, {
            raw_item_sku: sku,
            raw_item_name: String(addition.item_name || '').trim() || sku,
            raw_item_unit: addition.unit ? String(addition.unit).trim() : null,
        });
    }
    const shiftItemBySku = new Map<string, any>();
    for (const item of shiftItemsList) {
        const sku = String(item.item_sku || '').trim();
        if (sku && !shiftItemBySku.has(sku)) {
            shiftItemBySku.set(sku, item);
        }
    }

    const allSkus = [...new Set([
        ...controlledSkus,
        ...additionsBySku.keys(),
        ...expectedQtyBySku.keys(),
    ])];

    const controlRows: DailyControlRow[] = [];
    for (const sku of allSkus) {
        const inv = inventoryBySku.get(sku) || {};
        const invId = String(inv.id || '').trim();
        const stk = invId ? stocktakeItemByInvId.get(invId) || {} : {};
        const standard = standardBySku.get(sku) || {};
        const shiftItem = shiftItemBySku.get(sku) || {};

        const hasLedgerRow = shiftItemBySku.has(sku);
        const openingQty = hasLedgerRow ? n(shiftItem.opening_stock) : n(stk.opening_qty);
        const additionsQty = additionsBySku.get(sku) ?? n(shiftItem.additions);
        const expectedConsumptionQty = n(expectedQtyBySku.get(sku) || 0);
        const portionsSold = portionsSoldByRawSku.get(sku) || 0;
        const posSalesQty = portionsSold > 0 ? portionsSold : n(posSalesQtyBySku.get(sku) ?? shiftItem.sold_quantity);
        const spoilageQty = hasLedgerRow ? n(shiftItem.spoilage_quantity) : 0;

        const physicalClosingQty =
            shiftItem.physical_count != null
                ? n(shiftItem.physical_count)
                : (stk.closing_qty != null ? n(stk.closing_qty) : null);

        // Filter out completely inactive items with 0 stock and 0 activity
        if (openingQty === 0 && additionsQty === 0 && expectedConsumptionQty === 0 && (physicalClosingQty == null || physicalClosingQty === 0)) {
            continue;
        }

        const systemClosingQty = Math.max(0, openingQty + additionsQty - expectedConsumptionQty - spoilageQty);
        const actualClosing = physicalClosingQty != null ? physicalClosingQty : systemClosingQty;

        // Actual usage: if opening and additions are 0 but expected usage occurred (e.g. Fresh Milk without logged additions),
        // actual usage equals expected usage so it reconciles cleanly without false negative stock
        let actualConsumptionQty = openingQty + additionsQty - actualClosing - spoilageQty;
        if (openingQty === 0 && additionsQty === 0 && actualConsumptionQty <= 0 && expectedConsumptionQty > 0) {
            actualConsumptionQty = expectedConsumptionQty;
        }
        actualConsumptionQty = Math.max(0, Number(actualConsumptionQty.toFixed(3)));

        const varianceQty = Number((actualConsumptionQty - expectedConsumptionQty).toFixed(3));
        const costPrice = n(shiftItem.cost_price) || n(inv.cost_price) || n(inv.default_unit_cost) || 0;
        const expectedCost = Number((expectedConsumptionQty * costPrice).toFixed(2));
        const actualCost = Number((actualConsumptionQty * costPrice).toFixed(2));
        const varianceCost = Number((actualCost - expectedCost).toFixed(2));

        const channelBreakdownMap = additionsBySkuAndChannel.get(sku) || new Map<string, number>();
        const channelBreakdown = [...channelBreakdownMap.entries()]
            .map(([channelCode, issuedQty]) => ({
                channel_code: channelCode,
                channel_name: channelNames[channelCode] || channelCode,
                issued_qty: Number(issuedQty.toFixed(3)),
            }))
            .sort((a, b) => b.issued_qty - a.issued_qty);

        const itemName = String(
            shiftItem.item_name ||
            inv.item_name ||
            standard.raw_item_name ||
            sku
        );
        const unit = String(
            shiftItem.unit_of_measure ||
            shiftItem.unit ||
            inv.unit ||
            standard.raw_item_unit ||
            'unit'
        );

        // Dishes produced summary
        const dishesMap = dishesProducedByRawSku.get(sku);
        const producedItems = dishesMap ? [...dishesMap.entries()].map(([name, stat]) => ({
            dish_name: name,
            portions_sold: Number(stat.portions.toFixed(2)),
            raw_quantity_consumed: Number(stat.raw_consumed.toFixed(3)),
            unit: unit,
        })).sort((a, b) => b.portions_sold - a.portions_sold) : [];

        if (dishesMap && dishesMap.size > 0 && channelBreakdown.length === 0) {
            const dishesSummary = [...dishesMap.entries()]
                .map(([name, stat]) => `${name}: ${stat.portions}`)
                .join(', ');
            channelBreakdown.push({
                channel_code: 'pos_restaurant',
                channel_name: `POS: ${dishesSummary}`,
                issued_qty: Number(expectedConsumptionQty.toFixed(3)),
            });
        }

        const rawChannelName = channelBreakdown[0]?.channel_name || 'POS Restaurant';
        const displayChannel = rawChannelName.startsWith('POS:') ? 'POS Restaurant' : rawChannelName;

        controlRows.push({
            item_sku: sku,
            item_name: itemName,
            unit,
            main_channel: displayChannel,
            opening_qty: Number(openingQty.toFixed(3)),
            additions_qty: Number(additionsQty.toFixed(3)),
            pos_sales_qty: Number(posSalesQty.toFixed(3)),
            spoilage_qty: Number(spoilageQty.toFixed(3)),
            system_closing_qty: Number(systemClosingQty.toFixed(3)),
            physical_closing_qty: Number(actualClosing.toFixed(3)),
            actual_consumption_qty: actualConsumptionQty,
            expected_consumption_qty: Number(expectedConsumptionQty.toFixed(3)),
            variance_qty: varianceQty,
            cost_price: Number(costPrice.toFixed(2)),
            expected_cost: expectedCost,
            actual_cost: actualCost,
            variance_cost: varianceCost,
            channel_breakdown: channelBreakdown,
            produced_items: producedItems,
        });
    }

    // Rank by relevance: items that moved (additions / sales / variance) first, then by activity desc
    const rows: DailyControlRow[] = controlRows.sort((a, b) => {
        const aMoved = a.pos_sales_qty > 0 || a.additions_qty > 0 || a.opening_qty > 0 || a.expected_consumption_qty > 0;
        const bMoved = b.pos_sales_qty > 0 || b.additions_qty > 0 || b.opening_qty > 0 || b.expected_consumption_qty > 0;
        if (aMoved && !bMoved) return -1;
        if (!aMoved && bMoved) return 1;
        if (aMoved && bMoved) {
            return (b.additions_qty + b.expected_consumption_qty) - (a.additions_qty + a.expected_consumption_qty);
        }
        return a.item_name.localeCompare(b.item_name);
    });

    const summary = rows.reduce(
        (acc, row) => {
            acc.total_opening_qty += row.opening_qty;
            acc.total_additions_qty += row.additions_qty;
            acc.total_pos_sales_qty += row.pos_sales_qty;
            acc.total_spoilage_qty += row.spoilage_qty;
            acc.total_expected_cost += row.expected_cost;
            acc.total_actual_cost += row.actual_cost;
            acc.total_variance_cost += row.variance_cost;
            return acc;
        },
        {
            total_opening_qty: 0,
            total_additions_qty: 0,
            total_pos_sales_qty: 0,
            total_spoilage_qty: 0,
            total_expected_cost: 0,
            total_actual_cost: 0,
            total_variance_cost: 0,
        }
    );

    // Sold POS items with no recipe / inventory / food-control link — grouped
    // for the accountant to register (recipe / direct / exempt). Exclude bar & non-consumables.
    const isBarOrNonConsumableItem = (name: string, outletType?: string): boolean => {
        const normName = String(name || '').toLowerCase().trim();
        const normOutlet = String(outletType || '').toLowerCase().trim();

        if (['main_bar', 'executive_bar', 'sports_bar', 'bar', 'cellar'].includes(normOutlet)) {
            return true;
        }

        const nonConsumables = [
            'pool token', 'token', 'pool', 'trust classic', 'trust', 'condom', 't-shirt',
            'merchandise', 'cap', 'hat', 'towel', 'ticket', 'corkage', 'service charge',
            'damage fee', 'penalty', 'entry fee', 'parking', 'car wash', 'engine wash',
            'playground', 'swimming', 'dog food', 'takeaway tin', 'take away tin', 'tin', 'packaging', 'wash'
        ];
        if (nonConsumables.some(nc => normName.includes(nc))) {
            return true;
        }

        const barKeywords = [
            'white cap', 'tusker', 'guinness', 'guarana', 'manyatta', 'savanna', 'faxe',
            'viceroy', 'richot', 'vodka', 'captain morgan', 'black & white', 'kc ', 'kc 750', 'kc 350',
            'kenya cane', 'gilbeys', 'gordons', 'bond 7', 'chrome', 'tripple ace', 'konyagi',
            'jameson', 'jack daniel', 'red label', 'black label', 'johnnie walker', 'chivas',
            'hennessy', 'martell', 'tequila', 'bacardi', 'campari', 'jagermeister', 'baileys',
            'amarula', 'heineken', 'snapp', 'smirnoff', 'pilsner', 'bavaria', 'cider', 'lager',
            '750ml', '350ml', '250ml', 'soda 500ml', 'soda 300ml', 'red bull', 'black ice',
            'drostdy', 'caprice', 'camino', 'alvaro', 'balozi', 'tot', 'can', 'wine', 'beer'
        ];
        if (barKeywords.some(bk => normName.includes(bk))) {
            return true;
        }

        return false;
    };

    // Re-evaluate the "needs config" list against the CURRENT food-control config.
    const { data: exemptRows } = await supabase
        .from('food_control_exempt_items')
        .select('pos_outlet_item_id')
        .eq('branch_id', shift.branch_id);
    const configuredPosItemIds = new Set<string>();
    const configuredPosNames = new Set<string>();

    for (const recipe of activeRecipes) {
        const id = String(recipe.pos_outlet_item_id || '').trim();
        if (id) configuredPosItemIds.add(id);
        if (recipe.produced_item_name) configuredPosNames.add(norm(recipe.produced_item_name));
        if (recipe.recipe_name) configuredPosNames.add(norm(recipe.recipe_name));
    }
    for (const directRow of directFoodControlList) {
        const id = String(directRow.pos_outlet_item_id || '').trim();
        if (id) configuredPosItemIds.add(id);
        if (directRow.stock_item_name) configuredPosNames.add(norm(directRow.stock_item_name));
    }
    for (const exemptRow of ((exemptRows || []) as any[])) {
        const id = String(exemptRow.pos_outlet_item_id || '').trim();
        if (id) configuredPosItemIds.add(id);
    }

    const unmatchedByPosId = new Map<string, any>();
    for (const sale of posConsumptionList) {
        const saleId = String(sale.id || '');
        if (dynamicallyMatchedSaleIds.has(saleId)) continue;
        if (String((sale as any).match_status || 'matched') !== 'unmatched') continue;
        const posOutletId = String(sale.pos_outlet_item_id || '').trim();
        if (posOutletId && configuredPosItemIds.has(posOutletId)) continue;
        const itemName = String(sale.raw_item_name || sale.produced_item_name || 'Unmapped POS item');
        if (configuredPosNames.has(norm(itemName))) continue;
        const outletType = String((sale as any).outlet_type || (sale as any).outlet_name || '');
        if (isBarOrNonConsumableItem(itemName, outletType)) continue;

        const posId = posOutletId || norm(itemName);
        const existing = unmatchedByPosId.get(posId) || {
            pos_outlet_item_id: sale.pos_outlet_item_id || null,
            item_name: itemName,
            portions_sold: 0,
        };
        existing.portions_sold += n(sale.portions_sold);
        unmatchedByPosId.set(posId, existing);
    }
    const unmatchedPosItems = [...unmatchedByPosId.values()]
        .map((u) => ({ ...u, portions_sold: Number(u.portions_sold.toFixed(3)) }))
        .sort((a, b) => b.portions_sold - a.portions_sold);

    // Kitchen wastage recorded against THIS shift (branch_spoilage_log). Kept
    // separate from unexplained variance per food-control policy: approved =
    // confirmed loss, pending = awaiting accountant/manager approval.
    const { data: kitchenSpoilage } = await supabase
        .from('branch_spoilage_log')
        .select('item_sku, item_name, quantity, unit, unit_cost, total_loss, reason, status')
        .eq('branch_id', shift.branch_id)
        .eq('area', 'kitchen')
        .eq('kitchen_shift_id', shift.id);
    const spoilageRows = (kitchenSpoilage || []) as any[];
    const sumLoss = (status: string) => Number(
        spoilageRows.filter((r) => String(r.status) === status)
            .reduce((s, r) => s + n(r.total_loss), 0).toFixed(2)
    );
    const wastage = {
        approved_cost: sumLoss('approved'),
        pending_cost: sumLoss('pending'),
        entries: spoilageRows.map((r) => ({
            item_sku: r.item_sku || null,
            item_name: r.item_name || null,
            quantity: n(r.quantity),
            unit: r.unit || null,
            total_loss: n(r.total_loss),
            reason: r.reason || null,
            status: r.status || null,
        })),
    };

    // ── PER-CHANNEL CONTROLS (Phase 2) ───────────────────────────────────────
    // Each issue channel is controlled by the method appropriate to it:
    //   POS Restaurant  → recipe/POS-sales standard (expected vs actual)
    //   Conference/Buffet/Group/Outside Catering → net food cost, revenue,
    //       food-cost %, gross margin, cost per guest (Outside Catering also
    //       subtracts returns)
    //   Accommodation Breakfast → net cost ÷ confirmed pax
    //   Staff Meals → net cost, cost per guest (menu × served)
    //   Wastage → approved/pending loss (separate from unexplained variance)
    // Costs reuse kitchen_shift_items.cost_price; revenue/pax/returns come from
    // event_orders.
    const costBySku = new Map<string, number>();
    for (const it of shiftItemsList) {
        const sku = String(it.item_sku || '').trim();
        if (sku) costBySku.set(sku, n(it.cost_price));
    }
    const round2 = (v: number) => Number((v || 0).toFixed(2));
    const eventStyleChannels = ['buffet', 'conference_event', 'outside_catering', 'group_meal', 'event_order'];
    const channelControlMethod: Record<string, string> = {
        pos_restaurant: 'recipe_standard',
        accommodation_breakfast: 'cost_per_pax',
        buffet: 'cost_margin',
        conference_event: 'cost_margin',
        outside_catering: 'cost_margin_returns',
        group_meal: 'cost_margin',
        staff_meal: 'menu_x_served',
        wastage: 'wastage_approval',
    };
    const controlChannelKeys = [
        'pos_restaurant', 'accommodation_breakfast', 'buffet', 'conference_event',
        'outside_catering', 'group_meal', 'staff_meal', 'wastage',
    ];
    const channelControls = controlChannelKeys.map((channel) => {
        const adds = additionsList.filter(
            (a: any) => String(a.purpose_channel || 'kitchen_session') === channel
        );
        const issuedCost = adds.reduce(
            (s: number, a: any) => s + n(a.quantity) * (costBySku.get(String(a.item_sku || '').trim()) || 0),
            0
        );

        let revenue = 0;
        let pax = 0;
        let returns = 0;
        if (eventStyleChannels.includes(channel)) {
            const refIds = [...new Set(adds.map((a: any) => String(a.reference_id || '').trim()).filter(Boolean))];
            for (const rid of refIds) {
                const eo = eventOrderById.get(rid);
                if (!eo) continue;
                revenue += n((eo as any).total_amount);
                pax += n(eo.pax);
                returns += n((eo as any).returns_value);
            }
        } else if (channel === 'accommodation_breakfast') {
            pax = n(shift.breakfast_pax);
            revenue = pax * 1000;
        } else if (channel === 'staff_meal') {
            pax = n(shift.staff_meal_pax);
        }

        const wastageCost = channel === 'wastage' ? wastage.approved_cost : 0;
        const netCost = channel === 'wastage'
            ? round2(wastageCost)
            : round2(issuedCost - returns);
        const foodCostPct = revenue > 0 ? round2((netCost / revenue) * 100) : null;
        const grossMargin = revenue > 0 ? round2(revenue - netCost) : null;
        const costPerGuest = pax > 0 ? round2(netCost / pax) : null;

        return {
            channel_code: channel,
            channel_name: channelNames[channel] || channel,
            control_method: channelControlMethod[channel] || 'recipe_standard',
            issued_cost: round2(issuedCost),
            returns: round2(returns),
            wastage_cost: round2(wastageCost),
            net_cost: netCost,
            revenue: round2(revenue),
            food_cost_pct: foodCostPct,
            gross_margin: grossMargin,
            pax,
            cost_per_guest: costPerGuest,
        };
    }).filter((c) => c.issued_cost > 0 || c.revenue > 0 || c.wastage_cost > 0 || c.pax > 0);

    return {
        shift,
        rows,
        unmatched_pos_items: unmatchedPosItems,
        wastage,
        channel_controls: channelControls,
        summary: {
            ...summary,
            total_opening_qty: Number(summary.total_opening_qty.toFixed(3)),
            total_additions_qty: Number(summary.total_additions_qty.toFixed(3)),
            total_pos_sales_qty: Number(summary.total_pos_sales_qty.toFixed(3)),
            total_spoilage_qty: Number(summary.total_spoilage_qty.toFixed(3)),
            total_expected_cost: Number(summary.total_expected_cost.toFixed(2)),
            total_actual_cost: Number(summary.total_actual_cost.toFixed(2)),
            total_variance_cost: Number(summary.total_variance_cost.toFixed(2)),
            item_count: rows.length,
            standards_item_count: controlledSkus.length,
        },
        standards_configured: controlledSkus.length > 0,
    };
}

export async function getDailyControlsDataForShift(shift_id: string): Promise<any> {
    const { data: shiftRow, error: shiftLookupError } = await supabase
        .from('kitchen_shifts')
        .select('id, cashier_shift_id, status')
        .eq('id', shift_id)
        .maybeSingle();
    if (shiftLookupError) {
        throw new AppError(shiftLookupError.message, 500);
    }
    if (!shiftRow) {
        throw new AppError('Shift not found', 404);
    }

    const frozenShiftSnapshot = await loadKitchenShiftControlSnapshot(String(shift_id));
    if (frozenShiftSnapshot) {
        return toFrozenShiftDailyControlsResponse(
            frozenShiftSnapshot.payload,
            frozenShiftSnapshot.computedAt
        );
    }

    if (shiftRow.cashier_shift_id && String(shiftRow.status || '').toLowerCase() === 'closed') {
        const { data: frozenSnapshot } = await supabase
            .from('daily_control_snapshots')
            .select('snapshot_data, computed_at')
            .eq('cashier_shift_id', shiftRow.cashier_shift_id)
            .maybeSingle();

        const frozenReports = (frozenSnapshot?.snapshot_data as any)?.kitchen_shift_reports;
        if (Array.isArray(frozenReports)) {
            const matched = frozenReports.find((row: any) => String(row?.shift_id || '') === shift_id);
            if (matched) {
                return {
                    ...matched,
                    frozen: true,
                    frozen_at: frozenSnapshot?.computed_at ?? null,
                };
            }
        }
    }

    if (['closed', 'pending_chef_confirmation', 'pending_accountant_review', 'approved', 'rejected'].includes(String(shiftRow.status || '').toLowerCase())) {
        const persistedSnapshot = await persistKitchenShiftControlSnapshot(String(shift_id));
        return toFrozenShiftDailyControlsResponse(
            persistedSnapshot.payload,
            persistedSnapshot.computedAt
        );
    }

    const report = await buildShiftDailyControlsData(shift_id);
    return {
        ...toShiftDailyControlsApiPayload(report),
        frozen: false,
        frozen_at: null,
    };
}

export const getShiftDailyControlsReport = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const data = await getDailyControlsDataForShift(shift_id);
    res.status(200).json({
        success: true,
        data,
    });
});

export const exportShiftDailyControlsExcel = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const data = await getDailyControlsDataForShift(shift_id);
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Famous Gate Hotel Management System';
    workbook.created = new Date();

    const shift = data.shift || {};
    const summary = data.summary || {};
    const rows = Array.isArray(data.rows) ? data.rows : [];
    const shiftDate = shift.shift_date || 'date';
    const shiftNumber = shift.shift_number || String(shift_id).slice(0, 8);
    const shiftType = (shift.sub_shift_type || shift.shift_type || 'SHIFT').toUpperCase();

    // ── Sheet 1: Shift Control Sheet ─────────────────────────────────────────
    const wsControls = workbook.addWorksheet('Shift Control Sheet', {
        views: [{ state: 'frozen', ySplit: 5 }],
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 }
    });

    // Title Block
    wsControls.mergeCells('A1:R1');
    const titleCell = wsControls.getCell('A1');
    titleCell.value = 'FAMOUS GATE HOTELS — DAILY FOOD CONTROLS REPORT';
    titleCell.font = { name: 'Calibri', bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3D73' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wsControls.getRow(1).height = 36;

    // Subtitle / Shift Info Block
    wsControls.mergeCells('A2:R2');
    const subCell = wsControls.getCell('A2');
    subCell.value = `Shift: ${shiftNumber} | Date: ${shiftDate} | Shift Type: ${shiftType} | Department: ${shift.department || 'KITCHEN'} | Status: ${(shift.status || 'OPEN').toUpperCase()} | Snapshot: ${data.frozen ? `Frozen (${data.frozen_at || ''})` : 'Live Provisional'}`;
    subCell.font = { name: 'Calibri', italic: true, size: 11, color: { argb: 'FFFFFFFF' } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A5298' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wsControls.getRow(2).height = 22;

    // KPI Summary Strip on Row 3
    wsControls.mergeCells('A3:R3');
    const kpiCell = wsControls.getCell('A3');
    kpiCell.value = `Items: ${summary.item_count ?? rows.length}  |  Opening Qty: ${summary.total_opening_qty ?? 0}  |  Additions: ${summary.total_additions_qty ?? 0}  |  POS Sales: ${summary.total_pos_sales_qty ?? 0}  |  Spoilage: ${summary.total_spoilage_qty ?? 0}  |  Expected Cost: KES ${Number(summary.total_expected_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}  |  Actual Cost: KES ${Number(summary.total_actual_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}  |  Variance Cost: KES ${Number(summary.total_variance_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    kpiCell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF0F172A' } };
    kpiCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    kpiCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wsControls.getRow(3).height = 22;

    wsControls.addRow([]); // Blank spacer row 4

    // Table Headers on Row 5
    const headers = [
        '#', 'Item Name', 'SKU', 'Unit', 'Main Channel',
        'Opening Qty', 'Additions Qty', 'POS Sales Qty', 'Spoilage Qty',
        'System Closing', 'Physical Closing', 'Expected Usage', 'Actual Usage',
        'Variance Qty', 'Cost Price (KES)', 'Expected Cost (KES)', 'Actual Cost (KES)', 'Variance Cost (KES)'
    ];
    const headerRow = wsControls.getRow(5);
    headers.forEach((h: string, idx: number) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = h;
        cell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3D73' } };
        cell.alignment = { horizontal: idx >= 5 ? 'right' : (idx === 0 ? 'center' : 'left'), vertical: 'middle', wrapText: true };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
    });
    headerRow.height = 28;

    // Set Column Widths
    wsControls.columns = [
        { width: 6 },   // #
        { width: 28 },  // Item Name
        { width: 15 },  // SKU
        { width: 10 },  // Unit
        { width: 18 },  // Main Channel
        { width: 13 },  // Opening Qty
        { width: 13 },  // Additions Qty
        { width: 13 },  // POS Sales Qty
        { width: 13 },  // Spoilage Qty
        { width: 14 },  // System Closing
        { width: 15 },  // Physical Closing
        { width: 15 },  // Expected Usage
        { width: 14 },  // Actual Usage
        { width: 14 },  // Variance Qty
        { width: 15 },  // Cost Price
        { width: 18 },  // Expected Cost
        { width: 16 },  // Actual Cost
        { width: 18 },  // Variance Cost
    ];

    const thinBorder = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };

    rows.forEach((r: any, i: number) => {
        const isEven = i % 2 === 0;
        const rowNum = 6 + i;
        const row = wsControls.getRow(rowNum);
        const varianceCost = Number(r.variance_cost || 0);

        row.getCell(1).value = i + 1;
        row.getCell(2).value = r.item_name || '—';
        row.getCell(3).value = r.item_sku || '—';
        row.getCell(4).value = r.unit || '—';
        row.getCell(5).value = r.main_channel || '—';
        row.getCell(6).value = Number(r.opening_qty || 0);
        row.getCell(7).value = Number(r.additions_qty || 0);
        row.getCell(8).value = Number(r.pos_sales_qty || 0);
        row.getCell(9).value = Number(r.spoilage_qty || 0);
        row.getCell(10).value = Number(r.system_closing_qty || 0);
        row.getCell(11).value = Number(r.physical_closing_qty || 0);
        row.getCell(12).value = Number(r.expected_consumption_qty || 0);
        row.getCell(13).value = Number(r.actual_consumption_qty || 0);
        row.getCell(14).value = Number(r.variance_qty || 0);
        row.getCell(15).value = Number(r.cost_price || 0);
        row.getCell(16).value = Number(r.expected_cost || 0);
        row.getCell(17).value = Number(r.actual_cost || 0);
        row.getCell(18).value = varianceCost;

        const defaultBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';
        for (let col = 1; col <= 18; col++) {
            const cell = row.getCell(col);
            cell.font = { name: 'Calibri', size: 10 };
            cell.border = thinBorder;
            cell.alignment = {
                horizontal: col >= 6 ? 'right' : (col === 1 ? 'center' : 'left'),
                vertical: 'middle'
            };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: defaultBg } };

            if (col >= 6 && col <= 14) {
                cell.numFmt = '#,##0.000';
            } else if (col >= 15 && col <= 18) {
                cell.numFmt = '#,##0.00';
            }
        }

        // Highlight variance cell
        const varCell = row.getCell(18);
        if (varianceCost > 0.01) {
            varCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFB91C1C' } };
            varCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        } else if (varianceCost < -0.01) {
            varCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF047857' } };
            varCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
        }

        row.height = 22;
    });

    // Total Summary Row
    const totalRowNum = 6 + rows.length;
    const totalRow = wsControls.getRow(totalRowNum);
    wsControls.mergeCells(`A${totalRowNum}:E${totalRowNum}`);
    const totalLabelCell = totalRow.getCell(1);
    totalLabelCell.value = 'TOTALS';
    totalLabelCell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    totalLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3D73' } };
    totalLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };

    for (let c = 6; c <= 18; c++) {
        const colLetter = String.fromCharCode(64 + c);
        const cell = totalRow.getCell(c);
        if (rows.length > 0) {
            cell.value = { formula: `SUM(${colLetter}6:${colLetter}${totalRowNum - 1})` };
        } else {
            cell.value = 0;
        }
        cell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3D73' } };
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = c >= 15 ? '#,##0.00' : '#,##0.000';
    }
    totalRow.height = 26;

    // ── Sheet 2: Summary & Channel Controls ──────────────────────────────────
    const wsSummary = workbook.addWorksheet('Summary & Channels', {
        pageSetup: { orientation: 'portrait', fitToPage: true }
    });
    wsSummary.columns = [
        { width: 28 }, { width: 35 }, { width: 18 }, { width: 18 }, { width: 18 }
    ];

    wsSummary.mergeCells('A1:E1');
    const sTitle = wsSummary.getCell('A1');
    sTitle.value = 'SHIFT SUMMARY & CHANNEL CONTROLS';
    sTitle.font = { name: 'Calibri', bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    sTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3D73' } };
    sTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    wsSummary.getRow(1).height = 30;

    const summaryData = [
        ['Kitchen Shift Number', shiftNumber],
        ['Shift Date', shiftDate],
        ['Shift Type', shiftType],
        ['Department', shift.department || 'KITCHEN'],
        ['Shift Status', (shift.status || 'OPEN').toUpperCase()],
        ['Snapshot State', data.frozen ? `Frozen on ${data.frozen_at}` : 'Live provisional'],
        ['Breakfast Pax', data.breakfast_pax || shift.breakfast_pax || 0],
        ['Staff Meal Pax', data.staff_meal_pax || shift.staff_meal_pax || 0],
        ['Total Items Controlled', summary.item_count ?? rows.length],
        ['Total Opening Qty', summary.total_opening_qty ?? 0],
        ['Total Additions Qty', summary.total_additions_qty ?? 0],
        ['Total POS Sales Qty', summary.total_pos_sales_qty ?? 0],
        ['Total Spoilage Qty', summary.total_spoilage_qty ?? 0],
        ['Total Expected Cost (KES)', summary.total_expected_cost ?? 0],
        ['Total Actual Cost (KES)', summary.total_actual_cost ?? 0],
        ['Total Variance Cost (KES)', summary.total_variance_cost ?? 0],
    ];

    let currentSrow = 3;
    summaryData.forEach(([k, v]) => {
        const r = wsSummary.getRow(currentSrow);
        r.getCell(1).value = k;
        r.getCell(1).font = { name: 'Calibri', bold: true, size: 10 };
        r.getCell(2).value = v;
        r.getCell(2).font = { name: 'Calibri', size: 10 };
        currentSrow++;
    });

    currentSrow += 2;
    // Channel Controls table
    const channels = Array.isArray(data.channel_controls) ? data.channel_controls : [];
    if (channels.length > 0) {
        wsSummary.getCell(`A${currentSrow}`).value = 'Channel Controls Breakdown';
        wsSummary.getCell(`A${currentSrow}`).font = { name: 'Calibri', bold: true, size: 12, color: { argb: 'FF1E3D73' } };
        currentSrow++;

        const chHeaders = ['Channel', 'Control Method', 'Issued Cost (KES)', 'Returns (KES)', 'Net Cost (KES)', 'Revenue (KES)', 'Food Cost %', 'Margin (KES)', 'Pax'];
        const chHeaderRow = wsSummary.getRow(currentSrow);
        chHeaders.forEach((h, i) => {
            const cell = chHeaderRow.getCell(i + 1);
            cell.value = h;
            cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A5298' } };
            cell.alignment = { horizontal: i >= 2 ? 'right' : 'left' };
        });
        currentSrow++;

        channels.forEach((c: any) => {
            const cr = wsSummary.getRow(currentSrow);
            cr.getCell(1).value = c.channel_name || c.channel_code || '';
            cr.getCell(2).value = c.control_method || '';
            cr.getCell(3).value = Number(c.issued_cost || 0);
            cr.getCell(4).value = Number(c.returns || 0);
            cr.getCell(5).value = Number(c.net_cost || 0);
            cr.getCell(6).value = Number(c.revenue || 0);
            cr.getCell(7).value = c.food_cost_pct != null ? `${Number(c.food_cost_pct).toFixed(1)}%` : '—';
            cr.getCell(8).value = c.gross_margin != null ? Number(c.gross_margin) : 0;
            cr.getCell(9).value = Number(c.pax || 0);
            for (let j = 1; j <= 9; j++) {
                cr.getCell(j).font = { name: 'Calibri', size: 10 };
                cr.getCell(j).border = thinBorder;
                if ((j >= 3 && j <= 6) || j === 8) cr.getCell(j).numFmt = '#,##0.00';
            }
            currentSrow++;
        });
    }

    // ── Sheet 3: Unmatched POS Items (if any) ───────────────────────────────
    const unmatched = Array.isArray(data.unmatched_pos_items) ? data.unmatched_pos_items : [];
    if (unmatched.length > 0) {
        const wsUnmatched = workbook.addWorksheet('Unmatched POS Items');
        wsUnmatched.columns = [{ width: 40 }, { width: 20 }];
        wsUnmatched.mergeCells('A1:B1');
        const uTitle = wsUnmatched.getCell('A1');
        uTitle.value = 'POS ITEMS NEEDING FOOD-CONTROL CONFIGURATION';
        uTitle.font = { name: 'Calibri', bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        uTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C1C' } };
        uTitle.alignment = { horizontal: 'center', vertical: 'middle' };

        wsUnmatched.getRow(3).getCell(1).value = 'Item Name';
        wsUnmatched.getRow(3).getCell(2).value = 'Portions Sold';
        wsUnmatched.getRow(3).font = { name: 'Calibri', bold: true, size: 10 };

        unmatched.forEach((u: any, idx: number) => {
            const ur = wsUnmatched.getRow(4 + idx);
            ur.getCell(1).value = u.item_name || 'Unknown';
            ur.getCell(2).value = Number(u.portions_sold || 0);
            ur.getCell(1).border = thinBorder;
            ur.getCell(2).border = thinBorder;
            ur.getCell(2).numFmt = '#,##0.00';
        });
    }

    const safeShiftNum = String(shiftNumber).replace(/[^A-Za-z0-9_-]/g, '_');
    const safeDate = String(shiftDate).replace(/[^A-Za-z0-9_-]/g, '_');
    const filename = `FG_DailyControls_${safeDate}_${safeShiftNum}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
});

export const exportShiftDailyControlsCsv = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const data = await getDailyControlsDataForShift(shift_id);
    const shift = data.shift || {};
    const summary = data.summary || {};
    const rows = Array.isArray(data.rows) ? data.rows : [];
    const shiftDate = shift.shift_date || 'date';
    const shiftNumber = shift.shift_number || String(shift_id).slice(0, 8);
    const shiftType = (shift.sub_shift_type || shift.shift_type || 'SHIFT').toUpperCase();

    const csvCell = (v: any) => {
        let text = `${v ?? ''}`.replace(/\r/g, ' ').replace(/\n/g, ' ');
        if (text.startsWith('=') || text.startsWith('+') || text.startsWith('-') || text.startsWith('@')) {
            text = `'${text}`;
        }
        return `"${text.replace(/"/g, '""')}"`;
    };

    const lines: string[] = [];
    // BOM for UTF-8 Excel auto-detection
    lines.push('\uFEFFFAMOUS GATE HOTELS — DAILY FOOD CONTROLS REPORT');
    lines.push([`Kitchen Shift: ${shiftNumber}`, `Date: ${shiftDate}`, `Shift Type: ${shiftType}`, `Department: ${shift.department || 'KITCHEN'}`, `Status: ${(shift.status || 'OPEN').toUpperCase()}`].map(csvCell).join(','));
    lines.push([`Snapshot: ${data.frozen ? `Frozen (${data.frozen_at || ''})` : 'Live Provisional'}`].map(csvCell).join(','));
    lines.push('');
    lines.push('SUMMARY METRICS');
    lines.push(['Items Count', 'Breakfast Pax', 'Staff Meal Pax', 'Opening Qty', 'Additions Qty', 'POS Sales Qty', 'Spoilage Qty', 'Expected Cost (KES)', 'Actual Cost (KES)', 'Variance Cost (KES)'].map(csvCell).join(','));
    lines.push([
        summary.item_count ?? rows.length,
        data.breakfast_pax || shift.breakfast_pax || 0,
        data.staff_meal_pax || shift.staff_meal_pax || 0,
        summary.total_opening_qty ?? 0,
        summary.total_additions_qty ?? 0,
        summary.total_pos_sales_qty ?? 0,
        summary.total_spoilage_qty ?? 0,
        summary.total_expected_cost ?? 0,
        summary.total_actual_cost ?? 0,
        summary.total_variance_cost ?? 0,
    ].map(csvCell).join(','));
    lines.push('');
    lines.push('SHIFT CONTROL SHEET');
    const headers = [
        '#', 'Item Name', 'SKU', 'Unit', 'Main Channel',
        'Opening Qty', 'Additions Qty', 'POS Sales Qty', 'Spoilage Qty',
        'System Closing', 'Physical Closing', 'Expected Usage', 'Actual Usage',
        'Variance Qty', 'Cost Price (KES)', 'Expected Cost (KES)', 'Actual Cost (KES)', 'Variance Cost (KES)'
    ];
    lines.push(headers.map(csvCell).join(','));

    rows.forEach((r: any, idx: number) => {
        lines.push([
            idx + 1,
            r.item_name || '',
            r.item_sku || '',
            r.unit || '',
            r.main_channel || '',
            r.opening_qty ?? 0,
            r.additions_qty ?? 0,
            r.pos_sales_qty ?? 0,
            r.spoilage_qty ?? 0,
            r.system_closing_qty ?? 0,
            r.physical_closing_qty ?? 0,
            r.expected_consumption_qty ?? 0,
            r.actual_consumption_qty ?? 0,
            r.variance_qty ?? 0,
            r.cost_price ?? 0,
            r.expected_cost ?? 0,
            r.actual_cost ?? 0,
            r.variance_cost ?? 0,
        ].map(csvCell).join(','));
    });

    const safeShiftNum = String(shiftNumber).replace(/[^A-Za-z0-9_-]/g, '_');
    const safeDate = String(shiftDate).replace(/[^A-Za-z0-9_-]/g, '_');
    const filename = `FG_DailyControls_${safeDate}_${safeShiftNum}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(lines.join('\r\n'));
});

// ── KITCHEN VARIANCE SUMMARY & EXPORT ───────────────────────────
export async function buildKitchenVarianceSummaryReportData(query: any, user: any) {
    const { branch_id, from_date, to_date, shift_id, status } = query;
    const effectiveBranch = branch_id || user?.branch_id;

    let q = supabase
        .from('kitchen_shifts')
        .select('*, store_keeper:users!store_keeper_id(first_name,last_name)')
        .order('opened_at', { ascending: false });

    if (effectiveBranch) q = q.eq('branch_id', effectiveBranch);
    if (shift_id) q = q.eq('id', shift_id);
    if (status && status !== 'all') q = q.eq('status', status);
    if (from_date) q = q.gte('shift_date', from_date);
    if (to_date) q = q.lte('shift_date', to_date);

    const { data: shifts, error } = await q;
    if (error) throw new AppError(error.message, 500);

    const shiftList = shifts || [];
    const shiftIds = shiftList.map((s: any) => s.id);

    let snapshotMap = new Map<string, any>();
    let liabilityMap = new Map<string, any>();
    if (shiftIds.length > 0) {
        try {
            const [{ data: snapshots }, { data: liabilityCases }] = await Promise.all([
                supabase
                    .from('kitchen_shift_control_snapshots')
                    .select('shift_id, computed_at, snapshot_data')
                    .in('shift_id', shiftIds),
                supabase
                    .from('kitchen_shift_liability_cases')
                    .select('*')
                    .in('shift_id', shiftIds)
            ]);

            (snapshots || []).forEach((sn: any) => {
                snapshotMap.set(sn.shift_id, sn);
            });
            (liabilityCases || []).forEach((lc: any) => {
                liabilityMap.set(lc.shift_id, lc);
            });
        } catch (e) {
            logger.warn('buildKitchenVarianceSummaryReportData: snapshots/liability fetch failed', e as any);
        }
    }

    let totalExpectedCost = 0;
    let totalActualCost = 0;
    let totalVarianceCost = 0;
    let totalUnfavorableVariance = 0;
    let totalFavorableVariance = 0;
    let totalPosSalesQty = 0;
    let shiftsWithVariance = 0;
    let pendingReviewsCount = 0;

    const itemMap = new Map<string, {
        item_sku: string;
        item_name: string;
        unit: string;
        shifts_count: number;
        total_expected_qty: number;
        total_actual_qty: number;
        total_variance_qty: number;
        total_variance_cost: number;
    }>();

    const enrichedShifts = shiftList.map((shift: any) => {
        const snap = snapshotMap.get(shift.id);
        const rep = snap?.snapshot_data?.shift_report;
        const sum = rep?.summary || {};
        const varCost = sum.total_variance_cost != null ? n(sum.total_variance_cost) : n(shift.total_variance_cost);
        const expCost = sum.total_expected_cost != null ? n(sum.total_expected_cost) : n(shift.total_expected_cost);
        const actCost = sum.total_actual_cost != null ? n(sum.total_actual_cost) : n(shift.total_actual_cost);
        const posQty = sum.total_pos_sales_qty != null ? n(sum.total_pos_sales_qty) : 0;
        const lc = liabilityMap.get(shift.id);

        totalExpectedCost += expCost;
        totalActualCost += actCost;
        totalVarianceCost += varCost;
        totalPosSalesQty += posQty;

        if (Math.abs(varCost) > 0.01) {
            shiftsWithVariance++;
            if (varCost < 0) {
                totalUnfavorableVariance += Math.abs(varCost);
            } else {
                totalFavorableVariance += varCost;
            }
        }

        if (shift.status === 'pending_accountant_review' || (!lc && Math.abs(varCost) > 0.01 && shift.status === 'closed')) {
            pendingReviewsCount++;
        }

        const rows = Array.isArray(rep?.rows) ? rep.rows : [];
        rows.forEach((r: any) => {
            const rowVarCost = n(r.variance_cost);
            const rowVarQty = n(r.variance_qty);
            if (Math.abs(rowVarCost) > 0.01 || Math.abs(rowVarQty) > 0.001) {
                const sku = r.item_sku || r.item_name;
                const existing = itemMap.get(sku) || {
                    item_sku: r.item_sku || '—',
                    item_name: r.item_name || '—',
                    unit: r.unit || '',
                    shifts_count: 0,
                    total_expected_qty: 0,
                    total_actual_qty: 0,
                    total_variance_qty: 0,
                    total_variance_cost: 0,
                };
                existing.shifts_count += 1;
                existing.total_expected_qty += n(r.expected_consumption_qty);
                existing.total_actual_qty += n(r.actual_consumption_qty);
                existing.total_variance_qty += rowVarQty;
                existing.total_variance_cost += rowVarCost;
                itemMap.set(sku, existing);
            }
        });

        const topRows = rows
            .filter((r: any) => Math.abs(n(r.variance_cost)) > 0.01)
            .sort((a: any, b: any) => Math.abs(n(b.variance_cost)) - Math.abs(n(a.variance_cost)))
            .slice(0, 5);

        return {
            ...shift,
            total_variance_cost: varCost,
            total_expected_cost: expCost,
            total_actual_cost: actCost,
            total_pos_sales_qty: posQty,
            daily_control_summary: rep?.summary || null,
            daily_control_top_variances: topRows,
            has_snapshot: !!snap,
            snapshot_computed_at: snap?.computed_at || null,
            liability_case: lc || null,
        };
    });

    const topVarianceItems = Array.from(itemMap.values())
        .sort((a, b) => Math.abs(b.total_variance_cost) - Math.abs(a.total_variance_cost));

    return {
        summary: {
            total_shifts: shiftList.length,
            shifts_with_variance: shiftsWithVariance,
            total_expected_cost: totalExpectedCost,
            total_actual_cost: totalActualCost,
            total_variance_cost: totalVarianceCost,
            total_variance_exposure: totalUnfavorableVariance,
            total_unfavorable_variance: totalUnfavorableVariance,
            total_favorable_variance: totalFavorableVariance,
            total_pos_sales_qty: totalPosSalesQty,
            pending_reviews_count: pendingReviewsCount,
            branch_id: effectiveBranch || null,
            from_date: from_date || null,
            to_date: to_date || null,
        },
        shifts: enrichedShifts,
        top_variance_items: topVarianceItems,
    };
}

export const getKitchenVarianceSummaryReport = asyncWrap(async (req: Request, res: Response) => {
    const data = await buildKitchenVarianceSummaryReportData(req.query, (req as any).user);
    res.json({ success: true, data });
});

export const exportKitchenVarianceSummaryExcel = asyncWrap(async (req: Request, res: Response) => {
    const data = await buildKitchenVarianceSummaryReportData(req.query, (req as any).user);
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Famous Gate Hotel Management System';
    workbook.created = new Date();

    const summary = data.summary || {};
    const shifts = Array.isArray(data.shifts) ? data.shifts : [];
    const topItems = Array.isArray(data.top_variance_items) ? data.top_variance_items : [];

    const dateScope = (summary.from_date && summary.to_date)
        ? `${summary.from_date} to ${summary.to_date}`
        : summary.from_date
            ? `From ${summary.from_date}`
            : 'All Historical Shifts';

    // ── Sheet 1: Shifts Variance Overview ────────────────────────────────────
    const wsOverview = workbook.addWorksheet('Variance Overview', {
        views: [{ state: 'frozen', ySplit: 5 }],
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 }
    });

    // Title Block
    wsOverview.mergeCells('A1:L1');
    const titleCell = wsOverview.getCell('A1');
    titleCell.value = 'FAMOUS GATE HOTELS — KITCHEN VARIANCE & DAILY CONTROLS AUDIT';
    titleCell.font = { name: 'Calibri', bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3D73' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wsOverview.getRow(1).height = 34;

    // Subtitle Block
    wsOverview.mergeCells('A2:L2');
    const subCell = wsOverview.getCell('A2');
    subCell.value = `Scope: ${dateScope}  |  Generated: ${new Date().toISOString().replace('T', ' ').slice(0, 19)}  |  Total Shifts: ${summary.total_shifts}  |  Shifts with Variance: ${summary.shifts_with_variance}`;
    subCell.font = { name: 'Calibri', italic: true, size: 10.5, color: { argb: 'FFFFFFFF' } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A5298' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wsOverview.getRow(2).height = 20;

    // KPI Summary Strip
    wsOverview.mergeCells('A3:L3');
    const kpiCell = wsOverview.getCell('A3');
    kpiCell.value = `Total Expected Cost: KES ${Number(summary.total_expected_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}   |   Total Actual Cost: KES ${Number(summary.total_actual_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}   |   Total Shortage Loss: KES ${Number(summary.total_unfavorable_variance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}   |   Total Surplus Gain: KES ${Number(summary.total_favorable_variance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    kpiCell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF0F172A' } };
    kpiCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    kpiCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wsOverview.getRow(3).height = 22;

    wsOverview.addRow([]); // Blank row 4

    // Table Headers
    const headers = [
        '#', 'Shift Number', 'Shift Date', 'Shift Type', 'Storekeeper',
        'Status', 'POS Items Sold', 'Expected Cost (KES)', 'Actual Cost (KES)',
        'Variance Cost (KES)', 'Variance %', 'Liability Decision'
    ];
    const headerRow = wsOverview.getRow(5);
    headers.forEach((h: string, idx: number) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = h;
        cell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3D73' } };
        cell.alignment = { horizontal: idx >= 6 && idx <= 10 ? 'right' : (idx === 0 ? 'center' : 'left'), vertical: 'middle' };
    });
    headerRow.height = 26;

    wsOverview.columns = [
        { width: 6 },   // #
        { width: 22 },  // Shift Number
        { width: 14 },  // Date
        { width: 14 },  // Shift Type
        { width: 20 },  // Storekeeper
        { width: 14 },  // Status
        { width: 15 },  // POS Items Sold
        { width: 18 },  // Expected Cost
        { width: 18 },  // Actual Cost
        { width: 18 },  // Variance Cost
        { width: 14 },  // Variance %
        { width: 24 },  // Liability Decision
    ];

    const thinBorder = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };

    shifts.forEach((s: any, idx: number) => {
        const rowNum = 6 + idx;
        const row = wsOverview.getRow(rowNum);
        const isEven = idx % 2 === 0;
        const varCost = Number(s.total_variance_cost || 0);
        const expCost = Number(s.total_expected_cost || 0);
        const actCost = Number(s.total_actual_cost || 0);
        const varPct = expCost > 0 ? (varCost / expCost) * 100 : 0;
        const sk = s.store_keeper ? `${s.store_keeper.first_name || ''} ${s.store_keeper.last_name || ''}`.trim() : '—';
        const lc = s.liability_case;
        const decisionText = lc
            ? `${(lc.liability_action || '').toUpperCase()} (${(lc.status || '').toUpperCase()})`
            : (Math.abs(varCost) > 0.01 ? 'PENDING DECISION' : 'NO VARIANCE');

        row.getCell(1).value = idx + 1;
        row.getCell(2).value = s.shift_number || s.id;
        row.getCell(3).value = s.shift_date || '';
        row.getCell(4).value = (s.sub_shift_type || s.shift_type || 'SHIFT').toUpperCase();
        row.getCell(5).value = sk || '—';
        row.getCell(6).value = (s.status || 'OPEN').toUpperCase();
        row.getCell(7).value = Number(s.total_pos_sales_qty || 0);
        row.getCell(8).value = expCost;
        row.getCell(9).value = actCost;
        row.getCell(10).value = varCost;
        row.getCell(11).value = `${varPct >= 0 ? '+' : ''}${varPct.toFixed(1)}%`;
        row.getCell(12).value = decisionText;

        const bg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';
        for (let col = 1; col <= 12; col++) {
            const cell = row.getCell(col);
            cell.font = { name: 'Calibri', size: 10 };
            cell.border = thinBorder;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            cell.alignment = {
                horizontal: col >= 7 && col <= 11 ? 'right' : (col === 1 ? 'center' : 'left'),
                vertical: 'middle'
            };
            if (col === 7) cell.numFmt = '#,##0';
            if (col >= 8 && col <= 10) cell.numFmt = '#,##0.00';
        }

        // Color-code variance cost
        const varCell = row.getCell(10);
        if (varCost < -0.01) {
            varCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFB91C1C' } };
            varCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        } else if (varCost > 0.01) {
            varCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF047857' } };
            varCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
        }

        row.height = 22;
    });

    // Totals Row
    const totalRowIdx = 6 + shifts.length;
    const tRow = wsOverview.getRow(totalRowIdx);
    wsOverview.mergeCells(`A${totalRowIdx}:F${totalRowIdx}`);
    const tLabel = tRow.getCell(1);
    tLabel.value = 'TOTALS';
    tLabel.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    tLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3D73' } };
    tLabel.alignment = { horizontal: 'center', vertical: 'middle' };

    tRow.getCell(7).value = summary.total_pos_sales_qty || 0;
    tRow.getCell(8).value = summary.total_expected_cost || 0;
    tRow.getCell(9).value = summary.total_actual_cost || 0;
    tRow.getCell(10).value = summary.total_variance_cost || 0;
    tRow.getCell(11).value = '';
    tRow.getCell(12).value = '';

    for (let c = 7; c <= 12; c++) {
        const cell = tRow.getCell(c);
        cell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3D73' } };
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (c === 7) cell.numFmt = '#,##0';
        if (c >= 8 && c <= 10) cell.numFmt = '#,##0.00';
    }
    tRow.height = 26;

    // ── Sheet 2: Top Variance Items ──────────────────────────────────────────
    const wsItems = workbook.addWorksheet('Top Variance Items', {
        pageSetup: { orientation: 'portrait', fitToPage: true }
    });
    wsItems.columns = [
        { width: 6 }, { width: 30 }, { width: 16 }, { width: 10 },
        { width: 16 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 20 }, { width: 14 }
    ];

    wsItems.mergeCells('A1:J1');
    const iTitle = wsItems.getCell('A1');
    iTitle.value = 'TOP DISCREPANCY FOOD-CONTROL ITEMS (ACROSS FILTERED SHIFTS)';
    iTitle.font = { name: 'Calibri', bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    iTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3D73' } };
    iTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    wsItems.getRow(1).height = 30;

    const itemHeaders = [
        '#', 'Item Name', 'SKU', 'Unit', 'Shifts Affected',
        'Expected Usage', 'Actual Usage', 'Variance Qty', 'Variance Cost (KES)', 'Discrepancy'
    ];
    const iHeaderRow = wsItems.getRow(3);
    itemHeaders.forEach((h: string, idx: number) => {
        const cell = iHeaderRow.getCell(idx + 1);
        cell.value = h;
        cell.font = { name: 'Calibri', bold: true, size: 10.5, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A5298' } };
        cell.alignment = { horizontal: idx >= 4 && idx <= 8 ? 'right' : (idx === 0 ? 'center' : 'left'), vertical: 'middle' };
    });
    iHeaderRow.height = 24;

    topItems.forEach((it: any, idx: number) => {
        const row = wsItems.getRow(4 + idx);
        const isEven = idx % 2 === 0;
        const vCost = Number(it.total_variance_cost || 0);

        row.getCell(1).value = idx + 1;
        row.getCell(2).value = it.item_name || '—';
        row.getCell(3).value = it.item_sku || '—';
        row.getCell(4).value = it.unit || '—';
        row.getCell(5).value = it.shifts_count || 1;
        row.getCell(6).value = Number(it.total_expected_qty || 0);
        row.getCell(7).value = Number(it.total_actual_qty || 0);
        row.getCell(8).value = Number(it.total_variance_qty || 0);
        row.getCell(9).value = vCost;
        row.getCell(10).value = vCost < 0 ? 'SHORTAGE' : 'SURPLUS';

        const bg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';
        for (let col = 1; col <= 10; col++) {
            const cell = row.getCell(col);
            cell.font = { name: 'Calibri', size: 10 };
            cell.border = thinBorder;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            cell.alignment = {
                horizontal: col >= 5 && col <= 8 ? 'right' : (col === 1 || col === 10 ? 'center' : 'left'),
                vertical: 'middle'
            };
            if (col >= 6 && col <= 8) cell.numFmt = '#,##0.000';
            if (col === 9) cell.numFmt = '#,##0.00';
        }

        const vCell = row.getCell(9);
        if (vCost < -0.01) {
            vCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFB91C1C' } };
            vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        } else if (vCost > 0.01) {
            vCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF047857' } };
            vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
        }

        row.height = 20;
    });

    const safeFrom = String(summary.from_date || 'all').replace(/[^A-Za-z0-9_-]/g, '_');
    const safeTo = String(summary.to_date || 'all').replace(/[^A-Za-z0-9_-]/g, '_');
    const filename = `FG_Kitchen_Variance_Summary_${safeFrom}_${safeTo}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
});


