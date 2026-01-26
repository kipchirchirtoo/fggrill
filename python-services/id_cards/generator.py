
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
    """Generates Employee ID Cards (CR80 Standard Size) following the RED WAVY template"""
    
    def __init__(self):
        # Standard CR80 Dimensions: 54 x 86 mm (Vertical)
        self.width = 54 * mm
        self.height = 86 * mm
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
        c.setLineWidth(0.1*mm)
        for i in range(0, int(self.height), 10):
            c.line(0, i*mm, self.width, (i+5)*mm)
        c.restoreState()

        # 1. Top Section - Dark Header with Red Wavy Overlay
        c.setFillColor(self.dark_bg)
        c.rect(0, self.height - 30*mm, self.width, 30*mm, fill=1, stroke=0)
        
        c.setFillColor(self.primary_red)
        p = c.beginPath()
        p.moveTo(0, self.height - 22*mm)
        p.curveTo(self.width*0.3, self.height - 18*mm, self.width*0.7, self.height - 38*mm, self.width, self.height - 28*mm)
        p.lineTo(self.width, self.height)
        p.lineTo(0, self.height)
        p.close()
        c.drawPath(p, fill=1, stroke=0)

        # 2. Company Info & Logo
        if os.path.exists(self.logo_path):
            try:
                logo = ImageReader(self.logo_path)
                c.drawImage(logo, (self.width - 10*mm)/2, self.height - 12*mm, width=10*mm, height=10*mm, mask='auto', preserveAspectRatio=True)
            except:
                pass

        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 9)
        c.drawCentredString(self.width/2, self.height - 16*mm, "FAMOUS GATE HOTEL")
        c.setFont("Helvetica", 5)
        c.drawCentredString(self.width/2, self.height - 18.5*mm, "QUALITY HOSPITALITY SERVICES")
        # 3. Photo (Circular with RED BORDER)
        c.saveState()
        center_x = self.width/2
        center_y = self.height - 36*mm
        radius = 15*mm
        
        # Red border for circle
        c.setFillColor(self.primary_red)
        c.circle(center_x, center_y, radius + 1*mm, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.circle(center_x, center_y, radius + 0.1*mm, fill=1, stroke=0)
        
        # Clipping path for photo
        clip_path = c.beginPath()
        clip_path.circle(center_x, center_y, radius)
        c.clipPath(clip_path, stroke=0)
        
        photo_path = data.get('photo_path')
        if photo_path and os.path.exists(photo_path):
            try:
                img = ImageReader(photo_path)
                c.drawImage(img, center_x - radius, center_y - radius, width=2*radius, height=2*radius, preserveAspectRatio=True, anchor='c')
            except:
                self._draw_placeholder_photo(c, center_x, center_y, radius)
        else:
            self._draw_placeholder_photo(c, center_x, center_y, radius)
        c.restoreState()

        # 4. Employee Info (Arranged well, fit inside)
        c.setFillColor(self.primary_red)
        name = data.get('name', 'NAME').upper()
        
        # Adaptive font size for name
        font_size = 12
        if len(name) > 15: font_size = 10
        if len(name) > 22: font_size = 8
        c.setFont("Helvetica-Bold", font_size)
        c.drawCentredString(self.width/2, self.height - 56*mm, name)
        
        c.setFillColor(self.text_dark)
        c.setFont("Helvetica-Bold", 7.5)
        c.drawCentredString(self.width/2, self.height - 61*mm, data.get('role', 'POSITION'))
        
        # Divider line
        c.setStrokeColor(self.primary_red)
        c.setLineWidth(0.3*mm)
        c.line(10*mm, self.height - 63*mm, self.width - 10*mm, self.height - 63*mm)
       # Info Section
        details_y = self.height - 66*mm
        c.setFillColor(self.text_dark)
        details = [
            ("ID NO:", data.get('id_no', 'N/A')),
            ("EMAIL:", data.get('email', 'N/A')),
            ("JOINED:", data.get('join_date', 'N/A'))
        ]
        
        for label, val in details:
            c.setFont("Helvetica-Bold", 6)
            c.drawRightString(20*mm, details_y, label)
            c.setFont("Helvetica", 6)
            c.drawString(22*mm, details_y, val)
            details_y -= 3*mm

        # 5. Barcode (Positioned well above footer)
        barcode_value = data.get('id_no', 'TEMP-001')
        try:
            barcode = code128.Code128(barcode_value, barHeight=5*mm, barWidth=0.2*mm)
            barcode.drawOn(c, (self.width - barcode.width) / 2, 10*mm)
            c.setFont("Helvetica-Bold", 5)
            c.drawCentredString(self.width/2, 8.5*mm, f"CHECK-IN ID: {barcode_value}")
        except:
            pass

        # 6. Wavy Footer
        c.setFillColor(self.dark_bg)
        p_footer = c.beginPath()
        p_footer.moveTo(0, 0)
        p_footer.lineTo(self.width, 0)
        p_footer.lineTo(self.width, 4*mm)
        p_footer.curveTo(self.width*0.7, 8*mm, self.width*0.3, 2*mm, 0, 4*mm)
        p_footer.close()
        c.drawPath(p_footer, fill=1, stroke=0)

    def _draw_back(self, c, data):
        # Background Pattern
        c.saveState()
        c.setStrokeColor(colors.lightgrey)
        c.setLineWidth(0.05*mm)
        for i in range(0, int(self.width), 5):
            c.line(i*mm, 0, (i+2)*mm, self.height)
        c.restoreState()

        # 1. Wavy Header
 pieces
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
        c.drawCentredString(self.width/2, self.height - 18*mm, "Terms & Conditions")
        
        c.setFont("Helvetica", 6)
        terms = [
            "• This card is the property of Famous Gate Hotel.",
            "• It must be worn at all times while on duty.",
            "• If found, please return to the HR office.",
            "• Misuse is a disciplinary offense."
        ]
        y_pos = self.height - 25*mm
        for term in terms:
            c.drawString(6*mm, y_pos, term)
            y_pos -= 4*mm

        # 3. QR Code (Central)
        qr_data = data.get('qr_data', f"VERIFY:{data.get('id_no', 'N/A')}")
        qr_code = qr.QrCodeWidget(qr_data)
        bounds = qr_code.getBounds()
        w = bounds[2] - bounds[0]
        h = bounds[3] - bounds[1]
        
        d = Drawing(25*mm, 25*mm, transform=[25*mm/w, 0, 0, 25*mm/h, 0, 0])
        d.add(qr_code)
        renderPDF.draw(d, c, (self.width - 25*mm)/2, 25*mm)
        
        c.setFont("Helvetica-Bold", 6)
        c.drawCentredString(self.width/2, 22*mm, "SCAN TO VERIFY")

        # 4. Wavy Footer (Dark)
        c.setFillColor(self.dark_bg)
        p_footer = c.beginPath()
        p_footer.moveTo(0, 0)
        p_footer.lineTo(self.width, 0)
        p_footer.lineTo(self.width, 15*mm)
        p_footer.curveTo(self.width*0.6, 5*mm, self.width*0.4, 20*mm, 0, 10*mm)
        p_footer.close()
        c.drawPath(p_footer, fill=1, stroke=0)
        
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 9)
        c.drawCentredString(self.width/2, 4*mm, "FAMOUS GATE HOTEL")

    def _draw_placeholder_photo(self, c, x, y, r):
        c.setFillColor(colors.lightgrey)
        c.circle(x, y, r, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 15)
        c.drawCentredString(x, y - 5*mm, "?")

