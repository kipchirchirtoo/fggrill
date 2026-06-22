import { supabase } from '../config/database';

// Normalized payment_method values (migration
// 20260622_famousgate_major_redesign.sql, section 5).
export type PaymentMethod = 'mpesa' | 'cash' | 'card' | 'credit';

export interface PaymentMethodBreakdown {
    mpesa: number;
    cash: number;
    card: number;
    credit: number;
    total: number;
    transaction_count: number;
}

const EMPTY: PaymentMethodBreakdown = { mpesa: 0, cash: 0, card: 0, credit: 0, total: 0, transaction_count: 0 };

const num = (v: any): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const normalizeMethod = (raw: any): PaymentMethod | null => {
    const m = String(raw || '').toLowerCase();
    if (m === 'credit_bill' || m === 'mobile_money') return 'credit';
    if (m === 'mpesa' || m === 'cash' || m === 'card' || m === 'credit') return m;
    return null;
};

const addRow = (acc: PaymentMethodBreakdown, method: any, amount: any) => {
    const normalized = normalizeMethod(method);
    if (!normalized) return;
    acc[normalized] += num(amount);
    acc.total += num(amount);
    acc.transaction_count += 1;
};

/**
 * Payment method breakdown (mpesa/cash/card/credit) for a branch over a
 * date range, sourced from the two tables that carry a normalized
 * payment_method column: pos_transactions (direct branch_id) and
 * cashier_shift_transactions (joined via cashier_shift_logs.branch_id).
 *
 * branchId must be an INTEGER (branches.id / cashier_shift_logs.branch_id).
 */
export async function getPaymentMethodBreakdown(
    branchId: number,
    startDate: string,
    endDate: string
): Promise<PaymentMethodBreakdown> {
    const startTs = `${startDate}T00:00:00`;
    const endTs = `${endDate}T23:59:59`;
    const breakdown: PaymentMethodBreakdown = { ...EMPTY };

    const [{ data: posRows }, { data: shiftLogs }] = await Promise.all([
        supabase
            .from('pos_transactions')
            .select('amount, total_amount, payment_method, created_at')
            .eq('branch_id', branchId)
            .gte('created_at', startTs)
            .lte('created_at', endTs),
        supabase
            .from('cashier_shift_logs')
            .select('id')
            .eq('branch_id', branchId)
            .gte('shift_start', startTs)
            .lte('shift_start', endTs),
    ]);

    (posRows || []).forEach((row: any) => {
        addRow(breakdown, row.payment_method, row.amount ?? row.total_amount);
    });

    const shiftIds = (shiftLogs || []).map((s: any) => s.id);
    if (shiftIds.length) {
        const { data: shiftTxns } = await supabase
            .from('cashier_shift_transactions')
            .select('amount, payment_method')
            .in('shift_id', shiftIds);
        (shiftTxns || []).forEach((row: any) => {
            addRow(breakdown, row.payment_method, row.amount);
        });
    }

    (Object.keys(breakdown) as Array<keyof PaymentMethodBreakdown>).forEach((k) => {
        breakdown[k] = Math.round(num(breakdown[k]) * 100) / 100;
    });

    return breakdown;
}
