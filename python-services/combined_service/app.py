from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
import schedule
import time
import threading
import os
import logging
from typing import Dict, List
import json
import sqlite3
from dataclasses import dataclass
from jinja2 import Template, Environment, FileSystemLoader
import uuid
import barcode
from barcode.writer import ImageWriter
import io
import base64
from PIL import Image, ImageDraw, ImageFont
import qrcode

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Email configuration
SMTP_HOST = os.getenv('SMTP_HOST', 'smtp-relay.brevo.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
SMTP_USER = os.getenv('SMTP_USER', '96a507001@smtp-brevo.com')
SMTP_PASS = os.getenv('SMTP_PASS', '')
SMTP_FROM_NAME = os.getenv('SMTP_FROM_NAME', 'FG Grill Hotel')
SMTP_FROM_EMAIL = os.getenv('SMTP_FROM_EMAIL', '96a507001@smtp-brevo.com')

@dataclass
class EmailSchedule:
    booking_id: str
    email_type: str
    recipient_email: str
    send_date: datetime
    booking_data: Dict
    status: str = 'pending'

class CombinedMicroservice:
    def __init__(self):
        self.init_databases()
        self.email_templates = self.load_email_templates()
        self.jinja_env = Environment(loader=FileSystemLoader('templates'))
        
    def init_databases(self):
        """Initialize SQLite databases for email scheduling and templates"""
        # Email scheduling database
        self.email_conn = sqlite3.connect('email_schedule.db', check_same_thread=False)
        self.email_conn.execute('''
            CREATE TABLE IF NOT EXISTS email_schedule (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                booking_id TEXT NOT NULL,
                email_type TEXT NOT NULL,
                recipient_email TEXT NOT NULL,
                send_date TEXT NOT NULL,
                booking_data TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                sent_at TEXT NULL
            )
        ''')
        self.email_conn.commit()
        
        # Template database
        self.template_conn = sqlite3.connect('templates.db', check_same_thread=False)
        self.template_conn.execute('''
            CREATE TABLE IF NOT EXISTS templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                template_content TEXT NOT NULL,
                variables TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        self.template_conn.commit()
    
    def load_email_templates(self) -> Dict[str, str]:
        """Load email templates with minimal light theme and FG Grill branding"""
        return {
            'booking_confirmation': '''
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Booking Confirmed - FG Grill Hotel - {{ booking.confirmation_number }}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #3C3C43; margin: 0; padding: 0; background: #FAFAFA; }
                    .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; }
                    .header { background: #3C3C43; color: white; padding: 30px 20px; text-align: center; }
                    .content { padding: 30px 20px; }
                    .booking-id-section { background: #F2F2F7; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0; border: 2px solid #E5E5EA; }
                    .booking-details { background: #FAFAFA; padding: 20px; margin: 20px 0; border-radius: 12px; border: 1px solid #E5E5EA; }
                    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E5E5EA; }
                    .detail-row:last-child { border-bottom: none; }
                    .detail-label { color: #8E8E93; font-weight: 500; }
                    .detail-value { color: #3C3C43; font-weight: 600; }
                    .total-row { background: #3C3C43; color: white; padding: 15px; border-radius: 8px; margin: 10px 0; }
                    .barcode-section { text-align: center; margin: 30px 0; padding: 20px; background: #FAFAFA; border-radius: 12px; }
                    .footer { background: #F2F2F7; padding: 20px; text-align: center; color: #8E8E93; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin: 0; font-size: 24px; font-weight: 700;">FG GRILL HOTEL</h1>
                        <div style="background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 20px; display: inline-block; margin-top: 10px;">
                            ✅ BOOKING CONFIRMED
                        </div>
                    </div>
                    
                    <div class="content">
                        <div class="booking-id-section">
                            <h2 style="margin: 0 0 10px 0; color: #3C3C43; font-size: 18px;">Booking Confirmation</h2>
                            <div style="font-size: 24px; font-weight: 700; color: #3C3C43; font-family: 'Courier New', monospace;">{{ booking.confirmation_number }}</div>
                            <p style="margin: 10px 0 0 0; color: #8E8E93; font-size: 14px;">Please save this confirmation number</p>
                        </div>

                        <p style="font-size: 16px; margin-bottom: 25px;">Dear {{ booking.guest_name }},</p>
                        <p style="color: #8E8E93; margin-bottom: 25px;">Thank you for choosing FG Grill Hotel. Your booking has been confirmed and we're excited to welcome you!</p>
                        
                        <div class="booking-details">
                            <h3 style="margin: 0 0 15px 0; color: #3C3C43; font-size: 16px;">📅 Reservation Details</h3>
                            <div class="detail-row">
                                <span class="detail-label">Check-in</span>
                                <span class="detail-value">{{ booking.check_in_formatted }} at 3:00 PM</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Check-out</span>
                                <span class="detail-value">{{ booking.check_out_formatted }} by 11:00 AM</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Room Type</span>
                                <span class="detail-value">{{ booking.room_type }}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Guests</span>
                                <span class="detail-value">{{ booking.adults }} Adults{% if booking.children %}, {{ booking.children }} Children{% endif %}</span>
                            </div>
                        </div>

                        <div class="booking-details">
                            <h3 style="margin: 0 0 15px 0; color: #3C3C43; font-size: 16px;">💰 Payment Summary</h3>
                            <div class="total-row">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-size: 18px;">Total Amount</span>
                                    <span style="font-size: 24px; font-weight: 700;">KES {{ booking.total_amount | default('21,420') }}</span>
                                </div>
                            </div>
                            <div style="text-align: center; margin-top: 15px; padding: 10px; background: rgba(34, 197, 94, 0.1); border-radius: 8px; color: #059669;">
                                ✅ Payment Status: CONFIRMED
                            </div>
                        </div>

                        <div class="barcode-section">
                            <h3 style="margin: 0 0 15px 0; color: #3C3C43; font-size: 16px;">📱 Your Booking Barcode</h3>
                            <img src="http://localhost:5001/barcode-image/{{ booking.confirmation_number }}?format=code128&include_text=true" alt="Booking Barcode" style="max-width: 200px; height: auto;" />
                            <p style="margin: 10px 0 0 0; font-size: 12px; color: #8E8E93;">Show this barcode at check-in</p>
                        </div>

                        <div style="background: linear-gradient(135deg, #3C3C43 0%, #000000 100%); color: white; padding: 25px; border-radius: 12px; text-align: center; margin: 30px 0;">
                            <h3 style="margin: 0 0 10px 0; font-size: 20px;">🌟 We're Ready to Welcome You!</h3>
                            <p style="margin: 0; opacity: 0.9;">Our team is preparing for your arrival. We can't wait to make your stay exceptional!</p>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p style="margin: 0 0 10px 0;">FG Grill Hotel | 123 Hotel Street, Nairobi, Kenya</p>
                        <p style="margin: 0;">Phone: +254 XXX XXX XXX | Email: info@fggrillhotel.com</p>
                    </div>
                </div>
            </body>
            </html>
            '''
        }
    
    # EMAIL AUTOMATION METHODS
    def schedule_booking_emails(self, booking_data: Dict) -> bool:
        """Schedule all emails for a booking"""
        try:
            check_in_date = datetime.fromisoformat(booking_data['check_in'].replace('Z', '+00:00'))
            check_out_date = datetime.fromisoformat(booking_data['check_out'].replace('Z', '+00:00'))
            
            email_schedule = [
                {
                    'type': 'pre_arrival',
                    'days_offset': -7,
                    'relative_to': 'check_in',
                    'subject': f"Your Stay is Almost Here! - Booking {booking_data['confirmation_number']}"
                },
                {
                    'type': 'check_in_reminder',
                    'days_offset': -2,
                    'relative_to': 'check_in',
                    'subject': f"Check-in Reminder - Booking {booking_data['confirmation_number']}"
                }
            ]
            
            for email_config in email_schedule:
                if email_config['relative_to'] == 'check_in':
                    send_date = check_in_date + timedelta(days=email_config['days_offset'])
                else:
                    send_date = check_out_date + timedelta(days=email_config['days_offset'])
                
                if send_date > datetime.now():
                    self.email_conn.execute('''
                        INSERT INTO email_schedule 
                        (booking_id, email_type, recipient_email, send_date, booking_data)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (
                        booking_data['id'],
                        email_config['type'],
                        booking_data['guest_email'],
                        send_date.isoformat(),
                        json.dumps({**booking_data, 'subject': email_config['subject']})
                    ))
            
            self.email_conn.commit()
            logger.info(f"Scheduled emails for booking {booking_data['confirmation_number']}")
            return True
            
        except Exception as e:
            logger.error(f"Error scheduling emails: {str(e)}")
            return False
    
    def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """Send email using SMTP"""
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
            msg['To'] = to_email
            
            html_part = MIMEText(html_content, 'html')
            msg.attach(html_part)
            
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASS)
                server.send_message(msg)
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Error sending email to {to_email}: {str(e)}")
            return False
    
    # TEMPLATE GENERATOR METHODS
    def save_template(self, template_id, name, category, content, variables):
        try:
            self.template_conn.execute('''
                INSERT OR REPLACE INTO templates 
                (id, name, category, template_content, variables)
                VALUES (?, ?, ?, ?, ?)
            ''', (template_id, name, category, content, json.dumps(variables)))
            self.template_conn.commit()
            return True
        except Exception as e:
            logger.error(f"Error saving template: {e}")
            return False
    
    def get_template(self, template_id):
        cursor = self.template_conn.execute(
            'SELECT * FROM templates WHERE id = ?', (template_id,)
        )
        return cursor.fetchone()
    
    def render_template(self, template_id, data):
        template_row = self.get_template(template_id)
        if not template_row:
            return None
        
        template = Template(template_row[3])  # template_content
        return template.render(**data)
    
    # BARCODE GENERATOR METHODS
    def generate_barcode(self, booking_id: str, format_type: str = 'code128', include_text: bool = True) -> bytes:
        """Generate barcode for booking ID"""
        try:
            clean_id = booking_id.replace('-', '').replace('HTL', '')
            
            barcode_class = barcode.get_barcode_class(format_type)
            code = barcode_class(clean_id, writer=ImageWriter())
            
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
    
    def generate_qr_code(self, booking_id: str, booking_url: str = None) -> bytes:
        """Generate QR code for booking lookup"""
        try:
            qr_data = booking_url or f"https://fggrillhotel.com/booking/{booking_id}"
            
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(qr_data)
            qr.make(fit=True)
            
            qr_img = qr.make_image(fill_color="black", back_color="white")
            
            buffer = io.BytesIO()
            qr_img.save(buffer, format='PNG')
            buffer.seek(0)
            
            return buffer.getvalue()
            
        except Exception as e:
            logger.error(f"Error generating QR code: {str(e)}")
            raise

# Initialize service
combined_service = CombinedMicroservice()

# HEALTH CHECK
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy', 
        'services': ['email_automation', 'template_generator', 'barcode_generator'],
        'port': 5001
    })

# EMAIL AUTOMATION ENDPOINTS
@app.route('/schedule-booking-emails', methods=['POST'])
def schedule_booking_emails():
    """Schedule email sequence for a new booking"""
    try:
        booking_data = request.json
        
        if not booking_data or not all(k in booking_data for k in ['id', 'confirmation_number', 'guest_email', 'check_in', 'check_out']):
            return jsonify({'error': 'Missing required booking data'}), 400
        
        success = combined_service.schedule_booking_emails(booking_data)
        
        if success:
            return jsonify({'message': 'Email sequence scheduled successfully'})
        else:
            return jsonify({'error': 'Failed to schedule emails'}), 500
            
    except Exception as e:
        logger.error(f"Error in schedule_booking_emails: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/send-immediate-email', methods=['POST'])
def send_immediate_email():
    """Send an immediate email"""
    try:
        data = request.json
        
        if not data or not all(k in data for k in ['to_email', 'subject', 'template_type', 'booking_data']):
            return jsonify({'error': 'Missing required email data'}), 400
        
        template = Template(combined_service.email_templates.get(data['template_type'], ''))
        html_content = template.render(booking=data['booking_data'])
        
        success = combined_service.send_email(data['to_email'], data['subject'], html_content)
        
        if success:
            return jsonify({'message': 'Email sent successfully'})
        else:
            return jsonify({'error': 'Failed to send email'}), 500
            
    except Exception as e:
        logger.error(f"Error in send_immediate_email: {str(e)}")
        return jsonify({'error': str(e)}), 500

# TEMPLATE GENERATOR ENDPOINTS
@app.route('/templates', methods=['POST'])
def create_template():
    data = request.json
    template_id = data.get('id', str(uuid.uuid4()))
    
    success = combined_service.save_template(
        template_id,
        data['name'],
        data['category'], 
        data['content'],
        data.get('variables', [])
    )
    
    if success:
        return jsonify({'id': template_id})
    return jsonify({'error': 'Failed'}), 500

@app.route('/templates/<template_id>/render', methods=['POST'])
def render_template(template_id):
    data = request.json or {}
    rendered = combined_service.render_template(template_id, data)
    
    if rendered:
        return jsonify({'content': rendered})
    return jsonify({'error': 'Not found'}), 404

# BARCODE GENERATOR ENDPOINTS
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
        
        barcode_bytes = combined_service.generate_barcode(booking_id, format_type, include_text)
        barcode_b64 = base64.b64encode(barcode_bytes).decode('utf-8')
        
        return jsonify({
            'barcode': barcode_b64,
            'format': 'image/png',
            'booking_id': booking_id
        })
        
    except Exception as e:
        logger.error(f"Error in generate_barcode: {str(e)}")
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
        
        qr_bytes = combined_service.generate_qr_code(booking_id, booking_url)
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
        
        barcode_bytes = combined_service.generate_barcode(booking_id, format_type, include_text)
        
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
    logger.info("FG Grill Hotel Combined Microservice starting on port 5001...")
    logger.info("Services: Email Automation, Template Generator, Barcode Generator")
    app.run(host='0.0.0.0', port=5001, debug=False)
