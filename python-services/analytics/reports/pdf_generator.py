from datetime import date
from typing import Optional
from datetime import datetime
from typing import Dict
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.enums import TA_CENTER
import tempfile

class PDFReportGenerator:
    async def generate_report(self, report_type: str, report_date: date, branch_id: Optional[str] = None) -> str:
        return "/tmp/dummy_report.pdf"

    async def get_daily_report(self, report_date: date, branch_id: Optional[str] = None) -> Optional[str]:
        return "/tmp/dummy_daily_report.pdf"

    async def generate_branch_sales_report(self, sales_data: Dict, branch_name: str, date_range: Dict) -> str:
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
        temp_path = temp_file.name
        temp_file.close()

        doc = SimpleDocTemplate(
            temp_path,
            pagesize=A4,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=18
        )

        elements = []
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1a1a1a'),
            spaceAfter=30,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        )

        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#2c3e50'),
            spaceAfter=12,
            spaceBefore=12,
            fontName='Helvetica-Bold'
        )

        normal_style = styles['Normal']

        elements.append(Paragraph('FAMOUSGATE HOTELS', title_style))
        elements.append(Paragraph('Branch Sales Report', heading_style))
        elements.append(Paragraph(f'Branch: {branch_name}', normal_style))
        elements.append(Spacer(1, 20))

        report_info = [
            ['Report Type:', 'Branch Sales Analytics'],
            ['Generated Date:', datetime.now().strftime('%B %d, %Y')],
            ['Generated Time:', datetime.now().strftime('%I:%M %p')],
            ['Report Period:', f"{date_range['start']} to {date_range['end']}"],
            ['Branch:', branch_name]
        ]

        info_table = Table(report_info, colWidths=[2 * inch, 4 * inch])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#ecf0f1')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey)
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 20))

        summary = sales_data['summary']
        elements.append(Paragraph('Sales Summary', heading_style))
        summary_data = [
            ['Total Sales (KES):', f"{summary['total_sales']:,.2f}"],
            ['Transaction Count:', str(summary['transaction_count'])],
            ['Average Transaction Value (KES):', f"{summary['avg_transaction_value']:,.2f}"]
        ]

        summary_table = Table(summary_data, colWidths=[2.5 * inch, 3.5 * inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#3498db')),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.whitesmoke),
            ('TEXTCOLOR', (1, 0), (1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey)
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 20))

        payment_data = [['Payment Method', 'Total Sales (KES)', 'Transactions', 'Percentage']]
        for item in sales_data['payment_method_breakdown']:
            payment_data.append([
                str(item['payment_method']).upper(),
                f"{item['total_sales']:,.2f}",
                str(item['transaction_count']),
                f"{item['percentage']:.2f}%"
            ])

        elements.append(Paragraph('Payment Method Breakdown', heading_style))
        payment_table = Table(payment_data, colWidths=[1.5 * inch, 1.5 * inch, 1.5 * inch, 1.5 * inch])
        payment_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#34495e')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        elements.append(payment_table)
        elements.append(Spacer(1, 20))

        category_data = [['Category', 'Total Sales (KES)', 'Transactions', 'Percentage']]
        for item in sales_data['category_breakdown']:
            category_data.append([
                str(item['category']).upper(),
                f"{item['total_sales']:,.2f}",
                str(item['transaction_count']),
                f"{item['percentage']:.2f}%"
            ])

        elements.append(Paragraph('Category Breakdown', heading_style))
        category_table = Table(category_data, colWidths=[1.5 * inch, 1.5 * inch, 1.5 * inch, 1.5 * inch])
        category_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#34495e')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        elements.append(category_table)
        elements.append(Spacer(1, 20))

        daily_data = [['Date', 'Total Sales (KES)', 'Transactions', 'Avg Value (KES)']]
        for item in sales_data['daily_breakdown'][:30]:
            daily_data.append([
                item['date'],
                f"{item['total_sales']:,.2f}",
                str(item['transaction_count']),
                f"{item['avg_transaction_value']:,.2f}"
            ])

        elements.append(Paragraph('Daily Sales Breakdown', heading_style))
        daily_table = Table(daily_data, colWidths=[1.5 * inch, 1.5 * inch, 1.5 * inch, 1.5 * inch])
        daily_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#34495e')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey)
        ]))
        elements.append(daily_table)
        elements.append(Spacer(1, 30))

        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.grey,
            alignment=TA_CENTER
        )
        elements.append(Paragraph('CONFIDENTIAL - For Internal Use Only', footer_style))
        elements.append(Paragraph(f"© {datetime.now().year} FamousGate Hotels. All rights reserved.", footer_style))

        doc.build(elements)
        return temp_path
