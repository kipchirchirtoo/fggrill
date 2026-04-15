import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

const ExcelJS = require('exceljs');

// ── Shared helpers ────────────────────────────────────────────────────────────

function applyTitleBlock(ws: any, title: string, subtitle: string, colCount: number) {
  const lastCol = String.fromCharCode(64 + colCount);
  ws.mergeCells(`A1:${lastCol}1`);
  const t = ws.getCell('A1');
  t.value = `FAMOUSGATE HOTELS — ${title}`;
  t.font = { name: 'Calibri', bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3C5E' } };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 34;

  ws.mergeCells(`A2:${lastCol}2`);
  const s = ws.getCell('A2');
  s.value = subtitle;
  s.font = { name: 'Calibri', italic: true, size: 10, color: { argb: 'FFFFFFFF' } };
  s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E6DA4' } };
  s.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 20;
  ws.addRow([]);
}

function applyHeaderRow(ws: any, headers: string[], rowNum: number) {
  const row = ws.getRow(rowNum);
  headers.forEach((h, i) => {
    const cell = row.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3C5E' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } } };
  });
  row.height = 28;
}

function styleDataCell(cell: any, isEven: boolean, align: 'left' | 'right' | 'center' = 'left', numFmt?: string, flagged?: boolean) {
  const bg = flagged ? 'FFFFF3CD' : (isEven ? 'FFF5F9FF' : 'FFFFFFFF');
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  cell.font = { name: 'Calibri', size: 10 };
  cell.alignment = { horizontal: align, vertical: 'middle', wrapText: align === 'left' };
  cell.border = { top: { style: 'hair', color: { argb: 'FFD0D7E0' } }, bottom: { style: 'hair', color: { argb: 'FFD0D7E0' } }, left: { style: 'hair', color: { argb: 'FFD0D7E0' } }, right: { style: 'hair', color: { argb: 'FFD0D7E0' } } };
  if (numFmt) cell.numFmt = numFmt;
}

function addSummaryRow(ws: any, label: string, colCount: number, summaryValues: { col: number; value: any; numFmt?: string }[]) {
  ws.addRow([]);
  const rowNum = ws.lastRow.number + 1;
  const row = ws.getRow(rowNum);
  ws.mergeCells(`A${rowNum}:C${rowNum}`);
  const lc = row.getCell(1);
  lc.value = label;
  lc.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3C5E' } };
  lc.alignment = { horizontal: 'left', vertical: 'middle' };
  summaryValues.forEach(({ col, value, numFmt }) => {
    const c = row.getCell(col);
    c.value = value;
    c.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3C5E' } };
    c.alignment = { horizontal: 'right', vertical: 'middle' };
    if (numFmt) c.numFmt = numFmt;
  });
  row.height = 24;
}

async function sendWorkbook(res: Response, workbook: any, filename: string) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

function branchFilter(query: any, branch_ids: string | undefined, field = 'branch_id') {
  if (!branch_ids) return query;
  const ids = branch_ids.split(',').map(Number).filter(Boolean);
  if (ids.length === 1) return query.eq(field, ids[0]);
  if (ids.length > 1) return query.in(field, ids);
  return query;
}

// ── 1. Exception Summary ──────────────────────────────────────────────────────
export const exportExceptionSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branch_ids, start_date, end_date, branch_name = 'All Branches' } = req.query as any;

    let q = supabase.from('audit_exceptions').select('*, branch:branches(name)').order('created_at', { ascending: false });
    q = branchFilter(q, branch_ids);
    if (start_date) q = q.gte('created_at', start_date);
    if (end_date) q = q.lte('created_at', end_date + 'T23:59:59');
    const { data: exceptionsRaw, error } = await q;
    if (error) throw error;

    // Manually enrich raised_by user (no FK in schema)
    const raisedByIds = [...new Set((exceptionsRaw || []).map((e: any) => e.raised_by).filter(Boolean))];
    const raisedByMap: Record<string, any> = {};
    if (raisedByIds.length > 0) {
      const { data: raisedUsers } = await supabase.from('users').select('id, first_name, last_name').in('id', raisedByIds);
      (raisedUsers || []).forEach((u: any) => { raisedByMap[u.id] = u; });
    }
    const exceptions = (exceptionsRaw || []).map((e: any) => ({
      ...e,
      raised_by_user: e.raised_by ? (raisedByMap[e.raised_by] || null) : null,
    }));

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Exception Summary', { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 } });
    ws.columns = [
      { key: 'id', width: 10 }, { key: 'type', width: 22 }, { key: 'branch', width: 22 },
      { key: 'description', width: 40 }, { key: 'severity', width: 14 }, { key: 'status', width: 14 },
      { key: 'raised_by', width: 22 }, { key: 'date', width: 18 },
    ];
    applyTitleBlock(ws, 'AUDIT EXCEPTION SUMMARY', `Branch: ${branch_name}  |  Period: ${start_date || 'All'} → ${end_date || 'All'}  |  Generated: ${new Date().toLocaleString()}`, 8);
    applyHeaderRow(ws, ['#', 'Exception Type', 'Branch', 'Description', 'Severity', 'Status', 'Raised By', 'Date'], 4);
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4, activeCell: 'A5' }];

    let open = 0, resolved = 0, critical = 0;
    (exceptions || []).forEach((ex: any, i: number) => {
      const isEven = i % 2 === 0;
      const isCritical = ex.severity === 'critical' || ex.severity === 'high';
      if (ex.status === 'open') open++; else resolved++;
      if (isCritical) critical++;
      const row = ws.addRow([
        i + 1, ex.exception_type || ex.type || 'N/A',
        ex.branch?.name || 'N/A', ex.description || '',
        ex.severity || 'medium', ex.status || 'open',
        ex.raised_by_user ? `${ex.raised_by_user.first_name} ${ex.raised_by_user.last_name}` : 'System',
        ex.created_at ? new Date(ex.created_at).toLocaleDateString() : 'N/A',
      ]);
      row.height = 20;
      row.eachCell((cell: any, col: number) => {
        styleDataCell(cell, isEven, col === 4 ? 'left' : 'center', undefined, isCritical && ex.status === 'open');
        if (col === 5) {
          const colors: any = { critical: ['FF9B1C1C', 'FFFEE2E2'], high: ['FF92400E', 'FFFEF3C7'], medium: ['FF1E40AF', 'FFDBEAFE'], low: ['FF166534', 'FFD1FAE5'] };
          const [fg, bg] = colors[ex.severity] || colors.medium;
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: fg } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        }
        if (col === 6) {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: ex.status === 'open' ? 'FF9B1C1C' : 'FF166534' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ex.status === 'open' ? 'FFFEE2E2' : 'FFD1FAE5' } };
        }
      });
    });
    addSummaryRow(ws, `Total: ${(exceptions || []).length}  |  Open: ${open}  |  Resolved: ${resolved}  |  Critical: ${critical}`, 8, []);
    await sendWorkbook(res, wb, `exception_summary_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (e) { next(e); }
};

// ── 2. Voided Transaction Analysis ───────────────────────────────────────────
export const exportVoidAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branch_ids, start_date, end_date, branch_name = 'All Branches' } = req.query as any;
    const start = start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const end = (end_date || new Date().toISOString().split('T')[0]) + 'T23:59:59';

    let rq = supabase.from('restaurant_orders').select('id, order_number, total_amount, table_number, created_at, staff_id, branch_id, branch:branches(name), staff:users!staff_id(first_name, last_name)').eq('status', 'cancelled').gte('created_at', start).lte('created_at', end);
    rq = branchFilter(rq, branch_ids);
    let bq = supabase.from('bar_orders').select('id, order_number, total, created_at, staff_id, branch_id, branch:branches(name), staff:users!staff_id(first_name, last_name)').eq('status', 'cancelled').gte('created_at', start).lte('created_at', end);
    bq = branchFilter(bq, branch_ids);

    const [{ data: restVoids }, { data: barVoids }] = await Promise.all([rq, bq]);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Voided Transactions', { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 } });
    ws.columns = [
      { key: 'num', width: 8 }, { key: 'source', width: 14 }, { key: 'order_no', width: 18 },
      { key: 'branch', width: 22 }, { key: 'amount', width: 16 }, { key: 'staff', width: 24 },
      { key: 'table', width: 12 }, { key: 'date', width: 20 },
    ];
    applyTitleBlock(ws, 'VOIDED TRANSACTION ANALYSIS', `Branch: ${branch_name}  |  Period: ${start_date} → ${end_date}  |  Generated: ${new Date().toLocaleString()}`, 8);
    applyHeaderRow(ws, ['#', 'Source', 'Order No.', 'Branch', 'Amount (KES)', 'Voided By', 'Table/Bar', 'Date & Time'], 4);
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4, activeCell: 'A5' }];

    let idx = 0;
    let totalVoided = 0;
    const allVoids = [
      ...(restVoids || []).map((v: any) => ({ ...v, source: 'Restaurant', amount: v.total_amount, table: v.table_number })),
      ...(barVoids || []).map((v: any) => ({ ...v, source: 'Bar', amount: v.total, table: 'Bar' })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    allVoids.forEach((v: any) => {
      const isEven = idx % 2 === 0;
      const amt = Number(v.amount || 0);
      totalVoided += amt;
      const row = ws.addRow([
        ++idx, v.source, v.order_number || 'N/A',
        v.branch?.name || 'N/A', amt,
        v.staff ? `${v.staff.first_name} ${v.staff.last_name}` : 'Unknown',
        v.table || 'N/A',
        v.created_at ? new Date(v.created_at).toLocaleString() : 'N/A',
      ]);
      row.height = 20;
      row.eachCell((cell: any, col: number) => {
        styleDataCell(cell, isEven, col === 5 ? 'right' : 'center');
        if (col === 5) cell.numFmt = '"KES "#,##0.00';
      });
    });
    addSummaryRow(ws, `Total Voided Transactions: ${allVoids.length}`, 8, [{ col: 5, value: totalVoided, numFmt: '"KES "#,##0.00' }]);
    await sendWorkbook(res, wb, `void_analysis_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (e) { next(e); }
};

