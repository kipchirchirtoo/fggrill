
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from './date-utils';
import { PYTHON_SERVICE_URL } from './config';
import { openBlobForPrint } from './tauri-print';

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
    const vehicle = raw.vehicle_number || raw.vehicle_registration || raw.registration_number || (raw.vehicle?.registration_number) || '_______________';
    const driver = raw.driver_name || raw.driver || (raw.driver?.name) || '_______________';
    const phone = raw.driver_phone || raw.phone || raw.driver_contact || (raw.driver?.phone) || '_______________';

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

    // Signatures Area — 4 blocks
    doc.setDrawColor(150);
    doc.setFontSize(9);
    doc.setTextColor(44, 62, 80);

    // Check if we need a new page for signatures
    if (cursorY > 230) {
        doc.addPage();
        cursorY = 20;
    }

    const sigW = 75; // width of each signature block
    const col1 = margin;
    const col2 = margin + sigW + 10;

    // Row 1: Prepared By | Dispatched By / Driver
    doc.setFont('helvetica', 'bold');
    doc.text('Prepared By (Central Store):', col1, cursorY);
    doc.text('Dispatched By / Driver:', col2, cursorY);
    cursorY += 8;

    doc.setFont('helvetica', 'normal');
    doc.text('Name: ___________________________', col1, cursorY);
    doc.text('Name: ___________________________', col2, cursorY);
    cursorY += 8;
    doc.text('Sign: ___________________________', col1, cursorY);
    doc.text('Sign: ___________________________', col2, cursorY);
    cursorY += 8;
    doc.text('Date: ___________________________', col1, cursorY);
    doc.text('Date: ___________________________', col2, cursorY);
    cursorY += 16;

    // Row 2: Branch Storekeeper Received
    doc.setFont('helvetica', 'bold');
    doc.text('Branch Storekeeper (Received By):', col1, cursorY);
    cursorY += 8;
    doc.setFont('helvetica', 'normal');
    doc.text('Name: ___________________________', col1, cursorY);
    doc.text('Condition of Goods: ______________', col2, cursorY);
    cursorY += 8;
    doc.text('Sign: ___________________________', col1, cursorY);
    doc.text('Date: ___________________________', col2, cursorY);
    cursorY += 14;

    // Return note
    doc.setDrawColor(44, 62, 80);
    doc.setLineWidth(0.5);
    doc.rect(col1, cursorY, 170, 10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(44, 62, 80);
    doc.text(
        'This delivery note must be signed and returned to Central Store after delivery.',
        105, cursorY + 6.5,
        { align: 'center' }
    );
    doc.setLineWidth(0.2);

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
    await openBlobForPrint(doc.output('bloburl') as unknown as string);
};

// =========================================================
// DELIVERED DISPATCHES BATCH REPORT
// =========================================================

export interface DeliveredReportFilters {
    from_date?: string;
    to_date?: string;
    branch_name?: string;
}

