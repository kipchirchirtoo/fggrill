import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from './date-utils';

export const generateBranchSalesPDF = async (salesData: any, metadata: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let cursorY = 20;

    // Brand Colors
    const brandPrimary = [139, 69, 19]; // Saddle Brown
    const brandSecondary = [218, 165, 32]; // Goldenrod
    const brandDark = [44, 62, 80]; // Dark Blue-Gray
    const brandLight = [245, 245, 220]; // Beige

    // ===== HEADER SECTION WITH BRAND BANNER =====
    // Top brand banner
    doc.setFillColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    // Gold accent line
    doc.setFillColor(brandSecondary[0], brandSecondary[1], brandSecondary[2]);
    doc.rect(0, 45, pageWidth, 3, 'F');

    // Logo (with timeout)
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
        doc.addImage(img, 'PNG', margin, 8, 35, 35);
    } catch (e) {
        console.warn('Logo not loaded, using text branding:', e);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('FG', margin + 10, 28);
    }

    // Company name and report title
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('FAMOUSGATE HOTELS', pageWidth - margin, 18, { align: 'right' });
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('Branch Sales Analytics Report', pageWidth - margin, 28, { align: 'right' });
    
    doc.setFontSize(10);
    doc.setTextColor(brandSecondary[0], brandSecondary[1], brandSecondary[2]);
    doc.text('Excellence in Hospitality', pageWidth - margin, 36, { align: 'right' });

    cursorY = 58;

    // Report metadata box
    doc.setFillColor(brandLight[0], brandLight[1], brandLight[2]);
    doc.roundedRect(margin, cursorY, pageWidth - 2 * margin, 28, 3, 3, 'F');
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
    
    const branchName = metadata?.branchName || 'Branch Operations';
    doc.text('Branch:', margin + 5, cursorY + 8);
    doc.setFont('helvetica', 'normal');
    doc.text(branchName, margin + 25, cursorY + 8);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Period:', margin + 5, cursorY + 16);
    doc.setFont('helvetica', 'normal');
    doc.text(`${formatDate(metadata?.startDate)} to ${formatDate(metadata?.endDate)}`, margin + 25, cursorY + 16);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Generated:', margin + 5, cursorY + 24);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' }), margin + 30, cursorY + 24);

    cursorY = 95;

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(val || 0).replace('KES', 'Ksh');
    };

    // ===== EXECUTIVE SUMMARY - KEY METRICS CARDS =====
    const summary = salesData?.summary || { total_sales: 0, transaction_count: 0, avg_transaction_value: 0 };
    
    // Section header with gold underline
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
    doc.text('EXECUTIVE SUMMARY', margin, cursorY);
    
    doc.setDrawColor(brandSecondary[0], brandSecondary[1], brandSecondary[2]);
    doc.setLineWidth(1);
    doc.line(margin, cursorY + 2, margin + 60, cursorY + 2);
    cursorY += 12;

    // Metric cards in a row
    const cardWidth = (pageWidth - 2 * margin - 10) / 3;
    const cardHeight = 28;
    const cardSpacing = 5;

    // Card 1: Total Sales
    doc.setFillColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
    doc.roundedRect(margin, cursorY, cardWidth, cardHeight, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(brandSecondary[0], brandSecondary[1], brandSecondary[2]);
    doc.text('TOTAL REVENUE', margin + cardWidth / 2, cursorY + 8, { align: 'center' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(formatCurrency(summary.total_sales), margin + cardWidth / 2, cursorY + 20, { align: 'center' });

    // Card 2: Transaction Count
    doc.setFillColor(brandSecondary[0], brandSecondary[1], brandSecondary[2]);
    doc.roundedRect(margin + cardWidth + cardSpacing, cursorY, cardWidth, cardHeight, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
    doc.text('TRANSACTIONS', margin + cardWidth + cardSpacing + cardWidth / 2, cursorY + 8, { align: 'center' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(summary.transaction_count.toString(), margin + cardWidth + cardSpacing + cardWidth / 2, cursorY + 20, { align: 'center' });

    // Card 3: Average Transaction Value
    doc.setFillColor(brandDark[0], brandDark[1], brandDark[2]);
    doc.roundedRect(margin + 2 * (cardWidth + cardSpacing), cursorY, cardWidth, cardHeight, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(brandSecondary[0], brandSecondary[1], brandSecondary[2]);
    doc.text('AVG TRANSACTION', margin + 2 * (cardWidth + cardSpacing) + cardWidth / 2, cursorY + 8, { align: 'center' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(formatCurrency(summary.avg_transaction_value), margin + 2 * (cardWidth + cardSpacing) + cardWidth / 2, cursorY + 20, { align: 'center' });

    cursorY += cardHeight + 15;

    // ===== PAYMENT METHOD BREAKDOWN TABLE =====
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
    doc.text('REVENUE BY PAYMENT METHOD', margin, cursorY);
    
    doc.setDrawColor(brandSecondary[0], brandSecondary[1], brandSecondary[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, cursorY + 2, margin + 80, cursorY + 2);
    cursorY += 8;

    const paymentData = (salesData?.payment_method_breakdown || []).map((pm: any) => [
        pm.payment_method || 'Unknown',
        pm.transaction_count || 0,
        formatCurrency(pm.total_sales),
        `${(pm.percentage || 0).toFixed(1)}%`
    ]);

    autoTable(doc, {
        startY: cursorY,
        head: [['Payment Method', 'Transactions', 'Total Amount', '% of Sales']],
        body: paymentData,
        theme: 'grid',
        headStyles: { 
            fillColor: brandPrimary,
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: 'bold',
            halign: 'center'
        },
        bodyStyles: {
            fontSize: 9,
            textColor: brandDark
        },
        alternateRowStyles: {
            fillColor: [250, 250, 245]
        },
        columnStyles: {
            0: { halign: 'left', cellWidth: 50 },
            1: { halign: 'center', cellWidth: 35 },
            2: { halign: 'right', cellWidth: 45 },
            3: { halign: 'center', cellWidth: 30 }
        },
        margin: { left: margin, right: margin }
    });

    cursorY = (doc as any).lastAutoTable.finalY + 15;

    // ===== CATEGORY BREAKDOWN TABLE =====
    if (cursorY > 240) { 
        doc.addPage(); 
        cursorY = 20; 
        // Add page header for continuation
        doc.setFillColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
        doc.rect(0, 0, pageWidth, 15, 'F');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('FAMOUSGATE HOTELS - Branch Sales Report (Continued)', pageWidth / 2, 10, { align: 'center' });
        cursorY = 25;
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
    doc.text('REVENUE BY CATEGORY', margin, cursorY);
    
    doc.setDrawColor(brandSecondary[0], brandSecondary[1], brandSecondary[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, cursorY + 2, margin + 65, cursorY + 2);
    cursorY += 8;

    const categoryData = (salesData?.category_breakdown || []).map((cat: any) => [
        cat.category || 'Unknown',
        cat.transaction_count || 0,
        formatCurrency(cat.total_sales),
        `${(cat.percentage || 0).toFixed(1)}%`
    ]);

    autoTable(doc, {
        startY: cursorY,
        head: [['Category', 'Items Sold', 'Total Amount', '% of Sales']],
        body: categoryData,
        theme: 'grid',
        headStyles: { 
            fillColor: brandSecondary,
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: 'bold',
            halign: 'center'
        },
        bodyStyles: {
            fontSize: 9,
            textColor: brandDark
        },
        alternateRowStyles: {
            fillColor: [250, 250, 245]
        },
        columnStyles: {
            0: { halign: 'left', cellWidth: 50 },
            1: { halign: 'center', cellWidth: 35 },
            2: { halign: 'right', cellWidth: 45 },
            3: { halign: 'center', cellWidth: 30 }
        },
        margin: { left: margin, right: margin }
    });

    cursorY = (doc as any).lastAutoTable.finalY + 15;

    // ===== DAILY SALES BREAKDOWN TABLE =====
    if (cursorY > 220) { 
        doc.addPage(); 
        cursorY = 20;
        // Add page header for continuation
        doc.setFillColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
        doc.rect(0, 0, pageWidth, 15, 'F');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('FAMOUSGATE HOTELS - Branch Sales Report (Continued)', pageWidth / 2, 10, { align: 'center' });
        cursorY = 25;
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
    doc.text('DAILY SALES BREAKDOWN', margin, cursorY);
    
    doc.setDrawColor(brandSecondary[0], brandSecondary[1], brandSecondary[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, cursorY + 2, margin + 65, cursorY + 2);
    cursorY += 8;

    const dailyData = (salesData?.daily_breakdown || []).map((day: any) => [
        formatDate(day.date),
        day.transaction_count || 0,
        formatCurrency(day.total_sales),
        formatCurrency(day.avg_transaction_value)
    ]);

    autoTable(doc, {
        startY: cursorY,
        head: [['Date', 'Transactions', 'Total Sales', 'Avg Value']],
        body: dailyData,
        theme: 'grid',
        headStyles: { 
            fillColor: brandDark,
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: 'bold',
            halign: 'center'
        },
        bodyStyles: {
            fontSize: 9,
            textColor: brandDark
        },
        alternateRowStyles: {
            fillColor: [250, 250, 245]
        },
        columnStyles: {
            0: { halign: 'left', cellWidth: 40 },
            1: { halign: 'center', cellWidth: 35 },
            2: { halign: 'right', cellWidth: 45 },
            3: { halign: 'right', cellWidth: 40 }
        },
        margin: { left: margin, right: margin }
    });

    // ===== BRANDED FOOTER ON ALL PAGES =====
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        
        // Footer background
        doc.setFillColor(brandLight[0], brandLight[1], brandLight[2]);
        doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
        
        // Footer text
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
        doc.text('FamousGate Hotels | Excellence in Hospitality', pageWidth / 2, pageHeight - 7, { align: 'center' });
        
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
        
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text('Confidential - For Internal Use Only', margin, pageHeight - 7);
    }

    return doc;
};

export const downloadBranchSalesPDF = async (salesData: any, metadata: any) => {
    try {
        const doc = await generateBranchSalesPDF(salesData, metadata);
        const safeStartDate = (metadata?.startDate || 'start').replace(/[/\\?%*:|"<>]/g, '_');
        const safeEndDate = (metadata?.endDate || 'end').replace(/[/\\?%*:|"<>]/g, '_');
        doc.save(`Branch_Sales_Report_${safeStartDate}_to_${safeEndDate}.pdf`);
        return true;
    } catch (error) {
        console.error('Download error:', error);
        throw error;
    }
};
