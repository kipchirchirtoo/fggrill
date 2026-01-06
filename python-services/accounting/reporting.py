from decimal import Decimal
from datetime import date
from typing import Dict, List, Any

class ReportingService:
    def __init__(self, supabase_client):
        self.supabase = supabase_client

    def get_profit_and_loss(self, branch_id: int, start_date: str, end_date: str) -> Dict[str, Any]:
        """Calculates P&L for a specific period"""
        try:
            # 1. Get Revenues
            # In a real system, we'd query accounting_journal_items joined with CoA category 'REVENUE'
            revenue_query = self.supabase.table('accounting_journal_items') \
                .select('*, account:accounting_chart_of_accounts!inner(*)') \
                .eq('account.category_id', 4) \
                .execute() # category 4 is REVENUE
                
            # 2. Get Expenses
            expense_query = self.supabase.table('accounting_journal_items') \
                .select('*, account:accounting_chart_of_accounts!inner(*)') \
                .eq('account.category_id', 5) \
                .execute() # category 5 is EXPENSES

            # Aggregate Revenue
            revenue_items = {}
            total_revenue = Decimal('0')
            for item in revenue_query.data:
                name = item['account']['account_name']
                amount = Decimal(str(item['credit'])) - Decimal(str(item['debit']))
                revenue_items[name] = revenue_items.get(name, Decimal('0')) + amount
                total_revenue += amount

            # Aggregate Expenses
            expense_items = {}
            total_expenses = Decimal('0')
            for item in expense_query.data:
                name = item['account']['account_name']
                amount = Decimal(str(item['debit'])) - Decimal(str(item['credit']))
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
