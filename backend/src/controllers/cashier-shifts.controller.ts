import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { applyBranchFilter, isGlobalRole } from '../utils/branchIsolation';
import notificationService from '../services/notification.service';
import { loadCashierVoidAudit, compileShiftVoidAudit } from '../services/cashier-void-audit.service';
import {
    loadAssignedPosOutlets,
    canAccessPosOutlet,
    stationTypesForCashierRole,
    isBarStationType,
    shouldRestrictCashierStationAccess,
    assignedOutletIds,
    type PosOutlet,
} from '../utils/posStationAccess';

// ==========================================
// SHIFT LOGBOOK
// ==========================================

const SHIFT_MANAGER_ROLES = new Set([
    'super_admin',
    'general_manager',
    'director',
    'branch_manager',
    'accountant',
    'branch_accountant',
    'auditor',
    'it_manager'
]);

// The server runs on UTC, but branches operate on Africa/Nairobi (UTC+3)
// local time. Between 00:00 and 03:00 EAT, new Date().toISOString() still
// reports the previous day, so the stocktake gate below must compare against
// today's date in branch-local time, not server UTC, or a stocktake genuinely
// submitted "today" in Nairobi looks like it belongs to "yesterday" and the
// gate never clears for overnight/early-morning shift opens.
function todayInBranchTimezone(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
}

