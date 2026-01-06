"""
Famous Gate Hotel - Accounting & Audit Routes
Handles journal entries, reviews, reconciliation, and audit trails
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
import uuid
from typing import Dict, List, Any, Optional, Tuple
from functools import wraps
import logging

# Create blueprint
accounting_bp = Blueprint('accounting', __name__, url_prefix='/api/accounting')
audit_bp = Blueprint('audit', __name__, url_prefix='/api/audit')

from .stock_valuation import StockValuationService
from .reporting import ReportingService
from flask import g

logger = logging.getLogger(__name__)

import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")
supabase: Client = create_client(supabase_url, supabase_key) if supabase_url and supabase_key else None

# Initialize services
stock_service = StockValuationService(supabase) if supabase else None

# In-memory storage for demo (fallback if database fails)
journal_entries = {}
review_queue = {}
audit_trail = []
reconciliations = []
workpapers = []

def get_account_id(account_code_or_name: str) -> Optional[str]:
    """Get account ID from code or name, or create if it doesn't exist"""
    if not supabase:
        return None
    
    # Extract code if it's in format "1000 - Name"
    code = account_code_or_name.split(' - ')[0] if ' - ' in account_code_or_name else account_code_or_name
    
    try:
        # Try to find by code
        res = supabase.table('accounting_chart_of_accounts').select('id').eq('account_code', code).execute()
        if res.data:
            return res.data[0]['id']
        
        # If not found, create it
        name = account_code_or_name.split(' - ')[1] if ' - ' in account_code_or_name else account_code_or_name
        # Determine type based on code
        acc_type = 'asset'
        if code.startswith('2'): acc_type = 'liability'
        elif code.startswith('3'): acc_type = 'equity'
        elif code.startswith('4'): acc_type = 'revenue'
        elif code.startswith('5'): acc_type = 'expense'
        
        new_acc = {
            'account_code': code,
            'account_name': name,
            'account_type': acc_type,
            'is_active': True
        }
        res = supabase.table('accounting_chart_of_accounts').insert(new_acc).execute()
        if res.data:
            return res.data[0]['id']
    except Exception as e:
        logger.error(f"Error getting/creating account: {e}")
    
    return None

# Chart of Accounts
CHART_OF_ACCOUNTS = {
    '1000': {'name': 'Cash and Cash Equivalents', 'type': 'asset'},
    '1100': {'name': 'Accounts Receivable', 'type': 'asset'},
    '1200': {'name': 'Inventory', 'type': 'asset'},
    '1300': {'name': 'Prepaid Expenses', 'type': 'asset'},
    '1400': {'name': 'Furniture & Equipment', 'type': 'asset'},
    '1500': {'name': 'Accumulated Depreciation', 'type': 'asset'},
    '2000': {'name': 'Accounts Payable', 'type': 'liability'},
    '2100': {'name': 'Accrued Expenses', 'type': 'liability'},
    '2200': {'name': 'Taxes Payable', 'type': 'liability'},
    '2300': {'name': 'Deferred Revenue', 'type': 'liability'},
    '3000': {'name': 'Owner\'s Equity', 'type': 'equity'},
    '3100': {'name': 'Retained Earnings', 'type': 'equity'},
    '4000': {'name': 'Room Revenue', 'type': 'revenue'},
    '4100': {'name': 'Restaurant Revenue', 'type': 'revenue'},
    '4200': {'name': 'Bar Revenue', 'type': 'revenue'},
    '4300': {'name': 'Other Revenue', 'type': 'revenue'},
    '5000': {'name': 'Cost of Goods Sold', 'type': 'expense'},
    '5100': {'name': 'Salaries & Wages', 'type': 'expense'},
    '5200': {'name': 'Utilities', 'type': 'expense'},
    '5300': {'name': 'Rent Expense', 'type': 'expense'},
    '5400': {'name': 'Marketing & Advertising', 'type': 'expense'},
    '5500': {'name': 'Maintenance & Repairs', 'type': 'expense'},
    '5600': {'name': 'Office Supplies', 'type': 'expense'},
    '5700': {'name': 'Insurance', 'type': 'expense'},
    '5800': {'name': 'Depreciation Expense', 'type': 'expense'},
    '5900': {'name': 'Other Expenses', 'type': 'expense'}
}

def log_audit_action(entry_id: str, action: str, user: str, details: str, ip_address: str = "127.0.0.1"):
    """Log action to audit trail"""
    audit_entry = {
        'id': str(uuid.uuid4()),
        'entry_id': entry_id,
        'action': action,
        'user': user,
        'timestamp': datetime.now().isoformat(),
        'details': details,
        'ip_address': ip_address
    }
    audit_trail.append(audit_entry)
    logger.info(f"Audit: {action} on entry {entry_id} by {user}")

def validate_journal_entry(entry_data: Dict[str, Any]) -> Tuple[bool, str]:
    """Validate journal entry data"""
    required_fields = ['date', 'reference', 'description', 'debit_account', 'credit_account', 'amount', 'department', 'category']
    
    for field in required_fields:
        if field not in entry_data or not entry_data[field]:
            return False, f"Missing required field: {field}"
    
    if entry_data['debit_account'] == entry_data['credit_account']:
        return False, "Debit and credit accounts must be different"
    
    if entry_data['amount'] <= 0:
        return False, "Amount must be greater than 0"
    
    return True, "Valid"

def is_period_locked(branch_id: int, date_str: str) -> bool:
    """Check if the accounting period for the given date and branch is locked"""
    if not supabase:
        return False
    try:
        res = supabase.table('accounting_periods')\
            .select('status')\
            .eq('branch_id', branch_id)\
            .lte('start_date', date_str)\
            .gte('end_date', date_str)\
            .execute()
        
        if res.data:
            return res.data[0]['status'] in ['closed', 'locked']
    except Exception as e:
        logger.error(f"Error checking period lock: {e}")
    return False

