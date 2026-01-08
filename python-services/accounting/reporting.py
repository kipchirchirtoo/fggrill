from decimal import Decimal
from datetime import date
from typing import Dict, List, Any

class ReportingService:
    def __init__(self, supabase_client):
        self.supabase = supabase_client

    def get_profit_and_loss(self, branch_id: int, start_date: str, end_date: str) -> Dict[str, Any]:
        """Calculates P&L for a specific period"""
        try:
            # 0. Get Category IDs
            categories_res = self.supabase.table('accounting_account_categories').select('id, name').execute()
            category_map = {cat['name'].upper(): cat['id'] for cat in categories_res.data}
            revenue_id = category_map.get('REVENUE')
            expense_id = category_map.get('EXPENSES')

            if not revenue_id or not expense_id:
                # Try fallback names if upper casing didn't match REVENUE/EXPENSES exactly
                revenue_id = revenue_id or category_map.get('REVENUE') or category_map.get('INCOME')
                expense_id = expense_id or category_map.get('EXPENSES') or category_map.get('EXPENSE')
                
                if not revenue_id or not expense_id:
                    raise Exception(f"Accounting categories 'REVENUE' and 'EXPENSES' not found. Available: {list(category_map.keys())}")

            # 1. Get Revenues
            revenue_query = self.supabase.table('accounting_journal_items') \
                .select('*, account:accounting_chart_of_accounts!inner(*)') \
                .eq('account.category_id', revenue_id)
            if branch_id:
                revenue_query = revenue_query.eq('account.branch_id', branch_id)
            revenue_res = revenue_query.execute()
                
            # 2. Get Expenses
            expense_query = self.supabase.table('accounting_journal_items') \
                .select('*, account:accounting_chart_of_accounts!inner(*)') \
                .eq('account.category_id', expense_id)
            if branch_id:
                expense_query = expense_query.eq('account.branch_id', branch_id)
            expense_res = expense_query.execute()

            # Aggregate Revenue
            revenue_items = {}
            total_revenue = Decimal('0')
            for item in revenue_res.data:
                name = item['account']['account_name']
                amount = Decimal(str(item.get('credit') or 0)) - Decimal(str(item.get('debit') or 0))
                revenue_items[name] = revenue_items.get(name, Decimal('0')) + amount
                total_revenue += amount

            # Aggregate Expenses
            expense_items = {}
            total_expenses = Decimal('0')
            for item in expense_res.data:
                name = item['account']['account_name']
                amount = Decimal(str(item.get('debit') or 0)) - Decimal(str(item.get('credit') or 0))
                expense_items[name] = expense_items.get(name, Decimal('0')) + amount
                total_expenses += amount

            net_profit = total_revenue - total_expenses

            return {
                'period': {'start': start_date, 'end': end_date},
                'total_revenue': float(total_revenue),
                'total_expenses': float(total_expenses),
                'net_profit': float(net_profit),
                'revenue_breakdown': {k: float(v) for k, v in revenue_items.items()},
                'expense_breakdown': {k: float(v) for k, v in expense_items.items()}
            }
        except Exception as e:
            raise Exception(f"Failed to generate P&L: {str(e)}")

    def get_trial_balance(self, branch_id: int) -> List[Dict[str, Any]]:
        """Gets the current trial balance"""
        try:
            res = self.supabase.rpc('get_trial_balance', {'p_branch_id': branch_id}).execute()
            return res.data
        except:
            # Fallback to view if RPC not available or failed
            res = self.supabase.table('trial_balance').select('*').execute()
            return res.data
