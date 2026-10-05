import db from '../db';
import { logger } from '../utils/logger';
import { calculateCashierShiftLedgerTotals, type LedgerTotals } from './cashier-ledger.service';

/**
 * Helpers that explain why a cashier logbook (cashier_shift_logs) and the POS
 * Sold Items report disagree. They are read-only and degrade to empty results.
 *
 * A POS sale belongs to the POS shift (pos_outlet_shifts) it was rung on, but
 * the money lands in the logbook of whichever cashier CLEARED the payment, so
 * one POS shift can be split across several logbooks and a logbook can hold
 * payments from POS shifts opened by someone else.
 */

const num = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export interface LogbookPosShiftSource {
    pos_shift_id: string;
    pos_shift_number: string | null;
    outlet_name: string | null;
    outlet_type: string | null;
    opened_by_cashier_id: string | null;
    opened_by_name: string | null;
    opened_by_other_cashier: boolean;
    opened_at: string | null;
    closed_at: string | null;
    payment_count: number;
    amount_in_this_logbook: number;
    // Other logbooks that hold payments of the same POS shift.
    also_in_logbooks: Array<{
        logbook_shift_id: string;
        shift_number: string | null;
        cashier_name: string | null;
        amount: number;
    }>;
}

/** For one logbook shift: which POS shifts do its payments come from? */
export async function loadLogbookPosShiftSources(
    logbookShiftId: string,
    logbookCashierId?: string | null
): Promise<LogbookPosShiftSource[]> {
    try {
        const { rows } = await db.query(
            `SELECT os.id AS pos_shift_id, os.shift_number, po.name AS outlet_name, po.outlet_type,
                    os.cashier_id AS opened_by_cashier_id,
                    NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), '') AS opened_by_name,
                    os.opened_at, os.closed_at,
                    COUNT(*)::int AS payment_count, SUM(cst.amount) AS amount
             FROM public.cashier_shift_transactions cst
             JOIN public.pos_shift_payments p ON p.id = cst.transaction_id
             JOIN public.pos_outlet_shifts os ON os.id = p.shift_id
             JOIN public.pos_outlets po ON po.id = os.outlet_id
             LEFT JOIN public.users u ON u.id = os.cashier_id
             WHERE cst.shift_id = $1 AND COALESCE(cst.is_voided, false) = false
             GROUP BY os.id, os.shift_number, po.name, po.outlet_type, os.cashier_id, u.first_name, u.last_name, os.opened_at, os.closed_at
             ORDER BY os.opened_at`,
            [logbookShiftId]
        );
        if (!rows.length) return [];

        const posShiftIds = rows.map((row: any) => row.pos_shift_id);
        const { rows: others } = await db.query(
            `SELECT p.shift_id AS pos_shift_id, csl.id AS logbook_shift_id, csl.shift_number, csl.cashier_name,
                    SUM(cst.amount) AS amount
             FROM public.pos_shift_payments p
             JOIN public.cashier_shift_transactions cst ON cst.transaction_id = p.id AND COALESCE(cst.is_voided, false) = false
             JOIN public.cashier_shift_logs csl ON csl.id = cst.shift_id
             WHERE p.shift_id = ANY($1::uuid[]) AND csl.id <> $2
             GROUP BY p.shift_id, csl.id, csl.shift_number, csl.cashier_name`,
            [posShiftIds, logbookShiftId]
        );

        return rows.map((row: any) => ({
            pos_shift_id: String(row.pos_shift_id),
            pos_shift_number: row.shift_number || null,
            outlet_name: row.outlet_name || null,
            outlet_type: row.outlet_type || null,
            opened_by_cashier_id: row.opened_by_cashier_id ? String(row.opened_by_cashier_id) : null,
            opened_by_name: row.opened_by_name || null,
            opened_by_other_cashier: Boolean(
                logbookCashierId && row.opened_by_cashier_id && String(row.opened_by_cashier_id) !== String(logbookCashierId)
            ),
            opened_at: row.opened_at || null,
            closed_at: row.closed_at || null,
            payment_count: num(row.payment_count),
            amount_in_this_logbook: num(row.amount),
            also_in_logbooks: others
                .filter((other: any) => String(other.pos_shift_id) === String(row.pos_shift_id))
                .map((other: any) => ({
                    logbook_shift_id: String(other.logbook_shift_id),
                    shift_number: other.shift_number || null,
                    cashier_name: other.cashier_name || null,
                    amount: num(other.amount),
                })),
        }));
    } catch (error: any) {
        logger.warn('loadLogbookPosShiftSources failed', { logbookShiftId, error: error?.message });
        return [];
    }
}

