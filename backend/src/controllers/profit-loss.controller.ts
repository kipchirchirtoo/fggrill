import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

// ── FamousGate branded PDF helpers (self-contained — no external service) ────
const PL_PRIMARY = '#1a1a1a';
const PL_SECONDARY = '#555555';
const PL_GOLD = '#c8a84b';
const PL_BORDER = '#e0e0e0';
const PL_HEADER_BG = '#333333';
const PL_ROW_BG = '#f9f9f9';
const PL_COMPANY = 'FamousGate Hotels';
const PL_ADDRESS = 'Bomet, Kenya';
const PL_EMAIL = 'famousgateshotelsbmt@gmail.com';
const PL_PHONE = '0706 782 828';

const plLogoPath = (): string | null => {
    const candidates = [
        path.join(process.cwd(), '../frontend/public/fglogo.png'),
        path.join(process.cwd(), 'frontend/public/fglogo.png'),
        path.join(__dirname, '../../../frontend/public/fglogo.png'),
    ];
    return candidates.find((c) => fs.existsSync(c)) || null;
};

const plMoney = (v: any): string => {
    const n = Number(v);
    return `KES ${(Number.isFinite(n) ? n : 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const plHeader = (doc: PDFKit.PDFDocument, title: string, subtitle: string): number => {
    const logo = plLogoPath();
    if (logo) {
        try { doc.image(logo, 40, 30, { width: 55 }); } catch { /* ignore */ }
    } else {
        doc.circle(67, 57, 27).fill(PL_PRIMARY);
        doc.fillColor('white').fontSize(20).font('Helvetica-Bold').text('FG', 53, 47);
    }
    doc.fillColor(PL_PRIMARY).fontSize(15).font('Helvetica-Bold').text(PL_COMPANY, 110, 30, { align: 'right' });
    doc.fontSize(9).font('Helvetica').fillColor(PL_SECONDARY)
        .text(PL_ADDRESS, 110, 50, { align: 'right' })
        .text(`Email: ${PL_EMAIL}`, { align: 'right' })
        .text(`Tel: ${PL_PHONE}`, { align: 'right' });
    doc.strokeColor(PL_BORDER).lineWidth(1).moveTo(40, 100).lineTo(doc.page.width - 40, 100).stroke();
    doc.rect(40, 101, doc.page.width - 80, 3).fill(PL_GOLD);
    doc.fillColor(PL_PRIMARY).fontSize(14).font('Helvetica-Bold').text(title, 40, 114, { align: 'center' });
    doc.fontSize(9).font('Helvetica').fillColor(PL_SECONDARY).text(subtitle, 40, 132, { align: 'center' });
    doc.strokeColor(PL_BORDER).lineWidth(0.5).moveTo(40, 146).lineTo(doc.page.width - 40, 146).stroke();
    doc.fillColor(PL_PRIMARY);
    return 158;
};

const plFooter = (doc: PDFKit.PDFDocument): void => {
    const y = doc.page.height - 52;
    doc.strokeColor(PL_BORDER).lineWidth(0.5).moveTo(40, y).lineTo(doc.page.width - 40, y).stroke();
    doc.fillColor(PL_SECONDARY).fontSize(7.5).font('Helvetica')
        .text(`Generated: ${new Date().toLocaleString('en-KE')} | ${PL_COMPANY} - Confidential`, 40, y + 7, {
            width: doc.page.width - 80, align: 'center', lineBreak: false, ellipsis: true,
        });
};

const plSpace = (doc: PDFKit.PDFDocument, y: number, needed = 60): number => {
    if (y + needed < doc.page.height - 70) return y;
    plFooter(doc);
    doc.addPage();
    return plHeader(doc, 'PROFIT & LOSS STATEMENT', 'Continued');
};

const plSectionTitle = (doc: PDFKit.PDFDocument, title: string, y: number): number => {
    doc.fillColor(PL_PRIMARY).fontSize(11).font('Helvetica-Bold').text(title, 40, y);
    doc.rect(40, y + 15, doc.page.width - 80, 2).fill(PL_GOLD);
    return y + 26;
};

const plTable = (
    doc: PDFKit.PDFDocument,
    y: number,
    headers: string[],
    rows: string[][],
    widths: number[],
    aligns: Array<'left' | 'center' | 'right'> = []
): number => {
    const left = 40;
    let cy = y;
    doc.rect(left, cy, doc.page.width - 80, 20).fill(PL_HEADER_BG);
    doc.fillColor('white').fontSize(8).font('Helvetica-Bold');
    let x = left + 6;
    headers.forEach((h, i) => {
        doc.text(h, x, cy + 6, { width: widths[i] - 8, align: aligns[i] || 'left', ellipsis: true });
        x += widths[i];
    });
    cy += 20;
    rows.forEach((row, ri) => {
        cy = plSpace(doc, cy, 22);
        if (ri % 2 === 0) doc.rect(left, cy, doc.page.width - 80, 18).fill(PL_ROW_BG);
        doc.fillColor(PL_PRIMARY).fontSize(8).font('Helvetica');
        x = left + 6;
        row.forEach((value, i) => {
            doc.text(value, x, cy + 5, { width: widths[i] - 8, align: aligns[i] || 'left', ellipsis: true });
            x += widths[i];
        });
        doc.strokeColor(PL_BORDER).lineWidth(0.3).moveTo(left, cy + 18).lineTo(doc.page.width - 40, cy + 18).stroke();
        cy += 18;
    });
    return cy + 12;
};

/**
 * @desc    Branch P&L sourced from cashier/POS transactions + sold items, broken
 *          down per POS outlet (revenue, COGS, gross profit) plus branch expenses.
 * @route   GET /api/finance/pos-profit-loss
 * @access  Branch Accountant, Branch Manager, Director, Auditor, GM, Super Admin
 */
const resolvePnlParams = (req: Request): { branchId: any; startDate: string; endDate: string } | null => {
    const role = String((req as any).user?.role || '');
    const userBranchId = (req as any).user?.branch_id;
    let branchId: any = req.query.branch_id;
    if (['branch_manager', 'branch_accountant'].includes(role)) branchId = userBranchId;
    if (!branchId || branchId === '0') return null;
    const now = new Date();
    const endDate = (req.query.to_date as string) || (req.query.end_date as string) ||
        now.toISOString().split('T')[0];
    const startDate = (req.query.from_date as string) || (req.query.start_date as string) ||
        new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    return { branchId, startDate, endDate };
};

// PostgREST silently caps unbounded selects at its default row limit (1000),
// so any table whose row count scales with transaction volume (orders, line
// items, cashier transactions) must be paged through in full or busy
// branches/periods silently lose data past the first page — with no error,
// just a quietly wrong total. Requires a stable order to page without gaps.
const PNL_PAGE_SIZE = 1000;
async function fetchAllRows<T = any>(
    build: (query: any) => any,
): Promise<T[]> {
    const rows: T[] = [];
    let from = 0;
    while (true) {
        const { data, error } = await build(supabase).range(from, from + PNL_PAGE_SIZE - 1);
        if (error) throw error;
        const batch = (data || []) as T[];
        rows.push(...batch);
        if (batch.length < PNL_PAGE_SIZE) break;
        from += PNL_PAGE_SIZE;
    }
    return rows;
}

const computePosProfitLoss = async (branchId: any, startDate: string, endDate: string): Promise<any> => {
        const startTs = `${startDate}T00:00:00`;
        const endTs = `${endDate}T23:59:59`;
        const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

        // Per-outlet accumulator
        type OutletPnl = { outlet_id: string; name: string; type: string; revenue: number; cogs: number; units: number };
        const outlets = new Map<string, OutletPnl>();
        const outletFor = (id: string, name: string, type: string): OutletPnl => {
            if (!outlets.has(id)) outlets.set(id, { outlet_id: id, name, type, revenue: 0, cogs: 0, units: 0 });
            return outlets.get(id)!;
        };

        // ── 1. POS outlets: revenue + COGS from POS shift orders + outlet items ──
        const { data: posOutlets } = await supabase
            .from('pos_outlets')
            .select('id, name, outlet_type')
            .eq('branch_id', branchId);
        const posOutletIds = (posOutlets || []).map((o: any) => o.id);
        const posOutletById = new Map<string, any>();
        (posOutlets || []).forEach((o: any) => posOutletById.set(String(o.id), o));

        if (posOutletIds.length) {
            // Get all POS orders for this period (paid orders only)
            const posOrders = await fetchAllRows((sb) => sb
                .from('pos_shift_orders')
                .select('id, outlet_id, total_amount, items, payment_status, status')
                .in('outlet_id', posOutletIds)
                .gte('created_at', startTs)
                .lte('created_at', endTs)
                .eq('payment_status', 'paid')
                .neq('status', 'cancelled')
                .neq('status', 'voided')
                .order('id', { ascending: true }));

            // Build cost price map from all outlet items
            const { data: outletItems } = await supabase
                .from('pos_outlet_items')
                .select('id, cost_price, selling_price')
                .in('outlet_id', posOutletIds);

            const costPriceMap = new Map<string, { cost: number; selling: number }>();
            (outletItems || []).forEach((item: any) => {
                costPriceMap.set(String(item.id), {
                    cost: n(item.cost_price),
                    selling: n(item.selling_price)
                });
            });

            // Process each order's items
            (posOrders || []).forEach((order: any) => {
                const oid = String(order.outlet_id);
                const meta = posOutletById.get(oid);
                const acc = outletFor(oid, meta?.name || 'POS Outlet', meta?.outlet_type || 'pos');

                // Add revenue from order total
                acc.revenue += n(order.total_amount);

                // Calculate COGS from items
                const items = Array.isArray(order.items) ? order.items : [];
                items.forEach((item: any) => {
                    const outletItemId = item.outlet_item_id || item.item_id;
                    if (!outletItemId) return;

                    const prices = costPriceMap.get(String(outletItemId));
                    if (prices) {
                        const qty = n(item.quantity);
                        acc.cogs += qty * prices.cost;
                        acc.units += qty;
                    }
                });
            });
        }

        // ── 2. Branch cost map for restaurant/bar items (base + branch override) ─
        const [{ data: rmi }, { data: bd }, { data: overrides }] = await Promise.all([
            supabase.from('restaurant_menu_items').select('id, cost_price').or(`branch_id.is.null,branch_id.eq.${branchId}`),
            supabase.from('bar_drinks').select('id, cost_price').or(`branch_id.is.null,branch_id.eq.${branchId}`),
            supabase.from('menu_item_branch_pricing').select('item_type, item_id, cost_price').eq('branch_id', branchId),
        ]);
        const restCost = new Map<string, number>();
        (rmi || []).forEach((m: any) => restCost.set(String(m.id), n(m.cost_price)));
        const barCost = new Map<string, number>();
        (bd || []).forEach((m: any) => barCost.set(String(m.id), n(m.cost_price)));
        (overrides || []).forEach((o: any) => {
            const map = o.item_type === 'bar' ? barCost : restCost;
            if (o.cost_price != null) map.set(String(o.item_id), n(o.cost_price));
        });

        // ── 3. Restaurant orders → "Restaurant" outlet (revenue + item COGS) ────
        const restOrders = await fetchAllRows((sb) => sb
            .from('restaurant_orders')
            .select('id, total_amount, grand_total, status')
            .eq('branch_id', branchId)
            .gte('created_at', startTs)
            .lte('created_at', endTs)
            .not('status', 'eq', 'cancelled')
            .order('id', { ascending: true }));
        if ((restOrders || []).length) {
            const acc = outletFor('restaurant', 'Restaurant', 'restaurant');
            const restIds = (restOrders || []).map((o: any) => o.id);
            (restOrders || []).forEach((o: any) => { acc.revenue += n(o.grand_total) || n(o.total_amount); });
            const items = await fetchAllRows((sb) => sb
                .from('restaurant_order_items')
                .select('id, order_id, menu_item_id, quantity')
                .in('order_id', restIds)
                .order('id', { ascending: true }));
            (items || []).forEach((it: any) => {
                const qty = n(it.quantity);
                acc.cogs += qty * (restCost.get(String(it.menu_item_id)) || 0);
                acc.units += qty;
            });
        }

        // ── 4. Bar orders → "Bar" outlet (revenue + item COGS) ──────────────────
        const barOrders = await fetchAllRows((sb) => sb
            .from('bar_orders')
            .select('id, total, subtotal, status')
            .eq('branch_id', branchId)
            .gte('created_at', startTs)
            .lte('created_at', endTs)
            .not('status', 'eq', 'cancelled')
            .order('id', { ascending: true }));
        if ((barOrders || []).length) {
            const acc = outletFor('bar', 'Bar', 'bar');
            const barIds = (barOrders || []).map((o: any) => o.id);
            (barOrders || []).forEach((o: any) => { acc.revenue += n(o.total) || n(o.subtotal); });
            const items = await fetchAllRows((sb) => sb
                .from('bar_order_items')
                .select('id, order_id, drink_id, quantity')
                .in('order_id', barIds)
                .order('id', { ascending: true }));
            (items || []).forEach((it: any) => {
                const qty = n(it.quantity);
                acc.cogs += qty * (barCost.get(String(it.drink_id)) || 0);
                acc.units += qty;
            });
        }

        // ── 5. Cashier-recorded revenue cross-check ─────────────────────────────
        // Primary: cashier_transactions (canonical posted payments)
        // Fallback: cashier_shift_logs (legacy shift data)
        const [cashierTxns, { data: cashierShiftLogs }] = await Promise.all([
            fetchAllRows((sb) => sb.from('cashier_transactions')
                .select('id, amount, transaction_type, status')
                .eq('branch_id', branchId)
                .gte('transaction_date', startTs)
                .lte('transaction_date', endTs)
                .eq('status', 'posted')
                .neq('transaction_type', 'refund')
                .order('id', { ascending: true })),
            supabase.from('cashier_shift_logs')
                .select('cash_at_hand, total_sales')
                .eq('branch_id', branchId)
                .gte('shift_start', startTs)
                .lte('shift_start', endTs)
                .not('status', 'eq', 'cancelled'),
        ]);
        const cashierTxnTotal = (cashierTxns || []).reduce((s: number, t: any) => s + n(t.amount), 0);
        const cashierLogTotal = (cashierShiftLogs || []).reduce((s: number, t: any) => s + n(t.cash_at_hand || t.total_sales), 0);
        const cashierRevenue = cashierTxnTotal > 0 ? cashierTxnTotal : cashierLogTotal;

        // ── 6. Branch operating expenses ────────────────────────────────────────
        const [{ data: expenses }, { data: pettyCash }, { data: financeExpenses }] = await Promise.all([
            supabase.from('expenses').select('amount, category, status, approval_status')
                .eq('branch_id', branchId).gte('expense_date', startDate).lte('expense_date', endDate),
            supabase.from('petty_cash_transactions').select('amount, status')
                .eq('branch_id', branchId).gte('date', startDate).lte('date', endDate),
            supabase.from('finance_transactions').select('amount, category, transaction_type')
                .eq('branch_id', branchId).eq('transaction_type', 'expense')
                .gte('created_at', startTs).lte('created_at', endTs),
        ]);
        const expensesByCategory: Record<string, number> = {};
        let operatingExpenses = 0;
        (expenses || []).forEach((e: any) => {
            const ok = String(e.status || e.approval_status || '').toLowerCase();
            if (ok && !['approved', 'completed', 'paid'].includes(ok)) return;
            const cat = e.category || 'Other';
            expensesByCategory[cat] = (expensesByCategory[cat] || 0) + n(e.amount);
            operatingExpenses += n(e.amount);
        });
        const pettyCashTotal = (pettyCash || []).reduce((s: number, p: any) => s + n(p.amount), 0);
        if (pettyCashTotal > 0) {
            expensesByCategory['Petty Cash'] = (expensesByCategory['Petty Cash'] || 0) + pettyCashTotal;
            operatingExpenses += pettyCashTotal;
        }
        (financeExpenses || []).forEach((e: any) => {
            const cat = e.category || 'Finance';
            expensesByCategory[cat] = (expensesByCategory[cat] || 0) + n(e.amount);
            operatingExpenses += n(e.amount);
        });

        // ── 7. Roll up ──────────────────────────────────────────────────────────
        const outletList = Array.from(outlets.values())
            .map((o) => {
                const grossProfit = o.revenue - o.cogs;
                const margin = o.revenue > 0 ? (grossProfit / o.revenue) * 100 : 0;
                return {
                    outlet_id: o.outlet_id,
                    name: o.name,
                    type: o.type,
                    revenue: Math.round(o.revenue * 100) / 100,
                    cogs: Math.round(o.cogs * 100) / 100,
                    gross_profit: Math.round(grossProfit * 100) / 100,
                    margin: Math.round(margin * 10) / 10,
                    units: o.units,
                };
            })
            .sort((a, b) => b.revenue - a.revenue);

        const totalRevenue = outletList.reduce((s, o) => s + o.revenue, 0);
        const totalCogs = outletList.reduce((s, o) => s + o.cogs, 0);
        const grossProfit = totalRevenue - totalCogs;
        const operatingIncome = grossProfit - operatingExpenses;
        const netProfit = operatingIncome;
        const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
        const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        const revenueBySource: Record<string, number> = {};
        outletList.forEach((o) => { revenueBySource[o.name] = o.revenue; });

        return {
            period: { from: startDate, to: endDate },
            revenue: Math.round(totalRevenue * 100) / 100,
            cashierRevenue: Math.round(cashierRevenue * 100) / 100,
            costOfGoods: Math.round(totalCogs * 100) / 100,
            grossProfit: Math.round(grossProfit * 100) / 100,
            operatingExpenses: Math.round(operatingExpenses * 100) / 100,
            operatingIncome: Math.round(operatingIncome * 100) / 100,
            otherExpenses: 0,
            netProfit: Math.round(netProfit * 100) / 100,
            margin: Math.round(netMargin * 10) / 10,
            grossMargin: Math.round(grossMargin * 10) / 10,
            outlets: outletList,
            revenueBySource,
            expensesByCategory,
        };
};

/**
 * @route GET /api/finance/pos-profit-loss
 */
export const getPosProfitLoss = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const params = resolvePnlParams(req);
        if (!params) {
            res.status(400).json({ success: false, error: 'Branch ID is required' });
            return;
        }
        const data = await computePosProfitLoss(params.branchId, params.startDate, params.endDate);
        res.status(200).json({ success: true, data });
    } catch (error) {
        logger.error('Error generating POS profit & loss:', error);
        next(error);
    }
};

/**
 * @desc    Export the per-outlet P&L as a FamousGate-branded PDF
 * @route   GET /api/finance/pos-profit-loss/export/pdf
 */
export const exportPosProfitLossPDF = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const params = resolvePnlParams(req);
        if (!params) {
            res.status(400).json({ success: false, error: 'Branch ID is required' });
            return;
        }
        const data = await computePosProfitLoss(params.branchId, params.startDate, params.endDate);
        const { data: branch } = await supabase
            .from('branches').select('name').eq('id', params.branchId).maybeSingle();
        const branchName = branch?.name || 'Branch';
        const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
        const pct = (v: any) => `${num(v).toFixed(1)}%`;

        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const chunks: Buffer[] = [];
        doc.on('data', (c: any) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

        let y = plHeader(doc, 'PROFIT & LOSS STATEMENT',
            `${branchName}  |  ${params.startDate} to ${params.endDate}`);

        // Summary
        y = plSectionTitle(doc, 'Summary', y);
        y = plTable(doc, y,
            ['Line', 'Amount', 'Margin'],
            [
                ['Total Revenue', plMoney(data.revenue), ''],
                ['Cashier-Recorded Sales', plMoney(data.cashierRevenue), ''],
                ['Cost of Goods Sold (COGS)', plMoney(data.costOfGoods), ''],
                ['Gross Profit', plMoney(data.grossProfit), pct(data.grossMargin)],
                ['Operating Expenses', plMoney(data.operatingExpenses), ''],
                ['Operating Income', plMoney(data.operatingIncome), ''],
                ['NET PROFIT / (LOSS)', plMoney(data.netProfit), pct(data.margin)],
            ],
            [240, 175, 100], ['left', 'right', 'right']);

        // Per-outlet
        y = plSpace(doc, y, 80);
        y = plSectionTitle(doc, 'Profit & Loss by POS Outlet', y);
        const outlets = Array.isArray(data.outlets) ? data.outlets : [];
        if (outlets.length) {
            const rows = outlets.map((o: any) => [
                String(o.name || 'Outlet'), plMoney(o.revenue), plMoney(o.cogs),
                plMoney(o.gross_profit), pct(o.margin), String(num(o.units)),
            ]);
            rows.push(['TOTAL', plMoney(data.revenue), plMoney(data.costOfGoods),
                plMoney(data.grossProfit), pct(data.grossMargin), '']);
            y = plTable(doc, y,
                ['POS Outlet', 'Revenue', 'COGS', 'Gross Profit', 'Margin', 'Units'],
                rows, [150, 95, 85, 95, 55, 35],
                ['left', 'right', 'right', 'right', 'right', 'right']);
        } else {
            doc.fillColor(PL_SECONDARY).fontSize(9).font('Helvetica')
                .text('No POS outlet sales in this period.', 40, y);
            y += 20;
        }

        // Expenses
        const exp = (data.expensesByCategory || {}) as Record<string, any>;
        const expKeys = Object.keys(exp);
        if (expKeys.length) {
            y = plSpace(doc, y, 80);
            y = plSectionTitle(doc, 'Operating Expenses', y);
            const rows = expKeys.map((k) => [k, plMoney(exp[k])]);
            rows.push(['TOTAL', plMoney(data.operatingExpenses)]);
            y = plTable(doc, y, ['Category', 'Amount'], rows, [380, 135], ['left', 'right']);
        }

        plFooter(doc);
        doc.end();
        const pdf = await done;

        const filename = `FG_Profit_Loss_${params.startDate}_${params.endDate}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(pdf);
    } catch (error: any) {
        logger.error('Error exporting POS P&L PDF:', error?.message || error);
        next(error);
    }
};