export const exportDeliveredReportPDF = async (
    dispatches: any[],
    filters: DeliveredReportFilters = {}
) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const margin = 15;
    const pageW = 297;

    // ── Header bar ──────────────────────────────────────────
    doc.setFillColor(31, 31, 31);           // near-black
    doc.rect(0, 0, pageW, 28, 'F');

    // Logo
    try {
        const img = new Image();
        img.src = '/fglogo.png';
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
        doc.addImage(img, 'PNG', margin, 4, 20, 20);
    } catch { /* skip */ }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('FamousGate Hotels', margin + 24, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text('Central Store Delivered Dispatches Report', margin + 24, 22);

    // Right: print date
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - margin, 22, { align: 'right' });

    // ── Gold accent line ──────────────────────────────────────
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(1.2);
    doc.line(0, 28, pageW, 28);

    let cursorY = 36;

    // ── Filter summary ────────────────────────────────────────
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const filterParts: string[] = [];
    if (filters.from_date) filterParts.push(`From: ${filters.from_date}`);
    if (filters.to_date) filterParts.push(`To: ${filters.to_date}`);
    if (filters.branch_name) filterParts.push(`Branch: ${filters.branch_name}`);
    if (filterParts.length === 0) filterParts.push('All dates & branches');
    doc.text(`Filters: ${filterParts.join('  |  ')}`, margin, cursorY);
    cursorY += 8;

    // ── Stats strip ───────────────────────────────────────────
    const totalItems = dispatches.reduce((s, d) => s + (d.items?.length || 0), 0);
    const uniqueBranches = new Set(dispatches.map(d => d.to_branch_name || d.to_branch?.name)).size;

    const stats = [
        { label: 'Total Dispatches', value: String(dispatches.length) },
        { label: 'Branches Served', value: String(uniqueBranches) },
        { label: 'Total Line Items', value: String(totalItems) },
    ];
    const boxW = 55;
    stats.forEach((s, i) => {
        const x = margin + i * (boxW + 5);
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(x, cursorY, boxW, 16, 2, 2, 'F');
        doc.setFillColor(212, 175, 55);
        doc.roundedRect(x, cursorY, 3, 16, 1, 1, 'F');
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 31, 31);
        doc.text(s.value, x + 8, cursorY + 11);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text(s.label.toUpperCase(), x + 8, cursorY + 15.5);
    });
    cursorY += 24;

    // ── Main table ────────────────────────────────────────────
    const tableRows = dispatches.map(d => {
        const branch = d.to_branch_name || d.to_branch?.name || 'Unknown';
        const date = d.confirmed_at || d.delivered_at || d.dispatched_at || d.created_at;
        const displayDate = date ? new Date(date).toLocaleDateString('en-KE') : '—';
        const driver = d.driver_name || d.driver?.name || '—';
        const vehicle = d.vehicle_registration || d.vehicle_number || d.vehicle?.registration_number || '—';
        const itemCount = d.items?.length || 0;
        const statusLabel = d.status === 'CONFIRMED' ? 'Confirmed' : d.status === 'DISPUTED' ? 'Disputed' : 'Delivered';

        return [
            d.dispatch_number || '—',
            branch,
            displayDate,
            driver,
            vehicle,
            String(itemCount),
            statusLabel
        ];
    });

    autoTable(doc, {
        startY: cursorY,
        head: [['DISPATCH #', 'DESTINATION BRANCH', 'DELIVERY DATE', 'DRIVER', 'VEHICLE', 'ITEMS', 'STATUS']],
        body: tableRows,
        theme: 'grid',
        headStyles: {
            fillColor: [31, 31, 31],
            textColor: 255,
            fontSize: 8,
            fontStyle: 'bold',
            halign: 'left',
        },
        bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 42 },
            1: { cellWidth: 55 },
            2: { cellWidth: 30 },
            3: { cellWidth: 40 },
            4: { cellWidth: 30 },
            5: { halign: 'center', cellWidth: 18 },
            6: { halign: 'center', cellWidth: 28 },
        },
        margin: { left: margin, right: margin },
        didParseCell: (data) => {
            // Color status column
            if (data.column.index === 6 && data.section === 'body') {
                const status = data.cell.raw as string;
                if (status === 'Confirmed') {
                    data.cell.styles.textColor = [22, 163, 74];  // green
                    data.cell.styles.fontStyle = 'bold';
                } else if (status === 'Disputed') {
                    data.cell.styles.textColor = [239, 68, 68];  // red
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        }
    });

    // ── Footer ────────────────────────────────────────────────
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(212, 175, 55);
        doc.setLineWidth(0.5);
        doc.line(margin, 198, pageW - margin, 198);
        doc.setFontSize(7.5);
        doc.setTextColor(150);
        doc.text('FamousGate Hotels Management System — Confidential', margin, 203);
        doc.text(`Page ${i} of ${pageCount}`, pageW - margin, 203, { align: 'right' });
    }

    // Download
    const dateStr = new Date().toISOString().split('T')[0];
    doc.save(`FG_Delivered_Dispatches_${dateStr}.pdf`);
};

// =========================================================
// BRANCH REQUISITIONS HISTORY REPORT
// =========================================================