export interface NonPosCollections {
    total: number;
    count: number;
    by_type: Array<{ type: string; label: string; count: number; amount: number }>;
    lines: Array<{
        id: string;
        reference: string | null;
        customer_name: string | null;
        revenue_type: string;
        payment_method: string;
        amount: number;
        created_at: string | null;
    }>;
}

const REVENUE_TYPE_LABELS: Record<string, string> = {
    ROOM_BOOKING: 'Room bookings',
    ROOM_FOLIO: 'Room folios',
    ROOM: 'Rooms',
    CONFERENCE: 'Conference',
    EVENTS: 'Events',
    BANQUET: 'Banquet',
    POOL: 'Pool',
};

/**
 * Money a cashier cleared outside POS (reception room / conference payments).
 * These sit in the logbook total but can never appear in Sold Items' POS
 * lines, so they are itemised here instead of being left as an unexplained gap.
 */
export async function loadNonPosCollections(logbookShiftId: string, branchId: number | string): Promise<NonPosCollections> {
    const empty: NonPosCollections = { total: 0, count: 0, by_type: [], lines: [] };
    try {
        const { rows } = await db.query(
            `SELECT id, transaction_number, payment_reference, customer_name, revenue_type, payment_method, amount, created_at
             FROM public.cashier_transactions
             WHERE cashier_shift_log_id = $1 AND branch_id = $2
               AND COALESCE(LOWER(status), 'completed') NOT IN ('voided', 'failed', 'cancelled', 'reversed')
               AND COALESCE(UPPER(transaction_type), 'PAYMENT') NOT IN ('PAYOUT', 'EXPENSE')
               AND LOWER(COALESCE(payment_method, '')) NOT LIKE 'credit%'
             ORDER BY created_at`,
            [logbookShiftId, branchId]
        );
        if (!rows.length) return empty;

        const byType = new Map<string, { count: number; amount: number }>();
        let total = 0;
        const lines = rows.map((row: any) => {
            const type = String(row.revenue_type || 'OTHER').toUpperCase();
            const amount = num(row.amount);
            const bucket = byType.get(type) || { count: 0, amount: 0 };
            bucket.count += 1;
            bucket.amount += amount;
            byType.set(type, bucket);
            total += amount;
            return {
                id: String(row.id),
                reference: row.transaction_number || row.payment_reference || null,
                customer_name: row.customer_name || null,
                revenue_type: type,
                payment_method: String(row.payment_method || '').toLowerCase(),
                amount,
                created_at: row.created_at || null,
            };
        });

        return {
            total,
            count: rows.length,
            by_type: Array.from(byType.entries())
                .map(([type, value]) => ({
                    type,
                    label: REVENUE_TYPE_LABELS[type] || type.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
                    count: value.count,
                    amount: value.amount,
                }))
                .sort((a, b) => b.amount - a.amount),
            lines,
        };
    } catch (error: any) {
        logger.warn('loadNonPosCollections failed', { logbookShiftId, error: error?.message });
        return empty;
    }
}

export interface PosShiftLogbookSplit {
    logbook_shift_id: string;
    logbook_shift_number: string | null;
    logbook_cashier_name: string | null;
    amount: number;
    payment_count: number;
}

/**
 * For a set of POS shifts: which logbooks hold their payments?
 * Keyed by POS shift id. Used by Sold Items to show a POS shift's money
 * split across more than one cashier logbook.
 */
