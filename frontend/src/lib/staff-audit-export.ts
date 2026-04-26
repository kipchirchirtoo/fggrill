import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface StaffAuditRecord {
    id: string;
    date: string;
    type: 'Credit Bill' | 'Advance' | 'Loan' | 'Unpaid Bill';
    amount: number;
    staff_name: string;
    staff_id: string;
    staff_code?: string | null;
    staff_department?: string | null;
    staff_role?: string | null;
    description: string;
    status: string;
    reference: string;
    outstanding_amount?: number;
}

interface StaffSummary {
    staff_id: string;
    staff_name: string;
    employee_id?: string | null;
    department?: string | null;
    role?: string | null;
    phone?: string | null;
    total_credit_bills: number;
    total_advances: number;
    total_loans: number;
    total_unpaid_bills?: number;
    outstanding_balance: number;
}

interface ExportOptions {
    startDate: string;
    endDate: string;
    selectedBranch?: string;
    selectedStaff?: string;
    branchName?: string;
    staffName?: string;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' })
        .format(amount)
        .replace('KES', 'Ksh');
};

// PDF Export for Transactions
export const exportTransactionsPDF = async (
    records: StaffAuditRecord[],
    options: ExportOptions
) => {
    const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
    const margin = 20;
    const pageWidth = 297;
    let cursorY = 20;

    // 1. Logo & Header
    try {
        const logoUrl = '/fglogo.png';
        const img = new Image();
        img.src = logoUrl;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });
        doc.addImage(img, 'PNG', margin, cursorY, 30, 30);
    } catch (e) {
        console.error('Failed to load logo', e);
    }

    // Title
    doc.setFontSize(22);
    doc.setTextColor(44, 62, 80);
    doc.text('STAFF AUDIT REPORT', pageWidth - margin, cursorY + 10, { align: 'right' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('FamousGate Hotels', pageWidth - margin, cursorY + 20, { align: 'right' });
    doc.text('Bomet, Kenya', pageWidth - margin, cursorY + 25, { align: 'right' });
    doc.text('0706782828', pageWidth - margin, cursorY + 30, { align: 'right' });

    cursorY = 60;
    doc.setDrawColor(200);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 10;

    // 2. Report Details
    doc.setFontSize(10);
    doc.setTextColor(44, 62, 80);
    doc.text('REPORT DETAILS:', margin, cursorY);
    cursorY += 7;

    doc.setTextColor(0);
    doc.text(`Report Type: Staff Financial Transactions`, margin, cursorY);
    cursorY += 5;
    doc.text(`Period: ${format(new Date(options.startDate), 'MMM d, yyyy')} - ${format(new Date(options.endDate), 'MMM d, yyyy')}`, margin, cursorY);
    cursorY += 5;
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}`, margin, cursorY);
    cursorY += 5;

    if (options.branchName && options.branchName !== 'All Branches') {
        doc.text(`Branch: ${options.branchName}`, margin, cursorY);
        cursorY += 5;
    }

    if (options.staffName && options.staffName !== 'All Staff') {
        doc.text(`Staff Member: ${options.staffName}`, margin, cursorY);
        cursorY += 5;
    }

    cursorY += 10;

    // 3. Summary Stats
    const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);
    const creditBills = records.filter(r => r.type === 'Credit Bill');
    const advances = records.filter(r => r.type === 'Advance');
    const loans = records.filter(r => r.type === 'Loan');
    const unpaidBills = records.filter(r => r.type === 'Unpaid Bill');
    const totalOutstanding = records.reduce((sum, r) => sum + (r.outstanding_amount || 0), 0);

    doc.setFillColor(245, 245, 247);
    doc.rect(margin, cursorY, pageWidth - (2 * margin), 32, 'F');

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('Total Transactions:', margin + 10, cursorY + 7);
    doc.text('Credit Bills:', margin + 10, cursorY + 14);
    doc.text('Advances:', margin + 10, cursorY + 21);
    doc.text('Unpaid Bills:', margin + 10, cursorY + 28);

    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text(`${records.length}`, margin + 60, cursorY + 7);
    doc.text(`${creditBills.length} (${formatCurrency(creditBills.reduce((s, r) => s + r.amount, 0))})`, margin + 60, cursorY + 14);
    doc.text(`${advances.length} (${formatCurrency(advances.reduce((s, r) => s + r.amount, 0))})`, margin + 60, cursorY + 21);
    doc.text(`${unpaidBills.length} (${formatCurrency(unpaidBills.reduce((s, r) => s + r.amount, 0))})`, margin + 60, cursorY + 28);

    doc.text('Loans:', margin + 145, cursorY + 7);
    doc.text('Total Amount:', margin + 145, cursorY + 14);
    doc.text('Outstanding:', margin + 145, cursorY + 21);

    doc.text(`${loans.length} (${formatCurrency(loans.reduce((s, r) => s + r.amount, 0))})`, margin + 185, cursorY + 7);
    doc.text(formatCurrency(totalAmount), margin + 185, cursorY + 14);
    doc.text(formatCurrency(totalOutstanding), margin + 185, cursorY + 21);

    doc.setFont('helvetica', 'normal');
    cursorY += 42;

    // 4. Transactions Table
    const tableData = records.map(record => [
        format(new Date(record.date), 'MMM d, yyyy'),
        record.staff_code || '—',
        record.staff_department || '—',
        record.reference,
        record.type,
        record.staff_name,
        record.description.length > 60 ? record.description.substring(0, 57) + '...' : record.description,
        formatCurrency(record.amount),
        formatCurrency(record.outstanding_amount || 0),
        record.status
    ]);

    autoTable(doc, {
        startY: cursorY,
        head: [['Date', 'Emp ID', 'Department', 'Ref', 'Type', 'Staff', 'Description', 'Amount', 'Outstanding', 'Status']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [44, 62, 80], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 22 },
            2: { cellWidth: 28 },
            3: { cellWidth: 20 },
            4: { cellWidth: 25 },
            5: { cellWidth: 35 },
            6: { cellWidth: 45 },
            7: { cellWidth: 20, halign: 'right' },
            8: { cellWidth: 20, halign: 'right' },
            9: { cellWidth: 20, halign: 'center' }
        },
        margin: { left: margin, right: margin }
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('FamousGate Hotels - Staff Audit System', pageWidth / 2, 200, { align: 'center' });
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, 200, { align: 'right' });
    }

    return doc;
};

// PDF Export for Summary
export const exportSummaryPDF = async (
    summary: StaffSummary[],
    options: ExportOptions
) => {
    const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
    const margin = 20;
    const pageWidth = 297;
    let cursorY = 20;

    // 1. Logo & Header
    try {
        const logoUrl = '/fglogo.png';
        const img = new Image();
        img.src = logoUrl;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });
        doc.addImage(img, 'PNG', margin, cursorY, 30, 30);
    } catch (e) {
        console.error('Failed to load logo', e);
    }

    // Title
    doc.setFontSize(22);
    doc.setTextColor(44, 62, 80);
    doc.text('STAFF FINANCIAL SUMMARY', pageWidth - margin, cursorY + 10, { align: 'right' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('FamousGate Hotels', pageWidth - margin, cursorY + 20, { align: 'right' });
    doc.text('Bomet, Kenya', pageWidth - margin, cursorY + 25, { align: 'right' });
    doc.text('0706782828', pageWidth - margin, cursorY + 30, { align: 'right' });

    cursorY = 60;
    doc.setDrawColor(200);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 10;

    // 2. Report Details
    doc.setFontSize(10);
    doc.setTextColor(44, 62, 80);
    doc.text('REPORT DETAILS:', margin, cursorY);
    cursorY += 7;

    doc.setTextColor(0);
    doc.text(`Report Type: Staff Financial Summary`, margin, cursorY);
    cursorY += 5;
    doc.text(`Period: ${format(new Date(options.startDate), 'MMM d, yyyy')} - ${format(new Date(options.endDate), 'MMM d, yyyy')}`, margin, cursorY);
    cursorY += 5;
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}`, margin, cursorY);
    cursorY += 10;

    // 3. Overall Summary
    const totalCreditBills = summary.reduce((sum, s) => sum + s.total_credit_bills, 0);
    const totalAdvances = summary.reduce((sum, s) => sum + s.total_advances, 0);
    const totalLoans = summary.reduce((sum, s) => sum + s.total_loans, 0);
    const totalUnpaidBills = summary.reduce((sum, s) => sum + (s.total_unpaid_bills || 0), 0);
    const totalOutstanding = summary.reduce((sum, s) => sum + s.outstanding_balance, 0);
    const totalExposure = totalCreditBills + totalAdvances + totalLoans + totalUnpaidBills;

    doc.setFillColor(245, 245, 247);
    doc.rect(margin, cursorY, pageWidth - (2 * margin), 35, 'F');

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('Total Staff Members:', margin + 10, cursorY + 7);
    doc.text('Total Credit Bills:', margin + 10, cursorY + 14);
    doc.text('Total Advances:', margin + 10, cursorY + 21);
    doc.text('Total Loans:', margin + 10, cursorY + 28);
    doc.text('Total Unpaid Bills:', margin + 10, cursorY + 35);

    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text(`${summary.length}`, margin + 60, cursorY + 7);
    doc.text(formatCurrency(totalCreditBills), margin + 60, cursorY + 14);
    doc.text(formatCurrency(totalAdvances), margin + 60, cursorY + 21);
    doc.text(formatCurrency(totalLoans), margin + 60, cursorY + 28);
    doc.text(formatCurrency(totalUnpaidBills), margin + 60, cursorY + 35);

    doc.text('Total Outstanding:', margin + 145, cursorY + 7);
    doc.text('Total Exposure:', margin + 145, cursorY + 14);

    doc.text(formatCurrency(totalOutstanding), margin + 185, cursorY + 7);
    doc.text(formatCurrency(totalExposure), margin + 185, cursorY + 14);

    doc.setFont('helvetica', 'normal');
    cursorY += 45;

    // 4. Summary Table
    const tableData = summary.map(item => [
        item.staff_name,
        item.employee_id || '—',
        item.department || '—',
        item.role || '—',
        formatCurrency(item.total_credit_bills),
        formatCurrency(item.total_advances),
        formatCurrency(item.total_loans),
        formatCurrency(item.total_unpaid_bills || 0),
        formatCurrency(item.outstanding_balance),
        formatCurrency(item.total_credit_bills + item.total_advances + item.total_loans + (item.total_unpaid_bills || 0))
    ]);

    autoTable(doc, {
        startY: cursorY,
        head: [['Staff Member', 'Emp ID', 'Department', 'Role', 'Credit Bills', 'Advances', 'Loans', 'Unpaid Bills', 'Outstanding', 'Total Exposure']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [44, 62, 80], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 22 },
            2: { cellWidth: 28 },
            3: { cellWidth: 25 },
            4: { cellWidth: 24, halign: 'right' },
            5: { cellWidth: 22, halign: 'right' },
            6: { cellWidth: 22, halign: 'right' },
            7: { cellWidth: 24, halign: 'right' },
            8: { cellWidth: 24, halign: 'right' },
            9: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: margin, right: margin }
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('FamousGate Hotels - Staff Audit System', pageWidth / 2, 200, { align: 'center' });
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, 200, { align: 'right' });
    }

    return doc;
};

