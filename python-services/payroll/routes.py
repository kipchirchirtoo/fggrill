from flask import Blueprint, request, jsonify, send_file
import os
import zipfile
import io
import shutil
from datetime import datetime
from reports.branded_pdf_generator import BrandedPDFGenerator
from email_automation.routes import email_service
import logging

payroll_bp = Blueprint('payroll', __name__, url_prefix='/api/payroll')
logger = logging.getLogger(__name__)

pdf_generator = BrandedPDFGenerator()

@payroll_bp.route('/generate-batch-zip', methods=['POST'])
def generate_batch_zip():
    """Generate batch payslips and return as ZIP"""
    try:
        data = request.json
        payroll_records = data.get('payroll_records', [])
        period = data.get('period', datetime.now().strftime('%B_%Y'))
        
        if not payroll_records:
            return jsonify({'error': 'No payroll records provided'}), 400

        # Create temporary directory
        temp_dir = os.path.join(os.getcwd(), 'temp_payslips', period)
        os.makedirs(temp_dir, exist_ok=True)
        
        pdf_files = []
        
        for record in payroll_records:
            try:
                # Generate PDF
                staff_name = record.get('staff', {}).get('name', 'Staff').replace(' ', '_')
                filename = f"Payslip_{staff_name}_{period}.pdf"
                filepath = os.path.join(temp_dir, filename)
                
                # Use BrandedPDFGenerator to create PDF
                pdf_path = pdf_generator.generate_report('payslip', record, {})
                
                # Move the generated PDF to our temp directory
                shutil.copy(pdf_path, filepath)
                # Cleanup the original temp file
                if os.path.exists(pdf_path):
                    os.remove(pdf_path)
                    
                pdf_files.append(filepath)
            except Exception as e:
                logger.error(f"Error generating payslip for record {record.get('id')}: {str(e)}")
        
        # Create ZIP file
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for file_path in pdf_files:
                zip_file.write(file_path, os.path.basename(file_path))
                
        # Cleanup
        shutil.rmtree(temp_dir)
        
        zip_buffer.seek(0)
        return send_file(
            zip_buffer,
            mimetype='application/zip',
            as_attachment=True,
            download_name=f'Payslips_{period}.zip'
        )

    except Exception as e:
        logger.error(f"Error generating batch zip: {str(e)}")
        return jsonify({'error': str(e)}), 500

@payroll_bp.route('/email-batch', methods=['POST'])
def email_batch_payslips():
    """Email payslips to staff"""
    try:
        data = request.json
        payroll_records = data.get('payroll_records', [])
        period = data.get('period', datetime.now().strftime('%B %Y'))
        
        results = {'sent': 0, 'failed': 0, 'details': []}
        
        for record in payroll_records:
            staff_email = record.get('staff', {}).get('email')
            staff_name = record.get('staff', {}).get('name')
            
            if not staff_email:
                results['failed'] += 1
                results['details'].append({'name': staff_name, 'error': 'No email address'})
                continue
                
            try:
                # Generate PDF (returns path)
                pdf_path = pdf_generator.generate_report('payslip', record, {})
                
                with open(pdf_path, 'rb') as f:
                    pdf_content = f.read()
                
                # Cleanup the original temp file
                if os.path.exists(pdf_path):
                    os.remove(pdf_path)
                
                # Convert PDF to HTML/Text or Attachment (Email service needs update to handle attachments)
                # For now, we will send a notification that payslip is ready, 
                # OR we need to update email_service to accept attachments.
                # Assuming email_service changes... OR we can use standard smtplib here directly for attachments.
                
                # Let's use direct SMTP with attachment for this specific use case
                # Re-using logic from email_service would be better if refactored.
                # Constructing email with attachment:
                
                import smtplib
                from email.mime.multipart import MIMEMultipart
                from email.mime.text import MIMEText
                from email.mime.application import MIMEApplication
                
                msg = MIMEMultipart()
                msg['Subject'] = f"Payslip for {period} - {staff_name}"
                msg['From'] = email_service.SMTP_FROM_EMAIL # Accessing configured email
                msg['To'] = staff_email
                
                body = f"Dear {staff_name},\n\nPlease find attached your payslip for {period}.\n\nBest regards,\nFG Grill Management"
                msg.attach(MIMEText(body, 'plain'))
                
                # Attachment
                pdf_attachment = MIMEApplication(pdf_content, _subtype="pdf")
                pdf_attachment.add_header('Content-Disposition', 'attachment', filename=f"Payslip_{period}.pdf")
                msg.attach(pdf_attachment)
                
                with smtplib.SMTP(email_service.SMTP_HOST, email_service.SMTP_PORT, timeout=30) as server:
                    server.starttls()
                    server.login(email_service.SMTP_USER, email_service.SMTP_PASS)
                    server.send_message(msg)
                
                results['sent'] += 1
                results['details'].append({'name': staff_name, 'status': 'sent'})
                
            except Exception as e:
                logger.error(f"Error emailing payslip to {staff_name}: {str(e)}")
                results['failed'] += 1
                results['details'].append({'name': staff_name, 'error': str(e)})
        
        return jsonify(results)

    except Exception as e:
        logger.error(f"Error processing email batch: {str(e)}")
        return jsonify({'error': str(e)}), 500
