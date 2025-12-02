"""
Receipt and Invoice PDF Generator
Generates professional receipts, invoices, and inventory receipts with branding
"""

import os
import io
from datetime import datetime
from typing import Dict, List, Optional, Any
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.units import mm, inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing, Line
import base64


class ReceiptGenerator:
    """Generates thermal-style receipts (like first image template)"""
    
    def __init__(self, logo_path: str = None):
        self.logo_path = logo_path or os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'public', 'fglogo.png')
        self.company_name = "Famous Gate Hotel"
        self.company_address = "Kericho, Kenya"
        self.company_phone = "+254 700 000 000"
        self.company_email = "info@famousgate.co.ke"
        
    def generate_receipt(self, receipt_data: Dict[str, Any]) -> bytes:
        """Generate a thermal-style receipt PDF"""
        buffer = io.BytesIO()
        
        # Receipt width (80mm thermal paper)
        width = 80 * mm
        # Dynamic height based on items
        item_count = len(receipt_data.get('items', []))
        height = (180 + (item_count * 15)) * mm
        
        c = canvas.Canvas(buffer, pagesize=(width, height))
        
        # Starting Y position (from top)
        y = height - 15 * mm
        center_x = width / 2
        
        # === HEADER ===
        # Logo
        if os.path.exists(self.logo_path):
            try:
                c.drawImage(self.logo_path, center_x - 12*mm, y - 20*mm, width=24*mm, height=24*mm, preserveAspectRatio=True)
                y -= 25 * mm
            except:
                pass
        
        # Company name
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(center_x, y, self.company_name)
        y -= 5 * mm
        
        # Address
        c.setFont("Helvetica", 8)
        c.drawCentredString(center_x, y, self.company_address)
        y -= 4 * mm
        c.drawCentredString(center_x, y, f"Tel: {self.company_phone}")
        y -= 6 * mm
        
        # Receipt type header
        c.setFont("Helvetica-Bold", 11)
        receipt_type = receipt_data.get('receipt_type', 'CASH RECEIPT').upper()
        c.drawCentredString(center_x, y, receipt_type)
        y -= 8 * mm
        
        # Dashed line
        c.setDash(2, 2)
        c.line(5*mm, y, width - 5*mm, y)
        c.setDash()
        y -= 6 * mm
        
        # === RECEIPT INFO ===
        c.setFont("Helvetica", 8)
        receipt_no = receipt_data.get('receipt_number', 'N/A')
        date_str = receipt_data.get('date', datetime.now().strftime('%Y-%m-%d %H:%M'))
        
        c.drawString(5*mm, y, f"Receipt #: {receipt_no}")
        y -= 4 * mm
        c.drawString(5*mm, y, f"Date: {date_str}")
        y -= 4 * mm
        
        if receipt_data.get('table_number'):
            c.drawString(5*mm, y, f"Table: {receipt_data['table_number']}")
            y -= 4 * mm
        if receipt_data.get('room_number'):
            c.drawString(5*mm, y, f"Room: {receipt_data['room_number']}")
            y -= 4 * mm
        if receipt_data.get('customer_name'):
            c.drawString(5*mm, y, f"Customer: {receipt_data['customer_name']}")
            y -= 4 * mm
        if receipt_data.get('cashier_name'):
            c.drawString(5*mm, y, f"Served by: {receipt_data['cashier_name']}")
            y -= 4 * mm
        
        y -= 3 * mm
        
        # Dashed line
        c.setDash(2, 2)
        c.line(5*mm, y, width - 5*mm, y)
        c.setDash()
        y -= 6 * mm
        
        # === ITEMS HEADER ===
        c.setFont("Helvetica-Bold", 8)
        c.drawString(5*mm, y, "Description")
        c.drawRightString(width - 5*mm, y, "Price")
        y -= 5 * mm
        
        # Items
        c.setFont("Helvetica", 8)
        items = receipt_data.get('items', [])
        for item in items:
            name = item.get('name', item.get('item_name', 'Item'))
            qty = item.get('quantity', 1)
            price = item.get('total', item.get('unit_price', 0) * qty)
            
            # Truncate long names
            if len(name) > 25:
                name = name[:22] + "..."
            
            c.drawString(5*mm, y, f"{qty}x {name}")
            c.drawRightString(width - 5*mm, y, f"{price:,.0f}")
            y -= 4 * mm
        
        y -= 3 * mm
        
        # Dashed line
        c.setDash(2, 2)
        c.line(5*mm, y, width - 5*mm, y)
        c.setDash()
        y -= 6 * mm
        
        # === TOTALS ===
        c.setFont("Helvetica", 9)
        subtotal = receipt_data.get('subtotal', 0)
        tax = receipt_data.get('tax_amount', receipt_data.get('tax', 0))
        discount = receipt_data.get('discount_amount', 0)
        total = receipt_data.get('total_amount', receipt_data.get('total', 0))
        
        c.drawString(5*mm, y, "Subtotal")
        c.drawRightString(width - 5*mm, y, f"KES {subtotal:,.0f}")
        y -= 4 * mm
        
        if tax > 0:
            c.drawString(5*mm, y, "Tax (16%)")
            c.drawRightString(width - 5*mm, y, f"KES {tax:,.0f}")
            y -= 4 * mm
        
        if discount > 0:
            c.drawString(5*mm, y, "Discount")
            c.drawRightString(width - 5*mm, y, f"-KES {discount:,.0f}")
            y -= 4 * mm
        
        y -= 2 * mm
        c.setFont("Helvetica-Bold", 11)
        c.drawString(5*mm, y, "Total")
        c.drawRightString(width - 5*mm, y, f"KES {total:,.0f}")
        y -= 8 * mm
        
        # === PAYMENT INFO ===
        c.setFont("Helvetica", 8)
        payment_method = receipt_data.get('payment_method', 'Cash').upper()
        c.drawString(5*mm, y, f"Payment: {payment_method}")
        y -= 4 * mm
        
        amount_paid = receipt_data.get('amount_paid', total)
        c.drawString(5*mm, y, f"Paid: KES {amount_paid:,.0f}")
        y -= 4 * mm
        
        change = receipt_data.get('change_amount', 0)
        if change > 0:
            c.drawString(5*mm, y, f"Change: KES {change:,.0f}")
            y -= 4 * mm
        
        if receipt_data.get('payment_reference'):
            c.drawString(5*mm, y, f"Ref: {receipt_data['payment_reference']}")
            y -= 4 * mm
        
        y -= 5 * mm
        
        # Dashed line
        c.setDash(2, 2)
        c.line(5*mm, y, width - 5*mm, y)
        c.setDash()
        y -= 8 * mm
        
        # === FOOTER ===
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(center_x, y, "THANK YOU!")
        y -= 5 * mm
        
        c.setFont("Helvetica", 7)
        c.drawCentredString(center_x, y, "Please come again")
        y -= 4 * mm
        c.drawCentredString(center_x, y, self.company_email)
        
        c.save()
        buffer.seek(0)
        return buffer.getvalue()


