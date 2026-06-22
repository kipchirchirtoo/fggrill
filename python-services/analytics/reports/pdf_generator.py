from datetime import date
from typing import Optional
from datetime import datetime
from typing import Dict, Any, List
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.charts.legends import Legend
from reportlab.graphics.charts.linecharts import HorizontalLineChart
from reportlab.graphics.charts.barcharts import HorizontalBarChart
import tempfile

# Mirrors the colour palette used by the on-screen Branch Analytics charts
# (_PaymentMethodPieChart / _categoryColor in branch_accountant_dashboard.dart)
# so the printed report visually matches the dashboard at a glance.
PAYMENT_COLORS = {
    'cash': '#10B981',
    'card': '#3B82F6',
    'mpesa': '#8B5CF6',
    'mixed': '#F59E0B',
}
CATEGORY_COLORS = {
    'rooms': '#3B82F6',
    'restaurant': '#10B981',
    'bar': '#F59E0B',
    'spa': '#8B5CF6',
    'conference': '#EC4899',
    'dynamic_services': '#6B7280',
    'carwash': '#14B8A6',
}
CHART_FALLBACK_COLOR = '#94A3B8'


def _color_for(palette: Dict[str, str], key: str) -> str:
    return palette.get(str(key or '').lower(), CHART_FALLBACK_COLOR)


def build_donut_chart(slices: List[Dict[str, Any]], width: float = 480, height: float = 150) -> Optional[Drawing]:
    total = sum(s['value'] for s in slices)
    if total <= 0 or not slices:
        return None
    drawing = Drawing(width, height)
    pie = Pie()
    pie.x = 15
    pie.y = 10
    pie.width = 120
    pie.height = 120
    pie.innerRadiusFraction = 0.5
    pie.data = [max(s['value'], 0.01) for s in slices]
    pie.labels = None
    pie.slices.strokeWidth = 0.5
    pie.slices.strokeColor = colors.white
    for i, s in enumerate(slices):
        pie.slices[i].fillColor = colors.HexColor(s['color'])
    drawing.add(pie)

    legend = Legend()
    legend.x = 165
    legend.y = height - 12
    legend.dx = 7
    legend.dy = 7
    legend.dxTextSpace = 6
    legend.deltay = 13
    legend.fontName = 'Helvetica'
    legend.fontSize = 7.5
    legend.alignment = 'right'
    legend.colorNamePairs = [
        (colors.HexColor(s['color']), f"{str(s['label']).upper()} - KES {s['value']:,.0f} ({s['value'] / total * 100:.1f}%)")
        for s in slices
    ]
    drawing.add(legend)
    return drawing


