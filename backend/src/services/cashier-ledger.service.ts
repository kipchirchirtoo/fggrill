import { PoolClient } from 'pg';
import { logger } from '../utils/logger';

export interface LedgerTotals {
    // Payment Method totals
    total_cash: number;
    total_mpesa: number;
    total_card: number;
    total_credit_bill: number;
    total_bank_transfer: number;
    total_other: number;
    
    // Revenue Stream totals
    rooms_revenue: number;
    restaurant_revenue: number;
    bar_revenue: number;
    conference_revenue: number;
    pool_revenue: number;
    other_revenue: number;
    
    // Aggregated figures
    cash_collections: number;
    cash_refunds: number;
    payouts: number;
    gross_collections: number;
    transaction_count: number;

    unmapped_transactions: any[];
}

const normalizeKey = (value?: string | null) =>
    String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');

export const calculateCashierShiftLedgerTotals = async (
    cashierShiftLogId: string,
    branchId: number,
    client: PoolClient
): Promise<LedgerTotals> => {
    // Fetch shift info to infer revenue stream for POS transactions
    const shiftRes = await client.query(
        `SELECT cashier_name, type, notes FROM cashier_shift_logs WHERE id = $1`,
        [cashierShiftLogId]
    );
    const shiftInfo = shiftRes.rows[0] || {};
    const cashierNameUpper = String(shiftInfo.cashier_name || '').toUpperCase();
    const shiftTypeUpper = String(shiftInfo.type || '').toUpperCase();
    const shiftNotesUpper = String(shiftInfo.notes || '').toUpperCase();

    const isDefaultBarShift = cashierNameUpper.includes('BAR') || shiftTypeUpper.includes('BAR') || shiftNotesUpper.includes('BAR');
    const isDefaultRestaurantShift = cashierNameUpper.includes('RESTAURANT') || shiftTypeUpper.includes('RESTAURANT') || shiftNotesUpper.includes('RESTAURANT');
    const isDefaultRoomsShift = cashierNameUpper.includes('RECEPTION') || cashierNameUpper.includes('FRONT') || shiftTypeUpper.includes('ROOM');

    // 1. Fetch canonical transactions for this shift (combining Room/Front-Desk transactions from
    // cashier_transactions AND POS/Restaurant/Bar transactions from cashier_shift_transactions)
    const query = `
        SELECT 
            id, amount, amount_tendered, change_given, 
            payment_method, revenue_type, transaction_type, status,
            source_module, source_document_type
        FROM cashier_transactions
        WHERE cashier_shift_log_id = $1
          AND branch_id = $2

        UNION ALL

        SELECT 
            id, amount, amount as amount_tendered, 0 as change_given,
            payment_method, 'POS_SALE' as revenue_type, 'PAYMENT' as transaction_type,
            CASE WHEN is_voided = true THEN 'voided' ELSE 'completed' END as status,
            'POS' as source_module, 'POS_ORDER' as source_document_type
        FROM cashier_shift_transactions
        WHERE shift_id = $1
    `;
    const { rows } = await client.query(query, [cashierShiftLogId, branchId]);

    const totals: LedgerTotals = {
        total_cash: 0,
        total_mpesa: 0,
        total_card: 0,
        total_credit_bill: 0,
        total_bank_transfer: 0,
        total_other: 0,
        
        rooms_revenue: 0,
        restaurant_revenue: 0,
        bar_revenue: 0,
        conference_revenue: 0,
        pool_revenue: 0,
        other_revenue: 0,
        
        cash_collections: 0,
        cash_refunds: 0,
        payouts: 0,
        gross_collections: 0,
        transaction_count: 0,

        unmapped_transactions: []
    };

    const voidedStatuses = ['voided', 'failed', 'cancelled', 'reversed'];

    for (const tx of rows) {
        // Exclude failed/voided transactions completely
        const status = normalizeKey(tx.status);
        if (voidedStatuses.includes(status.toLowerCase())) {
            continue;
        }

        // Rule 6: One authoritative amount. Only use amount.
        const effectiveAmount = Math.abs(Number(tx.amount || 0));
        if (effectiveAmount === 0) continue;

        const pMethod = normalizeKey(tx.payment_method);
        const rType = normalizeKey(tx.revenue_type);
        const tType = normalizeKey(tx.transaction_type);

        const isRefundOrReversal = ['REFUND', 'REVERSAL'].includes(tType);
        const sign = isRefundOrReversal ? -1 : 1;
        const signedAmount = effectiveAmount * sign;

        totals.transaction_count++;

        // Rule 5: Charge-to-room (Exclude from physical collections, retain revenue source)
        const isChargeToRoom = ['ROOM_CHARGE', 'CHARGE_TO_ROOM'].includes(pMethod);
        
        if (!isChargeToRoom) {
            // Aggregate Payment Methods
            if (['CASH'].includes(pMethod)) {
                totals.total_cash += signedAmount;
                if (isRefundOrReversal) {
                    totals.cash_refunds += effectiveAmount;
                } else {
                    totals.cash_collections += effectiveAmount;
                }
            } else if (['MPESA', 'M_PESA', 'M-PESA', 'MOBILE_MONEY'].includes(pMethod)) {
                totals.total_mpesa += signedAmount;
            } else if (['CARD', 'SWIPE', 'VISA', 'MASTERCARD'].includes(pMethod)) {
                totals.total_card += signedAmount;
            } else if (['CREDIT', 'CREDIT_BILL', 'CORPORATE_CREDIT', 'STAFF_CREDIT'].includes(pMethod)) {
                totals.total_credit_bill += signedAmount;
            } else if (['BANK', 'BANK_TRANSFER', 'EFT', 'RTGS', 'CHEQUE'].includes(pMethod)) {
                totals.total_bank_transfer += signedAmount;
            } else {
                totals.total_other += signedAmount;
                totals.unmapped_transactions.push({ id: tx.id, field: 'payment_method', value: pMethod, amount: signedAmount });
            }

            // Exclude credit sales from gross physical collections
            if (!['CREDIT', 'CREDIT_BILL', 'CORPORATE_CREDIT', 'STAFF_CREDIT'].includes(pMethod)) {
                totals.gross_collections += signedAmount;
            }
        }

        // Rule 5: Determine actual revenue type even if it's a room charge or generic POS sale
        let activeRevenueType = rType;
        if (activeRevenueType === 'CHARGE_TO_ROOM' || activeRevenueType === 'POS_SALE' || activeRevenueType === 'POS') {
            const src = normalizeKey(tx.source_module);
            if (['RESTAURANT', 'POS_RESTAURANT'].includes(src)) activeRevenueType = 'RESTAURANT';
            else if (['BAR', 'POS_BAR'].includes(src)) activeRevenueType = 'BAR';
            else if (isDefaultBarShift) activeRevenueType = 'BAR';
            else if (isDefaultRestaurantShift) activeRevenueType = 'RESTAURANT';
            else if (isDefaultRoomsShift) activeRevenueType = 'ROOM';
            else activeRevenueType = 'BAR'; // Default POS outlet fallback to BAR/RESTAURANT instead of OTHER
        }

        // Aggregate Revenue Streams (double entry mapping)
        if (['ROOM', 'ROOMS', 'ROOM_BOOKING', 'ROOM_FOLIO', 'ACCOMMODATION'].includes(activeRevenueType)) {
            totals.rooms_revenue += signedAmount;
        } else if (['RESTAURANT', 'FOOD', 'POS_RESTAURANT'].includes(activeRevenueType)) {
            totals.restaurant_revenue += signedAmount;
        } else if (['BAR', 'BEVERAGE', 'POS_BAR'].includes(activeRevenueType)) {
            totals.bar_revenue += signedAmount;
        } else if (['CONFERENCE', 'EVENTS', 'BANQUET'].includes(activeRevenueType)) {
            totals.conference_revenue += signedAmount;
        } else if (['POOL', 'SWIMMING', 'SWIMMING_POOL', 'POOL_TOKEN'].includes(activeRevenueType)) {
            totals.pool_revenue += signedAmount;
        } else if (['PAYOUT', 'EXPENSE'].includes(activeRevenueType) || ['PAYOUT', 'EXPENSE'].includes(tType)) {
            totals.payouts += effectiveAmount;
        } else {
            // Unmapped revenue types go into other_revenue
            totals.other_revenue += signedAmount;
            totals.unmapped_transactions.push({ id: tx.id, field: 'revenue_type', value: activeRevenueType, amount: signedAmount });
        }
    }

    return totals;
};
