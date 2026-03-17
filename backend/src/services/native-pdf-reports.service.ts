import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { supabase } from '../config/database';
import { Response } from 'express';
import { detailedDocs, DetailedModuleDoc } from './documentation-data';
import { logger } from '../utils/logger';

// ── Brand constants (matches pdfGenerator.ts style) ──────────────────────────
const PRIMARY    = '#1a1a1a';
const SECONDARY  = '#555555';
const ACCENT     = '#0066cc';
const BORDER     = '#e0e0e0';
const ROW_BG     = '#f9f9f9';
const HEADER_BG  = '#333333';
const GOLD       = '#c8a84b';

const COMPANY_NAME    = 'FamousGateHotels';
const COMPANY_ADDRESS = 'Bomet, Kenya';
const COMPANY_EMAIL   = 'famousgateshotelsbmt@gmail.com';
const COMPANY_PHONE   = '0706 782 828';

function getLogoPath() {
  return path.join(process.cwd(), '../frontend/public/fglogo.png');
}

function fmt(n: number | null | undefined): string {
  return `KES ${(n ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Shared header (logo + company info + divider) ─────────────────────────────
function drawBrandedHeader(doc: PDFKit.PDFDocument, title: string, subtitle?: string) {
  const logoPath = getLogoPath();
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 40, 30, { width: 55 });
  } else {
    doc.circle(67, 57, 27).fill(PRIMARY);
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold').text('FG', 53, 47);
  }

  // Company info top-right
  doc.fillColor(PRIMARY).fontSize(15).font('Helvetica-Bold').text(COMPANY_NAME, 110, 30, { align: 'right' });
  doc.fontSize(9).font('Helvetica').fillColor(SECONDARY)
    .text(COMPANY_ADDRESS, 110, 50, { align: 'right' })
    .text(`Email: ${COMPANY_EMAIL}`, { align: 'right' })
    .text(`Tel: ${COMPANY_PHONE}`, { align: 'right' });

  // Divider
  doc.strokeColor(BORDER).lineWidth(1).moveTo(40, 100).lineTo(doc.page.width - 40, 100).stroke();

  // Gold accent
  doc.rect(40, 101, doc.page.width - 80, 3).fill(GOLD);

  // Report title block
  doc.fillColor(PRIMARY).fontSize(14).font('Helvetica-Bold').text(title, 40, 114, { align: 'center' });
  if (subtitle) {
    doc.fontSize(9).font('Helvetica').fillColor(SECONDARY).text(subtitle, 40, 132, { align: 'center' });
  }

  // Second divider
  const divY = subtitle ? 146 : 132;
  doc.strokeColor(BORDER).lineWidth(0.5).moveTo(40, divY).lineTo(doc.page.width - 40, divY).stroke();

  doc.fillColor(PRIMARY);
  return divY + 10; // return starting Y for content
}

function drawTableHeader(doc: PDFKit.PDFDocument, y: number, cols: { label: string; x: number; width: number; align?: string }[]) {
  doc.rect(40, y, doc.page.width - 80, 18).fill(HEADER_BG);
  doc.fillColor('white').fontSize(8).font('Helvetica-Bold');
  cols.forEach(col => {
    doc.text(col.label, col.x, y + 5, { width: col.width, align: (col.align as any) ?? 'left', ellipsis: true });
  });
  doc.fillColor(PRIMARY).font('Helvetica');
  return y + 18;
}

function drawRow(
  doc: PDFKit.PDFDocument,
  y: number,
  cols: { value: string; x: number; width: number; align?: string }[],
  shade: boolean
) {
  if (shade) doc.rect(40, y, doc.page.width - 80, 16).fill(ROW_BG);
  doc.fillColor(PRIMARY).fontSize(8).font('Helvetica');
  cols.forEach(col => {
    doc.text(col.value, col.x, y + 4, { width: col.width, align: (col.align as any) ?? 'left', ellipsis: true });
  });
  doc.strokeColor(BORDER).lineWidth(0.3).moveTo(40, y + 16).lineTo(doc.page.width - 40, y + 16).stroke();
  doc.fillColor(PRIMARY);
  return y + 16;
}

function drawSummaryBox(doc: PDFKit.PDFDocument, y: number, items: { label: string; value: string }[]) {
  const bw = 230;
  const bx = doc.page.width - 40 - bw;
  const rh = 20;
  const bh = items.length * rh + 6;
  doc.rect(bx, y, bw, bh).stroke(BORDER);
  items.forEach((item, i) => {
    const ry = y + 3 + i * rh;
    if (i === items.length - 1) doc.rect(bx, ry, bw, rh).fill('#eef2f7');
    doc.fillColor(ACCENT).fontSize(8.5).font('Helvetica-Bold').text(item.label, bx + 8, ry + 5, { width: 120 });
    doc.fillColor(PRIMARY).font('Helvetica').text(item.value, bx + 130, ry + 5, { width: bw - 138, align: 'right' });
  });
  doc.fillColor(PRIMARY);
  return y + bh + 12;
}

function drawFooter(doc: PDFKit.PDFDocument) {
  const y = doc.page.height - 40;
  doc.strokeColor(BORDER).lineWidth(0.5).moveTo(40, y).lineTo(doc.page.width - 40, y).stroke();
  doc.fillColor(SECONDARY).fontSize(7.5).font('Helvetica')
    .text(`Generated: ${new Date().toLocaleString('en-KE')} | ${COMPANY_NAME} — Confidential`, 40, y + 6, { align: 'center' });
}

// ── SUPPLIER STATEMENT ────────────────────────────────────────────────────────
export async function generateSupplierStatementPDF(
  res: Response,
  filters: { supplier_id: string; start_date?: string; from_date?: string; end_date?: string; to_date?: string }
) {
  const supplierId = filters.supplier_id;
  const fromDate = filters.from_date ?? filters.start_date;
  const toDate   = filters.to_date   ?? filters.end_date;

  const { data: supplier, error: supErr } = await supabase
    .from('store_suppliers')
    .select('id, name, supplier_code, tax_id, vat_number, phone, email, address_line1')
    .eq('id', supplierId)
    .single();

  if (supErr || !supplier) {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=FG_Supplier_Statement_${supplierId}.pdf`);
    doc.pipe(res);
    drawBrandedHeader(doc, 'Supplier Statement', 'Error');
    doc.fontSize(11).fillColor('red').text(`Supplier not found (ID: ${supplierId})`, 40, 180);
    drawFooter(doc);
    doc.end();
    return;
  }

  let ledgerQ = supabase
    .from('store_supplier_ledger')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('transaction_date', { ascending: true });
  if (fromDate) ledgerQ = ledgerQ.gte('transaction_date', fromDate);
  if (toDate)   ledgerQ = ledgerQ.lte('transaction_date', toDate);
  const { data: ledger } = await ledgerQ;

  const { data: balance } = await supabase
    .from('store_supplier_balances')
    .select('current_balance, total_invoices, total_payments')
    .eq('supplier_id', supplierId)
    .maybeSingle();

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition',
    `attachment; filename=FG_Supplier_Statement_${supplier.supplier_code ?? supplierId}_${new Date().toISOString().split('T')[0]}.pdf`);
  doc.pipe(res);

  const periodLabel = fromDate && toDate
    ? `Period: ${fmtDate(fromDate)} – ${fmtDate(toDate)}`
    : 'All Transactions';

  let y = drawBrandedHeader(doc, 'SUPPLIER STATEMENT', periodLabel);

  // Supplier info
  doc.fontSize(9).font('Helvetica-Bold').fillColor(ACCENT).text('Supplier Details', 40, y);
  y += 14;
  doc.fontSize(8.5).font('Helvetica').fillColor(PRIMARY);
  doc.text(`Name:`, 40, y, { continued: true }).font('Helvetica-Bold').text(` ${supplier.name}`, { continued: false });
  doc.font('Helvetica').text(`Code: ${supplier.supplier_code ?? '—'}`, 300, y);
  y += 13;
  doc.text(`PIN: ${supplier.tax_id || '—'}`, 40, y);
  doc.text(`VAT Reg: ${supplier.vat_number || '—'}`, 300, y);
  y += 13;
  doc.text(`Phone: ${supplier.phone || '—'}`, 40, y);
  doc.text(`Email: ${supplier.email || '—'}`, 300, y);
  y += 18;

  doc.strokeColor(BORDER).lineWidth(0.5).moveTo(40, y).lineTo(doc.page.width - 40, y).stroke();
  y += 8;

  const cols = [
    { label: 'Date',        x: 42,  width: 62 },
    { label: 'Reference',   x: 108, width: 90 },
    { label: 'Description', x: 202, width: 145 },
    { label: 'Debit',       x: 351, width: 65, align: 'right' },
    { label: 'Credit',      x: 420, width: 65, align: 'right' },
    { label: 'Balance',     x: 489, width: 66, align: 'right' },
  ];

  y = drawTableHeader(doc, y, cols);

  (ledger ?? []).forEach((entry: any, i: number) => {
    if (y > doc.page.height - 70) {
      drawFooter(doc);
      doc.addPage();
      y = drawBrandedHeader(doc, 'SUPPLIER STATEMENT (cont.)', periodLabel);
      y = drawTableHeader(doc, y, cols);
    }
    y = drawRow(doc, y, [
      { value: fmtDate(entry.transaction_date),                                    x: 42,  width: 62 },
      { value: entry.reference_number ?? '—',                                      x: 108, width: 90 },
      { value: entry.description ?? entry.transaction_type ?? '—',                 x: 202, width: 145 },
      { value: entry.debit_amount  ? fmt(entry.debit_amount)  : '—',               x: 351, width: 65, align: 'right' },
      { value: entry.credit_amount ? fmt(entry.credit_amount) : '—',               x: 420, width: 65, align: 'right' },
      { value: fmt(entry.running_balance ?? entry.balance ?? 0),                   x: 489, width: 66, align: 'right' },
    ], i % 2 === 0);
  });

  if (!ledger?.length) {
    doc.fontSize(9).fillColor(SECONDARY).text('No transactions found for this period.', 40, y + 10);
    y += 30;
  }

  y += 14;
  drawSummaryBox(doc, y, [
    { label: 'Total Invoiced',  value: fmt(balance?.total_invoices) },
    { label: 'Total Payments',  value: fmt(balance?.total_payments) },
    { label: 'Closing Balance', value: fmt(balance?.current_balance) },
  ]);

  drawFooter(doc);
  doc.end();
}

