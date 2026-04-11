"""
FamousGate Hotels - Security Analysis Report Generator
Professional branded PDF reports for security monitoring
"""

import os
import io
from datetime import datetime
from typing import Dict, Any, List
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, PageBreak, HRFlowable
)
from reportlab.pdfgen import canvas

# Security Document Colors - Professional, minimal color palette
SEC_BLACK = colors.HexColor('#000000')
SEC_DARK_GRAY = colors.HexColor('#2C2C2C')
SEC_GRAY = colors.HexColor('#666666')
SEC_LIGHT_GRAY = colors.HexColor('#CCCCCC')
SEC_VERY_LIGHT_GRAY = colors.HexColor('#F5F5F5')
SEC_WHITE = colors.white
SEC_RED = colors.HexColor('#8B0000')  # Dark red for critical items only


class SecurityReportGenerator:
    """Generate professional security analysis reports"""
    
    def __init__(self):
        self.logo_path = os.path.join(os.path.dirname(__file__), '..', 'assets', 'fglogo.png')
        self.styles = getSampleStyleSheet()
        self._setup_styles()
    
    def _setup_styles(self):
        """Setup custom paragraph styles - security document style"""
        self.styles.add(ParagraphStyle(
            name='ReportTitle',
            parent=self.styles['Heading1'],
            fontSize=16,
            textColor=SEC_BLACK,
            spaceAfter=6,
            alignment=TA_CENTER,
            fontName='Courier-Bold'  # Monospace font for security documents
        ))
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=11,
            textColor=SEC_BLACK,
            spaceBefore=12,
            spaceAfter=6,
            fontName='Courier-Bold'
        ))
        self.styles.add(ParagraphStyle(
            name='SmallText',
            parent=self.styles['Normal'],
            fontSize=8,
            textColor=SEC_GRAY,
            fontName='Courier'
        ))
        self.styles.add(ParagraphStyle(
            name='FooterText',
            parent=self.styles['Normal'],
            fontSize=7,
            textColor=SEC_GRAY,
            alignment=TA_CENTER,
            fontName='Courier'
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

    def _create_header(self, report_title: str, date_range: str = None):
        """Create professional report header with logo"""
        elements = []
        
        # Header table with logo and company info
        header_data = []
        logo = self._get_logo(width=1*inch)
        
        # Company info
        company_info = [
            Paragraph("<b>FamousGate Hotels</b>", self.styles['Normal']),
            Paragraph("Security Operations Center", self.styles['SmallText']),
            Paragraph("Bomet, Kenya", self.styles['SmallText']),
            Paragraph("Tel: +254 706 782 828 | Email: security@famousgatehotels.com", self.styles['SmallText']),
        ]
        
        # Date info
        now = datetime.now()
        date_info = [
            Paragraph(f"<b>Generated:</b> {now.strftime('%d/%m/%Y')}", self.styles['SmallText']),
            Paragraph(f"<b>Time:</b> {now.strftime('%H:%M:%S')}", self.styles['SmallText']),
            Paragraph("<b>Classification:</b> CONFIDENTIAL", 
                     ParagraphStyle('Confidential', parent=self.styles['SmallText'], 
                                  textColor=SEC_RED, fontName='Courier-Bold'))
        ]
        
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
        
        # Report title with black border - professional security document style
        title_table = Table([[Paragraph(f"<b>{report_title}</b>", 
            ParagraphStyle('TitleStyle', parent=self.styles['Normal'], 
                          fontSize=14, textColor=SEC_BLACK, alignment=TA_CENTER, fontName='Courier-Bold'))]], 
            colWidths=[7.5*inch])
        title_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), SEC_VERY_LIGHT_GRAY),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('BOX', (0, 0), (-1, -1), 2, SEC_BLACK),
        ]))
        elements.append(title_table)
        
        if date_range:
            elements.append(Spacer(1, 0.1*inch))
            elements.append(Paragraph(f"<i>Report Period: {date_range}</i>", 
                ParagraphStyle('DateRange', parent=self.styles['Normal'], 
                              fontSize=10, textColor=SEC_GRAY, alignment=TA_CENTER)))
        
        elements.append(Spacer(1, 0.2*inch))
        return elements

    def _create_footer(self, canvas, doc):
        """Add footer to each page"""
        canvas.saveState()
        canvas.setFont('Courier', 7)
        canvas.setFillColor(SEC_GRAY)
        
        # Footer text
        footer_text = f"FamousGate Hotels Security Report | CONFIDENTIAL | Generated: {datetime.now().strftime('%d/%m/%Y %H:%M')}"
        canvas.drawCentredString(A4[0]/2, 0.4*inch, footer_text)
        
        # Page number
        page_num = f"Page {doc.page}"
        canvas.drawRightString(A4[0] - 0.5*inch, 0.4*inch, page_num)
        
        canvas.restoreState()

    def generate_security_report(self, data: Dict[str, Any]) -> bytes:
        """Generate comprehensive security analysis report"""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.75*inch)
        elements = []
        
        # Extract data
        summary = data.get('summary', {})
        logs = data.get('logs', [])
        threat_analysis = data.get('threat_analysis', {})
        geo_distribution = data.get('geographic_distribution', [])
        
        # Header
        date_range = data.get('date_range', 'Last 24 Hours')
        elements.extend(self._create_header("SECURITY ANALYSIS REPORT", date_range))
        
        # Executive Summary
        elements.append(Paragraph("<b>EXECUTIVE SUMMARY</b>", self.styles['SectionHeader']))
        
        summary_data = [
            ['METRIC', 'VALUE', 'METRIC', 'VALUE'],
            ['Total Login Attempts', str(summary.get('total_logins', 0)),
             'Failed Logins', str(summary.get('failed_logins', 0))],
            ['Suspicious Activity', str(summary.get('suspicious_count', 0)),
             'Critical Events', str(summary.get('critical_events', 0))],
            ['Failure Rate', f"{summary.get('failure_rate', 0):.1f}%",
             'Avg Threat Score', f"{summary.get('avg_threat_score', 0):.0f}/100"],
        ]
        
        summary_table = Table(summary_data, colWidths=[1.8*inch, 1.8*inch, 1.8*inch, 1.8*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), SEC_LIGHT_GRAY),
            ('FONTNAME', (0, 0), (-1, -1), 'Courier'),
            ('FONTNAME', (0, 0), (-1, 0), 'Courier-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, SEC_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [SEC_WHITE, SEC_VERY_LIGHT_GRAY]),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Threat Analysis
        elements.append(Paragraph("<b>THREAT ANALYSIS</b>", self.styles['SectionHeader']))
        
        threat_data = [
            ['THREAT TYPE', 'COUNT', 'PERCENTAGE'],
            ['Total Attempts', str(threat_analysis.get('total', 0)), '100%'],
            ['Suspicious Activity', str(threat_analysis.get('suspicious', 0)),
             f"{(threat_analysis.get('suspicious', 0) / max(threat_analysis.get('total', 1), 1) * 100):.1f}%"],
            ['VPN Detected', str(threat_analysis.get('vpn_detected', 0)),
             f"{(threat_analysis.get('vpn_detected', 0) / max(threat_analysis.get('total', 1), 1) * 100):.1f}%"],
            ['Proxy Detected', str(threat_analysis.get('proxy_detected', 0)),
             f"{(threat_analysis.get('proxy_detected', 0) / max(threat_analysis.get('total', 1), 1) * 100):.1f}%"],
            ['High Threat (≥60)', str(threat_analysis.get('high_threat', 0)),
             f"{(threat_analysis.get('high_threat', 0) / max(threat_analysis.get('total', 1), 1) * 100):.1f}%"],
        ]
        
        threat_table = Table(threat_data, colWidths=[3*inch, 2*inch, 2.5*inch])
        threat_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), SEC_LIGHT_GRAY),
            ('FONTNAME', (0, 0), (-1, -1), 'Courier'),
            ('FONTNAME', (0, 0), (-1, 0), 'Courier-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, SEC_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [SEC_WHITE, SEC_VERY_LIGHT_GRAY]),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(threat_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Geographic Distribution
        elements.append(Paragraph("<b>GEOGRAPHIC DISTRIBUTION</b>", self.styles['SectionHeader']))
        
        geo_headers = ['COUNTRY', 'ACCESS COUNT', 'SUSPICIOUS']
        geo_data = [geo_headers]
        
        for item in geo_distribution[:10]:  # Top 10
            geo_data.append([
                str(item.get('country', 'Unknown'))[:30],
                str(item.get('count', 0)),
                str(item.get('suspicious', 0)) if item.get('suspicious', 0) > 0 else '-'
            ])
        
        if len(geo_data) == 1:
            geo_data.append(['No geographic data available', '-', '-'])
        
        geo_table = Table(geo_data, colWidths=[3.5*inch, 2*inch, 2*inch])
        geo_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), SEC_LIGHT_GRAY),
            ('FONTNAME', (0, 0), (-1, -1), 'Courier'),
            ('FONTNAME', (0, 0), (-1, 0), 'Courier-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, SEC_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [SEC_WHITE, SEC_VERY_LIGHT_GRAY]),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(geo_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Detailed Access Logs (First 50)
        elements.append(Paragraph("<b>DETAILED ACCESS LOGS</b>", self.styles['SectionHeader']))
        
        log_headers = ['TIMESTAMP', 'USER', 'IP ADDRESS', 'LOCATION', 'STATUS', 'THREAT']
        log_data = [log_headers]
        
        for log in logs[:50]:  # First 50 logs
            timestamp = log.get('timestamp', '')
            if timestamp:
                try:
                    dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    timestamp = dt.strftime('%d/%m/%Y %H:%M')
                except:
                    pass
            
            email = str(log.get('user', {}).get('email', 'Unknown'))[:25]
            ip = str(log.get('authentication', {}).get('ipAddress', 'Unknown'))
            location = log.get('location', {})
            loc_str = f"{location.get('city', 'Unknown')}, {location.get('country', 'Unknown')}"[:25]
            status = str(log.get('authentication', {}).get('status', 'Unknown')).upper()
            threat_score = log.get('security', {}).get('threatScore', 0)
            
            log_data.append([
                timestamp,
                email,
                ip,
                loc_str,
                status,
                str(threat_score)
            ])
        
        if len(log_data) == 1:
            log_data.append(['No logs available', '-', '-', '-', '-', '-'])
        
        log_table = Table(log_data, colWidths=[1.2*inch, 1.5*inch, 1.2*inch, 1.5*inch, 0.8*inch, 0.6*inch])
        log_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), SEC_LIGHT_GRAY),
            ('FONTNAME', (0, 0), (-1, -1), 'Courier'),
            ('FONTNAME', (0, 0), (-1, 0), 'Courier-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 7),
            ('ALIGN', (4, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, SEC_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [SEC_WHITE, SEC_VERY_LIGHT_GRAY]),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(log_table)
        
        if len(logs) > 50:
            elements.append(Spacer(1, 0.1*inch))
            elements.append(Paragraph(
                f"<i>Showing first 50 of {len(logs)} logs. Export to CSV/JSON for complete data.</i>",
                ParagraphStyle('Note', parent=self.styles['SmallText'], alignment=TA_CENTER)
            ))
        
        # Build PDF
        doc.build(elements, onFirstPage=self._create_footer, onLaterPages=self._create_footer)
        
        buffer.seek(0)
        return buffer.getvalue()