class InvoiceGenerator:
    """Generates professional invoices (like third image template)"""
    
    def __init__(self, logo_path: str = None):
        self.logo_path = logo_path or os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'public', 'fglogo.png')
        self.company_name = "Famous Gate Hotel"
        self.company_address = "Kericho, Kenya"
        self.company_phone = "+254 700 000 000"
        self.company_email = "info@famousgate.co.ke"
        self.company_website = "www.famousgate.co.ke"
        
    def generate_invoice(self, invoice_data: Dict[str, Any]) -> bytes:
        """Generate a professional invoice PDF"""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, 
                               rightMargin=20*mm, leftMargin=20*mm,
                               topMargin=20*mm, bottomMargin=20*mm)
        
        elements = []
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'InvoiceTitle',
            parent=styles['Heading1'],
            fontSize=28,
            spaceAfter=20,
            textColor=colors.HexColor('#333333'),
            fontName='Helvetica',
            letterSpacing=8
        )
        
        header_style = ParagraphStyle(
            'Header',
            parent=styles['Normal'],
            fontSize=9,
            textColor=colors.HexColor('#666666'),
            fontName='Helvetica'
        )
        
        # === HEADER with Logo ===
        header_data = []
        
        # Left side - Company info
        company_info = f"""
        <b>{self.company_name}</b><br/>
        {self.company_address}<br/>
        {self.company_phone}<br/>
        {self.company_email}
        """
        
        # Right side - Logo
        logo_cell = ""
        if os.path.exists(self.logo_path):
            try:
                logo = Image(self.logo_path, width=50*mm, height=50*mm)
                logo.hAlign = 'RIGHT'
                logo_cell = logo
            except:
                logo_cell = ""
        
        header_table = Table([
            [Paragraph(company_info, header_style), logo_cell]
        ], colWidths=[100*mm, 70*mm])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 15*mm))
        
        # === INVOICE TITLE ===
        elements.append(Paragraph("INVOICE", title_style))
        elements.append(Spacer(1, 10*mm))
        
        # === INVOICE DETAILS ===
        invoice_no = invoice_data.get('invoice_number', 'N/A')
        invoice_date = invoice_data.get('date', datetime.now().strftime('%Y-%m-%d'))
        due_date = invoice_data.get('due_date', '')
        
        customer_name = invoice_data.get('customer_name', '')
        customer_email = invoice_data.get('customer_email', '')
        customer_address = invoice_data.get('customer_address', '')
        
        details_left = f"""
        <b>BILLED TO:</b><br/>
        {customer_name}<br/>
        {customer_address}<br/>
        {customer_email}
        """
        
        details_right = f"""
        <b>INVOICE NO:</b> {invoice_no}<br/>
        <b>DATE:</b> {invoice_date}<br/>
        <b>DUE DATE:</b> {due_date}
        """
        
        details_table = Table([
            [Paragraph(details_left, header_style), Paragraph(details_right, header_style)]
        ], colWidths=[100*mm, 70*mm])
        details_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ]))
        elements.append(details_table)
        elements.append(Spacer(1, 10*mm))
        
        # === ITEMS TABLE ===
        items = invoice_data.get('items', [])
        table_data = [['DESCRIPTION', 'UNIT PRICE', 'QTY', 'TOTAL']]
        
        for item in items:
            name = item.get('description', item.get('name', 'Item'))
            unit_price = item.get('unit_price', 0)
            qty = item.get('quantity', 1)
            total = unit_price * qty
            
            table_data.append([
                name,
                f"KES {unit_price:,.0f}",
                str(qty),
                f"KES {total:,.0f}"
            ])
        
        items_table = Table(table_data, colWidths=[80*mm, 35*mm, 25*mm, 35*mm])
        items_table.setStyle(TableStyle([
            # Header
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f5f5f5')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#333333')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('TOPPADDING', (0, 0), (-1, 0), 12),
            # Body
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            # Alignment
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            # Grid
            ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#dddddd')),
            ('LINEBELOW', (0, -1), (-1, -1), 1, colors.HexColor('#dddddd')),
        ]))
        elements.append(items_table)
        elements.append(Spacer(1, 5*mm))
        
        # === TOTALS ===
        subtotal = invoice_data.get('subtotal', 0)
        tax = invoice_data.get('tax', invoice_data.get('tax_amount', 0))
        total = invoice_data.get('total', invoice_data.get('amount', 0))
        
        totals_data = [
            ['', '', 'Subtotal:', f"KES {subtotal:,.0f}"],
            ['', '', 'Tax (16%):', f"KES {tax:,.0f}"],
            ['', '', 'TOTAL:', f"KES {total:,.0f}"],
        ]
        
        totals_table = Table(totals_data, colWidths=[80*mm, 35*mm, 25*mm, 35*mm])
        totals_table.setStyle(TableStyle([
            ('FONTNAME', (2, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LINEABOVE', (2, -1), (-1, -1), 1, colors.HexColor('#333333')),
        ]))
        elements.append(totals_table)
        elements.append(Spacer(1, 15*mm))
        
        # === NOTES ===
        if invoice_data.get('notes'):
            notes_style = ParagraphStyle(
                'Notes',
                parent=styles['Normal'],
                fontSize=8,
                textColor=colors.HexColor('#666666')
            )
            elements.append(Paragraph(f"<b>Notes:</b><br/>{invoice_data['notes']}", notes_style))
            elements.append(Spacer(1, 10*mm))
        
        # === PAYMENT INFO ===
        payment_info = f"""
        <b>Payment Information:</b><br/>
        Bank: Kenya Commercial Bank<br/>
        Account: Famous Gate Hotel Ltd<br/>
        Account No: 1234567890<br/>
        M-Pesa Paybill: 123456
        """
        elements.append(Paragraph(payment_info, header_style))
        elements.append(Spacer(1, 15*mm))
        
        # === FOOTER ===
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.HexColor('#999999'),
            alignment=TA_CENTER
        )
        elements.append(Paragraph("Thank you for your business!", footer_style))
        elements.append(Paragraph(f"{self.company_website}", footer_style))
        
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()


class InventoryReceiptGenerator:
    """Generates inventory receipts (like second image template)"""
    
    def __init__(self, logo_path: str = None):
        self.logo_path = logo_path or os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'public', 'fglogo.png')
        self.company_name = "Famous Gate Hotel"
        self.company_address = "Kericho, Kenya"
        
    def generate_inventory_receipt(self, receipt_data: Dict[str, Any]) -> bytes:
        """Generate an inventory receipt PDF"""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4,
                               rightMargin=15*mm, leftMargin=15*mm,
                               topMargin=15*mm, bottomMargin=15*mm)
        
        elements = []
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'Title',
            parent=styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#1a365d'),
            fontName='Helvetica-Bold',
            spaceAfter=5
        )
        
        subtitle_style = ParagraphStyle(
            'Subtitle',
            parent=styles['Normal'],
            fontSize=12,
            textColor=colors.HexColor('#1a365d'),
            fontName='Helvetica'
        )
        
        # === HEADER BAR ===
        header_bar = Table([['', '']], colWidths=[170*mm, 10*mm])
        header_bar.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#1a365d')),
            ('LINEBELOW', (0, 0), (-1, -1), 3, colors.HexColor('#1a365d')),
        ]))
        elements.append(header_bar)
        elements.append(Spacer(1, 5*mm))
        
        # === HEADER ===
        logo_cell = ""
        if os.path.exists(self.logo_path):
            try:
                logo = Image(self.logo_path, width=30*mm, height=30*mm)
                logo_cell = logo
            except:
                pass
        
        header_left = f"""
        <b>{self.company_name}</b><br/>
        {self.company_address}
        """
        
        receipt_no = receipt_data.get('receipt_number', 'N/A')
        receipt_date = receipt_data.get('date', datetime.now().strftime('%Y-%m-%d'))
        
        header_right = f"""
        <b>Receipt #:</b> {receipt_no}<br/>
        <b>Date:</b> {receipt_date}
        """
        
        header_style = ParagraphStyle('Header', parent=styles['Normal'], fontSize=9)
        
        header_table = Table([
            [Paragraph(header_left, header_style), logo_cell, Paragraph(header_right, header_style)]
        ], colWidths=[70*mm, 40*mm, 70*mm])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (1, 0), (1, 0), 'CENTER'),
            ('ALIGN', (2, 0), (2, 0), 'RIGHT'),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 8*mm))
        
        # === TITLE ===
        elements.append(Paragraph("Inventory", title_style))
        elements.append(Paragraph("RECEIPT", subtitle_style))
        elements.append(Spacer(1, 8*mm))
        
        # === ITEMS TABLE ===
        items = receipt_data.get('items', [])
        table_data = [['QTY', 'DESCRIPTION', 'UNIT PRICE', 'AMOUNT']]
        
        for item in items:
            name = item.get('item_name', item.get('name', 'Item'))
            unit_price = item.get('unit_price', 0)
            qty = item.get('quantity', 1)
            total = item.get('total_amount', unit_price * qty)
            
            table_data.append([
                str(qty),
                name,
                f"KES {unit_price:,.0f}",
                f"KES {total:,.0f}"
            ])
        
        # Add totals row
        total_amount = receipt_data.get('total_amount', 0)
        table_data.append(['', '', 'Total (KES):', f"KES {total_amount:,.0f}"])
        
        items_table = Table(table_data, colWidths=[20*mm, 90*mm, 35*mm, 35*mm])
        items_table.setStyle(TableStyle([
            # Header
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a365d')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('TOPPADDING', (0, 0), (-1, 0), 10),
            # Body
            ('FONTNAME', (0, 1), (-1, -2), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            # Total row
            ('FONTNAME', (2, -1), (-1, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (2, -1), (-1, -1), colors.HexColor('#f0f0f0')),
            # Alignment
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),
            ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
            # Grid
            ('GRID', (0, 0), (-1, -2), 0.5, colors.HexColor('#dddddd')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#1a365d')),
        ]))
        elements.append(items_table)
        elements.append(Spacer(1, 10*mm))
        
        # === NOTES ===
        if receipt_data.get('notes'):
            notes_style = ParagraphStyle('Notes', parent=styles['Normal'], fontSize=8, textColor=colors.HexColor('#666666'))
            elements.append(Paragraph(f"<b>Notes:</b> {receipt_data['notes']}", notes_style))
        
        # === SIGNATURE ===
        elements.append(Spacer(1, 20*mm))
        sig_table = Table([
            ['_' * 30, '_' * 30],
            ['Received By', 'Authorized By']
        ], colWidths=[85*mm, 85*mm])
        sig_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 1), (-1, 1), 5),
        ]))
        elements.append(sig_table)
        
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()
