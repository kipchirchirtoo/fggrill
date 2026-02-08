"""
Email Automation Blueprint
Consolidated email automation service for booking confirmations and scheduled emails
"""
from flask import Blueprint, request, jsonify
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

logger = logging.getLogger(__name__)

# Create blueprint
email_automation_bp = Blueprint('email_automation', __name__, url_prefix='/api/email')

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
        self.db_path = os.path.join(os.path.dirname(__file__), 'email_schedule.db')
        self.init_database()
        self.email_templates = self.load_email_templates()
        # Expose SMTP config for other services
        self.SMTP_HOST = SMTP_HOST
        self.SMTP_PORT = SMTP_PORT
        self.SMTP_USER = SMTP_USER
        self.SMTP_PASS = SMTP_PASS
        self.SMTP_FROM_EMAIL = SMTP_FROM_EMAIL
        
    def init_database(self):
        """Initialize SQLite database for email scheduling"""
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
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
        """Load email templates"""
        # Load templates from the original file
        # For brevity, I'll include a simplified version
        return {
            'booking_confirmation': '''
            <!DOCTYPE html>
            <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #3C3C43; color: white; padding: 20px; text-align: center;">
                    <h1>FG GRILL HOTEL</h1>
                    <p>✅ BOOKING CONFIRMED</p>
                </div>
                <div style="padding: 20px;">
                    <h2>Booking Confirmation: {{ booking.confirmation_number }}</h2>
                    <p>Dear {{ booking.guest_name }},</p>
                    <p>Thank you for choosing FG Grill Hotel!</p>
                    <p><strong>Check-in:</strong> {{ booking.check_in_formatted }}</p>
                    <p><strong>Check-out:</strong> {{ booking.check_out_formatted }}</p>
                    <p><strong>Room Type:</strong> {{ booking.room_type }}</p>
                </div>
            </body>
            </html>
            ''',
            'pre_arrival': '<html><body><h1>Your Stay is Almost Here!</h1></body></html>',
            'check_in_reminder': '<html><body><h1>Check-in Reminder</h1></body></html>',
            'day_of_welcome': '<html><body><h1>Welcome Day is Here!</h1></body></html>',
            'mid_stay_checkin': '<html><body><h1>How is Everything?</h1></body></html>',
            'pre_departure': '<html><body><h1>Check-out Tomorrow</h1></body></html>',
            'post_stay_thankyou': '<html><body><h1>Thank You!</h1></body></html>',
            'review_reminder': '<html><body><h1>Share Your Experience</h1></body></html>'
        }
    
    def schedule_booking_emails(self, booking_data: Dict) -> bool:
        """Schedule all emails for a booking"""
        try:
            check_in_date = datetime.fromisoformat(booking_data['check_in'].replace('Z', '+00:00'))
            check_out_date = datetime.fromisoformat(booking_data['check_out'].replace('Z', '+00:00'))
            
            email_schedule = [
                {'type': 'pre_arrival', 'days_offset': -7, 'relative_to': 'check_in', 'subject': f"Your Stay is Almost Here! - Booking {booking_data['confirmation_number']}"},
                {'type': 'check_in_reminder', 'days_offset': -2, 'relative_to': 'check_in', 'subject': f"Check-in Reminder - Booking {booking_data['confirmation_number']}"},
                {'type': 'day_of_welcome', 'days_offset': 0, 'relative_to': 'check_in', 'subject': f"Welcome Day is Here! - Booking {booking_data['confirmation_number']}"},
                {'type': 'mid_stay_checkin', 'days_offset': 1, 'relative_to': 'check_in', 'subject': f"How is Everything? - FG Grill Hotel"},
                {'type': 'pre_departure', 'days_offset': -1, 'relative_to': 'check_out', 'subject': f"Check-out Tomorrow - Booking {booking_data['confirmation_number']}"},
                {'type': 'post_stay_thankyou', 'days_offset': 1, 'relative_to': 'check_out', 'subject': f"Thank You for Staying with Us!"},
                {'type': 'review_reminder', 'days_offset': 3, 'relative_to': 'check_out', 'subject': f"Share Your Experience - FG Grill Hotel"}
            ]
            
            for email_config in email_schedule:
                if email_config['relative_to'] == 'check_in':
                    send_date = check_in_date + timedelta(days=email_config['days_offset'])
                else:
                    send_date = check_out_date + timedelta(days=email_config['days_offset'])
                
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
                    
                    formatted_booking = {
                        **booking_data,
                        'check_in_formatted': datetime.fromisoformat(booking_data['check_in'].replace('Z', '+00:00')).strftime('%B %d, %Y'),
                        'check_out_formatted': datetime.fromisoformat(booking_data['check_out'].replace('Z', '+00:00')).strftime('%B %d, %Y')
                    }
                    
                    template = Template(self.email_templates[email_type])
                    html_content = template.render(booking=formatted_booking)
                    
                    if self.send_email(recipient_email, booking_data['subject'], html_content):
                        self.conn.execute('''
                            UPDATE email_schedule 
                            SET status = 'sent', sent_at = ?
                            WHERE id = ?
                        ''', (datetime.now().isoformat(), email_id))
                        self.conn.commit()
                        logger.info(f"Processed email {email_type} for booking {booking_id}")
                    else:
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

# Routes
@email_automation_bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'service': 'email_automation'})

@email_automation_bp.route('/schedule-booking-emails', methods=['POST'])
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

@email_automation_bp.route('/send-immediate-email', methods=['POST'])
def send_immediate_email():
    """Send an immediate email"""
    try:
        data = request.json
        
        if not data or not all(k in data for k in ['to_email', 'subject', 'template_type', 'booking_data']):
            return jsonify({'error': 'Missing required email data'}), 400
        
        template = Template(email_service.email_templates.get(data['template_type'], ''))
        html_content = template.render(booking=data['booking_data'])
        
        success = email_service.send_email(data['to_email'], data['subject'], html_content)
        
        if success:
            return jsonify({'message': 'Email sent successfully'})
        else:
            return jsonify({'error': 'Failed to send email'}), 500
            
    except Exception as e:
        logger.error(f"Error in send_immediate_email: {str(e)}")
        return jsonify({'error': str(e)}), 500

@email_automation_bp.route('/email-status/<booking_id>', methods=['GET'])
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

def start_email_scheduler():
    """Start the email scheduler in background thread"""
    scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
    scheduler_thread.start()
    logger.info("Email scheduler started")
