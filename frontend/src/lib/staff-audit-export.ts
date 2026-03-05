import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface StaffAuditRecord {
    id: string;
    date: string;
    type: 'Credit Bill' | 'Advance' | 'Loan';
    amount: number;
    staff_name: string;
    staff_id: string;
    description: string;
    status: string;
    reference: string;
}

interface StaffSummary {
    staff_id: string;
    staff_name: string;
    total_credit_bills: number;
    total_advances: number;
    total_loans: number;
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
    const doc = new jsPDF();
    const margin = 20;
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
    doc.text('STAFF AUDIT REPORT', 190, cursorY + 10, { align: 'right' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('FamousGate Hotels', 190, cursorY + 20, { align: 'right' });
    doc.text('Bomet, Kenya', 190, cursorY + 25, { align: 'right' });
    doc.text('0706782828', 190, cursorY + 30, { align: 'right' });

    cursorY = 60;
    doc.setDrawColor(200);
    doc.line(margin, cursorY, 190, cursorY);
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

    doc.setFillColor(245, 245, 247);
    doc.rect(margin, cursorY, 170, 25, 'F');

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('Total Transactions:', margin + 5, cursorY + 7);
    doc.text('Credit Bills:', margin + 5, cursorY + 14);
    doc.text('Advances:', margin + 5, cursorY + 21);

    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text(`${records.length}`, margin + 50, cursorY + 7);
    doc.text(`${creditBills.length} (${formatCurrency(creditBills.reduce((s, r) => s + r.amount, 0))})`, margin + 50, cursorY + 14);
    doc.text(`${advances.length} (${formatCurrency(advances.reduce((s, r) => s + r.amount, 0))})`, margin + 50, cursorY + 21);

    doc.text('Loans:', margin + 105, cursorY + 7);
    doc.text('Total Amount:', margin + 105, cursorY + 14);

    doc.text(`${loans.length} (${formatCurrency(loans.reduce((s, r) => s + r.amount, 0))})`, margin + 130, cursorY + 7);
    doc.text(formatCurrency(totalAmount), margin + 130, cursorY + 14);

    doc.setFont('helvetica', 'normal');
    cursorY += 35;

    // 4. Transactions Table
    const tableData = records.map(record => [
        format(new Date(record.date), 'MMM d, yyyy'),
        record.reference,
        record.type,
        record.staff_name,
        record.description.length > 40 ? record.description.substring(0, 37) + '...' : record.description,
        formatCurrency(record.amount),
        record.status
    ]);

    autoTable(doc, {
        startY: cursorY,
        head: [['Date', 'Ref', 'Type', 'Staff', 'Description', 'Amount', 'Status']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [44, 62, 80], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 18 },
            2: { cellWidth: 20 },
            3: { cellWidth: 30 },
            4: { cellWidth: 40 },
            5: { cellWidth: 22, halign: 'right' },
            6: { cellWidth: 18, halign: 'center' }
        },
        margin: { left: margin, right: margin }
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('FamousGate Hotels - Staff Audit System', 105, 285, { align: 'center' });
        doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: 'right' });
    }

    return doc;
};

// PDF Export for Summary
export const exportSummaryPDF = async (
    summary: StaffSummary[],
    options: ExportOptions
) => {
    const doc = new jsPDF();
    const margin = 20;
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
    doc.text('STAFF FINANCIAL SUMMARY', 190, cursorY + 10, { align: 'right' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('FamousGate Hotels', 190, cursorY + 20, { align: 'right' });
    doc.text('Bomet, Kenya', 190, cursorY + 25, { align: 'right' });
    doc.text('0706782828', 190, cursorY + 30, { align: 'right' });

    cursorY = 60;
    doc.setDrawColor(200);
    doc.line(margin, cursorY, 190, cursorY);
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
    const totalOutstanding = summary.reduce((sum, s) => sum + s.outstanding_balance, 0);
    const totalExposure = totalCreditBills + totalAdvances + totalLoans;

    doc.setFillColor(245, 245, 247);
    doc.rect(margin, cursorY, 170, 30, 'F');

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('Total Staff Members:', margin + 5, cursorY + 7);
    doc.text('Total Credit Bills:', margin + 5, cursorY + 14);
    doc.text('Total Advances:', margin + 5, cursorY + 21);
    doc.text('Total Loans:', margin + 5, cursorY + 28);

    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text(`${summary.length}`, margin + 50, cursorY + 7);
    doc.text(formatCurrency(totalCreditBills), margin + 50, cursorY + 14);
    doc.text(formatCurrency(totalAdvances), margin + 50, cursorY + 21);
    doc.text(formatCurrency(totalLoans), margin + 50, cursorY + 28);

    doc.text('Total Outstanding:', margin + 105, cursorY + 7);
    doc.text('Total Exposure:', margin + 105, cursorY + 14);

    doc.text(formatCurrency(totalOutstanding), margin + 145, cursorY + 7);
    doc.text(formatCurrency(totalExposure), margin + 145, cursorY + 14);

    doc.setFont('helvetica', 'normal');
    cursorY += 40;

    // 4. Summary Table
    const tableData = summary.map(item => [
        item.staff_name,
        formatCurrency(item.total_credit_bills),
        formatCurrency(item.total_advances),
        formatCurrency(item.total_loans),
        formatCurrency(item.outstanding_balance),
        formatCurrency(item.total_credit_bills + item.total_advances + item.total_loans)
    ]);

    autoTable(doc, {
        startY: cursorY,
        head: [['Staff Member', 'Credit Bills', 'Advances', 'Loans', 'Outstanding', 'Total Exposure']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [44, 62, 80], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 25, halign: 'right' },
            2: { cellWidth: 25, halign: 'right' },
            3: { cellWidth: 25, halign: 'right' },
            4: { cellWidth: 25, halign: 'right' },
            5: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: margin, right: margin }
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('FamousGate Hotels - Staff Audit System', 105, 285, { align: 'center' });
        doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: 'right' });
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
