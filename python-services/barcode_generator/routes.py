"""
Barcode Generator Blueprint
Consolidated barcode and QR code generation service
"""
from flask import Blueprint, request, jsonify, send_file
import barcode
from barcode.writer import ImageWriter
import io
import base64
import logging
from PIL import Image, ImageDraw, ImageFont
import qrcode

logger = logging.getLogger(__name__)

# Create blueprint
barcode_generator_bp = Blueprint('barcode_generator', __name__, url_prefix='/api/barcode')

class BarcodeGeneratorService:
    def __init__(self):
        self.supported_formats = ['code128', 'code39', 'ean8', 'ean13', 'upca']
    
    def generate_barcode(self, booking_id: str, format_type: str = 'code128', include_text: bool = True) -> bytes:
        """Generate barcode for booking ID"""
        try:
            # CODE128 supports full alphanumeric - use complete booking ID
            # Format: HTL251216-0007 (includes letters, numbers, and hyphen)
            
            # Get barcode class
            barcode_class = barcode.get_barcode_class(format_type)
            
            # Create barcode instance with full booking ID
            code = barcode_class(booking_id, writer=ImageWriter())
            
            # Generate high-quality barcode image with better appearance
            buffer = io.BytesIO()
            code.write(buffer, options={
                'module_width': 0.3,        # Thicker bars for better scanning
                'module_height': 18.0,      # Taller bars for better visibility
                'quiet_zone': 8.0,          # More white space around barcode
                'font_size': 12 if include_text else 0,  # Larger text
                'text_distance': 6.0,       # More space between barcode and text
                'background': 'white',
                'foreground': 'black',
                'write_text': include_text,
                'text': booking_id if include_text else '',
                'dpi': 300                  # High DPI for crisp image
            })
            
            buffer.seek(0)
            return buffer.getvalue()
            
        except Exception as e:
            logger.error(f"Error generating barcode: {str(e)}")
            raise
    
    def generate_qr_code(self, data: str, size: int = 300) -> bytes:
        """Generate QR code"""
        try:
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(data)
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            img = img.resize((size, size))
            
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            buffer.seek(0)
            return buffer.getvalue()
            
        except Exception as e:
            logger.error(f"Error generating QR code: {str(e)}")
            raise
    
    def generate_barcode_base64(self, booking_id: str, format_type: str = 'code128') -> str:
        """Generate barcode and return as base64 string"""
        try:
            barcode_bytes = self.generate_barcode(booking_id, format_type)
            return base64.b64encode(barcode_bytes).decode('utf-8')
        except Exception as e:
            logger.error(f"Error generating base64 barcode: {str(e)}")
            raise
    
    def generate_qr_base64(self, data: str, size: int = 300) -> str:
        """Generate QR code and return as base64 string"""
        try:
            qr_bytes = self.generate_qr_code(data, size)
            return base64.b64encode(qr_bytes).decode('utf-8')
        except Exception as e:
            logger.error(f"Error generating base64 QR code: {str(e)}")
            raise
    
    def generate_booking_card(self, booking_data: dict) -> bytes:
        """Generate complete booking card with barcode and details"""
        try:
            # Create base image
            width, height = 600, 400
            img = Image.new('RGB', (width, height), color='#FAFAFA')
            draw = ImageDraw.Draw(img)
            
            # Try to load fonts
            try:
                title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
                header_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
                body_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
            except:
                title_font = ImageFont.load_default()
                header_font = ImageFont.load_default()
                body_font = ImageFont.load_default()
            
            # Colors
            primary_color = '#3C3C43'
            secondary_color = '#8E8E93'
            accent_color = '#F2F2F7'
            
            # Header
            draw.rectangle([0, 0, width, 80], fill=primary_color)
            draw.text((20, 20), "FamousGate Hotels", fill='white', font=title_font)
            draw.text((20, 50), "BOOKING CONFIRMATION", fill='white', font=header_font)
            
            # Booking ID
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
            
            # Generate and paste barcode
            barcode_bytes = self.generate_barcode(booking_data.get('booking_id', 'HTL000000-0000'))
            barcode_img = Image.open(io.BytesIO(barcode_bytes))
            
            barcode_width = 200
            barcode_height = int(barcode_img.height * (barcode_width / barcode_img.width))
            barcode_img = barcode_img.resize((barcode_width, barcode_height))
            
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

# Initialize service
barcode_service = BarcodeGeneratorService()

# Routes
@barcode_generator_bp.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'service': 'barcode_generator'})

