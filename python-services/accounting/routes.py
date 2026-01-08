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
        if not supabase:
            return jsonify({'success': False, 'message': 'Database not available'}), 503
            
        # Try primary selective join
        try:
            query = supabase.table('approval_requests')\
                .select('*, requested_by_user:staff_profiles!requested_by(*)')\
                .eq('status', 'pending')
            if branch_id: 
                query = query.eq('branch_id', int(branch_id))
            res = query.order('created_at', desc=False).execute()
        except Exception as join_e:
            logger.warning(f"Join with 'requested_by' failed, trying fallback: {join_e}")
            # Fallback to simple select if join fails
            query = supabase.table('approval_requests').select('*').eq('status', 'pending')
            if branch_id: 
                query = query.eq('branch_id', int(branch_id))
            res = query.order('created_at', desc=False).execute()
            
        return jsonify({'success': True, 'data': res.data})
    except Exception as e:
        logger.error(f"Error in get_pending_approvals: {str(e)}")
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
# Removed redundant fallback routes that were causing AssertionError
