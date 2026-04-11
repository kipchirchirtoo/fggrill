
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
        # Professional Palette (Reverted)
        self.primary_red = colors.HexColor("#B71C1C")
        self.dark_bg = colors.HexColor("#1A1A1A")
        self.text_dark = colors.HexColor("#212121")
        self.text_light = colors.white
        self.gold_accent = colors.HexColor("#FFD700")

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
        # 1. Background (Standard Professional)
        c.setFillColor(colors.white)
        c.rect(0, 0, self.width, self.height, fill=1, stroke=0)
        
        # Subtle Pattern
        c.saveState()
        c.setStrokeColor(colors.lightgrey)
        c.setLineWidth(0.05*mm)
        for i in range(0, int(self.width), 5):
            c.line(i*mm, 0, (i+5)*mm, self.height)
        c.restoreState()

        # 2. Left Sidebar (Photo Area) - 28mm width
        c.setFillColor(self.dark_bg)
        c.rect(0, 0, 28*mm, self.height, fill=1, stroke=0)
        
        # Gold accent line
        c.setFillColor(self.gold_accent)
        c.rect(28*mm, 0, 1*mm, self.height, fill=1, stroke=0)

        # Photo Container (Elegant Circle)
        c.saveState()
        photo_cnt_x = 14*mm
        photo_cnt_y = self.height/2 + 2*mm
        radius = 10*mm
        
        # Gold Border
        c.setStrokeColor(self.gold_accent)
        c.setLineWidth(0.5*mm)
        c.circle(photo_cnt_x, photo_cnt_y, radius + 1*mm, fill=0, stroke=1)
        
        # Photo Clipping - Create circular mask
        path = c.beginPath()
        path.circle(photo_cnt_x, photo_cnt_y, radius)
        c.clipPath(path, stroke=0)
        
        # Fill background with white first (for transparency)
        c.setFillColor(colors.white)
        c.circle(photo_cnt_x, photo_cnt_y, radius, fill=1, stroke=0)
        
        # Draw Photo
        photo_path = data.get('photo_path')
        photo_url = data.get('photo_url')
        img_obj = None
        
        print(f"[Generator] photo_path: {photo_path}")
        print(f"[Generator] photo_url: {photo_url}")
        
        if photo_path:
            try:
                if photo_path.startswith(('http://', 'https://')):
                    import urllib.request
                    print(f"[Generator] Downloading from URL: {photo_path}")
                    # Add User-Agent to avoid 403 Forbidden on some servers
                    req = urllib.request.Request(
                        photo_path, 
                        data=None, 
                        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
                    )
                    with urllib.request.urlopen(req, timeout=10) as response:
                        img_data = response.read()
                        img_obj = io.BytesIO(img_data)
                        print(f"[Generator] Downloaded {len(img_data)} bytes")
                elif os.path.exists(photo_path):
                    print(f"[Generator] Loading from file: {photo_path}")
                    # Read file into BytesIO for ImageReader
                    with open(photo_path, 'rb') as f:
                        img_data = f.read()
                        img_obj = io.BytesIO(img_data)
                        print(f"[Generator] Loaded {len(img_data)} bytes from file")
                else:
                    print(f"[Generator] Photo path does not exist: {photo_path}")
            except Exception as e:
                print(f"[Generator] Error loading image: {e}")
                import traceback
                traceback.print_exc()
        else:
            print("[Generator] No photo_path provided")

        if img_obj:
            try:
                print(f"[Generator] Creating ImageReader from img_obj")
                img = ImageReader(img_obj)
                
                # Get image dimensions
                img_width, img_height = img.getSize()
                print(f"[Generator] Image size: {img_width}x{img_height}")
                
                # Calculate position to center the image in the circle
                x_pos = photo_cnt_x - radius
                y_pos = photo_cnt_y - radius
                size = 2 * radius
                
                print(f"[Generator] Drawing image at ({x_pos}, {y_pos}) with size {size}")
                
                # Draw image - fill the circle completely
                c.drawImage(img, x_pos, y_pos, 
                          width=size, height=size, 
                          preserveAspectRatio=True, mask='auto')
                print(f"[Generator] Image drawn successfully!")
            except Exception as e:
                print(f"[Generator] Error drawing image: {e}")
                import traceback
                traceback.print_exc()
                self._draw_placeholder_photo(c, photo_cnt_x, photo_cnt_y, radius)
        else:
            print("[Generator] No img_obj, drawing placeholder")
            self._draw_placeholder_photo(c, photo_cnt_x, photo_cnt_y, radius)
        c.restoreState()

        # 3. Top Header Bar (Full Width beyond sidebar)
        header_height = 12*mm
        header_y = self.height - header_height
        
        # Header Background (Red)
        c.setFillColor(self.primary_red)
        p = c.beginPath()
        p.moveTo(29*mm, self.height)
        p.lineTo(self.width, self.height)
        p.lineTo(self.width, header_y)
        p.lineTo(29*mm, header_y)
        p.close()
        c.drawPath(p, fill=1, stroke=0)

        # Hotel Name
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(32*mm, self.height - 7*mm, "FamousGate Hotels")
        
        c.setFont("Helvetica", 6)
        c.drawString(32*mm, self.height - 10*mm, "Quality Hospitality Services")

        # Logo Overlay
        if os.path.exists(self.logo_path):
            try:
                logo = ImageReader(self.logo_path)
                logo_size = 9*mm
                c.drawImage(logo, self.width - 11*mm, self.height - 10.5*mm,
                          width=logo_size, height=logo_size, mask='auto', preserveAspectRatio=True)
            except:
                pass

        # 4. Employee Info
        info_x = 32*mm
        
        # Name
        c.setFillColor(self.primary_red)
        name = data.get('name', 'NAME').upper()
        font_size = 13
        if len(name) > 18: font_size = 11
        if len(name) > 25: font_size = 9
        c.setFont("Helvetica-Bold", font_size)
        c.drawString(info_x, self.height - 18*mm, name)
        
        # Role
        role = data.get('role', 'POSITION').upper()
        c.setFillColor(self.text_dark)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(info_x, self.height - 22*mm, role)

        # Divider
        c.setStrokeColor(colors.lightgrey)
        c.setLineWidth(0.2*mm)
        c.line(info_x, self.height - 24*mm, self.width - 5*mm, self.height - 24*mm)

        # 5. Details
        details_y = self.height - 28*mm
        c.setFillColor(self.text_dark)
        
        def draw_label_val(label, val, x, y):
            c.setFont("Helvetica-Bold", 5)
            c.drawString(x, y, label)
            c.setFont("Helvetica", 5.5)
            c.drawString(x + 14*mm, y, val)

        draw_label_val("STAFF ID:", str(data.get('id_no', 'N/A')), info_x, details_y)
        draw_label_val("NATIONAL ID:", str(data.get('national_id', 'N/A')), info_x, details_y - 4*mm)
        draw_label_val("JOINED:", str(data.get('join_date', 'N/A')), info_x, details_y - 8*mm)
        draw_label_val("EXPIRES:", "31/12/2026", info_x, details_y - 12*mm)

        # 6. Barcode (Bottom - For Check-in)
        barcode_value = data.get('id_no', 'TEMP-001')
        try:
            # Draw barcode at bottom center of the white area
            # Available width approx: 29mm to 88mm = 59mm
            # Center of available area: 29 + 59/2 = 58.5mm
            barcode = code128.Code128(barcode_value, barHeight=6*mm, barWidth=0.2*mm)
            b_width = barcode.width
            b_x = 29*mm + (59*mm - b_width)/2
            barcode.drawOn(c, b_x, 3*mm)
            
            c.setFont("Helvetica", 4)
            c.drawCentredString(29*mm + 59*mm/2, 1.5*mm, f"CHECK-IN: {barcode_value}")
        except:
            pass
            
        # QR Code removed from front to make space for clean look and barcode focus


    def _draw_back(self, c, data):
        # 1. Background (White Clean)
        c.setFillColor(colors.white)
        c.rect(0, 0, self.width, self.height, fill=1, stroke=0)
        
        # 2. Header
        c.setFillColor(self.primary_red)
        c.rect(0, self.height - 8*mm, self.width, 8*mm, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(self.width/2, self.height - 5*mm, "TERMS AND CONDITIONS")
        
        # 3. Content
        c.setFillColor(self.text_dark)
        c.setFont("Helvetica", 6)
        
        # Terms Text
        terms_y = self.height - 14*mm
        c.drawString(5*mm, terms_y, "1. This card is the property of FamousGate Hotels.")
        c.drawString(5*mm, terms_y - 4*mm, "2. Must be visible at all times while on duty.")
        c.drawString(5*mm, terms_y - 8*mm, "3. Report loss/theft immediately to HR/Security.")
        
        # Emergency Info (Bold)
        c.setFont("Helvetica-Bold", 6)
        c.setFillColor(self.primary_red)
        c.drawString(5*mm, terms_y - 14*mm, "IF LOST, RETURN TO NEAREST POLICE STATION")
        c.drawString(5*mm, terms_y - 18*mm, "OR CALL EMERGENCY: 0706 782 828")

        # 4. QR Code (Left Side Bottom)
        # QR Data points to verification URL
        id_no = data.get('id_no', 'N/A')
        verify_url = f"https://famousgate.hirall.com/verify?id={id_no}"
        
        qr_size = 18*mm
        qr_x = self.width - qr_size - 5*mm
        qr_y = 5*mm
        
        try:
            qr_code = qr.QrCodeWidget(verify_url)
            bounds = qr_code.getBounds()
            w = bounds[2] - bounds[0]
            h = bounds[3] - bounds[1]
            d = Drawing(qr_size, qr_size, transform=[qr_size/w, 0, 0, qr_size/h, 0, 0])
            d.add(qr_code)
            renderPDF.draw(d, c, qr_x, qr_y)
        except:
            pass
            
        c.setFillColor(self.text_dark)
        c.setFont("Helvetica-Bold", 4)
        c.drawCentredString(qr_x + qr_size/2, qr_y - 2*mm, "SCAN TO VERIFY")

        # 5. Footer Line
        c.setFillColor(self.dark_bg)
        c.rect(0, 0, self.width, 2*mm, fill=1, stroke=0)


    def _draw_placeholder_photo(self, c, x, y, r):
        c.setFillColor(colors.lightgrey)
        c.circle(x, y, r, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 15)
        c.drawCentredString(x, y - 5*mm, "?")