export async function loadPosShiftLogbookSplit(posShiftIds: string[]): Promise<Record<string, PosShiftLogbookSplit[]>> {
    const result: Record<string, PosShiftLogbookSplit[]> = {};
    const ids = [...new Set(posShiftIds.filter(Boolean))];
    if (!ids.length) return result;
    try {
        const { rows } = await db.query(
            `SELECT p.shift_id AS pos_shift_id, csl.id AS logbook_shift_id, csl.shift_number, csl.cashier_name,
                    SUM(cst.amount) AS amount, COUNT(*)::int AS payment_count
             FROM public.pos_shift_payments p
             JOIN public.cashier_shift_transactions cst ON cst.transaction_id = p.id AND COALESCE(cst.is_voided, false) = false
             JOIN public.cashier_shift_logs csl ON csl.id = cst.shift_id
             WHERE p.shift_id = ANY($1::uuid[])
             GROUP BY p.shift_id, csl.id, csl.shift_number, csl.cashier_name
             ORDER BY SUM(cst.amount) DESC`,
            [ids]
        );
        rows.forEach((row: any) => {
            const key = String(row.pos_shift_id);
            (result[key] ||= []).push({
                logbook_shift_id: String(row.logbook_shift_id),
                logbook_shift_number: row.shift_number || null,
                logbook_cashier_name: row.cashier_name || null,
                amount: num(row.amount),
                payment_count: num(row.payment_count),
            });
        });
    } catch (error: any) {
        logger.warn('loadPosShiftLogbookSplit failed', { error: error?.message });
    }
    return result;
}

// ───────────────────────── Corporate account credit ─────────────────────────
// A bill charged to a corporate account is credit the account owes later. For POS
// bills the order is flipped to credit_bill / CORPORATE_CREDIT with NOTHING paid
// and no payment row, so it never reaches a cashier logbook's transaction lines and
// Sold Items counts it as plain credit. These helpers attribute it to the right
// shift and corporate account so both screens can show it explicitly.

export interface CorporateAccountCredit {
    corporate_customer_id: string;
    name: string;
    count: number;
    amount: number;
    pos_amount: number;
    room_folio_amount: number;
    conference_amount: number;
    uninvoiced_amount: number;
}

export interface CorporateCreditSummary {
    total: number;
    count: number;
    pos_total: number; // POS bills only: the part that is NOT already inside the ledger's credit total
    // POS corporate bills by the outlet they were rung on (revenue stream), e.g. { main_bar: 1200 }
    pos_by_outlet_type: Record<string, number>;
    by_type: Record<string, { count: number; amount: number }>;
    by_account: CorporateAccountCredit[];
    lines: Array<{
        id: string;
        account_name: string;
        reference_type: string;
        reference: string | null;
        amount: number;
        status: string;
        created_at: string | null;
    }>;
}

export const emptyCorporateCredit = (): CorporateCreditSummary => ({
    total: 0, count: 0, pos_total: 0, pos_by_outlet_type: {}, by_type: {}, by_account: [], lines: [],
});

const foldCorporateRows = (rows: any[]): CorporateCreditSummary => {
    const summary = emptyCorporateCredit();
    const accounts = new Map<string, CorporateAccountCredit>();
    rows.forEach((row: any) => {
        const amount = num(row.amount);
        const type = String(row.reference_type || 'pos').toLowerCase();
        const status = String(row.status || '').toUpperCase();
        summary.total += amount;
        summary.count += 1;
        if (type === 'pos') {
            summary.pos_total += amount;
            const outletType = String(row.outlet_type || 'other').toLowerCase();
            summary.pos_by_outlet_type[outletType] = (summary.pos_by_outlet_type[outletType] || 0) + amount;
        }
        const bucket = (summary.by_type[type] ||= { count: 0, amount: 0 });
        bucket.count += 1;
        bucket.amount += amount;

        const id = String(row.corporate_customer_id);
        const account = accounts.get(id) || {
            corporate_customer_id: id,
            name: row.account_name || 'Corporate account',
            count: 0, amount: 0, pos_amount: 0, room_folio_amount: 0, conference_amount: 0, uninvoiced_amount: 0,
        };
        account.count += 1;
        account.amount += amount;
        if (type === 'pos') account.pos_amount += amount;
        else if (type === 'room_folio') account.room_folio_amount += amount;
        else if (type === 'conference') account.conference_amount += amount;
        if (status === 'UNINVOICED') account.uninvoiced_amount += amount;
        accounts.set(id, account);

        if (row.id) {
            summary.lines.push({
                id: String(row.id),
                account_name: row.account_name || 'Corporate account',
                reference_type: type,
                reference: row.order_number || row.short_code || null,
                amount,
                status,
                created_at: row.created_at || null,
            });
        }
    });
    summary.by_account = Array.from(accounts.values()).sort((a, b) => b.amount - a.amount);
    return summary;
};

