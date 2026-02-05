from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
from dotenv import load_dotenv

# Load environment variables FIRST before any other imports that need them
load_dotenv()

# Apply MD5 fix for ReportLab compatibility BEFORE importing ReportLab
import md5_fix

import logging
from datetime import datetime, timedelta
import pandas as pd
from reports.pdf_generator import PDFReportGenerator
from reports.excel_generator import ExcelReportGenerator
from reports.data_fetcher import DataFetcher
from reports.branded_pdf_generator import BrandedPDFGenerator
from reports.database_fetcher import DatabaseFetcher
from reports.kpi_dashboard_generator import KPIDashboardGenerator
from reports.kpi_fetcher import add_kpi_dashboard_method

# Initialize KPI dashboard functionality
add_kpi_dashboard_method()
from report_scheduler import ReportScheduler, SchedulerDaemon
from receipts.routes import receipts_bp
from finance.routes import finance_bp
from accounting.routes import accounting_bp, audit_bp
from restaurant_inventory.routes import restaurant_inventory_bp
from budget_analytics import BudgetAnalytics
from portals.employee_service import employee_portal_bp
from portals.guest_service import guest_portal_bp

# Import new consolidated blueprints
from email_automation.routes import email_automation_bp, start_email_scheduler
from template_generator.routes import template_generator_bp
from barcode_generator.routes import barcode_generator_bp
from analytics.routes import analytics_bp
from pricing_engine.routes import pricing_bp
from communication_hub.routes import communication_bp
from room_service.routes import room_bp
from attendance.routes import attendance_bp
from id_cards.routes import id_cards_bp
from reports.auditor_reports import auditor_reports_bp


app = Flask(__name__)
CORS(app, origins=[
    'http://localhost:3000', 
    'http://localhost:3001', 
    'https://famousgate.hirall.com',
    'https://api.hirall.com',
    '*'
])

# Register existing blueprints
app.register_blueprint(receipts_bp)
app.register_blueprint(finance_bp)
app.register_blueprint(accounting_bp)
app.register_blueprint(audit_bp)
app.register_blueprint(restaurant_inventory_bp)
app.register_blueprint(employee_portal_bp)
app.register_blueprint(guest_portal_bp)

# Register new consolidated blueprints
app.register_blueprint(email_automation_bp)
app.register_blueprint(template_generator_bp)
app.register_blueprint(barcode_generator_bp)
app.register_blueprint(analytics_bp, url_prefix='/api/analytics')
app.register_blueprint(pricing_bp, url_prefix='/api/pricing')
app.register_blueprint(communication_bp, url_prefix='/api/communications')
app.register_blueprint(room_bp, url_prefix='/api/rooms')
app.register_blueprint(attendance_bp, url_prefix='/api/attendance')
app.register_blueprint(id_cards_bp)
app.register_blueprint(auditor_reports_bp)


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize services
pdf_generator = PDFReportGenerator()
excel_generator = ExcelReportGenerator()
data_fetcher = DataFetcher()
budget_analytics = BudgetAnalytics()

# Initialize branded report generators
branded_pdf_generator = BrandedPDFGenerator()
database_fetcher = DatabaseFetcher()
report_scheduler = ReportScheduler()

# Start scheduler daemon in background
scheduler_daemon = SchedulerDaemon()
scheduler_thread = None

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'OK',
        'service': 'Famous Gate Restaurant - Management Services',
        'version': '2.0.0',
        'features': ['branded_reports', 'automated_scheduling', 'real_database'],
        'timestamp': datetime.now().isoformat()
    }), 200