// ── VAT REPORT ────────────────────────────────────────────────────────────────
export async function generateVATReportPDF(
  res: Response,
  filters: { from_date: string; to_date: string }
) {
  const { from_date, to_date } = filters;

  const { data: invoices, error } = await supabase
    .from('store_supplier_invoices')
    .select(`
      invoice_number, invoice_date,
      supplier:store_suppliers(name, tax_id, vat_number),
      subtotal, vat_amount, withholding_vat_amount, total_amount, status
    `)
    .eq('status', 'approved')
    .gte('invoice_date', from_date)
    .lte('invoice_date', to_date)
    .order('invoice_date', { ascending: true });

  if (error) throw error;

  const totals = (invoices ?? []).reduce(
    (acc: any, inv: any) => ({
      subtotal:     acc.subtotal     + Number(inv.subtotal ?? 0),
      vat_amount:   acc.vat_amount   + Number(inv.vat_amount ?? 0),
      withholding:  acc.withholding  + Number(inv.withholding_vat_amount ?? 0),
      total_amount: acc.total_amount + Number(inv.total_amount ?? 0),
    }),
    { subtotal: 0, vat_amount: 0, withholding: 0, total_amount: 0 }
  );

  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=FG_VAT_Report_${from_date}_${to_date}.pdf`);
  doc.pipe(res);

  const periodLabel = `Period: ${fmtDate(from_date)} – ${fmtDate(to_date)}`;
  let y = drawBrandedHeader(doc, 'INPUT VAT REPORT', periodLabel);

  const cols = [
    { label: 'Invoice #',  x: 42,  width: 85 },
    { label: 'Date',       x: 131, width: 65 },
    { label: 'Supplier',   x: 200, width: 145 },
    { label: 'PIN',        x: 349, width: 85 },
    { label: 'VAT Reg #',  x: 438, width: 95 },
    { label: 'Subtotal',   x: 537, width: 75, align: 'right' },
    { label: 'VAT',        x: 616, width: 65, align: 'right' },
    { label: 'WHT',        x: 685, width: 65, align: 'right' },
    { label: 'Total',      x: 754, width: 75, align: 'right' },
  ];

  y = drawTableHeader(doc, y, cols);

  (invoices ?? []).forEach((inv: any, i: number) => {
    if (y > doc.page.height - 70) {
      drawFooter(doc);
      doc.addPage();
      y = drawBrandedHeader(doc, 'INPUT VAT REPORT (cont.)', periodLabel);
      y = drawTableHeader(doc, y, cols);
    }
    const sup = inv.supplier ?? {};
    y = drawRow(doc, y, [
      { value: inv.invoice_number ?? '—',          x: 42,  width: 85 },
      { value: fmtDate(inv.invoice_date),           x: 131, width: 65 },
      { value: sup.name ?? '—',                     x: 200, width: 145 },
      { value: sup.tax_id || '—',                   x: 349, width: 85 },
      { value: sup.vat_number || '—',               x: 438, width: 95 },
      { value: fmt(inv.subtotal),                   x: 537, width: 75, align: 'right' },
      { value: fmt(inv.vat_amount),                 x: 616, width: 65, align: 'right' },
      { value: fmt(inv.withholding_vat_amount),     x: 685, width: 65, align: 'right' },
      { value: fmt(inv.total_amount),               x: 754, width: 75, align: 'right' },
    ], i % 2 === 0);
  });

  if (!invoices?.length) {
    doc.fontSize(9).fillColor(SECONDARY).text('No approved invoices found for this period.', 40, y + 10);
    y += 30;
  }

  y += 14;
  drawSummaryBox(doc, y, [
    { label: 'Total Subtotal',    value: fmt(totals.subtotal) },
    { label: 'Total VAT (Input)', value: fmt(totals.vat_amount) },
    { label: 'Total WHT',         value: fmt(totals.withholding) },
    { label: 'Total Amount',      value: fmt(totals.total_amount) },
  ]);

  drawFooter(doc);
  doc.end();
}

// ── PROCUREMENT INTELLIGENCE ──────────────────────────────────────────────────
export async function generateProcurementIntelligencePDF(
  res: Response,
  filters: { from_date: string; to_date: string }
) {
  const { from_date, to_date } = filters;

  const { data: invoices } = await supabase
    .from('store_supplier_invoices')
    .select(`supplier_id, supplier:store_suppliers(name, supplier_code), total_amount, invoice_date`)
    .in('status', ['approved', 'paid'])
    .gte('invoice_date', from_date)
    .lte('invoice_date', to_date);

  const { data: grns } = await supabase
    .from('store_grn')
    .select('id, grn_number, grn_date, total_value, supplier:store_suppliers(name)')
    .gte('grn_date', from_date)
    .lte('grn_date', to_date)
    .order('grn_date', { ascending: false });

  // Aggregate by supplier
  const supplierMap: Record<string, { name: string; code: string; total: number; count: number }> = {};
  (invoices ?? []).forEach((inv: any) => {
    const id = inv.supplier_id;
    if (!supplierMap[id]) {
      supplierMap[id] = { name: inv.supplier?.name ?? '—', code: inv.supplier?.supplier_code ?? '—', total: 0, count: 0 };
    }
    supplierMap[id].total += Number(inv.total_amount ?? 0);
    supplierMap[id].count += 1;
  });
  const topSuppliers = Object.values(supplierMap).sort((a, b) => b.total - a.total).slice(0, 20);
  const grandTotal = topSuppliers.reduce((s, r) => s + r.total, 0);

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition',
    `attachment; filename=FG_Procurement_Intelligence_${from_date}_${to_date}.pdf`);
  doc.pipe(res);

  const periodLabel = `Period: ${fmtDate(from_date)} – ${fmtDate(to_date)}`;
  let y = drawBrandedHeader(doc, 'PROCUREMENT INTELLIGENCE REPORT', periodLabel);

  // Summary strip
  doc.rect(40, y, doc.page.width - 80, 28).fill('#eef2f7');
  doc.fillColor(PRIMARY).fontSize(9).font('Helvetica-Bold');
  doc.text(`Total Invoices: ${invoices?.length ?? 0}`, 55, y + 9);
  doc.text(`Total GRNs: ${grns?.length ?? 0}`, 200, y + 9);
  doc.text(`Total Spend: ${fmt(grandTotal)}`, 340, y + 9);
  doc.text(`Report Date: ${fmtDate(new Date().toISOString())}`, 460, y + 9);
  y += 38;

  // Top suppliers
  doc.fontSize(10).font('Helvetica-Bold').fillColor(ACCENT).text('Top Suppliers by Spend', 40, y);
  y += 12;

  const supCols = [
    { label: 'Supplier',    x: 42,  width: 210 },
    { label: 'Code',        x: 256, width: 80 },
    { label: 'Invoices',    x: 340, width: 60, align: 'right' },
    { label: 'Total Spend', x: 404, width: 100, align: 'right' },
    { label: '% of Total',  x: 508, width: 60, align: 'right' },
  ];
  y = drawTableHeader(doc, y, supCols);

  topSuppliers.forEach((sup, i) => {
    if (y > doc.page.height - 70) {
      drawFooter(doc);
      doc.addPage();
      y = drawBrandedHeader(doc, 'PROCUREMENT INTELLIGENCE (cont.)', periodLabel);
      y = drawTableHeader(doc, y, supCols);
    }
    const pct = grandTotal > 0 ? ((sup.total / grandTotal) * 100).toFixed(1) + '%' : '0%';
    y = drawRow(doc, y, [
      { value: sup.name,          x: 42,  width: 210 },
      { value: sup.code,          x: 256, width: 80 },
      { value: String(sup.count), x: 340, width: 60, align: 'right' },
      { value: fmt(sup.total),    x: 404, width: 100, align: 'right' },
      { value: pct,               x: 508, width: 60, align: 'right' },
    ], i % 2 === 0);
  });

  if (!topSuppliers.length) {
    doc.fontSize(9).fillColor(SECONDARY).text('No procurement data found for this period.', 40, y + 10);
    y += 30;
  }

  // Recent GRNs
  y += 18;
  if (y > doc.page.height - 120) {
    drawFooter(doc);
    doc.addPage();
    y = drawBrandedHeader(doc, 'PROCUREMENT INTELLIGENCE (cont.)', periodLabel);
  }

  doc.fontSize(10).font('Helvetica-Bold').fillColor(ACCENT).text('Recent Goods Received Notes', 40, y);
  y += 12;

  const grnCols = [
    { label: 'GRN #',    x: 42,  width: 100 },
    { label: 'Date',     x: 146, width: 70 },
    { label: 'Supplier', x: 220, width: 230 },
    { label: 'Value',    x: 454, width: 100, align: 'right' },
  ];
  y = drawTableHeader(doc, y, grnCols);

  (grns ?? []).slice(0, 30).forEach((grn: any, i: number) => {
    if (y > doc.page.height - 60) {
      drawFooter(doc);
      doc.addPage();
      y = drawBrandedHeader(doc, 'PROCUREMENT INTELLIGENCE (cont.)', periodLabel);
      y = drawTableHeader(doc, y, grnCols);
    }
    y = drawRow(doc, y, [
      { value: grn.grn_number ?? '—',      x: 42,  width: 100 },
      { value: fmtDate(grn.grn_date),       x: 146, width: 70 },
      { value: grn.supplier?.name ?? '—',   x: 220, width: 230 },
      { value: fmt(grn.total_value),         x: 454, width: 100, align: 'right' },
    ], i % 2 === 0);
  });

  drawFooter(doc);
  doc.end();
}

// ── HR PERFORMANCE REPORT ─────────────────────────────────────────────────────
export async function generateHRPerformancePDF(
  res: Response,
  filters: { month: number; year: number; branch_id?: number }
) {
  const { month, year, branch_id } = filters;
  const monthName = new Date(year, month - 1).toLocaleString('en-KE', { month: 'long' });
  const periodLabel = `Period: ${monthName} ${year}`;

  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate   = new Date(year, month, 0, 23, 59, 59).toISOString();
  const startDay  = startDate.split('T')[0];
  const endDay    = endDate.split('T')[0];

  // 1. Fetch staff_profiles (same as performance controller)
  let staffQuery = supabase
    .from('staff_profiles')
    .select('id, role, department, branch_id, first_name, last_name, user_id');
  if (branch_id) staffQuery = staffQuery.eq('branch_id', branch_id);
  const { data: staffList } = await staffQuery;

  const staffIds  = (staffList || []).map((s: any) => s.id);
  const userIds   = (staffList || []).map((s: any) => s.user_id).filter(Boolean);

  // 2. Fetch user names for staff whose name comes from users table
  let userMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .in('id', userIds);
    (users || []).forEach((u: any) => {
      userMap[u.id] = `${u.first_name || ''} ${u.last_name || ''}`.trim();
    });
  }

  // 3. Fetch attendance — column is attendance_date
  let attendance: any[] = [];
  if (staffIds.length > 0) {
    const { data: att } = await supabase
      .from('staff_attendance')
      .select('staff_id, status')
      .in('staff_id', staffIds)
      .gte('attendance_date', startDay)
      .lte('attendance_date', endDay);
    attendance = att || [];
  }

  const attMap: Record<string, number> = {};
  attendance.forEach((a: any) => {
    if (['present', 'active', 'late', 'half_day'].includes((a.status || '').toLowerCase())) {
      attMap[a.staff_id] = (attMap[a.staff_id] || 0) + 1;
    }
  });

  // 4. Fetch restaurant orders — keyed by created_by (user_id), uses grand_total
  let ordersQuery = supabase
    .from('restaurant_orders')
    .select('created_by, grand_total, tip_amount')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .eq('status', 'completed');
  if (branch_id) ordersQuery = ordersQuery.eq('branch_id', branch_id);
  const { data: orders } = await ordersQuery;

  // Map user_id → sales total
  const salesByUser: Record<string, number> = {};
  const tipsByUser:  Record<string, number> = {};
  (orders || []).forEach((o: any) => {
    if (o.created_by) {
      salesByUser[o.created_by] = (salesByUser[o.created_by] || 0) + Number(o.grand_total || 0);
      tipsByUser[o.created_by]  = (tipsByUser[o.created_by]  || 0) + Number(o.tip_amount  || 0);
    }
  });

  // 5. Build rows — resolve name from users table first, then staff_profiles
  const rows = (staffList || []).map((s: any) => {
    const name = (userMap[s.user_id] || `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Unknown Staff');
    const totalSales = salesByUser[s.user_id] || 0;
    const totalTips  = tipsByUser[s.user_id]  || 0;
    return {
      name,
      role:        s.role       || '—',
      department:  s.department || '—',
      presentDays: attMap[s.id] || 0,
      totalSales,
      totalTips,
    };
  }).sort((a: any, b: any) => b.totalSales - a.totalSales);

  const grandSales = rows.reduce((sum: number, r: any) => sum + r.totalSales, 0);
  const grandTips  = rows.reduce((sum: number, r: any) => sum + r.totalTips,  0);
  const avgAttendance = rows.length > 0
    ? (rows.reduce((sum: number, r: any) => sum + r.presentDays, 0) / rows.length).toFixed(1)
    : '0';

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition',
    `attachment; filename=FG_HR_Performance_${monthName}_${year}.pdf`);
  doc.pipe(res);

  let y = drawBrandedHeader(doc, 'HR STAFF PERFORMANCE REPORT', periodLabel);

  // Summary strip
  doc.rect(40, y, doc.page.width - 80, 28).fill('#eef2f7');
  doc.fillColor(PRIMARY).fontSize(9).font('Helvetica-Bold');
  doc.text(`Total Staff: ${rows.length}`, 55, y + 9);
  doc.text(`Avg Attendance: ${avgAttendance} days`, 200, y + 9);
  doc.text(`Total Sales: ${fmt(grandSales)}`, 380, y + 9);
  y += 38;

  const cols = [
    { label: '#',           x: 42,  width: 22 },
    { label: 'Staff Name',  x: 68,  width: 140 },
    { label: 'Role',        x: 212, width: 100 },
    { label: 'Department',  x: 316, width: 90 },
    { label: 'Attendance',  x: 410, width: 60, align: 'right' },
    { label: 'Sales (KES)', x: 474, width: 80, align: 'right' },
  ];

  y = drawTableHeader(doc, y, cols);

  rows.forEach((row: any, i: number) => {
    if (y > doc.page.height - 70) {
      drawFooter(doc);
      doc.addPage();
      y = drawBrandedHeader(doc, 'HR STAFF PERFORMANCE REPORT (cont.)', periodLabel);
      y = drawTableHeader(doc, y, cols);
    }
    // Highlight top 3
    if (i < 3) {
      const highlightColors = ['#fff8e1', '#f5f5f5', '#fff3e0'];
      doc.rect(40, y, doc.page.width - 80, 16).fill(highlightColors[i]);
    }
    y = drawRow(doc, y, [
      { value: String(i + 1),                    x: 42,  width: 22 },
      { value: row.name,                          x: 68,  width: 140 },
      { value: row.role,                          x: 212, width: 100 },
      { value: row.department,                    x: 316, width: 90 },
      { value: `${row.presentDays} days`,         x: 410, width: 60, align: 'right' },
      { value: fmt(row.totalSales),               x: 474, width: 80, align: 'right' },
    ], i % 2 === 0 && i >= 3);
  });

  if (!rows.length) {
    doc.fontSize(9).fillColor(SECONDARY).text('No staff performance data found for this period.', 40, y + 10);
    y += 30;
  }

  y += 14;
  drawSummaryBox(doc, y, [
    { label: 'Total Staff',       value: String(rows.length) },
    { label: 'Avg Attendance',    value: `${avgAttendance} days` },
    { label: 'Total Sales',       value: fmt(grandSales) },
    { label: 'Total Tips',        value: fmt(grandTips) },
  ]);

  drawFooter(doc);
  doc.end();
}


