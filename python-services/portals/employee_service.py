"""
Employee Portal Python Microservice
Advanced functionalities for employee self-service portal
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta, date
import os
from supabase import create_client, Client
import logging

logger = logging.getLogger(__name__)

employee_portal_bp = Blueprint('employee_portal', __name__, url_prefix='/api/employee-portal')

# Initialize Supabase client
def get_supabase() -> Client:
    url = os.getenv('SUPABASE_URL') or os.getenv('SUPABASE_PROJECT_URL')
    key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        raise ValueError("Supabase credentials not configured")
    return create_client(url, key)


# =====================================================
# EMPLOYEE DASHBOARD & ANALYTICS
# =====================================================

@employee_portal_bp.route('/analytics/summary', methods=['GET'])
def get_employee_analytics():
    """Get employee performance analytics summary"""
    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'error': 'user_id required'}), 400
        
        supabase = get_supabase()
        
        # Get current month stats
        now = datetime.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Get time clock data for the month
        time_data = supabase.table('employee_time_clock').select('*').eq(
            'user_id', user_id
        ).gte('clock_in', month_start.isoformat()).execute()
        
        # Calculate hours worked
        total_hours = 0
        total_days = 0
        for record in time_data.data or []:
            if record.get('clock_out'):
                clock_in = datetime.fromisoformat(record['clock_in'].replace('Z', '+00:00'))
                clock_out = datetime.fromisoformat(record['clock_out'].replace('Z', '+00:00'))
                hours = (clock_out - clock_in).total_seconds() / 3600
                hours -= (record.get('break_minutes', 0) / 60)
                total_hours += max(0, hours)
                total_days += 1
        
        # Get tasks completed
        tasks_data = supabase.table('employee_tasks').select('*').eq(
            'user_id', user_id
        ).eq('status', 'completed').gte(
            'completed_at', month_start.isoformat()
        ).execute()
        
        tasks_completed = len(tasks_data.data or [])
        
        # Get pending tasks
        pending_tasks = supabase.table('employee_tasks').select('*').eq(
            'user_id', user_id
        ).in_('status', ['pending', 'in_progress']).execute()
        
        # Get training progress
        training_data = supabase.table('employee_training').select('*').eq(
            'user_id', user_id
        ).execute()
        
        total_training = len(training_data.data or [])
        completed_training = len([t for t in (training_data.data or []) if t.get('status') == 'completed'])
        
        # Calculate attendance rate (assuming 22 working days per month)
        working_days_passed = min(now.day, 22)
        attendance_rate = round((total_days / working_days_passed) * 100, 1) if working_days_passed > 0 else 0
        
        return jsonify({
            'success': True,
            'data': {
                'hoursWorkedThisMonth': round(total_hours, 1),
                'daysWorkedThisMonth': total_days,
                'averageHoursPerDay': round(total_hours / total_days, 1) if total_days > 0 else 0,
                'tasksCompletedThisMonth': tasks_completed,
                'pendingTasks': len(pending_tasks.data or []),
                'attendanceRate': min(attendance_rate, 100),
                'trainingProgress': {
                    'completed': completed_training,
                    'total': total_training,
                    'percentage': round((completed_training / total_training) * 100) if total_training > 0 else 0
                },
                'month': now.strftime('%B %Y')
            }
        })
    except Exception as e:
        logger.error(f"Error getting employee analytics: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@employee_portal_bp.route('/performance/score', methods=['GET'])
def get_performance_score():
    """Calculate employee performance score based on multiple factors"""
    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'error': 'user_id required'}), 400
        
        supabase = get_supabase()
        now = datetime.now()
        month_start = now.replace(day=1)
        
        scores = {
            'attendance': 0,
            'punctuality': 0,
            'taskCompletion': 0,
            'training': 0
        }
        
        # Attendance score (max 25)
        time_data = supabase.table('employee_time_clock').select('*').eq(
            'user_id', user_id
        ).gte('clock_in', month_start.isoformat()).execute()
        
        days_worked = len(time_data.data or [])
        expected_days = min(now.day, 22)
        scores['attendance'] = min(25, round((days_worked / expected_days) * 25)) if expected_days > 0 else 0
        
        # Punctuality score (max 25) - based on clock-in times
        late_count = 0
        for record in time_data.data or []:
            clock_in = datetime.fromisoformat(record['clock_in'].replace('Z', '+00:00'))
            # Assuming 8 AM is the expected start time
            if clock_in.hour > 8 or (clock_in.hour == 8 and clock_in.minute > 15):
                late_count += 1
        
        on_time_rate = ((days_worked - late_count) / days_worked) if days_worked > 0 else 1
        scores['punctuality'] = round(on_time_rate * 25)
        
        # Task completion score (max 25)
        all_tasks = supabase.table('employee_tasks').select('*').eq(
            'user_id', user_id
        ).gte('created_at', month_start.isoformat()).execute()
        
        completed_tasks = len([t for t in (all_tasks.data or []) if t.get('status') == 'completed'])
        total_tasks = len(all_tasks.data or [])
        scores['taskCompletion'] = round((completed_tasks / total_tasks) * 25) if total_tasks > 0 else 25
        
        # Training score (max 25)
        training = supabase.table('employee_training').select('*').eq('user_id', user_id).execute()
        completed_training = len([t for t in (training.data or []) if t.get('status') == 'completed'])
        total_training = len(training.data or [])
        scores['training'] = round((completed_training / total_training) * 25) if total_training > 0 else 25
        
        total_score = sum(scores.values())
        
        # Determine rating
        if total_score >= 90:
            rating = 'Excellent'
        elif total_score >= 75:
            rating = 'Good'
        elif total_score >= 60:
            rating = 'Satisfactory'
        else:
            rating = 'Needs Improvement'
        
        return jsonify({
            'success': True,
            'data': {
                'totalScore': total_score,
                'maxScore': 100,
                'rating': rating,
                'breakdown': scores,
                'period': now.strftime('%B %Y')
            }
        })
    except Exception as e:
        logger.error(f"Error calculating performance score: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# =====================================================
# TIME CLOCK MANAGEMENT
# =====================================================

@employee_portal_bp.route('/clock/status', methods=['GET'])
def get_clock_status():
    """Get current clock status for employee"""
    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'error': 'user_id required'}), 400
        
        supabase = get_supabase()
        today = date.today().isoformat()
        
        # Get today's clock record
        result = supabase.table('employee_time_clock').select('*').eq(
            'user_id', user_id
        ).gte('clock_in', today).is_('clock_out', 'null').order(
            'clock_in', desc=True
        ).limit(1).execute()
        
        if result.data and len(result.data) > 0:
            record = result.data[0]
            clock_in = datetime.fromisoformat(record['clock_in'].replace('Z', '+00:00'))
            elapsed = datetime.now(clock_in.tzinfo) - clock_in
            
            return jsonify({
                'success': True,
                'data': {
                    'isClockedIn': True,
                    'clockInTime': record['clock_in'],
                    'elapsedMinutes': int(elapsed.total_seconds() / 60),
                    'recordId': record['id']
                }
            })
        
        return jsonify({
            'success': True,
            'data': {
                'isClockedIn': False,
                'clockInTime': None,
                'elapsedMinutes': 0,
                'recordId': None
            }
        })
    except Exception as e:
        logger.error(f"Error getting clock status: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@employee_portal_bp.route('/clock/in', methods=['POST'])
def clock_in():
    """Clock in for the day"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        branch_id = data.get('branch_id')
        notes = data.get('notes', '')
        
        if not user_id:
            return jsonify({'success': False, 'error': 'user_id required'}), 400
        
        supabase = get_supabase()
        today = date.today().isoformat()
        
        # Check if already clocked in
        existing = supabase.table('employee_time_clock').select('id').eq(
            'user_id', user_id
        ).gte('clock_in', today).is_('clock_out', 'null').execute()
        
        if existing.data and len(existing.data) > 0:
            return jsonify({'success': False, 'error': 'Already clocked in today'}), 400
        
        # Create clock in record
        result = supabase.table('employee_time_clock').insert({
            'user_id': user_id,
            'branch_id': branch_id,
            'clock_in': datetime.now().isoformat(),
            'notes': notes,
            'status': 'active'
        }).execute()
        
        return jsonify({
            'success': True,
            'data': result.data[0] if result.data else None,
            'message': 'Clocked in successfully'
        })
    except Exception as e:
        logger.error(f"Error clocking in: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@employee_portal_bp.route('/clock/out', methods=['POST'])
def clock_out():
    """Clock out for the day"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        break_minutes = data.get('break_minutes', 0)
        notes = data.get('notes', '')
        
        if not user_id:
            return jsonify({'success': False, 'error': 'user_id required'}), 400
        
        supabase = get_supabase()
        today = date.today().isoformat()
        
        # Find active clock record
        existing = supabase.table('employee_time_clock').select('*').eq(
            'user_id', user_id
        ).gte('clock_in', today).is_('clock_out', 'null').execute()
        
        if not existing.data or len(existing.data) == 0:
            return jsonify({'success': False, 'error': 'No active clock-in found'}), 400
        
        record = existing.data[0]
        clock_out_time = datetime.now()
        clock_in_time = datetime.fromisoformat(record['clock_in'].replace('Z', '+00:00'))
        
        # Calculate hours worked
        total_minutes = (clock_out_time - clock_in_time.replace(tzinfo=None)).total_seconds() / 60
        hours_worked = (total_minutes - break_minutes) / 60
        
        # Update record
        result = supabase.table('employee_time_clock').update({
            'clock_out': clock_out_time.isoformat(),
            'break_minutes': break_minutes,
            'notes': f"{record.get('notes', '')} | Clock out: {notes}".strip(' |'),
            'status': 'completed',
            'updated_at': datetime.now().isoformat()
        }).eq('id', record['id']).execute()
        
        return jsonify({
            'success': True,
            'data': {
                'hoursWorked': round(hours_worked, 2),
                'clockIn': record['clock_in'],
                'clockOut': clock_out_time.isoformat(),
                'breakMinutes': break_minutes
            },
            'message': f'Clocked out successfully. Hours worked: {round(hours_worked, 2)}'
        })
    except Exception as e:
        logger.error(f"Error clocking out: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@employee_portal_bp.route('/timesheet', methods=['GET'])
def get_timesheet():
    """Get employee timesheet for a period"""
    try:
        user_id = request.args.get('user_id')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        if not user_id:
            return jsonify({'success': False, 'error': 'user_id required'}), 400
        
        supabase = get_supabase()
        
        # Default to current month
        if not start_date:
            now = datetime.now()
            start_date = now.replace(day=1).strftime('%Y-%m-%d')
        if not end_date:
            end_date = datetime.now().strftime('%Y-%m-%d')
        
        result = supabase.table('employee_time_clock').select('*').eq(
            'user_id', user_id
        ).gte('clock_in', start_date).lte('clock_in', end_date).order(
            'clock_in', desc=True
        ).execute()
        
        # Calculate totals
        total_hours = 0
        total_days = 0
        records = []
        
        for record in result.data or []:
            if record.get('clock_out'):
                clock_in = datetime.fromisoformat(record['clock_in'].replace('Z', '+00:00'))
                clock_out = datetime.fromisoformat(record['clock_out'].replace('Z', '+00:00'))
                hours = (clock_out - clock_in).total_seconds() / 3600
                hours -= (record.get('break_minutes', 0) / 60)
                total_hours += max(0, hours)
                total_days += 1
                record['hours_worked'] = round(hours, 2)
            else:
                record['hours_worked'] = None
            records.append(record)
        
        return jsonify({
            'success': True,
            'data': {
                'records': records,
                'summary': {
                    'totalHours': round(total_hours, 2),
                    'totalDays': total_days,
                    'averageHoursPerDay': round(total_hours / total_days, 2) if total_days > 0 else 0,
                    'period': f"{start_date} to {end_date}"
                }
            }
        })
    except Exception as e:
        logger.error(f"Error getting timesheet: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# =====================================================
# LEAVE MANAGEMENT
# =====================================================

@employee_portal_bp.route('/leave/balance', methods=['GET'])
def get_leave_balance():
    """Get employee leave balance"""
    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'error': 'user_id required'}), 400
        
        supabase = get_supabase()
        current_year = datetime.now().year
        
        # Get staff profile for leave entitlement
        profile = supabase.table('staff_profiles').select('*').eq('user_id', user_id).single().execute()
        
        # Default entitlements
        entitlements = {
            'annual': 21,
            'sick': 14,
            'personal': 5,
            'maternity': 90,
            'paternity': 14
        }
        
        # Get leaves taken this year
        leaves = supabase.table('staff_leave').select('*').eq(
            'staff_id', profile.data['id'] if profile.data else user_id
        ).eq('status', 'approved').gte(
            'start_date', f'{current_year}-01-01'
        ).execute()
        
        # Calculate days taken by type
        taken = {'annual': 0, 'sick': 0, 'personal': 0, 'maternity': 0, 'paternity': 0}
        
        for leave in leaves.data or []:
            leave_type = leave.get('leave_type', 'annual').lower()
            start = datetime.strptime(leave['start_date'], '%Y-%m-%d')
            end = datetime.strptime(leave['end_date'], '%Y-%m-%d')
            days = (end - start).days + 1
            if leave_type in taken:
                taken[leave_type] += days
        
        # Calculate balances
        balances = {}
        for leave_type, entitlement in entitlements.items():
            balances[leave_type] = {
                'entitlement': entitlement,
                'taken': taken.get(leave_type, 0),
                'remaining': entitlement - taken.get(leave_type, 0),
                'pending': 0  # TODO: Calculate pending requests
            }
        
        return jsonify({
            'success': True,
            'data': {
                'year': current_year,
                'balances': balances,
                'totalEntitlement': sum(e['entitlement'] for e in balances.values()),
                'totalTaken': sum(e['taken'] for e in balances.values()),
                'totalRemaining': sum(e['remaining'] for e in balances.values())
            }
        })
    except Exception as e:
        logger.error(f"Error getting leave balance: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@employee_portal_bp.route('/leave/request', methods=['POST'])
def submit_leave_request():
    """Submit a new leave request"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        leave_type = data.get('leave_type')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        reason = data.get('reason', '')
        
        if not all([user_id, leave_type, start_date, end_date]):
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400
        
        supabase = get_supabase()
        
        # Get staff profile
        profile = supabase.table('staff_profiles').select('id').eq('user_id', user_id).single().execute()
        
        if not profile.data:
            return jsonify({'success': False, 'error': 'Staff profile not found'}), 404
        
        # Calculate days
        start = datetime.strptime(start_date, '%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%d')
        days = (end - start).days + 1
        
        # Create leave request
        result = supabase.table('staff_leave').insert({
            'staff_id': profile.data['id'],
            'leave_type': leave_type,
            'start_date': start_date,
            'end_date': end_date,
            'reason': reason,
            'status': 'pending',
            'days_requested': days,
            'created_at': datetime.now().isoformat()
        }).execute()
        
        return jsonify({
            'success': True,
            'data': result.data[0] if result.data else None,
            'message': f'Leave request submitted for {days} days'
        })
    except Exception as e:
        logger.error(f"Error submitting leave request: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# =====================================================
# TASK MANAGEMENT
# =====================================================

@employee_portal_bp.route('/tasks', methods=['GET'])
def get_tasks():
    """Get employee tasks"""
    try:
        user_id = request.args.get('user_id')
        status = request.args.get('status')
        
        if not user_id:
            return jsonify({'success': False, 'error': 'user_id required'}), 400
        
        supabase = get_supabase()
        
        query = supabase.table('employee_tasks').select('*').eq('user_id', user_id)
        
        if status:
            query = query.eq('status', status)
        
        result = query.order('due_date', desc=False).execute()
        
        # Categorize tasks
        tasks = {
            'overdue': [],
            'today': [],
            'upcoming': [],
            'completed': []
        }
        
        today = date.today()
        
        for task in result.data or []:
            if task.get('status') == 'completed':
                tasks['completed'].append(task)
            elif task.get('due_date'):
                due = datetime.strptime(task['due_date'][:10], '%Y-%m-%d').date()
                if due < today:
                    tasks['overdue'].append(task)
                elif due == today:
                    tasks['today'].append(task)
                else:
                    tasks['upcoming'].append(task)
            else:
                tasks['upcoming'].append(task)
        
        return jsonify({
            'success': True,
            'data': {
                'tasks': tasks,
                'counts': {k: len(v) for k, v in tasks.items()}
            }
        })
    except Exception as e:
        logger.error(f"Error getting tasks: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@employee_portal_bp.route('/tasks/<task_id>/update', methods=['PUT'])
def update_task_status(task_id):
    """Update task status"""
    try:
        data = request.get_json()
        status = data.get('status')
        notes = data.get('notes', '')
        
        if not status:
            return jsonify({'success': False, 'error': 'status required'}), 400
        
        supabase = get_supabase()
        
        update_data = {
            'status': status,
            'notes': notes,
            'updated_at': datetime.now().isoformat()
        }
        
        if status == 'completed':
            update_data['completed_at'] = datetime.now().isoformat()
        
        result = supabase.table('employee_tasks').update(update_data).eq('id', task_id).execute()
        
        return jsonify({
            'success': True,
            'data': result.data[0] if result.data else None,
            'message': f'Task marked as {status}'
        })
    except Exception as e:
        logger.error(f"Error updating task: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# =====================================================
# PAYSLIP GENERATION
# =====================================================

@employee_portal_bp.route('/payslip/generate', methods=['POST'])
def generate_payslip():
    """Generate payslip PDF for employee"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        month = data.get('month')
        year = data.get('year')
        
        if not all([user_id, month, year]):
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400
        
        supabase = get_supabase()
        
        # Get employee details
        user = supabase.table('users').select('*').eq('id', user_id).single().execute()
        profile = supabase.table('staff_profiles').select('*').eq('user_id', user_id).single().execute()
        
        if not user.data or not profile.data:
            return jsonify({'success': False, 'error': 'Employee not found'}), 404
        
        # Get time records for the month
        month_start = f"{year}-{month:02d}-01"
        if month == 12:
            month_end = f"{year + 1}-01-01"
        else:
            month_end = f"{year}-{month + 1:02d}-01"
        
        time_records = supabase.table('employee_time_clock').select('*').eq(
            'user_id', user_id
        ).gte('clock_in', month_start).lt('clock_in', month_end).execute()
        
        # Calculate hours worked
        total_hours = 0
        for record in time_records.data or []:
            if record.get('clock_out'):
                clock_in = datetime.fromisoformat(record['clock_in'].replace('Z', '+00:00'))
                clock_out = datetime.fromisoformat(record['clock_out'].replace('Z', '+00:00'))
                hours = (clock_out - clock_in).total_seconds() / 3600
                hours -= (record.get('break_minutes', 0) / 60)
                total_hours += max(0, hours)
        
        # Calculate salary components
        base_salary = float(profile.data.get('salary', 0))
        hourly_rate = base_salary / 176  # Assuming 176 hours per month
        
        # Earnings
        basic_pay = base_salary
        overtime_hours = max(0, total_hours - 176)
        overtime_pay = overtime_hours * hourly_rate * 1.5
        
        # Deductions (Kenya statutory)
        gross_salary = basic_pay + overtime_pay
        nhif = min(1700, gross_salary * 0.0275)  # NHIF contribution
        nssf = min(2160, gross_salary * 0.06)  # NSSF Tier I & II
        
        # PAYE calculation (simplified)
        taxable_income = gross_salary - nssf
        if taxable_income <= 24000:
            paye = taxable_income * 0.10
        elif taxable_income <= 32333:
            paye = 2400 + (taxable_income - 24000) * 0.25
        else:
            paye = 2400 + 2083 + (taxable_income - 32333) * 0.30
        
        # Personal relief
        paye = max(0, paye - 2400)
        
        total_deductions = nhif + nssf + paye
        net_salary = gross_salary - total_deductions
        
        payslip_data = {
            'employee': {
                'name': f"{user.data.get('first_name', '')} {user.data.get('last_name', '')}",
                'email': user.data.get('email'),
                'department': profile.data.get('department'),
                'position': profile.data.get('role'),
                'employeeId': profile.data.get('id_number')
            },
            'period': {
                'month': month,
                'year': year,
                'monthName': datetime(year, month, 1).strftime('%B')
            },
            'attendance': {
                'hoursWorked': round(total_hours, 2),
                'regularHours': min(total_hours, 176),
                'overtimeHours': round(overtime_hours, 2),
                'daysWorked': len(time_records.data or [])
            },
            'earnings': {
                'basicPay': round(basic_pay, 2),
                'overtimePay': round(overtime_pay, 2),
                'grossSalary': round(gross_salary, 2)
            },
            'deductions': {
                'paye': round(paye, 2),
                'nhif': round(nhif, 2),
                'nssf': round(nssf, 2),
                'totalDeductions': round(total_deductions, 2)
            },
            'netSalary': round(net_salary, 2),
            'generatedAt': datetime.now().isoformat()
        }
        
        return jsonify({
            'success': True,
            'data': payslip_data
        })
    except Exception as e:
        logger.error(f"Error generating payslip: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
