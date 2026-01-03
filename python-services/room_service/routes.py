from flask import Blueprint, request, jsonify
from room_service.service import room_service
from datetime import date
import os

room_bp = Blueprint('rooms', __name__)

@room_bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "room-service", "version": "1.0.0"}), 200

@room_bp.route('/availability', methods=['GET'])
async def check_availability():
    try:
        check_in = request.args.get('check_in')
        check_out = request.args.get('check_out')
        guests = request.args.get('guests', default=1, type=int)
        room_type_id = request.args.get('room_type_id')
        branch_id = request.args.get('branch_id')

        if not check_in or not check_out:
            return jsonify({"error": "check_in and check_out are required"}), 400

        check_in_date = date.fromisoformat(check_in)
        check_out_date = date.fromisoformat(check_out)

        if check_out_date <= check_in_date:
            return jsonify({"error": "Check-out date must be after check-in date"}), 400
        
        available_rooms = await room_service.check_availability(
            check_in=check_in_date,
            check_out=check_out_date,
            guests=guests,
            room_type_id=room_type_id,
            branch_id=branch_id
        )
        
        nights = (check_out_date - check_in_date).days
        
        # Convert Pydantic models to dict if necessary
        data = [r.dict() if hasattr(r, 'dict') else r for r in available_rooms]
        
        return jsonify({
            "success": True,
            "data": data,
            "total_available": len(available_rooms),
            "check_in": check_in,
            "check_out": check_out,
            "nights": nights,
            "message": f"Found {len(available_rooms)} available room(s)"
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@room_bp.route('/occupancy', methods=['GET'])
async def get_current_occupancy():
    try:
        branch_id = request.args.get('branch_id')
        stats = await room_service.get_current_occupancy(branch_id)
        occupied_rooms = await room_service.get_occupied_rooms(branch_id)
        
        return jsonify({
            "success": True,
            "data": stats.dict() if hasattr(stats, 'dict') else stats,
            "occupied_rooms": [r.dict() if hasattr(r, 'dict') else r for r in occupied_rooms],
            "message": f"Occupancy rate: {stats.occupancy_rate if hasattr(stats, 'occupancy_rate') else stats.get('occupancy_rate')}%"
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ... Port other routes ...