// ── 3. Revenue Reconciliation ─────────────────────────────────────────────────
export const exportRevenueReconciliation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branch_ids, start_date, end_date, branch_name = 'All Branches' } = req.query as any;
    const start = (start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]) + 'T00:00:00';
    const end = (end_date || new Date().toISOString().split('T')[0]) + 'T23:59:59';

    let rq = supabase.from('restaurant_orders').select('total_amount, created_at, branch_id, branch:branches(name)').in('status', ['completed', 'paid']).gte('created_at', start).lte('created_at', end);
    let bq = supabase.from('bar_orders').select('total, created_at, branch_id, branch:branches(name)').in('status', ['completed', 'paid', 'closed']).gte('created_at', start).lte('created_at', end);
    let roomq = supabase.from('reservations').select('total_amount, created_at, branch_id, branch:branches(name)').in('status', ['confirmed', 'checked_in', 'checked_out']).gte('created_at', start).lte('created_at', end);
    let posq = supabase.from('pos_transactions').select('amount, created_at, branch_id, branch:branches(name)').gte('created_at', start).lte('created_at', end);
    let payq = supabase.from('payments').select('amount, payment_method, created_at').gte('created_at', start).lte('created_at', end);

    rq = branchFilter(rq, branch_ids); bq = branchFilter(bq, branch_ids);
    roomq = branchFilter(roomq, branch_ids); posq = branchFilter(posq, branch_ids);

    const [{ data: rest }, { data: bar }, { data: rooms }, { data: pos }, { data: payments }] = await Promise.all([rq, bq, roomq, posq, payq]);

    const totalRest = (rest || []).reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0);
    const totalBar = (bar || []).reduce((s: number, r: any) => s + Number(r.total || 0), 0);
    const totalRooms = (rooms || []).reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0);
    const totalPos = (pos || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const totalPayments = (payments || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const totalRevenue = totalRest + totalBar + totalRooms + totalPos;
    const variance = totalRevenue - totalPayments;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Revenue Reconciliation', { pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1 } });
    ws.columns = [{ key: 'stream', width: 30 }, { key: 'transactions', width: 18 }, { key: 'amount', width: 22 }, { key: 'pct', width: 16 }];
    applyTitleBlock(ws, 'REVENUE RECONCILIATION', `Branch: ${branch_name}  |  Period: ${start_date} → ${end_date}  |  Generated: ${new Date().toLocaleString()}`, 4);
    applyHeaderRow(ws, ['Revenue Stream', 'Transactions', 'Amount (KES)', '% of Total'], 4);
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4, activeCell: 'A5' }];

    const streams = [
      { name: 'Restaurant Sales', count: rest?.length || 0, amount: totalRest },
      { name: 'Bar Sales', count: bar?.length || 0, amount: totalBar },
      { name: 'Room Revenue', count: rooms?.length || 0, amount: totalRooms },
      { name: 'POS Transactions', count: pos?.length || 0, amount: totalPos },
    ];
    streams.forEach((s, i) => {
      const isEven = i % 2 === 0;
      const pct = totalRevenue > 0 ? (s.amount / totalRevenue) * 100 : 0;
      const row = ws.addRow([s.name, s.count, s.amount, pct]);
      row.height = 22;
      row.eachCell((cell: any, col: number) => {
        styleDataCell(cell, isEven, col === 1 ? 'left' : 'right');
        if (col === 3) cell.numFmt = '"KES "#,##0.00';
        if (col === 4) cell.numFmt = '#,##0.00"%"';
      });
    });

    // Payments breakdown
    ws.addRow([]);
    applyHeaderRow(ws, ['Payment Method', 'Count', 'Amount (KES)', '% of Payments'], ws.lastRow.number + 1);
    const pmMap: Record<string, { count: number; amount: number }> = {};
    (payments || []).forEach((p: any) => {
      const m = p.payment_method || 'Unknown';
      if (!pmMap[m]) pmMap[m] = { count: 0, amount: 0 };
      pmMap[m].count++; pmMap[m].amount += Number(p.amount || 0);
    });
    Object.entries(pmMap).forEach(([method, data], i) => {
      const pct = totalPayments > 0 ? (data.amount / totalPayments) * 100 : 0;
      const row = ws.addRow([method, data.count, data.amount, pct]);
      row.height = 20;
      row.eachCell((cell: any, col: number) => {
        styleDataCell(cell, i % 2 === 0, col === 1 ? 'left' : 'right');
        if (col === 3) cell.numFmt = '"KES "#,##0.00';
        if (col === 4) cell.numFmt = '#,##0.00"%"';
      });
    });

    addSummaryRow(ws, `Total Revenue: KES ${totalRevenue.toLocaleString()}  |  Total Payments: KES ${totalPayments.toLocaleString()}  |  Variance: KES ${variance.toLocaleString()}`, 4, [
      { col: 3, value: totalRevenue, numFmt: '"KES "#,##0.00' },
    ]);
    await sendWorkbook(res, wb, `revenue_reconciliation_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (e) { next(e); }
};

// ── 4. Leakage Analysis ───────────────────────────────────────────────────────
export const exportLeakageReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branch_ids, start_date, end_date, branch_name = 'All Branches' } = req.query as any;
    const start = (start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]) + 'T00:00:00';
    const end = (end_date || new Date().toISOString().split('T')[0]) + 'T23:59:59';

    let excQ = supabase.from('audit_exceptions').select('*, branch:branches(name)').eq('status', 'open').gte('created_at', start).lte('created_at', end);
    excQ = branchFilter(excQ, branch_ids);
    let voidRQ = supabase.from('restaurant_orders').select('id, order_number, total_amount, created_at, branch_id, branch:branches(name)').eq('status', 'cancelled').gte('created_at', start).lte('created_at', end);
    voidRQ = branchFilter(voidRQ, branch_ids);
    let voidBQ = supabase.from('bar_orders').select('id, order_number, total, created_at, branch_id, branch:branches(name)').eq('status', 'cancelled').gte('created_at', start).lte('created_at', end);
    voidBQ = branchFilter(voidBQ, branch_ids);
    let wastQ = supabase.from('branch_stock_movements').select('item_sku, quantity, notes, created_at, branch_id, branch:branches(name)').in('movement_type', ['WASTAGE', 'DAMAGE', 'LOSS']).gte('created_at', start).lte('created_at', end);
    wastQ = branchFilter(wastQ, branch_ids);

    const [{ data: exceptions }, { data: restVoids }, { data: barVoids }, { data: wastage }] = await Promise.all([excQ, voidRQ, voidBQ, wastQ]);

    const wb = new ExcelJS.Workbook();

    // Sheet 1: Exceptions
    const ws1 = wb.addWorksheet('Open Exceptions');
    ws1.columns = [{ key: 'n', width: 8 }, { key: 'type', width: 24 }, { key: 'branch', width: 22 }, { key: 'desc', width: 44 }, { key: 'sev', width: 14 }, { key: 'date', width: 18 }];
    applyTitleBlock(ws1, 'LEAKAGE ANALYSIS — OPEN EXCEPTIONS', `Branch: ${branch_name}  |  Period: ${start_date} → ${end_date}`, 6);
    applyHeaderRow(ws1, ['#', 'Type', 'Branch', 'Description', 'Severity', 'Date'], 4);
    (exceptions || []).forEach((ex: any, i: number) => {
      const row = ws1.addRow([i + 1, ex.exception_type || ex.type || 'N/A', ex.branch?.name || 'N/A', ex.description || '', ex.severity || 'medium', ex.created_at ? new Date(ex.created_at).toLocaleDateString() : 'N/A']);
      row.height = 20;
      row.eachCell((cell: any, col: number) => styleDataCell(cell, i % 2 === 0, col === 4 ? 'left' : 'center'));
    });

    // Sheet 2: Voids
    const ws2 = wb.addWorksheet('Voided Orders');
    ws2.columns = [{ key: 'n', width: 8 }, { key: 'src', width: 14 }, { key: 'no', width: 18 }, { key: 'branch', width: 22 }, { key: 'amt', width: 18 }, { key: 'date', width: 20 }];
    applyTitleBlock(ws2, 'LEAKAGE ANALYSIS — VOIDED ORDERS', `Branch: ${branch_name}  |  Period: ${start_date} → ${end_date}`, 6);
    applyHeaderRow(ws2, ['#', 'Source', 'Order No.', 'Branch', 'Amount (KES)', 'Date'], 4);
    let totalVoids = 0;
    [...(restVoids || []).map((v: any) => ({ ...v, src: 'Restaurant', amt: v.total_amount })),
     ...(barVoids || []).map((v: any) => ({ ...v, src: 'Bar', amt: v.total }))].forEach((v: any, i: number) => {
      totalVoids += Number(v.amt || 0);
      const row = ws2.addRow([i + 1, v.src, v.order_number || 'N/A', v.branch?.name || 'N/A', Number(v.amt || 0), v.created_at ? new Date(v.created_at).toLocaleString() : 'N/A']);
      row.height = 20;
      row.eachCell((cell: any, col: number) => { styleDataCell(cell, i % 2 === 0, col === 5 ? 'right' : 'center'); if (col === 5) cell.numFmt = '"KES "#,##0.00'; });
    });
    addSummaryRow(ws2, `Total Voided Value`, 6, [{ col: 5, value: totalVoids, numFmt: '"KES "#,##0.00' }]);

    // Sheet 3: Wastage
    const ws3 = wb.addWorksheet('Wastage & Losses');
    ws3.columns = [{ key: 'n', width: 8 }, { key: 'sku', width: 20 }, { key: 'branch', width: 22 }, { key: 'qty', width: 14 }, { key: 'notes', width: 36 }, { key: 'date', width: 20 }];
    applyTitleBlock(ws3, 'LEAKAGE ANALYSIS — WASTAGE & LOSSES', `Branch: ${branch_name}  |  Period: ${start_date} → ${end_date}`, 6);
    applyHeaderRow(ws3, ['#', 'Item SKU', 'Branch', 'Quantity', 'Notes', 'Date'], 4);
    (wastage || []).forEach((w: any, i: number) => {
      const row = ws3.addRow([i + 1, w.item_sku, w.branch?.name || 'N/A', Number(w.quantity || 0), w.notes || '', w.created_at ? new Date(w.created_at).toLocaleString() : 'N/A']);
      row.height = 20;
      row.eachCell((cell: any, col: number) => { styleDataCell(cell, i % 2 === 0, col === 4 ? 'right' : 'center'); if (col === 4) cell.numFmt = '#,##0.00'; });
    });

    await sendWorkbook(res, wb, `leakage_report_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (e) { next(e); }
};