/**
 * Corporate bills a cashier charged during ONE cashier shift. Attributed by the
 * bill's shift_id when the client sent one, otherwise by cashier + branch + the
 * shift's time window (charges currently carry no shift_id).
 */
export async function loadCorporateCreditForCashierShift(shift: {
    id: string;
    cashier_id?: string | null;
    branch_id: number | string;
    shift_start?: string | null;
    shift_end?: string | null;
}): Promise<CorporateCreditSummary> {
    try {
        const { rows } = await db.query(
            `SELECT cb.id, cb.reference_type, cb.amount, cb.status, cb.created_at, cb.corporate_customer_id,
                    cc.name AS account_name, o.order_number, o.short_code, po.outlet_type
             FROM public.corporate_credit_bills cb
             JOIN public.corporate_customers cc ON cc.id = cb.corporate_customer_id
             LEFT JOIN public.pos_shift_orders o ON o.id = cb.pos_bill_id
             LEFT JOIN public.pos_outlets po ON po.id = o.outlet_id
             WHERE cb.branch_id = $2
               AND (cb.shift_id = $1
                    OR ($3::uuid IS NOT NULL AND cb.cashier_id = $3::uuid
                        AND cb.created_at >= $4::timestamptz AND cb.created_at <= COALESCE($5::timestamptz, now())))
             ORDER BY cb.created_at`,
            [shift.id, shift.branch_id, shift.cashier_id || null, shift.shift_start || null, shift.shift_end || null]
        );
        return foldCorporateRows(rows);
    } catch (error: any) {
        logger.warn('loadCorporateCreditForCashierShift failed', { shiftId: shift.id, error: error?.message });
        return emptyCorporateCredit();
    }
}

/** Corporate POS bills per POS shift (by the order's own shift). Keyed by POS shift id. */
export async function loadCorporateCreditByPosShift(posShiftIds: string[]): Promise<Record<string, CorporateCreditSummary>> {
    const result: Record<string, CorporateCreditSummary> = {};
    const ids = [...new Set(posShiftIds.filter(Boolean))];
    if (!ids.length) return result;
    try {
        const { rows } = await db.query(
            `SELECT o.shift_id AS pos_shift_id, cb.id, cb.reference_type, cb.amount, cb.status, cb.created_at, cb.corporate_customer_id,
                    cc.name AS account_name, o.order_number, o.short_code, po.outlet_type
             FROM public.corporate_credit_bills cb
             JOIN public.pos_shift_orders o ON o.id = cb.pos_bill_id
             LEFT JOIN public.pos_outlets po ON po.id = o.outlet_id
             JOIN public.corporate_customers cc ON cc.id = cb.corporate_customer_id
             WHERE o.shift_id = ANY($1::uuid[])
             ORDER BY cb.created_at`,
            [ids]
        );
        const grouped: Record<string, any[]> = {};
        rows.forEach((row: any) => (grouped[String(row.pos_shift_id)] ||= []).push(row));
        Object.entries(grouped).forEach(([shiftId, list]) => { result[shiftId] = foldCorporateRows(list); });
    } catch (error: any) {
        logger.warn('loadCorporateCreditByPosShift failed', { error: error?.message });
    }
    return result;
}

