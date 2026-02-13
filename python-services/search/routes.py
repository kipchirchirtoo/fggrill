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

            # Search Restaurant Orders
            try:
                rest_orders_res = supabase.table('restaurant_orders').select('id, order_number, total_amount, status, branch_id, created_at').or_(
                    f'order_number.ilike.%{query}%,id.eq.{query if "-" in query and len(query) > 30 else "00000000-0000-0000-0000-000000000000"}'
                ).limit(5).execute()
                
                for order in rest_orders_res.data:
                    results.append({
                        'type': 'order',
                        'id': str(order['id']),
                        'title': f"Restaurant Odr #{order.get('order_number', 'N/A')}",
                        'subtitle': f"Restaurant • KES {order.get('total_amount', 0):,.2f}",
                        'metadata': {
                            'order_number': order.get('order_number', 'N/A'),
                            'amount': order.get('total_amount', 0),
                            'status': order.get('status', 'N/A'),
                            'branch_id': order.get('branch_id', 'N/A'),
                            'created_at': order.get('created_at', 'N/A'),
                            'order_type': 'Restaurant'
                        }
                    })
            except Exception as e:
                logger.error(f"Error searching restaurant orders: {e}")

            # Search Bar Orders
            try:
                bar_orders_res = supabase.table('bar_orders').select('id, order_number, total, status, branch_id, created_at').or_(
                    f'order_number.ilike.%{query}%,id.eq.{query if "-" in query and len(query) > 30 else "00000000-0000-0000-0000-000000000000"}'
                ).limit(5).execute()
                
                for order in bar_orders_res.data:
                    results.append({
                        'type': 'order',
                        'id': str(order['id']),
                        'title': f"Bar Order #{order.get('order_number', 'N/A')}",
                        'subtitle': f"Bar • KES {order.get('total', 0):,.2f}",
                        'metadata': {
                            'order_number': order.get('order_number', 'N/A'),
                            'amount': order.get('total', 0),
                            'status': order.get('status', 'N/A'),
                            'branch_id': order.get('branch_id', 'N/A'),
                            'created_at': order.get('created_at', 'N/A'),
                            'order_type': 'Bar'
                        }
                    })
            except Exception as e:
                logger.error(f"Error searching bar orders: {e}")

            # Search Guests
            try:
                guests_res = supabase.table('guests').select('id, first_name, last_name, email, phone, id_number').or_(
                    f'first_name.ilike.%{query}%,last_name.ilike.%{query}%,email.ilike.%{query}%,phone.ilike.%{query}%,id_number.ilike.%{query}%'
                ).limit(5).execute()
                
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
                bookings_res = supabase.table('reservations').select('id, confirmation_number, guest_name, check_in_date, check_out_date, status, branch_id').or_(
                    f'confirmation_number.ilike.%{query}%,guest_name.ilike.%{query}%,id.eq.{query if "-" in query and len(query) > 30 else "00000000-0000-0000-0000-000000000000"}'
                ).limit(5).execute()
                
                for booking in bookings_res.data:
                    results.append({
                        'type': 'booking',
                        'id': str(booking['id']),
                        'title': f"Booking {booking.get('confirmation_number', booking['id'])}",
                        'subtitle': f"{booking.get('guest_name', 'Guest')} • {booking.get('status', 'N/A')}",
                        'metadata': {
                            'confirmation_number': booking.get('confirmation_number', 'N/A'),
                            'guest_name': booking.get('guest_name', 'N/A'),
                            'check_in': booking.get('check_in_date', 'N/A'),
                            'check_out': booking.get('check_out_date', 'N/A'),
                            'status': booking.get('status', 'N/A'),
                            'branch_id': booking.get('branch_id', 'N/A')
                        }
                    })
            except Exception as e:
                logger.error(f"Error searching bookings: {e}")

            # Search Transactions (Payments)
            try:
                payments_res = supabase.table('payments').select('id, reference, amount, payment_method, status, created_at').or_(
                    f'reference.ilike.%{query}%'
                ).limit(5).execute()
                
                for txn in payments_res.data:
                    results.append({
                        'type': 'transaction',
                        'id': str(txn['id']),
                        'title': f"Payment {txn.get('reference', txn['id'])}",
                        'subtitle': f"KES {txn.get('amount', 0):,.2f} • {txn.get('payment_method', 'N/A')}",
                        'metadata': {
                            'reference': txn.get('reference', 'N/A'),
                            'amount': txn.get('amount', 0),
                            'payment_method': txn.get('payment_method', 'N/A'),
                            'status': txn.get('status', 'N/A'),
                            'created_at': txn.get('created_at', 'N/A')
                        }
                    })
            except Exception as e:
                logger.error(f"Error searching payments: {e}")

            # Search Bills
            try:
                bills_res = supabase.table('unpaid_bills').select('id, bill_number, customer_name, total_amount, status, branch_id, created_at').or_(
                    f'bill_number.ilike.%{query}%,customer_name.ilike.%{query}%'
                ).limit(5).execute()
                
                for bill in bills_res.data:
                    results.append({
                        'type': 'bill',
                        'id': str(bill['id']),
                        'title': f"Bill #{bill.get('bill_number', bill['id'])}",
                        'subtitle': f"{bill.get('customer_name', 'Customer')} • KES {bill.get('total_amount', 0):,.2f}",
                        'metadata': {
                            'bill_number': bill.get('bill_number', 'N/A'),
                            'customer_name': bill.get('customer_name', 'N/A'),
                            'amount': bill.get('total_amount', 0),
                            'status': bill.get('status', 'N/A'),
                            'branch_id': bill.get('branch_id', 'N/A'),
                            'created_at': bill.get('created_at', 'N/A')
                        }
                    })
            except Exception as e:
                logger.error(f"Error searching bills: {e}")

            # Search Supplier Invoices
            try:
                invoices_res = supabase.table('store_supplier_invoices').select('*, supplier:store_suppliers(name)').or_(
                    f'invoice_number.ilike.%{query}%'
                ).limit(5).execute()
                
                for inv in invoices_res.data:
                    results.append({
                        'type': 'supplier_invoice',
                        'id': str(inv['id']),
                        'title': f"Supplier Invoice #{inv.get('invoice_number', 'N/A')}",
                        'subtitle': f"{inv.get('supplier', {}).get('name', 'N/A')} • KES {inv.get('total_amount', 0):,.2f}",
                        'metadata': {
                            'invoice_number': inv.get('invoice_number', 'N/A'),
                            'amount': inv.get('total_amount', 0),
                            'status': inv.get('status', 'N/A'),
                            'supplier_name': inv.get('supplier', {}).get('name', 'N/A'),
                            'created_at': inv.get('created_at', 'N/A')
                        }
                    })
            except Exception as e:
                logger.error(f"Error searching supplier invoices: {e}")

            return jsonify({'success': True, 'data': results, 'count': len(results)})
        
        return jsonify({'success': False, 'error': 'Database not available'}), 503
        
    except Exception as e:
        logger.error(f"Universal search error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
