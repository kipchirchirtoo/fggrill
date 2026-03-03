from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import barcode
from barcode.writer import ImageWriter
import io
import base64
import logging
from PIL import Image, ImageDraw, ImageFont
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

class BarcodeGeneratorService:
    def __init__(self):
        self.supported_formats = ['code128', 'code39', 'ean8', 'ean13', 'upca']
    
    def generate_barcode(self, booking_id: str, format_type: str = 'code128', include_text: bool = True) -> bytes:
        """Generate barcode for booking ID"""
        try:
            # Clean booking ID for barcode (remove hyphens for compatibility)
            clean_id = booking_id.replace('-', '').replace('HTL', '')
            
            # Get barcode class
            barcode_class = barcode.get_barcode_class(format_type)
            
            # Create barcode instance
            code = barcode_class(clean_id, writer=ImageWriter())
            
            # Generate barcode image
            buffer = io.BytesIO()
            code.write(buffer, options={
                'module_width': 0.2,
                'module_height': 15.0,
                'quiet_zone': 6.5,
                'font_size': 10 if include_text else 0,
                'text_distance': 5.0,
                'background': 'white',
                'foreground': 'black',
                'write_text': include_text,
                'text': booking_id if include_text else ''
            })
            
            buffer.seek(0)
            return buffer.getvalue()
            
        except Exception as e:
            logger.error(f"Error generating barcode: {str(e)}")
            raise
    
    def generate_booking_card(self, booking_data: dict) -> bytes:
        """Generate a complete booking card with barcode and details"""
        try:
            # Create base image (minimal light theme)
            width, height = 600, 400
            img = Image.new('RGB', (width, height), color='#FAFAFA')  # Light gray background
            draw = ImageDraw.Draw(img)
            
            # Try to load a font, fallback to default
            try:
                title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
                header_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
                body_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
            except:
                title_font = ImageFont.load_default()
                header_font = ImageFont.load_default()
                body_font = ImageFont.load_default()
            
            # Colors (minimal theme)
            primary_color = '#3C3C43'  # Dark gray
            secondary_color = '#8E8E93'  # Medium gray
            accent_color = '#F2F2F7'  # Light gray
            
            # Header section
            draw.rectangle([0, 0, width, 80], fill=primary_color)
            draw.text((20, 20), "Kyogong", fill='white', font=title_font)
            draw.text((20, 50), "BOOKING CONFIRMATION", fill='white', font=header_font)
            
            # Booking ID prominently displayed
            draw.rectangle([20, 100, width-20, 140], fill=accent_color, outline=primary_color, width=2)
            draw.text((30, 110), f"Booking ID: {booking_data.get('booking_id', 'N/A')}", fill=primary_color, font=header_font)
            
            # Guest details
            y_pos = 160
            draw.text((20, y_pos), f"Guest: {booking_data.get('guest_name', 'N/A')}", fill=primary_color, font=body_font)
            y_pos += 25
            draw.text((20, y_pos), f"Check-in: {booking_data.get('check_in', 'N/A')}", fill=secondary_color, font=body_font)
            y_pos += 20
            draw.text((20, y_pos), f"Check-out: {booking_data.get('check_out', 'N/A')}", fill=secondary_color, font=body_font)
            y_pos += 20
            draw.text((20, y_pos), f"Room: {booking_data.get('room_type', 'N/A')}", fill=secondary_color, font=body_font)
            y_pos += 20
            draw.text((20, y_pos), f"Guests: {booking_data.get('adults', 1)} Adults", fill=secondary_color, font=body_font)
            
            # Generate barcode
            barcode_bytes = self.generate_barcode(booking_data.get('booking_id', 'HTL000000-0000'))
            barcode_img = Image.open(io.BytesIO(barcode_bytes))
            
            # Resize barcode to fit
            barcode_width = 200
            barcode_height = int(barcode_img.height * (barcode_width / barcode_img.width))
            barcode_img = barcode_img.resize((barcode_width, barcode_height))
            
            # Paste barcode on the right side
            barcode_x = width - barcode_width - 20
            barcode_y = 160
            img.paste(barcode_img, (barcode_x, barcode_y))
            
            # Convert to bytes
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            buffer.seek(0)
            
            return buffer.getvalue()
            
        except Exception as e:
            logger.error(f"Error generating booking card: {str(e)}")
            raise
    
    def generate_qr_code(self, booking_id: str, booking_url: str = None) -> bytes:
        """Generate QR code for booking lookup"""
        try:
            import qrcode
            
            # Create QR code data
            qr_data = booking_url or f"https://fggrillhotel.com/booking/{booking_id}"
            
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(qr_data)
            qr.make(fit=True)
            
            # Create QR code image
            qr_img = qr.make_image(fill_color="black", back_color="white")
            
            # Convert to bytes
            buffer = io.BytesIO()
            qr_img.save(buffer, format='PNG')
            buffer.seek(0)
            
            return buffer.getvalue()
            
        except ImportError:
            logger.error("QR code generation requires 'qrcode' package")
            raise Exception("QR code generation not available")
        except Exception as e:
            logger.error(f"Error generating QR code: {str(e)}")
            raise

