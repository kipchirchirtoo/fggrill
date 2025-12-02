"""
Receipt API Routes
Handles receipt generation, storage, and retrieval
"""

import os
import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify, send_file
import io
from .receipt_generator import ReceiptGenerator, InvoiceGenerator, InventoryReceiptGenerator

receipts_bp = Blueprint('receipts', __name__, url_prefix='/api/receipts')

# Initialize generators
LOGO_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'public', 'fglogo.png')
receipt_gen = ReceiptGenerator(LOGO_PATH)
invoice_gen = InvoiceGenerator(LOGO_PATH)
inventory_gen = InventoryReceiptGenerator(LOGO_PATH)


@receipts_bp.route('/generate', methods=['POST'])
def generate_receipt():
    """Generate a receipt PDF"""
    try:
        data = request.get_json()
        receipt_type = data.get('receipt_type', 'sale')
        
        if receipt_type in ['sale', 'refund']:
            pdf_bytes = receipt_gen.generate_receipt(data)
        elif receipt_type == 'invoice':
            pdf_bytes = invoice_gen.generate_invoice(data)
        elif receipt_type == 'inventory':
            pdf_bytes = inventory_gen.generate_inventory_receipt(data)
        else:
            pdf_bytes = receipt_gen.generate_receipt(data)
        
        # Return as downloadable PDF
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f"receipt_{data.get('receipt_number', datetime.now().strftime('%Y%m%d%H%M%S'))}.pdf"
        )
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@receipts_bp.route('/generate/base64', methods=['POST'])
def generate_receipt_base64():
    """Generate a receipt and return as base64 for preview"""
    try:
        data = request.get_json()
        receipt_type = data.get('receipt_type', 'sale')
        
        if receipt_type in ['sale', 'refund']:
            pdf_bytes = receipt_gen.generate_receipt(data)
        elif receipt_type == 'invoice':
            pdf_bytes = invoice_gen.generate_invoice(data)
        elif receipt_type == 'inventory':
            pdf_bytes = inventory_gen.generate_inventory_receipt(data)
        else:
            pdf_bytes = receipt_gen.generate_receipt(data)
        
        import base64
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        return jsonify({
            'success': True,
            'data': {
                'pdf_base64': pdf_base64,
                'filename': f"receipt_{data.get('receipt_number', datetime.now().strftime('%Y%m%d%H%M%S'))}.pdf"
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@receipts_bp.route('/preview', methods=['POST'])
def preview_receipt():
    """Generate a receipt PDF for inline viewing"""
    try:
        data = request.get_json()
        receipt_type = data.get('receipt_type', 'sale')
        
        if receipt_type in ['sale', 'refund']:
            pdf_bytes = receipt_gen.generate_receipt(data)
        elif receipt_type == 'invoice':
            pdf_bytes = invoice_gen.generate_invoice(data)
        elif receipt_type == 'inventory':
            pdf_bytes = inventory_gen.generate_inventory_receipt(data)
        else:
            pdf_bytes = receipt_gen.generate_receipt(data)
        
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype='application/pdf',
            as_attachment=False
        )
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@receipts_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'success': True,
        'service': 'receipt-generator',
        'status': 'healthy',
        'logo_exists': os.path.exists(LOGO_PATH)
    })
