"""
Receipt API Routes
Handles receipt generation, storage, retrieval, and thermal printing
"""

import os
import uuid
import logging
from datetime import datetime
from flask import Blueprint, request, jsonify, send_file
import io
from .receipt_generator import ReceiptGenerator, InvoiceGenerator, InventoryReceiptGenerator
from .thermal_printer import ThermalPrinter, get_thermal_printer, NetworkPrinterDiscovery

logger = logging.getLogger(__name__)

receipts_bp = Blueprint('receipts', __name__, url_prefix='/api/receipts')

# Initialize generators
LOGO_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'public', 'fglogo.png')
receipt_gen = ReceiptGenerator(LOGO_PATH)
invoice_gen = InvoiceGenerator(LOGO_PATH)
inventory_gen = InventoryReceiptGenerator(LOGO_PATH)

# Thermal printer instance
thermal_printer = None


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
        'logo_exists': os.path.exists(LOGO_PATH),
        'thermal_printer_available': thermal_printer is not None
    })


# ============ THERMAL PRINTER ENDPOINTS ============

@receipts_bp.route('/printer/configure', methods=['POST'])
def configure_printer():
    """Configure thermal printer connection"""
    global thermal_printer
    try:
        data = request.get_json()
        config = {
            'connection_type': data.get('connection_type', 'network'),
            'printer_ip': data.get('printer_ip', os.getenv('THERMAL_PRINTER_IP', '192.168.1.100')),
            'printer_port': data.get('printer_port', os.getenv('THERMAL_PRINTER_PORT', 9100)),
            'usb_vendor': data.get('usb_vendor'),
            'usb_product': data.get('usb_product'),
            'serial_port': data.get('serial_port'),
        }
        
        thermal_printer = ThermalPrinter(config)
        connected = thermal_printer.connect()
        
        return jsonify({
            'success': connected,
            'message': 'Printer configured successfully' if connected else 'Failed to connect to printer',
            'config': config
        })
    except Exception as e:
        logger.error(f"Error configuring printer: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@receipts_bp.route('/printer/print', methods=['POST'])
def print_receipt():
    """Print receipt directly to thermal printer"""
    global thermal_printer
    try:
        data = request.get_json()
        
        # Initialize printer if not configured
        if thermal_printer is None:
            thermal_printer = get_thermal_printer()
        
        # Print the receipt
        result = thermal_printer.print_receipt(data)
        
        if result.get('success'):
            return jsonify({
                'success': True,
                'message': 'Receipt printed successfully',
                'receipt_number': result.get('receipt_number')
            })
        else:
            error_msg = result.get('error', 'Unknown error')
            logger.warning(f"Print failed: {error_msg}")
            return jsonify({
                'success': False,
                'error': error_msg
            }), 500
            
    except Exception as e:
        error_msg = str(e) if str(e) else 'Unknown error occurred during printing'
        logger.error(f"Error printing receipt: {error_msg}", exc_info=True)
        return jsonify({
            'success': False,
            'error': error_msg
        }), 500


@receipts_bp.route('/printer/print-and-generate', methods=['POST'])
def print_and_generate_receipt():
    """Print to thermal printer AND generate PDF receipt"""
    global thermal_printer
    try:
        data = request.get_json()
        
        # Initialize printer if not configured
        if thermal_printer is None:
            thermal_printer = get_thermal_printer()
        
        # Print to thermal printer
        print_result = thermal_printer.print_receipt(data)
        
        # Also generate PDF
        receipt_type = data.get('receipt_type', 'sale')
        if receipt_type in ['sale', 'refund']:
            pdf_bytes = receipt_gen.generate_receipt(data)
        elif receipt_type == 'invoice':
            pdf_bytes = invoice_gen.generate_invoice(data)
        else:
            pdf_bytes = receipt_gen.generate_receipt(data)
        
        import base64
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        return jsonify({
            'success': True,
            'printed': print_result.get('success', False),
            'print_message': print_result.get('message', ''),
            'pdf_base64': pdf_base64,
            'filename': f"receipt_{data.get('receipt_number', datetime.now().strftime('%Y%m%d%H%M%S'))}.pdf"
        })
        
    except Exception as e:
        logger.error(f"Error in print and generate: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@receipts_bp.route('/printer/test', methods=['POST'])
def test_printer():
    """Print a test receipt"""
    global thermal_printer
    try:
        if thermal_printer is None:
            thermal_printer = get_thermal_printer()
        
        result = thermal_printer.test_print()
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error testing printer: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@receipts_bp.route('/printer/discover', methods=['GET'])
def discover_printers():
    """Discover thermal printers on the network"""
    try:
        ip_range = request.args.get('ip_range', '192.168.1')
        port = int(request.args.get('port', 9100))
        
        printers = NetworkPrinterDiscovery.scan_network(ip_range, port)
        
        return jsonify({
            'success': True,
            'printers': printers,
            'count': len(printers)
        })
    except Exception as e:
        logger.error(f"Error discovering printers: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@receipts_bp.route('/printer/status', methods=['GET'])
def printer_status():
    """Get thermal printer status"""
    global thermal_printer
    return jsonify({
        'success': True,
        'configured': thermal_printer is not None,
        'connection_type': thermal_printer.connection_type if thermal_printer else None,
        'settings': thermal_printer.settings if thermal_printer else None
    })
