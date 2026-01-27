
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
        # Modern Digital Palette
        self.primary_red = colors.HexColor("#D32F2F")  # Brighter Red
        self.dark_bg = colors.HexColor("#121212")      # Deep Black
        self.card_bg = colors.HexColor("#1E1E1E")      # Dark Grey
        self.accent_cyan = colors.HexColor("#00E5FF")  # Digital Cyan
        self.text_dark = colors.HexColor("#FAFAFA")    # White Text
        self.text_gray = colors.HexColor("#B0BEC5")    # Light Gray Text

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
        # 1. Background (Digital Dark Theme)
        c.setFillColor(self.card_bg)
        c.rect(0, 0, self.width, self.height, fill=1, stroke=0)
        
        # Tech Pattern - Grid Lines
        c.saveState()
        c.setStrokeColor(colors.HexColor("#333333"))
        c.setLineWidth(0.1*mm)
        for i in range(0, int(self.width), 4):
            c.line(i*mm, 0, (i+2)*mm, self.height)
            c.line(0, i*mm, self.width, (i+2)*mm)
        c.restoreState()

        # 2. Left Sidebar (Photo Area) - 30mm width
        # Gradient simulation (Darker sidebar)
        c.setFillColor(self.dark_bg)
        c.rect(0, 0, 32*mm, self.height, fill=1, stroke=0)
        
        # Digital Accent Line (Vertical)
        c.setStrokeColor(self.primary_red)
        c.setLineWidth(0.8*mm)
        c.line(32*mm, 0, 32*mm, self.height)

        # Photo Container (Hexagonal or Circular with Tech Ring)
        c.saveState()
        photo_cnt_x = 16*mm
        photo_cnt_y = self.height/2 + 2*mm
        radius = 11*mm
        
        # Tech Ring (Outer)
        c.setStrokeColor(self.primary_red)
        c.setLineWidth(0.3*mm)
        c.circle(photo_cnt_x, photo_cnt_y, radius + 2*mm, fill=0, stroke=1)
        
        # Tech Ring (Inner dashed)
        c.setStrokeColor(self.accent_cyan)
        c.setLineWidth(0.2*mm)
        c.setDash([1, 2], 0)
        c.circle(photo_cnt_x, photo_cnt_y, radius + 1*mm, fill=0, stroke=1)
        c.setDash([], 0) # Reset dash

        # Photo Clipping
        path = c.beginPath()
        path.circle(photo_cnt_x, photo_cnt_y, radius)
        c.clipPath(path, stroke=0)
        
        # Draw Photo
        photo_path = data.get('photo_path')
        if photo_path and os.path.exists(photo_path):
            try:
                img = ImageReader(photo_path)
                c.drawImage(img, photo_cnt_x - radius, photo_cnt_y - radius, 
                          width=2*radius, height=2*radius, preserveAspectRatio=True, anchor='c')
            except:
                self._draw_placeholder_photo(c, photo_cnt_x, photo_cnt_y, radius)
        else:
            self._draw_placeholder_photo(c, photo_cnt_x, photo_cnt_y, radius)
        c.restoreState()

        # 3. Top Header Bar (Full Width beyond sidebar)
        # Fixes cut-off issue by extending to self.width
        header_height = 12*mm
        header_y = self.height - header_height
        
        # Header Background
        c.setFillColor(self.primary_red)
        # Using a polygon for a dynamic angle
        p = c.beginPath()
        p.moveTo(32*mm, self.height)      # Top left after sidebar
        p.lineTo(self.width, self.height) # Top right
        p.lineTo(self.width, header_y)    # Bottom right of header
        p.lineTo(32*mm, header_y)    # Bottom left of header
        p.close()
        c.drawPath(p, fill=1, stroke=0)

        # Hotel Name
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 11)
        # Adjust text position to ensure it fits
        c.drawString(36*mm, self.height - 7*mm, "FAMOUS GATE HOTEL")
        
        c.setFont("Helvetica", 6)
        c.setFillColor(colors.HexColor("#FFEBEE")) # Light red/white
        c.drawString(36*mm, self.height - 10*mm, "DIGITAL ACCESS PASS")

        # Logo Overlay
        if os.path.exists(self.logo_path):
            try:
                logo = ImageReader(self.logo_path)
                logo_size = 9*mm
                c.drawImage(logo, self.width - 12*mm, self.height - 11*mm,
                          width=logo_size, height=logo_size, mask='auto', preserveAspectRatio=True)
            except:
                pass

        # 4. Employee Info (Main Body)
        info_x = 36*mm
        
        # Name (Big and bold)
        c.setFillColor(colors.white)
        name = data.get('name', 'NAME').upper()
        font_size = 14
        if len(name) > 18: font_size = 12
        if len(name) > 25: font_size = 10
        c.setFont("Helvetica-Bold", font_size)
        c.drawString(info_x, self.height - 19*mm, name)
        
        # Role (highlighted)
        role = data.get('role', 'POSITION').upper()
        c.setFillColor(self.accent_cyan)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(info_x, self.height - 23*mm, role)

        # 5. Data Grid (Details)
        # Draw a small tech container for details
        details_y_start = self.height - 28*mm
        
        # Labels
        c.setFillColor(self.text_gray)
        c.setFont("Helvetica", 5)
        c.drawString(info_x, details_y_start, "ID CARD NO")
        c.drawString(info_x, details_y_start - 6*mm, "DATE JOINED")
        c.drawString(info_x, details_y_start - 12*mm, "VALID UNTIL")

        # Values
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 7)
        c.drawString(info_x, details_y_start - 2.5*mm, str(data.get('id_no', 'N/A')))
        c.drawString(info_x, details_y_start - 8.5*mm, str(data.get('join_date', 'N/A')))
        c.drawString(info_x, details_y_start - 14.5*mm, "31/12/2026")

        # 6. QR Code (Right Side Bottom)
        # Tech box for QR
        qr_size = 18*mm
        qr_x = self.width - qr_size - 4*mm
        qr_y = 4*mm
        
        # QR Background glow
        c.saveState()
        c.setFillColor(colors.white) 
        c.rect(qr_x - 1*mm, qr_y - 1*mm, qr_size + 2*mm, qr_size + 2*mm, fill=1, stroke=0)
        c.restoreState()

        qr_data = data.get('qr_data', f"VERIFY:{data.get('id_no', 'N/A')}")
        try:
            qr_code = qr.QrCodeWidget(qr_data)
            bounds = qr_code.getBounds()
            w = bounds[2] - bounds[0]
            h = bounds[3] - bounds[1]
            d = Drawing(qr_size, qr_size, transform=[qr_size/w, 0, 0, qr_size/h, 0, 0])
            d.add(qr_code)
            renderPDF.draw(d, c, qr_x, qr_y)
        except:
            pass
        
        # footer text
        c.setFillColor(self.text_gray)
        c.setFont("Helvetica", 4)
        c.drawCentredString(qr_x + qr_size/2, qr_y - 2*mm, "SCAN TO VERIFY")

    def _draw_back(self, c, data):
        # 1. Background (Digital Dark)
        c.setFillColor(self.card_bg)
        c.rect(0, 0, self.width, self.height, fill=1, stroke=0)
        
        # Grid lines
        c.saveState()
        c.setStrokeColor(colors.HexColor("#333333"))
        c.setLineWidth(0.1*mm)
        for i in range(0, int(self.width), 4):
            c.line(i*mm, 0, (i+2)*mm, self.height)
        c.restoreState()

        # 2. Wavy Header (Inverted/Digital style)
        c.setFillColor(self.primary_red)
        p_header = c.beginPath()
        p_header.moveTo(0, self.height)
        p_header.lineTo(self.width, self.height)
        p_header.lineTo(self.width, self.height - 8*mm)
        # Tech cut
        p_header.lineTo(self.width * 0.8, self.height - 4*mm)
        p_header.lineTo(0, self.height - 4*mm)
        p_header.close()
        c.drawPath(p_header, fill=1, stroke=0)
        
        # 3. Terms & Conditions
        c.setFillColor(self.text_dark)
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(self.width/2, self.height - 15*mm, "TERMS & CONDITIONS")
        
        c.setFont("Helvetica", 6)
        c.setFillColor(self.text_gray)
        terms = [
            "• This card remains the property of Famous Gate Hotel.",
            "• Must be typically worn and visible while on duty.",
            "• Report loss or theft immediately to Security/HR.",
            "• Unauthorized use is a serious offense."
        ]
        y_pos = self.height - 22*mm
        for term in terms:
            c.drawString(10*mm, y_pos, term)
            y_pos -= 5*mm

        # 4. QR Code (Right side)
        # Small verify QR
        qr_size = 14*mm
        qr_x = self.width - qr_size - 6*mm
        qr_y = 10*mm
        
        # QR BG
        c.setFillColor(colors.white)
        c.rect(qr_x - 1*mm, qr_y - 1*mm, qr_size + 2*mm, qr_size + 2*mm, fill=1, stroke=0)
        
        qr_data = data.get('qr_data', f"VERIFY:{data.get('id_no', 'N/A')}")
        qr_code = qr.QrCodeWidget(qr_data)
        bounds = qr_code.getBounds()
        w = bounds[2] - bounds[0]
        h = bounds[3] - bounds[1]
        
        d = Drawing(qr_size, qr_size, transform=[qr_size/w, 0, 0, qr_size/h, 0, 0])
        d.add(qr_code)
        renderPDF.draw(d, c, qr_x, qr_y)
        
        c.setFillColor(self.accent_cyan)
        c.setFont("Helvetica-Bold", 4)
        c.drawCentredString(qr_x + qr_size/2, qr_y - 2.5*mm, "SECURITY CHECK")

        # 5. Footer
        c.setFillColor(self.dark_bg)
        c.rect(0, 0, self.width, 6*mm, fill=1, stroke=0)
        
        c.setFillColor(self.text_dark)
        c.setFont("Helvetica-Bold", 7)
        c.drawCentredString(self.width/2, 2*mm, "FAMOUS GATE HOTEL")

    def _draw_placeholder_photo(self, c, x, y, r):
        c.setFillColor(self.card_bg)
        c.circle(x, y, r, fill=1, stroke=0)
        c.setStrokeColor(self.text_gray)
        c.setLineWidth(0.3*mm)
        c.circle(x, y, r, fill=0, stroke=1)
        
        c.setFillColor(self.text_dark)
        c.setFont("Helvetica-Bold", 15)
        c.drawCentredString(x, y - 5*mm, "?")

