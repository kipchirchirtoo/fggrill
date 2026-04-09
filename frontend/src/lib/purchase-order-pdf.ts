
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { openBlobForPrint } from './tauri-print';

interface POItem {
    item?: { name: string };
    item_id?: number | string;
    item_name?: string;
    quantity?: number;
    quantity_ordered?: number;
    unit_price: number;
    total?: number;
    total_price?: number;
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
    created_by?: {
        id?: string;
        full_name?: string;
        name?: string;
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
    doc.text(po.branch?.name || 'FamousGate Hotels', 190, cursorY, { align: 'right' });
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
    const tableData = (po.items || []).map(item => {
        // Handle both quantity_ordered (from DB) and quantity (from form)
        const qty = Number(item.quantity_ordered || item.quantity) || 0;
        const price = Number(item.unit_price) || 0;
        // Use total_price from DB if available, otherwise calculate
        const total = Number(item.total_price) || (qty * price);

        // Get item name from nested item object or fallback
        const itemName = item.item?.name || item.item_name || `Item #${item.item_id}`;

        return [
            itemName,
            qty,
            new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price).replace('KES', 'Ksh'),
            new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(total).replace('KES', 'Ksh')
        ];
    });

    autoTable(doc, {
        startY: cursorY,
        head: [['Item Description', 'Qty', 'Unit Price', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [44, 62, 80], textColor: 255 },
        margin: { left: margin, right: margin }
    });

    cursorY = (doc as any).lastAutoTable.finalY + 15;

    // 5. Totals
    const totalLabelX = 110; // Increased gap to avoid overlap with large amounts
    const totalValueX = 190;

    const subtotal = Number(po.subtotal || po.total_amount) || 0;
    const tax = Number(po.tax_amount) || 0;

    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', totalLabelX, cursorY);
    doc.text(new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(subtotal).replace('KES', 'Ksh'), totalValueX, cursorY, { align: 'right' });

    cursorY += 10; // Increased spacing
    doc.text('Tax:', totalLabelX, cursorY);
    doc.text(new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(tax).replace('KES', 'Ksh'), totalValueX, cursorY, { align: 'right' });

    cursorY += 15; // Increased spacing for Grand Total
    doc.setFontSize(14); // Slightly larger for emphasis
    doc.setFont('helvetica', 'bold');
    doc.text('GRAND TOTAL:', totalLabelX, cursorY);
    doc.text(new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(po.total_amount).replace('KES', 'Ksh'), totalValueX, cursorY, { align: 'right' });

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

    // 7. Bank Details + Branch
    cursorY += po.notes ? 20 : 20;
    if (cursorY > 230) { doc.addPage(); cursorY = 20; }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(44, 62, 80);
    doc.text('PAYMENT DETAILS:', margin, cursorY);
    cursorY += 6;

    autoTable(doc, {
        startY: cursorY,
        body: [
            ['AC Name:', 'FAMOUS GATES LIMITED'],
            ['AC No:', '2041305757'],
            ['Bank:', 'ABSA BANK'],
            ['Branch:', 'BOMET'],
        ],
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 35, textColor: [44, 62, 80] },
            1: { cellWidth: 95 }
        },
        margin: { left: margin, right: margin }
    });

    if ((doc as any).lastAutoTable) {
        cursorY = (doc as any).lastAutoTable.finalY + 5;
    } else {
        cursorY += 30;
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(120);
    doc.text('Issued by: FamousGate Hote', margin, cursorY);
    cursorY += 15;
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
        doc.text('FamousGate Hotels - Procurement System', 105, 285, { align: 'center' });
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
    openBlobForPrint(doc.output('bloburl') as unknown as string);
};
