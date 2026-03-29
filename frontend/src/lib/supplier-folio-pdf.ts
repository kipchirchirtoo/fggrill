
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { openBlobForPrint } from './tauri-print';

interface SupplierData {
    name: string;
    supplier_code?: string;
    legal_name?: string;
    contact_person?: string;
    email?: string;
    phone?: string;
    alternate_phone?: string;
    website?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
    tax_id?: string;
    vat_number?: string;
    registration_number?: string;
    payment_terms?: string;
    credit_limit?: number;
    bank_name?: string;
    bank_account_number?: string;
    bank_branch?: string;
    lead_time_days?: number;
    status: string;
    notes?: string;
    created_at?: string;
}

export const generateSupplierFolioPDF = async (supplier: SupplierData) => {
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

    // 2. Company Identity (Right Side)
    doc.setFontSize(22);
    doc.setTextColor(44, 62, 80); // Dark Corporate Blue
    doc.setFont('helvetica', 'bold');
    doc.text('SUPPLIER FOLIO', 190, cursorY + 10, { align: 'right' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    cursorY += 15;
    doc.text('FamousGate Hotels & Resorts', 190, cursorY, { align: 'right' });
    cursorY += 5;
    doc.text('Central Procurement Division', 190, cursorY, { align: 'right' });
    cursorY += 5;
    doc.text(`Generated: ${new Date().toLocaleString()}`, 190, cursorY, { align: 'right' });

    cursorY = 60;
    doc.setDrawColor(44, 62, 80);
    doc.setLineWidth(0.5);
    doc.line(margin, cursorY, 190, cursorY);
    cursorY += 15;

    // 3. Main Profile Section
    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80);
    doc.setFont('helvetica', 'bold');
    doc.text(supplier.name.toUpperCase(), margin, cursorY);
    
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`System ID: ${supplier.supplier_code || '---'}`, 190, cursorY, { align: 'right' });
    
    cursorY += 10;

    // 4. Data Tables (Using autoTable for structure)
    
    // Group 1: General & Contact
    const generalInfo = [
        ['Legal Name', supplier.legal_name || '---', 'Contact Person', supplier.contact_person || '---'],
        ['Email Address', supplier.email || '---', 'Phone Number', supplier.phone || '---'],
        ['Alternate Phone', supplier.alternate_phone || '---', 'Website', supplier.website || '---'],
        ['Physical Address', `${supplier.address_line1 || ''} ${supplier.address_line2 || ''}`.trim() || '---', 'City/State', `${supplier.city || ''}, ${supplier.state || ''}`.trim() || '---']
    ];

    autoTable(doc, {
        startY: cursorY,
        head: [[{ content: 'REGISTRATION & CONTACT INFORMATION', colSpan: 4, styles: { fillColor: [44, 62, 80], halign: 'center' } }]],
        body: generalInfo,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', width: 40 }, 2: { fontStyle: 'bold', width: 40 } },
        margin: { left: margin, right: margin }
    });

    cursorY = (doc as any).lastAutoTable.finalY + 10;

    // Group 2: Financial & Tax
    const financialInfo = [
        ['Tax PIN / ID', supplier.tax_id || '---', 'VAT Number', supplier.vat_number || '---'],
        ['Reg Number', supplier.registration_number || '---', 'Lead Time', `${supplier.lead_time_days || 0} Days`]
    ];

    autoTable(doc, {
        startY: cursorY,
        head: [[{ content: 'FINANCIAL & TAXATION DETAILS', colSpan: 4, styles: { fillColor: [44, 62, 80], halign: 'center' } }]],
        body: financialInfo,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', width: 40 }, 2: { fontStyle: 'bold', width: 40 } },
        margin: { left: margin, right: margin }
    });

    cursorY = (doc as any).lastAutoTable.finalY + 10;

    // Group 3: Banking Details
    const bankInfo = [
        ['Bank Name', supplier.bank_name || '---', 'Branch', supplier.bank_branch || '---'],
        ['Account Number', supplier.bank_account_number || '---', 'Payment Terms', supplier.payment_terms || '---']
    ];

    autoTable(doc, {
        startY: cursorY,
        head: [[{ content: 'BANKING & SETTLEMENT INFORMATION', colSpan: 4, styles: { fillColor: [44, 62, 80], halign: 'center' } }]],
        body: bankInfo,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', width: 40 }, 2: { fontStyle: 'bold', width: 40 } },
        margin: { left: margin, right: margin }
    });

    cursorY = (doc as any).lastAutoTable.finalY + 15;

    // 5. Notes Section
    if (supplier.notes) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('REMARKS / INTERNAL NOTES:', margin, cursorY);
        cursorY += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80);
        doc.text(supplier.notes, margin, cursorY, { maxWidth: 170 });
        cursorY += 20;
    }

    // 6. Footer Branded Info
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.line(margin, 280, 190, 280);
        doc.text('FamousGate Hotels & Resorts | Vendor Management System', 105, 287, { align: 'center' });
        doc.text(`Page ${i} of ${pageCount}`, 190, 287, { align: 'right' });
    }

    return doc;
};

export const downloadSupplierFolioPDF = async (supplier: SupplierData) => {
    const doc = await generateSupplierFolioPDF(supplier);
    doc.save(`Folio_${supplier.supplier_code || supplier.name}.pdf`);
};

export const printSupplierFolioPDF = async (supplier: SupplierData) => {
    const doc = await generateSupplierFolioPDF(supplier);
    doc.autoPrint();
    openBlobForPrint(doc.output('bloburl') as unknown as string);
};