# Stock Taking & Valuation Routes

# Stock Taking & Valuation Routes
@accounting_bp.route('/stock-counts', methods=['GET'])
def get_stock_counts():
    """Get stock count sessions"""
    try:
        branch_id = request.args.get('branch_id')
        status = request.args.get('status')
        
        if supabase:
            query = supabase.table('stock_counts').select('*')
            if branch_id:
                query = query.eq('branch_id', branch_id)
            if status:
                query = query.eq('status', status)
                
            res = query.order('count_date', desc=True).execute()
            return jsonify({'success': True, 'data': res.data})
        
        return jsonify({'success': False, 'message': 'Database not available'}), 503
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@accounting_bp.route('/stock-counts', methods=['POST'])
def create_stock_count():
    """Create a new stock count session"""
    try:
        data = request.get_json()
        if supabase:
            res = supabase.table('stock_counts').insert(data).execute()
            if res.data:
                return jsonify({'success': True, 'data': res.data[0]})
        return jsonify({'success': False, 'message': 'Failed to create stock count'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@accounting_bp.route('/stock-counts/<count_id>/items', methods=['POST'])
def add_stock_count_items(count_id):
    """Add items to a stock count session"""
    try:
        items = request.get_json() # List of items
        for item in items:
            item['stock_count_id'] = count_id
            
        if supabase:
            res = supabase.table('stock_count_items').insert(items).execute()
            return jsonify({'success': True, 'data': res.data})
        return jsonify({'success': False, 'message': 'Database not available'}), 503
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@accounting_bp.route('/stock-valuation/calculate', methods=['POST'])
def calculate_stock_valuation():
    """Calculate stock valuation using FIFO or Weighted Average"""
    try:
        data = request.get_json()
        branch_id = data.get('branch_id')
        item_id = data.get('item_id')
        method = data.get('method', 'FIFO')
        as_of_date = data.get('as_of_date', date.today().isoformat())
        quantity = Decimal(str(data.get('quantity', 0)))
        
        if not stock_service:
            return jsonify({'success': False, 'message': 'Stock service not available'}), 503
            
        if method == 'FIFO':
            total_cost, layers = stock_service.calculate_fifo_cost(
                branch_id, item_id, quantity, date.fromisoformat(as_of_date)
            )
            return jsonify({
                'success': True, 
                'total_cost': float(total_cost), 
                'unit_cost': float(total_cost / quantity) if quantity > 0 else 0,
                'layers_used': layers
            })
        else:
            avg_cost = stock_service.calculate_weighted_average_cost(
                branch_id, item_id, date.fromisoformat(as_of_date)
            )
            return jsonify({
                'success': True, 
                'unit_cost': float(avg_cost),
                'total_cost': float(avg_cost * quantity)
            })
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Credit & Bills Routes
@accounting_bp.route('/credit-bills/employee', methods=['GET'])
def get_employee_credit_bills():
    """Get employee credit bills"""
    try:
        branch_id = request.args.get('branch_id')
        employee_id = request.args.get('employee_id')
        status = request.args.get('status')
        
        if supabase:
            query = supabase.table('employee_credit_bills').select('*, employee:staff(*)')
            if branch_id:
                query = query.eq('branch_id', branch_id)
            if employee_id:
                query = query.eq('employee_id', employee_id)
            if status:
                query = query.eq('status', status)
                
            res = query.order('bill_date', desc=True).execute()
            return jsonify({'success': True, 'data': res.data})
        return jsonify({'success': False, 'message': 'Database not available'}), 503
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@accounting_bp.route('/credit-bills/customer', methods=['GET'])
def get_customer_invoices():
    """Get customer unpaid invoices (Aging Analysis)"""
    try:
        branch_id = request.args.get('branch_id')
        customer_id = request.args.get('customer_id')
        aging_bucket = request.args.get('aging_bucket')
        
        if supabase:
            query = supabase.table('customer_invoices').select('*, customer:guests(*)')
            if branch_id:
                query = query.eq('branch_id', branch_id)
            if customer_id:
                query = query.eq('customer_id', customer_id)
            if aging_bucket:
                query = query.eq('aging_bucket', aging_bucket)
                
            res = query.order('due_date', desc=True).execute()
            return jsonify({'success': True, 'data': res.data})
        return jsonify({'success': False, 'message': 'Database not available'}), 503
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@accounting_bp.route('/credit-bills/employee/record', methods=['POST'])
def record_employee_credit():
    """Record a new employee credit bill"""
    try:
        data = request.get_json()
        if supabase:
            res = supabase.table('employee_credit_bills').insert(data).execute()
            return jsonify({'success': True, 'data': res.data[0]})
        return jsonify({'success': False, 'message': 'Database not available'}), 503
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Banking & Payment Routes
@accounting_bp.route('/banking/deposits', methods=['GET'])
def get_bank_deposits():
    """Get bank deposits"""
    try:
        branch_id = request.args.get('branch_id')
        if supabase:
            res = supabase.table('bank_deposits').select('*, bank_account:bank_accounts(*)').eq('branch_id', branch_id).order('deposit_date', desc=True).execute()
            return jsonify({'success': True, 'data': res.data})
        return jsonify({'success': False, 'message': 'Database not available'}), 503
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@accounting_bp.route('/banking/deposits', methods=['POST'])
def record_bank_deposit():
    """Record a bank deposit"""
    try:
        data = request.get_json()
        branch_id = data.get('branch_id')
        deposit_date = data.get('deposit_date')
        
        if is_period_locked(branch_id, deposit_date):
            return jsonify({'success': False, 'message': 'Period is locked'}), 403
            
        if supabase:
            res = supabase.table('bank_deposits').insert(data).execute()
            return jsonify({'success': True, 'data': res.data[0]})
        return jsonify({'success': False, 'message': 'Database not available'}), 503
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@accounting_bp.route('/banking/receipts', methods=['GET'])
def get_payment_receipts():
    """Get payment receipts"""
    try:
        branch_id = request.args.get('branch_id')
        status = request.args.get('reconciled')
        
        if supabase:
            query = supabase.table('payment_receipts').select('*').eq('branch_id', branch_id)
            if status is not None:
                query = query.eq('reconciled', status.lower() == 'true')
            res = query.order('receipt_date', desc=True).execute()
            return jsonify({'success': True, 'data': res.data})
        return jsonify({'success': False, 'message': 'Database not available'}), 503
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Expense Management Routes
@accounting_bp.route('/expenses', methods=['GET'])
def get_expenses():
    """Get expenses with categories"""
    try:
        branch_id = request.args.get('branch_id')
        category_id = request.args.get('category_id')
        
        if supabase:
            query = supabase.table('expenses').select('*, category:expense_categories(*)').eq('branch_id', branch_id)
            if category_id:
                query = query.eq('category_id', category_id)
            res = query.order('expense_date', desc=True).execute()
            return jsonify({'success': True, 'data': res.data})
        return jsonify({'success': False, 'message': 'Database not available'}), 503
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@accounting_bp.route('/expenses', methods=['POST'])
def record_expense():
    """Record an expense with period lock check"""
    try:
        data = request.get_json()
        branch_id = data.get('branch_id')
        expense_date = data.get('expense_date')
        
        if is_period_locked(branch_id, expense_date):
            return jsonify({'success': False, 'message': 'Period is locked'}), 403
            
        if supabase:
            res = supabase.table('expenses').insert(data).execute()
            return jsonify({'success': True, 'data': res.data[0]})
        return jsonify({'success': False, 'message': 'Database not available'}), 503
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Quotation & Invoice Management Routes
@accounting_bp.route('/quotations', methods=['GET'])
def get_quotations():
    """Get all quotations"""
    try:
        branch_id = request.args.get('branch_id')
        status = request.args.get('status')
        if supabase:
            query = supabase.table('quotations').select('*, items:quotation_items(*), customer:guests(*)')
            if branch_id: query = query.eq('branch_id', branch_id)
            if status: query = query.eq('status', status)
            res = query.order('created_at', desc=True).execute()
            return jsonify({'success': True, 'data': res.data})
        return jsonify({'success': False, 'message': 'Database not available'}), 503
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@accounting_bp.route('/quotations', methods=['POST'])
def create_quotation():
    """Create a new quotation with items"""
    try:
        data = request.get_json()
        items = data.pop('items', [])
        
        if supabase:
            # Insert quotation header
            res = supabase.table('quotations').insert(data).execute()
            if not res.data:
                return jsonify({'success': False, 'message': 'Failed to create quotation'}), 400
            
            quotation_id = res.data[0]['id']
            # Insert items
            for item in items:
                item['quotation_id'] = quotation_id
            
            if items:
                supabase.table('quotation_items').insert(items).execute()
                
            return jsonify({'success': True, 'data': res.data[0]})
        return jsonify({'success': False, 'message': 'Database not available'}), 503
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@accounting_bp.route('/quotations/<quot_id>/convert', methods=['POST'])
def convert_quotation_to_invoice(quot_id):
    """Convert a quotation to an invoice"""
    try:
        if not supabase: return jsonify({'success': False}), 503
        
        # 1. Fetch quotation and items
        q_res = supabase.table('quotations').select('*, items:quotation_items(*)').eq('id', quot_id).single().execute()
        if not q_res.data:
            return jsonify({'success': False, 'message': 'Quotation not found'}), 404
        
        quot = q_res.data
        
        # 2. Create Invoice
        invoice_data = {
            'branch_id': quot['branch_id'],
            'customer_id': quot['customer_id'],
            'invoice_number': f"INV-{quot['quotation_number'].split('-')[-1]}",
            'invoice_date': datetime.now().date().isoformat(),
            'due_date': (datetime.now() + timedelta(days=14)).date().isoformat(),
            'amount': quot['grand_total'],
            'status': 'unpaid'
        }
        
        inv_res = supabase.table('customer_invoices').insert(invoice_data).execute()
        if not inv_res.data:
            return jsonify({'success': False, 'message': 'Failed to create invoice'}), 400
        
        invoice_id = inv_res.data[0]['id']
        
        # 3. Create Invoice Items
        inv_items = []
        for q_item in quot['items']:
            inv_items.append({
                'invoice_id': invoice_id,
                'item_description': q_item['item_description'],
                'quantity': q_item['quantity'],
                'unit_price': q_item['unit_price'],
                'tax_rate': q_item['tax_rate']
            })
        
        if inv_items:
            supabase.table('customer_invoice_items').insert(inv_items).execute()
            
        # 4. Update Quotation status
        supabase.table('quotations').update({
            'status': 'converted', 
            'converted_to_invoice_id': invoice_id
        }).eq('id', quot_id).execute()
        
        return jsonify({'success': True, 'invoice_id': invoice_id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Auditor & Approval Routes
@audit_bp.route('/approvals/pending', methods=['GET'])
def get_pending_approvals():
    """Get all pending approval requests for the auditor"""
    try:
        branch_id = request.args.get('branch_id')
        if supabase:
            query = supabase.table('approval_requests').select('*, requested_by_user:staff(*)').eq('status', 'pending')
            if branch_id: query = query.eq('branch_id', branch_id)
            res = query.order('created_at', desc=False).execute()
            return jsonify({'success': True, 'data': res.data})
        return jsonify({'success': False}), 503
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@audit_bp.route('/approvals/<request_id>/process', methods=['POST'])
def process_approval(request_id):
    """Approve or Reject a financial request"""
    try:
        data = request.get_json()
        status = data.get('status') # 'approved' or 'rejected'
        comments = data.get('comments')
        reviewer_id = data.get('reviewer_id')
        
        if status not in ['approved', 'rejected']:
            return jsonify({'success': False, 'message': 'Invalid status'}), 400
            
        if supabase:
            # 1. Update approval request
            res = supabase.table('approval_requests').update({
                'status': status,
                'comments': comments,
                'reviewed_by': reviewer_id,
                'reviewed_at': datetime.now().isoformat()
            }).eq('id', request_id).execute()
            
            if not res.data:
                return jsonify({'success': False, 'message': 'Request not found'}), 404
            
            req = res.data[0]
            
            # 2. Update the target entity status
            entity_table_map = {
                'STOCK_COUNT': 'stock_counts',
                'EXPENSE': 'expenses',
                'JOURNAL_ENTRY': 'accounting_journal_entries'
            }
            
            table = entity_table_map.get(req['entity_type'])
            if table:
                supabase.table(table).update({
                    'status' if req['entity_type'] == 'STOCK_COUNT' else 'approval_status': status
                }).eq('id', req['entity_id']).execute()
            
            return jsonify({'success': True, 'data': req})
        return jsonify({'success': False}), 503
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@audit_bp.route('/trail', methods=['GET'])
def get_audit_trail():
    """Get global financial audit trail"""
    try:
        branch_id = request.args.get('branch_id')
        entity_type = request.args.get('entity_type')
        if supabase:
            query = supabase.table('financial_audit_logs').select('*, staff(*)')
            if branch_id: query = query.eq('branch_id', branch_id)
            if entity_type: query = query.eq('entity_type', entity_type)
            res = query.order('created_at', desc=True).limit(100).execute()
            return jsonify({'success': True, 'data': res.data})
        return jsonify({'success': False}), 503
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Journal Entry Routes (Enhanced)
@accounting_bp.route('/journal-entries/comprehensive', methods=['POST'])
def create_journal_entry_with_items():
    """Create a journal entry with all its line items (Double Entry)"""
    try:
        data = request.get_json()
        items = data.pop('items', [])
        
        if supabase:
            # 1. Insert header
            res = supabase.table('accounting_journal_entries').insert(data).execute()
            if not res.data:
                return jsonify({'success': False, 'message': 'Failed to create entry'}), 400
            
            entry_id = res.data[0]['id']
            
            # 2. Insert line items
            for item in items:
                item['journal_entry_id'] = entry_id
                
            if items:
                supabase.table('accounting_journal_items').insert(items).execute()
                
            return jsonify({'success': True, 'data': res.data[0]})
        return jsonify({'success': False}), 503
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Chart of Accounts Routes
@accounting_bp.route('/chart-of-accounts', methods=['GET'])
def get_chart_of_accounts():
    """Get the full chart of accounts"""
    try:
        branch_id = request.args.get('branch_id')
        if supabase:
            query = supabase.table('accounting_chart_of_accounts').select('*, category:accounting_account_categories(*)')
            if branch_id: query = query.eq('branch_id', branch_id)
            res = query.order('account_code').execute()
            return jsonify({'success': True, 'data': res.data})
        return jsonify({'success': False}), 503
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Financial Reporting Routes
@accounting_bp.route('/reports/p-and-l', methods=['GET'])
def get_p_and_l():
    """Generate Profit & Loss statement"""
    try:
        branch_id = request.args.get('branch_id', type=int)
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        if supabase:
            service = ReportingService(supabase)
            data = service.get_profit_and_loss(branch_id, start_date, end_date)
            return jsonify({'success': True, 'data': data})
        return jsonify({'success': False}), 503
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@accounting_bp.route('/reports/trial-balance', methods=['GET'])
def get_trial_balance_report():
    """Get Trial Balance report"""
    try:
        branch_id = request.args.get('branch_id')
        if supabase:
            service = ReportingService(supabase)
            data = service.get_trial_balance(branch_id)
            return jsonify({'success': True, 'data': data})
        return jsonify({'success': False}), 503
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ... keep existing journal routes below if needed or replace ...
@accounting_bp.route('/journal-entries', methods=['GET'])
def get_journal_entries():
    """Get all journal entries with optional filters"""
    try:
        status = request.args.get('status')
        department = request.args.get('department')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        branch_id = request.args.get('branch_id')
        
        if supabase:
            query = supabase.table('accounting_journal_entries').select('*, lines:accounting_journal_lines(*, account:accounting_chart_of_accounts(*))')
            
            if status:
                query = query.eq('status', status)
            if start_date:
                query = query.gte('entry_date', start_date)
            if end_date:
                query = query.lte('entry_date', end_date)
            
            # Note: branch_id in accounting_journal_entries might need to be added or handled via metadata
            # For now, we'll fetch all and filter in memory if needed, or assume it's not yet implemented in schema
            
            res = query.order('entry_date', desc=True).execute()
            
            # Map database structure back to what frontend expects
            entries = []
            for item in (res.data or []):
                lines = item.get('lines', [])
                debit_line = next((l for l in lines if l['debit_amount'] > 0), {})
                credit_line = next((l for l in lines if l['credit_amount'] > 0), {})
                
                entry = {
                    'id': item['id'],
                    'date': item['entry_date'],
                    'reference': item['reference'] or item['journal_number'],
                    'description': item['description'],
                    'debit_account': f"{debit_line.get('account', {}).get('account_code', '')} - {debit_line.get('account', {}).get('account_name', '')}",
                    'credit_account': f"{credit_line.get('account', {}).get('account_code', '')} - {credit_line.get('account', {}).get('account_name', '')}",
                    'amount': float(item['total_debit']),
                    'status': item['status'],
                    'created_at': item['created_at'],
                    'department': debit_line.get('department') or 'General'
                }
                entries.append(entry)
            
            return jsonify({
                'success': True,
                'data': entries,
                'total': len(entries)
            })
        
        # Fallback to in-memory
        filtered_entries = list(journal_entries.values())
        # ... (rest of filtering logic)
    except Exception as e:
        logger.error(f"Error fetching journal entries: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@accounting_bp.route('/journal-entries', methods=['POST'])
def create_journal_entry():
    """Create a new journal entry"""
    try:
        entry_data = request.get_json()
        
        # Validate entry
        is_valid, message = validate_journal_entry(entry_data)
        if not is_valid:
            return jsonify({'success': False, 'error': message}), 400
        
        if supabase:
            # 1. Get account IDs
            debit_acc_id = get_account_id(entry_data['debit_account'])
            credit_acc_id = get_account_id(entry_data['credit_account'])
            
            if not debit_acc_id or not credit_acc_id:
                return jsonify({'success': False, 'error': 'Could not resolve account IDs'}), 400
            
            # 2. Create entry
            journal_number = f"JE-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8]}"
            entry_record = {
                'journal_number': journal_number,
                'entry_date': entry_data['date'],
                'description': entry_data['description'],
                'reference': entry_data['reference'],
                'total_debit': entry_data['amount'],
                'total_credit': entry_data['amount'],
                'status': 'draft'
            }
            
            res = supabase.table('accounting_journal_entries').insert(entry_record).execute()
            if not res.data:
                raise Exception("Failed to create journal entry record")
            
            entry_id = res.data[0]['id']
            
            # 3. Create lines
            lines = [
                {
                    'journal_entry_id': entry_id,
                    'account_id': debit_acc_id,
                    'description': entry_data['description'],
                    'debit_amount': entry_data['amount'],
                    'credit_amount': 0,
                    'department': entry_data['department']
                },
                {
                    'journal_entry_id': entry_id,
                    'account_id': credit_acc_id,
                    'description': entry_data['description'],
                    'debit_amount': 0,
                    'credit_amount': entry_data['amount'],
                    'department': entry_data['department']
                }
            ]
            
            supabase.table('accounting_journal_lines').insert(lines).execute()
            
            # Log creation
            log_audit_action(entry_id, 'CREATED', entry_data.get('created_by', 'System'), f"Created journal entry: {entry_data['reference']}")
            
            return jsonify({
                'success': True,
                'data': {**entry_data, 'id': entry_id, 'status': 'draft'},
                'message': 'Journal entry created successfully'
            })

        # Fallback to in-memory
        entry_id = str(uuid.uuid4())
        # ... (rest of in-memory logic)
    except Exception as e:
        logger.error(f"Error creating journal entry: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@accounting_bp.route('/journal-entries/<entry_id>', methods=['PUT'])
def update_journal_entry(entry_id):
    """Update an existing journal entry"""
    try:
        update_data = request.get_json()
        
        if supabase:
            # Fetch entry to check status
            res = supabase.table('accounting_journal_entries').select('*').eq('id', entry_id).execute()
            if not res.data or len(res.data) == 0:
                return jsonify({'success': False, 'error': 'Entry not found'}), 404
            
            entry = res.data[0]
            if entry['status'] not in ['draft', 'rejected']:
                return jsonify({'success': False, 'error': 'Cannot update posted or approved entries'}), 400
            
            # Validate updated data
            is_valid, message = validate_journal_entry(update_data)
            if not is_valid:
                return jsonify({'success': False, 'error': message}), 400
            
            # Get account IDs
            debit_acc_id = get_account_id(update_data['debit_account'])
            credit_acc_id = get_account_id(update_data['credit_account'])
            
            if not debit_acc_id or not credit_acc_id:
                return jsonify({'success': False, 'error': 'Could not resolve account IDs'}), 400
            
            # Update entry
            entry_update = {
                'entry_date': update_data['date'],
                'description': update_data['description'],
                'reference': update_data['reference'],
                'total_debit': update_data['amount'],
                'total_credit': update_data['amount'],
                'updated_at': datetime.now().isoformat()
            }
            
            supabase.table('accounting_journal_entries').update(entry_update).eq('id', entry_id).execute()
            
            # Delete old lines
            supabase.table('accounting_journal_lines').delete().eq('journal_entry_id', entry_id).execute()
            
            # Create new lines
            lines = [
                {
                    'journal_entry_id': entry_id,
                    'account_id': debit_acc_id,
                    'description': update_data['description'],
                    'debit_amount': update_data['amount'],
                    'credit_amount': 0,
                    'department': update_data['department']
                },
                {
                    'journal_entry_id': entry_id,
                    'account_id': credit_acc_id,
                    'description': update_data['description'],
                    'debit_amount': 0,
                    'credit_amount': update_data['amount'],
                    'department': update_data['department']
                }
            ]
            
            supabase.table('accounting_journal_lines').insert(lines).execute()
            
            # Log update
            log_audit_action(entry_id, 'UPDATED', update_data.get('updated_by', 'System'), 
                           f"Updated journal entry: {update_data['reference']}")
            
            return jsonify({
                'success': True,
                'data': {**update_data, 'id': entry_id, 'status': entry['status']},
                'message': 'Journal entry updated successfully'
            })
        
        # Fallback to in-memory
        if entry_id not in journal_entries:
            return jsonify({'success': False, 'error': 'Entry not found'}), 404
        
        entry = journal_entries[entry_id]
        if entry['status'] not in ['draft', 'rejected']:
            return jsonify({'success': False, 'error': 'Cannot update posted or approved entries'}), 400
        
        # Validate updated data
        is_valid, message = validate_journal_entry({**entry, **update_data})
        if not is_valid:
            return jsonify({'success': False, 'error': message}), 400
        
        # Update entry
        entry.update(update_data)
        entry['updated_at'] = datetime.now().isoformat()
        entry['updated_by'] = update_data.get('updated_by', 'System')
        
        # Log update
        log_audit_action(entry_id, 'UPDATED', entry['updated_by'], f"Updated journal entry: {entry['reference']}")
        
        return jsonify({
            'success': True,
            'data': entry,
            'message': 'Journal entry updated successfully'
        })
    except Exception as e:
        logger.error(f"Error updating journal entry: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@accounting_bp.route('/journal-entries/<entry_id>/submit', methods=['POST'])
def submit_journal_entry(entry_id):
    """Submit journal entry for review"""
    try:
        if entry_id not in journal_entries:
            return jsonify({'success': False, 'error': 'Entry not found'}), 404
        
        entry = journal_entries[entry_id]
        if entry['status'] != 'draft':
            return jsonify({'success': False, 'error': 'Only draft entries can be submitted'}), 400
        
        entry['status'] = 'pending_review'
        entry['submitted_at'] = datetime.now().isoformat()
        entry['submitted_by'] = request.json.get('user', 'System') if request.json else 'System'
        
        # Add to review queue
        review_queue[entry_id] = entry
        
        # Log submission
        log_audit_action(entry_id, 'SUBMITTED', entry['submitted_by'], f"Submitted for review: {entry['reference']}")
        
        return jsonify({
            'success': True,
            'data': entry,
            'message': 'Journal entry submitted for review'
        })
    except Exception as e:
        logger.error(f"Error submitting journal entry: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# Review Routes
@accounting_bp.route('/review-queue', methods=['GET'])
def get_review_queue():
    """Get entries pending review"""
    try:
        pending_entries = [entry for entry in journal_entries.values() if entry['status'] == 'pending_review']
        
        return jsonify({
            'success': True,
            'data': pending_entries,
            'total': len(pending_entries)
        })
    except Exception as e:
        logger.error(f"Error fetching review queue: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@accounting_bp.route('/journal-entries/<entry_id>/review', methods=['POST'])
def review_journal_entry(entry_id):
    """Approve or reject a journal entry"""
    try:
        if entry_id not in journal_entries:
            return jsonify({'success': False, 'error': 'Entry not found'}), 404
        
        entry = journal_entries[entry_id]
        if entry['status'] != 'pending_review':
            return jsonify({'success': False, 'error': 'Entry is not pending review'}), 400
        
        review_data = request.get_json() or {}
        action = review_data.get('action')  # 'approve' or 'reject'
        notes = review_data.get('notes', '')
        reviewer = review_data.get('reviewer', 'System')
        
        if action not in ['approve', 'reject']:
            return jsonify({'success': False, 'error': 'Invalid action'}), 400
        
        entry['status'] = 'approved' if action == 'approve' else 'rejected'
        entry['reviewed_by'] = reviewer
        entry['reviewed_at'] = datetime.now().isoformat()
        entry['review_notes'] = notes
        
        # Remove from review queue
        if entry_id in review_queue:
            del review_queue[entry_id]
        
        # Log review
        log_audit_action(entry_id, action.upper(), reviewer, f"{action.title()}ed: {entry['reference']}. Notes: {notes}")
        
        return jsonify({
            'success': True,
            'data': entry,
            'message': f'Journal entry {action}d successfully'
        })
    except Exception as e:
        logger.error(f"Error reviewing journal entry: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@accounting_bp.route('/journal-entries/<entry_id>/post', methods=['POST'])
def post_journal_entry(entry_id):
    """Post approved journal entry to ledger"""
    try:
        if entry_id not in journal_entries:
            return jsonify({'success': False, 'error': 'Entry not found'}), 404
        
        entry = journal_entries[entry_id]
        if entry['status'] != 'approved':
            return jsonify({'success': False, 'error': 'Only approved entries can be posted'}), 400
        
        entry['status'] = 'posted'
        entry['posted_at'] = datetime.now().isoformat()
        entry['posted_by'] = request.json.get('user', 'System') if request.json else 'System'
        
        # Log posting
        log_audit_action(entry_id, 'POSTED', entry['posted_by'], f"Posted to ledger: {entry['reference']}")
        
        return jsonify({
            'success': True,
            'data': entry,
            'message': 'Journal entry posted successfully'
        })
    except Exception as e:
        logger.error(f"Error posting journal entry: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@accounting_bp.route('/journal-entries/<entry_id>', methods=['DELETE'])
def delete_journal_entry(entry_id):
    """Delete a journal entry (only draft or rejected entries)"""
    try:
        if supabase:
            # Fetch entry to check status
            res = supabase.table('accounting_journal_entries').select('*').eq('id', entry_id).execute()
            if not res.data or len(res.data) == 0:
                return jsonify({'success': False, 'error': 'Entry not found'}), 404
            
            entry = res.data[0]
            if entry['status'] not in ['draft', 'rejected']:
                return jsonify({'success': False, 'error': 'Only draft or rejected entries can be deleted'}), 400
            
            # Delete journal lines first (foreign key constraint)
            supabase.table('accounting_journal_lines').delete().eq('journal_entry_id', entry_id).execute()
            
            # Delete journal entry
            supabase.table('accounting_journal_entries').delete().eq('id', entry_id).execute()
            
            # Log deletion
            log_audit_action(entry_id, 'DELETED', request.json.get('deleted_by', 'System') if request.json else 'System', 
                           f"Deleted journal entry: {entry.get('reference', entry.get('journal_number', 'Unknown'))}")
            
            return jsonify({
                'success': True,
                'message': 'Journal entry deleted successfully'
            })
        
        # Fallback to in-memory
        if entry_id not in journal_entries:
            return jsonify({'success': False, 'error': 'Entry not found'}), 404
        
        entry = journal_entries[entry_id]
        if entry['status'] not in ['draft', 'rejected']:
            return jsonify({'success': False, 'error': 'Only draft or rejected entries can be deleted'}), 400
        
        # Remove from review queue if present
        if entry_id in review_queue:
            del review_queue[entry_id]
        
        # Delete entry
        del journal_entries[entry_id]
        
        # Log deletion
        log_audit_action(entry_id, 'DELETED', request.json.get('deleted_by', 'System') if request.json else 'System', 
                       f"Deleted journal entry: {entry['reference']}")
        
        return jsonify({
            'success': True,
            'message': 'Journal entry deleted successfully'
        })
    except Exception as e:
        logger.error(f"Error deleting journal entry: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# Reconciliation Routes
@accounting_bp.route('/reconciliations', methods=['GET'])
def get_reconciliations():
    """Get bank reconciliation status"""
    try:
        # Mock data for demonstration
        mock_reconciliations = [
            {
                'id': '1',
                'account_name': 'Cash - Main Bank Account',
                'account_type': 'Asset',
                'book_balance': 1250000.00,
                'bank_balance': 1248500.00,
                'difference': 1500.00,
                'last_reconciled': '2024-12-01',
                'status': 'discrepancy',
                'reconciled_by': 'accountant@famousgate.com'
            },
            {
                'id': '2',
                'account_name': 'Petty Cash',
                'account_type': 'Asset',
                'book_balance': 50000.00,
                'bank_balance': 50000.00,
                'difference': 0.00,
                'last_reconciled': '2024-12-09',
                'status': 'reconciled',
                'reconciled_by': 'accountant@famousgate.com'
            },
            {
                'id': '3',
                'account_name': 'Accounts Receivable',
                'account_type': 'Asset',
                'book_balance': 850000.00,
                'bank_balance': 0.00,
                'difference': 850000.00,
                'last_reconciled': '2024-11-30',
                'status': 'pending',
                'reconciled_by': None
            }
        ]
        
        return jsonify({
            'success': True,
            'data': mock_reconciliations
        })
    except Exception as e:
        logger.error(f"Error fetching reconciliations: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# Audit Routes
@audit_bp.route('/trail', methods=['GET'])
def get_audit_trail():
    """Get audit trail"""
    try:
        limit = request.args.get('limit', 100, type=int)
        entry_id = request.args.get('entry_id')
        
        filtered_trail = audit_trail
        
        if entry_id:
            filtered_trail = [log for log in audit_trail if log['entry_id'] == entry_id]
        
        # Sort by timestamp descending and limit
        filtered_trail.sort(key=lambda x: x['timestamp'], reverse=True)
        filtered_trail = filtered_trail[:limit]
        
        return jsonify({
            'success': True,
            'data': filtered_trail,
            'total': len(filtered_trail)
        })
    except Exception as e:
        logger.error(f"Error fetching audit trail: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@audit_bp.route('/workpapers', methods=['GET'])
def get_workpapers():
    """Get audit workpapers"""
    try:
        # Mock data for demonstration
        mock_workpapers = [
            {
                'id': '1',
                'title': 'Year-End Revenue Verification',
                'type': 'workpaper',
                'period': '2024-Q4',
                'status': 'completed',
                'prepared_by': 'auditor@famousgate.com',
                'reviewed_by': 'senior.auditor@famousgate.com',
                'file_url': '/files/workpapers/2024_Q4_revenue.pdf',
                'created_at': '2024-12-01T10:00:00'
            },
            {
                'id': '2',
                'title': 'Bank Reconciliation Schedule',
                'type': 'schedule',
                'period': '2024-12',
                'status': 'in_review',
                'prepared_by': 'accountant@famousgate.com',
                'reviewed_by': None,
                'file_url': '/files/schedules/bank_recon_2024_12.xlsx',
                'created_at': '2024-12-09T14:30:00'
            },
            {
                'id': '3',
                'title': 'Fixed Asset Register',
                'type': 'supporting_document',
                'period': '2024-FY',
                'status': 'draft',
                'prepared_by': 'accountant@famousgate.com',
                'reviewed_by': None,
                'file_url': None,
                'created_at': '2024-12-08T09:15:00'
            }
        ]
        
        return jsonify({
            'success': True,
            'data': mock_workpapers
        })
    except Exception as e:
        logger.error(f"Error fetching workpapers: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# Reports Routes
@accounting_bp.route('/reports/trial-balance', methods=['GET'])
def get_trial_balance():
    """Generate trial balance"""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        branch_id = request.args.get('branch_id')
        
        # Mock trial balance data
        trial_balance = []
        
        for code, account in CHART_OF_ACCOUNTS.items():
            # Calculate mock balances based on posted entries
            debit_total = 0
            credit_total = 0
            
            for entry in journal_entries.values():
                if entry['status'] == 'posted':
                    if entry['debit_account'].startswith(code):
                        debit_total += entry['amount']
                    if entry['credit_account'].startswith(code):
                        credit_total += entry['amount']
            
            balance = debit_total - credit_total
            
            trial_balance.append({
                'account_code': code,
                'account_name': account['name'],
                'account_type': account['type'],
                'debit_total': debit_total,
                'credit_total': credit_total,
                'balance': balance
            })
        
        return jsonify({
            'success': True,
            'data': trial_balance,
            'total_debits': sum(item['debit_total'] for item in trial_balance),
            'total_credits': sum(item['credit_total'] for item in trial_balance)
        })
    except Exception as e:
        logger.error(f"Error generating trial balance: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@accounting_bp.route('/reports/financial-statements', methods=['GET'])
def get_financial_statements():
    """Generate financial statements"""
    try:
        statement_type = request.args.get('type', 'balance-sheet')  # balance-sheet, income-statement, cash-flow
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        branch_id = request.args.get('branch_id')
        
        # Mock financial statements
        if statement_type == 'balance-sheet':
            statement = {
                'assets': {
                    'current_assets': {
                        'cash': 1500000,
                        'accounts_receivable': 850000,
                        'inventory': 450000,
                        'prepaid_expenses': 120000,
                        'total': 2920000
                    },
                    'non_current_assets': {
                        'furniture_equipment': 3500000,
                        'accumulated_depreciation': -850000,
                        'total': 2650000
                    },
                    'total_assets': 5570000
                },
                'liabilities': {
                    'current_liabilities': {
                        'accounts_payable': 620000,
                        'accrued_expenses': 280000,
                        'taxes_payable': 150000,
                        'total': 1050000
                    },
                    'non_current_liabilities': {
                        'bank_loans': 1800000,
                        'total': 1800000
                    },
                    'total_liabilities': 2850000
                },
                'equity': {
                    'owners_equity': 2500000,
                    'retained_earnings': 220000,
                    'total_equity': 2720000
                },
                'total_liabilities_equity': 5570000
            }
        elif statement_type == 'income-statement':
            statement = {
                'revenue': {
                    'room_revenue': 8500000,
                    'restaurant_revenue': 3200000,
                    'bar_revenue': 1800000,
                    'other_revenue': 450000,
                    'total_revenue': 13950000
                },
                'expenses': {
                    'cost_of_goods_sold': 2100000,
                    'salaries_wages': 3500000,
                    'utilities': 850000,
                    'rent': 1200000,
                    'marketing': 650000,
                    'maintenance': 450000,
                    'depreciation': 350000,
                    'other_expenses': 280000,
                    'total_expenses': 9380000
                },
                'net_income': 4570000
            }
        else:  # cash-flow
            statement = {
                'operating_activities': {
                    'net_income': 4570000,
                    'depreciation': 350000,
                    'increase_in_ar': -850000,
                    'increase_in_inventory': -450000,
                    'increase_in_ap': 620000,
                    'net_cash_from_operations': 4240000
                },
                'investing_activities': {
                    'purchase_of_equipment': -850000,
                    'net_cash_from_investing': -850000
                },
                'financing_activities': {
                    'loan_repayment': -200000,
                    'owners_draw': -500000,
                    'net_cash_from_financing': -700000
                },
                'net_change_in_cash': 2690000,
                'cash_beginning': 1500000,
                'cash_ending': 4190000
            }
        
        return jsonify({
            'success': True,
            'data': statement,
            'type': statement_type,
            'period': f"{start_date} to {end_date}"
        })
    except Exception as e:
        logger.error(f"Error generating financial statements: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# Initialize with some sample data
def init_sample_data():
    """Initialize with sample journal entries for demonstration"""
    sample_entries = [
        {
            'date': '2024-12-09',
            'reference': 'JE20241209-001',
            'description': 'Daily room revenue collection',
            'debit_account': '1000 - Cash and Cash Equivalents',
            'credit_account': '4000 - Room Revenue',
            'amount': 125000,
            'currency': 'KES',
            'department': 'Rooms Division',
            'category': 'revenue',
            'branch_id': 1,
            'status': 'posted',
            'created_by': 'accountant@famousgate.com',
            'created_at': datetime.now().isoformat(),
            'posted_at': datetime.now().isoformat(),
            'posted_by': 'accountant@famousgate.com',
            'attachments': []
        },
        {
            'date': '2024-12-09',
            'reference': 'JE20241209-002',
            'description': 'Restaurant supplies purchase',
            'debit_account': '1200 - Inventory',
            'credit_account': '2000 - Accounts Payable',
            'amount': 45000,
            'currency': 'KES',
            'department': 'Food & Beverage',
            'category': 'expense',
            'branch_id': 1,
            'status': 'pending_review',
            'created_by': 'restaurant@famousgate.com',
            'created_at': datetime.now().isoformat(),
            'attachments': []
        },
        {
            'date': '2024-12-08',
            'reference': 'JE20241208-003',
            'description': 'Monthly rent payment',
            'debit_account': '5300 - Rent Expense',
            'credit_account': '1000 - Cash and Cash Equivalents',
            'amount': 120000,
            'currency': 'KES',
            'department': 'Administration',
            'category': 'expense',
            'branch_id': 1,
            'status': 'posted',
            'created_by': 'accountant@famousgate.com',
            'created_at': datetime.now().isoformat(),
            'posted_at': datetime.now().isoformat(),
            'posted_by': 'accountant@famousgate.com',
            'attachments': []
        }
    ]
    
    for entry in sample_entries:
        entry_id = str(uuid.uuid4())
        entry['id'] = entry_id
        journal_entries[entry_id] = entry
        
        # Log creation
        log_audit_action(entry_id, 'CREATED', entry['created_by'], f"Created journal entry: {entry['reference']}")
        
        # Add pending entries to review queue
        if entry['status'] == 'pending_review':
            review_queue[entry_id] = entry

# Initialize sample data on module import
init_sample_data()
