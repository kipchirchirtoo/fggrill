import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from './date-utils';

export interface StaffMember {
    id: string;
    first_name: string;
    last_name?: string;
    email?: string;
    role: string;
    branch_id?: string;
    department?: string;
    phone?: string;
    status: 'active' | 'inactive';
}

interface PDFOptions {
    branchMap?: Record<string, string>;
    departmentMap?: Record<string, string>;
}

export const generateEmployeePDF = async (staff: StaffMember[], options: PDFOptions = {}) => {
    const doc = new jsPDF() as any;
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
        doc.setDrawColor(200);
        doc.rect(margin, cursorY, 30, 30);
    }

    doc.setFontSize(22);
    doc.setTextColor(44, 62, 80);
    doc.text('EMPLOYEE REGISTRY', 190, cursorY + 5, { align: 'right' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    cursorY += 15;
    doc.text('FamousGate Hotels', 190, cursorY + 15, { align: 'right' });
    cursorY += 5;
    doc.text('Human Resources Department', 190, cursorY + 15, { align: 'right' });
    cursorY += 5;
    doc.text('Bomet, Kenya | 0706782828', 190, cursorY + 15, { align: 'right' });

    cursorY = 75;
    doc.setDrawColor(200);
    doc.line(margin, cursorY, 190, cursorY);
    cursorY += 10;

    // 2. Report Details
    doc.setFontSize(11);
    doc.setTextColor(44, 62, 80);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORT SUMMARY:', margin, cursorY);

    cursorY += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0);

    doc.text(`Total Employees: ${staff.length}`, margin, cursorY);
    doc.text(`Active Employees: ${staff.filter(s => s.status === 'active').length}`, 120, cursorY);

    cursorY += 5;
    doc.text(`Generated On: ${formatDate(new Date().toISOString())}`, margin, cursorY);

    cursorY += 15;

    // 3. Items Table
    const tableData = staff.map((member) => {
        const fullName = `${member.first_name || ''} ${member.last_name || ''}`.trim();
        const branchName = member.branch_id && options.branchMap ? (options.branchMap[member.branch_id] || member.branch_id) : (member.branch_id || '-');
        const deptName = member.department && options.departmentMap ? (options.departmentMap[member.department] || member.department) : (member.department || '-');

        return [
            fullName,
            member.role || '-',
            deptName,
            branchName,
            member.phone || '-',
            // member.email || '-',
            member.status === 'active' ? 'Active' : 'Inactive'
        ];
    });

    autoTable(doc, {
        startY: cursorY,
        head: [['EMPLOYEE NAME', 'ROLE', 'DEPARTMENT', 'BRANCH', 'PHONE', 'STATUS']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [44, 62, 80], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: margin, right: margin },
        didParseCell: (data) => {
            // Color code the status column (index 5)
            if (data.section === 'body' && data.column.index === 5) {
                if (data.cell.raw === 'Active') {
                    data.cell.styles.textColor = [34, 139, 34]; // Forest Green
                    data.cell.styles.fontStyle = 'bold';
                } else {
                    data.cell.styles.textColor = [128, 128, 128]; // Gray
                }
            }
        }
    });

    // 4. Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Printed on: ${new Date().toLocaleString()}`, margin, 285);
        doc.text(`FamousGate Hotels - HR Registry | Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
    }

    return doc;
};

export const downloadEmployeePDF = async (staff: StaffMember[], options?: PDFOptions) => {
    const doc = await generateEmployeePDF(staff, options);
    doc.save(`Employee_Registry_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const printEmployeePDF = async (staff: StaffMember[], options?: PDFOptions) => {
    const doc = await generateEmployeePDF(staff, options);
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
};