@barcode_generator_bp.route('/generate', methods=['POST'])
def generate_barcode():
    """Generate barcode image"""
    try:
        data = request.json
        booking_id = data.get('booking_id')
        format_type = data.get('format', 'code128')
        include_text = data.get('include_text', True)
        return_base64 = data.get('return_base64', False)
        
        if not booking_id:
            return jsonify({'error': 'booking_id is required'}), 400
        
        if format_type not in barcode_service.supported_formats:
            return jsonify({'error': f'Unsupported format. Use one of: {barcode_service.supported_formats}'}), 400
        
        if return_base64:
            barcode_base64 = barcode_service.generate_barcode_base64(booking_id, format_type)
            return jsonify({
                'barcode': barcode_base64,
                'format': 'base64',
                'type': format_type
            })
        else:
            barcode_bytes = barcode_service.generate_barcode(booking_id, format_type, include_text)
            return send_file(
                io.BytesIO(barcode_bytes),
                mimetype='image/png',
                as_attachment=False,
                download_name=f'{booking_id}_barcode.png'
            )
            
    except Exception as e:
        logger.error(f"Error in generate_barcode: {str(e)}")
        return jsonify({'error': str(e)}), 500

@barcode_generator_bp.route('/barcode-image/<booking_id>', methods=['GET'])
def get_barcode_image(booking_id):
    """Get barcode image by booking ID (for email templates)"""
    try:
        format_type = request.args.get('format', 'code128')
        include_text = request.args.get('include_text', 'true').lower() == 'true'
        
        barcode_bytes = barcode_service.generate_barcode(booking_id, format_type, include_text)
        return send_file(
            io.BytesIO(barcode_bytes),
            mimetype='image/png',
            as_attachment=False
        )
        
    except Exception as e:
        logger.error(f"Error in get_barcode_image: {str(e)}")
        return jsonify({'error': str(e)}), 500

@barcode_generator_bp.route('/qr/generate', methods=['POST'])
def generate_qr():
    """Generate QR code"""
    try:
        data = request.json
        qr_data = data.get('data')
        size = data.get('size', 300)
        return_base64 = data.get('return_base64', False)
        
        if not qr_data:
            return jsonify({'error': 'data is required'}), 400
        
        if return_base64:
            qr_base64 = barcode_service.generate_qr_base64(qr_data, size)
            return jsonify({
                'qr_code': qr_base64,
                'format': 'base64'
            })
        else:
            qr_bytes = barcode_service.generate_qr_code(qr_data, size)
            return send_file(
                io.BytesIO(qr_bytes),
                mimetype='image/png',
                as_attachment=False,
                download_name='qr_code.png'
            )
            
    except Exception as e:
        logger.error(f"Error in generate_qr: {str(e)}")
        return jsonify({'error': str(e)}), 500

@barcode_generator_bp.route('/generate-qr', methods=['POST'])
def generate_qr_code():
    """Generate QR code for booking (frontend compatible)"""
    try:
        data = request.json
        booking_id = data.get('booking_id')
        booking_url = data.get('booking_url')
        
        if not booking_id:
            return jsonify({'error': 'booking_id is required'}), 400
        
        qr_data = booking_url or f"https://kyogong.com/booking/{booking_id}"
        qr_bytes = barcode_service.generate_qr_code(qr_data, 300)
        qr_b64 = base64.b64encode(qr_bytes).decode('utf-8')
        
        return jsonify({
            'qr_code': qr_b64,
            'format': 'image/png',
            'booking_id': booking_id
        })
        
    except Exception as e:
        logger.error(f"Error in generate_qr_code: {str(e)}")
        return jsonify({'error': str(e)}), 500

@barcode_generator_bp.route('/generate-card', methods=['POST'])
def generate_booking_card_route():
    """Generate complete booking card with barcode"""
    try:
        booking_data = request.json
        
        if not booking_data or not booking_data.get('booking_id'):
            return jsonify({'error': 'booking_data with booking_id is required'}), 400
        
        card_bytes = barcode_service.generate_booking_card(booking_data)
        card_b64 = base64.b64encode(card_bytes).decode('utf-8')
        
        return jsonify({
            'booking_card': card_b64,
            'format': 'image/png',
            'booking_id': booking_data.get('booking_id')
        })
        
    except Exception as e:
        logger.error(f"Error in generate_booking_card: {str(e)}")
        return jsonify({'error': str(e)}), 500

@barcode_generator_bp.route('/formats', methods=['GET'])
def get_supported_formats():
    """Get list of supported barcode formats"""
    return jsonify({
        'formats': barcode_service.supported_formats,
        'default': 'code128'
    })