export const exportRequestsHistoryPDF = async (requests: any[]) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const margin = 15;
    const pageW = 297;

    // ── Header bar ──────────────────────────────────────────
    doc.setFillColor(31, 31, 31);
    doc.rect(0, 0, pageW, 28, 'F');

    try {
        const img = new Image();
        img.src = '/fglogo.png';
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
        doc.addImage(img, 'PNG', margin, 4, 20, 20);
    } catch { /* skip */ }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('FamousGate Hotels', margin + 24, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text('Branch Requisitions — Historical Activity Report', margin + 24, 22);

    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - margin, 22, { align: 'right' });

    // ── Gold accent line ──────────────────────────────────────
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(1.2);
    doc.line(0, 28, pageW, 28);

    let cursorY = 36;

    // ── Stats strip ───────────────────────────────────────────
    const delivered = requests.filter(r => r.status === 'DELIVERED').length;
    const rejected  = requests.filter(r => r.status === 'REJECTED').length;
    const cancelled = requests.filter(r => r.status === 'CANCELLED').length;
    const uniqueBranches = new Set(requests.map(r => r.branch_name || r.branch?.name || '')).size;

    const stats = [
        { label: 'Total Records',    value: String(requests.length),   color: [31, 31, 31] as [number, number, number] },
        { label: 'Delivered',        value: String(delivered),          color: [22, 163, 74] as [number, number, number] },
        { label: 'Rejected',         value: String(rejected),           color: [239, 68, 68] as [number, number, number] },
        { label: 'Branches',         value: String(uniqueBranches),     color: [100, 100, 100] as [number, number, number] },
    ];

    const boxW = 60;
    stats.forEach((s, i) => {
        const x = margin + i * (boxW + 5);
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(x, cursorY, boxW, 18, 2, 2, 'F');
        doc.setFillColor(212, 175, 55);
        doc.roundedRect(x, cursorY, 3, 18, 1, 1, 'F');
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(s.color[0], s.color[1], s.color[2]);
        doc.text(s.value, x + 8, cursorY + 12);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text(s.label.toUpperCase(), x + 8, cursorY + 17);
    });
    cursorY += 26;

    // ── Main table ────────────────────────────────────────────
    const tableRows = requests.map(r => {
        const date = r.created_at ? new Date(r.created_at).toLocaleDateString('en-KE') : '—';
        const items = (r.items || []).slice(0, 3).map((i: any) => i.item_name || i.item_sku).join(', ')
            + (r.items?.length > 3 ? ` +${r.items.length - 3} more` : '');

        return [
            r.request_number || '—',
            r.branch_name || r.branch?.name || '—',
            date,
            r.priority || 'NORMAL',
            String(r.items?.length || 0),
            items || '—',
            r.status || '—',
        ];
    });

    autoTable(doc, {
        startY: cursorY,
        head: [['REQUEST #', 'BRANCH', 'DATE', 'PRIORITY', 'ITEMS', 'ITEM SUMMARY', 'STATUS']],
        body: tableRows,
        theme: 'grid',
        headStyles: {
            fillColor: [31, 31, 31],
            textColor: 255,
            fontSize: 8,
            fontStyle: 'bold',
            halign: 'left',
        },
        bodyStyles: { fontSize: 7.5, textColor: [50, 50, 50] },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 36 },
            1: { cellWidth: 44 },
            2: { cellWidth: 26 },
            3: { halign: 'center', cellWidth: 22 },
            4: { halign: 'center', cellWidth: 16 },
            5: { cellWidth: 80 },
            6: { halign: 'center', cellWidth: 28 },
        },
        margin: { left: margin, right: margin },
        didParseCell: (data) => {
            if (data.column.index === 6 && data.section === 'body') {
                const status = data.cell.raw as string;
                if (status === 'DELIVERED') {
                    data.cell.styles.textColor = [22, 163, 74];
                    data.cell.styles.fontStyle = 'bold';
                } else if (status === 'REJECTED' || status === 'CANCELLED') {
                    data.cell.styles.textColor = [239, 68, 68];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
            if (data.column.index === 3 && data.section === 'body') {
                if ((data.cell.raw as string) === 'URGENT') {
                    data.cell.styles.textColor = [239, 68, 68];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        }
    });

    // ── Footer ────────────────────────────────────────────────
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(212, 175, 55);
        doc.setLineWidth(0.5);
        doc.line(margin, 198, pageW - margin, 198);
        doc.setFontSize(7.5);
        doc.setTextColor(150);
        doc.text('FamousGate Hotels Management System — Confidential', margin, 203);
        doc.text(`Page ${i} of ${pageCount}`, pageW - margin, 203, { align: 'right' });
    }

    const dateStr = new Date().toISOString().split('T')[0];
    doc.save(`FG_Requisitions_History_${dateStr}.pdf`);
};

