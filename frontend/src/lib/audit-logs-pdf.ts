/**
 * audit-logs-pdf.ts
 * Branded PDF export for Audit Logs — Famous Gates Hotels
 * Matches the payroll summary style: header, branded colors, bordered table
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { LogEntry } from '@/lib/api/admin-logs';

// ── Brand constants ───────────────────────────────────────────────────────────
const BRAND = {
  black:      [26,  26,  26]  as [number, number, number],
  darkGray:   [55,  55,  55]  as [number, number, number],
  midGray:    [120, 120, 120] as [number, number, number],
  lightGray:  [240, 240, 240] as [number, number, number],
  white:      [255, 255, 255] as [number, number, number],
  accent:     [0,   102, 204] as [number, number, number],
  success:    [21,  128, 61]  as [number, number, number],
  danger:     [185, 28,  28]  as [number, number, number],
  warning:    [161, 98,  7]   as [number, number, number],
  rowAlt:     [249, 249, 249] as [number, number, number],
};

const fmt = (n: number) => n.toLocaleString('en-KE', { minimumFractionDigits: 0 });
const fmtDate = (d: string) => {
  try { return format(new Date(d), 'dd MMM yyyy HH:mm'); } catch { return d; }
};

function statusColor(status: string): [number, number, number] {
  if (status === 'success') return BRAND.success;
  if (status === 'failed')  return BRAND.danger;
  return BRAND.midGray;
}

function severityColor(sev: string): [number, number, number] {
  if (sev === 'CRITICAL') return BRAND.danger;
  if (sev === 'HIGH')     return BRAND.warning;
  return BRAND.midGray;
}

// ── Draw branded header ───────────────────────────────────────────────────────
async function drawHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  pageW: number
) {
  // Top black bar
  doc.setFillColor(...BRAND.black);
  doc.rect(0, 0, pageW, 28, 'F');

  // Logo (try to load; fallback to text)
  try {
    const img = new Image();
    img.src = '/fglogo.png';
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej();
    });
    doc.addImage(img, 'PNG', 8, 3, 22, 22);
  } catch {
    doc.setTextColor(...BRAND.white);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('FG', 14, 18);
  }

  // Company name in header bar
  doc.setTextColor(...BRAND.white);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('FAMOUS GATES HOTELS', 36, 12);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Bomet, Kenya  |  famousgateshotelsbmt@gmail.com  |  0706 782 828', 36, 20);

  // Right side: generated date
  doc.setFontSize(7);
  doc.setTextColor(...BRAND.white);
  doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, pageW - 8, 18, { align: 'right' });

  // Title block
  doc.setFillColor(...BRAND.lightGray);
  doc.rect(0, 28, pageW, 18, 'F');
  doc.setTextColor(...BRAND.black);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 8, 40);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BRAND.midGray);
  doc.text(subtitle, pageW - 8, 40, { align: 'right' });

  // Divider
  doc.setDrawColor(...BRAND.black);
  doc.setLineWidth(0.5);
  doc.line(0, 46, pageW, 46);
}

// ── Draw footer on every page ─────────────────────────────────────────────────
function drawFooter(doc: jsPDF, pageW: number, pageH: number, pageNum: number, totalPages: number) {
  doc.setFillColor(...BRAND.black);
  doc.rect(0, pageH - 10, pageW, 10, 'F');
  doc.setTextColor(...BRAND.white);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Famous Gates Hotels — Confidential Audit Record', 8, pageH - 3.5);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageW - 8, pageH - 3.5, { align: 'right' });
}

// ── Main export function ──────────────────────────────────────────────────────
export async function exportAuditLogsPDF(
  logs: LogEntry[],
  category: string,
  filters?: { search?: string; dateFrom?: string; dateTo?: string }
) {
  if (!logs.length) return;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const categoryLabel: Record<string, string> = {
    security: 'Access Control Logs',
    audit:    'Operational Audit Trail',
    finance:  'Financial Reconciliation Logs',
    alerts:   'Security Alert Logs',
  };

  const title = `AUDIT LOGS — ${(categoryLabel[category] || category).toUpperCase()}`;
  const filterParts: string[] = [];
  if (filters?.dateFrom) filterParts.push(`From: ${filters.dateFrom}`);
  if (filters?.dateTo)   filterParts.push(`To: ${filters.dateTo}`);
  if (filters?.search)   filterParts.push(`Search: "${filters.search}"`);
  const subtitle = filterParts.length ? filterParts.join('  |  ') : `All records  |  ${logs.length} entries`;

  await drawHeader(doc, title, subtitle, pageW);

  // ── Summary row ────────────────────────────────────────────────────────────
  const successCount = logs.filter(l => l.status === 'success').length;
  const failedCount  = logs.filter(l => l.status === 'failed').length;
  const criticalCount = logs.filter(l => l.severity === 'CRITICAL').length;

  const summaryY = 50;
  const boxW = (pageW - 16) / 4;
  const summaryItems = [
    { label: 'Total Records', value: String(logs.length), color: BRAND.black },
    { label: 'Successful',    value: String(successCount), color: BRAND.success },
    { label: 'Failed',        value: String(failedCount),  color: BRAND.danger },
    { label: 'Critical',      value: String(criticalCount), color: BRAND.warning },
  ];

  summaryItems.forEach((item, i) => {
    const x = 8 + i * (boxW + 1.3);
    doc.setFillColor(...BRAND.lightGray);
    doc.rect(x, summaryY, boxW, 14, 'F');
    doc.setDrawColor(...BRAND.black);
    doc.setLineWidth(0.3);
    doc.rect(x, summaryY, boxW, 14, 'S');

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...item.color);
    doc.text(item.value, x + boxW / 2, summaryY + 9, { align: 'center' });

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BRAND.midGray);
    doc.text(item.label.toUpperCase(), x + boxW / 2, summaryY + 13.5, { align: 'center' });
  });

  // ── Table ──────────────────────────────────────────────────────────────────
  const tableStartY = summaryY + 18;

  const head = [['#', 'Timestamp', 'Actor', 'Email', 'Action / Message', 'IP Address', 'Method', 'Status', 'Severity']];

  const body = logs.map((log, idx) => [
    String(idx + 1),
    fmtDate(log.created_at),
    log.user ? `${log.user.first_name} ${log.user.last_name}` : 'System',
    log.email || log.user?.email || '—',
    (log.message || log.action || '—').substring(0, 60),
    log.ip_address || '—',
    log.auth_method || '—',
    (log.status || 'info').toUpperCase(),
    (log.severity || 'INFO').toUpperCase(),
  ]);

  autoTable(doc, {
    startY: tableStartY,
    head,
    body,
    margin: { left: 8, right: 8 },
    tableWidth: pageW - 16,
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      lineColor: [210, 210, 210],
      lineWidth: 0.3,
      font: 'helvetica',
      textColor: BRAND.black,
      overflow: 'ellipsize',
    },
    headStyles: {
      fillColor: BRAND.black,
      textColor: BRAND.white,
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left',
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
    },
    alternateRowStyles: {
      fillColor: BRAND.rowAlt,
    },
    columnStyles: {
      0: { cellWidth: 8,  halign: 'center', textColor: BRAND.midGray },  // #
      1: { cellWidth: 32 },                                               // Timestamp
      2: { cellWidth: 32 },                                               // Actor
      3: { cellWidth: 42 },                                               // Email
      4: { cellWidth: 'auto' },                                           // Message (fills remaining)
      5: { cellWidth: 26, font: 'courier', fontSize: 7 },                 // IP
      6: { cellWidth: 18, halign: 'center' },                             // Method
      7: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },          // Status
      8: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },          // Severity
    },
    // Color status and severity cells
    didParseCell(data) {
      if (data.section === 'body') {
        if (data.column.index === 7) {
          const val = String(data.cell.raw || '').toLowerCase();
          data.cell.styles.textColor = statusColor(val);
        }
        if (data.column.index === 8) {
          const val = String(data.cell.raw || '');
          data.cell.styles.textColor = severityColor(val);
        }
      }
    },
    // Draw footer on each page
    didDrawPage(data) {
      const pageNum = (doc as any).internal.getCurrentPageInfo().pageNumber;
      const totalPages = (doc as any).internal.getNumberOfPages();
      drawFooter(doc, pageW, pageH, pageNum, totalPages);
    },
  });

  // Fix footer on first page too (autoTable fires didDrawPage after first page)
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, pageW, pageH, i, totalPages);
  }

  const filename = `FG_AuditLogs_${category}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`;
  doc.save(filename);
}
