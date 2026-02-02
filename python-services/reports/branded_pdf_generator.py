"""
Famous Gate Hotel - Professional Branded PDF Report Generator
Matches the UI/UX designs from provided templates
"""

import os
import io
from datetime import datetime
from typing import Dict, Any, List, Optional
import hashlib
import warnings

# Fix for ReportLab MD5 issue in newer versions
warnings.filterwarnings("ignore", category=DeprecationWarning, module="reportlab")

from reportlab.lib import colors
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.charts.barcharts import HorizontalBarChart
from reportlab.graphics.charts.legends import Legend
from reportlab.graphics.charts.textlabels import Label
from reportlab.graphics.shapes import Drawing, String
from reportlab.graphics import renderPDF
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, PageBreak, HRFlowable
)
from reportlab.pdfgen import canvas
from PIL import Image as PILImage

# Famous Gate Brand Colors
FG_DARK = colors.HexColor('#3C3C43')
FG_GRAY = colors.HexColor('#8E8E93')
FG_LIGHT = colors.HexColor('#F2F2F7')
FG_GREEN = colors.HexColor('#34C759')
FG_ORANGE = colors.HexColor('#FF9500')
FG_RED = colors.HexColor('#FF3B30')
FG_BLUE = colors.HexColor('#007AFF')
FG_WHITE = colors.white
FG_BLACK = colors.HexColor('#000000')

# Table header colors matching images
HEADER_GREEN = colors.HexColor('#C6EFCE')
HEADER_YELLOW = colors.HexColor('#FFEB9C')
HEADER_BLUE = colors.HexColor('#BDD7EE')
HEADER_GRAY = colors.HexColor('#D9D9D9')
ROW_ALT = colors.HexColor('#F5F5F5')