// ── PAYROLL REPORT ────────────────────────────────────────────────────────────
export async function generatePayrollPDF(
  res: Response,
  filters: { month: number; year: number; branch_id?: number; branch_name?: string }
) {
  const { month, year, branch_id, branch_name } = filters;
  const monthName = new Date(year, month - 1).toLocaleString('en-KE', { month: 'long' });
  const branchLabel = branch_name || (branch_id ? `Branch #${branch_id}` : 'All Branches');
  const periodLabel = `${branchLabel} · Payroll Period: ${monthName} ${year}`;

  // Fetch payroll records
  const { data: payrollData } = await supabase
    .from('staff_payroll')
    .select('*')
    .eq('month', String(month))
    .eq('year', year)
    .order('generated_at', { ascending: false });

  // Fetch staff profiles (include employee_id)
  const staffIds = [...new Set((payrollData || []).map((r: any) => r.staff_id).filter(Boolean))];
  const { data: staffProfiles } = staffIds.length > 0
    ? await supabase.from('staff_profiles').select('id, role, department, branch_id, first_name, last_name, user_id, employee_id').in('id', staffIds)
    : { data: [] };
  const userIds = (staffProfiles || []).map((s: any) => s.user_id).filter(Boolean);
  const { data: users } = userIds.length > 0
    ? await supabase.from('users').select('id, first_name, last_name').in('id', userIds)
    : { data: [] };

  // Fetch branch names
  const branchIds = [...new Set((staffProfiles || []).map((s: any) => s.branch_id).filter(Boolean))];
  const { data: branchData } = branchIds.length > 0
    ? await supabase.from('branches').select('id, name').in('id', branchIds)
    : { data: [] };

  const staffMap  = new Map((staffProfiles || []).map((s: any) => [s.id, s]));
  const userMap   = new Map((users || []).map((u: any) => [u.id, u]));
  const branchMap = new Map((branchData || []).map((b: any) => [b.id, b.name]));

  const rows = (payrollData || [])
    .map((r: any) => {
      const sp   = staffMap.get(r.staff_id);
      const user = sp ? userMap.get(sp.user_id) : null;
      const firstName = user?.first_name || sp?.first_name || '';
      const lastName  = user?.last_name  || sp?.last_name  || '';
      return {
        empId:       sp?.employee_id || '—',
        name:        `${firstName} ${lastName}`.trim() || 'Unknown',
        role:        sp?.role || '—',
        branchId:    sp?.branch_id,
        branchName:  branchMap.get(sp?.branch_id) || '—',
        basicSalary: Number(r.basic_salary || 0),
        nssf:        Number(r.nssf_deduction || r.nssf || 0),
        shif:        Number(r.shif_deduction || 0),
        housing:     Number(r.housing_levy_deduction || r.housing_levy || 0),
        paye:        Number(r.paye || 0),
        credits:     Number(r.total_credit_bills || 0),
        advances:    Number(r.total_advances || 0),
        loans:       Number(r.loan_deduction || 0),
        totalDed:    Number(r.total_deductions || 0),
        netPay:      Number(r.net_pay || 0),
        status:      r.status || 'draft',
      };
    })
    .filter((r: any) => !branch_id || r.branchId === branch_id);

  const totalBasic = rows.reduce((s: number, r: any) => s + r.basicSalary, 0);
  const totalDed   = rows.reduce((s: number, r: any) => s + r.totalDed, 0);
  const totalNet   = rows.reduce((s: number, r: any) => s + r.netPay, 0);
  const totalNssf  = rows.reduce((s: number, r: any) => s + r.nssf, 0);
  const totalShif  = rows.reduce((s: number, r: any) => s + r.shif, 0);
  const totalHousing = rows.reduce((s: number, r: any) => s + r.housing, 0);
  const totalPaye  = rows.reduce((s: number, r: any) => s + r.paye, 0);
  const totalCredits = rows.reduce((s: number, r: any) => s + r.credits, 0);
  const totalAdvances = rows.reduce((s: number, r: any) => s + r.advances, 0);
  const totalLoans = rows.reduce((s: number, r: any) => s + r.loans, 0);

  // ── A3 LANDSCAPE: 1190 × 842 pt, margins 36pt each side ──
  // Usable width = 1190 - 36 - 36 = 1118pt
  // Row height 22pt, header 24pt — comfortable reading
  const ROW_H = 22;
  const HDR_H = 24;
  const MARGIN = 36;
  const PAGE_W = 1190;
  // Column widths: 24+58+148+90+86+86+68+68+68+68+68+68+62+78+78 = 1118 ✓
  // Each col x = MARGIN + cumulative sum of previous widths
  // Last col ends at 36+1082=1118+36=1154 = PAGE_W(1190) - MARGIN(36) ✓ perfect fit
  const C = [
    { label: '#',          x: 36,   width: 24 },
    { label: 'Emp ID',     x: 60,   width: 58 },
    { label: 'Staff Name', x: 118,  width: 148 },
    { label: 'Role',       x: 266,  width: 90 },
    { label: 'Branch',     x: 356,  width: 86 },
    { label: 'Basic',      x: 442,  width: 86,  align: 'right' },
    { label: 'NSSF',       x: 528,  width: 68,  align: 'right' },
    { label: 'SHIF',       x: 596,  width: 68,  align: 'right' },
    { label: 'Housing',    x: 664,  width: 68,  align: 'right' },
    { label: 'PAYE',       x: 732,  width: 68,  align: 'right' },
    { label: 'Credits',    x: 800,  width: 68,  align: 'right' },
    { label: 'Advances',   x: 868,  width: 68,  align: 'right' },
    { label: 'Loans',      x: 936,  width: 62,  align: 'right' },
    { label: 'Total Ded.', x: 998,  width: 78,  align: 'right' },
    { label: 'Net Pay',    x: 1076, width: 78,  align: 'right' },
  ];

  // Compact number formatter
  const n = (v: number) => v === 0 ? '—' : v.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const doc = new PDFDocument({ margin: MARGIN, size: [PAGE_W, 842], layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  const safeBranch = branchLabel.replace(/[^a-zA-Z0-9]/g, '_');
  res.setHeader('Content-Disposition',
    `attachment; filename=FG_Payroll_${safeBranch}_${monthName}_${year}.pdf`);
  doc.pipe(res);

  // ── Override drawBrandedHeader to use correct margin ──
  const logoPath = getLogoPath();
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, MARGIN, 28, { width: 60 });
  } else {
    doc.circle(MARGIN + 30, 58, 28).fill(PRIMARY);
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold').text('FG', MARGIN + 16, 47);
  }
  doc.fillColor(PRIMARY).fontSize(16).font('Helvetica-Bold').text(COMPANY_NAME, MARGIN + 70, 28, { align: 'right', width: PAGE_W - MARGIN * 2 - 70 });
  doc.fontSize(9).font('Helvetica').fillColor(SECONDARY)
    .text(COMPANY_ADDRESS, MARGIN + 70, 50, { align: 'right', width: PAGE_W - MARGIN * 2 - 70 })
    .text(`Email: ${COMPANY_EMAIL}`, { align: 'right', width: PAGE_W - MARGIN * 2 - 70 })
    .text(`Tel: ${COMPANY_PHONE}`, { align: 'right', width: PAGE_W - MARGIN * 2 - 70 });
  doc.strokeColor(BORDER).lineWidth(1).moveTo(MARGIN, 100).lineTo(PAGE_W - MARGIN, 100).stroke();
  doc.rect(MARGIN, 101, PAGE_W - MARGIN * 2, 3).fill(GOLD);
  doc.fillColor(PRIMARY).fontSize(15).font('Helvetica-Bold').text('PAYROLL REPORT', MARGIN, 114, { align: 'center', width: PAGE_W - MARGIN * 2 });
  doc.fontSize(9).font('Helvetica').fillColor(SECONDARY).text(periodLabel, MARGIN, 133, { align: 'center', width: PAGE_W - MARGIN * 2 });
  doc.strokeColor(BORDER).lineWidth(0.5).moveTo(MARGIN, 148).lineTo(PAGE_W - MARGIN, 148).stroke();
  let y = 158;

  // ── 4-box summary strip ──
  const sw = (PAGE_W - MARGIN * 2) / 4;
  [
    { label: 'STAFF COUNT',        value: String(rows.length),  green: false },
    { label: 'TOTAL BASIC SALARY', value: fmt(totalBasic),      green: false },
    { label: 'TOTAL DEDUCTIONS',   value: fmt(totalDed),        green: false },
    { label: 'TOTAL NET PAY',      value: fmt(totalNet),        green: true  },
  ].forEach((item, i) => {
    const bx = MARGIN + i * sw;
    doc.rect(bx, y, sw, 36).fill(item.green ? '#1a6b3c' : '#eef2f7');
    if (i > 0) doc.strokeColor('#d0d8e4').lineWidth(0.5).moveTo(bx, y).lineTo(bx, y + 36).stroke();
    doc.fillColor(item.green ? '#a8f0c6' : SECONDARY).fontSize(7).font('Helvetica').text(item.label, bx + 10, y + 6, { width: sw - 20 });
    doc.fillColor(item.green ? 'white' : PRIMARY).fontSize(12).font('Helvetica-Bold').text(item.value, bx + 10, y + 18, { width: sw - 20 });
  });
  y += 46;

  // ── Table header ──
  doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, HDR_H).fill(HEADER_BG);
  doc.fillColor('white').fontSize(7.5).font('Helvetica-Bold');
  C.forEach(col => {
    doc.text(col.label, col.x + 2, y + 7, { width: col.width - 4, align: (col.align as any) ?? 'left', ellipsis: true });
  });
  y += HDR_H;

  // ── Data rows ──
  const renderRow = (row: any, i: number) => {
    if (i % 2 === 0) doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, ROW_H).fill(ROW_BG);
    doc.fillColor(PRIMARY).fontSize(8).font('Helvetica');
    const vals = [
      { v: String(i + 1),       c: C[0] },
      { v: row.empId,            c: C[1] },
      { v: row.name,             c: C[2] },
      { v: row.role,             c: C[3] },
      { v: row.branchName,       c: C[4] },
      { v: n(row.basicSalary),   c: C[5] },
      { v: n(row.nssf),          c: C[6] },
      { v: n(row.shif),          c: C[7] },
      { v: n(row.housing),       c: C[8] },
      { v: n(row.paye),          c: C[9] },
      { v: n(row.credits),       c: C[10] },
      { v: n(row.advances),      c: C[11] },
      { v: n(row.loans),         c: C[12] },
      { v: n(row.totalDed),      c: C[13] },
      { v: n(row.netPay),        c: C[14] },
    ];
    vals.forEach(({ v, c }) => {
      doc.text(v, c.x + 2, y + 6, { width: c.width - 4, align: (c.align as any) ?? 'left', ellipsis: true });
    });
    doc.strokeColor(BORDER).lineWidth(0.3).moveTo(MARGIN, y + ROW_H).lineTo(PAGE_W - MARGIN, y + ROW_H).stroke();
    return y + ROW_H;
  };

  rows.forEach((row: any, i: number) => {
    if (y > 842 - 80) {
      // Footer on current page
      doc.strokeColor(BORDER).lineWidth(0.5).moveTo(MARGIN, 842 - 36).lineTo(PAGE_W - MARGIN, 842 - 36).stroke();
      doc.fillColor(SECONDARY).fontSize(7.5).font('Helvetica').text(
        `Generated: ${new Date().toLocaleString('en-KE')} | ${COMPANY_NAME} — Confidential`,
        MARGIN, 842 - 26, { align: 'center', width: PAGE_W - MARGIN * 2 }
      );
      doc.addPage();
      // Repeat header on new page
      doc.fillColor(PRIMARY).fontSize(11).font('Helvetica-Bold').text('PAYROLL REPORT (cont.)', MARGIN, 20, { align: 'center', width: PAGE_W - MARGIN * 2 });
      doc.fontSize(8).font('Helvetica').fillColor(SECONDARY).text(periodLabel, MARGIN, 34, { align: 'center', width: PAGE_W - MARGIN * 2 });
      y = 50;
      doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, HDR_H).fill(HEADER_BG);
      doc.fillColor('white').fontSize(7.5).font('Helvetica-Bold');
      C.forEach(col => {
        doc.text(col.label, col.x + 2, y + 7, { width: col.width - 4, align: (col.align as any) ?? 'left', ellipsis: true });
      });
      y += HDR_H;
    }
    y = renderRow(row, i);
  });

  if (!rows.length) {
    doc.fontSize(10).fillColor(SECONDARY).text('No payroll records found for this period.', MARGIN, y + 14);
    y += 34;
  }

  // ── Totals row ──
  y += 2;
  doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, ROW_H + 2).fill('#1a1a1a');
  doc.fillColor('white').fontSize(8.5).font('Helvetica-Bold');
  doc.text('TOTALS', C[2].x + 2, y + 7, { width: 200 });
  [
    { v: n(totalBasic),    c: C[5] },
    { v: n(totalNssf),     c: C[6] },
    { v: n(totalShif),     c: C[7] },
    { v: n(totalHousing),  c: C[8] },
  ].forEach(({ v, c }) => {
    doc.text(v, c.x + 2, y + 7, { width: c.width - 4, align: 'right' });
  });
  y += ROW_H + 12;

  // ── Summary box + signatures ──
  drawSummaryBox(doc, y, [
    { label: 'Total Staff',        value: String(rows.length) },
    { label: 'Total Basic Salary', value: fmt(totalBasic) },
    { label: 'Total Deductions',   value: fmt(totalDed) },
    { label: 'Total Net Pay',      value: fmt(totalNet) },
  ]);
  doc.fillColor(SECONDARY).fontSize(8.5).font('Helvetica')
    .text('Prepared by: _______________________________', MARGIN, y + 8)
    .text('Approved by: _______________________________', MARGIN, y + 28)
    .text(`Date: ${new Date().toLocaleDateString('en-KE')}`, MARGIN, y + 48);

  // ── Footer ──
  drawFooter(doc);
  doc.end();
}

