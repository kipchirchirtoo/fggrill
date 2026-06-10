from datetime import date
from typing import Optional
from datetime import datetime
from typing import Dict
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
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

        primary = colors.HexColor('#1a1a1a')
        secondary = colors.HexColor('#555555')
        gold = colors.HexColor('#c8a84b')
        border = colors.HexColor('#e0e0e0')
        header_bg = colors.HexColor('#333333')
        row_bg = colors.HexColor('#f9f9f9')
        accent = colors.HexColor('#0066cc')

        doc = SimpleDocTemplate(
            temp_path,
            pagesize=A4,
            rightMargin=40,
            leftMargin=40,
            topMargin=34,
            bottomMargin=42
        )

        elements = []
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            'FGTitle',
            parent=styles['Heading1'],
            fontSize=15,
            textColor=primary,
            spaceAfter=3,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        )

        subtitle_style = ParagraphStyle(
            'FGSubtitle',
            parent=styles['Normal'],
            fontSize=9,
            textColor=secondary,
            spaceAfter=10,
            alignment=TA_CENTER,
            fontName='Helvetica'
        )

        heading_style = ParagraphStyle(
            'FGHeading',
            parent=styles['Heading2'],
            fontSize=11,
            textColor=primary,
            spaceAfter=8,
            spaceBefore=12,
            fontName='Helvetica-Bold'
        )

        normal_style = ParagraphStyle(
            'FGNormal',
            parent=styles['Normal'],
            fontSize=9,
            textColor=primary,
            leading=12
        )

        def money(value):
            return f"KES {float(value or 0):,.2f}"

        def safe_date(value):
            try:
                return datetime.fromisoformat(str(value).replace('Z', '+00:00')).strftime('%d %b %Y')
            except Exception:
                return str(value or '-')

        def logo_path():
            candidates = [
                os.path.abspath(os.path.join(os.getcwd(), 'frontend/public/fglogo.png')),
                os.path.abspath(os.path.join(os.getcwd(), '../frontend/public/fglogo.png')),
                os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../frontend/public/fglogo.png')),
                os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../frontend/public/fglogo.png')),
            ]
            for candidate in candidates:
                if os.path.exists(candidate):
                    return candidate
            return None

        logo = logo_path()
        if logo:
            logo_table = Table(
                [[Image(logo, width=0.62 * inch, height=0.62 * inch),
                  Paragraph(
                      '<b>FamousGateHotels</b><br/>Bomet, Kenya<br/>'
                      'Email: famousgateshotelsbmt@gmail.com<br/>Tel: 0706 782 828',
                      ParagraphStyle(
                          'CompanyBlock',
                          parent=normal_style,
                          alignment=TA_RIGHT,
                          fontSize=8.5,
                          textColor=secondary,
                          leading=11
                      )
                  )]],
                colWidths=[1.0 * inch, 6.1 * inch]
            )
        else:
            logo_table = Table(
                [[Paragraph('<b>FG</b>', ParagraphStyle('FGMark', parent=styles['Normal'], fontSize=20, textColor=colors.white, alignment=TA_CENTER)),
                  Paragraph(
                      '<b>FamousGateHotels</b><br/>Bomet, Kenya<br/>'
                      'Email: famousgateshotelsbmt@gmail.com<br/>Tel: 0706 782 828',
                      ParagraphStyle('CompanyBlockFallback', parent=normal_style, alignment=TA_RIGHT, fontSize=8.5, textColor=secondary, leading=11)
                  )]],
                colWidths=[1.0 * inch, 6.1 * inch]
            )
        logo_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (0, 0), primary if not logo else colors.white),
            ('BOX', (0, 0), (0, 0), 0.5, primary if not logo else colors.white),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ]))
        elements.append(logo_table)

        elements.append(Table([['']], colWidths=[7.1 * inch], rowHeights=[3], style=[
            ('BACKGROUND', (0, 0), (-1, -1), gold),
            ('LINEABOVE', (0, 0), (-1, -1), 0.5, border),
        ]))
        elements.append(Spacer(1, 10))

        elements.append(Paragraph('BRANCH SALES ANALYTICS REPORT', title_style))
        elements.append(Paragraph(
            f"{branch_name} | {safe_date(date_range['start'])} to {safe_date(date_range['end'])}",
            subtitle_style
        ))

        report_info = [
            ['Report Type:', 'Branch Sales Analytics'],
            ['Generated:', datetime.now().strftime('%d %b %Y, %I:%M %p')],
            ['Report Period:', f"{safe_date(date_range['start'])} to {safe_date(date_range['end'])}"],
            ['Branch:', branch_name]
        ]

        info_table = Table(report_info, colWidths=[1.55 * inch, 5.55 * inch])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), row_bg),
            ('TEXTCOLOR', (0, 0), (-1, -1), primary),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
            ('TOPPADDING', (0, 0), (-1, -1), 7),
            ('GRID', (0, 0), (-1, -1), 0.5, border)
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 14))

        summary = sales_data['summary']
        summary_data = [
            ['TOTAL SALES', 'TRANSACTIONS', 'AVERAGE TICKET'],
            [money(summary.get('total_sales')), f"{int(summary.get('transaction_count') or 0):,}", money(summary.get('avg_transaction_value'))]
        ]

        summary_table = Table(summary_data, colWidths=[2.36 * inch, 2.36 * inch, 2.36 * inch], rowHeights=[20, 28])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), header_bg),
            ('BACKGROUND', (0, 1), (-1, 1), primary),
            ('TEXTCOLOR', (0, 0), (-1, 0), gold),
            ('TEXTCOLOR', (0, 1), (-1, 1), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('FONTSIZE', (0, 1), (-1, 1), 12),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.white)
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 14))

        payment_data = [['Payment Method', 'Total Sales (KES)', 'Transactions', 'Percentage']]
        for item in sales_data.get('payment_method_breakdown', []):
            payment_data.append([
                str(item.get('payment_method') or 'Unknown').upper(),
                money(item.get('total_sales')),
                f"{int(item.get('transaction_count') or 0):,}",
                f"{float(item.get('percentage') or 0):.1f}%"
            ])

        elements.append(Paragraph('REVENUE BY PAYMENT METHOD', heading_style))
        payment_table = Table(payment_data, colWidths=[2.0 * inch, 2.0 * inch, 1.55 * inch, 1.55 * inch])
        payment_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), header_bg),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (0, 1), (0, -1), 'LEFT'),
            ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
            ('TOPPADDING', (0, 0), (-1, -1), 7),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, row_bg]),
            ('GRID', (0, 0), (-1, -1), 0.35, border)
        ]))
        elements.append(payment_table)
        elements.append(Spacer(1, 12))

        category_data = [['Category', 'Total Sales (KES)', 'Transactions', 'Percentage']]
        for item in sales_data.get('category_breakdown', []):
            category_data.append([
                str(item.get('category') or 'Unknown').upper(),
                money(item.get('total_sales')),
                f"{int(item.get('transaction_count') or 0):,}",
                f"{float(item.get('percentage') or 0):.1f}%"
            ])

        elements.append(Paragraph('REVENUE BY CATEGORY', heading_style))
        category_table = Table(category_data, colWidths=[2.0 * inch, 2.0 * inch, 1.55 * inch, 1.55 * inch])
        category_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), accent),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (0, 1), (0, -1), 'LEFT'),
            ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
            ('TOPPADDING', (0, 0), (-1, -1), 7),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, row_bg]),
            ('GRID', (0, 0), (-1, -1), 0.35, border)
        ]))
        elements.append(category_table)
        elements.append(Spacer(1, 12))

        daily_data = [['Date', 'Total Sales (KES)', 'Transactions', 'Avg Value (KES)']]
        for item in sales_data.get('daily_breakdown', [])[:31]:
            daily_data.append([
                safe_date(item.get('date')),
                money(item.get('total_sales')),
                f"{int(item.get('transaction_count') or 0):,}",
                money(item.get('avg_transaction_value'))
            ])

        elements.append(Paragraph('DAILY SALES BREAKDOWN', heading_style))
        daily_table = Table(daily_data, colWidths=[1.75 * inch, 2.0 * inch, 1.55 * inch, 1.8 * inch])
        daily_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), header_bg),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
            ('ALIGN', (3, 1), (3, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, row_bg]),
            ('GRID', (0, 0), (-1, -1), 0.35, border)
        ]))
        elements.append(daily_table)
        elements.append(Spacer(1, 18))

        footer_style = ParagraphStyle(
            'FGFooter',
            parent=styles['Normal'],
            fontSize=7.5,
            textColor=secondary,
            alignment=TA_CENTER
        )
        elements.append(Paragraph(
            f"Generated: {datetime.now().strftime('%d %b %Y, %I:%M %p')} | FamousGateHotels - Confidential",
            footer_style
        ))

        doc.build(elements)
        return temp_path
