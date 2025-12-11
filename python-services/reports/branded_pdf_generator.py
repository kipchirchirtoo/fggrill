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
            Paragraph("P.O. Box 12345, Nairobi, Kenya", self.styles['SmallText']),
            Paragraph("Tel: +254 700 123 456 | Email: info@famousgate.co.ke", self.styles['SmallText']),
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
        }
        
        generator = generators.get(report_type, self._generate_generic_report)
        return generator(data, filters)

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
        
        date_range = f"{filters.get('start_date', 'N/A')} to {filters.get('end_date', 'N/A')}"
        branch = filters.get('branch_name', 'All Branches')
        elements.extend(self._create_header("DAILY SALES REPORT", date_range, branch))
        
        # Summary section
        summary_data = [
            ['SALES SUMMARY', '', '', ''],
            ['Total Revenue:', self._format_currency(data.get('total_revenue', 0)), 
             'Total Transactions:', self._format_number(data.get('total_transactions', 0))],
            ['Average Transaction:', self._format_currency(data.get('avg_transaction', 0)),
             'Cash Sales:', self._format_currency(data.get('cash_sales', 0))],
            ['Card Sales:', self._format_currency(data.get('card_sales', 0)),
             'M-Pesa Sales:', self._format_currency(data.get('mpesa_sales', 0))],
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
        
        total_rev = data.get('total_revenue', 1) or 1
        for cat in data.get('categories', []):
            pct = (cat.get('total', 0) / total_rev * 100) if total_rev > 0 else 0
            cat_data.append([
                cat.get('name', 'Unknown'),
                self._format_number(cat.get('quantity', 0)),
                self._format_currency(cat.get('total', 0)),
                self._format_percent(pct)
            ])
        
        if len(cat_data) == 1:
            cat_data.append(['No data available', '-', '-', '-'])
        
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
            ['Occupancy Rate:', self._format_percent(data.get('occupancy_rate', 0)),
             'Total Rooms:', self._format_number(data.get('total_rooms', 0))],
            ['Occupied Rooms:', self._format_number(data.get('occupied_rooms', 0)),
             'Available Rooms:', self._format_number(data.get('available_rooms', 0))],
            ['ADR (Avg Daily Rate):', self._format_currency(data.get('adr', 0)),
             'RevPAR:', self._format_currency(data.get('revpar', 0))],
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
                rt.get('type', 'Unknown'),
                self._format_number(rt.get('total', 0)),
                self._format_number(rt.get('occupied', 0)),
                self._format_number(rt.get('total', 0) - rt.get('occupied', 0)),
                self._format_percent(rt.get('occupancy_pct', 0)),
                self._format_currency(rt.get('revenue', 0))
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
            ['Rooms', '', 'Lodging', '', self._format_currency(data.get('room_revenue', 0))],
            ['', '', 'Cancellation / No-Show', '', self._format_currency(0)],
            ['', '', 'Other', '', self._format_currency(0)],
            ['', '', '', 'Total Room Revenue', self._format_currency(data.get('room_revenue', 0))],
            ['F&B', '', 'Food', '', self._format_currency(data.get('restaurant_revenue', 0))],
            ['', '', 'Beverage', '', self._format_currency(data.get('bar_revenue', 0))],
            ['', '', 'Other', '', self._format_currency(0)],
            ['', '', '', 'Total F&B Revenue', self._format_currency(data.get('restaurant_revenue', 0) + data.get('bar_revenue', 0))],
            ['Other Departments', '', 'Meetings & Events', '', self._format_currency(0)],
            ['', '', 'Spa', '', self._format_currency(0)],
            ['', '', 'Parking', '', self._format_currency(0)],
            ['', '', 'Other', '', self._format_currency(data.get('other_revenue', 0))],
            ['', '', '', 'Total Other Revenue', self._format_currency(data.get('other_revenue', 0))],
            ['', '', '', '', ''],
            ['', '', '', 'TOTAL REVENUE', self._format_currency(data.get('total_revenue', 0))],
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
            ['Payroll & Benefits', self._format_currency(data.get('payroll_expense', 0)), 
             self._format_percent(data.get('payroll_pct', 0))],
            ['Utilities', self._format_currency(data.get('utilities_expense', 0)),
             self._format_percent(data.get('utilities_pct', 0))],
            ['Supplies', self._format_currency(data.get('supplies_expense', 0)),
             self._format_percent(data.get('supplies_pct', 0))],
            ['Maintenance', self._format_currency(data.get('maintenance_expense', 0)),
             self._format_percent(data.get('maintenance_pct', 0))],
            ['Other', self._format_currency(data.get('other_expense', 0)),
             self._format_percent(data.get('other_exp_pct', 0))],
            ['TOTAL EXPENSES', self._format_currency(data.get('total_expenses', 0)), '100%'],
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
            ['NET PROFIT/LOSS', self._format_currency(data.get('net_profit', 0)), 
             self._format_percent(data.get('profit_margin', 0)) + ' margin']
        ]
        profit_table = Table(profit_data, colWidths=[3*inch, 2*inch, 1.5*inch])
        profit_color = HEADER_GREEN if data.get('net_profit', 0) >= 0 else colors.HexColor('#FFCDD2')
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
            ['Total Items:', self._format_number(data.get('total_items', 0)),
             'Total Value:', self._format_currency(data.get('total_value', 0))],
            ['Low Stock Items:', self._format_number(data.get('low_stock_count', 0)),
             'Out of Stock:', self._format_number(data.get('out_of_stock', 0))],
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
        
        for item in data.get('items', [])[:30]:  # Limit to 30 items
            qty = item.get('quantity', 0)
            min_qty = item.get('min_quantity', 0)
            
            if qty == 0:
                status = 'OUT OF STOCK'
            elif qty < min_qty:
                status = 'LOW STOCK'
            else:
                status = 'OK'
            
            item_data.append([
                str(item.get('code', ''))[:10],
                str(item.get('name', ''))[:25],
                str(item.get('category', ''))[:15],
                self._format_number(qty),
                self._format_number(min_qty),
                str(item.get('unit', 'pcs'))[:5],
                self._format_currency(item.get('value', 0)),
                status
            ])
        
        if len(item_data) == 1:
            item_data.append(['No items', '-', '-', '-', '-', '-', '-', '-'])
        
        item_table = Table(item_data, colWidths=[0.8*inch, 1.8*inch, 1*inch, 0.6*inch, 0.6*inch, 0.5*inch, 1*inch, 0.9*inch])
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
            ['Rooms Cleaned:', self._format_number(data.get('rooms_cleaned', 0)),
             'Avg Time (mins):', f"{data.get('avg_time', 0):.1f}"],
            ['Inspection Pass Rate:', self._format_percent(data.get('pass_rate', 0)),
             'Complaints:', self._format_number(data.get('complaints', 0))],
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
                staff.get('name', 'Unknown'),
                self._format_number(staff.get('rooms', 0)),
                f"{staff.get('avg_time', 0):.1f}",
                self._format_percent(staff.get('pass_rate', 0)),
                f"{staff.get('rating', 0):.1f}/5"
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
            ['Total Requests:', self._format_number(data.get('total_requests', 0)),
             'Completed:', self._format_number(data.get('completed', 0))],
            ['Pending:', self._format_number(data.get('pending', 0)),
             'In Progress:', self._format_number(data.get('in_progress', 0))],
            ['Avg Resolution (hrs):', f"{data.get('avg_resolution', 0):.1f}", '', ''],
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
                wo.get('id', '')[:8],
                str(wo.get('location', ''))[:15],
                str(wo.get('issue', ''))[:30],
                wo.get('priority', 'Normal'),
                wo.get('status', 'Pending'),
                wo.get('assigned_to', 'Unassigned')[:15]
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
            ['Total Gross Pay:', self._format_currency(data.get('total_gross', 0)),
             'Total Deductions:', self._format_currency(data.get('total_deductions', 0))],
            ['PAYE:', self._format_currency(data.get('paye', 0)),
             'NHIF:', self._format_currency(data.get('nhif', 0))],
            ['NSSF:', self._format_currency(data.get('nssf', 0)),
             'Net Pay:', self._format_currency(data.get('total_net', 0))],
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
                emp.get('id', '')[:8],
                emp.get('name', 'Unknown')[:20],
                emp.get('department', 'N/A')[:15],
                self._format_currency(emp.get('gross', 0)),
                self._format_currency(emp.get('deductions', 0)),
                self._format_currency(emp.get('net', 0))
            ])
        
        if len(emp_data) == 1:
            emp_data.append(['No payroll data', '-', '-', '-', '-', '-'])
        
        # Add totals
        emp_data.append([
            'TOTAL', '', '',
            self._format_currency(data.get('total_gross', 0)),
            self._format_currency(data.get('total_deductions', 0)),
            self._format_currency(data.get('total_net', 0))
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
        
        date_range = f"{filters.get('start_date', 'N/A')} to {filters.get('end_date', 'N/A')}"
        elements.extend(self._create_header("RESTAURANT SALES REPORT", date_range))
        
        # Summary
        summary_data = [
            ['SALES SUMMARY', '', '', ''],
            ['Total Revenue:', self._format_currency(data.get('total_revenue', 0)),
             'Total Orders:', self._format_number(data.get('total_orders', 0))],
            ['Average Order:', self._format_currency(data.get('avg_order', 0)),
             'Dine-In:', self._format_number(data.get('dine_in', 0))],
            ['Room Service:', self._format_number(data.get('room_service', 0)),
             'Takeaway:', self._format_number(data.get('takeaway', 0))],
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
                item.get('name', 'Unknown')[:30],
                item.get('category', 'Other')[:15],
                self._format_number(item.get('quantity', 0)),
                self._format_currency(item.get('revenue', 0))
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
            ['Total Revenue:', self._format_currency(data.get('total_revenue', 0)),
             'Total Orders:', self._format_number(data.get('total_orders', 0))],
            ['Average Order:', self._format_currency(data.get('avg_order', 0)), '', ''],
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
                item.get('name', 'Unknown')[:30],
                self._format_number(item.get('quantity', 0)),
                self._format_currency(item.get('revenue', 0))
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
            qty = item.get('quantity', 0)
            reorder = item.get('reorder_level', 0)
            status = 'LOW' if qty < reorder else 'OK'
            
            supply_data.append([
                item.get('name', 'Unknown')[:25],
                item.get('category', 'Other')[:15],
                self._format_number(qty),
                item.get('unit', 'pcs'),
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
        
        period = filters.get('period', 'This Period')
        date_range = f"{filters.get('start_date', datetime.now().strftime('%d/%m/%Y'))} to {filters.get('end_date', datetime.now().strftime('%d/%m/%Y'))}"
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
        total_revenue = data.get('total_revenue', 0)
        total_orders = data.get('total_orders', 0)
        avg_satisfaction = data.get('avg_satisfaction', 0)
        best_performer = data.get('best_performer', 'N/A')
        worst_performer = data.get('worst_performer', 'N/A')
        
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
            revenue_change = branch.get('revenue_change', 0)
            change_str = f"+{revenue_change:.1f}%" if revenue_change >= 0 else f"{revenue_change:.1f}%"
            
            perf_data.append([
                branch.get('branch_name', 'Unknown')[:12],
                self._format_currency(branch.get('revenue', 0)),
                change_str,
                self._format_number(branch.get('orders', 0)),
                self._format_currency(branch.get('avg_order_value', 0)),
                f"{branch.get('customer_satisfaction', 0):.1f}",
                f"{branch.get('staff_efficiency', 0)}%",
                f"{branch.get('target_achievement', 0)}%"
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
                ['Revenue', self._format_currency(branch.get('revenue', 0)), 
                 self._format_currency(branch.get('revenue', 0) / (branch.get('target_achievement', 100) / 100) if branch.get('target_achievement', 0) > 0 else 0),
                 'On Track' if branch.get('target_achievement', 0) >= 80 else 'Below Target'],
                ['Orders', self._format_number(branch.get('orders', 0)), '-', 'Active'],
                ['Customer Satisfaction', f"{branch.get('customer_satisfaction', 0):.1f}/5.0", '4.0/5.0',
                 'Good' if branch.get('customer_satisfaction', 0) >= 4.0 else 'Needs Improvement'],
                ['Staff Efficiency', f"{branch.get('staff_efficiency', 0)}%", '85%',
                 'Good' if branch.get('staff_efficiency', 0) >= 85 else 'Needs Improvement'],
                ['Inventory Turnover', f"{branch.get('inventory_turnover', 0)}x", '3x',
                 'Good' if branch.get('inventory_turnover', 0) >= 3 else 'Low'],
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
            if branch.get('target_achievement', 0) < 80:
                recommendations.append(f"• {branch.get('branch_name', 'Branch')}: Focus on increasing sales to meet targets")
            if branch.get('customer_satisfaction', 0) < 4.0:
                recommendations.append(f"• {branch.get('branch_name', 'Branch')}: Improve customer service quality")
            if branch.get('staff_efficiency', 0) < 85:
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
                str(data.get('total_staff', 0)),
                str(data.get('active_staff', 0)),
                str(data.get('on_leave', 0)),
                f"{data.get('avg_performance', 0):.1f}%",
                f"{data.get('avg_attendance', 0):.1f}%"
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
                    branch.get('branch_name', 'N/A'),
                    str(branch.get('total_staff', 0)),
                    str(branch.get('active', 0)),
                    str(branch.get('on_leave', 0)),
                    f"{branch.get('avg_performance', 0):.1f}%",
                    f"{branch.get('avg_attendance', 0):.1f}%"
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
                    staff.get('name', 'N/A'),
                    staff.get('branch_name', 'N/A'),
                    staff.get('role', 'N/A'),
                    f"{staff.get('performance_score', 0):.1f}%",
                    f"{staff.get('attendance_rate', 0):.1f}%",
                    f"{staff.get('customer_rating', 0):.1f}/5"
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
                issue = 'Low Performance' if staff.get('performance_score', 100) < 70 else 'Low Attendance'
                attention_data.append([
                    staff.get('name', 'N/A'),
                    staff.get('branch_name', 'N/A'),
                    staff.get('role', 'N/A'),
                    f"{staff.get('performance_score', 0):.1f}%",
                    f"{staff.get('attendance_rate', 0):.1f}%",
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
        
        compliance_rate = data.get('overall_compliance_rate', 0)
        rate_color = self.HEADER_GREEN if compliance_rate >= 90 else (self.HEADER_YELLOW if compliance_rate >= 75 else HexColor('#DC2626'))
        
        summary_data = [
            ['Total Requirements', 'Compliant', 'Non-Compliant', 'Pending', 'Expired', 'Compliance Rate'],
            [
                str(data.get('total_requirements', 0)),
                str(data.get('compliant', 0)),
                str(data.get('non_compliant', 0)),
                str(data.get('pending', 0)),
                str(data.get('expired', 0)),
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
                rate = branch.get('compliance_rate', 0)
                branch_data.append([
                    branch.get('branch_name', 'N/A'),
                    str(branch.get('total_requirements', 0)),
                    str(branch.get('compliant', 0)),
                    str(branch.get('non_compliant', 0)),
                    str(branch.get('pending', 0)),
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
        self._add_report_header(elements, title)
        
        # Add report metadata
        metadata = [
            ('Report Date:', datetime.now().strftime('%d %b %Y, %H:%M')),
            ('Period:', period.capitalize()),
            ('Metric:', metric.replace('_', ' ').capitalize()),
        ]
        self._add_metadata_table(elements, metadata)
        
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
        sorted_branches = sorted(branches, key=lambda x: x.get(metric, 0), reverse=True)
        
        # Add summary text
        if branches:
            best_branch = sorted_branches[0]['name']
            best_value = sorted_branches[0].get(metric, 0)
            formatted_value = self._format_currency(best_value) if metric == 'revenue' else (
                f"{best_value}%" if metric == 'occupancy' else str(best_value)
            )
            
            summary = f"Based on {metric_label} data for the selected {period}, {best_branch} is the top performing branch with a {metric_label} of {formatted_value}."
            elements.append(self._create_paragraph(summary, self.styles['Normal'], 12))
            
            # Add spacer
            elements.append(self._create_spacer(0.2))
        
        # Add comparison chart
        if branches:
            # Create data for chart
            chart_data = []
            chart_labels = []
            max_value = max([b.get(metric, 0) for b in branches])
            
            for branch in sorted_branches:
                chart_data.append(branch.get(metric, 0))
                chart_labels.append(branch.get('name', 'Unknown'))
            
            # Add horizontal bar chart
            chart_title = f"{period_label} {metric_label} by Branch"
            elements.append(self._create_horizontal_bar_chart(chart_data, chart_labels, chart_title))
        
        # Add spacer
        elements.append(self._create_spacer(0.2))
        
        # Add comparison table
        if branches:
            # Table data
            table_data = [
                ['Branch', metric_label, 'Rank']
            ]
            
            for i, branch in enumerate(sorted_branches, 1):
                branch_name = branch.get('name', 'Unknown')
                value = branch.get(metric, 0)
                
                # Format based on metric type
                if metric == 'revenue':
                    formatted_value = self._format_currency(value)
                elif metric == 'occupancy':
                    formatted_value = f"{value}%"
                else:
                    formatted_value = str(value)
                    
                table_data.append([branch_name, formatted_value, str(i)])
            
            # Create and add the table
            elements.append(self._create_table(
                table_data, 
                colWidths=[250, 150, 80],
                style=[
                    ('BACKGROUND', (0, 0), (-1, 0), self.HEADER_GRAY),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
                    ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
                    ('ALIGN', (2, 1), (2, -1), 'CENTER'),
                    ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 1), (-1, -1), 9),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ]
            ))
        
        # Add notes
        elements.append(self._create_spacer(0.3))
        elements.append(self._create_paragraph("Notes:", self.styles['Heading5']))
        notes = [
            "This report provides a comparison of branch performance based on selected metrics.",
            f"The period shown is: {period_label}.",
            "Rankings are based on current data and may change over time.",
        ]
        for note in notes:
            elements.append(self._create_paragraph(f"• {note}", self.styles['Normal'], 9))
        
        # Create the PDF
        return self._create_pdf(elements)
    
    def _generate_generic_report(self, data: Dict, filters: Dict) -> str:
        """Generate a generic report for unknown types"""
        elements = []
        
        elements.extend(self._create_header("REPORT", 
            f"Generated: {datetime.now().strftime('%d/%m/%Y %H:%M')}"))
        
        elements.append(Paragraph("Report data:", self.styles['SectionHeader']))
        
        # Display data as key-value pairs
        for key, value in data.items():
            if not isinstance(value, (list, dict)):
                elements.append(Paragraph(f"<b>{key}:</b> {value}", self.styles['Normal']))
        
        return self._create_pdf(elements)