// CSV Export for Transactions
export const exportTransactionsCSV = (records: StaffAuditRecord[]) => {
    const headers = ['Date', 'Reference', 'Type', 'Staff Member', 'Description', 'Amount', 'Status'];
    const csvData = records.map(record => [
        format(new Date(record.date), 'yyyy-MM-dd'),
        record.reference,
        record.type,
        record.staff_name,
        record.description,
        record.amount.toFixed(2),
        record.status
    ]);

    const csvContent = [
        headers.join(','),
        ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
};

// CSV Export for Summary
export const exportSummaryCSV = (summary: StaffSummary[]) => {
    const headers = ['Staff Member', 'Credit Bills', 'Advances', 'Loans', 'Outstanding Balance', 'Total Exposure'];
    const csvData = summary.map(item => [
        item.staff_name,
        item.total_credit_bills.toFixed(2),
        item.total_advances.toFixed(2),
        item.total_loans.toFixed(2),
        item.outstanding_balance.toFixed(2),
        (item.total_credit_bills + item.total_advances + item.total_loans).toFixed(2)
    ]);

    const csvContent = [
        headers.join(','),
        ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
};

// Download helper
export const downloadFile = (content: string | Blob, filename: string, type: 'csv' | 'pdf') => {
    const blob = type === 'csv' 
        ? new Blob([content as string], { type: 'text/csv;charset=utf-8;' })
        : content as Blob;
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
