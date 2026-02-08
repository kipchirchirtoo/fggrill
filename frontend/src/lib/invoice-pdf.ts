
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface InvoiceItem {
    description: string;
    quantity: number;
    unit_price: number;
    total?: number;
}

interface InvoiceData {
    invoice_number: string;
    customer?: {
        customer_name: string;
        email?: string;
        phone?: string;
        address?: string;
    };
    customer_name?: string; // Fallback for ad-hoc
    customer_email?: string;
    invoice_date: string;
    due_date: string;
    reference_number?: string;
    notes?: string;
    items: InvoiceItem[];
    subtotal?: number;
    tax_amount?: number;
    total_amount: number;
    branch?: {
        name: string;
        address?: string;
        phone?: string;
        email?: string;
    };
}

export const generateInvoicePDF = async (invoice: InvoiceData) => {
    const doc = new jsPDF();

    // Helper for coordinates
    const margin = 20;
    let cursorY = 20;

    // 1. Logo
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

    // 2. Company Info (Right Side)
    doc.setFontSize(20);
    doc.setTextColor(44, 62, 80);
    doc.text('INVOICE', 190, cursorY + 5, { align: 'right' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    cursorY += 15;
    doc.text(invoice.branch?.name || 'FG GRILL & LOUNGE', 190, cursorY, { align: 'right' });
    cursorY += 5;
    doc.text(invoice.branch?.address || 'Bomet, Kenya', 190, cursorY, { align: 'right' });
    cursorY += 5;
    doc.text(invoice.branch?.phone || '0706782828', 190, cursorY, { align: 'right' });
    cursorY += 5;
    doc.text(invoice.branch?.email || 'famousgatesbmt@gmail.com', 190, cursorY, { align: 'right' });

    cursorY = 60;
    doc.setDrawColor(200);
    doc.line(margin, cursorY, 190, cursorY);
    cursorY += 10;

    // 3. Bill To vs Invoice Details
    doc.setFontSize(12);
    doc.setTextColor(44, 62, 80);
    doc.text('BILL TO:', margin, cursorY);
    doc.text('INVOICE DETAILS:', 120, cursorY);

    cursorY += 7;
    doc.setFontSize(10);
    doc.setTextColor(0);
    const customerName = invoice.customer?.customer_name || invoice.customer_name || 'Valued Customer';
    doc.text(customerName, margin, cursorY);
    doc.text(`Invoice #: ${invoice.invoice_number}`, 120, cursorY);

    cursorY += 5;
    doc.text(invoice.customer?.email || invoice.customer_email || '', margin, cursorY);
    doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString()}`, 120, cursorY);

    cursorY += 5;
    doc.text(invoice.customer?.phone || '', margin, cursorY);
    doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, 120, cursorY);

    if (invoice.reference_number) {
        cursorY += 5;
        doc.text(`Ref: ${invoice.reference_number}`, 120, cursorY);
    }

    cursorY += 15;

    // 4. Items Table
    const tableData = (invoice.items || []).map(item => [
        item.description,
        item.quantity,
        new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(item.unit_price),
        new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(item.quantity * item.unit_price)
    ]);

    autoTable(doc, {
        startY: cursorY,
        head: [['Description', 'Qty', 'Unit Price', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [44, 62, 80], textColor: 255 },
        margin: { left: margin, right: margin }
    });

    cursorY = (doc as any).lastAutoTable.finalY + 10;

    // 5. Totals
    const totalLabelX = 140;
    const totalValueX = 190;

    const subtotalText = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(invoice.subtotal ?? invoice.total_amount);
    const taxText = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(invoice.tax_amount ?? 0);

    doc.text('Subtotal:', totalLabelX, cursorY);
    doc.text(subtotalText, totalValueX, cursorY, { align: 'right' });

    cursorY += 7;
    doc.text('Tax (0%):', totalLabelX, cursorY);
    doc.text(taxText, totalValueX, cursorY, { align: 'right' });

    cursorY += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', totalLabelX, cursorY);
    doc.text(new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(invoice.total_amount), totalValueX, cursorY, { align: 'right' });

    // 6. Notes & Footer
    if (invoice.notes) {
        cursorY += 20;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Notes:', margin, cursorY);
        cursorY += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(invoice.notes, margin, cursorY, { maxWidth: 170 });
    }

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('Thank you for your business!', 105, 285, { align: 'center' });
        doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: 'right' });
    }

    return doc;
};

export const downloadInvoicePDF = async (invoice: InvoiceData) => {
    const doc = await generateInvoicePDF(invoice);
    doc.save(`Invoice_${invoice.invoice_number}.pdf`);
};

export const printInvoicePDF = async (invoice: InvoiceData) => {
    const doc = await generateInvoicePDF(invoice);
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
};
