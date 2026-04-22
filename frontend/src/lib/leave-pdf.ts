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

export const generateLeavePDF = async (
  leaveRequests: LeaveRequest[],
  metadata: PDFMetadata
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let cursorY = 20;

  // Brand Colors
  const brandPrimary = [139, 69, 19]; // Saddle Brown
  const brandSecondary = [218, 165, 32]; // Goldenrod
  const brandDark = [44, 62, 80]; // Dark Blue-Gray
  const brandLight = [245, 245, 220]; // Beige

  // ===== HEADER SECTION WITH BRAND BANNER =====
  doc.setFillColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  doc.setFillColor(brandSecondary[0], brandSecondary[1], brandSecondary[2]);
  doc.rect(0, 45, pageWidth, 3, 'F');

  // Logo
  try {
    const logoUrl = '/fglogo.png';
    const img = new Image();
    img.src = logoUrl;
    await Promise.race([
      new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Logo timeout')), 3000))
    ]);
    doc.addImage(img, 'PNG', margin, 8, 35, 35);
  } catch (e) {
    console.warn('Logo not loaded, using text branding:', e);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('FG', margin + 10, 28);
  }

  // Company name and report title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('FAMOUSGATE HOTELS', pageWidth - margin, 18, { align: 'right' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Leave Management Report', pageWidth - margin, 28, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setTextColor(brandSecondary[0], brandSecondary[1], brandSecondary[2]);
  doc.text('Excellence in Hospitality', pageWidth - margin, 36, { align: 'right' });

  cursorY = 58;

  // Report metadata box
  doc.setFillColor(brandLight[0], brandLight[1], brandLight[2]);
  doc.roundedRect(margin, cursorY, pageWidth - 2 * margin, 32, 3, 3, 'F');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
  
  doc.text('Branch:', margin + 5, cursorY + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(metadata.branchName, margin + 25, cursorY + 8);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Report Type:', margin + 5, cursorY + 16);
  doc.setFont('helvetica', 'normal');
  const reportTypeLabel = metadata.filterType === 'active' ? 'Active Leaves' : 
                          metadata.filterType === 'history' ? 'Leave History' : 'All Leaves';
  doc.text(reportTypeLabel, margin + 35, cursorY + 16);
  
  if (metadata.dateRange) {
    doc.setFont('helvetica', 'bold');
    doc.text('Period:', margin + 5, cursorY + 24);
    doc.setFont('helvetica', 'normal');
    doc.text(`${format(new Date(metadata.dateRange.start), 'MMM dd, yyyy')} to ${format(new Date(metadata.dateRange.end), 'MMM dd, yyyy')}`, margin + 25, cursorY + 24);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.text('Generated:', margin + 5, cursorY + 24);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' }), margin + 30, cursorY + 24);
  }

  cursorY = 100;

  // ===== SUMMARY STATISTICS =====
  const stats = {
    total: leaveRequests.length,
    pending: leaveRequests.filter(r => r.status === 'pending').length,
    approved: leaveRequests.filter(r => r.status === 'approved').length,
    rejected: leaveRequests.filter(r => r.status === 'rejected').length,
    returned: leaveRequests.filter(r => r.reported_to_duty).length
  };

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
  doc.text('SUMMARY STATISTICS', margin, cursorY);
  
  doc.setDrawColor(brandSecondary[0], brandSecondary[1], brandSecondary[2]);
  doc.setLineWidth(1);
  doc.line(margin, cursorY + 2, margin + 60, cursorY + 2);
  cursorY += 12;

  // Stats cards
  const cardWidth = (pageWidth - 2 * margin - 15) / 4;
  const cardHeight = 24;
  const cardSpacing = 5;

  // Card 1: Total
  doc.setFillColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
  doc.roundedRect(margin, cursorY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(brandSecondary[0], brandSecondary[1], brandSecondary[2]);
  doc.text('TOTAL', margin + cardWidth / 2, cursorY + 7, { align: 'center' });
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(stats.total.toString(), margin + cardWidth / 2, cursorY + 17, { align: 'center' });

  // Card 2: Pending
  doc.setFillColor(218, 165, 32);
  doc.roundedRect(margin + cardWidth + cardSpacing, cursorY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(139, 69, 19);
  doc.text('PENDING', margin + cardWidth + cardSpacing + cardWidth / 2, cursorY + 7, { align: 'center' });
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(stats.pending.toString(), margin + cardWidth + cardSpacing + cardWidth / 2, cursorY + 17, { align: 'center' });

  // Card 3: Approved
  doc.setFillColor(34, 197, 94);
  doc.roundedRect(margin + 2 * (cardWidth + cardSpacing), cursorY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(22, 101, 52);
  doc.text('APPROVED', margin + 2 * (cardWidth + cardSpacing) + cardWidth / 2, cursorY + 7, { align: 'center' });
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(stats.approved.toString(), margin + 2 * (cardWidth + cardSpacing) + cardWidth / 2, cursorY + 17, { align: 'center' });

  // Card 4: Returned
  doc.setFillColor(59, 130, 246);
  doc.roundedRect(margin + 3 * (cardWidth + cardSpacing), cursorY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 64, 175);
  doc.text('RETURNED', margin + 3 * (cardWidth + cardSpacing) + cardWidth / 2, cursorY + 7, { align: 'center' });
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(stats.returned.toString(), margin + 3 * (cardWidth + cardSpacing) + cardWidth / 2, cursorY + 17, { align: 'center' });

  cursorY += cardHeight + 20;

  // ===== LEAVE REQUESTS TABLE =====
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
  doc.text('LEAVE REQUESTS', margin, cursorY);
  
  doc.setDrawColor(brandSecondary[0], brandSecondary[1], brandSecondary[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, cursorY + 2, margin + 55, cursorY + 2);
  cursorY += 8;

  const tableData = leaveRequests.map((req) => [
    `${req.staff?.first_name || ''} ${req.staff?.last_name || ''}`,
    LEAVE_TYPE_LABELS[req.leave_type] || req.leave_type,
    `${format(new Date(req.start_date), 'MMM dd, yyyy')} - ${format(new Date(req.end_date), 'MMM dd, yyyy')}`,
    `${calculateDays(req.start_date, req.end_date)}d`,
    req.status.toUpperCase(),
    req.reported_to_duty ? 'Yes' : 'No'
  ]);

  autoTable(doc, {
    startY: cursorY,
    head: [['Employee', 'Type', 'Period', 'Days', 'Status', 'Returned']],
    body: tableData,
    theme: 'grid',
    headStyles: { 
      fillColor: brandPrimary,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: brandDark
    },
    alternateRowStyles: {
      fillColor: [250, 250, 245]
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 40 },
      1: { halign: 'left', cellWidth: 30 },
      2: { halign: 'left', cellWidth: 50 },
      3: { halign: 'center', cellWidth: 15 },
      4: { halign: 'center', cellWidth: 25 },
      5: { halign: 'center', cellWidth: 20 }
    },
    margin: { left: margin, right: margin }
  });

  // ===== BRANDED FOOTER ON ALL PAGES =====
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Footer background
    doc.setFillColor(brandLight[0], brandLight[1], brandLight[2]);
    doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
    
    // Footer text
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
    doc.text('FamousGate Hotels | Excellence in Hospitality', pageWidth / 2, pageHeight - 7, { align: 'center' });
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
    
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('Confidential - For Internal Use Only', margin, pageHeight - 7);
  }

  return doc;
};

export const downloadLeavePDF = async (
  leaveRequests: LeaveRequest[],
  metadata: PDFMetadata
) => {
  try {
    const doc = await generateLeavePDF(leaveRequests, metadata);
    const fileName = `Leave_Report_${metadata.branchName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    doc.save(fileName);
    return true;
  } catch (error) {
    console.error('PDF generation error:', error);
    throw error;
  }
};
