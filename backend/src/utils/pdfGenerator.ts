import PDFDocument from 'pdfkit';
import { Buffer } from 'buffer';

export interface PayslipData {
    month: string;
    year: number;
    basic_salary: number;
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
    };
    company?: string;
    company_email?: string;
    company_address?: string;
}

export const generatePayslipPDF = (data: PayslipData): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err) => reject(err));

        // Colors
        const FG_DARK = '#3C3C43';
        const FG_GRAY = '#8E8E93';
        const HEADER_GRAY = '#D9D9D9';

        // Header
        // Logo placeholder (since we don't have the file easily here, we'll use a rect or text)
        doc.fillColor(FG_DARK).rect(50, 45, 40, 40).fill();
        doc.fillColor('white').fontSize(20).text('F', 62, 55);

        doc.fillColor(FG_GRAY).fontSize(10).text('SmithBrand', 100, 50);
        doc.fillColor(FG_DARK).fontSize(22).font('Helvetica-Bold').text('PAYSLIP', 100, 65);
        doc.fillColor(FG_GRAY).fontSize(8).font('Helvetica').text(`${data.company_email || 'accounts@famousgate.co.ke'} | ${data.company_address || 'Kericho-Kisumu Highway, Kericho, Kenya'}`, 100, 95);

        doc.moveDown(3);

        // Body Title
        doc.fillColor(FG_DARK).fontSize(20).font('Helvetica-Bold').text('Payslip', { align: 'center' });
        doc.fontSize(11).font('Helvetica').text(`Pay Period: ${data.month} ${data.year}`, { align: 'center' });

        doc.moveDown(2);

        // Employee Info
        const name = `${data.employee.user.first_name} ${data.employee.user.last_name}`;
        const id = data.employee.kra_pin || data.employee.national_id || 'N/A';
        const position = data.employee.employee_type || 'Staff';

        doc.fontSize(10).font('Helvetica-Bold').text('Employee Name: ', { continued: true }).font('Helvetica').text(name);
        doc.font('Helvetica-Bold').text('Employee PIN/ID: ', { continued: true }).font('Helvetica').text(id);
        doc.font('Helvetica-Bold').text('Position: ', { continued: true }).font('Helvetica').text(position);

        doc.moveDown(2);

        // Financial Table
        const tableTop = doc.y;
        const col1 = 50;
        const col2 = 200;
        const col3 = 300;
        const col4 = 450;
        const rowHeight = 25;

        // Table Header
        doc.rect(col1, tableTop, 500, rowHeight).fill(HEADER_GRAY);
        doc.fillColor(FG_DARK).font('Helvetica-Bold').fontSize(10);
        doc.text('Earnings', col1 + 10, tableTop + 7);
        doc.text('Amount', col2 + 10, tableTop + 7);
        doc.text('Deductions', col3 + 10, tableTop + 7);
        doc.text('Amount', col4 + 10, tableTop + 7);

        const formatCurrency = (amt: number) => `KES ${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        const rows = [
            ['Base Salary', formatCurrency(data.basic_salary), 'PAYE Tax', formatCurrency(data.paye_tax)],
            ['Overtime Pay', formatCurrency(data.overtime_pay), 'NSSF', formatCurrency(data.nssf_deduction)],
            ['Allowances/Bonuses', formatCurrency(data.allowances), 'SHIF', formatCurrency(data.shif_deduction)],
            ['', '', 'Housing Levy', formatCurrency(data.housing_levy_deduction)],
            ['Gross Salary', formatCurrency(data.gross_pay), 'Other Deductions', formatCurrency(0)],
            ['Total', formatCurrency(data.gross_pay), 'Total', formatCurrency(data.total_deductions)]
        ];

        let currentY = tableTop + rowHeight;
        doc.font('Helvetica').fontSize(9);

        rows.forEach((row, i) => {
            // Background for alternate rows if desired
            if (i % 2 === 1) {
                // doc.rect(col1, currentY, 500, rowHeight).fill('#F9F9F9');
            }

            doc.fillColor(FG_DARK);
            if (i === 4 || i === 5) doc.font('Helvetica-Bold'); else doc.font('Helvetica');

            doc.text(row[0], col1 + 10, currentY + 7);
            doc.text(row[1], col2 + 10, currentY + 7, { align: 'right', width: col3 - col2 - 20 });
            doc.text(row[2], col3 + 10, currentY + 7);
            doc.text(row[3], col4 + 10, currentY + 7, { align: 'right', width: 100 });

            // Borders
            doc.rect(col1, currentY, 500, rowHeight).stroke(FG_GRAY);
            doc.lineCap('butt').moveTo(col2, currentY).lineTo(col2, currentY + rowHeight).stroke(FG_GRAY);
            doc.moveTo(col3, currentY).lineTo(col3, currentY + rowHeight).stroke(FG_GRAY);
            doc.moveTo(col4, currentY).lineTo(col4, currentY + rowHeight).stroke(FG_GRAY);

            currentY += rowHeight;
        });

        doc.moveDown(2);

        // Net Pay Table
        const netTop = doc.y;
        doc.rect(col1, netTop, 500, rowHeight).fill(HEADER_GRAY);
        doc.fillColor(FG_DARK).font('Helvetica-Bold').fontSize(10);
        doc.text('Net Pay', col1 + 10, netTop + 7);
        doc.text('Amount', col3 + 10, netTop + 7);

        doc.rect(col1, netTop + rowHeight, 500, rowHeight).stroke(FG_GRAY);
        doc.font('Helvetica').text('Net Pay', col1 + 10, netTop + rowHeight + 7);
        doc.font('Helvetica-Bold').text(formatCurrency(data.net_salary), col3 + 10, netTop + rowHeight + 7, { align: 'right', width: col4 - col3 + 100 - 10 });
        doc.moveTo(col3, netTop).lineTo(col3, netTop + 2 * rowHeight).stroke(FG_GRAY);

        doc.moveDown(3);

        // Footer
        doc.font('Helvetica').fontSize(9).text(`If you need further assistance, please feel free to contact HR at ${data.company_email || 'accounts@famousgate.co.ke'}.`, { align: 'left' });

        doc.end();
    });
};
