"""
PDF Generation Routes
"""
from flask import Blueprint, request, jsonify, send_file
from .invoice import generate_booking_invoice
import logging

logger = logging.getLogger(__name__)

pdf_generator_bp = Blueprint('pdf_generator', __name__, url_prefix='/api/reports')

@pdf_generator_bp.route('/generate/branded-pdf', methods=['POST'])
def generate_branded_pdf():
    """
    Generate a branded PDF invoice for a booking
    
    Expected JSON body:
    {
        "confirmationNumber": "HTL123456",
        "guestName": "John Doe",
        "email": "john@example.com",
        "phone": "+254 700 000 000",
        "checkInDate": "March 10, 2026",
        "checkOutDate": "March 15, 2026",
        "roomType": "Deluxe Room",
        "guests": 2,
        "totalAmount": 15000
    }
    """
    try:
        booking_data = request.get_json()
        
        if not booking_data:
            return jsonify({'error': 'No booking data provided'}), 400
        
        # Validate required fields
        required_fields = ['confirmationNumber', 'guestName', 'totalAmount']
        missing_fields = [field for field in required_fields if field not in booking_data]
        
        if missing_fields:
            return jsonify({
                'error': 'Missing required fields',
                'missing': missing_fields
            }), 400
        
        logger.info(f"Generating PDF invoice for booking {booking_data.get('confirmationNumber')}")
        
        # Generate PDF
        pdf_buffer = generate_booking_invoice(booking_data)
        
        # Return PDF as attachment
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f"invoice_{booking_data.get('confirmationNumber')}.pdf"
        )
        
    except Exception as e:
        logger.error(f"Error generating PDF: {str(e)}")
        return jsonify({'error': str(e)}), 500