def build_line_chart(points: List[Dict[str, Any]], width: float = 515, height: float = 150) -> Optional[Drawing]:
    if not points:
        return None
    drawing = Drawing(width, height)
    chart = HorizontalLineChart()
    chart.x = 45
    chart.y = 18
    chart.width = width - 65
    chart.height = height - 35
    chart.data = [[p['value'] for p in points]]
    step = max(1, len(points) // 8)
    chart.categoryAxis.categoryNames = [p['label'] if i % step == 0 else '' for i, p in enumerate(points)]
    chart.categoryAxis.labels.fontSize = 6
    chart.categoryAxis.labels.angle = 0
    chart.lines[0].strokeColor = colors.HexColor('#0066cc')
    chart.lines[0].strokeWidth = 1.6
    chart.lines[0].symbol = None
    chart.valueAxis.valueMin = 0
    chart.valueAxis.labels.fontSize = 6
    drawing.add(chart)
    return drawing


def build_bar_chart(bars: List[Dict[str, Any]], width: float = 515, height: float = 140) -> Optional[Drawing]:
    if not bars:
        return None
    drawing = Drawing(width, max(height, 40 + len(bars) * 18))
    chart = HorizontalBarChart()
    chart.x = 95
    chart.y = 18
    chart.width = width - 115
    chart.height = drawing.height - 35
    chart.data = [[b['value'] for b in bars]]
    chart.categoryAxis.categoryNames = [str(b['label']).upper() for b in bars]
    chart.categoryAxis.labels.fontSize = 7
    chart.valueAxis.valueMin = 0
    chart.valueAxis.labels.fontSize = 6.5
    chart.barLabelFormat = '%0.0f'
    chart.barWidth = 10
    for i, b in enumerate(bars):
        chart.bars[(0, i)].fillColor = colors.HexColor(b['color'])
    drawing.add(chart)
    return drawing

class PDFReportGenerator:
    async def generate_report(self, report_type: str, report_date: date, branch_id: Optional[str] = None) -> str:
        return "/tmp/dummy_report.pdf"

    async def get_daily_report(self, report_date: date, branch_id: Optional[str] = None) -> Optional[str]:
        return "/tmp/dummy_daily_report.pdf"

    async def generate_branch_sales_report(self, sales_data: Dict, branch_name: str, date_range: Dict, extra: Optional[Dict] = None) -> str:
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
        elements.append(Spacer(1, 10))

        if extra:
            fin_colors = [colors.HexColor('#0f766e'), colors.HexColor('#b91c1c'), colors.HexColor('#312e81'), colors.HexColor('#78350f')]
            net_position = float(extra.get('receivables', 0)) - float(extra.get('payables', 0))
            fin_header = ['BRANCH REVENUE', 'BRANCH EXPENSES', 'NET PROFIT', 'NET POSITION']
            fin_values = [money(extra.get('revenue')), money(extra.get('expenses')), money(extra.get('net_profit')), money(net_position)]
            fin_table = Table([fin_header, fin_values], colWidths=[1.77 * inch] * 4, rowHeights=[18, 26])
            fin_style = [
                ('TEXTCOLOR', (0, 0), (-1, 0), gold),
                ('TEXTCOLOR', (0, 1), (-1, 1), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 7),
                ('FONTSIZE', (0, 1), (-1, 1), 10.5),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.white)
            ]
            for i, c in enumerate(fin_colors):
                fin_style.append(('BACKGROUND', (i, 0), (i, 1), c))
            fin_table.setStyle(TableStyle(fin_style))
            elements.append(fin_table)
            elements.append(Spacer(1, 14))

        trend_chart = build_line_chart([
            {'label': safe_date(item.get('date')), 'value': float(item.get('total_sales') or 0)}
            for item in sales_data.get('daily_breakdown', [])
        ])
        if trend_chart:
            elements.append(Paragraph('SALES TREND', heading_style))
            elements.append(trend_chart)
            elements.append(Spacer(1, 8))

        elements.append(Paragraph('DETAILED ANALYSIS', heading_style))
        for line in self._build_narrative(sales_data, extra, money, safe_date):
            elements.append(Paragraph(f'&bull;&nbsp;&nbsp;{line}', normal_style))
            elements.append(Spacer(1, 3))
        elements.append(Spacer(1, 10))

        payment_data = [['Payment Method', 'Total Sales (KES)', 'Transactions', 'Percentage']]
        donut_slices = []
        for item in sales_data.get('payment_method_breakdown', []):
            payment_data.append([
                str(item.get('payment_method') or 'Unknown').upper(),
                money(item.get('total_sales')),
                f"{int(item.get('transaction_count') or 0):,}",
                f"{float(item.get('percentage') or 0):.1f}%"
            ])
            donut_slices.append({
                'label': item.get('payment_method') or 'Unknown',
                'value': float(item.get('total_sales') or 0),
                'color': _color_for(PAYMENT_COLORS, item.get('payment_method'))
            })

        elements.append(Paragraph('REVENUE BY PAYMENT METHOD', heading_style))
        donut = build_donut_chart(donut_slices)
        if donut:
            elements.append(donut)
            elements.append(Spacer(1, 4))
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
        bar_slices = []
        for item in sales_data.get('category_breakdown', []):
            category_data.append([
                str(item.get('category') or 'Unknown').upper(),
                money(item.get('total_sales')),
                f"{int(item.get('transaction_count') or 0):,}",
                f"{float(item.get('percentage') or 0):.1f}%"
            ])
            bar_slices.append({
                'label': item.get('category') or 'Unknown',
                'value': float(item.get('total_sales') or 0),
                'color': _color_for(CATEGORY_COLORS, item.get('category'))
            })

        elements.append(Paragraph('REVENUE BY CATEGORY', heading_style))
        bar_chart = build_bar_chart(bar_slices)
        if bar_chart:
            elements.append(bar_chart)
            elements.append(Spacer(1, 4))
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

        if extra:
            elements.append(Paragraph('FINANCIAL SUMMARY', heading_style))
            revenue_rows = [(k.upper(), v) for k, v in (extra.get('revenue_by_source') or {}).items() if v]
            expense_rows = [(k.upper(), v) for k, v in (extra.get('expenses_by_category') or {}).items()]
            rev_data = [['Revenue Source', 'Amount (KES)']] + (
                [[k, money(v)] for k, v in revenue_rows] or [['No revenue recorded', money(0)]]
            )
            exp_data = [['Expense Category', 'Amount (KES)']] + (
                [[k, money(v)] for k, v in expense_rows] or [['No expenses recorded', money(0)]]
            )
            mini_table_style = TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), header_bg),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
                ('FONTSIZE', (0, 0), (-1, -1), 7.5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, row_bg]),
                ('GRID', (0, 0), (-1, -1), 0.35, border)
            ])
            rev_table = Table(rev_data, colWidths=[1.55 * inch, 1.55 * inch])
            rev_table.setStyle(mini_table_style)
            exp_table = Table(exp_data, colWidths=[1.55 * inch, 1.55 * inch])
            exp_table.setStyle(mini_table_style)
            fin_summary_table = Table([[rev_table, exp_table]], colWidths=[3.55 * inch, 3.55 * inch])
            fin_summary_table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
            elements.append(fin_summary_table)
            elements.append(Spacer(1, 6))
            elements.append(Paragraph(
                f"Outstanding Receivables: {money(extra.get('receivables'))} &nbsp;|&nbsp; Outstanding Payables: {money(extra.get('payables'))}",
                normal_style
            ))
            elements.append(Spacer(1, 12))

            staff_audit = extra.get('staff_audit') or {}
            elements.append(Paragraph('STAFF AUDIT SUMMARY', heading_style))
            audit_summary_data = [
                ['STAFF ACTIONS', 'CRITICAL ACTIONS', 'STAFF INVOLVED'],
                [
                    f"{int(staff_audit.get('total_actions') or 0):,}",
                    f"{int(staff_audit.get('critical_actions') or 0):,}",
                    f"{int(staff_audit.get('unique_users') or 0):,}"
                ]
            ]
            audit_summary_table = Table(audit_summary_data, colWidths=[2.36 * inch, 2.36 * inch, 2.36 * inch], rowHeights=[18, 24])
            audit_summary_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#334155')),
                ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#475569')),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 7.5),
                ('FONTSIZE', (0, 1), (-1, 1), 11),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.white)
            ]))
            elements.append(audit_summary_table)
            elements.append(Spacer(1, 8))

            recent_critical = staff_audit.get('recent_critical') or []
            critical_data = [['Staff', 'Action', 'Date']] + (
                [[log.get('user_name', 'Unknown'), str(log.get('action') or '-').upper(), safe_date(log.get('created_at'))] for log in recent_critical]
                or [['-', 'No critical actions in this period', '-']]
            )
            elements.append(Paragraph('Recent Critical Actions (delete / void / discount / refund / role change)', normal_style))
            elements.append(Spacer(1, 4))
            critical_table = Table(critical_data, colWidths=[2.5 * inch, 3.05 * inch, 1.55 * inch])
            critical_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), header_bg),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('ALIGN', (2, 1), (2, -1), 'RIGHT'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, row_bg]),
                ('GRID', (0, 0), (-1, -1), 0.35, border)
            ]))
            elements.append(critical_table)
            elements.append(Spacer(1, 14))

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
        elements.append(Spacer(1, 12))

        transactions_data = [['Date', 'Source', 'Category', 'Payment', 'Amount (KES)']]
        for txn in (sales_data.get('transactions') or [])[:40]:
            transactions_data.append([
                safe_date(txn.get('transaction_date')),
                str(txn.get('source') or '-').upper(),
                str(txn.get('category') or '-').upper(),
                str(txn.get('payment_method') or '-').upper(),
                money(txn.get('total_amount'))
            ])

        elements.append(Paragraph('RECENT TRANSACTIONS', heading_style))
        transactions_table = Table(transactions_data, colWidths=[1.2 * inch, 1.3 * inch, 1.4 * inch, 1.4 * inch, 1.8 * inch])
        transactions_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), header_bg),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (4, 1), (4, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 7.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, row_bg]),
            ('GRID', (0, 0), (-1, -1), 0.35, border)
        ]))
        elements.append(transactions_table)
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

    def _build_narrative(self, sales_data: Dict, extra: Optional[Dict], money, safe_date) -> List[str]:
        """Plain-English read of the period's numbers (best/worst day, dominant
        payment method, top category, margin, staff-audit flags) so the report
        isn't just raw tables -- it answers "so what happened this period?"
        the way an accountant reading the dashboard would explain it."""
        lines: List[str] = []
        summary = sales_data.get('summary', {})
        daily = sales_data.get('daily_breakdown', [])

        lines.append(
            f"The branch recorded {money(summary.get('total_sales'))} in total sales across "
            f"{int(summary.get('transaction_count') or 0):,} transactions during the report period, "
            f"averaging {money(summary.get('avg_transaction_value'))} per transaction."
        )

        if len(daily) > 1:
            best = max(daily, key=lambda d: d.get('total_sales') or 0)
            worst = min(daily, key=lambda d: d.get('total_sales') or 0)
            lines.append(
                f"The strongest trading day was {safe_date(best.get('date'))} with {money(best.get('total_sales'))} "
                f"across {best.get('transaction_count')} transactions, while {safe_date(worst.get('date'))} was the "
                f"slowest at {money(worst.get('total_sales'))}."
            )

        payments = sales_data.get('payment_method_breakdown', [])
        if payments:
            top_payment = max(payments, key=lambda p: p.get('total_sales') or 0)
            lines.append(
                f"{str(top_payment.get('payment_method') or 'Unknown').upper()} was the dominant payment method, "
                f"accounting for {float(top_payment.get('percentage') or 0):.1f}% of sales "
                f"({money(top_payment.get('total_sales'))})."
            )

        categories = sales_data.get('category_breakdown', [])
        if categories:
            top_category = max(categories, key=lambda c: c.get('total_sales') or 0)
            lines.append(
                f"{str(top_category.get('category') or 'Unknown').upper()} was the top-performing category, "
                f"contributing {float(top_category.get('percentage') or 0):.1f}% of total revenue "
                f"({money(top_category.get('total_sales'))})."
            )

        if extra:
            revenue = float(extra.get('revenue') or 0)
            expenses = float(extra.get('expenses') or 0)
            net_profit = float(extra.get('net_profit') or 0)
            margin = (net_profit / revenue * 100) if revenue > 0 else 0
            net_position = float(extra.get('receivables') or 0) - float(extra.get('payables') or 0)
            lines.append(
                f"Branch revenue of {money(revenue)} against expenses of {money(expenses)} produced a net profit of "
                f"{money(net_profit)} ({margin:.1f}% margin). Outstanding receivables stand at "
                f"{money(extra.get('receivables'))} against payables of {money(extra.get('payables'))}, "
                f"a net position of {money(net_position)}."
            )
            staff_audit = extra.get('staff_audit') or {}
            critical = int(staff_audit.get('critical_actions') or 0)
            if critical > 0:
                lines.append(
                    f"{critical} critical staff action(s) (voids, discounts, refunds, role changes) were logged "
                    f"across {int(staff_audit.get('unique_users') or 0)} staff member(s) during this period and "
                    f"should be reviewed in the Staff Audit Summary below."
                )
            else:
                lines.append("No critical staff actions (voids, discounts, refunds, role changes) were logged during this period.")

        return lines
