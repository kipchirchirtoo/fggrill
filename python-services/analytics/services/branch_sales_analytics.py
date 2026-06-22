from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal
import os
import psycopg2
from psycopg2.extras import RealDictCursor


class BranchSalesAnalytics:
    """Service for aggregating and analyzing branch sales data."""

    def __init__(self):
        self.conn = None
        self._table_exists_cache: Dict[str, bool] = {}

    def _get_connection(self):
        if not self.conn or self.conn.closed:
            self.conn = psycopg2.connect(
                os.getenv('DATABASE_URL'),
                cursor_factory=RealDictCursor
            )
        return self.conn

    def _table_exists(self, table_name: str) -> bool:
        """Some deployments of this schema are missing tables/columns that
        the migration files claim to add (confirmed via live testing: e.g.
        pos_shift_orders.payment_method and conference_bookings were both
        absent on at least one live database). Rather than hard-crash the
        whole report when an optional revenue source isn't present on a
        given installation, check existence once and skip that source."""
        if table_name in self._table_exists_cache:
            return self._table_exists_cache[table_name]
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            cursor.execute("SELECT to_regclass(%s) IS NOT NULL as exists", (f'public.{table_name}',))
            exists = bool(cursor.fetchone()['exists'])
        except Exception:
            conn.rollback()
            exists = False
        finally:
            cursor.close()
        self._table_exists_cache[table_name] = exists
        return exists

    def aggregate_sales_data(
        self,
        branch_id: int,
        start_date: str,
        end_date: str,
        filters: Optional[Dict[str, List[str]]] = None
    ) -> Dict[str, Any]:
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        try:
            filter_conditions = self._build_filter_conditions(filters)
            has_conference = self._table_exists('conference_bookings')

            # bar_sales and pos_sales were missing entirely until this fix, so
            # "Total Sales" silently excluded every bar_orders sale and every
            # outlet-POS sale (pos_shift_orders) -- the primary sales path for
            # restaurant/bar outlets. pos_shift_orders has no branch_id of its
            # own (it's outlet-scoped), so it's joined through pos_outlets.
            # conference_bookings is conditional: some deployments of this
            # schema don't have the table even though the migration claims to
            # create it (confirmed via live testing), so skip it gracefully
            # rather than 500 the whole report for branches without a hall.
            conference_cte = f"""
            , conference_sales AS (
                SELECT
                    cb.id,
                    cb.branch_id,
                    cb.total_amount,
                    NULL::text as payment_method,
                    'conference'::text as source,
                    'conference'::text as category,
                    NULL::text as order_type,
                    cb.created_at as transaction_date,
                    cb.status::text as status,
                    cb.booking_number::text as code,
                    NULL::text as short_code,
                    'Conference Hall'::text as outlet
                FROM conference_bookings cb
                WHERE cb.branch_id = %s
                    AND cb.status NOT IN ('cancelled', 'draft')
                    AND DATE(cb.created_at) BETWEEN %s AND %s
                    {filter_conditions['conference']}
            )
            """ if has_conference else ""
            conference_union = "UNION ALL SELECT * FROM conference_sales" if has_conference else ""

            query = f"""
            WITH bookings_sales AS (
                SELECT
                    b.id,
                    b.branch_id,
                    b.total_amount,
                    b.payment_method::text as payment_method,
                    'booking'::text as source,
                    'rooms'::text as category,
                    NULL::text as order_type,
                    b.created_at as transaction_date,
                    b.status::text as status,
                    b.booking_number::text as code,
                    NULL::text as short_code,
                    'Rooms / Front Office'::text as outlet
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
                    COALESCE(ro.grand_total, ro.total_amount) as total_amount,
                    ro.payment_status::text as payment_method,
                    'restaurant'::text as source,
                    'restaurant'::text as category,
                    ro.order_type::text as order_type,
                    ro.created_at as transaction_date,
                    ro.status::text as status,
                    ro.order_number::text as code,
                    ro.bill_number::text as short_code,
                    COALESCE(ro.department, 'Restaurant')::text as outlet
                FROM restaurant_orders ro
                WHERE ro.branch_id = %s
                    AND ro.status NOT IN ('cancelled')
                    AND DATE(ro.created_at) BETWEEN %s AND %s
                    {filter_conditions['restaurant']}
            ),
            bar_sales AS (
                SELECT
                    bo.id,
                    bo.branch_id,
                    COALESCE(bo.total, bo.subtotal, 0) as total_amount,
                    bo.payment_method::text as payment_method,
                    'bar'::text as source,
                    'bar'::text as category,
                    NULL::text as order_type,
                    bo.created_at as transaction_date,
                    bo.status::text as status,
                    bo.order_number::text as code,
                    NULL::text as short_code,
                    'Bar'::text as outlet
                FROM bar_orders bo
                WHERE bo.branch_id = %s
                    AND bo.status NOT IN ('cancelled')
                    AND DATE(bo.created_at) BETWEEN %s AND %s
                    {filter_conditions['bar']}
            ),
            pos_sales AS (
                SELECT
                    pso.id,
                    po.branch_id,
                    pso.total_amount,
                    COALESCE(
                        (SELECT psp.payment_method FROM pos_shift_payments psp
                         WHERE psp.order_id = pso.id ORDER BY psp.created_at DESC LIMIT 1),
                        pso.payment_status
                    )::text as payment_method,
                    'pos'::text as source,
                    CASE
                        WHEN po.outlet_type = 'restaurant' THEN 'restaurant'
                        WHEN po.outlet_type IN ('main_bar', 'executive_bar', 'sports_bar') THEN 'bar'
                        ELSE 'other'
                    END::text as category,
                    pso.order_type::text as order_type,
                    pso.created_at as transaction_date,
                    CASE WHEN pso.payment_status = 'credit_bill' THEN 'credit_bill' ELSE 'completed' END::text as status,
                    pso.order_number::text as code,
                    pso.short_code::text as short_code,
                    COALESCE(po.name, 'POS Outlet')::text as outlet
                FROM pos_shift_orders pso
                JOIN pos_outlets po ON po.id = pso.outlet_id
                WHERE po.branch_id = %s
                    AND (pso.status IN ('paid', 'credit_bill') OR pso.payment_status IN ('paid', 'credit_bill'))
                    AND DATE(pso.created_at) BETWEEN %s AND %s
                    {filter_conditions['pos']}
            ),
            shift_sales AS (
                SELECT
                    st.id,
                    st.branch_id,
                    st.total_amount,
                    st.payment_method::text as payment_method,
                    'shift_transaction'::text as source,
                    COALESCE(st.service_category::text, 'other') as category,
                    NULL::text as order_type,
                    st.created_at as transaction_date,
                    'completed'::text as status,
                    st.transaction_number::text as code,
                    NULL::text as short_code,
                    COALESCE(st.service_category::text, 'POS')::text as outlet
                FROM shift_transactions st
                WHERE st.branch_id = %s
                    AND DATE(st.created_at) BETWEEN %s AND %s
                    {filter_conditions['shift']}
            )
            {conference_cte}
            , all_sales AS (
                SELECT * FROM bookings_sales
                UNION ALL
                SELECT * FROM restaurant_sales
                UNION ALL
                SELECT * FROM bar_sales
                UNION ALL
                SELECT * FROM pos_sales
                UNION ALL
                SELECT * FROM shift_sales
                {conference_union}
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
                code,
                short_code,
                outlet,
                DATE(transaction_date) as sale_date
            FROM all_sales
            ORDER BY transaction_date DESC
            """

            params = [
                branch_id, start_date, end_date,
                branch_id, start_date, end_date,
                branch_id, start_date, end_date,
                branch_id, start_date, end_date,
                branch_id, start_date, end_date,
            ]
            if has_conference:
                params += [branch_id, start_date, end_date]

            cursor.execute(query, params)
            transactions = cursor.fetchall()

            summary = self._calculate_summary_metrics(transactions)
            daily_breakdown = self._calculate_daily_breakdown(transactions)
            payment_breakdown = self._calculate_payment_breakdown(transactions)
            category_breakdown = self._calculate_category_breakdown(transactions)
            revenue_by_source = self._calculate_revenue_by_source(transactions)

            return {
                'summary': summary,
                'daily_breakdown': daily_breakdown,
                'payment_method_breakdown': payment_breakdown,
                'category_breakdown': category_breakdown,
                'revenue_by_source': revenue_by_source,
                'transactions': [self._serialize_transaction(t) for t in transactions[:1000]]
            }
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()

    def _build_filter_conditions(self, filters: Optional[Dict[str, List[str]]]) -> Dict[str, str]:
        conditions = {
            'bookings': '',
            'restaurant': '',
            'bar': '',
            'pos': '',
            'shift': '',
            'conference': ''
        }

        if not filters:
            return conditions

        if filters.get('payment_methods'):
            payment_methods = ', '.join([f"'{pm}'" for pm in filters['payment_methods']])
            payment_filter = f"AND payment_method IN ({payment_methods})"
            conditions['bookings'] += f" {payment_filter}"
            conditions['restaurant'] += f" {payment_filter}"
            conditions['bar'] += f" {payment_filter}"
            conditions['pos'] += f" {payment_filter}"
            conditions['shift'] += f" {payment_filter}"

        if filters.get('order_types'):
            order_types = ', '.join([f"'{ot}'" for ot in filters['order_types']])
            conditions['restaurant'] += f" AND order_type IN ({order_types})"

        if filters.get('categories'):
            categories = ', '.join([f"'{cat}'" for cat in filters['categories']])
            conditions['shift'] += f" AND service_category IN ({categories})"

        return conditions

    def _calculate_revenue_by_source(self, transactions: List[Dict[str, Any]]) -> Dict[str, float]:
        sources = {'bookings': 0.0, 'restaurant': 0.0, 'bar': 0.0, 'other': 0.0}
        for transaction in transactions:
            amount = float(transaction['total_amount'] or 0)
            category = transaction['category'] or 'other'
            if category == 'rooms':
                sources['bookings'] += amount
            elif category == 'restaurant':
                sources['restaurant'] += amount
            elif category == 'bar':
                sources['bar'] += amount
            else:
                sources['other'] += amount
        return {key: round(value, 2) for key, value in sources.items()}

    def get_expense_breakdown(self, branch_id: int, start_date: str, end_date: str) -> Dict[str, Any]:
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            categories: Dict[str, float] = {}

            cursor.execute(
                """
                SELECT category, amount FROM expenses
                WHERE branch_id = %s AND status IN ('approved', 'paid')
                    AND expense_date BETWEEN %s AND %s
                """,
                (branch_id, start_date, end_date)
            )
            for row in cursor.fetchall():
                cat = row['category'] or 'Other'
                categories[cat] = categories.get(cat, 0) + float(row['amount'] or 0)

            cursor.execute(
                """
                SELECT category, amount FROM finance_transactions
                WHERE branch_id = %s AND transaction_type = 'expense'
                    AND DATE(created_at) BETWEEN %s AND %s
                """,
                (branch_id, start_date, end_date)
            )
            for row in cursor.fetchall():
                cat = row['category'] or 'Other'
                categories[cat] = categories.get(cat, 0) + float(row['amount'] or 0)

            total = round(sum(categories.values()), 2)
            return {'total': total, 'by_category': {k: round(v, 2) for k, v in categories.items()}}
        finally:
            cursor.close()

    def get_receivables_payables(self, branch_id: int) -> Dict[str, float]:
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            cursor.execute(
                "SELECT COALESCE(SUM(balance), 0) as total FROM accounting_ar_invoices WHERE branch_id = %s AND status != 'paid'",
                (branch_id,)
            )
            receivables = float(cursor.fetchone()['total'] or 0)

            cursor.execute(
                "SELECT COALESCE(SUM(balance), 0) as total FROM accounting_ap_bills WHERE branch_id = %s AND status != 'paid'",
                (branch_id,)
            )
            payables = float(cursor.fetchone()['total'] or 0)

            return {'receivables': round(receivables, 2), 'payables': round(payables, 2)}
        finally:
            cursor.close()

    def get_staff_audit_summary(self, branch_id: int, start_date: str, end_date: str) -> Dict[str, Any]:
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        critical_actions = ('delete', 'void', 'discount', 'refund', 'role_change', 'permission_change')
        try:
            cursor.execute(
                """
                SELECT al.id, al.user_id, al.action, al.created_at,
                       u.first_name, u.last_name
                FROM audit_logs al
                LEFT JOIN users u ON u.id = al.user_id
                WHERE u.branch_id = %s
                    AND DATE(al.created_at) BETWEEN %s AND %s
                ORDER BY al.created_at DESC
                LIMIT 500
                """,
                (branch_id, start_date, end_date)
            )
            logs = cursor.fetchall()

            critical = [log for log in logs if str(log['action'] or '').lower() in critical_actions]
            recent_critical = [
                {
                    'user_name': f"{log['first_name'] or ''} {log['last_name'] or ''}".strip() or 'Unknown',
                    'action': log['action'],
                    'created_at': log['created_at'].isoformat() if log['created_at'] else None,
                }
                for log in critical[:15]
            ]

            return {
                'total_actions': len(logs),
                'critical_actions': len(critical),
                'unique_users': len({log['user_id'] for log in logs if log['user_id']}),
                'recent_critical': recent_critical,
            }
        finally:
            cursor.close()

    def _calculate_summary_metrics(self, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
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

    def _calculate_daily_breakdown(self, transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        daily_data: Dict[str, Dict[str, Any]] = {}

        for transaction in transactions:
            sale_date = transaction['sale_date'].isoformat() if isinstance(transaction['sale_date'], date) else str(transaction['sale_date'])

            if sale_date not in daily_data:
                daily_data[sale_date] = {
                    'date': sale_date,
                    'total_sales': 0,
                    'transaction_count': 0
                }

            daily_data[sale_date]['total_sales'] += float(transaction['total_amount'])
            daily_data[sale_date]['transaction_count'] += 1

        result = []
        for date_str, data in sorted(daily_data.items()):
            result.append({
                'date': date_str,
                'total_sales': round(data['total_sales'], 2),
                'transaction_count': data['transaction_count'],
                'avg_transaction_value': round(data['total_sales'] / data['transaction_count'], 2)
            })

        return result

    def _calculate_payment_breakdown(self, transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        payment_data: Dict[str, Dict[str, Any]] = {}
        total_sales = sum(float(t['total_amount']) for t in transactions)

        for transaction in transactions:
            payment_method = transaction['payment_method'] or 'unknown'

            if payment_method not in payment_data:
                payment_data[payment_method] = {
                    'payment_method': payment_method,
                    'total_sales': 0,
                    'transaction_count': 0
                }

            payment_data[payment_method]['total_sales'] += float(transaction['total_amount'])
            payment_data[payment_method]['transaction_count'] += 1

        result = []
        for payment_method, data in payment_data.items():
            percentage = (data['total_sales'] / total_sales * 100) if total_sales > 0 else 0
            result.append({
                'payment_method': payment_method,
                'total_sales': round(data['total_sales'], 2),
                'transaction_count': data['transaction_count'],
                'percentage': round(percentage, 2)
            })

        return sorted(result, key=lambda item: item['total_sales'], reverse=True)

    def _calculate_category_breakdown(self, transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        category_data: Dict[str, Dict[str, Any]] = {}
        total_sales = sum(float(t['total_amount']) for t in transactions)

        for transaction in transactions:
            category = transaction['category'] or 'other'

            if category not in category_data:
                category_data[category] = {
                    'category': category,
                    'total_sales': 0,
                    'transaction_count': 0
                }

            category_data[category]['total_sales'] += float(transaction['total_amount'])
            category_data[category]['transaction_count'] += 1

        result = []
        for category, data in category_data.items():
            percentage = (data['total_sales'] / total_sales * 100) if total_sales > 0 else 0
            result.append({
                'category': category,
                'total_sales': round(data['total_sales'], 2),
                'transaction_count': data['transaction_count'],
                'percentage': round(percentage, 2)
            })

        return sorted(result, key=lambda item: item['total_sales'], reverse=True)

    def _serialize_transaction(self, transaction: Dict[str, Any]) -> Dict[str, Any]:
        return {
            'id': str(transaction['id']),
            'branch_id': transaction['branch_id'],
            'transaction_date': transaction['transaction_date'].isoformat() if isinstance(transaction['transaction_date'], (date, datetime)) else str(transaction['transaction_date']),
            'category': transaction['category'],
            'payment_method': transaction['payment_method'],
            'order_type': transaction['order_type'],
            'total_amount': float(transaction['total_amount']) if isinstance(transaction['total_amount'], Decimal) else float(transaction['total_amount'] or 0),
            'status': transaction['status'],
            'source': transaction['source'],
            'code': transaction.get('code'),
            'short_code': transaction.get('short_code'),
            'outlet': transaction.get('outlet')
        }

    def get_branch_name(self, branch_id: int) -> str:
        conn = self._get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cursor.execute('SELECT name FROM branches WHERE id = %s', (branch_id,))
            result = cursor.fetchone()
            return result['name'] if result else f'Branch {branch_id}'
        finally:
            cursor.close()

    def close(self):
        if self.conn and not self.conn.closed:
            self.conn.close()
