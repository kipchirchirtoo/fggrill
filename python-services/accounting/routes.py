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

logger = logging.getLogger(__name__)

# In-memory storage for demo (replace with database in production)
journal_entries = {}
review_queue = {}
audit_trail = []
reconciliations = []
workpapers = []

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

# Journal Entry Routes
@accounting_bp.route('/journal-entries', methods=['GET'])
def get_journal_entries():
    """Get all journal entries with optional filters"""
    try:
        status = request.args.get('status')
        department = request.args.get('department')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        branch_id = request.args.get('branch_id')
        
        filtered_entries = list(journal_entries.values())
        
        # Apply filters
        if status:
            filtered_entries = [e for e in filtered_entries if e['status'] == status]
        
        if department:
            filtered_entries = [e for e in filtered_entries if e['department'] == department]
        
        if start_date:
            filtered_entries = [e for e in filtered_entries if e['date'] >= start_date]
        
        if end_date:
            filtered_entries = [e for e in filtered_entries if e['date'] <= end_date]
        
        if branch_id:
            filtered_entries = [e for e in filtered_entries if str(e.get('branch_id')) == branch_id]
        
        # Sort by date descending
        filtered_entries.sort(key=lambda x: x['date'], reverse=True)
        
        return jsonify({
            'success': True,
            'data': filtered_entries,
            'total': len(filtered_entries)
        })
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
        
        # Create entry
        entry_id = str(uuid.uuid4())
        entry = {
            'id': entry_id,
            'date': entry_data['date'],
            'reference': entry_data['reference'],
            'description': entry_data['description'],
            'debit_account': entry_data['debit_account'],
            'credit_account': entry_data['credit_account'],
            'amount': entry_data['amount'],
            'currency': entry_data.get('currency', 'KES'),
            'status': 'draft',
            'created_by': entry_data.get('created_by', 'System'),
            'created_at': datetime.now().isoformat(),
            'department': entry_data['department'],
            'category': entry_data['category'],
            'tax_code': entry_data.get('tax_code'),
            'project_code': entry_data.get('project_code'),
            'branch_id': entry_data.get('branch_id'),
            'attachments': entry_data.get('attachments', [])
        }
        
        journal_entries[entry_id] = entry
        
        # Log creation
        log_audit_action(entry_id, 'CREATED', entry['created_by'], f"Created journal entry: {entry['reference']}")
        
        return jsonify({
            'success': True,
            'data': entry,
            'message': 'Journal entry created successfully'
        })
    except Exception as e:
        logger.error(f"Error creating journal entry: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@accounting_bp.route('/journal-entries/<entry_id>', methods=['PUT'])
def update_journal_entry(entry_id):
    """Update an existing journal entry"""
    try:
        if entry_id not in journal_entries:
            return jsonify({'success': False, 'error': 'Entry not found'}), 404
        
        entry = journal_entries[entry_id]
        if entry['status'] not in ['draft', 'rejected']:
            return jsonify({'success': False, 'error': 'Cannot update posted or approved entries'}), 400
        
        update_data = request.get_json()
        
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
