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
        
        # Colors from the provided images
        self.bg_brown = colors.HexColor("#A68B7A")  # Main brown/beige background
        self.bg_pattern = colors.HexColor("#B69D8E") # Lighter brown for geometric pattern
        self.dark_navy = colors.HexColor("#1E212D") # Dark navy/black for waves and text
        self.text_labels = colors.HexColor("#333333") # Subtle dark for labels
        self.text_values = colors.HexColor("#1E212D") # Rich dark for values
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

    def _draw_background_pattern(self, c):
        """Draws the diagonal geometric shapes seen in the background"""
        c.saveState()
        c.setFillColor(self.bg_pattern)
        
        # Top right diagonal polygon
        p = c.beginPath()
        p.moveTo(self.width * 0.4, self.height)
        p.lineTo(self.width, self.height)
        p.lineTo(self.width, self.height * 0.7)
        p.close()
        c.drawPath(p, fill=1, stroke=0)
        
        # Middle diagonal section
        p2 = c.beginPath()
        p2.moveTo(0, self.height * 0.4)
        p2.lineTo(self.width, self.height * 0.8)
        p2.lineTo(self.width, self.height * 0.6)
        p2.lineTo(0, self.height * 0.2)
        p2.close()
        c.drawPath(p2, fill=1, stroke=0)
        
        c.restoreState()

    def _draw_wavy_decor(self, c, top=True):
        """Draws the dark navy wavy shapes at top/bottom"""
        c.saveState()
        c.setFillColor(self.dark_navy)
        
        if top:
            # Top Wave
            p = c.beginPath()
            p.moveTo(0, self.height)
            p.lineTo(self.width, self.height)
            p.lineTo(self.width, self.height - 10*mm)
            p.curveTo(self.width * 0.7, self.height - 15*mm, self.width * 0.3, self.height - 5*mm, 0, self.height - 10*mm)
            p.close()
            c.drawPath(p, fill=1, stroke=0)
            
            # Subtle secondary wave line
            c.setStrokeColor(self.dark_navy)
            c.setLineWidth(0.5*mm)
            c.setStrokeAlpha(0.3)
            c.bezier(0, self.height - 12*mm, self.width*0.3, self.height - 7*mm, self.width*0.7, self.height - 17*mm, self.width, self.height - 12*mm)
        else:
            # Bottom Wave
            p = c.beginPath()
            p.moveTo(0, 0)
            p.lineTo(self.width, 0)
            p.lineTo(self.width, 10*mm)
            p.curveTo(self.width * 0.7, 5*mm, self.width * 0.3, 15*mm, 0, 10*mm)
            p.close()
            c.drawPath(p, fill=1, stroke=0)
            
            # Subtle secondary wave line
            c.setStrokeColor(self.dark_navy)
            c.setLineWidth(0.5*mm)
            c.setStrokeAlpha(0.3)
            c.bezier(0, 12*mm, self.width*0.3, 17*mm, self.width*0.7, 7*mm, self.width, 12*mm)
            
        c.restoreState()

    def _draw_front(self, c, data):
        # Base background color
        c.setFillColor(self.bg_brown)
        c.rect(0, 0, self.width, self.height, fill=1, stroke=0)
        
        # Background pattern & Waves
        self._draw_background_pattern(c)
        self._draw_wavy_decor(c, top=True)
        self._draw_wavy_decor(c, top=False)

        # Centered Photo Circle
        photo_x = self.width / 2
        photo_y = self.height * 0.65
        radius = 18*mm
        
        c.saveState()
        # Dark border for photo
        c.setFillColor(self.dark_navy)
        c.circle(photo_x, photo_y, radius + 0.5*mm, fill=1, stroke=0)
        
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

        # Employee Name
        c.setFillColor(self.dark_navy)
        name = data.get('name', 'DANIEL GALLEGO').upper()
        font_size = 14
        if len(name) > 15: font_size = 12
        if len(name) > 20: font_size = 10
        c.setFont("Helvetica-Bold", font_size)
        c.drawCentredString(self.width / 2, self.height * 0.42, name)
        
        # Name Underline
        c.setStrokeColor(self.dark_navy)
        c.setLineWidth(1)
        c.line(self.width * 0.2, self.height * 0.4, self.width * 0.8, self.height * 0.4)
        
        # Role
        c.setFont("Helvetica", 10)
        c.drawCentredString(self.width / 2, self.height * 0.36, data.get('role', 'MANAGER').upper())
        
        # Details section (Staff ID, Email, Phone)
        details_y = self.height * 0.28
        spacing = 4*mm
        
        def draw_label_value(label, value, y):
            c.setFont("Helvetica", 7)
            c.setFillColor(self.text_labels)
            label_text = f"{label} : "
            c.drawString(10*mm, y, label_text)
            
            c.setFont("Helvetica", 7)
            c.setFillColor(self.text_values)
            c.drawString(28*mm, y, str(value if value else 'N/A'))

        draw_label_value("STAFF ID", data.get('id_no'), details_y)
        draw_label_value("EMAIL", data.get('email'), details_y - spacing)
        draw_label_value("PHONE", data.get('phone'), details_y - 2 * spacing)

        # Barcode at bottom
        barcode_value = str(data.get('id_no', '1234567890'))
        try:
            barcode = code128.Code128(barcode_value, barHeight=6*mm, barWidth=0.2*mm)
            barcode.drawOn(c, (self.width - barcode.width) / 2, 10*mm)
        except:
            pass

    def _draw_back(self, c, data):
        # Base background color
        c.setFillColor(self.bg_brown)
        c.rect(0, 0, self.width, self.height, fill=1, stroke=0)
        
        # Background pattern & Waves
        self._draw_background_pattern(c)
        self._draw_wavy_decor(c, top=True)
        self._draw_wavy_decor(c, top=False)

        # Terms & Conditions Header
        c.setFillColor(self.dark_navy)
        c.setFont("Helvetica", 10)
        c.drawCentredString(self.width/2, self.height * 0.75, "TERMS & CONDITIONS")
        
        # Terms Bullet points
        c.setFont("Helvetica", 7)
        c.setFillColor(self.text_values)
        terms = [
            "Identification: All employees must keep their",
            "ID cards visible or readily available while on",
            "company premises to ensure proper access",
            "control and identity verification.",
            "",
            "Usage: The ID card remains the exclusive",
            "property of the company. It is issued for",
            "personal use only and must not be lent,",
            "copied, or misused in any manner."
        ]
        
        text_obj = c.beginText(10*mm, self.height * 0.68)
        text_obj.setFont("Helvetica", 7)
        text_obj.setLeading(10)
        for line in terms:
            if line:
                # Add a small dot for actual bullets if needed, but the image uses a dot
                if line.startswith("Identification") or line.startswith("Usage"):
                    c.circle(8*mm, text_obj.getY() + 0.5*mm, 0.4*mm, fill=1, stroke=0)
                text_obj.textLine(line)
            else:
                text_obj.textLine("")
        c.drawText(text_obj)

        # Scan for Validity
        c.setFont("Helvetica", 9)
        c.drawCentredString(self.width/2, self.height * 0.4, "SCAN FOR VALIDIITY")
        
        # QR Code
        qr_data = data.get('qr_data', f"https://famousgate.hirall.com/verify/{data.get('id_no', 'N/A')}")
        try:
            qr_code = qr.QrCodeWidget(qr_data)
            bounds = qr_code.getBounds()
            w = bounds[2] - bounds[0]
            h = bounds[3] - bounds[1]
            
            qr_size = 25*mm
            d = Drawing(qr_size, qr_size, transform=[qr_size/w, 0, 0, qr_size/h, 0, 0])
            d.add(qr_code)
            renderPDF.draw(d, c, (self.width - qr_size)/2, self.height * 0.18)
        except:
            pass

        # Footer URL
        c.setFillColor(self.dark_navy)
        c.setFont("Helvetica", 8)
        c.drawCentredString(self.width/2, 25*mm, "www.famousgate.hirall.com")

    def _draw_placeholder_photo(self, c, x, y, r):
        c.setFillColor(self.dark_navy)
        c.circle(x, y, r, fill=1, stroke=0)
        c.setFillColor(self.white)
        c.setFont("Helvetica-Bold", 15)
        c.drawCentredString(x, y - 5*mm, "?")