barcode_service = BarcodeGeneratorService()

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'service': 'barcode_generator'})

@app.route('/generate-barcode', methods=['POST'])
def generate_barcode():
    """Generate barcode for booking ID"""
    try:
        data = request.json
        booking_id = data.get('booking_id')
        format_type = data.get('format', 'code128')
        include_text = data.get('include_text', True)
        
        if not booking_id:
            return jsonify({'error': 'booking_id is required'}), 400
        
        barcode_bytes = barcode_service.generate_barcode(booking_id, format_type, include_text)
        
        # Return as base64 encoded string
        barcode_b64 = base64.b64encode(barcode_bytes).decode('utf-8')
        
        return jsonify({
            'barcode': barcode_b64,
            'format': 'image/png',
            'booking_id': booking_id
        })
        
    except Exception as e:
        logger.error(f"Error in generate_barcode: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/generate-booking-card', methods=['POST'])
def generate_booking_card():
    """Generate complete booking card with barcode"""
    try:
        booking_data = request.json
        
        if not booking_data or not booking_data.get('booking_id'):
            return jsonify({'error': 'booking_data with booking_id is required'}), 400
        
        card_bytes = barcode_service.generate_booking_card(booking_data)
        
        # Return as base64 encoded string
        card_b64 = base64.b64encode(card_bytes).decode('utf-8')
        
        return jsonify({
            'booking_card': card_b64,
            'format': 'image/png',
            'booking_id': booking_data.get('booking_id')
        })
        
    except Exception as e:
        logger.error(f"Error in generate_booking_card: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/generate-qr-code', methods=['POST'])
def generate_qr_code():
    """Generate QR code for booking"""
    try:
        data = request.json
        booking_id = data.get('booking_id')
        booking_url = data.get('booking_url')
        
        if not booking_id:
            return jsonify({'error': 'booking_id is required'}), 400
        
        qr_bytes = barcode_service.generate_qr_code(booking_id, booking_url)
        
        # Return as base64 encoded string
        qr_b64 = base64.b64encode(qr_bytes).decode('utf-8')
        
        return jsonify({
            'qr_code': qr_b64,
            'format': 'image/png',
            'booking_id': booking_id
        })
        
    except Exception as e:
        logger.error(f"Error in generate_qr_code: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/barcode-image/<booking_id>', methods=['GET'])
def get_barcode_image(booking_id):
    """Get barcode as image file"""
    try:
        format_type = request.args.get('format', 'code128')
        include_text = request.args.get('include_text', 'true').lower() == 'true'
        
        barcode_bytes = barcode_service.generate_barcode(booking_id, format_type, include_text)
        
        return send_file(
            io.BytesIO(barcode_bytes),
            mimetype='image/png',
            as_attachment=False,
            download_name=f'barcode_{booking_id}.png'
        )
        
    except Exception as e:
        logger.error(f"Error serving barcode image: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    logger.info("Barcode Generator Service starting...")
    app.run(host='0.0.0.0', port=5003, debug=False)
