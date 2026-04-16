"""
Kyogong - Database Data Fetcher
Direct database connection for accurate report data
"""

import os
import logging
import calendar
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

try:
    from supabase import create_client, Client
except ImportError:
    create_client = None
    Client = object

logger = logging.getLogger(__name__)


class DatabaseFetcher:
    """Fetch real data directly from Supabase database"""
    
    def __init__(self):
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_ANON_KEY')
        self.client: Optional[Client] = None
        self._connect()
    
    def _connect(self):
        """Establish database connection"""
        if create_client is None:
            logger.warning("Supabase client not found. Database features disabled.")
            return

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
            # Aliases for common IDs used in frontend (match BrandedPDFGenerator)
            aliases = {
                'inventory_status_report': 'inventory_status',
                'exception_summary': 'exception_logs',
                'void_analytics': 'exception_logs',
                'leakage_report': 'reconciliation_audit',
                'expenditure_audit': 'expense',
                'variance_report': 'financial_variance',
                'consumption_audit': 'inventory_discrepancy',
                'grn_audit': 'procurement_analysis',
                'compliance_audit': 'compliance'
            }
            report_type = aliases.get(report_type, report_type)
            
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
                'financial_variance': self._fetch_financial_variance,
                'inventory_discrepancy': self._fetch_inventory_discrepancy,
                'procurement_analysis': self._fetch_procurement_analysis,
                'exception_logs': self._fetch_exception_logs,
                'reconciliation_audit': self._fetch_reconciliation_audit,
                'sold_items_analytics': self._fetch_sold_items_agg,
                'branch_performance': self._fetch_branch_performance,
                'stock_usage': self._fetch_stock_usage,
                'employee_credit': self._fetch_employee_credit,
                'conference_summary': self._fetch_conference_reports,
                'kitchen_ledger': self._fetch_kitchen_ledger,
                'kitchen_item_ledger': self._fetch_kitchen_item_ledger,
                'vat_report': self._fetch_vat_report,
                'procurement_intelligence': self._fetch_procurement_intelligence,
                'supplier_statement': self._fetch_supplier_statement,
                'revenue_reconciliation': self._fetch_revenue_reconciliation,
                'sales_performance': self._fetch_sales_performance,
                'staff_performance': self._fetch_staff_performance,
            }
            
            fetcher = fetchers.get(report_type)
            if fetcher:
                logger.info(f"Fetching data for report type: {report_type} with filters: {filters}")
                data = fetcher(filters)
                
                # CRITICAL FIX: Ensure data is never None and always has proper structure
                if data is None:
                    logger.warning(f"Fetcher returned None for {report_type}, using empty structure")
                    data = self._get_empty_structure(report_type)
                
                # Log data summary for debugging
                if isinstance(data, dict):
                    logger.info(f"Data fetched for {report_type}: {len(data)} keys, has_error: {data.get('error') is not None}")
                    # Log key data points
                    for key in ['items', 'voided_orders', 'total_revenue', 'total_items']:
                        if key in data:
                            value = data[key]
                            if isinstance(value, list):
                                logger.info(f"  {key}: {len(value)} items")
                            else:
                                logger.info(f"  {key}: {value}")
                
                # Automatically fetch AI insights for the report
                if data and not data.get('error'):
                    try:
                        ai_insights = self._fetch_ai_insights(report_type, data, filters)
                        if ai_insights:
                            data['ai_insights'] = ai_insights
                    except Exception as e:
                        logger.warning(f"Failed to fetch AI insights: {e}")
                        # Don't fail the report if AI insights fail
                
                return data
            else:
                logger.warning(f"Unknown report type: {report_type}")
                return self._get_empty_structure(report_type, error=f'Unknown report type: {report_type}')
        except Exception as e:
            logger.error(f"Error fetching {report_type} data: {e}", exc_info=True)
            return self._get_empty_structure(report_type, error=str(e))
    
    def _get_empty_structure(self, report_type: str, error: str = None) -> Dict[str, Any]:
        """Return proper empty structure for each report type to prevent PDF generation errors"""
        base = {
            'report_type': report_type,
            'generated_at': datetime.now().isoformat(),
            'has_data': False
        }
        
        if error:
            base['error'] = error
            base['error_message'] = f"No data available: {error}"
        
        # Report-specific empty structures
        structures = {
            'inventory_status': {
                **base,
                'total_items': 0,
                'low_stock_count': 0,
                'out_of_stock': 0,
                'total_value': 0,
                'items': []
            },
            'exception_logs': {
                **base,
                'voided_orders': [],
                'cancelled_bookings': [],
                'high_discounts': [],
                'total_exception_value': 0
            },
            'reconciliation_audit': {
                **base,
                'reconciliation_items': [],
                'total_leakage_value': 0,
                'summary': {'total_dispatched': 0, 'total_sold': 0}
            },
            'branch_performance': {
                **base,
                'period': {'start': '', 'end': ''},
                'sales': {'restaurant': 0, 'bar': 0, 'total': 0},
                'expenses': {'total': 0, 'breakdown': {}},
                'netProfit': 0,
                'profitMargin': 0
            },
            'stock_usage': {
                **base,
                'items': []
            },
            'employee_credit': {
                **base,
                'summary': {
                    'current': 0,
                    'overdue_30': 0,
                    'overdue_60': 0,
                    'overdue_90': 0,
                    'total_outstanding': 0
                },
                'bills': []
            },
            'sales_performance': {
                **base,
                'analysis': [],
                'summary': {
                    'total_items_sold': 0,
                    'total_quantity_sold': 0,
                    'total_revenue': 0
                }
            },
            'staff_performance': {
                **base,
                'period': {},
                'branch': 'All Branches',
                'staff_performance': [],
                'summary': {
                    'total_staff': 0,
                    'total_sales': 0,
                    'total_tips': 0,
                    'avg_attendance': 0
                }
            }
        }
        
        return structures.get(report_type, base)


    def _parse_dates(self, filters: Dict) -> tuple:
        """Parse date filters"""
        # Default to today if no dates provided
        today = datetime.now().strftime('%Y-%m-%d')
        start_date = filters.get('start_date', filters.get('startDate', filters.get('from_date', today)))
        end_date = filters.get('end_date', filters.get('endDate', filters.get('to_date', today)))
        
        # Log the dates being used for debugging
        logger.info(f"Parsing dates - start: {start_date}, end: {end_date}, branch_id: {filters.get('branch_id')}")
        return start_date, end_date

    def _parse_branch_ids(self, filters: Dict) -> List[int]:
        """Extract branch IDs from filters"""
        branch_ids = filters.get('branch_ids', [])
        if not branch_ids and filters.get('branch_id'):
            try:
                branch_ids = [int(filters.get('branch_id'))]
            except (ValueError, TypeError):
                pass
        
        # If string comma separated, split it
        if isinstance(branch_ids, str):
            try:
                branch_ids = [int(b.strip()) for b in branch_ids.split(',') if b.strip()]
            except ValueError:
                branch_ids = []
                
        return branch_ids

    def _apply_branch_filter(self, query, filters: Dict, column: str = 'branch_id'):
        """Apply single or multiple branch filter to a query"""
        branch_ids = self._parse_branch_ids(filters)
        if branch_ids:
            if len(branch_ids) == 1:
                return query.eq(column, branch_ids[0])
            else:
                return query.in_(column, branch_ids)
        return query
    
    def _fetch_ai_insights(self, report_type: str, data: Dict[str, Any], filters: Dict[str, Any]) -> str:
        """
        Fetch AI-generated insights for a report.
        Returns a text summary that can be included in the PDF.
        """
        try:
            import os
            import google.genai
            from google import genai
            
            api_key = os.getenv('GEMINI_API_KEY')
            if not api_key:
                logger.info("GEMINI_API_KEY not set, skipping AI insights")
                return ""
            
            client = genai.Client(api_key=api_key)
            
            # Construct a natural language prompt based on report type and data
            branch_name = filters.get('branch_name', 'All Branches')
            start_date = filters.get('start_date', 'N/A')
            end_date = filters.get('end_date', 'N/A')
            
            # Extract key metrics from data for context
            summary_text = ""
            if 'summary' in data:
                summary_text = f"Summary metrics: {str(data['summary'])[:300]}"
            elif 'total_revenue' in data:
                summary_text = f"Total revenue: {data.get('total_revenue', 0)}"
            
            # Create a focused prompt for executive summary
            prompt = f"""You are a business analyst reviewing a {report_type.replace('_', ' ')} report for {branch_name} covering the period from {start_date} to {end_date}.

{summary_text}

Provide a brief executive summary (2-3 sentences maximum) that:
1. Highlights the most important finding or trend
2. Identifies any notable concern or achievement
3. Suggests one actionable recommendation

Be concise, specific, and business-focused. Do not use bullet points or markdown formatting."""

            response = client.models.generate_content(
                model='gemini-1.5-flash',
                contents=prompt
            )
            
            if response and response.text:
                # Clean up the response
                insights = response.text.strip()
                # Remove any markdown formatting that might have slipped through
                insights = insights.replace('**', '').replace('*', '').replace('#', '')
                return insights
            else:
                logger.warning("AI insights generation returned empty response")
                return ""
                
        except Exception as e:
            logger.error(f"Error fetching AI insights: {e}")
            return ""  # Return empty string on error, don't break report generation
    
    def _fetch_revenue_reconciliation(self, filters: Dict) -> Dict[str, Any]:
        """Fetch comprehensive revenue reconciliation data"""
        start_date, end_date = self._parse_dates(filters)
        
        data = {
            'total_revenue': 0,
            'sales': 0,
            'variance': 0,
            'departments': {
                'restaurant': 0,
                'bar': 0,
                'accommodation': 0,
                'events': 0,
                'pos': 0,
                'pool': 0,
                'other': 0
            },
            'payment_modes': {
                'cash': 0,
                'mpesa': 0,
                'card': 0,
                'other': 0
            },
            'cashier_summaries': {}, # Map of user_id -> summary
            'transactions': []
        }
        
        if not self.client:
            return data
            
        try:
            # 1. Fetch ALL payments for the period (all statuses — cash=completed, mpesa/card=pending until verified)
            payments_query = self.client.table('payments').select('*')\
                .gte('created_at', f'{start_date}T00:00:00')\
                .lte('created_at', f'{end_date}T23:59:59')\
                .in_('status', ['completed', 'pending', 'verified', 'approved'])
                
            payments_response = payments_query.execute()
            all_payments = payments_response.data or []

            # 1b. Also fetch from payment_verifications (the primary payments table used by cashiers)
            pv_query = self.client.table('payment_verifications').select('*')\
                .gte('recorded_at', f'{start_date}T00:00:00')\
                .lte('recorded_at', f'{end_date}T23:59:59')
            pv_response = pv_query.execute()
            pv_payments = pv_response.data or []

            # Normalize payment_verifications to match payments structure
            for pv in pv_payments:
                all_payments.append({
                    'id': pv.get('id'),
                    'amount': pv.get('amount'),
                    'payment_method': pv.get('payment_method'),
                    'status': pv.get('status', 'completed'),
                    'reference': pv.get('reference_number'),
                    'created_at': pv.get('recorded_at'),
                    'branch_id': pv.get('branch_id'),
                    'created_by': pv.get('recorded_by'),
                    'restaurant_order_id': None,
                    'bar_order_id': None,
                    'booking_id': None,
                    'pos_transaction_id': None,
                    'outside_catering_id': None,
                    'restaurant_pool_token_sales_id': None,
                    '_source': 'payment_verification'
                })
            
            # 2. Get Branch IDs to filter
            branch_ids = self._parse_branch_ids(filters)
            
            # 3. Fetch theoretical sales to calculate variance
            # Restaurant Orders
            rest_sales_query = self.client.table('restaurant_orders').select('total_amount, branch_id')\
                .gte('created_at', f'{start_date}T00:00:00')\
                .lte('created_at', f'{end_date}T23:59:59')\
                .in_('status', ['completed', 'paid', 'delivered'])
            if branch_ids:
                if len(branch_ids) == 1: rest_sales_query = rest_sales_query.eq('branch_id', branch_ids[0])
                else: rest_sales_query = rest_sales_query.in_('branch_id', branch_ids)
            
            rest_sales_res = rest_sales_query.execute()
            data['sales'] += sum(float(o.get('total_amount', 0) or 0) for o in (rest_sales_res.data or []))

            # Bar Orders
            bar_sales_query = self.client.table('bar_orders').select('total, branch_id')\
                .gte('created_at', f'{start_date}T00:00:00')\
                .lte('created_at', f'{end_date}T23:59:59')\
                .in_('status', ['completed', 'paid', 'closed'])
            if branch_ids:
                if len(branch_ids) == 1: bar_sales_query = bar_sales_query.eq('branch_id', branch_ids[0])
                else: bar_sales_query = bar_sales_query.in_('branch_id', branch_ids)
            
            bar_sales_res = bar_sales_query.execute()
            data['sales'] += sum(float(o.get('total', o.get('total_amount', 0)) or 0) for o in (bar_sales_res.data or []))

            # Reservations
            res_sales_query = self.client.table('reservations').select('total_amount, branch_id')\
                .gte('created_at', f'{start_date}T00:00:00')\
                .lte('created_at', f'{end_date}T23:59:59')\
                .in_('status', ['confirmed', 'checked_in', 'checked_out'])
            if branch_ids:
                if len(branch_ids) == 1: res_sales_query = res_sales_query.eq('branch_id', branch_ids[0])
                else: res_sales_query = res_sales_query.in_('branch_id', branch_ids)
            
            res_sales_res = res_sales_query.execute()
            data['sales'] += sum(float(o.get('total_amount', 0) or 0) for o in (res_sales_res.data or []))

            # Catering & Events
            event_sales_query = self.client.table('outside_catering_bookings').select('total_amount, branch_id')\
                .gte('event_date', start_date)\
                .lte('event_date', end_date)\
                .in_('status', ['confirmed', 'completed'])
            if branch_ids:
                if len(branch_ids) == 1: event_sales_query = event_sales_query.eq('branch_id', branch_ids[0])
                else: event_sales_query = event_sales_query.in_('branch_id', branch_ids)
            
            event_sales_res = event_sales_query.execute()
            data['sales'] += sum(float(o.get('total_amount', 0) or 0) for o in (event_sales_res.data or []))

            # POS Transactions
            pos_sales_query = self.client.table('pos_transactions').select('total_amount, branch_id')\
                .gte('created_at', f'{start_date}T00:00:00')\
                .lte('created_at', f'{end_date}T23:59:59')
            if branch_ids:
                if len(branch_ids) == 1: pos_sales_query = pos_sales_query.eq('branch_id', branch_ids[0])
                else: pos_sales_query = pos_sales_query.in_('branch_id', branch_ids)
            
            pos_sales_res = pos_sales_query.execute()
            data['sales'] += sum(float(o.get('total_amount') or 0) for o in (pos_sales_res.data or []))

            # Pool Token Sales
            pool_sales_query = self.client.table('restaurant_pool_token_sales').select('total_amount, branch_id')\
                .gte('created_at', f'{start_date}T00:00:00')\
                .lte('created_at', f'{end_date}T23:59:59')
            if branch_ids:
                if len(branch_ids) == 1: pool_sales_query = pool_sales_query.eq('branch_id', branch_ids[0])
                else: pool_sales_query = pool_sales_query.in_('branch_id', branch_ids)
            
            pool_sales_res = pool_sales_query.execute()
            for sale in (pool_sales_res.data or []):
                val = float(sale.get('total_amount', 0) or 0)
                data['sales'] += val

            # 4. Aggregation and Filtering (In-Memory Branch Filtering logic similar to backend)
            # Since payments don't have branch_id, we infer from related tables or treat as global if missing
            
            # Fetch related IDs
            booking_ids = list(set([p.get('booking_id') for p in all_payments if p.get('booking_id')]))
            order_ids = list(set([p.get('restaurant_order_id') for p in all_payments if p.get('restaurant_order_id')]))
            bar_ids = list(set([p.get('bar_order_id') for p in all_payments if p.get('bar_order_id')]))
            event_ids = list(set([p.get('outside_catering_id') for p in all_payments if p.get('outside_catering_id')]))
            pos_txn_ids = list(set([p.get('pos_transaction_id') for p in all_payments if p.get('pos_transaction_id')]))
            
            # Fetch mappings
            map_data = {}
            if booking_ids:
                res = self.client.table('reservations').select('id, branch_id, created_by').in_('id', booking_ids).execute()
                for item in (res.data or []): 
                    map_data[f"booking_{item['id']}"] = item.get('branch_id')
                    map_data[f"booking_user_{item['id']}"] = item.get('created_by')
                
            if order_ids:
                res = self.client.table('restaurant_orders').select('id, branch_id, created_by').in_('id', order_ids).execute()
                for item in (res.data or []): 
                    map_data[f"rest_{item['id']}"] = item.get('branch_id')
                    map_data[f"rest_user_{item['id']}"] = item.get('created_by')
                
            if bar_ids:
                res = self.client.table('bar_orders').select('id, branch_id, created_by').in_('id', bar_ids).execute()
                for item in (res.data or []): 
                    map_data[f"bar_{item['id']}"] = item.get('branch_id')
                    map_data[f"bar_user_{item['id']}"] = item.get('created_by')

            if event_ids:
                res = self.client.table('outside_catering_bookings').select('id, branch_id, created_by').in_('id', event_ids).execute()
                for item in (res.data or []):
                    map_data[f"event_{item['id']}"] = item.get('branch_id')
                    map_data[f"event_user_{item['id']}"] = item.get('created_by')

            if pos_txn_ids:
                res = self.client.table('pos_transactions').select('id, branch_id, cashier_id').in_('id', pos_txn_ids).execute()
                for item in (res.data or []):
                    map_data[f"pos_{item['id']}"] = item.get('branch_id')
                    map_data[f"pos_user_{item['id']}"] = item.get('cashier_id')
                
            # Filter and Aggregate
            active_user_ids = []
            for payment in all_payments:
                pid = payment.get('branch_id')
                uid = payment.get('created_by')
                
                # Infer branch and user if missing
                if not pid:
                    if payment.get('booking_id'):
                        pid = map_data.get(f"booking_{payment.get('booking_id')}")
                        if not uid: uid = map_data.get(f"booking_user_{payment.get('booking_id')}")
                    elif payment.get('restaurant_order_id'):
                        pid = map_data.get(f"rest_{payment.get('restaurant_order_id')}")
                        if not uid: uid = map_data.get(f"rest_user_{payment.get('restaurant_order_id')}")
                    elif payment.get('bar_order_id'):
                        pid = map_data.get(f"bar_{payment.get('bar_order_id')}")
                        if not uid: uid = map_data.get(f"bar_user_{payment.get('bar_order_id')}")
                    elif payment.get('outside_catering_id'):
                        pid = map_data.get(f"event_{payment.get('outside_catering_id')}")
                        if not uid: uid = map_data.get(f"event_user_{payment.get('outside_catering_id')}")
                    elif payment.get('pos_transaction_id'):
                        pid = map_data.get(f"pos_{payment.get('pos_transaction_id')}")
                        if not uid: uid = map_data.get(f"pos_user_{payment.get('pos_transaction_id')}")
                
                # Apply Branch Filter
                if branch_ids and (pid not in branch_ids):
                    continue
                    
                amount = float(payment.get('amount', 0) or 0)
                method = (payment.get('payment_method') or 'other').lower()
                
                # Add to totals
                data['total_revenue'] += amount
                
                # Add to modes
                if 'cash' in method: data['payment_modes']['cash'] += amount
                elif 'mpesa' in method: data['payment_modes']['mpesa'] += amount
                elif 'card' in method: data['payment_modes']['card'] += amount
                else: data['payment_modes']['other'] += amount
                
                # Add to departments
                if payment.get('booking_id'): data['departments']['accommodation'] += amount
                elif payment.get('restaurant_order_id'): data['departments']['restaurant'] += amount
                elif payment.get('bar_order_id'): data['departments']['bar'] += amount
                elif payment.get('outside_catering_id'): data['departments']['events'] += amount
                elif payment.get('pos_transaction_id'): data['departments']['pos'] += amount
                elif payment.get('restaurant_pool_token_sales_id'): data['departments']['pool'] += amount
                elif payment.get('_source') == 'payment_verification':
                    # Categorize by payment method for payment_verifications
                    data['departments']['other'] += amount
                else: data['departments']['other'] += amount
                
                # Cashier Summary
                if uid:
                    if uid not in data['cashier_summaries']:
                        data['cashier_summaries'][uid] = {'total_amount': 0, 'payment_count': 0, 'cashier_name': 'Unknown'}
                        active_user_ids.append(uid)
                    data['cashier_summaries'][uid]['total_amount'] += amount
                    data['cashier_summaries'][uid]['payment_count'] += 1

                # Add transaction (limit to top 100 for report)
                if len(data['transactions']) < 100:
                    data['transactions'].append({
                        'date': payment.get('created_at'),
                        'reference': payment.get('reference') or payment.get('reference_number') or '',
                        'amount': amount,
                        'method': method,
                        'type': 'Booking' if payment.get('booking_id') else 'Order' if payment.get('restaurant_order_id') else 'Bar' if payment.get('bar_order_id') else 'Catering' if payment.get('outside_catering_id') else 'POS' if payment.get('pos_transaction_id') else 'Payment'
                    })

            # Fetch User Names for summaries
            if active_user_ids:
                users_res = self.client.table('users').select('id, first_name, last_name').in_('id', active_user_ids).execute()
                for u in (users_res.data or []):
                    name = f"{u.get('first_name', '')} {u.get('last_name', '')}".strip()
                    if u['id'] in data['cashier_summaries']:
                        data['cashier_summaries'][u['id']]['cashier_name'] = name

            # Convert map to list for generator
            data['cashier_summaries'] = sorted(list(data['cashier_summaries'].values()), key=lambda x: x['total_amount'], reverse=True)
            
            # Calculate Variance
            data['variance'] = data['total_revenue'] - data['sales']
                    
        except Exception as e:
            logger.error(f"Error fetching revenue reconciliation: {e}")
            
        return data

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
            query = self._apply_branch_filter(query, filters)
            
            restaurant_orders = query.execute()
            
            # Fetch bar orders (Only paid or partial)
            bar_query = self.client.table('bar_orders').select('*')
            bar_query = bar_query.gte('created_at', f'{start_date}T00:00:00')
            bar_query = bar_query.lte('created_at', f'{end_date}T23:59:59')
            bar_query = bar_query.in_('payment_status', ['paid', 'partial'])
            bar_query = self._apply_branch_filter(bar_query, filters)
            
            bar_orders = bar_query.execute()
            
            # Fetch reservations (replacing bookings)
            res_query = self.client.table('reservations').select('*')
            res_query = res_query.gte('created_at', f'{start_date}T00:00:00')
            res_query = res_query.lte('created_at', f'{end_date}T23:59:59')
            # Statuses that imply some revenue or commitment
            res_query = res_query.in_('status', ['confirmed', 'checked_in', 'checked_out'])
            res_query = self._apply_branch_filter(res_query, filters)
            
            reservations = res_query.execute()
            
            # Fetch receipts for additional revenue tracking
            receipts_query = self.client.table('receipts').select('*')
            receipts_query = receipts_query.gte('created_at', f'{start_date}T00:00:00')
            receipts_query = receipts_query.lte('created_at', f'{end_date}T23:59:59')
            receipts_query = receipts_query.eq('payment_status', 'paid')
            
            receipts = receipts_query.execute()
            
            # Fetch actual completed payments for the period - most accurate source
            payments_query = self.client.table('payments').select('*')\
                .gte('created_at', f'{start_date}T00:00:00')\
                .lte('created_at', f'{end_date}T23:59:59')\
                .eq('status', 'completed')
            
            actual_payments = payments_query.execute()
            
            # Sum by category from payments table
            restaurant_total = sum(float(p.get('amount') or 0) for p in (actual_payments.data or []) if p.get('restaurant_order_id'))
            # Note: payments.booking_id links to reservations.id
            booking_total = sum(float(p.get('amount') or 0) for p in (actual_payments.data or []) if p.get('booking_id'))
            # Bar orders might be linked via bar_order_id
            bar_total_from_payments = sum(float(p.get('amount') or 0) for p in (actual_payments.data or []) if p.get('bar_order_id'))
            
            # If bar orders are not in payments table, we fallback to bar_orders table for those not covered
            bar_total = bar_total_from_payments
            if bar_total == 0:
                bar_total = sum(float(o.get('total', o.get('total_amount', 0)) or 0) for o in (bar_orders.data or []))
                
            receipts_total = sum(float(r.get('total_amount', 0) or 0) for r in (receipts.data or []))
            
            # Log the data for debugging
            logger.info(f"Daily sales calculation (Verified) - Restaurant: {restaurant_total}, Bar: {bar_total}, Reservations: {booking_total}, Receipts: {receipts_total}")
            
            data['total_revenue'] = restaurant_total + bar_total + booking_total + receipts_total
            data['total_transactions'] = len(actual_payments.data or []) + (len(bar_orders.data or []) if bar_total_from_payments == 0 else 0) + len(receipts.data or [])
            
            if data['total_transactions'] > 0:
                data['avg_transaction'] = data['total_revenue'] / data['total_transactions']
            
            # Payment method breakdown from verified payments
            for p in (actual_payments.data or []):
                method = (p.get('payment_method') or '').lower()
                amount = float(p.get('amount') or 0)
                if 'cash' in method:
                    data['cash_sales'] += amount
                elif 'card' in method:
                    data['card_sales'] += amount
                elif 'mpesa' in method or 'm-pesa' in method:
                    data['mpesa_sales'] += amount
            
            # Categories
            data['categories'] = [
                {'name': 'Restaurant', 'quantity': len([p for p in (actual_payments.data or []) if p.get('restaurant_order_id')]), 'total': restaurant_total},
                {'name': 'Bar & Lounge', 'quantity': len(bar_orders.data or []) if bar_total_from_payments == 0 else len([p for p in (actual_payments.data or []) if p.get('bar_order_id')]), 'total': bar_total},
                {'name': 'Room Bookings', 'quantity': len(reservations.data or []), 'total': booking_total},
                {'name': 'Other Sales', 'quantity': len(receipts.data or []), 'total': receipts_total},
            ]
            
        except Exception as e:
            logger.error(f"Error fetching daily sales: {e}", exc_info=True)
        
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
            rooms_query = self._apply_branch_filter(rooms_query, filters)
            rooms = rooms_query.execute()
            
            # Fetch active reservations (replacing bookings)
            res_query = self.client.table('reservations').select('*, room:rooms(*)')
            res_query = res_query.lte('check_in_date', end_date)
            res_query = res_query.gte('check_out_date', start_date)
            res_query = res_query.in_('status', ['confirmed', 'checked_in'])
            res_query = self._apply_branch_filter(res_query, filters)
            
            reservations = res_query.execute()
            
            total_rooms = len(rooms.data or [])
            occupied_room_ids = set(b.get('room_id') for b in (reservations.data or []) if b.get('room_id'))
            occupied_rooms = len(occupied_room_ids)
            
            data['total_rooms'] = total_rooms
            data['occupied_rooms'] = occupied_rooms
            data['available_rooms'] = total_rooms - occupied_rooms
            
            if total_rooms > 0:
                data['occupancy_rate'] = (occupied_rooms / total_rooms) * 100
            
            # Calculate ADR and RevPAR
            total_revenue = sum(float(b.get('total_amount', 0) or 0) for b in (reservations.data or []))
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
            
            for reservation in (reservations.data or []):
                room = reservation.get('room', {})
                rt = room.get('type', 'Standard') if room else 'Standard'
                if rt in room_type_stats:
                    room_type_stats[rt]['revenue'] += float(reservation.get('total_amount', 0) or 0)
            
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
            logger.error(f"Error fetching occupancy: {e}", exc_info=True)
        
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
            # Revenue from reservations (replacing bookings)
            res_query = self.client.table('reservations').select('total_amount')\
                .gte('created_at', f'{start_date}T00:00:00')\
                .lte('created_at', f'{end_date}T23:59:59')\
                .in_('status', ['confirmed', 'checked_in', 'checked_out'])
            res_query = self._apply_branch_filter(res_query, filters)
            reservations = res_query.execute()
            data['room_revenue'] = sum(float(b.get('total_amount', 0) or 0) for b in (reservations.data or []))
            
            # Revenue from restaurant
            restaurant_query = self.client.table('restaurant_orders').select('total_amount')\
                .gte('created_at', f'{start_date}T00:00:00')\
                .lte('created_at', f'{end_date}T23:59:59')
            restaurant_query = self._apply_branch_filter(restaurant_query, filters)
            restaurant = restaurant_query.execute()
            data['restaurant_revenue'] = sum(o.get('total_amount', 0) or 0 for o in (restaurant.data or []))
            
            # Revenue from bar
            bar_query = self.client.table('bar_orders').select('total_amount')\
                .gte('created_at', f'{start_date}T00:00:00')\
                .lte('created_at', f'{end_date}T23:59:59')
            bar_query = self._apply_branch_filter(bar_query, filters)
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
                .gte('expense_date', start_date)\
                .lte('expense_date', end_date)
            expenses_query = self._apply_branch_filter(expenses_query, filters)
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
            # If Branch 1 (Central) or no branch specified, use simple_items
            if not branch_id or str(branch_id) == '1':
                query = self.client.table('simple_items').select('*').eq('is_active', True)
                items = query.execute()
                
                for item in (items.data or []):
                    qty = item.get('quantity', 0) or 0
                    min_qty = item.get('reorder_level', 0) or 0
                    unit_cost = item.get('cost_price', 0) or 0
                    
                    data['total_items'] += 1
                    data['total_value'] += qty * unit_cost
                    
                    if qty <= 0:
                        data['out_of_stock'] += 1
                    elif qty < min_qty:
                        data['low_stock_count'] += 1
                    
                    data['items'].append({
                        'code': item.get('sku', ''),
                        'name': item.get('item_name', item.get('description', '')),
                        'category': item.get('category', ''),
                        'quantity': qty,
                        'min_quantity': min_qty,
                        'unit': item.get('unit_of_measure', 'pcs'),
                        'value': qty * unit_cost,
                        # Excel compatibility
                        'itemCode': item.get('sku', ''),
                        'itemName': item.get('item_name', item.get('description', '')),
                        'currentStock': qty,
                        'minStock': min_qty
                    })
            else:
                # Use branch_stock table which joins with simple_items
                query = self.client.table('branch_stock').select('*, item:simple_items(*)').eq('branch_id', branch_id)
                items = query.execute()
                
                for entry in (items.data or []):
                    item = entry.get('item', {}) or {}
                    qty = entry.get('quantity', 0) or 0
                    # For branches, we might not have a specific min_qty, use global or default
                    min_qty = entry.get('reorder_level') or item.get('reorder_level', 0) or 0
                    unit_cost = item.get('cost_price', 0) or 0
                    
                    data['total_items'] += 1
                    data['total_value'] += qty * unit_cost
                    
                    if qty <= 0:
                        data['out_of_stock'] += 1
                    elif qty < min_qty:
                        data['low_stock_count'] += 1
                    
                    data['items'].append({
                        'code': item.get('sku', ''),
                        'name': item.get('item_name', item.get('description', '')),
                        'category': item.get('category', ''),
                        'quantity': qty,
                        'min_quantity': min_qty,
                        'unit': item.get('unit_of_measure', 'pcs'),
                        'value': qty * unit_cost,
                        # Excel compatibility
                        'itemCode': item.get('sku', ''),
                        'itemName': item.get('item_name', item.get('description', '')),
                        'currentStock': qty,
                        'minStock': min_qty
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
            # Search in simple_items for room-related categories
            items = self.client.table('simple_items').select('*')\
                .or_('category.ilike.*room*,category.ilike.*amenit*,category.ilike.*linen*,category.ilike.*toiletry*,category.ilike.*housekeep*,category.ilike.*soap*,category.ilike.*clean*,category.ilike.*deterg*')\
                .execute()
            
            for item in (items.data or []):
                data['supplies'].append({
                    'name': item.get('item_name', item.get('description', '')),
                    'category': item.get('category', ''),
                    'quantity': item.get('quantity', 0) or 0,
                    'unit': item.get('unit_of_measure', 'pcs'),
                    'reorder_level': item.get('reorder_level', 0) or 0
                })
            
        except Exception as e:
            logger.error(f"Error fetching room supplies: {e}")
        
        return data

    def _fetch_manager_duty(self, filters: Dict) -> Dict[str, Any]:
        """Fetch manager on duty report data"""
        date = filters.get('date', datetime.now().strftime('%Y-%m-%d'))
        
        data = {
            'manager_name': 'Not assigned',
            'incidents': [],
            'check_ins': 0,
            'check_outs': 0,
            'vip_guests': []
        }
        
        if not self.client:
            return data
        
        try:
            # Check-ins from reservations
            in_q = self.client.table('reservations').select('id', count='exact').eq('check_in_date', date)
            in_res = in_q.execute()
            data['check_ins'] = in_res.count or 0
            
            # Check-outs from reservations
            out_q = self.client.table('reservations').select('id', count='exact').eq('check_out_date', date)
            out_res = out_q.execute()
            data['check_outs'] = out_res.count or 0
            
            # VIP Guests
            vip_q = self.client.table('reservations').select('*, guest:guests(*)').eq('check_in_date', date)
            vips = vip_q.execute()
            for v in (vips.data or []):
                guest = v.get('guest', {}) or {}
                if guest.get('is_vip'):
                    data['vip_guests'].append({
                        'name': f"{guest.get('first_name', '')} {guest.get('last_name', '')}".strip() or 'Guest',
                        'room': 'TBD',
                        'preferences': guest.get('preferences', '')
                    })
            
        except Exception as e:
            logger.error(f"Error fetching MOD report: {e}", exc_info=True)
        
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
            # Fetch attendance records first
            query = self.client.table('staff_attendance').select('*')
            query = query.gte('attendance_date', start_date)
            query = query.lte('attendance_date', end_date)
            
            result = query.execute()
            all_records = result.data or []
            logger.info(f"Fetched {len(all_records)} attendance records for date range {start_date} to {end_date}")
            
            if not all_records:
                logger.warning("No attendance records found for the date range")
                return data
            
            # Get unique staff_ids
            staff_ids = list(set(r.get('staff_id') for r in all_records if r.get('staff_id')))
            logger.info(f"Found {len(staff_ids)} unique staff IDs")
            
            # Fetch staff profiles - try matching by both id and user_id
            staff_profiles = {}
            if staff_ids:
                profiles_result = self.client.table('staff_profiles').select('*').in_('id', staff_ids).execute()
                for p in (profiles_result.data or []):
                    staff_profiles[p['id']] = p
                    if p.get('user_id'):
                        staff_profiles[p['user_id']] = p  # Also map by user_id as fallback
                
                logger.info(f"Fetched {len(profiles_result.data or [])} staff profiles")
            
            # Attach staff profile to each record
            for record in all_records:
                staff_id = record.get('staff_id')
                record['staff'] = staff_profiles.get(staff_id, {})
            
            # Filter by branch manually if needed
            if branch_id:
                logger.info(f"Filtering by branch_id: {branch_id}")
                filtered = []
                for r in all_records:
                    staff_branch = r.get('staff', {}).get('branch_id')
                    if staff_branch == int(branch_id):
                        filtered.append(r)
                all_records = filtered
                logger.info(f"After branch filter: {len(all_records)} records")
            
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
                
                # For the detailed records, we still list individual shifts
                for record in s_info['records']:
                    data['records'].append({
                        'date': record.get('attendance_date'),
                        'name': f"{staff.get('first_name', '')} {staff.get('last_name', '')}".strip() or 'Unknown',
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
            # table 'bookings' replaced by 'reservations'
            booking = self.client.table('reservations').select('*, guest:guests(*), room:rooms(*)')\
                .eq('id', booking_id).single().execute()
            
            if booking.data:
                b = booking.data
                guest = b.get('guest', {}) or {}
                room = b.get('room', {}) or {}
                
                # Use first_name and last_name from guests table
                first_name = guest.get('first_name') or ''
                last_name = guest.get('last_name') or ''
                data['guest_name'] = f"{first_name} {last_name}".strip() or guest.get('name', 'Guest')
                
                data['email'] = guest.get('email', '')
                data['phone'] = guest.get('phone', '')
                data['address'] = guest.get('address', '')
                data['id_number'] = guest.get('id_number', '')
                
                data['confirmation_number'] = b.get('confirmation_number', b.get('id', '')[:8])
                data['check_in'] = b.get('check_in_date', '')
                data['check_out'] = b.get('check_out_date', '')
                data['room_type'] = room.get('type', '')
                data['room_number'] = room.get('number', room.get('room_number', ''))
                # Handle room_id if number/room_number is missing
                if not data['room_number'] and b.get('room_id'):
                    data['room_number'] = f"Room {str(b.get('room_id'))[:4]}"

                data['guests'] = (b.get('adults', 0) or 0) + (b.get('children', 0) or 0)
                if data['guests'] == 0: data['guests'] = 1
                
                data['special_requests'] = b.get('special_requests', '')
                
                data['room_rate'] = float(b.get('room_rate', 0) or room.get('rate', 0) or 0)
                
                # Calculate nights if not provided
                if b.get('check_in_date') and b.get('check_out_date'):
                    try:
                        d1 = datetime.strptime(b['check_in_date'], '%Y-%m-%d')
                        d2 = datetime.strptime(b['check_out_date'], '%Y-%m-%d')
                        data['nights'] = max(1, (d2 - d1).days)
                    except:
                        data['nights'] = b.get('nights', 1)
                else:
                    data['nights'] = b.get('nights', 1)
                    
                data['subtotal'] = float(b.get('subtotal') or (data['room_rate'] * data['nights']))
                data['taxes'] = float(b.get('tax_amount', 0) or 0)
                data['total'] = float(b.get('total_amount') or (data['subtotal'] + data['taxes']))
                data['payment_method'] = b.get('payment_method', '')
                data['payment_status'] = 'Deposit Paid' if b.get('deposit_paid') else 'Pending'
            
        except Exception as e:
            logger.error(f"Error fetching reservation: {e}", exc_info=True)
        
        return data

    def _fetch_revenue_analysis(self, filters: Dict) -> Dict[str, Any]:
        """Fetch revenue analysis data"""
        return self._fetch_financial_summary(filters)

    def _fetch_stock_movement(self, filters: Dict) -> Dict[str, Any]:
        """Fetch stock movement data"""
        start_date, end_date = self._parse_dates(filters)
        branch_id = filters.get('branch_id')
        movement_type = filters.get('movement_type')  # e.g. 'STOCK_OUT'
        
        data = {'movements': []}
        
        if not self.client:
            return data
            
        try:
            if not branch_id or str(branch_id) == '1':
                # Central Store movements from store_stock_movements
                query = self.client.table('store_stock_movements').select('*, item:store_items(name, item_code)')\
                    .gte('created_at', f'{start_date}T00:00:00')\
                    .lte('created_at', f'{end_date}T23:59:59')\
                    .order('created_at', desc=True)
                if movement_type:
                    query = query.eq('movement_type', movement_type)
                movements = query.execute()
                
                for m in (movements.data or []):
                    item = m.get('item', {}) or {}
                    item_code = item.get('item_code', m.get('item_id', ''))
                    item_name = item.get('name', item_code)
                    m_type = m.get('movement_type', '')
                    is_out = m_type in ['dispatch', 'transfer', 'STOCK_OUT', 'out', 'issue']

                    data['movements'].append({
                        'date': m.get('created_at', '')[:10],
                        'item_code': item_code,
                        'item_name': item_name,
                        'type': m_type,
                        'quantity': m.get('quantity', 0),
                        'from': 'Central Store' if is_out else 'Supplier/Adj',
                        'to': 'Branch/Adj' if is_out else 'Central Store',
                        'reference': m.get('reference_number', m.get('reference_type', '')),
                        'itemCode': item_code,
                        'itemName': item_name
                    })
            else:
                # Branch movements from branch_stock_movements
                query = self.client.table('branch_stock_movements').select('*, item:simple_items(item_name)')\
                    .eq('branch_id', branch_id)\
                    .gte('created_at', f'{start_date}T00:00:00')\
                    .lte('created_at', f'{end_date}T23:59:59')\
                    .order('created_at', desc=True)
                if movement_type:
                    query = query.eq('movement_type', movement_type)
                movements = query.execute()
                
                for m in (movements.data or []):
                    item = m.get('item', {}) or {}
                    data['movements'].append({
                        'date': m.get('created_at', '')[:10],
                        'item_code': m.get('item_sku', ''),
                        'item_name': item.get('item_name', m.get('item_sku', '')),
                        'type': m.get('movement_type', ''),
                        'quantity': m.get('quantity', 0),
                        'from': 'Global' if m.get('movement_type') == 'DISPATCH_RECEIVE' else 'Branch',
                        'to': 'Branch',
                        'reference': m.get('reference_number', m.get('reference_type', '')),
                        'itemCode': m.get('item_sku', ''),
                        'itemName': item.get('item_name', m.get('item_sku', ''))
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
            # table 'bookings' replaced by 'reservations'
            arrivals = self.client.table('reservations').select('*, guest:guests(first_name, last_name), room:rooms(number)')\
                .eq('check_in_date', date).execute()
            
            for a in (arrivals.data or []):
                guest = a.get('guest', {}) or {}
                room = a.get('room', {}) or {}
                data['arrivals'].append({
                    'guest_name': f"{guest.get('first_name', '')} {guest.get('last_name', '')}".strip() or 'Guest',
                    'room': room.get('number', ''),
                    'time': a.get('arrival_time', ''),
                    'status': a.get('status', '')
                })
            
            # table 'bookings' replaced by 'reservations'
            departures = self.client.table('reservations').select('*, guest:guests(first_name, last_name), room:rooms(number)')\
                .eq('check_out_date', date).execute()
            
            for d in (departures.data or []):
                guest = d.get('guest', {}) or {}
                room = d.get('room', {}) or {}
                data['departures'].append({
                    'guest_name': f"{guest.get('first_name', '')} {guest.get('last_name', '')}".strip() or 'Guest',
                    'room': room.get('number', ''),
                    'time': d.get('departure_time', ''),
                    'status': d.get('status', '')
                })
            
        except Exception as e:
            logger.error(f"Error fetching arrivals/departures: {e}", exc_info=True)
        
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

    def _fetch_financial_variance(self, filters: Dict) -> Dict[str, Any]:
        """Fetch financial variance data (Deep dive into revenue leakage)"""
        start_date, end_date = self._parse_dates(filters)
        branch_id = filters.get('branch_id')
        
        data = {
            'expected_revenue': 0,
            'actual_collected': 0,
            'variance': 0,
            'variances_by_source': [],
            'anomalies': []
        }
        
        if not self.client: return data
        
        try:
            # 1. Fetch expected revenue from all sources
            # Restaurant
            rest_q = self.client.table('restaurant_orders').select('total_amount')\
                .gte('created_at', f'{start_date}T00:00:00').lte('created_at', f'{end_date}T23:59:59')
            rest_q = self._apply_branch_filter(rest_q, filters)
            rest_rev = sum(o.get('total_amount', 0) or 0 for o in (rest_q.execute().data or []))
            
            # Bar
            bar_q = self.client.table('bar_orders').select('total_amount')\
                .gte('created_at', f'{start_date}T00:00:00').lte('created_at', f'{end_date}T23:59:59')
            bar_q = self._apply_branch_filter(bar_q, filters)
            bar_rev = sum(o.get('total_amount', 0) or 0 for o in (bar_q.execute().data or []))
            
            # Reservations (replacing bookings)
            book_q = self.client.table('reservations').select('total_amount')\
                .gte('created_at', f'{start_date}T00:00:00').lte('created_at', f'{end_date}T23:59:59')
            book_q = self._apply_branch_filter(book_q, filters)
            book_rev = sum(float(o.get('total_amount', 0) or 0) for o in (book_q.execute().data or []))
            
            data['expected_revenue'] = rest_rev + bar_rev + book_rev
            
            # 2. Fetch actual payments
            pay_q = self.client.table('payments').select('amount')\
                .gte('created_at', f'{start_date}T00:00:00').lte('created_at', f'{end_date}T23:59:59')\
                .eq('status', 'completed')
            # Note: payments table might not have branch_id directly, usually linked via order_id
            pay_rev = sum(p.get('amount', 0) or 0 for p in (pay_q.execute().data or []))
            
            data['actual_collected'] = pay_rev
            data['variance'] = data['actual_collected'] - data['expected_revenue']
            
            data['variances_by_source'] = [
                {'source': 'Restaurant', 'expected': rest_rev, 'actual': rest_rev + (data['variance'] * 0.4 if data['variance'] < 0 else 0)},
                {'source': 'Bar', 'expected': bar_rev, 'actual': bar_rev + (data['variance'] * 0.4 if data['variance'] < 0 else 0)},
                {'source': 'Bookings', 'expected': book_rev, 'actual': book_rev + (data['variance'] * 0.2 if data['variance'] < 0 else 0)}
            ]
            
        except Exception as e:
            logger.error(f"Error in financial variance fetching: {e}")
            
        return data

    def _fetch_inventory_discrepancy(self, filters: Dict) -> Dict[str, Any]:
        """Fetch inventory gap analysis (Theoretical vs Actual)"""
        branch_id = filters.get('branch_id')
        
        data = {
            'discrepancy_items': [],
            'total_value_loss': 0,
            'high_risk_categories': []
        }
        
        if not self.client: return data
        
        try:
            # Fetch consumption variances (from the new tables)
            query = self.client.table('audit_config_consumption').select('*, item:inventory_items(name, unit_cost)')
            query = self._apply_branch_filter(query, filters)
            
            variances = query.execute()
            
            for v in (variances.data or []):
                item = v.get('item') or {}
                name = item.get('name', 'Unknown')
                cost = item.get('unit_cost', 0) or 0
                
                theoretical = v.get('theoretical_consumption', 0) or 0
                actual = v.get('actual_consumption', 0) or 0
                diff = actual - theoretical
                
                loss = abs(diff) * cost if diff > 0 else 0
                data['total_value_loss'] += loss
                
                data['discrepancy_items'].append({
                    'name': name,
                    'theoretical': theoretical,
                    'actual': actual,
                    'variance': diff,
                    'variance_pct': (diff / theoretical * 100) if theoretical > 0 else 0,
                    'value_impact': loss
                })
                
        except Exception as e:
            logger.error(f"Error in inventory discrepancy fetching: {e}")
            
        return data

    def _fetch_procurement_analysis(self, filters: Dict) -> Dict[str, Any]:
        """Fetch procurement status and supplier pricing trends"""
        start_date, end_date = self._parse_dates(filters)
        
        data = {
            'top_suppliers': [],
            'price_trends': [],
            'volume_analysis': []
        }
        
        if not self.client: return data
        
        try:
            # Fetch GRN items for the period (actual purchases)
            # Joining with store_grn to filter by date and store_suppliers for name
            grn_query = self.client.table('store_grn_items').select('*, grn:store_grn(*, supplier:store_suppliers(name)), item:simple_items(item_name)')\
                .gte('created_at', f'{start_date}T00:00:00')\
                .lte('created_at', f'{end_date}T23:59:59')
            
            items = grn_query.execute()
            
            supplier_totals = {}
            item_prices = {}
            
            for m in (items.data or []):
                grn = m.get('grn') or {}
                supplier_obj = grn.get('supplier') or {}
                supplier = supplier_obj.get('name', 'Unknown')
                amount = float(m.get('total_value', 0) or 0)
                
                supplier_totals[supplier] = supplier_totals.get(supplier, 0) + amount
                
                item_obj = m.get('item') or {}
                item_name = item_obj.get('item_name', 'Unknown')
                price = float(m.get('unit_price', 0) or 0)
                if item_name not in item_prices: item_prices[item_name] = []
                item_prices[item_name].append(price)
            
            # If no GRN items, try store_suppliers directly for summary
            if not supplier_totals:
                supp_res = self.client.table('store_suppliers').select('name, total_purchase_value')\
                    .order('total_purchase_value', desc=True).limit(5).execute()
                data['top_suppliers'] = [
                    {'name': s.get('name'), 'total_spend': float(s.get('total_purchase_value') or 0)} 
                    for s in (supp_res.data or [])
                ]
            else:
                data['top_suppliers'] = [
                    {'name': s, 'total_spend': t} for s, t in sorted(supplier_totals.items(), key=lambda x: x[1], reverse=True)[:5]
                ]
            
            data['price_trends'] = [
                {'item': i, 'avg_price': sum(p)/len(p), 'min': min(p), 'max': max(p)} 
                for i, p in item_prices.items() if p
            ]
            
        except Exception as e:
            logger.error(f"Error in procurement fetching: {e}", exc_info=True)
        
        return data

    def _fetch_exception_logs(self, filters: Dict) -> Dict[str, Any]:
        """Fetch exception activity (Voids, Cancellations, Discounts)"""
        start_date, end_date = self._parse_dates(filters)
        branch_id = filters.get('branch_id')
        
        data = {
            'voided_orders': [],
            'cancelled_bookings': [],
            'high_discounts': [],
            'total_exception_value': 0
        }
        
        if not self.client: return data
        
        try:
            # 1. Voided/Cancelled Restaurant Orders
            rest_q = self.client.table('restaurant_orders').select('*')\
                .in_('status', ['voided', 'cancelled'])\
                .gte('created_at', f'{start_date}T00:00:00').lte('created_at', f'{end_date}T23:59:59')
            rest_q = self._apply_branch_filter(rest_q, filters)
            
            voids = rest_q.execute()
            for v in (voids.data or []):
                val = v.get('total_amount', 0) or 0
                data['total_exception_value'] += val
                data['voided_orders'].append({
                    'id': v.get('order_number', v.get('id', '')[:8]),
                    'type': 'Restaurant',
                    'reason': v.get('void_reason', 'Not specified'),
                    'amount': val,
                    'timestamp': v.get('created_at')
                })
            
            # 2. Cancelled Reservations (replacing bookings)
            res_q = self.client.table('reservations').select('*, guest:guests(first_name, last_name)')\
                .eq('status', 'cancelled')\
                .gte('created_at', f'{start_date}T00:00:00').lte('created_at', f'{end_date}T23:59:59')
            res_q = self._apply_branch_filter(res_q, filters)
            
            cancels = res_q.execute()
            for c in (cancels.data or []):
                val = float(c.get('total_amount', 0) or 0)
                data['total_exception_value'] += val
                guest = c.get('guest', {}) or {}
                guest_name = f"{guest.get('first_name', '')} {guest.get('last_name', '')}".strip() or 'Guest'
                data['cancelled_bookings'].append({
                    'id': c.get('confirmation_number', c.get('id', '')[:8]),
                    'guest': guest_name,
                    'amount': val,
                    'date': c.get('created_at')
                })
                
        except Exception as e:
            logger.error(f"Error in exception logs fetching: {e}")
            
        return data

    def _fetch_reconciliation_audit(self, filters: Dict) -> Dict[str, Any]:
        """Compare stock dispatches vs recorded sales to detect fraud/leakage"""
        start_date, end_date = self._parse_dates(filters)
        branch_id = filters.get('branch_id')
        if branch_id:
            try:
                branch_id = int(branch_id)
            except (ValueError, TypeError):
                branch_id = None
        
        data = {
            'reconciliation_items': [],
            'total_leakage_value': 0,
            'summary': {'total_dispatched': 0, 'total_sold': 0}
        }
        
        if not self.client: return data
        
        try:
            # 1. Fetch Dispatched items and map names from simple_items
            item_names = {}
            # Fetch simple_items to map SKU to name
            items_res = self.client.table('simple_items').select('sku, item_name, cost_price').execute()
            for itm in (items_res.data or []):
                item_names[itm.get('sku')] = {
                    'name': itm.get('item_name') or itm.get('sku'),
                    'cost': float(itm.get('cost_price') or 0)
                }

            dispatch_q = self.client.table('branch_stock_movements')\
                .select('*')\
                .in_('movement_type', ['dispatch', 'transfer'])\
                .gte('created_at', f'{start_date}T00:00:00').lte('created_at', f'{end_date}T23:59:59')
            dispatch_q = self._apply_branch_filter(dispatch_q, filters, 'branch_id')
            
            dispatches = dispatch_q.execute()
            
            # Aggregate dispatches
            item_stats = {}
            for d in (dispatches.data or []):
                sku = d.get('item_sku')
                info = item_names.get(sku, {'name': sku or 'Unknown', 'cost': 0})
                name = info['name']
                qty = float(d.get('quantity', 0) or 0)
                if name not in item_stats:
                    item_stats[name] = {'dispatched': 0, 'sold': 0, 'cost': info['cost']}
                item_stats[name]['dispatched'] += qty
                data['summary']['total_dispatched'] += qty

            # 2. Fetch Sales (Restaurant & Bar)
            # Restaurant
            rest_q = self.client.table('restaurant_orders').select('id, items:restaurant_order_items(quantity, menu_item:restaurant_menu_items(name))')\
                .gte('created_at', f'{start_date}T00:00:00').lte('created_at', f'{end_date}T23:59:59')\
                .eq('payment_status', 'paid')
            rest_q = self._apply_branch_filter(rest_q, filters)
            
            rest_sales = rest_q.execute()
            for order in (rest_sales.data or []):
                for item in order.get('items', []):
                    menu_item = item.get('menu_item') or {}
                    name = menu_item.get('name', 'Unknown')
                    qty = float(item.get('quantity', 0) or 0)
                    if name in item_stats:
                        item_stats[name]['sold'] += qty
                        data['summary']['total_sold'] += qty
                    # Also check for partial matches or case issues
                    elif name.lower() in [k.lower() for k in item_stats.keys()]:
                        # Find the correct key
                        real_key = [k for k in item_stats.keys() if k.lower() == name.lower()][0]
                        item_stats[real_key]['sold'] += qty
                        data['summary']['total_sold'] += qty

            # 3. Calculate Variance
            for name, stats in item_stats.items():
                gap = stats['dispatched'] - stats['sold']
                if gap > 0:
                    leakage = gap * stats['cost']
                    data['total_leakage_value'] += leakage
                    data['reconciliation_items'].append({
                        'name': name,
                        'dispatched': stats['dispatched'],
                        'sold': stats['sold'],
                        'variance': gap,
                        'leakage_value': leakage,
                        'risk_level': 'High' if gap > (stats['dispatched'] * 0.1) else 'Medium'
                    })

        except Exception as e:
            logger.error(f"Error in reconciliation audit: {e}")
            
        return data

    def _fetch_sales_performance(self, filters: Dict) -> Dict[str, Any]:
        """Fetch Branch Sales Performance data (Aggregated Sold Items + Efficiency)"""
        start_date, end_date = self._parse_dates(filters)
        branch_ids = self._parse_branch_ids(filters)
        
        data = {
            'analysis': [],
            'summary': {
                'total_items_sold': 0,
                'total_quantity_sold': 0,
                'total_revenue': 0
            }
        }
        
        if not self.client:
            return data
            
        try:
            # 1. Fetch Restaurant Sold Items
            rest_query = self.client.table('restaurant_orders').select('*, items:restaurant_order_items(*, menu_item:restaurant_menu_items(name, category_id))')\
                .eq('status', 'completed')\
                .gte('created_at', f'{start_date}T00:00:00')\
                .lte('created_at', f'{end_date}T23:59:59')
            if branch_ids:
                if len(branch_ids) == 1: rest_query = rest_query.eq('branch_id', branch_ids[0])
                else: rest_query = rest_query.in_('branch_id', branch_ids)
            
            rest_res = rest_query.execute()
            
            # 2. Fetch Bar Sold Items
            bar_query = self.client.table('bar_orders').select('*, items:bar_order_items(*, stock_item:bar_inventory(name))')\
                .eq('status', 'completed')\
                .gte('created_at', f'{start_date}T00:00:00')\
                .lte('created_at', f'{end_date}T23:59:59')
            if branch_ids:
                if len(branch_ids) == 1: bar_query = bar_query.eq('branch_id', branch_ids[0])
                else: bar_query = bar_query.in_('branch_id', branch_ids)
                
            bar_res = bar_query.execute()

            # 3. Fetch Stock Requested
            stock_req_query = self.client.table('stock_requests').select('*, items:stock_request_items(item_sku, requested_quantity)')\
                .gte('created_at', f'{start_date}T00:00:00')\
                .lte('created_at', f'{end_date}T23:59:59')
            if branch_ids:
                if len(branch_ids) == 1: stock_req_query = stock_req_query.eq('requesting_branch_id', branch_ids[0])
                else: stock_req_query = stock_req_query.in_('requesting_branch_id', branch_ids)
                
            stock_res = stock_req_query.execute()

            # Mapping for aggregation
            sold_items_map = {} # Key: name
            requested_map = {} # Key: SKU or Name-ish (we'll try to match by name/SKU)
            
            # Process Stock Requests
            for req in (stock_res.data or []):
                for item in req.get('items', []):
                    sku = item.get('item_sku')
                    qty = float(item.get('requested_quantity', 0) or 0)
                    requested_map[sku] = requested_map.get(sku, 0) + qty

            def process_orders(orders_data, type_label):
                for order in (orders_data or []):
                    for item in order.get('items', []):
                        name = 'Unknown Item'
                        if type_label == 'restaurant':
                            name = (item.get('menu_item') or {}).get('name') or item.get('item_name') or 'Unknown'
                        else:
                            name = (item.get('stock_item') or {}).get('name') or item.get('item_name') or 'Unknown'
                        
                        sku = item.get('item_sku') or name # Use SKU if available, otherwise name
                        qty = float(item.get('quantity', 0) or 0)
                        price = float(item.get('unit_price', item.get('price', 0)) or 0)
                        revenue = qty * price
                        
                        if name not in sold_items_map:
                            sold_items_map[name] = {
                                'name': name,
                                'category': type_label.title(),
                                'quantity': 0,
                                'revenue': 0,
                                'skus': set()
                            }
                        
                        sold_items_map[name]['quantity'] += qty
                        sold_items_map[name]['revenue'] += revenue
                        if sku: sold_items_map[name]['skus'].add(sku)
                        
                        data['summary']['total_quantity_sold'] += qty
                        data['summary']['total_revenue'] += revenue

            process_orders(rest_res.data, 'restaurant')
            process_orders(bar_res.data, 'bar')
            
            # Final Analysis Assembly
            for name, sold in sold_items_map.items():
                # Try to find requested quantity by any associated SKUs
                requested_qty = 0
                for sku in sold['skus']:
                    requested_qty += requested_map.get(sku, 0)
                
                sold['stock_requested'] = requested_qty
                sold['consumption_ratio'] = (sold['quantity'] / requested_qty) if requested_qty > 0 else 0
                # Remove skus set for serialization
                del sold['skus']
                data['analysis'].append(sold)
                
            data['summary']['total_items_sold'] = len(data['analysis'])
            data['analysis'] = sorted(data['analysis'], key=lambda x: x['quantity'], reverse=True)
            
        except Exception as e:
            logger.error(f"Error fetching sales performance: {e}")
            
        return data

    def _fetch_staff_performance(self, filters: Dict) -> Dict[str, Any]:
        """Fetch Staff Performance Report data — attendance + sales + tips + ratings"""
        month = filters.get('month')
        year = filters.get('year')
        branch_id = filters.get('branch_id')

        now = datetime.now()
        if month and year:
            try:
                start_date = datetime(int(year), int(month), 1).strftime('%Y-%m-%d')
                # Last day of month
                last_day = calendar.monthrange(int(year), int(month))[1]
                end_date = datetime(int(year), int(month), last_day).strftime('%Y-%m-%d')
                period_month = datetime(int(year), int(month), 1).strftime('%B')
                period_year = int(year)
            except Exception:
                start_date = now.replace(day=1).strftime('%Y-%m-%d')
                end_date = now.strftime('%Y-%m-%d')
                period_month = now.strftime('%B')
                period_year = now.year
        else:
            start_date, end_date = self._parse_dates(filters)
            period_month = now.strftime('%B')
            period_year = now.year

        data = {
            'period': {'month': period_month, 'year': period_year},
            'branch': 'All Branches',
            'staff_performance': [],
            'summary': {
                'total_staff': 0,
                'total_sales': 0,
                'total_tips': 0,
                'avg_attendance': 0
            }
        }

        if not self.client:
            return data

        try:
            # 1. Fetch all staff profiles
            profiles_query = self.client.table('staff_profiles').select('id, first_name, last_name, role, department, branch_id, user_id')
            if branch_id:
                profiles_query = profiles_query.eq('branch_id', int(branch_id))
                # Resolve branch name
                try:
                    br = self.client.table('branches').select('name').eq('id', int(branch_id)).single().execute()
                    data['branch'] = (br.data or {}).get('name', 'Unknown Branch')
                except Exception:
                    data['branch'] = f'Branch {branch_id}'

            profiles_res = profiles_query.execute()
            profiles = profiles_res.data or []

            if not profiles:
                return data

            # Build lookup maps
            staff_map = {}  # id -> profile
            for p in profiles:
                staff_map[p['id']] = p

            staff_ids = list(staff_map.keys())

            # 2. Fetch attendance for the period
            attendance_map = {}  # staff_id -> present_days count
            try:
                att_res = self.client.table('staff_attendance')\
                    .select('staff_id, status')\
                    .in_('staff_id', staff_ids)\
                    .gte('attendance_date', start_date)\
                    .lte('attendance_date', end_date)\
                    .execute()
                for rec in (att_res.data or []):
                    sid = rec.get('staff_id')
                    if rec.get('status') in ('present', 'late'):
                        attendance_map[sid] = attendance_map.get(sid, 0) + 1
            except Exception as e:
                logger.warning(f"Could not fetch attendance for staff performance: {e}")

            # 3. Fetch sales attributed to staff (restaurant orders)
            sales_map = {}   # staff_id -> total_sales
            tips_map = {}    # staff_id -> total_tips
            try:
                orders_query = self.client.table('restaurant_orders')\
                    .select('staff_id, total_amount, tip_amount')\
                    .in_('staff_id', staff_ids)\
                    .gte('created_at', f'{start_date}T00:00:00')\
                    .lte('created_at', f'{end_date}T23:59:59')\
                    .eq('status', 'completed')
                if branch_id:
                    orders_query = orders_query.eq('branch_id', int(branch_id))
                orders_res = orders_query.execute()
                for order in (orders_res.data or []):
                    sid = order.get('staff_id')
                    if sid:
                        sales_map[sid] = sales_map.get(sid, 0) + float(order.get('total_amount', 0) or 0)
                        tips_map[sid] = tips_map.get(sid, 0) + float(order.get('tip_amount', 0) or 0)
            except Exception as e:
                logger.warning(f"Could not fetch sales for staff performance: {e}")

            # 4. Fetch ratings (staff_ratings table if it exists)
            ratings_map = {}  # staff_id -> avg_rating
            try:
                ratings_res = self.client.table('staff_ratings')\
                    .select('staff_id, rating')\
                    .in_('staff_id', staff_ids)\
                    .gte('created_at', f'{start_date}T00:00:00')\
                    .lte('created_at', f'{end_date}T23:59:59')\
                    .execute()
                ratings_by_staff = {}
                for r in (ratings_res.data or []):
                    sid = r.get('staff_id')
                    if sid:
                        if sid not in ratings_by_staff:
                            ratings_by_staff[sid] = []
                        ratings_by_staff[sid].append(float(r.get('rating', 0) or 0))
                for sid, rlist in ratings_by_staff.items():
                    ratings_map[sid] = sum(rlist) / len(rlist) if rlist else 0
            except Exception as e:
                logger.warning(f"Could not fetch ratings for staff performance: {e}")

            # 5. Assemble performance list
            perf_list = []
            total_sales = 0
            total_tips = 0
            total_present = 0

            for staff in profiles:
                sid = staff['id']
                present_days = attendance_map.get(sid, 0)
                s_sales = sales_map.get(sid, 0)
                s_tips = tips_map.get(sid, 0)
                avg_rating = ratings_map.get(sid, 0)

                total_sales += s_sales
                total_tips += s_tips
                total_present += present_days

                full_name = f"{staff.get('first_name', '')} {staff.get('last_name', '')}".strip().upper() or 'UNKNOWN'
                role = (staff.get('role') or 'UNSPECIFIED').upper()
                dept = (staff.get('department') or 'general').lower()

                perf_list.append({
                    'name': full_name,
                    'role': role,
                    'department': dept,
                    'total_sales': round(s_sales, 2),
                    'total_tips': round(s_tips, 2),
                    'present_days': present_days,
                    'avg_rating': round(avg_rating, 2)
                })

            # Sort by sales desc, then attendance desc
            perf_list.sort(key=lambda x: (-x['total_sales'], -x['present_days'], -x['avg_rating']))
            for i, item in enumerate(perf_list):
                item['rank'] = i + 1

            data['staff_performance'] = perf_list
            data['summary']['total_staff'] = len(perf_list)
            data['summary']['total_sales'] = round(total_sales, 2)
            data['summary']['total_tips'] = round(total_tips, 2)
            data['summary']['avg_attendance'] = round(total_present / len(perf_list), 2) if perf_list else 0

        except Exception as e:
            logger.error(f"Error fetching staff performance: {e}", exc_info=True)

        return data

    def _fetch_sold_items_agg(self, filters: Dict) -> Dict[str, Any]:
        """Aggregate sold items across branches for global analysis"""
        start_date, end_date = self._parse_dates(filters)
        
        data = {
            'items': [],
            'total_revenue': 0,
            'total_quantity': 0
        }
        
        if not self.client: return data
        
        try:
            agg = {}
            branch_ids = self._parse_branch_ids(filters)
            
            # 1. Aggregate Restaurant Order Items
            rest_query = self.client.table('restaurant_order_items').select('*, order:restaurant_orders(branch_id, branch:branches(name)), menu_item:restaurant_menu_items(name)')\
                .gte('created_at', f'{start_date}T00:00:00').lte('created_at', f'{end_date}T23:59:59')
            
            if branch_ids:
                if len(branch_ids) == 1:
                    rest_query = rest_query.filter('order.branch_id', 'eq', branch_ids[0])
                else:
                    branch_ids_str = f"({','.join(map(str, branch_ids))})"
                    rest_query = rest_query.filter('order.branch_id', 'in', branch_ids_str)
                
            rest_result = rest_query.execute()
            
            for item in (rest_result.data or []):
                name = item.get('menu_item', {}).get('name') or item.get('item_name', 'Unknown Item')
                qty = item.get('quantity', 0) or 0
                price = item.get('unit_price', 0) or 0
                
                if name not in agg:
                    agg[name] = {'name': name, 'quantity': 0, 'revenue': 0, 'branches': {}, 'type': 'Food'}
                
                agg[name]['quantity'] += qty
                agg[name]['revenue'] += qty * price
                
                br_name = item.get('order', {}).get('branch', {}).get('name', 'Main')
                agg[name]['branches'][br_name] = agg[name]['branches'].get(br_name, 0) + qty
                
                data['total_revenue'] += qty * price
                data['total_quantity'] += qty

            # 2. Aggregate Bar Order Items
            try:
                bar_query = self.client.table('bar_order_items').select('*, order:bar_orders(branch_id, branch:branches(name))')\
                    .gte('created_at', f'{start_date}T00:00:00').lte('created_at', f'{end_date}T23:59:59')
                
                if branch_ids:
                    if len(branch_ids) == 1:
                        bar_query = bar_query.filter('order.branch_id', 'eq', branch_ids[0])
                    else:
                        branch_ids_str = f"({','.join(map(str, branch_ids))})"
                        bar_query = bar_query.filter('order.branch_id', 'in', branch_ids_str)
                
                bar_result = bar_query.execute()
                
                for item in (bar_result.data or []):
                    name = item.get('drink_name', 'Unknown Drink')
                    qty = item.get('quantity', 0) or 0
                    price = item.get('unit_price', 0) or 0
                    
                    if name not in agg:
                        agg[name] = {'name': name, 'quantity': 0, 'revenue': 0, 'branches': {}, 'type': 'Drink'}
                    
                    agg[name]['quantity'] += qty
                    agg[name]['revenue'] += qty * price
                    
                    br_name = item.get('order', {}).get('branch', {}).get('name', 'Main')
                    agg[name]['branches'][br_name] = agg[name]['branches'].get(br_name, 0) + qty
                    
                    data['total_revenue'] += qty * price
                    data['total_quantity'] += qty
            except Exception as be:
                logger.error(f"Error fetching bar items agg: {be}")
                
            data['items'] = sorted(agg.values(), key=lambda x: x['revenue'], reverse=True)
            
        except Exception as e:
            logger.error(f"Error fetching sold items agg: {e}")
            
        return data


    def _fetch_branch_performance(self, filters: Dict) -> Dict[str, Any]:
        """Fetch Branch Performance Report data"""
        start_date, end_date = self._parse_dates(filters)
        branch_id = filters.get('branch_id')
        
        data = {
            'period': {'start': start_date, 'end': end_date},
            'sales': {'restaurant': 0, 'bar': 0, 'total': 0},
            'expenses': {'total': 0, 'breakdown': {}},
            'netProfit': 0,
            'profitMargin': 0
        }
        
        if not self.client or not branch_id:
            return data
            
        try:
            # 1. Restaurant Sales
            rest_res = self.client.table('restaurant_orders').select('total_amount')\
                .eq('branch_id', branch_id)\
                .gte('created_at', f'{start_date}T00:00:00')\
                .lte('created_at', f'{end_date}T23:59:59')\
                .neq('status', 'cancelled').execute()
            
            data['sales']['restaurant'] = sum(float(o.get('total_amount', 0) or 0) for o in (rest_res.data or []))
            
            # 2. Bar Sales
            bar_res = self.client.table('bar_orders').select('total')\
                .eq('branch_id', branch_id)\
                .gte('created_at', f'{start_date}T00:00:00')\
                .lte('created_at', f'{end_date}T23:59:59')\
                .neq('status', 'cancelled').execute()
            
            data['sales']['bar'] = sum(float(o.get('total', 0) or 0) for o in (bar_res.data or []))
            data['sales']['total'] = data['sales']['restaurant'] + data['sales']['bar']
            
            # 3. Expenses
            exp_res = self.client.table('expenses').select('amount, category')\
                .eq('branch_id', branch_id)\
                .gte('expense_date', start_date)\
                .lte('expense_date', end_date).execute()
            
            for exp in (exp_res.data or []):
                amt = float(exp.get('amount', 0) or 0)
                cat = exp.get('category', 'Other')
                data['expenses']['total'] += amt
                data['expenses']['breakdown'][cat] = data['expenses']['breakdown'].get(cat, 0) + amt
                
            data['netProfit'] = data['sales']['total'] - data['expenses']['total']
            if data['sales']['total'] > 0:
                data['profitMargin'] = (data['netProfit'] / data['sales']['total']) * 100
                
        except Exception as e:
            logger.error(f"Error fetching branch performance: {e}")
            
        return data

    def _fetch_stock_usage(self, filters: Dict) -> Dict[str, Any]:
        """Fetch Stock Usage Report (Requested vs Used)"""
        start_date, end_date = self._parse_dates(filters)
        branch_id = filters.get('branch_id')
        
        data = {'items': []}
        
        if not self.client or not branch_id:
            return data
            
        try:
            # 1. Stock Requests
            req_res = self.client.table('stock_requests').select('*, items:stock_request_items(item_sku, approved_quantity)')\
                .eq('requesting_branch_id', branch_id)\
                .eq('status', 'APPROVED')\
                .gte('created_at', f'{start_date}T00:00:00')\
                .lte('created_at', f'{end_date}T23:59:59').execute()
            
            requested_map = {}
            for req in (req_res.data or []):
                for item in req.get('items', []):
                    sku = item.get('item_sku')
                    qty = float(item.get('approved_quantity', 0) or 0)
                    requested_map[sku] = requested_map.get(sku, 0) + qty
                    
            # 2. Usage (Stock Movements)
            mov_res = self.client.table('branch_stock_movements').select('item_sku, quantity')\
                .eq('branch_id', branch_id)\
                .in_('movement_type', ['USAGE', 'SALE', 'WASTAGE'])\
                .gte('created_at', f'{start_date}T00:00:00')\
                .lte('created_at', f'{end_date}T23:59:59').execute()
                
            usage_map = {}
            for mov in (mov_res.data or []):
                sku = mov.get('item_sku')
                qty = float(mov.get('quantity', 0) or 0)
                usage_map[sku] = usage_map.get(sku, 0) + qty
                
            # Combine
            all_skus = set(list(requested_map.keys()) + list(usage_map.keys()))
            
            # Get item names for these SKUs if possible
            item_names = {}
            if all_skus:
                inv_res = self.client.table('inventory_items').select('sku, name')\
                    .in_('sku', list(all_skus)).execute()
                for item in (inv_res.data or []):
                    item_names[item['sku']] = item['name']
            
            for sku in all_skus:
                req_qty = requested_map.get(sku, 0)
                use_qty = usage_map.get(sku, 0)
                data['items'].append({
                    'sku': sku,
                    'name': item_names.get(sku, f"Item {sku}"),
                    'requested': req_qty,
                    'used': use_qty,
                    'variance': req_qty - use_qty
                })
                
        except Exception as e:
            logger.error(f"Error fetching stock usage: {e}")
            
        return data

    def _fetch_employee_credit(self, filters: Dict) -> Dict[str, Any]:
        """Fetch Employee Credit Report data with Aging Analysis"""
        data = {
            'summary': {
                'current': 0,
                'overdue_30': 0,
                'overdue_60': 0,
                'overdue_90': 0,
                'total_outstanding': 0
            },
            'bills': []
        }
        
        if not self.client:
            return data
            
        try:
            # Use staff_credit_bills instead of employee_credit_bills
            bills_res = self.client.table('staff_credit_bills').select('''
                *,
                employee:staff_profiles(id, first_name, last_name, id_number),
                branch:branches(name)
            ''')\
                .eq('is_paid', False)\
                .order('date', desc=True).execute()
                
            today = datetime.now()
            
            for bill in (bills_res.data or []):
                # staff_credit_bills uses 'amount' and 'is_paid'
                balance = float(bill.get('amount', 0) or 0)
                due_date_str = bill.get('date')
                
                days_overdue = 0
                if due_date_str:
                    try:
                        if 'T' in due_date_str:
                            due_date = datetime.fromisoformat(due_date_str.replace('Z', '+00:00')).replace(tzinfo=None)
                        else:
                            due_date = datetime.strptime(due_date_str, '%Y-%m-%d')
                        
                        days_overdue = (today - due_date).days
                    except:
                        pass
                
                bill_data = {
                    'id': bill.get('id'),
                    'bill_number': f"CB-{bill.get('id')}",
                    'bill_date': bill.get('date'),
                    'balance': balance,
                    'daysOverdue': max(0, days_overdue),
                    'status': 'pending', 
                    'employee': bill.get('employee', {}),
                    'branch': bill.get('branch', {})
                }
                data['bills'].append(bill_data)
                
                # Update buckets
                data['summary']['total_outstanding'] += balance
                if days_overdue <= 0:
                    data['summary']['current'] += balance
                elif days_overdue <= 30:
                    data['summary']['overdue_30'] += balance
                elif days_overdue <= 60:
                    data['summary']['overdue_60'] += balance
                else:
                    data['summary']['overdue_90'] += balance
                    
        except Exception as e:
            logger.error(f"Error fetching employee credit: {e}")
            
        return data

    def _fetch_conference_reports(self, filters: Dict) -> Dict[str, Any]:
        """Fetch conference revenue and usage reports"""
        start_date, end_date = self._parse_dates(filters)
        branch_id = filters.get('branch_id')
        
        data = {
            'total_revenue': 0,
            'total_bookings': 0,
            'total_pax': 0,
            'hall_revenue': 0,
            'meal_revenue': 0,
            'amenity_revenue': 0,
            'by_hall': [],
            'recent_bookings': []
        }
        
        if not self.client:
            return data
            
        try:
            query = self.client.table('conference_hall_bookings').select('*, hall:conference_halls(*)')
            query = query.gte('start_date', f'{start_date}T00:00:00')
            query = query.lte('start_date', f'{end_date}T23:59:59')
            if branch_id:
                query = query.eq('branch_id', branch_id)
            
            bookings = query.execute()
            
            hall_stats = {}
            for b in (bookings.data or []):
                data['total_bookings'] += 1
                data['total_revenue'] += b.get('total_amount', 0) or 0
                data['total_pax'] += b.get('num_participants', 0) or 0
                
                hall = b.get('hall') or {}
                hall_name = hall.get('name', 'Unknown')
                if hall_name not in hall_stats:
                    hall_stats[hall_name] = {'bookings': 0, 'revenue': 0, 'pax': 0}
                
                hall_stats[hall_name]['bookings'] += 1
                hall_stats[hall_name]['revenue'] += b.get('total_amount', 0) or 0
                hall_stats[hall_name]['pax'] += b.get('num_participants', 0) or 0
                
                data['recent_bookings'].append({
                    'id': b.get('id'),
                    'client': b.get('company_name') or b.get('customer_name'),
                    'date': b.get('start_date', '')[:10],
                    'hall': hall_name,
                    'pax': b.get('num_participants', 0),
                    'total': b.get('total_amount', 0),
                    'status': b.get('booking_status', 'N/A')
                })
            
            data['by_hall'] = [
                {'name': name, 'bookings': stats['bookings'], 'revenue': stats['revenue'], 'pax': stats['pax']}
                for name, stats in hall_stats.items()
            ]
            
            data['recent_bookings'] = sorted(data['recent_bookings'], key=lambda x: x['date'], reverse=True)[:10]
            
        except Exception as e:
            logger.error(f"Error fetching conference reports: {e}")
            
        return data
    def _fetch_bar_sales(self, filters: Dict) -> Dict[str, Any]:
        """Fetch bar sales and inventory"""
        start_date, end_date = self._parse_dates(filters)
        branch_id = filters.get('branch_id')
        
        data = {
            'total_revenue': 0,
            'total_orders': 0,
            'avg_order': 0,
            'top_items': [],
            'inventory': []
        }
        
        if not self.client: return data
        
        try:
            # Basic revenue from bar_orders
            query = self.client.table('bar_orders').select('*')\
                .gte('created_at', f'{start_date}T00:00:00')\
                .lte('created_at', f'{end_date}T23:59:59')\
                .eq('status', 'paid')
            
            if branch_id:
                query = query.eq('branch_id', branch_id)
                
            orders = query.execute()
            
            for o in (orders.data or []):
                # bar_orders uses 'total' instead of 'total_amount'
                data['total_revenue'] += o.get('total', o.get('total_amount', 0)) or 0
                data['total_orders'] += 1
            
            if data['total_orders'] > 0:
                data['avg_order'] = data['total_revenue'] / data['total_orders']
            
            # Fetch inventory from simple_items (category 'bar')
            inv_query = self.client.table('simple_items').select('*')\
                .ilike('category', '%bar%')
            inv_items = inv_query.execute()
            
            for i in (inv_items.data or []):
                data['inventory'].append({
                    'name': i.get('item_name', i.get('description', '')),
                    'quantity': i.get('quantity', 0),
                    'unit': i.get('unit_of_measure', 'pcs')
                })
                
        except Exception as e:
            logger.error(f"Error fetching bar sales: {e}")
            
        return data

    def _fetch_kitchen_ledger(self, filters: Dict) -> Dict[str, Any]:
        """Fetch kitchen ledger summary for a branch"""
        start_date, end_date = self._parse_dates(filters)
        branch_id = filters.get('branch_id')
        
        data = {
            'branch_id': branch_id,
            'start_date': start_date,
            'end_date': end_date,
            'items': []
        }
        
        if not self.client:
            return data
            
        try:
            # Query kitchen_ledger_entries for the branch and date range
            query = self.client.table('kitchen_ledger_entries').select('*')
            if branch_id:
                try:
                    query = query.eq('branch_id', int(branch_id))
                except:
                    query = query.eq('branch_id', branch_id)
            query = query.gte('entry_date', start_date).lte('entry_date', end_date)
            query = query.order('entry_date', desc=True)
            
            result = query.execute()
            data['items'] = result.data or []
            
        except Exception as e:
            logger.error(f"Error fetching kitchen ledger: {e}")
            
        return data

    def _fetch_kitchen_item_ledger(self, filters: Dict) -> Dict[str, Any]:
        """Fetch detailed ledger for a specific kitchen item"""
        start_date, end_date = self._parse_dates(filters)
        branch_id = filters.get('branch_id')
        item_sku = filters.get('item_sku')
        
        data = {
            'branch_id': branch_id,
            'item_sku': item_sku,
            'start_date': start_date,
            'end_date': end_date,
            'item_name': '',
            'transactions': []
        }
        
        if not self.client or not item_sku:
            return data
            
        try:
            # Query kitchen_stock_ledger for the specific item
            query = self.client.table('kitchen_stock_ledger').select('*')
            if branch_id:
                try:
                    query = query.eq('branch_id', int(branch_id))
                except:
                    query = query.eq('branch_id', branch_id)
            query = query.eq('item_sku', item_sku)
            query = query.gte('transaction_date', f'{start_date}T00:00:00')
            query = query.lte('transaction_date', f'{end_date}T23:59:59')
            query = query.order('transaction_date', desc=False)
            
            result = query.execute()
            data['transactions'] = result.data or []
            
            if data['transactions']:
                data['item_name'] = data['transactions'][0].get('item_name', '')
            else:
                # Fallback to fetch item name from kitchen_stock if no transactions found
                item_query = self.client.table('kitchen_stock').select('item_name').eq('item_sku', item_sku)
                if branch_id:
                    item_query = item_query.eq('branch_id', branch_id)
                item_result = item_query.execute()
                if item_result.data and len(item_result.data) > 0:
                    data['item_name'] = item_result.data[0].get('item_name', '')
            
        except Exception as e:
            logger.error(f"Error fetching kitchen item ledger: {e}")
            
        return data

    def _fetch_vat_report(self, filters: Dict) -> Dict[str, Any]:
        """Fetch VAT report data (Input VAT from supplier invoices)"""
        start_date, end_date = self._parse_dates(filters)
        supplier_id = filters.get('supplier_id')
        
        data = {
            'data': [],
            'summary': {
                'total_subtotal': 0,
                'total_vat': 0,
                'total_withholding': 0,
                'total_combined': 0
            }
        }
        
        if not self.client: return data
        
        try:
            query = self.client.table('store_supplier_invoices')\
                .select('*, supplier:store_suppliers(id, name, supplier_pin, vat_registration_number)')\
                .eq('status', 'approved')\
                .gte('invoice_date', start_date)\
                .lte('invoice_date', end_date)
            
            if supplier_id:
                query = query.eq('supplier_id', supplier_id)
                
            res = query.execute()
            report_data = res.data or []
            data['data'] = report_data
            
            # Calculate totals
            for inv in report_data:
                sub = float(inv.get('subtotal') or 0)
                vat = float(inv.get('vat_amount') or 0)
                wvat = float(inv.get('withholding_vat_amount') or 0)
                total = float(inv.get('total_amount') or 0)
                
                data['summary']['total_subtotal'] += sub
                data['summary']['total_vat'] += vat
                data['summary']['total_withholding'] += wvat
                data['summary']['total_combined'] += total
                
        except Exception as e:
            logger.error(f"Error fetching VAT report: {e}")
            
        return data

    def _fetch_procurement_intelligence(self, filters: Dict) -> Dict[str, Any]:
        """Fetch comprehensive procurement intelligence (VAT, GRNI, Aging)"""
        start_date, end_date = self._parse_dates(filters)
        
        data = {
            'vat': self._fetch_vat_report(filters),
            'grni': [],
            'aging': []
        }
        
        if not self.client: return data
        
        try:
            # 1. Fetch GRNI
            grni_res = self.client.table('store_grni_control_account')\
                .select('*, supplier:store_suppliers(id, name, supplier_code), grn:store_grn(id, grn_number, grn_date)')\
                .eq('status', 'open')\
                .execute()
            data['grni'] = grni_res.data or []
            
            # 2. Fetch Aging
            aging_res = self.client.table('store_supplier_balances')\
                .select('*, supplier:store_suppliers(id, name, supplier_code)')\
                .order('current_balance', desc=True)\
                .execute()
            data['aging'] = aging_res.data or []
            
        except Exception as e:
            logger.error(f"Error fetching procurement intelligence: {e}")
            
        return data

    def _fetch_supplier_statement(self, filters: Dict) -> Dict[str, Any]:
        """Fetch supplier statement data (Ledger, Balance, Aging)"""
        start_date, end_date = self._parse_dates(filters)
        supplier_id = filters.get('supplier_id')
        
        data = {
            'supplier': {},
            'start_date': start_date,
            'end_date': end_date,
            'opening_balance': 0,
            'transactions': [],
            'closing_balance': 0,
            'total_invoiced': 0,
            'total_paid': 0,
            'aging': {
                'current_amount': 0, 'days_30_amount': 0, 'days_60_amount': 0, 'days_90_plus_amount': 0
            }
        }
        
        if not self.client or not supplier_id:
            return data
            
        try:
            # 1. Fetch Supplier Details
            supp_res = self.client.table('store_suppliers').select('*').eq('id', supplier_id).maybe_single().execute()
            if supp_res.data:
                supplier = supp_res.data
                addr_parts = [supplier.get('address_line1'), supplier.get('address_line2'), supplier.get('city')]
                supplier['address'] = ", ".join([p for p in addr_parts if p])
                data['supplier'] = supplier
            
            # 2. Calculate Opening Balance
            opening_res = self.client.table('store_supplier_ledger')\
                .select('debit_amount, credit_amount')\
                .eq('supplier_id', supplier_id)\
                .lt('transaction_date', start_date)\
                .execute()
            
            for entry in (opening_res.data or []):
                data['opening_balance'] += (float(entry.get('credit_amount') or 0) - float(entry.get('debit_amount') or 0))
            
            # 3. Fetch Transactions
            query = self.client.table('store_supplier_ledger').select('*')\
                .eq('supplier_id', supplier_id)\
                .gte('transaction_date', start_date)\
                .lte('transaction_date', end_date)\
                .order('transaction_date', desc=False)
            
            trans_res = query.execute()
            transactions = trans_res.data or []
            
            # Summary & Running Balance
            running_bal = data['opening_balance']
            for t in transactions:
                credit = float(t.get('credit_amount') or 0)
                debit = float(t.get('debit_amount') or 0)
                
                if t.get('transaction_type') == 'invoice':
                    data['total_invoiced'] += credit
                elif t.get('transaction_type') == 'payment':
                    data['total_paid'] += debit
                
                running_bal += (credit - debit)
                t['running_balance'] = running_bal
            
            data['transactions'] = transactions
            data['closing_balance'] = running_bal
            
            # 4. Fetch Aging
            aging_res = self.client.table('store_supplier_balances').select('*')\
                .eq('supplier_id', supplier_id).maybe_single().execute()
            if aging_res.data:
                data['aging'] = aging_res.data
                
        except Exception as e:
            logger.error(f"Error fetching supplier statement: {e}")
            data['error'] = str(e)
            
        return data
    def fetch_stock_levels_data(self, branch_id: Any = None) -> Dict[str, Any]:
        """
        Fetch and calculate stock levels with variances (Theoretical vs Actual)
        Matches logic from Node.js getStockLevelsVerification
        """
        if not self.client:
            return {'stock_items': [], 'total_stock_value': 0, 'total_variance_value': 0}
            
        try:
            # 1. Fetch current stock levels
            query = self.client.table('branch_stock').select('*')
            if branch_id and str(branch_id) != '0':
                try:
                    query = query.eq('branch_id', int(branch_id))
                except:
                    query = query.eq('branch_id', branch_id)
            
            stock_res = query.execute()
            raw_stock = stock_res.data or []
            
            if not raw_stock:
                return {'stock_items': [], 'total_stock_value': 0, 'total_variance_value': 0}
            
            # 2. Fetch related items
            item_skus = list(set([s.get('item_sku') for s in raw_stock if s.get('item_sku')]))
            items_res = self.client.table('simple_items').select('id, item_name, sku, unit_of_measure, category, cost_price').in_('sku', item_skus).execute()
            item_map = {i['sku']: i for i in (items_res.data or [])}
            
            # 3. Fetch movements for last 7 days for variance analysis
            seven_days_ago = (datetime.now() - timedelta(days=7)).isoformat()
            mov_query = self.client.table('branch_stock_movements').select('*').gte('created_at', seven_days_ago)
            if branch_id and str(branch_id) != '0':
                try:
                    mov_query = mov_query.eq('branch_id', int(branch_id))
                except:
                    mov_query = mov_query.eq('branch_id', branch_id)
            
            mov_res = mov_query.execute()
            movements = mov_res.data or []
            
            # 4. Perform analysis
            stock_analysis = []
            total_stock_value = 0
            total_variance_value = 0
            
            for stock in raw_stock:
                sku = stock.get('item_sku')
                item = item_map.get(sku, {})
                
                # Filter movements for this item/branch
                item_movs = [m for m in movements if m.get('item_sku') == sku and m.get('branch_id') == stock.get('branch_id')]
                
                total_in = sum(float(m.get('quantity') or 0) for m in item_movs if m.get('movement_type') in ['RECEIPT', 'ADJUSTMENT_IN', 'TRANSFER_IN'])
                total_out = sum(float(m.get('quantity') or 0) for m in item_movs if m.get('movement_type') in ['USAGE', 'SALE', 'WASTAGE', 'ADJUSTMENT_OUT', 'TRANSFER_OUT'])
                
                current_qty = float(stock.get('quantity') or 0)
                theoretical_stock = current_qty - total_out + total_in
                variance = current_qty - theoretical_stock
                
                cost = float(item.get('cost_price') or 0)
                value = current_qty * cost
                variance_value = variance * cost
                
                total_stock_value += value
                total_variance_value += abs(variance_value)
                
                stock_analysis.append({
                    'item_name': item.get('item_name', 'Unknown Item'),
                    'item_sku': sku,
                    'current_stock': current_qty,
                    'theoretical_stock': theoretical_stock,
                    'variance': variance,
                    'variance_value': variance_value,
                    'unit': item.get('unit_of_measure', 'pcs'),
                    'cost': cost,
                    'value': value,
                    'has_discrepancy': abs(variance) > 0
                })
                
            return {
                'stock_items': stock_analysis,
                'total_stock_value': total_stock_value,
                'total_variance_value': total_variance_value
            }
            
        except Exception as e:
            logger.error(f"Error in fetch_stock_levels_data: {e}")
            return {'stock_items': [], 'total_stock_value': 0, 'total_variance_value': 0, 'error': str(e)}

    def fetch_sales_verification_data(self, branch_id: Any, start_date: str, end_date: str) -> Dict[str, Any]:
        """Fetch sales data for auditor verification"""
        if not self.client:
            return {}
            
        try:
            filters = {
                'branch_id': branch_id,
                'start_date': start_date,
                'end_date': end_date
            }
            
            # Fetch daily sales using existing method
            sales_data = self._fetch_daily_sales(filters)
            
            # Add restaurant specific summary
            rest_query = self.client.table('restaurant_orders').select('total_amount, status, payment_status')
            rest_query = self._apply_branch_filter(rest_query, filters)
            rest_query = rest_query.gte('created_at', f'{start_date}T00:00:00')\
                                   .lte('created_at', f'{end_date}T23:59:59')
            rest_res = rest_query.execute()
            rest_orders = rest_res.data or []
            
            # Add bar specific summary
            bar_query = self.client.table('bar_orders').select('total_amount, status, payment_status')
            bar_query = self._apply_branch_filter(bar_query, filters)
            bar_query = bar_query.gte('created_at', f'{start_date}T00:00:00')\
                                 .lte('created_at', f'{end_date}T23:59:59')
            bar_res = bar_query.execute()
            bar_orders = bar_res.data or []
            
            return {
                'total_revenue': sales_data.get('total_revenue', 0),
                'total_collected': sales_data.get('total_revenue', 0), # Simplified
                'restaurant': {
                    'total_value': sum(o.get('total_amount', 0) or 0 for o in rest_orders if o.get('payment_status') == 'paid'),
                    'count': len(rest_orders),
                    'voided': len([o for o in rest_orders if o.get('status') == 'voided'])
                },
                'bar': {
                    'total_value': sum(o.get('total', o.get('total_amount', 0)) or 0 for o in bar_orders if o.get('payment_status') == 'paid'),
                    'count': len(bar_orders),
                    'voided': len([o for o in bar_orders if o.get('status') == 'voided'])
                },
                'pos': {
                    'total_value': sales_data.get('total_revenue', 0),
                    'count': sales_data.get('total_transactions', 0)
                }
            }
        except Exception as e:
            logger.error(f"Error in fetch_sales_verification_data: {e}")
            return {'error': str(e)}

    def fetch_branch_orders_data(self, branch_id: Any, start_date: str, end_date: str) -> Dict[str, Any]:
        """Fetch branch orders/requisitions data for auditor"""
        if not self.client:
            return {}
            
        try:
            # Table is 'stock_requests' not 'stock_requisitions'
            query = self.client.table('stock_requests').select('*, items:stock_request_items(*)')
            if branch_id and str(branch_id) != '0':
                query = query.eq('requesting_branch_id', branch_id)
            
            query = query.gte('created_at', f'{start_date}T00:00:00')\
                         .lte('created_at', f'{end_date}T23:59:59')
            
            res = query.execute()
            requests = res.data or []
            
            return {
                'requests': requests,
                'total_requests': len(requests),
                'pending': len([r for r in requests if r.get('status') == 'pending']),
                'approved': len([r for r in requests if r.get('status') == 'approved']),
                'rejected': len([r for r in requests if r.get('status') == 'rejected']),
                'dispatched': len([r for r in requests if r.get('status') == 'dispatched'])
            }
        except Exception as e:
            logger.error(f"Error in fetch_branch_orders_data: {e}")
            return {'error': str(e)}

    def fetch_sold_items_data(self, branch_id: Any, start_date: str, end_date: str) -> List[Dict[str, Any]]:
        """Fetch aggregated sold items data"""
        if not self.client:
            return []
            
        filters = {'branch_id': branch_id, 'start_date': start_date, 'end_date': end_date}
        data = self._fetch_sold_items_agg(filters)
        return data.get('items', [])

    def fetch_financial_verification_data(self, branch_id: Any, audit_date: str) -> Dict[str, Any]:
        """Fetch financial verification data"""
        if not self.client:
            return {}
            
        filters = {'branch_id': branch_id, 'start_date': audit_date, 'end_date': audit_date}
        sales = self._fetch_daily_sales(filters)
        
        # Fetch payment data
        payment_query = self.client.table('payments').select('*, cashier:users(full_name)')
        payment_query = self._apply_branch_filter(payment_query, filters)
        payment_query = payment_query.gte('created_at', f'{audit_date}T00:00:00')\
                                     .lte('created_at', f'{audit_date}T23:59:59')\
                                     .eq('status', 'completed')
        
        pay_res = payment_query.execute()
        payments = pay_res.data or []
        
        # Group by cashier
        cashier_map = {}
        for p in payments:
            name = p.get('cashier', {}).get('full_name', 'System')
            if name not in cashier_map:
                cashier_map[name] = {'cashier_name': name, 'total_amount': 0, 'payment_count': 0}
            cashier_map[name]['total_amount'] += float(p.get('amount') or 0)
            cashier_map[name]['payment_count'] += 1
            
        return {
            'total_payments': sum(float(p.get('amount') or 0) for p in payments),
            'sales': sales.get('total_revenue', 0),
            'variance': sum(float(p.get('amount') or 0) for p in payments) - sales.get('total_revenue', 0),
            'payments_by_mode': {
                'cash': sales.get('cash_sales', 0),
                'mpesa': sales.get('mpesa_sales', 0),
                'card': sales.get('card_sales', 0)
            },
            'cashier_summaries': list(cashier_map.values())
        }

    def fetch_revenue_oversight_data(self, branch_id: Any, start_date: str, end_date: str) -> Dict[str, Any]:
        """Fetch revenue oversight data"""
        filters = {'branch_id': branch_id, 'start_date': start_date, 'end_date': end_date}
        return self._fetch_revenue_reconciliation(filters)
