"""
Kyogong - Accounting & Audit Routes
Handles journal entries, reviews, reconciliation, and audit trails
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta, date
from decimal import Decimal
import uuid
import io
from typing import Dict, List, Any, Optional, Tuple
from functools import wraps
import logging

# Create blueprint
accounting_bp = Blueprint('accounting', __name__, url_prefix='/api/accounting')
audit_bp = Blueprint('audit', __name__, url_prefix='/api/audit')

from .stock_valuation import StockValuationService
from .reporting import ReportingService
from .document_generator import AccountingDocumentGenerator
from flask import g, send_file

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
            # Note: Removed join with staff_profiles as there's no FK relationship
            # and staff_profiles lacks first_name/last_name columns
            query = supabase.table('financial_audit_logs').select('*')
            if branch_id: query = query.eq('branch_id', branch_id)
            if entity_type: query = query.eq('entity_type', entity_type)
            res = query.order('created_at', desc=True).limit(100).execute()
            return jsonify({'success': True, 'data': res.data})
        return jsonify({'success': False}), 503
    except Exception as e:
        logger.error(f"Error fetching audit trail: {e}")
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
            # Note: Removed join with accounting_account_categories as there's no FK relationship
            # Frontend can fetch categories separately if needed
            query = supabase.table('accounting_chart_of_accounts').select('*')
            if branch_id: query = query.eq('branch_id', branch_id)
            res = query.order('account_code').execute()
            return jsonify({'success': True, 'data': res.data})
        return jsonify({'success': False}), 503
    except Exception as e:
        logger.error(f"Error fetching chart of accounts: {e}")
        return jsonify({'error': str(e)}), 500

# Fiscal Period Management Routes
@accounting_bp.route('/fiscal-periods', methods=['GET'])
def get_fiscal_periods():
    """Get all fiscal periods for a branch"""
    try:
        branch_id = request.args.get('branch_id', type=int)
        if supabase:
            query = supabase.table('fiscal_periods').select('*')
            if branch_id:
                query = query.eq('branch_id', branch_id)
            res = query.order('start_date', desc=True).execute()
            return jsonify({'success': True, 'data': res.data})
        return jsonify({'success': False}), 503
    except Exception as e:
        logger.error(f"Error fetching fiscal periods: {e}")
        return jsonify({'error': str(e)}), 500

@accounting_bp.route('/fiscal-periods', methods=['POST'])
def create_fiscal_period():
    """Create a new fiscal period"""
    try:
        data = request.get_json()
        if supabase:
            res = supabase.table('fiscal_periods').insert(data).execute()
            return jsonify({'success': True, 'data': res.data})
        return jsonify({'success': False}), 503
    except Exception as e:
        logger.error(f"Error creating fiscal period: {e}")
        return jsonify({'error': str(e)}), 500

@accounting_bp.route('/fiscal-periods/<period_id>/close', methods=['PATCH'])
def close_fiscal_period(period_id):
    """Close a fiscal period"""
    try:
        data = request.get_json()
        if supabase:
            update_data = {
                'status': 'closed',
                'closed_at': data.get('closing_date', datetime.now().isoformat()),
                'closed_by': data.get('closed_by')
            }
            res = supabase.table('fiscal_periods').update(update_data).eq('id', period_id).execute()
            return jsonify({'success': True, 'data': res.data})
        return jsonify({'success': False}), 503
    except Exception as e:
        logger.error(f"Error closing fiscal period: {e}")
        return jsonify({'error': str(e)}), 500

@accounting_bp.route('/fiscal-periods/<period_id>/lock', methods=['PATCH'])
def lock_fiscal_period(period_id):
    """Lock a fiscal period (auditor only)"""
    try:
        data = request.get_json()
        if supabase:
            update_data = {
                'status': 'locked',
                'locked_at': datetime.now().isoformat(),
                'locked_by': data.get('locked_by')
            }
            res = supabase.table('fiscal_periods').update(update_data).eq('id', period_id).execute()
            return jsonify({'success': True, 'data': res.data})
        return jsonify({'success': False}), 503
    except Exception as e:
        logger.error(f"Error locking fiscal period: {e}")
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

# Initialize services
stock_service = StockValuationService(supabase) if supabase else None
doc_generator = AccountingDocumentGenerator()

# ... keep existing journal routes below if needed or replace ...
# Removed redundant fallback routes that were causing AssertionError

# =====================================================
# DOCUMENT EXPORT ROUTES
# =====================================================

@accounting_bp.route('/reports/trial-balance/export/pdf', methods=['GET'])
def export_trial_balance_pdf():
    """Export Trial Balance as PDF"""
    try:
        branch_id = request.args.get('branch_id')
        as_of_date = request.args.get('as_of_date', datetime.now().strftime('%Y-%m-%d'))
        
        if supabase:
            service = ReportingService(supabase)
            data = service.get_trial_balance(branch_id)
            data['as_of_date'] = as_of_date
            
            # Get branch name
            if branch_id:
                branch_res = supabase.table('branches').select('name').eq('id', branch_id).single().execute()
                if branch_res.data:
                    data['branch_name'] = branch_res.data['name']
            
            pdf_bytes = doc_generator.generate_trial_balance_pdf(data)
            
            return send_file(
                io.BytesIO(pdf_bytes),
                mimetype='application/pdf',
                as_attachment=True,
                download_name=f'trial_balance_{as_of_date}.pdf'
            )
        return jsonify({'success': False, 'message': 'Service unavailable'}), 503
    except Exception as e:
        logger.error(f"Error exporting trial balance PDF: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@accounting_bp.route('/reports/p-and-l/export/pdf', methods=['GET'])
def export_profit_loss_pdf():
    """Export Profit & Loss Statement as PDF"""
    try:
        branch_id = request.args.get('branch_id', type=int)
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        if supabase:
            service = ReportingService(supabase)
            data = service.get_profit_and_loss(branch_id, start_date, end_date)
            data['start_date'] = start_date
            data['end_date'] = end_date
            
            # Get branch name
            if branch_id:
                branch_res = supabase.table('branches').select('name').eq('id', branch_id).single().execute()
                if branch_res.data:
                    data['branch_name'] = branch_res.data['name']
            
            pdf_bytes = doc_generator.generate_profit_loss_pdf(data)
            
            return send_file(
                io.BytesIO(pdf_bytes),
                mimetype='application/pdf',
                as_attachment=True,
                download_name=f'profit_loss_{start_date}_to_{end_date}.pdf'
            )
        return jsonify({'success': False, 'message': 'Service unavailable'}), 503
    except Exception as e:
        logger.error(f"Error exporting P&L PDF: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@accounting_bp.route('/reports/balance-sheet/export/pdf', methods=['GET'])
def export_balance_sheet_pdf():
    """Export Balance Sheet as PDF"""
    try:
        branch_id = request.args.get('branch_id', type=int)
        as_of_date = request.args.get('as_of_date', datetime.now().strftime('%Y-%m-%d'))
        
        if supabase:
            # Fetch balance sheet data
            assets_res = supabase.table('accounting_chart_of_accounts')\
                .select('account_code, account_name, category:accounting_account_categories(name)')\
                .eq('category.name', 'ASSETS')\
                .execute()
            
            liabilities_res = supabase.table('accounting_chart_of_accounts')\
                .select('account_code, account_name, category:accounting_account_categories(name)')\
                .eq('category.name', 'LIABILITIES')\
                .execute()
            
            equity_res = supabase.table('accounting_chart_of_accounts')\
                .select('account_code, account_name, category:accounting_account_categories(name)')\
                .eq('category.name', 'EQUITY')\
                .execute()
            
            data = {
                'as_of_date': as_of_date,
                'assets': assets_res.data or [],
                'liabilities': liabilities_res.data or [],
                'equity': equity_res.data or []
            }
            
            # Get branch name
            if branch_id:
                branch_res = supabase.table('branches').select('name').eq('id', branch_id).single().execute()
                if branch_res.data:
                    data['branch_name'] = branch_res.data['name']
            
            pdf_bytes = doc_generator.generate_balance_sheet_pdf(data)
            
            return send_file(
                io.BytesIO(pdf_bytes),
                mimetype='application/pdf',
                as_attachment=True,
                download_name=f'balance_sheet_{as_of_date}.pdf'
            )
        return jsonify({'success': False, 'message': 'Service unavailable'}), 503
    except Exception as e:
        logger.error(f"Error exporting balance sheet PDF: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@accounting_bp.route('/journal-entries/export/excel', methods=['GET'])
def export_journal_entries_excel():
    """Export Journal Entries as Excel"""
    try:
        branch_id = request.args.get('branch_id', type=int)
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        if supabase:
            query = supabase.table('accounting_journal_entries')\
                .select('*, items:accounting_journal_items(*, account:accounting_chart_of_accounts(*)), created_by:users(full_name)')
            
            if branch_id:
                query = query.eq('branch_id', branch_id)
            if start_date:
                query = query.gte('entry_date', start_date)
            if end_date:
                query = query.lte('entry_date', end_date)
            
            res = query.order('entry_date', desc=True).execute()
            
            excel_bytes = doc_generator.generate_journal_entries_excel(res.data or [])
            
            return send_file(
                io.BytesIO(excel_bytes),
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                as_attachment=True,
                download_name=f'journal_entries_{start_date}_to_{end_date}.xlsx'
            )
        return jsonify({'success': False, 'message': 'Service unavailable'}), 503
    except Exception as e:
        logger.error(f"Error exporting journal entries Excel: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@accounting_bp.route('/stock-counts/export/pdf', methods=['GET'])
def export_stock_count_pdf():
    """Export Stock Count Report as PDF"""
    try:
        count_id = request.args.get('count_id')
        
        if not count_id:
            return jsonify({'success': False, 'message': 'count_id required'}), 400
        
        if supabase:
            # Fetch stock count data
            count_res = supabase.table('stock_counts')\
                .select('*, items:stock_count_items(*, item:store_items(*)), branch:branches(*), counted_by:staff_profiles(*)')\
                .eq('id', count_id)\
                .single()\
                .execute()
            
            if not count_res.data:
                return jsonify({'success': False, 'message': 'Stock count not found'}), 404
            
            # Generate PDF using branded_pdf_generator
            from reports.branded_pdf_generator import generate_stock_count_report
            pdf_bytes = generate_stock_count_report(count_res.data)
            
            return send_file(
                io.BytesIO(pdf_bytes),
                mimetype='application/pdf',
                as_attachment=True,
                download_name=f'stock_count_{count_id}.pdf'
            )
        return jsonify({'success': False, 'message': 'Service unavailable'}), 503
    except Exception as e:
        logger.error(f"Error exporting stock count PDF: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@accounting_bp.route('/suppliers/statement/export/pdf', methods=['GET'])
def export_supplier_statement_pdf():
    """Export Supplier Statement as PDF"""
    try:
        supplier_id = request.args.get('supplier_id')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        if not supplier_id:
            return jsonify({'success': False, 'message': 'Supplier ID is required'}), 400

        if not supabase:
             return jsonify({'success': False, 'message': 'Service unavailable'}), 503

        # 1. Fetch Supplier Details
        try:
            supplier_res = supabase.table('store_suppliers').select('*').eq('id', supplier_id).maybe_single().execute()
            if not supplier_res.data:
                return jsonify({'success': False, 'message': 'Supplier not found'}), 404
            supplier = supplier_res.data
        except Exception as e:
            logger.error(f"Error fetching supplier {supplier_id}: {e}")
            return jsonify({'success': False, 'message': f"Error fetching supplier details: {str(e)}"}), 500
        
        # Format Address
        addr_parts = [supplier.get('address_line1'), supplier.get('address_line2'), supplier.get('city')]
        supplier['address'] = ", ".join([p for p in addr_parts if p])

        # 2. Calculate Opening Balance (Transactions < start_date)
        opening_balance = 0
        try:
            if start_date:
                opening_res = supabase.table('store_supplier_ledger')\
                    .select('debit_amount, credit_amount')\
                    .eq('supplier_id', supplier_id)\
                    .lt('transaction_date', start_date)\
                    .execute()
                
                for entry in opening_res.data or []:
                    opening_balance += (float(entry.get('credit_amount') or 0) - float(entry.get('debit_amount') or 0))
        except Exception as e:
            logger.warning(f"Error calculating opening balance for supplier {supplier_id}: {e}")
            # Continue with 0 balance if opening fails

        # 3. Fetch Transactions in Period
        try:
            query = supabase.table('store_supplier_ledger')\
                .select('*')\
                .eq('supplier_id', supplier_id)\
                .order('transaction_date', desc=False)
                
            if start_date: query = query.gte('transaction_date', start_date)
            if end_date: query = query.lte('transaction_date', end_date)
            
            trans_res = query.execute()
            transactions = trans_res.data or []
        except Exception as e:
            logger.error(f"Error fetching ledger transactions for supplier {supplier_id}: {e}")
            transactions = []

        # Calculate entries totals for summary
        total_invoiced = sum(float(t.get('credit_amount') or 0) for t in transactions if t.get('transaction_type') == 'invoice')
        total_paid = sum(float(t.get('debit_amount') or 0) for t in transactions if t.get('transaction_type') == 'payment')

        # Recalculate running balances for display starting from opening balance
        running_bal = opening_balance
        for t in transactions:
            credit = float(t.get('credit_amount') or 0)
            debit = float(t.get('debit_amount') or 0)
            running_bal += (credit - debit)
            t['running_balance'] = running_bal

        closing_balance = running_bal

        # 4. Fetch Current Aging (Real-time from balances table)
        aging = {
            'current_amount': 0, 'days_30_amount': 0, 'days_60_amount': 0, 'days_90_plus_amount': 0
        }
        try:
            aging_res = supabase.table('store_supplier_balances')\
                .select('*')\
                .eq('supplier_id', supplier_id)\
                .maybe_single()\
                .execute()
            
            if aging_res.data:
                aging = aging_res.data
        except Exception as e:
            logger.warning(f"Error fetching aging for supplier {supplier_id}: {e}")

        # Prepare Data for PDF
        pdf_data = {
            'supplier': supplier,
            'start_date': start_date or 'Beginning',
            'end_date': end_date or datetime.now().strftime('%Y-%m-%d'),
            'opening_balance': opening_balance,
            'transactions': transactions,
            'closing_balance': closing_balance,
            'total_invoiced': total_invoiced,
            'total_paid': total_paid,
            'aging': aging
        }

        pdf_bytes = doc_generator.generate_supplier_statement_pdf(pdf_data)

        filename = f'statement_{supplier.get("supplier_code", "SUP")}_{end_date or datetime.now().strftime("%Y-%m-%d")}.pdf'
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )

    except Exception as e:
        logger.error(f"Error exporting supplier statement PDF: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@accounting_bp.route('/purchase-orders/<id>/export/pdf', methods=['GET'])
def export_po_pdf(id):
    """Export Purchase Order as PDF"""
    try:
        if not supabase:
             return jsonify({'success': False, 'message': 'Service unavailable'}), 503

        # Fetch PO with relations. Assuming 'store_purchase_order_items' linked via 'purchase_order_id' (implicit or explicit)
        # Note: 'items:store_purchase_order_items(...)' syntax relies on foreign key naming. 
        # If 'store_purchase_order_items' has 'po_id' or 'purchase_order_id', Supabase detects it.
        # We need to be careful about the foreign key name. Assuming standard 'purchase_order_id'.
        
        po_res = supabase.table('store_purchase_orders')\
            .select('*, supplier:store_suppliers(*), items:store_purchase_order_items(*, item:store_items(name, unit))')\
            .eq('id', id)\
            .single()\
            .execute()
        
        if not po_res.data:
            return jsonify({'success': False, 'message': 'PO not found'}), 404
            
        po_data = po_res.data
        
        # Flatten item structure
        flat_items = []
        for i in po_data.get('items', []):
             item_details = i.get('item') or {}
             flat_item = {
                 'name': item_details.get('name', 'Unknown Item'),
                 'unit': item_details.get('unit', 'Unit'),
                 'quantity': i.get('quantity', 0),
                 'unit_price': i.get('unit_price', 0),
                 'total_amount': i.get('total_amount', 0)
             }
             flat_items.append(flat_item)
        po_data['items'] = flat_items
        
        # Map user info if available (created_by_id)
        # We can optionally fetch user name, but 'System' default is fine for MVP.
        
        pdf_bytes = doc_generator.generate_purchase_order_pdf(po_data)
        
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f"PO_{po_data.get('po_number', 'draft')}.pdf"
        )
    except Exception as e:
        logger.error(f"Error exporting PO PDF: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@accounting_bp.route('/event-orders/<id>/export/pdf', methods=['GET'])
def export_event_order_pdf(id):
    """Export Event Order as a customer-facing PDF."""
    try:
        if not supabase:
            return jsonify({'success': False, 'message': 'Service unavailable'}), 503

        res = supabase.table('event_orders') \
            .select('*, conference_halls(name)') \
            .eq('id', id) \
            .single() \
            .execute()

        if not res.data:
            return jsonify({'success': False, 'message': 'Event order not found'}), 404

        eo = res.data

        # Resolve branch details
        branch_name = 'FamousGate Hotels'
        branch_address = 'FamousGate Hotels'
        branch_phone = '+254 706 782 828'
        branch_email = 'info@famousgatehotels.com'
        if eo.get('branch_id'):
            branch_res = supabase.table('branches') \
                .select('name, address, location, phone, email') \
                .eq('id', eo['branch_id']) \
                .maybeSingle() \
                .execute()
            if branch_res.data:
                branch_name = branch_res.data.get('name', branch_name)
                branch_address = branch_res.data.get('address') or branch_res.data.get('location') or branch_address
                branch_phone = branch_res.data.get('phone') or branch_phone
                branch_email = branch_res.data.get('email') or branch_email

        event_type = str(eo.get('event_type') or '').strip().lower()
        channel_map = {
            'conference': 'conference_event',
            'buffet': 'buffet',
            'outside_catering': 'outside_catering',
            'group_meal': 'group_meal',
        }
        channel_code = channel_map.get(event_type, 'pos_restaurant')
        package_definition_id = str(eo.get('package_definition_id') or '').strip()
        menu_package = str(eo.get('menu_package') or '').strip()
        pax = max(int(float(eo.get('pax') or 0)), 0)
        charge_per_pax = float(eo.get('charge_per_pax') or 0)
        total_amount = float(eo.get('total_amount') or 0)
        package_total = (charge_per_pax * pax) if pax > 0 else total_amount
        remainder = total_amount - package_total

        package_query = supabase.table('channel_package_menu_items') \
            .select('pos_item_name, pos_item_sku, quantity_per_pax, unit, package_name, package_definition_id') \
            .eq('branch_id', eo.get('branch_id')) \
            .eq('channel', channel_code)
        if package_definition_id:
            package_query = package_query.eq('package_definition_id', package_definition_id)
        elif menu_package:
            package_query = package_query.eq('package_name', menu_package)
        package_query = package_query.order('pos_item_name')
        package_res = package_query.execute()
        package_rows = package_res.data or []

        pricing_items = []
        if pax > 0 or charge_per_pax > 0 or total_amount > 0:
            pricing_items.append({
                'description': menu_package or f'{event_type.title()} package',
                'unit': 'pax',
                'quantity': pax or 1,
                'unit_price': charge_per_pax or total_amount,
                'total': package_total or total_amount,
            })
        if abs(remainder) > 0.01:
            pricing_items.append({
                'description': 'Additional Charges' if remainder > 0 else 'Package Discount / Adjustment',
                'unit': 'lot',
                'quantity': 1,
                'unit_price': remainder,
                'total': remainder,
            })

        payload = dict(eo)
        payload['branch_name'] = branch_name
        payload['branch_address'] = branch_address
        payload['branch_phone'] = branch_phone
        payload['branch_email'] = branch_email
        payload['menu_lines'] = [
            {
                'description': row.get('pos_item_name') or row.get('pos_item_sku') or 'Menu item',
                'sku': row.get('pos_item_sku'),
                'unit': row.get('unit') or 'pcs',
                'quantity_per_pax': float(row.get('quantity_per_pax') or 0),
                'planned_total': float(row.get('quantity_per_pax') or 0) * pax,
            }
            for row in package_rows
        ]
        payload['items'] = pricing_items

        pdf_bytes = doc_generator.generate_event_order_pdf_v2(payload)

        safe_number = (eo.get('event_number') or 'EO').replace('/', '-')
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f"{safe_number}.pdf"
        )
    except Exception as e:
        logger.error(f"Error exporting event order PDF: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@accounting_bp.route('/event-orders/render/pdf', methods=['POST'])
def render_event_order_pdf():
    """Render an Event Order PDF from an already-resolved payload."""
    try:
        payload = request.get_json(silent=True) or {}
        pdf_bytes = doc_generator.generate_event_order_pdf_v2(payload)

        safe_number = str(payload.get('event_number') or 'EO').replace('/', '-')
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f"{safe_number}.pdf"
        )
    except Exception as e:
        logger.error(f"Error rendering event order PDF: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