/**
 * @desc    Branch P&L sourced from the get_branch_profit_loss() Postgres RPC
 *          (migration 20260622_famousgate_major_redesign.sql, section 2) —
 *          aggregates revenue, verified collections, expenses, and COGS
 *          server-side in a single JSONB-returning function call.
 * @route   GET /api/finance/branch-profit-loss
 * @access  Branch Accountant, Branch Manager, Director, Auditor, GM, Super Admin
 */
export const getBranchProfitLossRpc = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const params = resolvePnlParams(req);
        if (!params) {
            res.status(400).json({ success: false, error: 'Branch ID is required' });
            return;
        }
        const branchId = Number(params.branchId);
        if (!Number.isInteger(branchId)) {
            res.status(400).json({ success: false, error: 'branch_id must be an integer' });
            return;
        }
        const isValidDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
        if (!isValidDate(params.startDate) || !isValidDate(params.endDate)) {
            res.status(400).json({ success: false, error: 'from_date/to_date must be valid YYYY-MM-DD dates' });
            return;
        }
        if (params.startDate > params.endDate) {
            res.status(400).json({ success: false, error: 'from_date must not be after to_date' });
            return;
        }

        const { data, error } = await supabase.rpc('get_branch_profit_loss', {
            branch_id: branchId,
            start_date: params.startDate,
            end_date: params.endDate,
        });

        if (error) throw error;

        const rpcData: Record<string, any> = data || {};
        const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
        const round2 = (v: number) => Math.round(v * 100) / 100;

        // The live get_branch_profit_loss() RPC prices COGS off goods_receipt_lines
        // (stock RECEIVED directly at this branch via a local GRN). Branches like
        // this one mostly get stock via central-store dispatch, not local supplier
        // GRNs, so that figure is almost always 0 — which then makes gross/net
        // profit silently equal system_revenue instead of reflecting real cost.
        // computePosProfitLoss() already derives true cost of goods SOLD from
        // actual POS/restaurant/bar order line items (the same data backing the
        // "P&L by POS Outlet" table below) — reuse that instead of the RPC's cogs.
        const posPnl = await computePosProfitLoss(branchId, params.startDate, params.endDate);

        const systemRevenue = n(rpcData.system_revenue);
        const cogs = n(posPnl.costOfGoods);

        // The RPC also mislays 'operational' as a sibling top-level
        // operational_expenses field instead of inside expenses_by_category, and
        // omits net_margin entirely — both silently read as 0 by the frontend.
        const expensesByCategory: Record<string, number> = {
            ...(rpcData.expenses_by_category || {}),
            operational: n(rpcData.operational_expenses),
        };
        if (n(rpcData.other_expenses) !== 0) {
            expensesByCategory.other = n(rpcData.other_expenses);
        }
        const totalExpenses = Object.values(expensesByCategory).reduce((s, v) => s + n(v), 0);

        const grossProfit = systemRevenue - cogs;
        const netProfit = grossProfit - totalExpenses;
        const netMargin = systemRevenue === 0 ? 0 : round2((netProfit / systemRevenue) * 100);

        res.status(200).json({
            success: true,
            data: {
                period: { from: params.startDate, to: params.endDate },
                branch_id: branchId,
                ...rpcData,
                expenses_by_category: expensesByCategory,
                cogs: round2(cogs),
                gross_profit: round2(grossProfit),
                net_profit: round2(netProfit),
                net_margin: netMargin,
            },
        });
    } catch (error) {
        logger.error('Error generating branch profit & loss (RPC):', error);
        next(error);
    }
};
