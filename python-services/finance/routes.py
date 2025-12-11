"""
Finance Routes - Flask Blueprint for finance API endpoints
"""
from flask import Blueprint, request, jsonify
from .service import FinanceService
import logging

logger = logging.getLogger(__name__)

finance_bp = Blueprint('finance', __name__, url_prefix='/api/finance')
finance_service = FinanceService()


@finance_bp.route('/dashboard', methods=['GET'])
def get_dashboard():
    """Get finance dashboard summary"""
    try:
        branch_id = request.args.get('branch_id', type=int)
        data = finance_service.get_dashboard(branch_id)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        logger.error(f"Dashboard error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@finance_bp.route('/transactions', methods=['GET'])
def get_transactions():
    """Get financial transactions"""
    try:
        params = {
            'branch_id': request.args.get('branch_id', type=int),
            'type': request.args.get('type'),
            'from_date': request.args.get('from_date'),
            'to_date': request.args.get('to_date')
        }
        data = finance_service.get_transactions(params)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        logger.error(f"Transactions error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@finance_bp.route('/expenses', methods=['GET'])
def get_expenses():
    """Get expenses"""
    try:
        params = {
            'branch_id': request.args.get('branch_id', type=int),
            'status': request.args.get('status'),
            'category': request.args.get('category')
        }
        data = finance_service.get_expenses(params)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        logger.error(f"Expenses error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@finance_bp.route('/expenses', methods=['POST'])
def create_expense():
    """Create new expense"""
    try:
        data = request.get_json()
        user_id = request.headers.get('X-User-Id', 'system')
        result = finance_service.create_expense(data, user_id)
        return jsonify({'success': True, 'data': result}), 201
    except Exception as e:
        logger.error(f"Create expense error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@finance_bp.route('/invoices', methods=['GET'])
def get_invoices():
    """Get invoices"""
    try:
        data = finance_service.get_invoices()
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        logger.error(f"Invoices error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@finance_bp.route('/invoices', methods=['POST'])
def create_invoice():
    """Create new invoice"""
    try:
        data = request.get_json()
        user_id = request.headers.get('X-User-Id', 'system')
        result = finance_service.create_invoice(data, user_id)
        return jsonify({'success': True, 'data': result}), 201
    except Exception as e:
        logger.error(f"Create invoice error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@finance_bp.route('/cashflow', methods=['GET'])
def get_cash_flow():
    """Get cash flow report"""
    try:
        params = {
            'startDate': request.args.get('startDate'),
            'endDate': request.args.get('endDate'),
            'branch_id': request.args.get('branch_id', type=int)
        }
        data = finance_service.get_cash_flow(params)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        logger.error(f"Cash flow error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@finance_bp.route('/profit-loss', methods=['GET'])
def get_profit_loss():
    """Get profit & loss statement"""
    try:
        params = {
            'startDate': request.args.get('startDate'),
            'endDate': request.args.get('endDate'),
            'branch_id': request.args.get('branch_id', type=int)
        }
        data = finance_service.get_profit_loss(params)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        logger.error(f"P&L error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@finance_bp.route('/revenue-by-branch', methods=['GET'])
def get_revenue_by_branch():
    """Get revenue breakdown by branch"""
    try:
        params = {
            'startDate': request.args.get('startDate'),
            'endDate': request.args.get('endDate')
        }
        data = finance_service.get_revenue_by_branch(params)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        logger.error(f"Revenue by branch error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@finance_bp.route('/budget-analysis', methods=['GET'])
def get_budget_analysis():
    """Get budget vs actual analysis"""
    try:
        params = {
            'year': request.args.get('year', type=int),
            'month': request.args.get('month', type=int),
            'branch_id': request.args.get('branch_id', type=int)
        }
        data = finance_service.get_budget_analysis(params)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        logger.error(f"Budget analysis error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@finance_bp.route('/tax-summary', methods=['GET'])
def get_tax_summary():
    """Get tax summary"""
    try:
        params = {
            'startDate': request.args.get('startDate'),
            'endDate': request.args.get('endDate')
        }
        data = finance_service.get_tax_summary(params)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        logger.error(f"Tax summary error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@finance_bp.route('/forecast', methods=['GET'])
def get_forecast():
    """Get financial forecast"""
    try:
        months = request.args.get('months', 6, type=int)
        data = finance_service.get_forecast(months)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        logger.error(f"Forecast error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@finance_bp.route('/ar-ap', methods=['GET'])
def get_ar_ap():
    """Get accounts receivable and payable"""
    try:
        data = finance_service.get_ar_ap()
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        logger.error(f"AR/AP error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@finance_bp.route('/kpis', methods=['GET'])
def get_kpis():
    """Get financial KPIs"""
    try:
        period = request.args.get('period', 'month')
        data = finance_service.get_kpis(period)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        logger.error(f"KPIs error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@finance_bp.route('/balance-sheet', methods=['GET'])
def get_balance_sheet():
    """Get balance sheet statement"""
    try:
        params = {
            'branch_id': request.args.get('branch_id', type=int),
            'as_of_date': request.args.get('as_of_date')
        }
        data = finance_service.get_balance_sheet(params)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        logger.error(f"Balance sheet error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@finance_bp.route('/trial-balance', methods=['GET'])
def get_trial_balance():
    """Get trial balance report"""
    try:
        params = {
            'branch_id': request.args.get('branch_id', type=int),
            'start_date': request.args.get('start_date'),
            'end_date': request.args.get('end_date')
        }
        data = finance_service.get_trial_balance(params)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        logger.error(f"Trial balance error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@finance_bp.route('/journal-entries', methods=['GET'])
def get_journal_entries():
    """Get journal entries"""
    try:
        params = {
            'branch_id': request.args.get('branch_id', type=int),
            'limit': request.args.get('limit', 50, type=int)
        }
        data = finance_service.get_journal_entries(params)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        logger.error(f"Journal entries error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@finance_bp.route('/journal-entries', methods=['POST'])
def create_journal_entry():
    """Create a journal entry"""
    try:
        data = request.get_json()
        user_id = request.headers.get('X-User-Id', 'system')
        result = finance_service.create_journal_entry(data, user_id)
        return jsonify({'success': True, 'data': result}), 201
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Create journal entry error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@finance_bp.route('/financial-ratios', methods=['GET'])
def get_financial_ratios():
    """Get financial ratios"""
    try:
        params = {
            'branch_id': request.args.get('branch_id', type=int)
        }
        data = finance_service.get_financial_ratios(params)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        logger.error(f"Financial ratios error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@finance_bp.route('/aging-report', methods=['GET'])
def get_aging_report():
    """Get AR or AP aging report"""
    try:
        report_type = request.args.get('type', 'receivable')
        data = finance_service.get_aging_report(report_type)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        logger.error(f"Aging report error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@finance_bp.route('/expense-breakdown', methods=['GET'])
def get_expense_breakdown():
    """Get expense breakdown by category"""
    try:
        params = {
            'branch_id': request.args.get('branch_id', type=int),
            'start_date': request.args.get('start_date'),
            'end_date': request.args.get('end_date')
        }
        data = finance_service.get_expense_breakdown(params)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        logger.error(f"Expense breakdown error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@finance_bp.route('/revenue-analysis', methods=['GET'])
def get_revenue_analysis():
    """Get revenue analysis"""
    try:
        params = {
            'branch_id': request.args.get('branch_id', type=int)
        }
        data = finance_service.get_revenue_analysis(params)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        logger.error(f"Revenue analysis error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@finance_bp.route('/comparative-analysis', methods=['GET'])
def get_comparative_analysis():
    """Get comparative analysis"""
    try:
        params = {
            'type': request.args.get('type', 'period'),
            'branch_id': request.args.get('branch_id', type=int),
            'days': request.args.get('days', 30, type=int)
        }
        data = finance_service.get_comparative_analysis(params)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        logger.error(f"Comparative analysis error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@finance_bp.route('/reports/generate', methods=['POST'])
def generate_report():
    """Generate a financial report"""
    try:
        data = request.get_json()
        report_type = data.get('report_type', 'daily_summary')
        params = {
            'branch_id': data.get('branch_id')
        }
        result = finance_service.generate_financial_report(report_type, params)
        return jsonify({'success': True, 'data': result})
    except Exception as e:
        logger.error(f"Generate report error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@finance_bp.route('/branches', methods=['GET'])
def get_branches():
    """Get all branches for filtering"""
    try:
        from supabase import create_client
        import os
        supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY'))
        result = supabase.table('branches').select('id, name, code').execute()
        return jsonify({'success': True, 'data': result.data or []})
    except Exception as e:
        logger.error(f"Get branches error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
