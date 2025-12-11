"""
Finance Service - Core business logic for financial operations
"""
import os
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Any
from supabase import create_client, Client
import logging

logger = logging.getLogger(__name__)


class FinanceService:
    """Service class for finance operations"""
    
    def __init__(self):
        self.supabase: Client = create_client(
            os.getenv('SUPABASE_URL'),
            os.getenv('SUPABASE_SERVICE_KEY')
        )
    
    # ==================== DASHBOARD ====================
    
    def get_dashboard(self, branch_id: Optional[int] = None) -> Dict[str, Any]:
        """Get finance dashboard summary"""
        try:
            today = datetime.now()
            start_of_month = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            last_month_start = (start_of_month - timedelta(days=1)).replace(day=1)
            last_month_end = start_of_month - timedelta(days=1)
            
            # Current month transactions
            query = self.supabase.table('finance_transactions').select('amount, transaction_type')
            if branch_id:
                query = query.eq('branch_id', branch_id)
            query = query.gte('created_at', start_of_month.isoformat())
            current = query.execute()
            
            # Last month transactions
            query_last = self.supabase.table('finance_transactions').select('amount, transaction_type')
            if branch_id:
                query_last = query_last.eq('branch_id', branch_id)
            query_last = query_last.gte('created_at', last_month_start.isoformat()).lte('created_at', last_month_end.isoformat())
            last_month = query_last.execute()
            
            # Calculate totals
            current_revenue = sum(float(t['amount']) for t in (current.data or []) if t['transaction_type'] == 'income')
            current_expenses = sum(float(t['amount']) for t in (current.data or []) if t['transaction_type'] == 'expense')
            last_revenue = sum(float(t['amount']) for t in (last_month.data or []) if t['transaction_type'] == 'income')
            last_expenses = sum(float(t['amount']) for t in (last_month.data or []) if t['transaction_type'] == 'expense')
            
            # Calculate changes
            revenue_change = ((current_revenue - last_revenue) / last_revenue * 100) if last_revenue > 0 else 0
            expense_change = ((current_expenses - last_expenses) / last_expenses * 100) if last_expenses > 0 else 0
            
            # Pending payments (unpaid invoices)
            pending_query = self.supabase.table('accounting_ar_invoices').select('balance').neq('status', 'paid')
            pending = pending_query.execute()
            pending_payments = sum(float(p['balance']) for p in (pending.data or []))
            
            return {
                'totalRevenue': round(current_revenue, 2),
                'totalExpenses': round(current_expenses, 2),
                'netProfit': round(current_revenue - current_expenses, 2),
                'pendingPayments': round(pending_payments, 2),
                'revenueChange': round(revenue_change, 1),
                'expenseChange': round(expense_change, 1)
            }
        except Exception as e:
            logger.error(f"Error getting dashboard: {e}")
            return {
                'totalRevenue': 0, 'totalExpenses': 0, 'netProfit': 0,
                'pendingPayments': 0, 'revenueChange': 0, 'expenseChange': 0
            }
    
    # ==================== TRANSACTIONS ====================
    
    def get_transactions(self, params: Dict[str, Any]) -> List[Dict]:
        """Get financial transactions"""
        try:
            query = self.supabase.table('finance_transactions').select('*').order('created_at', desc=True)
            
            if params.get('branch_id'):
                query = query.eq('branch_id', params['branch_id'])
            if params.get('type'):
                query = query.eq('transaction_type', params['type'])
            if params.get('from_date'):
                query = query.gte('created_at', params['from_date'])
            if params.get('to_date'):
                query = query.lte('created_at', params['to_date'])
            
            result = query.limit(100).execute()
            
            return [{
                'id': t['id'],
                'type': t['transaction_type'],
                'description': t['description'],
                'amount': float(t['amount']),
                'category': t.get('category'),
                'date': t['created_at'],
                'payment_method': t.get('payment_method'),
                'reference': t.get('payment_reference')
            } for t in (result.data or [])]
        except Exception as e:
            logger.error(f"Error getting transactions: {e}")
            return []
    
    # ==================== EXPENSES ====================
    
    def get_expenses(self, params: Dict[str, Any]) -> List[Dict]:
        """Get expenses"""
        try:
            query = self.supabase.table('expenses').select('*').order('created_at', desc=True)
            
            if params.get('branch_id'):
                query = query.eq('branch_id', params['branch_id'])
            if params.get('status'):
                query = query.eq('status', params['status'])
            if params.get('category'):
                query = query.eq('category', params['category'])
            
            result = query.limit(100).execute()
            
            return [{
                'id': str(e['id']),
                'description': e['description'],
                'amount': float(e['amount']),
                'category': e['category'],
                'status': e['status'],
                'date': e['expense_date'],
                'submitted_by': e.get('created_by'),
                'approved_by': e.get('approved_by')
            } for e in (result.data or [])]
        except Exception as e:
            logger.error(f"Error getting expenses: {e}")
            return []
    
    def create_expense(self, data: Dict[str, Any], user_id: str) -> Dict:
        """Create new expense"""
        try:
            expense = {
                'description': data['description'],
                'amount': data['amount'],
                'category': data.get('category', 'Other'),
                'expense_date': data.get('date', datetime.now().date().isoformat()),
                'created_by': user_id,
                'status': 'pending'
            }
            if data.get('branch_id'):
                expense['branch_id'] = data['branch_id']
            
            result = self.supabase.table('expenses').insert(expense).execute()
            return result.data[0] if result.data else {}
        except Exception as e:
            logger.error(f"Error creating expense: {e}")
            raise
    
    # ==================== INVOICES ====================
    
    def get_invoices(self) -> List[Dict]:
        """Get invoices"""
        try:
            result = self.supabase.table('accounting_ar_invoices').select('*').order('created_at', desc=True).limit(100).execute()
            
            return [{
                'id': inv['id'],
                'invoice_number': inv['invoice_number'],
                'customer_name': inv.get('reference', 'Customer'),
                'amount': float(inv['total_amount']),
                'status': inv['status'],
                'due_date': inv['due_date'],
                'created_at': inv['created_at']
            } for inv in (result.data or [])]
        except Exception as e:
            logger.error(f"Error getting invoices: {e}")
            return []
    
    def create_invoice(self, data: Dict[str, Any], user_id: str) -> Dict:
        """Create new invoice"""
        try:
            # Generate invoice number
            count = self.supabase.table('accounting_ar_invoices').select('id', count='exact').execute()
            invoice_number = f"INV-{datetime.now().strftime('%Y%m')}-{(count.count or 0) + 1:04d}"
            
            invoice = {
                'invoice_number': invoice_number,
                'invoice_date': datetime.now().date().isoformat(),
                'due_date': data.get('due_date', (datetime.now() + timedelta(days=30)).date().isoformat()),
                'subtotal': data.get('subtotal', data['amount']),
                'tax_amount': data.get('tax', 0),
                'total_amount': data['amount'],
                'balance': data['amount'],
                'status': 'pending',
                'reference': data.get('customer_name', ''),
                'notes': data.get('notes', ''),
                'created_by': user_id
            }
            
            result = self.supabase.table('accounting_ar_invoices').insert(invoice).execute()
            return result.data[0] if result.data else {}
        except Exception as e:
            logger.error(f"Error creating invoice: {e}")
            raise
    
    # ==================== CASH FLOW ====================
    
    def get_cash_flow(self, params: Dict[str, Any]) -> Dict:
        """Get cash flow report"""
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)
            
            if params.get('startDate'):
                start_date = datetime.fromisoformat(params['startDate'].replace('Z', ''))
            if params.get('endDate'):
                end_date = datetime.fromisoformat(params['endDate'].replace('Z', ''))
            
            query = self.supabase.table('finance_transactions').select('amount, transaction_type, created_at')
            query = query.gte('created_at', start_date.isoformat()).lte('created_at', end_date.isoformat())
            
            if params.get('branch_id'):
                query = query.eq('branch_id', params['branch_id'])
            
            result = query.execute()
            transactions = result.data or []
            
            # Calculate totals
            total_inflow = sum(float(t['amount']) for t in transactions if t['transaction_type'] == 'income')
            total_outflow = sum(float(t['amount']) for t in transactions if t['transaction_type'] == 'expense')
            
            # Group by week
            periods = []
            current = start_date
            while current < end_date:
                week_end = min(current + timedelta(days=7), end_date)
                week_txns = [t for t in transactions if current.isoformat() <= t['created_at'] < week_end.isoformat()]
                
                inflow = sum(float(t['amount']) for t in week_txns if t['transaction_type'] == 'income')
                outflow = sum(float(t['amount']) for t in week_txns if t['transaction_type'] == 'expense')
                
                periods.append({
                    'period': current.strftime('%b %d') + ' - ' + week_end.strftime('%b %d'),
                    'inflow': round(inflow, 2),
                    'outflow': round(outflow, 2),
                    'net': round(inflow - outflow, 2)
                })
                current = week_end
            
            return {
                'summary': {
                    'totalInflow': round(total_inflow, 2),
                    'totalOutflow': round(total_outflow, 2),
                    'netCashFlow': round(total_inflow - total_outflow, 2)
                },
                'periods': periods
            }
        except Exception as e:
            logger.error(f"Error getting cash flow: {e}")
            return {'summary': {'totalInflow': 0, 'totalOutflow': 0, 'netCashFlow': 0}, 'periods': []}
    
    # ==================== PROFIT & LOSS ====================
    
    def get_profit_loss(self, params: Dict[str, Any]) -> Dict:
        """Get profit & loss statement"""
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)
            
            query = self.supabase.table('finance_transactions').select('amount, transaction_type, category')
            query = query.gte('created_at', start_date.isoformat())
            
            if params.get('branch_id'):
                query = query.eq('branch_id', params['branch_id'])
            
            result = query.execute()
            transactions = result.data or []
            
            revenue = sum(float(t['amount']) for t in transactions if t['transaction_type'] == 'income')
            expenses = sum(float(t['amount']) for t in transactions if t['transaction_type'] == 'expense')
            
            # Estimate cost breakdown
            cost_of_goods = expenses * 0.4
            operating_expenses = expenses * 0.5
            other_expenses = expenses * 0.1
            
            gross_profit = revenue - cost_of_goods
            operating_income = gross_profit - operating_expenses
            net_profit = operating_income - other_expenses
            margin = (net_profit / revenue * 100) if revenue > 0 else 0
            
            return {
                'revenue': round(revenue, 2),
                'costOfGoods': round(cost_of_goods, 2),
                'grossProfit': round(gross_profit, 2),
                'operatingExpenses': round(operating_expenses, 2),
                'operatingIncome': round(operating_income, 2),
                'otherIncome': 0,
                'otherExpenses': round(other_expenses, 2),
                'netProfit': round(net_profit, 2),
                'margin': round(margin, 1)
            }
        except Exception as e:
            logger.error(f"Error getting P&L: {e}")
            return {
                'revenue': 0, 'costOfGoods': 0, 'grossProfit': 0,
                'operatingExpenses': 0, 'operatingIncome': 0,
                'otherIncome': 0, 'otherExpenses': 0, 'netProfit': 0, 'margin': 0
            }
    
    # ==================== REVENUE BY BRANCH ====================
    
    def get_revenue_by_branch(self, params: Dict[str, Any]) -> List[Dict]:
        """Get revenue breakdown by branch"""
        try:
            # Get branches
            branches = self.supabase.table('branches').select('id, name').execute()
            
            # Get transactions
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)
            
            txns = self.supabase.table('finance_transactions').select('amount, transaction_type, branch_id').gte('created_at', start_date.isoformat()).execute()
            
            result = []
            for branch in (branches.data or []):
                branch_txns = [t for t in (txns.data or []) if t.get('branch_id') == branch['id']]
                revenue = sum(float(t['amount']) for t in branch_txns if t['transaction_type'] == 'income')
                expenses = sum(float(t['amount']) for t in branch_txns if t['transaction_type'] == 'expense')
                
                result.append({
                    'branch_id': branch['id'],
                    'branch_name': branch['name'],
                    'revenue': round(revenue, 2),
                    'expenses': round(expenses, 2),
                    'profit': round(revenue - expenses, 2),
                    'occupancy': 75  # Placeholder
                })
            
            return result
        except Exception as e:
            logger.error(f"Error getting revenue by branch: {e}")
            return []
    
    # ==================== BUDGET ANALYSIS ====================
    
    def get_budget_analysis(self, params: Dict[str, Any]) -> List[Dict]:
        """Get budget vs actual analysis"""
        try:
            year = params.get('year', datetime.now().year)
            month = params.get('month', datetime.now().month)
            
            # Get budgets
            budgets = self.supabase.table('budgets').select('*').execute()
            
            # Get actual expenses
            start_date = datetime(year, month, 1)
            if month == 12:
                end_date = datetime(year + 1, 1, 1)
            else:
                end_date = datetime(year, month + 1, 1)
            
            expenses = self.supabase.table('expenses').select('amount, category').gte('expense_date', start_date.date().isoformat()).lt('expense_date', end_date.date().isoformat()).execute()
            
            # Group expenses by category
            actuals = {}
            for exp in (expenses.data or []):
                cat = exp.get('category', 'Other')
                actuals[cat] = actuals.get(cat, 0) + float(exp['amount'])
            
            # Build analysis
            categories = ['Utilities', 'Supplies', 'Maintenance', 'Salaries', 'Marketing', 'Food & Beverage', 'Transport', 'Other']
            result = []
            
            for cat in categories:
                budgeted = 50000  # Default budget per category
                actual = actuals.get(cat, 0)
                variance = budgeted - actual
                percent_used = (actual / budgeted * 100) if budgeted > 0 else 0
                
                result.append({
                    'category': cat,
                    'budgeted': budgeted,
                    'actual': round(actual, 2),
                    'variance': round(variance, 2),
                    'percentUsed': round(percent_used, 1)
                })
            
            return result
        except Exception as e:
            logger.error(f"Error getting budget analysis: {e}")
            return []
    
    # ==================== TAX SUMMARY ====================
    
    def get_tax_summary(self, params: Dict[str, Any]) -> Dict:
        """Get tax summary"""
        try:
            end_date = datetime.now()
            start_date = datetime(end_date.year, 1, 1)
            
            txns = self.supabase.table('finance_transactions').select('amount, transaction_type').gte('created_at', start_date.isoformat()).execute()
            
            revenue = sum(float(t['amount']) for t in (txns.data or []) if t['transaction_type'] == 'income')
            expenses = sum(float(t['amount']) for t in (txns.data or []) if t['transaction_type'] == 'expense')
            
            # Kenya tax rates
            vat_rate = 0.16
            vat_collected = revenue * vat_rate
            vat_paid = expenses * vat_rate
            net_vat = vat_collected - vat_paid
            
            # Estimated payroll taxes
            paye_tax = expenses * 0.1  # Rough estimate
            withholding_tax = revenue * 0.05
            
            return {
                'vatCollected': round(vat_collected, 2),
                'vatPaid': round(vat_paid, 2),
                'netVat': round(net_vat, 2),
                'withholdingTax': round(withholding_tax, 2),
                'payeTax': round(paye_tax, 2),
                'totalTaxLiability': round(net_vat + paye_tax + withholding_tax, 2)
            }
        except Exception as e:
            logger.error(f"Error getting tax summary: {e}")
            return {
                'vatCollected': 0, 'vatPaid': 0, 'netVat': 0,
                'withholdingTax': 0, 'payeTax': 0, 'totalTaxLiability': 0
            }
    
    # ==================== FORECAST ====================
    
    def get_forecast(self, months: int = 6) -> List[Dict]:
        """Get financial forecast"""
        try:
            # Get historical data
            end_date = datetime.now()
            start_date = end_date - timedelta(days=180)
            
            txns = self.supabase.table('finance_transactions').select('amount, transaction_type, created_at').gte('created_at', start_date.isoformat()).execute()
            
            # Calculate monthly averages
            monthly_revenue = {}
            monthly_expenses = {}
            
            for t in (txns.data or []):
                month_key = t['created_at'][:7]
                if t['transaction_type'] == 'income':
                    monthly_revenue[month_key] = monthly_revenue.get(month_key, 0) + float(t['amount'])
                else:
                    monthly_expenses[month_key] = monthly_expenses.get(month_key, 0) + float(t['amount'])
            
            avg_revenue = sum(monthly_revenue.values()) / max(len(monthly_revenue), 1)
            avg_expenses = sum(monthly_expenses.values()) / max(len(monthly_expenses), 1)
            
            # Generate forecast
            forecast = []
            growth_rate = 1.02  # 2% monthly growth
            
            for i in range(1, months + 1):
                future_date = end_date + timedelta(days=30 * i)
                projected_revenue = avg_revenue * (growth_rate ** i)
                projected_expenses = avg_expenses * (growth_rate ** (i * 0.5))
                
                forecast.append({
                    'month': future_date.strftime('%B %Y'),
                    'projectedRevenue': round(projected_revenue, 2),
                    'projectedExpenses': round(projected_expenses, 2),
                    'projectedProfit': round(projected_revenue - projected_expenses, 2),
                    'confidence': max(60, 95 - (i * 5))
                })
            
            return forecast
        except Exception as e:
            logger.error(f"Error getting forecast: {e}")
            return []
    
    # ==================== AR/AP ====================
    
    def get_ar_ap(self) -> List[Dict]:
        """Get accounts receivable and payable"""
        try:
            result = []
            
            # Accounts Receivable
            ar = self.supabase.table('accounting_ar_invoices').select('*').neq('status', 'paid').execute()
            for inv in (ar.data or []):
                due_date = datetime.fromisoformat(inv['due_date'])
                days_overdue = (datetime.now() - due_date).days if datetime.now() > due_date else 0
                
                result.append({
                    'id': inv['id'],
                    'type': 'receivable',
                    'entity_name': inv.get('reference', 'Customer'),
                    'amount': float(inv['balance']),
                    'due_date': inv['due_date'],
                    'status': 'overdue' if days_overdue > 0 else 'current',
                    'days_overdue': days_overdue
                })
            
            # Accounts Payable
            ap = self.supabase.table('accounting_ap_bills').select('*').neq('status', 'paid').execute()
            for bill in (ap.data or []):
                due_date = datetime.fromisoformat(bill['due_date'])
                days_overdue = (datetime.now() - due_date).days if datetime.now() > due_date else 0
                
                result.append({
                    'id': bill['id'],
                    'type': 'payable',
                    'entity_name': bill.get('reference', 'Vendor'),
                    'amount': float(bill['balance']),
                    'due_date': bill['due_date'],
                    'status': 'overdue' if days_overdue > 0 else 'current',
                    'days_overdue': days_overdue
                })
            
            return result
        except Exception as e:
            logger.error(f"Error getting AR/AP: {e}")
            return []
    
    # ==================== KPIs ====================
    
    def get_kpis(self, period: str = 'month') -> List[Dict]:
        """Get financial KPIs"""
        try:
            days = {'week': 7, 'month': 30, 'quarter': 90}.get(period, 30)
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            prev_start = start_date - timedelta(days=days)
            
            # Current period
            current = self.supabase.table('finance_transactions').select('amount, transaction_type').gte('created_at', start_date.isoformat()).execute()
            
            # Previous period
            previous = self.supabase.table('finance_transactions').select('amount, transaction_type').gte('created_at', prev_start.isoformat()).lt('created_at', start_date.isoformat()).execute()
            
            curr_revenue = sum(float(t['amount']) for t in (current.data or []) if t['transaction_type'] == 'income')
            curr_expenses = sum(float(t['amount']) for t in (current.data or []) if t['transaction_type'] == 'expense')
            prev_revenue = sum(float(t['amount']) for t in (previous.data or []) if t['transaction_type'] == 'income')
            prev_expenses = sum(float(t['amount']) for t in (previous.data or []) if t['transaction_type'] == 'expense')
            
            revenue_change = ((curr_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0
            expense_change = ((curr_expenses - prev_expenses) / prev_expenses * 100) if prev_expenses > 0 else 0
            
            profit_margin = ((curr_revenue - curr_expenses) / curr_revenue * 100) if curr_revenue > 0 else 0
            
            return [
                {'name': 'Total Revenue', 'value': round(curr_revenue, 2), 'unit': 'KES', 'target': curr_revenue * 1.1, 'change': round(revenue_change, 1), 'trend': 'up' if revenue_change > 0 else 'down'},
                {'name': 'Total Expenses', 'value': round(curr_expenses, 2), 'unit': 'KES', 'target': curr_expenses * 0.9, 'change': round(expense_change, 1), 'trend': 'down' if expense_change < 0 else 'up'},
                {'name': 'Net Profit', 'value': round(curr_revenue - curr_expenses, 2), 'unit': 'KES', 'change': round(revenue_change - expense_change, 1), 'trend': 'up' if (curr_revenue - curr_expenses) > (prev_revenue - prev_expenses) else 'down'},
                {'name': 'Profit Margin', 'value': round(profit_margin, 1), 'unit': '%', 'target': 25, 'trend': 'up' if profit_margin > 20 else 'down'},
                {'name': 'Revenue per Day', 'value': round(curr_revenue / days, 2), 'unit': 'KES', 'trend': 'stable'},
                {'name': 'Expense Ratio', 'value': round((curr_expenses / curr_revenue * 100) if curr_revenue > 0 else 0, 1), 'unit': '%', 'target': 70, 'trend': 'up' if curr_expenses / max(curr_revenue, 1) < 0.7 else 'down'}
            ]
        except Exception as e:
            logger.error(f"Error getting KPIs: {e}")
            return []
    
    # ==================== BALANCE SHEET ====================
    
    def get_balance_sheet(self, params: Dict[str, Any]) -> Dict:
        """Get balance sheet statement"""
        try:
            branch_id = params.get('branch_id')
            as_of_date = params.get('as_of_date', datetime.now().date().isoformat())
            
            # Get all transactions up to date
            query = self.supabase.table('finance_transactions').select('amount, transaction_type, category').lte('created_at', as_of_date)
            if branch_id:
                query = query.eq('branch_id', branch_id)
            result = query.execute()
            transactions = result.data or []
            
            # Calculate totals
            total_income = sum(float(t['amount']) for t in transactions if t['transaction_type'] == 'income')
            total_expenses = sum(float(t['amount']) for t in transactions if t['transaction_type'] == 'expense')
            retained_earnings = total_income - total_expenses
            
            # Get AR (Assets)
            ar = self.supabase.table('accounting_ar_invoices').select('balance').neq('status', 'paid').execute()
            accounts_receivable = sum(float(inv['balance']) for inv in (ar.data or []))
            
            # Get AP (Liabilities)
            ap = self.supabase.table('accounting_ap_bills').select('balance').neq('status', 'paid').execute()
            accounts_payable = sum(float(bill['balance']) for bill in (ap.data or []))
            
            # Estimate other values based on business logic
            cash = retained_earnings * 0.3  # 30% of earnings as cash
            inventory = total_expenses * 0.15  # 15% of expenses as inventory
            fixed_assets = 5000000  # Estimated fixed assets
            accumulated_depreciation = fixed_assets * 0.2
            
            # Current Assets
            current_assets = {
                'cash': round(max(cash, 0), 2),
                'accounts_receivable': round(accounts_receivable, 2),
                'inventory': round(inventory, 2),
                'prepaid_expenses': round(total_expenses * 0.05, 2),
                'total': 0
            }
            current_assets['total'] = round(sum([current_assets['cash'], current_assets['accounts_receivable'], 
                                                  current_assets['inventory'], current_assets['prepaid_expenses']]), 2)
            
            # Fixed Assets
            fixed_assets_data = {
                'property_equipment': round(fixed_assets, 2),
                'accumulated_depreciation': round(-accumulated_depreciation, 2),
                'net_fixed_assets': round(fixed_assets - accumulated_depreciation, 2)
            }
            
            total_assets = current_assets['total'] + fixed_assets_data['net_fixed_assets']
            
            # Current Liabilities
            current_liabilities = {
                'accounts_payable': round(accounts_payable, 2),
                'accrued_expenses': round(total_expenses * 0.08, 2),
                'short_term_debt': round(total_expenses * 0.1, 2),
                'total': 0
            }
            current_liabilities['total'] = round(sum([current_liabilities['accounts_payable'], 
                                                       current_liabilities['accrued_expenses'],
                                                       current_liabilities['short_term_debt']]), 2)
            
            # Long-term Liabilities
            long_term_liabilities = {
                'long_term_debt': round(fixed_assets * 0.3, 2),
                'total': round(fixed_assets * 0.3, 2)
            }
            
            total_liabilities = current_liabilities['total'] + long_term_liabilities['total']
            
            # Equity
            equity = {
                'common_stock': 1000000,
                'retained_earnings': round(retained_earnings, 2),
                'total': round(1000000 + retained_earnings, 2)
            }
            
            return {
                'as_of_date': as_of_date,
                'current_assets': current_assets,
                'fixed_assets': fixed_assets_data,
                'total_assets': round(total_assets, 2),
                'current_liabilities': current_liabilities,
                'long_term_liabilities': long_term_liabilities,
                'total_liabilities': round(total_liabilities, 2),
                'equity': equity,
                'total_liabilities_equity': round(total_liabilities + equity['total'], 2)
            }
        except Exception as e:
            logger.error(f"Error getting balance sheet: {e}")
            return {}
    
    # ==================== TRIAL BALANCE ====================
    
    def get_trial_balance(self, params: Dict[str, Any]) -> Dict:
        """Get trial balance report"""
        try:
            branch_id = params.get('branch_id')
            end_date = datetime.now()
            start_date = datetime(end_date.year, end_date.month, 1)
            
            if params.get('start_date'):
                start_date = datetime.fromisoformat(params['start_date'])
            if params.get('end_date'):
                end_date = datetime.fromisoformat(params['end_date'])
            
            # Get transactions
            query = self.supabase.table('finance_transactions').select('amount, transaction_type, category')
            query = query.gte('created_at', start_date.isoformat()).lte('created_at', end_date.isoformat())
            if branch_id:
                query = query.eq('branch_id', branch_id)
            result = query.execute()
            transactions = result.data or []
            
            # Group by category
            accounts = {}
            for t in transactions:
                category = t.get('category') or ('Revenue' if t['transaction_type'] == 'income' else 'Expenses')
                if category not in accounts:
                    accounts[category] = {'debit': 0, 'credit': 0}
                
                amount = float(t['amount'])
                if t['transaction_type'] == 'income':
                    accounts[category]['credit'] += amount
                else:
                    accounts[category]['debit'] += amount
            
            # Build trial balance
            entries = []
            total_debit = 0
            total_credit = 0
            
            for account, values in accounts.items():
                entries.append({
                    'account': account,
                    'debit': round(values['debit'], 2),
                    'credit': round(values['credit'], 2)
                })
                total_debit += values['debit']
                total_credit += values['credit']
            
            # Add standard accounts
            ar = self.supabase.table('accounting_ar_invoices').select('balance').neq('status', 'paid').execute()
            ar_balance = sum(float(inv['balance']) for inv in (ar.data or []))
            if ar_balance > 0:
                entries.append({'account': 'Accounts Receivable', 'debit': round(ar_balance, 2), 'credit': 0})
                total_debit += ar_balance
            
            ap = self.supabase.table('accounting_ap_bills').select('balance').neq('status', 'paid').execute()
            ap_balance = sum(float(bill['balance']) for bill in (ap.data or []))
            if ap_balance > 0:
                entries.append({'account': 'Accounts Payable', 'debit': 0, 'credit': round(ap_balance, 2)})
                total_credit += ap_balance
            
            return {
                'period': f"{start_date.strftime('%b %d, %Y')} - {end_date.strftime('%b %d, %Y')}",
                'entries': sorted(entries, key=lambda x: x['account']),
                'total_debit': round(total_debit, 2),
                'total_credit': round(total_credit, 2),
                'is_balanced': abs(total_debit - total_credit) < 0.01
            }
        except Exception as e:
            logger.error(f"Error getting trial balance: {e}")
            return {'entries': [], 'total_debit': 0, 'total_credit': 0, 'is_balanced': True}
    
    # ==================== JOURNAL ENTRIES ====================
    
    def get_journal_entries(self, params: Dict[str, Any]) -> List[Dict]:
        """Get journal entries"""
        try:
            branch_id = params.get('branch_id')
            limit = params.get('limit', 50)
            
            query = self.supabase.table('finance_transactions').select('*').order('created_at', desc=True)
            if branch_id:
                query = query.eq('branch_id', branch_id)
            result = query.limit(limit).execute()
            
            entries = []
            for t in (result.data or []):
                amount = float(t['amount'])
                entry = {
                    'id': t['id'],
                    'date': t['created_at'][:10],
                    'description': t['description'] or f"{t['transaction_type'].title()} Transaction",
                    'reference': t.get('payment_reference', ''),
                    'lines': []
                }
                
                if t['transaction_type'] == 'income':
                    entry['lines'] = [
                        {'account': 'Cash/Bank', 'debit': round(amount, 2), 'credit': 0},
                        {'account': t.get('category') or 'Revenue', 'debit': 0, 'credit': round(amount, 2)}
                    ]
                else:
                    entry['lines'] = [
                        {'account': t.get('category') or 'Expenses', 'debit': round(amount, 2), 'credit': 0},
                        {'account': 'Cash/Bank', 'debit': 0, 'credit': round(amount, 2)}
                    ]
                
                entries.append(entry)
            
            return entries
        except Exception as e:
            logger.error(f"Error getting journal entries: {e}")
            return []
    
    def create_journal_entry(self, data: Dict[str, Any], user_id: str) -> Dict:
        """Create a journal entry"""
        try:
            lines = data.get('lines', [])
            total_debit = sum(line.get('debit', 0) for line in lines)
            total_credit = sum(line.get('credit', 0) for line in lines)
            
            if abs(total_debit - total_credit) > 0.01:
                raise ValueError("Journal entry must be balanced (debits = credits)")
            
            # Create transaction for each line
            created = []
            for line in lines:
                if line.get('debit', 0) > 0:
                    txn = {
                        'description': data.get('description', 'Journal Entry'),
                        'amount': line['debit'],
                        'transaction_type': 'expense',
                        'category': line.get('account'),
                        'payment_reference': data.get('reference', ''),
                        'created_by': user_id
                    }
                    if data.get('branch_id'):
                        txn['branch_id'] = data['branch_id']
                    result = self.supabase.table('finance_transactions').insert(txn).execute()
                    if result.data:
                        created.append(result.data[0])
            
            return {'success': True, 'entries_created': len(created)}
        except Exception as e:
            logger.error(f"Error creating journal entry: {e}")
            raise
    
    # ==================== FINANCIAL RATIOS ====================
    
    def get_financial_ratios(self, params: Dict[str, Any]) -> Dict:
        """Calculate key financial ratios"""
        try:
            branch_id = params.get('branch_id')
            end_date = datetime.now()
            start_date = end_date - timedelta(days=365)
            
            # Get transactions
            query = self.supabase.table('finance_transactions').select('amount, transaction_type')
            query = query.gte('created_at', start_date.isoformat())
            if branch_id:
                query = query.eq('branch_id', branch_id)
            result = query.execute()
            transactions = result.data or []
            
            revenue = sum(float(t['amount']) for t in transactions if t['transaction_type'] == 'income')
            expenses = sum(float(t['amount']) for t in transactions if t['transaction_type'] == 'expense')
            net_income = revenue - expenses
            
            # Get balance sheet data
            balance_sheet = self.get_balance_sheet(params)
            
            current_assets = balance_sheet.get('current_assets', {}).get('total', 0)
            current_liabilities = balance_sheet.get('current_liabilities', {}).get('total', 1)
            total_assets = balance_sheet.get('total_assets', 1)
            total_liabilities = balance_sheet.get('total_liabilities', 0)
            total_equity = balance_sheet.get('equity', {}).get('total', 1)
            inventory = balance_sheet.get('current_assets', {}).get('inventory', 0)
            ar = balance_sheet.get('current_assets', {}).get('accounts_receivable', 0)
            
            # Calculate ratios
            ratios = {
                'liquidity': {
                    'current_ratio': round(current_assets / max(current_liabilities, 1), 2),
                    'quick_ratio': round((current_assets - inventory) / max(current_liabilities, 1), 2),
                    'cash_ratio': round(balance_sheet.get('current_assets', {}).get('cash', 0) / max(current_liabilities, 1), 2)
                },
                'profitability': {
                    'gross_margin': round((revenue - expenses * 0.4) / max(revenue, 1) * 100, 1),
                    'operating_margin': round((revenue - expenses * 0.9) / max(revenue, 1) * 100, 1),
                    'net_profit_margin': round(net_income / max(revenue, 1) * 100, 1),
                    'return_on_assets': round(net_income / max(total_assets, 1) * 100, 1),
                    'return_on_equity': round(net_income / max(total_equity, 1) * 100, 1)
                },
                'efficiency': {
                    'asset_turnover': round(revenue / max(total_assets, 1), 2),
                    'inventory_turnover': round(expenses * 0.4 / max(inventory, 1), 2),
                    'receivables_turnover': round(revenue / max(ar, 1), 2),
                    'days_sales_outstanding': round(365 / max(revenue / max(ar, 1), 1), 0)
                },
                'leverage': {
                    'debt_ratio': round(total_liabilities / max(total_assets, 1) * 100, 1),
                    'debt_to_equity': round(total_liabilities / max(total_equity, 1), 2),
                    'equity_ratio': round(total_equity / max(total_assets, 1) * 100, 1)
                }
            }
            
            return ratios
        except Exception as e:
            logger.error(f"Error calculating financial ratios: {e}")
            return {}
    
    # ==================== AGING REPORT ====================
    
    def get_aging_report(self, report_type: str = 'receivable') -> Dict:
        """Get AR or AP aging report"""
        try:
            if report_type == 'receivable':
                table = 'accounting_ar_invoices'
                entity_field = 'reference'
            else:
                table = 'accounting_ap_bills'
                entity_field = 'reference'
            
            result = self.supabase.table(table).select('*').neq('status', 'paid').execute()
            items = result.data or []
            
            today = datetime.now()
            buckets = {'current': [], '1_30': [], '31_60': [], '61_90': [], 'over_90': []}
            totals = {'current': 0, '1_30': 0, '31_60': 0, '61_90': 0, 'over_90': 0}
            
            for item in items:
                due_date = datetime.fromisoformat(item['due_date'])
                days_overdue = (today - due_date).days
                balance = float(item['balance'])
                
                entry = {
                    'id': item['id'],
                    'entity': item.get(entity_field, 'Unknown'),
                    'invoice_number': item.get('invoice_number', ''),
                    'amount': round(balance, 2),
                    'due_date': item['due_date'],
                    'days_overdue': max(days_overdue, 0)
                }
                
                if days_overdue <= 0:
                    buckets['current'].append(entry)
                    totals['current'] += balance
                elif days_overdue <= 30:
                    buckets['1_30'].append(entry)
                    totals['1_30'] += balance
                elif days_overdue <= 60:
                    buckets['31_60'].append(entry)
                    totals['31_60'] += balance
                elif days_overdue <= 90:
                    buckets['61_90'].append(entry)
                    totals['61_90'] += balance
                else:
                    buckets['over_90'].append(entry)
                    totals['over_90'] += balance
            
            return {
                'type': report_type,
                'as_of_date': today.date().isoformat(),
                'buckets': buckets,
                'totals': {k: round(v, 2) for k, v in totals.items()},
                'grand_total': round(sum(totals.values()), 2)
            }
        except Exception as e:
            logger.error(f"Error getting aging report: {e}")
            return {'buckets': {}, 'totals': {}, 'grand_total': 0}
    
    # ==================== EXPENSE BREAKDOWN ====================
    
    def get_expense_breakdown(self, params: Dict[str, Any]) -> Dict:
        """Get detailed expense breakdown by category"""
        try:
            branch_id = params.get('branch_id')
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)
            
            if params.get('start_date'):
                start_date = datetime.fromisoformat(params['start_date'])
            if params.get('end_date'):
                end_date = datetime.fromisoformat(params['end_date'])
            
            query = self.supabase.table('expenses').select('amount, category, expense_date, status')
            query = query.gte('expense_date', start_date.date().isoformat())
            query = query.lte('expense_date', end_date.date().isoformat())
            if branch_id:
                query = query.eq('branch_id', branch_id)
            result = query.execute()
            expenses = result.data or []
            
            # Group by category
            by_category = {}
            by_status = {'pending': 0, 'approved': 0, 'rejected': 0, 'paid': 0}
            total = 0
            
            for exp in expenses:
                cat = exp.get('category', 'Other')
                amount = float(exp['amount'])
                status = exp.get('status', 'pending')
                
                if cat not in by_category:
                    by_category[cat] = {'amount': 0, 'count': 0}
                by_category[cat]['amount'] += amount
                by_category[cat]['count'] += 1
                
                if status in by_status:
                    by_status[status] += amount
                
                total += amount
            
            # Calculate percentages
            categories = []
            for cat, data in by_category.items():
                categories.append({
                    'category': cat,
                    'amount': round(data['amount'], 2),
                    'count': data['count'],
                    'percentage': round(data['amount'] / max(total, 1) * 100, 1)
                })
            
            return {
                'period': f"{start_date.strftime('%b %d')} - {end_date.strftime('%b %d, %Y')}",
                'total': round(total, 2),
                'categories': sorted(categories, key=lambda x: x['amount'], reverse=True),
                'by_status': {k: round(v, 2) for k, v in by_status.items()}
            }
        except Exception as e:
            logger.error(f"Error getting expense breakdown: {e}")
            return {'total': 0, 'categories': [], 'by_status': {}}
    
    # ==================== REVENUE ANALYSIS ====================
    
    def get_revenue_analysis(self, params: Dict[str, Any]) -> Dict:
        """Get detailed revenue analysis"""
        try:
            branch_id = params.get('branch_id')
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)
            
            query = self.supabase.table('finance_transactions').select('amount, category, created_at, payment_method')
            query = query.eq('transaction_type', 'income')
            query = query.gte('created_at', start_date.isoformat())
            if branch_id:
                query = query.eq('branch_id', branch_id)
            result = query.execute()
            transactions = result.data or []
            
            # Group by category
            by_category = {}
            by_payment_method = {}
            by_day = {}
            total = 0
            
            for t in transactions:
                cat = t.get('category', 'Other')
                amount = float(t['amount'])
                method = t.get('payment_method', 'Other')
                day = t['created_at'][:10]
                
                by_category[cat] = by_category.get(cat, 0) + amount
                by_payment_method[method] = by_payment_method.get(method, 0) + amount
                by_day[day] = by_day.get(day, 0) + amount
                total += amount
            
            # Daily trend
            daily_trend = [{'date': d, 'amount': round(a, 2)} for d, a in sorted(by_day.items())]
            
            # Top categories
            categories = [{'category': c, 'amount': round(a, 2), 'percentage': round(a / max(total, 1) * 100, 1)} 
                         for c, a in sorted(by_category.items(), key=lambda x: x[1], reverse=True)]
            
            # Payment methods
            payment_methods = [{'method': m, 'amount': round(a, 2)} 
                              for m, a in sorted(by_payment_method.items(), key=lambda x: x[1], reverse=True)]
            
            return {
                'total': round(total, 2),
                'average_daily': round(total / max(len(by_day), 1), 2),
                'categories': categories,
                'payment_methods': payment_methods,
                'daily_trend': daily_trend
            }
        except Exception as e:
            logger.error(f"Error getting revenue analysis: {e}")
            return {'total': 0, 'categories': [], 'payment_methods': [], 'daily_trend': []}
    
    # ==================== COMPARATIVE ANALYSIS ====================
    
    def get_comparative_analysis(self, params: Dict[str, Any]) -> Dict:
        """Compare financial performance across periods or branches"""
        try:
            comparison_type = params.get('type', 'period')  # 'period' or 'branch'
            
            if comparison_type == 'branch':
                return self._compare_branches(params)
            else:
                return self._compare_periods(params)
        except Exception as e:
            logger.error(f"Error in comparative analysis: {e}")
            return {}
    
    def _compare_periods(self, params: Dict[str, Any]) -> Dict:
        """Compare current period vs previous period"""
        branch_id = params.get('branch_id')
        days = params.get('days', 30)
        
        end_date = datetime.now()
        current_start = end_date - timedelta(days=days)
        prev_end = current_start
        prev_start = prev_end - timedelta(days=days)
        
        # Current period
        query = self.supabase.table('finance_transactions').select('amount, transaction_type')
        query = query.gte('created_at', current_start.isoformat())
        if branch_id:
            query = query.eq('branch_id', branch_id)
        current = query.execute()
        
        # Previous period
        query = self.supabase.table('finance_transactions').select('amount, transaction_type')
        query = query.gte('created_at', prev_start.isoformat()).lt('created_at', prev_end.isoformat())
        if branch_id:
            query = query.eq('branch_id', branch_id)
        previous = query.execute()
        
        curr_revenue = sum(float(t['amount']) for t in (current.data or []) if t['transaction_type'] == 'income')
        curr_expenses = sum(float(t['amount']) for t in (current.data or []) if t['transaction_type'] == 'expense')
        prev_revenue = sum(float(t['amount']) for t in (previous.data or []) if t['transaction_type'] == 'income')
        prev_expenses = sum(float(t['amount']) for t in (previous.data or []) if t['transaction_type'] == 'expense')
        
        return {
            'type': 'period',
            'current_period': {
                'label': f"Last {days} days",
                'revenue': round(curr_revenue, 2),
                'expenses': round(curr_expenses, 2),
                'profit': round(curr_revenue - curr_expenses, 2),
                'margin': round((curr_revenue - curr_expenses) / max(curr_revenue, 1) * 100, 1)
            },
            'previous_period': {
                'label': f"Previous {days} days",
                'revenue': round(prev_revenue, 2),
                'expenses': round(prev_expenses, 2),
                'profit': round(prev_revenue - prev_expenses, 2),
                'margin': round((prev_revenue - prev_expenses) / max(prev_revenue, 1) * 100, 1)
            },
            'changes': {
                'revenue': round((curr_revenue - prev_revenue) / max(prev_revenue, 1) * 100, 1),
                'expenses': round((curr_expenses - prev_expenses) / max(prev_expenses, 1) * 100, 1),
                'profit': round(((curr_revenue - curr_expenses) - (prev_revenue - prev_expenses)) / max(abs(prev_revenue - prev_expenses), 1) * 100, 1)
            }
        }
    
    def _compare_branches(self, params: Dict[str, Any]) -> Dict:
        """Compare performance across branches"""
        days = params.get('days', 30)
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # Get branches
        branches = self.supabase.table('branches').select('id, name').execute()
        
        # Get transactions
        txns = self.supabase.table('finance_transactions').select('amount, transaction_type, branch_id')
        txns = txns.gte('created_at', start_date.isoformat()).execute()
        
        branch_data = []
        for branch in (branches.data or []):
            branch_txns = [t for t in (txns.data or []) if t.get('branch_id') == branch['id']]
            revenue = sum(float(t['amount']) for t in branch_txns if t['transaction_type'] == 'income')
            expenses = sum(float(t['amount']) for t in branch_txns if t['transaction_type'] == 'expense')
            
            branch_data.append({
                'branch_id': branch['id'],
                'branch_name': branch['name'],
                'revenue': round(revenue, 2),
                'expenses': round(expenses, 2),
                'profit': round(revenue - expenses, 2),
                'margin': round((revenue - expenses) / max(revenue, 1) * 100, 1)
            })
        
        # Sort by profit
        branch_data.sort(key=lambda x: x['profit'], reverse=True)
        
        total_revenue = sum(b['revenue'] for b in branch_data)
        total_profit = sum(b['profit'] for b in branch_data)
        
        return {
            'type': 'branch',
            'period': f"Last {days} days",
            'branches': branch_data,
            'totals': {
                'revenue': round(total_revenue, 2),
                'profit': round(total_profit, 2)
            },
            'best_performer': branch_data[0] if branch_data else None,
            'needs_attention': branch_data[-1] if len(branch_data) > 1 else None
        }
    
    # ==================== FINANCIAL REPORTS ====================
    
    def generate_financial_report(self, report_type: str, params: Dict[str, Any]) -> Dict:
        """Generate comprehensive financial report"""
        try:
            branch_id = params.get('branch_id')
            
            if report_type == 'daily_summary':
                return self._generate_daily_summary(branch_id)
            elif report_type == 'monthly_summary':
                return self._generate_monthly_summary(branch_id)
            elif report_type == 'executive_summary':
                return self._generate_executive_summary(branch_id)
            else:
                return {'error': 'Unknown report type'}
        except Exception as e:
            logger.error(f"Error generating report: {e}")
            return {'error': str(e)}
    
    def _generate_daily_summary(self, branch_id: Optional[int]) -> Dict:
        """Generate daily financial summary"""
        today = datetime.now().date()
        
        query = self.supabase.table('finance_transactions').select('amount, transaction_type, category')
        query = query.gte('created_at', today.isoformat())
        if branch_id:
            query = query.eq('branch_id', branch_id)
        result = query.execute()
        transactions = result.data or []
        
        revenue = sum(float(t['amount']) for t in transactions if t['transaction_type'] == 'income')
        expenses = sum(float(t['amount']) for t in transactions if t['transaction_type'] == 'expense')
        
        return {
            'report_type': 'daily_summary',
            'date': today.isoformat(),
            'branch_id': branch_id,
            'summary': {
                'total_revenue': round(revenue, 2),
                'total_expenses': round(expenses, 2),
                'net_income': round(revenue - expenses, 2),
                'transaction_count': len(transactions)
            }
        }
    
    def _generate_monthly_summary(self, branch_id: Optional[int]) -> Dict:
        """Generate monthly financial summary"""
        today = datetime.now()
        start_of_month = today.replace(day=1)
        
        # Get P&L
        pl = self.get_profit_loss({'branch_id': branch_id})
        
        # Get cash flow
        cf = self.get_cash_flow({'branch_id': branch_id})
        
        # Get KPIs
        kpis = self.get_kpis('month')
        
        return {
            'report_type': 'monthly_summary',
            'month': today.strftime('%B %Y'),
            'branch_id': branch_id,
            'profit_loss': pl,
            'cash_flow': cf.get('summary', {}),
            'kpis': kpis
        }
    
    def _generate_executive_summary(self, branch_id: Optional[int]) -> Dict:
        """Generate executive summary with all key metrics"""
        # Get all key data
        dashboard = self.get_dashboard(branch_id)
        pl = self.get_profit_loss({'branch_id': branch_id})
        ratios = self.get_financial_ratios({'branch_id': branch_id})
        comparison = self.get_comparative_analysis({'branch_id': branch_id, 'days': 30})
        
        return {
            'report_type': 'executive_summary',
            'generated_at': datetime.now().isoformat(),
            'branch_id': branch_id,
            'overview': dashboard,
            'profit_loss': pl,
            'financial_ratios': ratios,
            'period_comparison': comparison
        }
