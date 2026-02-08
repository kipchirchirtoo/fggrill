from flask import Blueprint, request, jsonify
import logging

logger = logging.getLogger(__name__)

search_bp = Blueprint('search', __name__, url_prefix='/api/search')

def init_search_routes(supabase_client):
    global supabase
    supabase = supabase_client

@search_bp.route('/universal', methods=['GET'])
def universal_search():
    """Universal search across all entities"""
    try:
        query = request.args.get('q', '').strip()
        if not query or len(query) < 2:
            return jsonify({'success': False, 'error': 'Query must be at least 2 characters'}), 400

        results = []
        
        if supabase:
            # Search Staff
            try:
                staff_res = supabase.table('users').select('id, first_name, last_name, email, employee_id, role, branch_id, status').or_(
                    f'first_name.ilike.%{query}%,last_name.ilike.%{query}%,employee_id.ilike.%{query}%,email.ilike.%{query}%'
                ).limit(10).execute()
                
                for staff in staff_res.data:
                    results.append({
                        'type': 'staff',
                        'id': str(staff['id']),
                        'title': f"{staff.get('first_name', '')} {staff.get('last_name', '')}".strip(),
                        'subtitle': f"{staff.get('role', 'Staff')} • Branch {staff.get('branch_id', 'N/A')}",
                        'metadata': {
                            'employee_id': staff.get('employee_id', 'N/A'),
                            'email': staff.get('email', 'N/A'),
                            'role': staff.get('role', 'N/A'),
                            'branch_id': staff.get('branch_id', 'N/A'),
                            'status': staff.get('status', 'N/A')
                        }
                    })
            except Exception as e:
                logger.error(f"Error searching staff: {e}")

            # Search Orders (Restaurant/Bar/POS)
            try:
                orders_res = supabase.table('orders').select('id, order_number, total_amount, status, branch_id, created_at, order_type').or_(
                    f'order_number.ilike.%{query}%,id.eq.{query if query.isdigit() else "0"}'
                ).limit(10).execute()
                
                for order in orders_res.data:
                    results.append({
                        'type': 'order',
                        'id': str(order['id']),
                        'title': f"Order #{order.get('order_number', order['id'])}",
                        'subtitle': f"{order.get('order_type', 'Order')} • KES {order.get('total_amount', 0):,.2f}",
                        'metadata': {
                            'order_number': order.get('order_number', 'N/A'),
                            'total_amount': f"KES {order.get('total_amount', 0):,.2f}",
                            'status': order.get('status', 'N/A'),
                            'branch_id': order.get('branch_id', 'N/A'),
                            'created_at': order.get('created_at', 'N/A'),
                            'order_type': order.get('order_type', 'N/A')
                        }
                    })
            except Exception as e:
                logger.error(f"Error searching orders: {e}")

            # Search Guests
            try:
                guests_res = supabase.table('guests').select('id, first_name, last_name, email, phone, id_number').or_(
                    f'first_name.ilike.%{query}%,last_name.ilike.%{query}%,email.ilike.%{query}%,phone.ilike.%{query}%,id_number.ilike.%{query}%'
                ).limit(10).execute()
                
                for guest in guests_res.data:
                    results.append({
                        'type': 'guest',
                        'id': str(guest['id']),
                        'title': f"{guest.get('first_name', '')} {guest.get('last_name', '')}".strip(),
                        'subtitle': f"{guest.get('email', guest.get('phone', 'No contact'))}",
                        'metadata': {
                            'email': guest.get('email', 'N/A'),
                            'phone': guest.get('phone', 'N/A'),
                            'id_number': guest.get('id_number', 'N/A')
                        }
                    })
            except Exception as e:
                logger.error(f"Error searching guests: {e}")

            # Search Bookings
            try:
                bookings_res = supabase.table('reservations').select('id, booking_reference, guest_name, check_in, check_out, status, branch_id').or_(
                    f'booking_reference.ilike.%{query}%,guest_name.ilike.%{query}%,id.eq.{query if query.isdigit() else "0"}'
                ).limit(10).execute()
                
                for booking in bookings_res.data:
                    results.append({
                        'type': 'booking',
                        'id': str(booking['id']),
                        'title': f"Booking {booking.get('booking_reference', booking['id'])}",
                        'subtitle': f"{booking.get('guest_name', 'Guest')} • {booking.get('status', 'N/A')}",
                        'metadata': {
                            'booking_reference': booking.get('booking_reference', 'N/A'),
                            'guest_name': booking.get('guest_name', 'N/A'),
                            'check_in': booking.get('check_in', 'N/A'),
                            'check_out': booking.get('check_out', 'N/A'),
                            'status': booking.get('status', 'N/A'),
                            'branch_id': booking.get('branch_id', 'N/A')
                        }
                    })
            except Exception as e:
                logger.error(f"Error searching bookings: {e}")

            # Search Transactions (M-Pesa, Bank)
            try:
                transactions_res = supabase.table('mpesa_transactions').select('id, transaction_code, amount, phone_number, transaction_type, created_at').or_(
                    f'transaction_code.ilike.%{query}%,phone_number.ilike.%{query}%'
                ).limit(10).execute()
                
                for txn in transactions_res.data:
                    results.append({
                        'type': 'transaction',
                        'id': str(txn['id']),
                        'title': f"M-Pesa {txn.get('transaction_code', txn['id'])}",
                        'subtitle': f"KES {txn.get('amount', 0):,.2f} • {txn.get('phone_number', 'N/A')}",
                        'metadata': {
                            'transaction_code': txn.get('transaction_code', 'N/A'),
                            'amount': f"KES {txn.get('amount', 0):,.2f}",
                            'phone_number': txn.get('phone_number', 'N/A'),
                            'transaction_type': txn.get('transaction_type', 'N/A'),
                            'created_at': txn.get('created_at', 'N/A')
                        }
                    })
            except Exception as e:
                logger.error(f"Error searching transactions: {e}")

            # Search Receipts
            try:
                receipts_res = supabase.table('receipts').select('id, receipt_number, amount, payment_method, branch_id, created_at').or_(
                    f'receipt_number.ilike.%{query}%,id.eq.{query if query.isdigit() else "0"}'
                ).limit(10).execute()
                
                for receipt in receipts_res.data:
                    results.append({
                        'type': 'receipt',
                        'id': str(receipt['id']),
                        'title': f"Receipt #{receipt.get('receipt_number', receipt['id'])}",
                        'subtitle': f"KES {receipt.get('amount', 0):,.2f} • {receipt.get('payment_method', 'N/A')}",
                        'metadata': {
                            'receipt_number': receipt.get('receipt_number', 'N/A'),
                            'amount': f"KES {receipt.get('amount', 0):,.2f}",
                            'payment_method': receipt.get('payment_method', 'N/A'),
                            'branch_id': receipt.get('branch_id', 'N/A'),
                            'created_at': receipt.get('created_at', 'N/A')
                        }
                    })
            except Exception as e:
                logger.error(f"Error searching receipts: {e}")

            # Search Bills/Invoices
            try:
                bills_res = supabase.table('credit_bills').select('id, bill_number, customer_name, amount, status, branch_id, created_at').or_(
                    f'bill_number.ilike.%{query}%,customer_name.ilike.%{query}%'
                ).limit(10).execute()
                
                for bill in bills_res.data:
                    results.append({
                        'type': 'bill',
                        'id': str(bill['id']),
                        'title': f"Bill #{bill.get('bill_number', bill['id'])}",
                        'subtitle': f"{bill.get('customer_name', 'Customer')} • KES {bill.get('amount', 0):,.2f}",
                        'metadata': {
                            'bill_number': bill.get('bill_number', 'N/A'),
                            'customer_name': bill.get('customer_name', 'N/A'),
                            'amount': f"KES {bill.get('amount', 0):,.2f}",
                            'status': bill.get('status', 'N/A'),
                            'branch_id': bill.get('branch_id', 'N/A'),
                            'created_at': bill.get('created_at', 'N/A')
                        }
                    })
            except Exception as e:
                logger.error(f"Error searching bills: {e}")

            return jsonify({'success': True, 'data': results, 'count': len(results)})
        
        return jsonify({'success': False, 'error': 'Database not available'}), 503
        
    except Exception as e:
        logger.error(f"Universal search error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
