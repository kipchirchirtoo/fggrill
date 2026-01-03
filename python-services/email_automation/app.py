from flask import Flask, request, jsonify
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
from jinja2 import Template

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Email configuration
SMTP_HOST = os.getenv('SMTP_HOST', 'smtp-relay.brevo.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
SMTP_USER = os.getenv('SMTP_USER', '96a507001@smtp-brevo.com')
SMTP_PASS = os.getenv('SMTP_PASS', 'xsmtpsib-38bcbdb899aab096feabd5c17c1e566d5c057251501891a77b64bc74ba87ad06-XPa8Pw5mp819KU2E')
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

class EmailAutomationService:
    def __init__(self):
        self.init_database()
        self.email_templates = self.load_email_templates()
        
    def init_database(self):
        """Initialize SQLite database for email scheduling"""
        self.conn = sqlite3.connect('email_schedule.db', check_same_thread=False)
        self.conn.execute('''
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
        self.conn.commit()
    
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
                    .logo { width: 60px; height: 60px; margin: 0 auto 15px; background: white; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
                    .content { padding: 30px 20px; }
                    .booking-id-section { background: #F2F2F7; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0; border: 2px solid #E5E5EA; }
                    .booking-details { background: #FAFAFA; padding: 20px; margin: 20px 0; border-radius: 12px; border: 1px solid #E5E5EA; }
                    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E5E5EA; }
                    .detail-row:last-child { border-bottom: none; }
                    .detail-label { color: #8E8E93; font-weight: 500; }
                    .detail-value { color: #3C3C43; font-weight: 600; }
                    .total-row { background: #3C3C43; color: white; padding: 15px; border-radius: 8px; margin: 10px 0; }
                    .action-buttons { text-align: center; margin: 30px 0; }
                    .btn { display: inline-block; padding: 12px 24px; margin: 8px; text-decoration: none; border-radius: 8px; font-weight: 600; }
                    .btn-primary { background: #3C3C43; color: white; }
                    .btn-secondary { background: #F2F2F7; color: #3C3C43; border: 1px solid #E5E5EA; }
                    .barcode-section { text-align: center; margin: 30px 0; padding: 20px; background: #FAFAFA; border-radius: 12px; }
                    .footer { background: #F2F2F7; padding: 20px; text-align: center; color: #8E8E93; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">
                            <img src="data:image/png;base64,{{ logo_base64 }}" alt="FG Grill Hotel" style="width: 40px; height: 40px;" />
                        </div>
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
                                <span class="detail-label">Nights</span>
                                <span class="detail-value">{{ booking.nights }} night(s)</span>
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
                            <div class="detail-row">
                                <span class="detail-label">Room Rate (per night)</span>
                                <span class="detail-value">KES {{ booking.room_rate | default('8,500') }}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Subtotal</span>
                                <span class="detail-value">KES {{ booking.subtotal | default('17,000') }}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Taxes (16% VAT)</span>
                                <span class="detail-value">KES {{ booking.tax_amount | default('2,720') }}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Service Charge (10%)</span>
                                <span class="detail-value">KES {{ booking.service_charge | default('1,700') }}</span>
                            </div>
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

                        {% if booking.special_requests %}
                        <div class="booking-details">
                            <h3 style="margin: 0 0 15px 0; color: #3C3C43; font-size: 16px;">📝 Special Requests</h3>
                            <p style="margin: 0; padding: 15px; background: #F8F9FA; border-radius: 8px; color: #6B7280;">{{ booking.special_requests }}</p>
                            <p style="margin: 10px 0 0 0; font-size: 12px; color: #8E8E93;">*Subject to availability</p>
                        </div>
                        {% endif %}

                        <div class="barcode-section">
                            <h3 style="margin: 0 0 15px 0; color: #3C3C43; font-size: 16px;">📱 Your Booking Barcode</h3>
                            <img src="http://localhost:5003/barcode-image/{{ booking.confirmation_number }}?format=code128&include_text=true" alt="Booking Barcode" style="max-width: 200px; height: auto;" />
                            <p style="margin: 10px 0 0 0; font-size: 12px; color: #8E8E93;">Show this barcode at check-in</p>
                        </div>

                        <div class="booking-details">
                            <h3 style="margin: 0 0 15px 0; color: #3C3C43; font-size: 16px;">🏨 Hotel Information</h3>
                            <div class="detail-row">
                                <span class="detail-label">Address</span>
                                <span class="detail-value">123 Hotel Street, Nairobi, Kenya</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Phone</span>
                                <span class="detail-value">+254 XXX XXX XXX</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Email</span>
                                <span class="detail-value">info@fggrillhotel.com</span>
                            </div>
                        </div>

                        <div class="booking-details">
                            <h3 style="margin: 0 0 15px 0; color: #3C3C43; font-size: 16px;">📋 Important Information</h3>
                            <ul style="margin: 0; padding-left: 20px; color: #6B7280;">
                                <li>Check-in: 3:00 PM onwards</li>
                                <li>Check-out: 11:00 AM</li>
                                <li>Please bring valid ID and credit card</li>
                                <li>Free cancellation up to 24 hours before arrival</li>
                                <li>Complimentary WiFi and parking</li>
                            </ul>
                        </div>

                        <div class="action-buttons">
                            <a href="https://fggrillhotel.com/booking/{{ booking.confirmation_number }}" class="btn btn-primary">View Booking Details</a>
                            <a href="https://fggrillhotel.com/booking/{{ booking.confirmation_number }}/modify" class="btn btn-secondary">Modify Booking</a>
                            <a href="#" class="btn btn-secondary">Add to Calendar</a>
                        </div>

                        <div style="background: linear-gradient(135deg, #3C3C43 0%, #000000 100%); color: white; padding: 25px; border-radius: 12px; text-align: center; margin: 30px 0;">
                            <h3 style="margin: 0 0 10px 0; font-size: 20px;">🌟 We're Ready to Welcome You!</h3>
                            <p style="margin: 0; opacity: 0.9;">Our team is preparing for your arrival. We can't wait to make your stay exceptional!</p>
                        </div>

                        <div class="booking-details">
                            <h3 style="margin: 0 0 15px 0; color: #3C3C43; font-size: 16px;">📅 What's Next?</h3>
                            <ul style="margin: 0; padding-left: 20px; color: #6B7280;">
                                <li>We'll send you a reminder 48 hours before check-in</li>
                                <li>Download our mobile app for mobile check-in</li>
                                <li>Complete your pre-check-in form (link will be sent separately)</li>
                                <li>Contact us for any special arrangements or questions</li>
                            </ul>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p style="margin: 0 0 10px 0;">FG Grill Hotel | 123 Hotel Street, Nairobi, Kenya</p>
                        <p style="margin: 0;">Phone: +254 XXX XXX XXX | Email: info@fggrillhotel.com</p>
                    </div>
                </div>
            </body>
            </html>
            ''',
            
            'pre_arrival': '''
            <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #3C3C43; color: white; padding: 20px; text-align: center;">
                    <h1>🌟 Your Stay is Almost Here!</h1>
                    <p>Booking ID: {{ booking.confirmation_number }}</p>
                </div>
                <div style="padding: 20px;">
                    <p>Dear {{ booking.guest_name }},</p>
                    <p>We're excited to welcome you to FG Grill Hotel in just 7 days!</p>
                    
                    <div style="background: white; padding: 15px; margin: 15px 0; border-radius: 5px; border: 1px solid #ddd;">
                        <h3>📅 Your Reservation Reminder</h3>
                        <p><strong>Check-in:</strong> {{ booking.check_in_formatted }}</p>
                        <p><strong>Room:</strong> {{ booking.room_type }}</p>
                        <p><strong>Guests:</strong> {{ booking.adults }} Adults{% if booking.children %}, {{ booking.children }} Children{% endif %}</p>
                    </div>

                    <div style="background: white; padding: 15px; margin: 15px 0; border-radius: 5px; border: 1px solid #ddd;">
                        <h3>🌤️ Weather Forecast</h3>
                        <p>Expect pleasant weather with temperatures around 22-28°C. Perfect for exploring!</p>
                    </div>

                    <div style="background: white; padding: 15px; margin: 15px 0; border-radius: 5px; border: 1px solid #ddd;">
                        <h3>🎯 Local Attractions</h3>
                        <ul>
                            <li>Nairobi National Park - 15 minutes away</li>
                            <li>Karen Blixen Museum - 20 minutes away</li>
                            <li>Giraffe Centre - 25 minutes away</li>
                        </ul>
                    </div>
                </div>
            </body>
            </html>
            ''',
            
            'check_in_reminder': '''
            <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #3C3C43; color: white; padding: 20px; text-align: center;">
                    <h1>⏰ Check-in Reminder</h1>
                    <p>Booking ID: {{ booking.confirmation_number }}</p>
                </div>
                <div style="padding: 20px;">
                    <p>Dear {{ booking.guest_name }},</p>
                    <p>Your stay at FG Grill Hotel begins in 48 hours!</p>
                    
                    <div style="background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <h3>📋 What to Bring</h3>
                        <ul>
                            <li>Valid photo ID</li>
                            <li>Credit card for incidentals</li>
                            <li>Confirmation email (this one!)</li>
                        </ul>
                    </div>

                    <div style="text-align: center; margin: 20px 0;">
                        <a href="#" style="background: #3C3C43; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Mobile Check-in</a>
                    </div>
                </div>
            </body>
            </html>
            ''',
            
            'day_of_welcome': '''
            <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #3C3C43 0%, #000000 100%); color: white; padding: 20px; text-align: center;">
                    <h1>🎉 Welcome Day is Here!</h1>
                </div>
                <div style="padding: 20px;">
                    <p>Dear {{ booking.guest_name }},</p>
                    <p>Welcome to your check-in day! We're ready for you at FG Grill Hotel.</p>
                    
                    <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; text-align: center;">
                        <h3>✅ Your Room is Being Prepared</h3>
                        <p>Estimated ready time: 2:30 PM</p>
                    </div>
                </div>
            </body>
            </html>
            ''',
            
            'mid_stay_checkin': '''
            <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #3C3C43; color: white; padding: 20px; text-align: center;">
                    <h1>😊 How is Everything?</h1>
                </div>
                <div style="padding: 20px;">
                    <p>Dear {{ booking.guest_name }},</p>
                    <p>We hope you're enjoying your stay! Is there anything we can do to make it even better?</p>
                    
                    <div style="text-align: center; margin: 20px 0;">
                        <a href="#" style="background: #3C3C43; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 5px;">Quick Survey</a>
                        <a href="#" style="background: #F2F2F7; color: #3C3C43; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 5px; border: 1px solid #3C3C43;">Need Assistance</a>
                    </div>
                </div>
            </body>
            </html>
            ''',
            
            'pre_departure': '''
            <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #3C3C43; color: white; padding: 20px; text-align: center;">
                    <h1>📦 Check-out Tomorrow</h1>
                </div>
                <div style="padding: 20px;">
                    <p>Dear {{ booking.guest_name }},</p>
                    <p>Thank you for staying with us! Check-out is tomorrow by 11:00 AM.</p>
                    
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <h3>Express Check-out Options</h3>
                        <ul>
                            <li>Leave key card in room</li>
                            <li>Use mobile check-out</li>
                            <li>Visit front desk</li>
                        </ul>
                    </div>
                </div>
            </body>
            </html>
            ''',
            
            'post_stay_thankyou': '''
            <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #3C3C43 0%, #000000 100%); color: white; padding: 20px; text-align: center;">
                    <h1>🙏 Thank You!</h1>
                </div>
                <div style="padding: 20px;">
                    <p>Dear {{ booking.guest_name }},</p>
                    <p>Thank you for choosing FG Grill Hotel! We hope you had a wonderful stay.</p>
                    
                    <div style="text-align: center; margin: 20px 0;">
                        <a href="#" style="background: #3C3C43; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 5px;">Leave a Review</a>
                        <a href="#" style="background: #F2F2F7; color: #3C3C43; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 5px; border: 1px solid #3C3C43;">Book Again (10% Off)</a>
                    </div>
                </div>
            </body>
            </html>
            ''',
            
            'review_reminder': '''
            <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #3C3C43; color: white; padding: 20px; text-align: center;">
                    <h1>⭐ Share Your Experience</h1>
                </div>
                <div style="padding: 20px;">
                    <p>Dear {{ booking.guest_name }},</p>
                    <p>We'd love to hear about your recent stay at FG Grill Hotel!</p>
                    
                    <div style="text-align: center; margin: 20px 0;">
                        <a href="#" style="background: #3C3C43; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Leave Review</a>
                    </div>
                </div>
            </body>
            </html>
            '''
        }
    
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
                },
                {
                    'type': 'day_of_welcome',
                    'days_offset': 0,
                    'relative_to': 'check_in',
                    'subject': f"Welcome Day is Here! - Booking {booking_data['confirmation_number']}"
                },
                {
                    'type': 'mid_stay_checkin',
                    'days_offset': 1,
                    'relative_to': 'check_in',
                    'subject': f"How is Everything? - FG Grill Hotel"
                },
                {
                    'type': 'pre_departure',
                    'days_offset': -1,
                    'relative_to': 'check_out',
                    'subject': f"Check-out Tomorrow - Booking {booking_data['confirmation_number']}"
                },
                {
                    'type': 'post_stay_thankyou',
                    'days_offset': 1,
                    'relative_to': 'check_out',
                    'subject': f"Thank You for Staying with Us!"
                },
                {
                    'type': 'review_reminder',
                    'days_offset': 3,
                    'relative_to': 'check_out',
                    'subject': f"Share Your Experience - FG Grill Hotel"
                }
            ]
            
            for email_config in email_schedule:
                if email_config['relative_to'] == 'check_in':
                    send_date = check_in_date + timedelta(days=email_config['days_offset'])
                else:
                    send_date = check_out_date + timedelta(days=email_config['days_offset'])
                
                # Only schedule future emails
                if send_date > datetime.now():
                    self.conn.execute('''
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
            
            self.conn.commit()
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
    
    def process_scheduled_emails(self):
        """Process and send scheduled emails"""
        try:
            cursor = self.conn.execute('''
                SELECT id, booking_id, email_type, recipient_email, send_date, booking_data
                FROM email_schedule 
                WHERE status = 'pending' AND send_date <= ?
            ''', (datetime.now().isoformat(),))
            
            pending_emails = cursor.fetchall()
            
            for email_record in pending_emails:
                email_id, booking_id, email_type, recipient_email, send_date, booking_data_json = email_record
                
                try:
                    booking_data = json.loads(booking_data_json)
                    
                    # Format booking data for template
                    formatted_booking = {
                        **booking_data,
                        'check_in_formatted': datetime.fromisoformat(booking_data['check_in'].replace('Z', '+00:00')).strftime('%B %d, %Y'),
                        'check_out_formatted': datetime.fromisoformat(booking_data['check_out'].replace('Z', '+00:00')).strftime('%B %d, %Y')
                    }
                    
                    # Render email template
                    template = Template(self.email_templates[email_type])
                    html_content = template.render(booking=formatted_booking)
                    
                    # Send email
                    if self.send_email(recipient_email, booking_data['subject'], html_content):
                        # Mark as sent
                        self.conn.execute('''
                            UPDATE email_schedule 
                            SET status = 'sent', sent_at = ?
                            WHERE id = ?
                        ''', (datetime.now().isoformat(), email_id))
                        self.conn.commit()
                        logger.info(f"Processed email {email_type} for booking {booking_id}")
                    else:
                        # Mark as failed
                        self.conn.execute('''
                            UPDATE email_schedule 
                            SET status = 'failed'
                            WHERE id = ?
                        ''', (email_id,))
                        self.conn.commit()
                        
                except Exception as e:
                    logger.error(f"Error processing email {email_id}: {str(e)}")
                    self.conn.execute('''
                        UPDATE email_schedule 
                        SET status = 'failed'
                        WHERE id = ?
                    ''', (email_id,))
                    self.conn.commit()
                    
        except Exception as e:
            logger.error(f"Error in process_scheduled_emails: {str(e)}")

# Initialize service
email_service = EmailAutomationService()

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'service': 'email_automation'})

@app.route('/schedule-booking-emails', methods=['POST'])
def schedule_booking_emails():
    """Schedule email sequence for a new booking"""
    try:
        booking_data = request.json
        
        if not booking_data or not all(k in booking_data for k in ['id', 'confirmation_number', 'guest_email', 'check_in', 'check_out']):
            return jsonify({'error': 'Missing required booking data'}), 400
        
        success = email_service.schedule_booking_emails(booking_data)
        
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
        
        # Render template
        template = Template(email_service.email_templates.get(data['template_type'], ''))
        html_content = template.render(booking=data['booking_data'])
        
        # Send email
        success = email_service.send_email(data['to_email'], data['subject'], html_content)
        
        if success:
            return jsonify({'message': 'Email sent successfully'})
        else:
            return jsonify({'error': 'Failed to send email'}), 500
            
    except Exception as e:
        logger.error(f"Error in send_immediate_email: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/email-status/<booking_id>', methods=['GET'])
def get_email_status(booking_id):
    """Get email status for a booking"""
    try:
        cursor = email_service.conn.execute('''
            SELECT email_type, status, send_date, sent_at
            FROM email_schedule 
            WHERE booking_id = ?
            ORDER BY send_date
        ''', (booking_id,))
        
        emails = []
        for row in cursor.fetchall():
            emails.append({
                'type': row[0],
                'status': row[1],
                'scheduled_date': row[2],
                'sent_date': row[3]
            })
        
        return jsonify({'emails': emails})
        
    except Exception as e:
        logger.error(f"Error getting email status: {str(e)}")
        return jsonify({'error': str(e)}), 500

def run_scheduler():
    """Run the email scheduler in a separate thread"""
    schedule.every(1).minutes.do(email_service.process_scheduled_emails)
    
    while True:
        schedule.run_pending()
        time.sleep(60)

if __name__ == '__main__':
    # Start scheduler in background thread
    scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
    scheduler_thread.start()
    
    logger.info("Email Automation Service starting...")
    app.run(host='0.0.0.0', port=5001, debug=False)
