"""
PDF Invoice Generator for Hotel Bookings
"""
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from datetime import datetime
import io
import os
import requests
from PIL import Image as PILImage

def generate_booking_invoice(booking_data):
    """
    Generate a PDF invoice for a hotel booking
    
    Args:
        booking_data: Dictionary containing booking information
        
    Returns:
        BytesIO object containing the PDF
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
    
    # Container for PDF elements
    elements = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1a1a1a'),
        spaceAfter=12,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.HexColor('#666666'),
        spaceAfter=20,
        alignment=TA_CENTER
    )
    
    section_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor('#1a1a1a'),
        spaceAfter=10,
        spaceBefore=20,
        fontName='Helvetica-Bold',
        borderColor=colors.HexColor('#d4af37'),
        borderWidth=2,
        borderPadding=5
    )
    
    # Add logo at the top
    logo_path = os.path.join(os.path.dirname(__file__), '..', 'assets', 'fglogo.png')
    if os.path.exists(logo_path):
        try:
            logo = Image(logo_path, width=1.5*inch, height=1.05*inch)
            elements.append(logo)
            elements.append(Spacer(1, 0.2*inch))
        except Exception as e:
            print(f"Could not load logo: {e}")
    
    # Header
    elements.append(Paragraph("FAMOUSGATE HOTELS", title_style))
    elements.append(Paragraph("Hotel Booking Invoice", subtitle_style))
    elements.append(Spacer(1, 0.2*inch))
    
    # Invoice details
    today = datetime.now().strftime('%B %d, %Y')
    elements.append(Paragraph(f"<b>Invoice Date:</b> {today}", styles['Normal']))
    elements.append(Paragraph(f"<b>Confirmation Number:</b> {booking_data.get('confirmationNumber', 'N/A')}", styles['Normal']))
    elements.append(Spacer(1, 0.3*inch))
    
    # Guest Information Section
    elements.append(Paragraph("Guest Information", section_style))
    guest_data = [
        ['Guest Name:', booking_data.get('guestName', 'N/A')],
        ['Email:', booking_data.get('email', 'N/A')],
        ['Phone:', booking_data.get('phone', 'N/A')],
    ]
    guest_table = Table(guest_data, colWidths=[2*inch, 4*inch])
    guest_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#666666')),
        ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#1a1a1a')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(guest_table)
    elements.append(Spacer(1, 0.2*inch))
    
    # Reservation Details Section
    elements.append(Paragraph("Reservation Details", section_style))
    reservation_data = [
        ['Check-in Date:', booking_data.get('checkInDate', 'N/A')],
        ['Check-out Date:', booking_data.get('checkOutDate', 'N/A')],
        ['Room Type:', booking_data.get('roomType', 'N/A')],
        ['Number of Guests:', str(booking_data.get('guests', 'N/A'))],
    ]
    reservation_table = Table(reservation_data, colWidths=[2*inch, 4*inch])
    reservation_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#666666')),
        ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#1a1a1a')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(reservation_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Amount Section
    elements.append(Paragraph("Payment Summary", section_style))
    amount_data = [
        ['Total Amount:', f"KES {booking_data.get('totalAmount', 0):,.2f}"],
    ]
    amount_table = Table(amount_data, colWidths=[2*inch, 4*inch])
    amount_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 14),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#666666')),
        ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#1a1a1a')),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f9f6f0')),
        ('BOX', (0, 0), (-1, -1), 2, colors.HexColor('#d4af37')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    elements.append(amount_table)
    elements.append(Spacer(1, 0.4*inch))
    
    # Footer
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#666666'),
        alignment=TA_CENTER
    )
    elements.append(Paragraph("Thank you for choosing FamousGate Hotels", footer_style))
    elements.append(Spacer(1, 0.1*inch))
    elements.append(Paragraph("Bomet, Kenya", footer_style))
    elements.append(Paragraph("+254 706 782 828 • info@famousgatehotels.com", footer_style))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    return buffer
