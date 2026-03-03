
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from './date-utils';
import { PYTHON_SERVICE_URL } from './config';

interface InvoiceItem {
    description?: string;
    item_name?: string;
    quantity: number;
    unit_price: number;
    vat_rate: number;
    vat_amount: number;
    total_amount: number;
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
    vat_amount: number;
    subtotal: number;
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

    doc.setFontSize(22);
    doc.setTextColor(44, 62, 80);
    doc.text('INVOICE', 190, cursorY + 5, { align: 'right' });

    // 2.1 Barcode
    try {
        const barcodeUrl = `${PYTHON_SERVICE_URL}/api/barcode/barcode-image/${invoice.invoice_number}?format=code128&include_text=true`;
        const response = await fetch(barcodeUrl);
        if (response.ok) {
            const blob = await response.blob();
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
            // Position carefully in the header area
            doc.addImage(base64, 'PNG', 140, 30, 50, 15);
        }
    } catch (e) {
        console.error('Failed to load barcode', e);
    }

    doc.setFontSize(10);
    doc.setTextColor(100);
    cursorY += 15;
    doc.text(invoice.branch?.name || 'Kyogong GRILL & LOUNGE', 190, cursorY + 15, { align: 'right' });
    cursorY += 5;
    doc.text(invoice.branch?.address || 'Bomet, Kenya', 190, cursorY + 15, { align: 'right' });
    cursorY += 5;
    doc.text(invoice.branch?.phone || '0706782828', 190, cursorY + 15, { align: 'right' });
    cursorY += 5;
    doc.text(invoice.branch?.email || 'kyogongsbmt@gmail.com', 190, cursorY + 15, { align: 'right' });

    cursorY = 75;
    doc.setDrawColor(200);
    doc.line(margin, cursorY, 190, cursorY);
    cursorY += 10;

    // 3. Billing Details
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
        const vatRate = Number(item.vat_rate) || Number(item.vatRate) || 16;
        const total = Number(item.total_amount) || Number(item.totalAmount) || Number(item.amount) || (qty * price);

        return [
            item.description || item.item_name || item.item?.name || 'Item',
            qty,
            new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price).replace('KES', 'Ksh'),
            `${vatRate}%`,
            new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(total).replace('KES', 'Ksh')
        ];
    });

    autoTable(doc, {
        startY: cursorY,
        head: [['Description', 'Qty', 'Unit Price', 'VAT', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [44, 62, 80], textColor: 255 },
        margin: { left: margin, right: margin }
    });

    cursorY = (doc as any).lastAutoTable.finalY + 15;

    // 5. Totals
    const totalLabelX = 110;
    const totalValueX = 190;

    // Recalculate totals using inclusive logic as requested: 16% is inside the amount
    let totalGross = 0;
    let totalVat = 0;
    let totalNet = 0;

    (invoice.items || []).forEach(item => {
        const qty = Number(item.quantity) || Number(item.qty) || 0;
        const price = Number(item.unit_price) || Number(item.unitPrice) || Number(item.price) || 0;
        const vatRate = Number(item.vat_rate) || Number(item.vatRate) || 16;
        const lineGross = Number(item.total_amount) || Number(item.totalAmount) || Number(item.amount) || (qty * price);

        // Inclusive VAT calculation: Line Net = Total / (1 + VAT Rate / 100)
        const lineNet = lineGross / (1 + (vatRate / 100));
        const lineVat = lineGross - lineNet;

        totalGross += lineGross;
        totalVat += lineVat;
        totalNet += lineNet;
    });

    // Use calculated values to ensure consistency with inclusive logic
    const subtotal = totalNet;
    const vatAmount = totalVat;
    const totalAmount = totalGross;

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(val || 0).replace('KES', 'Ksh');
    };

    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal (Excl. VAT):', totalLabelX, cursorY);
    doc.text(formatCurrency(subtotal), totalValueX, cursorY, { align: 'right' });

    cursorY += 10;
    doc.text('VAT Amount (16%):', totalLabelX, cursorY);
    doc.text(formatCurrency(vatAmount), totalValueX, cursorY, { align: 'right' });

    cursorY += 15;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('GRAND TOTAL:', totalLabelX, cursorY);
    doc.text(formatCurrency(totalAmount), totalValueX, cursorY, { align: 'right' });

    // 6. Notes
    if (invoice.notes) {
        cursorY += 20;
        doc.setFontSize(10);
        doc.text('Notes:', margin, cursorY);
        cursorY += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(invoice.notes, margin, cursorY, { maxWidth: 170 });
    }

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('Kyogong Grill & Lounge - Finance System', 105, 285, { align: 'center' });
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
