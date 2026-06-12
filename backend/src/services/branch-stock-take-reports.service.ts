/**
 * BRANCH STOCK TAKE — EXECUTIVE REPORTING ENGINE
 * --------------------------------------------------------------------------
 * Purpose-built PDF + Excel templates for the branch stock take workflow:
 * storekeeper count → branch accountant review → auditor final review.
 *
 * Every export is FG-branded (logo, cover header, gold accent, footer, page
 * numbering) and resembles an enterprise hospitality ERP output rather than a
 * raw table dump. Layouts adapt to the stock take family:
 *   - inventory / foodstuffs / store  → full variance & valuation report
 *   - bar (main / executive / sports) → bottle-count bar control report
 *   - kitchen (shift A/B / production) → production, yield & wastage report
 * and to the workflow variant: storekeeper, accountant_review, audit.
 */

import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { Response } from 'express';

const ExcelJS = require('exceljs');

// ── FG brand constants ────────────────────────────────────────────────────────
const PRIMARY   = '#1a1a1a';
const SECONDARY = '#555555';
const ACCENT    = '#0066cc';
const BORDER    = '#e0e0e0';
const ROW_BG    = '#f9f9f9';
const HEADER_BG = '#1a3c5e';
const GOLD      = '#c8a84b';
const GREEN     = '#16a34a';
const AMBER     = '#d97706';
const RED       = '#dc2626';

const GREEN_BG  = '#e8f6ec';
const AMBER_BG  = '#fdf3e3';
const RED_BG    = '#fdecec';

const COMPANY_NAME    = 'FamousGateHotels';
const COMPANY_ADDRESS = 'Bomet, Kenya';
const COMPANY_EMAIL   = 'famousgateshotelsbmt@gmail.com';
const COMPANY_PHONE   = '0706 782 828';

// Excel ARGB equivalents
const X_HEADER   = 'FF1A3C5E';
const X_GOLD     = 'FFC8A84B';
const X_WHITE    = 'FFFFFFFF';
const X_GREEN_BG = 'FFD1FAE5';
const X_AMBER_BG = 'FFFEF3C7';
const X_RED_BG   = 'FFFEE2E2';
const X_GREEN_TX = 'FF166534';
const X_AMBER_TX = 'FF92400E';
const X_RED_TX   = 'FF9B1C1C';
const X_ZEBRA    = 'FFF4F7FA';

const KES_FMT = '"KES "#,##0.00';
const QTY_FMT = '#,##0.00';
const PCT_FMT = '#,##0.00"%"';

// ── Types ─────────────────────────────────────────────────────────────────────
export type StockTakeFamily = 'inventory' | 'bar' | 'kitchen';
export type StockTakeVariant = 'storekeeper' | 'accountant_review' | 'audit';

export interface StockTakeReportData {
  /** stock_counts header row (count_number, store_type, status, *_reviewed_*, notes …) */
  header: any;
  /** Enriched items from getEnrichedStockCountItems() */
  items: any[];
  branchName: string;
  outletName: string;
  storeTypeLabel: string;
  countDate: string | null;
  periodLabel: string;
  preparedBy: string;
  reviewedBy: string;
  approvedBy: string;
  generatedBy: string;
  accountantNotes?: string | null;
  auditorNotes?: string | null;
  variant: StockTakeVariant;
}

