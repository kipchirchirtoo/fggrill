from flask import Blueprint, request, jsonify
from pricing_engine.service import PricingService
import os

pricing_bp = Blueprint('pricing', __name__)
pricing_service = PricingService()

@pricing_bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "service": "pricing-engine"}), 200

@pricing_bp.route('/calculate', methods=['POST'])
def calculate_price():
    try:
        data = request.get_json()
        result = pricing_service.calculate_rate(
            data.get('check_in'),
            data.get('check_out'),
            data.get('room_type_id'),
            data.get('guests')
        )
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
