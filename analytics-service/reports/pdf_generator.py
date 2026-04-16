from datetime import date, datetime
from typing import Optional, Dict, List
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
import os
import tempfile

class PDFReportGenerator:
    async def generate_report(self, report_type: str, report_date: date, branch_id: Optional[str] = None) -> str:
        # Return a dummy path
        return "/tmp/dummy_report.pdf"

    async def get_daily_report(self, report_date: date, branch_id: Optional[str] = None) -> Optional[str]:
        return "/tmp/dummy_daily_report.pdf"

    async def generate_branch_sales_report(self, sales_data: Dict, branch_name: str, date_range: Dict) -> str:
        """Generate branded PDF report for branch sales analytics"""
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
        temp_path = temp_file.name
        temp_file.close()

        # Create PDF document
        doc = SimpleDocTemplate(temp_path, pagesize=A4,
                                rightMargin=72, leftMargin=72,
                                topMargin=72, bottomMargin=18)

        elements = []
        styles = getSampleStyleSheet()

        # Define custom styles
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

        # Header
        elements.append(Paragraph("FAMOUSGATE HOTELS", title_style))
        elements.append(Paragraph("Branch Sales Report", heading_style))
        elements.append(Paragraph(f"Branch: {branch_name}", normal_style))
        elements.append(Spacer(1, 20))

        # Report Information
        report_info = [
            ['Report Type:', 'Branch Sales Analytics'],
            ['Generated Date:', datetime.now().strftime('%B %d, %Y')],
            ['Generated Time:', datetime.now().strftime('%I:%M %p')],
            ['Report Period:', f"{date_range['start']} to {date_range['end']}"],
            ['Branch:', branch_name]
        ]
        
        info_table = Table(report_info, colWidths=[2*inch, 4*inch])
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

        # Sales Summary
        elements.append(Paragraph("Sales Summary", heading_style))
        summary = sales_data['summary']
        summary_data = [
            ['Total Sales (KES):', f"{summary['total_sales']:,.2f}"],
            ['Transaction Count:', str(summary['transaction_count'])],
            ['Average Transaction Value (KES):', f"{summary['avg_transaction_value']:,.2f}"]
        ]
        
        summary_table = Table(summary_data, colWidths=[2.5*inch, 3.5*inch])
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

        # Payment Method Breakdown
        elements.append(Paragraph("Payment Method Breakdown", heading_style))
        payment_data = [['Payment Method', 'Total Sales (KES)', 'Transactions', 'Percentage']]
        for pm in sales_data['payment_method_breakdown']:
            payment_data.append([
                pm['payment_method'].upper(),
                f"{pm['total_sales']:,.2f}",
                str(pm['transaction_count']),
                f"{pm['percentage']:.2f}%"
            ])
        
        payment_table = Table(payment_data, colWidths=[1.5*inch, 1.5*inch, 1.5*inch, 1.5*inch])
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

        # Category Breakdown
        elements.append(Paragraph("Category Breakdown", heading_style))
        category_data = [['Category', 'Total Sales (KES)', 'Transactions', 'Percentage']]
        for cat in sales_data['category_breakdown']:
            category_data.append([
                cat['category'].upper(),
                f"{cat['total_sales']:,.2f}",
                str(cat['transaction_count']),
                f"{cat['percentage']:.2f}%"
            ])
        
        category_table = Table(category_data, colWidths=[1.5*inch, 1.5*inch, 1.5*inch, 1.5*inch])
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

        # Daily Breakdown (limit to first 30 days for PDF)
        elements.append(Paragraph("Daily Sales Breakdown", heading_style))
        daily_data = [['Date', 'Total Sales (KES)', 'Transactions', 'Avg Value (KES)']]
        for day in sales_data['daily_breakdown'][:30]:
            daily_data.append([
                day['date'],
                f"{day['total_sales']:,.2f}",
                str(day['transaction_count']),
                f"{day['avg_transaction_value']:,.2f}"
            ])
        
        daily_table = Table(daily_data, colWidths=[1.5*inch, 1.5*inch, 1.5*inch, 1.5*inch])
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

        # Footer
        elements.append(Spacer(1, 30))
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.grey,
            alignment=TA_CENTER
        )
        elements.append(Paragraph("CONFIDENTIAL - For Internal Use Only", footer_style))
        elements.append(Paragraph(
            f"© {datetime.now().year} FamousGate Hotels. All rights reserved.",
            footer_style
        ))

        # Build PDF
        doc.build(elements)
        
        return temp_path

    async def generate_security_report(self, data: Dict) -> str:
        """Generate branded security report PDF"""
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
        temp_path = temp_file.name
        temp_file.close()

        # Create PDF document
        doc = SimpleDocTemplate(temp_path, pagesize=A4,
                                rightMargin=72, leftMargin=72,
                                topMargin=72, bottomMargin=18)

        # Container for the 'Flowable' objects
        elements = []

        # Define styles
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

        # Header
        elements.append(Paragraph("FAMOUSGATE HOTELS", title_style))
        elements.append(Paragraph("Security Analysis Report", heading_style))
        elements.append(Paragraph("Security Operations Center", normal_style))
        elements.append(Spacer(1, 20))

        # Report Information
        report_info = [
            ['Report Type:', 'Security Access & Threat Analysis'],
            ['Generated Date:', datetime.now().strftime('%B %d, %Y')],
            ['Generated Time:', datetime.now().strftime('%I:%M %p')],
            ['Report Period:', data.get('date_range', 'Last 24 Hours')],
            ['Classification:', 'CONFIDENTIAL'],
            ['Total Records:', str(len(data.get('logs', [])))]
        ]
        
        info_table = Table(report_info, colWidths=[2*inch, 4*inch])
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

        # Company Information
        elements.append(Paragraph("Company Information", heading_style))
        company_info = [
            ['Organization:', 'FamousGate Hotels'],
            ['Location:', 'Bomet, Kenya'],
            ['Contact:', '+254 706 782 828'],
            ['Email:', 'security@famousgatehotels.com']
        ]
        
        company_table = Table(company_info, colWidths=[2*inch, 4*inch])
        company_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#ecf0f1')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey)
        ]))
        elements.append(company_table)
        elements.append(Spacer(1, 20))

        # Executive Summary
        elements.append(Paragraph("Executive Summary", heading_style))
        summary = data.get('summary', {})
        if summary:
            summary_data = [
                ['Total Login Attempts:', str(summary.get('total_logins', 0))],
                ['Failed Login Attempts:', str(summary.get('failed_logins', 0))],
                ['Suspicious Activity:', str(summary.get('suspicious_count', 0))],
                ['Critical Events (24h):', str(summary.get('critical_events', 0))],
                ['Failure Rate:', f"{summary.get('failure_rate', 0):.2f}%"],
                ['Avg Threat Score:', f"{summary.get('avg_threat_score', 0):.2f}"]
            ]
            
            summary_table = Table(summary_data, colWidths=[2.5*inch, 3.5*inch])
            summary_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#ecf0f1')),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 1, colors.grey)
            ]))
            elements.append(summary_table)
            elements.append(Spacer(1, 20))

        # Threat Analysis
        elements.append(Paragraph("Threat Analysis", heading_style))
        threat = data.get('threat_analysis', {})
        threat_data = [
            ['Total Access Attempts:', str(threat.get('total', 0))],
            ['Suspicious Activity:', str(threat.get('suspicious', 0))],
            ['VPN Connections:', str(threat.get('vpn_detected', 0))],
            ['Proxy Connections:', str(threat.get('proxy_detected', 0))],
            ['High Threat Events:', str(threat.get('high_threat', 0))]
        ]
        
        threat_table = Table(threat_data, colWidths=[2.5*inch, 3.5*inch])
        threat_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#ecf0f1')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey)
        ]))
        elements.append(threat_table)
        elements.append(Spacer(1, 20))

        # Geographic Distribution
        elements.append(Paragraph("Geographic Distribution", heading_style))
        geo_dist = data.get('geographic_distribution', [])[:5]  # Top 5
        if geo_dist:
            geo_data = [['Country', 'Access Count', 'Suspicious']]
            for item in geo_dist:
                geo_data.append([
                    item.get('country', 'Unknown'),
                    str(item.get('count', 0)),
                    str(item.get('suspicious', 0))
                ])
            
            geo_table = Table(geo_data, colWidths=[2*inch, 2*inch, 2*inch])
            geo_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#34495e')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            elements.append(geo_table)
            elements.append(Spacer(1, 20))

        # Page break before detailed logs
        elements.append(PageBreak())

        # Detailed Access Logs
        elements.append(Paragraph("Detailed Access Logs", heading_style))
        logs = data.get('logs', [])[:50]  # Limit to first 50 logs
        if logs:
            log_data = [['Time', 'User', 'Status', 'IP', 'Location', 'Threat']]
            for log in logs:
                timestamp = log.get('timestamp', '')
                if timestamp:
                    try:
                        dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                        timestamp = dt.strftime('%m/%d %H:%M')
                    except:
                        timestamp = timestamp[:16]
                
                user_email = log.get('user', {}).get('email', 'Unknown')
                status = log.get('authentication', {}).get('status', 'Unknown').upper()
                ip = log.get('authentication', {}).get('ipAddress', 'N/A')
                location = log.get('location', {}).get('country', 'Unknown')
                threat_level = log.get('security', {}).get('threatLevel', 'Low')
                
                log_data.append([
                    timestamp,
                    user_email[:20],  # Truncate long emails
                    status,
                    ip,
                    location,
                    threat_level
                ])
            
            log_table = Table(log_data, colWidths=[1*inch, 1.5*inch, 0.8*inch, 1.2*inch, 1*inch, 0.8*inch])
            log_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#34495e')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey)
            ]))
            elements.append(log_table)

        # Footer
        elements.append(Spacer(1, 30))
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.grey,
            alignment=TA_CENTER
        )
        elements.append(Paragraph("CONFIDENTIALITY NOTICE", footer_style))
        elements.append(Paragraph(
            "This report contains confidential security information and is intended solely for authorized personnel.",
            footer_style
        ))
        elements.append(Paragraph(
            f"© {datetime.now().year} FamousGate Hotels. All rights reserved.",
            footer_style
        ))

        # Build PDF
        doc.build(elements)
        
        return temp_path

