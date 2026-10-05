import 'dotenv/config';
import { Pool } from 'pg';
import { rebuildKitchenShiftItems, refreshKitchenShiftItemTotals } from '../controllers/kitchen-shift.controller';

/**
 * Rebuilds kitchen_shift_items for kitchen shifts that were opened while the item seed
 * insert was failing (committed code wrote the GENERATED column system_closing_stock,
 * so Postgres rejected the whole batch and every shift got NO item rows — the kitchen
 * stocktake then read opening / added / sold / system closing as 0).
 *
 * DRY RUN by default: lists the affected shifts and what each would be rebuilt from.
 *
 *   npx ts-node --transpile-only src/scripts/repair-kitchen-shift-items.ts [--days=30] [--branch=7] [--apply] [--include-closed] [--reverse]
 *
 * --apply only touches OPEN shifts unless --include-closed is also given. Rebuilding is
 * idempotent (a shift that already has item rows is skipped).
 */

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string, fallback: string) => (args.find((a) => a.startsWith(`--${name}=`)) || `--${name}=${fallback}`).split('=')[1];

const DAYS = Number(opt('days', '30'));
const BRANCH = opt('branch', '');
const APPLY = flag('apply');
const INCLUDE_CLOSED = flag('include-closed');
// Work from the newest shift backwards (lets a second pass share the work safely: the
// rebuild skips any shift that already has item rows).
const REVERSE = flag('reverse');
// --refresh=KS-123,KS-456 : re-apply the additions / sold ledgers to shifts that already have item rows.
const REFRESH = opt('refresh', '');

(async () => {
    if (REFRESH) {
        const { supabase } = await import('../config/database');
        const numbers = REFRESH.split(',').map((v) => v.trim()).filter(Boolean);
        let rows: any[] = [];
        for (let attempt = 1; attempt <= 5 && rows.length === 0; attempt++) {
            const result = await supabase.from('kitchen_shifts').select('id, shift_number').in('shift_number', numbers);
            rows = result.data || [];
        }
        for (const row of rows) {
            console.log(`${row.shift_number}:`, JSON.stringify(APPLY ? await refreshKitchenShiftItemTotals(String(row.id)) : { dryRun: true }));
        }
        process.exit(0);
    }
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 1,
        connectionTimeoutMillis: 20000,
        statement_timeout: 60000,
    });
    // READ ONLY transaction (not a session SET: session settings leak into the shared
    // connection pool and can leave other clients stuck read-only).
    const client = await pool.connect();
    try {
        const params: any[] = [DAYS];
        let where = `s.opened_at >= now() - ($1 || ' days')::interval
                     AND NOT EXISTS (SELECT 1 FROM public.kitchen_shift_items i WHERE i.shift_id = s.id)`;
        if (BRANCH) { params.push(Number(BRANCH)); where += ` AND s.branch_id = $${params.length}`; }
        if (!INCLUDE_CLOSED) where += ` AND s.status = 'open'`;

        await client.query('BEGIN READ ONLY');
        const { rows: shifts } = await client.query(
            `SELECT s.id, b.name AS branch, s.shift_number, s.shift_date, s.sub_shift_type, s.status, s.opened_at,
                    (SELECT COUNT(*) FROM public.kitchen_stocktake_items ki
                       JOIN public.kitchen_stocktake_shifts ks ON ks.id = ki.shift_id
                      WHERE ks.branch_id = s.branch_id AND ks.stocktake_date = s.shift_date AND ks.shift = 'A') AS opening_count_rows,
                    (SELECT COUNT(*) FROM public.kitchen_shift_additions a WHERE a.shift_id = s.id) AS additions_rows,
                    (SELECT COUNT(*) FROM public.kitchen_shift_pos_consumption c WHERE c.shift_id = s.id AND COALESCE(c.match_status,'') <> 'unmatched') AS matched_sales_rows
             FROM public.kitchen_shifts s JOIN public.branches b ON b.id = s.branch_id
             WHERE ${where} ORDER BY s.opened_at ${REVERSE ? 'DESC' : 'ASC'}`,
            params
        );
        await client.query('COMMIT');

        console.log(`${APPLY ? 'APPLY' : 'DRY RUN'}: ${shifts.length} kitchen shift(s) without item rows (last ${DAYS} days, ${INCLUDE_CLOSED ? 'open + closed' : 'open only'})`);
        console.table(shifts.map((r: any) => ({
            branch: r.branch, shift: r.shift_number, date: String(r.shift_date).slice(0, 10), sub: r.sub_shift_type || 'single',
            status: r.status, opening_count_rows: Number(r.opening_count_rows), additions_rows: Number(r.additions_rows), matched_sales_rows: Number(r.matched_sales_rows),
        })));

        if (!APPLY) {
            console.log('Re-run with --apply to rebuild these shifts.');
            return;
        }
        for (const shift of shifts) {
            const result = await rebuildKitchenShiftItems(String(shift.id));
            console.log(`${shift.branch} ${shift.shift_number}:`, JSON.stringify(result));
        }
    } finally {
        client.release();
        await pool.end();
    }
    process.exit(0);
})().catch((error) => {
    console.error('Repair failed:', error?.message || error);
    process.exit(1);
});