@app.route('/api/reports/generate/branded-pdf', methods=['POST'])
def generate_branded_pdf_report():
    """Generate branded PDF report with FG styling"""
    try:
        data = request.get_json()
        report_type = data.get('reportType')
        filters = data.get('filters', {})
        use_real_data = data.get('useRealData', True)
        passed_data = data.get('data')  # Data passed directly from frontend
        
        logger.info(f"Generating branded PDF report: {report_type} with filters: {filters}")
        
        # Use passed data if available and useRealData is false
        if passed_data and not use_real_data:
            report_data = passed_data
        elif use_real_data:
            report_data = database_fetcher.fetch_report_data(report_type, filters)
        else:
            report_data = data_fetcher.fetch_report_data(report_type, filters)
        
        # Ensure report_data is at least an empty dict
        if report_data is None:
            report_data = {}

        logger.info(f"Report data generated: {report_data}")
        
        # Check for error in report_data
        if isinstance(report_data, dict) and report_data.get('error'):
            logger.error(f"Error in fetched data: {report_data.get('error')}")
            # We still proceed to generator, but it should handle empty data gracefully
        
        # Generate branded PDF
        pdf_file = branded_pdf_generator.generate_report(report_type, report_data, filters)
        
        return send_file(
            pdf_file,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'FG_{report_type}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf'
        )
    except Exception as e:
        logger.error(f"Error generating branded PDF report: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Initialize Anomaly Detector
from finance.anomaly_detector import PaymentAnomalyDetector
anomaly_detector = PaymentAnomalyDetector()

@app.route('/api/finance/verify-anomaly', methods=['POST'])
def verify_payment_anomaly():
    """Analyze payment for anomalies using ML"""
    try:
        data = request.get_json()
        logger.info(f"Analyzing payment anomaly for amount: {data.get('amount')}")
        
        result = anomaly_detector.detect_anomaly(data)
        
        return jsonify({
            'success': True,
            'data': result
        })
    except Exception as e:
        logger.error(f"Error analyzing payment anomaly: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/reports/generate/checkout-bill', methods=['POST'])
def generate_checkout_bill():
    """Generate Guest Checkout Bill PDF"""
    try:
        data = request.get_json()
        logger.info(f"Generating checkout bill for guest: {data.get('guest_name')}")
        
        # Generate PDF
        pdf_file = branded_pdf_generator.generate_checkout_bill(data)
        
        return send_file(
            pdf_file,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'Bill_{data.get("guest_name", "Guest").replace(" ", "_")}.pdf'
        )
    except Exception as e:
        logger.error(f"Error generating checkout bill: {str(e)}")
        return jsonify({'error': str(e)}), 500
@app.route('/api/reports/generate/dispatch-note', methods=['POST'])
def generate_dispatch_note():
    """Generate Dispatch Note PDF"""
    try:
        data = request.get_json()
        logger.info(f"Generating dispatch note: {data.get('dispatch_number')}")
        logger.info(f"Dispatch data keys: {list(data.keys())}")
        logger.info(f"Vehicle info: {data.get('vehicle_registration')} / {data.get('vehicle')}")
        logger.info(f"Driver info: {data.get('driver_name')} / {data.get('driver')}")
        
        # Generate PDF
        pdf_file = branded_pdf_generator.generate_report('dispatch_note', data)
        
        return send_file(
            pdf_file,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'Dispatch_{data.get("dispatch_number", "Note").replace("/", "_")}.pdf'
        )
    except Exception as e:
        logger.error(f"Error generating dispatch note: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/reports/generate/pdf', methods=['POST'])
def generate_pdf_report():
    """Generate PDF report (aliased to branded for consistency)"""
    try:
        data = request.get_json()
        report_type = data.get('reportType')
        filters = data.get('filters', {})
        
        logger.info(f"Generating PDF report: {report_type} (using branded engine)")
        
        # Fetch data based on report type
        report_data = database_fetcher.fetch_report_data(report_type, filters)
        
        # Generate branded PDF
        pdf_file = branded_pdf_generator.generate_report(report_type, report_data, filters)
        
        return send_file(
            pdf_file,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'FG_{report_type}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf'
        )
    except Exception as e:
        logger.error(f"Error generating PDF report: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/reports/generate/excel', methods=['POST'])
def generate_excel_report():
    """Generate Excel report"""
    try:
        data = request.get_json()
        report_type = data.get('reportType')
        filters = data.get('filters', {})
        use_real_data = data.get('useRealData', True)
        passed_data = data.get('data')  # Data passed directly from frontend
        
        logger.info(f"Generating Excel report: {report_type}")
        
        # Use passed data if available and useRealData is false
        if passed_data and not use_real_data:
            report_data = passed_data
        elif use_real_data:
            report_data = database_fetcher.fetch_report_data(report_type, filters)
        else:
            report_data = data_fetcher.fetch_report_data(report_type, filters)
        
        # Generate Excel
        excel_file = excel_generator.generate_report(report_type, report_data, filters)
        
        return send_file(
            excel_file,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=f'FG_{report_type}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
        )
    except Exception as e:
        logger.error(f"Error generating Excel report: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/reports/types', methods=['GET'])
def get_report_types():
    """Get available report types"""
    report_types = [
        {
            'id': 'financial_summary',
            'name': 'Financial Summary',
            'category': 'finance',
            'description': 'Comprehensive financial overview'
        },
        {
            'id': 'revenue_analysis',
            'name': 'Revenue Analysis',
            'category': 'finance',
            'description': 'Revenue breakdown by source'
        },
        {
            'id': 'payroll_summary',
            'name': 'Payroll Summary',
            'category': 'hr',
            'description': 'Employee payroll summary'
        },
        {
            'id': 'employee_attendance',
            'name': 'Employee Attendance',
            'category': 'hr',
            'description': 'Staff attendance records'
        },
        {
            'id': 'inventory_status',
            'name': 'Inventory Status',
            'category': 'stock',
            'description': 'Current stock levels and value'
        },
        {
            'id': 'financial_variance',
            'name': 'Financial Variance',
            'category': 'audit',
            'description': 'Revenue leakage and deposit variances'
        },
        {
            'id': 'inventory_discrepancy',
            'name': 'Inventory Discrepancy',
            'category': 'audit',
            'description': 'Theoretical vs actual stock analysis'
        },
        {
            'id': 'procurement_analysis',
            'name': 'Procurement Analysis',
            'category': 'audit',
            'description': 'Supplier trends and pricing audits'
        },
        {
            'id': 'exception_logs',
            'name': 'Exception Activity',
            'category': 'audit',
            'description': 'Voids, cancellations, and risk activity'
        },
        {
            'id': 'reconciliation_audit',
            'name': 'Reconciliation Audit',
            'category': 'audit',
            'description': 'Stock vs Sales gap analysis'
        },
        {
            'id': 'sold_items_analytics',
            'name': 'Sold Items Analytics',
            'category': 'audit',
            'description': 'Aggregated item performance'
        },
        {
            'id': 'stock_movement',
            'name': 'Stock Movement',
            'category': 'inventory',
            'description': 'Stock movement history'
        },
        {
            'id': 'booking_summary',
            'name': 'Booking Summary',
            'category': 'bookings',
            'description': 'Room booking overview'
        },
        {
            'id': 'occupancy_rate',
            'name': 'Occupancy Rate',
            'category': 'bookings',
            'description': 'Room occupancy statistics'
        },
        {
            'id': 'housekeeping_performance',
            'name': 'Housekeeping Performance',
            'category': 'operations',
            'description': 'Housekeeping task completion'
        },
        {
            'id': 'maintenance_log',
            'name': 'Maintenance Log',
            'category': 'operations',
            'description': 'Maintenance requests and completions'
        },
        {
            'id': 'bar_sales',
            'name': 'Bar Sales Report',
            'category': 'operations',
            'description': 'Bar revenue and inventory'
        },
        {
            'id': 'restaurant_sales',
            'name': 'Restaurant Sales Report',
            'category': 'operations',
            'description': 'Restaurant revenue and orders'
        },
        {
            'id': 'branch_performance',
            'name': 'Branch Performance',
            'category': 'auditor',
            'description': 'Advanced financial metrics for branch auditing'
        },
        {
            'id': 'stock_usage',
            'name': 'Stock Usage & Variance',
            'category': 'auditor',
            'description': 'Theoretical vs actual inventory usage'
        },
        {
            'id': 'employee_credit',
            'name': 'Employee Credit Aging',
            'category': 'auditor',
            'description': 'Detailed aging analysis of staff credit'
        }
    ]
    
    return jsonify({
        'success': True,
        'data': report_types
    }), 200

@app.route('/api/reports/data', methods=['GET'])
def get_report_data():
    """Get raw report data as JSON (for analytics views)"""
    try:
        report_type = request.args.get('type')
        if not report_type:
            return jsonify({'error': 'Report type is required'}), 400
        
        # Build filters from query parameters
        filters = {}
        for key in request.args:
            if key != 'type':
                filters[key] = request.args.get(key)
        
        logger.info(f"Fetching raw data for report type: {report_type}, filters: {filters}")
        
        # Fetch data using DatabaseFetcher
        data = database_fetcher.fetch_report_data(report_type, filters)
        
        return jsonify({
            'success': True,
            'data': data
        }), 200
    except Exception as e:
        logger.error(f"Error fetching report data: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'message': f'Failed to fetch {report_type} data'
        }), 500

@app.route('/api/reports/auditor/export/<report_type>', methods=['GET'])
def export_auditor_report(report_type):
    """Export auditor reports as branded PDFs"""
    try:
        # Get query parameters
        branch_ids_str = request.args.get('branch_ids')
        branch_id = request.args.get('branch_id')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Determine branch IDs (prioritize multiple if provided)
        branch_ids = []
        if branch_ids_str:
            try:
                branch_ids = [int(bid.strip()) for bid in branch_ids_str.split(',') if bid.strip()]
            except ValueError:
                logger.warning(f"Invalid branch_ids format: {branch_ids_str}")
                
        if not branch_ids and branch_id:
            try:
                branch_ids = [int(branch_id)]
            except ValueError:
                pass
                
        branch_name = request.args.get('branch_name', f'Branch {branch_id}' if branch_id else 'All Branches')
        
        logger.info(f"Exporting auditor report: {report_type} for branches {branch_ids}")
        
        # Build filters
        filters = {
            'branch_id': branch_ids[0] if len(branch_ids) == 1 else None,
            'branch_ids': branch_ids,
            'start_date': start_date,
            'end_date': end_date,
            'branch_name': branch_name
        }
        
        
        # Fetch real data from database using database_fetcher
        try:
            report_data = database_fetcher.fetch_report_data(report_type, filters)
            logger.info(f"Fetched report data: {len(str(report_data))} bytes")
        except Exception as fetch_error:
            logger.warning(f"Error fetching data from database: {str(fetch_error)}, using placeholder")
            # Fallback to placeholder if database fetch fails
            report_data = {
                'report_type': report_type,
                'branch_id': branch_id,
                'branch_name': branch_name,
                'start_date': start_date,
                'end_date': end_date,
                'generated_at': datetime.now().isoformat(),
                'data': [],
                'error': 'No data available'
            }
        
        
        # Generate branded PDF
        pdf_file = branded_pdf_generator.generate_report(report_type, report_data, filters)
        
        return send_file(
            pdf_file,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'FG_Auditor_{report_type}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf'
        )
    except Exception as e:
        logger.error(f"Error exporting auditor report {report_type}: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'message': f'Failed to export {report_type} report'
        }), 500

@app.route('/api/reports/schedule', methods=['POST'])
def schedule_report():
    """Schedule automatic report generation"""
    try:
        data = request.get_json()
        
        schedule_data = {
            'name': data.get('name', f"{data.get('reportType', 'report').replace('_', ' ').title()} Report"),
            'report_type': data.get('reportType'),
            'frequency': data.get('frequency', 'daily'),
            'schedule_time': data.get('scheduleTime', '08:00'),
            'schedule_day': data.get('scheduleDay'),
            'recipients': data.get('recipients', []),
            'parameters': data.get('parameters', {}),
            'is_active': True,
            'next_run_at': report_scheduler._calculate_next_run(
                data.get('frequency', 'daily'),
                data.get('scheduleTime', '08:00')
            )
        }
        
        # Store in database
        if report_scheduler.supabase:
            result = report_scheduler.supabase.table('scheduled_reports').insert(schedule_data).execute()
            schedule_id = result.data[0]['id'] if result.data else None
        else:
            schedule_id = None
        
        logger.info(f"Report scheduled: {schedule_data['name']}, frequency: {schedule_data['frequency']}")
        
        return jsonify({
            'success': True,
            'message': 'Report scheduled successfully',
            'schedule_id': schedule_id,
            'next_run': schedule_data['next_run_at']
        }), 200
    except Exception as e:
        logger.error(f"Error scheduling report: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/reports/schedules', methods=['GET'])
def get_scheduled_reports():
    """Get all scheduled reports"""
    try:
        if report_scheduler.supabase:
            result = report_scheduler.supabase.table('scheduled_reports').select('*').execute()
            schedules = result.data or []
        else:
            schedules = []
        
        return jsonify({
            'success': True,
            'data': schedules
        }), 200
    except Exception as e:
        logger.error(f"Error fetching schedules: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/reports/schedules/<schedule_id>', methods=['DELETE'])
def delete_scheduled_report(schedule_id):
    """Delete a scheduled report"""
    try:
        if report_scheduler.supabase:
            report_scheduler.supabase.table('scheduled_reports').delete().eq('id', schedule_id).execute()
        
        return jsonify({
            'success': True,
            'message': 'Schedule deleted successfully'
        }), 200
    except Exception as e:
        logger.error(f"Error deleting schedule: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/reports/schedules/<schedule_id>/toggle', methods=['PUT'])
def toggle_scheduled_report(schedule_id):
    """Toggle a scheduled report active/inactive"""
    try:
        if report_scheduler.supabase:
            # Get current status
            result = report_scheduler.supabase.table('scheduled_reports').select('is_active').eq('id', schedule_id).single().execute()
            current_status = result.data.get('is_active', True) if result.data else True
            
            # Toggle
            report_scheduler.supabase.table('scheduled_reports').update({
                'is_active': not current_status
            }).eq('id', schedule_id).execute()
        
        return jsonify({
            'success': True,
            'message': 'Schedule toggled successfully'
        }), 200
    except Exception as e:
        logger.error(f"Error toggling schedule: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/reports/run-now', methods=['POST'])
def run_report_now():
    """Run a scheduled report immediately"""
    try:
        data = request.get_json()
        schedule_id = data.get('scheduleId')
        
        if schedule_id:
            report_scheduler.run_scheduled_report(schedule_id)
        
        return jsonify({
            'success': True,
            'message': 'Report generation started'
        }), 200
    except Exception as e:
        logger.error(f"Error running report: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/reports/history', methods=['GET'])
def get_report_history():
    """Get generated report history"""
    try:
        limit = request.args.get('limit', 50, type=int)
        report_type = request.args.get('type')
        
        if report_scheduler.supabase:
            query = report_scheduler.supabase.table('reports').select('*').order('created_at', desc=True).limit(limit)
            if report_type:
                query = query.eq('type', report_type)
            result = query.execute()
            reports = result.data or []
        else:
            reports = []
        
        return jsonify({
            'success': True,
            'data': reports
        }), 200
    except Exception as e:
        logger.error(f"Error fetching report history: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/kpi/dashboard', methods=['GET'])
def get_kpi_dashboard():
    """Get KPI dashboard data with real metrics"""
    try:
        branch_id = request.args.get('branch_id')
        period = request.args.get('period', 'month')  # day, week, month, quarter, year
        
        filters = {'branch_id': int(branch_id) if branch_id else None}
        
        # Fetch real data from database
        revenue_data = database_fetcher.fetch_report_data('daily_sales', filters)
        occupancy_data = database_fetcher.fetch_report_data('occupancy', filters)
        expense_data = database_fetcher.fetch_report_data('expense', filters)
        
        # Calculate KPIs
        total_revenue = revenue_data.get('total_revenue', 0)
        total_expenses = expense_data.get('total_expenses', 0)
        profit = total_revenue - total_expenses
        profit_margin = (profit / total_revenue * 100) if total_revenue > 0 else 0
        
        # Get previous period for comparison (simplified - would need date range logic)
        prev_revenue = total_revenue * 0.92  # Placeholder for demo
        prev_expenses = total_expenses * 0.95
        
        revenue_change = ((total_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0
        expense_change = ((total_expenses - prev_expenses) / prev_expenses * 100) if prev_expenses > 0 else 0
        profit_change = ((profit - (prev_revenue - prev_expenses)) / (prev_revenue - prev_expenses) * 100) if (prev_revenue - prev_expenses) > 0 else 0
        
        kpi_data = {
            'revenue': {
                'current': total_revenue,
                'previous': prev_revenue,
                'change': round(revenue_change, 1),
                'trend': 'up' if revenue_change > 0 else 'down',
                'label': 'Total Revenue',
                'period': 'vs last period'
            },
            'expenses': {
                'current': total_expenses,
                'previous': prev_expenses,
                'change': round(expense_change, 1),
                'trend': 'up' if expense_change > 0 else 'down',
                'label': 'Expenses',
                'period': 'vs last period'
            },
            'profit': {
                'current': profit,
                'previous': prev_revenue - prev_expenses,
                'change': round(profit_change, 1),
                'trend': 'up' if profit_change > 0 else 'down',
                'label': 'Profit',
                'period': 'vs last period'
            },
            'profit_margin': {
                'current': round(profit_margin, 1),
                'previous': round((prev_revenue - prev_expenses) / prev_revenue * 100, 1) if prev_revenue > 0 else 0,
                'label': 'Profit Margin',
                'suffix': '%'
            },
            'occupancy': {
                'rate': occupancy_data.get('occupancy_rate', 0),
                'total_rooms': occupancy_data.get('total_rooms', 0),
                'occupied': occupancy_data.get('occupied_rooms', 0),
                'available': occupancy_data.get('available_rooms', 0),
                'adr': occupancy_data.get('adr', 0),
                'revpar': occupancy_data.get('revpar', 0)
            },
            'transactions': {
                'total': revenue_data.get('total_transactions', 0),
                'average': revenue_data.get('avg_transaction', 0),
                'cash': revenue_data.get('cash_sales', 0),
                'card': revenue_data.get('card_sales', 0),
                'mpesa': revenue_data.get('mpesa_sales', 0)
            },
            'categories': revenue_data.get('categories', []),
            'daily_trend': revenue_data.get('daily_breakdown', []),
            'timestamp': datetime.now().isoformat()
        }
        
        return jsonify({
            'success': True,
            'data': kpi_data
        }), 200
    except Exception as e:
        logger.error(f"Error fetching KPI data: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/kpi/summary', methods=['GET'])
def get_kpi_summary():
    """Get quick KPI summary cards"""
    try:
        branch_id = request.args.get('branch_id')
        filters = {'branch_id': int(branch_id) if branch_id else None}
        
        # Fetch data
        revenue_data = database_fetcher.fetch_report_data('daily_sales', filters)
        occupancy_data = database_fetcher.fetch_report_data('occupancy', filters)
        
        summary = {
            'cards': [
                {
                    'id': 'revenue',
                    'title': 'Total Revenue',
                    'value': revenue_data.get('total_revenue', 0),
                    'format': 'currency',
                    'change': 8.7,
                    'trend': 'up',
                    'subtitle': 'vs last month'
                },
                {
                    'id': 'occupancy',
                    'title': 'Occupancy Rate',
                    'value': occupancy_data.get('occupancy_rate', 0),
                    'format': 'percent',
                    'change': 2.3,
                    'trend': 'up',
                    'subtitle': 'vs last month'
                },
                {
                    'id': 'adr',
                    'title': 'ADR',
                    'value': occupancy_data.get('adr', 0),
                    'format': 'currency',
                    'change': 5.2,
                    'trend': 'up',
                    'subtitle': 'vs last month'
                },
                {
                    'id': 'revpar',
                    'title': 'RevPAR',
                    'value': occupancy_data.get('revpar', 0),
                    'format': 'currency',
                    'change': 7.8,
                    'trend': 'up',
                    'subtitle': 'vs last month'
                },
                {
                    'id': 'transactions',
                    'title': 'Transactions',
                    'value': revenue_data.get('total_transactions', 0),
                    'format': 'number',
                    'change': 12.5,
                    'trend': 'up',
                    'subtitle': 'vs last month'
                },
                {
                    'id': 'avg_transaction',
                    'title': 'Avg Transaction',
                    'value': revenue_data.get('avg_transaction', 0),
                    'format': 'currency',
                    'change': -3.2,
                    'trend': 'down',
                    'subtitle': 'vs last month'
                }
            ]
        }
        
        return jsonify({
            'success': True,
            'data': summary
        }), 200
    except Exception as e:
        logger.error(f"Error fetching KPI summary: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/budget/performance', methods=['GET'])
def analyze_budget_performance():
    """Analyze budget performance"""
    try:
        branch_id = request.args.get('branch_id')
        fiscal_year = request.args.get('fiscal_year')
        
        if not branch_id:
            return jsonify({'error': 'branch_id is required'}), 400
        
        result = budget_analytics.analyze_budget_performance(branch_id, fiscal_year)
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error analyzing budget performance: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/budget/forecast', methods=['GET'])
def forecast_budget():
    """Generate budget forecasts"""
    try:
        branch_id = request.args.get('branch_id')
        category = request.args.get('category')
        periods = request.args.get('periods', type=int, default=3)
        
        if not branch_id:
            return jsonify({'error': 'branch_id is required'}), 400
        
        result = budget_analytics.forecast_budget(branch_id, category, periods)
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error generating budget forecast: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/budget/variance', methods=['GET'])
def budget_variance_report():
    """Generate budget variance report"""
    try:
        branch_id = request.args.get('branch_id')
        fiscal_year = request.args.get('fiscal_year')
        
        if not branch_id:
            return jsonify({'error': 'branch_id is required'}), 400
        
        result = budget_analytics.generate_budget_variance_report(branch_id, fiscal_year)
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error generating budget variance report: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/budget/recommendations', methods=['GET'])
def budget_recommendations():
    """Get budget adjustment recommendations"""
    try:
        branch_id = request.args.get('branch_id')
        fiscal_year = request.args.get('fiscal_year')
        
        if not branch_id:
            return jsonify({'error': 'branch_id is required'}), 400
        
        result = budget_analytics.recommend_budget_adjustments(branch_id, fiscal_year)
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error generating budget recommendations: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==========================================
# FORECASTING ENDPOINTS
# ==========================================
@app.route('/api/forecasting/generate', methods=['POST'])
def generate_forecast():
    """Generate AI-powered forecasts using historical data"""
    try:
        data = request.get_json()
        branch_id = data.get('branch_id')
        forecast_type = data.get('forecast_type', 'revenue')
        metric_name = data.get('metric_name', 'Daily Revenue')
        periods = data.get('periods', 30)
        
        logger.info(f"Generating {forecast_type} forecast for branch {branch_id}, {periods} periods")
        
        # Fetch historical data from database
        if database_fetcher.client:
            # Get historical revenue data
            result = database_fetcher.client.rpc('get_daily_revenue', {
                'p_branch_id': branch_id,
                'p_days': 90
            }).execute()
            
            if result.data:
                historical_data = pd.DataFrame(result.data)
            else:
                # Fallback: fetch from restaurant_orders
                result = database_fetcher.client.table('restaurant_orders').select(
                    'created_at, total_amount'
                ).gte('created_at', (datetime.now() - timedelta(days=90)).isoformat()).execute()
                
                if result.data:
                    df = pd.DataFrame(result.data)
                    df['date'] = pd.to_datetime(df['created_at']).dt.date
                    historical_data = df.groupby('date').agg({
                        'total_amount': 'sum'
                    }).reset_index()
                    historical_data.columns = ['date', 'value']
                else:
                    historical_data = pd.DataFrame()
        else:
            historical_data = pd.DataFrame()
        
        if historical_data.empty or len(historical_data) < 7:
            return jsonify({
                'success': True,
                'data': {
                    'forecasts': [],
                    'message': 'Insufficient historical data for forecasting',
                    'model': 'none'
                }
            }), 200
        
        # Prepare data for forecasting
        historical_data = historical_data.sort_values('date')
        values = historical_data['value'].astype(float).values
        
        forecasts = []
        model_used = 'linear'
        confidence = 75
        
        try:
            # Try ARIMA model first
            from statsmodels.tsa.arima.model import ARIMA
            model = ARIMA(values, order=(1, 1, 1))
            model_fit = model.fit()
            predictions = model_fit.forecast(steps=periods)
            model_used = 'arima'
            confidence = 80
            
            for i, pred in enumerate(predictions):
                forecast_date = datetime.now() + timedelta(days=i+1)
                forecasts.append({
                    'date': forecast_date.strftime('%Y-%m-%d'),
                    'value': max(0, float(pred)),
                    'confidence': confidence,
                    'lower_bound': max(0, float(pred) * 0.85),
                    'upper_bound': float(pred) * 1.15
                })
        except Exception as arima_error:
            logger.warning(f"ARIMA failed, falling back to linear: {arima_error}")
            
            # Fallback to linear regression
            from sklearn.linear_model import LinearRegression
            X = np.arange(len(values)).reshape(-1, 1)
            y = values
            model = LinearRegression()
            model.fit(X, y)
            
            for i in range(periods):
                pred = model.predict([[len(values) + i]])[0]
                forecast_date = datetime.now() + timedelta(days=i+1)
                forecasts.append({
                    'date': forecast_date.strftime('%Y-%m-%d'),
                    'value': max(0, float(pred)),
                    'confidence': 70,
                    'lower_bound': max(0, float(pred) * 0.8),
                    'upper_bound': float(pred) * 1.2
                })
            model_used = 'linear'
        
        return jsonify({
            'success': True,
            'data': {
                'forecasts': forecasts,
                'model': model_used,
                'historical_points': len(values),
                'forecast_periods': periods,
                'metric_name': metric_name,
                'forecast_type': forecast_type
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating forecast: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/forecasting/models', methods=['GET'])
def get_forecast_models():
    """Get available forecasting models"""
    return jsonify({
        'success': True,
        'data': [
            {'id': 'linear', 'name': 'Linear Regression', 'description': 'Simple trend-based forecasting', 'accuracy': 70},
            {'id': 'arima', 'name': 'ARIMA', 'description': 'Time series analysis with seasonality', 'accuracy': 80},
            {'id': 'exponential', 'name': 'Exponential Smoothing', 'description': 'Weighted moving average', 'accuracy': 75},
            {'id': 'seasonal', 'name': 'Seasonal Decomposition', 'description': 'Accounts for weekly/monthly patterns', 'accuracy': 82}
        ]
    }), 200


@app.route('/api/analytics/kpi-analysis', methods=['POST'])
def analyze_kpis():
    """Analyze KPI performance and provide insights"""
    try:
        data = request.get_json()
        branch_id = data.get('branch_id')
        period = data.get('period', 30)
        
        insights = []
        
        if database_fetcher.client:
            # Get revenue data
            result = database_fetcher.client.table('restaurant_orders').select(
                'total_amount, created_at'
            ).gte('created_at', (datetime.now() - timedelta(days=period)).isoformat()).execute()
            
            if result.data:
                df = pd.DataFrame(result.data)
                total_revenue = df['total_amount'].sum()
                avg_order = df['total_amount'].mean()
                order_count = len(df)
                
                # Generate insights
                insights.append({
                    'type': 'revenue',
                    'title': 'Revenue Performance',
                    'value': float(total_revenue),
                    'trend': 'up' if total_revenue > 0 else 'stable',
                    'insight': f'Total revenue of KES {total_revenue:,.0f} from {order_count} orders'
                })
                
                insights.append({
                    'type': 'efficiency',
                    'title': 'Average Order Value',
                    'value': float(avg_order),
                    'trend': 'stable',
                    'insight': f'Average order value is KES {avg_order:,.0f}'
                })
        
        return jsonify({
            'success': True,
            'data': {
                'insights': insights,
                'period_days': period,
                'generated_at': datetime.now().isoformat()
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error analyzing KPIs: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/analytics/trends', methods=['GET'])
def get_analytics_trends():
    """Get analytics trends data for dashboard"""
    try:
        period = request.args.get('period', type=int, default=30)
        branch_id = request.args.get('branch_id')
        
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=period)
        prev_start = start_date - timedelta(days=period)
        
        # Fetch revenue data from multiple sources
        revenue_trend = []
        total_revenue = 0
        total_orders = 0
        prev_revenue = 0
        prev_orders = 0
        
        # Revenue by category
        category_revenue = {
            'Restaurant': 0,
            'Bar': 0,
            'Room Service': 0,
            'Events': 0
        }
        
        try:
            # Get restaurant orders
            query = database_fetcher.client.table('restaurant_orders').select(
                'id, total_amount, created_at, status'
            ).gte('created_at', start_date.isoformat()).lte('created_at', end_date.isoformat())
            
            if branch_id:
                query = query.eq('branch_id', branch_id)
            
            result = query.execute()
            
            if result.data:
                df = pd.DataFrame(result.data)
                df['created_at'] = pd.to_datetime(df['created_at'])
                df['date'] = df['created_at'].dt.date
                
                # Daily aggregation
                daily = df.groupby('date').agg({
                    'total_amount': 'sum',
                    'id': 'count'
                }).reset_index()
                
                for _, row in daily.iterrows():
                    revenue_trend.append({
                        'date': str(row['date']),
                        'revenue': float(row['total_amount']),
                        'orders': int(row['id'])
                    })
                
                total_revenue += df['total_amount'].sum()
                total_orders += len(df)
                category_revenue['Restaurant'] = float(df['total_amount'].sum())
            
            # Get bar orders
            bar_query = database_fetcher.client.table('bar_orders').select(
                'id, total_amount, created_at'
            ).gte('created_at', start_date.isoformat()).lte('created_at', end_date.isoformat())
            
            if branch_id:
                bar_query = bar_query.eq('branch_id', branch_id)
            
            bar_result = bar_query.execute()
            
            if bar_result.data:
                bar_df = pd.DataFrame(bar_result.data)
                total_revenue += bar_df['total_amount'].sum()
                total_orders += len(bar_df)
                category_revenue['Bar'] = float(bar_df['total_amount'].sum())
            
            # Get bookings for room revenue
            booking_query = database_fetcher.client.table('bookings').select(
                'id, total_amount, created_at'
            ).gte('created_at', start_date.isoformat()).lte('created_at', end_date.isoformat())
            
            if branch_id:
                booking_query = booking_query.eq('branch_id', branch_id)
            
            booking_result = booking_query.execute()
            
            if booking_result.data:
                booking_df = pd.DataFrame(booking_result.data)
                total_revenue += booking_df['total_amount'].sum()
                category_revenue['Room Service'] = float(booking_df['total_amount'].sum())
            
            # Get previous period data for comparison
            prev_query = database_fetcher.client.table('restaurant_orders').select(
                'total_amount'
            ).gte('created_at', prev_start.isoformat()).lt('created_at', start_date.isoformat())
            
            if branch_id:
                prev_query = prev_query.eq('branch_id', branch_id)
            
            prev_result = prev_query.execute()
            
            if prev_result.data:
                prev_df = pd.DataFrame(prev_result.data)
                prev_revenue = prev_df['total_amount'].sum()
                prev_orders = len(prev_df)
                
        except Exception as e:
            logger.warning(f"Error fetching trend data: {str(e)}")
        
        # Calculate percentage changes
        revenue_change = ((total_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0
        orders_change = ((total_orders - prev_orders) / prev_orders * 100) if prev_orders > 0 else 0
        avg_order = total_revenue / total_orders if total_orders > 0 else 0
        daily_avg_revenue = total_revenue / period if period > 0 else 0
        daily_avg_orders = total_orders / period if period > 0 else 0
        
        # Sort trend by date
        revenue_trend.sort(key=lambda x: x['date'], reverse=True)
        
        # Calculate category percentages
        total_cat_revenue = sum(category_revenue.values())
        categories = []
        colors = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef']
        for i, (name, value) in enumerate(category_revenue.items()):
            pct = (value / total_cat_revenue * 100) if total_cat_revenue > 0 else 0
            categories.append({
                'name': name,
                'value': round(pct),
                'amount': float(value),
                'color': colors[i % len(colors)]
            })
        
        return jsonify({
            'success': True,
            'data': {
                'summary': {
                    'total_revenue': float(total_revenue),
                    'total_orders': int(total_orders),
                    'avg_order_value': float(avg_order),
                    'daily_avg_revenue': float(daily_avg_revenue),
                    'daily_avg_orders': float(daily_avg_orders),
                    'revenue_change': round(revenue_change, 1),
                    'orders_change': round(orders_change, 1),
                    'trend_direction': 'up' if revenue_change > 0 else 'down'
                },
                'revenue_trend': revenue_trend[:period],
                'categories': categories,
                'period_days': period,
                'generated_at': datetime.now().isoformat()
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching analytics trends: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/analytics/executive', methods=['GET'])
def get_executive_dashboard():
    """Get executive dashboard data"""
    try:
        period = request.args.get('period', type=int, default=30)
        
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=period)
        prev_start = start_date - timedelta(days=period)
        
        # Initialize data
        total_revenue = 0
        total_orders = 0
        prev_revenue = 0
        staff_count = 0
        branches = []
        kpis = []
        
        try:
            # Get branches data
            branch_result = database_fetcher.client.table('branches').select('*').execute()
            
            if branch_result.data:
                for branch in branch_result.data:
                    branch_id = branch.get('id')
                    
                    # Get revenue for this branch
                    branch_revenue_query = database_fetcher.client.table('restaurant_orders').select(
                        'total_amount, id'
                    ).eq('branch_id', branch_id).gte('created_at', start_date.isoformat())
                    
                    branch_revenue_result = branch_revenue_query.execute()
                    
                    branch_revenue = 0
                    branch_orders = 0
                    if branch_revenue_result.data:
                        branch_df = pd.DataFrame(branch_revenue_result.data)
                        branch_revenue = float(branch_df['total_amount'].sum())
                        branch_orders = len(branch_df)
                    
                    branches.append({
                        'branch_id': branch_id,
                        'branch_name': branch.get('name', f'Branch {branch_id}'),
                        'revenue': branch_revenue,
                        'orders': branch_orders
                    })
                    
                    total_revenue += branch_revenue
                    total_orders += branch_orders
            
            # Get staff count
            staff_result = database_fetcher.client.table('staff_profiles').select('id', count='exact').execute()
            staff_count = staff_result.count if hasattr(staff_result, 'count') and staff_result.count else len(staff_result.data) if staff_result.data else 0
            
            # Get previous period revenue
            prev_query = database_fetcher.client.table('restaurant_orders').select(
                'total_amount'
            ).gte('created_at', prev_start.isoformat()).lt('created_at', start_date.isoformat())
            
            prev_result = prev_query.execute()
            if prev_result.data:
                prev_df = pd.DataFrame(prev_result.data)
                prev_revenue = float(prev_df['total_amount'].sum())
            
            # Generate KPIs
            revenue_change = ((total_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0
            avg_order = total_revenue / total_orders if total_orders > 0 else 0
            revenue_per_staff = total_revenue / staff_count if staff_count > 0 else 0
            
            kpis = [
                {
                    'id': 1,
                    'name': 'Monthly Revenue Target',
                    'description': 'Target revenue for the month',
                    'category': 'Financial',
                    'target_value': 5000000,
                    'current_value': int(total_revenue),
                    'unit': 'KES',
                    'frequency': 'Monthly'
                },
                {
                    'id': 2,
                    'name': 'Customer Satisfaction',
                    'description': 'Average customer rating',
                    'category': 'Service',
                    'target_value': 90,
                    'current_value': 87,
                    'unit': '%',
                    'frequency': 'Monthly'
                },
                {
                    'id': 3,
                    'name': 'Order Fulfillment Rate',
                    'description': 'Orders completed on time',
                    'category': 'Operations',
                    'target_value': 95,
                    'current_value': 92,
                    'unit': '%',
                    'frequency': 'Daily'
                },
                {
                    'id': 4,
                    'name': 'Staff Productivity',
                    'description': 'Revenue per staff member',
                    'category': 'HR',
                    'target_value': 200000,
                    'current_value': int(revenue_per_staff),
                    'unit': 'KES',
                    'frequency': 'Monthly'
                },
                {
                    'id': 5,
                    'name': 'Average Order Value',
                    'description': 'Average transaction amount',
                    'category': 'Sales',
                    'target_value': 2500,
                    'current_value': int(avg_order),
                    'unit': 'KES',
                    'frequency': 'Daily'
                },
                {
                    'id': 6,
                    'name': 'Inventory Turnover',
                    'description': 'Stock rotation rate',
                    'category': 'Inventory',
                    'target_value': 12,
                    'current_value': 10,
                    'unit': 'times',
                    'frequency': 'Monthly'
                }
            ]
            
        except Exception as e:
            logger.warning(f"Error fetching executive data: {str(e)}")
        
        return jsonify({
            'success': True,
            'data': {
                'total_revenue': float(total_revenue),
                'total_orders': int(total_orders),
                'staff_count': int(staff_count),
                'branches': branches,
                'kpis': kpis,
                'revenue_change': round(revenue_change, 1) if 'revenue_change' in dir() else 0,
                'period_days': period,
                'generated_at': datetime.now().isoformat()
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching executive dashboard: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/analytics/export', methods=['POST'])
def export_analytics():
    """Export analytics data as PDF or Excel"""
    try:
        data = request.get_json()
        export_type = data.get('type', 'pdf')  # pdf or excel
        report_name = data.get('report_name', 'analytics_report')
        period = data.get('period', 30)
        filters = data.get('filters', {})
        
        # Fetch the analytics data
        end_date = datetime.now()
        start_date = end_date - timedelta(days=period)
        
        # Get trend data
        query = database_fetcher.client.table('restaurant_orders').select(
            'id, total_amount, created_at'
        ).gte('created_at', start_date.isoformat())
        
        result = query.execute()
        
        report_data = {
            'title': f'Analytics Report - Last {period} Days',
            'period': f'{start_date.strftime("%Y-%m-%d")} to {end_date.strftime("%Y-%m-%d")}',
            'total_revenue': 0,
            'total_orders': 0,
            'daily_data': []
        }
        
        if result.data:
            df = pd.DataFrame(result.data)
            df['created_at'] = pd.to_datetime(df['created_at'])
            df['date'] = df['created_at'].dt.date
            
            daily = df.groupby('date').agg({
                'total_amount': 'sum',
                'id': 'count'
            }).reset_index()
            
            report_data['total_revenue'] = float(df['total_amount'].sum())
            report_data['total_orders'] = len(df)
            report_data['daily_data'] = [
                {'date': str(row['date']), 'revenue': float(row['total_amount']), 'orders': int(row['id'])}
                for _, row in daily.iterrows()
            ]
        
        if export_type == 'excel':
            file_path = excel_generator.generate_report('analytics', report_data, filters)
            return send_file(
                file_path,
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                as_attachment=True,
                download_name=f'{report_name}_{datetime.now().strftime("%Y%m%d")}.xlsx'
            )
        else:
            file_path = branded_pdf_generator.generate_report('financial_summary', report_data, filters)
            return send_file(
                file_path,
                mimetype='application/pdf',
                as_attachment=True,
                download_name=f'{report_name}_{datetime.now().strftime("%Y%m%d")}.pdf'
            )
            
    except Exception as e:
        logger.error(f"Error exporting analytics: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    # Prioritize PORT (Render) over PYTHON_SERVICE_PORT
    port = int(os.getenv('PORT', os.getenv('PYTHON_SERVICE_PORT', 8002)))
    
    # Start scheduler daemon in background
    if os.getenv('ENABLE_SCHEDULER', 'true').lower() == 'true':
        scheduler_thread = scheduler_daemon.run_in_background()
        logger.info("Report scheduler daemon started in background")
    
    # Start email automation scheduler
    start_email_scheduler()
    logger.info("Email automation scheduler started")
    
    logger.info(f"Starting Famous Gates Hotels Unified Python Service on port {port}")
    logger.info("Services: Reports, Finance, Accounting, Receipts, Email, Templates, Barcodes, Portals")
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_ENV') == 'development')
