"""
Guest Portal Python Microservice
Advanced functionalities for guest self-service portal
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta, date
import os
from supabase import create_client, Client
import logging

logger = logging.getLogger(__name__)

guest_portal_bp = Blueprint('guest_portal', __name__, url_prefix='/api/guest-portal')

# Initialize Supabase client
def get_supabase() -> Client:
    url = os.getenv('SUPABASE_URL') or os.getenv('SUPABASE_PROJECT_URL')
    key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        raise ValueError("Supabase credentials not configured")
    return create_client(url, key)


# =====================================================
# GUEST DASHBOARD & ANALYTICS
# =====================================================

@guest_portal_bp.route('/dashboard/summary', methods=['GET'])
def get_guest_dashboard():
    """Get comprehensive guest dashboard data"""
    try:
        guest_id = request.args.get('guest_id')
        if not guest_id:
            return jsonify({'success': False, 'error': 'guest_id required'}), 400
        
        supabase = get_supabase()
        
        # Get guest profile
        profile = supabase.table('guest_profiles').select('*').eq('user_id', guest_id).single().execute()
        user = supabase.table('users').select('first_name, last_name, email, phone').eq('id', guest_id).single().execute()
        
        # Get loyalty info
        loyalty = supabase.table('guest_loyalty').select('*').eq('guest_id', guest_id).single().execute()
        
        # Get active/upcoming bookings
        today = date.today().isoformat()
        bookings = supabase.table('bookings').select('*').eq(
            'guest_id', guest_id
        ).gte('check_out_date', today).order('check_in_date').limit(5).execute()
        
        # Get pending requests
        requests = supabase.table('guest_requests').select('*').eq(
            'guest_id', guest_id
        ).in_('status', ['pending', 'in_progress']).execute()
        
        # Get unread messages
        messages = supabase.table('guest_messages').select('id').eq(
            'guest_id', guest_id
        ).eq('is_read', False).eq('sender_type', 'staff').execute()
        
        # Get recent feedback
        feedback = supabase.table('guest_feedback').select('*').eq(
            'guest_id', guest_id
        ).order('created_at', desc=True).limit(3).execute()
        
        return jsonify({
            'success': True,
            'data': {
                'guest': {
                    **(user.data or {}),
                    **(profile.data or {}),
                    'id': guest_id
                },
                'loyalty': loyalty.data or {
                    'total_points': 0,
                    'tier': 'bronze',
                    'total_stays': 0,
                    'total_spent': 0
                },
                'activeBookings': len(bookings.data or []),
                'upcomingBookings': bookings.data or [],
                'pendingRequests': len(requests.data or []),
                'unreadMessages': len(messages.data or []),
                'recentFeedback': feedback.data or []
            }
        })
    except Exception as e:
        logger.error(f"Error getting guest dashboard: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# =====================================================
# LOYALTY PROGRAM
# =====================================================

@guest_portal_bp.route('/loyalty/details', methods=['GET'])
def get_loyalty_details():
    """Get detailed loyalty program information"""
    try:
        guest_id = request.args.get('guest_id')
        if not guest_id:
            return jsonify({'success': False, 'error': 'guest_id required'}), 400
        
        supabase = get_supabase()
        
        # Get loyalty record
        loyalty = supabase.table('guest_loyalty').select('*').eq('guest_id', guest_id).single().execute()
        
        if not loyalty.data:
            # Create new loyalty record
            new_loyalty = supabase.table('guest_loyalty').insert({
                'guest_id': guest_id,
                'total_points': 0,
                'tier': 'bronze',
                'total_stays': 0,
                'total_spent': 0,
                'member_since': date.today().isoformat()
            }).execute()
            loyalty_data = new_loyalty.data[0] if new_loyalty.data else {}
        else:
            loyalty_data = loyalty.data
        
        # Get recent transactions
        transactions = supabase.table('guest_loyalty_transactions').select('*').eq(
            'guest_id', guest_id
        ).order('created_at', desc=True).limit(20).execute()
        
        # Calculate tier progress
        current_points = loyalty_data.get('total_points', 0)
        tier = loyalty_data.get('tier', 'bronze')
        
        tier_thresholds = {
            'bronze': {'min': 0, 'max': 1000, 'next': 'silver'},
            'silver': {'min': 1000, 'max': 5000, 'next': 'gold'},
            'gold': {'min': 5000, 'max': 15000, 'next': 'platinum'},
            'platinum': {'min': 15000, 'max': float('inf'), 'next': None}
        }
        
        current_tier = tier_thresholds.get(tier, tier_thresholds['bronze'])
        points_to_next = max(0, current_tier['max'] - current_points) if current_tier['next'] else 0
        progress = min(100, ((current_points - current_tier['min']) / (current_tier['max'] - current_tier['min'])) * 100) if current_tier['max'] != float('inf') else 100
        
        # Tier benefits
        tier_benefits = {
            'bronze': ['10% off restaurant', 'Early check-in (subject to availability)', 'Welcome drink'],
            'silver': ['15% off restaurant', 'Guaranteed early check-in', 'Room upgrade (subject to availability)', 'Late checkout until 2pm'],
            'gold': ['20% off restaurant', 'Guaranteed room upgrade', 'Late checkout until 4pm', 'Free breakfast', 'Airport transfer discount'],
            'platinum': ['25% off restaurant', 'Best room guaranteed', 'Late checkout until 6pm', 'Free breakfast & dinner', 'Free airport transfer', 'Personal concierge']
        }
        
        return jsonify({
            'success': True,
            'data': {
                'loyalty': loyalty_data,
                'transactions': transactions.data or [],
                'tierProgress': {
                    'currentTier': tier,
                    'nextTier': current_tier['next'],
                    'pointsToNext': points_to_next,
                    'progressPercent': round(progress, 1)
                },
                'benefits': tier_benefits.get(tier, tier_benefits['bronze']),
                'allTierBenefits': tier_benefits
            }
        })
    except Exception as e:
        logger.error(f"Error getting loyalty details: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@guest_portal_bp.route('/loyalty/redeem', methods=['POST'])
def redeem_points():
    """Redeem loyalty points for rewards"""
    try:
        data = request.get_json()
        guest_id = data.get('guest_id')
        points = data.get('points')
        reward_type = data.get('reward_type')
        description = data.get('description', '')
        
        if not all([guest_id, points, reward_type]):
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400
        
        supabase = get_supabase()
        
        # Get current balance
        loyalty = supabase.table('guest_loyalty').select('*').eq('guest_id', guest_id).single().execute()
        
        if not loyalty.data:
            return jsonify({'success': False, 'error': 'Loyalty account not found'}), 404
        
        current_points = loyalty.data.get('total_points', 0)
        
        if current_points < points:
            return jsonify({'success': False, 'error': 'Insufficient points'}), 400
        
        new_balance = current_points - points
        
        # Update loyalty balance
        supabase.table('guest_loyalty').update({
            'total_points': new_balance,
            'last_activity': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }).eq('guest_id', guest_id).execute()
        
        # Create transaction record
        supabase.table('guest_loyalty_transactions').insert({
            'guest_id': guest_id,
            'transaction_type': 'redeem',
            'points': -points,
            'description': f"Redeemed for {reward_type}: {description}",
            'balance_after': new_balance
        }).execute()
        
        return jsonify({
            'success': True,
            'data': {
                'pointsRedeemed': points,
                'newBalance': new_balance,
                'reward': reward_type
            },
            'message': f'Successfully redeemed {points} points for {reward_type}'
        })
    except Exception as e:
        logger.error(f"Error redeeming points: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# =====================================================
# SERVICE REQUESTS
# =====================================================

@guest_portal_bp.route('/requests', methods=['GET'])
def get_service_requests():
    """Get guest service requests"""
    try:
        guest_id = request.args.get('guest_id')
        status = request.args.get('status')
        
        if not guest_id:
            return jsonify({'success': False, 'error': 'guest_id required'}), 400
        
        supabase = get_supabase()
        
        query = supabase.table('guest_requests').select('*').eq('guest_id', guest_id)
        
        if status:
            query = query.eq('status', status)
        
        result = query.order('created_at', desc=True).execute()
        
        # Categorize by status
        requests = {
            'pending': [],
            'in_progress': [],
            'completed': [],
            'cancelled': []
        }
        
        for req in result.data or []:
            status = req.get('status', 'pending')
            if status in requests:
                requests[status].append(req)
        
        return jsonify({
            'success': True,
            'data': {
                'requests': requests,
                'counts': {k: len(v) for k, v in requests.items()},
                'total': len(result.data or [])
            }
        })
    except Exception as e:
        logger.error(f"Error getting service requests: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@guest_portal_bp.route('/requests/create', methods=['POST'])
def create_service_request():
    """Create a new service request"""
    try:
        data = request.get_json()
        guest_id = data.get('guest_id')
        request_type = data.get('request_type')
        title = data.get('title')
        description = data.get('description', '')
        priority = data.get('priority', 'normal')
        room_number = data.get('room_number')
        scheduled_time = data.get('scheduled_time')
        booking_id = data.get('booking_id')
        branch_id = data.get('branch_id')
        
        if not all([guest_id, request_type, title]):
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400
        
        supabase = get_supabase()
        
        result = supabase.table('guest_requests').insert({
            'guest_id': guest_id,
            'booking_id': booking_id,
            'branch_id': branch_id,
            'request_type': request_type,
            'title': title,
            'description': description,
            'priority': priority,
            'room_number': room_number,
            'scheduled_time': scheduled_time,
            'status': 'pending',
            'created_at': datetime.now().isoformat()
        }).execute()
        
        return jsonify({
            'success': True,
            'data': result.data[0] if result.data else None,
            'message': 'Service request submitted successfully'
        })
    except Exception as e:
        logger.error(f"Error creating service request: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@guest_portal_bp.route('/requests/<request_id>/rate', methods=['POST'])
def rate_service_request(request_id):
    """Rate a completed service request"""
    try:
        data = request.get_json()
        rating = data.get('rating')
        feedback = data.get('feedback', '')
        
        if not rating or rating < 1 or rating > 5:
            return jsonify({'success': False, 'error': 'Rating must be between 1 and 5'}), 400
        
        supabase = get_supabase()
        
        result = supabase.table('guest_requests').update({
            'rating': rating,
            'feedback': feedback,
            'updated_at': datetime.now().isoformat()
        }).eq('id', request_id).execute()
        
        return jsonify({
            'success': True,
            'data': result.data[0] if result.data else None,
            'message': 'Thank you for your feedback!'
        })
    except Exception as e:
        logger.error(f"Error rating service request: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# =====================================================
# MESSAGING / CONCIERGE
# =====================================================

@guest_portal_bp.route('/messages', methods=['GET'])
def get_messages():
    """Get guest messages/conversations"""
    try:
        guest_id = request.args.get('guest_id')
        booking_id = request.args.get('booking_id')
        
        if not guest_id:
            return jsonify({'success': False, 'error': 'guest_id required'}), 400
        
        supabase = get_supabase()
        
        query = supabase.table('guest_messages').select('*').eq('guest_id', guest_id)
        
        if booking_id:
            query = query.eq('booking_id', booking_id)
        
        result = query.order('created_at', desc=True).limit(100).execute()
        
        # Mark messages as read
        unread_ids = [m['id'] for m in (result.data or []) if not m.get('is_read') and m.get('sender_type') == 'staff']
        if unread_ids:
            supabase.table('guest_messages').update({'is_read': True}).in_('id', unread_ids).execute()
        
        return jsonify({
            'success': True,
            'data': {
                'messages': result.data or [],
                'unreadCount': len(unread_ids)
            }
        })
    except Exception as e:
        logger.error(f"Error getting messages: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@guest_portal_bp.route('/messages/send', methods=['POST'])
def send_message():
    """Send a message to hotel staff"""
    try:
        data = request.get_json()
        guest_id = data.get('guest_id')
        message = data.get('message')
        subject = data.get('subject', '')
        booking_id = data.get('booking_id')
        branch_id = data.get('branch_id')
        
        if not all([guest_id, message]):
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400
        
        supabase = get_supabase()
        
        result = supabase.table('guest_messages').insert({
            'guest_id': guest_id,
            'booking_id': booking_id,
            'branch_id': branch_id,
            'subject': subject,
            'message': message,
            'sender_type': 'guest',
            'sender_id': guest_id,
            'is_read': False,
            'created_at': datetime.now().isoformat()
        }).execute()
        
        return jsonify({
            'success': True,
            'data': result.data[0] if result.data else None,
            'message': 'Message sent successfully'
        })
    except Exception as e:
        logger.error(f"Error sending message: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# =====================================================
# AMENITIES & BOOKINGS
# =====================================================

@guest_portal_bp.route('/amenities', methods=['GET'])
def get_amenities():
    """Get available hotel amenities"""
    try:
        branch_id = request.args.get('branch_id')
        category = request.args.get('category')
        
        supabase = get_supabase()
        
        query = supabase.table('hotel_amenities').select('*').eq('is_active', True)
        
        if branch_id:
            query = query.eq('branch_id', int(branch_id))
        
        if category:
            query = query.eq('category', category)
        
        result = query.order('category').execute()
        
        # Group by category
        amenities_by_category = {}
        for amenity in result.data or []:
            cat = amenity.get('category', 'other')
            if cat not in amenities_by_category:
                amenities_by_category[cat] = []
            amenities_by_category[cat].append(amenity)
        
        return jsonify({
            'success': True,
            'data': {
                'amenities': result.data or [],
                'byCategory': amenities_by_category,
                'categories': list(amenities_by_category.keys())
            }
        })
    except Exception as e:
        logger.error(f"Error getting amenities: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@guest_portal_bp.route('/amenities/book', methods=['POST'])
def book_amenity():
    """Book an amenity"""
    try:
        data = request.get_json()
        guest_id = data.get('guest_id')
        amenity_id = data.get('amenity_id')
        scheduled_date = data.get('scheduled_date')
        scheduled_time = data.get('scheduled_time')
        duration_minutes = data.get('duration_minutes', 60)
        guests_count = data.get('guests_count', 1)
        special_requests = data.get('special_requests', '')
        booking_id = data.get('booking_id')
        
        if not all([guest_id, amenity_id, scheduled_date]):
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400
        
        supabase = get_supabase()
        
        # Get amenity details
        amenity = supabase.table('hotel_amenities').select('*').eq('id', amenity_id).single().execute()
        
        if not amenity.data:
            return jsonify({'success': False, 'error': 'Amenity not found'}), 404
        
        if not amenity.data.get('is_bookable'):
            return jsonify({'success': False, 'error': 'This amenity is not bookable'}), 400
        
        # Calculate total amount
        price = float(amenity.data.get('price', 0))
        total_amount = price * guests_count
        
        result = supabase.table('amenity_bookings').insert({
            'amenity_id': amenity_id,
            'guest_id': guest_id,
            'booking_id': booking_id,
            'scheduled_date': scheduled_date,
            'scheduled_time': scheduled_time,
            'duration_minutes': duration_minutes,
            'guests_count': guests_count,
            'special_requests': special_requests,
            'total_amount': total_amount,
            'status': 'pending',
            'created_at': datetime.now().isoformat()
        }).execute()
        
        return jsonify({
            'success': True,
            'data': result.data[0] if result.data else None,
            'message': f'Booking request submitted for {amenity.data.get("name")}'
        })
    except Exception as e:
        logger.error(f"Error booking amenity: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@guest_portal_bp.route('/amenities/bookings', methods=['GET'])
def get_amenity_bookings():
    """Get guest's amenity bookings"""
    try:
        guest_id = request.args.get('guest_id')
        
        if not guest_id:
            return jsonify({'success': False, 'error': 'guest_id required'}), 400
        
        supabase = get_supabase()
        
        result = supabase.table('amenity_bookings').select(
            '*, hotel_amenities(name, category, icon)'
        ).eq('guest_id', guest_id).order('scheduled_date', desc=True).execute()
        
        return jsonify({
            'success': True,
            'data': result.data or []
        })
    except Exception as e:
        logger.error(f"Error getting amenity bookings: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# =====================================================
# FEEDBACK & REVIEWS
# =====================================================

@guest_portal_bp.route('/feedback/submit', methods=['POST'])
def submit_feedback():
    """Submit guest feedback/review"""
    try:
        data = request.get_json()
        guest_id = data.get('guest_id')
        booking_id = data.get('booking_id')
        branch_id = data.get('branch_id')
        overall_rating = data.get('overall_rating')
        cleanliness_rating = data.get('cleanliness_rating')
        service_rating = data.get('service_rating')
        amenities_rating = data.get('amenities_rating')
        value_rating = data.get('value_rating')
        comment = data.get('comment', '')
        would_recommend = data.get('would_recommend', True)
        is_public = data.get('is_public', False)
        
        if not all([guest_id, overall_rating]):
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400
        
        supabase = get_supabase()
        
        result = supabase.table('guest_feedback').insert({
            'guest_id': guest_id,
            'booking_id': booking_id,
            'branch_id': branch_id,
            'overall_rating': overall_rating,
            'cleanliness_rating': cleanliness_rating,
            'service_rating': service_rating,
            'amenities_rating': amenities_rating,
            'value_rating': value_rating,
            'comment': comment,
            'would_recommend': would_recommend,
            'is_public': is_public,
            'created_at': datetime.now().isoformat()
        }).execute()
        
        # Award loyalty points for feedback
        if result.data:
            loyalty = supabase.table('guest_loyalty').select('total_points').eq('guest_id', guest_id).single().execute()
            if loyalty.data:
                new_points = loyalty.data.get('total_points', 0) + 50  # 50 points for feedback
                supabase.table('guest_loyalty').update({
                    'total_points': new_points,
                    'last_activity': datetime.now().isoformat()
                }).eq('guest_id', guest_id).execute()
                
                supabase.table('guest_loyalty_transactions').insert({
                    'guest_id': guest_id,
                    'transaction_type': 'bonus',
                    'points': 50,
                    'description': 'Bonus for submitting feedback',
                    'balance_after': new_points
                }).execute()
        
        return jsonify({
            'success': True,
            'data': result.data[0] if result.data else None,
            'message': 'Thank you for your feedback! You earned 50 loyalty points.'
        })
    except Exception as e:
        logger.error(f"Error submitting feedback: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@guest_portal_bp.route('/feedback/history', methods=['GET'])
def get_feedback_history():
    """Get guest's feedback history"""
    try:
        guest_id = request.args.get('guest_id')
        
        if not guest_id:
            return jsonify({'success': False, 'error': 'guest_id required'}), 400
        
        supabase = get_supabase()
        
        result = supabase.table('guest_feedback').select('*').eq(
            'guest_id', guest_id
        ).order('created_at', desc=True).execute()
        
        return jsonify({
            'success': True,
            'data': result.data or []
        })
    except Exception as e:
        logger.error(f"Error getting feedback history: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# =====================================================
# PREFERENCES
# =====================================================

@guest_portal_bp.route('/preferences', methods=['GET'])
def get_preferences():
    """Get guest saved preferences"""
    try:
        guest_id = request.args.get('guest_id')
        
        if not guest_id:
            return jsonify({'success': False, 'error': 'guest_id required'}), 400
        
        supabase = get_supabase()
        
        result = supabase.table('guest_saved_preferences').select('*').eq('guest_id', guest_id).execute()
        
        # Organize by category
        preferences = {}
        for pref in result.data or []:
            category = pref.get('category', 'general')
            if category not in preferences:
                preferences[category] = {}
            preferences[category][pref.get('preference_key')] = pref.get('preference_value')
        
        return jsonify({
            'success': True,
            'data': preferences
        })
    except Exception as e:
        logger.error(f"Error getting preferences: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@guest_portal_bp.route('/preferences/save', methods=['POST'])
def save_preferences():
    """Save guest preferences"""
    try:
        data = request.get_json()
        guest_id = data.get('guest_id')
        preferences = data.get('preferences', {})
        
        if not guest_id:
            return jsonify({'success': False, 'error': 'guest_id required'}), 400
        
        supabase = get_supabase()
        
        saved = []
        for category, prefs in preferences.items():
            for key, value in prefs.items():
                # Upsert preference
                result = supabase.table('guest_saved_preferences').upsert({
                    'guest_id': guest_id,
                    'category': category,
                    'preference_key': key,
                    'preference_value': str(value),
                    'updated_at': datetime.now().isoformat()
                }, on_conflict='guest_id,category,preference_key').execute()
                
                if result.data:
                    saved.append(f"{category}.{key}")
        
        return jsonify({
            'success': True,
            'data': {'saved': saved},
            'message': f'Saved {len(saved)} preferences'
        })
    except Exception as e:
        logger.error(f"Error saving preferences: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# =====================================================
# BOOKING MANAGEMENT
# =====================================================

@guest_portal_bp.route('/bookings', methods=['GET'])
def get_bookings():
    """Get guest bookings"""
    try:
        guest_id = request.args.get('guest_id')
        status = request.args.get('status')
        
        if not guest_id:
            return jsonify({'success': False, 'error': 'guest_id required'}), 400
        
        supabase = get_supabase()
        
        query = supabase.table('bookings').select('*, rooms(room_number, room_type, floor)')
        query = query.eq('guest_id', guest_id)
        
        if status:
            query = query.eq('status', status)
        
        result = query.order('check_in_date', desc=True).execute()
        
        # Categorize bookings
        today = date.today()
        bookings = {
            'current': [],
            'upcoming': [],
            'past': [],
            'cancelled': []
        }
        
        for booking in result.data or []:
            if booking.get('status') == 'cancelled':
                bookings['cancelled'].append(booking)
            else:
                check_in = datetime.strptime(booking['check_in_date'][:10], '%Y-%m-%d').date()
                check_out = datetime.strptime(booking['check_out_date'][:10], '%Y-%m-%d').date()
                
                if check_in <= today <= check_out:
                    bookings['current'].append(booking)
                elif check_in > today:
                    bookings['upcoming'].append(booking)
                else:
                    bookings['past'].append(booking)
        
        return jsonify({
            'success': True,
            'data': {
                'bookings': bookings,
                'counts': {k: len(v) for k, v in bookings.items()}
            }
        })
    except Exception as e:
        logger.error(f"Error getting bookings: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@guest_portal_bp.route('/bookings/<booking_id>/details', methods=['GET'])
def get_booking_details(booking_id):
    """Get detailed booking information"""
    try:
        supabase = get_supabase()
        
        booking = supabase.table('bookings').select(
            '*, rooms(room_number, room_type, floor, amenities)'
        ).eq('id', booking_id).single().execute()
        
        if not booking.data:
            return jsonify({'success': False, 'error': 'Booking not found'}), 404
        
        # Get related requests
        requests = supabase.table('guest_requests').select('*').eq(
            'booking_id', booking_id
        ).execute()
        
        # Get related messages
        messages = supabase.table('guest_messages').select('*').eq(
            'booking_id', booking_id
        ).order('created_at', desc=True).limit(10).execute()
        
        return jsonify({
            'success': True,
            'data': {
                'booking': booking.data,
                'requests': requests.data or [],
                'messages': messages.data or []
            }
        })
    except Exception as e:
        logger.error(f"Error getting booking details: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