/** Corporate credit of every type charged in a period (Sold Items summary). */
export async function loadCorporateCreditForPeriod(
    startIso: string,
    endIso: string,
    branchId?: number | null
): Promise<CorporateCreditSummary> {
    try {
        const params: any[] = [startIso, endIso];
        let branchSql = '';
        if (branchId) { params.push(branchId); branchSql = ` AND cb.branch_id = $${params.length}`; }
        const { rows } = await db.query(
            `SELECT cb.id, cb.reference_type, cb.amount, cb.status, cb.created_at, cb.corporate_customer_id,
                    cc.name AS account_name, o.order_number, o.short_code, po.outlet_type
             FROM public.corporate_credit_bills cb
             JOIN public.corporate_customers cc ON cc.id = cb.corporate_customer_id
             LEFT JOIN public.pos_shift_orders o ON o.id = cb.pos_bill_id
             LEFT JOIN public.pos_outlets po ON po.id = o.outlet_id
             WHERE cb.created_at >= $1 AND cb.created_at <= $2${branchSql}
             ORDER BY cb.created_at`,
            params
        );
        const summary = foldCorporateRows(rows);
        summary.lines = []; // period view lists accounts, not every bill
        return summary;
    } catch (error: any) {
        logger.warn('loadCorporateCreditForPeriod failed', { error: error?.message });
        return emptyCorporateCredit();
    }
}

/**
 * Everything a cashier-shift view needs to explain how its total relates to Sold
 * Items: money collected vs credit, non-POS money, the POS shifts the payments came
 * from, corporate-account credit, and whether the stored total still matches the
 * ledger. Shared by the shift log and the cashier logbook detail endpoints.
 */
export async function buildShiftReconciliationExtras(
    shift: any,
    ledger?: LedgerTotals | null,
    fallback: { collected?: number; credit?: number } = {}
) {
    const branchId = Number(shift.branch_id);
    let live: LedgerTotals | null = ledger ?? null;
    if (!live) {
        try {
            live = await calculateCashierShiftLedgerTotals(shift.id, branchId, db as any);
        } catch (error: any) {
            logger.warn('Ledger recompute failed for shift reconciliation extras', { shiftId: shift.id, error: error?.message });
        }
    }

    const [nonPosCollections, posShiftSources, corporateCredit] = await Promise.all([
        loadNonPosCollections(shift.id, branchId),
        loadLogbookPosShiftSources(shift.id, shift.cashier_id),
        loadCorporateCreditForCashierShift({
            id: shift.id,
            cashier_id: shift.cashier_id,
            branch_id: branchId,
            shift_start: shift.shift_start,
            shift_end: shift.shift_end,
        }),
    ]);

    const collected = live ? live.gross_collections : num(fallback.collected ?? shift.total_sales);
    const staffCredit = live ? live.total_credit_bill : num(fallback.credit ?? shift.credit_bills_taken);
    // Corporate POS bills leave the order credit_bill with nothing paid and no payment
    // row, so they are NOT inside the ledger's credit total. (Room and conference
    // corporate charges post a credit_bill payment and already are.)
    const corporatePosCredit = corporateCredit.pos_total;
    const stored = num(shift.total_sales);
    const isOpen = shift.status === 'open' || shift.status === 'pending_open';

    return {
        // Physical money collected (cash + M-Pesa + card + other), credit excluded.
        total_collected: collected,
        // Collected + all credit sold: the figure to compare with Sold Items.
        total_sales_incl_credit: collected + staffCredit + corporatePosCredit,
        credit_sales_total: staffCredit + corporatePosCredit,
        staff_credit_total: staffCredit,
        corporate_pos_credit_total: corporatePosCredit,
        // Bills charged to corporate accounts by this cashier during this shift, per account.
        corporate_credit: corporateCredit,
        pos_collections: live?.pos_collections ?? null,
        non_pos_collections: nonPosCollections,
        // POS shifts whose payments sit in this logbook (and who else holds the rest).
        pos_shift_sources: posShiftSources,
        // Flags closed shifts whose stored totals no longer match the ledger
        // (e.g. closed before reception payments stopped being double counted).
        totals_check: isOpen || !live
            ? null
            : {
                stored_total_sales: stored,
                recomputed_total_sales: live.gross_collections,
                difference: stored - live.gross_collections,
                mismatch: Math.abs(stored - live.gross_collections) > 1,
            },
    };
}
