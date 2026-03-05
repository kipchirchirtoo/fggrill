
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from './date-utils';
import { PYTHON_SERVICE_URL } from './config';

interface DispatchItem {
    item_sku: string;
    dispatched_quantity: number;
    received_quantity?: number;
    item?: {
        item_name: string;
        unit_of_measure: string;
        cost_price?: number;
    };
}

interface DispatchData {
    dispatch_number: string;
    created_at: string;
    status: string;
    from_branch_id: number;
    to_branch_id: number;
    vehicle_number?: string;
    driver_name?: string;
    driver_phone?: string;
    estimated_delivery?: string;
    dispatch_notes?: string;
    items?: DispatchItem[];
    from_branch?: { name: string; location?: string };
    to_branch?: { name: string; location?: string };
}

export const generateDispatchPDF = async (dispatch: DispatchData) => {
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
        // Fallback placeholder if logo fails
        doc.setDrawColor(200);
        doc.rect(margin, cursorY, 30, 30);
    }

    doc.setFontSize(22);
    doc.setTextColor(44, 62, 80);
    doc.text('DELIVERY NOTE', 190, cursorY + 5, { align: 'right' });

    // 2. Barcode (Dispatch Number)
    try {
        const barcodeUrl = `${PYTHON_SERVICE_URL}/api/barcode/barcode-image/${dispatch.dispatch_number}?format=code128&include_text=true`;
        const response = await fetch(barcodeUrl);
        if (response.ok) {
            const blob = await response.blob();
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
            doc.addImage(base64, 'PNG', 140, 30, 50, 15);
        }
    } catch (e) {
        console.error('Failed to load barcode', e);
    }

    doc.setFontSize(10);
    doc.setTextColor(100);
    cursorY += 15;
    doc.text('FamousGate Hotels', 190, cursorY + 15, { align: 'right' });
    cursorY += 5;
    doc.text('Central Warehouse & Logistics', 190, cursorY + 15, { align: 'right' });
    cursorY += 5;
    doc.text('Bomet, Kenya | 0706782828', 190, cursorY + 15, { align: 'right' });

    cursorY = 75;
    doc.setDrawColor(200);
    doc.line(margin, cursorY, 190, cursorY);
    cursorY += 10;

    // 3. Dispatch Details
    doc.setFontSize(11);
    doc.setTextColor(44, 62, 80);
    doc.setFont('helvetica', 'bold');
    doc.text('DISPATCH INFO:', margin, cursorY);
    doc.text('LOGISTICS:', 120, cursorY);

    cursorY += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0);

    // Robust field mapping
    const raw = dispatch as any;
    const vehicle = raw.vehicle_number || raw.vehicle_registration || raw.registration_number || (raw.vehicle?.registration_number) || 'N/A';
    const driver = raw.driver_name || raw.driver || (raw.driver?.name) || 'N/A';
    const phone = raw.driver_phone || raw.phone || raw.driver_contact || (raw.driver?.phone) || 'N/A';

    // Left: Dispatch Routes
    doc.text(`Dispatch #: ${dispatch.dispatch_number}`, margin, cursorY);
    doc.text(`Vehicle: ${vehicle}`, 120, cursorY);

    cursorY += 5;
    const fromName = raw.from_branch?.name || raw.from_branch_name || 'Central Store';
    doc.text(`From: ${fromName}`, margin, cursorY);
    doc.text(`Driver: ${driver}`, 120, cursorY);

    cursorY += 5;
    const toName = raw.to_branch?.name || raw.to_branch_name || raw.to_branch?.location || 'Unknown';
    doc.text(`To: ${toName}`, margin, cursorY);
    doc.text(`Phone: ${phone}`, 120, cursorY);

    cursorY += 5;
    doc.text(`Date: ${formatDate(dispatch.created_at)}`, margin, cursorY);
    if (dispatch.estimated_delivery) {
        doc.text(`Est. Delivery: ${formatDate(dispatch.estimated_delivery)}`, 120, cursorY);
    }

    cursorY += 15;

    // 4. Items Table
    let items = dispatch.items || (raw as any).dispatch_items || [];

    // Handle JSON string cases
    if (typeof items === 'string') {
        try {
            items = JSON.parse(items);
        } catch (e) {
            console.error('Failed to parse items JSON', e);
            items = [];
        }
    }

    const tableData = (items || []).map((item: any) => {
        const qty = item.dispatched_quantity || item.quantity || item.approved_quantity || 0;
        const unit = item.item?.unit_of_measure || item.unit || item.unit_of_measure || 'pcs';
        const itemName = item.item?.item_name || item.item_name || item.name || item.item_sku || 'Item';
        const cost = item.item?.cost_price || item.cost_price || item.price || 0;
        const total = qty * cost;

        return [
            itemName,
            qty, // Pkg (Qty)
            qty, // Actual (Assuming same for DN)
            unit,
            `KES ${cost.toLocaleString()}`,
            `KES ${total.toLocaleString()}`
        ];
    });

    autoTable(doc, {
        startY: cursorY,
        head: [['ITEMS', 'QTY (Pkg)', 'QTY (Actual)', 'UNIT', 'COST', 'TOTAL']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [44, 62, 80], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: margin, right: margin }
    });

    cursorY = (doc as any).lastAutoTable.finalY + 15;

    // 5. Remarks & Signatures
    if (dispatch.dispatch_notes) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Remarks:', margin, cursorY);
        cursorY += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(dispatch.dispatch_notes, margin, cursorY, { maxWidth: 100 });
        cursorY += 15;
    }

    // Signatures Area
    doc.setDrawColor(200);
    const sigLine = 50;

    doc.line(margin, cursorY + 15, margin + sigLine, cursorY + 15);
    doc.text('Prepared By', margin, cursorY + 20);

    doc.line(140, cursorY + 15, 140 + sigLine, cursorY + 15);
    doc.text('Received By', 140, cursorY + 20);

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Printed on: ${new Date().toLocaleString()}`, margin, 285);
        doc.text(`FamousGate Hotels - Delivery Note | Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
    }

    return doc;
};

export const downloadDispatchPDF = async (dispatch: DispatchData) => {
    const doc = await generateDispatchPDF(dispatch);
    doc.save(`DeliveryNote_${dispatch.dispatch_number.replace(/\//g, '_')}.pdf`);
};

export const printDispatchPDF = async (dispatch: DispatchData) => {
    const doc = await generateDispatchPDF(dispatch);
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
};
