
import os
import io
import qrcode
from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.barcode import qr, code128
from reportlab.graphics import renderPDF

class IDCardGenerator:
    """Generates Employee ID Cards (CR80 Standard Size) - Landscape Format"""
    
    def __init__(self):
        # Standard CR80 Dimensions: 88 x 52 mm (Landscape)
        self.width = 88 * mm
        self.height = 52 * mm
        self.logo_path = os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'public', 'fglogo.png')
        self.primary_red = colors.HexColor("#B71C1C")
        self.dark_bg = colors.HexColor("#1A1A1A")
        self.text_dark = colors.HexColor("#212121")
        self.text_light = colors.white

    def generate(self, employee_data):
        """
        Generate ID card PDF with Front and Back pages
        employee_data: {
            'name': str,
            'role': str,
            'id_no': str,
            'email': str,
            'phone': str,
            'join_date': str,
            'expire_date': str,
            'photo_path': str (optional),
            'qr_data': str (optional)
        }
        """
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=(self.width, self.height))
        
        # --- FRONT SIDE ---
        self._draw_front(c, employee_data)
        c.showPage()
        
        # --- BACK SIDE ---
        self._draw_back(c, employee_data)
        c.showPage()
        
        c.save()
        buffer.seek(0)
        return buffer.getvalue()

    def _draw_front(self, c, data):
        # Background Pattern (Subtle)
        c.saveState()
        c.setStrokeColor(colors.lightgrey)
        c.setLineWidth(0.05*mm)
        for i in range(0, int(self.width), 8):
            c.line(i*mm, 0, (i+3)*mm, self.height)
        c.restoreState()

        # LEFT SECTION: Photo Area (0-30mm)
        # Dark background for photo section
        c.setFillColor(self.dark_bg)
        c.rect(0, 0, 30*mm, self.height, fill=1, stroke=0)
        
        # Red accent wave on right edge of photo section
        c.setFillColor(self.primary_red)
        p_left = c.beginPath()
        p_left.moveTo(28*mm, 0)
        p_left.curveTo(25*mm, self.height*0.3, 32*mm, self.height*0.7, 28*mm, self.height)
        p_left.lineTo(30*mm, self.height)
        p_left.lineTo(30*mm, 0)
        p_left.close()
        c.drawPath(p_left, fill=1, stroke=0)
        
        # Photo (Circular with border) - Left side
        c.saveState()
        photo_x = 15*mm
        photo_y = self.height/2
        radius = 12*mm
        
        # Red border
        c.setFillColor(self.primary_red)
        c.circle(photo_x, photo_y, radius + 0.7*mm, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.circle(photo_x, photo_y, radius + 0.1*mm, fill=1, stroke=0)
        
        # Clipping path for photo
        clip_path = c.beginPath()
        clip_path.circle(photo_x, photo_y, radius)
        c.clipPath(clip_path, stroke=0)
        
        photo_path = data.get('photo_path')
        if photo_path and os.path.exists(photo_path):
            try:
                img = ImageReader(photo_path)
                c.drawImage(img, photo_x - radius, photo_y - radius, 
                          width=2*radius, height=2*radius, preserveAspectRatio=True, anchor='c')
            except:
                self._draw_placeholder_photo(c, photo_x, photo_y, radius)
        else:
            self._draw_placeholder_photo(c, photo_x, photo_y, radius)
        c.restoreState()

        # CENTER SECTION: Company Info & Employee Details (30-68mm)
        # Top header bar
        c.setFillColor(self.primary_red)
        c.rect(30*mm, self.height - 12*mm, 38*mm, 12*mm, fill=1, stroke=0)
        
        # Company logo and name in header
        if os.path.exists(self.logo_path):
            try:
                logo = ImageReader(self.logo_path)
                c.drawImage(logo, 32*mm, self.height - 10*mm, 
                          width=8*mm, height=8*mm, mask='auto', preserveAspectRatio=True)
            except:
                pass
        
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(42*mm, self.height - 6*mm, "FAMOUS GATE HOTEL")
        c.setFont("Helvetica", 5)
        c.drawString(42*mm, self.height - 9.5*mm, "Quality Hospitality Services")
        
        # Employee Name
        c.setFillColor(self.primary_red)
        name = data.get('name', 'NAME').upper()
        font_size = 12
        if len(name) > 15: font_size = 10
        if len(name) > 20: font_size = 8
        c.setFont("Helvetica-Bold", font_size)
        c.drawString(32*mm, self.height - 18*mm, name)
        
        # Role
        c.setFillColor(self.text_dark)
        c.setFont("Helvetica-Bold", 7)
        c.drawString(32*mm, self.height - 23*mm, data.get('role', 'POSITION'))
        
        # Divider line
        c.setStrokeColor(self.primary_red)
        c.setLineWidth(0.2*mm)
        c.line(32*mm, self.height - 25*mm, 66*mm, self.height - 25*mm)
        
        # Employee Details (compact, left-aligned)
        details_y = self.height - 30*mm
        c.setFillColor(self.text_dark)
        
        # ID Number
        c.setFont("Helvetica-Bold", 5)
        c.drawString(32*mm, details_y, "ID NUMBER:")
        c.setFont("Helvetica", 6.5)
        c.drawString(47*mm, details_y, str(data.get('id_no', 'N/A')))
        
        # Email
        details_y -= 5*mm
        c.setFont("Helvetica-Bold", 5)
        c.drawString(32*mm, details_y, "EMAIL:")
        c.setFont("Helvetica", 5.5)
        email_val = str(data.get('email', 'N/A'))
        if len(email_val) > 22: c.setFont("Helvetica", 4.5)
        c.drawString(42*mm, details_y, email_val)
        
        # Join Date
        details_y -= 5*mm
        c.setFont("Helvetica-Bold", 5)
        c.drawString(32*mm, details_y, "JOINED:")
        c.setFont("Helvetica", 6.5)
        c.drawString(45*mm, details_y, str(data.get('join_date', 'N/A')))


        # RIGHT SECTION: QR Code (68-88mm)
        # QR Code on right side
        qr_data = data.get('qr_data', f"VERIFY:{data.get('id_no', 'N/A')}")
        try:
            qr_code = qr.QrCodeWidget(qr_data)
            bounds = qr_code.getBounds()
            w = bounds[2] - bounds[0]
            h = bounds[3] - bounds[1]
            
            d = Drawing(16*mm, 16*mm, transform=[16*mm/w, 0, 0, 16*mm/h, 0, 0])
            d.add(qr_code)
            renderPDF.draw(d, c, 70*mm, self.height/2 - 8*mm)
            
            c.setFont("Helvetica-Bold", 4)
            c.setFillColor(self.text_dark)
            c.drawCentredString(78*mm, self.height/2 - 10*mm, "SCAN ID")
        except:
            pass
        
        # BARCODE: Bottom center (horizontal)
        barcode_value = data.get('id_no', 'TEMP-001')
        try:
            barcode = code128.Code128(barcode_value, barHeight=4*mm, barWidth=0.18*mm)
            barcode.drawOn(c, (self.width - barcode.width) / 2, 4*mm)
            c.setFont("Helvetica-Bold", 3.5)
            c.setFillColor(self.text_dark)
            c.drawCentredString(self.width/2, 2*mm, f"CHECK-IN: {barcode_value}")
        except:
            pass
        
        # Bottom footer strip
        c.setFillColor(self.dark_bg)
        c.rect(30*mm, 0, 58*mm, 1.5*mm, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 3.5)
        c.drawCentredString(59*mm, 0.3*mm, "www.famousgate.com")

    def _draw_back(self, c, data):
        # Background Pattern
        c.saveState()
        c.setStrokeColor(colors.lightgrey)
        c.setLineWidth(0.05*mm)
        for i in range(0, int(self.width), 5):
            c.line(i*mm, 0, (i+2)*mm, self.height)
        c.restoreState()

        # 1. Wavy Header
        c.setFillColor(self.primary_red)
        p_header = c.beginPath()
        p_header.moveTo(0, self.height)
        p_header.lineTo(self.width, self.height)
        p_header.lineTo(self.width, self.height - 8*mm)
        p_header.curveTo(self.width*0.7, self.height - 12*mm, self.width*0.3, self.height - 4*mm, 0, self.height - 8*mm)
        p_header.close()
        c.drawPath(p_header, fill=1, stroke=0)
        
        # 2. Terms & Conditions
        c.setFillColor(self.text_dark)
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(self.width/2, self.height - 15*mm, "Terms & Conditions")
        
        c.setFont("Helvetica", 5.5)
        terms = [
            "• This card is the property of Famous Gate Hotel.",
            "• It must be worn at all times while on duty.",
            "• If found, please return to the HR office.",
            "• Misuse is a disciplinary offense."
        ]
        y_pos = self.height - 20*mm
        for term in terms:
            c.drawString(8*mm, y_pos, term)
            y_pos -= 4*mm

        # 3. QR Code (Right side)
        qr_data = data.get('qr_data', f"VERIFY:{data.get('id_no', 'N/A')}")
        qr_code = qr.QrCodeWidget(qr_data)
        bounds = qr_code.getBounds()
        w = bounds[2] - bounds[0]
        h = bounds[3] - bounds[1]
        
        d = Drawing(20*mm, 20*mm, transform=[20*mm/w, 0, 0, 20*mm/h, 0, 0])
        d.add(qr_code)
        renderPDF.draw(d, c, self.width - 25*mm, 8*mm)
        
        c.setFont("Helvetica-Bold", 5)
        c.drawCentredString(self.width - 15*mm, 6*mm, "SCAN TO VERIFY")

        # 4. Footer
        c.setFillColor(self.dark_bg)
        c.rect(0, 0, self.width, 5*mm, fill=1, stroke=0)
        
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 7)
        c.drawCentredString(self.width/2, 1.5*mm, "FAMOUS GATE HOTEL")

    def _draw_placeholder_photo(self, c, x, y, r):
        c.setFillColor(colors.lightgrey)
        c.circle(x, y, r, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 15)
        c.drawCentredString(x, y - 5*mm, "?")

