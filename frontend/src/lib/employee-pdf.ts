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
    national_id?: string;
    id_number?: string;
    status: 'active' | 'inactive';
}

interface PDFOptions {
    branchMap?: Record<string, string>;
    departmentMap?: Record<string, string>;
    branchName?: string;
}

export const generateEmployeePDF = async (staff: StaffMember[], options: PDFOptions = {}) => {
    const doc = new jsPDF() as any;
    const margin = 20;
    let cursorY = 20;

    // 1. Logo & Branded Header
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

    // Company Identity (Right Side)
    doc.setFontSize(22);
    doc.setTextColor(44, 62, 80); // Dark Corporate Blue
    doc.setFont('helvetica', 'bold');
    doc.text('PERSONNEL REGISTRY', 190, cursorY + 10, { align: 'right' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    cursorY += 15;
    doc.text('FamousGate Hotels & Resorts', 190, cursorY, { align: 'right' });
    cursorY += 5;
    doc.text('Human Resources Department', 190, cursorY, { align: 'right' });
    cursorY += 5;
    doc.text(`Generated: ${new Date().toLocaleString()}`, 190, cursorY, { align: 'right' });

    cursorY = 60;
    doc.setDrawColor(44, 62, 80);
    doc.setLineWidth(0.5);
    doc.line(margin, cursorY, 190, cursorY);
    cursorY += 15;

    // 2. Report Summary Header
    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80);
    doc.setFont('helvetica', 'bold');
    doc.text('EMPLOYEE AUDIT SUMMARY', margin, cursorY);
    
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Total Personnel Count: ${staff.length}`, 190, cursorY, { align: 'right' });
    
    cursorY += 10;

    // Summary Table (Cleaner than free text)
    const activeCount = staff.filter(s => s.status === 'active').length;
    const inactiveCount = staff.length - activeCount;

    autoTable(doc, {
        startY: cursorY,
        body: [
            ['Active Personnel', activeCount, 'Inactive/Archived', inactiveCount],
            ['Generation Date', formatDate(new Date().toISOString()), 'Registry Scope', options.branchName || 'All Branches']
        ],
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 
            0: { fontStyle: 'bold', fillColor: [245, 245, 245], cellWidth: 40 }, 
            2: { fontStyle: 'bold', fillColor: [245, 245, 245], cellWidth: 40 } 
        },
        margin: { left: margin, right: margin }
    });

    cursorY = (doc as any).lastAutoTable.finalY + 15;

    // 3. Main Employee Data Table
    const tableData = staff.map((member) => {
        const fullName = `${member.first_name || ''} ${member.last_name || ''}`.trim();
        const branchName = member.branch_id && options.branchMap ? (options.branchMap[member.branch_id] || member.branch_id) : (member.branch_id || '-');
        const deptName = member.department && options.departmentMap ? (options.departmentMap[member.department] || member.department) : (member.department || '-');
        const systemId = member.id_number || member.id.substring(0, 8).toUpperCase();

        return [
            systemId,
            fullName,
            member.role || '-',
            deptName,
            branchName,
            member.phone || '-',
            member.status === 'active' ? 'ACTIVE' : 'INACTIVE'
        ];
    });

    autoTable(doc, {
        startY: cursorY,
        head: [['SYSTEM ID', 'FULL NAME', 'DESIGNATION', 'DEPARTMENT', 'BRANCH', 'CONTACT', 'STATUS']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [44, 62, 80], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
            0: { fontStyle: 'bold', halign: 'center' },
            6: { fontStyle: 'bold', halign: 'center' }
        },
        margin: { left: margin, right: margin },
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 6) {
                if (data.cell.raw === 'ACTIVE') {
                    data.cell.styles.textColor = [34, 139, 34]; // Forest Green
                } else {
                    data.cell.styles.textColor = [128, 128, 128]; // Gray
                }
            }
        }
    });

    // 4. Branded Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.line(margin, 280, 190, 280); // Footer line
        doc.text('FamousGate Hotels & Resorts | Personnel Registry Management System', 105, 287, { align: 'center' });
        doc.text(`Page ${i} of ${pageCount}`, 190, 287, { align: 'right' });
    }

    return doc;
};

export const downloadEmployeePDF = async (staff: StaffMember[], options?: PDFOptions) => {
    const doc = await generateEmployeePDF(staff, options);
    doc.save(`Personnel_Registry_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const printEmployeePDF = async (staff: StaffMember[], options?: PDFOptions) => {
    const doc = await generateEmployeePDF(staff, options);
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
};

