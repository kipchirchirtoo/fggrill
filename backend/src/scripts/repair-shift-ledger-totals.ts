import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { calculateCashierShiftLedgerTotals } from '../services/cashier-ledger.service';

/**
 * Repairs stored totals on CLOSED cashier shifts (cashier_shift_logs) that were
 * closed before two ledger bugs were fixed:
 *   1. reception payments were counted twice (cashier_transactions + their
 *      cashier_shift_transactions mirror row), inflating total_sales and the
 *      cash / M-Pesa / card buckets;
 *   2. POS sales rung by a "reception" cashier were all booked as Rooms revenue.
 *
 * DRY RUN by default. Nothing is written unless --apply is passed.
 *
 *   npx ts-node --transpile-only src/scripts/repair-shift-ledger-totals.ts [--days=60] [--branch=1] [--apply] [--include-reconciled]
 *
 * Only the sales and revenue-stream columns are rewritten. expected_closing_float,
 * variance and the accountant's reconciliation are NOT touched: cash that was
 * double counted shifts the expected-cash figure, so the script reports that
 * impact (`cash_overstated`) for the accountant to review instead of silently
 * changing a reconciled variance.
 */

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string, fallback: string) => (args.find((a) => a.startsWith(`--${name}=`)) || `--${name}=${fallback}`).split('=')[1];

const DAYS = Number(opt('days', '60'));
const BRANCH = opt('branch', '');
const APPLY = flag('apply');
const INCLUDE_RECONCILED = flag('include-reconciled');
const EPSILON = 1;

(async () => {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 2,
        connectionTimeoutMillis: 20000,
        statement_timeout: 60000,
    });
    const client = await pool.connect();
    try {
        if (!APPLY) await client.query('SET default_transaction_read_only = on');

        const params: any[] = [DAYS];
        let where = `l.status = 'closed' AND l.shift_start >= now() - ($1 || ' days')::interval`;
        if (BRANCH) { params.push(Number(BRANCH)); where += ` AND l.branch_id = $${params.length}`; }
        if (!INCLUDE_RECONCILED) where += ` AND COALESCE(l.reconciliation_status, 'pending_reconciliation') NOT IN ('reconciled', 'approved', 'hard_closed')`;

        const { rows: shifts } = await client.query(
            `SELECT l.id, l.branch_id, b.name AS branch, l.shift_number, l.cashier_name, l.shift_start,
                    l.total_sales, l.total_cash_sales, l.total_mpesa_sales, l.total_card_sales,
                    l.restaurant_revenue, l.bar_revenue, l.room_booking_revenue, l.conference_revenue, l.other_revenue, l.swimming_pool_revenue
             FROM cashier_shift_logs l JOIN branches b ON b.id = l.branch_id
             WHERE ${where} ORDER BY l.shift_start`,
            params
        );

        console.log(`${APPLY ? 'APPLY' : 'DRY RUN'}: ${shifts.length} closed shifts in the last ${DAYS} days${BRANCH ? ` (branch ${BRANCH})` : ''}`);

        const report: any[] = [];
        const perBranch: Record<string, { shifts: number; changed: number; totalDelta: number; cashDelta: number }> = {};

        for (const shift of shifts) {
            const ledger = await calculateCashierShiftLedgerTotals(shift.id, Number(shift.branch_id), client as any);
            const n = (v: any) => Number(v || 0);
            const next = {
                total_sales: ledger.gross_collections,
                total_cash_sales: ledger.total_cash,
                total_mpesa_sales: ledger.total_mpesa,
                total_card_sales: ledger.total_card,
                restaurant_revenue: ledger.restaurant_revenue,
                bar_revenue: ledger.bar_revenue,
                room_booking_revenue: ledger.rooms_revenue,
                conference_revenue: ledger.conference_revenue,
                swimming_pool_revenue: ledger.pool_revenue,
                other_revenue: ledger.other_revenue,
            };
            const changed = (Object.keys(next) as Array<keyof typeof next>).some((k) => Math.abs(n(shift[k]) - next[k]) > EPSILON);

            const bucket = (perBranch[shift.branch] ||= { shifts: 0, changed: 0, totalDelta: 0, cashDelta: 0 });
            bucket.shifts += 1;
            if (!changed) continue;
            bucket.changed += 1;
            bucket.totalDelta += next.total_sales - n(shift.total_sales);
            bucket.cashDelta += next.total_cash_sales - n(shift.total_cash_sales);

            report.push({
                branch: shift.branch,
                shift_number: shift.shift_number,
                cashier: shift.cashier_name,
                shift_start: shift.shift_start,
                total_sales_before: n(shift.total_sales),
                total_sales_after: next.total_sales,
                cash_overstated: n(shift.total_cash_sales) - next.total_cash_sales,
                rooms_before: n(shift.room_booking_revenue),
                rooms_after: next.room_booking_revenue,
                restaurant_after: next.restaurant_revenue,
                bar_after: next.bar_revenue,
            });

            if (APPLY) {
                await client.query(
                    `UPDATE cashier_shift_logs SET
                        total_sales = $1, total_cash_sales = $2, total_mpesa_sales = $3, total_card_sales = $4,
                        restaurant_revenue = $5, bar_revenue = $6, room_booking_revenue = $7, conference_revenue = $8,
                        swimming_pool_revenue = $9, other_revenue = $10, updated_at = NOW()
                     WHERE id = $11 AND status = 'closed'`,
                    [next.total_sales, next.total_cash_sales, next.total_mpesa_sales, next.total_card_sales,
                     next.restaurant_revenue, next.bar_revenue, next.room_booking_revenue, next.conference_revenue,
                     next.swimming_pool_revenue, next.other_revenue, shift.id]
                );
            }
        }

        console.table(Object.entries(perBranch).map(([branch, v]) => ({
            branch, shifts_checked: v.shifts, shifts_to_change: v.changed,
            total_sales_change: Math.round(v.totalDelta), cash_bucket_change: Math.round(v.cashDelta),
        })));

        const outDir = path.resolve(__dirname, '../../../reports');
        fs.mkdirSync(outDir, { recursive: true });
        const file = path.join(outDir, `shift-ledger-repair-${APPLY ? 'applied' : 'dryrun'}-${new Date().toISOString().slice(0, 10)}.csv`);
        const header = Object.keys(report[0] || { branch: '' });
        fs.writeFileSync(file, [header.join(','), ...report.map((r) => header.map((h) => JSON.stringify(r[h] ?? '')).join(','))].join('\n'));
        console.log(`${APPLY ? 'Updated' : 'Would update'} ${report.length} shifts. Detail: ${file}`);
        if (!APPLY) console.log('Re-run with --apply to write these changes.');
    } finally {
        client.release();
        await pool.end();
    }
})().catch((error) => {
    console.error('Repair failed:', error?.message || error?.code || error);
    process.exit(1);
});
