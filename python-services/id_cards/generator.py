import os
import io
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.barcode import qr, code128
from reportlab.graphics import renderPDF

class IDCardGenerator:
    """Generates Employee ID Cards (CR80 Standard Size) - Portrait Format"""
    
    def __init__(self):
        # Standard CR80 Dimensions: 53.98 x 85.6 mm (Portrait)
        self.width = 53.98 * mm
        self.height = 85.6 * mm
        self.logo_path = os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'public', 'fglogo.png')
        
        # Premium Brand Colors
        self.bg_dark = colors.HexColor("#1A1917")    # Warm Black (Warm 900)
        self.bg_charcoal = colors.HexColor("#2E2C28") # Charcoal (Warm 800)
        self.accent_gold = colors.HexColor("#FCA311") # Brand Amber/Gold
        self.text_white = colors.HexColor("#FFFFFF")
        self.text_gray = colors.HexColor("#A8A49A")   # Warm Gray (Warm 400)
        self.white = colors.white

    def generate(self, employee_data):
        """
        Generate ID card PDF with Front and Back pages
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

    def _draw_tech_pattern(self, c):
        """Draws a subtle digital/tech background pattern"""
        c.saveState()
        c.setStrokeColor(self.accent_gold)
        c.setLineWidth(0.1*mm)
        c.setStrokeAlpha(0.1)
        
        # Draw a subtle grid
        step = 10*mm
        for x in range(0, int(self.width/mm) + 10, 10):
            c.line(x*mm, 0, x*mm, self.height)
        for y in range(0, int(self.height/mm) + 10, 10):
            c.line(0, y*mm, self.width, y*mm)
            
        # Draw some tech accents (corner brackets)
        c.setStrokeAlpha(0.4)
        c.setLineWidth(0.3*mm)
        margin = 3*mm
        len_ = 5*mm
        
        # Top Left
        c.line(margin, self.height - margin, margin + len_, self.height - margin)
        c.line(margin, self.height - margin, margin, self.height - margin - len_)
        
        # Top Right
        c.line(self.width - margin, self.height - margin, self.width - margin - len_, self.height - margin)
        c.line(self.width - margin, self.height - margin, self.width - margin, self.height - margin - len_)
        
        # Bottom Left
        c.line(margin, margin, margin + len_, margin)
        c.line(margin, margin, margin, margin + len_)
        
        # Bottom Right
        c.line(self.width - margin, margin, self.width - margin - len_, margin)
        c.line(self.width - margin, margin, self.width - margin, margin + len_)
        
        c.restoreState()

    def _draw_front(self, c, data):
        # 1. Background
        c.setFillColor(self.bg_dark)
        c.rect(0, 0, self.width, self.height, fill=1, stroke=0)
        
        # Gradient-like effect top
        c.setFillColor(self.bg_charcoal)
        p = c.beginPath()
        p.moveTo(0, self.height)
        p.lineTo(self.width, self.height)
        p.lineTo(self.width, self.height * 0.6)
        p.lineTo(0, self.height * 0.7)
        p.close()
        c.drawPath(p, fill=1, stroke=0)
        
        self._draw_tech_pattern(c)

        # 2. Header: Logo & Company Name
        if os.path.exists(self.logo_path):
            try:
                logo = ImageReader(self.logo_path)
                # Draw logo centered at top
                c.drawImage(logo, (self.width - 15*mm)/2, self.height - 18*mm, 
                          width=15*mm, height=15*mm, mask='auto', preserveAspectRatio=True)
            except:
                pass
        
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(self.accent_gold)
        c.drawCentredString(self.width/2, self.height - 22*mm, "FAMOUS GATE HOTEL")
        
        c.setFont("Helvetica", 5)
        c.setFillColor(self.text_white)
        c.drawCentredString(self.width/2, self.height - 25*mm, "EXCELLENCE IN HOSPITALITY")

        # 3. Photo Area (Central, glowing border)
        photo_y = self.height * 0.52
        radius = 16*mm
        
        c.saveState()
        # Gold Glow/Border
        c.setFillColor(self.accent_gold)
        c.circle(self.width/2, photo_y, radius + 0.8*mm, fill=1, stroke=0)
        
        # Dark inner border
        c.setFillColor(self.bg_dark)
        c.circle(self.width/2, photo_y, radius + 0.4*mm, fill=1, stroke=0)
        
        # Photo clip
        path = c.beginPath()
        path.circle(self.width/2, photo_y, radius)
        c.clipPath(path, stroke=0)
        
        photo_path = data.get('photo_path')
        if photo_path and os.path.exists(photo_path):
            try:
                img = ImageReader(photo_path)
                c.drawImage(img, self.width/2 - radius, photo_y - radius, 
                          width=2*radius, height=2*radius, preserveAspectRatio=True, anchor='c')
            except:
                self._draw_placeholder(c, self.width/2, photo_y, radius)
        else:
            self._draw_placeholder(c, self.width/2, photo_y, radius)
        c.restoreState()

        # 4. Employee Details
        text_y = self.height * 0.35
        
        # Name
        c.setFont("Helvetica-Bold", 13)
        c.setFillColor(self.text_white)
        name = data.get('name', 'EMPLOYEE NAME').upper()
        # Auto-scale text if too long
        if c.stringWidth(name, "Helvetica-Bold", 13) > self.width - 10*mm:
             c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(self.width/2, text_y, name)
        
        # Role
        text_y -= 5*mm
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(self.accent_gold)
        c.drawCentredString(self.width/2, text_y, data.get('role', 'STAFF').upper())
        
        # Divider
        text_y -= 4*mm
        c.setStrokeColor(self.text_gray)
        c.setLineWidth(0.2*mm)
        c.line(15*mm, text_y, self.width - 15*mm, text_y)
        
        # Details (Grid layout)
        text_y -= 5*mm
        c.setFont("Helvetica", 6)
        c.setFillColor(self.text_gray)
        
        # ID Label & Value
        c.drawCentredString(self.width/2, text_y, "STAFF ID")
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(self.text_white)
        c.drawCentredString(self.width/2, text_y - 3*mm, str(data.get('id_no', '---')))

        # 5. Barcode (Footer)
        # White background container for barcode to ensure readability
        bar_area_h = 12*mm
        c.setFillColor(self.white)
        # Rounded rect for barcode
        c.roundRect(5*mm, 6*mm, self.width - 10*mm, bar_area_h, 2*mm, fill=1, stroke=0)
        
        barcode_value = str(data.get('id_no', '12345'))
        try:
            # Code128 conforms to width
            code = code128.Code128(barcode_value, barHeight=8*mm, barWidth=0.25*mm)
            # Center it
            code.drawOn(c, (self.width - code.width)/2, 8*mm)
        except:
            pass

    def _draw_back(self, c, data):
        # 1. Background
        c.setFillColor(self.bg_dark)
        c.rect(0, 0, self.width, self.height, fill=1, stroke=0)
        self._draw_tech_pattern(c)

        # 2. Header
        c.setFillColor(self.accent_gold)
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(self.width/2, self.height - 12*mm, "TERMS & CONDITIONS")
        
        c.setStrokeColor(self.accent_gold)
        c.line(15*mm, self.height - 14*mm, self.width - 15*mm, self.height - 14*mm)

        # 3. Content
        c.setFillColor(self.text_white)
        c.setFont("Helvetica", 6.5)
        
        terms = [
            "This card remains the property of Famous Gate",
            "Hotel and must be returned upon request or",
            "termination of employment.",
            "",
            "If found, please return to:",
            "Famous Gate Hotel HR Department",
            "",
            "Use of this card constitutes acceptance of",
            "company policies and security regulations."
        ]
        
        text_obj = c.beginText(6*mm, self.height - 22*mm)
        text_obj.setFont("Helvetica", 6.5)
        text_obj.setLeading(9)
        text_obj.setFillColor(self.text_white)
        
        for line in terms:
            if "Famous Gate" in line:
                text_obj.setFillColor(self.accent_gold)
            else:
                text_obj.setFillColor(self.text_white)
            text_obj.textLine(line)
            
        c.drawText(text_obj)

        # 4. QR Code Section (Scan for Validity)
        qr_y = 25*mm
        c.setFillColor(self.white)
        # White box for QR
        qr_size = 28*mm
        x_pos = (self.width - qr_size)/2
        
        # Gold border container
        c.setStrokeColor(self.accent_gold)
        c.setLineWidth(0.5*mm)
        c.roundRect(x_pos - 1*mm, qr_y - 1*mm, qr_size + 2*mm, qr_size + 2*mm, 1*mm, fill=0, stroke=1)
        
        # QR Code
        qr_data = data.get('qr_data', f"https://famousgate.hirall.com/verify/{data.get('id_no', 'N/A')}")
        try:
            qr_code = qr.QrCodeWidget(qr_data)
            bounds = qr_code.getBounds()
            w = bounds[2] - bounds[0]
            h = bounds[3] - bounds[1]
            
            d = Drawing(qr_size, qr_size, transform=[qr_size/w, 0, 0, qr_size/h, 0, 0])
            d.add(qr_code)
            renderPDF.draw(d, c, x_pos, qr_y)
        except:
            pass

        c.setFillColor(self.accent_gold)
        c.setFont("Helvetica-Bold", 7)
        c.drawCentredString(self.width/2, qr_y - 5*mm, "SCAN TO VERIFY")

        # 5. Footer
        c.setFillColor(self.bg_charcoal)
        c.rect(0, 0, self.width, 8*mm, fill=1, stroke=0)
        c.setFillColor(self.text_gray)
        c.setFont("Helvetica", 6)
        c.drawCentredString(self.width/2, 3*mm, "www.famousgate.hirall.com")

    def _draw_placeholder(self, c, x, y, r):
        c.setFillColor(self.bg_charcoal)
        c.circle(x, y, r, fill=1, stroke=0)
        c.setFillColor(self.text_gray)
        c.setFont("Helvetica-Bold", 20)
        c.drawCentredString(x, y - 6*mm, "?")