// ── 5. Expenditure Audit ──────────────────────────────────────────────────────
export const exportExpenditureAudit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branch_ids, start_date, end_date, branch_name = 'All Branches' } = req.query as any;
    const start = start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const end = end_date || new Date().toISOString().split('T')[0];

    let expQ = supabase.from('expenses').select('*, branch:branches(name), approved_by_user:users!approved_by(first_name, last_name)').gte('expense_date', start).lte('expense_date', end).order('expense_date', { ascending: false });
    expQ = branchFilter(expQ, branch_ids);
    let pcQ = supabase.from('petty_cash_transactions').select('*, branch:branches(name), created_by_user:users!created_by(first_name, last_name)').gte('created_at', start + 'T00:00:00').lte('created_at', end + 'T23:59:59');
    pcQ = branchFilter(pcQ, branch_ids);

    const [{ data: expenses }, { data: pettyCash }] = await Promise.all([expQ, pcQ]);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Expenditure Audit', { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 } });
    ws.columns = [
      { key: 'n', width: 8 }, { key: 'date', width: 16 }, { key: 'branch', width: 22 },
      { key: 'category', width: 22 }, { key: 'description', width: 36 }, { key: 'amount', width: 18 },
      { key: 'approved_by', width: 22 }, { key: 'status', width: 14 },
    ];
    applyTitleBlock(ws, 'EXPENDITURE AUDIT', `Branch: ${branch_name}  |  Period: ${start_date} → ${end_date}  |  Generated: ${new Date().toLocaleString()}`, 8);
    applyHeaderRow(ws, ['#', 'Date', 'Branch', 'Category', 'Description', 'Amount (KES)', 'Approved By', 'Status'], 4);
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4, activeCell: 'A5' }];

    let total = 0;
    const catMap: Record<string, number> = {};
    (expenses || []).forEach((ex: any, i: number) => {
      const amt = Number(ex.amount || 0);
      total += amt;
      catMap[ex.category || 'Other'] = (catMap[ex.category || 'Other'] || 0) + amt;
      const row = ws.addRow([
        i + 1, ex.expense_date || 'N/A', ex.branch?.name || 'N/A',
        ex.category || 'Other', ex.description || '', amt,
        ex.approved_by_user ? `${ex.approved_by_user.first_name} ${ex.approved_by_user.last_name}` : 'Pending',
        ex.status || 'approved',
      ]);
      row.height = 20;
      row.eachCell((cell: any, col: number) => {
        styleDataCell(cell, i % 2 === 0, col === 5 ? 'left' : (col === 6 ? 'right' : 'center'));
        if (col === 6) cell.numFmt = '"KES "#,##0.00';
      });
    });

    // Petty cash sheet
    const ws2 = wb.addWorksheet('Petty Cash');
    ws2.columns = [{ key: 'n', width: 8 }, { key: 'date', width: 18 }, { key: 'branch', width: 22 }, { key: 'type', width: 16 }, { key: 'desc', width: 36 }, { key: 'amt', width: 18 }, { key: 'by', width: 22 }];
    applyTitleBlock(ws2, 'PETTY CASH TRANSACTIONS', `Branch: ${branch_name}  |  Period: ${start_date} → ${end_date}`, 7);
    applyHeaderRow(ws2, ['#', 'Date', 'Branch', 'Type', 'Description', 'Amount (KES)', 'By'], 4);
    let pcTotal = 0;
    (pettyCash || []).forEach((pc: any, i: number) => {
      const amt = Number(pc.amount || 0);
      pcTotal += amt;
      const row = ws2.addRow([i + 1, pc.created_at ? new Date(pc.created_at).toLocaleDateString() : 'N/A', pc.branch?.name || 'N/A', pc.transaction_type || pc.type || 'N/A', pc.description || pc.notes || '', amt, pc.created_by_user ? `${pc.created_by_user.first_name} ${pc.created_by_user.last_name}` : 'N/A']);
      row.height = 20;
      row.eachCell((cell: any, col: number) => { styleDataCell(cell, i % 2 === 0, col === 6 ? 'right' : 'center'); if (col === 6) cell.numFmt = '"KES "#,##0.00'; });
    });
    addSummaryRow(ws2, `Total Petty Cash`, 7, [{ col: 6, value: pcTotal, numFmt: '"KES "#,##0.00' }]);

    addSummaryRow(ws, `Total Expenditure  |  Categories: ${Object.keys(catMap).length}`, 8, [{ col: 6, value: total, numFmt: '"KES "#,##0.00' }]);
    await sendWorkbook(res, wb, `expenditure_audit_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (e) { next(e); }
};

// ── 6. Stock Variance Report ──────────────────────────────────────────────────
export const exportStockVarianceReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branch_ids, start_date, end_date, branch_name = 'All Branches' } = req.query as any;
    const start = (start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]) + 'T00:00:00';
    const end = (end_date || new Date().toISOString().split('T')[0]) + 'T23:59:59';

    let stockQ = supabase.from('branch_stock').select('*, branch:branches(name)');
    stockQ = branchFilter(stockQ, branch_ids);
    let movQ = supabase.from('branch_stock_movements').select('item_sku, quantity, movement_type, branch_id').gte('created_at', start).lte('created_at', end);
    movQ = branchFilter(movQ, branch_ids);

    const [{ data: stock }, { data: movements }] = await Promise.all([stockQ, movQ]);

    const itemSkus = [...new Set((stock || []).map((s: any) => s.item_sku).filter(Boolean))];
    const { data: items } = await supabase.from('simple_items').select('sku, item_name, unit_of_measure, category, cost_price').in('sku', itemSkus as string[]);
    const itemMap: Record<string, any> = Object.fromEntries((items || []).map((i: any) => [i.sku, i]));

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Stock Variance', { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 } });
    ws.columns = [
      { key: 'n', width: 8 }, { key: 'name', width: 30 }, { key: 'sku', width: 18 },
      { key: 'branch', width: 22 }, { key: 'category', width: 18 }, { key: 'unit', width: 12 },
      { key: 'system', width: 16 }, { key: 'in', width: 14 }, { key: 'out', width: 14 },
      { key: 'wastage', width: 14 }, { key: 'variance', width: 14 }, { key: 'cost', width: 16 },
      { key: 'varValue', width: 18 }, { key: 'status', width: 14 },
    ];
    applyTitleBlock(ws, 'STOCK VARIANCE REPORT', `Branch: ${branch_name}  |  Period: ${start_date} → ${end_date}  |  Generated: ${new Date().toLocaleString()}`, 14);
    applyHeaderRow(ws, ['#', 'Item Name', 'SKU', 'Branch', 'Category', 'Unit', 'System Qty', 'Stock In', 'Stock Out', 'Wastage', 'Variance', 'Cost Price', 'Variance Value', 'Status'], 4);
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4, activeCell: 'A5' }];

    let totalVarValue = 0; let flaggedCount = 0;
    (stock || []).forEach((s: any, i: number) => {
      const item = itemMap[s.item_sku] || {};
      const branchMovs = (movements || []).filter((m: any) => m.item_sku === s.item_sku && m.branch_id === s.branch_id);
      const stockIn = branchMovs.filter((m: any) => ['STOCK_IN', 'RECEIVE', 'TRANSFER_IN'].includes(m.movement_type?.toUpperCase())).reduce((sum: number, m: any) => sum + Number(m.quantity || 0), 0);
      const stockOut = branchMovs.filter((m: any) => ['STOCK_OUT', 'USAGE', 'SALE', 'TRANSFER_OUT'].includes(m.movement_type?.toUpperCase())).reduce((sum: number, m: any) => sum + Number(m.quantity || 0), 0);
      const wastage = branchMovs.filter((m: any) => ['WASTAGE', 'DAMAGE', 'LOSS'].includes(m.movement_type?.toUpperCase())).reduce((sum: number, m: any) => sum + Number(m.quantity || 0), 0);
      const systemQty = Number(s.quantity || 0);
      const variance = wastage;
      const costPrice = Number(item.cost_price || 0);
      const varValue = Math.abs(variance) * costPrice;
      const isFlagged = variance > 0;
      if (isFlagged) { flaggedCount++; totalVarValue += varValue; }

      const row = ws.addRow([
        i + 1, item.item_name || s.item_sku, s.item_sku,
        s.branch?.name || 'N/A', item.category || 'General', item.unit_of_measure || 'Unit',
        systemQty, stockIn, stockOut, wastage, variance, costPrice, varValue,
        isFlagged ? 'Flagged' : 'Balanced',
      ]);
      row.height = 20;
      row.eachCell((cell: any, col: number) => {
        styleDataCell(cell, i % 2 === 0, [7, 8, 9, 10, 11, 12, 13].includes(col) ? 'right' : 'center', undefined, isFlagged);
        if ([7, 8, 9, 10, 11].includes(col)) cell.numFmt = '#,##0.00';
        if ([12, 13].includes(col)) cell.numFmt = '"KES "#,##0.00';
        if (col === 14) {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: isFlagged ? 'FF9B1C1C' : 'FF166534' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isFlagged ? 'FFFEE2E2' : 'FFD1FAE5' } };
          cell.alignment = { horizontal: 'center' };
        }
        if (col === 2) cell.alignment = { horizontal: 'left', wrapText: true };
      });
    });
    addSummaryRow(ws, `Total Items: ${(stock || []).length}  |  Flagged: ${flaggedCount}  |  Balanced: ${(stock || []).length - flaggedCount}`, 14, [{ col: 13, value: totalVarValue, numFmt: '"KES "#,##0.00' }]);
    await sendWorkbook(res, wb, `stock_variance_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (e) { next(e); }
};

