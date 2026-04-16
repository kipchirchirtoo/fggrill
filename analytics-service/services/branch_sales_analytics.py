# Branch Sales Analytics Service
# Handles data aggregation and analysis for branch manager dashboard

from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal
import psycopg2
from psycopg2.extras import RealDictCursor
from config.database import get_db_connection


class BranchSalesAnalytics:
    """Service for aggregating and analyzing branch sales data"""

    def __init__(self):
        self.conn = None

    def _get_connection(self):
        """Get database connection"""
        if not self.conn or self.conn.closed:
            self.conn = get_db_connection()
        return self.conn

    def aggregate_sales_data(
        self,
        branch_id: int,
        start_date: str,
        end_date: str,
        filters: Optional[Dict[str, List[str]]] = None
    ) -> Dict[str, Any]:
        """
        Aggregate sales data from multiple sources (bookings, restaurant_orders, shift_transactions)
        
        Args:
            branch_id: Branch ID to filter by
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            filters: Optional filters for payment_methods, order_types, categories
            
        Returns:
            Dictionary containing aggregated sales data
        """
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        try:
            # Build filter conditions
            filter_conditions = self._build_filter_conditions(filters)

            # Query to aggregate all sales data
            query = f"""
            WITH bookings_sales AS (
                SELECT 
                    b.id,
                    b.branch_id,
                    b.total_amount,
                    b.payment_method,
                    'booking' as source,
                    'rooms' as category,
                    NULL as order_type,
                    b.created_at as transaction_date,
                    b.status
                FROM bookings b
                WHERE b.branch_id = %s
                    AND b.status NOT IN ('cancelled')
                    AND DATE(b.created_at) BETWEEN %s AND %s
                    {filter_conditions['bookings']}
            ),
            restaurant_sales AS (
                SELECT 
                    ro.id,
                    ro.branch_id,
                    ro.total_amount,
                    ro.payment_method,
                    'restaurant' as source,
                    'restaurant' as category,
                    ro.order_type,
                    ro.created_at as transaction_date,
                    ro.status
                FROM restaurant_orders ro
                WHERE ro.branch_id = %s
                    AND ro.status NOT IN ('cancelled')
                    AND DATE(ro.created_at) BETWEEN %s AND %s
                    {filter_conditions['restaurant']}
            ),
            shift_sales AS (
                SELECT 
                    st.id,
                    st.branch_id,
                    st.total_amount,
                    st.payment_method,
                    'shift_transaction' as source,
                    COALESCE(st.service_category, 'other') as category,
                    NULL as order_type,
                    st.transaction_date,
                    'completed' as status
                FROM shift_transactions st
                WHERE st.branch_id = %s
                    AND DATE(st.transaction_date) BETWEEN %s AND %s
                    {filter_conditions['shift']}
            ),
            all_sales AS (
                SELECT * FROM bookings_sales
                UNION ALL
                SELECT * FROM restaurant_sales
                UNION ALL
                SELECT * FROM shift_sales
            )
            SELECT 
                id,
                branch_id,
                total_amount,
                payment_method,
                source,
                category,
                order_type,
                transaction_date,
                status,
                DATE(transaction_date) as sale_date
            FROM all_sales
            ORDER BY transaction_date DESC
            """

            # Execute query with parameters (branch_id and dates repeated for each CTE)
            params = [
                branch_id, start_date, end_date,  # bookings
                branch_id, start_date, end_date,  # restaurant
                branch_id, start_date, end_date   # shift_transactions
            ]

            cursor.execute(query, params)
            transactions = cursor.fetchall()

            # Calculate metrics
            summary = self._calculate_summary_metrics(transactions)
            daily_breakdown = self._calculate_daily_breakdown(transactions)
            payment_breakdown = self._calculate_payment_breakdown(transactions)
            category_breakdown = self._calculate_category_breakdown(transactions)

            return {
                'summary': summary,
                'daily_breakdown': daily_breakdown,
                'payment_method_breakdown': payment_breakdown,
                'category_breakdown': category_breakdown,
                'transactions': [self._serialize_transaction(t) for t in transactions[:1000]]  # Limit to 1000 for performance
            }

        except Exception as e:
            print(f"Error aggregating sales data: {str(e)}")
            raise
        finally:
            cursor.close()

    def _build_filter_conditions(self, filters: Optional[Dict[str, List[str]]]) -> Dict[str, str]:
        """Build SQL filter conditions based on provided filters"""
        conditions = {
            'bookings': '',
            'restaurant': '',
            'shift': ''
        }

        if not filters:
            return conditions

        # Payment method filter (applies to all sources)
        if filters.get('payment_methods'):
            payment_methods = ', '.join([f"'{pm}'" for pm in filters['payment_methods']])
            payment_filter = f"AND payment_method IN ({payment_methods})"
            conditions['bookings'] += f" {payment_filter}"
            conditions['restaurant'] += f" {payment_filter}"
            conditions['shift'] += f" {payment_filter}"

        # Order type filter (only for restaurant)
        if filters.get('order_types'):
            order_types = ', '.join([f"'{ot}'" for ot in filters['order_types']])
            conditions['restaurant'] += f" AND order_type IN ({order_types})"

        # Category filter (applies to shift transactions)
        if filters.get('categories'):
            categories = ', '.join([f"'{cat}'" for cat in filters['categories']])
            conditions['shift'] += f" AND service_category IN ({categories})"

        return conditions

    def _calculate_summary_metrics(self, transactions: List[Dict]) -> Dict[str, Any]:
        """Calculate summary metrics from transactions"""
        if not transactions:
            return {
                'total_sales': 0,
                'transaction_count': 0,
                'avg_transaction_value': 0
            }

        total_sales = sum(float(t['total_amount']) for t in transactions)
        transaction_count = len(transactions)
        avg_transaction_value = total_sales / transaction_count if transaction_count > 0 else 0

        return {
            'total_sales': round(total_sales, 2),
            'transaction_count': transaction_count,
            'avg_transaction_value': round(avg_transaction_value, 2)
        }

    def _calculate_daily_breakdown(self, transactions: List[Dict]) -> List[Dict[str, Any]]:
        """Calculate daily sales breakdown"""
        daily_data = {}

        for t in transactions:
            sale_date = t['sale_date'].isoformat() if isinstance(t['sale_date'], date) else str(t['sale_date'])
            
            if sale_date not in daily_data:
                daily_data[sale_date] = {
                    'date': sale_date,
                    'total_sales': 0,
                    'transaction_count': 0
                }
            
            daily_data[sale_date]['total_sales'] += float(t['total_amount'])
            daily_data[sale_date]['transaction_count'] += 1

        # Calculate average and round values
        result = []
        for date_str, data in sorted(daily_data.items()):
            result.append({
                'date': date_str,
                'total_sales': round(data['total_sales'], 2),
                'transaction_count': data['transaction_count'],
                'avg_transaction_value': round(data['total_sales'] / data['transaction_count'], 2)
            })

        return result

    def _calculate_payment_breakdown(self, transactions: List[Dict]) -> List[Dict[str, Any]]:
        """Calculate payment method breakdown"""
        payment_data = {}
        total_sales = sum(float(t['total_amount']) for t in transactions)

        for t in transactions:
            payment_method = t['payment_method'] or 'unknown'
            
            if payment_method not in payment_data:
                payment_data[payment_method] = {
                    'payment_method': payment_method,
                    'total_sales': 0,
                    'transaction_count': 0
                }
            
            payment_data[payment_method]['total_sales'] += float(t['total_amount'])
            payment_data[payment_method]['transaction_count'] += 1

        # Calculate percentages
        result = []
        for pm, data in payment_data.items():
            percentage = (data['total_sales'] / total_sales * 100) if total_sales > 0 else 0
            result.append({
                'payment_method': pm,
                'total_sales': round(data['total_sales'], 2),
                'transaction_count': data['transaction_count'],
                'percentage': round(percentage, 2)
            })

        return sorted(result, key=lambda x: x['total_sales'], reverse=True)

    def _calculate_category_breakdown(self, transactions: List[Dict]) -> List[Dict[str, Any]]:
        """Calculate category breakdown"""
        category_data = {}
        total_sales = sum(float(t['total_amount']) for t in transactions)

        for t in transactions:
            category = t['category'] or 'other'
            
            if category not in category_data:
                category_data[category] = {
                    'category': category,
                    'total_sales': 0,
                    'transaction_count': 0
                }
            
            category_data[category]['total_sales'] += float(t['total_amount'])
            category_data[category]['transaction_count'] += 1

        # Calculate percentages
        result = []
        for cat, data in category_data.items():
            percentage = (data['total_sales'] / total_sales * 100) if total_sales > 0 else 0
            result.append({
                'category': cat,
                'total_sales': round(data['total_sales'], 2),
                'transaction_count': data['transaction_count'],
                'percentage': round(percentage, 2)
            })

        return sorted(result, key=lambda x: x['total_sales'], reverse=True)

    def _serialize_transaction(self, transaction: Dict) -> Dict[str, Any]:
        """Serialize transaction for JSON response"""
        return {
            'id': str(transaction['id']),
            'branch_id': transaction['branch_id'],
            'transaction_date': transaction['transaction_date'].isoformat() if isinstance(transaction['transaction_date'], (date, datetime)) else str(transaction['transaction_date']),
            'category': transaction['category'],
            'payment_method': transaction['payment_method'],
            'order_type': transaction['order_type'],
            'total_amount': float(transaction['total_amount']),
            'status': transaction['status'],
            'source': transaction['source']
        }

    def get_branch_name(self, branch_id: int) -> str:
        """Get branch name by ID"""
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cursor.execute("SELECT name FROM branches WHERE id = %s", (branch_id,))
            result = cursor.fetchone()
            return result['name'] if result else f"Branch {branch_id}"
        except Exception as e:
            print(f"Error fetching branch name: {str(e)}")
            return f"Branch {branch_id}"
        finally:
            cursor.close()

    def close(self):
        """Close database connection"""
        if self.conn and not self.conn.closed:
            self.conn.close()
