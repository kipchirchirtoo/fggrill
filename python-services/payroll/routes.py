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

@payroll_bp.route('/generate-single-pdf', methods=['POST'])
def generate_single_pdf():
    """Generate a single payslip PDF and return the binary data"""
    try:
        record = request.json
        if not record:
            return jsonify({'error': 'No payroll record provided'}), 400

        # Generate PDF (returns path)
        pdf_path = pdf_generator.generate_report('payslip', record, {})
        
        if not pdf_path or not os.path.exists(pdf_path):
            return jsonify({'error': 'Failed to generate PDF'}), 500

        # Read binary data
        with open(pdf_path, 'rb') as f:
            pdf_content = f.read()
        
        # Cleanup the temp file
        os.remove(pdf_path)
        
        return pdf_content, 200, {'Content-Type': 'application/pdf'}

    except Exception as e:
        logger.error(f"Error generating single PDF: {str(e)}")
        return jsonify({'error': str(e)}), 500
