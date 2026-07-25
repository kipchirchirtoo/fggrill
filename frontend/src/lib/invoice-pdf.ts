
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from './date-utils';
import { PYTHON_SERVICE_URL } from './config';
import { openBlobForPrint } from './tauri-print';

interface InvoiceItem {
    description?: string;
    item_name?: string;
    quantity: number;
    unit_price: number;
    vat_rate?: number;
    vat_amount?: number;
    total_amount?: number;
    item?: { name: string };
}

interface InvoiceData {
    invoice_number: string;
    customer_name?: string;
    customer?: { name?: string; customer_name?: string; contact_person?: string; phone?: string; address?: string; email?: string };
    invoice_date: string;
    due_date: string;
    status: string;
    total_amount: number;
    vat_amount?: number;
    subtotal?: number;
    paid_amount?: number;
    amount_paid?: number;
    balance_due?: number;
    reference?: string;
    supplier_name?: string;
    other_supplier_name?: string;
    notes?: string;
    items?: any[];
    branch?: {
        name: string;
        address?: string;
        phone?: string;
        email?: string;
    };
}

export const generateInvoicePDF = async (invoice: InvoiceData) => {
    const doc = new jsPDF();
    const margin = 20;
    let cursorY = 20;

    // 1. Logo (with timeout)
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
        doc.addImage(img, 'PNG', margin, cursorY, 30, 30);
    } catch (e) {
        console.warn('Skipping logo:', e);
    }

    // 2. Header Title & Company Contact Details with Website
    doc.setFontSize(22);
    doc.setTextColor(44, 62, 80);
    doc.text('INVOICE', 190, cursorY + 5, { align: 'right' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    cursorY += 15;
    doc.text(invoice.branch?.name || 'FamousGate Hotels', 190, cursorY + 10, { align: 'right' });
    cursorY += 5;
    doc.text(invoice.branch?.address || 'Bomet, Kenya', 190, cursorY + 10, { align: 'right' });
    cursorY += 5;
    doc.text(invoice.branch?.phone || 'Tel: 0706782828', 190, cursorY + 10, { align: 'right' });
    cursorY += 5;
    doc.text(invoice.branch?.email || 'Email: famousgatesbmt@gmail.com', 190, cursorY + 10, { align: 'right' });
    cursorY += 5;
    doc.text('www.famousgatehotels.com', 190, cursorY + 10, { align: 'right' });

    cursorY = 70;
    doc.setDrawColor(200);
    doc.line(margin, cursorY, 190, cursorY);
    cursorY += 10;

    // 3. Billing Details Block
    doc.setFontSize(12);
    doc.setTextColor(44, 62, 80);

    // Dynamic Labeling logic
    let mainLabel = 'CUSTOMER:';
    const contextStr = (invoice.notes || '' + (invoice.reference || '')).toUpperCase();

    if (contextStr.includes('ROOM') || contextStr.includes('BOOKING') || contextStr.includes('GUEST') || (invoice as any).customer_name) {
        mainLabel = 'GUEST:';
    } else if (contextStr.includes('CONFERENCE') || contextStr.includes('MEETING')) {
        mainLabel = 'CONFERENCE:';
    } else if (invoice.supplier_name || (invoice as any).other_supplier_name) {
        mainLabel = 'SUPPLIER:';
    }

    doc.text(mainLabel, margin, cursorY);
    doc.text('INVOICE DETAILS:', 120, cursorY);

    cursorY += 7;
    doc.setFontSize(10);
    doc.setTextColor(0);
    const billingName =
        invoice.customer?.customer_name ||
        invoice.customer?.name ||
        (invoice as any).customer_name ||
        (invoice as any).supplier?.name ||
        (invoice as any).supplier_name ||
        (invoice as any).other_supplier_name ||
        'Client';
    doc.text(billingName, margin, cursorY);
    doc.text(`Invoice #: ${invoice.invoice_number}`, 120, cursorY);

    cursorY += 5;
    const billingPhone = invoice.customer?.phone || (invoice as any).supplier?.phone || '';
    doc.text(billingPhone, margin, cursorY);
    doc.text(`Date: ${formatDate(invoice.invoice_date)}`, 120, cursorY);

    cursorY += 5;
    const billingAddress = invoice.customer?.address || (invoice as any).supplier?.address || '';
    doc.text(billingAddress, margin, cursorY);
    doc.text(`Due Date: ${formatDate(invoice.due_date)}`, 120, cursorY);

    cursorY += 15;

    // 4. Items Table
    const tableData = (invoice.items || []).map(item => {
        const qty = Number(item.quantity) || Number(item.qty) || 0;
        const price = Number(item.unit_price) || Number(item.unitPrice) || Number(item.price) || 0;
        const total = Number(item.total_amount) || Number(item.totalAmount) || Number(item.amount) || (qty * price);

        return [
            item.description || item.item_name || item.item?.name || 'Item',
            qty,
            new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price).replace('KES', 'Ksh'),
            '16%',
            new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(total).replace('KES', 'Ksh')
        ];
    });

    autoTable(doc, {
        startY: cursorY,
        head: [['Description', 'Qty', 'Unit Price (KES)', 'VAT', 'Total Amount']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [44, 62, 80], textColor: 255 },
        margin: { left: margin, right: margin }
    });

    if ((doc as any).lastAutoTable) {
        cursorY = (doc as any).lastAutoTable.finalY + 15;
    } else {
        cursorY += (tableData.length * 10) + 20;
    }

    // 5. Totals Breakdown with Inclusive Tax & Levy Calculations
    const totalLabelX = 100;
    const totalValueX = 190;

    // Inclusive math for VAT (16%), CL (Catering Levy 2.00%), SC (Service Charge 3.00%)
    let totalGross = 0;
    (invoice.items || []).forEach(item => {
        const qty = Number(item.quantity) || Number(item.qty) || 0;
        const price = Number(item.unit_price) || Number(item.unitPrice) || Number(item.price) || 0;
        const lineGross = Number(item.total_amount) || Number(item.totalAmount) || Number(item.amount) || (qty * price);
        totalGross += lineGross;
    });

    if (totalGross === 0 && invoice.total_amount) {
        totalGross = Number(invoice.total_amount);
    }

    const vatRate = 0.16;
    const clRate = 0.02;
    const scRate = 0.03;
    const combinedRate = vatRate + clRate + scRate; // 0.21

    // Net Subtotal = Total Gross / (1 + 0.16 + 0.02 + 0.03)
    const netSubtotal = totalGross / (1 + combinedRate);
    const vatAmount = netSubtotal * vatRate;
    const clAmount = netSubtotal * clRate;
    const scAmount = netSubtotal * scRate;
    const grandTotal = totalGross;

    const paidAmount = Number(invoice.paid_amount) || Number(invoice.amount_paid) || Number((invoice as any).total_paid) || (invoice.status === 'paid' ? grandTotal : 0);
    const balanceDue = Number(invoice.balance_due) ?? Math.max(0, grandTotal - paidAmount);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(val || 0).replace('KES', 'Ksh');
    };

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Subtotal (Excl. Tax & Levies):', totalLabelX, cursorY);
    doc.text(formatCurrency(netSubtotal), totalValueX, cursorY, { align: 'right' });

    cursorY += 7;
    doc.text('VAT Amount (16.00%):', totalLabelX, cursorY);
    doc.text(formatCurrency(vatAmount), totalValueX, cursorY, { align: 'right' });

    cursorY += 7;
    doc.text('Catering Levy (CL 2.00%):', totalLabelX, cursorY);
    doc.text(formatCurrency(clAmount), totalValueX, cursorY, { align: 'right' });

    cursorY += 7;
    doc.text('Service Charge (SC 3.00%):', totalLabelX, cursorY);
    doc.text(formatCurrency(scAmount), totalValueX, cursorY, { align: 'right' });

    cursorY += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('GRAND TOTAL:', totalLabelX, cursorY);
    doc.text(formatCurrency(grandTotal), totalValueX, cursorY, { align: 'right' });

    cursorY += 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(34, 139, 34); // Green for payments
    doc.text('Total Payment Done:', totalLabelX, cursorY);
    doc.text(formatCurrency(paidAmount), totalValueX, cursorY, { align: 'right' });

    cursorY += 7;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(balanceDue > 0 ? 178 : 34, balanceDue > 0 ? 34 : 139, 34);
    doc.text('Balance Due:', totalLabelX, cursorY);
    doc.text(formatCurrency(balanceDue), totalValueX, cursorY, { align: 'right' });

    // 6. Notes
    if (invoice.notes) {
        cursorY += 15;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 62, 80);
        doc.text('Notes / Instructions:', margin, cursorY);
        cursorY += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(invoice.notes, margin, cursorY, { maxWidth: 170 });
    }

    // 7. Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('FamousGate Hotels - Finance System | www.famousgatehotels.com', 105, 285, { align: 'center' });
        doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: 'right' });
    }

    return doc;
};

export const downloadInvoicePDF = async (invoice: InvoiceData) => {
    try {
        const doc = await generateInvoicePDF(invoice);
        const safeId = (invoice.invoice_number || 'Invoice').replace(/[/\\?%*:|"<>]/g, '_');
        doc.save(`Invoice_${safeId}.pdf`);
        return true;
    } catch (error) {
        console.error('Download error:', error);
        throw error;
    }
};

export const printInvoicePDF = async (invoice: InvoiceData) => {
    try {
        const doc = await generateInvoicePDF(invoice);
        doc.autoPrint();
        const blobUrl = doc.output('bloburl') as unknown as string;
        openBlobForPrint(blobUrl);
        return true;
    } catch (error) {
        console.error('Print error:', error);
        throw error;
    }
};
