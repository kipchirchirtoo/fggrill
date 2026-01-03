"""
Restaurant Sales Data Fetcher
Enhanced restaurant sales reporting with real database integration
"""

import logging
from datetime import datetime
from typing import Dict, Any, List
from .database_fetcher import DatabaseFetcher

logger = logging.getLogger(__name__)


class RestaurantSalesFetcher(DatabaseFetcher):
    """Enhanced restaurant sales data fetcher"""
    
    def _fetch_restaurant_sales(self, filters: Dict) -> Dict[str, Any]:
        """Fetch comprehensive restaurant sales data"""
        start_date, end_date = self._parse_dates(filters)
        branch_id = filters.get('branch_id')
        
        data = {
            'total_revenue': 0,
            'total_orders': 0,
            'avg_order_value': 0,
            'top_items': [],
            'hourly_sales': [],
            'payment_breakdown': {
                'cash': 0,
                'card': 0,
                'mpesa': 0
            },
            'order_types': {
                'dine_in': {'count': 0, 'revenue': 0},
                'takeaway': {'count': 0, 'revenue': 0},
                'room_service': {'count': 0, 'revenue': 0}
            },
            'daily_breakdown': []
        }
        
        if not self.client:
            return data
        
        try:
            # Fetch restaurant orders with items
            orders_query = self.client.table('restaurant_orders').select('''
                *,
                items:restaurant_order_items(
                    *,
                    menu_item:restaurant_menu_items(name, category_id)
                )
            ''')
            orders_query = orders_query.gte('created_at', f'{start_date}T00:00:00')
            orders_query = orders_query.lte('created_at', f'{end_date}T23:59:59')
            if branch_id:
                orders_query = orders_query.eq('branch_id', branch_id)
            
            orders = orders_query.execute()
            
            # Process orders
            item_sales = {}
            hourly_data = {}
            daily_data = {}
            
            for order in (orders.data or []):
                total = order.get('total_amount', 0) or 0
                order_type = order.get('order_type', 'dine_in')
                payment_method = (order.get('payment_method', '') or '').lower()
                created_at = order.get('created_at', '')
                
                # Basic totals
                data['total_revenue'] += total
                data['total_orders'] += 1
                
                # Order type breakdown
                if order_type in data['order_types']:
                    data['order_types'][order_type]['count'] += 1
                    data['order_types'][order_type]['revenue'] += total
                
                # Payment method breakdown
                if 'cash' in payment_method:
                    data['payment_breakdown']['cash'] += total
                elif 'card' in payment_method:
                    data['payment_breakdown']['card'] += total
                elif 'mpesa' in payment_method or 'm-pesa' in payment_method:
                    data['payment_breakdown']['mpesa'] += total
                
                # Hourly breakdown
                if created_at:
                    try:
                        hour = datetime.fromisoformat(created_at.replace('Z', '+00:00')).hour
                        if hour not in hourly_data:
                            hourly_data[hour] = {'orders': 0, 'revenue': 0}
                        hourly_data[hour]['orders'] += 1
                        hourly_data[hour]['revenue'] += total
                    except:
                        pass
                
                # Daily breakdown
                if created_at:
                    try:
                        date = created_at[:10]
                        if date not in daily_data:
                            daily_data[date] = {'orders': 0, 'revenue': 0}
                        daily_data[date]['orders'] += 1
                        daily_data[date]['revenue'] += total
                    except:
                        pass
                
                # Process order items for top items
                items = order.get('items', []) or []
                for item in items:
                    menu_item = item.get('menu_item', {}) or {}
                    item_name = menu_item.get('name', 'Unknown Item')
                    quantity = item.get('quantity', 0) or 0
                    unit_price = item.get('unit_price', 0) or 0
                    
                    if item_name not in item_sales:
                        item_sales[item_name] = {
                            'name': item_name,
                            'quantity': 0,
                            'revenue': 0,
                            'category': menu_item.get('category_id', 'Other')
                        }
                    
                    item_sales[item_name]['quantity'] += quantity
                    item_sales[item_name]['revenue'] += quantity * unit_price
            
            # Calculate averages
            if data['total_orders'] > 0:
                data['avg_order_value'] = data['total_revenue'] / data['total_orders']
            
            # Top selling items
            data['top_items'] = sorted(
                item_sales.values(),
                key=lambda x: x['revenue'],
                reverse=True
            )[:10]
            
            # Hourly sales
            data['hourly_sales'] = [
                {
                    'hour': f"{hour:02d}:00",
                    'orders': hourly_data.get(hour, {}).get('orders', 0),
                    'revenue': hourly_data.get(hour, {}).get('revenue', 0)
                }
                for hour in range(24)
            ]
            
            # Daily breakdown
            data['daily_breakdown'] = [
                {
                    'date': date,
                    'orders': stats['orders'],
                    'revenue': stats['revenue']
                }
                for date, stats in sorted(daily_data.items())
            ]
            
        except Exception as e:
            logger.error(f"Error fetching restaurant sales: {e}")
        
        return data
    
    def _fetch_bar_sales(self, filters: Dict) -> Dict[str, Any]:
        """Fetch bar sales data"""
        start_date, end_date = self._parse_dates(filters)
        branch_id = filters.get('branch_id')
        
        data = {
            'total_revenue': 0,
            'total_orders': 0,
            'avg_order_value': 0,
            'top_drinks': [],
            'categories': []
        }
        
        if not self.client:
            return data
        
        try:
            # Fetch bar orders
            bar_query = self.client.table('bar_orders').select('*')
            bar_query = bar_query.gte('created_at', f'{start_date}T00:00:00')
            bar_query = bar_query.lte('created_at', f'{end_date}T23:59:59')
            if branch_id:
                bar_query = bar_query.eq('branch_id', branch_id)
            
            bar_orders = bar_query.execute()
            
            for order in (bar_orders.data or []):
                total = order.get('total_amount', 0) or 0
                data['total_revenue'] += total
                data['total_orders'] += 1
            
            if data['total_orders'] > 0:
                data['avg_order_value'] = data['total_revenue'] / data['total_orders']
            
        except Exception as e:
            logger.error(f"Error fetching bar sales: {e}")
        
        return data
