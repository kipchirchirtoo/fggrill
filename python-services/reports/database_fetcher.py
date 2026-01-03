"""
Famous Gate Hotel - Database Data Fetcher
Direct database connection for accurate report data
"""

import os
import logging
from datetime import datetime, timedelta
from supabase import create_client, Client
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


class DatabaseFetcher:
    """Fetch real data directly from Supabase database"""
    
    def __init__(self):
        self.supabase_url = os.getenv('SUPABASE_URL', 'https://utsvlihpudfraxzcmtle.supabase.co')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_KEY', os.getenv('SUPABASE_ANON_KEY', ''))
        self.client: Optional[Client] = None
        self._connect()
    
    def _connect(self):
        """Establish database connection"""
        try:
            if self.supabase_url and self.supabase_key:
                self.client = create_client(self.supabase_url, self.supabase_key)
                logger.info("Connected to Supabase database")
            else:
                logger.warning("Supabase credentials not configured")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            self.client = None

    def fetch_report_data(self, report_type: str, filters: Dict[str, Any]) -> Dict[str, Any]:
        """Fetch data for specific report type"""
        try:
            fetchers = {
                'daily_sales': self._fetch_daily_sales,
                'occupancy': self._fetch_occupancy,
                'financial_summary': self._fetch_financial_summary,
                'inventory_status': self._fetch_inventory_status,
                'housekeeping': self._fetch_housekeeping,
                'maintenance': self._fetch_maintenance,
                'payroll_summary': self._fetch_payroll,
                'restaurant_sales': self._fetch_restaurant_sales,
                'room_supplies': self._fetch_room_supplies,
                'manager_duty': self._fetch_manager_duty,
                'reservation': self._fetch_reservation,
                'revenue_analysis': self._fetch_revenue_analysis,
                'stock_movement': self._fetch_stock_movement,
                'arrivals_departures': self._fetch_arrivals_departures,
                'expense': self._fetch_expenses,
                'bar_sales': self._fetch_bar_sales,
                'kpi_dashboard': self._fetch_kpi_dashboard,
                'employee_attendance': self._fetch_employee_attendance,
            }
            
            fetcher = fetchers.get(report_type)
            if fetcher:
                return fetcher(filters)
            else:
                logger.warning(f"Unknown report type: {report_type}")
                return {'error': f'Unknown report type: {report_type}'}
        except Exception as e:
            logger.error(f"Error fetching {report_type} data: {e}")
            return {'error': str(e)}

    def _parse_dates(self, filters: Dict) -> tuple:
        """Parse date filters"""
        # Default to today if no dates provided
        today = datetime.now().strftime('%Y-%m-%d')
        start_date = filters.get('start_date', today)
        end_date = filters.get('end_date', today)
        
        # Log the dates being used for debugging
        logger.info(f"Parsing dates - start: {start_date}, end: {end_date}, branch_id: {filters.get('branch_id')}")
        return start_date, end_date

    def _fetch_daily_sales(self, filters: Dict) -> Dict[str, Any]:
        """Fetch daily sales data from all revenue sources"""
        start_date, end_date = self._parse_dates(filters)
        branch_id = filters.get('branch_id')
        
        data = {
            'total_revenue': 0,
            'total_transactions': 0,
            'avg_transaction': 0,
            'cash_sales': 0,
            'card_sales': 0,
            'mpesa_sales': 0,
            'categories': [],
            'daily_breakdown': []
        }
        
        if not self.client:
            return data
        
        try:
            # Fetch restaurant orders (Only paid or partial)
            query = self.client.table('restaurant_orders').select('*')
            query = query.gte('created_at', f'{start_date}T00:00:00')
            query = query.lte('created_at', f'{end_date}T23:59:59')
            query = query.in_('payment_status', ['paid', 'partial'])
            if branch_id:
                query = query.eq('branch_id', int(branch_id))
            
            restaurant_orders = query.execute()
            
            # Fetch bar orders (Only paid or partial)
            bar_query = self.client.table('bar_orders').select('*')
            bar_query = bar_query.gte('created_at', f'{start_date}T00:00:00')
            bar_query = bar_query.lte('created_at', f'{end_date}T23:59:59')
            bar_query = bar_query.in_('payment_status', ['paid', 'partial'])
            if branch_id:
                bar_query = bar_query.eq('branch_id', int(branch_id))
            
            bar_orders = bar_query.execute()
            
            # Fetch room bookings payments (Only confirmed/checked_in with payment)
            booking_query = self.client.table('bookings').select('*')
            booking_query = booking_query.gte('created_at', f'{start_date}T00:00:00')
            booking_query = booking_query.lte('created_at', f'{end_date}T23:59:59')
            booking_query = booking_query.in_('payment_status', ['paid', 'partial'])
            if branch_id:
                booking_query = booking_query.eq('branch_id', int(branch_id))
            
            bookings = booking_query.execute()
            
            # Fetch receipts for additional revenue tracking
            # Note: receipts table has branch_id as UUID, need to convert from integer
            receipts_query = self.client.table('receipts').select('*')
            receipts_query = receipts_query.gte('created_at', f'{start_date}T00:00:00')
            receipts_query = receipts_query.lte('created_at', f'{end_date}T23:59:59')
            receipts_query = receipts_query.eq('payment_status', 'paid')
            # Skip receipts filtering by branch for now due to UUID/integer mismatch
            # TODO: Fix receipts table branch_id schema or mapping
            
            receipts = receipts_query.execute()
            
            # Calculate totals - use correct column names
            # For partial payments, we should ideally sum the actual payments, 
            # but the current schema stores total_amount on the order.
            # To be accurate, we should fetch from 'payments' table where status='completed'.
            
            # Fetch actual completed payments for the period
            payments_query = self.client.table('payments').select('*')\
                .gte('created_at', f'{start_date}T00:00:00')\
                .lte('created_at', f'{end_date}T23:59:59')\
                .eq('status', 'completed')
            
            actual_payments = payments_query.execute()
            
            # Sum by category from payments table
            restaurant_total = sum(p.get('amount', 0) for p in (actual_payments.data or []) if p.get('restaurant_order_id'))
            booking_total = sum(p.get('amount', 0) for p in (actual_payments.data or []) if p.get('booking_id'))
            # Bar orders might be linked differently or not yet in payments table
            # If bar orders are not in payments table, we fallback to bar_orders table
            bar_total = sum(o.get('total_amount', 0) or 0 for o in (bar_orders.data or []))
            receipts_total = sum(r.get('total_amount', 0) or 0 for r in (receipts.data or []))
            
            # Log the data for debugging
            logger.info(f"Daily sales calculation (Verified Only) - Restaurant: {restaurant_total}, Bar: {bar_total}, Bookings: {booking_total}, Receipts: {receipts_total}")
            
            data['total_revenue'] = restaurant_total + bar_total + booking_total + receipts_total
            data['total_transactions'] = len(actual_payments.data or []) + len(bar_orders.data or []) + len(receipts.data or [])
            
            if data['total_transactions'] > 0:
                data['avg_transaction'] = data['total_revenue'] / data['total_transactions']
            
            # Payment method breakdown from verified payments
            for p in (actual_payments.data or []):
                method = p.get('payment_method', '').lower()
                amount = p.get('amount', 0) or 0
                if 'cash' in method:
                    data['cash_sales'] += amount
                elif 'card' in method:
                    data['card_sales'] += amount
                elif 'mpesa' in method or 'm-pesa' in method:
                    data['mpesa_sales'] += amount
            
            # Categories
            data['categories'] = [
                {'name': 'Restaurant', 'quantity': len([p for p in (actual_payments.data or []) if p.get('restaurant_order_id')]), 'total': restaurant_total},
                {'name': 'Bar & Lounge', 'quantity': len(bar_orders.data or []), 'total': bar_total},
                {'name': 'Room Bookings', 'quantity': len([p for p in (actual_payments.data or []) if p.get('booking_id')]), 'total': booking_total},
                {'name': 'Other Sales', 'quantity': len(receipts.data or []), 'total': receipts_total},
            ]
            
        except Exception as e:
            logger.error(f"Error fetching daily sales: {e}")
        
        return data

    def _fetch_occupancy(self, filters: Dict) -> Dict[str, Any]:
        """Fetch room occupancy data"""
        start_date, end_date = self._parse_dates(filters)
        branch_id = filters.get('branch_id')
        
        data = {
            'occupancy_rate': 0,
            'total_rooms': 0,
            'occupied_rooms': 0,
            'available_rooms': 0,
            'adr': 0,
            'revpar': 0,
            'room_types': []
        }
        
        if not self.client:
            return data
        
        try:
            # Fetch all rooms
            rooms_query = self.client.table('rooms').select('*')
            if branch_id:
                rooms_query = rooms_query.eq('branch_id', branch_id)
            rooms = rooms_query.execute()
            
            # Fetch active bookings
            bookings_query = self.client.table('bookings').select('*, room:rooms(*)')
            bookings_query = bookings_query.lte('check_in', end_date)
            bookings_query = bookings_query.gte('check_out', start_date)
            bookings_query = bookings_query.in_('status', ['confirmed', 'checked_in'])
            
            bookings = bookings_query.execute()
            
            total_rooms = len(rooms.data or [])
            occupied_room_ids = set(b.get('room_id') for b in (bookings.data or []) if b.get('room_id'))
            occupied_rooms = len(occupied_room_ids)
            
            data['total_rooms'] = total_rooms
            data['occupied_rooms'] = occupied_rooms
            data['available_rooms'] = total_rooms - occupied_rooms
            
            if total_rooms > 0:
                data['occupancy_rate'] = (occupied_rooms / total_rooms) * 100
            
            # Calculate ADR and RevPAR
            total_revenue = sum(b.get('total_amount', 0) or 0 for b in (bookings.data or []))
            if occupied_rooms > 0:
                data['adr'] = total_revenue / occupied_rooms
            if total_rooms > 0:
                data['revpar'] = total_revenue / total_rooms
            
            # Room type breakdown
            room_type_stats = {}
            for room in (rooms.data or []):
                rt = room.get('type', 'Standard')
                if rt not in room_type_stats:
                    room_type_stats[rt] = {'total': 0, 'occupied': 0, 'revenue': 0}
                room_type_stats[rt]['total'] += 1
                if room.get('id') in occupied_room_ids:
                    room_type_stats[rt]['occupied'] += 1
            
            for booking in (bookings.data or []):
                room = booking.get('room', {})
                rt = room.get('type', 'Standard') if room else 'Standard'
                if rt in room_type_stats:
                    room_type_stats[rt]['revenue'] += booking.get('total_amount', 0) or 0
            
            data['room_types'] = [
                {
                    'type': rt,
                    'total': stats['total'],
                    'occupied': stats['occupied'],
                    'occupancy_pct': (stats['occupied'] / stats['total'] * 100) if stats['total'] > 0 else 0,
                    'revenue': stats['revenue']
                }
                for rt, stats in room_type_stats.items()
            ]
            
        except Exception as e:
            logger.error(f"Error fetching occupancy: {e}")
        
        return data

    def _fetch_financial_summary(self, filters: Dict) -> Dict[str, Any]:
        """Fetch comprehensive financial summary"""
        start_date, end_date = self._parse_dates(filters)
        branch_id = filters.get('branch_id')
        
        data = {
            'room_revenue': 0, 'room_pct': 0,
            'restaurant_revenue': 0, 'restaurant_pct': 0,
            'bar_revenue': 0, 'bar_pct': 0,
            'other_revenue': 0, 'other_pct': 0,
            'total_revenue': 0,
            'payroll_expense': 0, 'payroll_pct': 0,
            'utilities_expense': 0, 'utilities_pct': 0,
            'supplies_expense': 0, 'supplies_pct': 0,
            'maintenance_expense': 0, 'maintenance_pct': 0,
            'other_expense': 0, 'other_exp_pct': 0,
            'total_expenses': 0,
            'net_profit': 0,
            'profit_margin': 0
        }
        
        if not self.client:
            return data
        
        try:
            # Revenue from bookings
            bookings_query = self.client.table('bookings').select('total_amount')\
                .gte('created_at', f'{start_date}T00:00:00')\
                .lte('created_at', f'{end_date}T23:59:59')
            if branch_id:
                bookings_query = bookings_query.eq('branch_id', branch_id)
            bookings = bookings_query.execute()
            data['room_revenue'] = sum(b.get('total_amount', 0) or 0 for b in (bookings.data or []))
            
            # Revenue from restaurant
            restaurant_query = self.client.table('restaurant_orders').select('total_amount')\
                .gte('created_at', f'{start_date}T00:00:00')\
                .lte('created_at', f'{end_date}T23:59:59')
            if branch_id:
                restaurant_query = restaurant_query.eq('branch_id', branch_id)
            restaurant = restaurant_query.execute()
            data['restaurant_revenue'] = sum(o.get('total_amount', 0) or 0 for o in (restaurant.data or []))
            
            # Revenue from bar
            bar_query = self.client.table('bar_orders').select('total_amount')\
                .gte('created_at', f'{start_date}T00:00:00')\
                .lte('created_at', f'{end_date}T23:59:59')
            if branch_id:
                bar_query = bar_query.eq('branch_id', branch_id)
            bar = bar_query.execute()
            data['bar_revenue'] = sum(o.get('total_amount', 0) or 0 for o in (bar.data or []))
            
            # Calculate total revenue
            data['total_revenue'] = data['room_revenue'] + data['restaurant_revenue'] + data['bar_revenue']
            
            if data['total_revenue'] > 0:
                data['room_pct'] = (data['room_revenue'] / data['total_revenue']) * 100
                data['restaurant_pct'] = (data['restaurant_revenue'] / data['total_revenue']) * 100
                data['bar_pct'] = (data['bar_revenue'] / data['total_revenue']) * 100
            
            # Fetch expenses
            expenses_query = self.client.table('expenses').select('*')\
                .gte('date', start_date)\
                .lte('date', end_date)
            if branch_id:
                expenses_query = expenses_query.eq('branch_id', branch_id)
            expenses = expenses_query.execute()
            
            for exp in (expenses.data or []):
                category = (exp.get('category', '') or '').lower()
                amount = exp.get('amount', 0) or 0
                
                if 'payroll' in category or 'salary' in category:
                    data['payroll_expense'] += amount
                elif 'utility' in category or 'electric' in category or 'water' in category:
                    data['utilities_expense'] += amount
                elif 'supply' in category or 'supplies' in category:
                    data['supplies_expense'] += amount
                elif 'maintenance' in category or 'repair' in category:
                    data['maintenance_expense'] += amount
                else:
                    data['other_expense'] += amount
            
            data['total_expenses'] = (data['payroll_expense'] + data['utilities_expense'] + 
                                      data['supplies_expense'] + data['maintenance_expense'] + 
                                      data['other_expense'])
            
            if data['total_expenses'] > 0:
                data['payroll_pct'] = (data['payroll_expense'] / data['total_expenses']) * 100
                data['utilities_pct'] = (data['utilities_expense'] / data['total_expenses']) * 100
                data['supplies_pct'] = (data['supplies_expense'] / data['total_expenses']) * 100
                data['maintenance_pct'] = (data['maintenance_expense'] / data['total_expenses']) * 100
                data['other_exp_pct'] = (data['other_expense'] / data['total_expenses']) * 100
            
            data['net_profit'] = data['total_revenue'] - data['total_expenses']
            if data['total_revenue'] > 0:
                data['profit_margin'] = (data['net_profit'] / data['total_revenue']) * 100
            
        except Exception as e:
            logger.error(f"Error fetching financial summary: {e}")
        
        return data

    def _fetch_inventory_status(self, filters: Dict) -> Dict[str, Any]:
        """Fetch inventory status"""
        branch_id = filters.get('branch_id')
        
        data = {
            'total_items': 0,
            'low_stock_count': 0,
            'out_of_stock': 0,
            'total_value': 0,
            'items': []
        }
        
        if not self.client:
            return data
        
        try:
            query = self.client.table('inventory_items').select('*')
            items = query.execute()
            
            for item in (items.data or []):
                qty = item.get('quantity', 0) or item.get('current_stock', 0) or 0
                min_qty = item.get('min_quantity', 0) or item.get('reorder_level', 0) or 0
                unit_cost = item.get('unit_cost', 0) or item.get('cost', 0) or 0
                
                data['total_items'] += 1
                data['total_value'] += qty * unit_cost
                
                if qty == 0:
                    data['out_of_stock'] += 1
                elif qty < min_qty:
                    data['low_stock_count'] += 1
                
                data['items'].append({
                    'code': item.get('item_code', item.get('sku', '')),
                    'name': item.get('name', ''),
                    'category': item.get('category', ''),
                    'quantity': qty,
                    'min_quantity': min_qty,
                    'unit': item.get('unit', 'pcs'),
                    'value': qty * unit_cost
                })
            
        except Exception as e:
            logger.error(f"Error fetching inventory: {e}")
        
        return data

    def _fetch_housekeeping(self, filters: Dict) -> Dict[str, Any]:
        """Fetch housekeeping performance data"""
        start_date, end_date = self._parse_dates(filters)
        
        data = {
            'rooms_cleaned': 0,
            'avg_time': 0,
            'pass_rate': 0,
            'complaints': 0,
            'utilization': 0,
            'staff': []
        }
        
        if not self.client:
            return data
        
        try:
            tasks = self.client.table('housekeeping_tasks').select('*')\
                .gte('created_at', f'{start_date}T00:00:00')\
                .lte('created_at', f'{end_date}T23:59:59').execute()
            
            completed_tasks = [t for t in (tasks.data or []) if t.get('status') == 'completed']
            data['rooms_cleaned'] = len(completed_tasks)
            
            # Calculate average time
            times = []
            for task in completed_tasks:
                if task.get('started_at') and task.get('completed_at'):
                    try:
                        start = datetime.fromisoformat(task['started_at'].replace('Z', '+00:00'))
                        end = datetime.fromisoformat(task['completed_at'].replace('Z', '+00:00'))
                        times.append((end - start).total_seconds() / 60)
                    except:
                        pass
            
            if times:
                data['avg_time'] = sum(times) / len(times)
            
            # Pass rate (inspected and passed)
            inspected = [t for t in completed_tasks if t.get('inspection_status')]
            passed = [t for t in inspected if t.get('inspection_status') == 'passed']
            if inspected:
                data['pass_rate'] = (len(passed) / len(inspected)) * 100
            
            # Staff performance
            staff_stats = {}
            for task in completed_tasks:
                staff_id = task.get('assigned_to')
                if staff_id:
                    if staff_id not in staff_stats:
                        staff_stats[staff_id] = {'rooms': 0, 'times': [], 'passed': 0, 'inspected': 0}
                    staff_stats[staff_id]['rooms'] += 1
                    
                    if task.get('started_at') and task.get('completed_at'):
                        try:
                            start = datetime.fromisoformat(task['started_at'].replace('Z', '+00:00'))
                            end = datetime.fromisoformat(task['completed_at'].replace('Z', '+00:00'))
                            staff_stats[staff_id]['times'].append((end - start).total_seconds() / 60)
                        except:
                            pass
                    
                    if task.get('inspection_status'):
                        staff_stats[staff_id]['inspected'] += 1
                        if task.get('inspection_status') == 'passed':
                            staff_stats[staff_id]['passed'] += 1
            
            # Get staff names
            if staff_stats:
                staff_ids = list(staff_stats.keys())
                staff_query = self.client.table('users').select('id, full_name')\
                    .in_('id', staff_ids).execute()
                staff_names = {s['id']: s.get('full_name', 'Unknown') for s in (staff_query.data or [])}
                
                for staff_id, stats in staff_stats.items():
                    avg_time = sum(stats['times']) / len(stats['times']) if stats['times'] else 0
                    pass_rate = (stats['passed'] / stats['inspected'] * 100) if stats['inspected'] > 0 else 0
                    
                    data['staff'].append({
                        'name': staff_names.get(staff_id, 'Unknown'),
                        'rooms': stats['rooms'],
                        'avg_time': round(avg_time, 1),
                        'pass_rate': round(pass_rate, 1),
                        'rating': 4.5 if pass_rate > 90 else (4.0 if pass_rate > 80 else 3.5)
                    })
            
        except Exception as e:
            logger.error(f"Error fetching housekeeping data: {e}")
        
        return data

    def _fetch_maintenance(self, filters: Dict) -> Dict[str, Any]:
        """Fetch maintenance log data"""
        start_date, end_date = self._parse_dates(filters)
        
        data = {
            'total_requests': 0,
            'completed': 0,
            'pending': 0,
            'in_progress': 0,
            'avg_resolution': 0,
            'work_orders': []
        }
        
        if not self.client:
            return data
        
        try:
            requests = self.client.table('maintenance_requests').select('*, assigned:users(full_name)')\
                .gte('created_at', f'{start_date}T00:00:00')\
                .lte('created_at', f'{end_date}T23:59:59').execute()
            
            data['total_requests'] = len(requests.data or [])
            
            resolution_times = []
            for req in (requests.data or []):
                status = (req.get('status', '') or '').lower()
                
                if status == 'completed':
                    data['completed'] += 1
                    if req.get('created_at') and req.get('completed_at'):
                        try:
                            created = datetime.fromisoformat(req['created_at'].replace('Z', '+00:00'))
                            completed = datetime.fromisoformat(req['completed_at'].replace('Z', '+00:00'))
                            resolution_times.append((completed - created).total_seconds() / 3600)
                        except:
                            pass
                elif status == 'in_progress' or status == 'in-progress':
                    data['in_progress'] += 1
                else:
                    data['pending'] += 1
                
                assigned = req.get('assigned', {})
                data['work_orders'].append({
                    'id': req.get('id', '')[:8] if req.get('id') else '',
                    'location': req.get('location', req.get('room_number', '')),
                    'issue': req.get('description', req.get('issue', ''))[:50],
                    'priority': req.get('priority', 'Normal'),
                    'status': status.title(),
                    'assigned_to': assigned.get('full_name', 'Unassigned') if assigned else 'Unassigned'
                })
            
            if resolution_times:
                data['avg_resolution'] = round(sum(resolution_times) / len(resolution_times), 1)
            
        except Exception as e:
            logger.error(f"Error fetching maintenance data: {e}")
        
        return data

    def _fetch_payroll(self, filters: Dict) -> Dict[str, Any]:
        """Fetch payroll summary"""
        start_date, end_date = self._parse_dates(filters)
        
        data = {
            'total_gross': 0,
            'total_deductions': 0,
            'paye': 0,
            'nhif': 0,
            'nssf': 0,
            'total_net': 0,
            'employees': []
        }
        
        if not self.client:
            return data
        
        try:
            # Fetch attendance records for the period
            attendance = self.client.table('staff_attendance').select('staff_id, attendance_date, status')\
                .gte('attendance_date', start_date)\
                .lte('attendance_date', end_date).execute()
            attendance_data = attendance.data or []

            # Fetch payroll records
            payroll = self.client.table('payroll').select('*, employee:users(full_name, department)')\
                .gte('pay_date', start_date)\
                .lte('pay_date', end_date).execute()
            
            for record in (payroll.data or []):
                gross = record.get('gross_pay', 0) or 0
                paye = record.get('paye', 0) or 0
                nhif = record.get('nhif', 0) or 0
                nssf = record.get('nssf', 0) or 0
                other_ded = record.get('other_deductions', 0) or 0
                deductions = paye + nhif + nssf + other_ded
                net = gross - deductions
                
                data['total_gross'] += gross
                data['paye'] += paye
                data['nhif'] += nhif
                data['nssf'] += nssf
                data['total_deductions'] += deductions
                data['total_net'] += net
                
                employee = record.get('employee', {})
                staff_id = record.get('staff_id')
                
                # Get attendance summary for this employee in this period
                emp_att = [r for r in attendance_data if r.get('staff_id') == staff_id]
                days_present = len(set([r.get('attendance_date') for r in emp_att if r.get('status') in ['present', 'late']]))
                
                data['employees'].append({
                    'id': record.get('employee_id', '')[:8] if record.get('employee_id') else '',
                    'name': employee.get('full_name', 'Unknown') if employee else 'Unknown',
                    'department': employee.get('department', 'N/A') if employee else 'N/A',
                    'gross': gross,
                    'deductions': deductions,
                    'net': net,
                    'days_present': days_present
                })
            
        except Exception as e:
            logger.error(f"Error fetching payroll data: {e}")
        
        return data

    def _fetch_restaurant_sales(self, filters: Dict) -> Dict[str, Any]:
        """Fetch restaurant sales data"""
        start_date, end_date = self._parse_dates(filters)
        branch_id = filters.get('branch_id')
        
        data = {
            'total_revenue': 0,
            'total_orders': 0,
            'avg_order': 0,
            'dine_in': 0,
            'room_service': 0,
            'takeaway': 0,
            'top_items': []
        }
        
        if not self.client:
            return data
        
        try:
            # First get orders
            orders_query = self.client.table('restaurant_orders').select('*')
            orders_query = orders_query.gte('created_at', f'{start_date}T00:00:00')
            orders_query = orders_query.lte('created_at', f'{end_date}T23:59:59')
            if branch_id:
                orders_query = orders_query.eq('branch_id', int(branch_id))
            
            orders = orders_query.execute()
            data['total_orders'] = len(orders.data or [])
            
            # Get order IDs for fetching items
            order_ids = [order['id'] for order in (orders.data or [])]
            
            if not order_ids:
                return data
            
            # Get order items
            items_query = self.client.table('restaurant_order_items').select('*').in_('order_id', order_ids)
            items_result = items_query.execute()
            
            # Get all unique menu item IDs
            menu_item_ids = list(set([item.get('menu_item_id') for item in (items_result.data or []) if item.get('menu_item_id')]))
            
            # Fetch menu items separately
            menu_items = {}
            if menu_item_ids:
                menu_query = self.client.table('restaurant_menu_items').select('*').in_('id', menu_item_ids)
                menu_result = menu_query.execute()
                
                for menu_item in (menu_result.data or []):
                    menu_items[menu_item['id']] = menu_item
            
            item_sales = {}
            for order in (orders.data or []):
                total = order.get('total_amount', 0) or 0
                data['total_revenue'] += total
                
                order_type = (order.get('order_type', '') or '').lower()
                if 'dine' in order_type or 'table' in order_type:
                    data['dine_in'] += 1
                elif 'room' in order_type:
                    data['room_service'] += 1
                else:
                    data['takeaway'] += 1
            
            # Process items to get menu names
            for item in (items_result.data or []):
                menu_item_id = item.get('menu_item_id')
                menu_item = menu_items.get(menu_item_id, {})
                item_name = menu_item.get('name', f'Item ID {menu_item_id}' if menu_item_id else 'Unknown Item')
                
                qty = item.get('quantity', 1)
                price = item.get('unit_price', 0) or 0
                
                if item_name not in item_sales:
                    item_sales[item_name] = {
                        'quantity': 0, 
                        'revenue': 0, 
                        'category': menu_item.get('category_id', 'Other')
                    }
                item_sales[item_name]['quantity'] += qty
                item_sales[item_name]['revenue'] += qty * price
            
            if data['total_orders'] > 0:
                data['avg_order'] = data['total_revenue'] / data['total_orders']
            
            # Top items
            sorted_items = sorted(item_sales.items(), key=lambda x: x[1]['revenue'], reverse=True)
            data['top_items'] = [
                {'name': name, 'category': stats['category'], 'quantity': stats['quantity'], 'revenue': stats['revenue']}
                for name, stats in sorted_items[:10]
            ]
            
        except Exception as e:
            logger.error(f"Error fetching restaurant sales: {e}")
        
        return data

    def _fetch_room_supplies(self, filters: Dict) -> Dict[str, Any]:
        """Fetch room supplies inventory"""
        data = {'supplies': []}
        
        if not self.client:
            return data
        
        try:
            items = self.client.table('inventory_items').select('*')\
                .or_('category.ilike.%room%,category.ilike.%amenity%,category.ilike.%linen%,category.ilike.%toiletry%')\
                .execute()
            
            for item in (items.data or []):
                data['supplies'].append({
                    'name': item.get('name', ''),
                    'category': item.get('category', ''),
                    'quantity': item.get('quantity', 0) or item.get('current_stock', 0) or 0,
                    'unit': item.get('unit', 'pcs'),
                    'reorder_level': item.get('min_quantity', 0) or item.get('reorder_level', 0) or 0
                })
            
        except Exception as e:
            logger.error(f"Error fetching room supplies: {e}")
        
        return data

    def _fetch_manager_duty(self, filters: Dict) -> Dict[str, Any]:
        """Fetch manager on duty report data"""
        date = filters.get('date', datetime.now().strftime('%Y-%m-%d'))
        
        data = {
            'manager_name': filters.get('manager_name', ''),
            'date': date,
            'time': datetime.now().strftime('%H:%M'),
            'shift': filters.get('shift', 'Day'),
            'arrivals': 0,
            'departures': 0,
            'occupancy': 0,
            'ooo_rooms': 0,
            'checklist': []
        }
        
        if not self.client:
            return data
        
        try:
            # Get arrivals (check-ins today)
            arrivals = self.client.table('bookings').select('id')\
                .eq('check_in', date)\
                .in_('status', ['confirmed', 'checked_in']).execute()
            data['arrivals'] = len(arrivals.data or [])
            
            # Get departures (check-outs today)
            departures = self.client.table('bookings').select('id')\
                .eq('check_out', date).execute()
            data['departures'] = len(departures.data or [])
            
            # Get occupancy
            rooms = self.client.table('rooms').select('id, status').execute()
            total_rooms = len(rooms.data or [])
            occupied = len([r for r in (rooms.data or []) if r.get('status') == 'occupied'])
            ooo = len([r for r in (rooms.data or []) if r.get('status') == 'out_of_order'])
            
            data['ooo_rooms'] = ooo
            if total_rooms > 0:
                data['occupancy'] = round((occupied / total_rooms) * 100)
            
            # Get currently clocked in staff
            attendance_query = self.client.table('staff_attendance')\
                .select('*, staff:staff_profiles(*, user:users(*))')\
                .eq('attendance_date', date)\
                .is_('clock_out', 'null')\
                .execute()
            
            data['clocked_in_staff'] = [
                {
                    'name': f"{r['staff']['user']['first_name']} {r['staff']['user']['last_name']}",
                    'time': r['clock_in']
                } for r in (attendance_query.data or [])
            ]
            
        except Exception as e:
            logger.error(f"Error fetching manager duty data: {e}")
        
        return data

    def _fetch_employee_attendance(self, filters: Dict) -> Dict[str, Any]:
        """Fetch employee attendance data"""
        start_date, end_date = self._parse_dates(filters)
        branch_id = filters.get('branch_id')
        
        data = {
            'total_staff': 0,
            'present_count': 0,
            'late_count': 0,
            'absent_count': 0,
            'leave_count': 0,
            'total_hours': 0,
            'records': []
        }
        
        if not self.client:
            return data
            
        try:
            # Fetch attendance records with staff and user info
            query = self.client.table('staff_attendance').select('*, staff:staff_profiles(*, user:users(*))')
            query = query.gte('attendance_date', start_date)
            query = query.lte('attendance_date', end_date)
            
            # Filter by branch if provided
            # Note: We need to filter by staff_profiles.branch_id
            # Supabase JS client doesn't support deep filtering easily in select, 
            # but we can filter after fetching or use a view/RPC
            
            result = query.execute()
            
            all_records = result.data or []
            
            # Filter by branch manually if needed
            if branch_id:
                all_records = [r for r in all_records if r.get('staff', {}).get('branch_id') == int(branch_id)]
            
            # Group by staff_id
            staff_data = {}
            for record in all_records:
                staff_id = record.get('staff_id')
                if staff_id not in staff_data:
                    staff_data[staff_id] = {
                        'records': [],
                        'total_seconds': 0,
                        'status': 'absent',
                        'staff': record.get('staff', {})
                    }
                
                staff_data[staff_id]['records'].append(record)
                
                # Calculate hours for this shift
                if record.get('clock_in') and record.get('clock_out'):
                    try:
                        clock_in = datetime.fromisoformat(record['clock_in'].replace('Z', '+00:00'))
                        clock_out = datetime.fromisoformat(record['clock_out'].replace('Z', '+00:00'))
                        staff_data[staff_id]['total_seconds'] += (clock_out - clock_in).total_seconds()
                    except:
                        pass
                
                # Update status (if any shift is present/late, mark as such)
                current_status = record.get('status', 'absent')
                if current_status in ['present', 'late']:
                    staff_data[staff_id]['status'] = current_status

            data['total_staff'] = len(staff_data)
            
            total_seconds = 0
            for staff_id, s_info in staff_data.items():
                status = s_info['status']
                if status == 'present': data['present_count'] += 1
                elif status == 'late': data['late_count'] += 1
                elif status == 'absent': data['absent_count'] += 1
                elif status == 'leave': data['leave_count'] += 1
                
                total_seconds += s_info['total_seconds']
                
                staff = s_info['staff']
                user = staff.get('user', {})
                
                # For the detailed records, we still list individual shifts
                for record in s_info['records']:
                    data['records'].append({
                        'date': record.get('attendance_date'),
                        'name': f"{user.get('first_name', '')} {user.get('last_name', '')}",
                        'employee_id': staff.get('id_number', ''),
                        'clock_in': record.get('clock_in'),
                        'clock_out': record.get('clock_out'),
                        'status': record.get('status', 'absent'),
                        'notes': record.get('notes', '')
                    })
            
            data['total_hours'] = round(total_seconds / 3600, 2)
            
        except Exception as e:
            logger.error(f"Error fetching attendance data: {e}")
            
        return data

    def _fetch_reservation(self, filters: Dict) -> Dict[str, Any]:
        """Fetch reservation details for confirmation"""
        booking_id = filters.get('booking_id')
        
        data = {
            'guest_name': '',
            'email': '',
            'phone': '',
            'address': '',
            'id_number': '',
            'confirmation_number': '',
            'check_in': '',
            'check_out': '',
            'room_type': '',
            'room_number': '',
            'guests': 1,
            'special_requests': '',
            'room_rate': 0,
            'nights': 1,
            'subtotal': 0,
            'taxes': 0,
            'total': 0,
            'payment_method': '',
            'payment_status': ''
        }
        
        if not self.client or not booking_id:
            return data
        
        try:
            booking = self.client.table('bookings').select('*, guest:guests(*), room:rooms(*)')\
                .eq('id', booking_id).single().execute()
            
            if booking.data:
                b = booking.data
                guest = b.get('guest', {}) or {}
                room = b.get('room', {}) or {}
                
                data['guest_name'] = guest.get('full_name', guest.get('name', ''))
                data['email'] = guest.get('email', '')
                data['phone'] = guest.get('phone', '')
                data['address'] = guest.get('address', '')
                data['id_number'] = guest.get('id_number', '')
                
                data['confirmation_number'] = b.get('confirmation_number', b.get('id', '')[:8])
                data['check_in'] = b.get('check_in', '')
                data['check_out'] = b.get('check_out', '')
                data['room_type'] = room.get('type', '')
                data['room_number'] = room.get('number', room.get('room_number', ''))
                data['guests'] = b.get('guests', 1)
                data['special_requests'] = b.get('special_requests', '')
                
                data['room_rate'] = b.get('rate', 0) or room.get('rate', 0) or 0
                data['nights'] = b.get('nights', 1)
                data['subtotal'] = data['room_rate'] * data['nights']
                data['taxes'] = b.get('taxes', 0) or 0
                data['total'] = b.get('total_amount', 0) or data['subtotal'] + data['taxes']
                data['payment_method'] = b.get('payment_method', '')
                data['payment_status'] = b.get('payment_status', 'Pending')
            
        except Exception as e:
            logger.error(f"Error fetching reservation: {e}")
        
        return data

    def _fetch_revenue_analysis(self, filters: Dict) -> Dict[str, Any]:
        """Fetch revenue analysis data"""
        return self._fetch_financial_summary(filters)

    def _fetch_stock_movement(self, filters: Dict) -> Dict[str, Any]:
        """Fetch stock movement data"""
        start_date, end_date = self._parse_dates(filters)
        
        data = {'movements': []}
        
        if not self.client:
            return data
        
        try:
            movements = self.client.table('stock_movements').select('*')\
                .gte('created_at', f'{start_date}T00:00:00')\
                .lte('created_at', f'{end_date}T23:59:59')\
                .order('created_at', desc=True).execute()
            
            for m in (movements.data or []):
                data['movements'].append({
                    'date': m.get('created_at', '')[:10],
                    'item_code': m.get('item_code', ''),
                    'item_name': m.get('item_name', ''),
                    'type': m.get('movement_type', ''),
                    'quantity': m.get('quantity', 0),
                    'from': m.get('from_location', ''),
                    'to': m.get('to_location', ''),
                    'reference': m.get('reference', '')
                })
            
        except Exception as e:
            logger.error(f"Error fetching stock movements: {e}")
        
        return data

    def _fetch_arrivals_departures(self, filters: Dict) -> Dict[str, Any]:
        """Fetch arrivals and departures data"""
        date = filters.get('date', datetime.now().strftime('%Y-%m-%d'))
        
        data = {'arrivals': [], 'departures': []}
        
        if not self.client:
            return data
        
        try:
            arrivals = self.client.table('bookings').select('*, guest:guests(full_name), room:rooms(number)')\
                .eq('check_in', date).execute()
            
            for a in (arrivals.data or []):
                guest = a.get('guest', {}) or {}
                room = a.get('room', {}) or {}
                data['arrivals'].append({
                    'guest_name': guest.get('full_name', ''),
                    'room': room.get('number', ''),
                    'time': a.get('expected_arrival', ''),
                    'status': a.get('status', '')
                })
            
            departures = self.client.table('bookings').select('*, guest:guests(full_name), room:rooms(number)')\
                .eq('check_out', date).execute()
            
            for d in (departures.data or []):
                guest = d.get('guest', {}) or {}
                room = d.get('room', {}) or {}
                data['departures'].append({
                    'guest_name': guest.get('full_name', ''),
                    'room': room.get('number', ''),
                    'time': d.get('expected_departure', ''),
                    'status': d.get('status', '')
                })
            
        except Exception as e:
            logger.error(f"Error fetching arrivals/departures: {e}")
        
        return data

    def _fetch_expenses(self, filters: Dict) -> Dict[str, Any]:
        """Fetch expense report data"""
        start_date, end_date = self._parse_dates(filters)
        
        data = {
            'total_expenses': 0,
            'by_category': [],
            'expenses': []
        }
        
        if not self.client:
            return data
        
        try:
            expenses = self.client.table('expenses').select('*')\
                .gte('date', start_date)\
                .lte('date', end_date)\
                .order('date', desc=True).execute()
            
            category_totals = {}
            for exp in (expenses.data or []):
                amount = exp.get('amount', 0) or 0
                category = exp.get('category', 'Other')
                
                data['total_expenses'] += amount
                category_totals[category] = category_totals.get(category, 0) + amount
                
                data['expenses'].append({
                    'date': exp.get('date', ''),
                    'description': exp.get('description', ''),
                    'category': category,
                    'amount': amount,
                    'vendor': exp.get('vendor', ''),
                    'status': exp.get('status', '')
                })
            
            data['by_category'] = [
                {'category': cat, 'amount': amt, 'pct': (amt / data['total_expenses'] * 100) if data['total_expenses'] > 0 else 0}
                for cat, amt in category_totals.items()
            ]
            
        except Exception as e:
            logger.error(f"Error fetching expenses: {e}")
        
        return data

    def _fetch_kpi_dashboard(self, filters: Dict) -> Dict[str, Any]:
        """Fetch KPI dashboard data"""
        start_date, end_date = self._parse_dates(filters)
        branch_id = filters.get('branch_id')
        
        data = {
            'revenue': 0,
            'occupancy': 0,
            'attendance_rate': 0,
            'punctuality_rate': 0,
            'total_staff': 0,
            'present_staff': 0,
            'late_staff': 0,
            'revenue_by_source': {},
            'daily_stats': []
        }
        
        if not self.client:
            return data
            
        try:
            # 1. Revenue
            sales = self._fetch_daily_sales(filters)
            data['revenue'] = sales.get('total_revenue', 0)
            
            # 2. Occupancy
            occ = self._fetch_occupancy(filters)
            data['occupancy'] = occ.get('occupancy_rate', 0)
            
            # 3. Attendance
            att = self._fetch_employee_attendance(filters)
            data['total_staff'] = att.get('total_staff', 0)
            data['present_staff'] = att.get('present_count', 0)
            data['late_staff'] = att.get('late_count', 0)
            
            if data['total_staff'] > 0:
                data['attendance_rate'] = round((data['present_staff'] / data['total_staff']) * 100, 1)
                if data['present_staff'] > 0:
                    data['punctuality_rate'] = round(((data['present_staff'] - data['late_staff']) / data['present_staff']) * 100, 1)

        except Exception as e:
            logger.error(f"Error fetching KPI dashboard: {e}")
            
        return data

    def _fetch_bar_sales(self, filters: Dict) -> Dict[str, Any]:
        """Fetch bar sales data"""
        start_date, end_date = self._parse_dates(filters)
        branch_id = filters.get('branch_id')
        
        data = {
            'total_revenue': 0,
            'total_orders': 0,
            'avg_order': 0,
            'top_items': []
        }
        
        if not self.client:
            return data
        
        try:
            query = self.client.table('bar_orders').select('*, items:bar_order_items(*)')
            query = query.gte('created_at', f'{start_date}T00:00:00')
            query = query.lte('created_at', f'{end_date}T23:59:59')
            if branch_id:
                query = query.eq('branch_id', branch_id)
            
            orders = query.execute()
            
            data['total_orders'] = len(orders.data or [])
            
            item_sales = {}
            for order in (orders.data or []):
                data['total_revenue'] += order.get('total', 0) or 0
                
                for item in (order.get('items', []) or []):
                    item_name = item.get('name', 'Unknown')
                    qty = item.get('quantity', 1)
                    price = item.get('price', 0) or 0
                    
                    if item_name not in item_sales:
                        item_sales[item_name] = {'quantity': 0, 'revenue': 0}
                    item_sales[item_name]['quantity'] += qty
                    item_sales[item_name]['revenue'] += qty * price
            
            if data['total_orders'] > 0:
                data['avg_order'] = data['total_revenue'] / data['total_orders']
            
            sorted_items = sorted(item_sales.items(), key=lambda x: x[1]['revenue'], reverse=True)
            data['top_items'] = [
                {'name': name, 'quantity': stats['quantity'], 'revenue': stats['revenue']}
                for name, stats in sorted_items[:10]
            ]
            
        except Exception as e:
            logger.error(f"Error fetching bar sales: {e}")
        
        return data
