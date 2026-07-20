import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { creditOutletItemStock, updateBranchStock } from '../services/branch-inventory.service';
import { normalizeQty } from '../utils/unitNormalization';
import { getActiveShiftMode } from '../services/shiftConfigService';
import db from '../db';

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
const todayInNairobi = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
const OPENING_STOCKTAKE_ACCEPTED_STATUSES = ['submitted', 'reviewed', 'approved', 'posted'];
const BREAKFAST_ELIGIBLE_MEAL_PLANS = ['bb', 'hb', 'fb', 'bed_breakfast', 'half_board', 'full_board', 'bed & breakfast', 'half board', 'full board'];
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

    const items = params.openingItems.map((it: any) => ({
        shift_id: shift.id,
        branch_id: params.branchId,
        item_sku: it.sku,
        item_name: it.name,
        unit_of_measure: it.unit,
        cost_price: n(it.cost_price),
        opening_stock: n(it.quantity),
        additions: 0,
        sold_quantity: 0,
        spoilage_quantity: 0
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

function mealPlanIncludesBreakfast(value: unknown): boolean {
    const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (!normalized) return false;
    return BREAKFAST_ELIGIBLE_MEAL_PLANS.some((code) => normalized.includes(code));
}

async function getBreakfastPaxControl(branchId: number, date: string) {
    const [{ data: control, error: controlError }, { data: reservations, error: reservationsError }] = await Promise.all([
        supabase
            .from('accommodation_breakfast_pax')
            .select('*')
            .eq('branch_id', branchId)
            .eq('breakfast_date', date)
            .maybeSingle(),
        supabase
            .from('reservations')
            .select('adults,children,meal_plan')
            .eq('branch_id', branchId)
            .eq('status', 'checked_in')
            .lte('check_in_date', date)
            .gt('check_out_date', date)
    ]);

    if (controlError) throw new AppError(controlError.message, 500);
    if (reservationsError) throw new AppError(reservationsError.message, 500);

    let calculatedPax = 0;
    (reservations || []).forEach((row: any) => {
        if (mealPlanIncludesBreakfast(row.meal_plan)) {
            calculatedPax += Number(row.adults || 0) + Number(row.children || 0);
        }
    });

    return {
        branch_id: branchId,
        breakfast_date: date,
        calculated_pax: calculatedPax,
        confirmed_pax: control?.confirmed_pax ?? calculatedPax,
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
        const { data: invItems, error: invErr } = invIds.length > 0
            ? await supabase
                .from('inventory_items')
                .select('id,sku,item_name,unit,default_unit_cost')
                .in('id', invIds)
            : { data: [], error: null as any };
        if (invErr) throw new AppError(invErr.message, 500);

        const invMap = new Map((invItems || []).map((item: any) => [item.id, item]));
        const openingItems = rawItems.map((item: any) => {
            const inv = item.inventory_item_id ? invMap.get(item.inventory_item_id) : null;
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
            .is('sub_shift_type', null)
            .eq('department', dept)
            .maybeSingle();
        if (existingSingleShift) {
            throw new AppError(`KITCHEN_SHIFT_ALREADY_OPEN: A single kitchen session (${dept}) has already been opened for this commercial day`, 409);
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
        const foodControlType: string = typeResult || 'UNREGISTERED';

        let recipeId: string | null = it.recipe_id || null;
        if (foodControlType === 'A_RECIPE_BOM' && !recipeId) {
            throw new AppError(`BOM_DECLARATION_REQUIRED: ${it.name || it.sku} is a recipe item — select which recipe this batch is for`, 400);
        }
        if (foodControlType !== 'A_RECIPE_BOM') {
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
                unit_of_measure: baseUnit, cost_price: n(it.cost_price), opening_stock: 0, additions: normalizedQty, sold_quantity: 0, spoilage_quantity: 0
            }).select().single();
            results.push({ ...cr, food_control_type: foodControlType });
        }
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
        returned_quantity,
        return_notes,
        process_loss_quantity,
        wastage_quantity,
        wastage_reason
    } = req.body || {};

    const userId = req.user?.id || '';
    const userBranchId = req.user?.branch_id;

    if (n(returned_quantity) <= 0) {
        throw new AppError('returned_quantity must be greater than zero', 400);
    }
    if (n(process_loss_quantity) < 0) {
        throw new AppError('process_loss_quantity cannot be negative', 400);
    }
    if (n(wastage_quantity) < 0) {
        throw new AppError('wastage_quantity cannot be negative', 400);
    }
    if (n(wastage_quantity) > 0 && !String(wastage_reason || '').trim()) {
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
    if (!PREP_BATCH_STATUSES.includes(String(batch.status))) {
        throw new AppError('Invalid prep batch status', 400);
    }
    if (batch.status !== 'sent') {
        throw new AppError('This prep batch has already been received or cancelled', 400);
    }
    if (Number(batch.branch_id) !== Number(userBranchId)) {
        throw new AppError('BRANCH_SCOPE_VIOLATION: Branch does not match user context', 403);
    }

    const { data: shift } = await supabase
        .from('kitchen_shifts')
        .select('id, branch_id, shift_number')
        .eq('id', shift_id)
        .maybeSingle();
    if (!shift) throw new AppError('Shift not found', 404);

    const producedInventoryId = batch.produced_inventory_item_id?.toString();
    const producedSku = String(batch.produced_item_sku || '').trim();
    if (!producedInventoryId || !producedSku) {
        throw new AppError('Processed inventory item is not configured on this prep batch', 400);
    }

    const { data: producedInventory } = await supabase
        .from('inventory_items')
        .select('id, sku, unit')
        .eq('id', producedInventoryId)
        .maybeSingle();
    if (!producedInventory) throw new AppError('Processed inventory item not found', 404);

    const normalizedReturnedQty = await normalizeQty(
        n(returned_quantity),
        batch.produced_unit || producedInventory.unit || 'portion',
        producedInventory.unit || batch.produced_unit || 'portion',
        producedInventory.id,
        shift.branch_id
    );

    const processLossQty = n(process_loss_quantity);
    const wastageQty = n(wastage_quantity);
    const rawUnit = String(batch.raw_unit || '').trim() || 'unit';
    const producedUnit = String(producedInventory.unit || batch.produced_unit || '').trim() || 'unit';
    const unexplainedVarianceQuantity =
        canonicalUnitLabel(rawUnit) === canonicalUnitLabel(producedUnit)
            ? Number((n(batch.raw_quantity_sent) - normalizedReturnedQty - processLossQty - wastageQty).toFixed(3))
            : null;

    await updateBranchStock(
        Number(shift.branch_id),
        producedInventory.sku,
        normalizedReturnedQty,
        'KITCHEN_PREP_RETURNED',
        userId,
        'kitchen_prep_batch',
        batch.id,
        shift.shift_number,
        return_notes || `Prep return received for ${batch.produced_item_name}`
    );

    const { data: updated, error: updateError } = await supabase
        .from('kitchen_prep_batches')
        .update({
            returned_quantity: normalizedReturnedQty,
            returned_unit: producedInventory.unit || batch.produced_unit,
            process_loss_quantity: processLossQty,
            process_loss_unit: rawUnit,
            wastage_quantity: wastageQty,
            wastage_unit: rawUnit,
            wastage_reason: String(wastage_reason || '').trim() || null,
            unexplained_variance_quantity: unexplainedVarianceQuantity,
            unexplained_variance_unit:
                unexplainedVarianceQuantity === null ? null : rawUnit,
            status: 'returned',
            return_notes: return_notes || null,
            returned_by: userId,
            returned_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
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

        await supabase.from('kitchen_shift_items').update({ sold_quantity: n(raw.sold_quantity) + n(p.raw_quantity_used) }).eq('id', raw.id);
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
            const { data: bill, error: billError } = await supabase.from('staff_credit_bills').insert({
                staff_id: staffId,
                amount: varianceCost,
                description: `Production shortfall — ${prod.produced_item_name} (expected ${expected}, actual ${actual})`,
                bill_date: new Date().toISOString().split('T')[0],
                status: 'accountant_confirmed',
                balance: varianceCost,
                paid_amount: 0,
                shift_id,
                branch_id: prod.branch_id,
                approved_at: new Date().toISOString(),
                approved_by: userId
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
    const requiresHandover = shift.sub_shift_type === 'A';
    const outgoingWitnesses: string[] = Array.isArray(outgoing_witness_ids) ? outgoing_witness_ids : [];
    const incomingWitnesses: string[] = Array.isArray(incoming_witness_ids) ? incoming_witness_ids : [];
    if (requiresHandover && (outgoingWitnesses.length === 0 || incomingWitnesses.length === 0)) {
        res.status(400).json({
            success: false,
            code: 'HANDOVER_WITNESSES_REQUIRED',
            message: 'Both the outgoing shift team and the incoming shift team must be named as witnesses before this shift can close.'
        });
        return;
    }

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

// ── ACCOUNTANT REVIEW ─────────────────────────────────────
export const accountantReviewShift = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const { approved, notes, liability_action, allocations, write_off_reason } = req.body;
    const userId = (req as any).user?.id;
    const { data: shift } = await supabase
        .from('kitchen_shifts')
        .select('id,branch_id,status,shift_number,total_variance_cost')
        .eq('id', shift_id)
        .single();
    if (!shift) throw new AppError('Shift not found', 404);
    if (shift.status !== 'pending_accountant_review') throw new AppError('Not pending review', 400);
    const next = approved ? 'approved' : 'rejected';
    const action = liability_action || (approved ? 'approve_only' : 'rejected');

    if (approved && action === 'write_off' && !String(write_off_reason || notes || '').trim()) {
        throw new AppError('Write-off reason is required', 400);
    }

    // Deliberate-allocation guard: when the accountant explicitly chooses
    // liability_action='staff_liability', credit bills must never be
    // auto-created from a blank allocation list — the accountant must name
    // who is being billed and how much.
    if (approved && action === 'staff_liability' && absMoney(shift.total_variance_cost) > 0) {
        if (!Array.isArray(allocations) || allocations.length === 0) {
            res.status(400).json({
                success: false,
                code: 'ALLOCATIONS_REQUIRED',
                message: 'Staff liability allocations must be explicitly provided by the accountant before credit bills are created.'
            });
            return;
        }
    }

    const { data: upd } = await supabase.from('kitchen_shifts').update({
        status: next, accountant_reviewed_by: userId, accountant_reviewed_at: new Date().toISOString(),
        accountant_approved_by: approved ? userId : null, accountant_approved_at: approved ? new Date().toISOString() : null,
        accountant_rejection_reason: approved ? null : notes, updated_at: new Date().toISOString()
    }).eq('id', shift_id).select().single();

    let liabilityCase: any = null;
    const creditBills: any[] = [];
    const varianceCost = absMoney(shift.total_variance_cost);
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
            for (const allocation of normalizedAllocations) {
                const amount = absMoney(allocation.amount);
                if (amount <= 0) continue;
                const staffId = await resolveStaffProfileId(
                    allocation.staff_profile_id || allocation.staff_id || allocation.user_id
                );
                if (!staffId) continue;
                const { data: bill, error: billError } = await supabase
                    .from('staff_credit_bills')
                    .insert({
                        staff_id: staffId,
                        amount,
                        description: allocation.description || `Kitchen variance liability - ${shift.shift_number}`,
                        bill_date: new Date().toISOString().split('T')[0],
                        status: 'accountant_confirmed',
                        balance: amount,
                        paid_amount: 0,
                        shift_id,
                        branch_id: shift.branch_id,
                        approved_at: new Date().toISOString(),
                        approved_by: userId
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
    const [{ data: items }, { data: prods }, { data: prodInputs }, { data: st }, { data: aprv }, { data: liabilityCases }] = await Promise.all([
        supabase.from('kitchen_shift_items').select('*').eq('shift_id', shift_id).order('item_name'),
        supabase.from('kitchen_shift_production').select('*').eq('shift_id', shift_id).order('produced_at', { ascending: false }),
        supabase.from('kitchen_shift_production_inputs').select('*').eq('shift_id', shift_id).order('created_at', { ascending: false }),
        supabase.from('kitchen_shift_stock_take').select('*').eq('shift_id', shift_id).order('item_name'),
        supabase.from('kitchen_shift_approvals').select('*').eq('shift_id', shift_id).order('approved_at', { ascending: false }),
        supabase.from('kitchen_shift_liability_cases').select('*').eq('shift_id', shift_id).order('created_at', { ascending: false })
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
    res.json({ success: true, data: { shift, items: items || [], productions: enrichedProductions, stock_take: st || [], approvals: aprv || [], liability_cases: liabilityCases || [], shift_staff: staff, summary } });
});

// ── LIST SHIFTS ─────────────────────────────────────────────
export const listKitchenShifts = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id, status, shift_date, from_date, to_date } = req.query;
    let q = supabase.from('kitchen_shifts').select('*, store_keeper:users!store_keeper_id(first_name,last_name)').order('opened_at', { ascending: false });
    if (branch_id) q = q.eq('branch_id', branch_id);
    if (status) q = q.eq('status', status);
    if (shift_date) q = q.eq('shift_date', shift_date);
    if (from_date) q = q.gte('shift_date', from_date);
    if (to_date) q = q.lte('shift_date', to_date);
    const { data, error } = await q;
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: data || [] });
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
    if (resolvedPrepStageCode && !['PEEL', 'CUT', 'PREP_OTHER'].includes(resolvedPrepStageCode)) {
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
        created_by: userId
    }));

    const { data, error } = await supabase
        .from('kitchen_production_recipes')
        .insert(insertRows)
        .select();
    if (error) throw new AppError(error.message, 500);

    // Insert inputs into the new table
    const inputRows: any[] = [];
    for (const recipe of data) {
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
    const { error: inputsError } = await supabase.from('kitchen_production_recipe_inputs').insert(inputRows);
    if (inputsError) throw new AppError(inputsError.message, 500);

    await Promise.all(normalizedOutputs.map((output: any) =>
        applyPoolLink(output.pos_outlet_item_id, output.pool_item_id, output.pool_fraction)
    ));
    res.status(201).json({ success: true, data: outputs.length > 0 ? data : data?.[0] });
});

export const updateProductionRecipe = asyncWrap(async (req: Request, res: Response) => {
    const { recipe_id } = req.params;
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
        if (payload.prep_stage_code && !['PEEL', 'CUT', 'PREP_OTHER'].includes(payload.prep_stage_code)) {
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
    if (error) throw new AppError(error.message, 500);

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
    const { branch_id, yield_type } = req.query;
    let q = supabase.from('kitchen_production_recipes').select('*, inputs:kitchen_production_recipe_inputs(*)').eq('is_active', true).order('recipe_name');
    if (branch_id) q = q.eq('branch_id', branch_id);
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
    const { data, error } = await supabase
        .from('pos_outlet_items')
        .select('id, name, sku, unit, category, item_group, track_stock, source_table')
        .eq('branch_id', branch_id)
        .eq('is_active', true)
        .order('name', { ascending: true });
    if (error) throw new AppError(error.message, 500);
    
    // Filter out Bar items so Kitchen only sees Restaurant items
    const restaurantItems = (data || []).filter((item: any) => !isBarItem(item));
    
    res.json({ success: true, data: restaurantItems });
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
    const { data, error } = await supabase
        .from('food_control_direct_items')
        .select('*, pos_outlet_item:pos_outlet_items(id,name,sku,unit)')
        .eq('branch_id', Number(branch_id))
        .eq('is_active', true)
        .order('stock_item_name');
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: data || [] });
});

export const createDirectItem = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id, stock_item_sku, stock_item_name, pos_outlet_item_id } = req.body;
    if (!branch_id || !stock_item_sku || !pos_outlet_item_id) {
        throw new AppError('branch_id, stock_item_sku and pos_outlet_item_id are required', 400);
    }
    const userId = (req as any).user?.id;
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
    const { data, error } = await supabase
        .from('food_control_exempt_items')
        .select('*, pos_outlet_item:pos_outlet_items(id,name,sku,unit,category)')
        .eq('branch_id', Number(branch_id))
        .order('created_at', { ascending: false });
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
    const { data: items, error } = await supabase
        .from('pos_outlet_items')
        .select('id, name, sku, category, unit, stock_pool_item_id, item_group, source_table')
        .eq('branch_id', Number(branch_id))
        .eq('is_active', true);
    if (error) throw new AppError(error.message, 500);

    const candidates = (items || []).filter((item) => !isBarItem(item) && !item.stock_pool_item_id);
    const skus = Array.from(new Set(candidates.map((item) => item.sku).filter(Boolean)));
    const types = new Map<string, string>();
    await Promise.all(skus.map(async (sku) => {
        const { data } = await supabase.rpc('get_stock_item_food_control_type', {
            p_branch_id: Number(branch_id),
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
    if (!['super_admin', 'director', 'general_manager', 'hr_manager', 'branch_manager', 'branch_accountant'].includes(userRole)) {
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
    const branch_id = req.query.branch_id || req.user?.branch_id;
    
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
        report_version: 1,
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
        supabase
            .from('kitchen_shift_pos_consumption')
            .select('raw_item_sku, raw_item_name, raw_quantity_consumed, raw_unit, portions_sold, pos_outlet_item_id')
            .eq('shift_id', shiftId),
        supabase
            .from('food_control_direct_items')
            .select('stock_item_sku, stock_item_name')
            .eq('branch_id', shift.branch_id)
            .eq('is_active', true),
    ]);

    if (itemsError) throw new AppError(itemsError.message, 500);
    if (addsError) throw new AppError(addsError.message, 500);
    if (standardsError) throw new AppError(standardsError.message, 500);
    if (recipesError) throw new AppError(recipesError.message, 500);
    if (posConsumptionError) throw new AppError(posConsumptionError.message, 500);
    if (directFoodControlError) throw new AppError(directFoodControlError.message, 500);

    const shiftItemsList = (shiftItems || []) as any[];
    const additionsList = (additions || []) as any[];
    const standardsList = (standards || []) as any[];
    const activeRecipes = (recipeRows || []) as any[];
    const posConsumptionList = (posConsumptionRows || []) as any[];
    const directFoodControlList = (directFoodControlRows || []) as any[];
    const recipeIds = activeRecipes.map((row: any) => row.id).filter(Boolean);
    const { data: recipeInputs, error: recipeInputsError } = recipeIds.length
        ? await supabase
            .from('kitchen_production_recipe_inputs')
            .select('recipe_id, raw_item_sku, raw_item_name')
            .in('recipe_id', recipeIds)
        : { data: [], error: null } as any;
    if (recipeInputsError) throw new AppError(recipeInputsError.message, 500);

    const controlledSkuSet = new Set<string>();
    for (const row of standardsList) {
        const sku = String(row.raw_item_sku || '').trim();
        if (sku) controlledSkuSet.add(sku);
    }
    for (const row of activeRecipes) {
        const sku = String(row.raw_item_sku || '').trim();
        if (sku) controlledSkuSet.add(sku);
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

    const eventRefIds = [...new Set(
        additionsList
            .map((row: any) => String(row.reference_id || '').trim())
            .filter(Boolean)
    )];

    const { data: eventOrders, error: eventOrdersError } = eventRefIds.length
        ? await supabase
            .from('event_orders')
            .select('id, pax, menu_package, package_definition_id, event_name, event_type')
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

    for (const sale of posConsumptionList) {
        const sku = String(sale.raw_item_sku || '').trim();
        if (!controlledSkuSet.has(sku)) continue;
        const rawQtyConsumed = n(sale.raw_quantity_consumed);
        if (rawQtyConsumed <= 0) continue;
        addExpectedQty(sku, rawQtyConsumed);
        posSalesQtyBySku.set(
            sku,
            (posSalesQtyBySku.get(sku) || 0) + rawQtyConsumed
        );
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

    const { data: inventoryItems } = controlledSkus.length
        ? await supabase
            .from('inventory_items')
            .select('sku, item_name, unit')
            .in('sku', controlledSkus)
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
    const shiftItemBySku = new Map<string, any>();
    for (const item of shiftItemsList) {
        const sku = String(item.item_sku || '').trim();
        if (sku && !shiftItemBySku.has(sku)) {
            shiftItemBySku.set(sku, item);
        }
    }
    const allSkus = [...new Set([
        ...controlledSkus,
        ...[...expectedQtyBySku.keys()].filter((sku) => controlledSkuSet.has(sku)),
        ...[...additionsBySku.keys()].filter((sku) => controlledSkuSet.has(sku)),
    ])];

    const rows: DailyControlRow[] = allSkus.map((sku) => {
        const item = shiftItemBySku.get(sku) || {};
        const inventoryItem = inventoryBySku.get(sku) || {};
        const standard = standardBySku.get(sku) || {};
        const itemName = String(
            item.item_name ||
            inventoryItem.item_name ||
            standard.raw_item_name ||
            sku ||
            'Unnamed Item'
        );
        const unit = String(
            item.unit_of_measure ||
            item.unit ||
            inventoryItem.unit ||
            standard.raw_item_unit ||
            'unit'
        );
        const openingQty = n(item.opening_stock);
        const additionsQty = additionsBySku.get(sku) ?? n(item.additions);
        const posSalesQty = n(posSalesQtyBySku.get(sku) ?? item.sold_quantity);
        const spoilageQty = n(item.spoilage_quantity);
        const systemClosingQty = openingQty + additionsQty - posSalesQty - spoilageQty;
        const physicalClosingQty =
            item.physical_count != null
                ? n(item.physical_count)
                : item.system_closing_stock != null
                    ? n(item.system_closing_stock)
                    : systemClosingQty;
        const actualConsumptionQty = Math.max(
            0,
            Number((openingQty + additionsQty - physicalClosingQty - spoilageQty).toFixed(3))
        );
        const expectedConsumptionQty = n(expectedQtyBySku.get(sku) || 0);
        const varianceQty = Number((actualConsumptionQty - expectedConsumptionQty).toFixed(3));
        const costPrice = n(item.cost_price);
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

        return {
            item_sku: sku,
            item_name: itemName,
            unit,
            main_channel: channelBreakdown[0]?.channel_name || 'POS Restaurant',
            opening_qty: Number(openingQty.toFixed(3)),
            additions_qty: Number(additionsQty.toFixed(3)),
            pos_sales_qty: Number(posSalesQty.toFixed(3)),
            spoilage_qty: Number(spoilageQty.toFixed(3)),
            system_closing_qty: Number(systemClosingQty.toFixed(3)),
            physical_closing_qty: Number(physicalClosingQty.toFixed(3)),
            actual_consumption_qty: actualConsumptionQty,
            expected_consumption_qty: Number(expectedConsumptionQty.toFixed(3)),
            variance_qty: varianceQty,
            cost_price: Number(costPrice.toFixed(2)),
            expected_cost: expectedCost,
            actual_cost: actualCost,
            variance_cost: varianceCost,
            channel_breakdown: channelBreakdown,
        };
    }).filter((row) => row.item_sku.trim().length > 0);

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

    return {
        shift,
        rows,
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

export const getShiftDailyControlsReport = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
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
        res.status(200).json({
            success: true,
            data: toFrozenShiftDailyControlsResponse(
                frozenShiftSnapshot.payload,
                frozenShiftSnapshot.computedAt
            ),
        });
        return;
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
                res.status(200).json({
                    success: true,
                    data: {
                        ...matched,
                        frozen: true,
                        frozen_at: frozenSnapshot?.computed_at ?? null,
                    },
                });
                return;
            }
        }
    }

    if (['closed', 'pending_chef_confirmation', 'pending_accountant_review', 'approved', 'rejected'].includes(String(shiftRow.status || '').toLowerCase())) {
        const persistedSnapshot = await persistKitchenShiftControlSnapshot(String(shift_id));
        res.status(200).json({
            success: true,
            data: toFrozenShiftDailyControlsResponse(
                persistedSnapshot.payload,
                persistedSnapshot.computedAt
            ),
        });
        return;
    }

    const report = await buildShiftDailyControlsData(shift_id);

    res.status(200).json({
        success: true,
        data: {
            ...toShiftDailyControlsApiPayload(report),
            frozen: false,
            frozen_at: null,
        },
    });
});