function parsePositiveInt(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function isNullifiedZeroPosOrder(order: any): boolean {
    const totalAmount = Number(order?.total_amount || 0);
    const amountPaid = Number(order?.amount_paid || 0);
    const balanceAmount = Number(order?.balance_amount || 0);
    const status = String(order?.status || '').toLowerCase();
    const paymentStatus = String(order?.payment_status || '').toLowerCase();
    const items = Array.isArray(order?.items) ? order.items : [];

    if (!['open', 'unpaid', 'partial'].includes(status) && !['unpaid', 'partial'].includes(paymentStatus)) {
        return false;
    }

    if (totalAmount !== 0 || amountPaid !== 0 || balanceAmount !== 0) {
        return false;
    }

    if (!items.length) {
        return true;
    }

    return items.every((item: any) => {
        const activeQty = Number(item?.active_qty ?? item?.quantity ?? item?.qty ?? 0);
        const activeTotal = Number(item?.active_total ?? item?.line_total ?? 0);
        return item?.is_fully_voided === true
            || (activeQty <= 0 && activeTotal <= 0)
            || Number(item?.voided_qty || 0) >= Number(item?.quantity || item?.qty || 0);
    });
}

function isShiftManager(role?: unknown): boolean {
    const normalized = String(role || '').toLowerCase();
    return SHIFT_MANAGER_ROLES.has(normalized) || isGlobalRole(normalized);
}

// A cashier only needs the stocktake for the station they actually serve —
// a restaurant cashier never touches bar stock, and a bar cashier never
// touches the kitchen, so gating either one on the other's stocktake just
// blocks shifts on irrelevant data. Executive Bar only exists at Kyogong
// (branch 1); every other branch's bar cashier is gated on main_bar instead.
function requiredStocktakeLocationsForRole(
    role: unknown,
    branchId: number
): Array<{ key: string; label: string; groupStoreType?: string }> {
    const normalized = stationTypesForCashierRole(role, branchId).includes('restaurant')
        ? 'restaurant_cashier'
        : String(role || '').trim().toLowerCase();
    switch (normalized) {
        case 'restaurant_cashier':
        case 'choma_zone_cashier':
            // Kitchen syncs one stock_counts row PER SHIFT (location: kitchen_a,
            // kitchen_b, ...) so an A-shift count can't overwrite a B-shift count
            // in the same day — group-match on store_type, rather than an exact
            // 'kitchen' location that no row ever has anymore. Choma Zone shares
            // this gate too — its grilled dishes (e.g. "Mbuzi Choma") are part of
            // the same KITCHEN_STOCKTAKE_ITEMS list, not a separate stocktake.
            return [{ key: 'kitchen', label: 'Kitchen stocktake', groupStoreType: 'kitchen' }];
        case 'main_bar_cashier':
        case 'kyogong_sports_bar_cashier':
            return [{ key: 'main_bar', label: 'Bar stocktake' }];
        case 'executive_bar_cashier':
        case 'kyogong_executive_bar_cashier':
            return branchId === 1
                ? [{ key: 'executive_bar', label: 'Executive Bar stocktake' }]
                : [{ key: 'main_bar', label: 'Bar stocktake' }];
        default:
            // No station-specific stocktake applies to this role (e.g.
            // non-consumables, reception, spa) — nothing to gate on.
            return [];
    }
}

/**
 * Ensure the stocktake(s) relevant to this cashier's own station are
 * submitted for the branch/date before their shift can be opened/approved.
 *
 * All counts are stored in the unified stock_counts table. A location is
 * considered complete if there is at least one non-draft, non-rejected count
 * for that branch/date/location.
 *
 * For Bar/Kitchen groups, ANY matching store_type counts as complete (e.g.
 * main_bar or executive_bar for Bar; kitchen_a or kitchen_b for Kitchen).
 *
 * Returns { ok: true } if all are complete, otherwise { ok: false, missing: [...] }.
 */
async function verifyStocktakesComplete(
    branchId: number,
    date: string,
    cashierRole: unknown
): Promise<{ ok: boolean; missing: string[] }> {
    const requiredLocations = requiredStocktakeLocationsForRole(cashierRole, branchId);
    if (requiredLocations.length === 0) {
        return { ok: true, missing: [] };
    }

    // Check each required location separately
    const missing: string[] = [];

    for (const loc of requiredLocations) {
        if (loc.groupStoreType) {
            // Group match: ANY location under this store_type counts (e.g.
            // any bar location, or any kitchen shift A/B/... for the date).
            const { data: groupCounts, error: groupError } = await supabase
                .from('stock_counts')
                .select('location')
                .eq('branch_id', branchId)
                .eq('count_date', date)
                .eq('store_type', loc.groupStoreType)
                .not('status', 'in', '(draft,rejected)')
                .limit(1);

            if (groupError) throw groupError;
            if (!groupCounts || groupCounts.length === 0) {
                missing.push(loc.label);
            }
        } else {
            // Exact location match
            const { data: locCounts, error: locError } = await supabase
                .from('stock_counts')
                .select('location')
                .eq('branch_id', branchId)
                .eq('count_date', date)
                .eq('location', loc.key)
                .not('status', 'in', '(draft,rejected)')
                .limit(1);

            if (locError) throw locError;
            if (!locCounts || locCounts.length === 0) {
                missing.push(loc.label);
            }
        }
    }

    return { ok: missing.length === 0, missing };
}

const seedPosOutletShiftStockCounts = async (
    shiftId: string,
    outletId: string
): Promise<void> => {
    const { data: existingCounts, error: existingError } = await supabase
        .from('pos_shift_stock_counts')
        .select('id')
        .eq('shift_id', shiftId)
        .limit(1);
    if (existingError) throw existingError;
    if (existingCounts && existingCounts.length > 0) return;

    const { data: items, error: itemsError } = await supabase
        .from('pos_outlet_items')
        .select('*')
        .eq('outlet_id', outletId)
        .eq('is_active', true);
    if (itemsError) throw itemsError;

    const stockRows = ((items || []) as Array<Record<string, any>>).map((item) => ({
        shift_id: shiftId,
        outlet_id: outletId,
        outlet_item_id: item.id,
        item_name: item.name,
        sku: item.sku,
        unit: item.unit || 'each',
        cost_price: item.cost_price || 0,
        selling_price: item.selling_price || 0,
        opening_stock: item.current_stock ?? item.opening_stock ?? 0,
        additions: 0,
        sold_quantity: 0,
        system_closing_stock: item.current_stock ?? item.opening_stock ?? 0,
        track_stock: item.track_stock !== false
    }));

    if (!stockRows.length) return;

    const { error: stockError } = await supabase
        .from('pos_shift_stock_counts')
        .insert(stockRows);
    if (stockError) throw stockError;
};

const ensurePosOutletShiftsForCashier = async (params: {
    branchId: number;
    cashierId: string;
    cashierRole: unknown;
    openedAt?: string | null;
}): Promise<void> => {
    const outletTypes = stationTypesForCashierRole(params.cashierRole, params.branchId);
    if (!outletTypes.length) return;

    const { data: outlets, error: outletsError } = await supabase
        .from('pos_outlets')
        .select('id, branch_id, outlet_type, is_active')
        .eq('branch_id', params.branchId)
        .eq('is_active', true)
        .in('outlet_type', outletTypes);
    if (outletsError) throw outletsError;

    for (const outlet of (outlets || []) as Array<Record<string, any>>) {
        const { data: existingShift, error: existingError } = await supabase
            .from('pos_outlet_shifts')
            .select('id, cashier_id, status')
            .eq('outlet_id', outlet.id)
            .eq('status', 'open')
            .order('opened_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (existingError) throw existingError;
        if (existingShift) continue;

        const { data: createdShift, error: createError } = await supabase
            .from('pos_outlet_shifts')
            .insert({
                outlet_id: outlet.id,
                branch_id: params.branchId,
                cashier_id: params.cashierId,
                opening_float: 0,
                status: 'open',
                opened_at: params.openedAt || new Date().toISOString()
            })
            .select('id')
            .single();
        if (createError) throw createError;

        await seedPosOutletShiftStockCounts(String(createdShift.id), String(outlet.id));
    }
};

function isLegacyUnapprovedOpenShift(shift: any): boolean {
    return String(shift?.status || '').toLowerCase() === 'open'
        && !shift?.opening_requested_by
        && !shift?.opening_approved_by
        && !shift?.opening_approved_at;
}

function normalizeShiftOpeningStatus(shift: any): any {
    if (!isLegacyUnapprovedOpenShift(shift)) return shift;
    return {
        ...shift,
        status: 'pending_open',
        legacy_unapproved_open: true,
        opening_requires_approval: true
    };
}

function toNumber(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function toArray(value: unknown): any[] {
    return Array.isArray(value) ? value : [];
}

function normalizePaymentMethod(value: unknown): string {
    const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (!normalized) return 'other';
    if (normalized.includes('mpesa') || normalized.includes('m_pesa') || normalized.includes('m-pesa')) return 'mpesa';
    if (normalized.includes('card') || normalized.includes('swipe') || normalized.includes('visa')) return 'card';
    if (normalized.includes('credit')) return 'credit_bill';
    if (normalized.includes('cash')) return 'cash';
    return normalized;
}

function summarizeShiftTransactions(transactions: any[]): {
    total_cash: number;
    total_mpesa: number;
    total_card: number;
    total_credit_bill: number;
    total_other: number;
    total_sales: number;
    transaction_count: number;
} {
    const summary = {
        total_cash: 0,
        total_mpesa: 0,
        total_card: 0,
        total_credit_bill: 0,
        total_other: 0,
        total_sales: 0,
        transaction_count: 0
    };

    transactions.forEach((transaction) => {
        if (transaction?.is_voided === true || transaction?.status === 'void') return;
        const amount = toNumber(transaction?.amount);
        if (amount <= 0) return;
        const method = normalizePaymentMethod(transaction?.payment_method);
        if (method === 'cash') summary.total_cash += amount;
        else if (method === 'mpesa') summary.total_mpesa += amount;
        else if (method === 'card') summary.total_card += amount;
        else if (method === 'credit_bill') summary.total_credit_bill += amount;
        else summary.total_other += amount;
        summary.total_sales += amount;
        summary.transaction_count += 1;
    });

    return summary;
}

type ShiftActualCollectionInput = {
    payment_method: 'cash' | 'mpesa' | 'card';
    system_amount: number;
    actual_amount: number;
    shift_id: string;
    branch_id: number;
    entered_by: string | null;
    entry_reference?: string | null;
};

async function upsertShiftActualCollections(
    rows: ShiftActualCollectionInput[]
): Promise<void> {
    if (!rows.length) return;

    // variance is GENERATED ALWAYS AS (actual_amount - system_amount) in the
    // live table — supplying it makes Postgres reject the whole insert (428C9).
    const payload = rows.map((row) => ({
        shift_id: row.shift_id,
        branch_id: row.branch_id,
        payment_method: row.payment_method,
        system_amount: row.system_amount,
        actual_amount: row.actual_amount,
        entered_by: row.entered_by,
        entered_at: new Date().toISOString(),
        entry_reference: row.entry_reference || null,
        entry_source: 'blind_shift_close'
    }));

    const { error } = await supabase
        .from('shift_actual_collections')
        .upsert(payload, { onConflict: 'shift_id,payment_method' });

    if (error) throw error;
}

export async function generateCashierShiftLogbook(shift: any, reviewerId?: string): Promise<any> {
    const logDate = String(shift.shift_start || new Date().toISOString()).slice(0, 10);
    const creditBills = toArray(shift.credit_bills_details);
    const paidBills = toArray(shift.paid_bills_details);
    const totalCash = toNumber(shift.total_cash_sales);
    const totalMpesa = toNumber(shift.total_mpesa_sales);
    const totalCard = toNumber(shift.total_card_sales);
    const totalSales = toNumber(shift.total_sales);
    let shiftTransactions: any[] = [];

    const { data: transactionRows, error: transactionError } = await supabase
        .from('cashier_shift_transactions')
        .select('*')
        .eq('shift_id', shift.id)
        .order('transaction_time', { ascending: true });

    if (transactionError) {
        logger.warn('Unable to load cashier shift transactions for logbook generation', {
            shiftId: shift.id,
            error: transactionError.message
        });
    } else {
        shiftTransactions = transactionRows || [];
    }

    const { data: existingLogbook, error: existingError } = await supabase
        .from('cashier_logbooks')
        .select('id')
        .eq('cashier_shift_id', shift.id)
        .maybeSingle();

    if (existingError) throw existingError;

    const payload = {
        branch_id: shift.branch_id,
        cashier_id: shift.cashier_id,
        type: 'cashier',
        log_date: logDate,
        opening_float: toNumber(shift.opening_float),
        closing_float: toNumber(shift.closing_float ?? shift.cash_at_hand),
        sales_breakdown: {
            source: 'cashier_shift_logs',
            shift_id: shift.id,
            shift_number: shift.shift_number,
            cashier_name: shift.cashier_name,
            total_cash: totalCash,
            total_mpesa: totalMpesa,
            total_card: totalCard,
            total_sales: totalSales,
            expected_closing_float: toNumber(shift.expected_closing_float),
            variance: toNumber(shift.variance),
            cash_drops: 0,
            payouts: toNumber(shift.payouts ?? shift.paid_outs),
            expense_total: toNumber(shift.expense_total),
            transaction_count: toNumber(shift.transaction_count),
            restaurant_revenue: toNumber(shift.restaurant_revenue),
            bar_revenue: toNumber(shift.bar_revenue),
            room_booking_revenue: toNumber(shift.room_booking_revenue),
            conference_revenue: toNumber(shift.conference_revenue),
            swimming_pool_revenue: toNumber(shift.swimming_pool_revenue),
            other_revenue: toNumber(shift.other_revenue),
            unpaid_bills_value: toNumber(shift.unpaid_bills_value),
            unpaid_bills_count: toNumber(shift.unpaid_bills_count),
            paid_bills_value: toNumber(shift.paid_bills_value),
            paid_bills_count: toNumber(shift.paid_bills_count),
            // Staff credit bills issued this shift — total + who they're for, so
            // the branch accountant sees the breakdown in the logbook.
            total_credit_bills: toNumber(shift.credit_bills_taken)
                || creditBills.reduce((s: number, b: any) => s + toNumber(b.amount), 0),
            credit_bills_count: toNumber(shift.credit_bills_count) || creditBills.length,
            credit_bills_details: creditBills.map((b: any) => ({
                staff_id: b.staff_id || null,
                name: b.name || b.staff_name || b.customer_name || 'Staff',
                amount: toNumber(b.amount),
                reference: b.reference || b.id || null,
            })),
            // Paid credits recorded this shift — staff name, amount and the
            // method they paid with (cash / M-Pesa / card). The branch
            // accountant applies each entry against the correct credit bill.
            paid_bills_details: paidBills.map((b: any) => ({
                staff_id: b.staff_id || null,
                name: b.name || b.staff_name || b.customer_name || 'Staff',
                amount: toNumber(b.amount),
                payment_method: b.payment_method || 'cash',
                reference: b.reference || b.id || null,
            })),
            void_summary: shift.void_summary || {
                total_void_amount: 0,
                total_void_count: 0,
                whole_bill_void_amount: 0,
                whole_bill_void_count: 0,
                item_void_amount: 0,
                item_void_count: 0,
                payment_void_amount: 0,
                payment_void_count: 0
            },
            gross_sales: toNumber(shift.gross_sales ?? totalSales),
            net_sales: toNumber(shift.net_sales ?? totalSales),
        },
        total_cash: totalCash,
        total_mpesa: totalMpesa,
        total_swipe: totalCard,
        notes: shift.notes || 'Generated automatically when the cashier shift was closed.',
        status: 'pending_accountant_review',
        source: 'cashier_shift_close',
        cashier_shift_id: shift.id,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    const logbookResult = existingLogbook?.id
        ? await supabase
            .from('cashier_logbooks')
            .update(payload)
            .eq('id', existingLogbook.id)
            .select('*')
            .single()
        : await supabase
            .from('cashier_logbooks')
            .insert(payload)
            .select('*')
            .single();

    if (logbookResult.error) throw logbookResult.error;
    const logbook = logbookResult.data;

    await supabase
        .from('cashier_logbook_lines')
        .delete()
        .eq('logbook_id', logbook.id);

    const lines = [
        ...shiftTransactions.map((transaction: any, index: number) => ({
            logbook_id: logbook.id,
            line_type: 'cleared_transaction',
            section: 'cleared_transaction',
            customer_name: transaction.customer_name
                || transaction.description
                || `Cashier cleared ${normalizePaymentMethod(transaction.payment_method)}`,
            amount: toNumber(transaction.amount),
            reference: transaction.transaction_ref
                || transaction.reference
                || transaction.transaction_id
                || `${shift.shift_number}-txn-${index + 1}`,
            source_table: 'cashier_shift_transactions',
            source_id: transaction.id || null,
            payment_method: normalizePaymentMethod(transaction.payment_method)
        })),
        ...creditBills.map((bill: any, index: number) => ({
            logbook_id: logbook.id,
            line_type: 'credit_bill',
            section: 'credit_bill',
            customer_name: bill.name || bill.staff_name || bill.customer_name || 'Credit bill',
            amount: toNumber(bill.amount),
            reference: bill.reference || bill.id || `${shift.shift_number}-credit-${index + 1}`,
            source_table: null,
            source_id: null,
            payment_method: 'credit_bill'
        })),
        ...paidBills.map((bill: any, index: number) => ({
            logbook_id: logbook.id,
            line_type: 'paid_bill',
            section: 'paid_bill',
            customer_name: bill.name || bill.staff_name || bill.customer_name || 'Paid bill',
            amount: toNumber(bill.amount),
            reference: bill.reference || bill.id || `${shift.shift_number}-paid-${index + 1}`,
            source_table: null,
            source_id: null,
            payment_method: bill.payment_method || 'cash'
        })),
        ...toArray(shift.void_lines).map((line: any, index: number) => ({
            logbook_id: logbook.id,
            line_type: 'voided_transaction',
            section: line.section || 'voided_transaction',
            customer_name: line.customer_name || 'Voided transaction',
            amount: toNumber(line.amount),
            reference: line.reference || `${shift.shift_number}-void-${index + 1}`,
            source_table: line.source_table || null,
            source_id: line.source_id || null,
            payment_method: line.payment_method || 'other'
        }))
    ].filter((line) => line.amount > 0);

    if (lines.length) {
        const { error: linesError } = await supabase
            .from('cashier_logbook_lines')
            .insert(lines);
        if (linesError) throw linesError;
    }

    notificationService.notifyRole(
        'branch_accountant',
        'Cashier shift logbook ready for review',
        `Shift ${shift.shift_number || shift.id} has been closed and is waiting for accountant review.`,
        {
            type: 'info',
            category: 'cashier_logbook',
            priority: 'high',
            branchId: shift.branch_id,
            metadata: {
                logbook_id: logbook.id,
                cashier_shift_id: shift.id,
                shift_number: shift.shift_number,
                reviewed_by: reviewerId
            }
        }
    ).catch((notifyError) => logger.warn('Cashier logbook notification failed:', notifyError));

    return logbook;
}

// @desc    Get shift logs
// @route   GET /api/cashier/shifts
// @access  Private
export const getShiftLogs = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, cashier_id, status, from_date, to_date } = req.query;
        const userId = req.user?.id;
        const userRole = req.user?.role;

        let query = supabase
            .from('cashier_shift_logs')
            .select('*')
            .order('shift_start', { ascending: false });

        // Apply branch isolation automatically
        query = applyBranchFilter(query, req);
        const requestedBranchId = parsePositiveInt(branch_id);
        if (requestedBranchId) {
            const userBranchId = parsePositiveInt(req.user?.branch_id ?? req.user?.branchId);
            if (isGlobalRole(userRole?.toString()) || !userBranchId || requestedBranchId === userBranchId) {
                query = query.eq('branch_id', requestedBranchId);
            }
        }
        
        // Cashiers can only see their own shifts unless they're admin/accountant/auditor/storekeeper
        const managerRoles = [
            'super_admin',
            'general_manager', 
            'branch_manager',
            'accountant',
            'branch_accountant',
            'auditor',
            'it_manager',
            // Storekeepers need read access to all branch shifts for the opening-stock gate
            'branch_storekeeper',
            'central_storekeeper',
            'storekeeper'
        ];
        
        const isManager = managerRoles.includes((userRole || '').toString().toLowerCase()) || isGlobalRole(userRole?.toString());
        
        // Priority: if a manager provides a cashier_id, filter by it.
        // Otherwise, if not a manager, FORCE filter by their own userId.
        if (!isManager) {
            query = query.eq('cashier_id', userId);
        } else if (cashier_id) {
            query = query.eq('cashier_id', cashier_id);
        }

        // Handle comma-separated statuses (e.g. "pending_open,open")
        const requestedStatus = status ? String(status).trim() : '';
        const statusList = requestedStatus.split(',').map(s => s.trim()).filter(Boolean);
        const normalizedStatuses = statusList.map(s => s === 'pending_approval' ? 'pending_open' : s);
        const specialStatuses = ['pending_open', 'open'];

        // If ALL requested statuses are "special" (handled by post-fetch filter), skip DB filter.
        // Otherwise, apply a DB-level filter for non-special statuses.
        const nonSpecial = normalizedStatuses.filter(s => !specialStatuses.includes(s));
        if (nonSpecial.length === 1) {
            query = query.eq('status', nonSpecial[0]);
        } else if (nonSpecial.length > 1) {
            query = query.in('status', nonSpecial);
        }

        // Filter by date range
        if (from_date) {
            query = query.gte('shift_start', from_date);
        }
        if (to_date) {
            query = query.lte('shift_start', to_date);
        }

        const { data, error } = await query;

        if (error) throw error;

        let shifts = (data || []).map(normalizeShiftOpeningStatus);
        // Post-fetch filter for special statuses
        if (normalizedStatuses.length > 0 && normalizedStatuses.every(s => specialStatuses.includes(s))) {
            shifts = shifts.filter((shift: any) => {
                const s = String(shift.status || '').toLowerCase();
                if (normalizedStatuses.includes('pending_open') && s === 'pending_open') return true;
                if (normalizedStatuses.includes('open') && s === 'open' && !shift.opening_requires_approval) return true;
                return false;
            });
        } else if (normalizedStatuses.includes('pending_open') && !normalizedStatuses.includes('open')) {
            shifts = shifts.filter((shift: any) => String(shift.status || '').toLowerCase() === 'pending_open');
        } else if (normalizedStatuses.includes('open') && !normalizedStatuses.includes('pending_open')) {
            shifts = shifts.filter((shift: any) =>
                String(shift.status || '').toLowerCase() === 'open' && !shift.opening_requires_approval
            );
        }

        // Batch-fetch user names for shifts missing cashier_name
        const missingNameIds = [...new Set(
            shifts.filter((s: any) => !s.cashier_name && s.cashier_id).map((s: any) => s.cashier_id)
        )];
        const userNameMap: Record<string, string> = {};
        if (missingNameIds.length > 0) {
            const { data: users } = await supabase
                .from('users')
                .select('id, first_name, last_name')
                .in('id', missingNameIds);
            (users || []).forEach((u: any) => {
                userNameMap[u.id] = `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'N/A';
            });
        }

        // Enrich each shift: compute live sales from source revenue tables
        const enriched = await Promise.all(shifts.map(async (shift: any) => {
            const cashierName = shift.cashier_name || userNameMap[shift.cashier_id] || 'N/A';
            const buildVoidAudit = async () => {
                if (!shift.shift_start || !shift.branch_id) return null;
                try {
                    return await loadCashierVoidAudit({
                        branchId: Number(shift.branch_id),
                        cashierId: shift.cashier_id,
                        cashierShiftId: shift.id,
                        shiftStart: shift.shift_start,
                        shiftEnd: shift.shift_end || new Date().toISOString()
                    });
                } catch (voidErr) {
                    logger.warn(`Void audit failed for shift ${shift.id}:`, voidErr);
                    return null;
                }
            };

            // For closed/reconciled shifts that already have totals stored, use them as-is
            if (shift.status !== 'open' && shift.status !== 'pending_open') {
                const voidAudit = await buildVoidAudit();
                return {
                    ...shift,
                    cashier_name: cashierName,
                    void_summary: voidAudit?.summary || undefined,
                    net_sales: toNumber(shift.total_sales),
                    gross_sales: toNumber(shift.total_sales) + toNumber(voidAudit?.summary?.total_void_amount)
                };
            }

            if (!shift.shift_start || !shift.branch_id) {
                return { ...shift, cashier_name: cashierName };
            }

            const shiftEnd = shift.shift_end || new Date().toISOString();
            const branchId = shift.branch_id;

            try {
                // Primary source of truth: the shift's own transaction rows.
                // These include the payment method (incl. CREDIT_BILL), which the
                // RPC summary doesn't break out — so we bucket them here.
                const { data: shiftTxns } = await supabase
                    .from('cashier_shift_transactions')
                    .select('payment_method, amount, is_voided, status')
                    .eq('shift_id', shift.id)
                    .or('is_voided.is.null,is_voided.eq.false');

                if (shiftTxns && shiftTxns.length > 0) {
                    let txnCash = 0, txnMpesa = 0, txnCard = 0, txnCredit = 0, txnTotal = 0;
                    for (const t of shiftTxns) {
                        const m = String(t.payment_method || '').toLowerCase();
                        const amt = Number(t.amount || 0);
                        txnTotal += amt;
                        if (m.includes('credit')) txnCredit += amt;
                        else if (m.includes('mpesa') || m.includes('m-pesa')) txnMpesa += amt;
                        else if (m.includes('card') || m.includes('swipe')) txnCard += amt;
                        else txnCash += amt;
                    }
                    // Include cash paid-credits already recorded during the shift
                    // (staff settling credit bills with cash) — these physically
                    // land in the drawer and must be in the expected reconciliation.
                    // Expenses can't be known yet (entered at close), so they're excluded.
                    const paidBillsList = Array.isArray(shift.paid_bills_details) ? shift.paid_bills_details : [];
                    const cashPaidCreditsLive = paidBillsList
                        .filter((b: any) => !String(b.payment_method || 'cash').toLowerCase().match(/mpesa|card/))
                        .reduce((s: number, b: any) => s + (Number(b.amount) || 0), 0);
                    const expectedClosingFloat = Number(shift.opening_float || 0) + txnCash + cashPaidCreditsLive;
                    const closingFloat = Number(shift.closing_float || 0);
                    return {
                        ...shift,
                        cashier_name: cashierName,
                        total_sales: txnTotal,
                        total_cash_sales: txnCash,
                        total_mpesa_sales: txnMpesa,
                        total_card_sales: txnCard,
                        credit_bills_taken: txnCredit,
                        credit_bills_count: shiftTxns.filter((t: any) =>
                            String(t.payment_method || '').toLowerCase().includes('credit')).length,
                        transaction_count: shiftTxns.length,
                        expected_closing_float: expectedClosingFloat,
                        variance: closingFloat > 0 ? closingFloat - expectedClosingFloat : shift.variance,
                    };
                }

                // Fallback: the RPC summary (cash/mpesa/card only).
                const { data: summary } = await supabase
                    .rpc('calculate_shift_summary', { p_shift_id: shift.id });

                if (summary && summary.total_sales > 0) {
                    const paidBillsListRpc = Array.isArray(shift.paid_bills_details) ? shift.paid_bills_details : [];
                    const cashPaidCreditsRpc = paidBillsListRpc
                        .filter((b: any) => !String(b.payment_method || 'cash').toLowerCase().match(/mpesa|card/))
                        .reduce((s: number, b: any) => s + (Number(b.amount) || 0), 0);
                    const expectedClosingFloat = Number(shift.opening_float || 0) + Number(summary.total_cash || 0) + cashPaidCreditsRpc;
                    const closingFloat = Number(shift.closing_float || 0);
                    return {
                        ...shift,
                        cashier_name: cashierName,
                        total_sales: summary.total_sales,
                        total_cash_sales: summary.total_cash || 0,
                        total_mpesa_sales: summary.total_mpesa || 0,
                        total_card_sales: summary.total_card || 0,
                        credit_bills_taken: shift.credit_bills_taken || 0,
                        transaction_count: summary.transaction_count || 0,
                        expected_closing_float: expectedClosingFloat,
                        variance: closingFloat > 0 ? closingFloat - expectedClosingFloat : shift.variance,
                    };
                }

                // Fallback: aggregate from source revenue tables
                // CRITICAL: Must filter by branch_id AND cashier_id to prevent cross-shift/cross-branch leakage
                const [
                    { data: restOrders },
                    { data: barOrders },
                ] = await Promise.all([
                    supabase.from('restaurant_orders')
                        .select('total_amount')
                        .eq('branch_id', branchId)
                        .eq('created_by', shift.cashier_id)
                        .gte('created_at', shift.shift_start)
                        .lte('created_at', shiftEnd)
                        .not('status', 'in', '(voided,cancelled)'),
                    supabase.from('bar_orders')
                        .select('total_amount:total')
                        .eq('branch_id', branchId)
                        .eq('created_by', shift.cashier_id)
                        .gte('created_at', shift.shift_start)
                        .lte('created_at', shiftEnd)
                        .not('status', 'in', '(voided,cancelled)'),
                ]);

                const allOrders = [
                    ...(restOrders || []),
                    ...(barOrders || []),
                ];
                const totalCash = toNumber(shift.total_cash_sales);
                const totalMpesa = toNumber(shift.total_mpesa_sales);
                const totalCard = toNumber(shift.total_card_sales);
                const restBarTotal = allOrders.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
                const totalSales = restBarTotal;
                const txCount = allOrders.length;

                if (totalSales > 0) {
                    const expectedClosingFloat = Number(shift.opening_float || 0) + totalCash;
                    const closingFloat = Number(shift.closing_float || 0);
                    return {
                        ...shift,
                        cashier_name: cashierName,
                        total_sales: totalSales,
                        total_cash_sales: totalCash,
                        total_mpesa_sales: totalMpesa,
                        total_card_sales: totalCard,
                        transaction_count: txCount,
                        expected_closing_float: expectedClosingFloat,
                        variance: closingFloat > 0 ? closingFloat - expectedClosingFloat : shift.variance,
                    };
                }
            } catch (err) {
                logger.warn(`Sales enrichment failed for shift ${shift.id}:`, err);
            }

            return { ...shift, cashier_name: cashierName };
        }));

        res.status(200).json({
            success: true,
            data: enriched
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single shift log with transactions
// @route   GET /api/cashier/shifts/:id
// @access  Private
export const getShiftLog = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        let query = supabase.from("cashier_shift_logs").select("*").eq("id", id);
        query = applyBranchFilter(query, req);
        const { data: rawShift, error: shiftError } = await query.single();

        if (shiftError) throw shiftError;
        if (!rawShift) throw new AppError('Shift not found', 404);
        const shift = normalizeShiftOpeningStatus(rawShift);

        // Verify ownership - cashiers can only view their own shifts
        const userId = req.user?.id;
        const userRole = (req.user?.role || '').toString().toLowerCase();
        const managerRoles = [
            'super_admin',
            'general_manager',
            'branch_manager',
            'accountant',
            'branch_accountant',
            'auditor'
        ];
        const isManager = managerRoles.includes(userRole) || isGlobalRole(userRole);
        
        if (!isManager && shift.cashier_id !== userId) {
            throw new AppError('You can only view your own shifts', 403);
        }

        // Get transactions
        const { data: transactions, error: txError } = await supabase
            .from('cashier_shift_transactions')
            .select('*')
            .eq('shift_id', id)
            .order('transaction_time', { ascending: false });

        if (txError) throw txError;

        // Enrich cashier name — fallback to users table if not stored on shift
        let cashierName = shift.cashier_name;
        if (!cashierName && shift.cashier_id) {
            const { data: user } = await supabase
                .from('users')
                .select('first_name, last_name')
                .eq('id', shift.cashier_id)
                .single();
            cashierName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'N/A';
        }
        cashierName = cashierName || 'N/A';

        // If totals are zero, recompute from payments table
        let enrichedShift = { ...shift, cashier_name: cashierName, transactions: transactions || [] };

        if ((shift.status === 'open' || shift.status === 'pending_open') && shift.cashier_id && shift.shift_start) {
            const shiftEnd = shift.shift_end || new Date().toISOString();
            const branchId = shift.branch_id;
            let rpcOk = false;

            // Step 1: try RPC
            try {
                const { data: summary } = await supabase
                    .rpc('calculate_shift_summary', { p_shift_id: shift.id });

                if (summary && summary.total_sales > 0) {
                    rpcOk = true;
                    const expectedClosingFloat = Number(shift.opening_float || 0) + Number(summary.total_cash || 0);
                    const closingFloat = Number(shift.closing_float || 0);
                    enrichedShift = {
                        ...enrichedShift,
                        total_sales: summary.total_sales,
                        total_cash_sales: summary.total_cash || 0,
                        total_mpesa_sales: summary.total_mpesa || 0,
                        total_card_sales: summary.total_card || 0,
                        transaction_count: summary.transaction_count || 0,
                        expected_closing_float: expectedClosingFloat,
                        variance: closingFloat > 0 ? closingFloat - expectedClosingFloat : shift.variance,
                    };
                }
            } catch (rpcErr) {
                logger.warn(`calculate_shift_summary failed for shift ${shift.id}:`, rpcErr);
            }

            // Step 2: fallback — aggregate from source revenue tables by time window only
            if (!rpcOk) {
                try {
                    // Resolve outlet type(s) for this shift so we only aggregate
                    // the outlet(s) this cashier actually ran during this shift.
                    let fallbackOutletTypes: Set<string> = new Set();
                    try {
                        const { data: fbOutletRows } = await supabase
                            .from('pos_outlet_shifts')
                            .select('outlet_id, outlet:pos_outlets(outlet_type)')
                            .eq('branch_id', branchId)
                            .eq('cashier_id', shift.cashier_id)
                            .gte('opened_at', shift.shift_start)
                            .lte('opened_at', shiftEnd);
                        for (const row of (fbOutletRows || [])) {
                            const ot = String((row as any).outlet?.outlet_type || '').toLowerCase();
                            if (ot) fallbackOutletTypes.add(ot);
                        }
                    } catch (_) {}

                    const fbIsBarType = (t: string) => ['bar', 'bar_store', 'spirits', 'main_bar', 'exec_bar', 'pool_bar'].includes(t);
                    const fbIsRestType = (t: string) => ['restaurant', 'dining', 'room_service', 'kitchen'].includes(t);
                    const fbFetchRest = fallbackOutletTypes.size === 0 || Array.from(fallbackOutletTypes).some(fbIsRestType);
                    const fbFetchBar = fallbackOutletTypes.size === 0 || Array.from(fallbackOutletTypes).some(fbIsBarType);

                    // Fallback: aggregate from source revenue tables
                    const [
                        { data: restOrders },
                        { data: barOrders },
                    ] = await Promise.all([
                        fbFetchRest
                            ? supabase.from('restaurant_orders')
                                .select('total_amount')
                                .eq('branch_id', branchId)
                                .eq('created_by', shift.cashier_id)
                                .gte('created_at', shift.shift_start)
                                .lte('created_at', shiftEnd)
                            : Promise.resolve({ data: [], error: null }),
                        fbFetchBar
                            ? supabase.from('bar_orders')
                                .select('total_amount:total')
                                .eq('branch_id', branchId)
                                .eq('created_by', shift.cashier_id)
                                .gte('created_at', shift.shift_start)
                                .lte('created_at', shiftEnd)
                            : Promise.resolve({ data: [], error: null }),
                    ]);

                    const allOrders = [...(restOrders || []), ...(barOrders || [])];
                    const totalCash = toNumber(enrichedShift.total_cash_sales);
                    const totalMpesa = toNumber(enrichedShift.total_mpesa_sales);
                    const totalCard = toNumber(enrichedShift.total_card_sales);
                    const totalSales = allOrders.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);

                    if (totalSales > 0) {
                        const expectedClosingFloat = Number(shift.opening_float || 0) + totalCash;
                        const closingFloat = Number(shift.closing_float || 0);
                        enrichedShift = {
                            ...enrichedShift,
                            total_sales: totalSales,
                            total_cash_sales: totalCash,
                            total_mpesa_sales: totalMpesa,
                            total_card_sales: totalCard,
                            transaction_count: allOrders.length,
                            expected_closing_float: expectedClosingFloat,
                            variance: closingFloat > 0 ? closingFloat - expectedClosingFloat : shift.variance,
                        };
                    }
                } catch (fallbackErr) {
                    logger.warn(`Source-table fallback failed for shift ${shift.id}:`, fallbackErr);
                }
            }
        }

        // Autopopulate staff credit bills that were cleared through the cashier
        // during this open shift, so the close-shift logbook submits the same
        // staff_profiles IDs to payroll staff_credit_bills.
        try {
            const shiftEnd = shift.shift_end || new Date().toISOString();
            const { data: cashierCreditTxs, error: cashierCreditTxError } = await supabase
                .from('cashier_transactions')
                .select('id, amount, transaction_number, payment_reference, credit_bill_id, customer_name, created_at')
                .eq('branch_id', shift.branch_id)
                .eq('cashier_id', shift.cashier_id)
                .or('payment_method.eq.credit_bill,payment_method.eq.CREDIT_BILL,payment_method.eq.credit_bill_manual,payment_method.eq.CREDIT_BILL_MANUAL')
                .gte('created_at', shift.shift_start)
                .lte('created_at', shiftEnd);

            if (cashierCreditTxError) throw cashierCreditTxError;

            const creditBillIds = Array.from(new Set((cashierCreditTxs || [])
                .map((tx: any) => tx.credit_bill_id)
                .filter(Boolean)));

            let creditBillMap = new Map<string, any>();
            if (creditBillIds.length > 0) {
                const { data: creditBills, error: creditBillsError } = await supabase
                    .from('credit_bills')
                    .select('id, credit_number, staff_id, staff_name, employee_id, department, total_amount')
                    .in('id', creditBillIds);

                if (creditBillsError) throw creditBillsError;
                creditBillMap = new Map((creditBills || []).map((bill: any) => [bill.id, bill]));
            }

            const existingCreditDetails = Array.isArray(enrichedShift.credit_bills_details)
                ? enrichedShift.credit_bills_details
                : [];
            const mergedCreditDetails = [...existingCreditDetails];
            const seenCreditDetails = new Set(existingCreditDetails.map((bill: any) =>
                `${bill.staff_id || ''}|${Number(bill.amount || 0)}|${bill.reference || bill.credit_number || ''}`
            ));

            for (const tx of cashierCreditTxs || []) {
                const bill = tx.credit_bill_id ? creditBillMap.get(tx.credit_bill_id) : null;
                const staffId = bill?.staff_id;
                const amount = Number(bill?.total_amount || tx.amount || 0);
                if (!staffId || amount <= 0) continue;

                const reference = bill?.credit_number || tx.payment_reference || tx.transaction_number;
                const key = `${staffId}|${amount}|${reference || ''}`;
                if (seenCreditDetails.has(key)) continue;
                seenCreditDetails.add(key);

                mergedCreditDetails.push({
                    staff_id: staffId,
                    name: bill?.staff_name || tx.customer_name || 'Staff',
                    employee_id: bill?.employee_id,
                    department: bill?.department,
                    amount,
                    reference,
                    credit_bill_id: tx.credit_bill_id,
                    source: 'cashier_credit_bill_payment'
                });
            }

            if (mergedCreditDetails.length !== existingCreditDetails.length) {
                const totalCreditBills = mergedCreditDetails
                    .reduce((sum: number, bill: any) => sum + Number(bill.amount || 0), 0);
                enrichedShift = {
                    ...enrichedShift,
                    credit_bills_details: mergedCreditDetails,
                    credit_bills_count: mergedCreditDetails.length,
                    credit_bills_taken: totalCreditBills
                };
            }
        } catch (creditErr) {
            logger.warn(`Cashier credit bill enrichment failed for shift ${shift.id}:`, creditErr);
        }

        // =====================================================================
        // STRUCTURED SHIFT RECONCILIATION DATA
        // Build the exact response shape the Flutter branch-accountant
        // dashboard expects so every closed shift auto-populates the
        // reconciliation panel (POS bills, credit bills, revenue, payment
        // breakdown, cash drawer trace, etc.).
        // =====================================================================
        try {
            const shiftEnd = shift.shift_end || new Date().toISOString();
            const branchId = shift.branch_id;
            const voidAudit = await loadCashierVoidAudit({
                branchId,
                cashierId: shift.cashier_id,
                cashierShiftId: shift.id,
                shiftStart: shift.shift_start,
                shiftEnd
            });

            // --- resolve which POS outlet type(s) belong to THIS shift ---
            // Only show orders from the outlet(s) this cashier actually ran
            // during this specific shift. Without this, a restaurant-only cashier
            // and a bar-only cashier with overlapping time windows both see each
            // other's orders combined into one 584-line evidence table.
            let shiftOutletTypes: Set<string> = new Set();
            try {
                const { data: outletShiftRows } = await supabase
                    .from('pos_outlet_shifts')
                    .select('outlet_id, outlet:pos_outlets(outlet_type)')
                    .eq('branch_id', branchId)
                    .eq('cashier_id', shift.cashier_id)
                    .gte('opened_at', shift.shift_start)
                    .lte('opened_at', shiftEnd);

                for (const row of (outletShiftRows || [])) {
                    const ot = String((row as any).outlet?.outlet_type || '').toLowerCase();
                    if (ot) shiftOutletTypes.add(ot);
                }
            } catch (_) {
                // If lookup fails, fall back to fetching both (safe degradation)
            }

            // Determine which legacy order tables to query based on outlet type.
            // bar_store, bar, spirits etc. → bar_orders; restaurant → restaurant_orders.
            // If no outlet types resolved (old shifts / fallback), query both.
            const isBarType = (t: string) => ['bar', 'bar_store', 'spirits', 'main_bar', 'exec_bar', 'pool_bar'].includes(t);
            const isRestType = (t: string) => ['restaurant', 'dining', 'room_service', 'kitchen'].includes(t);

            const fetchRestOrders = shiftOutletTypes.size === 0
                || Array.from(shiftOutletTypes).some(isRestType);
            const fetchBarOrders = shiftOutletTypes.size === 0
                || Array.from(shiftOutletTypes).some(isBarType);

            // --- fetch POS evidence scoped to this shift's outlet type(s) ---
            const [
                { data: restOrders },
                { data: barOrders },
                { data: creditBillRecords },
            ] = await Promise.all([
                fetchRestOrders
                    ? supabase.from('restaurant_orders')
                        .select('*')
                        .eq('branch_id', branchId)
                        .eq('created_by', shift.cashier_id)
                        .gte('created_at', shift.shift_start)
                        .lte('created_at', shiftEnd)
                    : Promise.resolve({ data: [], error: null }),
                fetchBarOrders
                    ? supabase.from('bar_orders')
                        .select('*')
                        .eq('branch_id', branchId)
                        .eq('created_by', shift.cashier_id)
                        .gte('created_at', shift.shift_start)
                        .lte('created_at', shiftEnd)
                    : Promise.resolve({ data: [], error: null }),
                // Scoped to this cashier + this shift only.
                supabase.from('credit_bills')
                    .select('id, credit_number, staff_name, employee_id, department, total_amount, balance_amount, status, approval_status, created_at')
                    .eq('branch_id', branchId)
                    .eq('created_by', shift.cashier_id)
                    .gte('created_at', shift.shift_start)
                    .lte('created_at', shiftEnd)
            ]);

            // --- payment breakdown (from shift totals + transaction evidence) ---
            const totalCash = toNumber(enrichedShift.total_cash_sales);
            const totalMpesa = toNumber(enrichedShift.total_mpesa_sales);
            const totalCard = toNumber(enrichedShift.total_card_sales);
            const totalCreditBill = toNumber(enrichedShift.credit_bills_taken);
            const totalPaidBills = toNumber(enrichedShift.paid_bills_value);
            const totalSales = toNumber(enrichedShift.total_sales);
            const netSales = totalSales;
            const grossSales = netSales + toNumber(voidAudit.summary.total_void_amount);

            const paymentBreakdown = [
                { method: 'cash', amount: totalCash, count: (transactions || []).filter((t: any) => normalizePaymentMethod(t.payment_method) === 'cash').length },
                { method: 'mpesa', amount: totalMpesa, count: (transactions || []).filter((t: any) => normalizePaymentMethod(t.payment_method) === 'mpesa').length },
                { method: 'card', amount: totalCard, count: (transactions || []).filter((t: any) => normalizePaymentMethod(t.payment_method) === 'card').length },
                { method: 'credit_bill', amount: totalCreditBill, count: toNumber(enrichedShift.credit_bills_count) },
                { method: 'other', amount: Math.max(0, totalSales - totalCash - totalMpesa - totalCard - totalCreditBill), count: 0 },
            ].filter((row) => row.amount > 0 || ['cash', 'mpesa', 'card', 'credit_bill'].includes(row.method));

            // --- revenue breakdown (from shift revenue fields) ---
            const revenueBreakdown = [
                { label: 'Restaurant', amount: toNumber(shift.restaurant_revenue) },
                { label: 'Bar', amount: toNumber(shift.bar_revenue) },
                { label: 'Rooms', amount: toNumber(shift.room_booking_revenue) },
                { label: 'Conference', amount: toNumber(shift.conference_revenue) },
                { label: 'Pool', amount: toNumber(shift.swimming_pool_revenue) + toNumber(shift.pool_token_revenue) },
                { label: 'Other', amount: toNumber(shift.other_revenue) + totalPaidBills }
            ].filter((row) => row.amount > 0);

            // --- transaction history / lines (cleared transactions + POS orders) ---
            const txLines = (transactions || []).map((t: any) => ({
                id: t.id,
                amount: toNumber(t.amount),
                payment_method: normalizePaymentMethod(t.payment_method),
                section: 'cleared_transaction',
                source_table: 'cashier_shift_transactions',
                source_id: t.id,
                customer_name: t.customer_name || t.description || `Cleared ${normalizePaymentMethod(t.payment_method)}`,
                reference: t.transaction_ref || t.reference || t.transaction_id || t.id,
                created_at: t.transaction_time || t.created_at || shift.shift_start
            }));

            const posLines = [
                ...(restOrders || []).map((o: any) => ({
                    id: o.id,
                    amount: toNumber(o.total_amount),
                    payment_method: 'other',
                    section: 'restaurant_sale',
                    source_table: 'restaurant_orders',
                    source_id: o.id,
                    customer_name: o.customer_name || o.guest_name || o.order_type || 'Restaurant order',
                    reference: o.id,
                    created_at: o.created_at
                })),
                ...(barOrders || []).map((o: any) => ({
                    id: o.id,
                    amount: toNumber(o.total ?? o.subtotal),
                    payment_method: 'other',
                    section: 'bar_sale',
                    source_table: 'bar_orders',
                    source_id: o.id,
                    customer_name: o.customer_name || o.guest_name || 'Bar order',
                    reference: o.id,
                    created_at: o.created_at
                }))
            ];

            const allLines = [...txLines, ...posLines]
                .filter((line) => line.amount > 0)
                .sort((a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

            const transactionHistory = allLines;

            // --- credit bills (issued during shift) ---
            const creditBills = (creditBillRecords || []).map((bill: any) => ({
                id: bill.id,
                credit_number: bill.credit_number || null,
                staff_name: bill.staff_name || bill.customer_name || bill.employee_name || 'Staff',
                employee_id: bill.employee_id || null,
                department: bill.department || null,
                bill_type: 'credit_bill',
                amount: toNumber(bill.total_amount ?? bill.amount),
                balance: toNumber(bill.balance_amount ?? bill.balance ?? bill.total_amount ?? bill.amount),
                status: bill.status || bill.approval_status || 'active',
                created_at: bill.created_at
            }));
            const creditBillsTotal = creditBills.reduce((sum: number, b: any) => sum + toNumber(b.amount), 0);

            // --- paid bills (from shift.paid_bills_details) ---
            const rawPaidBills = Array.isArray(shift.paid_bills_details) ? shift.paid_bills_details : [];
            const paidBills = rawPaidBills.map((b: any) => ({
                staff_id: b.staff_id || null,
                name: b.name || b.staff_name || b.customer_name || 'Staff',
                amount: toNumber(b.amount),
                payment_method: b.payment_method || 'cash',
                reference: b.reference || b.id || null
            }));

            // --- cash reconciliation ---
            const cashDrops = 0; // cash_deposited is not part of the drawer formula
            const payouts = toNumber(shift.payouts ?? shift.paid_outs);
            const openingFloat = toNumber(shift.opening_float);
            const closingFloat = toNumber(shift.closing_float ?? shift.cash_at_hand);
            const expectedClosing = toNumber(shift.expected_closing_float);
            const variance = toNumber(shift.variance);

            // --- sales breakdown (same shape as logbook sales_breakdown) ---
            const creditBillDetails = Array.isArray(shift.credit_bills_details) ? shift.credit_bills_details : [];
            const salesBreakdown = {
                source: 'cashier_shift_logs',
                shift_id: shift.id,
                shift_number: shift.shift_number,
                cashier_name: cashierName,
                total_cash: totalCash,
                total_mpesa: totalMpesa,
                total_card: totalCard,
                total_sales: totalSales,
                expected_closing_float: expectedClosing,
                variance,
                cash_drops: cashDrops,
                payouts,
                transaction_count: toNumber(shift.transaction_count),
                restaurant_revenue: toNumber(shift.restaurant_revenue),
                bar_revenue: toNumber(shift.bar_revenue),
                room_booking_revenue: toNumber(shift.room_booking_revenue),
                conference_revenue: toNumber(shift.conference_revenue),
                swimming_pool_revenue: toNumber(shift.swimming_pool_revenue),
                other_revenue: toNumber(shift.other_revenue),
                unpaid_bills_value: toNumber(shift.unpaid_bills_value),
                unpaid_bills_count: toNumber(shift.unpaid_bills_count),
                paid_bills_value: totalPaidBills,
                paid_bills_count: toNumber(shift.paid_bills_count),
                total_credit_bills: totalCreditBill || creditBillDetails.reduce((s: number, b: any) => s + toNumber(b.amount), 0),
                credit_bills_count: toNumber(shift.credit_bills_count) || creditBillDetails.length,
                credit_bills_details: creditBillDetails.map((b: any) => ({
                    staff_id: b.staff_id || null,
                    name: b.name || b.staff_name || b.customer_name || 'Staff',
                    amount: toNumber(b.amount),
                    reference: b.reference || b.id || null
                })),
                paid_bills_details: paidBills.map((b: any) => ({
                    staff_id: b.staff_id || null,
                    name: b.name || b.staff_name || b.customer_name || 'Staff',
                    amount: toNumber(b.amount),
                    payment_method: b.payment_method || 'cash',
                    reference: b.reference || b.id || null
                })),
                void_summary: voidAudit.summary,
                gross_sales: grossSales,
                net_sales: netSales
            };

            enrichedShift = {
                ...enrichedShift,
                cash_reconciliation: {
                    opening_float: openingFloat,
                    cash_sales: totalCash,
                    cash_tendered: totalCash,
                    change_given: toNumber(shift.change_given),
                    drawer_cash_in: totalCash,
                    credit_payments_received: totalPaidBills,
                    cash_drops: cashDrops,
                    payouts,
                    expected_closing: expectedClosing,
                    actual_closing: closingFloat,
                    variance
                },
                payment_breakdown: paymentBreakdown,
                revenue_breakdown: revenueBreakdown,
                credit_bills: creditBills,
                credit_bills_total: creditBillsTotal,
                paid_bills: paidBills,
                lines: allLines,
                transaction_history: transactionHistory,
                sales_breakdown: salesBreakdown,
                void_summary: voidAudit.summary,
                void_lines: voidAudit.lines,
                summary: {
                    total_sales: netSales,
                    net_sales: netSales,
                    gross_sales: grossSales,
                    total_void_amount: toNumber(voidAudit.summary.total_void_amount),
                    total_void_count: toNumber(voidAudit.summary.total_void_count),
                    transaction_count: toNumber(shift.transaction_count, allLines.length),
                    paid_bills_value: totalPaidBills,
                    paid_bills_count: toNumber(shift.paid_bills_count),
                    unpaid_bills_value: toNumber(shift.unpaid_bills_value),
                    unpaid_bills_count: toNumber(shift.unpaid_bills_count)
                }
            };
        } catch (structErr) {
            logger.warn(`Structured shift data build failed for shift ${shift.id}:`, structErr);
            // Do not fail the request — the raw shift data is still useful.
        }

        // ---------------------------------------------------------------
        // Cashier expenses recorded against this shift (Expenses tab ->
        // shift_reconciliation_expenses, the canonical shift-expense table).
        // Surface them as expense_details so the close-shift logbook shows
        // them, the expected-cash calculation reduces the drawer by cash paid
        // out, and the branch accountant sees the same figures at
        // reconciliation. Non-fatal.
        // ---------------------------------------------------------------
        try {
            const { data: pettyRows } = await supabase
                .from('shift_reconciliation_expenses')
                .select('amount, category, description, paid_to_name, receipt_number, po_reference, created_at')
                .eq('shift_id', shift.id)
                .order('created_at', { ascending: true });

            const expenseDetails = (pettyRows || []).map((row: any) => ({
                description: row.description || row.category || 'Expense',
                category: row.category || null,
                amount: Number(row.amount || 0),
                payment_method: 'cash', // cashier expenses are paid from the drawer
                paid_to_name: row.paid_to_name || null,
                receipt_number: row.receipt_number || null,
                po_reference: row.po_reference || null,
                time: row.created_at || null,
            }));
            const expenseTotal = expenseDetails.reduce(
                (sum: number, e: any) => sum + Number(e.amount || 0), 0);

            enrichedShift = {
                ...enrichedShift,
                expense_details: expenseDetails,
                expense_total: expenseTotal,
                total_expenses: expenseTotal,
            };
        } catch (expErr) {
            logger.warn(`Petty-cash expense enrichment failed for shift ${shift.id}:`, expErr);
        }

        res.status(200).json({
            success: true,
            data: enrichedShift
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Start a new shift
// @route   POST /api/cashier/shifts/start
// @access  Private (Cashier)
// ── DAILY CONTROLS SNAPSHOT (Phase 5) ────────────────────────
// Triggered whenever a cashier shift actually transitions to 'open' — either
// immediately below in startShift, or later via approveShiftOpening. At that
// moment the branch's previous commercial day is definitively over, so its
// Daily Controls numbers are computed once via buildDailyControlPayload and
// frozen into daily_control_snapshots — the source of truth the Daily
// Controls screen shows as "previous closed day", as opposed to a live call
// to the same function for the still-open shift ("Live/provisional").
// Idempotent (unique index on cashier_shift_id) and non-fatal — a failure
// here must never block the new shift from opening.
export const startShift = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { opening_float, notes, cashier_id, cashierId, branch_id, branchId } = req.body;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const manager = isShiftManager(userRole);
        const requestedCashierId = cashier_id || cashierId;
        const targetCashierId = manager && requestedCashierId ? requestedCashierId : userId;
        const requestedBranchId = parsePositiveInt(branch_id ?? branchId);
        const userBranchId = parsePositiveInt(req.user?.branch_id ?? req.user?.branchId);

        if (!targetCashierId) {
            throw new AppError('Cashier ID is required to open a shift', 400);
        }

        if (requestedCashierId && !manager) {
            throw new AppError('Only branch accountants or managers can open shifts for another cashier', 403);
        }

        let targetUser: any = {
            id: userId,
            first_name: req.user?.first_name,
            last_name: req.user?.last_name,
            email: req.user?.email,
            role: req.user?.role,
            branch_id: req.user?.branch_id ?? req.user?.branchId
        };

        if (targetCashierId !== userId) {
            const { data: cashier, error: cashierError } = await supabase
                .from('users')
                .select('id, first_name, last_name, email, role, branch_id')
                .eq('id', targetCashierId)
                .maybeSingle();

            if (cashierError) throw cashierError;
            if (!cashier) throw new AppError('Selected cashier was not found', 404);
            targetUser = cashier;
        }

        const targetBranchId =
            requestedBranchId ||
            parsePositiveInt(targetUser.branch_id) ||
            userBranchId;

        if (!targetBranchId) {
            throw new AppError('Branch ID is required', 400);
        }

        if (!isGlobalRole(userRole?.toString()) && userBranchId && targetBranchId !== userBranchId) {
            throw new AppError('Forbidden: cannot open a cashier shift for another branch', 403);
        }

        const userName = `${targetUser.first_name || ''} ${targetUser.last_name || ''}`.trim() ||
            targetUser.email ||
            'Cashier';

        // The stocktake(s) relevant to this cashier's own station must be
        // completed before their shift can open.
        const today = todayInBranchTimezone();
        const stocktakeGate = await verifyStocktakesComplete(targetBranchId, today, targetUser.role);
        if (!stocktakeGate.ok) {
            throw new AppError(
                `Cannot open cashier shift until all stocktakes are completed: ${stocktakeGate.missing.join(', ')}`,
                400
            );
        }

        // Check if cashier already has an open shift or a pending opening request.
        const { data: openShift, error: openShiftError } = await supabase
            .from('cashier_shift_logs')
            .select('id, status, opening_requested_by, opening_approved_by, opening_approved_at')
            .eq('cashier_id', targetCashierId)
            .in('status', ['pending_open', 'open'])
            .limit(1);

        if (openShiftError) throw openShiftError;

        if (openShift && openShift.length > 0) {
            const activeStatus = normalizeShiftOpeningStatus(openShift[0]).status;
            throw new AppError(
                activeStatus === 'pending_open'
                    ? 'This cashier already has a shift opening request awaiting branch accountant approval.'
                    : 'This cashier already has an open shift. Please close it first.',
                400
            );
        }

        // Generate shift number
        const { data: shiftNumber, error: numberError } = await supabase
            .rpc('generate_shift_number', { p_branch_id: targetBranchId });

        if (numberError) throw numberError;

        const now = new Date().toISOString();
        // Stocktake submission (verified above) is the ONLY gate for opening a
        // cashier shift. Branch-accountant approval is no longer required — once
        // the relevant stocktake(s) are submitted, the cashier's shift opens
        // immediately on request. (Managers opening for another cashier also
        // open immediately.)
        const opensImmediately = true;

        // Create shift. Cashiers request opening; branch accountants/managers can open for another cashier.
        const { data: newShift, error: shiftError } = await supabase
            .from('cashier_shift_logs')
            .insert({
                shift_number: shiftNumber,
                branch_id: targetBranchId,
                cashier_id: targetCashierId,
                cashier_name: userName,
                shift_start: now,
                opening_float: opening_float || 0,
                status: opensImmediately ? 'open' : 'pending_open',
                notes,
                requested_at: now,
                opening_requested_by: userId,
                opening_approved_by: opensImmediately ? userId : null,
                opening_approved_at: opensImmediately ? now : null,
                opening_review_notes: opensImmediately
                    ? (notes || 'Auto-opened on request — stocktake submitted, no approval required')
                    : notes
            })
            .select()
            .single();

        if (shiftError) throw shiftError;

        if (opensImmediately) {
            try {
                await ensurePosOutletShiftsForCashier({
                    branchId: targetBranchId,
                    cashierId: String(targetCashierId),
                    cashierRole: targetUser.role,
                    openedAt: newShift.shift_start || now
                });
            } catch (posShiftError: any) {
                logger.warn('Failed to eagerly open POS outlet shifts for cashier shift', {
                    shiftId: newShift.id,
                    cashierId: targetCashierId,
                    branchId: targetBranchId,
                    error: posShiftError?.message
                });
            }

            // Automated food-control pipeline for the just-finalized previous
            // day — same lifecycle moment as the snapshot above, fire-and-forget
            // so it never slows down opening the new shift.
            if (targetCashierId !== userId) {
                void notificationService.notifyUser(
                    targetCashierId,
                    'Cashier shift opened',
                    `Your shift ${shiftNumber} has been opened by ${req.user?.first_name || 'a branch manager'}.`,
                    {
                        type: 'success',
                        category: 'cashier_shift',
                        priority: 'medium',
                        actionUrl: '/cashier/shifts',
                        metadata: {
                            shift_id: newShift.id,
                            shift_number: shiftNumber,
                            branch_id: targetBranchId,
                            status: 'open'
                        }
                    }
                ).catch((notifyError) => logger.warn('Shift open notification failed:', notifyError));
            }
        } else {
            const amount = Number(opening_float || 0).toLocaleString('en-KE');
            void notificationService.notifyRole(
                'branch_accountant',
                'Shift opening approval needed',
                `${userName} requested to open shift ${shiftNumber} with opening float KES ${amount}.`,
                {
                    type: 'warning',
                    category: 'cashier_shift',
                    priority: 'high',
                    actionUrl: '/dashboard/branch-accounting/shift-review',
                    branchId: targetBranchId,
                    metadata: {
                        shift_id: newShift.id,
                        shift_number: shiftNumber,
                        cashier_id: targetCashierId,
                        cashier_name: userName,
                        branch_id: targetBranchId,
                        opening_float: Number(opening_float || 0),
                        status: 'pending_open'
                    }
                }
            ).catch((notifyError) => logger.warn('Shift opening approval notification failed:', notifyError));
        }

        res.status(201).json({
            success: true,
            message: opensImmediately
                ? 'Shift opened successfully.'
                : 'Shift opening request submitted. A branch accountant must approve it before cashier operations can begin.',
            data: newShift
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Approve cashier shift opening request
// @route   PUT /api/cashier/shifts/:id/approve-open
// @access  Private (Branch Accountant / Accountant / Manager)
export const approveShiftOpening = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        const userId = req.user?.id;
        const userRole = req.user?.role;

        let fetchQuery = supabase
            .from('cashier_shift_logs')
            .select('*')
            .eq('id', id);
        fetchQuery = applyBranchFilter(fetchQuery, req);

        const { data: shift, error: shiftError } = await fetchQuery.single();
        if (shiftError) throw shiftError;
        if (!shift) throw new AppError('Shift opening request not found', 404);
        const legacyUnapprovedOpen = isLegacyUnapprovedOpenShift(shift);
        if (shift.status !== 'pending_open' && !legacyUnapprovedOpen) {
            throw new AppError('Only pending shift opening requests can be approved.', 400);
        }

        if (!isShiftManager(userRole)) {
            throw new AppError('Only branch accountants or managers can approve cashier shift openings.', 403);
        }

        // The stocktake(s) relevant to this cashier's own station must be
        // completed before their shift opening can be approved.
        const { data: cashierUser, error: cashierRoleError } = await supabase
            .from('users')
            .select('id, role')
            .eq('id', shift.cashier_id)
            .maybeSingle();
        if (cashierRoleError) throw cashierRoleError;

        const shiftDate = todayInBranchTimezone();
        const stocktakeGate = await verifyStocktakesComplete(
            Number(shift.branch_id),
            shiftDate,
            cashierUser?.role
        );
        if (!stocktakeGate.ok) {
            throw new AppError(
                `Cannot approve cashier shift until all stocktakes are completed: ${stocktakeGate.missing.join(', ')}`,
                400
            );
        }

        const now = new Date().toISOString();
        let updateQuery = supabase
            .from('cashier_shift_logs')
            .update({
                status: 'open',
                shift_start: legacyUnapprovedOpen && shift.shift_start ? shift.shift_start : now,
                opening_approved_by: userId,
                opening_approved_at: now,
                opening_review_notes: notes || (legacyUnapprovedOpen
                    ? 'Approved by branch accountant after pending-open migration'
                    : 'Approved by branch accountant'),
                updated_at: now
            })
            .eq('id', id);

        if (!isGlobalRole(userRole?.toString())) {
            updateQuery = updateQuery.eq('branch_id', req.user?.branch_id);
        }

        const { data, error } = await updateQuery.select().single();
        if (error) throw error;

        try {
            await ensurePosOutletShiftsForCashier({
                branchId: Number(shift.branch_id),
                cashierId: String(shift.cashier_id),
                cashierRole: cashierUser?.role,
                openedAt: data?.shift_start || shift.shift_start || now
            });
        } catch (posShiftError: any) {
            logger.warn('Failed to eagerly open POS outlet shifts after shift approval', {
                shiftId: id,
                cashierId: shift.cashier_id,
                branchId: shift.branch_id,
                error: posShiftError?.message
            });
        }

        if (data?.cashier_id) {
            void notificationService.notifyUser(
                data.cashier_id,
                'Shift approved',
                `Your shift ${data.shift_number || id} is now open. You can start cashier operations.`,
                {
                    type: 'success',
                    category: 'cashier_shift',
                    priority: 'high',
                    actionUrl: '/cashier/shifts',
                    metadata: {
                        shift_id: data.id,
                        shift_number: data.shift_number,
                        branch_id: data.branch_id,
                        status: 'open'
                    }
                }
            ).catch((notifyError) => logger.warn('Shift approval notification failed:', notifyError));
        }

        res.status(200).json({
            success: true,
            message: 'Cashier shift opened.',
            data
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Reject cashier shift opening request
// @route   PUT /api/cashier/shifts/:id/reject-open
// @access  Private (Branch Accountant / Accountant / Manager)
export const rejectShiftOpening = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { notes, reason } = req.body;
        const userId = req.user?.id;
        const userRole = req.user?.role;

        let fetchQuery = supabase
            .from('cashier_shift_logs')
            .select('*')
            .eq('id', id);
        fetchQuery = applyBranchFilter(fetchQuery, req);

        const { data: shift, error: shiftError } = await fetchQuery.single();
        if (shiftError) throw shiftError;
        if (!shift) throw new AppError('Shift opening request not found', 404);
        const legacyUnapprovedOpen = isLegacyUnapprovedOpenShift(shift);
        if (shift.status !== 'pending_open' && !legacyUnapprovedOpen) {
            throw new AppError('Only pending shift opening requests can be rejected.', 400);
        }

        if (!isShiftManager(userRole)) {
            throw new AppError('Only branch accountants or managers can reject cashier shift openings.', 403);
        }

        const now = new Date().toISOString();
        let updateQuery = supabase
            .from('cashier_shift_logs')
            .update({
                status: 'rejected',
                shift_end: legacyUnapprovedOpen ? now : shift.shift_end,
                opening_rejected_by: userId,
                opening_rejected_at: now,
                opening_review_notes: notes || reason || 'Rejected by branch accountant',
                updated_at: now
            })
            .eq('id', id);

        if (!isGlobalRole(userRole?.toString())) {
            updateQuery = updateQuery.eq('branch_id', req.user?.branch_id);
        }

        const { data, error } = await updateQuery.select().single();
        if (error) throw error;

        if (data?.cashier_id) {
            void notificationService.notifyUser(
                data.cashier_id,
                'Shift opening rejected',
                `Your shift opening request ${data.shift_number || id} was rejected. ${data.opening_review_notes || ''}`.trim(),
                {
                    type: 'error',
                    category: 'cashier_shift',
                    priority: 'high',
                    actionUrl: '/cashier/shifts',
                    metadata: {
                        shift_id: data.id,
                        shift_number: data.shift_number,
                        branch_id: data.branch_id,
                        status: 'rejected',
                        notes: data.opening_review_notes
                    }
                }
            ).catch((notifyError) => logger.warn('Shift rejection notification failed:', notifyError));
        }

        res.status(200).json({
            success: true,
            message: 'Cashier shift opening request rejected.',
            data
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Close shift
// @route   PUT /api/cashier/shifts/:id/close
// @access  Private (Cashier)
export const closeShift = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const {
            closing_float,
            notes,
            // Revenue by source
            swimming_pool_revenue,
            pool_token_revenue,
            conference_revenue,
            room_booking_revenue,
            restaurant_revenue,
            bar_revenue,
            other_revenue,
            // Credit & bills
            credit_bills_taken,
            credit_bills_count,
            credit_bills_details,
            unpaid_bills_value,
            unpaid_bills_count,
            paid_bills_value,
            paid_bills_count,
            paid_bills_details,
            // Expenses paid out of this shift's collections — reduce the
            // matching payment method's reported sales (see expense
            // deduction below).
            expense_details,
            // Cash management
            cash_at_hand,
            actual_cash_counted,
            actual_mpesa_logged,
            actual_card_logged,
            cash_deposited,
            bank_deposit_ref,
            mpesa_summary_ref,
            card_batch_ref,
            // N/A flags
            pool_na,
            conference_na,
            rooms_na
        } = req.body;
        const userId = req.user?.id;
        const automationWarnings: string[] = [];

        // Get shift
        const { data: shift, error: shiftError } = await supabase
            .from('cashier_shift_logs')
            .select('*')
            .eq('id', id)
            .single();

        if (shiftError) throw shiftError;
        if (!shift) throw new AppError('Shift not found', 404);

        // Verify ownership - allow cashier to close own shift, or managers/accountants/auditors to close any shift
        const userRole = (req.user?.role || '').toString().toLowerCase();
        const canCloseAnyShift = [
            'super_admin',
            'general_manager',
            'branch_manager',
            'accountant',
            'branch_accountant',
            'auditor'
        ].includes(userRole) || isGlobalRole(userRole);
        
        if (shift.cashier_id !== userId && !canCloseAnyShift) {
            throw new AppError('You can only close your own shifts. Please contact a manager if you need to close this shift.', 403);
        }
        
        // Also ensure shift belongs to user's branch if they are not global
        if (!isGlobalRole(userRole) && shift.branch_id !== req.user?.branch_id) {
            throw new AppError('You can only manage shifts within your own branch', 403);
        }

        if (shift.status !== 'open') {
            throw new AppError('Shift is already closed', 400);
        }

        if (isLegacyUnapprovedOpenShift(shift)) {
            throw new AppError('This shift opening is still awaiting branch accountant approval.', 403);
        }

        // ==========================================
        // VALIDATION: Check for unpaid bills
        // ==========================================
        const UNSETTLED = ['pending', 'unpaid', 'partial'];

        // Each POS-outlet cashier is responsible for ONLY their own outlet's
        // bills (a main-bar cashier clears main-bar orders, not exec-bar/
        // restaurant). Resolve the shift OWNER's outlets so this guard counts
        // exactly the bills that appear in their Unpaid Bills tab.
        const { data: ownerUser } = await supabase
            .from('users')
            .select('role')
            .eq('id', shift.cashier_id)
            .maybeSingle();
        const ownerRole = String(ownerUser?.role || '').toLowerCase();
        const ownerAssignedOutlets = await loadAssignedPosOutlets(supabase, shift.cashier_id);
        const ownerAssignedIds = assignedOutletIds(ownerAssignedOutlets);
        const ownerStationRestricted = shouldRestrictCashierStationAccess(
            ownerRole,
            ownerAssignedIds,
            shift.branch_id
        );
        const ownerOutletTypes = new Set([
            ...stationTypesForCashierRole(ownerRole, shift.branch_id),
            ...ownerAssignedOutlets
                .map((o: PosOutlet) => String(o.outlet_type || '').toLowerCase())
                .filter(Boolean),
        ]);
        const canCloseRestaurant = !ownerStationRestricted || ownerOutletTypes.has('restaurant');
        const canCloseBar = !ownerStationRestricted || Array.from(ownerOutletTypes).some(isBarStationType);

        // POS shift orders: only the outlets this cashier runs.
        const { data: branchPosOutlets } = await supabase
            .from('pos_outlets')
            .select('id, outlet_type, branch_id, name')
            .eq('branch_id', shift.branch_id);
        const allowedOutletIds = ((branchPosOutlets || []) as PosOutlet[])
            .filter((outlet) =>
                canAccessPosOutlet(ownerRole, outlet, ownerAssignedOutlets, shift.branch_id)
            )
            .map((outlet) => String(outlet.id))
            .filter(Boolean);

        let unpaidPosOrders = 0;
        if (allowedOutletIds.length) {
            const { data: ownerPosShifts } = await supabase
                .from('pos_outlet_shifts')
                .select('id')
                .eq('branch_id', shift.branch_id)
                .eq('cashier_id', shift.cashier_id)
                .eq('status', 'open')
                .in('outlet_id', allowedOutletIds);
            const ownerPosShiftIds = (ownerPosShifts || [])
                .map((s: any) => s.id)
                .filter(Boolean);
            if (ownerPosShiftIds.length) {
                const { data: posOrders, error: posErr } = await supabase
                    .from('pos_shift_orders')
                    .select('id, items, total_amount, amount_paid, balance_amount, status, payment_status')
                    .in('shift_id', ownerPosShiftIds)
                    .in('payment_status', ['unpaid', 'partial'])
                    .neq('status', 'cancelled');
                if (posErr) throw posErr;
                unpaidPosOrders = (posOrders || []).filter((order: any) => !isNullifiedZeroPosOrder(order)).length;
            }
        }

        // Legacy restaurant / bar orders only count for cashiers who serve them.
        // A failed query here must not silently read as "zero unpaid bills" —
        // that would let a shift close with real unsettled bills outstanding.
        let unpaidRestCount = 0;
        if (canCloseRestaurant) {
            const { data: unpaidRestOrders, error: unpaidRestError } = await supabase.from('restaurant_orders')
                .select('id')
                .eq('branch_id', shift.branch_id)
                .in('payment_status', UNSETTLED);
            if (unpaidRestError) throw unpaidRestError;
            unpaidRestCount = unpaidRestOrders?.length || 0;
        }
        let unpaidBarCount = 0;
        if (canCloseBar) {
            const { data: unpaidBarOrders, error: unpaidBarError } = await supabase.from('bar_orders')
                .select('id')
                .eq('branch_id', shift.branch_id)
                .in('payment_status', UNSETTLED);
            if (unpaidBarError) throw unpaidBarError;
            unpaidBarCount = unpaidBarOrders?.length || 0;
        }

        const totalUnpaid = unpaidRestCount + unpaidBarCount + unpaidPosOrders;

        if (totalUnpaid > 0) {
            throw new AppError(`Cannot close shift: ${totalUnpaid} unsettled bill(s) remain. Settle every bill (cash, M-Pesa or card) or record it as a credit bill before closing the shift.`, 400);
        }

        // Block close if any item-level void requests are sitting in this
        // cashier's own queue ('kitchen_acknowledged' — kitchen has signed
        // off, cashier has not yet acknowledged or declined). Requests still
        // at 'pending' haven't reached the cashier yet (kitchen's queue, not
        // theirs) so they don't block this close. Scope to the stations THIS
        // cashier runs (same outlets their close sweeps): the Void Requests
        // tab is station-scoped, so counting another station's requests here
        // deadlocks the close against a queue this cashier can't even see.
        let pendingItemVoidsQuery = supabase
            .from('pos_item_void_requests')
            .select('id, order_number, item_name, qty_to_void, requested_by')
            .eq('branch_id', shift.branch_id)
            .eq('status', 'kitchen_acknowledged');
        if (allowedOutletIds.length) {
            pendingItemVoidsQuery = pendingItemVoidsQuery.in('outlet_id', allowedOutletIds);
        }
        const { data: pendingItemVoids, error: pendingItemVoidsError } = await pendingItemVoidsQuery;
        if (pendingItemVoidsError) throw pendingItemVoidsError;
        if (pendingItemVoids && pendingItemVoids.length > 0) {
            const voidList = pendingItemVoids
                .map((v: any) => `"${v.item_name}" on bill ${v.order_number || v.id}`)
                .join(', ');
            // Notify the branch accountant so they can follow up.
            await notificationService.notifyRole(
                'branch_accountant',
                'Shift close blocked — pending void requests',
                `Cashier attempted to close the shift but ${pendingItemVoids.length} item void request(s) are still awaiting acknowledgement: ${voidList}.`,
                { type: 'warning', category: 'pos_item_void_request', priority: 'high', branchId: shift.branch_id }
            );
            throw new AppError(
                `Cannot close shift: ${pendingItemVoids.length} item void request(s) are still awaiting cashier acknowledgement. Acknowledge or decline each request from the "Void Requests" tab first.`,
                400
            );
        }
        // ==========================================

        const { data: shiftTransactionRows, error: shiftTransactionsError } = await supabase
            .from('cashier_shift_transactions')
            .select('amount, payment_method, is_voided, status')
            .eq('shift_id', id)
            .or('is_voided.is.null,is_voided.eq.false');

        if (shiftTransactionsError) {
            logger.warn('Unable to load cashier shift transaction evidence for close calculation', {
                shiftId: id,
                error: shiftTransactionsError.message
            });
        }

        const transactionSummary = summarizeShiftTransactions(shiftTransactionRows || []);

        // Calculate summary from the RPC as a fallback only. The transaction
        // rows are the source of truth because they are what the logbook displays.
        const { data: summary } = await supabase
            .rpc('calculate_shift_summary', { p_shift_id: id });

        const hasTransactionEvidence = transactionSummary.transaction_count > 0;
        const cash_sales = hasTransactionEvidence ? transactionSummary.total_cash : toNumber(summary?.total_cash);
        const mpesa_sales = hasTransactionEvidence ? transactionSummary.total_mpesa : toNumber(summary?.total_mpesa);
        const card_sales = hasTransactionEvidence ? transactionSummary.total_card : toNumber(summary?.total_card);
        const credit_bill_sales = hasTransactionEvidence ? transactionSummary.total_credit_bill : 0;
        const other_sales = hasTransactionEvidence ? transactionSummary.total_other : toNumber(other_revenue);
        const total_sales = hasTransactionEvidence ? transactionSummary.total_sales : toNumber(summary?.total_sales);
        const transaction_count = hasTransactionEvidence ? transactionSummary.transaction_count : toNumber(summary?.transaction_count);
        // cash_deposited is not part of the drawer reconciliation formula —
        // it was set historically by interim cash-at-hand snapshots, not by
        // cashier declaration. Keeping it at 0 prevents ECF from being
        // deflated by a phantom "deposit" that never happened.
        const cashDrops = 0;
        const payouts = toNumber(req.body.payouts ?? req.body.paid_outs ?? req.body.expense_total);

        // Paid credits recorded this shift (a customer settling an OLD credit
        // bill) are real cash/mpesa/card landing in the cashier's hands this
        // shift, so they correctly affect the CASH-DRAWER reconciliation
        // below (total_cash_sales_final / expectedClosingFloat). They must
        // NOT inflate reported "sales"/"revenue" figures though — that
        // revenue was already recognised in the shift the credit was
        // originally issued; counting it again here would double-count it
        // company-wide. total_cash_sales / total_mpesa_sales / total_card_sales /
        // total_sales (persisted below) therefore stay on the un-folded
        // cash_sales/mpesa_sales/card_sales/total_sales values; only the
        // *_final variants (drawer-reconciliation only) include paid credits.
        const paidBillsList: any[] = Array.isArray(paid_bills_details) ? paid_bills_details : [];
        const paidCreditsByMethod = (method: string) => paidBillsList
            .filter((b: any) => normalizePaymentMethod(b.payment_method) === method)
            .reduce((s: number, b: any) => s + (parseFloat(b.amount) || 0), 0);
        const cashPaidCredits = paidCreditsByMethod('cash');
        const mpesaPaidCredits = paidCreditsByMethod('mpesa');
        const cardPaidCredits = paidCreditsByMethod('card');

        // Expense entries the cashier logs during the shift (fuel, petty
        // purchases, etc.) — each is tagged with how it was paid out, and
        // reduces that same method's reported sales, per ops requirement.
        // A cash expense also reduces the cash-drawer reconciliation, since
        // that cash physically left the drawer.
        const expensesList: any[] = Array.isArray(expense_details) ? expense_details : [];
        const expensesByMethod = (method: string) => expensesList
            .filter((e: any) => normalizePaymentMethod(e.payment_method) === method)
            .reduce((s: number, e: any) => s + (parseFloat(e.amount) || 0), 0);
        const cashExpenses = expensesByMethod('cash');
        const mpesaExpenses = expensesByMethod('mpesa');
        const cardExpenses = expensesByMethod('card');
        const expenseTotal = expensesList.reduce((s: number, e: any) => s + (parseFloat(e.amount) || 0), 0);

        const cash_sales_net = Math.max(0, cash_sales - cashExpenses);
        const mpesa_sales_net = Math.max(0, mpesa_sales - mpesaExpenses);
        const card_sales_net = Math.max(0, card_sales - cardExpenses);
        const total_sales_net = Math.max(0, total_sales - expenseTotal);

        const total_cash_sales_final = cash_sales_net + cashPaidCredits;
        const voidAudit = await loadCashierVoidAudit({
            branchId: Number(shift.branch_id),
            cashierId: shift.cashier_id,
            cashierShiftId: shift.id,
            shiftStart: shift.shift_start,
            shiftEnd: new Date().toISOString()
        });
        const gross_sales = total_sales_net + toNumber(voidAudit.summary.total_void_amount);

        // Correct formula: Expected = Opening Float + Gross Cash Sales + Cash Paid Credits - Cash Expenses.
        // cash_deposited is NOT subtracted — it is not a cashier-declared deposit but a computed snapshot
        // that was historically misused in the formula, causing inflated/deflated variance.
        const expectedClosingFloat = toNumber(shift.opening_float) + cash_sales + cashPaidCredits - cashExpenses;
        const hasDeclaredClosingFloat = closing_float !== undefined
            && closing_float !== null
            && `${closing_float}`.trim() !== '';
        const hasDeclaredCashAtHand = cash_at_hand !== undefined
            && cash_at_hand !== null
            && `${cash_at_hand}`.trim() !== '';
        const hasDeclaredActualCashCounted = actual_cash_counted !== undefined
            && actual_cash_counted !== null
            && `${actual_cash_counted}`.trim() !== '';
        const hasDeclaredActualMpesaLogged = actual_mpesa_logged !== undefined
            && actual_mpesa_logged !== null
            && `${actual_mpesa_logged}`.trim() !== '';
        const hasDeclaredActualCardLogged = actual_card_logged !== undefined
            && actual_card_logged !== null
            && `${actual_card_logged}`.trim() !== '';
        const actualClosingFloat = hasDeclaredClosingFloat
            ? toNumber(closing_float)
            : hasDeclaredCashAtHand
                ? toNumber(cash_at_hand)
                : expectedClosingFloat;
        const actualCashCounted = hasDeclaredActualCashCounted
            ? toNumber(actual_cash_counted)
            : actualClosingFloat;
        const expectedMpesaSales = mpesa_sales_net + mpesaPaidCredits;
        const expectedCardSales = card_sales_net + cardPaidCredits;
        const actualMpesaLogged = hasDeclaredActualMpesaLogged
            ? toNumber(actual_mpesa_logged)
            : expectedMpesaSales;
        const actualCardLogged = hasDeclaredActualCardLogged
            ? toNumber(actual_card_logged)
            : expectedCardSales;
        const variance = actualClosingFloat - expectedClosingFloat;
        const cashVarianceBlind = actualCashCounted - expectedClosingFloat;
        const mpesaVarianceBlind = actualMpesaLogged - expectedMpesaSales;
        const cardVarianceBlind = actualCardLogged - expectedCardSales;

        // Compute unpaid_bills server-side from credit issued only. Paid
        // credits are separate cashier-collected evidence for the branch
        // accountant to apply later; they must not reduce staff credit balances
        // or same-shift credit issued automatically.
        const creditTaken = (credit_bills_details || []).reduce((s: number, b: any) => s + (parseFloat(b.amount) || 0), 0);
        const computedUnpaidBills = Math.max(0, creditTaken);

        // Reconciliation warning: payment method sum should equal total_sales
        const methodSum = cash_sales + mpesa_sales + card_sales + credit_bill_sales + other_sales;
        if (total_sales > 0 && Math.abs(methodSum - total_sales) > 0.01) {
            logger.warn(`Shift ${id} reconciliation warning: method sum ${methodSum} ≠ total_sales ${total_sales}`);
        }

        // Update shift with all revenue breakdown
        const { data: updatedShift, error: updateError } = await supabase
            .from('cashier_shift_logs')
            .update({
                shift_end: new Date().toISOString(),
                closing_float: actualClosingFloat,
                expected_closing_float: expectedClosingFloat,
                variance,
                // Payment method totals — true sales, net of expenses paid
                // out this shift. Paid credits are NOT folded in here (see
                // comment above); they're still captured separately via
                // paid_bills_value/paid_bills_details below, and via
                // cash-drawer reconciliation (closing_float/
                // expected_closing_float/variance above).
                total_cash_sales: cash_sales_net,
                total_mpesa_sales: mpesa_sales_net,
                total_card_sales: card_sales_net,
                total_sales: total_sales_net,
                transaction_count,
                expense_total: expenseTotal,
                expense_details: expensesList,
                // Revenue by source
                swimming_pool_revenue: swimming_pool_revenue || 0,
                pool_token_revenue: pool_token_revenue || 0,
                conference_revenue: conference_revenue || 0,
                room_booking_revenue: room_booking_revenue || 0,
                restaurant_revenue: restaurant_revenue || 0,
                bar_revenue: bar_revenue || 0,
                other_revenue: other_sales,
                // Credit & bills
                credit_bills_taken: credit_bills_taken || 0,
                credit_bills_count: credit_bills_count || 0,
                credit_bills_details: credit_bills_details || [],
                unpaid_bills_value: computedUnpaidBills,
                unpaid_bills_count: unpaid_bills_count || 0,
                paid_bills_value: paid_bills_value || 0,
                paid_bills_count: paid_bills_count || 0,
                paid_bills_details: paid_bills_details || [],
                // Cash management
                cash_at_hand: toNumber(cash_at_hand ?? actualClosingFloat),
                actual_cash_counted: actualCashCounted,
                actual_mpesa_logged: actualMpesaLogged,
                actual_card_logged: actualCardLogged,
                cash_deposited: 0,
                bank_deposit_ref,
                mpesa_summary_ref: mpesa_summary_ref || null,
                card_batch_ref: card_batch_ref || null,
                // N/A flags
                pool_na: pool_na || false,
                conference_na: conference_na || false,
                rooms_na: rooms_na || false,
                // Status
                status: 'closed',
                reconciliation_status: 'pending_reconciliation',
                notes: notes || shift.notes,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        // The shift row above is already closed — from here on every step must
        // degrade to a warning. An unguarded throw here previously 500'd the
        // whole close AFTER the status flip, silently skipping the POS station
        // close sweep, credit-bill sync, and logbook generation (the shift then
        // never appeared in the accountant's Shift Reconciliation queue).
        try {
            await upsertShiftActualCollections([
                {
                    shift_id: id,
                    branch_id: Number(shift.branch_id),
                    payment_method: 'cash',
                    system_amount: expectedClosingFloat,
                    actual_amount: actualCashCounted,
                    entered_by: userId || null,
                    entry_reference: bank_deposit_ref || null
                },
                {
                    shift_id: id,
                    branch_id: Number(shift.branch_id),
                    payment_method: 'mpesa',
                    system_amount: expectedMpesaSales,
                    actual_amount: actualMpesaLogged,
                    entered_by: userId || null,
                    entry_reference: mpesa_summary_ref || null
                },
                {
                    shift_id: id,
                    branch_id: Number(shift.branch_id),
                    payment_method: 'card',
                    system_amount: expectedCardSales,
                    actual_amount: actualCardLogged,
                    entered_by: userId || null,
                    entry_reference: card_batch_ref || null
                }
            ]);
        } catch (blindEntryError) {
            logger.error(`Failed to record blind collection entries for shift ${id}`, blindEntryError);
            automationWarnings.push('Shift closed, but blind collection entries could not be recorded. Capture them from Shift Reconciliation.');
        }

        // Close only THIS cashier's POS station shift(s) — the POS for their
        // outlet is "open" while their cashier shift is open (getActiveShift
        // bridge). Other outlets' cashiers keep their own shifts open.
        let closedPosOutletShiftIds: string[] = [];
        try {
            let posCloseQuery = supabase
                .from('pos_outlet_shifts')
                .update({ status: 'closed', closed_at: new Date().toISOString() })
                .eq('branch_id', shift.branch_id)
                .eq('status', 'open');
            if (allowedOutletIds.length) {
                posCloseQuery = posCloseQuery.in('outlet_id', allowedOutletIds);
            }
            const { data: closedPosShifts } = await posCloseQuery.select('id');
            closedPosOutletShiftIds = (closedPosShifts || []).map((row: any) => String(row.id)).filter(Boolean);
        } catch (posCloseErr) {
            logger.warn('Failed to close POS station shifts on cashier close', {
                shiftId: id,
                error: (posCloseErr as any)?.message
            });
        }

        // Cashier Void Management — compile this shift's void activity into a
        // standing audit row for the Branch Accountant's review queue. Uses the
        // exact pos_outlet_shifts ids just closed above rather than a time-window
        // heuristic, since we have them precisely at this point.
        try {
            await compileShiftVoidAudit({
                cashierShiftId: id,
                branchId: Number(shift.branch_id),
                cashierId: shift.cashier_id,
                shiftStart: shift.shift_start,
                shiftEnd: updatedShift?.shift_end || new Date().toISOString(),
                outletShiftIds: closedPosOutletShiftIds,
                grossRevenue: toNumber(updatedShift?.total_sales ?? total_sales_net)
            });
        } catch (voidAuditErr) {
            logger.warn('Failed to compile cashier shift void audit', {
                shiftId: id,
                error: (voidAuditErr as any)?.message
            });
        }

        // SYNC WITH BRANCH ACCOUNTANT: Create staff_credit_bills records
        try {
            // 1. Process Credit Bills (Unpaid)
            if (credit_bills_details && Array.isArray(credit_bills_details)) {
                const creditBillsToInsert = credit_bills_details
                    .filter((bill: any) => bill.staff_id)
                    .map((bill: any) => ({
                        staff_id: bill.staff_id,
                        amount: bill.amount,
                        description: `Shift Credit - Shift #${shift.shift_number} - ${bill.name}`,
                        bill_date: new Date().toISOString().split('T')[0],
                        status: 'pending',
                        paid_amount: 0,
                        balance: bill.amount,
                        branch_id: shift.branch_id,
                        shift_id: shift.id
                    }));

                if (creditBillsToInsert.length > 0) {
                    const { error: creditError } = await supabase
                        .from('staff_credit_bills')
                        .insert(creditBillsToInsert);

                    if (creditError) {
                        logger.error(`Failed to sync credit bills for shift ${id}`, creditError);
                    }
                }
            }

            // 2. Paid credits stay as shift entries for branch-accountant
            // review. Do not auto-create payment rows or reduce any existing
            // staff_credit_bills balances here.
            if (paid_bills_details && Array.isArray(paid_bills_details)) {
                logger.info(`Shift ${id} has ${paid_bills_details.length} paid-credit entr${paid_bills_details.length === 1 ? 'y' : 'ies'} pending branch-accountant application.`);
            }
        } catch (syncError) {
            // Log but don't fail the request since shift is already closed
            logger.error(`Error in shift sync logic for ${id}`, syncError);
            automationWarnings.push('Credit-bill sync failed. Review staff credit bills manually.');
        }

        let generatedLogbook: any = null;
        try {
            generatedLogbook = await generateCashierShiftLogbook({
                ...updatedShift,
                void_summary: voidAudit.summary,
                void_lines: voidAudit.lines,
                net_sales: total_sales_net,
                gross_sales: gross_sales
            }, userId);
        } catch (logbookError) {
            logger.error(`Failed to generate cashier shift logbook for ${id}`, logbookError);
            automationWarnings.push('Shift closed, but cashier logbook generation failed. Branch accountant queue may not show this shift.');
        }

        res.status(200).json({
            success: true,
            message: automationWarnings.length
                ? 'Shift closed with automation warnings'
                : 'Shift closed and sent to branch accountant for logbook review',
            data: {
                ...updatedShift,
                void_summary: voidAudit.summary,
                void_lines: voidAudit.lines,
                net_sales: total_sales_net,
                gross_sales: gross_sales,
                blind_reconciliation: {
                    cash: {
                        expected: expectedClosingFloat,
                        actual: actualCashCounted,
                        variance: cashVarianceBlind
                    },
                    mpesa: {
                        expected: expectedMpesaSales,
                        actual: actualMpesaLogged,
                        variance: mpesaVarianceBlind
                    },
                    card: {
                        expected: expectedCardSales,
                        actual: actualCardLogged,
                        variance: cardVarianceBlind
                    }
                },
                generated_logbook_id: generatedLogbook?.id || null,
                automation_warnings: automationWarnings
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Reconcile shift (Branch Accountant)
// @route   PUT /api/cashier/shifts/:id/reconcile
// @access  Private (Accountant)
export const reconcileShift = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { reconciliation_notes, variance_reason_code, variance_comment } = req.body;
        const userId = req.user?.id;
        const now = new Date().toISOString();

        let fetchQuery = supabase
            .from('cashier_shift_logs')
            .select('*')
            .eq('id', id);

        if (!isGlobalRole(req.user?.role)) {
            fetchQuery = fetchQuery.eq('branch_id', req.user?.branch_id);
        }

        const { data: shift, error: shiftError } = await fetchQuery.maybeSingle();
        if (shiftError) throw shiftError;
        if (!shift) throw new AppError('Shift not found', 404);

        const { data: actualCollections, error: actualCollectionsError } = await supabase
            .from('shift_actual_collections')
            .select('*')
            .eq('shift_id', id);
        if (actualCollectionsError) throw actualCollectionsError;

        const hasVariance = (actualCollections || []).some((row: any) => Math.abs(toNumber(row?.variance)) > 0.009);
        if (hasVariance) {
            if (!String(variance_reason_code || '').trim()) {
                throw new AppError('A variance reason code is required before hard-closing a shift with discrepancies.', 400);
            }
            if (!String(variance_comment || '').trim()) {
                throw new AppError('An audit comment is required before hard-closing a shift with discrepancies.', 400);
            }
        }

        let query = supabase
            .from('cashier_shift_logs')
            .update({
                status: 'reconciled',
                reconciliation_status: 'hard_closed',
                reconciled_by: userId,
                reconciled_at: now,
                reconciliation_notes,
                variance_reason_code: String(variance_reason_code || '').trim() || null,
                variance_comment: String(variance_comment || '').trim() || null,
                hard_closed_by: userId,
                hard_closed_at: now,
                updated_at: now
            })
            .eq('id', id);
            
        // Enforce branch isolation
        if (!isGlobalRole(req.user?.role)) {
            query = query.eq('branch_id', req.user?.branch_id);
        }
        
        const { data, error } = await query.select().single();

        if (error) throw error;

        const { error: logbookUpdateError } = await supabase
            .from('cashier_logbooks')
            .update({
                accountant_reviewed_by: userId,
                accountant_reviewed_at: now,
                accountant_notes: reconciliation_notes || String(variance_comment || '').trim() || null,
                status: 'pending_audit',
                updated_at: now
            })
            .eq('cashier_shift_id', id);
        if (logbookUpdateError) throw logbookUpdateError;

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Verify shift (Auditor)
// @route   PUT /api/cashier/shifts/:id/verify
// @access  Private (Auditor)
export const verifyShift = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { verification_notes } = req.body;
        const userId = req.user?.id;

        let query = supabase
            .from('cashier_shift_logs')
            .update({
                status: 'verified',
                verified_by: userId,
                verified_at: new Date().toISOString(),
                verification_notes,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
            
        // Enforce branch isolation
        if (!isGlobalRole(req.user?.role)) {
            query = query.eq('branch_id', req.user?.branch_id);
        }
        
        const { data, error } = await query.select().single();

        if (error) throw error;

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Add transaction to shift
// @route   POST /api/cashier/shifts/:id/transactions
// @access  Private
export const addShiftTransaction = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { transaction_id, transaction_ref, payment_method, amount } = req.body;
        const userId = req.user?.id;
        const userRole = (req.user?.role || '').toString().toLowerCase();

        // 1. Fetch shift to verify ownership
        const { data: shift, error: shiftError } = await supabase
            .from('cashier_shift_logs')
            .select('*')
            .eq('id', id)
            .single();

        if (shiftError || !shift) {
            throw new AppError('Shift not found', 404);
        }

        // 2. Ownership & Branch check
        const isManager = [
            'super_admin',
            'general_manager',
            'branch_manager',
            'accountant',
            'branch_accountant',
            'auditor'
        ].includes(userRole) || isGlobalRole(userRole);

        if (shift.cashier_id !== userId && !isManager) {
            throw new AppError('You can only add transactions to your own shifts', 403);
        }

        if (!isGlobalRole(userRole) && shift.branch_id !== req.user?.branch_id) {
            throw new AppError('Unauthorized branch access', 403);
        }

        if (shift.status !== 'open') {
            throw new AppError('Cannot add transactions to a closed shift', 400);
        }

        const { data, error } = await supabase
            .from('cashier_shift_transactions')
            .insert({
                shift_id: id,
                transaction_id,
                transaction_ref,
                payment_method,
                amount,
                transaction_time: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};
