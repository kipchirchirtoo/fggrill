from flask import Blueprint, request, jsonify
from communication_hub.service import communication_service
from communication_hub.models import EmailRequest, SMSRequest, BookingConfirmationRequest, CheckInReminderRequest, InvoiceRequest
import os

communication_bp = Blueprint('communication', __name__)

@communication_bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "communication-hub", "version": "1.0.0"}), 200

@communication_bp.route('/email', methods=['POST'])
async def send_email():
    try:
        data = request.get_json()
        # Map data to EmailRequest if needed, or just pass if service handles dict
        from communication_hub.models import EmailRequest
        req = EmailRequest(**data)
        result = await communication_service.send_email(req)
        if not result.success:
            return jsonify(result.dict()), 500
        return jsonify(result.dict()), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@communication_bp.route('/email/booking-confirmation', methods=['POST'])
async def send_booking_confirmation():
    try:
        data = request.get_json()
        from communication_hub.models import BookingConfirmationRequest
        req = BookingConfirmationRequest(**data)
        results = await communication_service.send_booking_confirmation(req)
        return jsonify({
            "success": all(r.success for r in results.values()),
            "results": {k: v.dict() for k, v in results.items()}
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ... Port other routes ...
