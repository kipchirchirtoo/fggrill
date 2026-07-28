import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import db from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { performanceMonitor } from '../utils/performance-monitor';
import { billCache, BillCache } from '../utils/bill-cache';
import { migratePendingBills } from '../jobs/migrate-pending-bills.job';
import { paymentVerificationService } from '../services/payment.verification.service';
import { mpesaService } from '../services/mpesa.service';
import notificationService from '../services/notification.service';
import { deductIngredientsForItem } from './kitchen/recipes.controller';
import { applyBranchFilter, isGlobalRole } from '../utils/branchIsolation';
import { getPaymentMethodBreakdown } from '../utils/paymentMethodBreakdown';
import {
    assignedOutletIds,
    canAccessPosOutlet,
    isBarStationType,
    loadAssignedPosOutlets,
    shouldRestrictCashierStationAccess,
    stationDisplayName,
    stationTypesForCashierRole
} from '../utils/posStationAccess';
import axios from 'axios';
import { PYTHON_SERVICE_URL } from '../config/pythonService';
import PDFDocument from 'pdfkit';
import { loadCashierVoidAudit } from '../services/cashier-void-audit.service';

function isImmediateCashierPaymentMethod(method?: string): boolean {
    const normalized = (method || '').toLowerCase();
    return [
        'cash',
        'mpesa',
        'mpesa_manual',
        'm-pesa',
        'card',
        'card_manual',
        'bank',
        'bank_transfer',
        'credit_bill',
        'credit_bill_manual'
    ].includes(normalized);
}

function normalizeRestaurantBillPaymentMethod(method?: string): string {
    const normalized = (method || '').toLowerCase().replace(/[\s_-]/g, '');
    if (normalized.includes('mpesa')) return 'MPESA';
    if (normalized.includes('card')) return 'CARD';
    if (normalized.includes('bank')) return 'BANK_TRANSFER';
    if (normalized.includes('credit')) return 'CREDIT';
    return 'CASH';
}

