from flask import Blueprint, request, jsonify
import logging
from .feature_extractor import FeatureExtractor
from .detector import BehaviorDetector

logger = logging.getLogger(__name__)

behavior_bp = Blueprint('behavior_bp', __name__)
detector = BehaviorDetector()
extractor = FeatureExtractor()

@behavior_bp.route('/', methods=['GET'])
def get_anomalies():
    """Fetch detected anomalies along with user info"""
    try:
        limit = request.args.get('limit', 100)
        user_id = request.args.get('user_id')
        
        filters = {'limit': limit}
        if user_id:
            filters['user_id'] = user_id
            
        data = detector.fetch_anomalies(filters)
        return jsonify({
            'success': True,
            'anomalies': data,
            'count': len(data)
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching anomalies: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@behavior_bp.route('/analyze', methods=['POST'])
def analyze_event():
    """Process a real-time event through the behavior detector"""
    try:
        payload = request.get_json()
        if not payload or not payload.get('user_id'):
            return jsonify({
                'success': False,
                'message': 'user_id is required'
            }), 400
            
        result = detector.analyze_event(payload)
        
        return jsonify({
            'success': True,
            'result': result
        }), 200
        
    except Exception as e:
        logger.error(f"Error analyzing event: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@behavior_bp.route('/retrain', methods=['POST'])
def retrain_model():
    """Rebuild the statistical distribution profiles for all users from historical logs"""
    try:
        success = extractor.build_profiles()
        if success:
            return jsonify({
                'success': True,
                'message': 'User behavior profiles rebuilt successfully.'
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'No data found or issue creating profiles.'
            }), 400
    except Exception as e:
        logger.error(f"Error rebuilding profiles: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@behavior_bp.route('/profile/<user_id>', methods=['GET'])
def get_user_profile(user_id):
    """Fetch a specific user's baseline behavior profile"""
    try:
        profile = extractor.get_profile(user_id)
        if profile:
            return jsonify({
                'success': True,
                'profile': profile
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'User profile not found.'
            }), 404
    except Exception as e:
        logger.error(f"Error fetching user profile: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
