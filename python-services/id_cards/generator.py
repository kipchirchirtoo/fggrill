
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
    """Generates Employee ID Cards (CR80 Standard Size) following the uploaded template"""
    
    def __init__(self):
        # CR80 Dimensions: 85.60 x 53.98 mm (Vertical)
        self.width = 53.98 * mm
        self.height = 85.60 * mm
        self.logo_path = os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'public', 'fglogo.png')
        self.dark_blue = colors.HexColor("#002147")
        self.light_blue = colors.HexColor("#007AFF")
        self.accent_blue = colors.HexColor("#5AC8FA")
        self.text_color = colors.HexColor("#333333")
        
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
        # 1. Background Shapes
        # Dark Blue Header Block
        c.setFillColor(self.dark_blue)
        c.rect(0, self.height - 20*mm, self.width, 20*mm, fill=1, stroke=0)
        
        # Curved blue accents (matching the template's arcs)
        c.setFillColor(self.light_blue)
        p = c.beginPath()
        p.moveTo(0, self.height - 20*mm)
        p.curveTo(self.width*0.3, self.height - 15*mm, self.width*0.7, self.height - 35*mm, self.width, self.height - 25*mm)
        p.lineTo(self.width, self.height - 20*mm)
        p.close()
        c.drawPath(p, fill=1, stroke=0)
        
        c.setFillColor(self.accent_blue)
        p2 = c.beginPath()
        p2.moveTo(0, self.height - 25*mm)
        p2.curveTo(self.width*0.3, self.height - 20*mm, self.width*0.7, self.height - 40*mm, self.width, self.height - 30*mm)
        p2.lineTo(self.width, self.height - 25*mm)
        p2.close()
        c.drawPath(p2, fill=1, stroke=0)

        # 2. Company Info (White in header)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(self.width/2, self.height - 10*mm, "FAMOUS GATE HOTEL")
        c.setFont("Helvetica", 6)
        c.drawCentredString(self.width/2, self.height - 13*mm, "QUALITY HOSPITALITY SERVICES")

        # 3. Photo (Circular)
        c.saveState()
        center_x = self.width/2
        center_y = self.height - 40*mm
        radius = 15*mm
        
        # White border for circle
        c.setFillColor(colors.white)
        c.circle(center_x, center_y, radius + 1*mm, fill=1, stroke=0)
        
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

        # 4. Employee Info
        c.setFillColor(self.text_color)
        c.setFont("Helvetica-Bold", 12)
        c.drawCentredString(self.width/2, self.height - 62*mm, data.get('name', 'NAME').upper())
        
        c.setFillColor(self.light_blue)
        c.setFont("Helvetica-Bold", 7)
        c.drawCentredString(self.width/2, self.height - 66*mm, data.get('role', 'POSITION'))
        
        # Details Table
        c.setFillColor(self.text_color)
        c.setFont("Helvetica-Bold", 6)
        left_margin = 8*mm
        start_y = self.height - 72*mm
        line_height = 3.5*mm
        
        details = [
            ("ID NO", data.get('id_no', 'N/A')),
            ("EMAIL", data.get('email', 'N/A')),
            ("PHONE", data.get('phone', 'N/A'))
        ]
        
        for label, val in details:
            c.setFont("Helvetica-Bold", 6)
            c.drawString(left_margin, start_y, label)
            c.setFont("Helvetica", 6)
            c.drawString(left_margin + 12*mm, start_y, val)
            start_y -= line_height

        # 5. Footer Strip
        c.setFillColor(self.dark_blue)
        c.rect(0, 0, self.width, 5*mm, fill=1, stroke=0)

    def _draw_back(self, c, data):
        # 1. Header Strip
        c.setFillColor(self.dark_blue)
        c.rect(0, self.height - 8*mm, self.width, 8*mm, fill=1, stroke=0)
        
        # 2. Terms & Conditions
        c.setFillColor(self.text_color)
        c.setFont("Helvetica-Bold", 7)
        c.drawCentredString(self.width/2, self.height - 15*mm, "Terms & Conditions")
        
        c.setFont("Helvetica", 5)
        terms = [
            "• This card is the property of Famous Gate Hotel.",
            "• It must be worn at all times while on duty.",
            "• If found, please return to the HR office.",
            "• Misuse of this card is a disciplinary offense."
        ]
        y_pos = self.height - 20*mm
        for term in terms:
            c.drawString(6*mm, y_pos, term)
            y_pos -= 3*mm

        # 3. Dates
        c.setFont("Helvetica-Bold", 6)
        c.drawString(6*mm, y_pos - 5*mm, "JOIN DATE:")
        c.setFont("Helvetica", 6)
        c.drawString(25*mm, y_pos - 5*mm, data.get('join_date', 'N/A'))
        
        c.setFont("Helvetica-Bold", 6)
        c.drawString(6*mm, y_pos - 9*mm, "EXPIRE DATE:")
        c.setFont("Helvetica", 6)
        c.drawString(25*mm, y_pos - 9*mm, data.get('expire_date', 'N/A'))

        # 4. QR Code
        qr_data = data.get('qr_data', data.get('id_no', 'VERIFY'))
        qr_code = qr.QrCodeWidget(qr_data)
        bounds = qr_code.getBounds()
        width = bounds[2] - bounds[0]
        height = bounds[3] - bounds[1]
        
        d = Drawing(20*mm, 20*mm, transform=[20*mm/width, 0, 0, 20*mm/height, 0, 0])
        d.add(qr_code)
        renderPDF.draw(d, c, (self.width - 20*mm)/2, 22*mm)
        
        c.setFont("Helvetica", 5)
        c.drawCentredString(self.width/2, 20*mm, "Scan to verify employee status")

        # 4.5. Barcode for Checking In
        barcode_value = data.get('id_no', 'N/A')
        if barcode_value != 'N/A':
            # Code 128
            barcode = code128.Code128(barcode_value, barHeight=8*mm, barWidth=0.25*mm)
            barcode.drawOn(c, (self.width - barcode.width) / 2, 45*mm)
            c.setFont("Helvetica", 5)
            c.drawCentredString(self.width/2, 43*mm, f"CHECK-IN ID: {barcode_value}")

        # 5. Bottom Geometric Pattern (matching template)
        c.setFillColor(self.dark_blue)
        path = c.beginPath()
        path.moveTo(0, 0)
        path.lineTo(self.width, 0)
        path.lineTo(self.width, 15*mm)
        path.lineTo(self.width/2, 5*mm)
        path.lineTo(0, 15*mm)
        path.close()
        c.drawPath(path, fill=1, stroke=0)
        
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(self.width/2, 3*mm, "FAMOUS GATE HOTEL")

    def _draw_placeholder_photo(self, c, x, y, r):
        c.setFillColor(colors.lightgrey)
        c.circle(x, y, r, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 15)
        c.drawCentredString(x, y - 5, "?")

