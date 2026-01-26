
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
        # CR80 Dimensions: 85.60 x 53.98 mm (Vertical)
        self.width = 53.98 * mm
        self.height = 85.60 * mm
        self.logo_path = os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'public', 'fglogo.png')
        self.primary_red = colors.HexColor("#B71C1C")
        self.dark_bg = colors.HexColor("#1A1A1A")
        self.accent_red = colors.HexColor("#D32F2F")
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
        # 1. Top Section - Dark Header with Wavy Bottom
        c.setFillColor(self.dark_bg)
        c.rect(0, self.height - 25*mm, self.width, 25*mm, fill=1, stroke=0)
        
        # Red Wave Header
        c.setFillColor(self.primary_red)
        p = c.beginPath()
        p.moveTo(0, self.height - 20*mm)
        p.curveTo(self.width*0.3, self.height - 15*mm, self.width*0.7, self.height - 35*mm, self.width, self.height - 25*mm)
        p.lineTo(self.width, self.height)
        p.lineTo(0, self.height)
        p.close()
        c.drawPath(p, fill=1, stroke=0)

        # 2. Company Info (White in header)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 11)
        c.drawCentredString(self.width/2, self.height - 10*mm, "FAMOUS GATE HOTEL")
        c.setFont("Helvetica", 6)
        c.drawCentredString(self.width/2, self.height - 13*mm, "QUALITY HOSPITALITY SERVICES")

        # 3. Photo (Circular with RED BORDER)
        c.saveState()
        center_x = self.width/2
        center_y = self.height - 38*mm
        radius = 16*mm
        
        # Red border for circle
        c.setFillColor(self.primary_red)
        c.circle(center_x, center_y, radius + 1.2*mm, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.circle(center_x, center_y, radius + 0.2*mm, fill=1, stroke=0)
        
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
        c.setFillColor(self.primary_red)
        c.setFont("Helvetica-Bold", 13)
        c.drawCentredString(self.width/2, self.height - 60*mm, data.get('name', 'NAME').upper())
        
        c.setFillColor(self.text_dark)
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(self.width/2, self.height - 65*mm, data.get('role', 'POSITION'))
        
        # Info Block (Red background with white text)
        info_y = self.height - 78*mm
        c.setFillColor(self.primary_red)
        # Draw a small pill or line? Template shows a block
        # c.rect(5*mm, info_y - 2*mm, self.width - 10*mm, 15*mm, fill=1, stroke=0)
        
        # Let's use clean text with small icons or labels
        c.setFillColor(self.text_dark)
        c.setFont("Helvetica-Bold", 6)
        details = [
            ("ID NO:", data.get('id_no', 'N/A')),
            ("EMAIL:", data.get('email', 'N/A')),
            ("JOIN:", data.get('join_date', 'N/A'))
        ]
        
        inner_y = info_y
        for label, val in details:
            c.setFont("Helvetica-Bold", 6)
            c.drawString(8*mm, inner_y, label)
            c.setFont("Helvetica", 6)
            c.drawString(22*mm, inner_y, val)
            inner_y -= 3.5*mm

        # 5. Barcode for Check-in (FRONT BOTTOM as requested)
        barcode_value = data.get('id_no', 'TEMP-001')
        barcode = code128.Code128(barcode_value, barHeight=6*mm, barWidth=0.22*mm)
        barcode.drawOn(c, (self.width - barcode.width) / 2, 8*mm)
        c.setFont("Helvetica", 5)
        c.drawCentredString(self.width/2, 6*mm, f"CHECK-IN ID: {barcode_value}")

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

