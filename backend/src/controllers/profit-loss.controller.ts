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
 * @desc    Get profit & loss statement
 * @route   GET /api/finance/profit-loss
 * @access  Private (Branch Manager, Auditor, Super Admin)
 */
export const getProfitLossStatement = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, from_date, to_date } = req.query;

        console.log('🔍 [P&L] Fetching profit & loss statement:', { branch_id, from_date, to_date });

        // Calculate date range (default: current month)
        const now = new Date();
        const endDate = (to_date as string) || now.toISOString().split('T')[0];
        const startDate = (from_date as string) || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

        if (!branch_id || branch_id === '0') {
            res.status(400).json({
                success: false,
                error: 'Branch ID is required'
            });
            return;
        }

        // ===== REVENUE CALCULATION =====
        console.log('📊 [P&L] Calculating revenue...');

        // 1. Room Revenue (from bookings)
        const { data: bookings, error: bookingsError } = await supabase
            .from('bookings')
            .select('total_amount, status')
            .eq('branch_id', branch_id)
            .gte('check_in_date', startDate)
            .lte('check_in_date', endDate)
            .in('status', ['confirmed', 'checked_in', 'checked_out']);

        if (bookingsError) {
            console.error('❌ [P&L] Error fetching bookings:', bookingsError);
        }

        const roomRevenue = (bookings || []).reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

        // 2. F&B Revenue (restaurant + bar)
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('total_amount, order_type, status')
            .eq('branch_id', branch_id)
            .gte('created_at', `${startDate}T00:00:00`)
            .lte('created_at', `${endDate}T23:59:59`)
            .eq('status', 'completed');

        if (ordersError) {
            console.error('❌ [P&L] Error fetching orders:', ordersError);
        }

        const restaurantRevenue = (orders || [])
            .filter(o => o.order_type === 'restaurant' || o.order_type === 'dine_in')
            .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

        const barRevenue = (orders || [])
            .filter(o => o.order_type === 'bar')
            .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

        // 3. Additional Services Revenue
        const { data: services, error: servicesError } = await supabase
            .from('additional_services')
            .select('amount, status')
            .eq('branch_id', branch_id)
            .gte('created_at', `${startDate}T00:00:00`)
            .lte('created_at', `${endDate}T23:59:59`)
            .eq('status', 'completed');

        if (servicesError) {
            console.error('❌ [P&L] Error fetching services:', servicesError);
        }

        const servicesRevenue = (services || []).reduce((sum, s) => sum + Number(s.amount || 0), 0);

        // 4. Conference Revenue
        const { data: conferences, error: conferencesError } = await supabase
            .from('conference_bookings')
            .select('total_amount, status')
            .eq('branch_id', branch_id)
            .gte('booking_date', startDate)
            .lte('booking_date', endDate)
            .in('status', ['confirmed', 'completed']);

        if (conferencesError) {
            console.error('❌ [P&L] Error fetching conferences:', conferencesError);
        }

        const conferenceRevenue = (conferences || []).reduce((sum, c) => sum + Number(c.total_amount || 0), 0);

        const totalRevenue = roomRevenue + restaurantRevenue + barRevenue + servicesRevenue + conferenceRevenue;

        console.log('✅ [P&L] Revenue calculated:', {
            room: roomRevenue,
            restaurant: restaurantRevenue,
            bar: barRevenue,
            services: servicesRevenue,
            conference: conferenceRevenue,
            total: totalRevenue
        });

        // ===== EXPENSES CALCULATION =====
        console.log('📊 [P&L] Calculating expenses...');

        // 1. Cost of Goods Sold (COGS) - Stock purchases
        const { data: purchases, error: purchasesError } = await supabase
            .from('purchases')
            .select('total_amount, status')
            .eq('branch_id', branch_id)
            .gte('purchase_date', startDate)
            .lte('purchase_date', endDate)
            .in('status', ['approved', 'completed']);

        if (purchasesError) {
            console.error('❌ [P&L] Error fetching purchases:', purchasesError);
        }

        const cogs = (purchases || []).reduce((sum, p) => sum + Number(p.total_amount || 0), 0);

        // 2. Payroll Expenses
        const { data: payroll, error: payrollError } = await supabase
            .from('payroll')
            .select('net_salary, status')
            .eq('branch_id', branch_id)
            .gte('pay_period_start', startDate)
            .lte('pay_period_end', endDate)
            .eq('status', 'paid');

        if (payrollError) {
            console.error('❌ [P&L] Error fetching payroll:', payrollError);
        }

        const payrollExpenses = (payroll || []).reduce((sum, p) => sum + Number(p.net_salary || 0), 0);

        // 3. Petty Cash Expenses
        const { data: pettyCash, error: pettyCashError } = await supabase
            .from('petty_cash_transactions')
            .select('amount, transaction_type')
            .eq('branch_id', branch_id)
            .gte('transaction_date', startDate)
            .lte('transaction_date', endDate)
            .eq('transaction_type', 'expense');

        if (pettyCashError) {
            console.error('❌ [P&L] Error fetching petty cash:', pettyCashError);
        }

        const pettyCashExpenses = (pettyCash || []).reduce((sum, pc) => sum + Number(pc.amount || 0), 0);

        // 4. Maintenance Expenses
        const { data: maintenance, error: maintenanceError } = await supabase
            .from('maintenance_requests')
            .select('estimated_cost, status')
            .eq('branch_id', branch_id)
            .gte('created_at', `${startDate}T00:00:00`)
            .lte('created_at', `${endDate}T23:59:59`)
            .eq('status', 'completed');

        if (maintenanceError) {
            console.error('❌ [P&L] Error fetching maintenance:', maintenanceError);
        }

        const maintenanceExpenses = (maintenance || []).reduce((sum, m) => sum + Number(m.estimated_cost || 0), 0);

        // 5. Utilities & Other Operating Expenses (from expenses table if exists)
        const { data: otherExpenses, error: otherExpensesError } = await supabase
            .from('expenses')
            .select('amount, status')
            .eq('branch_id', branch_id)
            .gte('expense_date', startDate)
            .lte('expense_date', endDate)
            .eq('status', 'approved');

        if (otherExpensesError) {
            console.error('❌ [P&L] Error fetching other expenses:', otherExpensesError);
        }

        const otherOperatingExpenses = (otherExpenses || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);

        const totalExpenses = cogs + payrollExpenses + pettyCashExpenses + maintenanceExpenses + otherOperatingExpenses;

        console.log('✅ [P&L] Expenses calculated:', {
            cogs,
            payroll: payrollExpenses,
            pettyCash: pettyCashExpenses,
            maintenance: maintenanceExpenses,
            other: otherOperatingExpenses,
            total: totalExpenses
        });

        // ===== PROFIT CALCULATION =====
        const grossProfit = totalRevenue - cogs;
        const operatingExpenses = payrollExpenses + pettyCashExpenses + maintenanceExpenses + otherOperatingExpenses;
        const operatingProfit = grossProfit - operatingExpenses;
        const netProfit = totalRevenue - totalExpenses;

        const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
        const operatingMargin = totalRevenue > 0 ? (operatingProfit / totalRevenue) * 100 : 0;
        const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        console.log('✅ [P&L] Profit calculated:', {
            gross: grossProfit,
            operating: operatingProfit,
            net: netProfit
        });

        // ===== RESPONSE =====
        res.status(200).json({
            success: true,
            data: {
                period: {
                    from: startDate,
                    to: endDate
                },
                revenue: {
                    rooms: roomRevenue,
                    restaurant: restaurantRevenue,
                    bar: barRevenue,
                    services: servicesRevenue,
                    conference: conferenceRevenue,
                    total: totalRevenue
                },
                expenses: {
                    cogs,
                    payroll: payrollExpenses,
                    petty_cash: pettyCashExpenses,
                    maintenance: maintenanceExpenses,
                    other_operating: otherOperatingExpenses,
                    total: totalExpenses
                },
                profit: {
                    gross_profit: grossProfit,
                    operating_profit: operatingProfit,
                    net_profit: netProfit
                },
                margins: {
                    gross_margin: grossMargin,
                    operating_margin: operatingMargin,
                    net_margin: netMargin
                }
            }
        });
    } catch (error) {
        console.error('❌ [P&L] Error:', error);
        logger.error('Error generating profit & loss statement:', error);
        next(error);
    }
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

        // ── 1. POS outlets: revenue + COGS from cashier shift stock counts ──────
        const { data: posOutlets } = await supabase
            .from('pos_outlets')
            .select('id, name, outlet_type')
            .eq('branch_id', branchId);
        const posOutletIds = (posOutlets || []).map((o: any) => o.id);
        const posOutletById = new Map<string, any>();
        (posOutlets || []).forEach((o: any) => posOutletById.set(String(o.id), o));

        if (posOutletIds.length) {
            const { data: posOrders } = await supabase
                .from('pos_shift_orders')
                .select('id, outlet_id, shift_id, total_amount, created_at, status')
                .in('outlet_id', posOutletIds)
                .gte('created_at', startTs)
                .lte('created_at', endTs);
            const shiftToOutlet = new Map<string, string>();
            const shiftIds = new Set<string>();
            (posOrders || []).forEach((o: any) => {
                if (o.shift_id) {
                    shiftToOutlet.set(String(o.shift_id), String(o.outlet_id));
                    shiftIds.add(String(o.shift_id));
                }
            });
            if (shiftIds.size) {
                const { data: counts } = await supabase
                    .from('pos_shift_stock_counts')
                    .select('shift_id, sold_quantity, cost_price, selling_price')
                    .in('shift_id', Array.from(shiftIds));
                (counts || []).forEach((c: any) => {
                    const oid = shiftToOutlet.get(String(c.shift_id));
                    if (!oid) return;
                    const meta = posOutletById.get(oid);
                    const acc = outletFor(oid, meta?.name || 'POS Outlet', meta?.outlet_type || 'pos');
                    const qty = n(c.sold_quantity);
                    acc.revenue += qty * n(c.selling_price);
                    acc.cogs += qty * n(c.cost_price);
                    acc.units += qty;
                });
            }
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
        const { data: restOrders } = await supabase
            .from('restaurant_orders')
            .select('id, total_amount, grand_total, status')
            .eq('branch_id', branchId)
            .gte('created_at', startTs)
            .lte('created_at', endTs)
            .not('status', 'eq', 'cancelled');
        if ((restOrders || []).length) {
            const acc = outletFor('restaurant', 'Restaurant', 'restaurant');
            const restIds = (restOrders || []).map((o: any) => o.id);
            (restOrders || []).forEach((o: any) => { acc.revenue += n(o.grand_total) || n(o.total_amount); });
            const { data: items } = await supabase
                .from('restaurant_order_items')
                .select('order_id, menu_item_id, quantity')
                .in('order_id', restIds);
            (items || []).forEach((it: any) => {
                const qty = n(it.quantity);
                acc.cogs += qty * (restCost.get(String(it.menu_item_id)) || 0);
                acc.units += qty;
            });
        }

        // ── 4. Bar orders → "Bar" outlet (revenue + item COGS) ──────────────────
        const { data: barOrders } = await supabase
            .from('bar_orders')
            .select('id, total, subtotal, status')
            .eq('branch_id', branchId)
            .gte('created_at', startTs)
            .lte('created_at', endTs)
            .not('status', 'eq', 'cancelled');
        if ((barOrders || []).length) {
            const acc = outletFor('bar', 'Bar', 'bar');
            const barIds = (barOrders || []).map((o: any) => o.id);
            (barOrders || []).forEach((o: any) => { acc.revenue += n(o.total) || n(o.subtotal); });
            const { data: items } = await supabase
                .from('bar_order_items')
                .select('order_id, drink_id, quantity')
                .in('order_id', barIds);
            (items || []).forEach((it: any) => {
                const qty = n(it.quantity);
                acc.cogs += qty * (barCost.get(String(it.drink_id)) || 0);
                acc.units += qty;
            });
        }

        // ── 5. Cashier-recorded revenue cross-check (cashier_shifts) ─────────────
        // Primary: cashier_shifts.actual_cash (what cashiers physically handed over)
        // Fallback: shift_transactions if cashier_shifts has no data for this branch
        const [{ data: cashierShiftsData }, { data: shiftTxns }] = await Promise.all([
            supabase.from('cashier_shifts')
                .select('actual_cash, expected_cash')
                .eq('branch_id', branchId)
                .gte('start_time', startTs)
                .lte('start_time', endTs),
            supabase.from('shift_transactions')
                .select('total_amount, is_voided')
                .eq('branch_id', branchId)
                .gte('created_at', startTs)
                .lte('created_at', endTs),
        ]);
        const cashierShiftTotal = (cashierShiftsData || []).reduce((s: number, t: any) => s + n(t.actual_cash || t.expected_cash), 0);
        const shiftTxnTotal = (shiftTxns || []).filter((t: any) => t.is_voided !== true).reduce((s: number, t: any) => s + n(t.total_amount), 0);
        const cashierRevenue = cashierShiftTotal > 0 ? cashierShiftTotal : shiftTxnTotal;

        // ── 6. Branch operating expenses ────────────────────────────────────────
        const [{ data: expenses }, { data: pettyCash }] = await Promise.all([
            supabase.from('expenses').select('amount, category, status, approval_status')
                .eq('branch_id', branchId).gte('expense_date', startDate).lte('expense_date', endDate),
            supabase.from('petty_cash_transactions').select('amount, status')
                .eq('branch_id', branchId).gte('date', startDate).lte('date', endDate),
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
 * @desc    Get expense breakdown by category
 * @route   GET /api/finance/expense-breakdown
 * @access  Private
 */
export const getExpenseBreakdown = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, from_date, to_date } = req.query;

        console.log('🔍 [P&L] Fetching expense breakdown:', { branch_id, from_date, to_date });

        const now = new Date();
        const endDate = (to_date as string) || now.toISOString().split('T')[0];
        const startDate = (from_date as string) || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

        if (!branch_id || branch_id === '0') {
            res.status(400).json({
                success: false,
                error: 'Branch ID is required'
            });
            return;
        }

        // Get expenses by category
        const { data: expenses, error } = await supabase
            .from('expenses')
            .select('amount, category, description, expense_date')
            .eq('branch_id', branch_id)
            .gte('expense_date', startDate)
            .lte('expense_date', endDate)
            .eq('status', 'approved')
            .order('expense_date', { ascending: false });

        if (error) throw error;

        // Group by category
        const breakdown: Record<string, { total: number; count: number; items: any[] }> = {};

        (expenses || []).forEach(expense => {
            const category = expense.category || 'Uncategorized';
            if (!breakdown[category]) {
                breakdown[category] = { total: 0, count: 0, items: [] };
            }
            breakdown[category].total += Number(expense.amount || 0);
            breakdown[category].count += 1;
            breakdown[category].items.push(expense);
        });

        res.status(200).json({
            success: true,
            data: {
                breakdown,
                period: { from: startDate, to: endDate }
            }
        });
    } catch (error) {
        logger.error('Error fetching expense breakdown:', error);
        next(error);
    }
};