function posOrderLocation(order: any, fallbackStation: string): string {
    const orderType = String(order?.order_type || '').toLowerCase();
    const tableNumber = String(order?.table_number || '').trim();
    const roomNumber = String(order?.room_number || '').trim();
    if (orderType === 'dine_in' && tableNumber) return `Table ${tableNumber}`;
    if (orderType === 'room_service' && roomNumber) return `Room ${roomNumber}`;
    if (orderType === 'takeaway') return 'Takeaway';
    if (String(order?.customer_name || '').trim()) return String(order.customer_name).trim();
    return fallbackStation;
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

const PUBLIC_SHORT_CODE_PATTERN = /^(?:[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}|[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}|\d{4,8})$/;

type CashierShortCodeResolution = {
    source: string;
    lookupId: string;
    row?: any;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeUuidOrNull(value: unknown): string | null {
    const text = String(value || '').trim();
    return UUID_PATTERN.test(text) ? text : null;
}

function parseBranchId(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function resolveCashierBranchId(req: Request, requestedBranchId?: unknown): number {
    const userBranchId = parseBranchId(req.user?.branch_id ?? req.user?.branchId);
    const requested = parseBranchId(requestedBranchId);
    const isGlobal = isGlobalRole(req.user?.role);

    if (!isGlobal) {
        if (!userBranchId) {
            throw new AppError('Branch context is required for cashier POS access', 403);
        }
        if (requested && requested !== userBranchId) {
            throw new AppError('Forbidden: cannot access POS items from another branch', 403);
        }
        return userBranchId;
    }

    const effectiveBranchId = requested || userBranchId;
    if (!effectiveBranchId) {
        throw new AppError('branch_id is required for POS branch isolation', 400);
    }
    return effectiveBranchId;
}

type CashierCreditStaffProfile = {
    id: string;
    name: string;
    employeeId: string | null;
    department: string | null;
    branchId: number | null;
};

function cashierUserName(user: any): string {
    return [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() ||
        user?.email ||
        'Unknown cashier';
}

async function fetchCashierUsersById(ids: unknown[]): Promise<Map<string, any>> {
    const userIds = Array.from(new Set(
        ids
            .map((id) => String(id || '').trim())
            .filter(Boolean)
    ));

    if (!userIds.length) {
        return new Map();
    }

    const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .in('id', userIds);

    if (error) {
        logger.warn('Unable to attach cashier user details', { error: error.message });
        return new Map();
    }

    return new Map((data || []).map((user: any) => [String(user.id), user]));
}

async function resolveCashierCreditStaffProfile(
    staffId: unknown,
    effectiveBranchId?: number | null
): Promise<CashierCreditStaffProfile> {
    const staffKey = String(staffId || '').trim();
    if (!staffKey) {
        throw new AppError('Staff member is required for a credit bill', 400);
    }

    let query = supabase
        .from('staff_profiles')
        .select('id, first_name, last_name, national_id, department, branch_id, user_id')
        .limit(1);

    if (UUID_PATTERN.test(staffKey)) {
        query = query.or(`id.eq.${staffKey},user_id.eq.${staffKey}`);
    } else {
        const safeStaffKey = staffKey.replace(/[(),]/g, '');
        query = query.eq('national_id', safeStaffKey);
    }

    const { data: staffRows, error: staffError } = await query;

    if (staffError) {
        throw new AppError(`Staff lookup failed: ${staffError.message}`, 500);
    }

    const staff = staffRows?.[0];
    if (!staff) {
        throw new AppError('Staff profile not found for credit bill', 404);
    }

    const staffBranchId = parseBranchId(staff.branch_id);
    if (effectiveBranchId && staffBranchId && staffBranchId !== effectiveBranchId) {
        throw new AppError('Selected staff member does not belong to this branch', 403);
    }

    let userName = '';
    if (staff.user_id) {
        const { data: user } = await supabase
            .from('users')
            .select('first_name, last_name')
            .eq('id', staff.user_id)
            .maybeSingle();

        userName = String(
            [user?.first_name, user?.last_name].filter(Boolean).join(' ')
        ).trim();
    }

    const staffName = String(
        userName ||
        [staff.first_name, staff.last_name].filter(Boolean).join(' ')
    ).trim();

    return {
        id: staff.id,
        name: staffName || staff.national_id || 'Staff',
        employeeId: staff.national_id || null,
        department: staff.department || null,
        branchId: staffBranchId
    };
}

function normalizeSearchTerm(value: unknown): string {
    return String(value || '').trim();
}

function normalizePOSItemIds(items: any[]): string[] {
    return Array.from(new Set(
        items
            .map((item) => String(item?.product_id || item?.outlet_item_id || item?.id || '').trim())
            .filter((id) => UUID_PATTERN.test(id))
    ));
}

async function loadCashierPOSItems(
    branchId: number,
    options: { search?: string; itemIds?: string[] } = {}
): Promise<any[]> {
    const params: any[] = [branchId];
    const filters: string[] = ['po.branch_id = $1', 'po.is_active = TRUE', 'poi.is_active = TRUE'];

    if (options.search) {
        params.push(`%${options.search.toLowerCase()}%`);
        filters.push(`(
            LOWER(poi.name) LIKE $${params.length}
            OR LOWER(COALESCE(poi.sku, '')) LIKE $${params.length}
            OR LOWER(COALESCE(poi.category, '')) LIKE $${params.length}
            OR LOWER(COALESCE(po.name, '')) LIKE $${params.length}
        )`);
    }

    if (options.itemIds?.length) {
        params.push(options.itemIds);
        filters.push(`poi.id = ANY($${params.length}::uuid[])`);
    }

    const outletItemsSql = `
        SELECT
            poi.id::text AS id,
            poi.id::text AS product_id,
            poi.id::text AS outlet_item_id,
            poi.outlet_id::text AS outlet_id,
            po.outlet_type,
            po.name AS outlet_name,
            po.branch_id,
            poi.sku,
            poi.name,
            poi.category,
            poi.unit,
            COALESCE(poi.cost_price, 0)::numeric AS cost_price,
            COALESCE(poi.selling_price, 0)::numeric AS selling_price,
            COALESCE(poi.current_stock, 0)::numeric AS current_stock,
            COALESCE(poi.track_stock, FALSE) AS track_stock,
            'pos_outlet_items' AS source_table
        FROM pos_outlet_items poi
        JOIN pos_outlets po ON po.id = poi.outlet_id
        WHERE ${filters.join(' AND ')}
        ORDER BY po.outlet_type, poi.category NULLS LAST, poi.name
    `;

    try {
        const { rows } = await db.query(outletItemsSql, params);
        if (rows.length || options.itemIds?.length) return rows;
    } catch (error: any) {
        logger.warn(`Cashier POS outlet item lookup failed: ${error.message}`);
    }

    const menuParams: any[] = [branchId];
    const menuFilters: string[] = ['rmi.is_available = TRUE', '(rmi.branch_id IS NULL OR rmi.branch_id = $1)'];

    if (options.search) {
        menuParams.push(`%${options.search.toLowerCase()}%`);
        menuFilters.push(`(
            LOWER(rmi.name) LIKE $${menuParams.length}
            OR LOWER(COALESCE(rmi.category, '')) LIKE $${menuParams.length}
        )`);
    }

    if (options.itemIds?.length) {
        menuParams.push(options.itemIds);
        menuFilters.push(`rmi.id = ANY($${menuParams.length}::uuid[])`);
    }

    const menuItemsSql = `
        SELECT
            rmi.id::text AS id,
            rmi.id::text AS product_id,
            NULL::text AS outlet_item_id,
            NULL::text AS outlet_id,
            'restaurant' AS outlet_type,
            'Restaurant POS' AS outlet_name,
            COALESCE(rmi.branch_id, $1) AS branch_id,
            NULL::text AS sku,
            rmi.name,
            rmi.category,
            'each' AS unit,
            0::numeric AS cost_price,
            COALESCE(rmi.price, 0)::numeric AS selling_price,
            0::numeric AS current_stock,
            FALSE AS track_stock,
            'restaurant_menu_items' AS source_table
        FROM restaurant_menu_items rmi
        WHERE ${menuFilters.join(' AND ')}
        ORDER BY rmi.category NULLS LAST, rmi.name
    `;

    const { rows } = await db.query(menuItemsSql, menuParams);
    return rows;
}

function normalizeCashierPOSMethod(method?: string): string {
    return String(method || '').trim().toUpperCase();
}

function isPublicShortCode(value: string): boolean {
    return PUBLIC_SHORT_CODE_PATTERN.test(value.toUpperCase());
}

function isMissingShortCodeSchema(error: any): boolean {
    const message = `${error?.message || ''} ${error?.details || ''}`;
    return error?.code === '42703' ||
        error?.code === 'PGRST204' ||
        /short_code/i.test(message) && /column|schema cache|does not exist/i.test(message);
}

async function queryShortCodeCandidate(
    table: string,
    code: string,
    req: Request,
    select = '*'
): Promise<any | null> {
    try {
        if (table === 'pos_shift_orders') {
            const safeSelect = select.includes('shift_id') ? select : `${select}, shift_id`;
            const { data, error } = await supabase
                .from(table)
                .select(safeSelect)
                .eq('short_code', code)
                .maybeSingle();

            if (error) {
                if (isMissingShortCodeSchema(error)) return null;
                logger.warn(`Short code lookup failed on ${table}: ${error.message}`);
                return null;
            }

            if (!data) return null;

            const userBranchId = parseBranchId(req.user?.branch_id ?? req.user?.branchId);
            if (!isGlobalRole(req.user?.role) && userBranchId) {
                const { data: shift } = await supabase
                    .from('pos_outlet_shifts')
                    .select('branch_id')
                    .eq('id', (data as any).shift_id)
                    .maybeSingle();
                if (Number(shift?.branch_id) !== userBranchId) return null;
            }

            return data;
        }

        let query = supabase
            .from(table)
            .select(select)
            .eq('short_code', code);

        query = applyBranchFilter(query, req);

        const { data, error } = await query.maybeSingle();
        if (error) {
            if (isMissingShortCodeSchema(error)) return null;
            logger.warn(`Short code lookup failed on ${table}: ${error.message}`);
            return null;
        }
        return data || null;
    } catch (error: any) {
        if (isMissingShortCodeSchema(error)) return null;
        logger.warn(`Short code lookup threw on ${table}: ${error?.message || error}`);
        return null;
    }
}

async function resolveCashierScannedCode(
    code: string,
    req: Request
): Promise<CashierShortCodeResolution | null> {
    const normalized = code.toUpperCase();

    try {
        let unpaidQuery = supabase
            .from('unpaid_bills')
            .select('bill_number, scan_reference, short_code, branch_id')
            .eq('scan_reference', normalized);
        unpaidQuery = applyBranchFilter(unpaidQuery, req);

        const { data: unpaidBill, error: unpaidError } = await unpaidQuery.maybeSingle();
        if (!unpaidError && unpaidBill?.bill_number) {
            return {
                source: 'unpaid_bill',
                lookupId: String(unpaidBill.bill_number).toUpperCase(),
                row: unpaidBill
            };
        }
        if (unpaidError && !isMissingShortCodeSchema(unpaidError)) {
            logger.warn(`Scan reference lookup failed: ${unpaidError.message}`);
        }
    } catch (error: any) {
        if (!isMissingShortCodeSchema(error)) {
            logger.warn(`Scan reference lookup threw: ${error?.message || error}`);
        }
    }

    try {
        const { data: barcodeRow, error: barcodeError } = await supabase
            .from('pos_barcodes')
            .select('*')
            .eq('barcode_value', normalized)
            .maybeSingle();

        if (barcodeError) {
            if (!['42P01', '42703', 'PGRST205', 'PGRST204'].includes(barcodeError.code)) {
                logger.warn(`POS barcode lookup failed: ${barcodeError.message}`);
            }
            return null;
        }

        if (!barcodeRow) return null;

        if (barcodeRow.transaction_id) {
            const transactionKey = String(barcodeRow.transaction_id).toUpperCase();
            if (transactionKey.startsWith('CS-')) {
                return { source: 'pos', lookupId: transactionKey, row: barcodeRow };
            }

            let transactionQuery = supabase
                .from('pos_transactions')
                .select('transaction_ref, transaction_number, branch_id')
                .eq('id', barcodeRow.transaction_id);
            transactionQuery = applyBranchFilter(transactionQuery, req);
            const { data: transaction } = await transactionQuery.maybeSingle();
            if (transaction?.transaction_ref || transaction?.transaction_number) {
                return {
                    source: 'pos',
                    lookupId: String(transaction.transaction_ref || transaction.transaction_number).toUpperCase(),
                    row: transaction
                };
            }
        }

        if (barcodeRow.order_id) {
            let restaurantQuery = supabase
                .from('restaurant_orders')
                .select('order_number, branch_id')
                .eq('id', barcodeRow.order_id);
            restaurantQuery = applyBranchFilter(restaurantQuery, req);
            const { data: restaurantOrder } = await restaurantQuery.maybeSingle();
            if (restaurantOrder?.order_number) {
                return {
                    source: 'restaurant',
                    lookupId: String(restaurantOrder.order_number).toUpperCase(),
                    row: restaurantOrder
                };
            }

            let barQuery = supabase
                .from('bar_orders')
                .select('order_number, branch_id')
                .eq('id', barcodeRow.order_id);
            barQuery = applyBranchFilter(barQuery, req);
            const { data: barOrder } = await barQuery.maybeSingle();
            if (barOrder?.order_number) {
                return {
                    source: 'bar',
                    lookupId: String(barOrder.order_number).toUpperCase(),
                    row: barOrder
                };
            }
        }

        if (barcodeRow.bill_id) {
            let unpaidByIdQuery = supabase
                .from('unpaid_bills')
                .select('bill_number, branch_id')
                .eq('id', barcodeRow.bill_id);
            unpaidByIdQuery = applyBranchFilter(unpaidByIdQuery, req);
            const { data: unpaidById } = await unpaidByIdQuery.maybeSingle();
            if (unpaidById?.bill_number) {
                return {
                    source: 'unpaid_bill',
                    lookupId: String(unpaidById.bill_number).toUpperCase(),
                    row: unpaidById
                };
            }

            let restaurantBillQuery = supabase
                .from('restaurant_bills')
                .select('bill_number, branch_id')
                .eq('id', barcodeRow.bill_id);
            restaurantBillQuery = applyBranchFilter(restaurantBillQuery, req);
            const { data: restaurantBill } = await restaurantBillQuery.maybeSingle();
            if (restaurantBill?.bill_number) {
                return {
                    source: 'restaurant_bill',
                    lookupId: String(restaurantBill.bill_number).toUpperCase(),
                    row: restaurantBill
                };
            }
        }
    } catch (error: any) {
        logger.warn(`POS barcode resolution threw: ${error?.message || error}`);
    }

    return null;
}

async function resolveCashierShortCode(
    code: string,
    req: Request
): Promise<CashierShortCodeResolution | null> {
    const normalized = code.toUpperCase();
    if (!isPublicShortCode(normalized)) return null;

    const lookups: Array<{
        table: string;
        source: string;
        select: string;
        map: (row: any) => string | undefined;
    }> = [
        {
            table: 'restaurant_orders',
            source: 'restaurant',
            select: 'order_number, short_code, branch_id',
            map: (row) => row.order_number
        },
        {
            table: 'bar_orders',
            source: 'bar',
            select: 'order_number, short_code, branch_id',
            map: (row) => row.order_number
        },
        {
            table: 'pos_transactions',
            source: 'pos',
            select: 'transaction_ref, transaction_number, short_code, branch_id',
            map: (row) => row.transaction_ref || row.transaction_number
        },
        {
            table: 'pos_shift_orders',
            source: 'pos_shift_order',
            select: 'id, order_number, short_code, shift_id',
            map: (row) => row.order_number
        },
        {
            table: 'shift_transactions',
            source: 'kyogong',
            select: 'transaction_number, short_code, branch_id',
            map: (row) => row.transaction_number
        },
        {
            table: 'unpaid_bills',
            source: 'unpaid_bill',
            select: 'bill_number, short_code, branch_id',
            map: (row) => row.bill_number
        },
        {
            table: 'restaurant_bills',
            source: 'restaurant_bill',
            select: 'bill_number, short_code, branch_id',
            map: (row) => row.bill_number
        },
        {
            table: 'payments',
            source: 'payment',
            select: 'id, reference, reference_number, amount, currency, payment_method, status, short_code, branch_id',
            map: (row) => row.reference || row.reference_number
        },
        {
            table: 'reservations',
            source: 'hotel',
            select: 'confirmation_number, short_code, branch_id',
            map: (row) => row.confirmation_number
        },
        {
            table: 'conference_hall_bookings',
            source: 'conference',
            select: 'invoice_number, short_code, branch_id',
            map: (row) => row.invoice_number
        },
        {
            table: 'finance_invoices',
            source: 'invoice',
            select: 'invoice_number, short_code, branch_id',
            map: (row) => row.invoice_number
        },
        {
            table: 'accounting_ar_invoices',
            source: 'invoice',
            select: 'invoice_number, short_code, branch_id',
            map: (row) => row.invoice_number
        }
    ];

    for (const lookup of lookups) {
        const row = await queryShortCodeCandidate(lookup.table, normalized, req, lookup.select);
        const lookupId = row ? lookup.map(row) : undefined;
        if (lookupId) {
            return { source: lookup.source, lookupId: String(lookupId).toUpperCase(), row };
        }
    }

    return null;
}


type OutletPosOrderResolution = {
    order: any;
    shift: any;
    originalOrder?: any;
};

async function reconcileSettledOutletPosOrder(order: any): Promise<any> {
    const totalAmount = Number(order?.total_amount || 0);
    if (!order?.id || totalAmount <= 0) return order;

    const currentStatus = String(order.payment_status || '').toLowerCase();
    if (['paid', 'credit_bill', 'voided'].includes(currentStatus)) return order;

    const currentPaid = Number(order.amount_paid || 0);
    const currentBalance = Number(order.balance_amount ?? Math.max(0, totalAmount - currentPaid));
    let reconciledPaid = currentPaid;

    // If power/network died between writing payment rows and finalizing the
    // order row, recover from the durable payment ledger before showing or
    // accepting another payment for the bill.
    if (currentPaid + 0.01 < totalAmount || currentBalance > 0.01) {
        const { data: paymentRows, error: paymentError } = await supabase
            .from('pos_shift_payments')
            .select('amount')
            .eq('order_id', order.id);
        if (paymentError) {
            logger.warn('Failed to reconcile POS shift payments for settled order check', {
                orderId: order.id,
                error: paymentError.message
            });
        } else {
            const ledgerPaid = (paymentRows || []).reduce(
                (sum: number, row: any) => sum + Number(row.amount || 0),
                0
            );
            if (ledgerPaid > reconciledPaid) reconciledPaid = ledgerPaid;
        }
    }

    const nextBalance = Math.max(0, totalAmount - reconciledPaid);
    const isSettled = reconciledPaid + 0.01 >= totalAmount || nextBalance <= 0.01;
    if (!isSettled) return order;

    const { data: updated, error: updateError } = await supabase
        .from('pos_shift_orders')
        .update({
            status: 'paid',
            payment_status: 'paid',
            amount_paid: reconciledPaid,
            balance_amount: 0,
            updated_at: new Date().toISOString()
        })
        .eq('id', order.id)
        .select('*')
        .single();

    if (updateError) {
        logger.warn('Failed to auto-finalize settled POS order', {
            orderId: order.id,
            error: updateError.message
        });
        return order;
    }

    return updated || order;
}

async function loadOutletPosShiftIdsForLookup(req: Request): Promise<string[] | null> {
    const requestedBranchId = parseBranchId(req.query.branch_id);
    const userBranchId = parseBranchId(req.user?.branch_id ?? req.user?.branchId);

    if (!isGlobalRole(req.user?.role)) {
        if (requestedBranchId && userBranchId && requestedBranchId !== userBranchId) {
            throw new AppError('Forbidden: cannot access POS bills from another branch', 403);
        }

        if (!userBranchId) return [];

        const { data: shifts, error } = await supabase
            .from('pos_outlet_shifts')
            .select('id')
            .eq('branch_id', userBranchId);

        if (error) throw new AppError(`POS shift lookup failed: ${error.message}`, 500);
        return (shifts || []).map((shift: any) => String(shift.id));
    }

    if (!requestedBranchId) return null;

    const { data: shifts, error } = await supabase
        .from('pos_outlet_shifts')
        .select('id')
        .eq('branch_id', requestedBranchId);

    if (error) throw new AppError(`POS shift lookup failed: ${error.message}`, 500);
    return (shifts || []).map((shift: any) => String(shift.id));
}

async function queryOutletPosOrderByColumn(
    column: 'id' | 'order_number' | 'short_code',
    value: string,
    shiftIds: string[] | null
): Promise<any | null> {
    let query = supabase
        .from('pos_shift_orders')
        .select('*')
        .eq(column, value)
        .not('status', 'eq', 'cancelled')
        .not('payment_status', 'eq', 'voided')
        .limit(1);

    if (shiftIds) {
        if (!shiftIds.length) return null;
        query = query.in('shift_id', shiftIds);
    }

    const { data, error } = await query;
    if (error) {
        throw new AppError(`POS bill lookup failed: ${error.message}`, 500);
    }

    return data?.[0] || null;
}

async function findOutletPosOrderByReference(
    reference: unknown,
    req: Request
): Promise<OutletPosOrderResolution | null> {
    const rawReference = normalizeSearchTerm(reference);
    if (!rawReference) return null;

    const normalized = rawReference.toUpperCase();
    const shiftIds = await loadOutletPosShiftIdsForLookup(req);
    const uuid = normalizeUuidOrNull(rawReference);

    const candidates: Array<{ column: 'id' | 'order_number' | 'short_code'; value: string }> = [];
    if (uuid) candidates.push({ column: 'id', value: uuid });
    candidates.push({ column: 'order_number', value: normalized });
    candidates.push({ column: 'short_code', value: normalized });

    let order: any | null = null;
    for (const candidate of candidates) {
        order = await queryOutletPosOrderByColumn(candidate.column, candidate.value, shiftIds);
        if (order) break;
    }

    if (!order) return null;

    let targetOrder = order;
    if (order.is_merged && order.merged_into) {
        const mergedTarget = await queryOutletPosOrderByColumn('id', String(order.merged_into), shiftIds);
        if (mergedTarget) targetOrder = mergedTarget;
    }

    targetOrder = await reconcileSettledOutletPosOrder(targetOrder);

    const { data: shift, error: shiftError } = await supabase
        .from('pos_outlet_shifts')
        .select('id, branch_id, outlet_id, outlet:pos_outlets(name, outlet_type)')
        .eq('id', targetOrder.shift_id)
        .maybeSingle();

    if (shiftError) throw new AppError(`POS shift lookup failed: ${shiftError.message}`, 500);
    if (!shift) return null;

    const userBranchId = parseBranchId(req.user?.branch_id ?? req.user?.branchId);
    if (!isGlobalRole(req.user?.role) && userBranchId && Number(shift.branch_id) !== userBranchId) {
        return null;
    }

    return {
        order: targetOrder,
        shift,
        originalOrder: targetOrder.id === order.id ? undefined : order
    };
}

function buildOutletPosBillResponse(resolution: OutletPosOrderResolution): Record<string, unknown> {
    const posOrder = resolution.order;
    const items = Array.isArray(posOrder.items) ? posOrder.items : [];
    const totalAmount = Number(posOrder.total_amount || 0);
    const amountPaid = Number(posOrder.amount_paid || 0);
    const balance = Math.max(0, totalAmount - amountPaid);
    const outlet = Array.isArray(resolution.shift?.outlet)
        ? resolution.shift.outlet[0]
        : resolution.shift?.outlet;

    return {
        success: true,
        data: {
            type: 'pos_shift_order',
            source: 'pos',
            merged_from: resolution.originalOrder ? {
                id: resolution.originalOrder.id,
                order_number: resolution.originalOrder.order_number,
                short_code: resolution.originalOrder.short_code
            } : undefined,
            order: {
                id: posOrder.id,
                order_number: posOrder.order_number,
                short_code: posOrder.short_code,
                guest_name: posOrder.customer_name || 'Walk-in',
                waiter_name: posOrder.waiter_name,
                station_name: outlet?.name,
                station_type: outlet?.outlet_type,
                status: posOrder.payment_status === 'paid' ? 'cleared' : 'unpaid',
                items: items.map((item: any) => ({
                    name: item.name || item.item_name || 'POS item',
                    quantity: Number(item.quantity || item.qty || 1),
                    price: Number(item.unit_price || item.price || 0),
                    total: Number(item.line_total || item.total || 0)
                }))
            },
            financials: {
                total_amount: totalAmount,
                amount_paid: amountPaid,
                balance,
                currency: 'KES'
            },
            payment_status: posOrder.payment_status === 'paid' ? 'cleared' : posOrder.payment_status
        }
    };
}

// Helper function to determine lookup strategy based on ID format
function determineLookupStrategy(searchId: string): { type: string, prefix?: string } {
    // UUID pattern
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchId)) {
        return { type: 'uuid' };
    }
    
    // Prefix patterns
    if (searchId.startsWith('INV')) return { type: 'invoice', prefix: 'INV' };
    if (searchId.startsWith('HTL')) return { type: 'hotel', prefix: 'HTL' };
    if (searchId.startsWith('ORD')) return { type: 'restaurant', prefix: 'ORD' };
    if (searchId.startsWith('BAR')) return { type: 'bar', prefix: 'BAR' };
    if (searchId.startsWith('CNF')) return { type: 'conference', prefix: 'CNF' };
    if (searchId.startsWith('CS')) return { type: 'pos', prefix: 'CS' };
    if (searchId.startsWith('POS')) return { type: 'pos_captain', prefix: 'POS' };
    
    // Kyogong pattern: PREFIX-DATE-RANDOM
    const kyogongPattern = /^[A-Z]+-\d{8}-\d{4}$/;
    if (kyogongPattern.test(searchId) || searchId.includes('-202')) {
        return { type: 'kyogong' };
    }
    
    // Other bill prefixes
    const billPrefixes = ['CON', 'POL', 'CWS', 'BILL'];
    for (const prefix of billPrefixes) {
        if (searchId.startsWith(prefix)) {
            return { type: 'bill', prefix };
        }
    }
    
    // Fallback to room lookup for simple numbers/strings
    return { type: 'room' };
}

/**
 * Get Bill Details by Booking ID (or Barcode)
 */
export const getBillDetails = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const timer = performanceMonitor.startTimer('getBillDetails');
    
    try {
        const { bookingId } = req.params;

        if (!bookingId) {
            timer.end(false, 'Missing bookingId parameter');
            throw new AppError('ID is required', 400);
        }

        let searchId = bookingId.toUpperCase();
        const branchId = req.user?.branch_id;
        
        // Check cache first
        const cacheKey = BillCache.generateKey(searchId, branchId);
        const cachedResult = billCache.get(cacheKey);
        if (cachedResult) {
            timer.end(true);
            res.json(cachedResult);
            return;
        }
        
        // Quick prefix-based routing to avoid unnecessary lookups
        let lookupStrategy = determineLookupStrategy(searchId);
        
        // Handle scanned codes and short codes first
        const scannedCodeResolution = await resolveCashierScannedCode(searchId, req);
        if (scannedCodeResolution) {
            searchId = scannedCodeResolution.lookupId;
        }

        const shortCodeResolution = await resolveCashierShortCode(searchId, req);
        if (shortCodeResolution) {
            if (shortCodeResolution.source === 'payment') {
                const payment = shortCodeResolution.row;
                const responseData = {
                    success: true,
                    data: {
                        type: 'payment_receipt',
                        payment: {
                            id: payment.id,
                            short_code: payment.short_code,
                            reference: payment.reference || payment.reference_number,
                            status: payment.status,
                            payment_method: payment.payment_method
                        },
                        financials: {
                            total_amount: payment.amount || 0,
                            amount_paid: payment.amount || 0,
                            balance: 0,
                            currency: payment.currency || 'KES'
                        },
                        payment_status: payment.status || 'completed'
                    }
                };
                
                // Cache for a shorter time since payments are sensitive
                billCache.set(cacheKey, responseData, 2 * 60 * 1000); // 2 minutes
                timer.end(true);
                res.json(responseData);
                return;
            }
            searchId = shortCodeResolution.lookupId;
        }

        lookupStrategy = determineLookupStrategy(searchId);

        const outletPosLookupReference = shortCodeResolution?.source === 'pos_shift_order' && shortCodeResolution.row?.id
            ? shortCodeResolution.row.id
            : searchId;
        const shouldTryOutletPosLookup = shortCodeResolution?.source === 'pos_shift_order'
            || searchId.startsWith('POS')
            || searchId.startsWith('MERGE-')
            || searchId.startsWith('SPLIT-')
            || isPublicShortCode(searchId)
            || Boolean(normalizeUuidOrNull(searchId));

        if (shouldTryOutletPosLookup) {
            const outletPosOrder = await findOutletPosOrderByReference(outletPosLookupReference, req);
            if (outletPosOrder) {
                const userRole = (req.user as any)?.role?.toLowerCase() || '';
                if (!isGlobalRole(userRole)) {
                    const { shift } = outletPosOrder;
                    const outletRaw = Array.isArray(shift?.outlet) ? shift.outlet[0] : shift?.outlet;
                    const outletObj = {
                        id: shift?.outlet_id,
                        outlet_type: outletRaw?.outlet_type,
                        branch_id: shift?.branch_id,
                        name: outletRaw?.name
                    };
                    const assignedOutlets = await loadAssignedPosOutlets(supabase, (req.user as any)?.id);
                    if (!canAccessPosOutlet(userRole, outletObj, assignedOutlets, (req.user as any)?.branch_id ?? (req.user as any)?.branchId)) {
                        throw new AppError('Forbidden: you do not have access to this POS station', 403);
                    }
                }
                const responseData = buildOutletPosBillResponse(outletPosOrder);
                billCache.set(cacheKey, responseData);
                timer.end(true);
                res.json(responseData);
                return;
            }
        }

        // Route to specific handlers based on prefix for better performance
        if (lookupStrategy.type === 'invoice') {
            // Optimized invoice lookup - check both tables in parallel
            const [arInvoiceResult, finInvoiceResult] = await Promise.allSettled([
                supabase
                    .from('accounting_ar_invoices')
                    .select(`
                        *,
                        customer:accounting_customers(id, customer_name, email, phone)
                    `)
                    .eq('invoice_number', searchId)
                    .single(),
                supabase
                    .from('finance_invoices')
                    .select('*')
                    .eq('invoice_number', searchId)
                    .single()
            ]);

            // Check AR invoice first
            if (arInvoiceResult.status === 'fulfilled' && arInvoiceResult.value.data) {
                const arInvoice = arInvoiceResult.value.data;
                const responseData = {
                    success: true,
                    data: {
                        type: 'invoice',
                        source: 'accounting',
                        invoice: {
                            id: arInvoice.id,
                            invoice_number: arInvoice.invoice_number,
                            short_code: arInvoice.short_code,
                            customer_name: arInvoice.customer?.customer_name || 'Walk-in',
                            status: arInvoice.status,
                            items: (arInvoice.items || []).map((item: any) => ({
                                name: item.description || item.item_name || 'Item',
                                quantity: item.quantity || item.qty || 1,
                                price: item.unit_price || item.unitPrice || 0,
                                total: item.total_amount || item.totalAmount || 0
                            }))
                        },
                        financials: {
                            total_amount: arInvoice.total_amount,
                            amount_paid: Number(arInvoice.total_amount) - Number(arInvoice.balance),
                            balance: arInvoice.balance,
                            currency: 'KES'
                        },
                        payment_status: arInvoice.status === 'paid' ? 'paid' : (arInvoice.balance < arInvoice.total_amount ? 'partial' : 'unpaid')
                    }
                };
                
                billCache.set(cacheKey, responseData);
                timer.end(true);
                res.json(responseData);
                return;
            }

            // Check finance invoice second
            if (finInvoiceResult.status === 'fulfilled' && finInvoiceResult.value.data) {
                const finInvoice = finInvoiceResult.value.data;
                res.json({
                    success: true,
                    data: {
                        type: 'invoice',
                        source: 'finance',
                        invoice: {
                            id: finInvoice.id,
                            invoice_number: finInvoice.invoice_number,
                            short_code: finInvoice.short_code,
                            customer_name: finInvoice.customer_name || 'Walk-in',
                            status: finInvoice.status,
                            items: []
                        },
                        financials: {
                            total_amount: finInvoice.total_amount,
                            amount_paid: finInvoice.paid_amount || 0,
                            balance: Number(finInvoice.total_amount) - Number(finInvoice.paid_amount || 0),
                            currency: 'KES'
                        },
                        payment_status: finInvoice.status === 'paid' ? 'paid' : (finInvoice.paid_amount > 0 ? 'partial' : 'unpaid')
                    }
                });
                return;
            }

            timer.end(false, 'Invoice not found in any ledger');
            throw new AppError('Invoice not found in any ledger', 404);
        }

        // Hotel reservation lookup (HTL prefix)
        if (lookupStrategy.type === 'hotel') {
            let hotelQuery = supabase
                .from('reservations')
                .select(`
                    *,
                    room:rooms(room_number, branch_id)
                `)
                .eq('confirmation_number', searchId);

            const { data: reservation, error: resError } = await hotelQuery.single();

            if (resError) {
                if (resError.code === 'PGRST116') {
                    throw new AppError('Hotel reservation not found', 404);
                }
                throw resError;
            }

            if (!reservation) {
                throw new AppError('Hotel reservation not found', 404);
            }

            // Load the guest FOLIO so the cashier settles the WHOLE unpaid bill
            // (room booking + every Charge-to-Room POS bill), not the room only.
            const { data: folio } = await supabase
                .from('folios')
                .select('id, food_charges, beverage_charges, other_charges, total_payments')
                .eq('reservation_id', reservation.id)
                .maybeSingle();
            const roomTotal = parseFloat(reservation.total_amount || 0);
            const posCharges =
                Number(folio?.food_charges || 0) +
                Number(folio?.beverage_charges || 0) +
                Number(folio?.other_charges || 0);
            const reservationPaid = Math.max(
                Number(reservation.amount_paid || 0),
                Number(reservation.deposit_amount || 0)
            );
            const folioPayments = Number(folio?.total_payments || 0);

            const totalAmount = roomTotal + posCharges;
            const paidAmount = reservationPaid + folioPayments;
            const balance = Math.max(0, totalAmount - paidAmount);

            // Itemise each Charge-to-Room POS bill from the folio audit trail.
            const posItems: Array<Record<string, any>> = [];
            if (folio?.id && posCharges > 0) {
                const { data: ftx } = await supabase
                    .from('folio_transactions')
                    .select('description, amount, category')
                    .eq('folio_id', folio.id)
                    .eq('transaction_type', 'charge')
                    .order('created_at', { ascending: true });
                for (const t of (ftx || [])) {
                    posItems.push({
                        name: (t as any).description || `Charge to Room (${(t as any).category || 'POS'})`,
                        quantity: 1,
                        price: Number((t as any).amount || 0),
                        total: Number((t as any).amount || 0),
                    });
                }
                if (posItems.length === 0) {
                    posItems.push({ name: 'Charge to Room (POS)', quantity: 1, price: posCharges, total: posCharges });
                }
            }

            const responseData = {
                success: true,
                data: {
                    type: 'hotel',
                    source: 'reservations',
                    booking: {
                        id: reservation.id,
                        order_number: reservation.confirmation_number,
                        short_code: reservation.short_code,
                        guest_name: reservation.guest_name || 'Guest',
                        room_number: reservation.room?.room_number || reservation.room_number,
                        status: reservation.status,
                        check_in: reservation.check_in_date || reservation.check_in,
                        check_out: reservation.check_out_date || reservation.check_out,
                        items: [
                            {
                                name: `Accommodation Services (${reservation.room_type || 'Room'})`,
                                quantity: 1,
                                price: roomTotal,
                                total: roomTotal,
                            },
                            ...posItems,
                        ],
                    },
                    financials: {
                        total_amount: totalAmount,
                        amount_paid: paidAmount,
                        balance: balance,
                        currency: 'KES'
                    },
                    payment_status: balance <= 0 ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid')
                }
            };

            billCache.set(cacheKey, responseData);
            timer.end(true);
            res.json(responseData);
            return;
        }

        // For other types, fall back to the original implementation for now
        // This maintains backward compatibility while we optimize incrementally
        if (searchId.startsWith('ORD')) {
            // Fetch restaurant order details
            let restaurantQuery = supabase
                .from('restaurant_orders')
                .select(`
                    *,
                    items:restaurant_order_items(
                        *,
                        menu_item:restaurant_menu_items(name)
                    )
                `)
                .or(`order_number.eq.${searchId},order_number.eq.${searchId + ' '}`);

            // Branch isolation
            restaurantQuery = applyBranchFilter(restaurantQuery, req);

            const { data: order, error: orderError } = await restaurantQuery.single();

            if (orderError || !order) {
                throw new AppError('Restaurant order not found', 404);
            }

            const userRole = (req.user as any)?.role?.toLowerCase() || '';
            if (!isGlobalRole(userRole)) {
                const assignedOutlets = await loadAssignedPosOutlets(supabase, (req.user as any)?.id);
                const assignedIds = assignedOutletIds(assignedOutlets);

                let outlet: any = null;
                if (order.outlet_id) {
                    const { data: outletData } = await supabase
                        .from('pos_outlets')
                        .select('id, name, outlet_type, branch_id')
                        .eq('id', order.outlet_id)
                        .maybeSingle();
                    outlet = outletData;
                }

                if (outlet) {
                    if (!canAccessPosOutlet(userRole, outlet, assignedOutlets, (req.user as any)?.branch_id ?? (req.user as any)?.branchId)) {
                        throw new AppError('Forbidden: you do not have access to this restaurant POS station', 403);
                    }
                } else {
                    const stationRestricted = shouldRestrictCashierStationAccess(userRole, assignedIds, (req.user as any)?.branch_id ?? (req.user as any)?.branchId);
                    if (stationRestricted) {
                        const roleOutletTypes = stationTypesForCashierRole(userRole, (req.user as any)?.branch_id ?? (req.user as any)?.branchId);
                        const allowedTypes = new Set([
                            ...roleOutletTypes,
                            ...assignedOutlets.map(o => String(o.outlet_type || '').toLowerCase()).filter(Boolean)
                        ]);
                        if (!allowedTypes.has('restaurant')) {
                            throw new AppError('Forbidden: you do not have access to restaurant bills', 403);
                        }
                    }
                }
            }

            res.json({
                success: true,
                data: {
                    type: 'restaurant',
	                    order: {
	                        id: order.id,
	                        order_number: order.order_number,
	                        short_code: order.short_code,
	                        order_type: order.order_type,
	                        table_number: order.table_number,
                        room_number: order.room_number,
                        guest_name: order.guest_name || 'Walk-in',
                        status: order.status,
                        items: order.items?.map((item: any) => ({
                            name: item.menu_item?.name || 'Unknown Item',
                            quantity: item.quantity,
                            price: item.unit_price,
                            total: item.total_price
                        }))
                    },
                    financials: {
                        total_amount: order.total_amount,
                        amount_paid: order.payment_status === 'paid' ? order.total_amount : 0,
                        balance: order.payment_status === 'paid' ? 0 : order.total_amount,
                        currency: 'KES'
                    },
                    payment_status: order.payment_status
                }
            });
            return;
        }

        // Check if it's a bar order (starts with BAR)
        if (searchId.startsWith('BAR')) {
            // Fetch bar order details
            let barQuery = supabase
                .from('bar_orders')
                .select(`
                    *,
                    items:bar_order_items(*)
                `)
                .or(`order_number.eq.${searchId},order_number.eq.${searchId + ' '}`);

            // Branch isolation
            barQuery = applyBranchFilter(barQuery, req);

            const { data: order, error: orderError } = await barQuery.single();

            if (orderError || !order) {
                throw new AppError('Bar order not found', 404);
            }

            const userRole = (req.user as any)?.role?.toLowerCase() || '';
            if (!isGlobalRole(userRole)) {
                const assignedOutlets = await loadAssignedPosOutlets(supabase, (req.user as any)?.id);
                const assignedIds = assignedOutletIds(assignedOutlets);

                let outlet: any = null;
                if (order.outlet_id) {
                    const { data: outletData } = await supabase
                        .from('pos_outlets')
                        .select('id, name, outlet_type, branch_id')
                        .eq('id', order.outlet_id)
                        .maybeSingle();
                    outlet = outletData;
                }

                if (outlet) {
                    if (!canAccessPosOutlet(userRole, outlet, assignedOutlets, (req.user as any)?.branch_id ?? (req.user as any)?.branchId)) {
                        throw new AppError('Forbidden: you do not have access to this bar POS station', 403);
                    }
                } else {
                    const stationRestricted = shouldRestrictCashierStationAccess(userRole, assignedIds, (req.user as any)?.branch_id ?? (req.user as any)?.branchId);
                    if (stationRestricted) {
                        const roleOutletTypes = stationTypesForCashierRole(userRole, (req.user as any)?.branch_id ?? (req.user as any)?.branchId);
                        const allowedTypes = new Set([
                            ...roleOutletTypes,
                            ...assignedOutlets.map(o => String(o.outlet_type || '').toLowerCase()).filter(Boolean)
                        ]);
                        const hasBarAccess = Array.from(allowedTypes).some(isBarStationType);
                        if (!hasBarAccess) {
                            throw new AppError('Forbidden: you do not have access to bar bills', 403);
                        }
                    }
                }
            }

            // Fetch payments for bar order
            const { data: payments } = await supabase
                .from('payments')
                .select('*')
                .eq('bar_order_id', order.id)
                .eq('status', 'completed');

            const amountPaid = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
            const balance = order.total - amountPaid;

            res.json({
                success: true,
                data: {
                    type: 'bar',
	                    order: {
	                        id: order.id,
	                        order_number: order.order_number,
	                        short_code: order.short_code,
	                        order_type: order.order_type,
                        table_number: order.seat_number, // bar uses seat_number
                        room_number: order.room_number,
                        guest_name: order.guest_name || 'Walk-in',
                        status: order.status,
                        items: order.items?.map((item: any) => ({
                            name: item.drink_name,
                            quantity: item.quantity,
                            price: item.unit_price,
                            total: item.total_price
                        }))
                    },
                    financials: {
                        total_amount: order.total,
                        amount_paid: amountPaid,
                        balance: balance,
                        currency: 'KES'
                    },
                    payment_status: order.payment_status,
                    payments: payments
                }
            });
            return;
        }

        // Check if it's a Kyogong Shift Transaction (SPA, EXEC, SPORTS, REC, etc.)
        // Pattern: PREFIX-DATE-RANDOM
        const kyogongPattern = /^[A-Z]+-\d{8}-\d{4}$/;
        if (kyogongPattern.test(searchId) || searchId.includes('-202')) {
            let kyogongQuery = supabase
                .from('shift_transactions')
                .select(`
                    *,
                    items:shift_transaction_items(*),
                    branch:branches(name)
                `)
                .eq('transaction_number', searchId);

            kyogongQuery = applyBranchFilter(kyogongQuery, req);

            const { data: tx, error: txError } = await kyogongQuery.single();

            if (!txError && tx) {
                res.json({
                    success: true,
                    data: {
                        type: 'kyogong',
	                    order: {
	                        id: tx.id,
	                        order_number: tx.transaction_number,
	                        short_code: tx.short_code,
	                        guest_name: tx.customer_name || 'Walk-in',
                            status: tx.status,
                            service_category: tx.service_category,
                            items: tx.items?.map((item: any) => ({
                                name: item.item_name,
                                quantity: item.quantity,
                                price: item.unit_price,
                                total: item.total_price
                            }))
                        },
                        financials: {
                            total_amount: tx.total_amount,
                            amount_paid: tx.payment_method === 'BILL' ? 0 : tx.total_amount,
                            balance: tx.payment_method === 'BILL' ? tx.total_amount : 0,
                            currency: 'KES'
                        },
                        payment_status: tx.payment_method === 'BILL' ? 'unpaid' : 'paid'
                    }
                });
                return;
            }
        }

        // Check if it's a Conference Invoice (starts with CNF)
        if (searchId.startsWith('CNF')) {
            const { data: booking, error: bookingError } = await supabase
                .from('conference_hall_bookings')
                .select('*')
                .eq('invoice_number', searchId)
                .single();

            if (!bookingError && booking) {
                const balance = booking.total_amount - (booking.amount_paid || 0);
                
                res.json({
                    success: true,
                    data: {
                        type: 'conference',
                        booking: {
                            id: booking.id,
                            invoice_number: booking.invoice_number,
                            short_code: booking.short_code,
                            company_name: booking.company_name || booking.customer_name,
                            contact_person: booking.contact_person,
                            phone: booking.customer_phone,
                            email: booking.customer_email,
                            start_date: booking.start_date,
                            end_date: booking.end_date,
                            status: booking.payment_status,
                            items: [] // Conference bookings typically don't have line items
                        },
                        financials: {
                            total_amount: booking.total_amount,
                            amount_paid: booking.amount_paid || 0,
                            balance: balance,
                            currency: 'KES'
                        },
                        payment_status: booking.payment_status
                    }
                });
                return;
            }
        }

        // Check if it's a POS transaction (starts with CS)
        if (searchId.startsWith('CS')) {
            const cleanId = searchId.startsWith('CS-') ? searchId : `CS-${searchId.slice(2)}`;

            let posQuery = supabase
                .from('pos_transactions')
                .select(`
                    *,
                    items:pos_transaction_items(
                        *,
                        product:restaurant_menu_items(name)
                    )
                `)
                .eq('transaction_ref', searchId);

            posQuery = applyBranchFilter(posQuery, req);

            let { data: finalTx, error: txError } = await posQuery.single();

            // If not found by searchId, try cleanId if they differ
            if ((txError || !finalTx) && cleanId !== searchId) {
                let cleanIdQuery = supabase
                    .from('pos_transactions')
                    .select('*, items:pos_transaction_items(*, product:restaurant_menu_items(name))')
                    .eq('transaction_ref', cleanId);

                cleanIdQuery = applyBranchFilter(cleanIdQuery, req);
                const { data: tx2 } = await cleanIdQuery.single();
                finalTx = tx2;
            }

            if (!finalTx) {
                throw new AppError('POS Transaction not found', 404);
            }

            res.json({
                success: true,
                data: {
                    type: 'pos',
	                    order: {
	                        id: finalTx.id,
	                        order_number: finalTx.transaction_ref,
	                        short_code: finalTx.short_code,
	                        guest_name: finalTx.customer_name || 'Walk-in',
                        status: finalTx.status,
                        items: finalTx.items?.map((item: any) => ({
                            name: item.product?.name || 'Unknown Item',
                            quantity: item.qty,
                            price: item.unit_price,
                            total: item.line_total
                        }))
                    },
                    financials: {
                        total_amount: finalTx.total_amount,
                        amount_paid: finalTx.status === 'PAID' ? finalTx.total_amount : 0,
                        balance: finalTx.status === 'PAID' ? 0 : finalTx.total_amount,
                        currency: 'KES'
                    },
                    payment_status: finalTx.status.toLowerCase()
                }
            });
            return;
        }

        // Check if it's an outlet POS captain order
        if (searchId.startsWith('POS')) {
            let posOrderQuery = supabase
                .from('pos_shift_orders')
                .select('*')
                .or(`order_number.eq.${searchId},short_code.eq.${searchId}`)
                .not('status', 'eq', 'cancelled')
                .not('payment_status', 'eq', 'voided');

            const effectiveBranchId = parseBranchId(req.query.branch_id) ||
                parseBranchId(req.user?.branch_id ?? req.user?.branchId);
            if (effectiveBranchId) {
                const { data: shifts } = await supabase
                    .from('pos_outlet_shifts')
                    .select('id')
                    .eq('branch_id', effectiveBranchId);
                const shiftIds = (shifts || []).map((shift: any) => shift.id);
                if (!shiftIds.length) {
                    throw new AppError('POS captain order not found', 404);
                }
                posOrderQuery = posOrderQuery.in('shift_id', shiftIds);
            }

            const { data: posOrder, error: posOrderError } = await posOrderQuery.single();

            if (posOrderError || !posOrder) {
                throw new AppError('POS captain order not found', 404);
            }

            const items = Array.isArray(posOrder.items) ? posOrder.items : [];
            const totalAmount = Number(posOrder.total_amount || 0);
            const amountPaid = Number(posOrder.amount_paid || 0);
            const balance = Math.max(0, totalAmount - amountPaid);

            res.json({
                success: true,
                data: {
                    type: 'pos_shift_order',
                    source: 'pos',
                    order: {
                        id: posOrder.id,
                        order_number: posOrder.order_number,
                        short_code: posOrder.short_code,
                        guest_name: posOrder.customer_name || 'Walk-in',
                        waiter_name: posOrder.waiter_name,
                        status: posOrder.payment_status === 'paid' ? 'cleared' : 'unpaid',
                        items: items.map((item: any) => ({
                            name: item.name || item.item_name || 'POS item',
                            quantity: Number(item.quantity || item.qty || 1),
                            price: Number(item.unit_price || item.price || 0),
                            total: Number(item.line_total || 0)
                        }))
                    },
                    financials: {
                        total_amount: totalAmount,
                        amount_paid: amountPaid,
                        balance,
                        currency: 'KES'
                    },
                    payment_status: posOrder.payment_status === 'paid' ? 'cleared' : posOrder.payment_status
                }
            });
            return;
        }

        // Check if it's an unpaid bill from other streams (CON, POL, CWS)
        const otherPrefixes = ['CON', 'POL', 'CWS', 'BILL'];
        const billPrefix = otherPrefixes.find(p => searchId.startsWith(p));

        if (billPrefix) {
            let query = supabase
                .from('unpaid_bills')
                .select('*')
                .eq('bill_number', searchId);

            query = applyBranchFilter(query, req);

            const { data: bill, error: billError } = await query.maybeSingle();

            if (billError) throw new AppError('Bill lookup failed', 500);

            if (bill) {
                res.json({
                    success: true,
                    data: {
                        type: 'unpaid_bill',
                        bill_type: bill.bill_type,
                        revenue_type: bill.revenue_type || bill.bill_type,
                        bill: {
                            id: bill.id,
                            bill_number: bill.bill_number,
                            short_code: bill.short_code,
                            customer_name: bill.customer_name,
                            room_number: bill.room_number,
                            status: bill.status,
                            due_date: bill.due_date,
                            remarks: bill.remarks
                        },
                        financials: {
                            total_amount: bill.total_amount,
                            amount_paid: bill.paid_amount || 0,
                            balance: bill.balance_amount || (bill.total_amount - (bill.paid_amount || 0)),
                            currency: 'KES'
                        }
                    }
                });
                return;
            }

            let restaurantBillQuery = supabase
                .from('restaurant_bills')
                .select('*')
                .eq('bill_number', searchId);

            restaurantBillQuery = applyBranchFilter(restaurantBillQuery, req);
            const { data: restaurantBill, error: restaurantBillError } = await restaurantBillQuery.maybeSingle();

            if (restaurantBillError || !restaurantBill) {
                throw new AppError('Bill not found', 404);
            }

            res.json({
                success: true,
                data: {
                    type: 'restaurant_bill',
                    bill_type: 'restaurant',
                    revenue_type: 'RESTAURANT',
                    bill: {
                        id: restaurantBill.id,
                        bill_number: restaurantBill.bill_number,
                        short_code: restaurantBill.short_code,
                        customer_name: restaurantBill.guest_name || 'Walk-in',
                        room_number: restaurantBill.room_number,
                        status: restaurantBill.status,
                        remarks: restaurantBill.internal_notes
                    },
                    financials: {
                        total_amount: restaurantBill.total_amount,
                        amount_paid: restaurantBill.paid_amount || 0,
                        balance: restaurantBill.balance || 0,
                        currency: 'KES'
                    },
                    payment_status: restaurantBill.status === 'PAID' ? 'paid' : 'unpaid'
                }
            });
            return;
        }

        // Check if it's a hotel booking by confirmation number (starts with HTL)
        if (searchId.startsWith('HTL')) {
            let query = supabase
                .from('reservations')
                .select(`
                    *,
                    room:rooms!room_id(number, branch_id, type:room_types!rooms_room_type_id_fkey(name, price))
                `)
                .eq('confirmation_number', searchId);

            // Branch isolation via room join
            query = applyBranchFilter(query, req, 'room.branch_id');

            const { data: booking, error: bookingError } = await query.single();

            if (!bookingError && booking) {
                await fetchHotelBillResponse(booking, res);
                return;
            }
        }

        // If not a prefix match, try UUID directly or Room Number fallback
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId);

        if (isUUID) {
            // 1. Check if it's a hotel reservation
            let hotelQuery = supabase
                .from('reservations')
                .select(`
                    *,
                    room:rooms!room_id(number, branch_id, type:room_types!rooms_room_type_id_fkey(name, price))
                `)
                .eq('id', bookingId);

            hotelQuery = applyBranchFilter(hotelQuery, req, 'room.branch_id');

            const { data: booking, error: bookingError } = await hotelQuery.maybeSingle(); // Changed to maybeSingle to avoid 404 throw early
            if (!bookingError && booking) {
                await fetchHotelBillResponse(booking, res);
                return;
            }

            // 2. Check shift_transactions (Kyogong)
            let kyogongQuery = supabase
                .from('shift_transactions')
                .select('*, items:shift_transaction_items(*), branch:branches(name)')
                .eq('id', bookingId);

            kyogongQuery = applyBranchFilter(kyogongQuery, req);
            const { data: tx } = await kyogongQuery.maybeSingle();
            if (tx) {
                res.json({
                    success: true,
                    data: {
                        type: 'kyogong',
                        order: {
                            id: tx.id,
                            order_number: tx.transaction_number,
                            guest_name: tx.customer_name || 'Walk-in',
                            status: tx.status,
                            service_category: tx.service_category,
                            items: tx.items?.map((item: any) => ({
                                name: item.item_name,
                                quantity: item.quantity,
                                price: item.unit_price,
                                total: item.total_price
                            }))
                        },
                        financials: {
                            total_amount: tx.total_amount,
                            amount_paid: tx.payment_method === 'BILL' ? 0 : tx.total_amount,
                            balance: tx.payment_method === 'BILL' ? tx.total_amount : 0,
                            currency: 'KES'
                        },
                        payment_status: tx.payment_method === 'BILL' ? 'unpaid' : 'paid'
                    }
                });
                return;
            }

            // 3. Check unpaid_bills (Manual)
            let billQuery = supabase.from('unpaid_bills').select('*').eq('id', bookingId);
            if (req.user?.branch_id) billQuery = billQuery.eq('branch_id', req.user.branch_id);
            const { data: bill } = await billQuery.maybeSingle();
            if (bill) {
                res.json({
                    success: true,
                    data: {
                        type: 'unpaid_bill',
                        bill_type: bill.bill_type,
                        revenue_type: bill.revenue_type || bill.bill_type,
                        bill: {
                            id: bill.id,
                            bill_number: bill.bill_number,
                            customer_name: bill.customer_name,
                            room_number: bill.room_number,
                            status: bill.status,
                            due_date: bill.due_date,
                            remarks: bill.remarks
                        },
                        financials: {
                            total_amount: bill.total_amount,
                            amount_paid: bill.paid_amount || 0,
                            balance: bill.balance_amount || (bill.total_amount - (bill.paid_amount || 0)),
                            currency: 'KES'
                        }
                    }
                });
                return;
            }

            // 4. Check accounting_ar_invoices
            const { data: arInvoice, error: arInvoiceError } = await supabase.from('accounting_ar_invoices')
                .select('*, customer:accounting_customers(id, customer_name, email, phone)')
                .eq('id', bookingId).maybeSingle();
            
            if (arInvoiceError) {
              console.error('Database error:', arInvoiceError);
              throw arInvoiceError;
            }
            if (arInvoice) {
                res.json({
                    success: true,
                    data: {
                        type: 'invoice',
                        source: 'accounting',
                        invoice: {
                            id: arInvoice.id,
                            invoice_number: arInvoice.invoice_number,
                            customer_name: arInvoice.customer?.customer_name || 'Walk-in',
                            status: arInvoice.status,
                            items: (arInvoice.items || []).map((item: any) => ({
                                name: item.description || item.item_name || 'Item',
                                quantity: item.quantity || item.qty || 1,
                                price: item.unit_price || item.unitPrice || 0,
                                total: item.total_amount || item.totalAmount || 0
                            }))
                        },
                        financials: {
                            total_amount: arInvoice.total_amount,
                            amount_paid: Number(arInvoice.total_amount) - Number(arInvoice.balance),
                            balance: arInvoice.balance,
                            currency: 'KES'
                        },
                        payment_status: arInvoice.status === 'paid' ? 'paid' : (arInvoice.balance < arInvoice.total_amount ? 'partial' : 'unpaid')
                    }
                });
                return;
            }

            // 5. Check finance_invoices
            const { data: finInvoice, error: finInvoiceError } = await supabase.from('finance_invoices').select('*').eq('id', bookingId).maybeSingle();
            if (finInvoiceError) {
              console.error('Database error:', finInvoiceError);
              throw finInvoiceError;
            }
            if (finInvoice) {
                res.json({
                    success: true,
                    data: {
                        type: 'invoice',
                        source: 'finance',
                        invoice: {
                            id: finInvoice.id,
                            invoice_number: finInvoice.invoice_number,
                            customer_name: finInvoice.customer_name || 'Walk-in',
                            status: finInvoice.status,
                            items: []
                        },
                        financials: {
                            total_amount: finInvoice.total_amount,
                            amount_paid: finInvoice.paid_amount || 0,
                            balance: Number(finInvoice.total_amount) - Number(finInvoice.paid_amount || 0),
                            currency: 'KES'
                        },
                        payment_status: finInvoice.status === 'paid' ? 'paid' : (finInvoice.paid_amount > 0 ? 'partial' : 'unpaid')
                    }
                });
                return;
            }
        }

        // Fallback: For numeric IDs (like 924094), check multiple tables in parallel
        if (/^\d+$/.test(searchId)) {
            const numericFallbacks = await Promise.allSettled([
                // Check unpaid_bills by bill_number
                supabase
                    .from('unpaid_bills')
                    .select('*')
                    .eq('bill_number', searchId)
                    .maybeSingle()
                    .then(({ data }) => ({ type: 'unpaid_bill', data })),
                
                // Check restaurant_bills by bill_number
                supabase
                    .from('restaurant_bills')
                    .select('*')
                    .eq('bill_number', searchId)
                    .maybeSingle()
                    .then(({ data }) => ({ type: 'restaurant_bill', data })),
                
                // Check room number for active bookings
                supabase
                    .from('reservations')
                    .select(`
                        *,
                        room:rooms!room_id!inner(number, branch_id, type:room_types!rooms_room_type_id_fkey(name, price))
                    `)
                    .eq('room.number', searchId)
                    .eq('status', 'checked_in')
                    .maybeSingle()
                    .then(({ data }) => ({ type: 'room_booking', data }))
            ]);

            for (const result of numericFallbacks) {
                if (result.status === 'fulfilled' && result.value.data) {
                    const { type, data } = result.value;
                    
                    if (type === 'unpaid_bill') {
                        const bill = data;
                        const responseData = {
                            success: true,
                            data: {
                                type: 'unpaid_bill',
                                bill_type: bill.bill_type,
                                revenue_type: bill.revenue_type || bill.bill_type,
                                bill: {
                                    id: bill.id,
                                    bill_number: bill.bill_number,
                                    short_code: bill.short_code,
                                    customer_name: bill.customer_name,
                                    room_number: bill.room_number,
                                    status: bill.status,
                                    due_date: bill.due_date,
                                    remarks: bill.remarks
                                },
                                financials: {
                                    total_amount: bill.total_amount,
                                    amount_paid: bill.paid_amount || 0,
                                    balance: bill.balance_amount || (bill.total_amount - (bill.paid_amount || 0)),
                                    currency: 'KES'
                                }
                            }
                        };
                        billCache.set(cacheKey, responseData);
                        timer.end(true);
                        res.json(responseData);
                        return;
                    }
                    
                    if (type === 'restaurant_bill') {
                        const bill = data;
                        const responseData = {
                            success: true,
                            data: {
                                type: 'restaurant_bill',
                                bill_type: 'restaurant',
                                revenue_type: 'RESTAURANT',
                                bill: {
                                    id: bill.id,
                                    bill_number: bill.bill_number,
                                    short_code: bill.short_code,
                                    customer_name: bill.guest_name || 'Walk-in',
                                    room_number: bill.room_number,
                                    status: bill.status,
                                    remarks: bill.internal_notes
                                },
                                financials: {
                                    total_amount: bill.total_amount,
                                    amount_paid: bill.paid_amount || 0,
                                    balance: bill.balance || 0,
                                    currency: 'KES'
                                },
                                payment_status: bill.status === 'PAID' ? 'paid' : 'unpaid'
                            }
                        };
                        billCache.set(cacheKey, responseData);
                        timer.end(true);
                        res.json(responseData);
                        return;
                    }
                    
                    if (type === 'room_booking') {
                        await fetchHotelBillResponse(data, res);
                        timer.end(true);
                        return;
                    }
                }
            }
        }

        // Fallback: Check if it's a Room Number for an active (checked-in) booking (non-numeric)
        if (!/^\d+$/.test(searchId)) {
            let roomQuery = supabase
                .from('reservations')
                .select(`
                    *,
                    room:rooms!room_id!inner(number, branch_id, type:room_types!rooms_room_type_id_fkey(name, price))
                `)
                .eq('room.number', searchId)
                .eq('status', 'checked_in');

            if (req.user?.branch_id) {
                roomQuery = roomQuery.eq('room.branch_id', req.user.branch_id);
            }

            const { data: roomBooking, error: roomError } = await roomQuery.maybeSingle();

            if (roomBooking) {
                await fetchHotelBillResponse(roomBooking, res);
                timer.end(true);
                return;
            }
        }

        timer.end(false, 'Bill or Booking not found');
        throw new AppError('Bill or Booking not found', 404);

    } catch (error: any) {
        // Enhanced error logging for debugging performance issues
        timer.end(false, error.message);
        logger.error('Error in getBillDetails:', {
            bookingId: req.params.bookingId,
            searchId: req.params.bookingId?.toUpperCase(),
            userBranch: req.user?.branch_id,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
        next(error);
    }
};

/**
 * Helper to fetch payments and return hotel bill response
 */
async function fetchHotelBillResponse(booking: any, res: Response): Promise<void> {
    // Fetch payments
    const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('booking_id', booking.id);

    if (paymentsError) {
        throw new AppError('Error fetching payments', 500);
    }

    // Calculate financials
    const totalAmount = booking.total_amount;
    const amountPaid = payments?.reduce((sum, p) => sum + (p.status === 'completed' ? Number(p.amount) : 0), 0) || 0;
    const balance = totalAmount - amountPaid;

    // Perform strict verification on all completed payments
    const verifications = [];
    if (payments) {
        for (const payment of payments) {
            if (payment.status === 'completed') {
                const result = await paymentVerificationService.verifyTransaction(payment.reference, Number(payment.amount));
                verifications.push({
                    reference: payment.reference,
                    amount: payment.amount,
                    verified: result.isValid,
                    message: result.message
                });
            }
        }
    }

    res.json({
        success: true,
        data: {
            type: 'hotel',
            booking: {
                id: booking.id,
                confirmation_number: booking.confirmation_number,
                guest_name: booking.guest_name,
                guest_phone: booking.guest_phone,
                room_number: booking.room?.number,
                room_type: booking.room?.type?.name,
                check_in: booking.check_in_date,
                check_out: booking.check_out_date,
                status: booking.status
            },
            financials: {
                total_amount: totalAmount,
                amount_paid: amountPaid,
                balance: balance,
                currency: 'KES'
            },
            payments: payments,
            verifications: verifications
        }
    });
}

// cashier_shift_transactions has a CHECK constraint
// (cashier_shift_transactions_payment_method_check, added in
// migrations/20260622_famousgate_major_redesign.sql) restricting
// payment_method to exactly {'mpesa','cash','card','credit'} lowercase.
// Inserting anything else (e.g. the .toUpperCase()'d values this file used
// to send, or the literal 'credit_bill' used elsewhere in this controller)
// violates the constraint and fails — silently, since both insert sites
// below are fire-and-forget. That silent failure is why real POS sales
// never made it into the shift's recorded cash/mpesa/card totals.
function toShiftTransactionPaymentMethod(raw: unknown): string {
    const m = String(raw || 'cash').toLowerCase();
    if (m.includes('mpesa') || m.includes('m-pesa')) return 'mpesa';
    if (m.includes('card') || m.includes('visa') || m.includes('swipe')) return 'card';
    if (m.includes('credit')) return 'credit';
    return 'cash';
}

/**
 * Links a completed payment to the cashier's active shift log (fire-and-forget)
 */
async function linkPaymentToActiveShift(
    cashierId: string,
    paymentId: string,
    paymentRef: string,
    paymentMethod: string,
    amount: number
): Promise<void> {
    try {
        // .single() throws if the cashier has 0 or 2+ rows with status='open'
        // (e.g. a prior shift left open while a new one is pending approval),
        // which silently dropped this shift's cashier_shift_transactions row
        // and undercounted Shift Collections even though the payment itself
        // succeeded. order+limit+maybeSingle tolerates duplicates and picks
        // the most recent, matching activeCashierShiftLogId below.
        const { data: shift, error: shiftLookupError } = await supabase
            .from('cashier_shift_logs')
            .select('id')
            .eq('cashier_id', cashierId)
            .eq('status', 'open')
            .order('shift_start', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (shiftLookupError || !shift) {
            logger.warn('linkPaymentToActiveShift: no active shift resolved', {
                cashierId,
                paymentId,
                error: shiftLookupError?.message
            });
            return;
        }

        const { error } = await supabase.from('cashier_shift_transactions').insert({
            shift_id: shift.id,
            transaction_id: paymentId,
            transaction_ref: paymentRef,
            payment_method: toShiftTransactionPaymentMethod(paymentMethod),
            amount,
            transaction_time: new Date().toISOString(),
            // Dedup (migration 20260622_famousgate_major_redesign.sql, section 7)
            // ranks 'cashier' rows above 'pos' rows when the same payment lands
            // in both flows.
            source: 'cashier'
        });

        if (error) {
            logger.warn('linkPaymentToActiveShift: failed to insert cashier_shift_transactions', {
                cashierId,
                paymentId,
                error: error.message
            });
            return; // don't increment totals if the transaction row didn't land
        }

        // Atomically increment the shift's running totals. A single UPDATE
        // inside a PL/pgSQL function is the only way to do this without a
        // read-then-write race: two payments arriving at the same millisecond
        // would both read the same stale total and overwrite each other.
        const { error: incrError } = await supabase.rpc('increment_cashier_shift_totals', {
            p_shift_id: shift.id,
            p_amount: amount,
            p_method: (paymentMethod || '').toUpperCase()
        });
        if (incrError) {
            logger.warn('linkPaymentToActiveShift: failed to increment cashier_shift_logs totals', {
                cashierId,
                shiftId: shift.id,
                error: incrError.message
            });
        }
    } catch (err) {
        logger.warn('linkPaymentToActiveShift threw', { cashierId, paymentId, error: (err as Error)?.message });
    }
}

async function activeCashierShiftLogId(
    cashierId?: string | null,
    branchId?: unknown
): Promise<string | null> {
    if (!cashierId) return null;
    try {
        let query = supabase
            .from('cashier_shift_logs')
            .select('id')
            .eq('cashier_id', cashierId)
            .eq('status', 'open')
            .order('shift_start', { ascending: false })
            .limit(1);

        const parsedBranchId = parseBranchId(branchId);
        if (parsedBranchId) {
            query = query.eq('branch_id', parsedBranchId);
        }

        const { data, error } = await query.maybeSingle();
        if (error) {
            logger.warn('Unable to resolve active cashier shift log', { error: error.message, cashierId, branchId });
            return null;
        }
        return data?.id || null;
    } catch (error) {
        logger.warn('Unable to resolve active cashier shift log', error);
        return null;
    }
}

async function recordActiveShiftSale(params: {
    cashierId?: string | null;
    branchId?: unknown;
    transactionId: string;
    transactionRef: string;
    paymentMethod: string;
    amount: number;
}): Promise<void> {
    const shiftId = await activeCashierShiftLogId(params.cashierId, params.branchId);
    if (!shiftId) return;
    const method = toShiftTransactionPaymentMethod(params.paymentMethod);
    const { error } = await supabase.from('cashier_shift_transactions').insert({
        shift_id: shiftId,
        transaction_id: params.transactionId,
        transaction_ref: params.transactionRef,
        payment_method: method,
        amount: params.amount,
        transaction_time: new Date().toISOString(),
        // Dedup (migration 20260622_famousgate_major_redesign.sql, section 7)
        // ranks 'cashier' rows above 'pos' rows for the same shift/ref/amount.
        source: 'pos'
    });
    if (error) {
        logger.warn('Unable to add payment to active cashier shift sales', { error: error.message, shiftId });
        return;
    }
    // Atomically increment the shift's running totals. Same reasoning as in
    // linkPaymentToActiveShift — a single PL/pgSQL UPDATE avoids the
    // read-modify-write race that supabase-js's plain .update() would create.
    const { error: incrError } = await supabase.rpc('increment_cashier_shift_totals', {
        p_shift_id: shiftId,
        p_amount: params.amount,
        p_method: method
    });
    if (incrError) {
        logger.warn('recordActiveShiftSale: failed to increment cashier_shift_logs totals', {
            shiftId,
            error: incrError.message
        });
    }
}

async function loadCashierTransactionsForShift(shift: any): Promise<any[]> {
    if (!shift?.id) return [];
    const byId = await safeLogbookQuery(
        'cashier_shift_transactions_by_shift_id',
        supabase
            .from('cashier_transactions')
            .select('*')
            .eq('shift_id', shift.id)
            .order('created_at', { ascending: true })
    );

    let byWindow: any[] = [];
    if (shift.cashier_id && shift.branch_id && (shift.start_time || shift.shift_start)) {
        let query = supabase
            .from('cashier_transactions')
            .select('*')
            .eq('branch_id', shift.branch_id)
            .eq('cashier_id', shift.cashier_id)
            .gte('created_at', shift.start_time || shift.shift_start)
            .order('created_at', { ascending: true });
        if (shift.end_time || shift.closed_at || shift.shift_end) {
            query = query.lte('created_at', shift.end_time || shift.closed_at || shift.shift_end);
        }
        byWindow = await safeLogbookQuery('cashier_shift_transactions_by_window', query);
    }

    return dedupeLogbookLines(
        [...byId, ...byWindow].map((line) => normalizeLogbookLine(line, 'cashier_transaction'))
    );
}

function cashierShiftTotals(shift: any, transactions: any[]): Record<string, number> {
    const totalFor = (method: string) => transactions
        .filter((transaction) => normalizeLogbookPaymentMethod(transaction.payment_method) === method)
        .reduce((sum, transaction) => sum + logbookNumber(transaction.amount), 0);
    const cash = totalFor('cash');
    const mpesa = totalFor('mpesa');
    const card = totalFor('card');
    const creditBill = totalFor('credit_bill');
    const cashTendered = transactions
        .filter((transaction) => normalizeLogbookPaymentMethod(transaction.payment_method) === 'cash')
        .reduce((sum, transaction) => sum + logbookNumber(transaction.amount_tendered), 0);
    const changeGiven = transactions
        .filter((transaction) => normalizeLogbookPaymentMethod(transaction.payment_method) === 'cash')
        .reduce((sum, transaction) => sum + logbookNumber(transaction.change_given), 0);
    const totalRevenue = transactions.reduce((sum, transaction) => sum + logbookNumber(transaction.amount), 0);
    const openingFloat = logbookNumber(shift?.opening_float);
    return {
        total_cash_sales: cash,
        total_cash_in: cash,
        total_mpesa_sales: mpesa,
        total_mpesa_in: mpesa,
        total_card_sales: card,
        total_card_in: card,
        total_credit_bill: creditBill,
        total_cash_tendered: cashTendered,
        total_change_given: changeGiven,
        drawer_cash_in: cash,
        expected_cash: openingFloat + cash,
        current_float: openingFloat + cash,
        total_sales: totalRevenue,
        total_revenue: totalRevenue,
        transaction_count: transactions.length
    };
}

/**
 * Process Manual/Cash Payment
 */
export const processCashierPayment = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        let { bookingId } = req.body;
        const { amount, method, reference } = req.body;
        // Cash change handed back + cash tendered (recorded on the cleared
        // payment row so reconciliation/audit can see it).
        const changeGiven = Number(req.body.change_given) || 0;
        const amountTendered = Number(req.body.amount_tendered) || 0;

        if (!bookingId || !amount || !method) {
            throw new AppError('ID, amount, and method are required', 400);
        }

        bookingId = String(bookingId).toUpperCase();
        let resolvedSource: string | null = null;
        const scannedCodeResolution = await resolveCashierScannedCode(bookingId, req);
        if (scannedCodeResolution) {
            bookingId = scannedCodeResolution.lookupId;
            resolvedSource = scannedCodeResolution.source;
        }

        const shortCodeResolution = await resolveCashierShortCode(bookingId, req);
        if (shortCodeResolution) {
            bookingId = shortCodeResolution.lookupId;
            resolvedSource = shortCodeResolution.source;
        }

        const paymentRef = reference || `CASH-${Date.now()}`;

        // Check if it's an invoice (starts with INV)
        if (bookingId.startsWith('INV')) {
            // 1. Try fetching from accounting_ar_invoices first
            const { data: arInvoice, error: arError } = await supabase
                .from('accounting_ar_invoices')
                .select('id, total_amount, balance')
                .eq('invoice_number', bookingId)
                .single();

            let targetInvoice = null;
            let invoiceSource = '';

            if (!arError && arInvoice) {
                targetInvoice = arInvoice;
                invoiceSource = 'accounting';
            } else {
                // 2. Try fetching from finance_invoices
                const { data: finInvoice, error: finError } = await supabase
                    .from('finance_invoices')
                    .select('id, total_amount, paid_amount')
                    .eq('invoice_number', bookingId)
                    .single();

                if (finInvoice) {
                    // Normalize to common format for payment recording
                    targetInvoice = {
                        id: finInvoice.id,
                        total_amount: finInvoice.total_amount,
                        balance: Number(finInvoice.total_amount) - Number(finInvoice.paid_amount || 0)
                    };
                    invoiceSource = 'finance';
                }
            }

            if (!targetInvoice) {
                throw new AppError('Invoice not found in any ledger', 404);
            }

            // 3. Record Payment in Database
            const isVerifiedMethod = isImmediateCashierPaymentMethod(method);
            const initialStatus = isVerifiedMethod ? 'completed' : 'pending';

            const paymentPayload: any = {
                amount: amount,
                currency: 'KES',
                payment_method: method,
                status: initialStatus,
                reference: paymentRef,
                metadata: {
                    processed_by: 'cashier',
                    cashier_id: req.user?.id,
                    processed_at: new Date().toISOString(),
                    invoice_number: bookingId,
                    invoice_source: invoiceSource,
                    verification_required: !isVerifiedMethod
                }
            };

            // Link to the correct ID column based on source
            if (invoiceSource === 'accounting') {
                paymentPayload.invoice_id = targetInvoice.id;
            } else {
                paymentPayload.bill_id = targetInvoice.id;
            }

            const { data: payment, error: paymentError } = await supabase
                .from('payments')
                .insert(paymentPayload)
                .select()
                .single();

            if (paymentError) {
                throw new AppError(`Payment recording failed: ${paymentError.message}`, 500);
            }

            // 4. Update Invoice Balance (Only if payment is completed)
            if (initialStatus === 'completed') {
                const currentBalance = Number(targetInvoice.balance);
                const paymentAmount = Number(amount);
                const newBalance = Math.max(0, currentBalance - paymentAmount);
                const isPaid = newBalance <= 0;
                const newStatus = isPaid ? 'paid' : 'partial';

                if (invoiceSource === 'accounting') {
                    const { error: invError } = await supabase
                        .from('accounting_ar_invoices')
                        .update({
                            balance: newBalance,
                            status: newStatus,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', targetInvoice.id);
                    if (invError) throw new AppError(`Failed to update AR invoice balance: ${invError.message}`, 500);
                } else {
                    const currentPaid = Number(targetInvoice.total_amount) - currentBalance;
                    const newPaidAmount = currentPaid + paymentAmount;
                    const { error: finError } = await supabase
                        .from('finance_invoices')
                        .update({
                            paid_amount: newPaidAmount,
                            status: newStatus,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', targetInvoice.id);
                    if (finError) throw new AppError(`Failed to update finance invoice status: ${finError.message}`, 500);
                }

                // Record cashier transaction
                const { error } = await supabase.from('cashier_transactions').insert({ change_given: changeGiven, amount_tendered: amountTendered,
                    transaction_number: `PAY-${Date.now()}`,
                    branch_id: req.user?.branch_id,
                    cashier_id: req.user?.id,
                    transaction_type: 'payment',
                    revenue_type: 'INVOICE_SETTLEMENT',
                    reference_type: invoiceSource === 'accounting' ? 'invoice' : 'finance_invoice',
                    reference_id: targetInvoice.id,
                    payment_method: method,
                    amount: amount,
                    customer_name: 'Invoice Customer'
                });

                if (error) {

                  console.error('Database error:', error);

                  throw error;

                }
            }

            await linkPaymentToActiveShift(req.user?.id!, payment.id, paymentRef, method, Number(amount));
            res.json({
                success: true,
                message: 'Invoice payment processed successfully',
                data: payment
            });
            return;
        }

        // Check if it's a conference booking (starts with CNF)
        if (bookingId.startsWith('CNF')) {
            // 1. Fetch the conference booking by invoice_number
            const { data: booking, error: bookingError } = await supabase
                .from('conference_hall_bookings')
                .select('id, total_amount, amount_paid, branch_id, customer_name')
                .eq('invoice_number', bookingId)
                .single();

            if (bookingError || !booking) {
                throw new AppError('Conference booking not found', 404);
            }

            // 2. Record Payment in Database
            const isVerifiedMethod = isImmediateCashierPaymentMethod(method);
            const initialStatus = isVerifiedMethod ? 'completed' : 'pending';

            const { data: payment, error: paymentError } = await supabase
                .from('payments')
                .insert({
                    conference_booking_id: booking.id,
                    amount: amount,
                    currency: 'KES',
                    payment_method: method,
                    status: initialStatus,
                    reference: paymentRef,
                    metadata: {
                        processed_by: 'cashier',
                        cashier_id: req.user?.id,
                        processed_at: new Date().toISOString(),
                        invoice_number: bookingId,
                        verification_required: !isVerifiedMethod
                    }
                })
                .select()
                .single();

            if (paymentError) {
                throw new AppError(`Payment recording failed: ${paymentError.message}`, 500);
            }

            // 3. Update Conference Booking Status (Only if payment is completed)
            if (initialStatus === 'completed') {
                const currentPaid = Number(booking.amount_paid || 0);
                const paymentAmount = Number(amount);
                const totalAmount = Number(booking.total_amount);

                const newPaidAmount = currentPaid + paymentAmount;
                const newBalance = Math.max(0, totalAmount - newPaidAmount);
                const isPaid = newBalance <= 0;
                const newStatus = isPaid ? 'paid' : (newPaidAmount > 0 ? 'partial' : 'pending');

                const { error: updateError } = await supabase
                    .from('conference_hall_bookings')
                    .update({
                        amount_paid: newPaidAmount,
                        payment_status: newStatus,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', booking.id);

                if (updateError) throw new AppError(`Failed to update conference booking status: ${updateError.message}`, 500);

                // Record cashier transaction
                const { error } = await supabase.from('cashier_transactions').insert({ change_given: changeGiven, amount_tendered: amountTendered,
                    transaction_number: `CNF-${bookingId}`,
                    branch_id: booking.branch_id || req.user?.branch_id,
                    cashier_id: req.user?.id,
                    transaction_type: 'payment',
                    revenue_type: 'CONFERENCE',
                    reference_type: 'conference_booking',
                    reference_id: booking.id,
                    payment_method: method,
                    amount: amount,
                    customer_name: booking.customer_name || 'Conference Client'
                });

                if (error) {

                  console.error('Database error:', error);

                  throw error;

                }
            }

            await linkPaymentToActiveShift(req.user?.id!, payment.id, paymentRef, method, Number(amount));
            res.json({
                success: true,
                message: 'Conference payment processed successfully',
                data: payment
            });
            return;
        }

        // Check if it's a restaurant order
        if (bookingId.startsWith('ORD')) {
            // 1. Fetch the order ID (UUID) from order number
            let orderQuery = supabase
                .from('restaurant_orders')
                .select('id, total_amount, outlet_id')
                .eq('order_number', bookingId);
            orderQuery = applyBranchFilter(orderQuery, req);
            const { data: order, error: orderError } = await orderQuery.single();

            if (orderError || !order) {
                throw new AppError('Restaurant order not found', 404);
            }

            const userRole = (req.user as any)?.role?.toLowerCase() || '';
            if (!isGlobalRole(userRole)) {
                const assignedOutlets = await loadAssignedPosOutlets(supabase, (req.user as any)?.id);
                const assignedIds = assignedOutletIds(assignedOutlets);

                let outlet: any = null;
                if (order.outlet_id) {
                    const { data: outletData } = await supabase
                        .from('pos_outlets')
                        .select('id, name, outlet_type, branch_id')
                        .eq('id', order.outlet_id)
                        .maybeSingle();
                    outlet = outletData;
                }

                if (outlet) {
                    if (Number(outlet.branch_id) !== Number((req.user as any)?.branch_id)) {
                        throw new AppError('Forbidden: order belongs to another branch', 403);
                    }
                    if (!canAccessPosOutlet(userRole, outlet, assignedOutlets, (req.user as any)?.branch_id ?? (req.user as any)?.branchId)) {
                        throw new AppError('Forbidden: this cashier cannot clear orders for this restaurant POS station', 403);
                    }
                } else {
                    const stationRestricted = shouldRestrictCashierStationAccess(userRole, assignedIds, (req.user as any)?.branch_id ?? (req.user as any)?.branchId);
                    if (stationRestricted) {
                        const roleOutletTypes = stationTypesForCashierRole(userRole, (req.user as any)?.branch_id ?? (req.user as any)?.branchId);
                        const allowedTypes = new Set([
                            ...roleOutletTypes,
                            ...assignedOutlets.map(o => String(o.outlet_type || '').toLowerCase()).filter(Boolean)
                        ]);
                        if (!allowedTypes.has('restaurant')) {
                            throw new AppError('Forbidden: this cashier is not authorized to clear restaurant bills', 403);
                        }
                    }
                }
            }

            // 2. Record Payment in Database
            const isVerifiedMethod = isImmediateCashierPaymentMethod(method);
            const initialStatus = isVerifiedMethod ? 'completed' : 'pending';

            const { data: payment, error: paymentError } = await supabase
                .from('payments')
                .insert({
                    restaurant_order_id: order.id,
                    amount: amount,
                    currency: 'KES',
                    payment_method: method,
                    status: initialStatus,
                    reference: paymentRef,
                    metadata: {
                        processed_by: 'cashier',
                        cashier_id: req.user?.id,
                        processed_at: new Date().toISOString(),
                        order_number: bookingId,
                        verification_required: !isVerifiedMethod
                    }
                })
                .select()
                .single();

            if (paymentError) {
                throw new AppError(`Payment recording failed: ${paymentError.message}`, 500);
            }

            // 3. Update Restaurant Order Status (Only if payment is completed)
            if (initialStatus === 'completed') {
                // Re-fetch all COMPLETED payments for this order to check balance
                const { data: allPayments } = await supabase
                    .from('payments')
                    .select('amount')
                    .eq('restaurant_order_id', order.id)
                    .eq('status', 'completed');

                const totalPaid = allPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

                if (totalPaid >= order.total_amount) {
                    await supabase
                        .from('restaurant_orders')
                        .update({
                            payment_status: 'paid',
                            status: 'delivered'
                        })
                        .eq('id', order.id);

                    // Auto-deduct ingredients
                    try {
                        const { data: orderWithItems } = await supabase
                            .from('restaurant_orders')
                            .select('*, items:restaurant_order_items(*)')
                            .eq('id', order.id)
                            .single();

                        if (orderWithItems && orderWithItems.items) {
                            for (const item of orderWithItems.items) {
                                await deductIngredientsForItem({
                                    order_id: orderWithItems.id,
                                    menu_item_id: item.menu_item_id,
                                    quantity: item.quantity,
                                    branch_id: orderWithItems.branch_id,
                                    user_id: req.user?.id
                                });
                            }
                            logger.info(`Ingredients auto-deducted for restaurant order ${orderWithItems.order_number}`);
                        }
                    } catch (deductError) {
                        logger.error(`Error in auto-deduction for restaurant order ${order.id}:`, deductError);
                    }
                } else if (totalPaid > 0) {
                    await supabase
                        .from('restaurant_orders')
                        .update({
                            payment_status: 'partial'
                        })
                        .eq('id', order.id);
                }
            }

            await linkPaymentToActiveShift(req.user?.id!, payment.id, paymentRef, method, Number(amount));
            res.json({
                success: true,
                message: 'Restaurant payment processed successfully',
                data: payment
            });
            return;
        }

        // Check if it's a bar order
        if (bookingId.startsWith('BAR')) {
            // 1. Fetch the order ID (UUID) from order number
            let orderQuery = supabase
                .from('bar_orders')
                .select('id, total, outlet_id')
                .eq('order_number', bookingId);
            orderQuery = applyBranchFilter(orderQuery, req);
            const { data: order, error: orderError } = await orderQuery.single();

            if (orderError || !order) {
                throw new AppError('Bar order not found', 404);
            }

            const userRole = (req.user as any)?.role?.toLowerCase() || '';
            if (!isGlobalRole(userRole)) {
                const assignedOutlets = await loadAssignedPosOutlets(supabase, (req.user as any)?.id);
                const assignedIds = assignedOutletIds(assignedOutlets);

                let outlet: any = null;
                if (order.outlet_id) {
                    const { data: outletData } = await supabase
                        .from('pos_outlets')
                        .select('id, name, outlet_type, branch_id')
                        .eq('id', order.outlet_id)
                        .maybeSingle();
                    outlet = outletData;
                }

                if (outlet) {
                    if (Number(outlet.branch_id) !== Number((req.user as any)?.branch_id)) {
                        throw new AppError('Forbidden: order belongs to another branch', 403);
                    }
                    if (!canAccessPosOutlet(userRole, outlet, assignedOutlets, (req.user as any)?.branch_id ?? (req.user as any)?.branchId)) {
                        throw new AppError('Forbidden: this cashier cannot clear orders for this bar POS station', 403);
                    }
                } else {
                    const stationRestricted = shouldRestrictCashierStationAccess(userRole, assignedIds, (req.user as any)?.branch_id ?? (req.user as any)?.branchId);
                    if (stationRestricted) {
                        const roleOutletTypes = stationTypesForCashierRole(userRole, (req.user as any)?.branch_id ?? (req.user as any)?.branchId);
                        const allowedTypes = new Set([
                            ...roleOutletTypes,
                            ...assignedOutlets.map(o => String(o.outlet_type || '').toLowerCase()).filter(Boolean)
                        ]);
                        const hasBarAccess = Array.from(allowedTypes).some(isBarStationType);
                        if (!hasBarAccess) {
                            throw new AppError('Forbidden: this cashier is not authorized to clear bar bills', 403);
                        }
                    }
                }
            }

            // 2. Record Payment in Database
            const isVerifiedMethod = isImmediateCashierPaymentMethod(method);
            const initialStatus = isVerifiedMethod ? 'completed' : 'pending';

            const { data: payment, error: paymentError } = await supabase
                .from('payments')
                .insert({
                    bar_order_id: order.id,
                    amount: amount,
                    currency: 'KES',
                    payment_method: method,
                    status: initialStatus,
                    reference: paymentRef,
                    metadata: {
                        processed_by: 'cashier',
                        cashier_id: req.user?.id,
                        processed_at: new Date().toISOString(),
                        order_number: bookingId,
                        verification_required: !isVerifiedMethod
                    }
                })
                .select()
                .single();

            if (paymentError) {
                throw new AppError(`Payment recording failed: ${paymentError.message}`, 500);
            }

            // 3. Update Bar Order Status (Only if payment is completed)
            if (initialStatus === 'completed') {
                // Re-fetch all COMPLETED payments for this order to check balance
                const { data: allPayments } = await supabase
                    .from('payments')
                    .select('amount')
                    .eq('bar_order_id', order.id)
                    .eq('status', 'completed');

                const totalPaid = allPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

                if (totalPaid >= order.total) {
                    await supabase
                        .from('bar_orders')
                        .update({
                            payment_status: 'paid',
                            status: 'completed'
                        })
                        .eq('id', order.id);
                } else if (totalPaid > 0) {
                    await supabase
                        .from('bar_orders')
                        .update({
                            payment_status: 'partial'
                        })
                        .eq('id', order.id);
                }
            }

            await linkPaymentToActiveShift(req.user?.id!, payment.id, paymentRef, method, Number(amount));
            res.json({
                success: true,
                message: 'Bar payment processed successfully',
                data: payment
            });
            return;
        }

        // Check if it's a POS transaction
        if (bookingId.startsWith('CS-')) {
            // 1. Fetch the transaction from ref
            let txQuery = supabase
                .from('pos_transactions')
                .select('*')
                .eq('transaction_ref', bookingId);
            txQuery = applyBranchFilter(txQuery, req);
            const { data: transaction, error: txError } = await txQuery.single();

            if (txError || !transaction) {
                throw new AppError('POS transaction not found', 404);
            }

            const isVerifiedMethod = isImmediateCashierPaymentMethod(method);
            const initialStatus = isVerifiedMethod ? 'completed' : 'pending';

            // 2. Record Payment in Database
            const { data: payment, error: paymentError } = await supabase
                .from('payments')
                .insert({
                    pos_transaction_id: transaction.id,
                    amount: amount,
                    currency: 'KES',
                    payment_method: method,
                    status: initialStatus,
                    reference: paymentRef,
                    metadata: {
                        processed_by: 'cashier',
                        cashier_id: req.user?.id,
                        processed_at: new Date().toISOString(),
                        transaction_ref: bookingId
                    }
                })
                .select()
                .single();

            if (paymentError) {
                throw new AppError(`Payment recording failed: ${paymentError.message}`, 500);
            }

            // 3. Update Transaction Status if completed
            if (initialStatus === 'completed') {
                await supabase
                    .from('pos_transactions')
                    .update({
                        status: 'PAID',
                        payment_method: method.toUpperCase(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', transaction.id);

                // Record legacy transaction for logbook
                const { error } = await supabase.from('cashier_transactions').insert({ change_given: changeGiven, amount_tendered: amountTendered,
                    transaction_number: `POS-${transaction.transaction_ref}`,
                    branch_id: transaction.branch_id,
                    cashier_id: req.user?.id,
                    transaction_type: 'payment',
                    revenue_type: 'POS_SALE',
                    reference_type: 'pos_transaction',
                    reference_id: transaction.id,
                    payment_method: method,
                    amount: amount,
                    customer_name: transaction.customer_name
                });

                if (error) {

                  console.error('Database error:', error);

                  throw error;

                }
            }

            await linkPaymentToActiveShift(req.user?.id!, payment.id, paymentRef, method, Number(amount));
            res.json({
                success: true,
                message: 'POS payment processed successfully',
                data: payment
            });
            return;
        }

        // Check if it's a POS outlet captain order (generated by restaurant/bar/non-consumable POS)
        const posPaymentLookupReference = shortCodeResolution?.source === 'pos_shift_order' && shortCodeResolution.row?.id
            ? shortCodeResolution.row.id
            : bookingId;
        const shouldTryPosPaymentLookup = resolvedSource === 'pos_shift_order'
            || bookingId.startsWith('POS')
            || bookingId.startsWith('MERGE-')
            || bookingId.startsWith('SPLIT-')
            || isPublicShortCode(bookingId)
            || Boolean(normalizeUuidOrNull(bookingId));
        const outletPosPaymentOrder = shouldTryPosPaymentLookup
            ? await findOutletPosOrderByReference(posPaymentLookupReference, req)
            : null;

        if (outletPosPaymentOrder || resolvedSource === 'pos_shift_order' || bookingId.startsWith('POS') || bookingId.startsWith('MERGE-') || bookingId.startsWith('SPLIT-')) {
            if (!outletPosPaymentOrder) throw new AppError('POS order not found', 404);

            const { shift } = outletPosPaymentOrder;
            const userRole = (req.user as any)?.role?.toLowerCase() || '';
            if (!isGlobalRole(userRole)) {
                const outletRaw = Array.isArray(shift.outlet) ? shift.outlet[0] : shift.outlet;
                const outletObj = {
                    id: shift.outlet_id,
                    outlet_type: outletRaw?.outlet_type,
                    branch_id: shift.branch_id,
                    name: outletRaw?.name
                };
                if (Number(outletObj.branch_id) !== Number((req.user as any)?.branch_id)) {
                    throw new AppError('Forbidden: order belongs to another branch', 403);
                }
                const assignedOutlets = await loadAssignedPosOutlets(supabase, (req.user as any)?.id);
                if (!canAccessPosOutlet(userRole, outletObj, assignedOutlets, (req.user as any)?.branch_id ?? (req.user as any)?.branchId)) {
                    throw new AppError('Forbidden: this cashier cannot clear orders for this POS station', 403);
                }
            }
            const order = await reconcileSettledOutletPosOrder(outletPosPaymentOrder.order);
            const normalizedMethod = String(method || 'cash').toLowerCase().replace(/[\s_-]/g, '_');
            const paymentMethod = normalizedMethod.includes('mpesa')
                ? 'mpesa'
                : normalizedMethod.includes('card')
                    ? 'card'
                    : normalizedMethod.includes('credit')
                        ? 'credit_bill'
                        : 'cash';

            if (!['cash', 'mpesa', 'card', 'credit_bill'].includes(paymentMethod)) {
                throw new AppError('Unsupported POS payment method', 400);
            }

            if (['paid', 'credit_bill', 'voided'].includes(String(order.payment_status || '').toLowerCase())) {
                throw new AppError('POS order is already cleared', 409);
            }

            const paymentAmount = Number(amount);
            if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
                throw new AppError('Payment amount must be greater than zero', 400);
            }

            // record_pos_shift_payment locks the order row (SELECT ... FOR UPDATE)
            // and updates amount_paid/balance_amount in the same transaction as the
            // pos_shift_payments insert, so two concurrent payments on the same bill
            // (double-tap, two cashiers) can't both read a stale balance and clobber
            // each other's contribution.
            const { data: rpcResult, error: rpcError } = await supabase
                .rpc('record_pos_shift_payment', {
                    p_order_id: order.id,
                    p_shift_id: order.shift_id,
                    p_outlet_id: order.outlet_id || shift.outlet_id,
                    p_payment_method: paymentMethod,
                    p_amount: paymentAmount,
                    p_reference: reference || `${paymentMethod}-${Date.now()}`,
                    p_received_by: req.user?.id
                });

            if (rpcError || !rpcResult) {
                throw new AppError(`POS payment recording failed: ${rpcError?.message || 'Unknown error'}`, 500);
            }

            const payment = rpcResult.payment;
            const updatedOrder = rpcResult.order;
            const nextPaid = Number(updatedOrder.amount_paid || 0);
            const nextBalance = Number(updatedOrder.balance_amount || 0);
            const isCleared = nextBalance <= 0.01;
            const nextPaymentStatus = updatedOrder.payment_status;

            try {
                const outlet = Array.isArray((shift as any).outlet) ? (shift as any).outlet[0] : (shift as any).outlet;
                const { data: txNumber } = await supabase.rpc('generate_cashier_transaction_number');
                await supabase.from('cashier_transactions').insert({ change_given: changeGiven, amount_tendered: amountTendered,
                    transaction_number: txNumber || `CT${Date.now()}`,
                    branch_id: shift.branch_id,
                    cashier_id: req.user?.id,
                    transaction_type: 'payment',
                    revenue_type: outlet?.outlet_type || 'pos',
                    reference_type: 'pos_shift_orders',
                    reference_id: order.id,
                    payment_method: paymentMethod,
                    amount: paymentAmount,
                    payment_reference: reference || payment.reference,
                    customer_name: order.customer_name || order.order_number
                });
            } catch (txError) {
                logger.warn('Could not record cashier transaction for POS captain payment:', txError);
            }

            await linkPaymentToActiveShift(req.user?.id!, payment.id, payment.reference || paymentRef, paymentMethod, paymentAmount);
            res.json({
                success: true,
                message: isCleared ? 'POS order cleared successfully' : 'POS partial payment recorded successfully',
                data: {
                    ...payment,
                    order_id: order.id,
                    order_number: order.order_number,
                    payment_status: nextPaymentStatus,
                    amount_paid: nextPaid,
                    balance_amount: nextBalance
                }
            });
            return;
        }

        // Check if it's a Kyogong Shift Transaction
        const kyogongPattern = /^[A-Z]+-\d{8}-\d{4}$/;
        if (kyogongPattern.test(bookingId.toString()) || bookingId.toString().includes('-202')) {
            let txQuery = supabase
                .from('shift_transactions')
                .select('*')
                .eq('transaction_number', bookingId);
            txQuery = applyBranchFilter(txQuery, req);
            const { data: transaction, error: txError } = await txQuery.single();

            if (!txError && transaction) {
                const isVerifiedMethod = isImmediateCashierPaymentMethod(method);
                const initialStatus = isVerifiedMethod ? 'completed' : 'pending';

                // 2. Record Payment
                const { data: payment, error: paymentError } = await supabase
                    .from('payments')
                    .insert({
                        kyogong_transaction_id: transaction.id, // We need to ensure this column exists or use metadata
                        amount: amount,
                        currency: 'KES',
                        payment_method: method,
                        status: initialStatus,
                        reference: paymentRef,
                        metadata: {
                            processed_by: 'cashier',
                            cashier_id: req.user?.id,
                            processed_at: new Date().toISOString(),
                            transaction_number: bookingId,
                            source: 'kyogong'
                        }
                    })
                    .select()
                    .single();

                if (paymentError) {
                    throw new AppError(`Payment recording failed: ${paymentError.message}`, 500);
                }

                if (initialStatus === 'completed') {
                    // Update Kyogong transaction status
                    await supabase
                        .from('shift_transactions')
                        .update({
                            payment_method: method.toUpperCase(),
                            cash_amount: method === 'cash' ? amount : 0,
                            mpesa_amount: method === 'mpesa' ? amount : 0,
                            card_amount: method === 'card' ? amount : 0
                        })
                        .eq('id', transaction.id);

                    // Record cashier transaction
                    const { error } = await supabase.from('cashier_transactions').insert({ change_given: changeGiven, amount_tendered: amountTendered,
                        transaction_number: `KYG-${transaction.transaction_number}`,
                        branch_id: transaction.branch_id,
                        cashier_id: req.user?.id,
                        transaction_type: 'payment',
                        revenue_type: 'KYOGONG_SALE',
                        reference_type: 'kyogong_transaction',
                        reference_id: transaction.id,
                        payment_method: method,
                        amount: amount,
                        customer_name: transaction.customer_name || 'Walk-in'
                    });

                    if (error) {

                      console.error('Database error:', error);

                      throw error;

                    }
                }

                await linkPaymentToActiveShift(req.user?.id!, payment.id, paymentRef, method, Number(amount));
                res.json({
                    success: true,
                    message: 'Kyogong payment processed successfully',
                    data: payment
                });
                return;
            }
        }

        // Check if it's an unpaid bill (starts with BILL, CON, POL, CWS)
        const otherPrefixes = ['CON', 'POL', 'CWS', 'BILL'];
        const billPrefix = otherPrefixes.find(p => bookingId.toString().startsWith(p));

        if (billPrefix) {
            // 1. Fetch the bill
            let unpaidBillQuery = supabase
                .from('unpaid_bills')
                .select('*')
                .eq('bill_number', bookingId);

            unpaidBillQuery = applyBranchFilter(unpaidBillQuery, req);
            const { data: bill, error: billError } = await unpaidBillQuery.maybeSingle();

            if (billError) throw new AppError('Bill lookup failed', 500);

            if (!bill) {
                let restaurantBillQuery = supabase
                    .from('restaurant_bills')
                    .select('*')
                    .eq('bill_number', bookingId);

                restaurantBillQuery = applyBranchFilter(restaurantBillQuery, req);
                const { data: restaurantBill, error: restaurantBillError } = await restaurantBillQuery.maybeSingle();

                if (restaurantBillError || !restaurantBill) {
                    throw new AppError('Bill not found', 404);
                }

                if (Number(amount) > Number(restaurantBill.balance || 0)) {
                    throw new AppError(`Payment amount (${amount}) exceeds bill balance (${restaurantBill.balance || 0})`, 400);
                }

                const { data: paymentNumberData, error: paymentNumberError } = await supabase
                    .rpc('generate_payment_number');
                if (paymentNumberError) throw paymentNumberError;

                const { data: payment, error: paymentError } = await supabase
                    .from('restaurant_bill_payments')
                    .insert({
                        bill_id: restaurantBill.id,
                        payment_number: paymentNumberData,
                        amount,
                        payment_method: normalizeRestaurantBillPaymentMethod(method),
                        payment_reference: paymentRef,
                        notes: 'Recorded from cashier station',
                        paid_by: req.user?.id,
                        cashier_id: req.user?.staff_profile_id
                    })
                    .select()
                    .single();

                if (paymentError) {
                    throw new AppError(`Restaurant bill payment recording failed: ${paymentError.message}`, 500);
                }

                const { error } = await supabase.from('cashier_transactions').insert({ change_given: changeGiven, amount_tendered: amountTendered,
                    transaction_number: `BILL-${restaurantBill.bill_number}`,
                    branch_id: restaurantBill.branch_id || req.user?.branch_id,
                    cashier_id: req.user?.id,
                    transaction_type: 'payment',
                    revenue_type: 'RESTAURANT',
                    reference_type: 'restaurant_bill',
                    reference_id: restaurantBill.id,
                    payment_method: method,
                    amount: amount,
                    customer_name: restaurantBill.guest_name || 'Walk-in'
                });

                if (error) throw error;

                res.json({
                    success: true,
                    message: 'Restaurant bill payment processed successfully',
                    data: payment
                });
                return;
            }

            const isVerifiedMethod = isImmediateCashierPaymentMethod(method);
            const initialStatus = isVerifiedMethod ? 'completed' : 'pending';

            // 2. Record Payment in Database
            const { data: payment, error: paymentError } = await supabase
                .from('payments')
                .insert({
                    bill_id: bill.id,
                    amount: amount,
                    currency: 'KES',
                    payment_method: method,
                    status: initialStatus,
                    reference: paymentRef,
                    metadata: {
                        processed_by: 'cashier',
                        cashier_id: req.user?.id,
                        processed_at: new Date().toISOString(),
                        bill_number: bookingId,
                        bill_type: bill.bill_type
                    }
                })
                .select()
                .single();

            if (paymentError) {
                throw new AppError(`Payment recording failed: ${paymentError.message}`, 500);
            }

            // 3. Update Bill status and balance if completed
            if (initialStatus === 'completed') {
                const currentPaid = Number(bill.paid_amount || 0);
                const paymentAmount = Number(amount);
                const totalAmount = Number(bill.total_amount);

                const newPaidAmount = currentPaid + paymentAmount;
                const newBalance = Math.max(0, totalAmount - newPaidAmount);
                const newStatus = newBalance <= 0 ? 'paid' : 'partial';

                const { error: updateError } = await supabase
                    .from('unpaid_bills')
                    .update({
                        paid_amount: newPaidAmount,
                        balance_amount: newBalance,
                        status: newStatus,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', bill.id);

                if (updateError) throw new AppError(`Failed to update bill status: ${updateError.message}`, 500);

                // Record cashier transaction
                const { error } = await supabase.from('cashier_transactions').insert({ change_given: changeGiven, amount_tendered: amountTendered,
                    transaction_number: `BILL-${bill.bill_number}`,
                    branch_id: bill.branch_id,
                    cashier_id: req.user?.id,
                    transaction_type: 'payment',
                    revenue_type: bill.revenue_type || 'GENERAL_SERVICE',
                    reference_type: 'unpaid_bill',
                    reference_id: bill.id,
                    payment_method: method,
                    amount: amount,
                    customer_name: bill.customer_name
                });

                if (error) {

                  console.error('Database error:', error);

                  throw error;

                }
            }

            await linkPaymentToActiveShift(req.user?.id!, payment.id, paymentRef, method, Number(amount));
            res.json({
                success: true,
                message: 'Bill payment processed successfully',
                data: payment
            });
            return;
        }

        // Check if it's a hotel booking (starts with HTL)
        let resolvedBookingId = bookingId;
        if (bookingId.toString().startsWith('HTL')) {
            const { data: resv, error: resvError } = await supabase
                .from('reservations')
                .select('id')
                .eq('confirmation_number', bookingId)
                .single();

            if (resvError || !resv) {
                throw new AppError('Hotel reservation not found', 404);
            }
            resolvedBookingId = resv.id;
        }

        if (!UUID_PATTERN.test(String(resolvedBookingId))) {
            throw new AppError('Bill or booking not found', 404);
        }

        // 1. Record Payment in Database
        const isVerifiedMethod = isImmediateCashierPaymentMethod(method);
        const initialStatus = isVerifiedMethod ? 'completed' : 'pending';

        const { data: payment, error: paymentError } = await supabase
            .from('payments')
            .insert({
                booking_id: resolvedBookingId,
                amount: amount,
                currency: 'KES',
                payment_method: method,
                status: initialStatus,
                reference: paymentRef,
                metadata: {
                    processed_by: 'cashier',
                    cashier_id: req.user?.id,
                    processed_at: new Date().toISOString(),
                    verification_required: !isVerifiedMethod,
                    original_id: bookingId
                }
            })
            .select()
            .single();

        if (paymentError) {
            throw new AppError(`Payment recording failed: ${paymentError.message}`, 500);
        }

        // 2. Update Booking Status (if fully paid and payment is completed)
        if (initialStatus === 'completed') {
            const { data: booking } = await supabase
                .from('reservations')
                .select('total_amount')
                .eq('id', resolvedBookingId)
                .single();

            const { data: allPayments } = await supabase
                .from('payments')
                .select('amount')
                .eq('booking_id', resolvedBookingId)
                .eq('status', 'completed');

            const totalPaid = allPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

            if (booking && totalPaid >= booking.total_amount) {
                await supabase
                    .from('reservations')
                    .update({
                        payment_status: 'paid',
                        deposit_paid: true
                    })
                    .eq('id', resolvedBookingId);
            }
        }

        await linkPaymentToActiveShift(req.user?.id!, payment.id, paymentRef, method, Number(amount));
        res.json({
            success: true,
            message: 'Hotel payment processed successfully',
            data: payment
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Backend fallback receipt printer — NOT the primary print path.
 * The cashier app prints the customer receipt client-side immediately after
 * a successful payment (see _printStationReceipt in cashier_dashboard.dart).
 * This endpoint is only called from that flow's catch block, i.e. when the
 * client-side print itself fails (printer offline, app crash, etc.), as a
 * last-resort attempt to still get a receipt out via the thermal printer
 * service.
 */
export const printCashierReceiptFallback = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { order_number, short_code, verification_code, customer_name, items, amount_paid, payment_method, outlet_name } = req.body;
        if (!order_number || !Array.isArray(items) || !items.length) {
            throw new AppError('order_number and items are required', 400);
        }

        const { customerReceiptPrintService } = await import('../services/customerReceiptPrint.service');
        const result = await customerReceiptPrintService.printCustomerReceipt({
            order_number,
            short_code,
            verification_code: verification_code || short_code,
            customer_name,
            items,
            amount_paid: Number(amount_paid) || 0,
            payment_method,
            cashier_name: `${req.user?.first_name || ''} ${req.user?.last_name || ''}`.trim(),
            outlet_name
        });

        if (result.success) {
            logger.info(`✅ Fallback receipt printed for ${order_number} (client-side print had failed)`);
        } else {
            logger.warn(`⚠️ Fallback receipt print also failed for ${order_number}: ${result.error}`);
        }
        res.json({ success: result.success, message: result.message, error: result.error });
    } catch (error) {
        next(error);
    }
};

/**
 * Verify a pending payment
 */
export const verifyPayment = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { paymentId } = req.params;
        const { status, notes } = req.body; // status: 'completed' or 'failed'

        if (!paymentId || !status) {
            throw new AppError('Payment ID and status are required', 400);
        }

        if (!['completed', 'failed'].includes(status)) {
            throw new AppError('Invalid status. Must be completed or failed', 400);
        }

        // 1. Get current payment
        const { data: payment, error: fetchError } = await supabase
            .from('payments')
            .select('*')
            .eq('id', paymentId)
            .single();

        if (fetchError || !payment) {
            throw new AppError('Payment not found', 404);
        }

        if (payment.status === 'completed') {
            throw new AppError('Payment is already verified', 400);
        }

        // 2. Update payment status
        const { data: updatedPayment, error: updateError } = await supabase
            .from('payments')
            .update({
                status: status,
                metadata: {
                    ...payment.metadata,
                    verified_by: req.user?.id,
                    verified_at: new Date().toISOString(),
                    verification_notes: notes
                },
                updated_at: new Date().toISOString()
            })
            .eq('id', paymentId)
            .select()
            .single();

        if (updateError) {
            throw new AppError(`Verification failed: ${updateError.message}`, 500);
        }

        // 3. If verified (completed), update related entity status
        if (status === 'completed') {
            // Hotel Booking
            if (payment.booking_id) {
                const { data: booking } = await supabase
                    .from('reservations')
                    .select('total_amount')
                    .eq('id', payment.booking_id)
                    .single();

                const { data: allPayments } = await supabase
                    .from('payments')
                    .select('amount')
                    .eq('booking_id', payment.booking_id)
                    .eq('status', 'completed');

                const totalPaid = allPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

                if (booking && totalPaid >= booking.total_amount) {
                    await supabase
                        .from('reservations')
                        .update({
                            payment_status: 'paid',
                            deposit_paid: true
                        })
                        .eq('id', payment.booking_id);
                }
            }
            // Restaurant Order
            else if (payment.restaurant_order_id) {
                const { data: order } = await supabase
                    .from('restaurant_orders')
                    .select('total_amount')
                    .eq('id', payment.restaurant_order_id)
                    .single();

                const { data: allPayments } = await supabase
                    .from('payments')
                    .select('amount')
                    .eq('restaurant_order_id', payment.restaurant_order_id)
                    .eq('status', 'completed');

                const totalPaid = allPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

                if (order && totalPaid >= order.total_amount) {
                    await supabase
                        .from('restaurant_orders')
                        .update({ payment_status: 'paid', status: 'delivered' })
                        .eq('id', payment.restaurant_order_id);
                } else if (totalPaid > 0) {
                    await supabase
                        .from('restaurant_orders')
                        .update({ payment_status: 'partial' })
                        .eq('id', payment.restaurant_order_id);
                }
            }
            // Bar Order
            else if (payment.bar_order_id) {
                const { data: order } = await supabase
                    .from('bar_orders')
                    .select('total')
                    .eq('id', payment.bar_order_id)
                    .single();

                const { data: allPayments } = await supabase
                    .from('payments')
                    .select('amount')
                    .eq('bar_order_id', payment.bar_order_id)
                    .eq('status', 'completed');

                const totalPaid = allPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

                if (order && totalPaid >= order.total) {
                    await supabase
                        .from('bar_orders')
                        .update({
                            payment_status: 'paid',
                            status: 'completed'
                        })
                        .eq('id', payment.bar_order_id);
                } else if (totalPaid > 0) {
                    await supabase
                        .from('bar_orders')
                        .update({ payment_status: 'partial' })
                        .eq('id', payment.bar_order_id);
                }
            }
            // POS Transaction
            else if (payment.pos_transaction_id) {
                await supabase
                    .from('pos_transactions')
                    .update({ status: 'PAID' })
                    .eq('id', payment.pos_transaction_id);
            }
            // Kyogong Transaction
            else if (payment.kyogong_transaction_id) {
                const method = payment.payment_method?.toLowerCase() || 'cash';
                await supabase
                    .from('shift_transactions')
                    .update({
                        payment_method: method.toUpperCase(),
                        cash_amount: method === 'cash' ? payment.amount : 0,
                        mpesa_amount: method === 'mpesa' ? payment.amount : 0,
                        card_amount: method === 'card' ? payment.amount : 0,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', payment.kyogong_transaction_id);
            }
            // Accounting AR Invoice
            else if (payment.invoice_id) {
                const { data: inv } = await supabase
                    .from('accounting_ar_invoices')
                    .select('total_amount, balance')
                    .eq('id', payment.invoice_id)
                    .single();

                if (inv) {
                    const currentBalance = Number(inv.balance);
                    const paymentAmount = Number(payment.amount);
                    const newBalance = Math.max(0, currentBalance - paymentAmount);

                    const { error: arError } = await supabase
                        .from('accounting_ar_invoices')
                        .update({
                            balance: newBalance,
                            status: newBalance <= 0 ? 'paid' : 'partial',
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', payment.invoice_id);
                    if (arError) throw new AppError(`Failed to update AR invoice status: ${arError.message}`, 500);
                }
            }
            // Unpaid Bill or Finance Invoice
            else if (payment.bill_id) {
                // Try finance_invoices first
                const { data: finInv } = await supabase
                    .from('finance_invoices')
                    .select('total_amount, paid_amount')
                    .eq('id', payment.bill_id)
                    .single();

                if (finInv) {
                    const currentPaid = Number(finInv.paid_amount || 0);
                    const paymentAmount = Number(payment.amount);
                    const totalAmount = Number(finInv.total_amount);
                    const newPaid = currentPaid + paymentAmount;

                    const { error: finError } = await supabase
                        .from('finance_invoices')
                        .update({
                            paid_amount: newPaid,
                            status: newPaid >= totalAmount ? 'paid' : 'partial',
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', payment.bill_id);
                    if (finError) throw new AppError(`Failed to update finance invoice status: ${finError.message}`, 500);
                } else {
                    // Try unpaid_bills
                    const { data: bill } = await supabase
                        .from('unpaid_bills')
                        .select('total_amount, paid_amount')
                        .eq('id', payment.bill_id)
                        .single();

                    if (bill) {
                        const currentPaid = Number(bill.paid_amount || 0);
                        const paymentAmount = Number(payment.amount);
                        const totalAmount = Number(bill.total_amount);

                        const newPaidAmount = currentPaid + paymentAmount;
                        const newBalance = Math.max(0, totalAmount - newPaidAmount);

                        const { error: billError } = await supabase
                            .from('unpaid_bills')
                            .update({
                                paid_amount: newPaidAmount,
                                balance_amount: newBalance,
                                status: newBalance <= 0 ? 'paid' : 'partial',
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', payment.bill_id);
                        if (billError) throw new AppError(`Failed to update bill status: ${billError.message}`, 500);
                    }
                }
            }
        }

        res.json({
            success: true,
            message: `Payment ${status} successfully`,
            data: updatedPayment
        });

    } catch (error) {
        next(error);
    }
};

// ============================================
// UNPAID BILLS MANAGEMENT
// ============================================

/**
 * Get all unpaid bills
 */
export const getUnpaidBills = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, status, customer_type, bill_type } = req.query;

        const userRole = (req.user as any)?.role?.toLowerCase() || '';
        const isGlobal = isGlobalRole(userRole);

        // Prioritize branch_id from query only if global
        let queryBranchId = branch_id ? parseInt(branch_id as string) : null;
        let effectiveBranchId = isGlobal ? queryBranchId : ((req.user as any)?.branch_id || 1);

        // Define roles that should see EVERYTHING (Hotel, Invoices, All Branches potentially)
        // Usually, these roles only see "Everything in THEIR branch" unless they are super_admin.
        const fullAccessRoles = [
            'super_admin', 'general_manager', 'accountant', 'branch_accountant',
            'auditor', 'receptionist', 'front_desk_supervisor', 'kyogong_reception_cashier'
        ];

        const hasFullAccess = fullAccessRoles.includes(userRole);

        // Fetch Unpaid POS Shift Transactions (Kyogong)
        // EVERYONE sees these if they match the branch
        let shiftQuery = supabase
            .from('shift_transactions')
            .select('*')
            .eq('payment_method', 'BILL')
            .eq('is_voided', false)
            .order('created_at', { ascending: false });

        if (effectiveBranchId) {
            shiftQuery = shiftQuery.eq('branch_id', effectiveBranchId);
        }

        const { data: shiftTransactions, error: shiftError } = await shiftQuery;
        if (shiftError) throw shiftError;

        // Map Kyogong bills (shift_transactions) to unpaid_bills format
        const mappedKyogong = (shiftTransactions || []).map(tx => ({
            id: tx.id,
            bill_number: tx.transaction_number,
            bill_date: tx.created_at,
            source_type: 'KYOGONG',
            customer_name: tx.customer_name || 'Guest',
            total_amount: tx.total_amount,
            paid_amount: 0,
            balance_amount: tx.total_amount,
            status: 'unpaid',
            branch_name: tx.branch?.name,
            description: `POS Transaction: ${tx.service_category || 'Items'}`,
            is_kyogong: true
        }));

        let combinedData: any[] = [...mappedKyogong];

        // ONLY full access roles see the rest (Hotel, Invoices, Manual Bills)
        if (hasFullAccess) {
            // Fetch Manual Unpaid Bills
            let query = supabase
                .from('unpaid_bills')
                .select('*')
                .order('bill_date', { ascending: false });

            if (effectiveBranchId) {
                query = query.eq('branch_id', effectiveBranchId);
            }

            if (status) {
                query = query.eq('status', status);
            } else {
                query = query.neq('status', 'paid');
            }

            if (customer_type) {
                query = query.eq('customer_type', customer_type as string);
            }

            if (bill_type) {
                query = query.eq('bill_type', bill_type as string);
            }

            const { data: unpaidBills, error: billsError } = await query;
            if (billsError) throw billsError;

            // `unpaid_bills` only stores `waiter_id` (FK to staff_profiles), not
            // a denormalized name, so cashiers in every outlet need it resolved
            // here to identify who is holding a credit/waiter bill.
            const waiterIds = Array.from(
                new Set((unpaidBills || []).map(b => b.waiter_id).filter(Boolean))
            );
            const staffByWaiterId = new Map<string, { first_name: string | null; last_name: string | null }>();
            if (waiterIds.length) {
                const { data: waiterProfiles } = await supabase
                    .from('staff_profiles')
                    .select('id, first_name, last_name')
                    .in('id', waiterIds);
                for (const profile of waiterProfiles || []) {
                    staffByWaiterId.set(profile.id, profile);
                }
            }
            const mappedUnpaidBills = (unpaidBills || []).map(bill => {
                const staff = bill.waiter_id ? staffByWaiterId.get(bill.waiter_id) : null;
                const waiterName = staff
                    ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim()
                    : null;
                return {
                    ...bill,
                    waiter_name: waiterName || null,
                    is_waiter_order: !!bill.waiter_id,
                };
            });

            // Fetch Unpaid Hotel Reservations
            // Hotel reservations might have `branch_id = null`, but the attached room has the real branch.
            // We must query the rooms table to filter correctly.
            let hotelQuery = supabase
                .from('reservations')
                .select(`
                    *,
                    room:rooms!inner(branch_id)
                `)
                .in('status', ['confirmed', 'checked_in'])
                .order('created_at', { ascending: false });

            if (effectiveBranchId) {
                // Filter by the joined room's branch_id
                hotelQuery = hotelQuery.eq('room.branch_id', effectiveBranchId);
            }

            const { data: hotelReservations, error: hotelError } = await hotelQuery;
            if (hotelError) throw hotelError;

            // Map Hotel Reservations to unpaid_bills format
            const mappedHotel = (hotelReservations || []).map(resv => ({
                id: resv.id,
                bill_number: resv.confirmation_number,
                branch_id: resv.room?.branch_id,
                bill_type: 'hotel',
                customer_name: resv.guest_name,
                total_amount: resv.total_amount,
                paid_amount: resv.amount_paid || resv.deposit_amount || 0,
                balance_amount: Number(resv.total_amount) - Number(resv.amount_paid || resv.deposit_amount || 0),
                bill_date: resv.created_at,
                status: resv.status,
                is_hotel: true
            })).filter(h => h.balance_amount > 0);

            // Fetch Unpaid Finance Invoices
            let financeInvoiceQuery = supabase
                .from('finance_invoices')
                .select('*')
                .neq('status', 'paid')
                .order('created_at', { ascending: false });

            if (effectiveBranchId) {
                financeInvoiceQuery = financeInvoiceQuery.eq('branch_id', effectiveBranchId);
            }

            const { data: financeInvoices } = await financeInvoiceQuery;

            // Map Finance Invoices
            const mappedFinance = (financeInvoices || []).map(inv => ({
                id: inv.id,
                bill_number: inv.invoice_number,
                branch_id: inv.branch_id,
                bill_type: 'finance_invoice',
                customer_name: inv.customer_name || 'Guest',
                total_amount: inv.total_amount,
                paid_amount: inv.paid_amount || 0,
                balance_amount: Number(inv.total_amount) - Number(inv.paid_amount || 0),
                bill_date: inv.created_at,
                status: inv.status,
                is_invoice: true
            }));

            // Fetch Unpaid Accounting AR Invoices
            let arInvoiceQuery = supabase
                .from('accounting_ar_invoices')
                .select('*')
                .neq('status', 'paid')
                .order('created_at', { ascending: false });

            const { data: arInvoices, error: arInvoiceError } = await arInvoiceQuery;
            if (arInvoiceError) throw arInvoiceError;

            // Map AR Invoices
            const mappedAR = (arInvoices || []).map(inv => ({
                id: inv.id,
                bill_number: inv.invoice_number,
                branch_id: inv.branch_id,
                bill_type: 'ar_invoice',
                customer_name: inv.notes || 'AR Invoice',
                total_amount: inv.total_amount,
                paid_amount: Number(inv.total_amount) - Number(inv.balance),
                balance_amount: inv.balance,
                bill_date: inv.created_at,
                status: inv.status,
                is_invoice: true
            }));

            // Combine all full access data.
            // Hotel room booking bills are DELIBERATELY excluded from the
            // cashier's general Unpaid Bills list — they now live in the
            // Reception "Room Bills" section (guest folios) and are cleared via
            // the cashier's dedicated Room Bills tab, not mixed in here. An
            // explicit bill_type=hotel query still returns them (reporting).
            const includeHotel = String(bill_type || '').toLowerCase() === 'hotel';
            combinedData = [
                ...combinedData,
                ...mappedUnpaidBills,
                ...(includeHotel ? mappedHotel : []),
                ...mappedFinance,
                ...mappedAR
            ];
        }

        // Sort final combined data
        combinedData.sort((a, b) => new Date(b.bill_date).getTime() - new Date(a.bill_date).getTime());


        res.json({
            success: true,
            message: 'Unpaid bills retrieved successfully',
            data: combinedData
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create unpaid bill
 */
export const createUnpaidBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const {
            branch_id,
            bill_type,
            reference_type,
            reference_id,
            customer_type,
            customer_id,
            customer_name,
            room_number,
            waiter_id,
            total_amount,
            payment_terms,
            credit_limit,
            due_date,
            remarks
        } = req.body;

        const effectiveBranchId = resolveCashierBranchId(req, branch_id);
        const waiterProfile = waiter_id
            ? await resolveCashierCreditStaffProfile(waiter_id, effectiveBranchId)
            : null;
        const normalizedReferenceId = normalizeUuidOrNull(reference_id);
        const normalizedCustomerId = normalizeUuidOrNull(customer_id);
        const normalizedCreatedBy = normalizeUuidOrNull(req.user?.id);

        // Generate bill number
        const { data: billNumberData } = await supabase
            .rpc('generate_bill_number');

        const bill_number = billNumberData || `BILL${Date.now()}`;

        const extraContext = [
            reference_type ? `ref_type=${reference_type}` : null,
            room_number ? `room=${room_number}` : null,
            payment_terms ? `terms=${payment_terms}` : null,
            (credit_limit !== undefined && credit_limit !== null && `${credit_limit}` !== '')
                ? `credit_limit=${credit_limit}` : null,
            customer_type ? `customer_type=${customer_type}` : null
        ].filter(Boolean).join(', ');
        const combinedRemarks = [remarks, extraContext ? `(${extraContext})` : null].filter(Boolean).join(' ');

        const { data, error } = await supabase
            .from('unpaid_bills')
            .insert({
                bill_number,
                branch_id: effectiveBranchId,
                bill_type,
                source_id: normalizedReferenceId,
                customer_id: normalizedCustomerId,
                customer_name: customer_name || waiterProfile?.name,
                waiter_id: waiterProfile?.id || waiter_id,
                total_amount,
                balance_amount: total_amount,
                balance_due: total_amount,
                due_date,
                remarks: combinedRemarks || null,
                status: 'unpaid',
                created_by: normalizedCreatedBy
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            message: 'Unpaid bill created successfully',
            data
        });
    } catch (error) {
        next(error);
    }
};

// POST /cashier/unpaid-bills/:id/charge
// Bill MORE to an existing customer credit account/tab — adds a charge and grows
// the running balance, so a customer credit bill behaves like a billable tab
// tracked against its credit terms (limit / due date). body: { amount, description? }
export const addChargeToUnpaidBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const amount = Number(req.body.amount);
        const description = String(req.body.description || '').trim();
        if (!(amount > 0)) throw new AppError('A positive charge amount is required', 400);

        const { data: bill, error: findErr } = await supabase
            .from('unpaid_bills').select('*').eq('id', id).maybeSingle();
        if (findErr) throw findErr;
        if (!bill) throw new AppError('Customer credit bill not found', 404);
        if (String(bill.status) === 'paid') {
            throw new AppError('This account is already fully settled', 409);
        }

        const paid = Number(bill.amount_paid || 0);
        const newTotal = Number(bill.total_amount || 0) + amount;
        const newBalance = Math.max(0, newTotal - paid);
        const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
        const chargeLog = `charge ${stamp}: ${description || 'item'} +${amount.toFixed(2)}`;
        const remarks = [bill.remarks, chargeLog].filter(Boolean).join(' | ');

        const { data, error } = await supabase
            .from('unpaid_bills')
            .update({
                total_amount: newTotal,
                balance_amount: newBalance,
                balance_due: newBalance,
                status: paid > 0 ? 'partial' : 'unpaid',
                remarks,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;

        res.json({ success: true, message: 'Charge billed to customer account', data });
    } catch (error) {
        next(error);
    }
};

/**
 * Settle a payment for a bill that is not a manual `unpaid_bills` row.
 * The cashier unpaid-bills list merges hotel reservations and Kyogong POS
 * shift transactions; both surface their own id, so a payment may target either.
 * Returns the updated record on success, or null if the id matches nothing.
 */
async function settleNonManualBill(
    id: string,
    opts: { paymentAmount: number; payment_method?: string; payment_reference?: string; cashierId?: string },
): Promise<any | null> {
    const { paymentAmount, payment_method, payment_reference, cashierId } = opts;

    // ── 1. Hotel reservation ────────────────────────────────────────────────
    const { data: reservation } = await supabase
        .from('reservations')
        .select('*, room:rooms(branch_id)')
        .eq('id', id)
        .maybeSingle();

    if (reservation) {
        const branchId = reservation.branch_id || reservation.room?.branch_id || null;
        const total = Number(reservation.total_amount || 0);
        const alreadyPaid = Number(reservation.amount_paid || reservation.deposit_amount || 0);
        const newPaid = alreadyPaid + paymentAmount;
        const fullyPaid = total > 0 && newPaid >= total;

        const { data: updated, error: updErr } = await supabase
            .from('reservations')
            .update({
                amount_paid: newPaid,
                payment_status: fullyPaid ? 'paid' : 'partial',
            })
            .eq('id', id)
            .select()
            .maybeSingle();
        if (updErr) throw updErr;

        await recordCashierTransactionSafe({
            branchId, cashierId, paymentAmount, payment_method, payment_reference,
            revenueType: 'hotel', referenceType: 'reservation', referenceId: id,
            customerName: reservation.guest_name,
        });
        return updated || { id, paid_amount: newPaid, balance_amount: Math.max(0, total - newPaid), status: fullyPaid ? 'paid' : 'partial' };
    }

    // ── 2. Kyogong POS shift transaction ────────────────────────────────────
    const { data: shiftTx } = await supabase
        .from('shift_transactions')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (shiftTx) {
        // Convert the BILL placeholder into a real settled payment so it leaves
        // the unpaid list.
        const { data: updated, error: updErr } = await supabase
            .from('shift_transactions')
            .update({ payment_method: (payment_method || 'cash').toUpperCase() })
            .eq('id', id)
            .select()
            .maybeSingle();
        if (updErr) throw updErr;

        await recordCashierTransactionSafe({
            branchId: shiftTx.branch_id, cashierId, paymentAmount, payment_method, payment_reference,
            revenueType: shiftTx.service_category || 'kyogong', referenceType: 'shift_transaction', referenceId: id,
            customerName: shiftTx.customer_name,
        });
        return updated || { id, status: 'paid' };
    }

    return null;
}

/**
 * Insert a cashier_transactions row + record the active-shift sale. Best-effort:
 * never throws, so a payment is not lost if downstream bookkeeping fails.
 */
async function recordCashierTransactionSafe(p: {
    branchId: number | null; cashierId?: string; paymentAmount: number;
    payment_method?: string; payment_reference?: string;
    revenueType?: string; referenceType: string; referenceId: string; customerName?: string;
}): Promise<void> {
    try {
        const { data: txNum } = await supabase.rpc('generate_cashier_transaction_number');
        const transaction_number = txNum || `CT${Date.now()}`;
        const { data: ct } = await supabase
            .from('cashier_transactions')
            .insert({
                transaction_number,
                branch_id: p.branchId,
                cashier_id: p.cashierId,
                transaction_type: 'payment',
                revenue_type: p.revenueType,
                reference_type: p.referenceType,
                reference_id: p.referenceId,
                payment_method: p.payment_method,
                amount: p.paymentAmount,
                payment_reference: p.payment_reference,
                customer_name: p.customerName,
            })
            .select('id, transaction_number')
            .maybeSingle();

        await recordActiveShiftSale({
            cashierId: p.cashierId,
            branchId: p.branchId || undefined,
            transactionId: ct?.id || p.referenceId,
            transactionRef: ct?.transaction_number || transaction_number,
            paymentMethod: p.payment_method || 'cash',
            amount: p.paymentAmount,
        });
    } catch (err) {
        logger.error('recordCashierTransactionSafe failed', err);
    }
}

/**
 * Record payment for unpaid bill
 */
export const recordBillPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const { payment_amount, payment_method, payment_reference, credit_bill_id } = req.body;
        const paymentAmount = Number(payment_amount || 0);
        const amountTendered = Number(req.body.amount_tendered) || 0;
        const changeGiven = Number(req.body.change_given) || 0;

        if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
            throw new AppError('Payment amount must be greater than zero', 400);
        }

        // Fetch current bill — use maybeSingle so a missing row doesn't 500.
        const { data: bill, error: fetchError } = await supabase
            .from('unpaid_bills')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (fetchError) throw fetchError;

        // The unpaid-bills list merges manual bills, hotel reservations and
        // Kyogong POS shift transactions — all keyed by their own id. If this id
        // is not a manual unpaid_bills row, settle the matching source instead.
        if (!bill) {
            const settled = await settleNonManualBill(id, {
                paymentAmount,
                payment_method,
                payment_reference,
                cashierId: req.user?.id,
            });
            if (settled) {
                res.json({ success: true, message: 'Payment recorded successfully', data: settled });
                return;
            }
            throw new AppError('Bill not found', 404);
        }

        // Calculate new paid amount
        const new_paid_amount = Number(bill.paid_amount || 0) + paymentAmount;
        const new_balance = bill.total_amount - new_paid_amount;

        // Update bill — mark as paid when balance reaches zero
        const isFullyPaid = new_balance <= 0;
        const nextStatus = isFullyPaid ? 'paid' : 'partial';
        const { data: updatedBill, error: updateError } = await supabase
            .from('unpaid_bills')
            .update({
                paid_amount: new_paid_amount,
                balance_amount: Math.max(0, new_balance),
                status: nextStatus,
                ...(isFullyPaid ? { paid_at: new Date().toISOString() } : {})
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Record cashier transaction
        const { data: transactionData } = await supabase
            .rpc('generate_cashier_transaction_number');

        const transaction_number = transactionData || `CT${Date.now()}`;

        const { data: cashierTransaction, error: cashierTransactionError } = await supabase
            .from('cashier_transactions')
            .insert({
                transaction_number,
                branch_id: bill.branch_id,
                cashier_id: req.user?.id,
                transaction_type: 'payment',
                revenue_type: bill.bill_type,
                reference_type: 'unpaid_bill',
                reference_id: bill.id,
                credit_bill_id: credit_bill_id || null,
                payment_method,
                amount: paymentAmount,
                amount_tendered: amountTendered,
                change_given: changeGiven,
                payment_reference,
                customer_name: bill.customer_name
            })
            .select('id, transaction_number')
            .single();

        if (cashierTransactionError) {
            throw new AppError(`Cashier transaction recording failed: ${cashierTransactionError.message}`, 500);
        }

        await recordActiveShiftSale({
            cashierId: req.user?.id,
            branchId: bill.branch_id,
            transactionId: cashierTransaction?.id || String(bill.id),
            transactionRef: cashierTransaction?.transaction_number || transaction_number,
            paymentMethod: payment_method,
            amount: paymentAmount
        });

        res.json({
            success: true,
            message: 'Payment recorded successfully',
            data: updatedBill
        });
    } catch (error) {
        next(error);
    }
};

export const downloadCustomerCreditInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id) {
            throw new AppError('Bill id is required', 400);
        }

        const { data: bill, error: fetchError } = await supabase
            .from('unpaid_bills')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !bill) {
            throw new AppError('Customer credit bill not found', 404);
        }

        let branchName: string | null = null;
        let branchLocation: string | null = null;

        if (bill.branch_id) {
            const { data: branch } = await supabase
                .from('branches')
                .select('name, location, address')
                .eq('id', bill.branch_id)
                .maybeSingle();

            if (branch) {
                branchName = branch.name || null;
                branchLocation = branch.location || branch.address || null;
            }
        }

        const itemsArray = Array.isArray(bill.items) ? bill.items : [];

        const normalizedItems = itemsArray.map((item: any, index: number) => {
            const quantity = Number(item?.quantity ?? item?.qty ?? 0) || 0;
            const unitPrice = Number(item?.unitPrice ?? item?.unit_price ?? item?.price ?? 0) || 0;
            const total = Number(item?.total ?? item?.total_amount ?? quantity * unitPrice) || 0;

            return {
                description: item?.description || item?.name || `Item ${index + 1}`,
                quantity,
                unit_price: unitPrice,
                total
            };
        });

        const invoiceNumber = bill.bill_number || bill.id;
        const formatDate = (value?: string | null) => {
            if (!value) return undefined;
            const parsed = new Date(value);
            if (Number.isNaN(parsed.getTime())) return undefined;
            return parsed.toISOString().split('T')[0];
        };

        const invoicePayload = {
            invoice_number: invoiceNumber,
            invoice_date: formatDate(bill.bill_date) || new Date().toISOString().split('T')[0],
            due_date: formatDate(bill.due_date),
            status: (bill.status || 'pending').toUpperCase(),
            customer_name: bill.customer_name || 'Customer',
            customer_address: branchName ? `${branchName}${branchLocation ? ' • ' + branchLocation : ''}` : 'FamousGate Hotels',
            customer_phone: bill.customer_phone || '',
            items: normalizedItems,
            tax_rate: Number(bill.tax_rate || 0) || 0,
            notes: bill.remarks || 'Thank you for your business.',
            terms: bill.payment_terms || 'Payment due upon receipt.',
            reference_code: bill.scan_reference || invoiceNumber
        };

        const pythonResponse = await axios.post(
            `${PYTHON_SERVICE_URL}/api/reports/generate/branded-pdf`,
            {
                reportType: 'invoice',
                data: invoicePayload,
                filters: {
                    branch_name: branchName || undefined,
                    branch_id: bill.branch_id || undefined,
                    bill_number: bill.bill_number || undefined,
                    scan_reference: bill.scan_reference || undefined
                },
                useRealData: false
            },
            { responseType: 'arraybuffer' }
        );

        const filename = `${invoiceNumber || 'Invoice'}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('Content-Length', Buffer.from(pythonResponse.data).length.toString());
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(Buffer.from(pythonResponse.data));
    } catch (error: any) {
        if (axios.isAxiosError(error)) {
            logger.error('Failed to generate branded invoice PDF', error);
            return next(new AppError('Unable to generate invoice PDF at this time', 502));
        }
        next(error);
    }
};

export const downloadCustomerCreditOutstandingReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id: branchIdParam, search: searchParam } = req.query;
        const branchId = resolveCashierBranchId(req, branchIdParam);
        const status = String(req.query.status || 'all').toLowerCase();
        const searchTerm = (searchParam as string)?.trim().toLowerCase() || '';
        const requestedDate = String(req.query.date || '').trim();
        const date = requestedDate || new Date().toISOString().slice(0, 10);
        const from = req.query.from_date
            ? new Date(String(req.query.from_date))
            : new Date(`${date}T00:00:00.000Z`);
        const to = req.query.to_date
            ? new Date(String(req.query.to_date))
            : new Date(`${date}T23:59:59.999Z`);

        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
            throw new AppError('Invalid report date supplied', 400);
        }

        const { data: branch } = await supabase
            .from('branches')
            .select('name, location, address')
            .eq('id', branchId)
            .maybeSingle();

        let billsQuery = supabase
            .from('unpaid_bills')
            .select('*')
            .eq('branch_id', branchId)
            .neq('status', 'paid')
            .gte('bill_date', from.toISOString().slice(0, 10))
            .lte('bill_date', to.toISOString().slice(0, 10))
            .order('bill_date', { ascending: false });

        if (status !== 'all') billsQuery = billsQuery.eq('status', status);

        const { data: billsData, error: billsError } = await billsQuery;
        if (billsError) throw billsError;

        let restaurantQuery = supabase
            .from('restaurant_orders')
            .select(`
                id, order_number, short_code, status, payment_status,
                table_number, room_number, guest_name,
                total_amount, amount_paid, balance_amount, created_at, branch_id, created_by,
                items:restaurant_order_items(
                    id, quantity, unit_price, total_price,
                    menu_item:restaurant_menu_items(name)
                )
            `)
            .eq('branch_id', branchId)
            .neq('payment_status', 'paid')
            .neq('status', 'cancelled')
            .gte('created_at', from.toISOString())
            .lte('created_at', to.toISOString())
            .order('created_at', { ascending: false });

        if (status !== 'all') restaurantQuery = restaurantQuery.eq('payment_status', status);

        const { data: restaurantOrders, error: restaurantError } = await restaurantQuery;
        if (restaurantError && restaurantError.code !== '42703') throw restaurantError;

        let barQuery = supabase
            .from('bar_orders')
            .select(`
                id, order_number, short_code, status, payment_status,
                seat_number, room_number, guest_name,
                total, amount_paid, balance_amount, created_at, branch_id, created_by,
                items:bar_order_items(id, drink_name, quantity, unit_price, total_price)
            `)
            .eq('branch_id', branchId)
            .neq('payment_status', 'paid')
            .neq('status', 'cancelled')
            .gte('created_at', from.toISOString())
            .lte('created_at', to.toISOString())
            .order('created_at', { ascending: false });

        if (status !== 'all') barQuery = barQuery.eq('payment_status', status);

        const { data: barOrders, error: barError } = await barQuery;
        if (barError && barError.code !== '42703') throw barError;

        const waiterMap = await fetchCashierUsersById([
            ...((restaurantOrders || []) as any[]).map((order: any) => order.created_by),
            ...((barOrders || []) as any[]).map((order: any) => order.created_by),
        ]);

        const formatDate = (value?: string | null) => {
            if (!value) return null;
            const parsed = new Date(value);
            if (Number.isNaN(parsed.getTime())) return null;
            return parsed.toISOString().split('T')[0];
        };

        const waiterName = (row: any) => {
            const waiter = waiterMap.get(String(row?.created_by || ''));
            return waiter ? `${waiter.first_name || ''} ${waiter.last_name || ''}`.trim() : '';
        };

        const searchableText = (parts: unknown[]) => parts
            .filter((part) => part !== null && part !== undefined)
            .join(' ')
            .toLowerCase();

        const persistedBills = (billsData || []).map((bill: any) => {
            const itemsArray = Array.isArray(bill.items) ? bill.items : [];
            const normalizedItems = itemsArray.map((item: any, itemIndex: number) => {
                const quantity = Number(item?.quantity ?? item?.qty ?? 0) || 0;
                const unitPrice = Number(item?.unitPrice ?? item?.unit_price ?? item?.price ?? 0) || 0;
                const total = Number(item?.total ?? item?.total_amount ?? quantity * unitPrice) || 0;

                return {
                    position: itemIndex + 1,
                    description: item?.description || item?.name || `Item ${itemIndex + 1}`,
                    quantity,
                    unit_price: unitPrice,
                    total,
                };
            });

            const paidAmount = Number(bill.paid_amount || 0);
            const totalAmount = Number(bill.total_amount || 0);
            const balanceAmount = Number(bill.balance_amount ?? totalAmount - paidAmount);

            return {
                sort_date: bill.bill_date || bill.created_at,
                search_text: searchableText([
                    bill.customer_name,
                    bill.bill_number,
                    bill.scan_reference,
                    bill.short_code,
                    bill.source_type,
                    bill.remarks,
                ]),
                customer_name: bill.customer_name || 'Customer',
                invoice_number: bill.bill_number || bill.id,
                reference_code: bill.scan_reference || bill.short_code || bill.bill_number || bill.id,
                status: (bill.status || 'pending').toUpperCase(),
                bill_date: formatDate(bill.bill_date) || formatDate(bill.created_at),
                due_date: formatDate(bill.due_date),
                payment_terms: bill.payment_terms || 'N/A',
                outstanding_amount: balanceAmount,
                total_amount: totalAmount,
                paid_amount: paidAmount,
                customer_phone: bill.customer_phone || null,
                remarks: bill.remarks || bill.source_type || null,
                items: normalizedItems,
            };
        });

        const restaurantBills = (restaurantOrders || []).map((order: any) => {
            const waiter = waiterName(order);
            const totalAmount = Number(order.total_amount || 0);
            const paidAmount = Number(order.amount_paid || 0);
            const balanceAmount = Number(order.balance_amount ?? (totalAmount - paidAmount)) || 0;
            const location = order.table_number ? `Table ${order.table_number}` : order.room_number ? `Room ${order.room_number}` : 'Restaurant';
            return {
                sort_date: order.created_at,
                search_text: searchableText([
                    order.order_number,
                    order.short_code,
                    order.guest_name,
                    waiter,
                    location,
                    'restaurant',
                ]),
                customer_name: order.guest_name || 'Walk-in',
                invoice_number: order.order_number || order.id,
                reference_code: order.short_code || order.order_number || order.id,
                status: (order.payment_status || 'unpaid').toUpperCase(),
                bill_date: formatDate(order.created_at),
                due_date: null,
                payment_terms: 'Cashier clearance',
                outstanding_amount: balanceAmount,
                total_amount: totalAmount,
                paid_amount: paidAmount,
                customer_phone: null,
                remarks: `Restaurant order${waiter ? ` | Waiter: ${waiter}` : ''} | ${location}`,
                items: (order.items || []).map((item: any, itemIndex: number) => {
                    const quantity = Number(item.quantity || 0) || 0;
                    const unitPrice = Number(item.unit_price || 0) || 0;
                    const total = Number(item.total_price ?? (quantity * unitPrice)) || 0;
                    return {
                        position: itemIndex + 1,
                        description: item.menu_item?.name || 'Menu item',
                        quantity,
                        unit_price: unitPrice,
                        total,
                    };
                }),
            };
        });

        const barBills = (barOrders || []).map((order: any) => {
            const waiter = waiterName(order);
            const totalAmount = Number(order.total || 0);
            const paidAmount = Number(order.amount_paid || 0);
            const balanceAmount = Number(order.balance_amount ?? (totalAmount - paidAmount)) || 0;
            const location = order.seat_number ? `Seat ${order.seat_number}` : order.room_number ? `Room ${order.room_number}` : 'Bar';
            return {
                sort_date: order.created_at,
                search_text: searchableText([
                    order.order_number,
                    order.short_code,
                    order.guest_name,
                    waiter,
                    location,
                    'bar',
                ]),
                customer_name: order.guest_name || 'Bar Customer',
                invoice_number: order.order_number || order.id,
                reference_code: order.short_code || order.order_number || order.id,
                status: (order.payment_status || 'unpaid').toUpperCase(),
                bill_date: formatDate(order.created_at),
                due_date: null,
                payment_terms: 'Cashier clearance',
                outstanding_amount: balanceAmount,
                total_amount: totalAmount,
                paid_amount: paidAmount,
                customer_phone: null,
                remarks: `Bar order${waiter ? ` | Waiter: ${waiter}` : ''} | ${location}`,
                items: (order.items || []).map((item: any, itemIndex: number) => {
                    const quantity = Number(item.quantity || 0) || 0;
                    const unitPrice = Number(item.unit_price || 0) || 0;
                    const total = Number(item.total_price ?? (quantity * unitPrice)) || 0;
                    return {
                        position: itemIndex + 1,
                        description: item.drink_name || 'Bar item',
                        quantity,
                        unit_price: unitPrice,
                        total,
                    };
                }),
            };
        });

        const normalizedBills = [
            ...persistedBills,
            ...restaurantBills,
            ...barBills,
        ]
            .filter((bill: any) => !searchTerm || bill.search_text.includes(searchTerm))
            .sort((a: any, b: any) => new Date(b.sort_date || 0).getTime() - new Date(a.sort_date || 0).getTime())
            .map((bill: any, index: number) => {
                const { sort_date, search_text, ...reportBill } = bill;
                return {
                    position: index + 1,
                    ...reportBill,
                };
            });

        const totalOutstanding = normalizedBills.reduce((sum, bill) => sum + (Number(bill.outstanding_amount) || 0), 0);
        const totalAmount = normalizedBills.reduce((sum, bill) => sum + (Number(bill.total_amount) || 0), 0);
        const uniqueCustomers = new Set(normalizedBills.map(bill => bill.customer_name || bill.invoice_number)).size;

        const payload = {
            generated_at: new Date().toISOString(),
            branch: {
                name: branch?.name || `Branch ${branchId}`,
                location: branch?.location || branch?.address || null,
            },
            summary: {
                total_bills: normalizedBills.length,
                unique_customers: uniqueCustomers,
                total_outstanding: totalOutstanding,
                total_amount: totalAmount,
            },
            bills: normalizedBills,
        };

        const pythonResponse = await axios.post(
            `${PYTHON_SERVICE_URL}/api/reports/generate/branded-pdf`,
            {
                reportType: 'cashier_unpaid_bills',
                data: payload,
                filters: {
                    branch_id: branchId,
                    branch_name: branch?.name || undefined,
                    date,
                    status,
                    search: searchTerm || undefined,
                    total_bills: payload.summary.total_bills,
                    title: 'UNPAID BILLS',
                    subtitle: 'Cashier Unpaid Bills',
                    detail_title: 'UNPAID BILL DETAILS',
                    empty_message: 'No unpaid bills found for the selected filters.',
                },
                useRealData: false,
            },
            { responseType: 'arraybuffer' }
        );

        const filename = `Cashier_Unpaid_Bills_${date}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('Content-Length', Buffer.from(pythonResponse.data).length.toString());
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(Buffer.from(pythonResponse.data));
    } catch (error) {
        if (axios.isAxiosError(error)) {
            logger.error('Failed to generate cashier unpaid bills PDF', error);
            return next(new AppError('Unable to generate unpaid bills PDF at this time', 502));
        }
        next(error);
    }
};

/**
 * Accountant/Auditor confirm unpaid bill
 */
export const confirmUnpaidBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const { role } = req.body; // 'accountant' or 'auditor'

        // 1. Fetch current bill
        const { data: bill, error: fetchError } = await supabase
            .from('unpaid_bills')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !bill) {
            throw new AppError('Bill not found', 404);
        }

        const updateData: any = {};
        if (role === 'accountant') {
            if (bill.accountant_confirmed_at) {
                throw new AppError('Bill already confirmed by accountant', 400);
            }
            updateData.accountant_confirmed_at = new Date().toISOString();
            updateData.accountant_id = normalizeUuidOrNull(req.user?.id);
        } else if (role === 'auditor') {
            if (bill.auditor_confirmed_at) {
                throw new AppError('Bill already confirmed by auditor', 400);
            }
            // Optional: require accountant confirmation first
            // if (!bill.accountant_confirmed_at) throw new AppError('Accountant confirmation required first', 400);

            updateData.auditor_confirmed_at = new Date().toISOString();
            updateData.auditor_id = normalizeUuidOrNull(req.user?.id);
        } else {
            throw new AppError('Invalid role for confirmation. Use accountant or auditor', 400);
        }

        const { data, error } = await supabase
            .from('unpaid_bills')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: `Bill confirmed by ${role} successfully`,
            data
        });
    } catch (error) {
        next(error);
    }
};

// ============================================
// CREDIT BILLS MANAGEMENT
// ============================================

/**
 * Get all credit bills
 */
export const getCreditBills = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, staff_id, status, approval_status, bill_type, search } = req.query;
        const requestedDate = String(req.query.date || '').trim();
        const from = req.query.from_date
            ? new Date(String(req.query.from_date))
            : requestedDate
                ? new Date(`${requestedDate}T00:00:00.000Z`)
                : null;
        const to = req.query.to_date
            ? new Date(String(req.query.to_date))
            : requestedDate
                ? new Date(`${requestedDate}T23:59:59.999Z`)
                : null;
        console.log('GET /api/cashier/credit-bills - Executing raw SQL fix');

        let queryStr = 'SELECT * FROM public.credit_bills WHERE 1=1';
        const params: any[] = [];

        const isGlobal = isGlobalRole(req.user?.role);
        const effectiveBranchId = isGlobal ? 
            (branch_id ? parseInt(branch_id as string) : null) : 
            req.user?.branch_id;

        if (effectiveBranchId) {
            params.push(effectiveBranchId);
            queryStr += ` AND branch_id = $${params.length}`;
        }

        const staffFilterId = normalizeUuidOrNull(staff_id);
        if (String(staff_id || '').trim() && !staffFilterId) {
            throw new AppError('Invalid staff_id filter', 400);
        }
        if (staffFilterId) {
            params.push(staffFilterId);
            queryStr += ` AND staff_id = $${params.length}`;
        }

        if (status) {
            params.push(status as string);
            queryStr += ` AND status = $${params.length}`;
        }

        if (from) {
            if (Number.isNaN(from.getTime())) throw new AppError('Invalid from date', 400);
            params.push(from.toISOString().slice(0, 10));
            queryStr += ` AND credit_date >= $${params.length}`;
        }

        if (to) {
            if (Number.isNaN(to.getTime())) throw new AppError('Invalid to date', 400);
            params.push(to.toISOString().slice(0, 10));
            queryStr += ` AND credit_date <= $${params.length}`;
        }

        if (approval_status) {
            params.push(approval_status as string);
            queryStr += ` AND approval_status = $${params.length}`;
        }

        if (bill_type) {
            params.push(bill_type as string);
            queryStr += ` AND bill_type = $${params.length}`;
        }

        if (search) {
            params.push(`%${String(search).trim()}%`);
            queryStr += ` AND (
                staff_name ILIKE $${params.length}
                OR employee_id ILIKE $${params.length}
                OR department ILIKE $${params.length}
                OR credit_number ILIKE $${params.length}
                OR remarks ILIKE $${params.length}
            )`;
        }

        queryStr += ' ORDER BY credit_date DESC';
        const { rows } = await db.query(queryStr, params);

        res.json({
            success: true,
            message: 'Credit bills retrieved successfully',
            data: rows
        });
    } catch (error) {
        console.error('Error in getCreditBills (Raw SQL fix):', error);
        next(error);
    }
};

/**
 * Get all loans (bill_type = 'loan')
 */
export const getLoans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, staff_id, status } = req.query;

        let query = supabase
            .from('credit_bills')
            .select('*')
            .eq('bill_type', 'loan')
            .order('credit_date', { ascending: false });

        query = applyBranchFilter(query, req);
        const isGlobal = isGlobalRole(req.user?.role);

        if (isGlobal && branch_id) {
            query = query.eq('branch_id', parseInt(branch_id as string));
        }

        if (staff_id) {
            query = query.eq('staff_id', staff_id as string);
        }

        if (status) {
            query = query.eq('status', status as string);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({
            success: true,
            message: 'Loans retrieved successfully',
            data
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all salary advances (bill_type = 'advance' or 'salary_advance')
 */
export const getAdvances = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, staff_id, status } = req.query;

        let query = supabase
            .from('credit_bills')
            .select('*')
            .or('bill_type.eq.advance,bill_type.eq.salary_advance')
            .order('credit_date', { ascending: false });

        query = applyBranchFilter(query, req);
        const isGlobal = isGlobalRole(req.user?.role);

        if (isGlobal && branch_id) {
            query = query.eq('branch_id', parseInt(branch_id as string));
        }

        if (staff_id) {
            query = query.eq('staff_id', staff_id as string);
        }

        if (status) {
            query = query.eq('status', status as string);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({
            success: true,
            message: 'Salary advances retrieved successfully',
            data
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create credit bill
 */
export const createCreditBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const {
            branch_id,
            staff_id,
            staff_name,
            employee_id,
            department,
            bill_type,
            reference_type,
            reference_id,
            total_amount,
            due_date,
            payment_method,
            deduction_months,
            remarks
        } = req.body;

        const effectiveBranchId = resolveCashierBranchId(req, branch_id);
        const totalAmount = Number(total_amount || 0);
        if (!staff_id) {
            throw new AppError('Staff member is required for a credit bill', 400);
        }
        if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
            throw new AppError('Credit bill amount must be greater than zero', 400);
        }
        const staffProfile = await resolveCashierCreditStaffProfile(staff_id, effectiveBranchId);
        const normalizedReferenceId = normalizeUuidOrNull(reference_id);
        const normalizedCreatedBy = normalizeUuidOrNull(req.user?.id);

        // Calculate monthly deduction
        const monthly_deduction = totalAmount / (deduction_months || 1);

        // Generate credit number
        const { data: creditNumberData } = await supabase
            .rpc('generate_credit_number');

        const credit_number = creditNumberData || `CR${Date.now()}`;

        const { data, error } = await supabase
            .from('credit_bills')
            .insert({
                bill_number: credit_number,
                branch_id: effectiveBranchId,
                customer_name: staff_name || staffProfile.name,
                source_module: reference_type || bill_type || 'cashier_credit',
                source_document_id: normalizedReferenceId,
                source_document_number: employee_id || null,
                total_amount: totalAmount,
                amount_paid: 0,
                balance_due: totalAmount,
                status: 'open',
                created_by: normalizedCreatedBy
            })
            .select()
            .single();

        if (error) throw error;

        const { data: staffCreditBill, error: staffCreditError } = await supabase
            .from('staff_credit_bills')
            .insert({
                staff_id: staffProfile.id,
                branch_id: effectiveBranchId,
                bill_number: credit_number,
                description: `Cashier Credit Bill - ${credit_number} - ${staff_name || staffProfile.name}`,
                amount: totalAmount,
                amount_paid: 0,
                balance: totalAmount,
                status: 'pending',
                source_cashier_credit_bill_id: data.id
            })
            .select('id')
            .single();

        if (staffCreditError) {
            throw new AppError(`Payroll credit bill creation failed: ${staffCreditError.message}`, 500);
        }

        res.status(201).json({
            success: true,
            message: 'Credit bill created successfully',
            data: {
                ...data,
                staff_credit_bill_id: staffCreditBill?.id || null
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Accountant/Auditor confirm credit bill
 */
export const confirmCreditBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        // Role may be passed explicitly; otherwise derive it from the signed-in
        // user so a branch accountant simply confirming (no role in body) works.
        let role = String(req.body.role || '').toLowerCase();
        if (!role) {
            const userRole = String(req.user?.role || '').toLowerCase();
            role = userRole === 'auditor' ? 'auditor' : 'accountant';
        }
        const confirmedAt = new Date().toISOString();
        const confirmedBy = normalizeUuidOrNull(req.user?.id);

        // 1. Fetch current credit bill
        const { data: bill, error: fetchError } = await supabase
            .from('credit_bills')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !bill) {
            throw new AppError('Credit bill not found', 404);
        }

        const updateData: any = {};
        const payrollUpdate: any = {};
        if (role === 'accountant' || role === 'branch_accountant') {
            if (bill.accountant_confirmed_at) {
                throw new AppError('Credit bill already confirmed by accountant', 400);
            }
            updateData.accountant_confirmed_at = confirmedAt;
            updateData.accountant_id = confirmedBy;
            payrollUpdate.accountant_confirmed_at = confirmedAt;
            payrollUpdate.accountant_id = confirmedBy;
            payrollUpdate.status = 'accountant_confirmed';
        } else if (role === 'auditor') {
            if (bill.auditor_confirmed_at) {
                throw new AppError('Credit bill already confirmed by auditor', 400);
            }
            updateData.auditor_confirmed_at = confirmedAt;
            updateData.auditor_id = confirmedBy;
            payrollUpdate.auditor_confirmed_at = confirmedAt;
            payrollUpdate.auditor_id = confirmedBy;
            payrollUpdate.status = 'auditor_confirmed';

            // If both are confirmed, mark the bill confirmed.
            if (bill.accountant_confirmed_at) {
                updateData.approval_status = 'confirmed';
            }
        } else {
            throw new AppError('Invalid role for confirmation', 400);
        }

        const { data, error } = await supabase
            .from('credit_bills')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // 2. Flow the branch-accountant / auditor confirmation through to the
        //    payroll-bound staff_credit_bills record so payroll + reporting see it.
        try {
            await supabase
                .from('staff_credit_bills')
                .update(payrollUpdate)
                .eq('source_cashier_credit_bill_id', id);
        } catch (propagateError) {
            logger.warn('Could not propagate credit bill confirmation to staff_credit_bills:', propagateError);
        }

        res.json({
            success: true,
            message: `Credit bill confirmed by ${role} successfully`,
            data
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Record credit bill payment
 */
export const recordCreditPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const { payment_amount, payment_method, payment_reference } = req.body;
        const paymentAmount = Number(payment_amount || 0);

        if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
            throw new AppError('Payment amount must be greater than zero', 400);
        }

        // Fetch current credit bill
        const { data: credit, error: fetchError } = await supabase
            .from('credit_bills')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;
        if (!credit) {
            throw new AppError('Credit bill not found', 404);
        }

        // Calculate new paid amount
        const new_paid_amount = Math.min(
            Number(credit.total_amount || 0),
            Number(credit.paid_amount || 0) + paymentAmount
        );
        const new_balance = Math.max(0, Number(credit.total_amount || 0) - new_paid_amount);

        // Update credit bill
        const { data: updatedCredit, error: updateError } = await supabase
            .from('credit_bills')
            .update({
                paid_amount: new_paid_amount,
                balance_amount: new_balance,
                status: new_balance <= 0 ? 'paid' : credit.status
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Normalize how the staff paid (cash / mpesa / card / bank) so the
        // branch accountant sees the real method when clearing the credit bill.
        const methodRaw = String(payment_method || 'cash').toLowerCase();
        const normalizedMethod = methodRaw.includes('mpesa') || methodRaw.includes('m-pesa')
            ? 'mpesa'
            : methodRaw.includes('card') || methodRaw.includes('swipe') || methodRaw.includes('visa')
                ? 'card'
                : methodRaw.includes('bank')
                    ? 'bank'
                    : 'cash';

        const { data: linkedPayrollBills, error: linkedPayrollError } = await supabase
            .from('staff_credit_bills')
            .select('id, amount, paid_amount, balance, status')
            .eq('source_cashier_credit_bill_id', id);

        if (linkedPayrollError) {
            throw new AppError(`Payroll credit bill lookup failed: ${linkedPayrollError.message}`, 500);
        }

        for (const payrollBill of linkedPayrollBills || []) {
            const payrollAmount = Number(payrollBill.amount || 0);
            const currentPaid = Number(payrollBill.paid_amount || 0);
            const payrollPaid = Math.min(payrollAmount, currentPaid + paymentAmount);
            const payrollBalance = Math.max(0, payrollAmount - payrollPaid);

            const { error: payrollUpdateError } = await supabase
                .from('staff_credit_bills')
                .update({
                    paid_amount: payrollPaid,
                    balance: payrollBalance,
                    status: payrollBalance <= 0 ? 'paid_cash' : payrollBill.status
                })
                .eq('id', payrollBill.id);

            if (payrollUpdateError) {
                throw new AppError(`Payroll credit bill update failed: ${payrollUpdateError.message}`, 500);
            }

            const appliedPaymentAmount = Math.min(paymentAmount, Math.max(0, payrollAmount - currentPaid));
            if (appliedPaymentAmount > 0) {
                const { error: paymentHistoryError } = await supabase
                    .from('staff_credit_bill_payments')
                    .insert({
                        credit_bill_id: payrollBill.id,
                        amount: appliedPaymentAmount,
                        payment_method: normalizedMethod,
                        reference: payment_reference || null,
                        notes: `Cashier payment for credit bill ${credit.credit_number || id}`,
                        recorded_by: req.user?.id || null
                    });

                if (paymentHistoryError) {
                    throw new AppError(`Payroll credit payment history failed: ${paymentHistoryError.message}`, 500);
                }
            }
        }

        // Record cashier transaction
        const { data: transactionData } = await supabase
            .rpc('generate_cashier_transaction_number');

        const transaction_number = transactionData || `CT${Date.now()}`;

        const { data: cashierTransaction, error: cashierTransactionError } = await supabase
            .from('cashier_transactions')
            .insert({
                transaction_number,
                branch_id: credit.branch_id,
                cashier_id: req.user?.id,
                transaction_type: 'payment',
                revenue_type: 'staff_credit',
                reference_type: 'credit_bill',
                reference_id: credit.id,
                payment_method: normalizedMethod,
                amount: paymentAmount,
                payment_reference,
                customer_name: credit.staff_name
            })
            .select('id, transaction_number')
            .single();

        if (cashierTransactionError) {
            throw new AppError(`Cashier transaction recording failed: ${cashierTransactionError.message}`, 500);
        }

        await recordActiveShiftSale({
            cashierId: req.user?.id,
            branchId: credit.branch_id,
            transactionId: cashierTransaction?.id || String(credit.id),
            transactionRef: cashierTransaction?.transaction_number || transaction_number,
            paymentMethod: normalizedMethod,
            amount: paymentAmount
        });

        res.json({
            success: true,
            message: 'Credit payment recorded successfully',
            data: updatedCredit
        });
    } catch (error) {
        next(error);
    }
};

// Normalize a free-form payment method to one of cash | mpesa | card | bank.
function normalizePaymentMethod(raw: unknown): string {
    const m = String(raw || 'cash').toLowerCase();
    if (m.includes('mpesa') || m.includes('m-pesa')) return 'mpesa';
    if (m.includes('card') || m.includes('swipe') || m.includes('visa')) return 'card';
    if (m.includes('bank')) return 'bank';
    return 'cash';
}

/**
 * Record a "paid bill": a staff member handing money to the cashier toward
 * their credit during the cashier's shift. The cashier does not settle a
 * specific staff_credit_bills row here; the branch accountant applies this
 * evidence later as a partial or full payment against the correct staff credit.
 *
 * The payment is appended to the open shift's `paid_bills_details`, which:
 *   1. shows on the cashier's "Paid Bills" tab (per-method totals + grand total),
 *   2. flows to the branch accountant automatically at shift close as a review
 *      entry without reducing existing staff credit balances.
 */
export const recordStaffPaidBill = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { staff_id, staff_name, amount, payment_method, reference, cash_rendered } = req.body;
        const paidAmount = Number(amount || 0);

        if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
            throw new AppError('Amount paid must be greater than zero', 400);
        }
        if (!staff_name && !staff_id) {
            throw new AppError('Select the staff member who paid', 400);
        }

        const method = normalizePaymentMethod(payment_method);

        // REFERENCE VALIDATION BASED ON PAYMENT METHOD
        let finalReference: string;
        let cashRenderedAmount: number | null = null;
        let cashVariance: number | null = null;

        if (method === 'cash') {
            // For CASH: System auto-generates reference + requires cash rendered tracking
            finalReference = `CASH-PB-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

            cashRenderedAmount = Number(cash_rendered || 0);
            if (!Number.isFinite(cashRenderedAmount) || cashRenderedAmount <= 0) {
                throw new AppError('For cash payments, you must enter the cash amount physically rendered to staff', 400);
            }

            // Calculate variance (should be 0, but tracks if cashier gave wrong amount)
            cashVariance = cashRenderedAmount - paidAmount;

        } else if (method === 'mpesa' || method === 'card') {
            // For M-PESA/CARD: User MUST provide reference
            if (!reference || String(reference).trim() === '') {
                throw new AppError(`${method.toUpperCase()} reference is required (e.g., M-Pesa code or Card approval code)`, 400);
            }
            finalReference = String(reference).trim();

        } else {
            // Other payment methods require reference
            if (!reference || String(reference).trim() === '') {
                throw new AppError('Payment reference is required', 400);
            }
            finalReference = String(reference).trim();
        }

        // Find the cashier's open shift to attach the paid bill to.
        const { data: shift, error: shiftError } = await supabase
            .from('cashier_shift_logs')
            .select('id, branch_id, paid_bills_details, paid_bills_value, paid_bills_count')
            .eq('cashier_id', req.user?.id)
            .eq('status', 'open')
            .order('shift_start', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (shiftError) throw shiftError;
        if (!shift) {
            throw new AppError('No open shift. Open a shift before recording paid bills.', 400);
        }

        // Find the staff member's outstanding credit bills
        let matchedCreditBills: any[] = [];
        if (staff_id) {
            const { data: creditBills } = await supabase
                .from('staff_credit_bills')
                .select('id, bill_number, amount, paid_amount, balance, status')
                .eq('staff_id', staff_id)
                .in('status', ['open', 'approved', 'pending'])
                .gt('balance', 0)
                .order('bill_date', { ascending: true }); // Oldest first (FIFO)

            matchedCreditBills = creditBills || [];
        }

        const existing = Array.isArray(shift.paid_bills_details)
            ? shift.paid_bills_details
            : [];

        const entry = {
            id: `PB${Date.now()}`,
            staff_id: staff_id || null,
            name: staff_name || 'Staff',
            amount: paidAmount,
            payment_method: method,
            reference: finalReference,
            cash_rendered: cashRenderedAmount, // For cash: tracks physical cash given to staff
            cash_variance: cashVariance, // For cash: variance (should be 0, but tracks errors)
            recorded_at: new Date().toISOString(),
            recorded_by: req.user?.id || null,
            review_status: 'pending_branch_accountant_approval',
            matched_credit_bills: matchedCreditBills.map(cb => ({
                credit_bill_id: cb.id,
                bill_number: cb.bill_number,
                outstanding_balance: cb.balance,
            })),
            branch_id: shift.branch_id,
        };

        const updated = [...existing, entry];
        const totalValue = updated.reduce(
            (sum: number, bill: any) => sum + (Number(bill.amount) || 0),
            0
        );

        const { error: updateError } = await supabase
            .from('cashier_shift_logs')
            .update({
                paid_bills_details: updated,
                paid_bills_value: totalValue,
                paid_bills_count: updated.length,
            })
            .eq('id', shift.id);

        if (updateError) throw updateError;

        // Build success message with cash variance alert if applicable
        let successMessage = matchedCreditBills.length > 0
            ? `Payment recorded. Found ${matchedCreditBills.length} outstanding credit bill(s) for this staff. Awaiting accountant approval.`
            : 'Payment recorded. No outstanding credit bills found for this staff. Awaiting accountant approval.';

        if (method === 'cash' && cashVariance !== null && cashVariance !== 0) {
            successMessage += ` WARNING: Cash variance detected (Rendered: KES ${cashRenderedAmount?.toFixed(2)}, Payment: KES ${paidAmount.toFixed(2)}, Variance: KES ${cashVariance.toFixed(2)})`;
        }

        res.status(201).json({
            success: true,
            message: successMessage,
            data: {
                entry,
                paid_bills_details: updated,
                paid_bills_value: totalValue,
                paid_bills_count: updated.length,
                matched_credit_bills: matchedCreditBills,
                cash_variance_alert: method === 'cash' && cashVariance !== 0 ? {
                    rendered: cashRenderedAmount,
                    payment: paidAmount,
                    variance: cashVariance,
                } : null,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * List the paid bills recorded against the cashier's current open shift, with
 * per-method subtotals so the "Paid Bills" tab can show Cash / M-Pesa / Card
 * tallies plus the grand Total Paid Bills.
 */
export const getStaffPaidBills = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { data: shift, error } = await supabase
            .from('cashier_shift_logs')
            .select('id, paid_bills_details, paid_bills_value, paid_bills_count')
            .eq('cashier_id', req.user?.id)
            .eq('status', 'open')
            .order('shift_start', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;

        const details: any[] = shift && Array.isArray(shift.paid_bills_details)
            ? shift.paid_bills_details
            : [];

        const totals: Record<string, number> = { cash: 0, mpesa: 0, card: 0, bank: 0, total: 0 };
        for (const bill of details) {
            const key = normalizePaymentMethod(bill.payment_method);
            const value = Number(bill.amount) || 0;
            totals[key] = (totals[key] || 0) + value;
            totals.total += value;
        }

        res.json({
            success: true,
            data: details,
            totals: { ...totals, count: details.length },
            has_open_shift: !!shift,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Branch Accountant approves a staff paid bill and applies payment to credit bills.
 * This action:
 * 1. Validates the payment reference and details
 * 2. Applies the payment to outstanding credit bills (FIFO order)
 * 3. Updates staff_credit_bills balances
 * 4. Creates payment history in staff_credit_bill_payments
 * 5. Marks the paid bill entry as approved
 */
export const approvePaidBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { shift_id, paid_bill_id } = req.params;
        const { notes } = req.body;

        // Verify user is branch accountant or admin
        const userRole = String((req as any).user?.role || '').toLowerCase();
        if (!userRole.includes('accountant') && !userRole.includes('admin')) {
            throw new AppError('Only branch accountants can approve paid bills', 403);
        }

        // Fetch shift with paid bills
        const { data: shift, error: shiftError } = await supabase
            .from('cashier_shift_logs')
            .select('*')
            .eq('id', shift_id)
            .single();

        if (shiftError) throw shiftError;
        if (!shift) {
            throw new AppError('Shift not found', 404);
        }

        const paidBills = Array.isArray(shift.paid_bills_details) ? shift.paid_bills_details : [];
        const paidBill = paidBills.find((pb: any) => pb.id === paid_bill_id);

        if (!paidBill) {
            throw new AppError('Paid bill entry not found', 404);
        }

        if (paidBill.review_status === 'approved') {
            throw new AppError('This payment has already been approved', 400);
        }

        if (paidBill.review_status === 'rejected') {
            throw new AppError('This payment has been rejected and cannot be approved', 400);
        }

        const paymentAmount = Number(paidBill.amount || 0);
        const staffId = paidBill.staff_id;
        const paymentMethod = normalizePaymentMethod(paidBill.payment_method);
        const paymentReference = paidBill.reference;

        if (!staffId) {
            throw new AppError('No staff ID linked to this payment', 400);
        }

        // Fetch staff's outstanding credit bills (FIFO order)
        const { data: creditBills, error: creditError } = await supabase
            .from('staff_credit_bills')
            .select('*')
            .eq('staff_id', staffId)
            .in('status', ['open', 'approved', 'pending'])
            .gt('balance', 0)
            .order('bill_date', { ascending: true });

        if (creditError) throw creditError;

        if (!creditBills || creditBills.length === 0) {
            throw new AppError('No outstanding credit bills found for this staff member', 404);
        }

        // Apply payment to credit bills (FIFO)
        let remainingPayment = paymentAmount;
        const paymentsApplied: any[] = [];

        for (const creditBill of creditBills) {
            if (remainingPayment <= 0) break;

            const currentBalance = Number(creditBill.balance || 0);
            const currentPaid = Number(creditBill.paid_amount || 0);
            const totalAmount = Number(creditBill.amount || 0);

            const amountToApply = Math.min(remainingPayment, currentBalance);
            const newPaid = currentPaid + amountToApply;
            const newBalance = Math.max(0, totalAmount - newPaid);

            // Update staff credit bill
            const { error: updateError } = await supabase
                .from('staff_credit_bills')
                .update({
                    paid_amount: newPaid,
                    balance: newBalance,
                    status: newBalance <= 0 ? 'paid_cash' : creditBill.status,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', creditBill.id);

            if (updateError) {
                throw new AppError(`Failed to update credit bill ${creditBill.bill_number}: ${updateError.message}`, 500);
            }

            // Create payment history record with cash audit trail
            const paymentHistoryData: any = {
                credit_bill_id: creditBill.id,
                amount: amountToApply,
                payment_method: paymentMethod,
                reference: paymentReference,
                notes: notes || `Cashier payment approved by ${(req as any).user?.first_name || 'accountant'}`,
                recorded_by: req.user?.id || null,
                approved_by: req.user?.id || null,
                approved_at: new Date().toISOString(),
            };

            // Add cash audit fields for cash payments
            if (paymentMethod === 'cash' && paidBill.cash_rendered) {
                paymentHistoryData.cash_rendered = Number(paidBill.cash_rendered);
                paymentHistoryData.cash_variance = paidBill.cash_variance ? Number(paidBill.cash_variance) : 0;
            }

            const { error: paymentHistoryError } = await supabase
                .from('staff_credit_bill_payments')
                .insert(paymentHistoryData);

            if (paymentHistoryError) {
                throw new AppError(`Failed to create payment history: ${paymentHistoryError.message}`, 500);
            }

            // Also update linked cashier credit bill if exists
            if (creditBill.source_cashier_credit_bill_id) {
                await supabase
                    .from('credit_bills')
                    .update({
                        paid_amount: newPaid,
                        balance_amount: newBalance,
                        status: newBalance <= 0 ? 'paid' : 'open',
                    })
                    .eq('id', creditBill.source_cashier_credit_bill_id);
            }

            paymentsApplied.push({
                credit_bill_id: creditBill.id,
                bill_number: creditBill.bill_number,
                amount_applied: amountToApply,
                new_balance: newBalance,
                status: newBalance <= 0 ? 'paid_cash' : creditBill.status,
            });

            remainingPayment -= amountToApply;
        }

        // Generate transaction number
        const { data: transactionNumberData } = await supabase.rpc('generate_cashier_transaction_number');
        const transaction_number = transactionNumberData || `CT${Date.now()}`;

        // Prepare transaction description with cash variance info if applicable
        let transactionDescription = `Staff credit payment approved: ${paidBill.name}`;
        const cashRendered = paidBill.cash_rendered ? Number(paidBill.cash_rendered) : null;
        const cashVariance = paidBill.cash_variance ? Number(paidBill.cash_variance) : null;

        if (paymentMethod === 'cash' && cashRendered !== null) {
            transactionDescription += ` | Cash Rendered: KES ${cashRendered.toFixed(2)}`;
            if (cashVariance !== null && cashVariance !== 0) {
                transactionDescription += ` | Variance: KES ${cashVariance.toFixed(2)}`;
            }
        }

        // Record cashier transaction with cash audit fields
        const transactionInsertData: any = {
            transaction_number,
            branch_id: shift.branch_id,
            cashier_id: shift.cashier_id,
            transaction_type: 'payment',
            revenue_type: 'staff_credit',
            reference_type: 'staff_credit_bill',
            reference_id: staffId,
            amount: paymentAmount - remainingPayment, // Actual amount applied
            payment_method: paymentMethod,
            payment_reference: paymentReference,
            description: transactionDescription,
            shift_id: shift.id,
            recorded_by: req.user?.id,
        };

        // Add cash audit fields for cash payments
        if (paymentMethod === 'cash' && cashRendered !== null) {
            transactionInsertData.metadata = {
                cash_rendered: cashRendered,
                cash_variance: cashVariance,
                payment_amount: paymentAmount,
            };
        }

        const { error: cashierTransactionError } = await supabase
            .from('cashier_transactions')
            .insert(transactionInsertData);

        if (cashierTransactionError) {
            throw new AppError(`Failed to create cashier transaction: ${cashierTransactionError.message}`, 500);
        }

        // Update the paid bill entry status in shift log
        const updatedPaidBills = paidBills.map((pb: any) => {
            if (pb.id === paid_bill_id) {
                return {
                    ...pb,
                    review_status: 'approved',
                    approved_by: req.user?.id,
                    approved_at: new Date().toISOString(),
                    payments_applied: paymentsApplied,
                    transaction_number,
                    remaining_unapplied: remainingPayment,
                };
            }
            return pb;
        });

        const { error: shiftUpdateError } = await supabase
            .from('cashier_shift_logs')
            .update({
                paid_bills_details: updatedPaidBills,
            })
            .eq('id', shift_id);

        if (shiftUpdateError) throw shiftUpdateError;

        res.json({
            success: true,
            message: remainingPayment > 0
                ? `Payment approved and applied. KES ${(paymentAmount - remainingPayment).toLocaleString()} applied to ${paymentsApplied.length} bill(s). KES ${remainingPayment.toLocaleString()} could not be applied (no more outstanding bills).`
                : `Payment approved and fully applied to ${paymentsApplied.length} credit bill(s).`,
            data: {
                paid_bill_id,
                amount_paid: paymentAmount,
                amount_applied: paymentAmount - remainingPayment,
                remaining_unapplied: remainingPayment,
                payments_applied: paymentsApplied,
                transaction_number,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Branch Accountant rejects a staff paid bill.
 * Marks the payment as rejected with reason.
 */
export const rejectPaidBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { shift_id, paid_bill_id } = req.params;
        const { reason } = req.body;

        // Verify user is branch accountant or admin
        const userRole = String((req as any).user?.role || '').toLowerCase();
        if (!userRole.includes('accountant') && !userRole.includes('admin')) {
            throw new AppError('Only branch accountants can reject paid bills', 403);
        }

        if (!reason || String(reason).trim() === '') {
            throw new AppError('Rejection reason is required', 400);
        }

        // Fetch shift with paid bills
        const { data: shift, error: shiftError } = await supabase
            .from('cashier_shift_logs')
            .select('*')
            .eq('id', shift_id)
            .single();

        if (shiftError) throw shiftError;
        if (!shift) {
            throw new AppError('Shift not found', 404);
        }

        const paidBills = Array.isArray(shift.paid_bills_details) ? shift.paid_bills_details : [];
        const paidBill = paidBills.find((pb: any) => pb.id === paid_bill_id);

        if (!paidBill) {
            throw new AppError('Paid bill entry not found', 404);
        }

        if (paidBill.review_status === 'approved') {
            throw new AppError('Cannot reject an already approved payment', 400);
        }

        // Update the paid bill entry status
        const updatedPaidBills = paidBills.map((pb: any) => {
            if (pb.id === paid_bill_id) {
                return {
                    ...pb,
                    review_status: 'rejected',
                    rejected_by: req.user?.id,
                    rejected_at: new Date().toISOString(),
                    rejection_reason: String(reason).trim(),
                };
            }
            return pb;
        });

        const { error: shiftUpdateError } = await supabase
            .from('cashier_shift_logs')
            .update({
                paid_bills_details: updatedPaidBills,
            })
            .eq('id', shift_id);

        if (shiftUpdateError) throw shiftUpdateError;

        res.json({
            success: true,
            message: 'Paid bill rejected',
            data: {
                paid_bill_id,
                reason,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Mark a staff credit bill to be settled via payroll deduction.
 * Branch accountant action: instead of the staff paying cash, the outstanding
 * amount is flagged so the next payroll run deducts it from their salary.
 * The payroll engine picks up staff_credit_bills not in
 * (paid, paid_cash, deducted, cancelled), so we set them to 'approved'.
 */
export const deductCreditBillFromPayroll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const { data: credit, error: fetchError } = await supabase
            .from('credit_bills')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (fetchError) throw fetchError;
        if (!credit) {
            throw new AppError('Credit bill not found', 404);
        }

        if (Number(credit.balance_amount || 0) <= 0) {
            throw new AppError('Credit bill has no outstanding balance to deduct', 400);
        }

        // Flag the cashier-side credit bill as scheduled for payroll deduction.
        const { data: updatedCredit, error: updateError } = await supabase
            .from('credit_bills')
            .update({
                status: 'approved',
                payroll_deduction_scheduled: true,
                payroll_scheduled_by: req.user?.id || null,
                payroll_scheduled_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .maybeSingle();
        // payroll_deduction_scheduled column may not exist on every deployment —
        // fall back to a status-only update so the action never hard-fails.
        if (updateError) {
            const { error: fallbackError } = await supabase
                .from('credit_bills')
                .update({ status: 'approved' })
                .eq('id', id);
            if (fallbackError) throw fallbackError;
        }

        // Ensure the linked payroll-side bills are pickable by the payroll run.
        const { data: linked } = await supabase
            .from('staff_credit_bills')
            .select('id, status')
            .eq('source_cashier_credit_bill_id', id);

        for (const bill of linked || []) {
            if (['paid', 'paid_cash', 'deducted', 'cancelled'].includes(bill.status)) continue;
            await supabase
                .from('staff_credit_bills')
                .update({
                    status: 'approved',
                    remarks: notes ? `Scheduled for payroll deduction: ${notes}` : 'Scheduled for payroll deduction',
                })
                .eq('id', bill.id);
        }

        res.json({
            success: true,
            message: 'Credit bill scheduled for payroll deduction',
            data: updatedCredit || { id, status: 'approved' },
        });
    } catch (error) {
        next(error);
    }
};

// ============================================
// CASHIER SHIFTS
// ============================================

/**
 * Get cashier shifts
 */
export const getCashierShifts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, cashier_id, status, shift_date } = req.query;

        let query = supabase
            .from('cashier_shifts')
            .select('*')
            .order('shift_date', { ascending: false });

        query = applyBranchFilter(query, req);
        const isGlobal = isGlobalRole(req.user?.role);

        if (isGlobal && branch_id) {
            query = query.eq('branch_id', parseInt(branch_id as string));
        }

        if (cashier_id) {
            query = query.eq('cashier_id', cashier_id as string);
        }

        if (status) {
            query = query.eq('status', status as string);
        }

        if (shift_date) {
            query = query.eq('shift_date', shift_date as string);
        }

        const { data, error } = await query;

        if (error) throw error;
        const decorated = await Promise.all((data || []).map(async (shift: any) => {
            const transactions = await loadCashierTransactionsForShift(shift);
            const liveTotals = cashierShiftTotals(shift, transactions);
            return {
                ...shift,
                ...liveTotals,
                cash_audit: {
                    amount_tendered: liveTotals.total_cash_tendered,
                    change_given: liveTotals.total_change_given,
                    drawer_cash_in: liveTotals.drawer_cash_in,
                    expected_cash: liveTotals.expected_cash
                }
            };
        }));

        res.json({
            success: true,
            message: 'Cashier shifts retrieved successfully',
            data: decorated
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Start cashier shift
 */
export const startShift = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, opening_float } = req.body;

        // Check if cashier already has an open shift
        const { data: existingShift } = await supabase
            .from('cashier_shifts')
            .select('*')
            .eq('cashier_id', req.user?.id)
            .eq('status', 'open')
            .single();

        if (existingShift) {
            throw new AppError('You already have an open shift', 400);
        }

        // Generate shift number
        const { data: shiftNumberData } = await supabase
            .rpc('generate_shift_number');

        const shift_number = shiftNumberData || `SH${Date.now()}`;

        const { data, error } = await supabase
            .from('cashier_shifts')
            .insert({
                shift_number,
                branch_id,
                cashier_id: req.user?.id,
                opening_float: opening_float || 0,
                start_time: new Date().toISOString(),
                status: 'open'
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            message: 'Shift started successfully',
            data
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Close cashier shift
 */
export const closeShift = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const { closing_float, actual_cash, remarks } = req.body;
        const automationWarnings: string[] = [];

        // Fetch shift
        const { data: shift, error: fetchError } = await supabase
            .from('cashier_shifts')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;
        if (!shift) {
            throw new AppError('Shift not found', 404);
        }

        // Block close while any item-level void request anywhere in this
        // branch is sitting in this cashier's own queue ('kitchen_acknowledged'
        // -- kitchen has signed off, cashier has not yet acknowledged or
        // declined). Requests still at 'pending' haven't reached the cashier
        // yet (kitchen's queue, not theirs). cashier_shifts has no FK to the
        // pos_outlet_shifts the void requests are raised against (a single
        // cashier shift spans every outlet station in the branch), so this
        // is scoped by branch_id rather than shift_id.
        const { data: pendingItemVoids, error: pendingItemVoidsError } = await supabase
            .from('pos_item_void_requests')
            .select('id, order_number, item_name, qty_to_void, requested_by')
            .eq('branch_id', shift.branch_id)
            .eq('status', 'kitchen_acknowledged');
        if (pendingItemVoidsError) throw pendingItemVoidsError;

        if (pendingItemVoids && pendingItemVoids.length > 0) {
            const requesterIds = Array.from(new Set(
                pendingItemVoids.map((row: any) => row.requested_by).filter(Boolean)
            ));
            let nameById = new Map<string, string>();
            if (requesterIds.length) {
                const { data: requesters } = await supabase
                    .from('users')
                    .select('id, email, first_name, last_name')
                    .in('id', requesterIds);
                nameById = new Map((requesters || []).map((user: any) => [
                    String(user.id),
                    `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Unknown'
                ]));
            }

            const unresolvedDescriptions = pendingItemVoids.map((row: any) =>
                `${row.order_number || 'Bill'}: ${row.item_name} x${row.qty_to_void} (requested by ${nameById.get(String(row.requested_by)) || 'Unknown'})`
            );

            notificationService.notifyRole(
                'branch_accountant',
                'Shift close blocked by pending void requests',
                `Shift ${id} cannot close — ${pendingItemVoids.length} void request(s) pending. Resolve to allow close.`,
                {
                    type: 'warning',
                    category: 'pos_item_void_request',
                    priority: 'high',
                    branchId: shift.branch_id,
                    metadata: { shift_id: id, pending_request_ids: pendingItemVoids.map((row: any) => row.id) }
                }
            ).catch((e: any) => logger.error('Failed to notify branch accountant of pending item voids blocking shift close', e));

            throw new AppError(
                `Cannot close shift: ${pendingItemVoids.length} pending item void request(s) must be resolved first. ${unresolvedDescriptions.join('; ')}`,
                400
            );
        }

        // Get all transactions for this shift. Older cashier payments were not
        // always linked by shift_id, so fall back to cashier/branch/time window.
        const transactions = await loadCashierTransactionsForShift(shift);

        // Calculate totals
        const total_cash = transactions?.filter(t => normalizeLogbookPaymentMethod(t.payment_method) === 'cash')
            .reduce((sum, t) => sum + logbookNumber(t.amount), 0) || 0;
        const total_cash_tendered = transactions?.filter(t => normalizeLogbookPaymentMethod(t.payment_method) === 'cash')
            .reduce((sum, t) => sum + logbookNumber(t.amount_tendered), 0) || 0;
        const total_change_given = transactions?.filter(t => normalizeLogbookPaymentMethod(t.payment_method) === 'cash')
            .reduce((sum, t) => sum + logbookNumber(t.change_given), 0) || 0;

        const total_mpesa = transactions?.filter(t => normalizeLogbookPaymentMethod(t.payment_method) === 'mpesa')
            .reduce((sum, t) => sum + logbookNumber(t.amount), 0) || 0;

        const total_card = transactions?.filter(t => normalizeLogbookPaymentMethod(t.payment_method) === 'card')
            .reduce((sum, t) => sum + logbookNumber(t.amount), 0) || 0;

        const total_revenue = transactions?.reduce((sum, t) => sum + logbookNumber(t.amount), 0) || 0;

        const expected_cash = shift.opening_float + total_cash;
        const actualCashWasProvided = actual_cash !== undefined && actual_cash !== null && actual_cash !== '';
        const actualCashCounted = actualCashWasProvided ? Number(actual_cash) : expected_cash;
        if (!Number.isFinite(actualCashCounted) || actualCashCounted < 0) {
            throw new AppError('Actual cash must be a valid non-negative number', 400);
        }
        const closingFloatValue = closing_float !== undefined && closing_float !== null && closing_float !== ''
            ? Number(closing_float)
            : expected_cash;
        const cash_variance = actualCashCounted - expected_cash;

        // Update shift
        const { data, error } = await supabase
            .from('cashier_shifts')
            .update({
                end_time: new Date().toISOString(),
                closing_float: closingFloatValue,
                expected_cash,
                actual_cash: actualCashCounted,
                cash_variance,
                total_transactions: transactions?.length || 0,
                total_cash_in: total_cash,
                total_mpesa_in: total_mpesa,
                total_card_in: total_card,
                total_revenue,
                remarks,
                status: 'closed'
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Trigger automatic migration of unpaid bills for this branch
        try {
            await migratePendingBills(shift.branch_id);
        } catch (migErr) {
            logger.error(`Error triggering pending bills migration on shift close:`, migErr);
            // Don't fail the whole request if migration fails
        }

        // Check for unresolved kitchen variances for this shift/date
        // Variance is unresolved if variance != 0 and reason_id is null
        const { data: unresolvedVariances } = await supabase
            .from('kitchen_daily_variance')
            .select('*')
            .eq('branch_id', shift.branch_id)
            .eq('variance_date', shift.shift_date)
            .is('reason_id', null)
            .neq('variance', 0);

        if (unresolvedVariances && unresolvedVariances.length > 0) {
            automationWarnings.push(`${unresolvedVariances.length} kitchen variance item(s) still need operational review.`);
        }

        try {
            const logDate = shift.shift_date || new Date().toISOString().slice(0, 10);
            const { data: existingLogbook } = await supabase
                .from('cashier_logbooks')
                .select('id')
                .eq('cashier_shift_id', id)
                .maybeSingle();

            const logbookPayload = {
                branch_id: shift.branch_id,
                cashier_id: shift.cashier_id,
                type: 'cashier',
                log_date: logDate,
                opening_float: shift.opening_float || 0,
                closing_float: closingFloatValue,
                sales_breakdown: {
                    total_cash,
                    total_cash_tendered,
                    total_change_given,
                    drawer_cash_in: total_cash,
                    expected_cash,
                    total_mpesa,
                    total_card,
                    total_revenue,
                    transactions: transactions?.length || 0,
                    source: 'cashier_shift_close'
                },
                total_mpesa,
                total_swipe: total_card,
                notes: remarks || 'Generated automatically by Lina at cashier shift close.',
                status: 'pending_accountant_review',
                source: 'lina_shift_automation',
                cashier_shift_id: id,
                submitted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const logbookResult = existingLogbook?.id
                ? await supabase
                    .from('cashier_logbooks')
                    .update(logbookPayload)
                    .eq('id', existingLogbook.id)
                    .select('*')
                    .single()
                : await supabase
                    .from('cashier_logbooks')
                    .insert(logbookPayload)
                    .select('*')
                    .single();

            if (logbookResult.error) throw logbookResult.error;
            const logbook = logbookResult.data;

            await supabase
                .from('cashier_logbook_lines')
                .delete()
                .eq('logbook_id', logbook.id)
                .eq('source_table', 'cashier_transactions');

            const lines = (transactions || []).map((transaction: any) => ({
                logbook_id: logbook.id,
                section: 'paid_bill',
                customer_name: transaction.customer_name || transaction.description || transaction.reference || 'Cashier transaction',
                amount: Number(transaction.amount || 0),
                reference: transaction.reference || transaction.id,
                source_table: 'cashier_transactions',
                source_id: transaction.id,
                payment_method: transaction.payment_method || null
            }));

            if (lines.length) {
                const { error: linesError } = await supabase
                    .from('cashier_logbook_lines')
                    .insert(lines);
                if (linesError) throw linesError;
            }

            notificationService.notifyRole(
                'branch_accountant',
                'Cashier shift logbook ready for review',
                `Lina generated a cashier shift logbook for ${logDate}.`,
                {
                    type: 'info',
                    category: 'cashier_logbook',
                    priority: 'high',
                    branchId: shift.branch_id,
                    metadata: { logbook_id: logbook.id, cashier_shift_id: id }
                }
            ).catch(e => logger.error('Failed to notify branch accountant of generated cashier logbook', e));
        } catch (logbookError) {
            logger.error('Failed to generate cashier shift logbook automatically:', logbookError);
            automationWarnings.push('Shift closed, but automatic logbook generation failed. Please review cashier logbooks.');
        }

        res.json({
            success: true,
            message: automationWarnings.length
                ? 'Shift closed with automation warnings'
                : 'Shift closed and logbook generated successfully',
            data: {
                ...data,
                automation_warnings: automationWarnings
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get cashier dashboard statistics
 */
export const getCashierStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id } = req.query;
        const today = new Date().toISOString().split('T')[0];

        const isGlobal = isGlobalRole(req.user?.role);
        const effectiveBranchId = isGlobal && branch_id ? parseInt(branch_id as string) : req.user?.branch_id;

        // Get today's transactions
        let txQuery = supabase
            .from('cashier_transactions')
            .select('*')
            .gte('transaction_date', today);
        if (effectiveBranchId) txQuery = txQuery.eq('branch_id', effectiveBranchId);
        const { data: transactions } = await txQuery;

        // Get unpaid bills
        let unpaidQuery = supabase
            .from('unpaid_bills')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'unpaid');
        if (effectiveBranchId) unpaidQuery = unpaidQuery.eq('branch_id', effectiveBranchId);
        const { count: unpaidCount } = await unpaidQuery;

        // Get pending credit bills
        let creditQuery = supabase
            .from('credit_bills')
            .select('*', { count: 'exact', head: true })
            .eq('approval_status', 'pending');
        if (effectiveBranchId) creditQuery = creditQuery.eq('branch_id', effectiveBranchId);
        const { count: pendingCreditsCount } = await creditQuery;

        // Get active shift
        const { data: activeShift } = await supabase
            .from('cashier_shifts')
            .select('*')
            .eq('cashier_id', req.user?.id)
            .eq('status', 'open')
            .single();

        const todayRevenue = transactions?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;

        // Get revenue breakdown by type
        const revenueByType: Record<string, number> = {};
        transactions?.forEach(t => {
            const type = t.revenue_type || 'other';
            revenueByType[type] = (revenueByType[type] || 0) + parseFloat(t.amount);
        });

        res.json({
            success: true,
            message: 'Cashier statistics retrieved successfully',
            data: {
                todayTransactions: transactions?.length || 0,
                todayRevenue,
                revenueBreakdown: revenueByType,
                unpaidBills: unpaidCount || 0,
                pendingCreditApprovals: pendingCreditsCount || 0,
                activeShift
            }
        });
    } catch (error) {
        next(error);
    }
};

// ============================================
// CASHIER LOGBOOK
// ============================================

/**
 * Get today's logbook for a specific type (reception/bar)
 */
export const getCashierLogbookToday = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { type } = req.query;
        const branch_id = req.headers['x-branch-id'];

        const isGlobal = isGlobalRole(req.user?.role);
        const effectiveBranchId = isGlobal && branch_id ? branch_id : req.user?.branch_id;

        if (!type || !effectiveBranchId) {
            throw new AppError('Type and Branch ID are required', 400);
        }

        const today = new Date().toISOString().split('T')[0];

        // 1. Try to fetch existing logbook for today
        const { data: logbook, error: fetchError } = await supabase
            .from('cashier_logbooks')
            .select(`
                *,
                credit_bills:cashier_logbook_lines(*),
                unpaid_bills:cashier_logbook_lines(*),
                paid_bills:cashier_logbook_lines(*)
            `)
            .eq('branch_id', effectiveBranchId)
            .eq('type', type)
            .eq('log_date', today)
            .single();

        if (logbook) {
            // Filter lines by section (the nested select above gets all lines for all 3 aliases if not filtered)
            // Actually supabase nested select doesn't filter by sub-criteria easily without JS filtering here
            const allLines = logbook.credit_bills || [];
            res.json({
                success: true,
                data: {
                    ...logbook,
                    credit_bills: allLines.filter((l: any) => l.section === 'credit_bill'),
                    unpaid_bills: allLines.filter((l: any) => l.section === 'unpaid_bill'),
                    paid_bills: allLines.filter((l: any) => l.section === 'paid_bill')
                }
            });
            return;
        }

        // 2. If not found, calculate initial data from today's transactions
        // Get total sales, mpesa, swipe for today's transactions in this branch/type
        // Note: For 'bar' type, we look at bar-related transactions. For 'reception', hotel-related.
        // For simplicity now, we aggregate by branch and optionally type if transactions are tagged.
        const { data: stats, error: statsError } = await supabase
            .from('cashier_transactions')
            .select('amount, payment_method')
            .eq('branch_id', effectiveBranchId)
            .gte('created_at', `${today}T00:00:00Z`)
            .lte('created_at', `${today}T23:59:59Z`);

        const sales_breakdown: Record<string, number> = {};
        let total_mpesa = 0;
        let total_swipe = 0;

        stats?.forEach(tx => {
            if (tx.payment_method?.toLowerCase() === 'mpesa') total_mpesa += Number(tx.amount);
            if (tx.payment_method?.toLowerCase() === 'swipe' || tx.payment_method?.toLowerCase() === 'card') total_swipe += Number(tx.amount);
        });

        res.json({
            success: true,
            data: {
                opening_float: 0,
                closing_float: 0,
                sales_breakdown,
                total_mpesa,
                total_swipe,
                notes: '',
                credit_bills: [],
                unpaid_bills: [],
                paid_bills: []
            }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Save or Update cashier logbook
 */
export const saveCashierLogbook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const {
            id, type, opening_float, closing_float, sales_breakdown,
            total_mpesa, total_swipe, notes, status,
            credit_bills, unpaid_bills, paid_bills
        } = req.body;
        const branch_id = req.headers['x-branch-id'];
        const cashier_id = req.user?.id;

        if (!type || !branch_id || !cashier_id) {
            throw new AppError('Type, Branch ID and Cashier are required', 400);
        }

        const today = new Date().toISOString().split('T')[0];
        const normalizedStatus = normalizeCashierLogbookStatus(status, 'open');

        // If updating existing logbook, check if it's approved
        if (id) {
            const { data: existing, error: checkError } = await supabase
                .from('cashier_logbooks')
                .select('status')
                .eq('id', id)
                .single();

            if (checkError) throw checkError;

            if (existing?.status === 'approved') {
                throw new AppError('Cannot edit an approved logbook', 403);
            }
        }

        // 1. Upsert the main logbook record
        const { data: logbook, error: logbookError } = await supabase
            .from('cashier_logbooks')
            .upsert({
                id: id || undefined,
                branch_id,
                cashier_id,
                type,
                log_date: today,
                opening_float,
                closing_float,
                sales_breakdown,
                total_mpesa,
                total_swipe,
                notes,
                status: normalizedStatus,
                ...(normalizedStatus === 'pending_audit' || normalizedStatus === 'pending_accountant_review'
                    ? { submitted_at: new Date().toISOString() }
                    : {}),
                updated_at: new Date()
            })
            .select()
            .single();

        if (logbookError) throw logbookError;

        // 2. Clear and recreate lines (simple replacement strategy)
        if (logbook.id) {
            const { error } = await supabase.from('cashier_logbook_lines').delete().eq('logbook_id', logbook.id);
            if (error) {
              console.error('Database error:', error);
              throw error;
            }

            const allLines = [
                ...(credit_bills || []).map((l: any) => ({ ...l, logbook_id: logbook.id, section: 'credit_bill' })),
                ...(unpaid_bills || []).map((l: any) => ({ ...l, logbook_id: logbook.id, section: 'unpaid_bill' })),
                ...(paid_bills || []).map((l: any) => ({ ...l, logbook_id: logbook.id, section: 'paid_bill' }))
            ].map(({ id, ...line }) => line); // Remove temp IDs if any

            if (allLines.length > 0) {
                const { error: linesError } = await supabase
                    .from('cashier_logbook_lines')
                    .insert(allLines);
                if (linesError) throw linesError;
            }

            // 3. Sync Credit Bills to 'staff_credit_bills' for Payroll
            // We want to ensure these are recorded in the payroll system
            if (credit_bills && Array.isArray(credit_bills)) {
                for (const bill of credit_bills) {
                    if (bill.staff_id && Number(bill.amount) > 0) {
                        try {
                            // Link to source logbook to allow payroll to check if logbook is approved/reconciled
                            const { data: existing } = await supabase
                                .from('staff_credit_bills')
                                .select('id')
                                .eq('staff_id', bill.staff_id)
                                .eq('bill_date', today)
                                .eq('amount', bill.amount)
                                .eq('source_logbook_id', logbook.id)
                                .maybeSingle();

                            if (!existing) {
                                const { error } = await supabase.from('staff_credit_bills').insert({
                                    staff_id: bill.staff_id,
                                    amount: bill.amount,
                                    paid_amount: 0,
                                    balance: bill.amount,
                                    bill_date: today,
                                    description: `Cashier Logbook Credit (${type}): ${bill.customer_name || 'Staff'} - ${bill.reference || 'No Ref'}`,
                                    status: 'pending',
                                    source_logbook_id: logbook.id
                                });

                                if (error) {

                                  console.error('Database error:', error);

                                  throw error;

                                }
                            }
                        } catch (err) {
                            console.error('Failed to sync credit bill to payroll:', err);
                        }
                    }
                }
            }
        }

        res.json({
            success: true,
            message: 'Logbook saved successfully',
            data: logbook
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Submit cashier logbook for audit
 */
export const submitLogbookForAudit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const cashier_id = req.user?.id;

        if (!id || !cashier_id) {
            throw new AppError('Logbook ID and Cashier ID are required', 400);
        }

        // Verify the logbook belongs to the cashier
        const { data: logbook, error: fetchError } = await supabase
            .from('cashier_logbooks')
            .select('*')
            .eq('id', id)
            .eq('cashier_id', cashier_id)
            .single();

        if (fetchError || !logbook) {
            throw new AppError('Logbook not found or access denied', 404);
        }

        if (logbook.status === 'pending_audit' || logbook.status === 'pending_accountant_review') {
            res.json({
                success: true,
                message: 'Logbook already submitted for review',
                data: logbook
            });
            return;
        }

        if (logbook.status !== 'open') {
            throw new AppError('Only open logbooks can be submitted for audit', 400);
        }

        // Logbooks first land with the branch accountant for review; the
        // auditor only sees them once the accountant approves (see
        // auditLogbook below), so the initial status must be
        // pending_accountant_review, not pending_audit.
        const { data: updated, error: updateError } = await supabase
            .from('cashier_logbooks')
            .update({
                status: 'pending_accountant_review',
                submitted_at: new Date(),
                updated_at: new Date()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Notify Accountant — scoped to the cashier's branch
        const cashierBranchId = req.user?.branch_id;
        const notificationData = {
            type: 'warning' as const,
            category: 'audit',
            priority: 'medium' as const,
            branchId: cashierBranchId,
            actionUrl: `/dashboard/auditor/financial-verification`,
            metadata: { logbook_id: id, type: 'cashier_logbook', cashier_id }
        };

        notificationService.notifyRole('branch_accountant', 'Cashier Logbook Submission', `Cashier logbook for ${logbook.type} has been submitted for review.`, notificationData)
            .catch(e => logger.error('Failed to notify accountant of logbook submission', e));

        res.json({
            success: true,
            message: 'Logbook submitted for audit successfully',
            data: updated
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Get logbooks pending audit (for auditors)
 */
export const getLogbooksForAudit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const branch_id = req.query.branch_id || req.headers['x-branch-id'];
        const requestedStatus = req.query.status as string | undefined;
        const reviewerRole = String(req.user?.role || '').toLowerCase();
        const defaultStatus = ['branch_accountant', 'accountant'].includes(reviewerRole)
            ? 'pending_accountant_review'
            : 'pending_audit';
        // status=all returns full logbook history across every status
        // (open, pending review/audit, audited, rejected, etc.) instead of
        // just the reviewer's pending queue.
        const status = requestedStatus || defaultStatus;
        // date_from/date_to accepted as aliases for from_date/to_date.
        const from_date = req.query.from_date || req.query.date_from;
        const to_date = req.query.to_date || req.query.date_to;
        const { cashier_id } = req.query;

        // NOTE: branch is hydrated separately below — there is no FK relationship
        // between cashier_logbooks and branches in PostgREST's schema cache, so an
        // embedded branches(...) join 500s ("Could not find a relationship...").
        let query = supabase
            .from('cashier_logbooks')
            .select('*')
            .order('log_date', { ascending: false });

        if (status !== 'all') {
            query = query.eq('status', status);
        }

        query = applyBranchFilter(query, req);
        const isGlobal = isGlobalRole(req.user?.role);

        if (branch_id) {
            const requestedBranchId = Number(Array.isArray(branch_id) ? branch_id[0] : branch_id);
            const userBranchId = Number(req.user?.branch_id ?? req.user?.branchId);
            if (Number.isFinite(requestedBranchId) && (isGlobal || requestedBranchId === userBranchId)) {
                query = query.eq('branch_id', requestedBranchId);
            }
        }

        if (cashier_id) {
            query = query.eq('cashier_id', cashier_id);
        }

        if (from_date) {
            query = query.gte('log_date', from_date);
        }

        if (to_date) {
            query = query.lte('log_date', to_date);
        }

        const { data: logbooks, error } = await query;

        if (error) throw error;

        const usersById = await fetchCashierUsersById((logbooks || []).map((logbook: any) => logbook.cashier_id));
        const logbookIds = [...new Set((logbooks || [])
            .map((logbook: any) => String(logbook.id || '').trim())
            .filter(Boolean))];
        const linesByLogbookId = new Map<string, any[]>();
        if (logbookIds.length) {
            const { data: lineRows, error: lineError } = await supabase
                .from('cashier_logbook_lines')
                .select('id, logbook_id, section, customer_name, amount, reference')
                .in('logbook_id', logbookIds);

            if (lineError) throw lineError;

            for (const line of (lineRows || []) as Array<Record<string, any>>) {
                const logbookId = String(line.logbook_id || '');
                if (!logbookId) continue;
                const bucket = linesByLogbookId.get(logbookId) || [];
                bucket.push(line);
                linesByLogbookId.set(logbookId, bucket);
            }
        }

        // Hydrate branch names separately (no FK relationship in schema cache).
        const branchIds = [...new Set((logbooks || [])
            .map((logbook: any) => logbook.branch_id)
            .filter((id: any) => id !== null && id !== undefined))];
        const branchById = new Map<string, any>();
        if (branchIds.length) {
            const { data: branchRows } = await supabase
                .from('branches')
                .select('id, name')
                .in('id', branchIds as any[]);
            for (const b of (branchRows || []) as Array<Record<string, any>>) {
                branchById.set(String(b.id), { id: b.id, name: b.name });
            }
        }

        const decoratedLogbooks = (logbooks || []).map((logbook: any) => {
            // cashier_logbooks has no variance/expected-closing columns — the
            // true figures are written into sales_breakdown at shift close.
            // Surface them top-level because clients render logbook.variance
            // directly (the accountant's logbook table showed KES 0 for every
            // shift otherwise).
            const breakdown = logbook.sales_breakdown && typeof logbook.sales_breakdown === 'object'
                ? logbook.sales_breakdown
                : {};
            // Build a synthetic payment_breakdown so the Flutter list view can
            // show Cash/MPESA badges without a separate detail fetch.
            const cashAmt = logbookNumber(logbook.total_cash) || logbookNumber(breakdown.total_cash);
            const mpesaAmt = logbookNumber(logbook.total_mpesa) || logbookNumber(breakdown.total_mpesa);
            const cardAmt = logbookNumber(logbook.total_swipe) || logbookNumber(breakdown.total_card);
            const syntheticPaymentBreakdown = [
                { method: 'cash', amount: cashAmt, count: 0 },
                { method: 'mpesa', amount: mpesaAmt, count: 0 },
                { method: 'card', amount: cardAmt, count: 0 },
            ].filter(r => r.amount > 0);

            return {
                ...logbook,
                variance: logbookNumber(breakdown.variance),
                expected_closing_float: logbookNumber(breakdown.expected_closing_float),
                total_sales: logbookNumber(logbook.total_sales) || logbookNumber(breakdown.total_sales),
                total_cash: cashAmt,
                total_mpesa: mpesaAmt,
                total_card: cardAmt,
                payment_breakdown: syntheticPaymentBreakdown,
                lines: linesByLogbookId.get(String(logbook.id || '')) || [],
                cashier: usersById.get(String(logbook.cashier_id || '')) || null,
                branch: branchById.get(String(logbook.branch_id || '')) || null
            };
        });

        res.json({
            success: true,
            data: decoratedLogbooks
        });

    } catch (error) {
        next(error);
    }
};

function logbookNumber(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCashierLogbookStatus(value: unknown, fallback = 'open'): string {
    const status = String(value || '').trim().toLowerCase();
    switch (status) {
        case '':
            return fallback;
        case 'draft':
            return 'open';
        case 'submitted':
        case 'pending':
        case 'submitted_for_audit':
            return 'pending_audit';
        case 'submitted_to_accountant':
        case 'accountant_review':
            return 'pending_accountant_review';
        case 'open':
        case 'closed':
        case 'pending_accountant_review':
        case 'pending_audit':
        case 'approved':
        case 'rejected':
            return status;
        default:
            return fallback;
    }
}

function logbookText(value: unknown, fallback = ''): string {
    const text = value === null || value === undefined ? '' : String(value).trim();
    return text || fallback;
}

function logbookMoney(value: unknown): string {
    return `KES ${logbookNumber(value).toLocaleString('en-KE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function normalizeLogbookPaymentMethod(method: unknown): string {
    const normalized = String(method || '').toLowerCase().replace(/[\s_-]/g, '');
    if (normalized.includes('mpesa')) return 'mpesa';
    if (normalized.includes('card') || normalized.includes('swipe')) return 'card';
    if (normalized.includes('credit')) return 'credit_bill';
    if (normalized.includes('bank')) return 'bank';
    if (normalized.includes('cash')) return 'cash';
    return normalized || 'other';
}

function addAmount(bucket: Record<string, number>, key: string, amount: unknown): void {
    const normalized = normalizeLogbookPaymentMethod(key);
    bucket[normalized] = logbookNumber(bucket[normalized]) + logbookNumber(amount);
}

function revenueBucketKey(value: unknown): 'restaurant' | 'bar' | 'rooms' | 'conference' | 'pool' | 'other' | null {
    const normalized = String(value || '').toLowerCase().replace(/[\s-]/g, '_');
    if (!normalized) return null;
    if (normalized.includes('restaurant') || normalized.includes('food')) return 'restaurant';
    if (
        normalized.includes('bar')
        || normalized.includes('beverage')
        || normalized.includes('drink')
        || normalized.includes('pos_sale')
        || normalized.includes('pos')
    ) return 'bar';
    if (
        normalized.includes('room')
        || normalized.includes('accommodation')
        || normalized.includes('lodging')
        || normalized.includes('booking')
    ) return 'rooms';
    if (
        normalized.includes('conference')
        || normalized.includes('banquet')
        || normalized.includes('meeting')
        || normalized.includes('event')
    ) return 'conference';
    if (
        normalized.includes('pool')
        || normalized.includes('swimming')
        || normalized.includes('token')
        || normalized.includes('spa')
    ) return 'pool';
    if (
        normalized.includes('invoice')
        || normalized.includes('credit')
        || normalized.includes('other')
    ) return 'other';
    return null;
}

function inferRevenueBucket(line: any): 'restaurant' | 'bar' | 'rooms' | 'conference' | 'pool' | 'other' | null {
    return revenueBucketKey(
        line?.revenue_bucket
        ?? line?.revenue_type
        ?? line?.outlet_type
        ?? line?.reference_type
        ?? line?.source_table
        ?? line?.section
    );
}

async function safeLogbookQuery(label: string, query: any): Promise<any[]> {
    const { data, error } = await query;
    if (error) {
        logger.warn(`Cashier logbook detail ${label} query failed`, {
            code: error.code,
            message: error.message
        });
        return [];
    }
    return data || [];
}

function normalizeLogbookLine(line: any, fallbackSection = 'transaction'): any {
    const amount = logbookNumber(line?.amount ?? line?.total_amount ?? line?.total ?? line?.paid_amount);
    const amountTendered = logbookNumber(line?.amount_tendered ?? line?.cash_tendered);
    const changeGiven = logbookNumber(line?.change_given ?? line?.cash_change);
    const fallbackSourceTable = fallbackSection === 'cashier_shift_transaction'
        ? 'cashier_shift_transactions'
        : fallbackSection === 'cashier_transaction'
            ? 'cashier_transactions'
            : fallbackSection === 'outlet_payment'
                ? 'pos_shift_payments'
                : fallbackSection === 'outlet_order'
                    ? 'pos_shift_orders'
                    : null;
    return {
        id: line?.id || line?.source_id || null,
        section: logbookText(line?.section, fallbackSection),
        reference: logbookText(
            line?.reference
                ?? line?.transaction_ref
                ?? line?.transaction_reference
                ?? line?.order_number
                ?? line?.short_code
                ?? line?.transaction_id,
            'Linked record'
        ),
        customer_name: logbookText(
            line?.customer_name
                ?? line?.guest_name
                ?? line?.staff_name
                ?? line?.description
                ?? line?.source
                ?? line?.section,
            fallbackSection === 'cashier_shift_transaction' ? 'Cashier cleared payment' : 'Walk-in customer'
        ),
        payment_method: normalizeLogbookPaymentMethod(line?.payment_method ?? line?.method ?? line?.type),
        amount,
        amount_tendered: amountTendered,
        change_given: changeGiven,
        drawer_cash_in: amountTendered > 0 ? Math.max(0, amountTendered - changeGiven) : amount,
        status: logbookText(line?.status ?? line?.payment_status, 'recorded'),
        created_at: line?.transaction_time || line?.transaction_date || line?.paid_at || line?.created_at || null,
        source_table: line?.source_table || fallbackSourceTable,
        source_id: line?.source_id || line?.id || null,
        reference_type: line?.reference_type || null,
        revenue_type: line?.revenue_type || null,
        outlet_type: line?.outlet_type || null,
        revenue_bucket: inferRevenueBucket(line),
        void_type: line?.void_type || null,
        void_reason: line?.void_reason || null,
        voided_by: line?.voided_by || null,
        voided_by_name: line?.voided_by_name || null
    };
}

function dedupeLogbookLines(lines: any[]): any[] {
    const unique: any[] = [];

    // Helper to clean references
    const cleanRef = (ref: string) => {
        if (!ref) return '';
        let r = ref.trim().toLowerCase();
        if (r === 'linked record' || r === '—' || r === '-' || r === 'recorded' || r === 'paid') return '';
        // remove common prefixes
        r = r.replace(/^(cash|mpesa|card|pos|order|ref)[\s\-_:]*/, '');
        return r;
    };

    const mergeFields = (existingLine: any, duplicateLine: any) => {
        if (!existingLine.revenue_bucket && duplicateLine.revenue_bucket) {
            existingLine.revenue_bucket = duplicateLine.revenue_bucket;
        }
        if (!existingLine.revenue_type && duplicateLine.revenue_type) {
            existingLine.revenue_type = duplicateLine.revenue_type;
        }
        if (!existingLine.outlet_type && duplicateLine.outlet_type) {
            existingLine.outlet_type = duplicateLine.outlet_type;
        }
        if (!existingLine.customer_name || existingLine.customer_name === 'Walk-in customer') {
            if (duplicateLine.customer_name && duplicateLine.customer_name !== 'Walk-in customer') {
                existingLine.customer_name = duplicateLine.customer_name;
            }
        }
        if (existingLine.reference === 'Linked record' && duplicateLine.reference && duplicateLine.reference !== 'Linked record') {
            existingLine.reference = duplicateLine.reference;
        }
    };

    for (const line of lines) {
        let isDup = false;
        for (const existing of unique) {
            // Check if they point to the exact same source database record
            if (line.source_table && line.source_id &&
                line.source_table === existing.source_table &&
                line.source_id === existing.source_id) {
                isDup = true;
                mergeFields(existing, line);
                break;
            }

            // Compare amount and payment method
            const amtDiff = Math.abs(logbookNumber(line.amount) - logbookNumber(existing.amount));
            const methodLine = normalizeLogbookPaymentMethod(line.payment_method);
            const methodExisting = normalizeLogbookPaymentMethod(existing.payment_method);
            if (amtDiff <= 0.01 && methodLine === methodExisting) {
                const refLine = cleanRef(line.reference);
                const refExisting = cleanRef(existing.reference);

                if (refLine && refExisting) {
                    if (refLine === refExisting) {
                        isDup = true;
                        mergeFields(existing, line);
                        break;
                    }
                } else {
                    const timeLine = new Date(line.created_at || 0).getTime();
                    const timeExisting = new Date(existing.created_at || 0).getTime();
                    if (!isNaN(timeLine) && !isNaN(timeExisting)) {
                        const diffSec = Math.abs(timeLine - timeExisting) / 1000;
                        if (diffSec <= 15) {
                            isDup = true;
                            mergeFields(existing, line);
                            // If the existing line doesn't have a clean reference, but the new one does,
                            // update the existing line to have the cleaner reference so it is preserved.
                            if (!refExisting && refLine) {
                                existing.reference = line.reference;
                            }
                            break;
                        }
                    }
                }
            }
        }
        if (!isDup) {
            unique.push(line);
        }
    }

    return unique;
}

function isVoidedLogbookLine(line: any): boolean {
    return /void|cancel/i.test(`${line?.status || ''} ${line?.section || ''}`);
}

async function buildCashierLogbookDetail(req: Request, id: string): Promise<any> {
    let query = supabase
        .from('cashier_logbooks')
        .select('*')
        .eq('id', id);

    query = applyBranchFilter(query, req);

    const { data: logbook, error } = await query.maybeSingle();
    if (error) throw error;
    if (!logbook) throw new AppError('Cashier logbook not found', 404);

    const [cashier] = (await fetchCashierUsersById([logbook.cashier_id])).values();
    const breakdown = logbook.sales_breakdown && typeof logbook.sales_breakdown === 'object'
        ? logbook.sales_breakdown
        : {};
    const branchResult = logbook.branch_id
        ? await supabase.from('branches').select('id, name, code').eq('id', logbook.branch_id).maybeSingle()
        : { data: null, error: null };
    if (branchResult.error) throw branchResult.error;
    const branch = branchResult.data;
    const storedRawLines = await safeLogbookQuery(
        'cashier_logbook_lines',
        supabase
            .from('cashier_logbook_lines')
            .select('*')
            .eq('logbook_id', logbook.id)
            .order('created_at', { ascending: true })
    );

    let shift: any = null;
    let outletShift: any = null;
    let shiftTransactions: any[] = [];
    let cashierTransactions: any[] = [];
    let restaurantOrders: any[] = [];
    let barOrders: any[] = [];
    let outletOrders: any[] = [];
    let outletPayments: any[] = [];
    let creditBillRecords: any[] = [];
    let shiftActualCollections: any[] = [];
    let voidAudit = {
        lines: [] as any[],
        summary: {
            total_void_amount: 0,
            total_void_count: 0,
            whole_bill_void_amount: 0,
            whole_bill_void_count: 0,
            item_void_amount: 0,
            item_void_count: 0,
            payment_void_amount: 0,
            payment_void_count: 0
        }
    };

    if (logbook.cashier_shift_id) {
        const shiftResult = await supabase
            .from('cashier_shift_logs')
            .select('*')
            .eq('id', logbook.cashier_shift_id)
            .maybeSingle();
        if (shiftResult.error) throw shiftResult.error;
        shift = shiftResult.data;

        shiftActualCollections = await safeLogbookQuery(
            'shift_actual_collections',
            supabase
                .from('shift_actual_collections')
                .select('*')
                .eq('shift_id', logbook.cashier_shift_id)
                .order('payment_method', { ascending: true })
        );

        shiftTransactions = await safeLogbookQuery(
            'cashier_shift_transactions',
            supabase
                .from('cashier_shift_transactions')
                .select('*')
                .eq('shift_id', logbook.cashier_shift_id)
                .order('transaction_time', { ascending: true })
        );

        if (shift?.branch_id && shift?.cashier_id && shift?.shift_start) {
            const startedAt = shift.shift_start;
            const endedAt = shift.shift_end || new Date().toISOString();

            cashierTransactions = await safeLogbookQuery(
                'cashier_transactions',
                supabase
                    .from('cashier_transactions')
                    .select('*')
                    .eq('branch_id', shift.branch_id)
                    .eq('cashier_id', shift.cashier_id)
                    .gte('created_at', startedAt)
                    .lte('created_at', endedAt)
                    .order('created_at', { ascending: true })
            );

            restaurantOrders = await safeLogbookQuery(
                'restaurant_orders',
                supabase
                    .from('restaurant_orders')
                    .select(`
                        id,
                        order_number,
                        short_code,
                        status,
                        payment_status,
                        guest_name,
                        total_amount,
                        amount_paid,
                        balance_amount,
                        created_at,
                        branch_id,
                        created_by,
                        table_number,
                        room_number
                    `)
                    .eq('branch_id', shift.branch_id)
                    .eq('created_by', shift.cashier_id)
                    .gte('created_at', startedAt)
                    .lte('created_at', endedAt)
                    .order('created_at', { ascending: true })
            );

            barOrders = await safeLogbookQuery(
                'bar_orders',
                supabase
                    .from('bar_orders')
                    .select('*')
                    .eq('branch_id', shift.branch_id)
                    .eq('created_by', shift.cashier_id)
                    .gte('created_at', startedAt)
                    .lte('created_at', endedAt)
                    .order('created_at', { ascending: true })
            );

            // Staff credit bills issued during this shift — fetched directly
            // from credit_bills so we get the real staff/customer name, amount,
            // department and status (not the generic cleared-line label).
            creditBillRecords = await safeLogbookQuery(
                'credit_bills',
                supabase
                    .from('credit_bills')
                    .select('*')
                    .eq('branch_id', shift.branch_id)
                    .gte('created_at', startedAt)
                    .lte('created_at', endedAt)
                    .order('created_at', { ascending: true })
            );

            voidAudit = await loadCashierVoidAudit({
                branchId: shift.branch_id,
                cashierId: shift.cashier_id,
                cashierShiftId: shift.id,
                shiftStart: startedAt,
                shiftEnd: endedAt
            });
        }
    }

    const outletShiftTypeMap = new Map<string, string>();
    let outletShiftIds: string[] = [];
    if (logbook.outlet_shift_id) {
        outletShiftIds.push(logbook.outlet_shift_id);
    } else if (shift && shift.cashier_id && shift.shift_start) {
        const startedAt = shift.shift_start;
        const endedAt = shift.shift_end || new Date().toISOString();
        const { data: matchedShifts } = await supabase
            .from('pos_outlet_shifts')
            .select('id')
            .eq('cashier_id', shift.cashier_id)
            .gte('opened_at', startedAt)
            .lte('opened_at', endedAt);
        if (matchedShifts && matchedShifts.length > 0) {
            outletShiftIds = matchedShifts.map((s: any) => s.id);
        }
    }

    if (outletShiftIds.length > 0) {
        const outletShiftsResult = await supabase
            .from('pos_outlet_shifts')
            .select('*, outlet:pos_outlets(id, name, outlet_type, branch_id)')
            .in('id', outletShiftIds);
        if (outletShiftsResult.error) throw outletShiftsResult.error;
        const outletShifts = outletShiftsResult.data || [];
        if (outletShifts.length > 0) {
            outletShift = outletShifts[0];
            outletShifts.forEach((s: any) => {
                const oType = Array.isArray(s.outlet) ? s.outlet[0]?.outlet_type : s.outlet?.outlet_type;
                if (oType) {
                    outletShiftTypeMap.set(s.id, oType);
                }
            });
        }

        const additionalOrders = await safeLogbookQuery(
            'pos_shift_orders',
            supabase
                .from('pos_shift_orders')
                .select('*')
                .in('shift_id', outletShiftIds)
                .order('created_at', { ascending: true })
        );
        outletOrders = [...outletOrders, ...additionalOrders];

        const additionalPayments = await safeLogbookQuery(
            'pos_shift_payments',
            supabase
                .from('pos_shift_payments')
                .select('*')
                .in('shift_id', outletShiftIds)
                .order('created_at', { ascending: true })
        );
        outletPayments = [...outletPayments, ...additionalPayments];
    }

    const getActiveOrderTotal = (order: any) => {
        const items = Array.isArray(order.items) ? order.items : [];
        return items.reduce((sum: number, item: any) => {
            if (
                item.is_voided === true ||
                item.is_cancelled === true ||
                item.kitchen_status === 'voided' ||
                item.kitchen_status === 'cancelled' ||
                item.is_fully_voided === true
            ) {
                return sum;
            }
            const quantity = Number(item.active_qty !== undefined ? item.active_qty : (item.quantity ?? item.qty ?? 0)) || 0;
            const unitPrice = Number(item.unit_price ?? item.selling_price ?? item.price ?? 0) || 0;
            const revenue = Number(item.active_total !== undefined ? item.active_total : (item.line_total ?? item.total_price ?? item.total ?? quantity * unitPrice)) || 0;
            return sum + revenue;
        }, 0);
    };

    const orderActiveTotals: Record<string, number> = {};
    const orderOriginalTotals: Record<string, number> = {};
    
    outletOrders.forEach((order: any) => {
        const activeTotal = getActiveOrderTotal(order);
        orderActiveTotals[order.id] = activeTotal;
        orderOriginalTotals[order.id] = Number(order.total_amount || 0);
        order.total_amount = activeTotal;
    });

    outletPayments.forEach((payment: any) => {
        const orderId = payment.order_id;
        const activeTotal = orderActiveTotals[orderId];
        const originalTotal = orderOriginalTotals[orderId];
        if (activeTotal !== undefined && originalTotal > 0) {
            payment.amount = (Number(payment.amount) * activeTotal) / originalTotal;
        } else if (activeTotal === 0) {
            payment.amount = 0;
        }
    });

    // Filter credit bills by cashier shift:
    // 1. If it has a source_document_id, resolve its order to see if it belongs to one of the cashier's POS outlet shifts.
    // 2. Otherwise, fall back to matching created_by = shift.cashier_id.
    const outletOrderIds = new Set((outletOrders || []).map((o: any) => o.id).filter(Boolean));
    const activeCashierId = shift?.cashier_id;
    creditBillRecords = (creditBillRecords || []).filter((bill: any) => {
        if (outletShiftIds.length > 0) {
            return bill.source_document_id ? outletOrderIds.has(bill.source_document_id) : false;
        }
        if (bill.source_document_id) {
            return outletOrderIds.has(bill.source_document_id);
        }
        return activeCashierId ? bill.created_by === activeCashierId : true;
    });

    const getShiftOutletType = (shiftId: string) => {
        const oType = outletShiftTypeMap.get(shiftId) || (Array.isArray(outletShift?.outlet) ? outletShift?.outlet[0]?.outlet_type : outletShift?.outlet?.outlet_type);
        return oType || logbook.type;
    };

    const storedLines = storedRawLines.map((line: any) => {
        const oType = line.outlet_shift_id ? getShiftOutletType(line.outlet_shift_id) : logbook.type;
        return normalizeLogbookLine({
            ...line,
            outlet_type: line.outlet_type || oType,
            revenue_type: line.revenue_type || line.outlet_type || oType
        }, 'logbook_line');
    });
    const generatedLines = [
        ...shiftTransactions.map((line) => normalizeLogbookLine(line, 'cashier_shift_transaction')),
        ...cashierTransactions.map((line) => normalizeLogbookLine(line, 'cashier_transaction')),
        ...restaurantOrders.map((line) => normalizeLogbookLine({
            ...line,
            amount: line.total_amount,
            section: 'restaurant_sale',
            customer_name: line.customer_name || line.guest_name || line.order_type
        })),
        ...barOrders.map((line) => normalizeLogbookLine({
            ...line,
            amount: line.total_amount ?? line.total,
            section: 'bar_sale',
            customer_name: line.customer_name || line.guest_name || line.order_type
        })),
        ...outletOrders.map((line) => {
            const oType = getShiftOutletType(line.shift_id);
            return normalizeLogbookLine({
                ...line,
                amount: line.total_amount,
                section: 'outlet_order',
                customer_name: line.customer_name || line.order_type,
                outlet_type: line.outlet_type || oType,
                revenue_type: line.order_type || line.outlet_type || oType
            });
        }),
        ...outletPayments.map((line) => {
            const oType = getShiftOutletType(line.shift_id);
            return normalizeLogbookLine({
                ...line,
                amount: line.amount,
                section: 'outlet_payment',
                customer_name: line.reference || line.payment_method,
                outlet_type: line.outlet_type || oType,
                revenue_type: line.revenue_type || line.outlet_type || oType
            });
        }),
        ...creditBillRecords.map((line) => normalizeLogbookLine({
            ...line,
            amount: line.total_amount ?? line.amount,
            section: 'credit_bill',
            payment_method: 'credit_bill',
            customer_name: line.staff_name || line.customer_name || line.employee_name || 'Credit Customer'
        })),
        ...voidAudit.lines.map((line) => normalizeLogbookLine(line, 'voided_transaction'))
    ];

    const orderSections = ['restaurant_sale', 'bar_sale', 'outlet_order'];
    const paymentLines = [...generatedLines, ...storedLines]
        .filter((line) => !orderSections.includes(line.section));
    const allLines = dedupeLogbookLines(paymentLines);
    const nonVoidLines = allLines.filter((line) => !isVoidedLogbookLine(line));
    const transactionHistory = [...allLines]
        .filter((line) => logbookNumber(line.amount) > 0)
        .sort((a, b) => {
            const left = new Date(a.created_at || 0).getTime();
            const right = new Date(b.created_at || 0).getTime();
            return left - right;
        });
    // Authoritative per-method totals from the cleared cashier payment lines
    // (cashier_transactions + cashier_shift_transactions). Order rows
    // (restaurant/bar) are NOT included here so the same sale isn't counted
    // twice (once as the order, once as its clearance).
    const clearedPaymentTotals: Record<string, number> = {};
    const clearedPaymentLines = nonVoidLines;
    clearedPaymentLines.forEach((line) => {
        if (logbookNumber(line.amount) > 0) addAmount(clearedPaymentTotals, line.payment_method, line.amount);
    });

    // Normalized staff credit bills (who the credit was for, and how much).
    const creditBills = creditBillRecords.map((bill: any) => ({
        id: bill.id,
        credit_number: bill.credit_number || bill.reference || null,
        staff_name: logbookText(bill.staff_name || bill.customer_name || bill.employee_name, 'Staff'),
        employee_id: bill.employee_id || null,
        department: bill.department || null,
        bill_type: bill.bill_type || 'credit_bill',
        amount: logbookNumber(bill.total_amount ?? bill.amount),
        balance: logbookNumber(bill.balance_amount ?? bill.balance ?? bill.total_amount ?? bill.amount),
        status: bill.status || bill.approval_status || 'active',
        created_at: bill.created_at || bill.credit_date || null
    }));
    const creditBillsTotal = creditBills.reduce((sum, b) => sum + logbookNumber(b.amount), 0);

    const allLinePaymentTotals: Record<string, number> = {};
    const saleSections = ['restaurant_sale', 'bar_sale', 'outlet_order'];
    nonVoidLines.forEach((line) => {
        if (!saleSections.includes(line.section) && logbookNumber(line.amount) > 0) {
            addAmount(allLinePaymentTotals, line.payment_method, line.amount);
        }
    });
    const outletOrderPaymentTotals: Record<string, number> = {};
    const voidedOrderIds = new Set<string>(
        outletOrders
            .filter((o: any) => {
                const s = String(o.status || '').toLowerCase();
                const p = String(o.payment_status || '').toLowerCase();
                return s === 'voided' || s === 'cancelled' || p === 'voided' || p === 'cancelled';
            })
            .map((o: any) => String(o.id))
    );
    const activeOutletOrders = outletOrders.filter((o: any) => !voidedOrderIds.has(String(o.id)));
    activeOutletOrders.forEach((line: any) => {
        const method = normalizeLogbookPaymentMethod(line.payment_method ?? line.payment_status);
        const amount = logbookNumber(line.total_amount ?? line.amount_paid ?? line.amount);
        if (amount > 0) addAmount(outletOrderPaymentTotals, method, amount);
    });

    const paymentRows = [
        ['cash', breakdown.total_cash ?? shift?.total_cash_sales],
        ['mpesa', breakdown.total_mpesa ?? logbook.total_mpesa ?? shift?.total_mpesa_sales],
        ['card', breakdown.total_card ?? logbook.total_swipe ?? shift?.total_card_sales],
        ['credit_bill', breakdown.total_credit_bill ?? shift?.credit_bills_taken],
        ['bank', breakdown.total_bank ?? shift?.total_bank_sales],
        ['other', breakdown.total_other ?? shift?.total_other_sales],
    ] as const;
    const payments = paymentRows.reduce<Record<string, number>>((acc, [method, explicit]) => {
        const explicitAmount = logbookNumber(explicit);
        const evidenceAmount =
            logbookNumber(clearedPaymentTotals[method])
            || logbookNumber(allLinePaymentTotals[method])
            || logbookNumber(outletOrderPaymentTotals[method]);
        if (outletShiftIds.length > 0) {
            if (method === 'credit_bill') {
                acc[method] = evidenceAmount || creditBillsTotal || explicitAmount;
            } else {
                acc[method] = evidenceAmount || explicitAmount;
            }
        } else {
            if (method === 'credit_bill') {
                acc[method] = creditBillsTotal || explicitAmount || evidenceAmount;
            } else {
                acc[method] = explicitAmount || evidenceAmount;
            }
        }
        return acc;
    }, {});

    const totalCash = logbookNumber(payments.cash);
    const totalMpesa = logbookNumber(payments.mpesa);
    const totalCard = logbookNumber(payments.card);
    const totalCreditBill = logbookNumber(payments.credit_bill);
    const totalBank = logbookNumber(payments.bank);
    const totalOther = logbookNumber(payments.other);
    const cashAuditLines = allLines.filter((line) => normalizeLogbookPaymentMethod(line.payment_method) === 'cash');
    const cashTenderedFromLines = cashAuditLines.reduce((sum, line) => sum + logbookNumber(line.amount_tendered), 0);
    const changeGivenFromLines = cashAuditLines.reduce((sum, line) => sum + logbookNumber(line.change_given), 0);
    const totalCashTendered = logbookNumber(breakdown.total_cash_tendered) || cashTenderedFromLines;
    const totalChangeGiven = logbookNumber(breakdown.total_change_given) || changeGivenFromLines;
    const evidenceTotalSales = totalCash + totalMpesa + totalCard + totalCreditBill + totalBank + totalOther;
    const netSales = Math.max(
        logbookNumber(breakdown.total_sales ?? shift?.total_sales),
        evidenceTotalSales
    );
    const grossSales = netSales + logbookNumber(voidAudit.summary.total_void_amount);
    const openingFloat = logbookNumber(logbook.opening_float ?? shift?.opening_float);
    const closingFloat = logbookNumber(logbook.closing_float ?? shift?.closing_float ?? shift?.cash_at_hand);
    const cashDrops = 0; // cash_deposited is not a cashier-declared deposit
    const payouts = logbookNumber(breakdown.payouts ?? breakdown.paid_outs);
    const expenseTotal = logbookNumber(breakdown.expense_total ?? shift?.expense_total);
    const creditPaymentsReceived = logbookNumber(breakdown.paid_bills_value ?? shift?.paid_bills_value);
    // For new-path logbooks (source: cashier_shift_logs) the shift row stores
    // expected_closing_float and variance using the correct formula at close time.
    // breakdown.total_cash is already net of cash expenses, so recomputing here
    // would double-subtract expenses. Use the stored shift values as the authority.
    const hasStoredExpected = shift != null && shift.expected_closing_float !== undefined && shift.expected_closing_float !== null;
    const hasStoredVariance = shift != null && shift.variance !== undefined && shift.variance !== null;
    // totalCash is NET (expenses already deducted). Fallback formula: opening + NET_cash + paid_credits.
    // Do NOT subtract expenseTotal — it is already absent from totalCash.
    const expectedCash = hasStoredExpected
        ? logbookNumber(shift.expected_closing_float)
        : (openingFloat + totalCash + creditPaymentsReceived);
    const variance = hasStoredVariance
        ? logbookNumber(shift.variance)
        : (closingFloat - expectedCash);

    const revenueEvidence: Record<string, number> = {
        restaurant: restaurantOrders.reduce((sum, line) => sum + logbookNumber(line.total_amount), 0),
        bar: barOrders.reduce((sum, line) => sum + logbookNumber(line.total_amount ?? line.total), 0),
        rooms: 0,
        conference: 0,
        pool: 0,
        other: 0
    };

    // Aggregate from the authoritative, fully-deduplicated cleared payment lines
    clearedPaymentLines.forEach((line: any) => {
        const bucket = inferRevenueBucket(line);
        if (bucket) {
            revenueEvidence[bucket] = logbookNumber(revenueEvidence[bucket]) + logbookNumber(line.amount);
        }
    });

    // Aggregate from POS outlet shift payments or orders (preventing double counting)
    const activeOutletPayments = outletPayments.filter((p: any) => !voidedOrderIds.has(String(p.order_id)));
    const activeOutletOrders2 = outletOrders.filter((o: any) => !voidedOrderIds.has(String(o.id)));
    const posLines = activeOutletPayments.length > 0 ? activeOutletPayments : activeOutletOrders2;
    posLines.forEach((line: any) => {
        const bucket = inferRevenueBucket(line);
        if (bucket) {
            revenueEvidence[bucket] = logbookNumber(revenueEvidence[bucket]) + logbookNumber(line.amount ?? line.total_amount ?? line.total);
        }
    });
    // Include other types of payments / credit bills
    revenueEvidence.other += creditPaymentsReceived;

    const revenueBreakdown = [
        {
            label: 'Restaurant',
            amount: logbookNumber(breakdown.restaurant_revenue ?? shift?.restaurant_revenue) || logbookNumber(revenueEvidence.restaurant)
        },
        {
            label: 'Bar',
            amount: logbookNumber(breakdown.bar_revenue ?? shift?.bar_revenue) || logbookNumber(revenueEvidence.bar)
        },
        {
            label: 'Rooms',
            amount: logbookNumber(breakdown.room_booking_revenue ?? shift?.room_booking_revenue) || logbookNumber(revenueEvidence.rooms)
        },
        {
            label: 'Conference',
            amount: logbookNumber(breakdown.conference_revenue ?? shift?.conference_revenue) || logbookNumber(revenueEvidence.conference)
        },
        {
            label: 'Pool',
            amount: (
                logbookNumber(breakdown.swimming_pool_revenue ?? shift?.swimming_pool_revenue)
                + logbookNumber(breakdown.pool_token_revenue ?? shift?.pool_token_revenue)
            ) || logbookNumber(revenueEvidence.pool)
        },
        {
            label: 'Other',
            amount: logbookNumber(breakdown.other_revenue ?? shift?.other_revenue) || logbookNumber(revenueEvidence.other)
        }
    ];

    const paymentBreakdown = Object.entries(payments)
        .filter(([method, amount]) => amount > 0 || ['cash', 'mpesa', 'card', 'credit_bill'].includes(method))
        .map(([method, amount]) => ({
            method,
            amount: logbookNumber(amount),
            count: clearedPaymentLines.filter((line) => normalizeLogbookPaymentMethod(line.payment_method) === method).length
                || nonVoidLines.filter((line) => normalizeLogbookPaymentMethod(line.payment_method) === method).length
        }));
    const paymentBreakdownByMethod = new Map(
        paymentBreakdown.map((row) => [normalizeLogbookPaymentMethod(row.method), logbookNumber(row.amount)])
    );

    const voidLines = allLines.filter((line) => isVoidedLogbookLine(line));
    const complianceFlags = [
        {
            label: 'Shift close logbook',
            status: logbook.cashier_shift_id || logbook.outlet_shift_id ? 'OK' : 'Review',
            detail: logbook.cashier_shift_id || logbook.outlet_shift_id
                ? 'Linked to a shift record'
                : 'No shift link was found'
        },
        {
            label: 'Payment capture',
            status: netSales > 0 || allLines.length > 0 ? 'OK' : 'Review',
            detail: netSales > 0 || allLines.length > 0
                ? `${transactionHistory.length} cleared transaction line(s) attached`
                : 'No sales or payment lines were captured'
        },
        {
            label: 'Cash variance',
            status: Math.abs(variance) < 0.01 ? 'OK' : 'Variance',
            detail: logbookMoney(variance)
        },
        {
            label: 'Voids and cancellations',
            status: voidLines.length ? 'Review' : 'OK',
            detail: voidLines.length ? `${voidLines.length} void/cancelled line(s)` : 'No void lines recorded'
        }
    ];

    const actualCollectionByMethod = new Map(
        shiftActualCollections.map((row: any) => [
            normalizeLogbookPaymentMethod(row.payment_method),
            row
        ])
    );
    const reconciliationRow = (method: 'cash' | 'mpesa' | 'card') => {
        const row = actualCollectionByMethod.get(method) || {};
        return {
            system_expected: logbookNumber(row.system_amount ?? (method === 'cash'
                ? expectedCash
                : method === 'mpesa'
                    ? paymentBreakdownByMethod.get('mpesa')
                    : paymentBreakdownByMethod.get('card'))),
            cashier_logged: logbookNumber(row.actual_amount ?? (method === 'cash'
                ? logbookNumber(shift?.actual_cash_counted ?? closingFloat)
                : method === 'mpesa'
                    ? logbookNumber(shift?.actual_mpesa_logged)
                    : logbookNumber(shift?.actual_card_logged))),
            variance: logbookNumber(row.variance),
            reference: logbookText(row.entry_reference)
        };
    };
    const reconciliationGrid = {
        cash: reconciliationRow('cash'),
        mpesa: reconciliationRow('mpesa'),
        card: reconciliationRow('card')
    };

    return {
        id: logbook.id,
        status: logbook.status,
        type: logbook.type,
        log_date: logbook.log_date,
        submitted_at: logbook.submitted_at,
        created_at: logbook.created_at,
        source: logbook.source,
        notes: logbook.notes,
        branch: branch || { id: logbook.branch_id, name: `Branch ${logbook.branch_id}` },
        cashier: cashier || {
            id: logbook.cashier_id,
            first_name: logbookText(shift?.cashier_name || breakdown.cashier_name || 'Cashier'),
            last_name: '',
            email: ''
        },
        shift: shift ? {
            id: shift.id,
            shift_number: shift.shift_number,
            shift_start: shift.shift_start,
            shift_end: shift.shift_end,
            status: shift.status,
            opening_approved_at: shift.opening_approved_at,
            opening_review_notes: shift.opening_review_notes
        } : outletShift ? {
            id: outletShift.id,
            shift_number: outletShift.shift_number,
            shift_start: outletShift.opened_at,
            shift_end: outletShift.closed_at,
            status: outletShift.status,
            outlet_name: Array.isArray(outletShift.outlet)
                ? outletShift.outlet[0]?.name
                : outletShift.outlet?.name,
            outlet_type: Array.isArray(outletShift.outlet)
                ? outletShift.outlet[0]?.outlet_type
                : outletShift.outlet?.outlet_type,
        } : null,
        cash_reconciliation: {
            opening_float: openingFloat,
            cash_sales: totalCash,
            cash_tendered: totalCashTendered,
            change_given: totalChangeGiven,
            drawer_cash_in: totalCash,
            credit_payments_received: creditPaymentsReceived,
            cash_drops: cashDrops,
            payouts,
            expense_total: expenseTotal,
            expected_closing: expectedCash,
            actual_closing: closingFloat,
            variance
        },
        reconciliation_status: logbookText(shift?.reconciliation_status),
        actual_cash_counted: logbookNumber(shift?.actual_cash_counted ?? closingFloat),
        actual_mpesa_logged: logbookNumber(shift?.actual_mpesa_logged),
        actual_card_logged: logbookNumber(shift?.actual_card_logged),
        mpesa_summary_ref: logbookText(shift?.mpesa_summary_ref),
        card_batch_ref: logbookText(shift?.card_batch_ref),
        variance_reason_code: logbookText(shift?.variance_reason_code),
        variance_comment: logbookText(shift?.variance_comment),
        reconciliation_grid: reconciliationGrid,
        summary: {
            total_sales: netSales,
            net_sales: netSales,
            gross_sales: grossSales,
            total_void_amount: logbookNumber(voidAudit.summary.total_void_amount),
            total_void_count: logbookNumber(voidAudit.summary.total_void_count),
            transaction_count: transactionHistory.length > 0
                ? transactionHistory.length
                : logbookNumber(breakdown.transaction_count ?? shift?.transaction_count),
            paid_bills_value: logbookNumber(breakdown.paid_bills_value ?? shift?.paid_bills_value),
            paid_bills_count: logbookNumber(breakdown.paid_bills_count ?? shift?.paid_bills_count),
            unpaid_bills_value: logbookNumber(breakdown.unpaid_bills_value ?? shift?.unpaid_bills_value),
            unpaid_bills_count: logbookNumber(breakdown.unpaid_bills_count ?? shift?.unpaid_bills_count)
        },
        payment_breakdown: paymentBreakdown,
        revenue_breakdown: revenueBreakdown,
        credit_bills: creditBills,
        credit_bills_total: creditBillsTotal,
        void_summary: voidAudit.summary,
        void_lines: voidLines,
        lines: allLines,
        transaction_history: transactionHistory,
        compliance_flags: complianceFlags
    };
}

export const getCashierLogbookDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const detail = await buildCashierLogbookDetail(req, req.params.id);
        res.json({ success: true, data: detail });
    } catch (error) {
        next(error);
    }
};

export const downloadCashierLogbookReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const detail = await buildCashierLogbookDetail(req, req.params.id);
        const shiftNumber = logbookText(detail.shift?.shift_number, 'cashier-shift');
        const filename = `Cashier_Logbook_${shiftNumber}_${detail.log_date || 'report'}.pdf`;

        try {
            const pythonResponse = await axios.post(
                `${PYTHON_SERVICE_URL}/api/payroll/generate-cashier-logbook-pdf`,
                detail,
                { responseType: 'arraybuffer' }
            );
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(Buffer.from(pythonResponse.data));
            return;
        } catch (pythonErr: any) {
            logger.warn(`Python cashier logbook PDF failed, falling back to native generator: ${pythonErr.message}`);
        }

        const doc = new PDFDocument({ margin: 42, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        doc.pipe(res);

        const cashierName = cashierUserName(detail.cashier);
        const LEFT = 42;
        const RIGHT = 553;
        const W = RIGHT - LEFT;
        const NAVY = '#1A3C5E';
        const GOLD = '#d6b25e';
        const LIGHT = '#f4f1ea';
        const MUTED = '#6B7280';

        const pageGuard = (needed: number) => {
            if (doc.y + needed > 800) doc.addPage();
        };

        const sectionHeader = (label: string) => {
            pageGuard(40);
            const y = doc.y;
            doc.save().rect(LEFT, y, W, 18).fill(NAVY).restore();
            doc.fillColor('white').font('Helvetica-Bold').fontSize(9.5)
                .text(label.toUpperCase(), LEFT + 8, y + 5, { lineBreak: false });
            doc.fillColor('black');
            doc.y = y + 26;
        };

        const pairRow = (label: string, value: string, o: any = {}) => {
            const h = o.h || 15;
            pageGuard(h);
            const y = doc.y;
            if (o.fill) doc.save().rect(LEFT, y, W, h).fill(o.fill).restore();
            doc.fillColor(o.labelColor || '#333')
                .font(o.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(o.size || 9)
                .text(label, LEFT + 8, y + 4, { width: W * 0.62, lineBreak: false });
            doc.fillColor(o.valueColor || '#111').font('Helvetica-Bold').fontSize(o.size || 9)
                .text(value, LEFT, y + 4, { width: W - 8, align: 'right', lineBreak: false });
            doc.fillColor('black');
            doc.y = y + h;
        };

        const tableRow = (cells: string[], fracs: number[], o: any = {}) => {
            const h = o.h || 14;
            pageGuard(h);
            const y = doc.y;
            if (o.fill) doc.save().rect(LEFT, y, W, h).fill(o.fill).restore();
            let x = LEFT + 6;
            cells.forEach((c, i) => {
                const w = W * fracs[i];
                doc.fillColor(o.color || '#222')
                    .font(o.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(o.size || 8)
                    .text(String(c), x, y + 4, {
                        width: w - 6,
                        align: (o.aligns && o.aligns[i]) || 'left',
                        lineBreak: false,
                        ellipsis: true
                    });
                x += w;
            });
            doc.fillColor('black');
            doc.y = y + h;
        };

        // ── Branded header band ────────────────────────────────────────────
        const headerH = 56;
        const hY = doc.y;
        doc.save().rect(LEFT, hY, W, headerH).fill(NAVY).restore();
        doc.fillColor('white').font('Helvetica-Bold').fontSize(17)
            .text('FAMOUS GATES HOTELS', LEFT + 14, hY + 11, { lineBreak: false });
        doc.font('Helvetica').fontSize(8.5).fillColor('#c8d4e2')
            .text('Bomet, Kenya  ·  0706 782 828', LEFT + 14, hY + 34, { lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(13).fillColor('white')
            .text('CASHIER SHIFT LOGBOOK', LEFT, hY + 14, { width: W - 14, align: 'right', lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(9).fillColor(GOLD)
            .text(`Shift ${shiftNumber}`, LEFT, hY + 34, { width: W - 14, align: 'right', lineBreak: false });
        doc.y = hY + headerH;
        doc.save().rect(LEFT, doc.y, W, 4).fill(GOLD).restore();
        doc.y += 16;
        doc.fillColor('black');

        // ── Shift meta ─────────────────────────────────────────────────────
        const metaY = doc.y;
        doc.font('Helvetica').fontSize(9).fillColor('#333');
        doc.text(`Branch: ${detail.branch?.name || 'Unknown branch'}`, LEFT, metaY, { lineBreak: false });
        doc.text(`Cashier: ${cashierName}`, LEFT, metaY + 13, { lineBreak: false });
        doc.text(`Log Date: ${detail.log_date || '—'}`, LEFT, metaY + 26, { lineBreak: false });
        doc.text(`Status: ${detail.status || '—'}`, LEFT + W / 2, metaY, { width: W / 2, align: 'right', lineBreak: false });
        doc.text(`Submitted: ${detail.submitted_at || detail.created_at || '—'}`, LEFT + W / 2, metaY + 13, { width: W / 2, align: 'right', lineBreak: false });
        doc.fillColor('black');
        doc.y = metaY + 42;

        // ── Cash Reconciliation ────────────────────────────────────────────
        const cr = detail.cash_reconciliation;
        sectionHeader('Cash Reconciliation');
        pairRow('Opening Float', logbookMoney(cr.opening_float));
        pairRow('+ Cash Sales', logbookMoney(cr.cash_sales), { fill: LIGHT });
        if (logbookNumber(cr.cash_tendered) > 0) pairRow('Cash Tendered', logbookMoney(cr.cash_tendered));
        if (logbookNumber(cr.change_given) > 0) pairRow('- Change Given', logbookMoney(cr.change_given), { fill: LIGHT });
        if (logbookNumber(cr.drawer_cash_in) > 0) pairRow('Net Drawer Cash In', logbookMoney(cr.drawer_cash_in), { bold: true });
        pairRow('+ Credit Payments Received', logbookMoney(cr.credit_payments_received));
        if (logbookNumber(cr.cash_drops) > 0) pairRow('- Cash Drops', logbookMoney(cr.cash_drops), { fill: LIGHT });
        if (logbookNumber(cr.payouts) > 0) pairRow('- Payouts', logbookMoney(cr.payouts));
        pairRow('= Expected Closing', logbookMoney(cr.expected_closing), { bold: true, fill: '#e8eef5' });
        pairRow('Actual Cash Counted', logbookMoney(cr.actual_closing), { bold: true });
        pairRow('Variance', logbookMoney(cr.variance), {
            bold: true,
            valueColor: Math.abs(logbookNumber(cr.variance)) < 0.01 ? '#16A34A' : '#DC2626'
        });
        pairRow('Total Sales', logbookMoney(detail.summary.total_sales), { bold: true, fill: NAVY, labelColor: 'white', valueColor: 'white' });
        doc.y += 8;

        // ── Sales By Payment Method ────────────────────────────────────────
        sectionHeader('Sales by Payment Method');
        tableRow(['Method', 'Lines', 'Amount'], [0.5, 0.2, 0.3],
            { bold: true, fill: LIGHT, color: MUTED, aligns: ['left', 'center', 'right'] });
        (detail.payment_breakdown || []).forEach((row: any) => {
            tableRow(
                [String(row.method).replace(/_/g, ' ').toUpperCase(), `${row.count || 0}`, logbookMoney(row.amount)],
                [0.5, 0.2, 0.3],
                { aligns: ['left', 'center', 'right'] }
            );
        });
        doc.y += 8;

        // ── Revenue Streams ────────────────────────────────────────────────
        const revenueRows = (detail.revenue_breakdown || []).filter((r: any) => logbookNumber(r.amount) > 0);
        if (revenueRows.length) {
            sectionHeader('Revenue Streams');
            revenueRows.forEach((r: any, i: number) =>
                pairRow(r.label, logbookMoney(r.amount), { fill: i % 2 ? LIGHT : undefined }));
            doc.y += 8;
        }

        // ── Staff Credit Bills (who for) ───────────────────────────────────
        sectionHeader(`Staff Credit Bills (${logbookMoney(detail.credit_bills_total || 0)})`);
        const creditBillRows = detail.credit_bills || [];
        if (!creditBillRows.length) {
            doc.font('Helvetica').fontSize(9).fillColor(MUTED)
                .text('No staff credit bills were issued during this shift.', LEFT + 8, doc.y, { lineBreak: false });
            doc.fillColor('black');
            doc.y += 16;
        } else {
            tableRow(['Staff', 'Reference', 'Department', 'Amount'], [0.34, 0.24, 0.22, 0.2],
                { bold: true, fill: LIGHT, color: MUTED, aligns: ['left', 'left', 'left', 'right'] });
            creditBillRows.forEach((b: any, i: number) => {
                tableRow(
                    [b.staff_name || 'Staff', b.credit_number || '—', b.department || '—', logbookMoney(b.amount)],
                    [0.34, 0.24, 0.22, 0.2],
                    { aligns: ['left', 'left', 'left', 'right'], fill: i % 2 ? LIGHT : undefined }
                );
            });
        }
        doc.y += 8;

        // ── Compliance Flags ───────────────────────────────────────────────
        sectionHeader('Compliance Checks');
        (detail.compliance_flags || []).forEach((flag: any) => {
            pageGuard(15);
            const y = doc.y;
            const ok = String(flag.status).toUpperCase() === 'OK';
            doc.save().roundedRect(LEFT + 8, y + 2, 46, 12, 3)
                .fill(ok ? '#dcfce7' : '#fef3c7').restore();
            doc.fillColor(ok ? '#16A34A' : '#B45309').font('Helvetica-Bold').fontSize(7.5)
                .text(String(flag.status).toUpperCase(), LEFT + 8, y + 5, { width: 46, align: 'center', lineBreak: false });
            doc.fillColor('#222').font('Helvetica').fontSize(8.5)
                .text(`${flag.label}: ${flag.detail}`, LEFT + 62, y + 4, { width: W - 70, lineBreak: false, ellipsis: true });
            doc.fillColor('black');
            doc.y = y + 16;
        });
        doc.y += 8;

        // ── Cleared Transaction History ────────────────────────────────────
        sectionHeader('Cleared Transaction History');
        const lines = (detail.transaction_history || detail.lines || []).slice(0, 80);
        if (!lines.length) {
            doc.font('Helvetica').fontSize(9).fillColor(MUTED)
                .text('No transaction lines were captured for this shift.', LEFT + 8, doc.y, { lineBreak: false });
            doc.fillColor('black');
        } else {
            tableRow(['#', 'Time', 'Reference', 'Customer', 'Method', 'Tendered', 'Change', 'Amount'],
                [0.04, 0.13, 0.16, 0.24, 0.11, 0.11, 0.1, 0.11],
                { bold: true, fill: LIGHT, color: MUTED, size: 7.2, aligns: ['left', 'left', 'left', 'left', 'left', 'right', 'right', 'right'] });
            lines.forEach((line: any, index: number) => {
                const time = String(line.created_at || '—').replace('T', ' ').slice(0, 19);
                tableRow(
                    [`${index + 1}`, time, line.reference || '—', line.customer_name || '—',
                        String(line.payment_method || '—').replace(/_/g, ' '),
                        logbookNumber(line.amount_tendered) > 0 ? logbookMoney(line.amount_tendered) : '—',
                        logbookNumber(line.change_given) > 0 ? logbookMoney(line.change_given) : '—',
                        logbookMoney(line.amount)],
                    [0.04, 0.13, 0.16, 0.24, 0.11, 0.11, 0.1, 0.11],
                    { aligns: ['left', 'left', 'left', 'left', 'left', 'right', 'right', 'right'], size: 7.2, fill: index % 2 ? LIGHT : undefined }
                );
            });
        }

        doc.end();
    } catch (error) {
        next(error);
    }
};

/**
 * Audit a logbook (approve or reject)
 */
export const auditLogbook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const { action, notes } = req.body;
        const auditor_id = req.user?.id;
        const reviewerRole = String(req.user?.role || '').toLowerCase();

        if (!id || !auditor_id) {
            throw new AppError('Logbook ID and reviewer ID are required', 400);
        }

        if (!['approve', 'reject'].includes(action)) {
            throw new AppError('Action must be either "approve" or "reject"', 400);
        }

        // Verify the logbook is pending audit
        const { data: logbook, error: fetchError } = await supabase
            .from('cashier_logbooks')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !logbook) {
            throw new AppError('Logbook not found', 404);
        }

        const isAccountantReview = ['branch_accountant', 'accountant'].includes(reviewerRole);
        if (isAccountantReview) {
            if (logbook.status !== 'pending_accountant_review') {
                throw new AppError('Only logbooks pending branch accountant review can be reviewed here', 400);
            }

            const { data: updated, error: updateError } = await supabase
                .from('cashier_logbooks')
                .update({
                    status: action === 'approve' ? 'pending_audit' : 'rejected',
                    accountant_reviewed_by: auditor_id,
                    accountant_reviewed_at: new Date(),
                    accountant_notes: notes || null,
                    updated_at: new Date()
                })
                .eq('id', id)
                .select()
                .single();

            if (updateError) throw updateError;

            if (action === 'approve') {
                notificationService.notifyRole(
                    'auditor',
                    'Cashier logbook ready for audit',
                    `Branch accountant reviewed a cashier logbook for ${updated.type}.`,
                    {
                        type: 'info',
                        category: 'cashier_logbook',
                        priority: 'high',
                        branchId: updated.branch_id,
                        metadata: { logbook_id: id, status: updated.status }
                    }
                ).catch(e => logger.error('Failed to notify auditor of accountant-reviewed logbook', e));
            }

            res.json({
                success: true,
                message: action === 'approve'
                    ? 'Logbook sent to auditor for final review'
                    : 'Logbook rejected by branch accountant',
                data: updated
            });
            return;
        }

        if (logbook.status !== 'pending_audit') {
            throw new AppError('Only logbooks pending final audit can be audited', 400);
        }

        // Update logbook with audit decision
        const { data: updated, error: updateError } = await supabase
            .from('cashier_logbooks')
            .update({
                status: action === 'approve' ? 'approved' : 'rejected',
                auditor_id,
                audited_at: new Date(),
                audit_notes: notes || null,
                updated_at: new Date()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Notify Cashier
        if (updated && updated.cashier_id) {
            const resultTitle = action === 'approve' ? 'Logbook Approved' : 'Logbook Rejected';
            const resultMsg = action === 'approve'
                ? `Your cashier logbook for ${updated.type} has been approved.`
                : `Your cashier logbook for ${updated.type} was rejected. Reason: ${notes || 'No reason provided.'}`;

            notificationService.notifyUser(
                updated.cashier_id,
                resultTitle,
                resultMsg,
                {
                    type: action === 'approve' ? 'success' : 'error',
                    category: 'audit_result',
                    priority: action === 'approve' ? 'medium' : 'high',
                    metadata: { logbook_id: id, status: updated.status }
                }
            ).catch(e => logger.error(`Failed to notify cashier ${updated.cashier_id} of logbook audit result`, e));
        }

        res.json({
            success: true,
            message: `Logbook ${action}d successfully`,
            data: updated
        });

    } catch (error) {
        next(error);
    }
};

/**
 * POS: Branch-scoped sellable item catalog for cashier station
 */
export const getCashierPOSItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const branchId = resolveCashierBranchId(req, req.query.branch_id);
        const search = normalizeSearchTerm(req.query.search);
        const rows = await loadCashierPOSItems(branchId, { search });

        res.json({
            success: true,
            message: 'POS items retrieved successfully',
            data: rows.map((item) => ({
                ...item,
                selling_price: Number(item.selling_price || 0),
                cost_price: Number(item.cost_price || 0),
                current_stock: Number(item.current_stock || 0)
            }))
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POS: Create a new transaction
 */
export const createPOSTransaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { items, customer_name, customer_phone, branch_id, total_amount, tax_amount, discount_amount } = req.body;
        const effectiveBranchId = resolveCashierBranchId(req, branch_id);

        if (!items || !Array.isArray(items) || items.length === 0) {
            throw new AppError('Items are required', 400);
        }

        const itemIds = normalizePOSItemIds(items);
        if (itemIds.length !== items.length) {
            throw new AppError('Every POS item must be selected from the branch POS catalog', 400);
        }

        const branchItems = await loadCashierPOSItems(effectiveBranchId, { itemIds });
        const branchItemMap = new Map<string, any>();
        for (const item of branchItems) {
            branchItemMap.set(String(item.id), item);
            branchItemMap.set(String(item.product_id), item);
            if (item.outlet_item_id) branchItemMap.set(String(item.outlet_item_id), item);
        }

        const normalizedItems = items.map((item: any) => {
            const productId = String(item.product_id || item.outlet_item_id || item.id || '').trim();
            const branchItem = branchItemMap.get(productId);
            if (!branchItem) {
                throw new AppError('One or more POS items do not belong to this branch', 403);
            }

            const qty = Number(item.qty || item.quantity || 1);
            if (!Number.isFinite(qty) || qty <= 0) {
                throw new AppError(`Invalid quantity for ${branchItem.name}`, 400);
            }

            const unitPrice = Number(branchItem.selling_price || 0);
            const itemDiscount = Number(item.discount_amount || 0);
            const itemTax = Number(item.tax_amount || 0);

            return {
                product_id: branchItem.product_id,
                outlet_item_id: branchItem.outlet_item_id,
                outlet_id: branchItem.outlet_id,
                name: branchItem.name,
                qty,
                unit_price: unitPrice,
                discount_amount: itemDiscount,
                tax_amount: itemTax,
                line_total: Math.max(0, qty * unitPrice - itemDiscount + itemTax)
            };
        });

        const serverTotal = normalizedItems.reduce((sum, item) => sum + item.line_total, 0);
        const providedTotal = Number(total_amount || serverTotal);
        if (Number.isFinite(providedTotal) && Math.abs(providedTotal - serverTotal) > 0.01) {
            logger.warn('Cashier POS total corrected from client value', {
                user_id: req.user?.id,
                branch_id: effectiveBranchId,
                provided_total: providedTotal,
                server_total: serverTotal
            });
        }

        const outletIds = Array.from(new Set(normalizedItems.map((item) => item.outlet_id).filter(Boolean)));

        // Generate unique transaction_ref: CS-{pos_id}-{ISOdate}-{random6}
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
        const transaction_ref = `CS-${effectiveBranchId}-${dateStr}-${randomStr}`;

        // 1. Create transaction header
        const { data: transaction, error: txError } = await supabase
            .from('pos_transactions')
            .insert({
                transaction_ref,
                cashier_id: req.user?.id,
                branch_id: effectiveBranchId,
                outlet_id: outletIds.length === 1 ? outletIds[0] : null,
                total_amount: serverTotal,
                tax_amount: tax_amount || 0,
                discount_amount: discount_amount || 0,
                status: 'PENDING',
                customer_name,
                customer_phone
            })
            .select()
            .single();

        if (txError) throw txError;

        // 2. Create transaction items
        const itemRecords = normalizedItems.map((item: any) => ({
            transaction_id: transaction.id,
            product_id: item.product_id,
            qty: item.qty,
            unit_price: item.unit_price,
            discount_amount: item.discount_amount || 0,
            tax_amount: item.tax_amount || 0,
            line_total: item.line_total
        }));

        const { error: itemsError } = await supabase
            .from('pos_transaction_items')
            .insert(itemRecords);

        if (itemsError) throw itemsError;

        res.status(201).json({
            success: true,
            data: {
                transaction_id: transaction.id,
                transaction_ref: transaction.transaction_ref,
                total_amount: transaction.total_amount,
                branch_id: transaction.branch_id
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POS: Initiate Payment for a transaction
 */
export const initiatePOSTransactionPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const { phone_number } = req.body;
        const method = normalizeCashierPOSMethod(req.body.method);

        // 1. Fetch transaction
        const { data: transaction, error: txError } = await supabase
            .from('pos_transactions')
            .select('*')
            .eq('id', id)
            .single();

        if (txError || !transaction) {
            throw new AppError('Transaction not found', 404);
        }

        resolveCashierBranchId(req, transaction.branch_id);

        if (transaction.status === 'PAID') {
            throw new AppError('Transaction already paid', 400);
        }

        if (method === 'MPESA') {
            if (!phone_number) throw new AppError('Phone number required for M-Pesa', 400);

            // Trigger STK Push via payment controller logic or call payment service directly
            const description = `Payment for POS Ref: ${transaction.transaction_ref}`;
            const stkResponse = await mpesaService.stkPush(
                phone_number,
                transaction.total_amount,
                transaction.transaction_ref,
                description
            );

            // Store payment record
            await supabase
                .from('payments')
                .insert({
                    reference: stkResponse.CheckoutRequestID,
                    amount: transaction.total_amount,
                    currency: 'KES',
                    payment_method: 'mpesa',
                    status: 'pending',
                    pos_transaction_id: transaction.id,
                    metadata: {
                        phoneNumber: phone_number,
                        merchantRequestId: stkResponse.MerchantRequestID,
                        checkoutRequestId: stkResponse.CheckoutRequestID,
                        transaction_ref: transaction.transaction_ref
                    }
                });

            res.json({
                success: true,
                message: 'STK Push initiated'
            });
        } else if (method === 'MPESA_MANUAL') {
            const { reference } = req.body;
            if (!reference) throw new AppError('M-Pesa reference required', 400);

            // 1. Update Transaction
            await supabase
                .from('pos_transactions')
                .update({
                    status: 'PAID',
                    payment_method: 'MPESA',
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            // 2. Record Payment
            const { error: paymentError } = await supabase.from('payments').insert({
                pos_transaction_id: transaction.id,
                amount: transaction.total_amount,
                currency: 'KES',
                payment_method: 'mpesa',
                status: 'completed',
                reference: reference,
                metadata: {
                    manual_entry: true,
                    transaction_ref: transaction.transaction_ref,
                    verified_at: new Date().toISOString()
                }
            });

            if (paymentError) {

              console.error('Database error:', paymentError);

              throw paymentError;

            }

            // 3. Record Logbook Transaction
            const { error: txnError } = await supabase.from('cashier_transactions').insert({
                transaction_number: `POS-${transaction.transaction_ref}`,
                branch_id: transaction.branch_id,
                cashier_id: req.user?.id || transaction.cashier_id,
                transaction_type: 'payment',
                revenue_type: 'POS_SALE',
                reference_type: 'pos_transaction',
                reference_id: transaction.id,
                payment_method: 'mpesa',
                amount: transaction.total_amount,
                customer_name: transaction.customer_name
            });

            if (txnError) {

              console.error('Database error:', txnError);

              throw txnError;

            }

            res.json({
                success: true,
                message: 'M-Pesa payment verified and transaction completed'
            });
        } else if (method === 'CASH') {
            // Cashier confirms amount received
            await supabase
                .from('pos_transactions')
                .update({
                    status: 'PAID',
                    payment_method: 'CASH',
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            // Record legacy transaction
            const { error } = await supabase.from('cashier_transactions').insert({
                transaction_number: `POS-${transaction.transaction_ref}`,
                branch_id: transaction.branch_id,
                cashier_id: transaction.cashier_id,
                transaction_type: 'payment',
                revenue_type: 'POS_SALE',
                reference_type: 'pos_transaction',
                reference_id: transaction.id,
                payment_method: 'cash',
                amount: transaction.total_amount,
                customer_name: transaction.customer_name
            });

            if (error) {

              console.error('Database error:', error);

              throw error;

            }

            res.json({
                success: true,
                message: 'Cash payment confirmed'
            });
        } else if (method === 'CARD' || method === 'CREDIT_BILL') {
            const { reference, credit_bill } = req.body;
            let creditBillId = credit_bill?.id || null;
            let staffCreditBillId = credit_bill?.staff_credit_bill_id || null;
            let creditStaffProfile: CashierCreditStaffProfile | null = null;

            if (method === 'CREDIT_BILL') {
                if (!credit_bill?.staff_id) {
                    throw new AppError('Staff member is required for a POS credit bill', 400);
                }
                creditStaffProfile = await resolveCashierCreditStaffProfile(
                    credit_bill.staff_id,
                    parseBranchId(credit_bill.branch_id) || parseBranchId(transaction.branch_id)
                );
            }

            if (method === 'CREDIT_BILL' && credit_bill && !creditBillId) {
                const { data: creditNumberData } = await supabase.rpc('generate_credit_number');
                const creditNumber = creditNumberData || `CR${Date.now()}`;
                const totalAmount = Number(transaction.total_amount || 0);
                const normalizedCreatedBy = normalizeUuidOrNull(req.user?.id);

                const { data: creditBill, error: creditError } = await supabase
                    .from('credit_bills')
                    .insert({
                        ...credit_bill,
                        credit_number: credit_bill.credit_number || creditNumber,
                        branch_id: credit_bill.branch_id || transaction.branch_id,
                        staff_id: creditStaffProfile?.id,
                        staff_name: credit_bill.staff_name || creditStaffProfile?.name || transaction.customer_name || 'Staff',
                        employee_id: credit_bill.employee_id || creditStaffProfile?.employeeId || null,
                        department: credit_bill.department || creditStaffProfile?.department || null,
                        bill_type: credit_bill.bill_type || 'pos_sale',
                        reference_type: 'pos_transaction',
                        reference_id: transaction.id,
                        total_amount: credit_bill.total_amount || totalAmount,
                        balance_amount: credit_bill.balance_amount || totalAmount,
                        payment_method: 'credit_bill',
                        deduction_months: credit_bill.deduction_months || 1,
                        monthly_deduction: (credit_bill.total_amount || totalAmount) / (credit_bill.deduction_months || 1),
                        status: 'active',
                        approval_status: 'pending',
                        created_by: normalizedCreatedBy
                    })
                    .select('id, credit_number')
                    .single();

                if (creditError) {
                    throw new AppError(`Credit bill creation failed: ${creditError.message}`, 500);
                }
                creditBillId = creditBill?.id || null;
            }

            if (method === 'CREDIT_BILL' && credit_bill?.staff_id && !staffCreditBillId) {
                const totalAmount = Number(credit_bill.total_amount || transaction.total_amount || 0);
                const staffName = credit_bill.staff_name || creditStaffProfile?.name || credit_bill.name || transaction.customer_name || 'Staff';
                const { data: staffCreditBill, error: staffCreditError } = await supabase
                    .from('staff_credit_bills')
                    .insert({
                        staff_id: creditStaffProfile?.id,
                        amount: totalAmount,
                        description: `Cashier POS Credit - ${transaction.transaction_ref} - ${staffName}`,
                        bill_date: new Date().toISOString().split('T')[0],
                        status: 'pending',
                        branch_id: transaction.branch_id,
                        source_cashier_credit_bill_id: creditBillId
                    })
                    .select('id')
                    .single();

                if (staffCreditError) {
                    throw new AppError(`Payroll credit bill creation failed: ${staffCreditError.message}`, 500);
                }
                staffCreditBillId = staffCreditBill?.id || null;
            }

            await supabase
                .from('pos_transactions')
                .update({
                    status: 'PAID',
                    payment_method: method,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            const paymentReference =
                reference || creditBillId || `POS-${method}-${transaction.transaction_ref}`;

            const { error: paymentError } = await supabase.from('payments').insert({
                pos_transaction_id: transaction.id,
                credit_bill_id: creditBillId,
                amount: transaction.total_amount,
                currency: 'KES',
                payment_method: method.toLowerCase(),
                status: 'completed',
                reference: paymentReference,
                metadata: {
                    manual_entry: true,
                    transaction_ref: transaction.transaction_ref,
                    credit_bill_id: creditBillId,
                    staff_credit_bill_id: staffCreditBillId,
                    verified_at: new Date().toISOString()
                }
            });

            if (paymentError) {
                console.error('Database error:', paymentError);
                throw paymentError;
            }

            const { error: txnError } = await supabase.from('cashier_transactions').insert({
                transaction_number: `POS-${transaction.transaction_ref}`,
                branch_id: transaction.branch_id,
                cashier_id: req.user?.id || transaction.cashier_id,
                transaction_type: 'payment',
                revenue_type: 'POS_SALE',
                reference_type: 'pos_transaction',
                reference_id: transaction.id,
                credit_bill_id: creditBillId,
                payment_method: method.toLowerCase(),
                amount: transaction.total_amount,
                payment_reference: paymentReference,
                customer_name: transaction.customer_name
            });

            if (txnError) {
                console.error('Database error:', txnError);
                throw txnError;
            }

            res.json({
                success: true,
                message: `${method === 'CARD' ? 'Card' : 'Credit bill'} payment confirmed`
            });
        } else {
            throw new AppError('Payment method not supported yet or in development', 400);
        }
    } catch (error) {
        next(error);
    }
};

/**
 * POS: Reconciliation Report
 */
export const getPOSReconciliation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { date, branch_id, from_date, to_date } = req.query;
        const targetDate = date ? (date as string) : new Date().toISOString().split('T')[0];
        const rangeFrom = (from_date as string) || targetDate;
        const rangeTo = (to_date as string) || targetDate;

        const isGlobal = isGlobalRole(req.user?.role);
        const effectiveBranchId = isGlobal && branch_id ? parseInt(branch_id as string) : (req.user?.branch_id || 0);

        // 1. Get transactions for the day
        const { data: transactions, error: txError } = await supabase
            .from('pos_transactions')
            .select('*')
            .eq('branch_id', effectiveBranchId)
            .gte('created_at', `${targetDate}T00:00:00Z`)
            .lte('created_at', `${targetDate}T23:59:59Z`);

        if (txError) throw txError;

        // 2. Breakdown per method
        const totals: Record<string, { count: number, total: number }> = {
            CASH: { count: 0, total: 0 },
            MPESA: { count: 0, total: 0 },
            CARD: { count: 0, total: 0 },
            PENDING: { count: 0, total: 0 }
        };

        transactions?.forEach(tx => {
            if (tx.status === 'PAID') {
                const method = tx.payment_method || 'UNKNOWN';
                if (!totals[method]) totals[method] = { count: 0, total: 0 };
                totals[method].count++;
                totals[method].total += Number(tx.total_amount);
            } else if (tx.status === 'PENDING') {
                totals.PENDING.count++;
                totals.PENDING.total += Number(tx.total_amount);
            }
        });

        // Normalized (mpesa/cash/card/credit) breakdown across both POS and
        // cashier-recorded transactions for the requested range — additive,
        // alongside the existing day-level `totals` above.
        const paymentMethodBreakdown = effectiveBranchId
            ? await getPaymentMethodBreakdown(Number(effectiveBranchId), rangeFrom, rangeTo).catch(() => null)
            : null;

        res.json({
            success: true,
            data: {
                date: targetDate,
                period: { from: rangeFrom, to: rangeTo },
                summary: totals,
                payment_method_breakdown: paymentMethodBreakdown,
                gross_total: Object.values(totals).reduce((sum, t) => sum + t.total, 0)
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POS: Recent branch transactions for branch manager dashboard
 */
export const getRecentTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const limit = Math.min(Math.max(parseInt(String(req.query.limit || '10'), 10) || 10, 1), 50);
        const effectiveBranchId = resolveCashierBranchId(req, req.query.branch_id);

        const { data: transactions, error } = await supabase
            .from('pos_transactions')
            .select('*')
            .eq('branch_id', effectiveBranchId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        const usersById = await fetchCashierUsersById((transactions || []).map((tx: any) => tx.cashier_id));
        const rows = (transactions || []).map((tx: any) => {
            const cashier = usersById.get(String(tx.cashier_id || ''));
            const amount = Number(tx.total_amount ?? tx.amount ?? tx.total ?? 0);
            const paymentMethod = String(tx.payment_method || '').replace(/_/g, ' ').trim();
            const status = String(tx.status || '').toLowerCase();
            const reference = tx.transaction_ref || tx.reference || tx.id;

            return {
                id: tx.id,
                description: [
                    status ? `${status.charAt(0).toUpperCase()}${status.slice(1)}` : 'POS',
                    paymentMethod || 'transaction',
                    reference ? `#${reference}` : ''
                ].filter(Boolean).join(' '),
                user_name: cashierUserName(cashier),
                cashier: cashierUserName(cashier),
                amount,
                status: tx.status,
                payment_method: tx.payment_method,
                branch_id: tx.branch_id,
                created_at: tx.created_at,
                time_ago: tx.created_at
            };
        });

        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all pending/unpaid restaurant and bar orders (waiter orders not yet collected)
 * GET /api/cashier/unpaid-orders
 */
export const getUnpaidWaiterOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userRole = (req.user as any)?.role?.toLowerCase() || '';
        const isGlobal = isGlobalRole(userRole);
        const queryBranchId = req.query.branch_id ? parseInt(req.query.branch_id as string) : null;
        const effectiveBranchId = isGlobal ? queryBranchId : ((req.user as any)?.branch_id || null);
        const status = String(req.query.status || 'all').toLowerCase();
        const wantsVoidedOrders = ['voided', 'void'].includes(status);
        const search = String(req.query.search || '').trim().toLowerCase();
        const requestedDate = String(req.query.date || '').trim();
        // An unpaid bill stays unpaid until it is settled, so by default we show
        // EVERY still-unpaid bill regardless of age (e.g. a bill from yesterday
        // remains visible while the shift is open). Only bound by a time window
        // when the caller explicitly requests a date or from/to range.
        const hasDateFilter = !!(requestedDate || req.query.from_date || req.query.to_date);
        let from: Date | null = null;
        let to: Date | null = null;
        if (hasDateFilter) {
            const date = requestedDate || new Date().toISOString().slice(0, 10);
            from = req.query.from_date
                ? new Date(String(req.query.from_date))
                : new Date(`${date}T00:00:00.000Z`);
            to = req.query.to_date
                ? new Date(String(req.query.to_date))
                : new Date(`${date}T23:59:59.999Z`);
        }
        const requestedOutletId = String(req.query.outlet_id || '').trim();
        const requestedOutletType = String(req.query.outlet_type || '').trim().toLowerCase();
        const assignedOutlets = await loadAssignedPosOutlets(supabase, (req.user as any)?.id);
        const assignedIds = assignedOutletIds(assignedOutlets);
        const roleOutletTypes = stationTypesForCashierRole(userRole, effectiveBranchId);
        const stationRestricted = shouldRestrictCashierStationAccess(userRole, assignedIds, effectiveBranchId);
        const allowedOutletTypes = new Set([
            ...roleOutletTypes,
            ...assignedOutlets.map((outlet) => String(outlet.outlet_type || '').toLowerCase()).filter(Boolean)
        ]);
        // Each POS-outlet cashier sees and clears ONLY their own outlet's bills
        // (a main-bar cashier sees main-bar orders, not executive-bar/restaurant).
        const includeLegacyWaiterOrders = !stationRestricted || req.query.include_legacy === 'true';
        const canSeeLegacyRestaurant = includeLegacyWaiterOrders && (!stationRestricted || allowedOutletTypes.has('restaurant'));
        const canSeeLegacyBar = includeLegacyWaiterOrders && (!stationRestricted || Array.from(allowedOutletTypes).some(isBarStationType));

        // Fetch all POS outlets for the branch (or globally if no branchId) to resolve outlet_type
        let outletsQuery = supabase.from('pos_outlets').select('id, name, outlet_type, branch_id');
        if (effectiveBranchId) {
            outletsQuery = outletsQuery.eq('branch_id', effectiveBranchId);
        }
        const { data: branchOutlets } = await outletsQuery;
        const outletMap = new Map((branchOutlets || []).map((o: any) => [String(o.id), o]));

        // Fetch pending restaurant orders
        let restaurantOrders: any[] = [];
        if (!wantsVoidedOrders && canSeeLegacyRestaurant && (!requestedOutletType || requestedOutletType === 'restaurant')) {
            let restaurantQuery = supabase
                .from('restaurant_orders')
                .select(`
                    id, order_number, short_code, status, payment_status,
                    table_number, room_number, guest_name,
                    total_amount, amount_paid, balance_amount, created_at, branch_id, created_by,
                    outlet_id,
                    items:restaurant_order_items(
                        id, quantity, unit_price, total_price,
                        menu_item:restaurant_menu_items(name)
                    )
                `)
                .neq('payment_status', 'paid')
                .neq('status', 'cancelled')
                .order('created_at', { ascending: false });

            if (from && to) {
                restaurantQuery = restaurantQuery
                    .gte('created_at', from.toISOString())
                    .lte('created_at', to.toISOString());
            }
            if (effectiveBranchId) restaurantQuery = restaurantQuery.eq('branch_id', effectiveBranchId);
            if (status !== 'all') restaurantQuery = restaurantQuery.eq('payment_status', status);

            const { data, error: rErr } = await restaurantQuery;
            if (rErr && rErr.code !== '42703') throw rErr;
            restaurantOrders = data || [];

            if (!isGlobal) {
                restaurantOrders = restaurantOrders.filter((o: any) => {
                    if (o.outlet_id) {
                        const outlet = outletMap.get(String(o.outlet_id));
                        return canAccessPosOutlet(userRole, outlet, assignedOutlets, effectiveBranchId);
                    }
                    return allowedOutletTypes.has('restaurant');
                });
            }
        }

        // Fetch pending bar orders
        let barOrders: any[] = [];
        if (!wantsVoidedOrders && canSeeLegacyBar && (!requestedOutletType || isBarStationType(requestedOutletType))) {
            let barQuery = supabase
                .from('bar_orders')
                .select(`
                    id, order_number, short_code, status, payment_status,
                    seat_number, room_number, guest_name,
                    total, amount_paid, balance_amount, created_at, branch_id, created_by,
                    outlet_id,
                    items:bar_order_items(id, drink_name, quantity, unit_price, total_price)
                `)
                .neq('payment_status', 'paid')
                .neq('status', 'cancelled')
                .order('created_at', { ascending: false });

            if (from && to) {
                barQuery = barQuery
                    .gte('created_at', from.toISOString())
                    .lte('created_at', to.toISOString());
            }
            if (effectiveBranchId) barQuery = barQuery.eq('branch_id', effectiveBranchId);
            if (status !== 'all') barQuery = barQuery.eq('payment_status', status);

            const { data, error: bErr } = await barQuery;
            if (bErr && bErr.code !== '42703') throw bErr;
            barOrders = data || [];

            if (!isGlobal) {
                barOrders = barOrders.filter((o: any) => {
                    if (o.outlet_id) {
                        const outlet = outletMap.get(String(o.outlet_id));
                        return canAccessPosOutlet(userRole, outlet, assignedOutlets, effectiveBranchId);
                    }
                    return Array.from(allowedOutletTypes).some(isBarStationType);
                });
            }
        }

        let posOrders: any[] = [];
        let posShiftIds: string[] = [];
        let shiftLookup: Record<string, any> = {};
        try {
            let posShiftQuery = supabase
                .from('pos_outlet_shifts')
                .select('id, branch_id, outlet_id, cashier_id, outlet:pos_outlets(id, name, outlet_type, branch_id)');
            if (effectiveBranchId) posShiftQuery = posShiftQuery.eq('branch_id', effectiveBranchId);
            if (!isGlobal && shouldRestrictCashierStationAccess(userRole, assignedIds, effectiveBranchId)) {
                posShiftQuery = posShiftQuery
                    .eq('cashier_id', (req.user as any)?.id)
                    .eq('status', 'open');
            }
            const { data: posShifts, error: posShiftErr } = await posShiftQuery;
            if (posShiftErr) throw posShiftErr;

            const visibleShifts = ((posShifts || []) as any[]).filter((shift: any) => {
                const outlet = Array.isArray(shift.outlet) ? shift.outlet[0] : shift.outlet;
                if (requestedOutletId && String(shift.outlet_id) !== requestedOutletId) return false;
                if (requestedOutletType && String(outlet?.outlet_type || '').toLowerCase() !== requestedOutletType) return false;
                // Only this cashier's own POS outlet(s).
                return canAccessPosOutlet(userRole, outlet, assignedOutlets, effectiveBranchId);
            });

            shiftLookup = Object.fromEntries(visibleShifts.map((shift: any) => [shift.id, shift]));
            posShiftIds = Object.keys(shiftLookup);
            if (posShiftIds.length) {
                const allowedStatuses = status === 'all' ? ['unpaid', 'partial'] : [status];
                let posOrdersQuery = supabase
                    .from('pos_shift_orders')
                    .select('*')
                    .in('shift_id', posShiftIds)
                    .order('created_at', { ascending: false });
                if (wantsVoidedOrders) {
                    posOrdersQuery = posOrdersQuery
                        .or('status.eq.voided,payment_status.eq.voided,void_request_status.eq.approved,void_request_status.eq.pending');
                } else {
                    posOrdersQuery = posOrdersQuery
                        .in('payment_status', allowedStatuses)
                        .neq('status', 'cancelled')
                        // Pending void approvals are stopped from payment. Once
                        // approved, they move to the cashier voided-orders view
                        // and never count as unpaid bills.
                        .or('void_request_status.is.null,void_request_status.eq.rejected');
                }
                if (from && to) {
                    posOrdersQuery = posOrdersQuery
                        .gte('created_at', from.toISOString())
                        .lte('created_at', to.toISOString());
                }
                const { data: fetchedPosOrders, error: posErr } = await posOrdersQuery;
                if (posErr) throw posErr;
                posOrders = fetchedPosOrders || [];
            }
        } catch (posError: any) {
            if (!['42P01', '42703', 'PGRST205', 'PGRST204'].includes(posError?.code)) {
                throw posError;
            }
        }

        // Item-level voids (pos_item_void_requests) never flip the order's own
        // status/payment_status/void_request_status -- void_order_item() only
        // mutates the JSONB item and reduces total/balance -- so the whole-bill
        // OR-filter above can never find them. Pull approved item-void records
        // for these shifts separately and merge in any orders not already
        // present so the cashier's voided-orders view also surfaces item-level
        // voids, not just whole-bill voids.
        const itemVoidsByOrder = new Map<string, any[]>();
        if (wantsVoidedOrders && posShiftIds.length) {
            try {
                const { data: itemVoidRows, error: itemVoidErr } = await supabase
                    .from('pos_item_void_requests')
                    .select('*')
                    .in('shift_id', posShiftIds)
                    .eq('status', 'approved')
                    .order('actioned_at', { ascending: false });
                if (itemVoidErr) throw itemVoidErr;

                for (const row of itemVoidRows || []) {
                    const orderId = String((row as any).order_id);
                    const list = itemVoidsByOrder.get(orderId) || [];
                    list.push(row);
                    itemVoidsByOrder.set(orderId, list);
                }

                const knownOrderIds = new Set(posOrders.map((o: any) => String(o.id)));
                const missingOrderIds = Array.from(itemVoidsByOrder.keys())
                    .filter((id) => !knownOrderIds.has(id));
                if (missingOrderIds.length) {
                    const { data: extraOrders, error: extraErr } = await supabase
                        .from('pos_shift_orders')
                        .select('*')
                        .in('id', missingOrderIds);
                    if (extraErr) throw extraErr;
                    posOrders = [...posOrders, ...(extraOrders || [])];
                }
            } catch (itemVoidError: any) {
                if (!['42P01', '42703', 'PGRST205', 'PGRST204'].includes(itemVoidError?.code)) {
                    throw itemVoidError;
                }
            }
        }

        const itemVoidActionerIds = Array.from(itemVoidsByOrder.values())
            .flat()
            .flatMap((row: any) => [row.actioned_by, row.requested_by]);

        const waiterMap = await fetchCashierUsersById([
            ...(restaurantOrders || []).map((order: any) => order.created_by),
            ...(barOrders || []).map((order: any) => order.created_by),
            ...itemVoidActionerIds,
        ]);

        // Normalise into a common shape
        const mapped = [
            ...(restaurantOrders || []).map((o: any) => ({
                id: o.id,
                source: 'restaurant',
                source_type: 'WAITER_ORDER',
                bill_type: 'restaurant_order',
                order_number: o.order_number,
                bill_number: o.order_number,
                short_code: o.short_code,
                location: o.table_number ? `Table ${o.table_number}` : o.room_number ? `Room ${o.room_number}` : '—',
                guest_name: o.guest_name || 'Walk-in',
                customer_name: o.guest_name || 'Walk-in',
                total_amount: Number(o.total_amount || 0),
                paid_amount: Number(o.amount_paid || 0),
                balance_amount: Math.max(0, Number(o.total_amount || 0) - Number(o.amount_paid || 0)),
                payment_status: o.payment_status,
                status: o.payment_status,
                created_at: o.created_at,
                bill_date: o.created_at,
                branch_id: o.branch_id,
                waiter: waiterMap.get(String(o.created_by || '')) || null,
                waiter_id: o.created_by,
                waiter_name: (() => {
                    const waiter = waiterMap.get(String(o.created_by || ''));
                    return waiter ? `${waiter.first_name || ''} ${waiter.last_name || ''}`.trim() : '';
                })(),
                items: (o.items || []).map((item: any) => ({
                    id: item.id,
                    item_name: item.menu_item?.name || 'Menu item',
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    total_price: item.total_price
                })),
                is_waiter_order: true
            })),
            ...(barOrders || []).map((o: any) => ({
                id: o.id,
                source: 'bar',
                source_type: 'WAITER_ORDER',
                bill_type: 'bar_order',
                order_number: o.order_number,
                bill_number: o.order_number,
                short_code: o.short_code,
                location: o.seat_number ? `Seat ${o.seat_number}` : o.room_number ? `Room ${o.room_number}` : '—',
                guest_name: o.guest_name || 'Bar Customer',
                customer_name: o.guest_name || 'Bar Customer',
                total_amount: Number(o.total || 0),
                paid_amount: Number(o.amount_paid || 0),
                balance_amount: Math.max(0, Number(o.total || 0) - Number(o.amount_paid || 0)),
                payment_status: o.payment_status,
                status: o.payment_status,
                created_at: o.created_at,
                bill_date: o.created_at,
                branch_id: o.branch_id,
                waiter: waiterMap.get(String(o.created_by || '')) || null,
                waiter_id: o.created_by,
                waiter_name: (() => {
                    const waiter = waiterMap.get(String(o.created_by || ''));
                    return waiter ? `${waiter.first_name || ''} ${waiter.last_name || ''}`.trim() : '';
                })(),
                items: o.items || [],
                is_waiter_order: true
            })),
            ...posOrders
            .filter((o: any) => wantsVoidedOrders || !isNullifiedZeroPosOrder(o))
            .map((o: any) => {
                const items = Array.isArray(o.items) ? o.items : [];
                const shift = shiftLookup[o.shift_id];
                const outlet = Array.isArray(shift?.outlet) ? shift.outlet[0] : shift?.outlet;
                const stationName = outlet?.name || stationDisplayName(outlet?.outlet_type);
                const location = posOrderLocation(o, stationName);
                const isVoided = o.status === 'voided' || o.payment_status === 'voided' || ['approved','pending'].includes(o.void_request_status);
                const itemVoids = itemVoidsByOrder.get(String(o.id)) || [];
                // A bill can have item-level voids without the bill itself ever
                // being voided (the waiter voided one line, the rest was paid
                // normally) -- only fall back to the item-void view when the
                // bill isn't already a whole-bill void.
                const isItemLevelVoid = !isVoided && itemVoids.length > 0;
                const latestItemVoid = itemVoids[0]; // already sorted desc by actioned_at
                const voidedAmount = itemVoids.reduce(
                    (sum: number, v: any) => sum + Number(v.qty_to_void || 0) * Number(v.unit_price || 0), 0
                );
                return {
                    id: o.id,
                    source: 'pos',
                    source_type: 'CAPTAIN_ORDER',
                    bill_type: 'pos_shift_order',
                    bill_label: 'Captain Order',
                    order_number: o.order_number,
                    bill_number: o.order_number,
                    short_code: o.short_code,
                    location,
                    guest_name: o.customer_name || 'Walk-in',
                    customer_name: o.customer_name || 'Walk-in',
                    total_amount: isItemLevelVoid ? voidedAmount : Number(o.total_amount || 0),
                    paid_amount: Number(o.amount_paid || 0),
                    balance_amount: (isVoided || isItemLevelVoid) ? 0 : Math.max(0, Number(o.total_amount || 0) - Number(o.amount_paid || 0)),
                    payment_status: isVoided ? 'voided' : (isItemLevelVoid ? 'item_voided' : (o.payment_status === 'paid' ? 'cleared' : o.payment_status)),
                    status: isVoided ? 'voided' : (isItemLevelVoid ? 'item_voided' : (o.payment_status === 'paid' ? 'cleared' : o.payment_status)),
                    created_at: o.created_at,
                    bill_date: o.created_at,
                    // Exact time this bill/ticket was last printed (Kenyan time
                    // shown client-side) — for cashier accountability, incl.
                    // recalled bills.
                    captain_printed_at: o.captain_printed_at || null,
                    original_bill_printed_at: o.original_bill_printed_at || null,
                    last_bill_printed_at: o.last_bill_printed_at
                        || o.original_bill_printed_at || o.captain_printed_at || null,
                    bill_reprint_count: Number(o.bill_reprint_count || 0),
                    branch_id: shift?.branch_id || effectiveBranchId,
                    outlet_id: o.outlet_id || shift?.outlet_id,
                    outlet_type: outlet?.outlet_type || null,
                    outlet_name: outlet?.name || null,
                    station_name: stationName,
                    void_type: isVoided ? 'whole_bill' : (isItemLevelVoid ? 'item_level' : null),
                    void_request_status: o.void_request_status || null,
                    void_reason: isItemLevelVoid
                        ? Array.from(new Set(itemVoids.map((v: any) => v.reason).filter(Boolean))).join('; ')
                        : (o.void_reason || null),
                    voided_at: isItemLevelVoid ? (latestItemVoid?.actioned_at || null) : (o.voided_at || null),
                    voided_by: isItemLevelVoid
                        ? (() => {
                            const actioner = waiterMap.get(String(latestItemVoid?.actioned_by || ''));
                            return actioner ? `${actioner.first_name || ''} ${actioner.last_name || ''}`.trim() : null;
                        })()
                        : (o.voided_by || null),
                    waiter: null,
                    waiter_id: o.waiter_id || o.created_by,
                    waiter_name: o.waiter_name || '',
                    items: isItemLevelVoid
                        ? itemVoids.map((v: any) => ({
                            id: v.id,
                            item_name: v.item_name || 'POS item',
                            quantity: Number(v.qty_to_void || 0),
                            unit_price: Number(v.unit_price || 0),
                            total_price: Number(v.qty_to_void || 0) * Number(v.unit_price || 0)
                        }))
                        : items.map((item: any, index: number) => ({
                            id: item.outlet_item_id || `${o.id}-${index}`,
                            item_name: item.name || item.item_name || 'POS item',
                            quantity: Number(item.quantity || item.qty || 1),
                            unit_price: Number(item.unit_price || item.price || 0),
                            total_price: Number(item.line_total || 0)
                        })),
                    is_waiter_order: true,
                    is_captain_order: true,
                    is_voided: isVoided || isItemLevelVoid
                };
            })
        ].filter((row) => {
            if (!search) return true;
            return [
                row.order_number,
                row.short_code,
                row.customer_name,
                row.waiter_name,
                row.location
            ].join(' ').toLowerCase().includes(search);
        }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        res.json({ success: true, data: mapped });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/cashier/unpaid-pos-orders
 *
 * Safe station-scoped unpaid list used by cashier close workflows. It reads
 * only POS shift orders and intentionally avoids legacy restaurant/bar waiter
 * tables, whose Supabase relationship metadata can be stale in production.
 */
export const getUnpaidPosOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userRole = (req.user as any)?.role?.toLowerCase() || '';
        const isGlobal = isGlobalRole(userRole);
        const queryBranchId = req.query.branch_id ? parseInt(req.query.branch_id as string) : null;
        const effectiveBranchId = isGlobal ? queryBranchId : ((req.user as any)?.branch_id || null);
        const status = String(req.query.status || 'all').toLowerCase();
        const wantsVoidedOrders = ['voided', 'void'].includes(status);
        const search = String(req.query.search || '').trim().toLowerCase();
        const requestedOutletId = String(req.query.outlet_id || '').trim();
        const requestedOutletType = String(req.query.outlet_type || '').trim().toLowerCase();

        const assignedOutlets = await loadAssignedPosOutlets(supabase, (req.user as any)?.id);
        const assignedIds = assignedOutletIds(assignedOutlets);
        const stationRestricted = shouldRestrictCashierStationAccess(userRole, assignedIds, effectiveBranchId);

        let posShiftQuery = supabase
            .from('pos_outlet_shifts')
            .select('id, branch_id, outlet_id, cashier_id, status, outlet:pos_outlets(id, name, outlet_type, branch_id)');
        if (effectiveBranchId) posShiftQuery = posShiftQuery.eq('branch_id', effectiveBranchId);
        if (!isGlobal && stationRestricted) {
            posShiftQuery = posShiftQuery
                .eq('cashier_id', (req.user as any)?.id)
                .eq('status', 'open');
        }

        const { data: posShifts, error: posShiftErr } = await posShiftQuery;
        if (posShiftErr) throw posShiftErr;

        const visibleShifts = ((posShifts || []) as any[]).filter((shift: any) => {
            const outlet = Array.isArray(shift.outlet) ? shift.outlet[0] : shift.outlet;
            if (requestedOutletId && String(shift.outlet_id) !== requestedOutletId) return false;
            if (requestedOutletType && String(outlet?.outlet_type || '').toLowerCase() !== requestedOutletType) return false;
            return canAccessPosOutlet(userRole, outlet, assignedOutlets, effectiveBranchId);
        });

        const shiftLookup: Record<string, any> = Object.fromEntries(visibleShifts.map((shift: any) => [shift.id, shift]));
        const posShiftIds = Object.keys(shiftLookup);
        if (!posShiftIds.length) {
            res.json({ success: true, data: [] });
            return;
        }

        const allowedStatuses = status === 'all' ? ['unpaid', 'partial'] : [status];
        let posOrdersQuery = supabase
            .from('pos_shift_orders')
            .select('*')
            .in('shift_id', posShiftIds)
            .order('created_at', { ascending: false });

        if (wantsVoidedOrders) {
            posOrdersQuery = posOrdersQuery
                .or('status.eq.voided,payment_status.eq.voided,void_request_status.eq.approved,void_request_status.eq.pending');
        } else {
            posOrdersQuery = posOrdersQuery
                .in('payment_status', allowedStatuses)
                .neq('status', 'cancelled')
                .or('void_request_status.is.null,void_request_status.eq.rejected');
        }

        const { data: posOrders, error: posErr } = await posOrdersQuery;
        if (posErr) throw posErr;

        const mapped = (posOrders || [])
        .filter((o: any) => wantsVoidedOrders || !isNullifiedZeroPosOrder(o))
        .map((o: any) => {
            const items = Array.isArray(o.items) ? o.items : [];
            const shift = shiftLookup[o.shift_id];
            const outlet = Array.isArray(shift?.outlet) ? shift.outlet[0] : shift?.outlet;
            const stationName = outlet?.name || stationDisplayName(outlet?.outlet_type);
            const location = posOrderLocation(o, stationName);
            const isVoided = o.status === 'voided' || o.payment_status === 'voided' || ['approved','pending'].includes(o.void_request_status);
            return {
                id: o.id,
                source: 'pos',
                source_type: 'CAPTAIN_ORDER',
                bill_type: 'pos_shift_order',
                bill_label: 'Captain Order',
                order_number: o.order_number,
                bill_number: o.order_number,
                short_code: o.short_code,
                location,
                guest_name: o.customer_name || 'Walk-in',
                customer_name: o.customer_name || 'Walk-in',
                total_amount: Number(o.total_amount || 0),
                paid_amount: Number(o.amount_paid || 0),
                balance_amount: isVoided ? 0 : Number(o.balance_amount || o.total_amount || 0),
                payment_status: isVoided ? 'voided' : (o.payment_status === 'paid' ? 'cleared' : o.payment_status),
                status: isVoided ? 'voided' : (o.payment_status === 'paid' ? 'cleared' : o.payment_status),
                created_at: o.created_at,
                bill_date: o.created_at,
                branch_id: shift?.branch_id || effectiveBranchId,
                outlet_id: o.outlet_id || shift?.outlet_id,
                outlet_type: outlet?.outlet_type || null,
                outlet_name: outlet?.name || null,
                station_name: stationName,
                void_request_status: o.void_request_status || null,
                void_reason: o.void_reason || null,
                voided_at: o.voided_at || null,
                voided_by: o.voided_by || null,
                waiter: null,
                waiter_id: o.waiter_id || o.created_by,
                waiter_name: o.waiter_name || '',
                items: items.map((item: any, index: number) => ({
                    id: item.outlet_item_id || `${o.id}-${index}`,
                    item_name: item.name || item.item_name || 'POS item',
                    quantity: Number(item.quantity || item.qty || 1),
                    unit_price: Number(item.unit_price || item.price || 0),
                    total_price: Number(item.line_total || 0)
                })),
                is_waiter_order: true,
                is_captain_order: true,
                is_voided: isVoided
            };
        }).filter((row: any) => {
            if (!search) return true;
            return [
                row.order_number,
                row.short_code,
                row.customer_name,
                row.waiter_name,
                row.location
            ].join(' ').toLowerCase().includes(search);
        });

        res.json({ success: true, data: mapped });
    } catch (error) {
        next(error);
    }
};

/**
 * Mark a restaurant or bar order as fully paid
 * PATCH /api/cashier/unpaid-orders/:source/:id/pay
 */
export const markWaiterOrderPaid = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { source, id } = req.params;
        const {
            payment_method = 'cash',
            payment_amount,
            payment_reference,
            credit_bill_id,
            staff_credit_bill_id,
            skip_credit_bill_creation = false
        } = req.body;
        const amountTendered = Number(req.body.amount_tendered) || 0;
        const changeGiven = Number(req.body.change_given) || 0;

        const userRole = (req.user as any)?.role?.toLowerCase() || '';
        const isGlobal = isGlobalRole(userRole);
        const normalizedSource = String(source || '').toLowerCase();
        const isRestaurantOrder = normalizedSource === 'restaurant';
        const isPosCaptainOrder = ['pos', 'pos_shift_order', 'captain', 'captain_order'].includes(normalizedSource);
        const table = isRestaurantOrder ? 'restaurant_orders' : isPosCaptainOrder ? 'pos_shift_orders' : 'bar_orders';
        const amountField = isRestaurantOrder || isPosCaptainOrder ? 'total_amount' : 'total';
        const revenueType = isRestaurantOrder || isPosCaptainOrder ? 'restaurant' : 'bar';
        const waiterField = isPosCaptainOrder ? 'waiter_id' : 'created_by';
        const customerField = isPosCaptainOrder ? 'customer_name' : 'guest_name';
        const waiterSelect = waiterField === 'created_by' ? '' : `, ${waiterField}`;

        const { data: order, error: fetchErr } = await (supabase
            .from(table)
            .select(`id, status, payment_status, ${amountField}, amount_paid, balance_amount, order_number, short_code, created_by${waiterSelect}, ${customerField}${isPosCaptainOrder ? ', shift_id, outlet_id, staff_credit_bill_id, void_request_status' : ', branch_id, outlet_id'}`)
            .eq('id', id)
            .single() as any);

        if (fetchErr || !order) throw new AppError('Order not found', 404);
        if (isPosCaptainOrder) {
            const orderStatus = String((order as any).status || '').toLowerCase();
            const paymentStatus = String((order as any).payment_status || '').toLowerCase();
            const voidRequestStatus = String((order as any).void_request_status || '').toLowerCase();
            if (orderStatus === 'voided' || paymentStatus === 'voided' || ['approved','pending'].includes(voidRequestStatus)) {
                throw new AppError('This captain order has been voided and cannot be paid', 400);
            }
        }
        const totalAmount = Number((order as any)[amountField] || 0);
        const previousPaid = Number((order as any).amount_paid || 0);
        const currentBalance = Number((order as any).balance_amount || Math.max(0, totalAmount - previousPaid));
        const amountPaid = Number(payment_amount || currentBalance);
        if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
            throw new AppError('Payment amount must be greater than zero', 400);
        }
        if (amountPaid - currentBalance > 0.01) {
            throw new AppError('Payment amount cannot exceed the outstanding bill balance', 400);
        }

        const nextPaid = previousPaid + amountPaid;
        const nextBalance = Math.max(0, totalAmount - nextPaid);
        const isCleared = nextBalance <= 0.01;
        const normalizedMethod = String(payment_method || 'cash').toLowerCase();
        const completedStatus = isRestaurantOrder ? 'delivered' : isPosCaptainOrder ? 'paid' : 'completed';
        let orderBranchId = (order as any).branch_id;
        if (isPosCaptainOrder && !orderBranchId && (order as any).shift_id) {
            const { data: shift } = await supabase
                .from('pos_outlet_shifts')
                .select('branch_id')
                .eq('id', (order as any).shift_id)
                .maybeSingle();
            orderBranchId = shift?.branch_id;
        }

        if (!isGlobal) {
            const assignedOutlets = await loadAssignedPosOutlets(supabase, (req.user as any)?.id);
            const assignedIds = assignedOutletIds(assignedOutlets);

            let targetOutletId = (order as any).outlet_id;
            let outlet: any = null;

            if (targetOutletId) {
                const { data: outletData, error: outletError } = await supabase
                    .from('pos_outlets')
                    .select('id, name, outlet_type, branch_id')
                    .eq('id', targetOutletId)
                    .maybeSingle();
                if (outletError) throw outletError;
                outlet = outletData;
            }

            if (outlet) {
                if (Number(outlet.branch_id) !== Number((req.user as any)?.branch_id)) {
                    throw new AppError('Forbidden: order belongs to another branch', 403);
                }
                if (!canAccessPosOutlet(userRole, outlet, assignedOutlets, (req.user as any)?.branch_id ?? (req.user as any)?.branchId)) {
                    throw new AppError('Forbidden: this cashier cannot clear orders for this POS station', 403);
                }
            } else {
                // Fallback check based on role & assigned outlet types if outlet_id is not assigned
                const stationRestricted = shouldRestrictCashierStationAccess(userRole, assignedIds, (req.user as any)?.branch_id ?? (req.user as any)?.branchId);
                if (stationRestricted) {
                    const roleOutletTypes = stationTypesForCashierRole(userRole, (req.user as any)?.branch_id ?? (req.user as any)?.branchId);
                    const allowedTypes = new Set([
                        ...roleOutletTypes,
                        ...assignedOutlets.map(o => String(o.outlet_type || '').toLowerCase()).filter(Boolean)
                    ]);
                    
                    if (isRestaurantOrder) {
                        if (!allowedTypes.has('restaurant')) {
                            throw new AppError('Forbidden: this cashier is not authorized to clear restaurant bills', 403);
                        }
                    } else if (isPosCaptainOrder) {
                        if (allowedTypes.size === 0) {
                            throw new AppError('Forbidden: this cashier is not authorized to clear captain bills', 403);
                        }
                    } else { // bar order
                        const hasBarAccess = Array.from(allowedTypes).some(isBarStationType);
                        if (!hasBarAccess) {
                            throw new AppError('Forbidden: this cashier is not authorized to clear bar bills', 403);
                        }
                    }
                }
            }
        }

        let linkedStaffCreditBillId = staff_credit_bill_id || null;

        if (normalizedMethod === 'credit_bill' && !linkedStaffCreditBillId && !skip_credit_bill_creation) {
            // The credit bill is owed by the staff the cashier SELECTS (passed as
            // staff_id), not the waiter who served the order. Fall back to the
            // waiter only when no staff was selected.
            const selectedStaffRef = req.body.staff_id
                || (order as any)[waiterField]
                || (order as any).created_by;
            const { data: staffProfile } = await supabase
                .from('staff_profiles')
                .select('id, first_name, last_name')
                .or(`user_id.eq.${selectedStaffRef},id.eq.${selectedStaffRef}`)
                .maybeSingle();

            if (staffProfile?.id) {
                const billNumber = (order as any).order_number || (order as any).short_code || id;
                const staffLabel = req.body.staff_name
                    || `${staffProfile.first_name || ''} ${staffProfile.last_name || ''}`.trim();
                const { data: staffCreditBill } = await supabase.from('staff_credit_bills').insert({
                    staff_id: staffProfile.id,
                    amount: amountPaid,
                    paid_amount: 0,
                    balance: amountPaid,
                    description: `Credit bill for ${staffLabel || 'staff'} — ${isPosCaptainOrder ? 'captain POS' : normalizedSource} order ${billNumber}`,
                    bill_date: new Date().toISOString().slice(0, 10),
                    status: 'pending',
                    branch_id: orderBranchId,
                    ...(isPosCaptainOrder ? { source_pos_order_id: id } : {})
                }).select('id').single();

                if (isPosCaptainOrder && staffCreditBill?.id) {
                    linkedStaffCreditBillId = staffCreditBill.id;
                    await supabase
                        .from('pos_shift_orders')
                        .update({ staff_credit_bill_id: staffCreditBill.id, updated_at: new Date().toISOString() })
                        .eq('id', id);
                }
            }
        }

        if (isPosCaptainOrder && linkedStaffCreditBillId) {
            await supabase
                .from('pos_shift_orders')
                .update({ staff_credit_bill_id: linkedStaffCreditBillId, updated_at: new Date().toISOString() })
                .eq('id', id);
        }

        const updatePayload: Record<string, any> = {
            payment_status: isCleared ? (isPosCaptainOrder && normalizedMethod === 'credit_bill' ? 'credit_bill' : 'paid') : 'partial',
            status: isCleared ? (normalizedMethod === 'credit_bill' && isPosCaptainOrder ? 'credit_bill' : completedStatus) : (order as any).status,
            amount_paid: nextPaid,
            balance_amount: nextBalance,
            updated_at: new Date().toISOString()
        };
        if (!isPosCaptainOrder) {
            updatePayload.payment_method = payment_method;
            if (isCleared) updatePayload.paid_at = new Date().toISOString();
        }

        const { error: updateErr } = await supabase
            .from(table)
            .update(updatePayload)
            .eq('id', id);

        if (updateErr) throw updateErr;

        if (isPosCaptainOrder) {
            try {
                await supabase.from('pos_shift_payments').insert({
                    shift_id: (order as any).shift_id,
                    outlet_id: (order as any).outlet_id,
                    order_id: id,
                    payment_method: normalizedMethod,
                    amount: amountPaid,
                    reference: payment_reference || `${normalizedMethod}-${Date.now()}`,
                    credit_bill_id: credit_bill_id || null,
                    staff_credit_bill_id: linkedStaffCreditBillId || null,
                    received_by: req.user?.id
                });
            } catch (posPaymentErr) {
                logger.warn('Could not record POS shift payment for cashier order clearance:', posPaymentErr);
            }
        }

        // Record cashier transaction for audit trail
        try {
            const { data: txNumber } = await supabase.rpc('generate_cashier_transaction_number');
            const transactionNumber = txNumber || `CT${Date.now()}`;
            const { data: cashierTransaction, error: cashierTransactionError } = await supabase.from('cashier_transactions').insert({
                transaction_number: transactionNumber,
                branch_id: orderBranchId,
                cashier_id: req.user?.id,
                transaction_type: 'payment',
                revenue_type: revenueType,
                reference_type: table,
                reference_id: (order as any).id,
                payment_method,
                amount: amountPaid,
                amount_tendered: amountTendered,
                change_given: changeGiven,
                payment_reference,
                credit_bill_id: credit_bill_id || null,
                customer_name: (order as any)[customerField] || (order as any).order_number
            }).select('id, transaction_number').single();
            if (cashierTransactionError) throw cashierTransactionError;
            await recordActiveShiftSale({
                cashierId: req.user?.id,
                branchId: orderBranchId,
                transactionId: cashierTransaction?.id || String((order as any).id),
                transactionRef: cashierTransaction?.transaction_number || transactionNumber,
                paymentMethod: payment_method,
                amount: amountPaid
            });
        } catch (txErr) {
            logger.warn('Could not record cashier transaction for order payment:', txErr);
        }

        res.json({
            success: true,
            message: isCleared ? 'Order cleared' : 'Partial payment recorded',
            data: {
                id,
                payment_status: isCleared
                    ? (isPosCaptainOrder && normalizedMethod === 'credit_bill'
                        ? 'credit_bill'
                        : 'paid')
                    : 'partial',
                amount_paid: nextPaid,
                balance_amount: nextBalance,
                staff_credit_bill_id: linkedStaffCreditBillId,
                credit_number: linkedStaffCreditBillId
            }
        });
    } catch (error) {
        next(error);
    }
};
