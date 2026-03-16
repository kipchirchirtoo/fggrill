import warnings
import hashlib

# Fix for ReportLab MD5 issue in newer versions
warnings.filterwarnings("ignore", category=DeprecationWarning, module="reportlab")

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from datetime import datetime
import os
import tempfile

class PDFReportGenerator:
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self.setup_custom_styles()
    
    def setup_custom_styles(self):
        """Setup custom paragraph styles"""
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1a1a1a'),
            spaceAfter=30,
            alignment=TA_CENTER
        ))
        
        self.styles.add(ParagraphStyle(
            name='CustomHeading',
            parent=self.styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#2c3e50'),
            spaceAfter=12,
            spaceBefore=12
        ))
        
        self.styles.add(ParagraphStyle(
            name='CustomBody',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#34495e')
        ))
    
    def generate_report(self, report_type, data, filters):
        """Generate PDF report based on type"""
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
        temp_file.close()
        
        # Create PDF document
        doc = SimpleDocTemplate(
            temp_file.name,
            pagesize=A4,
            rightMargin=0.75*inch,
            leftMargin=0.75*inch,
            topMargin=1*inch,
            bottomMargin=1*inch
        )
        
        # Build content
        story = []
        
        # Add header
        story.extend(self._create_header(report_type, filters))
        
        # Add content based on report type
        if report_type == 'financial_summary':
            story.extend(self._create_financial_summary(data))
        elif report_type == 'payroll_summary':
            story.extend(self._create_payroll_summary(data))
        elif report_type == 'inventory_status':
            story.extend(self._create_inventory_status(data))
        elif report_type == 'booking_summary':
            story.extend(self._create_booking_summary(data))
        elif report_type == 'employee_attendance':
            story.extend(self._create_attendance_report(data))
        else:
            story.extend(self._create_generic_report(data))
        
        # Add footer
        story.extend(self._create_footer())
        
        # Build PDF
        doc.build(story)
        
        return temp_file.name
    
    def _create_header(self, report_type, filters):
        """Create report header"""
        elements = []
        
        # Title
        title = report_type.replace('_', ' ').title()
        elements.append(Paragraph(f"FamousGate Hotels", self.styles['CustomTitle']))
        elements.append(Paragraph(title, self.styles['CustomHeading']))
        elements.append(Spacer(1, 0.2*inch))
        
        # Date and filters
        date_str = datetime.now().strftime("%B %d, %Y at %I:%M %p")
        elements.append(Paragraph(f"Generated: {date_str}", self.styles['CustomBody']))
        
        if filters:
            filter_text = self._format_filters(filters)
            elements.append(Paragraph(f"Filters: {filter_text}", self.styles['CustomBody']))
        
        elements.append(Spacer(1, 0.3*inch))
        
        return elements
    
    def _format_filters(self, filters):
        """Format filters for display"""
        filter_parts = []
        if 'startDate' in filters:
            filter_parts.append(f"From {filters['startDate']}")
        if 'endDate' in filters:
            filter_parts.append(f"To {filters['endDate']}")
        if 'branch' in filters:
            filter_parts.append(f"Branch: {filters['branch']}")
        return ", ".join(filter_parts) if filter_parts else "None"
    
    def _create_financial_summary(self, data):
        """Create financial summary report"""
        elements = []
        
        # Summary metrics
        elements.append(Paragraph("Financial Overview", self.styles['CustomHeading']))
        
        summary_data = [
            ['Metric', 'Amount (KES)'],
            ['Total Revenue', f"{data.get('totalRevenue', 0):,.2f}"],
            ['Total Expenses', f"{data.get('totalExpenses', 0):,.2f}"],
            ['Net Profit', f"{data.get('netProfit', 0):,.2f}"],
            ['Operating Margin', f"{data.get('operatingMargin', 0):.2f}%"]
        ]
        
        table = Table(summary_data, colWidths=[3*inch, 2*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#34495e')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#ecf0f1')),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#bdc3c7'))
        ]))
        
        elements.append(table)
        elements.append(Spacer(1, 0.3*inch))
        
        return elements
    
    def _create_payroll_summary(self, data):
        """Create payroll summary report"""
        elements = []
        
        elements.append(Paragraph("Payroll Summary", self.styles['CustomHeading']))
        
        # Employee payroll table
        employees = data.get('employees', [])
        if employees:
            table_data = [['Employee ID', 'Name', 'Position', 'Gross Pay', 'Deductions', 'Net Pay']]
            
            for emp in employees:
                table_data.append([
                    emp.get('employeeId', 'N/A'),
                    emp.get('name', 'N/A'),
                    emp.get('position', 'N/A'),
                    f"{emp.get('grossPay', 0):,.2f}",
                    f"{emp.get('deductions', 0):,.2f}",
                    f"{emp.get('netPay', 0):,.2f}"
                ])
            
            # Add totals
            total_gross = sum(emp.get('grossPay', 0) for emp in employees)
            total_deductions = sum(emp.get('deductions', 0) for emp in employees)
            total_net = sum(emp.get('netPay', 0) for emp in employees)
            
            table_data.append([
                '', '', 'TOTAL', 
                f"{total_gross:,.2f}", 
                f"{total_deductions:,.2f}", 
                f"{total_net:,.2f}"
            ])
            
            col_widths = [1*inch, 1.5*inch, 1.2*inch, 1*inch, 1*inch, 1*inch]
            table = Table(table_data, colWidths=col_widths)
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#34495e')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -2), colors.HexColor('#ecf0f1')),
                ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#bdc3c7')),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#95a5a6'))
            ]))
            
            elements.append(table)
        
        elements.append(Spacer(1, 0.3*inch))
        
        return elements
    
    def _create_inventory_status(self, data):
        """Create inventory status report"""
        elements = []
        
        elements.append(Paragraph("Inventory Status", self.styles['CustomHeading']))
        
        items = data.get('items', [])
        if items:
            table_data = [['Item Code', 'Item Name', 'Category', 'Current Stock', 'Min Stock', 'Status']]
            
            for item in items:
                status = 'Low Stock' if item.get('currentStock', 0) < item.get('minStock', 0) else 'OK'
                table_data.append([
                    item.get('itemCode', 'N/A'),
                    item.get('itemName', 'N/A'),
                    item.get('category', 'N/A'),
                    str(item.get('currentStock', 0)),
                    str(item.get('minStock', 0)),
                    status
                ])
            
            table = Table(table_data)
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#34495e')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#ecf0f1')),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#95a5a6'))
            ]))
            
            elements.append(table)
        
        elements.append(Spacer(1, 0.3*inch))
        
        return elements
    
    def _create_booking_summary(self, data):
        """Create booking summary report"""
        elements = []
        
        elements.append(Paragraph("Booking Summary", self.styles['CustomHeading']))
        
        bookings = data.get('bookings', [])
        if bookings:
            table_data = [['Booking ID', 'Guest Name', 'Room', 'Check-In', 'Check-Out', 'Status']]
            
            for booking in bookings:
                table_data.append([
                    booking.get('bookingId', 'N/A'),
                    booking.get('guestName', 'N/A'),
                    booking.get('roomNumber', 'N/A'),
                    booking.get('checkIn', 'N/A'),
                    booking.get('checkOut', 'N/A'),
                    booking.get('status', 'N/A')
                ])
            
            table = Table(table_data)
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#34495e')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#ecf0f1')),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#95a5a6'))
            ]))
            
            elements.append(table)
        
        elements.append(Spacer(1, 0.3*inch))
        
        return elements
    
    def _create_attendance_report(self, data):
        """Create employee attendance report"""
        elements = []
        
        elements.append(Paragraph("Employee Attendance", self.styles['CustomHeading']))
        
        attendance = data.get('attendance', [])
        if attendance:
            table_data = [['Employee ID', 'Name', 'Date', 'Check-In', 'Check-Out', 'Hours']]
            
            for record in attendance:
                table_data.append([
                    record.get('employeeId', 'N/A'),
                    record.get('name', 'N/A'),
                    record.get('date', 'N/A'),
                    record.get('checkIn', 'N/A'),
                    record.get('checkOut', 'N/A'),
                    record.get('hours', 'N/A')
                ])
            
            table = Table(table_data)
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#34495e')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#ecf0f1')),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#95a5a6'))
            ]))
            
            elements.append(table)
        
        elements.append(Spacer(1, 0.3*inch))
        
        return elements
    
    def _create_generic_report(self, data):
        """Create generic report for unknown types"""
        elements = []
        elements.append(Paragraph("Report Data", self.styles['CustomHeading']))
        elements.append(Paragraph(str(data), self.styles['CustomBody']))
        return elements
    
    def _create_footer(self):
        """Create report footer"""
        elements = []
        elements.append(Spacer(1, 0.5*inch))
        footer_text = f"Generated by FamousGate Hotels Management System | Page generated on {datetime.now().strftime('%Y-%m-%d')}"
        elements.append(Paragraph(footer_text, self.styles['CustomBody']))
        return elements
