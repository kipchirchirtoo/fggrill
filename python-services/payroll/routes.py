# -*- coding: utf-8 -*-
from flask import Blueprint, request, jsonify, send_file
import os, zipfile, io, shutil, logging
from datetime import datetime
from reports.branded_pdf_generator import BrandedPDFGenerator
from email_automation.routes import email_service
from payroll.payroll_generator import generate_payroll_xlsx, generate_payroll_pdf

payroll_bp = Blueprint('payroll', __name__, url_prefix='/api/payroll')
logger = logging.getLogger(__name__)
pdf_generator = BrandedPDFGenerator()


# ── NEW: XLSX export ──────────────────────────────────────────────────────────
@payroll_bp.route('/generate-xlsx', methods=['POST'])
def generate_xlsx():
    try:
        data = request.json or {}
        if not data.get("employees"):
            logger.warning("generate-xlsx: no employees in payload")
            data["employees"] = []

        xlsx_bytes = generate_payroll_xlsx(data)
        branch_slug = (data.get("branch") or "All").replace(" ", "_")
        period_slug = (data.get("period") or "").replace(" ", "_")
        filename = f"FG_Payroll_{branch_slug}_{period_slug}.xlsx"

        return send_file(
            io.BytesIO(xlsx_bytes),
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name=filename,
        )
    except Exception as e:
        logger.error(f"XLSX generation error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


# ── NEW: PDF export ───────────────────────────────────────────────────────────
@payroll_bp.route('/generate-pdf', methods=['POST'])
def generate_pdf():
    try:
        data = request.json or {}
        if not data.get("employees"):
            logger.warning("generate-pdf: no employees in payload")
            data["employees"] = []

        pdf_bytes = generate_payroll_pdf(data)
        branch_slug = (data.get("branch") or "All").replace(" ", "_")
        period_slug = (data.get("period") or "").replace(" ", "_")
        filename = f"FG_Payroll_{branch_slug}_{period_slug}.pdf"

        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name=filename,
        )
    except Exception as e:
        logger.error(f"PDF generation error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


# ── EXISTING routes (unchanged) ───────────────────────────────────────────────
@payroll_bp.route('/generate-batch-zip', methods=['POST'])
def generate_batch_zip():
    try:
        data = request.json
        payroll_records = data.get('payroll_records', [])
        period = data.get('period', datetime.now().strftime('%B_%Y'))
        if not payroll_records:
            return jsonify({'error': 'No payroll records provided'}), 400
        temp_dir = os.path.join(os.getcwd(), 'temp_payslips', period)
        os.makedirs(temp_dir, exist_ok=True)
        pdf_files = []
        for record in payroll_records:
            try:
                staff_name = record.get('staff', {}).get('name', 'Staff').replace(' ', '_')
                filename   = f"Payslip_{staff_name}_{period}.pdf"
                filepath   = os.path.join(temp_dir, filename)
                pdf_path   = pdf_generator.generate_report('payslip', record, {})
                shutil.copy(pdf_path, filepath)
                if os.path.exists(pdf_path): os.remove(pdf_path)
                pdf_files.append(filepath)
            except Exception as e:
                logger.error(f"Error generating payslip: {e}")
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            for fp in pdf_files:
                zf.write(fp, os.path.basename(fp))
        shutil.rmtree(temp_dir)
        zip_buffer.seek(0)
        return send_file(zip_buffer, mimetype='application/zip', as_attachment=True,
                         download_name=f'Payslips_{period}.zip')
    except Exception as e:
        logger.error(f"Error generating batch zip: {e}")
        return jsonify({'error': str(e)}), 500


@payroll_bp.route('/generate-single-pdf', methods=['POST'])
def generate_single_pdf():
    try:
        record = request.json
        if not record:
            return jsonify({'error': 'No payroll record provided'}), 400
        pdf_path = pdf_generator.generate_report('payslip', record, {})
        if not pdf_path or not os.path.exists(pdf_path):
            return jsonify({'error': 'Failed to generate PDF'}), 500
        with open(pdf_path, 'rb') as f:
            pdf_content = f.read()
        os.remove(pdf_path)
        return pdf_content, 200, {'Content-Type': 'application/pdf'}
    except Exception as e:
        logger.error(f"Error generating single PDF: {e}")
        return jsonify({'error': str(e)}), 500
