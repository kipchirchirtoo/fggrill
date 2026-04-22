import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface LeaveRequest {
  id: string;
  staff?: {
    first_name: string;
    last_name: string;
    id_number?: string;
    department?: string;
  };
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  reason?: string;
  created_at: string;
  reported_to_duty?: boolean;
  actual_return_date?: string;
}

interface PDFMetadata {
  branchName: string;
  dateRange?: {
    start: string;
    end: string;
  };
  filterType: 'active' | 'history' | 'all';
  generatedBy: string;
}

// ── Brand constants ───────────────────────────────────────────────────────────
const BRAND = {
  black:      [26,  26,  26]  as [number, number, number],
  darkGray:   [55,  55,  55]  as [number, number, number],
  midGray:    [120, 120, 120] as [number, number, number],
  lightGray:  [240, 240, 240] as [number, number, number],
  white:      [255, 255, 255] as [number, number, number],
  gold:       [212, 175, 55]  as [number, number, number],
  success:    [22,  163, 74]  as [number, number, number],
  danger:     [239, 68,  68]  as [number, number, number],
  warning:    [251, 191, 36]  as [number, number, number],
  info:       [59,  130, 246] as [number, number, number],
  rowAlt:     [249, 249, 249] as [number, number, number],
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: 'Annual Leave',
  sick: 'Sick Leave',
  maternity: 'Maternity Leave',
  paternity: 'Paternity Leave',
  unpaid: 'Unpaid Leave',
  other: 'Other'
};

const calculateDays = (start: string, end: string) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

function statusColor(status: string): [number, number, number] {
  if (status === 'approved') return BRAND.success;
  if (status === 'rejected') return BRAND.danger;
  if (status === 'pending')  return BRAND.warning;
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
      setTimeout(() => rej(new Error('timeout')), 2000);
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

  // Gold divider
  doc.setDrawColor(...BRAND.gold);
  doc.setLineWidth(1.2);
  doc.line(0, 46, pageW, 46);
}

// ── Draw footer on every page ─────────────────────────────────────────────────
function drawFooter(doc: jsPDF, pageW: number, pageH: number, pageNum: number, totalPages: number) {
  doc.setDrawColor(...BRAND.gold);
  doc.setLineWidth(0.5);
  doc.line(8, pageH - 12, pageW - 8, pageH - 12);
  
  doc.setFillColor(...BRAND.black);
  doc.rect(0, pageH - 10, pageW, 10, 'F');
  
  doc.setTextColor(...BRAND.white);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Famous Gates Hotels — Confidential Leave Management Record', 8, pageH - 3.5);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageW - 8, pageH - 3.5, { align: 'right' });
}

export const generateLeavePDF = async (
  leaveRequests: LeaveRequest[],
  metadata: PDFMetadata
) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const reportTypeLabel = metadata.filterType === 'active' ? 'Active Leaves' : 
                          metadata.filterType === 'history' ? 'Leave History' : 'All Leaves';

  const title = `LEAVE MANAGEMENT — ${reportTypeLabel.toUpperCase()}`;
  const filterParts: string[] = [];
  filterParts.push(`Branch: ${metadata.branchName}`);
  if (metadata.dateRange) {
    filterParts.push(`Period: ${format(new Date(metadata.dateRange.start), 'dd MMM yyyy')} - ${format(new Date(metadata.dateRange.end), 'dd MMM yyyy')}`);
  }
  filterParts.push(`${leaveRequests.length} records`);
  const subtitle = filterParts.join('  |  ');

  await drawHeader(doc, title, subtitle, pageW);

  // ── Summary statistics ────────────────────────────────────────────────────────
  const stats = {
    total: leaveRequests.length,
    pending: leaveRequests.filter(r => r.status === 'pending').length,
    approved: leaveRequests.filter(r => r.status === 'approved').length,
    rejected: leaveRequests.filter(r => r.status === 'rejected').length,
    returned: leaveRequests.filter(r => r.reported_to_duty).length
  };

  const summaryY = 50;
  const boxW = (pageW - 16) / 5;
  const summaryItems = [
    { label: 'Total Leaves', value: String(stats.total), color: BRAND.black },
    { label: 'Pending',      value: String(stats.pending), color: BRAND.warning },
    { label: 'Approved',     value: String(stats.approved), color: BRAND.success },
    { label: 'Rejected',     value: String(stats.rejected), color: BRAND.danger },
    { label: 'Returned',     value: String(stats.returned), color: BRAND.info },
  ];

  summaryItems.forEach((item, i) => {
    const x = 8 + i * (boxW + 1.3);
    doc.setFillColor(...BRAND.lightGray);
    doc.rect(x, summaryY, boxW, 14, 'F');
    doc.setDrawColor(...BRAND.black);
    doc.setLineWidth(0.3);
    doc.rect(x, summaryY, boxW, 14, 'S');

    // Gold accent bar
    doc.setFillColor(...BRAND.gold);
    doc.rect(x, summaryY, 3, 14, 'F');

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

  const head = [['#', 'Employee', 'ID Number', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Status', 'Returned']];

  const body = leaveRequests.map((req, idx) => [
    String(idx + 1),
    `${req.staff?.first_name || ''} ${req.staff?.last_name || ''}`.trim() || '—',
    req.staff?.id_number || '—',
    LEAVE_TYPE_LABELS[req.leave_type] || req.leave_type,
    format(new Date(req.start_date), 'dd MMM yyyy'),
    format(new Date(req.end_date), 'dd MMM yyyy'),
    `${calculateDays(req.start_date, req.end_date)}d`,
    req.status.toUpperCase(),
    req.reported_to_duty ? 'Yes' : 'No',
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
      1: { cellWidth: 42 },                                               // Employee
      2: { cellWidth: 28, font: 'courier', fontSize: 7 },                // ID Number
      3: { cellWidth: 32 },                                               // Leave Type
      4: { cellWidth: 28 },                                               // Start Date
      5: { cellWidth: 28 },                                               // End Date
      6: { cellWidth: 16, halign: 'center' },                            // Days
      7: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },         // Status
      8: { cellWidth: 20, halign: 'center' },                            // Returned
    },
    // Color status cells
    didParseCell(data) {
      if (data.section === 'body') {
        if (data.column.index === 7) {
          const val = String(data.cell.raw || '').toLowerCase();
          data.cell.styles.textColor = statusColor(val);
        }
        if (data.column.index === 8) {
          const val = String(data.cell.raw || '');
          if (val === 'Yes') {
            data.cell.styles.textColor = BRAND.success;
            data.cell.styles.fontStyle = 'bold';
          }
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

  // Fix footer on first page too
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, pageW, pageH, i, totalPages);
  }

  return doc;
};

export const downloadLeavePDF = async (
  leaveRequests: LeaveRequest[],
  metadata: PDFMetadata
) => {
  try {
    const doc = await generateLeavePDF(leaveRequests, metadata);
    const fileName = `FG_LeaveReport_${metadata.branchName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`;
    doc.save(fileName);
    return true;
  } catch (error) {
    console.error('PDF generation error:', error);
    throw error;
  }
};
