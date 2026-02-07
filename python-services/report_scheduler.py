"""
Famous Gate Hotel - Automated Report Scheduler
Generates and distributes reports on schedule
"""

import os
import logging
import schedule
import time
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders
from datetime import datetime, timedelta
from threading import Thread
from typing import List, Dict, Any, Optional
from supabase import create_client, Client

try:
    from reports.branded_pdf_generator import BrandedPDFGenerator
except ImportError:
    class BrandedPDFGenerator: pass

from reports.database_fetcher import DatabaseFetcher
from reports.excel_generator import ExcelReportGenerator

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ReportScheduler:
    """Automated report generation and distribution"""
    
    def __init__(self):
        self.pdf_generator = BrandedPDFGenerator()
        self.excel_generator = ExcelReportGenerator()
        self.data_fetcher = DatabaseFetcher()
        
        # Email configuration
        self.smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', '587'))
        self.smtp_user = os.getenv('SMTP_USER', '')
        self.smtp_password = os.getenv('SMTP_PASSWORD', '')
        self.from_email = os.getenv('FROM_EMAIL', 'reports@famousgate.co.ke')
        
        # Supabase for scheduled reports
        self.supabase_url = os.getenv('SUPABASE_URL', '')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_KEY', '')
        self.supabase: Optional[Client] = None
        
        if self.supabase_url and self.supabase_key:
            self.supabase = create_client(self.supabase_url, self.supabase_key)
        
        # Report output directory
        self.output_dir = os.getenv('REPORT_OUTPUT_DIR', '/tmp/reports')
        os.makedirs(self.output_dir, exist_ok=True)
    
    def generate_report(self, report_type: str, filters: Dict[str, Any], 
                       output_format: str = 'pdf') -> str:
        """Generate a report and return the file path"""
        try:
            # Fetch data
            data = self.data_fetcher.fetch_report_data(report_type, filters)
            
            # Generate report
            if output_format == 'pdf':
                file_path = self.pdf_generator.generate_report(report_type, data, filters)
            else:
                file_path = self.excel_generator.generate_report(report_type, data, filters)
            
            logger.info(f"Generated {report_type} report: {file_path}")
            return file_path
            
        except Exception as e:
            logger.error(f"Error generating report: {e}")
            raise
    
    def send_report_email(self, recipients: List[str], subject: str, 
                         body: str, attachments: List[str]) -> bool:
        """Send report via email"""
        if not self.smtp_user or not self.smtp_password:
            logger.warning("SMTP credentials not configured, skipping email")
            return False
        
        try:
            msg = MIMEMultipart()
            msg['From'] = self.from_email
            msg['To'] = ', '.join(recipients)
            msg['Subject'] = subject
            
            msg.attach(MIMEText(body, 'html'))
            
            # Attach files
            for file_path in attachments:
                if os.path.exists(file_path):
                    with open(file_path, 'rb') as f:
                        part = MIMEBase('application', 'octet-stream')
                        part.set_payload(f.read())
                        encoders.encode_base64(part)
                        
                        filename = os.path.basename(file_path)
                        part.add_header('Content-Disposition', f'attachment; filename="{filename}"')
                        msg.attach(part)
            
            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"Report email sent to {recipients}")
            return True
            
        except Exception as e:
            logger.error(f"Error sending email: {e}")
            return False
    
    def run_scheduled_report(self, schedule_id: str):
        """Execute a scheduled report"""
        if not self.supabase:
            logger.error("Supabase not configured")
            return
        
        try:
            # Fetch schedule details
            result = self.supabase.table('scheduled_reports').select('*')\
                .eq('id', schedule_id).single().execute()
            
            if not result.data:
                logger.error(f"Schedule not found: {schedule_id}")
                return
            
            schedule_data = result.data
            
            if not schedule_data.get('is_active'):
                logger.info(f"Schedule {schedule_id} is inactive, skipping")
                return
            
            report_type = schedule_data.get('report_type')
            parameters = schedule_data.get('parameters', {})
            recipients = schedule_data.get('recipients', [])
            
            # Set date filters based on frequency
            frequency = schedule_data.get('frequency', 'daily')
            today = datetime.now()
            
            if frequency == 'daily':
                parameters['start_date'] = (today - timedelta(days=1)).strftime('%Y-%m-%d')
                parameters['end_date'] = (today - timedelta(days=1)).strftime('%Y-%m-%d')
            elif frequency == 'weekly':
                parameters['start_date'] = (today - timedelta(days=7)).strftime('%Y-%m-%d')
                parameters['end_date'] = (today - timedelta(days=1)).strftime('%Y-%m-%d')
            elif frequency == 'monthly':
                first_of_month = today.replace(day=1)
                last_month_end = first_of_month - timedelta(days=1)
                last_month_start = last_month_end.replace(day=1)
                parameters['start_date'] = last_month_start.strftime('%Y-%m-%d')
                parameters['end_date'] = last_month_end.strftime('%Y-%m-%d')
            
            # Generate report
            file_path = self.generate_report(report_type, parameters, 'pdf')
            
            # Send email if recipients configured
            if recipients:
                subject = f"Famous Gate Hotel - {schedule_data.get('name', report_type.replace('_', ' ').title())}"
                body = f"""
                <html>
                <body style="font-family: Arial, sans-serif; color: #333;">
                    <div style="background: #3C3C43; padding: 20px; text-align: center;">
                        <h1 style="color: white; margin: 0;">Famous Gate Hotel & Lounge</h1>
                    </div>
                    <div style="padding: 20px;">
                        <h2>{schedule_data.get('name', 'Scheduled Report')}</h2>
                        <p>Please find attached your scheduled report.</p>
                        <p><strong>Report Type:</strong> {report_type.replace('_', ' ').title()}</p>
                        <p><strong>Period:</strong> {parameters.get('start_date')} to {parameters.get('end_date')}</p>
                        <p><strong>Generated:</strong> {today.strftime('%B %d, %Y at %I:%M %p')}</p>
                        <hr>
                        <p style="color: #888; font-size: 12px;">
                            This is an automated report from Famous Gate Hotel Management System.
                            <br>For questions, contact management@famousgate.co.ke
                        </p>
                    </div>
                </body>
                </html>
                """
                
                self.send_report_email(recipients, subject, body, [file_path])
            
            # Update last run time
            self.supabase.table('scheduled_reports').update({
                'last_run_at': datetime.now().isoformat(),
                'next_run_at': self._calculate_next_run(frequency, schedule_data.get('schedule_time'))
            }).eq('id', schedule_id).execute()
            
            # Log to reports table
            self.supabase.table('reports').insert({
                'name': schedule_data.get('name'),
                'type': report_type,
                'category': self._get_report_category(report_type),
                'parameters': parameters,
                'status': 'completed',
                'generated_at': datetime.now().isoformat()
            }).execute()
            
            logger.info(f"Scheduled report {schedule_id} completed successfully")
            
        except Exception as e:
            logger.error(f"Error running scheduled report {schedule_id}: {e}")
    
    def _calculate_next_run(self, frequency: str, schedule_time: str) -> str:
        """Calculate next run time based on frequency"""
        now = datetime.now()
        
        try:
            time_parts = schedule_time.split(':')
            hour = int(time_parts[0])
            minute = int(time_parts[1]) if len(time_parts) > 1 else 0
        except:
            hour, minute = 8, 0
        
        if frequency == 'daily':
            next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            if next_run <= now:
                next_run += timedelta(days=1)
        elif frequency == 'weekly':
            next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            days_until_monday = (7 - now.weekday()) % 7
            if days_until_monday == 0 and next_run <= now:
                days_until_monday = 7
            next_run += timedelta(days=days_until_monday)
        elif frequency == 'monthly':
            next_run = now.replace(day=1, hour=hour, minute=minute, second=0, microsecond=0)
            if next_run <= now:
                if now.month == 12:
                    next_run = next_run.replace(year=now.year + 1, month=1)
                else:
                    next_run = next_run.replace(month=now.month + 1)
        else:
            next_run = now + timedelta(days=1)
        
        return next_run.isoformat()
    
    def _get_report_category(self, report_type: str) -> str:
        """Get category for report type"""
        categories = {
            'daily_sales': 'financial',
            'financial_summary': 'financial',
            'revenue_analysis': 'financial',
            'expense': 'financial',
            'payroll_summary': 'financial',
            'occupancy': 'operations',
            'housekeeping': 'operations',
            'maintenance': 'operations',
            'arrivals_departures': 'operations',
            'manager_duty': 'operations',
            'inventory_status': 'inventory',
            'room_supplies': 'inventory',
            'stock_movement': 'inventory',
            'restaurant_sales': 'operations',
            'bar_sales': 'operations',
        }
        return categories.get(report_type, 'other')
    
    def check_and_run_due_reports(self):
        """Check for due scheduled reports and run them"""
        if not self.supabase:
            return
        
        try:
            now = datetime.now().isoformat()
            
            # Find due reports
            result = self.supabase.table('scheduled_reports').select('id')\
                .eq('is_active', True)\
                .lte('next_run_at', now).execute()
            
            for schedule in (result.data or []):
                self.run_scheduled_report(schedule['id'])
                
        except Exception as e:
            logger.error(f"Error checking scheduled reports: {e}")
    
    def setup_default_schedules(self):
        """Setup default report schedules"""
        if not self.supabase:
            return
        
        default_schedules = [
            {
                'name': 'Daily Sales Summary',
                'report_type': 'daily_sales',
                'frequency': 'daily',
                'schedule_time': '08:00',
                'recipients': ['management@famousgate.co.ke'],
                'is_active': True,
                'parameters': {}
            },
            {
                'name': 'Weekly Occupancy Report',
                'report_type': 'occupancy',
                'frequency': 'weekly',
                'schedule_time': '09:00',
                'schedule_day': 1,  # Monday
                'recipients': ['management@famousgate.co.ke'],
                'is_active': True,
                'parameters': {}
            },
            {
                'name': 'Monthly Financial Summary',
                'report_type': 'financial_summary',
                'frequency': 'monthly',
                'schedule_time': '07:00',
                'schedule_day': 1,  # 1st of month
                'recipients': ['finance@famousgate.co.ke', 'management@famousgate.co.ke'],
                'is_active': True,
                'parameters': {}
            },
            {
                'name': 'Daily Inventory Alert',
                'report_type': 'inventory_status',
                'frequency': 'daily',
                'schedule_time': '06:00',
                'recipients': ['store@famousgate.co.ke'],
                'is_active': True,
                'parameters': {}
            }
        ]
        
        for schedule in default_schedules:
            try:
                # Check if exists
                existing = self.supabase.table('scheduled_reports').select('id')\
                    .eq('name', schedule['name']).execute()
                
                if not existing.data:
                    schedule['next_run_at'] = self._calculate_next_run(
                        schedule['frequency'], 
                        schedule['schedule_time']
                    )
                    self.supabase.table('scheduled_reports').insert(schedule).execute()
                    logger.info(f"Created default schedule: {schedule['name']}")
                    
            except Exception as e:
                logger.error(f"Error creating schedule {schedule['name']}: {e}")


class SchedulerDaemon:
    """Background daemon for running scheduled reports"""
    
    def __init__(self):
        self.scheduler = ReportScheduler()
        self.running = False
    
    def start(self):
        """Start the scheduler daemon"""
        self.running = True
        
        # Setup default schedules
        self.scheduler.setup_default_schedules()
        
        # Schedule the check every minute
        schedule.every(1).minutes.do(self.scheduler.check_and_run_due_reports)
        
        logger.info("Report scheduler daemon started")
        
        while self.running:
            schedule.run_pending()
            time.sleep(30)
    
    def stop(self):
        """Stop the scheduler daemon"""
        self.running = False
        logger.info("Report scheduler daemon stopped")
    
    def run_in_background(self):
        """Run scheduler in background thread"""
        thread = Thread(target=self.start, daemon=True)
        thread.start()
        return thread


# Standalone execution
if __name__ == '__main__':
    daemon = SchedulerDaemon()
    try:
        daemon.start()
    except KeyboardInterrupt:
        daemon.stop()