// ── 7. Consumption Analytics ──────────────────────────────────────────────────
export const exportConsumptionAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branch_ids, start_date, end_date, branch_name = 'All Branches' } = req.query as any;
    const start = (start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]) + 'T00:00:00';
    const end = (end_date || new Date().toISOString().split('T')[0]) + 'T23:59:59';

    let movQ = supabase.from('branch_stock_movements').select('item_sku, quantity, movement_type, branch_id, created_at, branch:branches(name)').gte('created_at', start).lte('created_at', end);
    movQ = branchFilter(movQ, branch_ids);
    let reqQ = supabase.from('stock_requests').select('id, requesting_branch_id, status, created_at, branch:branches!requesting_branch_id(name)').gte('created_at', start).lte('created_at', end);
    reqQ = branchFilter(reqQ, branch_ids, 'requesting_branch_id');

    const [{ data: movements }, { data: requests }] = await Promise.all([movQ, reqQ]);

    const reqIds = (requests || []).map((r: any) => r.id);
    const { data: reqItems } = reqIds.length ? await supabase.from('stock_request_items').select('request_id, item_sku, approved_quantity, quantity').in('request_id', reqIds) : { data: [] };

    const itemSkus = [...new Set((movements || []).map((m: any) => m.item_sku).filter(Boolean))];
    const { data: items } = itemSkus.length ? await supabase.from('simple_items').select('sku, item_name, unit_of_measure, category').in('sku', itemSkus as string[]) : { data: [] };
    const itemMap: Record<string, any> = Object.fromEntries((items || []).map((i: any) => [i.sku, i]));

    // Aggregate by SKU
    const skuMap: Record<string, { requested: number; used: number; wastage: number; name: string; unit: string; category: string }> = {};
    (movements || []).forEach((m: any) => {
      if (!skuMap[m.item_sku]) skuMap[m.item_sku] = { requested: 0, used: 0, wastage: 0, name: itemMap[m.item_sku]?.item_name || m.item_sku, unit: itemMap[m.item_sku]?.unit_of_measure || 'Unit', category: itemMap[m.item_sku]?.category || 'General' };
      const qty = Number(m.quantity || 0);
      if (['USAGE', 'SALE', 'STOCK_OUT'].includes(m.movement_type?.toUpperCase())) skuMap[m.item_sku].used += qty;
      if (['WASTAGE', 'DAMAGE', 'LOSS'].includes(m.movement_type?.toUpperCase())) skuMap[m.item_sku].wastage += qty;
    });
    (reqItems || []).forEach((ri: any) => {
      if (!skuMap[ri.item_sku]) skuMap[ri.item_sku] = { requested: 0, used: 0, wastage: 0, name: itemMap[ri.item_sku]?.item_name || ri.item_sku, unit: itemMap[ri.item_sku]?.unit_of_measure || 'Unit', category: itemMap[ri.item_sku]?.category || 'General' };
      skuMap[ri.item_sku].requested += Number(ri.approved_quantity || ri.quantity || 0);
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Consumption Analytics', { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 } });
    ws.columns = [
      { key: 'n', width: 8 }, { key: 'name', width: 30 }, { key: 'sku', width: 18 },
      { key: 'category', width: 18 }, { key: 'unit', width: 12 }, { key: 'requested', width: 16 },
      { key: 'used', width: 14 }, { key: 'wastage', width: 14 }, { key: 'efficiency', width: 16 }, { key: 'variance', width: 14 },
    ];
    applyTitleBlock(ws, 'CONSUMPTION ANALYTICS', `Branch: ${branch_name}  |  Period: ${start_date} → ${end_date}  |  Generated: ${new Date().toLocaleString()}`, 10);
    applyHeaderRow(ws, ['#', 'Item Name', 'SKU', 'Category', 'Unit', 'Requested', 'Consumed', 'Wastage', 'Efficiency %', 'Variance'], 4);
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4, activeCell: 'A5' }];

    Object.entries(skuMap).forEach(([sku, data], i) => {
      const efficiency = data.requested > 0 ? ((data.used / data.requested) * 100) : 0;
      const variance = data.requested - data.used - data.wastage;
      const isLow = efficiency < 70;
      const row = ws.addRow([i + 1, data.name, sku, data.category, data.unit, data.requested, data.used, data.wastage, parseFloat(efficiency.toFixed(2)), variance]);
      row.height = 20;
      row.eachCell((cell: any, col: number) => {
        styleDataCell(cell, i % 2 === 0, [6, 7, 8, 9, 10].includes(col) ? 'right' : 'center', undefined, isLow && data.requested > 0);
        if ([6, 7, 8, 10].includes(col)) cell.numFmt = '#,##0.00';
        if (col === 9) { cell.numFmt = '#,##0.00"%"'; cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: efficiency >= 85 ? 'FF166534' : efficiency >= 70 ? 'FF92400E' : 'FF9B1C1C' } }; }
        if (col === 2) cell.alignment = { horizontal: 'left', wrapText: true };
      });
    });
    await sendWorkbook(res, wb, `consumption_analytics_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (e) { next(e); }
};

// ── 8. GRN Audit ──────────────────────────────────────────────────────────────
export const exportGrnAudit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branch_ids, start_date, end_date, branch_name = 'All Branches' } = req.query as any;
    const start = (start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]) + 'T00:00:00';
    const end = (end_date || new Date().toISOString().split('T')[0]) + 'T23:59:59';

    // Fetch stock_requests plain — no FK joins
    let grnQ = supabase.from('stock_requests')
      .select('id, request_number, requesting_branch_id, reviewed_by, requested_by, status, created_at')
      .in('status', ['APPROVED', 'FULFILLED', 'DELIVERED'])
      .gte('created_at', start).lte('created_at', end)
      .order('created_at', { ascending: false });
    grnQ = branchFilter(grnQ, branch_ids, 'requesting_branch_id');
    const { data: requests, error } = await grnQ;
    if (error) throw error;

    const reqIds = (requests || []).map((r: any) => r.id);

    // Fetch items plain — no FK join to simple_items
    const { data: reqItems } = reqIds.length
      ? await supabase.from('stock_request_items')
          .select('request_id, item_sku, quantity, approved_quantity')
          .in('request_id', reqIds)
      : { data: [] };

    // Collect all SKUs and fetch simple_items separately
    const allSkus = [...new Set((reqItems || []).map((i: any) => i.item_sku).filter(Boolean))];
    const { data: simpleItems } = allSkus.length
      ? await supabase.from('simple_items').select('sku, item_name, unit_of_measure, cost_price').in('sku', allSkus)
      : { data: [] };
    const skuMap: Record<string, any> = {};
    (simpleItems || []).forEach((si: any) => { skuMap[si.sku] = si; });

    // Collect branch IDs and user IDs, fetch separately
    const branchIds = [...new Set((requests || []).map((r: any) => r.requesting_branch_id).filter(Boolean))];
    const { data: branches } = branchIds.length
      ? await supabase.from('branches').select('id, name').in('id', branchIds)
      : { data: [] };
    const branchMap: Record<string, string> = {};
    (branches || []).forEach((b: any) => { branchMap[b.id] = b.name; });

    const userIds = [...new Set([
      ...(requests || []).map((r: any) => r.reviewed_by),
      ...(requests || []).map((r: any) => r.requested_by),
    ].filter(Boolean))];
    const { data: users } = userIds.length
      ? await supabase.from('users').select('id, first_name, last_name').in('id', userIds)
      : { data: [] };
    const userMap: Record<string, string> = {};
    (users || []).forEach((u: any) => { userMap[u.id] = `${u.first_name || ''} ${u.last_name || ''}`.trim(); });

    // Stitch items with SKU data
    const stitchedItems = (reqItems || []).map((ri: any) => ({
      ...ri,
      item: skuMap[ri.item_sku] || null,
    }));

    const itemsByReq: Record<string, any[]> = {};
    stitchedItems.forEach((ri: any) => { if (!itemsByReq[ri.request_id]) itemsByReq[ri.request_id] = []; itemsByReq[ri.request_id].push(ri); });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('GRN Audit', { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 } });
    ws.columns = [
      { key: 'n', width: 8 }, { key: 'grn', width: 20 }, { key: 'branch', width: 22 },
      { key: 'item', width: 30 }, { key: 'sku', width: 18 }, { key: 'unit', width: 12 },
      { key: 'requested', width: 14 }, { key: 'approved', width: 14 }, { key: 'cost', width: 16 },
      { key: 'total', width: 18 }, { key: 'approved_by', width: 22 }, { key: 'date', width: 18 }, { key: 'status', width: 14 },
    ];
    applyTitleBlock(ws, 'GRN AUDIT REPORT', `Branch: ${branch_name}  |  Period: ${start_date} → ${end_date}  |  Generated: ${new Date().toLocaleString()}`, 13);
    applyHeaderRow(ws, ['#', 'GRN / Request No.', 'Branch', 'Item Name', 'SKU', 'Unit', 'Requested', 'Approved Qty', 'Unit Cost', 'Line Total', 'Approved By', 'Date', 'Status'], 4);
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4, activeCell: 'A5' }];

    let rowIdx = 0; let grandTotal = 0;
    (requests || []).forEach((req: any) => {
      const items = itemsByReq[req.id] || [];
      if (items.length === 0) {
        const isEven = rowIdx % 2 === 0;
        const row = ws.addRow([++rowIdx, req.request_number || req.id, branchMap[req.requesting_branch_id] || 'N/A', '(no items)', '', '', '', '', '', '', userMap[req.reviewed_by] || 'N/A', req.created_at ? new Date(req.created_at).toLocaleDateString() : 'N/A', req.status]);
        row.height = 20;
        row.eachCell((cell: any) => styleDataCell(cell, isEven, 'center'));
      } else {
        items.forEach((item: any) => {
          const isEven = rowIdx % 2 === 0;
          const cost = Number(item.item?.cost_price || 0);
          const approvedQty = Number(item.approved_quantity || item.quantity || 0);
          const lineTotal = cost * approvedQty;
          grandTotal += lineTotal;
          const row = ws.addRow([
            ++rowIdx, req.request_number || req.id, branchMap[req.requesting_branch_id] || 'N/A',
            item.item?.item_name || item.item_sku, item.item_sku, item.item?.unit_of_measure || 'Unit',
            Number(item.quantity || 0), approvedQty, cost, lineTotal,
            userMap[req.reviewed_by] || 'N/A',
            req.created_at ? new Date(req.created_at).toLocaleDateString() : 'N/A', req.status,
          ]);
          row.height = 20;
          row.eachCell((cell: any, col: number) => {
            styleDataCell(cell, isEven, [7, 8, 9, 10].includes(col) ? 'right' : 'center');
            if ([7, 8].includes(col)) cell.numFmt = '#,##0.00';
            if ([9, 10].includes(col)) cell.numFmt = '"KES "#,##0.00';
            if (col === 4) cell.alignment = { horizontal: 'left', wrapText: true };
          });
        });
      }
    });
    addSummaryRow(ws, `Total GRNs: ${(requests || []).length}  |  Total Line Items: ${rowIdx}`, 13, [{ col: 10, value: grandTotal, numFmt: '"KES "#,##0.00' }]);
    await sendWorkbook(res, wb, `grn_audit_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (e) { next(e); }
};

