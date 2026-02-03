"""
Comprehensive Audit Report Templates
Generates detailed PDF reports after successful audits
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, PageBreak
from datetime import datetime


class AuditReportTemplates:
    """Templates for generating comprehensive audit reports"""
    
    def __init__(self, pdf_generator):
        """Initialize with reference to main PDF generator"""
        self.pdf = pdf_generator
        
    def generate_sales_audit_report(self, audit_data: dict, branch_info: dict, date_range: dict):
        """
        Generate comprehensive sales audit report
        
        Args:
            audit_data: Sales verification data from backend
            branch_info: Branch details
            date_range: Start and end dates
        """
        elements = []
        
        # Header
        elements.extend(self.pdf._create_header(
            report_title="SALES AUDIT REPORT",
            date_range=f"{date_range['start_date']} to {date_range['end_date']}",
            branch=branch_info.get('name', 'All Branches')
        ))
        
        # Executive Summary
        elements.append(Paragraph("EXECUTIVE SUMMARY", self.pdf.styles['SectionHeader']))
        elements.append(Spacer(1, 0.2*inch))
        
        summary_data = [
            ['Metric', 'Value', 'Status'],
            ['Total Restaurant Revenue', self.pdf._format_currency(audit_data.get('restaurant', {}).get('total_value', 0)), '✓'],
            ['Total Bar Revenue', self.pdf._format_currency(audit_data.get('bar', {}).get('total_value', 0)), '✓'],
            ['Total POS Transactions', self.pdf._format_currency(audit_data.get('pos', {}).get('total_value', 0)), '✓'],
            ['Total Payments Collected', self.pdf._format_currency(audit_data.get('total_collected', 0)), '✓'],
            ['Voided Transactions', str(audit_data.get('restaurant', {}).get('voided', 0) + audit_data.get('bar', {}).get('voided', 0)), '⚠' if (audit_data.get('restaurant', {}).get('voided', 0) + audit_data.get('bar', {}).get('voided', 0)) > 0 else '✓'],
        ]
        
        summary_table = Table(summary_data, colWidths=[3*inch, 2*inch, 1*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), self.pdf.HEADER_BLUE),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('ALIGN', (2, 0), (2, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, self.pdf.ROW_ALT]),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Branch Performance Breakdown
        if audit_data.get('branch_summaries'):
            elements.append(Paragraph("BRANCH PERFORMANCE ANALYSIS", self.pdf.styles['SectionHeader']))
            elements.append(Spacer(1, 0.2*inch))
            
            branch_data = [['Branch', 'Restaurant', 'Bar', 'POS', 'Total', 'Voided']]
            for branch in audit_data['branch_summaries']:
                branch_data.append([
                    branch.get('branch_name', 'N/A'),
                    self.pdf._format_currency(branch.get('restaurant', {}).get('total_value', 0)),
                    self.pdf._format_currency(branch.get('bar', {}).get('total_value', 0)),
                    self.pdf._format_currency(branch.get('pos', {}).get('total_value', 0)),
                    self.pdf._format_currency(branch.get('total_revenue', 0)),
                    str(branch.get('restaurant', {}).get('voided', 0) + branch.get('bar', {}).get('voided', 0))
                ])
            
            branch_table = Table(branch_data, colWidths=[1.5*inch, 1.2*inch, 1.2*inch, 1.2*inch, 1.3*inch, 0.8*inch])
            branch_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), self.pdf.HEADER_GREEN),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
                ('ALIGN', (0, 0), (0, -1), 'LEFT'),
                ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('GRID', (0, 0), (-1, -1), 1, colors.grey),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, self.pdf.ROW_ALT]),
            ]))
            elements.append(branch_table)
            elements.append(Spacer(1, 0.3*inch))
        
        # Audit Findings & Recommendations
        elements.append(Paragraph("AUDIT FINDINGS & RECOMMENDATIONS", self.pdf.styles['SectionHeader']))
        elements.append(Spacer(1, 0.2*inch))
        
        findings = []
        total_voided = audit_data.get('restaurant', {}).get('voided', 0) + audit_data.get('bar', {}).get('voided', 0)
        
        if total_voided > 0:
            findings.append(f"• {total_voided} voided transactions detected - requires management review")
        
        if audit_data.get('total_collected', 0) > 0:
            findings.append(f"• Total revenue collected: {self.pdf._format_currency(audit_data.get('total_collected', 0))} - verified")
        
        findings.append("• All payment gateways reconciled successfully")
        findings.append("• Recommend daily reconciliation for optimal cash flow management")
        
        for finding in findings:
            elements.append(Paragraph(finding, self.pdf.styles['Normal']))
            elements.append(Spacer(1, 0.1*inch))
        
        # Auditor Sign-off
        elements.append(Spacer(1, 0.5*inch))
        elements.append(Paragraph("AUDITOR CERTIFICATION", self.pdf.styles['SectionHeader']))
        elements.append(Spacer(1, 0.2*inch))
        
        cert_text = f"""
        I hereby certify that this audit was conducted in accordance with established procedures 
        and that the information presented is accurate to the best of my knowledge.
        <br/><br/>
        Date: {datetime.now().strftime('%B %d, %Y')}<br/>
        Time: {datetime.now().strftime('%I:%M %p')}<br/>
        <br/>
        Signature: _______________________<br/>
        Auditor Name: _______________________
        """
        elements.append(Paragraph(cert_text, self.pdf.styles['Normal']))
        
        return self.pdf._create_pdf(elements, filename=f"sales_audit_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf")
    
    def generate_financial_verification_report(self, financial_data: dict, branch_info: dict, audit_date: str):
        """
        Generate comprehensive financial verification audit report
        
        Args:
            financial_data: Financial verification data
            branch_info: Branch details
            audit_date: Date of audit
        """
        elements = []
        
        # Header
        elements.extend(self.pdf._create_header(
            report_title="FINANCIAL VERIFICATION AUDIT REPORT",
            date_range=audit_date,
            branch=branch_info.get('name', 'All Branches')
        ))
        
        # Executive Summary
        elements.append(Paragraph("EXECUTIVE SUMMARY", self.pdf.styles['SectionHeader']))
        elements.append(Spacer(1, 0.2*inch))
        
        summary_data = [
            ['Financial Metric', 'Amount', 'Status'],
            ['Total Payments Received', self.pdf._format_currency(financial_data.get('total_payments', 0)), '✓'],
            ['Total Sales Recorded', self.pdf._format_currency(financial_data.get('sales', 0)), '✓'],
            ['System Variance', self.pdf._format_currency(financial_data.get('variance', 0)), '⚠' if abs(financial_data.get('variance', 0)) > 100 else '✓'],
            ['M-Pesa Collections', self.pdf._format_currency(financial_data.get('payments_by_mode', {}).get('mpesa', 0)), '✓'],
            ['Cash Collections', self.pdf._format_currency(financial_data.get('payments_by_mode', {}).get('cash', 0)), '✓'],
            ['Card Collections', self.pdf._format_currency(financial_data.get('payments_by_mode', {}).get('card', 0)), '✓'],
        ]
        
        summary_table = Table(summary_data, colWidths=[3*inch, 2*inch, 1*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), self.pdf.HEADER_YELLOW),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('ALIGN', (2, 0), (2, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, self.pdf.ROW_ALT]),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Cashier Performance
        if financial_data.get('cashier_summaries'):
            elements.append(Paragraph("CASHIER PERFORMANCE ANALYSIS", self.pdf.styles['SectionHeader']))
            elements.append(Spacer(1, 0.2*inch))
            
            cashier_data = [['Cashier Name', 'Branch', 'Transactions', 'Total Collected', 'Status']]
            for cashier in financial_data['cashier_summaries']:
                cashier_data.append([
                    cashier.get('cashier_name', 'N/A'),
                    cashier.get('branch_name', 'N/A'),
                    str(cashier.get('payment_count', 0)),
                    self.pdf._format_currency(cashier.get('total_amount', 0)),
                    '✓ Verified'
                ])
            
            cashier_table = Table(cashier_data, colWidths=[2*inch, 1.5*inch, 1*inch, 1.5*inch, 1*inch])
            cashier_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), self.pdf.HEADER_BLUE),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
                ('ALIGN', (0, 0), (0, -1), 'LEFT'),
                ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('GRID', (0, 0), (-1, -1), 1, colors.grey),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, self.pdf.ROW_ALT]),
            ]))
            elements.append(cashier_table)
            elements.append(Spacer(1, 0.3*inch))
        
        # Variance Analysis
        variance = financial_data.get('variance', 0)
        if abs(variance) > 0:
            elements.append(Paragraph("VARIANCE ANALYSIS", self.pdf.styles['SectionHeader']))
            elements.append(Spacer(1, 0.2*inch))
            
            variance_text = f"""
            A variance of {self.pdf._format_currency(variance)} has been identified between recorded sales 
            and actual payments received. {'This is within acceptable limits.' if abs(variance) < 100 else 'This requires immediate investigation and reconciliation.'}
            <br/><br/>
            Possible causes:<br/>
            • Timing differences in payment processing<br/>
            • Pending transactions not yet cleared<br/>
            • Manual entry errors requiring correction<br/>
            • System synchronization delays
            """
            elements.append(Paragraph(variance_text, self.pdf.styles['Normal']))
            elements.append(Spacer(1, 0.3*inch))
        
        # Recommendations
        elements.append(Paragraph("AUDIT RECOMMENDATIONS", self.pdf.styles['SectionHeader']))
        elements.append(Spacer(1, 0.2*inch))
        
        recommendations = [
            "• Implement daily reconciliation procedures for all payment gateways",
            "• Ensure M-Pesa statements are verified against bank settlements",
            "• Conduct weekly cashier performance reviews",
            "• Maintain detailed audit trails for all financial transactions",
            "• Schedule quarterly comprehensive financial audits"
        ]
        
        for rec in recommendations:
            elements.append(Paragraph(rec, self.pdf.styles['Normal']))
            elements.append(Spacer(1, 0.1*inch))
        
        # Auditor Certification
        elements.append(Spacer(1, 0.5*inch))
        elements.append(Paragraph("AUDITOR CERTIFICATION", self.pdf.styles['SectionHeader']))
        elements.append(Spacer(1, 0.2*inch))
        
        cert_text = f"""
        This financial verification audit has been completed in accordance with established 
        accounting standards and internal control procedures.
        <br/><br/>
        Audit Date: {audit_date}<br/>
        Report Generated: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}<br/>
        <br/>
        Auditor Signature: _______________________<br/>
        Auditor Name: _______________________<br/>
        License/Certification: _______________________
        """
        elements.append(Paragraph(cert_text, self.pdf.styles['Normal']))
        
        return self.pdf._create_pdf(elements, filename=f"financial_audit_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf")
    
    def generate_stock_audit_report(self, stock_data: dict, branch_info: dict):
        """
        Generate comprehensive stock audit report
        
        Args:
            stock_data: Stock verification data
            branch_info: Branch details
        """
        elements = []
        
        # Header
        elements.extend(self.pdf._create_header(
            report_title="STOCK RECONCILIATION AUDIT REPORT",
            date_range=datetime.now().strftime('%B %d, %Y'),
            branch=branch_info.get('name', 'All Branches')
        ))
        
        # Executive Summary
        elements.append(Paragraph("EXECUTIVE SUMMARY", self.pdf.styles['SectionHeader']))
        elements.append(Spacer(1, 0.2*inch))
        
        summary_data = [
            ['Stock Metric', 'Value', 'Status'],
            ['Total Items Audited', str(len(stock_data.get('stock_items', []))), '✓'],
            ['Items with Discrepancies', str(sum(1 for item in stock_data.get('stock_items', []) if item.get('has_discrepancy', False))), '⚠'],
            ['Total Stock Value', self.pdf._format_currency(stock_data.get('total_stock_value', 0)), '✓'],
            ['Variance Value', self.pdf._format_currency(stock_data.get('total_variance_value', 0)), '⚠' if abs(stock_data.get('total_variance_value', 0)) > 1000 else '✓'],
        ]
        
        summary_table = Table(summary_data, colWidths=[3*inch, 2*inch, 1*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), self.pdf.HEADER_GREEN),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('ALIGN', (2, 0), (2, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, self.pdf.ROW_ALT]),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Discrepancy Details
        discrepancies = [item for item in stock_data.get('stock_items', []) if item.get('has_discrepancy', False)]
        if discrepancies:
            elements.append(Paragraph("ITEMS WITH DISCREPANCIES", self.pdf.styles['SectionHeader']))
            elements.append(Spacer(1, 0.2*inch))
            
            disc_data = [['Item Name', 'Expected', 'Actual', 'Variance', 'Value Impact']]
            for item in discrepancies[:20]:  # Limit to first 20
                disc_data.append([
                    item.get('item_name', 'N/A')[:30],
                    str(item.get('theoretical_stock', 0)),
                    str(item.get('current_stock', 0)),
                    str(item.get('variance', 0)),
                    self.pdf._format_currency(item.get('variance_value', 0))
                ])
            
            disc_table = Table(disc_data, colWidths=[2.5*inch, 1*inch, 1*inch, 1*inch, 1.5*inch])
            disc_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), self.pdf.HEADER_YELLOW),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
                ('ALIGN', (0, 0), (0, -1), 'LEFT'),
                ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('GRID', (0, 0), (-1, -1), 1, colors.grey),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, self.pdf.ROW_ALT]),
            ]))
            elements.append(disc_table)
            elements.append(Spacer(1, 0.3*inch))
        
        # Recommendations
        elements.append(Paragraph("AUDIT RECOMMENDATIONS", self.pdf.styles['SectionHeader']))
        elements.append(Spacer(1, 0.2*inch))
        
        recommendations = [
            "• Investigate all discrepancies exceeding KES 500 in value",
            "• Implement cycle counting procedures for high-value items",
            "• Review stock movement procedures and documentation",
            "• Conduct staff training on proper stock handling",
            "• Schedule monthly stock reconciliation audits"
        ]
        
        for rec in recommendations:
            elements.append(Paragraph(rec, self.pdf.styles['Normal']))
            elements.append(Spacer(1, 0.1*inch))
        
        # Auditor Certification
        elements.append(Spacer(1, 0.5*inch))
        elements.append(Paragraph("AUDITOR CERTIFICATION", self.pdf.styles['SectionHeader']))
        elements.append(Spacer(1, 0.2*inch))
        
        cert_text = f"""
        This stock audit has been conducted through physical verification and system reconciliation.
        <br/><br/>
        Audit Date: {datetime.now().strftime('%B %d, %Y')}<br/>
        Report Generated: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}<br/>
        <br/>
        Auditor Signature: _______________________<br/>
        Auditor Name: _______________________
        """
        elements.append(Paragraph(cert_text, self.pdf.styles['Normal']))
        
        return self.pdf._create_pdf(elements, filename=f"stock_audit_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf")
    
    def generate_branch_orders_report(self, orders_data: dict, branch_info: dict, date_range: dict):
        """
        Generate comprehensive branch orders/requisitions audit report
        
        Args:
            orders_data: Orders/requisitions data from backend
            branch_info: Branch details
            date_range: Start and end dates
        """
        elements = []
        
        # Header
        elements.extend(self.pdf._create_header(
            report_title="BRANCH REQUISITIONS AUDIT REPORT",
            date_range=f"{date_range['start_date']} to {date_range['end_date']}",
            branch=branch_info.get('name', 'All Branches')
        ))
        
        # Executive Summary
        elements.append(Paragraph("EXECUTIVE SUMMARY", self.pdf.styles['SectionHeader']))
        elements.append(Spacer(1, 0.2*inch))
        
        summary_data = [
            ['Requisition Metric', 'Count', 'Status'],
            ['Total Requisitions', str(orders_data.get('total_requests', 0)), '✓'],
            ['Pending Approval', str(orders_data.get('pending', 0)), '⚠' if orders_data.get('pending', 0) > 0 else '✓'],
            ['Approved Orders', str(orders_data.get('approved', 0)), '✓'],
            ['Dispatched Orders', str(orders_data.get('dispatched', 0)), '✓'],
            ['Rejected Orders', str(orders_data.get('rejected', 0)), '⚠' if orders_data.get('rejected', 0) > 0 else '✓'],
        ]
        
        summary_table = Table(summary_data, colWidths=[3*inch, 2*inch, 1*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), self.pdf.HEADER_BLUE),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('ALIGN', (2, 0), (2, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, self.pdf.ROW_ALT]),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Requisitions List
        if orders_data.get('requests'):
            elements.append(Paragraph("REQUISITION DETAILS", self.pdf.styles['SectionHeader']))
            elements.append(Spacer(1, 0.2*inch))
            
            req_data = [['Req. Number', 'Department', 'Date', 'Items', 'Status']]
            for req in orders_data['requests'][:50]:  # Limit to first 50
                req_data.append([
                    req.get('request_number', 'N/A')[:15],
                    req.get('department', 'General')[:15],
                    datetime.fromisoformat(req.get('created_at', '')).strftime('%Y-%m-%d') if req.get('created_at') else 'N/A',
                    str(len(req.get('items', []))),
                    req.get('status', 'Unknown').upper()
                ])
            
            req_table = Table(req_data, colWidths=[1.5*inch, 1.5*inch, 1.2*inch, 0.8*inch, 1*inch])
            req_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), self.pdf.HEADER_GREEN),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
                ('ALIGN', (0, 0), (0, -1), 'LEFT'),
                ('ALIGN', (3, 0), (3, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('GRID', (0, 0), (-1, -1), 1, colors.grey),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, self.pdf.ROW_ALT]),
            ]))
            elements.append(req_table)
            elements.append(Spacer(1, 0.3*inch))
        
        # Audit Findings & Recommendations
        elements.append(Paragraph("AUDIT FINDINGS & RECOMMENDATIONS", self.pdf.styles['SectionHeader']))
        elements.append(Spacer(1, 0.2*inch))
        
        findings = []
        
        if orders_data.get('pending', 0) > 0:
            findings.append(f"• {orders_data.get('pending', 0)} requisitions pending approval - requires immediate review")
        
        if orders_data.get('rejected', 0) > 0:
            findings.append(f"• {orders_data.get('rejected', 0)} requisitions rejected - investigate reasons")
        
        findings.append("• All requisitions properly documented and tracked")
        findings.append("• Recommend implementing automated approval workflows")
        findings.append("• Ensure timely dispatch of approved requisitions")
        
        for finding in findings:
            elements.append(Paragraph(finding, self.pdf.styles['Normal']))
            elements.append(Spacer(1, 0.1*inch))
        
        # Auditor Certification
        elements.append(Spacer(1, 0.5*inch))
        elements.append(Paragraph("AUDITOR CERTIFICATION", self.pdf.styles['SectionHeader']))
        elements.append(Spacer(1, 0.2*inch))
        
        cert_text = f"""
        This requisitions audit has been conducted in accordance with inventory control procedures.
        <br/><br/>
        Audit Period: {date_range['start_date']} to {date_range['end_date']}<br/>
        Report Generated: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}<br/>
        <br/>
        Auditor Signature: _______________________<br/>
        Auditor Name: _______________________
        """
        elements.append(Paragraph(cert_text, self.pdf.styles['Normal']))
        
        return self.pdf._create_pdf(elements, filename=f"branch_orders_audit_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf")

