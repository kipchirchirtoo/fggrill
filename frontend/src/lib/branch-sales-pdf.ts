import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from './date-utils';

export const generateBranchSalesPDF = async (salesData: any, metadata: any) => {
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

    doc.setFontSize(22);
    doc.setTextColor(44, 62, 80);
    doc.text('BRANCH SALES REPORT', 190, cursorY + 5, { align: 'right' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    cursorY += 15;
    
    const branchName = metadata?.branchName || 'FamousGate Hotels';
    doc.text(branchName, 190, cursorY + 15, { align: 'right' });
    cursorY += 5;
    doc.text(`Period: ${formatDate(metadata?.startDate)} to ${formatDate(metadata?.endDate)}`, 190, cursorY + 15, { align: 'right' });

    cursorY = 75;
    doc.setDrawColor(200);
    doc.line(margin, cursorY, 190, cursorY);
    cursorY += 10;

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(val || 0).replace('KES', 'Ksh');
    };

    // 2. Executive Summary
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(44, 62, 80);
    doc.text('EXECUTIVE SUMMARY', margin, cursorY);
    cursorY += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);
    
    const summary = salesData?.summary || { total_sales: 0, transaction_count: 0, avg_transaction_value: 0 };
    doc.text(`Total Sales Revenue: ${formatCurrency(summary.total_sales)}`, margin, cursorY);
    cursorY += 6;
    doc.text(`Total Transactions: ${summary.transaction_count}`, margin, cursorY);
    cursorY += 6;
    doc.text(`Average Transaction Value: ${formatCurrency(summary.avg_transaction_value)}`, margin, cursorY);
    cursorY += 15;

    // 3. Payment Method Breakdown Table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(44, 62, 80);
    doc.text('REVENUE BY PAYMENT METHOD', margin, cursorY);
    cursorY += 5;

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
        theme: 'striped',
        headStyles: { fillColor: [44, 62, 80], textColor: 255 },
        margin: { left: margin, right: margin }
    });

    cursorY = (doc as any).lastAutoTable.finalY + 15;

    // 4. Category Breakdown Table
    if (cursorY > 240) { doc.addPage(); cursorY = 20; }
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(44, 62, 80);
    doc.text('REVENUE BY CATEGORY', margin, cursorY);
    cursorY += 5;

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
        theme: 'striped',
        headStyles: { fillColor: [44, 62, 80], textColor: 255 },
        margin: { left: margin, right: margin }
    });

    cursorY = (doc as any).lastAutoTable.finalY + 15;

    // 5. Daily Sales Breakdown Table
    if (cursorY > 220) { doc.addPage(); cursorY = 20; }
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(44, 62, 80);
    doc.text('DAILY SALES BREAKDOWN', margin, cursorY);
    cursorY += 5;

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
        theme: 'plain',
        headStyles: { fillColor: [240, 240, 240], textColor: [44, 62, 80] },
        styles: { fontSize: 9 },
        margin: { left: margin, right: margin }
    });

    // 6. Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('FamousGate Hotels - Branch Manager Analytics Dashboard', 105, 285, { align: 'center' });
        doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: 'right' });
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