// ── 9. SOP Compliance Audit ───────────────────────────────────────────────────
export const exportComplianceAudit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branch_ids, start_date, end_date, branch_name = 'All Branches' } = req.query as any;
    const start = (start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]) + 'T00:00:00';
    const end = (end_date || new Date().toISOString().split('T')[0]) + 'T23:59:59';

    // Gather compliance signals from multiple tables
    let excQ = supabase.from('audit_exceptions').select('exception_type, severity, status, branch_id, created_at, branch:branches(name)').gte('created_at', start).lte('created_at', end);
    excQ = branchFilter(excQ, branch_ids);
    let voidRQ = supabase.from('restaurant_orders').select('id, branch_id, branch:branches(name)').eq('status', 'cancelled').gte('created_at', start).lte('created_at', end);
    voidRQ = branchFilter(voidRQ, branch_ids);
    let voidBQ = supabase.from('bar_orders').select('id, branch_id, branch:branches(name)').eq('status', 'cancelled').gte('created_at', start).lte('created_at', end);
    voidBQ = branchFilter(voidBQ, branch_ids);
    let expQ = supabase.from('expenses').select('id, status, branch_id, branch:branches(name)').gte('expense_date', start_date || '2000-01-01').lte('expense_date', end_date || new Date().toISOString().split('T')[0]);
    expQ = branchFilter(expQ, branch_ids);

    const [{ data: exceptions }, { data: restVoids }, { data: barVoids }, { data: expenses }] = await Promise.all([excQ, voidRQ, voidBQ, expQ]);

    // Score by branch
    const branchScores: Record<string, { name: string; exceptions: number; criticalExceptions: number; voids: number; unapprovedExpenses: number; score: number }> = {};
    const ensureBranch = (id: string, name: string) => { if (!branchScores[id]) branchScores[id] = { name, exceptions: 0, criticalExceptions: 0, voids: 0, unapprovedExpenses: 0, score: 100 }; };

    (exceptions || []).forEach((ex: any) => { ensureBranch(ex.branch_id, ex.branch?.name || 'N/A'); branchScores[ex.branch_id].exceptions++; if (['critical', 'high'].includes(ex.severity)) branchScores[ex.branch_id].criticalExceptions++; });
    (restVoids || []).forEach((v: any) => { ensureBranch(v.branch_id, v.branch?.name || 'N/A'); branchScores[v.branch_id].voids++; });
    (barVoids || []).forEach((v: any) => { ensureBranch(v.branch_id, v.branch?.name || 'N/A'); branchScores[v.branch_id].voids++; });
    (expenses || []).forEach((ex: any) => { if (ex.status === 'pending') { ensureBranch(ex.branch_id, ex.branch?.name || 'N/A'); branchScores[ex.branch_id].unapprovedExpenses++; } });

    // Calculate score: start at 100, deduct per issue
    Object.values(branchScores).forEach(b => { b.score = Math.max(0, 100 - (b.criticalExceptions * 10) - (b.exceptions * 3) - (b.voids * 1) - (b.unapprovedExpenses * 2)); });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Compliance Audit', { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 } });
    ws.columns = [
      { key: 'n', width: 8 }, { key: 'branch', width: 26 }, { key: 'exceptions', width: 16 },
      { key: 'critical', width: 18 }, { key: 'voids', width: 14 }, { key: 'unapproved', width: 22 },
      { key: 'score', width: 16 }, { key: 'rating', width: 16 },
    ];
    applyTitleBlock(ws, 'SOP COMPLIANCE AUDIT', `Branch: ${branch_name}  |  Period: ${start_date} → ${end_date}  |  Generated: ${new Date().toLocaleString()}`, 8);
    applyHeaderRow(ws, ['#', 'Branch', 'Total Exceptions', 'Critical Exceptions', 'Voided Orders', 'Unapproved Expenses', 'Compliance Score', 'Rating'], 4);
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4, activeCell: 'A5' }];

    const sorted = Object.entries(branchScores).sort(([, a], [, b]) => b.score - a.score);
    sorted.forEach(([, data], i) => {
      const rating = data.score >= 90 ? 'Excellent' : data.score >= 75 ? 'Good' : data.score >= 60 ? 'Fair' : 'Poor';
      const ratingColor = data.score >= 90 ? ['FF166534', 'FFD1FAE5'] : data.score >= 75 ? ['FF1E40AF', 'FFDBEAFE'] : data.score >= 60 ? ['FF92400E', 'FFFEF3C7'] : ['FF9B1C1C', 'FFFEE2E2'];
      const row = ws.addRow([i + 1, data.name, data.exceptions, data.criticalExceptions, data.voids, data.unapprovedExpenses, data.score, rating]);
      row.height = 22;
      row.eachCell((cell: any, col: number) => {
        styleDataCell(cell, i % 2 === 0, col === 2 ? 'left' : 'center');
        if (col === 7) { cell.numFmt = '#,##0.00"%"'; cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: ratingColor[0] } }; }
        if (col === 8) { cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: ratingColor[0] } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ratingColor[1] } }; }
      });
    });

    if (sorted.length === 0) {
      const row = ws.addRow(['', 'No branch data found for the selected period', '', '', '', '', '', '']);
      row.height = 22;
      ws.mergeCells(`B${row.number}:H${row.number}`);
      row.getCell(2).alignment = { horizontal: 'center' };
    }

    await sendWorkbook(res, wb, `compliance_audit_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (e) { next(e); }
};

// ── 10. Unified Stock Movement Report ─────────────────────────────────────────
export const exportStockMovement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branch_ids, start_date, end_date, branch_name = 'All Branches' } = req.query as any;
    const start = (start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]) + 'T00:00:00';
    const end = (end_date || new Date().toISOString().split('T')[0]) + 'T23:59:59';

    // 1. Central Store Movements (GRNs, Adjustments)
    let csmQ = supabase.from('stock_movements').select('created_at, item_sku, movement_type, quantity, reference_number, notes, created_by, branch_id').gte('created_at', start).lte('created_at', end);
    if (branch_ids && branch_ids !== 'all') {
         csmQ = branchFilter(csmQ, branch_ids);
    }

    // 2. Inter-Branch Transfers (Dispatch, Receiving)
    let trnQ = supabase.from('inventory_transfers').select('id, transfer_number, from_branch_id, to_branch_id, status, created_at, created_by, from_branch:branches!from_branch_id(name), to_branch:branches!to_branch_id(name)').in('status', ['COMPLETED', 'SHIPPED', 'DELIVERED']).gte('created_at', start).lte('created_at', end);
    if (branch_ids && branch_ids !== 'all') {
        const ids = branch_ids.split(',').map(Number).filter(Boolean);
        trnQ = trnQ.or(`from_branch_id.in.(${ids.join(',')}),to_branch_id.in.(${ids.join(',')})`);
    }

    // 3. Branch Stock Movements (Consumption, Wastage)
    let bsmQ = supabase.from('branch_stock_movements').select('created_at, item_sku, movement_type, quantity, reference_id, notes, created_by, branch_id, branch:branches(name)').gte('created_at', start).lte('created_at', end);
    if (branch_ids && branch_ids !== 'all') {
         bsmQ = branchFilter(bsmQ, branch_ids);
    }

    const [{ data: centralMovs }, { data: transfers }, { data: branchMovs }] = await Promise.all([csmQ, trnQ, bsmQ]);

    // Fetch transfer items
    const transferIds = (transfers || []).map((t: any) => t.id);
    const { data: transferItems } = transferIds.length ? await supabase.from('inventory_transfer_items').select('transfer_id, item_sku, transferred_quantity').in('transfer_id', transferIds) : { data: [] };
    const itemsByTransfer: Record<string, any[]> = {};
    (transferItems || []).forEach((ti: any) => { if (!itemsByTransfer[ti.transfer_id]) itemsByTransfer[ti.transfer_id] = []; itemsByTransfer[ti.transfer_id].push(ti); });

    // Collect SKUs & Users
    const allSkus = [...new Set([
        ...(centralMovs || []).map((m: any) => m.item_sku),
        ...(branchMovs || []).map((m: any) => m.item_sku),
        ...(transferItems || []).map((ti: any) => ti.item_sku)
    ].filter(Boolean))];

    const allUsers = [...new Set([
        ...(centralMovs || []).map((m: any) => m.created_by),
        ...(branchMovs || []).map((m: any) => m.created_by),
        ...(transfers || []).map((m: any) => m.created_by)
    ].filter(Boolean))];

    const { data: items } = allSkus.length ? await supabase.from('simple_items').select('sku, item_name, unit_of_measure, category').in('sku', allSkus as string[]) : { data: [] };
    const itemMap: Record<string, any> = Object.fromEntries((items || []).map((i: any) => [i.sku, i]));

    const { data: users } = allUsers.length ? await supabase.from('users').select('id, first_name, last_name').in('id', allUsers as string[]) : { data: [] };
    const userMap: Record<string, string> = Object.fromEntries((users || []).map((u: any) => [u.id, `${u.first_name} ${u.last_name}`]));

    // Build unified timeline
    type TimelineEvent = { date: Date; type: string; item: any; qty: number; from: string; to: string; ref: string; user: string; notes: string };
    const timeline: TimelineEvent[] = [];

    (centralMovs || []).forEach((m: any) => {
        timeline.push({
            date: new Date(m.created_at),
            type: m.movement_type === 'RECEIVE' ? 'GRN (Stock In)' : m.movement_type === 'DISPATCH' ? 'Central Dispatch' : m.movement_type,
            item: itemMap[m.item_sku] || { item_name: m.item_sku },
            qty: Number(m.quantity),
            from: ['RECEIVE', 'ADJUST_UP'].includes(m.movement_type) ? 'Supplier' : 'Central Store',
            to: ['DISPATCH'].includes(m.movement_type) ? (m.branch_id ? `Branch ${m.branch_id}` : 'External') : 'Central Store',
            ref: m.reference_number || 'N/A',
            user: userMap[m.created_by] || 'System',
            notes: m.notes || ''
        });
    });

    (branchMovs || []).forEach((m: any) => {
        timeline.push({
            date: new Date(m.created_at),
            type: m.movement_type === 'RECEIVE' ? 'Branch Receive' : m.movement_type === 'WAITRER_ISSUE' || m.movement_type === 'USAGE' ? 'Consumption' : m.movement_type,
            item: itemMap[m.item_sku] || { item_name: m.item_sku },
            qty: Number(m.quantity),
            from: m.branch?.name || `Branch ${m.branch_id}`,
            to: ['RECEIVE'].includes(m.movement_type) ? (m.branch?.name || `Branch ${m.branch_id}`) : 'Consumed/Lost',
            ref: m.reference_id || 'N/A',
            user: userMap[m.created_by] || 'System',
            notes: m.notes || ''
        });
    });

    (transfers || []).forEach((t: any) => {
        const tItems = itemsByTransfer[t.id] || [];
        tItems.forEach((ti: any) => {
            timeline.push({
                date: new Date(t.created_at),
                type: 'Inter-Branch Transfer',
                item: itemMap[ti.item_sku] || { item_name: ti.item_sku },
                qty: Number(ti.transferred_quantity),
                from: t.from_branch?.name || 'Central Store',
                to: t.to_branch?.name || 'Unknown',
                ref: t.transfer_number || 'N/A',
                user: userMap[t.created_by] || 'System',
                notes: `Status: ${t.status}`
            });
        });
    });

    // Sort descending by date
    timeline.sort((a, b) => b.date.getTime() - a.date.getTime());

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Stock Movement', { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 } });
    ws.columns = [
      { key: 'n', width: 6 }, { key: 'date', width: 18 }, { key: 'type', width: 22 },
      { key: 'item', width: 30 }, { key: 'qty', width: 12 }, { key: 'from', width: 20 },
      { key: 'to', width: 20 }, { key: 'ref', width: 20 }, { key: 'user', width: 20 }, { key: 'notes', width: 30 }
    ];
    applyTitleBlock(ws, 'UNIFIED STOCK MOVEMENT REPORT', `Branch: ${branch_name}  |  Period: ${start_date} → ${end_date}  |  Generated: ${new Date().toLocaleString()}`, 10);
    applyHeaderRow(ws, ['#', 'Date & Time', 'Movement Type', 'Item Details', 'Quantity', 'Source (From)', 'Destination (To)', 'Reference', 'Performed By', 'Notes'], 4);
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4, activeCell: 'A5' }];

    timeline.forEach((ev: TimelineEvent, i: number) => {
      const row = ws.addRow([
        i + 1, ev.date.toLocaleString(), ev.type,
        `${ev.item.item_name} ${ev.item.unit_of_measure ? '('+ev.item.unit_of_measure+')' : ''}`,
        ev.qty, ev.from, ev.to, ev.ref, ev.user, ev.notes
      ]);
      row.height = 20;
      row.eachCell((cell: any, col: number) => {
        styleDataCell(cell, i % 2 === 0, col === 5 ? 'right' : 'center');
        if (col === 5) cell.numFmt = '#,##0.00';
        if (col === 4 || col === 10) cell.alignment = { horizontal: 'left', wrapText: true };
      });
    });

    if (timeline.length === 0) {
      const row = ws.addRow(['', 'No movements recorded in the selected period', '', '', '', '', '', '', '', '']);
      row.height = 22;
      ws.mergeCells(`B${row.number}:J${row.number}`);
      row.getCell(2).alignment = { horizontal: 'center' };
    }

    await sendWorkbook(res, wb, `stock_movement_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (e) { next(e); }
};

// ── Legacy exports kept for backward compat ───────────────────────────────────
export const getBranchPerformanceReport = exportRevenueReconciliation;
export const getStockUsageReport = exportStockVarianceReport;
export const getEmployeeCreditReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: bills, error } = await supabase.from('staff_credit_bills').select('*, employee:staff_profiles(id, first_name, last_name, id_number), branch:branches(name)').eq('status', 'pending').order('bill_date', { ascending: false });
    if (error) throw error;
    res.status(200).json({ success: true, data: bills });
  } catch (e) { next(e); }
};
