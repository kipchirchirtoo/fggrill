import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import db from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { migratePendingBills } from '../jobs/migrate-pending-bills.job';
import { paymentVerificationService } from '../services/payment.verification.service';
import { mpesaService } from '../services/mpesa.service';
import notificationService from '../services/notification.service';
import { deductIngredientsForItem } from './kitchen/recipes.controller';
import { applyBranchFilter, isGlobalRole } from '../utils/branchIsolation';
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

const PUBLIC_SHORT_CODE_PATTERN = /^(?:[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}|[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6})$/;

type CashierShortCodeResolution = {
    source: string;
    lookupId: string;
    row?: any;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
        .select('id, first_name, last_name, id_number, department, branch_id, user_id')
        .limit(1);

    if (UUID_PATTERN.test(staffKey)) {
        query = query.or(`id.eq.${staffKey},user_id.eq.${staffKey}`);
    } else {
        const safeStaffKey = staffKey.replace(/[(),]/g, '');
        query = query.eq('id_number', safeStaffKey);
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
        name: staffName || staff.id_number || 'Staff',
        employeeId: staff.id_number || null,
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

/**
 * Get Bill Details by Booking ID (or Barcode)
 */
export const getBillDetails = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { bookingId } = req.params;

        if (!bookingId) {
            throw new AppError('ID is required', 400);
        }

        let searchId = bookingId.toUpperCase();
        const scannedCodeResolution = await resolveCashierScannedCode(searchId, req);
        if (scannedCodeResolution) {
            searchId = scannedCodeResolution.lookupId;
        }

        const shortCodeResolution = await resolveCashierShortCode(searchId, req);
        if (shortCodeResolution) {
            if (shortCodeResolution.source === 'payment') {
                const payment = shortCodeResolution.row;
                res.json({
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
                });
                return;
            }
            searchId = shortCodeResolution.lookupId;
        }

        // Check if it's an accounting invoice (starts with INV)
        if (searchId.startsWith('INV')) {
            // First check accounting_ar_invoices
            const { data: arInvoice, error: arError } = await supabase
                .from('accounting_ar_invoices')
                .select(`
                    *,
                    customer:accounting_customers(id, customer_name, email, phone)
                `)
                .eq('invoice_number', searchId)
                .single();

            if (!arError && arInvoice) {
                res.json({
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
                });
                return;
            }

            // If not found in accounting, check finance_invoices
            const { data: finInvoice, error: finError } = await supabase
                .from('finance_invoices')
                .select('*')
                .eq('invoice_number', searchId)
                .single();

            if (finInvoice) {
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
                            items: [] // finance_invoices might need a joined query for items if detail is needed
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

            throw new AppError('Invoice not found in any ledger', 404);
        }

        // Check if it's a hotel reservation (starts with HTL)
        if (searchId.startsWith('HTL')) {
            let hotelQuery = supabase
                .from('reservations')
                .select(`
                    *,
                    room:rooms(room_number, branch_id)
                `)
                .eq('confirmation_number', searchId);

            const { data: reservation, error: resError } = await hotelQuery.single();

            if (resError || !reservation) {
                throw new AppError('Hotel reservation not found', 404);
            }

            const totalAmount = parseFloat(reservation.total_amount || 0);
            const paidAmount = parseFloat(reservation.amount_paid || reservation.deposit_amount || 0);
            const balance = totalAmount - paidAmount;

            res.json({
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
                        items: [{
                            name: `Accommodation Services (${reservation.room_type || 'Room'})`,
                            quantity: 1,
                            price: totalAmount,
                            total: totalAmount
                        }]
                    },
                    financials: {
                        total_amount: totalAmount,
                        amount_paid: paidAmount,
                        balance: balance,
                        currency: 'KES'
                    },
                    payment_status: balance <= 0 ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid')
                }
            });
            return;
        }

        // Check if it's a restaurant order (starts with ORD)
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
                .or(`order_number.eq.${searchId},short_code.eq.${searchId}`);

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
            const balance = Number(posOrder.balance_amount ?? Math.max(0, totalAmount - amountPaid));

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
                    room:rooms!room_id(number, branch_id, type:room_types(name, price))
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
                    room:rooms!room_id(number, branch_id, type:room_types(name, price))
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

        // Fallback: Check if it's a Room Number for an active (checked-in) booking
        let roomQuery = supabase
            .from('reservations')
            .select(`
                *,
                room:rooms!room_id!inner(number, branch_id, type:room_types(name, price))
            `)
            .eq('room.number', bookingId)
            .eq('status', 'checked_in');

        if (req.user?.branch_id) {
            roomQuery = roomQuery.eq('room.branch_id', req.user.branch_id);
        }

        const { data: roomBooking, error: roomError } = await roomQuery.maybeSingle();

        if (roomBooking) {
            await fetchHotelBillResponse(roomBooking, res);
            return;
        }

        throw new AppError('Bill or Booking not found', 404);

    } catch (error) {
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
        const { data: shift } = await supabase
            .from('cashier_shift_logs')
            .select('id')
            .eq('cashier_id', cashierId)
            .eq('status', 'open')
            .single();

        if (!shift) return;

        const { error } = await supabase.from('cashier_shift_transactions').insert({
            shift_id: shift.id,
            transaction_id: paymentId,
            transaction_ref: paymentRef,
            payment_method: paymentMethod?.toUpperCase(),
            amount,
            transaction_time: new Date().toISOString()
        });


        if (error) {


          console.error('Database error:', error);


          throw error;


        }
    } catch {
        // Non-critical — don't fail the payment if shift linking fails
    }
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
                const { error } = await supabase.from('cashier_transactions').insert({
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
                const { error } = await supabase.from('cashier_transactions').insert({
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
                .select('id, total_amount')
                .eq('order_number', bookingId);
            orderQuery = applyBranchFilter(orderQuery, req);
            const { data: order, error: orderError } = await orderQuery.single();

            if (orderError || !order) {
                throw new AppError('Restaurant order not found', 404);
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
                .select('id, total')
                .eq('order_number', bookingId);
            orderQuery = applyBranchFilter(orderQuery, req);
            const { data: order, error: orderError } = await orderQuery.single();

            if (orderError || !order) {
                throw new AppError('Bar order not found', 404);
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
                const { error } = await supabase.from('cashier_transactions').insert({
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
        if (resolvedSource === 'pos_shift_order' || bookingId.startsWith('POS-')) {
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

            const resolvedPosOrderId = shortCodeResolution?.source === 'pos_shift_order' &&
                UUID_PATTERN.test(String(shortCodeResolution.row?.id || ''))
                ? String(shortCodeResolution.row.id)
                : null;

            let orderQuery = supabase
                .from('pos_shift_orders')
                .select('*');

            orderQuery = resolvedPosOrderId
                ? orderQuery.eq('id', resolvedPosOrderId)
                : orderQuery.eq('order_number', bookingId);

            const { data: order, error: orderError } = await orderQuery.maybeSingle();

            if (orderError) throw new AppError(`POS order lookup failed: ${orderError.message}`, 500);
            if (!order) throw new AppError('POS order not found', 404);

            const { data: shift, error: shiftError } = await supabase
                .from('pos_outlet_shifts')
                .select('id, branch_id, outlet_id, outlet:pos_outlets(name, outlet_type)')
                .eq('id', order.shift_id)
                .maybeSingle();

            if (shiftError) throw new AppError(`POS shift lookup failed: ${shiftError.message}`, 500);
            if (!shift) throw new AppError('POS shift not found for order', 404);

            const userBranchId = parseBranchId(req.user?.branch_id ?? req.user?.branchId);
            if (!isGlobalRole(req.user?.role) && userBranchId && Number(shift.branch_id) !== userBranchId) {
                throw new AppError('Forbidden: POS order belongs to another branch', 403);
            }

            if (['paid', 'credit_bill', 'voided'].includes(String(order.payment_status || '').toLowerCase())) {
                throw new AppError('POS order is already cleared', 409);
            }

            const totalAmount = Number(order.total_amount || 0);
            const currentPaid = Number(order.amount_paid || 0);
            const currentBalance = Math.max(0, Number(order.balance_amount || 0) || totalAmount - currentPaid);
            const paymentAmount = Number(amount);
            if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
                throw new AppError('Payment amount must be greater than zero', 400);
            }
            if (paymentAmount - currentBalance > 0.01) {
                throw new AppError('Payment cannot exceed remaining POS bill balance', 400);
            }

            const { data: payment, error: paymentError } = await supabase
                .from('pos_shift_payments')
                .insert({
                    shift_id: order.shift_id,
                    outlet_id: order.outlet_id || shift.outlet_id,
                    order_id: order.id,
                    payment_method: paymentMethod,
                    amount: paymentAmount,
                    reference: reference || `${paymentMethod}-${Date.now()}`,
                    received_by: req.user?.id
                })
                .select('*')
                .single();

            if (paymentError || !payment) {
                throw new AppError(`POS payment recording failed: ${paymentError?.message || 'Unknown error'}`, 500);
            }

            const nextPaid = currentPaid + paymentAmount;
            const nextBalance = Math.max(0, totalAmount - nextPaid);
            const isCleared = nextBalance <= 0.01;
            const nextPaymentStatus = isCleared
                ? paymentMethod === 'credit_bill' ? 'credit_bill' : 'paid'
                : 'partial';

            const { error: updateError } = await supabase
                .from('pos_shift_orders')
                .update({
                    amount_paid: nextPaid,
                    balance_amount: nextBalance,
                    payment_status: nextPaymentStatus,
                    status: isCleared ? nextPaymentStatus : order.status,
                    updated_at: new Date().toISOString()
                })
                .eq('id', order.id);

            if (updateError) {
                throw new AppError(`Failed to update POS order balance: ${updateError.message}`, 500);
            }

            try {
                const outlet = Array.isArray((shift as any).outlet) ? (shift as any).outlet[0] : (shift as any).outlet;
                const { data: txNumber } = await supabase.rpc('generate_cashier_transaction_number');
                await supabase.from('cashier_transactions').insert({
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
                    const { error } = await supabase.from('cashier_transactions').insert({
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

                const { error } = await supabase.from('cashier_transactions').insert({
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
                const { error } = await supabase.from('cashier_transactions').insert({
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
            .select(`
                *,
                branch:branches!shift_transactions_branch_id_fkey(name)
            `)
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
                paid_amount: resv.advance_payment || 0,
                balance_amount: Number(resv.total_amount) - Number(resv.advance_payment || 0),
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

            // Combine all full access data
            combinedData = [
                ...combinedData,
                ...(unpaidBills || []),
                ...mappedHotel,
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
            due_date,
            remarks,
            items
        } = req.body;

        const effectiveBranchId = resolveCashierBranchId(req, branch_id);
        const waiterProfile = waiter_id
            ? await resolveCashierCreditStaffProfile(waiter_id, effectiveBranchId)
            : null;

        // Generate bill number
        const { data: billNumberData } = await supabase
            .rpc('generate_bill_number');

        const bill_number = billNumberData || `BILL${Date.now()}`;
        const normalizedBillNumber = String(bill_number).toUpperCase().replace(/[^A-Z0-9]/g, '');
        const scan_reference = `CCB-${normalizedBillNumber}`;

        const { data, error } = await supabase
            .from('unpaid_bills')
            .insert({
                bill_number,
                branch_id: effectiveBranchId,
                bill_type,
                reference_type,
                reference_id,
                customer_type,
                customer_id,
                customer_name: customer_name || waiterProfile?.name,
                room_number,
                waiter_id: waiterProfile?.id || waiter_id,
                total_amount,
                balance_amount: total_amount,
                payment_terms,
                due_date,
                remarks,
                items: items || [],
                scan_reference,
                status: 'unpaid',
                created_by: req.user?.id
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

/**
 * Record payment for unpaid bill
 */
export const recordBillPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const { payment_amount, payment_method, payment_reference, credit_bill_id } = req.body;
        const paymentAmount = Number(payment_amount || 0);

        if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
            throw new AppError('Payment amount must be greater than zero', 400);
        }

        // Fetch current bill
        const { data: bill, error: fetchError } = await supabase
            .from('unpaid_bills')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;
        if (!bill) {
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

        await supabase
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
                payment_reference,
                customer_name: bill.customer_name
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
                waiter:users!created_by(id, first_name, last_name),
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
                waiter:users!created_by(id, first_name, last_name),
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

        const formatDate = (value?: string | null) => {
            if (!value) return null;
            const parsed = new Date(value);
            if (Number.isNaN(parsed.getTime())) return null;
            return parsed.toISOString().split('T')[0];
        };

        const waiterName = (row: any) => {
            const waiter = Array.isArray(row?.waiter) ? row.waiter[0] : row?.waiter;
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
            updateData.accountant_id = req.user?.id;
        } else if (role === 'auditor') {
            if (bill.auditor_confirmed_at) {
                throw new AppError('Bill already confirmed by auditor', 400);
            }
            // Optional: require accountant confirmation first
            // if (!bill.accountant_confirmed_at) throw new AppError('Accountant confirmation required first', 400);

            updateData.auditor_confirmed_at = new Date().toISOString();
            updateData.auditor_id = req.user?.id;
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

        if (staff_id) {
            params.push(staff_id as string);
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

        // Calculate monthly deduction
        const monthly_deduction = totalAmount / (deduction_months || 1);

        // Generate credit number
        const { data: creditNumberData } = await supabase
            .rpc('generate_credit_number');

        const credit_number = creditNumberData || `CR${Date.now()}`;

        const { data, error } = await supabase
            .from('credit_bills')
            .insert({
                credit_number,
                branch_id: effectiveBranchId,
                staff_id: staffProfile.id,
                staff_name: staff_name || staffProfile.name,
                employee_id: employee_id || staffProfile.employeeId,
                department: department || staffProfile.department,
                bill_type,
                reference_type,
                reference_id,
                total_amount: totalAmount,
                balance_amount: totalAmount,
                due_date,
                payment_method,
                deduction_months: deduction_months || 1,
                monthly_deduction,
                remarks,
                status: 'active',
                approval_status: 'pending',
                created_by: req.user?.id
            })
            .select()
            .single();

        if (error) throw error;

        const payrollPayload: any = {
            staff_id: staffProfile.id,
            amount: totalAmount,
            description: `Cashier Credit Bill - ${credit_number} - ${staff_name || staffProfile.name}`,
            bill_date: new Date().toISOString().slice(0, 10),
            status: 'pending',
            branch_id: effectiveBranchId,
            balance: totalAmount,
            source_cashier_credit_bill_id: data.id
        };

        const { data: staffCreditBill, error: staffCreditError } = await supabase
            .from('staff_credit_bills')
            .insert(payrollPayload)
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
        const { role } = req.body; // 'accountant' or 'auditor'

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
        if (role === 'accountant') {
            if (bill.accountant_confirmed_at) {
                throw new AppError('Credit bill already confirmed by accountant', 400);
            }
            updateData.accountant_confirmed_at = new Date().toISOString();
            updateData.accountant_id = req.user?.id;
        } else if (role === 'auditor') {
            if (bill.auditor_confirmed_at) {
                throw new AppError('Credit bill already confirmed by auditor', 400);
            }
            // if (!bill.accountant_confirmed_at) throw new AppError('Accountant confirmation required first', 400);

            updateData.auditor_confirmed_at = new Date().toISOString();
            updateData.auditor_id = req.user?.id;

            // If both are confirmed, we could optionally update approval_status to 'confirmed'
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
                    status: payrollBalance <= 0 ? 'paid_cash' : 'partial'
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
                        payment_method: String(payment_method || 'cash').toLowerCase().includes('mpesa')
                            ? 'mpesa'
                            : String(payment_method || 'cash').toLowerCase().includes('bank')
                                ? 'bank'
                                : 'cash',
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

        await supabase
            .from('cashier_transactions')
            .insert({
                transaction_number,
                branch_id: credit.branch_id,
                cashier_id: req.user?.id,
                transaction_type: 'payment',
                revenue_type: 'staff_credit',
                reference_type: 'credit_bill',
                reference_id: credit.id,
                payment_method,
                amount: paymentAmount,
                payment_reference,
                customer_name: credit.staff_name
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

        res.json({
            success: true,
            message: 'Cashier shifts retrieved successfully',
            data
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

        // Get all transactions for this shift
        const { data: transactions } = await supabase
            .from('cashier_transactions')
            .select('*')
            .eq('shift_id', id);

        // Calculate totals
        const total_cash = transactions?.filter(t => t.payment_method === 'cash')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;

        const total_mpesa = transactions?.filter(t => t.payment_method === 'mpesa')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;

        const total_card = transactions?.filter(t => t.payment_method === 'card')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;

        const total_revenue = transactions?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;

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
                status: status || 'open',
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

        if (logbook.status !== 'open') {
            throw new AppError('Only open logbooks can be submitted for audit', 400);
        }

        // Update status to pending_audit
        const { data: updated, error: updateError } = await supabase
            .from('cashier_logbooks')
            .update({
                status: 'pending_audit',
                submitted_at: new Date(),
                updated_at: new Date()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Notify Auditor and Accountant — scoped to the cashier's branch
        const cashierBranchId = req.user?.branch_id;
        const notificationData = {
            type: 'warning' as const,
            category: 'audit',
            priority: 'medium' as const,
            branchId: cashierBranchId,
            actionUrl: `/dashboard/auditor/financial-verification`,
            metadata: { logbook_id: id, type: 'cashier_logbook', cashier_id }
        };

        // 1. Notify Auditor
        notificationService.notifyRole('auditor', 'Cashier Logbook Submission', `Cashier logbook for ${logbook.type} has been submitted for audit.`, notificationData)
            .catch(e => logger.error('Failed to notify auditor of logbook submission', e));

        // 2. Notify Accountant
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
        const branch_id = req.headers['x-branch-id'];
        const requestedStatus = req.query.status as string | undefined;
        const reviewerRole = String(req.user?.role || '').toLowerCase();
        const defaultStatus = ['branch_accountant', 'accountant'].includes(reviewerRole)
            ? 'pending_accountant_review'
            : 'pending_audit';
        const status = requestedStatus || defaultStatus;
        const { from_date, to_date } = req.query;

        let query = supabase
            .from('cashier_logbooks')
            .select(`
                *,
                branch:branches(id, name),
                lines:cashier_logbook_lines!logbook_id(id, section, customer_name, amount, reference)
            `)
            .eq('status', status)
            .order('log_date', { ascending: false });

        query = applyBranchFilter(query, req);
        const isGlobal = isGlobalRole(req.user?.role);

        if (isGlobal && branch_id) {
            query = query.eq('branch_id', branch_id);
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
        const decoratedLogbooks = (logbooks || []).map((logbook: any) => ({
            ...logbook,
            cashier: usersById.get(String(logbook.cashier_id || '')) || null
        }));

        res.json({
            success: true,
            data: decoratedLogbooks
        });

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
                        created_by: req.user?.id
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
        const { date, branch_id } = req.query;
        const targetDate = date ? (date as string) : new Date().toISOString().split('T')[0];

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

        res.json({
            success: true,
            data: {
                date: targetDate,
                summary: totals,
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
        const search = String(req.query.search || '').trim().toLowerCase();
        const requestedDate = String(req.query.date || '').trim();
        const date = requestedDate || new Date().toISOString().slice(0, 10);
        const from = req.query.from_date
            ? new Date(String(req.query.from_date))
            : new Date(`${date}T00:00:00.000Z`);
        const to = req.query.to_date
            ? new Date(String(req.query.to_date))
            : new Date(`${date}T23:59:59.999Z`);
        const requestedOutletId = String(req.query.outlet_id || '').trim();
        const requestedOutletType = String(req.query.outlet_type || '').trim().toLowerCase();
        const assignedOutlets = await loadAssignedPosOutlets(supabase, (req.user as any)?.id);
        const assignedIds = assignedOutletIds(assignedOutlets);
        const roleOutletTypes = stationTypesForCashierRole(userRole);
        const stationRestricted = shouldRestrictCashierStationAccess(userRole, assignedIds);
        const allowedOutletTypes = new Set([
            ...roleOutletTypes,
            ...assignedOutlets.map((outlet) => String(outlet.outlet_type || '').toLowerCase()).filter(Boolean)
        ]);
        const canSeeLegacyRestaurant = !stationRestricted || allowedOutletTypes.has('restaurant');
        const canSeeLegacyBar = !stationRestricted || Array.from(allowedOutletTypes).some(isBarStationType);

        // Fetch pending restaurant orders
        let restaurantOrders: any[] = [];
        if (canSeeLegacyRestaurant && (!requestedOutletType || requestedOutletType === 'restaurant')) {
            let restaurantQuery = supabase
                .from('restaurant_orders')
                .select(`
                    id, order_number, short_code, status, payment_status,
                    table_number, room_number, guest_name,
                    total_amount, amount_paid, balance_amount, created_at, branch_id, created_by,
                    waiter:users!created_by(id, first_name, last_name),
                    items:restaurant_order_items(
                        id, quantity, unit_price, total_price,
                        menu_item:restaurant_menu_items(name)
                    )
                `)
                .neq('payment_status', 'paid')
                .neq('status', 'cancelled')
                .gte('created_at', from.toISOString())
                .lte('created_at', to.toISOString())
                .order('created_at', { ascending: false });

            if (effectiveBranchId) restaurantQuery = restaurantQuery.eq('branch_id', effectiveBranchId);
            if (status !== 'all') restaurantQuery = restaurantQuery.eq('payment_status', status);

            const { data, error: rErr } = await restaurantQuery;
            if (rErr && rErr.code !== '42703') throw rErr;
            restaurantOrders = data || [];
        }

        // Fetch pending bar orders
        let barOrders: any[] = [];
        if (canSeeLegacyBar && (!requestedOutletType || isBarStationType(requestedOutletType))) {
            let barQuery = supabase
                .from('bar_orders')
                .select(`
                    id, order_number, short_code, status, payment_status,
                    seat_number, room_number, guest_name,
                    total, amount_paid, balance_amount, created_at, branch_id, created_by,
                    waiter:users!created_by(id, first_name, last_name),
                    items:bar_order_items(id, drink_name, quantity, unit_price, total_price)
                `)
                .neq('payment_status', 'paid')
                .neq('status', 'cancelled')
                .gte('created_at', from.toISOString())
                .lte('created_at', to.toISOString())
                .order('created_at', { ascending: false });

            if (effectiveBranchId) barQuery = barQuery.eq('branch_id', effectiveBranchId);
            if (status !== 'all') barQuery = barQuery.eq('payment_status', status);

            const { data, error: bErr } = await barQuery;
            if (bErr && bErr.code !== '42703') throw bErr;
            barOrders = data || [];
        }

        let posOrders: any[] = [];
        let posShiftIds: string[] = [];
        let shiftLookup: Record<string, any> = {};
        try {
            let posShiftQuery = supabase
                .from('pos_outlet_shifts')
                .select('id, branch_id, outlet_id, cashier_id, outlet:pos_outlets(id, name, outlet_type, branch_id)');
            if (effectiveBranchId) posShiftQuery = posShiftQuery.eq('branch_id', effectiveBranchId);
            const { data: posShifts, error: posShiftErr } = await posShiftQuery;
            if (posShiftErr) throw posShiftErr;

            const visibleShifts = ((posShifts || []) as any[]).filter((shift: any) => {
                const outlet = Array.isArray(shift.outlet) ? shift.outlet[0] : shift.outlet;
                if (requestedOutletId && String(shift.outlet_id) !== requestedOutletId) return false;
                if (requestedOutletType && String(outlet?.outlet_type || '').toLowerCase() !== requestedOutletType) return false;
                return canAccessPosOutlet(userRole, outlet, assignedOutlets);
            });

            shiftLookup = Object.fromEntries(visibleShifts.map((shift: any) => [shift.id, shift]));
            posShiftIds = Object.keys(shiftLookup);
            if (posShiftIds.length) {
                const allowedStatuses = status === 'all' ? ['unpaid', 'partial'] : [status];
                const { data: fetchedPosOrders, error: posErr } = await supabase
                    .from('pos_shift_orders')
                    .select('*')
                    .in('shift_id', posShiftIds)
                    .in('payment_status', allowedStatuses)
                    .neq('status', 'cancelled')
                    .gte('created_at', from.toISOString())
                    .lte('created_at', to.toISOString())
                    .order('created_at', { ascending: false });
                if (posErr) throw posErr;
                posOrders = fetchedPosOrders || [];
            }
        } catch (posError: any) {
            if (!['42P01', '42703', 'PGRST205', 'PGRST204'].includes(posError?.code)) {
                throw posError;
            }
        }

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
                balance_amount: Number(o.balance_amount || o.total_amount || 0),
                payment_status: o.payment_status,
                status: o.payment_status,
                created_at: o.created_at,
                bill_date: o.created_at,
                branch_id: o.branch_id,
                waiter: Array.isArray(o.waiter) ? o.waiter[0] : o.waiter,
                waiter_id: o.created_by,
                waiter_name: (() => {
                    const waiter = Array.isArray(o.waiter) ? o.waiter[0] : o.waiter;
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
                balance_amount: Number(o.balance_amount || o.total || 0),
                payment_status: o.payment_status,
                status: o.payment_status,
                created_at: o.created_at,
                bill_date: o.created_at,
                branch_id: o.branch_id,
                waiter: Array.isArray(o.waiter) ? o.waiter[0] : o.waiter,
                waiter_id: o.created_by,
                waiter_name: (() => {
                    const waiter = Array.isArray(o.waiter) ? o.waiter[0] : o.waiter;
                    return waiter ? `${waiter.first_name || ''} ${waiter.last_name || ''}`.trim() : '';
                })(),
                items: o.items || [],
                is_waiter_order: true
            })),
            ...posOrders.map((o: any) => {
                const items = Array.isArray(o.items) ? o.items : [];
                const shift = shiftLookup[o.shift_id];
                const outlet = Array.isArray(shift?.outlet) ? shift.outlet[0] : shift?.outlet;
                const stationName = outlet?.name || stationDisplayName(outlet?.outlet_type);
                return {
                    id: o.id,
                    source: 'pos',
                    source_type: 'CAPTAIN_ORDER',
                    bill_type: 'pos_shift_order',
                    bill_label: 'Captain Order',
                    order_number: o.order_number,
                    bill_number: o.order_number,
                    short_code: o.short_code,
                    location: o.customer_name || stationName,
                    guest_name: o.customer_name || 'Walk-in',
                    customer_name: o.customer_name || 'Walk-in',
                    total_amount: Number(o.total_amount || 0),
                    paid_amount: Number(o.amount_paid || 0),
                    balance_amount: Number(o.balance_amount || o.total_amount || 0),
                    payment_status: o.payment_status === 'paid' ? 'cleared' : o.payment_status,
                    status: o.payment_status === 'paid' ? 'cleared' : o.payment_status,
                    created_at: o.created_at,
                    bill_date: o.created_at,
                    branch_id: shift?.branch_id || effectiveBranchId,
                    outlet_id: o.outlet_id || shift?.outlet_id,
                    outlet_type: outlet?.outlet_type || null,
                    outlet_name: outlet?.name || null,
                    station_name: stationName,
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
                    is_captain_order: true
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
            .select(`id, status, ${amountField}, amount_paid, balance_amount, order_number, short_code, created_by${waiterSelect}, ${customerField}${isPosCaptainOrder ? ', shift_id, outlet_id, staff_credit_bill_id' : ', branch_id'}`)
            .eq('id', id)
            .single() as any);

        if (fetchErr || !order) throw new AppError('Order not found', 404);
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

        if (isPosCaptainOrder) {
            const { data: outlet, error: outletError } = await supabase
                .from('pos_outlets')
                .select('id, name, outlet_type, branch_id')
                .eq('id', (order as any).outlet_id)
                .maybeSingle();
            if (outletError) throw outletError;
            if (!outlet) throw new AppError('POS station not found for this captain order', 404);
            if (!isGlobal && Number(outlet.branch_id) !== Number((req.user as any)?.branch_id)) {
                throw new AppError('Forbidden: captain order belongs to another branch', 403);
            }
            const assignedOutlets = await loadAssignedPosOutlets(supabase, (req.user as any)?.id);
            if (!canAccessPosOutlet(userRole, outlet, assignedOutlets)) {
                throw new AppError('Forbidden: this cashier cannot clear orders for this POS station', 403);
            }
        }

        let linkedStaffCreditBillId = staff_credit_bill_id || null;

        if (normalizedMethod === 'credit_bill' && !linkedStaffCreditBillId && !skip_credit_bill_creation) {
            const waiterUserId = (order as any)[waiterField] || (order as any).created_by;
            const { data: staffProfile } = await supabase
                .from('staff_profiles')
                .select('id, first_name, last_name')
                .or(`user_id.eq.${waiterUserId},id.eq.${waiterUserId}`)
                .maybeSingle();

            if (staffProfile?.id) {
                const billNumber = (order as any).order_number || (order as any).short_code || id;
                const { data: staffCreditBill } = await supabase.from('staff_credit_bills').insert({
                    staff_id: staffProfile.id,
                    amount: amountPaid,
                    description: `Uncleared ${isPosCaptainOrder ? 'captain POS' : normalizedSource} order ${billNumber} migrated from cashier`,
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
            await supabase.from('cashier_transactions').insert({
                transaction_number: txNumber || `CT${Date.now()}`,
                branch_id: orderBranchId,
                cashier_id: req.user?.id,
                transaction_type: 'payment',
                revenue_type: revenueType,
                reference_type: table,
                reference_id: (order as any).id,
                payment_method,
                amount: amountPaid,
                payment_reference,
                credit_bill_id: credit_bill_id || null,
                customer_name: (order as any)[customerField] || (order as any).order_number
            });
        } catch (txErr) {
            logger.warn('Could not record cashier transaction for order payment:', txErr);
        }

        res.json({
            success: true,
            message: isCleared ? 'Order cleared' : 'Partial payment recorded',
            data: {
                id,
                payment_status: isCleared ? 'paid' : 'partial',
                amount_paid: nextPaid,
                balance_amount: nextBalance
            }
        });
    } catch (error) {
        next(error);
    }
};