// ── Shared helpers ──────────────────────────────────────────────────────────--
function resolveLogoPath(): string | null {
  const candidates = [
    path.join(process.cwd(), 'public', 'fglogo.png'),
    path.join(process.cwd(), '../frontend/public/fglogo.png'),
    path.join(process.cwd(), 'frontend', 'public', 'fglogo.png'),
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const money = (n: number | null | undefined): string =>
  `KES ${num(n).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const qty = (n: number | null | undefined): string =>
  num(n).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pct = (n: number | null | undefined): string => `${num(n).toFixed(2)}%`;

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime())
    ? '—'
    : dt.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
};

export function stockTakeFamily(storeType: string | null | undefined): StockTakeFamily {
  const s = `${storeType || ''}`.toLowerCase();
  if (['main_bar', 'executive_bar', 'sports_bar', 'bar_store', 'lounge_bar', 'pool_bar'].includes(s)) return 'bar';
  if (['kitchen_shift_a', 'kitchen_shift_b', 'kitchen_production'].includes(s)) return 'kitchen';
  return 'inventory';
}

export function storeTypeLabel(storeType: string | null | undefined): string {
  const map: Record<string, string> = {
    foodstuffs: 'Foodstuffs',
    restaurant_store: 'Restaurant Store',
    bar_store: 'Bar Store',
    store_items: 'Store Items',
    main_bar: 'Main Bar',
    executive_bar: 'Executive Bar',
    sports_bar: 'Sports Bar',
    lounge_bar: 'Lounge Bar',
    pool_bar: 'Pool Bar',
    kitchen_shift_a: 'Kitchen — Shift A',
    kitchen_shift_b: 'Kitchen — Shift B',
    kitchen_production: 'Kitchen Production',
    housekeeping: 'Housekeeping',
    spa_sauna: 'Spa & Sauna',
    pos_outlet: 'POS Outlet',
    general: 'General Store',
  };
  return map[`${storeType || ''}`.toLowerCase()] || 'Branch Inventory';
}

interface Totals {
  itemCount: number;
  countedCount: number;
  pendingCount: number;
  inventoryValue: number;     // physical valuation at cost
  expectedValue: number;      // expected closing valuation at cost
  varianceValue: number;      // net variance value (signed)
  absVarianceValue: number;
  shortageValue: number;      // negative variance value (abs)
  overageValue: number;       // positive variance value
  red: number;
  amber: number;
  green: number;
  shortages: any[];           // variance < 0
  overages: any[];            // variance > 0
  highRisk: any[];            // amber + red, by abs variance value
}

function computeTotals(items: any[]): Totals {
  const t: Totals = {
    itemCount: items.length, countedCount: 0, pendingCount: 0,
    inventoryValue: 0, expectedValue: 0, varianceValue: 0, absVarianceValue: 0,
    shortageValue: 0, overageValue: 0, red: 0, amber: 0, green: 0,
    shortages: [], overages: [], highRisk: [],
  };
  for (const it of items) {
    const counted = it.counted_quantity ?? it.physical_quantity;
    const cost = num(it.cost_price);
    const expected = num(it.system_closing_stock);
    if (counted === null || counted === undefined) {
      t.pendingCount++;
    } else {
      t.countedCount++;
      t.inventoryValue += num(counted) * cost;
    }
    t.expectedValue += expected * cost;
    const vv = num(it.variance_value);
    t.varianceValue += vv;
    t.absVarianceValue += Math.abs(vv);
    if (vv < 0) { t.shortageValue += Math.abs(vv); t.shortages.push(it); }
    if (vv > 0) { t.overageValue += vv; t.overages.push(it); }
    const sev = `${it.variance_severity || ''}`.toLowerCase();
    if (sev === 'red') { t.red++; t.highRisk.push(it); }
    else if (sev === 'amber') { t.amber++; t.highRisk.push(it); }
    else if (sev === 'green') t.green++;
  }
  t.shortages.sort((a, b) => Math.abs(num(b.variance_value)) - Math.abs(num(a.variance_value)));
  t.overages.sort((a, b) => num(b.variance_value) - num(a.variance_value));
  t.highRisk.sort((a, b) => Math.abs(num(b.variance_value)) - Math.abs(num(a.variance_value)));
  return t;
}

const severityColor = (sev: string): { fg: string; bg: string } => {
  const s = `${sev || ''}`.toLowerCase();
  if (s === 'red') return { fg: RED, bg: RED_BG };
  if (s === 'amber') return { fg: AMBER, bg: AMBER_BG };
  if (s === 'green') return { fg: GREEN, bg: GREEN_BG };
  return { fg: SECONDARY, bg: '#f1f5f9' };
};

// ── PDF: branded header (drawn on every page) ──────────────────────────────────
function drawHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string): number {
  const W = doc.page.width;
  const logo = resolveLogoPath();
  if (logo) {
    try { doc.image(logo, 30, 26, { width: 50 }); } catch { /* ignore */ }
  } else {
    doc.circle(55, 51, 24).fill(PRIMARY);
    doc.fillColor('white').fontSize(18).font('Helvetica-Bold').text('FG', 42, 41);
  }

  doc.fillColor(PRIMARY).fontSize(15).font('Helvetica-Bold')
    .text(COMPANY_NAME, 90, 28, { align: 'right', width: W - 120 });
  doc.fontSize(8).font('Helvetica').fillColor(SECONDARY)
    .text(`${COMPANY_ADDRESS}  ·  ${COMPANY_EMAIL}  ·  Tel: ${COMPANY_PHONE}`, 90, 47,
      { align: 'right', width: W - 120 });

  doc.strokeColor(BORDER).lineWidth(1).moveTo(30, 78).lineTo(W - 30, 78).stroke();
  doc.rect(30, 79, W - 60, 3).fill(GOLD);

  doc.fillColor(PRIMARY).fontSize(13).font('Helvetica-Bold').text(title, 30, 90, { align: 'center', width: W - 60 });
  doc.fontSize(8.5).font('Helvetica').fillColor(SECONDARY).text(subtitle, 30, 107, { align: 'center', width: W - 60 });

  doc.strokeColor(BORDER).lineWidth(0.5).moveTo(30, 122).lineTo(W - 30, 122).stroke();
  doc.fillColor(PRIMARY);
  return 132;
}

// ── PDF: identification meta grid ──────────────────────────────────────────────
function drawMetaGrid(doc: PDFKit.PDFDocument, y: number, pairs: [string, string][]): number {
  const W = doc.page.width;
  const cols = 3;
  const colW = (W - 60) / cols;
  const rowH = 26;
  const rows = Math.ceil(pairs.length / cols);

  doc.rect(30, y, W - 60, rows * rowH).fillAndStroke('#fbfcfe', BORDER);
  pairs.forEach((pair, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const cx = 30 + c * colW + 8;
    const cy = y + r * rowH + 5;
    doc.fillColor(SECONDARY).fontSize(7).font('Helvetica-Bold').text(pair[0].toUpperCase(), cx, cy, { width: colW - 16 });
    doc.fillColor(PRIMARY).fontSize(9).font('Helvetica').text(pair[1] || '—', cx, cy + 9, { width: colW - 16, ellipsis: true });
  });
  return y + rows * rowH + 12;
}

// ── PDF: KPI cards ──────────────────────────────────────────────────────────---
function drawKpiCards(doc: PDFKit.PDFDocument, y: number, cards: { label: string; value: string; accent: string }[]): number {
  const W = doc.page.width;
  const gap = 10;
  const cardW = (W - 60 - gap * (cards.length - 1)) / cards.length;
  const cardH = 46;
  cards.forEach((card, i) => {
    const x = 30 + i * (cardW + gap);
    doc.roundedRect(x, y, cardW, cardH, 4).fillAndStroke('#ffffff', BORDER);
    doc.rect(x, y, 4, cardH).fill(card.accent);
    doc.fillColor(SECONDARY).fontSize(7.5).font('Helvetica-Bold').text(card.label.toUpperCase(), x + 12, y + 8, { width: cardW - 18 });
    doc.fillColor(PRIMARY).fontSize(13).font('Helvetica-Bold').text(card.value, x + 12, y + 22, { width: cardW - 18, ellipsis: true });
  });
  return y + cardH + 14;
}

// ── PDF: section title ─────────────────────────────────────────────────────────
function sectionTitle(doc: PDFKit.PDFDocument, y: number, text: string): number {
  const W = doc.page.width;
  doc.fillColor(HEADER_BG).fontSize(10.5).font('Helvetica-Bold').text(text.toUpperCase(), 30, y);
  doc.strokeColor(GOLD).lineWidth(1.5).moveTo(30, y + 15).lineTo(W - 30, y + 15).stroke();
  doc.fillColor(PRIMARY);
  return y + 22;
}

interface Col { label: string; width: number; align?: 'left' | 'right' | 'center'; }

function drawTableHead(doc: PDFKit.PDFDocument, y: number, cols: Col[]): number {
  const W = doc.page.width;
  doc.rect(30, y, W - 60, 18).fill(HEADER_BG);
  doc.fillColor('white').fontSize(7.5).font('Helvetica-Bold');
  let x = 30;
  cols.forEach(c => {
    doc.text(c.label, x + 4, y + 5.5, { width: c.width - 6, align: c.align || 'left', ellipsis: true });
    x += c.width;
  });
  doc.fillColor(PRIMARY).font('Helvetica');
  return y + 18;
}

function drawCells(doc: PDFKit.PDFDocument, y: number, cols: Col[], values: { text: string; color?: string }[], shade: boolean, rowH = 15): number {
  const W = doc.page.width;
  if (shade) doc.rect(30, y, W - 60, rowH).fill(ROW_BG);
  let x = 30;
  cols.forEach((c, i) => {
    const v = values[i] || { text: '' };
    doc.fillColor(v.color || PRIMARY).fontSize(7.5).font('Helvetica')
      .text(v.text, x + 4, y + 4, { width: c.width - 6, align: c.align || 'left', ellipsis: true });
    x += c.width;
  });
  doc.strokeColor(BORDER).lineWidth(0.25).moveTo(30, y + rowH).lineTo(W - 30, y + rowH).stroke();
  doc.fillColor(PRIMARY);
  return y + rowH;
}

// Column specs per family for the detailed item table (landscape A4, content ~782pt).
function detailColumns(family: StockTakeFamily): Col[] {
  if (family === 'bar') {
    return [
      { label: '#', width: 22 },
      { label: 'Item', width: 132 },
      { label: 'UoM', width: 40 },
      { label: 'Opening', width: 62, align: 'right' },
      { label: 'Purchases', width: 62, align: 'right' },
      { label: 'Transf In', width: 56, align: 'right' },
      { label: 'Transf Out', width: 58, align: 'right' },
      { label: 'Sales', width: 56, align: 'right' },
      { label: 'Expected', width: 62, align: 'right' },
      { label: 'Physical', width: 62, align: 'right' },
      { label: 'Variance', width: 58, align: 'right' },
      { label: 'Var Value', width: 72, align: 'right' },
      { label: 'Status', width: 40, align: 'center' },
    ];
  }
  if (family === 'kitchen') {
    return [
      { label: '#', width: 22 },
      { label: 'Item', width: 150 },
      { label: 'UoM', width: 42 },
      { label: 'Produced', width: 64, align: 'right' },
      { label: 'Issued', width: 60, align: 'right' },
      { label: 'Sold', width: 60, align: 'right' },
      { label: 'Wastage', width: 60, align: 'right' },
      { label: 'Expected', width: 62, align: 'right' },
      { label: 'Physical', width: 62, align: 'right' },
      { label: 'Variance', width: 58, align: 'right' },
      { label: 'Var %', width: 48, align: 'right' },
      { label: 'Reason', width: 92 },
    ];
  }
  return [
    { label: '#', width: 22 },
    { label: 'Item', width: 120 },
    { label: 'UoM', width: 34 },
    { label: 'Opening', width: 50, align: 'right' },
    { label: 'Additions', width: 52, align: 'right' },
    { label: 'Cost', width: 56, align: 'right' },
    { label: 'Issued', width: 48, align: 'right' },
    { label: 'Expected', width: 54, align: 'right' },
    { label: 'Physical', width: 54, align: 'right' },
    { label: 'Var Qty', width: 48, align: 'right' },
    { label: 'Var %', width: 42, align: 'right' },
    { label: 'Var Value', width: 64, align: 'right' },
    { label: 'Reason', width: 38 },
  ];
}

function detailRow(family: StockTakeFamily, it: any, index: number): { text: string; color?: string }[] {
  const counted = it.counted_quantity ?? it.physical_quantity;
  const sev = severityColor(it.variance_severity);
  const varCell = (v: any) => ({ text: v === null || v === undefined ? '—' : (num(v) > 0 ? '+' : '') + qty(v), color: sev.fg });
  if (family === 'bar') {
    return [
      { text: String(index) },
      { text: it.item_name || '—' },
      { text: it.unit || '—' },
      { text: qty(it.opening_stock) },
      { text: qty(it.additions) },
      { text: qty(it.transfers_in) },
      { text: qty(it.transfers_out) },
      { text: qty(it.sales_quantity ?? it.issued_quantity) },
      { text: qty(it.system_closing_stock) },
      { text: counted === null ? '—' : qty(counted) },
      varCell(it.variance),
      { text: it.variance_value === null ? '—' : money(it.variance_value), color: sev.fg },
      { text: counted === null ? 'PENDING' : 'OK', color: counted === null ? AMBER : GREEN, align: 'center' } as any,
    ];
  }
  if (family === 'kitchen') {
    return [
      { text: String(index) },
      { text: it.item_name || '—' },
      { text: it.unit || '—' },
      { text: qty(it.production_quantity) },
      { text: qty(it.issued_quantity) },
      { text: qty(it.sales_quantity) },
      { text: qty(it.wastage_quantity) },
      { text: qty(it.system_closing_stock) },
      { text: counted === null ? '—' : qty(counted) },
      varCell(it.variance),
      { text: it.variance_percentage === null ? '—' : pct(it.variance_percentage), color: sev.fg },
      { text: it.variance_reason || '—' },
    ];
  }
  return [
    { text: String(index) },
    { text: it.item_name || '—' },
    { text: it.unit || '—' },
    { text: qty(it.opening_stock) },
    { text: qty(it.additions) },
    { text: money(it.cost_price) },
    { text: qty(it.issued_quantity) },
    { text: qty(it.system_closing_stock) },
    { text: counted === null ? '—' : qty(counted) },
    varCell(it.variance),
    { text: it.variance_percentage === null ? '—' : pct(it.variance_percentage), color: sev.fg },
    { text: it.variance_value === null ? '—' : money(it.variance_value), color: sev.fg },
    { text: it.variance_reason || '—' },
  ];
}

function drawSignatureBlock(doc: PDFKit.PDFDocument, y: number, data: StockTakeReportData): number {
  const W = doc.page.width;
  y = sectionTitle(doc, y, 'Approval & Signatures');
  const cols: [string, string][] = [
    ['Prepared By (Storekeeper)', data.preparedBy],
    ['Reviewed By (Branch Accountant)', data.reviewedBy],
    ['Audited By (Auditor)', data.approvedBy],
  ];
  const colW = (W - 60) / 3;
  cols.forEach((c, i) => {
    const x = 30 + i * colW;
    doc.strokeColor(PRIMARY).lineWidth(0.6).moveTo(x + 6, y + 34).lineTo(x + colW - 12, y + 34).stroke();
    doc.fillColor(PRIMARY).fontSize(8.5).font('Helvetica-Bold').text(c[1] || '—', x + 6, y + 38, { width: colW - 18 });
    doc.fillColor(SECONDARY).fontSize(7).font('Helvetica').text(c[0], x + 6, y + 50, { width: colW - 18 });
    doc.fillColor(SECONDARY).fontSize(7).text('Signature & Date: ______________________', x + 6, y + 62, { width: colW - 12 });
  });
  return y + 84;
}

function ensureSpace(doc: PDFKit.PDFDocument, y: number, needed: number, title: string, subtitle: string): number {
  if (y + needed > doc.page.height - 50) {
    doc.addPage();
    return drawHeader(doc, title + ' (cont.)', subtitle);
  }
  return y;
}

// ── PDF: main entry point ──────────────────────────────────────────────────────
export async function generateBranchStockTakeReportPDF(res: Response, data: StockTakeReportData): Promise<void> {
  const family = stockTakeFamily(data.header?.store_type);
  const t = computeTotals(data.items);

  const variantTitle =
    data.variant === 'accountant_review' ? 'STOCK TAKE — BRANCH ACCOUNTANT REVIEW'
    : data.variant === 'audit'           ? 'BRANCH STOCK TAKE AUDIT REPORT'
    : family === 'bar'                   ? 'BRANCH BAR STOCK TAKE REPORT'
    : family === 'kitchen'               ? 'BRANCH KITCHEN PRODUCTION REPORT'
    :                                      'BRANCH STOCK TAKE REPORT';

  const ref = data.header?.count_number || `${data.header?.id || ''}`.substring(0, 8) || '—';
  const subtitle = `${data.branchName}  ·  ${data.outletName}  ·  Ref ${ref}`;

  const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape', bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  const safe = `${variantTitle}_${ref}`.replace(/[^a-zA-Z0-9]/g, '_');
  res.setHeader('Content-Disposition', `attachment; filename=FG_${safe}_${new Date().toISOString().split('T')[0]}.pdf`);
  doc.pipe(res);

  let y = drawHeader(doc, variantTitle, subtitle);

  // Identification grid
  y = drawMetaGrid(doc, y, [
    ['Branch', data.branchName],
    ['Outlet', data.outletName],
    ['Stock Category', data.storeTypeLabel],
    ['Stock Take Date', fmtDate(data.countDate)],
    ['Reporting Period', data.periodLabel],
    ['Reference', ref],
    ['Status', `${data.header?.status || 'draft'}`.replace(/_/g, ' ').toUpperCase()],
    ['Prepared By', data.preparedBy],
    ['Generated By', `${data.generatedBy}  ·  ${new Date().toLocaleString('en-KE')}`],
  ]);

  // KPI cards
  y = drawKpiCards(doc, y, [
    { label: 'Total Inventory Value', value: money(t.inventoryValue), accent: ACCENT },
    { label: 'Total Variance Value', value: money(t.varianceValue), accent: t.varianceValue < 0 ? RED : GOLD },
    { label: 'Items Counted', value: `${t.countedCount} / ${t.itemCount}`, accent: t.pendingCount ? AMBER : GREEN },
    { label: 'High-Risk Items', value: `${t.red + t.amber}`, accent: t.red ? RED : t.amber ? AMBER : GREEN },
  ]);

  // Detailed item table grouped by category
  y = sectionTitle(doc, y, family === 'bar' ? 'Bar Stock Detail' : family === 'kitchen' ? 'Kitchen Production Detail' : 'Stock Take Detail');
  const cols = detailColumns(family);

  const groups = data.items.reduce((acc: Record<string, any[]>, it) => {
    const cat = it.category || 'Uncategorised';
    (acc[cat] = acc[cat] || []).push(it);
    return acc;
  }, {});
  const cats = Object.keys(groups).sort();

  let idx = 0;
  for (const cat of cats) {
    y = ensureSpace(doc, y, 50, variantTitle, subtitle);
    doc.fillColor(SECONDARY).fontSize(8.5).font('Helvetica-Bold').text(cat.toUpperCase(), 30, y);
    y += 13;
    y = drawTableHead(doc, y, cols);
    for (const it of groups[cat]) {
      y = ensureSpace(doc, y, 16, variantTitle, subtitle);
      if (y === 132) y = drawTableHead(doc, y, cols); // header redrawn after page break
      idx++;
      y = drawCells(doc, y, cols, detailRow(family, it, idx), idx % 2 === 0);
    }
    y += 6;
  }
  if (data.items.length === 0) {
    doc.fontSize(9).fillColor(SECONDARY).text('No items recorded for this stock take.', 30, y + 6);
    y += 24;
  }

  // ── Summary + variance analysis ──
  y = ensureSpace(doc, y, 120, variantTitle, subtitle);
  y = sectionTitle(doc, y, 'Stock Take & Variance Summary');
  const sumPairs: [string, string][] = [
    ['Total Items', String(t.itemCount)],
    ['Counted', String(t.countedCount)],
    ['Pending', String(t.pendingCount)],
    ['Total Inventory Value', money(t.inventoryValue)],
    ['Expected Closing Value', money(t.expectedValue)],
    ['Net Variance Value', money(t.varianceValue)],
    ['Shortage Value', money(t.shortageValue)],
    ['Overage Value', money(t.overageValue)],
    [`Variance Severity (R/A/G)`, `${t.red} / ${t.amber} / ${t.green}`],
  ];
  y = drawMetaGrid(doc, y, sumPairs);

  // High variance items
  const miniCols: Col[] = [
    { label: 'Item', width: 200 },
    { label: 'Category', width: 110 },
    { label: 'Expected', width: 80, align: 'right' },
    { label: 'Physical', width: 80, align: 'right' },
    { label: 'Variance', width: 80, align: 'right' },
    { label: 'Var Value', width: 100, align: 'right' },
    { label: 'Severity', width: 70, align: 'center' },
    { label: 'Reason', width: 62 },
  ];
  const renderMini = (heading: string, rows: any[]) => {
    if (!rows.length) return;
    y = ensureSpace(doc, y, 60, variantTitle, subtitle);
    y = sectionTitle(doc, y, heading);
    y = drawTableHead(doc, y, miniCols);
    rows.slice(0, 15).forEach((it, i) => {
      y = ensureSpace(doc, y, 16, variantTitle, subtitle);
      const sev = severityColor(it.variance_severity);
      y = drawCells(doc, y, miniCols, [
        { text: it.item_name || '—' },
        { text: it.category || '—' },
        { text: qty(it.system_closing_stock) },
        { text: it.counted_quantity === null ? '—' : qty(it.counted_quantity) },
        { text: (num(it.variance) > 0 ? '+' : '') + qty(it.variance), color: sev.fg },
        { text: money(it.variance_value), color: sev.fg },
        { text: `${it.variance_severity || '—'}`.toUpperCase(), color: sev.fg },
        { text: it.variance_reason || '—' },
      ], i % 2 === 0);
    });
    y += 6;
  };
  renderMini('High-Risk Variances', t.highRisk);
  renderMini('Missing Inventory (Shortages)', t.shortages);
  renderMini('Overstocked Items (Overages)', t.overages);

  // Kitchen production efficiency
  if (family === 'kitchen') {
    const produced = data.items.reduce((s, it) => s + num(it.production_quantity), 0);
    const sold = data.items.reduce((s, it) => s + num(it.sales_quantity), 0);
    const wastage = data.items.reduce((s, it) => s + num(it.wastage_quantity), 0);
    const issued = data.items.reduce((s, it) => s + num(it.issued_quantity), 0);
    const yieldPct = produced > 0 ? (sold / produced) * 100 : 0;
    const wastePct = produced > 0 ? (wastage / produced) * 100 : 0;
    y = ensureSpace(doc, y, 80, variantTitle, subtitle);
    y = drawMetaGrid(doc, y, [
      ['Total Produced', qty(produced)],
      ['Total Issued', qty(issued)],
      ['Total Sold', qty(sold)],
      ['Total Wastage', qty(wastage)],
      ['Yield / Consumption %', pct(yieldPct)],
      ['Wastage %', pct(wastePct)],
    ]);
  }

  // Comments
  const renderNotes = (heading: string, body?: string | null) => {
    if (!body || !`${body}`.trim()) return;
    y = ensureSpace(doc, y, 60, variantTitle, subtitle);
    y = sectionTitle(doc, y, heading);
    doc.fillColor(PRIMARY).fontSize(8.5).font('Helvetica').text(`${body}`.trim(), 30, y, { width: doc.page.width - 60 });
    y = doc.y + 12;
  };
  renderNotes('Branch Accountant Comments', data.accountantNotes);
  renderNotes('Auditor Comments', data.auditorNotes);

  // Signatures
  y = ensureSpace(doc, y, 110, variantTitle, subtitle);
  y = drawSignatureBlock(doc, y, data);

  // Footer + page numbers on every buffered page
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const W = doc.page.width;
    const fy = doc.page.height - 28;
    doc.strokeColor(BORDER).lineWidth(0.5).moveTo(30, fy).lineTo(W - 30, fy).stroke();
    doc.fillColor(SECONDARY).fontSize(7).font('Helvetica')
      .text(`${COMPANY_NAME} · Confidential · Generated ${new Date().toLocaleString('en-KE')}`, 30, fy + 6,
        { width: W - 120, align: 'left', lineBreak: false });
    doc.text(`Page ${i + 1} of ${range.count}`, W - 130, fy + 6, { width: 100, align: 'right', lineBreak: false });
  }

  doc.end();
}

// ════════════════════════════════════════════════════════════════════════════
// EXCEL WORKBOOK
// ════════════════════════════════════════════════════════════════════════════

function brandSheetHeader(wb: any, ws: any, title: string, data: StockTakeReportData, lastCol: string): number {
  const logo = resolveLogoPath();
  if (logo) {
    try {
      const imgId = wb.addImage({ filename: logo, extension: 'png' });
      ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 90, height: 70 } });
    } catch { /* ignore */ }
  }
  ws.mergeCells(`B1:${lastCol}1`);
  const c1 = ws.getCell('B1');
  c1.value = COMPANY_NAME;
  c1.font = { name: 'Calibri', bold: true, size: 16, color: { argb: X_HEADER } };
  c1.alignment = { horizontal: 'left', vertical: 'middle' };

  ws.mergeCells(`B2:${lastCol}2`);
  const c2 = ws.getCell('B2');
  c2.value = `${COMPANY_ADDRESS}  ·  ${COMPANY_EMAIL}  ·  Tel: ${COMPANY_PHONE}`;
  c2.font = { name: 'Calibri', size: 9, color: { argb: 'FF555555' } };

  ws.mergeCells(`A4:${lastCol}4`);
  const tc = ws.getCell('A4');
  tc.value = title;
  tc.font = { name: 'Calibri', bold: true, size: 13, color: { argb: X_WHITE } };
  tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X_HEADER } };
  tc.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(4).height = 22;

  ws.mergeCells(`A5:${lastCol}5`);
  const sc = ws.getCell('A5');
  sc.value = `Branch: ${data.branchName}  |  Outlet: ${data.outletName}  |  Category: ${data.storeTypeLabel}  |  Date: ${fmtDate(data.countDate)}  |  Ref: ${data.header?.count_number || '—'}`;
  sc.font = { name: 'Calibri', size: 9, italic: true, color: { argb: X_WHITE } };
  sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X_GOLD } };
  sc.alignment = { horizontal: 'center', vertical: 'middle' };
  return 7; // first content row
}

function styleColHeader(row: any) {
  row.eachCell((cell: any) => {
    cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: X_WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X_HEADER } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: X_WHITE } } };
  });
}

function severityFill(sev: string): { bg: string; tx: string } {
  const s = `${sev || ''}`.toLowerCase();
  if (s === 'red') return { bg: X_RED_BG, tx: X_RED_TX };
  if (s === 'amber') return { bg: X_AMBER_BG, tx: X_AMBER_TX };
  if (s === 'green') return { bg: X_GREEN_BG, tx: X_GREEN_TX };
  return { bg: X_ZEBRA, tx: 'FF555555' };
}

export async function generateBranchStockTakeWorkbook(res: Response, data: StockTakeReportData): Promise<void> {
  const family = stockTakeFamily(data.header?.store_type);
  const t = computeTotals(data.items);
  const wb = new ExcelJS.Workbook();
  wb.creator = COMPANY_NAME;
  wb.created = new Date();
  const ref = data.header?.count_number || `${data.header?.id || ''}`.substring(0, 8);

  // ── Sheet 1: Executive Summary ──
  {
    const ws = wb.addWorksheet('Executive Summary', { pageSetup: { orientation: 'portrait', fitToPage: true } });
    for (let i = 1; i <= 4; i++) ws.getColumn(i).width = 26;
    let r = brandSheetHeader(wb, ws, 'BRANCH STOCK TAKE — EXECUTIVE SUMMARY', data, 'D');

    const kpis: [string, any, string?][] = [
      ['Total Items', t.itemCount],
      ['Items Counted', t.countedCount],
      ['Items Pending', t.pendingCount],
      ['Total Inventory Value', t.inventoryValue, KES_FMT],
      ['Expected Closing Value', t.expectedValue, KES_FMT],
      ['Net Variance Value', t.varianceValue, KES_FMT],
      ['Shortage Value', t.shortageValue, KES_FMT],
      ['Overage Value', t.overageValue, KES_FMT],
      ['High-Risk Items (Red)', t.red],
      ['Watch Items (Amber)', t.amber],
      ['Within Tolerance (Green)', t.green],
    ];
    kpis.forEach(([label, value, fmt]) => {
      const lc = ws.getCell(`A${r}`);
      lc.value = label;
      lc.font = { name: 'Calibri', bold: true, size: 10, color: { argb: X_HEADER } };
      lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X_ZEBRA } };
      const vc = ws.getCell(`B${r}`);
      vc.value = value;
      if (fmt) vc.numFmt = fmt as string;
      vc.font = { name: 'Calibri', bold: true, size: 11 };
      vc.alignment = { horizontal: 'right' };
      r++;
    });

    r += 1;
    const wc = ws.getCell(`A${r}`);
    wc.value = 'Workflow Status';
    wc.font = { name: 'Calibri', bold: true, size: 11, color: { argb: X_WHITE } };
    wc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X_HEADER } };
    ws.mergeCells(`A${r}:D${r}`);
    r++;
    ([
      ['Prepared By (Storekeeper)', data.preparedBy],
      ['Reviewed By (Accountant)', data.reviewedBy],
      ['Audited By (Auditor)', data.approvedBy],
      ['Current Status', `${data.header?.status || 'draft'}`.replace(/_/g, ' ').toUpperCase()],
      ['Generated By', `${data.generatedBy} · ${new Date().toLocaleString('en-KE')}`],
    ] as [string, string][]).forEach(([k, v]) => {
      ws.getCell(`A${r}`).value = k;
      ws.getCell(`A${r}`).font = { name: 'Calibri', bold: true, size: 10 };
      ws.mergeCells(`B${r}:D${r}`);
      ws.getCell(`B${r}`).value = v || '—';
      r++;
    });
  }

  // ── Sheet 2: Branch Stock Take Details ──
  {
    const ws = wb.addWorksheet('Stock Take Details', { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 } });
    const r0 = brandSheetHeader(wb, ws, 'BRANCH STOCK TAKE DETAILS', data, 'N');
    const headers = ['#', 'Item', 'SKU', 'Category', 'UoM', 'Opening', 'Additions', 'Cost Price', 'Issued/Sales', 'Expected', 'Physical', 'Variance Qty', 'Variance %', 'Variance Value'];
    const hr = ws.getRow(r0);
    hr.values = headers;
    styleColHeader(hr);
    ws.views = [{ state: 'frozen', ySplit: r0 }];
    const widths = [5, 30, 16, 18, 8, 11, 11, 13, 12, 12, 12, 12, 11, 14];
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    let rr = r0 + 1;
    const firstData = rr;
    data.items.forEach((it, i) => {
      const counted = it.counted_quantity ?? it.physical_quantity;
      const sev = severityFill(it.variance_severity);
      const row = ws.getRow(rr);
      row.values = [
        i + 1, it.item_name || '—', it.item_sku || '—', it.category || '—', it.unit || '—',
        num(it.opening_stock), num(it.additions), num(it.cost_price), num(it.issued_quantity),
        num(it.system_closing_stock), counted === null ? null : num(counted),
        it.variance === null ? null : num(it.variance),
        it.variance_percentage === null ? null : num(it.variance_percentage),
        it.variance_value === null ? null : num(it.variance_value),
      ];
      row.eachCell((cell: any, col: number) => {
        cell.font = { name: 'Calibri', size: 9 };
        if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X_ZEBRA } };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFD0D7E0' } } };
        if ([6, 7, 9, 10, 11].includes(col)) cell.numFmt = QTY_FMT;
        if ([8, 14].includes(col)) cell.numFmt = KES_FMT;
        if (col === 13) cell.numFmt = PCT_FMT;
        if (col === 12) cell.numFmt = '+#,##0.00;-#,##0.00;0';
        if ([12, 13, 14].includes(col)) {
          cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: sev.tx } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sev.bg } };
        }
      });
      rr++;
    });

    // Totals row with live formulas
    if (data.items.length) {
      const tr = ws.getRow(rr);
      const last = rr - 1;
      tr.getCell(2).value = 'TOTALS';
      [6, 7, 9, 10, 11].forEach(c => { tr.getCell(c).value = { formula: `SUM(${colLetter(c)}${firstData}:${colLetter(c)}${last})` }; tr.getCell(c).numFmt = QTY_FMT; });
      tr.getCell(14).value = { formula: `SUM(N${firstData}:N${last})` };
      tr.getCell(14).numFmt = KES_FMT;
      tr.eachCell((cell: any) => {
        cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: X_WHITE } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X_HEADER } };
      });
      ws.autoFilter = { from: { row: r0, column: 1 }, to: { row: last, column: headers.length } };
    }
  }

  // ── Sheet 3: Variance Analysis ──
  {
    const ws = wb.addWorksheet('Variance Analysis', { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 } });
    const r0 = brandSheetHeader(wb, ws, 'VARIANCE ANALYSIS', data, 'I');
    const headers = ['Item', 'Category', 'Expected', 'Physical', 'Variance Qty', 'Variance %', 'Variance Value', 'Severity', 'Reason'];
    const hr = ws.getRow(r0); hr.values = headers; styleColHeader(hr);
    ws.views = [{ state: 'frozen', ySplit: r0 }];
    [30, 18, 12, 12, 12, 11, 14, 11, 34].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    const sorted = [...data.items].sort((a, b) => Math.abs(num(b.variance_value)) - Math.abs(num(a.variance_value)));
    let rr = r0 + 1;
    sorted.forEach((it) => {
      const sev = severityFill(it.variance_severity);
      const row = ws.getRow(rr);
      row.values = [
        it.item_name || '—', it.category || '—', num(it.system_closing_stock),
        it.counted_quantity === null ? null : num(it.counted_quantity),
        it.variance === null ? null : num(it.variance),
        it.variance_percentage === null ? null : num(it.variance_percentage),
        it.variance_value === null ? null : num(it.variance_value),
        `${it.variance_severity || '—'}`.toUpperCase(), it.variance_reason || '—',
      ];
      row.eachCell((cell: any, col: number) => {
        cell.font = { name: 'Calibri', size: 9 };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFD0D7E0' } } };
        if ([3, 4].includes(col)) cell.numFmt = QTY_FMT;
        if (col === 5) cell.numFmt = '+#,##0.00;-#,##0.00;0';
        if (col === 6) cell.numFmt = PCT_FMT;
        if (col === 7) cell.numFmt = KES_FMT;
        if ([5, 6, 7, 8].includes(col)) {
          cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: sev.tx } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sev.bg } };
        }
      });
      rr++;
    });
    if (sorted.length) ws.autoFilter = { from: { row: r0, column: 1 }, to: { row: rr - 1, column: headers.length } };
  }

  // ── Sheet 4: Inventory Movements ──
  {
    const ws = wb.addWorksheet('Inventory Movements', { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 } });
    const r0 = brandSheetHeader(wb, ws, 'INVENTORY MOVEMENTS', data, 'L');
    const headers = ['Item', 'UoM', 'Opening', 'Additions', 'Transfers In', 'Transfers Out', 'Production', 'Sales', 'Wastage', 'Returns', 'Expected', 'Physical'];
    const hr = ws.getRow(r0); hr.values = headers; styleColHeader(hr);
    ws.views = [{ state: 'frozen', ySplit: r0 }];
    [30, 8, 11, 11, 12, 12, 11, 11, 11, 11, 11, 11].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    let rr = r0 + 1;
    data.items.forEach((it, i) => {
      const row = ws.getRow(rr);
      row.values = [
        it.item_name || '—', it.unit || '—', num(it.opening_stock), num(it.additions),
        num(it.transfers_in), num(it.transfers_out), num(it.production_quantity), num(it.sales_quantity ?? it.issued_quantity),
        num(it.wastage_quantity), num(it.returns_quantity), num(it.system_closing_stock),
        it.counted_quantity === null ? null : num(it.counted_quantity),
      ];
      row.eachCell((cell: any, col: number) => {
        cell.font = { name: 'Calibri', size: 9 };
        if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X_ZEBRA } };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFD0D7E0' } } };
        if (col >= 3) cell.numFmt = QTY_FMT;
      });
      rr++;
    });
    if (data.items.length) ws.autoFilter = { from: { row: r0, column: 1 }, to: { row: rr - 1, column: headers.length } };
  }

  // ── Sheet 5: Approvals & Audit Trail ──
  {
    const ws = wb.addWorksheet('Approvals & Audit Trail', { pageSetup: { orientation: 'portrait' } });
    [22, 28, 30].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    let r = brandSheetHeader(wb, ws, 'APPROVALS & AUDIT TRAIL', data, 'C');
    const hr = ws.getRow(r); hr.values = ['Stage', 'Performed By', 'Date / Notes']; styleColHeader(hr); r++;
    const trail: [string, string, string][] = [
      ['Prepared (Storekeeper)', data.preparedBy, fmtDate(data.header?.submitted_to_accountant_at || data.header?.created_at)],
      ['Submitted for Review', data.preparedBy, fmtDate(data.header?.submitted_to_accountant_at)],
      ['Accountant Review', data.reviewedBy, `${fmtDate(data.header?.accountant_reviewed_at)} — ${data.accountantNotes || 'No notes'}`],
      ['Auditor Review', data.approvedBy, `${fmtDate(data.header?.auditor_reviewed_at)} — ${data.auditorNotes || 'No notes'}`],
      ['Locked', '—', fmtDate(data.header?.locked_at)],
      ['Current Status', '—', `${data.header?.status || 'draft'}`.replace(/_/g, ' ').toUpperCase()],
    ];
    trail.forEach(([stage, who, when], i) => {
      const row = ws.getRow(r);
      row.values = [stage, who || '—', when];
      row.eachCell((cell: any) => {
        cell.font = { name: 'Calibri', size: 10 };
        cell.alignment = { wrapText: true, vertical: 'top' };
        if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X_ZEBRA } };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFD0D7E0' } } };
      });
      r++;
    });
  }

  // ── Sheet 6: Charts & Trends (pivot-ready summary tables) ──
  {
    const ws = wb.addWorksheet('Charts & Trends', { pageSetup: { orientation: 'portrait' } });
    [26, 16, 18].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    let r = brandSheetHeader(wb, ws, 'CHARTS & TRENDS (PIVOT-READY)', data, 'C');

    // Severity distribution
    ws.getCell(`A${r}`).value = 'Variance Severity Distribution';
    ws.getCell(`A${r}`).font = { name: 'Calibri', bold: true, size: 11, color: { argb: X_HEADER } };
    r++;
    const sevHdr = ws.getRow(r); sevHdr.values = ['Severity', 'Item Count', 'Variance Value']; styleColHeader(sevHdr); r++;
    ([
      ['Red (Critical)', t.red, severityValue(data.items, 'red')],
      ['Amber (Watch)', t.amber, severityValue(data.items, 'amber')],
      ['Green (Tolerance)', t.green, severityValue(data.items, 'green')],
    ] as [string, number, number][]).forEach(([label, count, val]) => {
      const row = ws.getRow(r);
      row.values = [label, count, val];
      row.getCell(3).numFmt = KES_FMT;
      r++;
    });

    r += 1;
    ws.getCell(`A${r}`).value = 'Variance Value by Category';
    ws.getCell(`A${r}`).font = { name: 'Calibri', bold: true, size: 11, color: { argb: X_HEADER } };
    r++;
    const catHdr = ws.getRow(r); catHdr.values = ['Category', 'Item Count', 'Variance Value']; styleColHeader(catHdr); r++;
    const byCat = data.items.reduce((acc: Record<string, { c: number; v: number }>, it) => {
      const k = it.category || 'Uncategorised';
      acc[k] = acc[k] || { c: 0, v: 0 };
      acc[k].c++; acc[k].v += num(it.variance_value);
      return acc;
    }, {});
    Object.keys(byCat).sort((a, b) => Math.abs(byCat[b].v) - Math.abs(byCat[a].v)).forEach((k) => {
      const row = ws.getRow(r);
      row.values = [k, byCat[k].c, byCat[k].v];
      row.getCell(3).numFmt = KES_FMT;
      r++;
    });
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const safe = `BranchStockTake_${ref}`.replace(/[^a-zA-Z0-9]/g, '_');
  res.setHeader('Content-Disposition', `attachment; filename="FG_${safe}_${new Date().toISOString().split('T')[0]}.xlsx"`);
  await wb.xlsx.write(res);
}

function severityValue(items: any[], sev: string): number {
  return items.filter(it => `${it.variance_severity || ''}`.toLowerCase() === sev)
    .reduce((s, it) => s + num(it.variance_value), 0);
}

function colLetter(n: number): string {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
