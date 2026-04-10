import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from './date-utils';
import { PYTHON_SERVICE_URL } from './config';
import { openBlobForPrint } from './tauri-print';

interface ConferenceBookingData {
    id: string;
    invoice_number?: string;
    company_name?: string;
    customer_name: string;
    customer_phone?: string;
    customer_email?: string;
    contact_person?: string;
    start_date: string;
    end_date: string;
    num_participants?: number;
    total_amount: number;
    amount_paid?: number;
    payment_status: string;
    booking_status: string;
    notes?: string;
    hall?: {
        name: string;
        capacity?: number;
    };
    branch?: {
        name: string;
        address?: string;
        phone?: string;
        email?: string;
    };
    meal_plan_details?: Array<{
        name: string;
        price: number;
        pax?: number;
    }>;
    amenities_details?: Array<{
        name: string;
        unit_cost: number;
        quantity: number;
    }>;
}

export const generateConferenceInvoicePDF = async (booking: ConferenceBookingData) => {
    const doc = new jsPDF();
    
    // Use Courier (monospace/typewriter font) for better readability
    doc.setFont('courier');
    
    const margin = 15; // Reduced margin for more space
    let cursorY = 15;

    // Use invoice number from database, fallback to generated one
    const invoiceNumber = booking.invoice_number || `CNF-${booking.id.slice(0, 8).toUpperCase()}`;

    // 1. Logo (smaller and faster)
    try {
        const logoUrl = '/fglogo.png';
        const img = new Image();
        img.src = logoUrl;
        await Promise.race([
            new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Logo timeout')), 2000))
        ]);
        doc.addImage(img, 'PNG', margin, cursorY, 25, 25);
    } catch (e) {
        console.warn('Skipping logo:', e);
    }

    doc.setFontSize(18);
    doc.setTextColor(44, 62, 80);
    doc.text('CONFERENCE INVOICE', 190, cursorY + 5, { align: 'right' });

    // 2. Barcode (smaller)
    try {
        const barcodeUrl = `${PYTHON_SERVICE_URL}/api/barcode/barcode-image/${invoiceNumber}?format=code128&include_text=true`;
        const response = await Promise.race([
            fetch(barcodeUrl),
            new Promise<Response>((_, reject) => setTimeout(() => reject(new Error('Barcode timeout')), 2000))
        ]) as Response;

        if (response.ok) {
            const blob = await response.blob();
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
            doc.addImage(base64, 'PNG', 145, 25, 45, 12);
        }
    } catch (e) {
        console.warn('Skipping barcode (service may be offline):', e);
    }

    doc.setFontSize(8);
    doc.setTextColor(100);
    cursorY += 12;
    doc.text(booking.branch?.name || 'FamousGate Hotels', 190, cursorY + 10, { align: 'right' });
    doc.text(booking.branch?.address || 'Bomet, Kenya', 190, cursorY + 14, { align: 'right' });
    doc.text(booking.branch?.phone || '0706782828', 190, cursorY + 18, { align: 'right' });

    cursorY = 50;
    doc.setDrawColor(200);
    doc.line(margin, cursorY, 195, cursorY);
    cursorY += 6;

    // 3. Client Details - SHOW ALL INFORMATION
    doc.setFontSize(10);
    doc.setTextColor(44, 62, 80);
    doc.setFont('courier', 'bold');
    doc.text('CLIENT INFORMATION:', margin, cursorY);
    doc.text('INVOICE DETAILS:', 120, cursorY);

    cursorY += 5;
    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.setFont('courier', 'normal');
    
    // LEFT SIDE - All client info
    const clientName = booking.company_name || booking.customer_name;
    doc.text(`Company: ${clientName}`, margin, cursorY);
    doc.text(`Invoice #: ${invoiceNumber}`, 120, cursorY);

    cursorY += 4;
    const contactPerson = booking.contact_person || booking.customer_name;
    doc.text(`Contact: ${contactPerson}`, margin, cursorY);
    doc.text(`Date: ${formatDate(booking.start_date)}`, 120, cursorY);

    cursorY += 4;
    const phone = booking.customer_phone || '';
    doc.text(`Phone: ${phone}`, margin, cursorY);
    doc.text(`Event: ${formatDate(booking.start_date)}`, 120, cursorY);

    cursorY += 4;
    const email = booking.customer_email || '';
    if (email) {
        doc.text(`Email: ${email}`, margin, cursorY);
    }
    doc.text(`Status: ${booking.payment_status.toUpperCase()}`, 120, cursorY);

    cursorY += 8;

    // 4. Event Details - Compact
    doc.setFontSize(9);
    doc.setFont('courier', 'bold');
    doc.setTextColor(44, 62, 80);
    doc.text('EVENT DETAILS', margin, cursorY);
    cursorY += 4;

    doc.setFontSize(8);
    doc.setFont('courier', 'normal');
    doc.setTextColor(0);

    doc.text(`Hall: ${booking.hall?.name || 'Conference Hall'}`, margin, cursorY);
    doc.text(`Participants: ${booking.num_participants || 0} people`, 100, cursorY);
    cursorY += 4;
    doc.text(`Start: ${new Date(booking.start_date).toLocaleString()}`, margin, cursorY);
    cursorY += 4;
    doc.text(`End: ${new Date(booking.end_date).toLocaleString()}`, margin, cursorY);

    cursorY += 8;

    // 5. Items Table
    const tableData: any[] = [];
    
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(val || 0).replace('KES', 'Ksh');
    };

    // Calculate total from all items
    let calculatedTotal = 0;

    // Hall rental - calculate based on dates if not itemized
    const start = new Date(booking.start_date);
    const end = new Date(booking.end_date);
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    // Meals total
    let mealsTotal = 0;
    if (booking.meal_plan_details && booking.meal_plan_details.length > 0) {
        booking.meal_plan_details.forEach(meal => {
            const qty = meal.pax || booking.num_participants || 0;
            const price = meal.price || 0;
            mealsTotal += qty * price;
        });
    }

    // Amenities total
    let amenitiesTotal = 0;
    if (booking.amenities_details && booking.amenities_details.length > 0) {
        booking.amenities_details.forEach(item => {
            const qty = item.quantity || 0;
            const price = item.unit_cost || 0;
            amenitiesTotal += qty * price;
        });
    }

    // Hall rental is the remainder
    const hallRental = booking.total_amount - mealsTotal - amenitiesTotal;

    // Add hall rental if there's a charge
    if (hallRental > 0) {
        const hallRentalNet = hallRental / 1.16;
        tableData.push([
            `Conference Hall Rental - ${booking.hall?.name || 'Hall'} (${diffDays} day${diffDays > 1 ? 's' : ''})`,
            '1',
            formatCurrency(hallRentalNet),
            '16%',
            formatCurrency(hallRental)
        ]);
        calculatedTotal += hallRental;
    }

    // Meals
    if (booking.meal_plan_details && booking.meal_plan_details.length > 0) {
        booking.meal_plan_details.forEach(meal => {
            const qty = meal.pax || booking.num_participants || 0;
            const price = meal.price || 0;
            const total = qty * price;
            const unitPrice = price;
            
            tableData.push([
                `${meal.name} (${qty} pax)`,
                qty,
                formatCurrency(unitPrice),
                '16%',
                formatCurrency(total)
            ]);
            calculatedTotal += total;
        });
    }

    // Amenities
    if (booking.amenities_details && booking.amenities_details.length > 0) {
        booking.amenities_details.forEach(item => {
            const qty = item.quantity || 0;
            const price = item.unit_cost || 0;
            const total = qty * price;
            
            tableData.push([
                item.name,
                qty,
                formatCurrency(price),
                '16%',
                formatCurrency(total)
            ]);
            calculatedTotal += total;
        });
    }

    // If no itemization, show total as conference package
    if (tableData.length === 0) {
        const packageNet = booking.total_amount / 1.16;
        tableData.push([
            `Conference Package - ${booking.hall?.name || 'Hall'} (${diffDays} day${diffDays > 1 ? 's' : ''}, ${booking.num_participants || 0} pax)`,
            '1',
            formatCurrency(packageNet),
            '16%',
            formatCurrency(booking.total_amount)
        ]);
    }

    autoTable(doc, {
        startY: cursorY,
        head: [['Description', 'Qty', 'Unit Price', 'VAT', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: { 
            fillColor: [44, 62, 80], 
            textColor: 255,
            font: 'courier',
            fontStyle: 'bold',
            fontSize: 8
        },
        styles: {
            font: 'courier',
            fontSize: 7,
            cellPadding: 1.5
        },
        columnStyles: {
            0: { cellWidth: 80 },
            1: { cellWidth: 15, halign: 'center' },
            2: { cellWidth: 30, halign: 'right' },
            3: { cellWidth: 15, halign: 'center' },
            4: { cellWidth: 30, halign: 'right' }
        },
        margin: { left: margin, right: margin }
    });

    if ((doc as any).lastAutoTable) {
        cursorY = (doc as any).lastAutoTable.finalY + 8;
    } else {
        cursorY += (tableData.length * 8) + 15;
    }

    // 6. Totals - Compact
    const totalLabelX = 120;
    const totalValueX = 195;

    // Calculate VAT (16% inclusive)
    const totalGross = booking.total_amount;
    const totalNet = totalGross / 1.16;
    const totalVat = totalGross - totalNet;

    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.text('Subtotal (Excl. VAT):', totalLabelX, cursorY);
    doc.text(formatCurrency(totalNet), totalValueX, cursorY, { align: 'right' });

    cursorY += 4;
    doc.text('VAT Amount (16%):', totalLabelX, cursorY);
    doc.text(formatCurrency(totalVat), totalValueX, cursorY, { align: 'right' });

    cursorY += 6;
    doc.setFontSize(10);
    doc.setFont('courier', 'bold');
    doc.text('GRAND TOTAL:', totalLabelX, cursorY);
    doc.text(formatCurrency(totalGross), totalValueX, cursorY, { align: 'right' });

    // Amount Paid
    if (booking.amount_paid && booking.amount_paid > 0) {
        cursorY += 5;
        doc.setFontSize(8);
        doc.setFont('courier', 'normal');
        doc.setTextColor(0, 128, 0);
        doc.text('Amount Paid:', totalLabelX, cursorY);
        doc.text(formatCurrency(booking.amount_paid), totalValueX, cursorY, { align: 'right' });

        const balance = totalGross - booking.amount_paid;
        if (balance > 0) {
            cursorY += 4;
            doc.setTextColor(255, 0, 0);
            doc.setFont('courier', 'bold');
            doc.text('BALANCE DUE:', totalLabelX, cursorY);
            doc.text(formatCurrency(balance), totalValueX, cursorY, { align: 'right' });
        }
    }

    doc.setTextColor(0);

    // 7. Notes - Compact
    if (booking.notes) {
        cursorY += 8;
        doc.setFontSize(8);
        doc.setFont('courier', 'bold');
        doc.text('Notes:', margin, cursorY);
        cursorY += 3;
        doc.setFont('courier', 'normal');
        doc.setTextColor(100);
        const splitNotes = doc.splitTextToSize(booking.notes, 180);
        doc.text(splitNotes, margin, cursorY);
        cursorY += (splitNotes.length * 3);
    }

    // 8. Payment Details - Compact, inline
    cursorY += 8;
    doc.setFontSize(8);
    doc.setFont('courier', 'bold');
    doc.setTextColor(44, 62, 80);
    doc.text('PAYMENT DETAILS:', margin, cursorY);
    cursorY += 4;

    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.text('AC Name: FAMOUS GATES LIMITED', margin, cursorY);
    doc.text('AC No: 2041305757', 100, cursorY);
    cursorY += 3;
    doc.text('Bank: ABSA BANK', margin, cursorY);
    doc.text('Branch: BOMET', 100, cursorY);

    cursorY += 6;
    doc.setFontSize(7);
    doc.setFont('courier', 'italic');
    doc.setTextColor(120);
    doc.text('Issued by: FamousGate Hotels', margin, cursorY);

    // Footer - Single page
    doc.setFontSize(7);
    doc.setFont('courier', 'normal');
    doc.setTextColor(150);
    doc.text('FamousGate Hotels - Conference Services', 105, 285, { align: 'center' });
    doc.text('Page 1 of 1', 195, 285, { align: 'right' });

    return doc;
};

export const downloadConferenceInvoicePDF = async (booking: ConferenceBookingData) => {
    try {
        const doc = await generateConferenceInvoicePDF(booking);
        const safeId = (booking.invoice_number || booking.id).replace(/[/\\?%*:|"<>]/g, '_');
        doc.save(`Conference_Invoice_${safeId}.pdf`);
        return true;
    } catch (error) {
        console.error('Download error:', error);
        throw error;
    }
};

export const printConferenceInvoicePDF = async (booking: ConferenceBookingData) => {
    try {
        const doc = await generateConferenceInvoicePDF(booking);
        doc.autoPrint();
        const blobUrl = doc.output('bloburl') as unknown as string;
        openBlobForPrint(blobUrl);
        return true;
    } catch (error) {
        console.error('Print error:', error);
        throw error;
    }
};