class BrandedPDFGenerator:
    """Professional PDF report generator with Famous Gate branding"""
    
    # Class-level color constants
    HEADER_GREEN = colors.HexColor('#C6EFCE')
    HEADER_YELLOW = colors.HexColor('#FFEB9C')
    HEADER_BLUE = colors.HexColor('#BDD7EE')
    HEADER_GRAY = colors.HexColor('#D9D9D9')
    ROW_ALT = colors.HexColor('#F5F5F5')
    
    def __init__(self):
        self.logo_path = os.path.join(os.path.dirname(__file__), '..', 'assets', 'fglogo.png')
        self.styles = getSampleStyleSheet()
        self._setup_styles()
    
    def _setup_styles(self):
        """Setup custom paragraph styles"""
        self.styles.add(ParagraphStyle(
            name='ReportTitle',
            parent=self.styles['Heading1'],
            fontSize=18,
            textColor=FG_DARK,
            spaceAfter=6,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        ))
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=12,
            textColor=FG_DARK,
            spaceBefore=12,
            spaceAfter=6,
            fontName='Helvetica-Bold'
        ))
        self.styles.add(ParagraphStyle(
            name='TableHeader',
            parent=self.styles['Normal'],
            fontSize=9,
            textColor=FG_BLACK,
            fontName='Helvetica-Bold',
            alignment=TA_CENTER
        ))
        self.styles.add(ParagraphStyle(
            name='TableCell',
            parent=self.styles['Normal'],
            fontSize=9,
            textColor=FG_BLACK,
            fontName='Helvetica'
        ))
        self.styles.add(ParagraphStyle(
            name='TableText',
            parent=self.styles['Normal'],
            fontSize=8,
            textColor=FG_BLACK,
            fontName='Helvetica'
        ))
        self.styles.add(ParagraphStyle(
            name='SmallText',
            parent=self.styles['Normal'],
            fontSize=8,
            textColor=FG_GRAY
        ))
        self.styles.add(ParagraphStyle(
            name='FooterText',
            parent=self.styles['Normal'],
            fontSize=7,
            textColor=FG_GRAY,
            alignment=TA_CENTER
        ))

    def _get_logo(self, width=1.2*inch):
        """Get logo image for reports"""
        if os.path.exists(self.logo_path):
            try:
                img = Image(self.logo_path, width=width, height=width*0.7)
                return img
            except:
                pass
        return None

    def _create_header(self, report_title: str, date_range: str = None, branch: str = None):
        """Create professional report header with logo"""
        elements = []
        
        # Header table with logo and company info
        header_data = []
        
        logo = self._get_logo(width=1*inch)
        
        # Company info
        company_info = [
            Paragraph("<b>FAMOUS GATE HOTEL & LOUNGE</b>", self.styles['Normal']),
            Paragraph("Kericho-Kisumu Highway", self.styles['SmallText']),
            Paragraph("Kericho, Kenya", self.styles['SmallText']),
            Paragraph("Tel: +254 700 000 000 | Email: accounts@famousgate.co.ke", self.styles['SmallText']),
        ]
        
        # Date info
        now = datetime.now()
        date_info = [
            Paragraph(f"<b>Date:</b> {now.strftime('%d/%m/%Y')}", self.styles['SmallText']),
            Paragraph(f"<b>Time:</b> {now.strftime('%H:%M')}", self.styles['SmallText']),
        ]
        if branch:
            date_info.append(Paragraph(f"<b>Branch:</b> {branch}", self.styles['SmallText']))
        
        if logo:
            header_data.append([logo, company_info, date_info])
        else:
            header_data.append([company_info, '', date_info])
        
        header_table = Table(header_data, colWidths=[1.5*inch, 4*inch, 2*inch])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('ALIGN', (-1, 0), (-1, 0), 'RIGHT'),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 0.2*inch))
        
        # Report title with green background like in images
        title_table = Table([[Paragraph(f"<b>{report_title}</b>", 
            ParagraphStyle('TitleStyle', parent=self.styles['Normal'], 
                          fontSize=14, textColor=FG_BLACK, alignment=TA_CENTER, fontName='Helvetica-Bold'))]], 
            colWidths=[7.5*inch])
        title_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), HEADER_GREEN),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('BOX', (0, 0), (-1, -1), 1, FG_DARK),
        ]))
        elements.append(title_table)
        
        if date_range:
            elements.append(Spacer(1, 0.1*inch))
            elements.append(Paragraph(f"<i>Period: {date_range}</i>", 
                ParagraphStyle('DateRange', parent=self.styles['Normal'], 
                              fontSize=10, textColor=FG_GRAY, alignment=TA_CENTER)))
        
        elements.append(Spacer(1, 0.2*inch))
        return elements

    def _create_footer(self, canvas, doc):
        """Add footer to each page"""
        canvas.saveState()
        canvas.setFont('Helvetica', 7)
        canvas.setFillColor(FG_GRAY)
        
        # Footer text
        footer_text = f"Famous Gate Hotel & Lounge | Confidential | Generated: {datetime.now().strftime('%d/%m/%Y %H:%M')}"
        canvas.drawCentredString(A4[0]/2, 0.4*inch, footer_text)
        
        # Page number
        page_num = f"Page {doc.page}"
        canvas.drawRightString(A4[0] - 0.5*inch, 0.4*inch, page_num)
        
        canvas.restoreState()

    def _format_currency(self, amount, currency='KES'):
        """Format amount as currency"""
        if amount is None:
            return f"{currency} 0.00"
        try:
            return f"{currency} {float(amount):,.2f}"
        except:
            return f"{currency} 0.00"

    def _format_number(self, num):
        """Format number with commas"""
        if num is None:
            return "0"
        try:
            return f"{int(num):,}"
        except:
            return str(num)

    def _format_percent(self, value):
        """Format as percentage"""
        if value is None:
            return "0%"
        try:
            return f"{float(value):.1f}%"
        except:
            return "0%"

    def _get_table_style(self):
        """Get standard table style for reports"""
        return TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_GRAY),
            ('TEXTCOLOR', (0, 0), (-1, 0), FG_BLACK),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('TOPPADDING', (0, 0), (-1, 0), 8),
            ('BACKGROUND', (0, 1), (-1, -1), FG_WHITE),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [FG_WHITE, ROW_ALT]),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ])

    def generate_report(self, report_type: str, data: Dict[str, Any], filters: Dict[str, Any] = None) -> str:
        """Generate PDF report based on type"""
        filters = filters or {}
        
        generators = {
            'daily_sales': self._generate_daily_sales_report,
            'occupancy': self._generate_occupancy_report,
            'financial_summary': self._generate_financial_report,
            'revenue_analysis': self._generate_revenue_report,
            'inventory_status': self._generate_inventory_report,
            'housekeeping': self._generate_housekeeping_report,
            'maintenance': self._generate_maintenance_report,
            'payroll_summary': self._generate_payroll_report,
            'restaurant_sales': self._generate_restaurant_report,
            'bar_sales': self._generate_bar_report,
            'room_supplies': self._generate_room_supplies_report,
            'manager_duty': self._generate_mod_report,
            'reservation': self._generate_reservation_report,
            'arrivals_departures': self._generate_arrivals_report,
            'expense': self._generate_expense_report,
            'stock_movement': self._generate_stock_movement_report,
            'branch_performance': self._generate_branch_performance_report,
            'staff_overview': self._generate_staff_overview_report,
            'compliance': self._generate_compliance_report,
            'branch_comparison': self._generate_branch_comparison_report,
            'kpi_dashboard': self._generate_kpi_dashboard_report,
            'employee_attendance': self._generate_attendance_report,
            'financial_variance': self._generate_financial_variance_report,
            'inventory_discrepancy': self._generate_inventory_discrepancy_report,
            'procurement_analysis': self._generate_procurement_analysis_report,
            'exception_logs': self._generate_exception_logs_report,
            'reconciliation_audit': self._generate_reconciliation_audit_report,
            'stock_usage': self._generate_stock_usage_report,
            'employee_credit': self._generate_employee_credit_report,
            'conference_invoice': self._generate_conference_invoice,
            'conference_summary': self._generate_conference_summary_report,
            'dispatch_note': self._generate_dispatch_note,
        }
        
        # Normalize report type - handle common variations and cases
        report_type = report_type.lower().strip()
        
        # Add aliases for common IDs used in frontend
        aliases = {
            'inventory_status_report': 'inventory_status',
            'stock_movement_report': 'stock_movement',
            'room_supplies_report': 'room_supplies',
            'daily_sales_report': 'daily_sales',
            'financial_summary_report': 'financial_summary',
            'revenue_analysis_report': 'revenue_analysis',
            'expense_report': 'expense',
            'payroll_summary_report': 'payroll_summary',
            'restaurant_sales_report': 'restaurant_sales',
            'bar_sales_report': 'bar_sales',
            'occupancy_report': 'occupancy',
            'housekeeping_report': 'housekeeping',
            'maintenance_report': 'maintenance',
            'mod_report': 'manager_duty',
            'audit_performance': 'reconciliation_audit',
            'compliance_report': 'compliance',
            'attendance_report': 'employee_attendance',
            'dispatch_note_report': 'dispatch_note'
        }
        
        report_type = aliases.get(report_type, report_type)
        
        generator = generators.get(report_type, self._generate_generic_report)
        return generator(data, filters)

    def _generate_reconciliation_audit_report(self, data: Dict, filters: Dict) -> str:
        """Generate Reconciliation Audit Report"""
        elements = []
        
        date_range = f"As of {datetime.now().strftime('%d/%m/%Y')}"
        elements.extend(self._create_header("RECONCILIATION AUDIT REPORT", date_range))
        
        # Summary
        summary = data.get('summary', {})
        summary_data = [
            ['AUDIT SUMMARY', '', '', ''],
            ['Total Discrepancy:', self._format_currency(summary.get('total_discrepancy') or 0),
             'Reconciled Accounts:', str(summary.get('reconciled_count') or 0)],
            ['Pending Accounts:', str(summary.get('pending_count') or 0),
             'Discrepancy Accounts:', str(summary.get('discrepancy_count') or 0)],
        ]
        
        summary_table = Table(summary_data, colWidths=[1.8*inch, 1.8*inch, 1.8*inch, 1.8*inch])
        summary_table.setStyle(TableStyle([
            ('SPAN', (0, 0), (-1, 0)),
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_BLUE),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 1), (2, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Reconciliations Table
        elements.append(Paragraph("<b>ACCOUNT RECONCILIATIONS</b>", self.styles['SectionHeader']))
        
        headers = ['Account Name', 'Type', 'Book Balance', 'Bank Balance', 'Difference', 'Status']
        rec_data = [headers]
        
        for rec in data.get('reconciliations', []):
            status = (rec.get('status') or 'Unknown').upper()
            rec_data.append([
                str(rec.get('account_name') or '')[:25],
                str(rec.get('account_type') or '')[:15],
                self._format_currency(rec.get('book_balance') or 0),
                self._format_currency(rec.get('bank_balance') or 0),
                self._format_currency(rec.get('difference') or 0),
                status
            ])
        
        if len(rec_data) == 1:
            rec_data.append(['No reconciliation data', '-', '-', '-', '-', '-'])
        
        rec_table = Table(rec_data, colWidths=[2*inch, 1*inch, 1.2*inch, 1.2*inch, 1.2*inch, 1*inch])
        rec_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_GREEN),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (2, 0), (4, -1), 'RIGHT'),
            ('ALIGN', (-1, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [FG_WHITE, ROW_ALT]),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(rec_table)
        
        return self._create_pdf(elements)

    def _create_pdf(self, elements: List, filename: str = None, landscape_mode: bool = False) -> str:
        """Create PDF from elements"""
        if not filename:
            filename = f"/tmp/FG_Report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        
        pagesize = landscape(A4) if landscape_mode else A4
        
        doc = SimpleDocTemplate(
            filename,
            pagesize=pagesize,
            rightMargin=0.5*inch,
            leftMargin=0.5*inch,
            topMargin=0.5*inch,
            bottomMargin=0.7*inch
        )
        
        doc.build(elements, onFirstPage=self._create_footer, onLaterPages=self._create_footer)
        return filename

    def _generate_daily_sales_report(self, data: Dict, filters: Dict) -> str:
        """Generate Daily Sales Report - matching bar business report style"""
        elements = []
        
        # Fix date range - if start and end dates are the same, show single date
        start_date = filters.get('start_date', 'N/A')
        end_date = filters.get('end_date', 'N/A')
        if start_date == end_date and start_date != 'N/A':
            date_range = f"Date: {start_date}"
        else:
            date_range = f"Period: {start_date} to {end_date}"
        
        # Get branch name from filters, default to specific branch name if available
        branch = filters.get('branch_name', 'Branch')
        if branch == 'All Branches' and filters.get('branch_id'):
            # Map branch ID to actual branch name
            branch_names = {
                1: 'Famous Gate Bomet (Central)',
                2: 'Famous Gate Bomet Town', 
                3: 'Famous Gate Kericho',
                4: 'Famous Gate Kapsoit',
                5: 'Famous Gate Mogogosiek',
                6: 'Famous Gate Litein',
                7: 'Famous Gate Grill'
            }
            branch_id = int(filters.get('branch_id', 0))
            branch = branch_names.get(branch_id, f'Branch {branch_id}')
        
        elements.extend(self._create_header("DAILY SALES REPORT", date_range, branch))
        
        # Summary section
        summary_data = [
            ['SALES SUMMARY', '', '', ''],
            ['Total Revenue:', self._format_currency(data.get('total_revenue') or 0), 
             'Total Transactions:', self._format_number(data.get('total_transactions') or 0)],
            ['Average Transaction:', self._format_currency(data.get('avg_transaction') or 0),
             'Cash Sales:', self._format_currency(data.get('cash_sales') or 0)],
            ['Card Sales:', self._format_currency(data.get('card_sales') or 0),
             'M-Pesa Sales:', self._format_currency(data.get('mpesa_sales') or 0)],
        ]
        
        summary_table = Table(summary_data, colWidths=[1.8*inch, 1.8*inch, 1.8*inch, 1.8*inch])
        summary_table.setStyle(TableStyle([
            ('SPAN', (0, 0), (-1, 0)),
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_GREEN),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 1), (2, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Sales by Category
        elements.append(Paragraph("<b>SALES BY CATEGORY</b>", self.styles['SectionHeader']))
        
        cat_headers = ['Category', 'Quantity', 'Total Sales', '% of Total']
        cat_data = [cat_headers]
        
        total_rev = data.get('total_revenue', 0)
        categories = data.get('categories', [])
        
        # Add debug info if no categories found
        if not categories and total_rev == 0:
            cat_data.append(['No sales data found for this branch/date', '-', '-', '-'])
        elif not categories:
            cat_data.append(['Sales found but no category breakdown', '-', self._format_currency(total_rev), '100%'])
        else:
            for cat in categories:
                pct = ((cat.get('total') or 0) / total_rev * 100) if total_rev > 0 else 0
                cat_data.append([
                    cat.get('name') or 'Unknown',
                    self._format_number(cat.get('quantity') or 0),
                    self._format_currency(cat.get('total') or 0),
                    self._format_percent(pct)
                ])
        
        # Add total row
        cat_data.append(['TOTAL', '', self._format_currency(data.get('total_revenue', 0)), '100%'])
        
        cat_table = Table(cat_data, colWidths=[2.5*inch, 1.5*inch, 2*inch, 1.5*inch])
        cat_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_YELLOW),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (0, -1), (-1, -1), HEADER_GRAY),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -2), [FG_WHITE, ROW_ALT]),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(cat_table)
        
        return self._create_pdf(elements)

    def _generate_occupancy_report(self, data: Dict, filters: Dict) -> str:
        """Generate Occupancy Report with KPIs"""
        elements = []
        
        date_range = f"{filters.get('start_date', 'N/A')} to {filters.get('end_date', 'N/A')}"
        elements.extend(self._create_header("OCCUPANCY STATUS REPORT", date_range))
        
        # KPI Summary
        kpi_data = [
            ['KEY PERFORMANCE INDICATORS', '', '', ''],
            ['Occupancy Rate:', self._format_percent(data.get('occupancy_rate') or 0),
             'Total Rooms:', self._format_number(data.get('total_rooms') or 0)],
            ['Occupied Rooms:', self._format_number(data.get('occupied_rooms') or 0),
             'Available Rooms:', self._format_number(data.get('available_rooms') or 0)],
            ['ADR (Avg Daily Rate):', self._format_currency(data.get('adr') or 0),
             'RevPAR:', self._format_currency(data.get('revpar') or 0)],
        ]
        
        kpi_table = Table(kpi_data, colWidths=[2*inch, 1.5*inch, 2*inch, 1.5*inch])
        kpi_table.setStyle(TableStyle([
            ('SPAN', (0, 0), (-1, 0)),
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_BLUE),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 1), (2, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(kpi_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Room Type Breakdown
        elements.append(Paragraph("<b>OCCUPANCY BY ROOM TYPE</b>", self.styles['SectionHeader']))
        
        rt_headers = ['Room Type', 'Total', 'Occupied', 'Available', 'Occupancy %', 'Revenue']
        rt_data = [rt_headers]
        
        for rt in data.get('room_types', []):
            rt_data.append([
                rt.get('type') or 'Unknown',
                self._format_number(rt.get('total') or 0),
                self._format_number(rt.get('occupied') or 0),
                self._format_number((rt.get('total') or 0) - (rt.get('occupied') or 0)),
                self._format_percent(rt.get('occupancy_pct') or 0),
                self._format_currency(rt.get('revenue') or 0)
            ])
        
        if len(rt_data) == 1:
            rt_data.append(['No room data', '-', '-', '-', '-', '-'])
        
        rt_table = Table(rt_data, colWidths=[1.8*inch, 1*inch, 1*inch, 1*inch, 1.2*inch, 1.5*inch])
        rt_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_GREEN),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (-1, 1), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [FG_WHITE, ROW_ALT]),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(rt_table)
        
        return self._create_pdf(elements)

    def _generate_financial_report(self, data: Dict, filters: Dict) -> str:
        """Generate Financial Summary Report - matching revenue breakdown style"""
        elements = []
        
        date_range = f"{filters.get('start_date', 'N/A')} to {filters.get('end_date', 'N/A')}"
        elements.extend(self._create_header("FINANCIAL SUMMARY REPORT", date_range))
        
        # Revenue Section - matching the image layout
        elements.append(Paragraph("<b>REVENUE</b>", self.styles['SectionHeader']))
        
        rev_data = [
            ['Rooms', '', 'Lodging', '', self._format_currency(data.get('room_revenue') or 0)],
            ['', '', 'Cancellation / No-Show', '', self._format_currency(0)],
            ['', '', 'Other', '', self._format_currency(0)],
            ['', '', '', 'Total Room Revenue', self._format_currency(data.get('room_revenue') or 0)],
            ['F&B', '', 'Food', '', self._format_currency(data.get('restaurant_revenue') or 0)],
            ['', '', 'Beverage', '', self._format_currency(data.get('bar_revenue') or 0)],
            ['', '', 'Other', '', self._format_currency(0)],
            ['', '', '', 'Total F&B Revenue', self._format_currency((data.get('restaurant_revenue') or 0) + (data.get('bar_revenue') or 0))],
            ['Other Departments', '', 'Meetings & Events', '', self._format_currency(0)],
            ['', '', 'Spa', '', self._format_currency(0)],
            ['', '', 'Parking', '', self._format_currency(0)],
            ['', '', 'Other', '', self._format_currency(data.get('other_revenue') or 0)],
            ['', '', '', 'Total Other Revenue', self._format_currency(data.get('other_revenue') or 0)],
            ['', '', '', '', ''],
            ['', '', '', 'TOTAL REVENUE', self._format_currency(data.get('total_revenue') or 0)],
        ]
        
        rev_table = Table(rev_data, colWidths=[1.5*inch, 0.5*inch, 2*inch, 1.5*inch, 1.5*inch])
        rev_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (3, 3), (3, 3), 'Helvetica-Bold'),
            ('FONTNAME', (3, 7), (3, 7), 'Helvetica-Bold'),
            ('FONTNAME', (3, 12), (3, 12), 'Helvetica-Bold'),
            ('FONTNAME', (3, -1), (-1, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (3, -1), (-1, -1), HEADER_YELLOW),
            ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LINEBELOW', (0, 3), (-1, 3), 0.5, FG_GRAY),
            ('LINEBELOW', (0, 7), (-1, 7), 0.5, FG_GRAY),
            ('LINEBELOW', (0, 12), (-1, 12), 0.5, FG_GRAY),
        ]))
        elements.append(rev_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Expenses Section
        elements.append(Paragraph("<b>EXPENSES</b>", self.styles['SectionHeader']))
        
        exp_data = [
            ['Category', 'Amount', '% of Total'],
            ['Payroll & Benefits', self._format_currency(data.get('payroll_expense') or 0), 
             self._format_percent(data.get('payroll_pct') or 0)],
            ['Utilities', self._format_currency(data.get('utilities_expense') or 0),
             self._format_percent(data.get('utilities_pct') or 0)],
            ['Supplies', self._format_currency(data.get('supplies_expense') or 0),
             self._format_percent(data.get('supplies_pct') or 0)],
            ['Maintenance', self._format_currency(data.get('maintenance_expense') or 0),
             self._format_percent(data.get('maintenance_pct') or 0)],
            ['Other', self._format_currency(data.get('other_expense') or 0),
             self._format_percent(data.get('other_exp_pct') or 0)],
            ['TOTAL EXPENSES', self._format_currency(data.get('total_expenses') or 0), '100%'],
        ]
        
        exp_table = Table(exp_data, colWidths=[3*inch, 2*inch, 1.5*inch])
        exp_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_YELLOW),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (0, -1), (-1, -1), HEADER_GRAY),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(exp_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Net Profit
        profit_data = [
            ['NET PROFIT/LOSS', self._format_currency(data.get('net_profit') or 0), 
             self._format_percent(data.get('profit_margin') or 0) + ' margin']
        ]
        profit_table = Table(profit_data, colWidths=[3*inch, 2*inch, 1.5*inch])
        profit_color = HEADER_GREEN if (data.get('net_profit') or 0) >= 0 else colors.HexColor('#FFCDD2')
        profit_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), profit_color),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 1, FG_DARK),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(profit_table)
        
        return self._create_pdf(elements)

    def _generate_revenue_report(self, data: Dict, filters: Dict) -> str:
        """Generate Revenue Analysis Report"""
        return self._generate_financial_report(data, filters)

    def _generate_inventory_report(self, data: Dict, filters: Dict) -> str:
        """Generate Inventory Status Report - matching purchase status style"""
        elements = []
        
        elements.extend(self._create_header("INVENTORY STATUS REPORT", 
            f"As of {datetime.now().strftime('%d/%m/%Y')}"))
        
        # Summary
        summary_data = [
            ['INVENTORY SUMMARY', '', '', ''],
            ['Total Items:', self._format_number(data.get('total_items') or 0),
             'Total Value:', self._format_currency(data.get('total_value') or 0)],
            ['Low Stock Items:', self._format_number(data.get('low_stock_count') or 0),
             'Out of Stock:', self._format_number(data.get('out_of_stock') or 0)],
        ]
        
        summary_table = Table(summary_data, colWidths=[1.8*inch, 1.8*inch, 1.8*inch, 1.8*inch])
        summary_table.setStyle(TableStyle([
            ('SPAN', (0, 0), (-1, 0)),
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_YELLOW),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 1), (2, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Items table
        elements.append(Paragraph("<b>ITEM DETAILS</b>", self.styles['SectionHeader']))
        
        headers = ['Item Code', 'Item Name', 'Category', 'Qty', 'Min Qty', 'Unit', 'Value', 'Status']
        item_data = [headers]
        
        for item in data.get('items', []):  # Removed limit to allow full inventory
            qty = item.get('quantity') or 0
            min_qty = item.get('min_quantity') or 0
            
            if qty == 0:
                status = 'OUT OF STOCK'
            elif qty < min_qty:
                status = 'LOW STOCK'
            else:
                status = 'OK'
            
            item_data.append([
                Paragraph(str(item.get('code') or ''), self.styles['TableText']),
                Paragraph(str(item.get('name') or ''), self.styles['TableText']),
                Paragraph(str(item.get('category') or ''), self.styles['TableText']),
                self._format_number(qty),
                self._format_number(min_qty),
                str(item.get('unit') or 'pcs'),
                self._format_currency(item.get('value') or 0),
                status
            ])
        
        if len(item_data) == 1:
            item_data.append(['No items', '-', '-', '-', '-', '-', '-', '-'])
        
        item_table = Table(item_data, colWidths=[1.2*inch, 1.4*inch, 1*inch, 0.6*inch, 0.6*inch, 0.5*inch, 1*inch, 0.9*inch])
        item_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_GREEN),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (3, 0), (6, -1), 'RIGHT'),
            ('ALIGN', (-1, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [FG_WHITE, ROW_ALT]),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(item_table)
        
        return self._create_pdf(elements)

    def _generate_housekeeping_report(self, data: Dict, filters: Dict) -> str:
        """Generate Housekeeping Performance Report"""
        elements = []
        
        date_range = f"{filters.get('start_date', 'N/A')} to {filters.get('end_date', 'N/A')}"
        elements.extend(self._create_header("HOUSEKEEPING PERFORMANCE REPORT", date_range))
        
        # Summary
        summary_data = [
            ['PERFORMANCE SUMMARY', '', '', ''],
            ['Rooms Cleaned:', self._format_number(data.get('rooms_cleaned') or 0),
             'Avg Time (mins):', f"{(data.get('avg_time') or 0):.1f}"],
            ['Inspection Pass Rate:', self._format_percent(data.get('pass_rate') or 0),
             'Complaints:', self._format_number(data.get('complaints') or 0)],
        ]
        
        summary_table = Table(summary_data, colWidths=[1.8*inch, 1.8*inch, 1.8*inch, 1.8*inch])
        summary_table.setStyle(TableStyle([
            ('SPAN', (0, 0), (-1, 0)),
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_BLUE),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 1), (2, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Staff Performance
        elements.append(Paragraph("<b>STAFF PERFORMANCE</b>", self.styles['SectionHeader']))
        
        headers = ['Staff Name', 'Rooms Cleaned', 'Avg Time (mins)', 'Pass Rate', 'Rating']
        staff_data = [headers]
        
        for staff in data.get('staff', []):
            staff_data.append([
                staff.get('name') or 'Unknown',
                self._format_number(staff.get('rooms') or 0),
                f"{(staff.get('avg_time') or 0):.1f}",
                self._format_percent(staff.get('pass_rate') or 0),
                f"{(staff.get('rating') or 0):.1f}/5"
            ])
        
        if len(staff_data) == 1:
            staff_data.append(['No staff data', '-', '-', '-', '-'])
        
        staff_table = Table(staff_data, colWidths=[2*inch, 1.5*inch, 1.5*inch, 1.2*inch, 1*inch])
        staff_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_GREEN),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [FG_WHITE, ROW_ALT]),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(staff_table)
        
        return self._create_pdf(elements)

    def _generate_maintenance_report(self, data: Dict, filters: Dict) -> str:
        """Generate Maintenance Log Report - matching incident report style"""
        elements = []
        
        date_range = f"{filters.get('start_date', 'N/A')} to {filters.get('end_date', 'N/A')}"
        elements.extend(self._create_header("MAINTENANCE LOG REPORT", date_range))
        
        # Summary
        summary_data = [
            ['MAINTENANCE SUMMARY', '', '', ''],
            ['Total Requests:', self._format_number(data.get('total_requests') or 0),
             'Completed:', self._format_number(data.get('completed') or 0)],
            ['Pending:', self._format_number(data.get('pending') or 0),
             'In Progress:', self._format_number(data.get('in_progress') or 0)],
            ['Avg Resolution (hrs):', f"{(data.get('avg_resolution') or 0):.1f}", '', ''],
        ]
        
        summary_table = Table(summary_data, colWidths=[1.8*inch, 1.8*inch, 1.8*inch, 1.8*inch])
        summary_table.setStyle(TableStyle([
            ('SPAN', (0, 0), (-1, 0)),
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_GREEN),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 1), (2, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Work Orders
        elements.append(Paragraph("<b>WORK ORDERS</b>", self.styles['SectionHeader']))
        
        headers = ['ID', 'Location', 'Issue', 'Priority', 'Status', 'Assigned To']
        wo_data = [headers]
        
        for wo in data.get('work_orders', [])[:20]:
            wo_data.append([
                wo.get('id') or ''[:8],
                str(wo.get('location') or '')[:15],
                str(wo.get('issue') or '')[:30],
                wo.get('priority') or 'Normal',
                wo.get('status') or 'Pending',
                (wo.get('assigned_to') or 'Unassigned')[:15]
            ])
        
        if len(wo_data) == 1:
            wo_data.append(['No work orders', '-', '-', '-', '-', '-'])
        
        wo_table = Table(wo_data, colWidths=[0.8*inch, 1.2*inch, 2.2*inch, 0.8*inch, 0.9*inch, 1.3*inch])
        wo_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_YELLOW),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [FG_WHITE, ROW_ALT]),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(wo_table)
        
        return self._create_pdf(elements)

    def _generate_payroll_report(self, data: Dict, filters: Dict) -> str:
        """Generate Payroll Summary Report"""
        elements = []
        
        date_range = f"{filters.get('start_date', 'N/A')} to {filters.get('end_date', 'N/A')}"
        elements.extend(self._create_header("PAYROLL SUMMARY REPORT", date_range))
        
        # Summary
        summary_data = [
            ['PAYROLL SUMMARY', '', '', ''],
            ['Total Gross Pay:', self._format_currency(data.get('total_gross') or 0),
             'Total Deductions:', self._format_currency(data.get('total_deductions') or 0)],
            ['PAYE:', self._format_currency(data.get('paye') or 0),
             'NHIF:', self._format_currency(data.get('nhif') or 0)],
            ['NSSF:', self._format_currency(data.get('nssf') or 0),
             'Net Pay:', self._format_currency(data.get('total_net') or 0)],
        ]
        
        summary_table = Table(summary_data, colWidths=[1.8*inch, 1.8*inch, 1.8*inch, 1.8*inch])
        summary_table.setStyle(TableStyle([
            ('SPAN', (0, 0), (-1, 0)),
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_BLUE),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 1), (2, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Employee Details
        elements.append(Paragraph("<b>EMPLOYEE PAYROLL DETAILS</b>", self.styles['SectionHeader']))
        
        headers = ['Emp ID', 'Name', 'Department', 'Gross Pay', 'Deductions', 'Net Pay']
        emp_data = [headers]
        
        for emp in data.get('employees', []):
            emp_data.append([
                emp.get('id') or ''[:8],
                emp.get('name') or 'Unknown'[:20],
                emp.get('department') or 'N/A'[:15],
                self._format_currency(emp.get('gross') or 0),
                self._format_currency(emp.get('deductions') or 0),
                self._format_currency(emp.get('net') or 0)
            ])
        
        if len(emp_data) == 1:
            emp_data.append(['No payroll data', '-', '-', '-', '-', '-'])
        
        # Add totals
        emp_data.append([
            'TOTAL', '', '',
            self._format_currency(data.get('total_gross') or 0),
            self._format_currency(data.get('total_deductions') or 0),
            self._format_currency(data.get('total_net') or 0)
        ])
        
        emp_table = Table(emp_data, colWidths=[0.8*inch, 1.8*inch, 1.2*inch, 1.2*inch, 1.2*inch, 1.2*inch])
        emp_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_GREEN),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (0, -1), (-1, -1), HEADER_GRAY),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (3, 0), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -2), [FG_WHITE, ROW_ALT]),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(emp_table)
        
        return self._create_pdf(elements)

    def _generate_restaurant_report(self, data: Dict, filters: Dict) -> str:
        """Generate Restaurant Sales Report - matching bar business style"""
        elements = []
        
        # Fix date range - if start and end dates are the same, show single date
        start_date = filters.get('start_date', 'N/A')
        end_date = filters.get('end_date', 'N/A')
        if start_date == end_date and start_date != 'N/A':
            date_range = f"Date: {start_date}"
        else:
            date_range = f"Period: {start_date} to {end_date}"
        
        # Get branch name from filters, default to specific branch name if available
        branch = filters.get('branch_name', 'Branch')
        if branch == 'All Branches' and filters.get('branch_id'):
            # Map branch ID to actual branch name
            branch_names = {
                1: 'Famous Gate Bomet (Central)',
                2: 'Famous Gate Bomet Town', 
                3: 'Famous Gate Kericho',
                4: 'Famous Gate Kapsoit',
                5: 'Famous Gate Mogogosiek',
                6: 'Famous Gate Litein',
                7: 'Famous Gate Grill'
            }
            branch_id = int(filters.get('branch_id', 0))
            branch = branch_names.get(branch_id, f'Branch {branch_id}')
        
        elements.extend(self._create_header("RESTAURANT SALES REPORT", date_range, branch))
        
        # Summary
        summary_data = [
            ['SALES SUMMARY', '', '', ''],
            ['Total Revenue:', self._format_currency(data.get('total_revenue') or 0),
             'Total Orders:', self._format_number(data.get('total_orders') or 0)],
            ['Average Order:', self._format_currency(data.get('avg_order') or 0),
             'Dine-In:', self._format_number(data.get('dine_in') or 0)],
            ['Room Service:', self._format_number(data.get('room_service') or 0),
             'Takeaway:', self._format_number(data.get('takeaway') or 0)],
        ]
        
        summary_table = Table(summary_data, colWidths=[1.8*inch, 1.8*inch, 1.8*inch, 1.8*inch])
        summary_table.setStyle(TableStyle([
            ('SPAN', (0, 0), (-1, 0)),
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_GREEN),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 1), (2, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Top Selling Items
        elements.append(Paragraph("<b>TOP SELLING ITEMS</b>", self.styles['SectionHeader']))
        
        headers = ['Item Name', 'Category', 'Quantity Sold', 'Revenue']
        item_data = [headers]
        
        for item in data.get('top_items', [])[:10]:
            item_data.append([
                (item.get('name') or 'Unknown')[:30],
                (item.get('category') or 'Other')[:15],
                self._format_number(item.get('quantity') or 0),
                self._format_currency(item.get('revenue') or 0)
            ])
        
        if len(item_data) == 1:
            item_data.append(['No sales data', '-', '-', '-'])
        
        item_table = Table(item_data, colWidths=[2.5*inch, 1.5*inch, 1.5*inch, 1.5*inch])
        item_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_YELLOW),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [FG_WHITE, ROW_ALT]),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(item_table)
        
        return self._create_pdf(elements)

    def _generate_bar_report(self, data: Dict, filters: Dict) -> str:
        """Generate Bar Sales Report"""
        elements = []
        
        date_range = f"{filters.get('start_date', 'N/A')} to {filters.get('end_date', 'N/A')}"
        elements.extend(self._create_header("BAR & LOUNGE SALES REPORT", date_range))
        
        # Summary
        summary_data = [
            ['SALES SUMMARY', '', '', ''],
            ['Total Revenue:', self._format_currency(data.get('total_revenue') or 0),
             'Total Orders:', self._format_number(data.get('total_orders') or 0)],
            ['Average Order:', self._format_currency(data.get('avg_order') or 0), '', ''],
        ]
        
        summary_table = Table(summary_data, colWidths=[1.8*inch, 1.8*inch, 1.8*inch, 1.8*inch])
        summary_table.setStyle(TableStyle([
            ('SPAN', (0, 0), (-1, 0)),
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_BLUE),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 1), (2, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Top Items
        elements.append(Paragraph("<b>TOP SELLING DRINKS</b>", self.styles['SectionHeader']))
        
        headers = ['Item Name', 'Quantity Sold', 'Revenue']
        item_data = [headers]
        
        for item in data.get('top_items', [])[:10]:
            item_data.append([
                (item.get('name') or 'Unknown')[:30],
                self._format_number(item.get('quantity') or 0),
                self._format_currency(item.get('revenue') or 0)
            ])
        
        if len(item_data) == 1:
            item_data.append(['No sales data', '-', '-'])
        
        item_table = Table(item_data, colWidths=[3*inch, 2*inch, 2*inch])
        item_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_YELLOW),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [FG_WHITE, ROW_ALT]),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(item_table)
        
        return self._create_pdf(elements)

    def _generate_room_supplies_report(self, data: Dict, filters: Dict) -> str:
        """Generate Room Supplies Report"""
        elements = []
        
        elements.extend(self._create_header("ROOM SUPPLIES INVENTORY", 
            f"As of {datetime.now().strftime('%d/%m/%Y')}"))
        
        headers = ['Item Name', 'Category', 'Current Stock', 'Unit', 'Reorder Level', 'Status']
        supply_data = [headers]
        
        for item in data.get('supplies', []):
            qty = item.get('quantity') or 0
            reorder = item.get('reorder_level') or 0
            status = 'LOW' if qty < reorder else 'OK'
            
            supply_data.append([
                (item.get('name') or 'Unknown')[:25],
                (item.get('category') or 'Other')[:15],
                self._format_number(qty),
                (item.get('unit') or 'pcs'),
                self._format_number(reorder),
                status
            ])
        
        if len(supply_data) == 1:
            supply_data.append(['No supplies data', '-', '-', '-', '-', '-'])
        
        supply_table = Table(supply_data, colWidths=[2*inch, 1.3*inch, 1*inch, 0.8*inch, 1*inch, 0.8*inch])
        supply_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_GREEN),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (2, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [FG_WHITE, ROW_ALT]),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(supply_table)
        
        return self._create_pdf(elements)

    def _generate_mod_report(self, data: Dict, filters: Dict) -> str:
        """Generate Manager on Duty Report"""
        elements = []
        
        report_date = filters.get('date', datetime.now().strftime('%Y-%m-%d'))
        elements.extend(self._create_header("MANAGER ON DUTY REPORT", report_date))
        
        # Manager Info
        info_data = [
            ['SHIFT INFORMATION', '', '', ''],
            ['Manager:', data.get('manager_name', 'N/A'),
             'Date:', report_date],
            ['Shift:', data.get('shift', 'Day'),
             'Time:', data.get('time', datetime.now().strftime('%H:%M'))],
        ]
        
        info_table = Table(info_data, colWidths=[1.5*inch, 2*inch, 1.5*inch, 2*inch])
        info_table.setStyle(TableStyle([
            ('SPAN', (0, 0), (-1, 0)),
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_BLUE),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 1), (2, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Operations Summary
        ops_data = [
            ['OPERATIONS SUMMARY', '', '', ''],
            ['Expected Arrivals:', self._format_number(data.get('arrivals', 0)),
             'Expected Departures:', self._format_number(data.get('departures', 0))],
            ['Current Occupancy:', self._format_percent(data.get('occupancy', 0)),
             'Out of Order Rooms:', self._format_number(data.get('ooo_rooms', 0))],
        ]
        
        ops_table = Table(ops_data, colWidths=[1.8*inch, 1.8*inch, 1.8*inch, 1.8*inch])
        ops_table.setStyle(TableStyle([
            ('SPAN', (0, 0), (-1, 0)),
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_GREEN),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 1), (2, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(ops_table)
        
        return self._create_pdf(elements)

    def _generate_attendance_report(self, data: Dict, filters: Dict) -> str:
        """Generate Staff Attendance Report"""
        elements = []
        
        date_range = f"{filters.get('start_date', 'N/A')} to {filters.get('end_date', 'N/A')}"
        branch = filters.get('branch_name', 'Branch')
        elements.extend(self._create_header("STAFF ATTENDANCE REPORT", date_range, branch))
        
        # Summary Section
        summary_data = [
            ['ATTENDANCE SUMMARY', '', '', ''],
            ['Total Staff:', self._format_number(data.get('total_staff') or 0),
             'Total Hours:', f"{data.get('total_hours', 0):.1f}h"],
            ['Present:', self._format_number(data.get('present_count') or 0),
             'Late:', self._format_number(data.get('late_count') or 0)],
            ['Absent:', self._format_number(data.get('absent_count') or 0),
             'On Leave:', self._format_number(data.get('leave_count') or 0)],
        ]
        
        summary_table = Table(summary_data, colWidths=[1.8*inch, 1.8*inch, 1.8*inch, 1.8*inch])
        summary_table.setStyle(TableStyle([
            ('SPAN', (0, 0), (-1, 0)),
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_BLUE),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 1), (2, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Detailed Records
        elements.append(Paragraph("<b>DETAILED ATTENDANCE RECORDS</b>", self.styles['SectionHeader']))
        
        headers = ['Date', 'Employee Name', 'ID', 'Clock In', 'Clock Out', 'Status']
        record_data = [headers]
        
        for record in data.get('records', []):
            clock_in = record.get('clock_in')
            clock_out = record.get('clock_out')
            
            # Format times
            in_time = datetime.fromisoformat(clock_in.replace('Z', '+00:00')).strftime('%H:%M') if clock_in else '--:--'
            out_time = datetime.fromisoformat(clock_out.replace('Z', '+00:00')).strftime('%H:%M') if clock_out else '--:--'
            
            record_data.append([
                record.get('date', ''),
                record.get('name', ''),
                record.get('employee_id', ''),
                in_time,
                out_time,
                record.get('status', '').upper()
            ])
            
        if len(record_data) == 1:
            record_data.append(['No records found', '-', '-', '-', '-', '-'])
            
        record_table = Table(record_data, colWidths=[1.2*inch, 2*inch, 1*inch, 1*inch, 1*inch, 1.3*inch])
        record_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_GREEN),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (3, 0), (5, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [FG_WHITE, ROW_ALT]),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
        ]))
        elements.append(record_table)
        
        return self._create_pdf(elements)

    def _generate_reservation_report(self, data: Dict, filters: Dict) -> str:
        """Generate Reservation Confirmation"""
        elements = []
        
        elements.extend(self._create_header("RESERVATION CONFIRMATION", None))
        
        # Guest Details
        guest_data = [
            ['GUEST INFORMATION', '', '', ''],
            ['Guest Name:', data.get('guest_name', 'N/A'),
             'Email:', data.get('email', 'N/A')],
            ['Phone:', data.get('phone', 'N/A'),
             'ID Number:', data.get('id_number', 'N/A')],
        ]
        
        guest_table = Table(guest_data, colWidths=[1.5*inch, 2*inch, 1.5*inch, 2*inch])
        guest_table.setStyle(TableStyle([
            ('SPAN', (0, 0), (-1, 0)),
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_BLUE),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 1), (2, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(guest_table)
        elements.append(Spacer(1, 0.2*inch))
        
        # Booking Details
        booking_data = [
            ['BOOKING DETAILS', '', '', ''],
            ['Confirmation #:', data.get('confirmation_number', 'N/A'),
             'Room Type:', data.get('room_type', 'N/A')],
            ['Check-In:', data.get('check_in', 'N/A'),
             'Check-Out:', data.get('check_out', 'N/A')],
            ['Room Number:', data.get('room_number', 'TBA'),
             'Guests:', self._format_number(data.get('guests', 1))],
        ]
        
        booking_table = Table(booking_data, colWidths=[1.5*inch, 2*inch, 1.5*inch, 2*inch])
        booking_table.setStyle(TableStyle([
            ('SPAN', (0, 0), (-1, 0)),
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_GREEN),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 1), (2, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(booking_table)
        elements.append(Spacer(1, 0.2*inch))
        
        # Payment
        payment_data = [
            ['PAYMENT SUMMARY', ''],
            ['Room Rate (per night):', self._format_currency(data.get('room_rate', 0))],
            ['Number of Nights:', self._format_number(data.get('nights', 1))],
            ['Subtotal:', self._format_currency(data.get('subtotal', 0))],
            ['Taxes & Fees:', self._format_currency(data.get('taxes', 0))],
            ['TOTAL:', self._format_currency(data.get('total', 0))],
            ['Payment Status:', data.get('payment_status', 'Pending')],
        ]
        
        payment_table = Table(payment_data, colWidths=[3*inch, 2*inch])
        payment_table.setStyle(TableStyle([
            ('SPAN', (0, 0), (-1, 0)),
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_YELLOW),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, -2), (-1, -2), 'Helvetica-Bold'),
            ('BACKGROUND', (0, -2), (-1, -2), HEADER_GRAY),
            ('ALIGN', (-1, 1), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(payment_table)
        
        return self._create_pdf(elements)

    def _generate_arrivals_report(self, data: Dict, filters: Dict) -> str:
        """Generate Arrivals & Departures Report"""
        elements = []
        
        report_date = filters.get('date', datetime.now().strftime('%Y-%m-%d'))
        elements.extend(self._create_header("ARRIVALS & DEPARTURES", report_date))
        
        # Arrivals
        elements.append(Paragraph("<b>EXPECTED ARRIVALS</b>", self.styles['SectionHeader']))
        
        arr_headers = ['Guest Name', 'Room', 'Expected Time', 'Status']
        arr_data = [arr_headers]
        
        for arr in data.get('arrivals', []):
            arr_data.append([
                arr.get('guest_name', 'Unknown')[:25],
                arr.get('room', 'TBA'),
                arr.get('time', 'N/A'),
                arr.get('status', 'Expected')
            ])
        
        if len(arr_data) == 1:
            arr_data.append(['No arrivals scheduled', '-', '-', '-'])
        
        arr_table = Table(arr_data, colWidths=[2.5*inch, 1*inch, 1.5*inch, 1.5*inch])
        arr_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_GREEN),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [FG_WHITE, ROW_ALT]),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(arr_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Departures
        elements.append(Paragraph("<b>EXPECTED DEPARTURES</b>", self.styles['SectionHeader']))
        
        dep_headers = ['Guest Name', 'Room', 'Expected Time', 'Status']
        dep_data = [dep_headers]
        
        for dep in data.get('departures', []):
            dep_data.append([
                dep.get('guest_name', 'Unknown')[:25],
                dep.get('room', 'N/A'),
                dep.get('time', 'N/A'),
                dep.get('status', 'Expected')
            ])
        
        if len(dep_data) == 1:
            dep_data.append(['No departures scheduled', '-', '-', '-'])
        
        dep_table = Table(dep_data, colWidths=[2.5*inch, 1*inch, 1.5*inch, 1.5*inch])
        dep_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_YELLOW),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [FG_WHITE, ROW_ALT]),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(dep_table)
        
        return self._create_pdf(elements)

    def _generate_expense_report(self, data: Dict, filters: Dict) -> str:
        """Generate Expense Report"""
        elements = []
        
        date_range = f"{filters.get('start_date', 'N/A')} to {filters.get('end_date', 'N/A')}"
        elements.extend(self._create_header("EXPENSE REPORT", date_range))
        
        # Summary by Category
        elements.append(Paragraph("<b>EXPENSES BY CATEGORY</b>", self.styles['SectionHeader']))
        
        cat_headers = ['Category', 'Amount', '% of Total']
        cat_data = [cat_headers]
        
        for cat in data.get('by_category', []):
            cat_data.append([
                cat.get('category', 'Other'),
                self._format_currency(cat.get('amount', 0)),
                self._format_percent(cat.get('pct', 0))
            ])
        
        if len(cat_data) == 1:
            cat_data.append(['No expenses', '-', '-'])
        
        cat_data.append(['TOTAL', self._format_currency(data.get('total_expenses', 0)), '100%'])
        
        cat_table = Table(cat_data, colWidths=[3*inch, 2*inch, 1.5*inch])
        cat_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_YELLOW),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (0, -1), (-1, -1), HEADER_GRAY),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -2), [FG_WHITE, ROW_ALT]),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(cat_table)
        
        return self._create_pdf(elements)

    def _generate_stock_movement_report(self, data: Dict, filters: Dict) -> str:
        """Generate Stock Movement Report"""
        elements = []
        
        date_range = f"{filters.get('start_date', 'N/A')} to {filters.get('end_date', 'N/A')}"
        elements.extend(self._create_header("STOCK MOVEMENT REPORT", date_range))
        
        headers = ['Date', 'Item Code', 'Item Name', 'Type', 'Qty', 'From', 'To', 'Reference']
        move_data = [headers]
        
        for m in data.get('movements', [])[:30]:
            move_data.append([
                m.get('date', '')[:10],
                m.get('item_code', '')[:10],
                m.get('item_name', '')[:20],
                m.get('type', '')[:10],
                self._format_number(m.get('quantity', 0)),
                m.get('from', '')[:10],
                m.get('to', '')[:10],
                m.get('reference', '')[:10]
            ])
        
        if len(move_data) == 1:
            move_data.append(['No movements', '-', '-', '-', '-', '-', '-', '-'])
        
        move_table = Table(move_data, colWidths=[0.8*inch, 0.8*inch, 1.5*inch, 0.8*inch, 0.5*inch, 0.8*inch, 0.8*inch, 0.8*inch])
        move_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_GREEN),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 7),
            ('ALIGN', (4, 0), (4, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [FG_WHITE, ROW_ALT]),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        elements.append(move_table)
        
        return self._create_pdf(elements)

    def _generate_branch_performance_report(self, data: Dict, filters: Dict) -> str:
        """Generate Branch Performance Report - Professional dashboard style matching provided templates"""
        elements = []
        
        period = filters.get('period') or 'This Period'
        start_date = filters.get('start_date') or datetime.now().strftime('%d/%m/%Y')
        end_date = filters.get('end_date') or datetime.now().strftime('%d/%m/%Y')
        date_range = f"{start_date} to {end_date}"
        elements.extend(self._create_header("BRANCH PERFORMANCE REPORT", date_range))
        
        # Executive Summary Section - Green header like in template images
        summary_title = Table([['EXECUTIVE SUMMARY']], colWidths=[7.5*inch])
        summary_title.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), HEADER_GREEN),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('BOX', (0, 0), (-1, -1), 1, FG_DARK),
        ]))
        elements.append(summary_title)
        elements.append(Spacer(1, 0.1*inch))
        
        # Summary metrics in 2x2 grid
        total_revenue = data.get('total_revenue') or 0
        total_orders = data.get('total_orders') or 0
        avg_satisfaction = data.get('avg_satisfaction') or 0
        best_performer = data.get('best_performer') or 'N/A'
        worst_performer = data.get('worst_performer') or 'N/A'
        
        summary_data = [
            ['Total Revenue', self._format_currency(total_revenue), 'Total Orders', self._format_number(total_orders)],
            ['Avg Satisfaction', f"{avg_satisfaction:.1f}/5.0", 'Best Performer', best_performer],
            ['Needs Attention', worst_performer, 'Period', period.title()],
        ]
        
        summary_table = Table(summary_data, colWidths=[1.8*inch, 1.9*inch, 1.8*inch, 1.9*inch])
        summary_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (0, 0), (-1, -1), ROW_ALT),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Branch Performance Comparison Table - Blue header like in template
        perf_title = Table([['BRANCH PERFORMANCE COMPARISON']], colWidths=[7.5*inch])
        perf_title.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), HEADER_BLUE),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('BOX', (0, 0), (-1, -1), 1, FG_DARK),
        ]))
        elements.append(perf_title)
        elements.append(Spacer(1, 0.1*inch))
        
        # Performance table headers
        perf_headers = ['Branch', 'Revenue', 'Change', 'Orders', 'AOV', 'Rating', 'Efficiency', 'Target']
        perf_data = [perf_headers]
        
        branches = data.get('branches', [])
        for branch in branches:
            revenue_change = branch.get('revenue_change') or 0
            change_str = f"+{revenue_change:.1f}%" if revenue_change >= 0 else f"{revenue_change:.1f}%"
            
            perf_data.append([
                branch.get('branch_name') or 'Unknown',
                self._format_currency(branch.get('revenue') or 0),
                change_str,
                self._format_number(branch.get('orders') or 0),
                self._format_currency(branch.get('avg_order_value') or 0),
                f"{(branch.get('customer_satisfaction') or 0):.1f}",
                f"{branch.get('staff_efficiency') or 0}%",
                f"{branch.get('target_achievement') or 0}%"
            ])
        
        if len(perf_data) == 1:
            perf_data.append(['No branch data', '-', '-', '-', '-', '-', '-', '-'])
        
        perf_table = Table(perf_data, colWidths=[1.1*inch, 1.1*inch, 0.7*inch, 0.7*inch, 0.9*inch, 0.6*inch, 0.9*inch, 0.7*inch])
        perf_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_YELLOW),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [FG_WHITE, ROW_ALT]),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(perf_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Performance Rating Scale - Like in template images
        rating_title = Table([['PERFORMANCE EVALUATION RATING SCALE']], colWidths=[7.5*inch])
        rating_title.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), HEADER_BLUE),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('BOX', (0, 0), (-1, -1), 1, FG_DARK),
        ]))
        elements.append(rating_title)
        
        rating_data = [
            ['5 - Outstanding', 'Exceeds all targets, exceptional performance'],
            ['4 - Exceeds Expectations', 'Consistently exceeds targets'],
            ['3 - Meets Expectations', 'Meets all required targets'],
            ['2 - Needs Improvement', 'Below target, requires attention'],
            ['1 - Unsatisfactory', 'Significantly below expectations'],
        ]
        
        rating_table = Table(rating_data, colWidths=[2*inch, 5.5*inch])
        rating_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#00B050')),
            ('BACKGROUND', (0, 1), (0, 1), colors.HexColor('#92D050')),
            ('BACKGROUND', (0, 2), (0, 2), colors.HexColor('#FFFF00')),
            ('BACKGROUND', (0, 3), (0, 3), colors.HexColor('#FFC000')),
            ('BACKGROUND', (0, 4), (0, 4), colors.HexColor('#FF0000')),
            ('TEXTCOLOR', (0, 0), (0, 0), FG_WHITE),
            ('TEXTCOLOR', (0, 4), (0, 4), FG_WHITE),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(rating_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Individual Branch Details
        for branch in branches[:4]:  # Limit to 4 branches per page
            branch_title = Table([[f"{branch.get('branch_name', 'Unknown')} - DETAILED METRICS"]], colWidths=[7.5*inch])
            branch_title.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), HEADER_GREEN),
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('BOX', (0, 0), (-1, -1), 1, FG_DARK),
            ]))
            elements.append(branch_title)
            
            # KPIs for this branch
            kpi_data = [
                ['KPI', 'Value', 'Target', 'Status'],
                ['Revenue', self._format_currency(branch.get('revenue') or 0), 
                 self._format_currency((branch.get('revenue') or 0) / ((branch.get('target_achievement') or 100) / 100) if (branch.get('target_achievement') or 0) > 0 else 0),
                 'On Track' if (branch.get('target_achievement') or 0) >= 80 else 'Below Target'],
                ['Orders', self._format_number(branch.get('orders') or 0), '-', 'Active'],
                ['Customer Satisfaction', f"{(branch.get('customer_satisfaction') or 0):.1f}/5.0", '4.0/5.0',
                 'Good' if (branch.get('customer_satisfaction') or 0) >= 4.0 else 'Needs Improvement'],
                ['Staff Efficiency', f"{branch.get('staff_efficiency') or 0}%", '85%',
                 'Good' if (branch.get('staff_efficiency') or 0) >= 85 else 'Needs Improvement'],
                ['Inventory Turnover', f"{branch.get('inventory_turnover') or 0}x", '3x',
                 'Good' if (branch.get('inventory_turnover') or 0) >= 3 else 'Low'],
            ]
            
            kpi_table = Table(kpi_data, colWidths=[2*inch, 1.8*inch, 1.8*inch, 1.9*inch])
            kpi_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), HEADER_GRAY),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
                ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [FG_WHITE, ROW_ALT]),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(kpi_table)
            
            # Top Products
            top_products = branch.get('top_products', [])
            if top_products:
                elements.append(Spacer(1, 0.1*inch))
                prod_data = [['Top Products', 'Units Sold']]
                for prod in top_products[:5]:
                    prod_data.append([prod.get('name', 'Unknown')[:30], self._format_number(prod.get('sales', 0))])
                
                prod_table = Table(prod_data, colWidths=[5.5*inch, 2*inch])
                prod_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), HEADER_YELLOW),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 8),
                    ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
                    ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [FG_WHITE, ROW_ALT]),
                    ('TOPPADDING', (0, 0), (-1, -1), 3),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ]))
                elements.append(prod_table)
            
            elements.append(Spacer(1, 0.2*inch))
        
        # Recommendations Section
        rec_title = Table([['RECOMMENDATIONS & ACTION ITEMS']], colWidths=[7.5*inch])
        rec_title.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), HEADER_YELLOW),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('BOX', (0, 0), (-1, -1), 1, FG_DARK),
        ]))
        elements.append(rec_title)
        
        # Generate recommendations based on data
        recommendations = []
        for branch in branches:
            if (branch.get('target_achievement') or 0) < 80:
                recommendations.append(f"• {branch.get('branch_name', 'Branch')}: Focus on increasing sales to meet targets")
            if (branch.get('customer_satisfaction') or 0) < 4.0:
                recommendations.append(f"• {branch.get('branch_name', 'Branch')}: Improve customer service quality")
            if (branch.get('staff_efficiency') or 0) < 85:
                recommendations.append(f"• {branch.get('branch_name', 'Branch')}: Review staff scheduling and training")
        
        if not recommendations:
            recommendations = ['• All branches performing within acceptable parameters', '• Continue monitoring KPIs regularly']
        
        for rec in recommendations[:6]:
            elements.append(Paragraph(rec, ParagraphStyle('Rec', parent=self.styles['Normal'], fontSize=9, leftIndent=10)))
        
        elements.append(Spacer(1, 0.2*inch))
        
        # Approval Section - Like in template
        approval_data = [
            ['Prepared By:', '_________________', 'Date:', '_________________'],
            ['Reviewed By:', '_________________', 'Date:', '_________________'],
            ['Approved By:', '_________________', 'Date:', '_________________'],
        ]
        
        approval_table = Table(approval_data, colWidths=[1.5*inch, 2.25*inch, 1*inch, 2.25*inch])
        approval_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ]))
        elements.append(approval_table)
        
        return self._create_pdf(elements, landscape_mode=True)

    def _generate_staff_overview_report(self, data: Dict, filters: Dict) -> str:
        """Generate Staff Overview Report"""
        elements = []
        
        # Header
        elements.extend(self._create_header("STAFF OVERVIEW REPORT", 
            f"Generated: {datetime.now().strftime('%d/%m/%Y %H:%M')}"))
        
        # Executive Summary
        elements.append(Paragraph("EXECUTIVE SUMMARY", self.styles['SectionHeader']))
        
        summary_data = [
            ['Total Staff', 'Active', 'On Leave', 'Avg Performance', 'Avg Attendance'],
            [
                str(data.get('total_staff') or 0),
                str(data.get('active_staff') or 0),
                str(data.get('on_leave') or 0),
                f"{(data.get('avg_performance') or 0):.1f}%",
                f"{(data.get('avg_attendance') or 0):.1f}%"
            ]
        ]
        
        summary_table = Table(summary_data, colWidths=[1.5*inch, 1.2*inch, 1.2*inch, 1.5*inch, 1.5*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), self.HEADER_GREEN),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 20))
        
        # Branch Staff Summary
        branch_summaries = data.get('branch_summaries', [])
        if branch_summaries:
            elements.append(Paragraph("BRANCH STAFF SUMMARY", self.styles['SectionHeader']))
            
            branch_data = [['Branch', 'Total Staff', 'Active', 'On Leave', 'Avg Performance', 'Avg Attendance']]
            for branch in branch_summaries:
                branch_data.append([
                    branch.get('branch_name') or 'N/A',
                    str(branch.get('total_staff') or 0),
                    str(branch.get('active') or 0),
                    str(branch.get('on_leave') or 0),
                    f"{(branch.get('avg_performance') or 0):.1f}%",
                    f"{(branch.get('avg_attendance') or 0):.1f}%"
                ])
            
            branch_table = Table(branch_data, colWidths=[1.8*inch, 1*inch, 0.9*inch, 0.9*inch, 1.3*inch, 1.3*inch])
            branch_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), self.HEADER_BLUE),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('ALIGN', (0, 1), (0, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, self.ROW_ALT]),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            elements.append(branch_table)
            elements.append(Spacer(1, 20))
        
        # Top Performers
        top_performers = data.get('top_performers', [])
        if top_performers:
            elements.append(Paragraph("TOP PERFORMERS", self.styles['SectionHeader']))
            
            performer_data = [['Name', 'Branch', 'Role', 'Performance', 'Attendance', 'Rating']]
            for staff in top_performers[:10]:
                performer_data.append([
                    staff.get('name') or 'N/A',
                    staff.get('branch_name') or 'N/A',
                    staff.get('role') or 'N/A',
                    f"{(staff.get('performance_score') or 0):.1f}%",
                    f"{(staff.get('attendance_rate') or 0):.1f}%",
                    f"{(staff.get('customer_rating') or 0):.1f}/5"
                ])
            
            performer_table = Table(performer_data, colWidths=[1.5*inch, 1.3*inch, 1.2*inch, 1.1*inch, 1.1*inch, 0.9*inch])
            performer_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), self.HEADER_GREEN),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('ALIGN', (0, 1), (0, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, self.ROW_ALT]),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            elements.append(performer_table)
            elements.append(Spacer(1, 20))
        
        # Needs Attention
        needs_attention = data.get('needs_attention', [])
        if needs_attention:
            elements.append(Paragraph("STAFF NEEDING ATTENTION", self.styles['SectionHeader']))
            
            attention_data = [['Name', 'Branch', 'Role', 'Performance', 'Attendance', 'Issue']]
            for staff in needs_attention[:10]:
                issue = 'Low Performance' if (staff.get('performance_score') if staff.get('performance_score') is not None else 100) < 70 else 'Low Attendance'
                attention_data.append([
                    staff.get('name') or 'N/A',
                    staff.get('branch_name') or 'N/A',
                    staff.get('role') or 'N/A',
                    f"{(staff.get('performance_score') or 0):.1f}%",
                    f"{(staff.get('attendance_rate') or 0):.1f}%",
                    issue
                ])
            
            attention_table = Table(attention_data, colWidths=[1.5*inch, 1.3*inch, 1.2*inch, 1.1*inch, 1.1*inch, 1.1*inch])
            attention_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), HexColor('#DC2626')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('ALIGN', (0, 1), (0, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, HexColor('#FEE2E2')]),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            elements.append(attention_table)
        
        # Footer with approval section
        elements.append(Spacer(1, 30))
        elements.append(Paragraph("APPROVAL", self.styles['SectionHeader']))
        
        approval_data = [
            ['Prepared By:', '_' * 30, 'Date:', '_' * 20],
            ['Reviewed By:', '_' * 30, 'Date:', '_' * 20],
            ['Approved By:', '_' * 30, 'Date:', '_' * 20],
        ]
        approval_table = Table(approval_data, colWidths=[1.2*inch, 2.5*inch, 0.8*inch, 1.8*inch])
        approval_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 15),
        ]))
        elements.append(approval_table)
        
        return self._create_pdf(elements, landscape_mode=True)

    def _generate_compliance_report(self, data: Dict, filters: Dict) -> str:
        """Generate Compliance Report"""
        elements = []
        
        # Header
        elements.extend(self._create_header("COMPLIANCE REPORT", 
            f"Generated: {datetime.now().strftime('%d/%m/%Y %H:%M')}"))
        
        # Executive Summary
        elements.append(Paragraph("COMPLIANCE OVERVIEW", self.styles['SectionHeader']))
        
        compliance_rate = data.get('overall_compliance_rate') or 0
        rate_color = self.HEADER_GREEN if compliance_rate >= 90 else (self.HEADER_YELLOW if compliance_rate >= 75 else HexColor('#DC2626'))
        
        summary_data = [
            ['Total Requirements', 'Compliant', 'Non-Compliant', 'Pending', 'Expired', 'Compliance Rate'],
            [
                str(data.get('total_requirements') or 0),
                str(data.get('compliant') or 0),
                str(data.get('non_compliant') or 0),
                str(data.get('pending') or 0),
                str(data.get('expired') or 0),
                f"{compliance_rate:.1f}%"
            ]
        ]
        
        summary_table = Table(summary_data, colWidths=[1.4*inch, 1.1*inch, 1.2*inch, 1*inch, 1*inch, 1.3*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), self.HEADER_BLUE),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('BACKGROUND', (-1, 1), (-1, 1), rate_color),
            ('TEXTCOLOR', (-1, 1), (-1, 1), colors.white),
            ('FONTNAME', (-1, 1), (-1, 1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 20))
        
        # Branch Compliance Summary
        branch_summaries = data.get('branch_summaries', [])
        if branch_summaries:
            elements.append(Paragraph("BRANCH COMPLIANCE SUMMARY", self.styles['SectionHeader']))
            
            branch_data = [['Branch', 'Total', 'Compliant', 'Non-Compliant', 'Pending', 'Rate']]
            for branch in branch_summaries:
                rate = branch.get('compliance_rate') or 0
                branch_data.append([
                    branch.get('branch_name') or 'N/A',
                    str(branch.get('total_requirements') or 0),
                    str(branch.get('compliant') or 0),
                    str(branch.get('non_compliant') or 0),
                    str(branch.get('pending') or 0),
                    f"{rate:.1f}%"
                ])
            
            branch_table = Table(branch_data, colWidths=[1.8*inch, 0.9*inch, 1.1*inch, 1.2*inch, 1*inch, 1*inch])
            branch_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), self.HEADER_GREEN),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('ALIGN', (0, 1), (0, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, self.ROW_ALT]),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            elements.append(branch_table)
            elements.append(Spacer(1, 20))
        
        # Critical Issues
        critical_issues = data.get('critical_issues', [])
        if critical_issues:
            elements.append(Paragraph("CRITICAL ISSUES - IMMEDIATE ACTION REQUIRED", self.styles['SectionHeader']))
            
            critical_data = [['Requirement', 'Branch', 'Category', 'Status', 'Due Date']]
            for item in critical_issues[:10]:
                critical_data.append([
                    item.get('requirement', 'N/A')[:40],
                    item.get('branch_name', 'N/A'),
                    item.get('category', 'N/A'),
                    item.get('status', 'N/A').replace('_', ' ').title(),
                    item.get('due_date', 'N/A')[:10] if item.get('due_date') else 'N/A'
                ])
            
            critical_table = Table(critical_data, colWidths=[2.5*inch, 1.3*inch, 1.2*inch, 1.1*inch, 1*inch])
            critical_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), HexColor('#DC2626')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('ALIGN', (0, 1), (0, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, HexColor('#FEE2E2')]),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            elements.append(critical_table)
            elements.append(Spacer(1, 20))
        
        # Upcoming Deadlines
        upcoming = data.get('upcoming_deadlines', [])
        if upcoming:
            elements.append(Paragraph("UPCOMING DEADLINES", self.styles['SectionHeader']))
            
            upcoming_data = [['Requirement', 'Branch', 'Category', 'Due Date', 'Days Left']]
            for item in upcoming[:10]:
                due_date = item.get('due_date', '')
                days_left = 'N/A'
                if due_date:
                    try:
                        from datetime import datetime as dt
                        due = dt.strptime(due_date[:10], '%Y-%m-%d')
                        days_left = (due - dt.now()).days
                        days_left = f"{days_left} days" if days_left > 0 else "Overdue"
                    except:
                        pass
                
                upcoming_data.append([
                    item.get('requirement', 'N/A')[:40],
                    item.get('branch_name', 'N/A'),
                    item.get('category', 'N/A'),
                    due_date[:10] if due_date else 'N/A',
                    str(days_left)
                ])
            
            upcoming_table = Table(upcoming_data, colWidths=[2.5*inch, 1.3*inch, 1.2*inch, 1*inch, 1*inch])
            upcoming_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), self.HEADER_YELLOW),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('ALIGN', (0, 1), (0, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, self.ROW_ALT]),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            elements.append(upcoming_table)
        
        # Footer with approval section
        elements.append(Spacer(1, 30))
        elements.append(Paragraph("APPROVAL", self.styles['SectionHeader']))
        
        approval_data = [
            ['Compliance Officer:', '_' * 30, 'Date:', '_' * 20],
            ['Branch Manager:', '_' * 30, 'Date:', '_' * 20],
            ['General Manager:', '_' * 30, 'Date:', '_' * 20],
        ]
        approval_table = Table(approval_data, colWidths=[1.4*inch, 2.5*inch, 0.8*inch, 1.8*inch])
        approval_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 15),
        ]))
        elements.append(approval_table)
        
        return self._create_pdf(elements, landscape_mode=True)

    def _create_horizontal_bar_chart(self, data, labels, title, width=500, height=300):
        """Create a horizontal bar chart"""
        drawing = Drawing(width, height)
        
        # Create chart
        bc = HorizontalBarChart()
        bc.x = 50
        bc.y = 50
        bc.height = height - 100
        bc.width = width - 100
        bc.data = [data]
        bc.categoryAxis.categoryNames = labels
        bc.categoryAxis.labels.fontName = 'Helvetica'
        bc.categoryAxis.labels.fontSize = 8
        bc.categoryAxis.tickLeft = 0
        bc.categoryAxis.tickRight = 0
        bc.valueAxis.labels.fontName = 'Helvetica'
        bc.valueAxis.labels.fontSize = 8
        bc.valueAxis.visibleGrid = True
        bc.valueAxis.gridStrokeWidth = 0.25
        bc.valueAxis.gridStrokeColor = colors.grey
        bc.bars[0].fillColor = colors.gray
        bc.barLabels.nudge = 10
        bc.barLabelFormat = '%0.1f'
        bc.barLabels.dy = -5
        bc.barLabels.fontSize = 8
        bc.barLabels.fontName = 'Helvetica'
        bc.barLabels.visible = True
        
        # Add title
        title_label = Label()
        title_label.setOrigin(width/2, height-20)
        title_label.boxAnchor = 'n'
        title_label.setText(title)
        title_label.fontName = 'Helvetica-Bold'
        title_label.fontSize = 12
        
        drawing.add(bc)
        drawing.add(title_label)
        
        return drawing

    def _generate_branch_comparison_report(self, data: Dict[str, Any], filters: Dict[str, Any] = None) -> str:
        """Generate Branch Comparison Report
        
        This report compares different branches based on revenue, occupancy, or staff count metrics
        """
        # Extract data
        title = data.get('title', 'Branch Comparison Report')
        period = data.get('period', 'month')
        metric = data.get('metric', 'revenue')
        branches = data.get('branches', [])
        
        # Build elements list for the PDF
        elements = []
        
        # Add report header
        elements.extend(self._create_header(title, period.capitalize()))
        
        # Add report metadata
        metadata = [
            [Paragraph("<b>Report Date:</b>", self.styles['Normal']), Paragraph(datetime.now().strftime('%d %b %Y, %H:%M'), self.styles['Normal'])],
            [Paragraph("<b>Period:</b>", self.styles['Normal']), Paragraph(period.capitalize(), self.styles['Normal'])],
            [Paragraph("<b>Metric:</b>", self.styles['Normal']), Paragraph(metric.replace('_', ' ').capitalize(), self.styles['Normal'])],
        ]
        metadata_table = Table(metadata, colWidths=[1.5*inch, 4*inch])
        metadata_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(metadata_table)
        elements.append(Spacer(1, 0.2*inch))
        
        # Prepare data for chart
        period_label = {
            'week': 'Weekly',
            'month': 'Monthly',
            'quarter': 'Quarterly',
            'year': 'Yearly'
        }.get(period, 'Period')
        
        metric_label = {
            'revenue': 'Revenue (KES)',
            'occupancy': 'Occupancy Rate (%)',
            'staff_count': 'Staff Count'
        }.get(metric, metric.replace('_', ' ').capitalize())
        
        # Sort branches by metric value (descending)
        sorted_branches = sorted(branches, key=lambda x: x.get(metric) or 0, reverse=True)
        
        # Add summary text
        if branches:
            best_branch = sorted_branches[0].get('name', 'Unknown')
            best_value = sorted_branches[0].get(metric) or 0
            formatted_value = self._format_currency(best_value) if metric == 'revenue' else (
                f"{best_value}%" if metric == 'occupancy' else str(best_value)
            )
            
            summary = f"Based on {metric_label} data for the selected {period}, {best_branch} is the top performing branch with a {metric_label} of {formatted_value}."
            elements.append(Paragraph(summary, self.styles['Normal']))
            
            # Add spacer
            elements.append(Spacer(1, 0.2*inch))
        
        # Add comparison chart
        if branches:
            # Create data for chart
            chart_data = []
            chart_labels = []
            
            for branch in sorted_branches:
                chart_data.append(branch.get(metric) or 0)
                chart_labels.append(branch.get('name', 'Unknown')[:15]) # Truncate long names
            
            # Add horizontal bar chart
            chart_title = f"{period_label} {metric_label} by Branch"
            elements.append(self._create_horizontal_bar_chart(chart_data, chart_labels, chart_title))
        
        # Add spacer
        elements.append(Spacer(1, 0.2*inch))
        
        # Add comparison table
        if branches:
            # Table data
            table_data = [
                [Paragraph("<b>Branch</b>", self.styles['TableHeader']), 
                 Paragraph(f"<b>{metric_label}</b>", self.styles['TableHeader']), 
                 Paragraph("<b>Rank</b>", self.styles['TableHeader'])]
            ]
            
            for i, branch in enumerate(sorted_branches, 1):
                branch_name = branch.get('name', 'Unknown')
                value = branch.get(metric) or 0
                
                # Format based on metric type
                if metric == 'revenue':
                    formatted_value = self._format_currency(value)
                elif metric == 'occupancy':
                    formatted_value = f"{value}%"
                else:
                    formatted_value = str(value)
                    
                table_data.append([
                    Paragraph(branch_name, self.styles['TableCell']), 
                    Paragraph(formatted_value, self.styles['TableCell']), 
                    Paragraph(str(i), self.styles['TableCell'])
                ])
            
            # Create and add the table
            comparison_table = Table(table_data, colWidths=[3.5*inch, 2.5*inch, 1*inch])
            comparison_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), self.HEADER_GRAY),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, self.ROW_ALT]),
            ]))
            elements.append(comparison_table)
        
        # Add notes
        elements.append(Spacer(1, 0.3*inch))
        elements.append(Paragraph("<b>Notes:</b>", self.styles['SectionHeader']))
        notes = [
            "This report provides a comparison of branch performance based on selected metrics.",
            f"The period shown is: {period_label}.",
            "Rankings are based on current data and may change over time.",
        ]
        for note in notes:
            elements.append(Paragraph(f"&bull; {note}", self.styles['Normal']))
        
        # Create the PDF
        return self._create_pdf(elements)
    
    def _generate_kpi_dashboard_report(self, data: Dict, filters: Dict) -> str:
        """Generate KPI Dashboard Report"""
        # Implementation for KPI dashboard report
        # For now, just use the generic report generator or a placeholder
        return self._generate_generic_report(data, filters)

    def generate_checkout_bill(self, data: Dict) -> str:
        """Generate Guest Checkout Bill"""
        elements = []
        
        # Custom Header for Bill
        logo = self._get_logo(width=1.5*inch)
        
        # Company info
        company_info = [
            Paragraph("<b>FAMOUS GATE HOTEL & LOUNGE</b>", self.styles['Normal']),
            Paragraph("Main Highway, Nairobi, Kenya", self.styles['SmallText']),
            Paragraph("Tel: +254 700 000 000", self.styles['SmallText']),
            Paragraph("Email: accounts@famousgate.co.ke", self.styles['SmallText']),
        ]
        
        header_data = []
        if logo:
            header_data.append([logo, company_info])
        else:
            header_data.append([company_info, ''])
            
        header_table = Table(header_data, colWidths=[2*inch, 4*inch])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('ALIGN', (1, 0), (1, 0), 'LEFT'),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Bill Title
        elements.append(Paragraph("<b>GUEST BILL / INVOICE</b>", 
            ParagraphStyle('BillTitle', parent=self.styles['Heading1'], alignment=TA_CENTER, fontSize=16, spaceAfter=20)))
        
        # Guest Details Section
        elements.append(Paragraph("<b>Check-Out Guest</b>", self.styles['Heading2']))
        
        guest_name = data.get('guest_name', '').upper()
        guest_phone = data.get('guest_phone', '')
        room_number = data.get('room_number', '')
        nights = data.get('nights', 1)
        
        details_data = [
            [Paragraph(f"<b>{guest_name}</b>", self.styles['Normal'])],
            [Paragraph(f"{guest_phone}", self.styles['Normal'])],
            [Spacer(1, 10)],
            [Paragraph(f"Room {room_number}", self.styles['Normal'])],
            [Spacer(1, 10)],
            [Paragraph(f"{nights} nights", self.styles['Normal'])],
        ]
        
        details_table = Table(details_data, colWidths=[6*inch])
        details_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ]))
        elements.append(details_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Financial Details
        room_charges = data.get('room_charges', 0)
        additional_charges = data.get('additional_charges', 0)
        amount_paid = data.get('amount_paid', 0)
        balance = data.get('balance', 0)
        
        fin_data = [
            ['Room Charges', self._format_currency(room_charges)],
            ['Additional Charges', self._format_currency(additional_charges)],
            ['Amount Paid', f"-{self._format_currency(amount_paid)}"],
            ['Balance', self._format_currency(balance)],
        ]
        
        fin_table = Table(fin_data, colWidths=[4*inch, 2*inch])
        fin_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('TEXTCOLOR', (0, 0), (-1, -1), FG_BLACK),
            ('LINEBELOW', (0, 2), (-1, 2), 1, FG_BLACK), # Line before Balance
            ('FONTNAME', (0, 3), (-1, 3), 'Helvetica-Bold'), # Bold Balance row
            ('FONTSIZE', (0, 3), (-1, 3), 12),
        ]))
        elements.append(fin_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Outstanding Balance Warning
        if balance > 0:
            elements.append(Paragraph("<b>Outstanding balance must be settled</b>", 
                ParagraphStyle('Warning', parent=self.styles['Normal'], textColor=FG_RED, alignment=TA_CENTER)))
        
        # Barcode for Cashier Scanning
        elements.append(Spacer(1, 0.5*inch))
        try:
            # Import here to avoid circular imports if any
            from barcode_generator.routes import barcode_service
            
            # Generate barcode for booking ID (or room number if booking ID not available, but booking ID is best)
            # Assuming data has booking_id, if not use room_number as fallback
            scan_code = data.get('booking_id', f"HTL-{room_number}")
            
            barcode_bytes = barcode_service.generate_barcode(scan_code, include_text=True)
            barcode_img = Image(io.BytesIO(barcode_bytes), width=2.5*inch, height=0.8*inch)
            elements.append(barcode_img)
            elements.append(Paragraph("Scan at Cashier", self.styles['SmallText']))
        except Exception as e:
            print(f"Error adding barcode: {e}")
            # Continue without barcode
        
        # Footer
        elements.append(Spacer(1, 1*inch))
        elements.append(Paragraph("Thank you for staying with us!", 
            ParagraphStyle('FooterThanks', parent=self.styles['Normal'], alignment=TA_CENTER, fontName='Helvetica-Oblique')))
            
        return self._create_pdf(elements, filename=f"/tmp/Bill_{guest_name.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d')}.pdf")

    def _generate_conference_invoice(self, data: Dict, filters: Dict) -> str:
        """Generate Professional Conference Invoice"""
        elements = []
        
        # Header
        elements.extend(self._create_header("CONFERENCE BOOKING & INVOICE", None))
        
        # Client & Event Info
        elements.append(Paragraph("<b>CLIENT & EVENT INFORMATION</b>", self.styles['SectionHeader']))
        
        client_data = [
            ['Company/Group:', data.get('company_name', 'N/A'), 'Invoice #:', data.get('invoice_number', 'N/A')],
            ['Contact Person:', data.get('contact_person', 'N/A'), 'Date:', datetime.now().strftime('%d/%m/%Y')],
            ['Event Type:', data.get('activity_type', 'N/A'), 'PAX Count:', str(data.get('num_participants', 0))],
            ['Start Date:', data.get('start_date', 'N/A'), 'End Date:', data.get('end_date', 'N/A')],
        ]
        
        client_table = Table(client_data, colWidths=[1.5*inch, 2.25*inch, 1.5*inch, 2.25*inch])
        client_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('BACKGROUND', (0, 0), (0, -1), ROW_ALT),
            ('BACKGROUND', (2, 0), (2, -1), ROW_ALT),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(client_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Cost Breakdown Table
        elements.append(Paragraph("<b>COST BREAKDOWN</b>", self.styles['SectionHeader']))
        
        headers = ['Description', 'Details', 'Qty/Pax', 'Unit Cost', 'Total']
        breakdown_data = [headers]
        
        # 1. Hall Rental
        hall = data.get('hall') or {}
        hall_name = hall.get('name', 'Conference Hall')
        # Simplified display of hall rental logic from controller
        breakdown_data.append([f'Hall Rental: {hall_name}', '-', '1', '-', '-']) # Specifics can be added if needed
        
        # 2. Per Pax Charge
        if data.get('amount_per_pax'):
            breakdown_data.append(['Per Participant Charge', 'Hall access & basic amenities', 
                                  str(data.get('num_participants', 0)), 
                                  self._format_currency(data.get('amount_per_pax')),
                                  self._format_currency(data.get('num_participants', 0) * data.get('amount_per_pax', 0))])
            
        # 3. Meals
        meals = data.get('meal_plan_details', [])
        if meals:
            for m in meals:
                breakdown_data.append([f"Meal: {m.get('name')}", "Configured meal plan",
                                      str(m.get('pax', data.get('num_participants', 0))),
                                      self._format_currency(m.get('price', 0)),
                                      self._format_currency(m.get('total', (m.get('pax', data.get('num_participants', 0)) * m.get('price', 0))))])
        
        # 4. Amenities
        amenities = data.get('amenities_details', [])
        if amenities:
            for a in amenities:
                breakdown_data.append([f"Extra: {a.get('name')}", "Optional amenity",
                                      str(a.get('quantity', 0)),
                                      self._format_currency(a.get('unit_cost', 0)),
                                      self._format_currency(a.get('total', (a.get('quantity', 0) * a.get('unit_cost', 0))))])
        
        # Total Row
        breakdown_data.append(['', '', '', '<b>GRAND TOTAL</b>', f"<b>{self._format_currency(data.get('total_amount', 0))}</b>"])
        
        breakdown_table = Table(breakdown_data, colWidths=[2*inch, 2*inch, 1*inch, 1.25*inch, 1.25*inch])
        breakdown_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_BLUE),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (2, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (4, 1), (4, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -2), [FG_WHITE, ROW_ALT]),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('BACKGROUND', (3, -1), (4, -1), FG_LIGHT),
        ]))
        elements.append(breakdown_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Program Schedule
        schedule = data.get('program_schedule', [])
        if schedule:
            elements.append(Paragraph("<b>PROGRAM SCHEDULE</b>", self.styles['SectionHeader']))
            sched_headers = ['Time', 'Activity / Description', 'PAX']
            sched_data = [sched_headers]
            for s in schedule:
                sched_data.append([s.get('time', ''), s.get('activity', ''), str(s.get('pax', ''))])
            
            sched_table = Table(sched_data, colWidths=[1.5*inch, 5*inch, 1*inch])
            sched_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), HEADER_GRAY),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(sched_table)
            
        # Barcode for ease of reference
        elements.append(Spacer(1, 0.5*inch))
        try:
            from barcode_generator.routes import barcode_service
            scan_code = data.get('invoice_number', f"CNF-{data.get('id')}")
            barcode_bytes = barcode_service.generate_barcode(scan_code, include_text=True)
            barcode_img = Image(io.BytesIO(barcode_bytes), width=2.5*inch, height=0.8*inch)
            elements.append(barcode_img)
            elements.append(Paragraph("Scan at Cashier for Payment", self.styles['SmallText']))
        except: pass
        
        # Authorization
        elements.append(Spacer(1, 0.5*inch))
        auth_data = [
            [f"Booked By: {data.get('booked_by_name', 'Staff')}", "", "Client Signature:"],
            ["Date: ____________________", "", "Date: ____________________"],
        ]
        auth_table = Table(auth_data, colWidths=[3*inch, 1.5*inch, 3*inch])
        auth_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TOPPADDING', (0, 0), (-1, -1), 20),
        ]))
        elements.append(auth_table)
        
        return self._create_pdf(elements, filename=f"/tmp/CNF_Invoice_{data.get('invoice_number', 'EXT')}.pdf")

    def _generate_conference_summary_report(self, data: Dict, filters: Dict) -> str:
        """Generate Conference / Hall Booking Summary Report"""
        elements = []
        
        date_range = f"{filters.get('start_date', 'N/A')} to {filters.get('end_date', 'N/A')}"
        elements.extend(self._create_header("CONFERENCE REVENUE & PERFORMANCE REPORT", date_range))
        
        # Executive Summary
        summary_data = [
            ['EXECUTIVE SUMMARY', '', '', ''],
            ['Total Booking Revenue:', self._format_currency(data.get('total_revenue') or 0),
             'Total Bookings:', self._format_number(data.get('total_bookings') or 0)],
            ['Total Participants:', self._format_number(data.get('total_pax') or 0),
             'Avg Revenue / Booking:', self._format_currency((data.get('total_revenue') or 0) / (data.get('total_bookings') or 1) if data.get('total_bookings', 0) > 0 else 0)],
        ]
        
        summary_table = Table(summary_data, colWidths=[1.8*inch, 1.8*inch, 1.8*inch, 1.8*inch])
        summary_table.setStyle(TableStyle([
            ('SPAN', (0, 0), (-1, 0)),
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_BLUE),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 1), (2, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Performance by Hall
        elements.append(Paragraph("<b>PERFORMANCE BY HALL</b>", self.styles['SectionHeader']))
        
        headers = ['Hall Name', 'Bookings', 'Total PAX', 'Revenue', '% of Total']
        hall_data = [headers]
        
        total_rev = data.get('total_revenue') or 1
        for h in data.get('by_hall', []):
            rev = h.get('revenue') or 0
            hall_data.append([
                h.get('name', 'Unknown'),
                str(h.get('bookings', 0)),
                str(h.get('pax', 0)),
                self._format_currency(rev),
                f"{(rev / total_rev * 100):.1f}%"
            ])
            
        if len(hall_data) == 1:
            hall_data.append(['No data available', '-', '-', '-', '-'])
            
        hall_table = Table(hall_data, colWidths=[2.2*inch, 1*inch, 1.2*inch, 1.8*inch, 1.3*inch])
        hall_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_GREEN),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (3, 1), (3, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [FG_WHITE, ROW_ALT]),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(hall_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Recent Bookings
        elements.append(Paragraph("<b>RECENT BOOKINGS</b>", self.styles['SectionHeader']))
        
        headers = ['Date', 'Client', 'Hall', 'PAX', 'Total Amount', 'Status']
        recent_data = [headers]
        
        for b in data.get('recent_bookings', []):
            recent_data.append([
                b.get('date', ''),
                (b.get('client') or 'N/A')[:20],
                (b.get('hall') or 'N/A')[:15],
                str(b.get('pax', 0)),
                self._format_currency(b.get('total', 0)),
                (b.get('status') or 'Confirmed').title()
            ])
            
        if len(recent_data) == 1:
            recent_data.append(['No recent bookings', '-', '-', '-', '-', '-'])
            
        recent_table = Table(recent_data, colWidths=[1.1*inch, 1.8*inch, 1.5*inch, 0.8*inch, 1.3*inch, 1*inch])
        recent_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_YELLOW),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (3, 0), (4, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [FG_WHITE, ROW_ALT]),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(recent_table)
        
        return self._create_pdf(elements)

    def _generate_dispatch_note(self, data: Dict, filters: Dict) -> str:
        """Generate Professional Dispatch/Delivery Note PDF"""
        elements = []
        
        to_branch = data.get('to_branch') or {}
        branch_name = data.get('to_branch_name') or (to_branch.get('name') if isinstance(to_branch, dict) else 'N/A')

        elements.extend(self._create_header("DELIVERY NOTE", 
            f"Date: {datetime.now().strftime('%d/%m/%Y')}", 
            branch_name))
        
        
        # Dispatch Details Section
        dispatch_data = [
            ['DISPATCH DETAILS', ''],
            ['DN Reference:', data.get('dispatch_number', 'N/A')],
            ['Date Created:', str(data.get('created_at', ''))[:10] or 'N/A'],
            ['To Branch:', branch_name],
        ]
        
        dispatch_table = Table(dispatch_data, colWidths=[2*inch, 5.5*inch])
        dispatch_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_BLUE),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('SPAN', (0, 0), (1, 0)),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(dispatch_table)
        elements.append(Spacer(1, 0.2*inch))
        
        # Logistics Info Section
        # Handle both flat fields (vehicle_registration, driver_name) and nested objects (vehicle.registration_number, driver.name)
        vehicle_info = data.get('vehicle_registration') or data.get('vehicle_number', '')
        if not vehicle_info and isinstance(data.get('vehicle'), dict):
            vehicle_info = data.get('vehicle', {}).get('registration_number', 'N/A')
        if not vehicle_info:
            vehicle_info = 'N/A'
            
        driver_info = data.get('driver_name', '')
        if not driver_info and isinstance(data.get('driver'), dict):
            driver_info = data.get('driver', {}).get('name', 'N/A')
        if not driver_info:
            driver_info = 'N/A'
        
        logistics_data = [
            ['LOGISTICS INFO', ''],
            ['Vehicle:', vehicle_info],
            ['Driver:', driver_info],
            ['Status:', data.get('status', 'N/A')]
        ]
        
        logistics_table = Table(logistics_data, colWidths=[2*inch, 5.5*inch])
        logistics_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_GREEN),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('SPAN', (0, 0), (1, 0)),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(logistics_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Items Table
        elements.append(Paragraph("<b>SHIPMENT CONTENTS</b>", self.styles['SectionHeader']))
        
        headers = ['SKU', 'Item Name', 'Quantity', 'Unit', 'Remarks']
        item_data = [headers]
        
        for item in data.get('items', []):
            item_data.append([
                item.get('item_sku') or item.get('sku', 'N/A'),
                item.get('item_name') or item.get('name', 'N/A'),
                str(item.get('quantity') or item.get('dispatched_quantity', 0)),
                item.get('unit', 'pcs'),
                '' # Remarks column
            ])
            
        if not item_data[1:]:
             item_data.append(['No items listed', '-', '-', '-', '-'])
             
        item_table = Table(item_data, colWidths=[1.2*inch, 2.5*inch, 1*inch, 1*inch, 1.5*inch])
        item_table.setStyle(self._get_table_style())
        elements.append(item_table)
        elements.append(Spacer(1, 0.5*inch))
        
        # Signature Section
        sig_data = [
            ['Authorized By:', '________________________', 'Receiver Name:', '________________________'],
            ['Date / Sign:', '________________________', 'Date / Sign:', '________________________']
        ]
        sig_table = Table(sig_data, colWidths=[1.2*inch, 2.4*inch, 1.2*inch, 2.4*inch])
        sig_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 15),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(sig_table)
        
        return self._create_pdf(elements)

    def _generate_generic_report(self, data: Dict, filters: Dict) -> str:
        """Generate a generic report for unknown types"""
        elements = []
        
        elements.extend(self._create_header("REPORT", 
            f"Generated: {datetime.now().strftime('%d/%m/%Y %H:%M')}"))
        
        elements.append(Paragraph("Report data:", self.styles['SectionHeader']))
        
        # Display data as key-value pairs
        return self._create_pdf(elements)

    def _generate_financial_variance_report(self, data: Dict, filters: Dict) -> str:
        """Generate Financial Variance Report PDF"""
        elements = []
        elements.extend(self._create_header("FINANCIAL VARIANCE REPORT", 
            f"Period: {filters.get('start_date', 'Today')} - {filters.get('end_date', 'Today')}"))
        
        # Summary Table
        summary_data = [
            [Paragraph("<b>Metric</b>", self.styles['TableHeader']), Paragraph("<b>Amount (KES)</b>", self.styles['TableHeader'])],
            ["Expected Revenue", self._format_currency(data.get('expected_revenue', 0))],
            ["Actual Collected", self._format_currency(data.get('actual_collected', 0))],
            ["Total Variance", Paragraph(f"<font color='red'>{self._format_currency(data.get('variance', 0))}</font>" if data.get('variance', 0) < 0 else self._format_currency(data.get('variance', 0)), self.styles['TableCell'])]
        ]
        elements.append(Table(summary_data, colWidths=[3*inch, 3*inch], style=self._get_table_style()))
        elements.append(Spacer(1, 0.3*inch))
        
        # Source Breakdown
        elements.append(Paragraph("Revenue Source Breakdown", self.styles['SectionHeader']))
        source_data = [[Paragraph("<b>Source</b>", self.styles['TableHeader']), Paragraph("<b>Expected</b>", self.styles['TableHeader']), Paragraph("<b>Actual</b>", self.styles['TableHeader'])]]
        for s in data.get('variances_by_source', []):
            source_data.append([s.get('source'), self._format_currency(s.get('expected', 0)), self._format_currency(s.get('actual', 0))])
        elements.append(Table(source_data, colWidths=[2*inch, 2*inch, 2*inch], style=self._get_table_style()))
        
        return self._create_pdf(elements)

    def _generate_inventory_discrepancy_report(self, data: Dict, filters: Dict) -> str:
        """Generate Inventory Discrepancy Report PDF"""
        elements = []
        elements.extend(self._create_header("INVENTORY DISCREPANCY ANALYSIS", f"Branch ID: {filters.get('branch_id', 'All')}"))
        
        elements.append(Paragraph(f"Total Estimated Loss: <font color='red'>{self._format_currency(data.get('total_value_loss', 0))}</font>", self.styles['Heading2']))
        elements.append(Spacer(1, 0.2*inch))
        
        # Discrepancy List
        headers = ["Item Name", "Theoretical", "Actual", "Variance", "Impact"]
        table_data = [[Paragraph(f"<b>{h}</b>", self.styles['TableHeader']) for h in headers]]
        for item in data.get('discrepancy_items', []):
            table_data.append([
                item.get('name'),
                str(item.get('theoretical')),
                str(item.get('actual')),
                f"{item.get('variance')} ({item.get('variance_pct', 0):.1f}%)",
                self._format_currency(item.get('value_impact', 0))
            ])
        elements.append(Table(table_data, colWidths=[2*inch, 1*inch, 1*inch, 1.2*inch, 1.3*inch], style=self._get_table_style()))
        
        return self._create_pdf(elements)

    def _generate_procurement_analysis_report(self, data: Dict, filters: Dict) -> str:
        """Generate Procurement Analysis Report PDF"""
        elements = []
        elements.extend(self._create_header("PROCUREMENT & SUPPLIER REPORT", f"Generated: {datetime.now().strftime('%d/%m/%Y')}"))
        
        # Top Suppliers
        elements.append(Paragraph("Top Suppliers by Spend", self.styles['SectionHeader']))
        supp_data = [[Paragraph("<b>Supplier</b>", self.styles['TableHeader']), Paragraph("<b>Total Spend</b>", self.styles['TableHeader'])]]
        for s in data.get('top_suppliers', []):
            supp_data.append([s.get('name'), self._format_currency(s.get('total_spend', 0))])
        elements.append(Table(supp_data, colWidths=[4*inch, 2.5*inch], style=self._get_table_style()))
        elements.append(Spacer(1, 0.3*inch))
        
        # Price Trends
        elements.append(Paragraph("Item Price Trends", self.styles['SectionHeader']))
        price_data = [[Paragraph("<b>Item</b>", self.styles['TableHeader']), Paragraph("<b>Avg Price</b>", self.styles['TableHeader']), Paragraph("<b>Min</b>", self.styles['TableHeader']), Paragraph("<b>Max</b>", self.styles['TableHeader'])]]
        for p in data.get('price_trends', []):
            price_data.append([p.get('item'), self._format_currency(p.get('avg_price', 0)), self._format_currency(p.get('min', 0)), self._format_currency(p.get('max', 0))])
        elements.append(Table(price_data, colWidths=[2.5*inch, 1.5*inch, 1*inch, 1*inch], style=self._get_table_style()))
        
        return self._create_pdf(elements)

    def _generate_exception_logs_report(self, data: Dict, filters: Dict) -> str:
        """Generate Exception Logs Report PDF"""
        elements = []
        elements.extend(self._create_header("AUDIT EXCEPTION LOGS", "Confidential Audit Intelligence"))
        
        elements.append(Paragraph(f"Total High-Risk Activity Value: {self._format_currency(data.get('total_exception_value', 0))}", self.styles['Heading2']))
        elements.append(Spacer(1, 0.2*inch))
        
        # Voided Orders
        elements.append(Paragraph("Voided & Cancelled Orders", self.styles['SectionHeader']))
        void_data = [[Paragraph("<b>ID</b>", self.styles['TableHeader']), Paragraph("<b>Reason</b>", self.styles['TableHeader']), Paragraph("<b>Amount</b>", self.styles['TableHeader'])]]
        for v in data.get('voided_orders', []):
            void_data.append([v.get('id'), v.get('reason'), self._format_currency(v.get('amount', 0))])
        elements.append(Table(void_data, colWidths=[1.5*inch, 3*inch, 2*inch], style=self._get_table_style()))
        elements.append(Spacer(1, 0.3*inch))
        
        # Cancelled Bookings
        elements.append(Paragraph("Cancelled Bookings", self.styles['SectionHeader']))
        cancel_data = [[Paragraph("<b>ID</b>", self.styles['TableHeader']), Paragraph("<b>Guest</b>", self.styles['TableHeader']), Paragraph("<b>Amount</b>", self.styles['TableHeader'])]]
        for c in data.get('cancelled_bookings', []):
            cancel_data.append([c.get('id'), c.get('guest'), self._format_currency(c.get('amount', 0))])
        elements.append(Table(cancel_data, colWidths=[1.5*inch, 3.5*inch, 1.5*inch], style=self._get_table_style()))
        
        return self._create_pdf(elements)

    def _generate_branch_performance_report(self, data: Dict, filters: Dict) -> str:
        """Generate Branch Performance Report PDF"""
        elements = []
        
        start_date = filters.get('start_date', 'N/A')
        end_date = filters.get('end_date', 'N/A')
        date_range = f"{start_date} to {end_date}"
        branch_name = filters.get('branch_name', 'Branch')
        
        elements.extend(self._create_header("BRANCH PERFORMANCE REPORT", date_range, branch_name))
        
        # Finance Summary
        elements.append(Paragraph("<b>FINANCIAL SUMMARY</b>", self.styles['SectionHeader']))
        
        sales = data.get('sales', {})
        expenses = data.get('expenses', {})
        
        summary_data = [
            ['METRIC', 'AMOUNT', '% OF REVENUE'],
            ['Restaurant Sales', self._format_currency(sales.get('restaurant', 0)), 
             self._format_percent((sales.get('restaurant', 0) / sales.get('total', 1)) * 100 if sales.get('total', 0) > 0 else 0)],
            ['Bar Sales', self._format_currency(sales.get('bar', 0)), 
             self._format_percent((sales.get('bar', 0) / sales.get('total', 1)) * 100 if sales.get('total', 0) > 0 else 0)],
            ['TOTAL REVENUE', self._format_currency(sales.get('total', 0)), '100%'],
            ['TOTAL EXPENSES', self._format_currency(expenses.get('total', 0)), 
             self._format_percent((expenses.get('total', 0) / sales.get('total', 1)) * 100 if sales.get('total', 0) > 0 else 0)],
            ['NET PROFIT', self._format_currency(data.get('netProfit', 0)), 
             self._format_percent(data.get('profitMargin', 0)) + ' Margin']
        ]
        
        summary_table = Table(summary_data, colWidths=[2.5*inch, 2*inch, 2*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_BLUE),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (0, 3), (-1, 3), HEADER_GRAY),
            ('BACKGROUND', (0, -1), (-1, -1), HEADER_GREEN if data.get('netProfit', 0) >= 0 else colors.HexColor('#FFCDD2')),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Expense Breakdown
        if expenses.get('breakdown'):
            elements.append(Paragraph("<b>EXPENSE BREAKDOWN</b>", self.styles['SectionHeader']))
            
            exp_data = [['Category', 'Amount', '% of Total Expenses']]
            total_exp = expenses.get('total', 1)
            
            sorted_exp = sorted(expenses.get('breakdown', {}).items(), key=lambda x: x[1], reverse=True)
            for cat, amt in sorted_exp:
                exp_data.append([
                    cat, 
                    self._format_currency(amt), 
                    self._format_percent((amt / total_exp) * 100 if total_exp > 0 else 0)
                ])
                
            exp_table = Table(exp_data, colWidths=[2.5*inch, 2*inch, 2*inch])
            exp_table.setStyle(self._get_table_style())
            elements.append(exp_table)
            
        return self._create_pdf(elements)

    def _generate_stock_usage_report(self, data: Dict, filters: Dict) -> str:
        """Generate Stock Usage Report PDF"""
        elements = []
        
        start_date = filters.get('start_date', 'N/A')
        end_date = filters.get('end_date', 'N/A')
        date_range = f"{start_date} to {end_date}"
        branch_name = filters.get('branch_name', 'Branch')
        
        elements.extend(self._create_header("STOCK USAGE AUDIT REPORT", date_range, branch_name))
        
        elements.append(Paragraph("<b>USAGE ANALYSIS (REQUESTED VS ACTUAL)</b>", self.styles['SectionHeader']))
        
        headers = ['SKU', 'Item Name', 'Requested', 'Actual Used', 'Variance', 'Status']
        usage_data = [headers]
        
        for item in data.get('items', []):
            var = item.get('variance', 0)
            status = 'OK'
            if var > 0: status = 'SURPLUS'
            elif var < 0: status = 'OVER-USED'
            
            usage_data.append([
                item.get('sku', ''),
                item.get('name', '')[:30],
                self._format_number(item.get('requested', 0)),
                self._format_number(item.get('used', 0)),
                self._format_number(var),
                status
            ])
            
        if not data.get('items'):
            usage_data.append(['No data', '-', '-', '-', '-', '-'])
            
        usage_table = Table(usage_data, colWidths=[1*inch, 2.5*inch, 1*inch, 1*inch, 1*inch, 1*inch])
        usage_table.setStyle(self._get_table_style())
        elements.append(usage_table)
        
        return self._create_pdf(elements)

    def _generate_employee_credit_report(self, data: Dict, filters: Dict) -> str:
        """Generate Employee Credit Aging Report PDF"""
        elements = []
        
        elements.extend(self._create_header("EMPLOYEE CREDIT AGING REPORT", f"As of {datetime.now().strftime('%d/%m/%Y')}"))
        
        # Summary Buckets
        elements.append(Paragraph("<b>CREDIT AGING SUMMARY</b>", self.styles['SectionHeader']))
        
        summary = data.get('summary', {})
        summary_data = [
            ['CURRENT', '1-30 DAYS', '31-60 DAYS', '61-90 DAYS', 'TOTAL OVERDUE'],
            [
                self._format_currency(summary.get('current', 0)),
                self._format_currency(summary.get('overdue_30', 0)),
                self._format_currency(summary.get('overdue_60', 0)),
                self._format_currency(summary.get('overdue_90', 0)),
                self._format_currency(summary.get('total_outstanding', 0))
            ]
        ]
        
        summary_table = Table(summary_data, colWidths=[1.5*inch, 1.5*inch, 1.5*inch, 1.5*inch, 1.5*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HEADER_BLUE),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, FG_GRAY),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND', (-1, 1), (-1, 1), HEADER_YELLOW)
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Detailed Bills
        elements.append(Paragraph("<b>OUTSTANDING EMPLOYEE BILLS</b>", self.styles['SectionHeader']))
        
        headers = ['Employee', 'Emp ID', 'Branch', 'Bill Date', 'Balance', 'Days Overdue']
        bill_data = [headers]
        
        for bill in data.get('bills', []):
            employee = bill.get('employee', {})
            emp_name = f"{employee.get('first_name', '')} {employee.get('last_name', '')}"
            branch = bill.get('branch', {}).get('name', 'N/A')
            
            bill_data.append([
                emp_name[:20],
                employee.get('employee_id', 'N/A'),
                branch,
                bill.get('bill_date', ''),
                self._format_currency(bill.get('balance', 0)),
                f"{bill.get('daysOverdue', 0)} days"
            ])
            
        if not data.get('bills'):
            bill_data.append(['No outstanding credit', '-', '-', '-', '-', '-'])
            
        bill_table = Table(bill_data, colWidths=[2*inch, 1*inch, 1.2*inch, 1.2*inch, 1.1*inch, 1*inch])
        bill_table.setStyle(self._get_table_style())
        elements.append(bill_table)
        
        return self._create_pdf(elements)
