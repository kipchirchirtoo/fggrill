import PDFDocument from 'pdfkit';
import { Buffer } from 'buffer';
import path from 'path';
import fs from 'fs';

export interface PayslipData {
    month: string;
    year: number;
    base_salary: number;
    overtime_pay: number;
    allowances: number;
    gross_pay: number;
    paye_tax: number;
    nssf_deduction: number;
    shif_deduction: number;
    housing_levy_deduction: number;
    total_deductions: number;
    net_salary: number;
    employee: {
        kra_pin?: string;
        national_id?: string;
        employee_type?: string;
        user: {
            first_name: string;
            last_name: string;
        };
        bank_name?: string;
        bank_account_number?: string;
        department?: string;
    };
    company?: string;
    company_email?: string;
    company_address?: string;
}

export const generatePayslipPDF = (data: PayslipData): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err) => reject(err));

        // Colors - Premium Palette
        const PRIMARY = '#1a1a1a';
        const SECONDARY = '#555555';
        const ACCENT = '#0066cc';
        const BORDER = '#e0e0e0';
        const ROW_BG = '#f9f9f9';
        const HEADER_BG = '#333333';

        // Header Section
        const logoPath = path.join(process.cwd(), '../frontend/public/fglogo.png');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 40, 40, { width: 60 });
        } else {
            // Branded Circle Placeholder
            doc.circle(70, 70, 30).fill(PRIMARY);
            doc.fillColor('white').fontSize(24).font('Helvetica-Bold').text('FG', 54, 60);
        }

        // Company Information (Top Right)
        doc.fillColor(PRIMARY).fontSize(16).font('Helvetica-Bold').text('FamousGateHotels', 120, 40, { align: 'right' });
        doc.fontSize(10).font('Helvetica').text(data.company_address || 'Bomet, Kenya', { align: 'right' });
        doc.text(`Email: ${data.company_email || 'famousgateshotelsbmt@gmail.com'}`, { align: 'right' });
        doc.text('Tel: 0706 782 828', { align: 'right' });

        doc.moveDown(1);
        doc.strokeColor(BORDER).lineWidth(1).moveTo(40, 110).lineTo(555, 110).stroke();

        // Payslip Title & Period
        doc.moveDown(2);
        doc.fillColor(PRIMARY).fontSize(20).font('Helvetica-Bold').text('PAYSLIP', { align: 'center' });
        doc.fontSize(12).font('Helvetica-Bold').text(`${data.month.toUpperCase()} ${data.year}`, { align: 'center' });

        doc.moveDown(2);

        // Employee Information Grid
        const infoY = doc.y;
        doc.rect(40, infoY, 515, 80).stroke(BORDER);

        const leftCol = 50;
        const midCol = 280;

        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Employee Name:', leftCol, infoY + 15);
        doc.font('Helvetica').text(`${data.employee.user.first_name} ${data.employee.user.last_name}`, leftCol + 90, infoY + 15);

        doc.font('Helvetica-Bold').text('Employee ID:', leftCol, infoY + 35);
        doc.font('Helvetica').text(data.employee.national_id || 'N/A', leftCol + 90, infoY + 35);

        doc.font('Helvetica-Bold').text('Position:', leftCol, infoY + 55);
        doc.font('Helvetica').text(data.employee.employee_type || 'Staff', leftCol + 90, infoY + 55);

        doc.font('Helvetica-Bold').text('Department:', midCol, infoY + 15);
        doc.font('Helvetica').text(data.employee.department || 'General', midCol + 90, infoY + 15);

        doc.font('Helvetica-Bold').text('Bank Account:', midCol, infoY + 35);
        doc.font('Helvetica').text(data.employee.bank_account_number || 'N/A', midCol + 90, infoY + 35);

        doc.font('Helvetica-Bold').text('Bank Name:', midCol, infoY + 55);
        doc.font('Helvetica').text(data.employee.bank_name || 'N/A', midCol + 90, infoY + 55);

        doc.moveDown(4);

        // Table Constants
        const tableTop = doc.y;
        const col1W = 160; // Category name
        const col2W = 100; // Amount
        const col3W = 160; // Category name
        const col4W = 95;  // Amount
        const rowH = 25;

        // Table Header
        doc.rect(40, tableTop, 515, rowH).fill(HEADER_BG);
        doc.fillColor('white').font('Helvetica-Bold').fontSize(10);
        doc.text('EARNINGS', 40 + 10, tableTop + 7);
        doc.text('AMOUNT', 40 + col1W + 10, tableTop + 7, { width: col2W - 20, align: 'right' });
        doc.text('DEDUCTIONS', 40 + col1W + col2W + 10, tableTop + 7);
        doc.text('AMOUNT', 40 + col1W + col2W + col3W + 10, tableTop + 7, { width: col4W - 20, align: 'right' });

        const formatCurrency = (amt: number) => amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const rows = [
            ['Basic Salary', formatCurrency(data.base_salary), 'PAYE Tax', formatCurrency(data.paye_tax)],
            ['Overtime Pay', formatCurrency(data.overtime_pay), 'NSSF (Tier I+II)', formatCurrency(data.nssf_deduction)],
            ['Allowances', formatCurrency(data.allowances), 'SHIF (Health)', formatCurrency(data.shif_deduction)],
            ['Other Bonuses', formatCurrency(0), 'Housing Levy', formatCurrency(data.housing_levy_deduction)],
            ['', '', 'Other Deductions', formatCurrency(0)],
            ['Total Earnings', formatCurrency(data.gross_pay), 'Total Deductions', formatCurrency(data.total_deductions)]
        ];

        let currentY = tableTop + rowH;

        rows.forEach((row, i) => {
            // Alternating Row Backgrounds
            if (i % 2 === 1) {
                doc.fillColor(ROW_BG).rect(40, currentY, 515, rowH).fill();
            }

            doc.fillColor(PRIMARY).font(i === rows.length - 1 ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);

            // Earnings Column
            doc.text(row[0], 40 + 10, currentY + 7);
            if (row[1]) doc.text(row[1], 40 + col1W + 10, currentY + 7, { width: col2W - 20, align: 'right' });

            // Deductions Column
            doc.text(row[2], 40 + col1W + col2W + 10, currentY + 7);
            if (row[3]) doc.text(row[3], 40 + col1W + col2W + col3W + 10, currentY + 7, { width: col4W - 20, align: 'right' });

            // Horizontal border
            doc.strokeColor(BORDER).lineWidth(0.5).moveTo(40, currentY + rowH).lineTo(555, currentY + rowH).stroke();

            currentY += rowH;
        });

        // Vertical Borders
        doc.strokeColor(BORDER).lineWidth(0.5);
        doc.moveTo(40, tableTop).lineTo(40, currentY).stroke();
        doc.moveTo(40 + col1W, tableTop).lineTo(40 + col1W, currentY).stroke();
        doc.moveTo(40 + col1W + col2W, tableTop).lineTo(40 + col1W + col2W, currentY).stroke();
        doc.moveTo(40 + col1W + col2W + col3W, tableTop).lineTo(40 + col1W + col2W + col3W, currentY).stroke();
        doc.moveTo(555, tableTop).lineTo(555, currentY).stroke();

        doc.moveDown(3);

        // Net Salary Section
        const netY = doc.y;
        doc.rect(300, netY, 255, 40).fill(PRIMARY).stroke(PRIMARY);
        doc.fillColor('white').fontSize(14).font('Helvetica-Bold').text('NET PAYABLE', 315, netY + 13);
        doc.fontSize(16).text(`KES ${formatCurrency(data.net_salary)}`, 400, netY + 12, { align: 'right', width: 140 });

        // Footer Section
        doc.moveDown(6);
        doc.fillColor(SECONDARY).fontSize(8).font('Helvetica');
        doc.text('---------------------------------------------------------', { align: 'center' });
        doc.text('This is a computer generated document and does not require a physical signature.', { align: 'center' });
        doc.moveDown(0.5);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });

        doc.end();
    });
};
