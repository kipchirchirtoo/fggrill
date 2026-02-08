
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface POItem {
    item?: { name: string };
    item_id?: number | string;
    quantity: number;
    unit_price: number;
    total?: number;
}

interface PurchaseOrderData {
    po_number: string;
    supplier?: {
        name: string;
        contact_person?: string;
        phone?: string;
        address?: string;
    };
    created_at: string;
    expected_delivery?: string;
    notes?: string;
    items: POItem[];
    total_amount: number;
    tax_amount?: number;
    subtotal?: number;
    branch?: {
        name: string;
        address?: string;
        phone?: string;
        email?: string;
    };
}

export const generatePurchaseOrderPDF = async (po: PurchaseOrderData) => {
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

    // 2. Company Info (Our info - Right Side)
    doc.setFontSize(20);
    doc.setTextColor(44, 62, 80);
    doc.text('PURCHASE ORDER', 190, cursorY + 5, { align: 'right' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    cursorY += 15;
    doc.text(po.branch?.name || 'FAMOUS GATE GRILL & LOUNGE', 190, cursorY, { align: 'right' });
    cursorY += 5;
    doc.text(po.branch?.address || 'Bomet, Kenya', 190, cursorY, { align: 'right' });
    cursorY += 5;
    doc.text(po.branch?.phone || '0706782828', 190, cursorY, { align: 'right' });
    cursorY += 5;
    doc.text(po.branch?.email || 'famousgatesbmt@gmail.com', 190, cursorY, { align: 'right' });

    cursorY = 60;
    doc.setDrawColor(200);
    doc.line(margin, cursorY, 190, cursorY);
    cursorY += 10;

    // 3. VENDOR vs PO DETAILS
    doc.setFontSize(12);
    doc.setTextColor(44, 62, 80);
    doc.text('VENDOR / SUPPLIER:', margin, cursorY);
    doc.text('PO DETAILS:', 120, cursorY);

    cursorY += 7;
    doc.setFontSize(10);
    doc.setTextColor(0);
    const supplierName = po.supplier?.name || 'Local Supplier';
    doc.text(supplierName, margin, cursorY);
    doc.text(`PO Number: ${po.po_number}`, 120, cursorY);

    cursorY += 5;
    doc.text(po.supplier?.contact_person || '', margin, cursorY);
    doc.text(`Date: ${new Date(po.created_at).toLocaleDateString()}`, 120, cursorY);

    cursorY += 5;
    doc.text(po.supplier?.phone || '', margin, cursorY);
    if (po.expected_delivery) {
        doc.text(`Expected Delivery: ${new Date(po.expected_delivery).toLocaleDateString()}`, 120, cursorY);
    }

    cursorY += 15;

    // 4. Items Table
    const tableData = (po.items || []).map(item => [
        item.item?.name || `Item #${item.item_id}`,
        item.quantity,
        new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(item.unit_price),
        new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(item.quantity * item.unit_price)
    ]);

    autoTable(doc, {
        startY: cursorY,
        head: [['Item Description', 'Qty', 'Unit Price', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [44, 62, 80], textColor: 255 },
        margin: { left: margin, right: margin }
    });

    cursorY = (doc as any).lastAutoTable.finalY + 10;

    // 5. Totals
    const totalLabelX = 140;
    const totalValueX = 190;

    const subtotal = po.subtotal || po.total_amount;
    const tax = po.tax_amount || 0;

    doc.text('Subtotal:', totalLabelX, cursorY);
    doc.text(new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(subtotal), totalValueX, cursorY, { align: 'right' });

    cursorY += 7;
    doc.text('Tax:', totalLabelX, cursorY);
    doc.text(new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(tax), totalValueX, cursorY, { align: 'right' });

    cursorY += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('GRAND TOTAL:', totalLabelX, cursorY);
    doc.text(new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(po.total_amount), totalValueX, cursorY, { align: 'right' });

    // 6. Notes & Approval
    if (po.notes) {
        cursorY += 20;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Notes:', margin, cursorY);
        cursorY += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(po.notes, margin, cursorY, { maxWidth: 170 });
    }

    // 7. Signatures
    cursorY += 40;
    if (cursorY > 250) {
        doc.addPage();
        cursorY = 20;
    }

    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.line(margin, cursorY, margin + 60, cursorY);
    doc.line(130, cursorY, 190, cursorY);

    cursorY += 5;
    doc.text('Prepared By / Branch Accountant', margin, cursorY);
    doc.text('Authorized By / Internal Auditor', 130, cursorY);

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('Famous Gate Grill & Lounge - Procurement System', 105, 285, { align: 'center' });
        doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: 'right' });
    }

    return doc;
};

export const downloadPurchaseOrderPDF = async (po: PurchaseOrderData) => {
    const doc = await generatePurchaseOrderPDF(po);
    doc.save(`PO_${po.po_number}.pdf`);
};

export const printPurchaseOrderPDF = async (po: PurchaseOrderData) => {
    const doc = await generatePurchaseOrderPDF(po);
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
};