// ── DOCUMENTATION REPORT (IN-DEPTH ENTERPRISE MANUAL) ─────────────────────────
export async function generateDocumentationPDF(
  res: Response,
  filters: { moduleId?: string }
) {
  const { moduleId } = filters;
  logger.info(`[V3.2_ZERO_PAGING] Initializing Absolute Layout Engine...`);

  const docsToRender = (moduleId && moduleId !== 'all') 
    ? detailedDocs.filter(d => d.id === moduleId) 
    : detailedDocs;

  if (docsToRender.length === 0) return;

  // 1. ABSOLUTE CONFIG: Set margins to 0 to disable all automatic paging.
  // We will enforce "Virtual Margins" manually via ensureSpace.
  const doc = new PDFDocument({ 
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    size: 'A4',
    autoFirstPage: true 
  });

  // VIRTUAL MARGIN CONSTANTS
  const V_TOP = 105;
  const V_BOTTOM = 60;
  const V_LEFT = 50;
  const V_RIGHT = 50;
  const PAGE_W = doc.page.width;
  const PAGE_H = doc.page.height;
  const CONTENT_W = PAGE_W - V_LEFT - V_RIGHT;

  const logoPath = path.join(process.cwd(), 'public', 'fglogo.png');
  const hasLogo = fs.existsSync(logoPath);

  res.setHeader('Content-Type', 'application/pdf');
  const filename = `FamousGate_Industrial_V3.2_${moduleId?.toUpperCase() || 'ENT'}.pdf`;
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  doc.pipe(res);

  let pageNumber = 0;
  let isBrandingActive = false;

  // --- Layout Master: Single Source of Truth for Branding ---
  const drawPageBranding = () => {
    if (isBrandingActive) return;
    isBrandingActive = true;
    pageNumber++;

    doc.save(); // Isolate branding style from content

    try {
      // Background Grid Line
      doc.rect(25, 25, PAGE_W - 50, PAGE_H - 50).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
      
      // HEADER: DOCUMENT CONTROL GRID
      const hY = 32;
      const hH = 48;
      doc.rect(32, hY, PAGE_W - 64, hH).lineWidth(1.5).strokeColor('#0f172a').stroke();
      
      // Vertical separators
      doc.moveTo(90, hY).lineTo(90, hY + hH).stroke();
      doc.moveTo(PAGE_W - 160, hY).lineTo(PAGE_W - 160, hY + hH).stroke();

      if (hasLogo) doc.image(logoPath, 48, hY + 10, { width: 30 });

      // Identify Content
      doc.font('Courier-Bold').fontSize(10).fillColor('#0f172a');
      doc.text('FAMOUSGATE SOLUTIONS ARCHITECTURE', 105, hY + 14);
      doc.font('Courier').fontSize(8).fillColor('#64748b');
      doc.text('SYSTEM SPECIFICATION // OPERATIONS AUDIT MANUAL // V3.2_STABLE', 105, hY + 28);

      // Status Metrics
      doc.font('Courier-Bold').fontSize(9).fillColor('#0f172a');
      doc.text(`REF: FG-OM-26-V3.2`, PAGE_W - 145, hY + 14);
      doc.text(`SHEET: ${String(pageNumber).padStart(3, '0')}`, PAGE_W - 145, hY + 28);

      // FOOTER: SECURITY BAR
      const fY = PAGE_H - 45;
      doc.rect(32, fY, PAGE_W - 64, 20).lineWidth(0.5).strokeColor('#94a3b8').stroke();
      doc.font('Courier').fontSize(8).fillColor('#94a3b8')
         .text('AUTHORIZED DISTRIBUTION ONLY // INTELLECTUAL PROPERTY OF HIRALL SOLUTIONS', 0, fY + 6, { align: 'center', width: PAGE_W });

    } finally {
      doc.restore(); // Critical: Never leak state
      isBrandingActive = false;
    }
  };

  // --- Master Paging Authority ---
  const ensureSpace = (h: number) => {
    // If current Y + planned height exceeds the safe content area, flip page.
    if (doc.y + h > PAGE_H - V_BOTTOM) {
      doc.addPage();
      doc.y = V_TOP; // Force cursor to virtual top
      return true;
    }
    return false;
  };

  doc.on('pageAdded', () => drawPageBranding());
  
  // Initialize First Page
  drawPageBranding();
  doc.y = V_TOP; // Set initial position

  // --- Industrial Styling Helpers ---
  const drawModuleHeader = (text: string) => {
    ensureSpace(40);
    const startY = doc.y;
    doc.rect(V_LEFT, startY, CONTENT_W, 25).fill('#0f172a');
    doc.font('Courier-Bold').fontSize(11).fillColor('#ffffff').text(` [ ${text.toUpperCase()} ]`, V_LEFT + 8, startY + 8);
    doc.y = startY + 35;
    doc.fillColor('#1e293b');
  };

  const drawDataRow = (k: string, v: string) => {
    const lines = doc.heightOfString(`${k} : ${v}`, { width: CONTENT_W });
    ensureSpace(lines + 10);
    doc.font('Courier-Bold').fontSize(10).fillColor('#334155').text(`» ${k.padEnd(20, ' ')} : `, { continued: true })
       .font('Courier').fillColor('#1e293b').text(v);
    doc.y += 5;
  };

  const drawTechnicalGrid = (headers: string[], rows: string[][], widths: number[]) => {
    ensureSpace(60);
    const startX = V_LEFT;
    
    // Header Row
    const headY = doc.y;
    doc.rect(startX, headY, CONTENT_W, 20).fill('#e2e8f0');
    doc.font('Courier-Bold').fontSize(9).fillColor('#475569');
    let cX = startX;
    headers.forEach((h, i) => {
      doc.text(h.toUpperCase(), cX + 6, headY + 6, { width: widths[i] - 12 });
      cX += widths[i];
    });
    doc.strokeColor('#cbd5e1').lineWidth(0.5).rect(startX, headY, CONTENT_W, 20).stroke();
    doc.y = headY + 20;

    // Body Rows
    rows.forEach(r => {
      // Check if this specific row needs a page flip
      const cellHeights = r.map((cell, i) => doc.heightOfString(cell, { width: widths[i] - 12 }));
      const maxH = Math.max(...cellHeights, 15) + 8;
      
      const didFlip = ensureSpace(maxH);
      if (didFlip) {
        // Redraw table header if we flipped mid-table
        const newHeadY = doc.y;
        doc.rect(startX, newHeadY, CONTENT_W, 20).fill('#cbd5e1'); // Darker for mid-split
        doc.font('Courier-Bold').fontSize(9).fillColor('#0f172a');
        let rCX = startX;
        headers.forEach((h, i) => {
          doc.text(h.toUpperCase(), rCX + 6, newHeadY + 6, { width: widths[i] - 12 });
          rCX += widths[i];
        });
        doc.y = newHeadY + 20;
      }

      const rowY = doc.y;
      cX = startX;
      doc.font('Courier').fontSize(9).fillColor('#1e293b');
      r.forEach((cell, i) => {
        doc.text(cell, cX + 6, rowY + 5, { width: widths[i] - 12 });
        cX += widths[i];
      });
      doc.y = rowY + maxH;

      // Draw Row Borders
      doc.strokeColor('#cbd5e1').lineWidth(0.5);
      doc.moveTo(startX, rowY).lineTo(startX, doc.y).stroke();
      doc.moveTo(startX + CONTENT_W, rowY).lineTo(startX + CONTENT_W, doc.y).stroke();
      doc.moveTo(startX, doc.y).lineTo(startX + CONTENT_W, doc.y).stroke();
    });
    doc.y += 10;
  };

  // 1. --- SYSTEM COVER V3.2 ---
  if (hasLogo) {
    doc.image(logoPath, PAGE_W / 2 - 60, 110, { width: 120 });
  }
  doc.y = 260; 
  doc.font('Courier-Bold').fontSize(40).fillColor('#0f172a').text('FAMOUSGATE', { align: 'center' });
  doc.fontSize(20).fillColor('#334155').text('TECHNICAL AUDIT & OPS MANUAL', { align: 'center' });
  doc.moveDown(1.5);
  
  doc.rect(150, doc.y, PAGE_W - 300, 2).fill('#0f172a');
  doc.moveDown(2);
  
  const metrics = [['SYSTEM_VERSION', '3.2.0-STABLE'], ['CLEARANCE', 'LEVEL_4_RESTRICTED'], ['ENGINE_CORE', 'HIRALL_AUTO_DOC_V3'], ['AUDIT_DATE', '2026-03-17']];
  metrics.forEach(([k, v]) => {
    doc.font('Courier-Bold').fontSize(11).text(k.padStart(18, ' '), 150, doc.y, { continued: true }).font('Courier').text(` : ${v}`);
    doc.y += 18;
  });

  // 2. --- SYSTEM INDEX ---
  doc.addPage();
  doc.y = V_TOP;
  drawModuleHeader('0.0 SYSTEM MODULE INDEX');
  doc.y += 10;
  docsToRender.forEach((m, i) => {
    doc.font('Courier-Bold').fontSize(11).text(`[ID: ${String(i + 1).padStart(2, '0')}] ${m.title.toUpperCase()}`, { continued: true })
       .text(' '.padEnd(45 - m.title.length, '.'), { continued: true })
       .text(` ACCESS: VERIFIED`);
    doc.y += 15;
  });

  // 3. --- CORE DOCUMENTATION SYSTEM ---
  docsToRender.forEach((m, mi) => {
    ensureSpace(200);
    doc.y += 30;
    
    // Module Giant Title
    const mY = doc.y;
    doc.rect(V_LEFT, mY, CONTENT_W, 35).lineWidth(2).strokeColor('#0f172a').stroke();
    doc.font('Courier-Bold').fontSize(16).fillColor('#0f172a').text(`[MOD_${mi+1}] ARCHITECTURE: ${m.title.toUpperCase()}`, V_LEFT + 15, mY + 11);
    doc.y = mY + 45;

    drawDataRow('CORE_OBJECTIVE', m.purpose);
    drawDataRow('ACCESS_ROLES', m.role);
    
    drawModuleHeader(`${mi + 1}.1 COMPONENT TOPOLOGY`);
    drawTechnicalGrid(['ID', 'Feature Designation', 'Registry'], m.components.map((c, ci) => [String(ci + 1), c.name, 'VERIFIED_ACTIVE']), [40, 345, 110]);

    drawModuleHeader(`${mi + 1}.2 SYSTEM PROTOCOLS (SOP)`);
    m.workflows.forEach((w, wi) => {
      ensureSpace(120);
      doc.font('Courier-Bold').fontSize(10).fillColor('#0f172a').text(` » SUB_PROCESS: [${mi+1}.${wi+1}] ${w.title.toUpperCase()}`);
      drawTechnicalGrid(['STP', 'Instruction Flow Execution'], w.steps.map((s, si) => [String(si + 1), s]), [40, 455]);
    });

    drawModuleHeader(`${mi + 1}.3 FAULT RESOLUTION MATRIX`);
    drawTechnicalGrid(['Fault Event Trigger', 'Recovery Routine Path'], m.troubleshooting.map(t => [t.issue, t.resolution]), [200, 295]);
    
    drawModuleHeader(`${mi+1}.4 LEGAL & COMPLIANCE`);
    const disclaimer = 'All data handled strictly per FamousGate Privacy Policy 2026. Access to this module requires Hirall Enterprise JWT clearance.';
    const dh = doc.heightOfString(disclaimer, { width: CONTENT_W });
    ensureSpace(dh + 20);
    doc.font('Courier').fontSize(10).text(disclaimer, { align: 'justify' });
    doc.y += 30;
  });

  // 4. --- LEGAL CLASSIFICATION END ---
  ensureSpace(120);
  doc.y += 40;
  doc.rect(V_LEFT, doc.y, CONTENT_W, 1).fill('#475569');
  doc.y += 10;
  doc.font('Courier-Bold').fontSize(12).fillColor('#0f172a').text('DOCUMENT LOCK // END OF TRANSMISSION', { align: 'center' });
  doc.font('Courier').fontSize(9).fillColor('#64748b').text('© 2026 FamousGate Hotels | Built by Hirall Systems core_v3.2', { align: 'center' });

  return new Promise((resolve, reject) => {
    res.on('finish', () => {
      logger.info('[V3.2_ZERO_PAGING] Generation Sequence Complete.');
      resolve(null);
    });
    res.on('error', reject);
    doc.removeAllListeners('pageAdded');
    doc.end();
  });
}







