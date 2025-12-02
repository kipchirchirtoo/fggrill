from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
from dotenv import load_dotenv
import logging
from datetime import datetime
from reports.pdf_generator import PDFReportGenerator
from reports.excel_generator import ExcelReportGenerator
from reports.data_fetcher import DataFetcher
from reports.branded_pdf_generator import BrandedPDFGenerator
from reports.database_fetcher import DatabaseFetcher
from report_scheduler import ReportScheduler, SchedulerDaemon
from receipts.routes import receipts_bp

load_dotenv()

app = Flask(__name__)
CORS(app, origins=['http://localhost:3000', 'http://localhost:3001', '*'])

# Register blueprints
app.register_blueprint(receipts_bp)

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
        'service': 'Famous Gate Hotel - Report Generation Service',
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
        
        logger.info(f"Generating branded PDF report: {report_type}")
        
        # Fetch data from database
        if use_real_data:
            report_data = database_fetcher.fetch_report_data(report_type, filters)
        else:
            report_data = data_fetcher.fetch_report_data(report_type, filters)
        
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

@app.route('/api/reports/generate/pdf', methods=['POST'])
def generate_pdf_report():
    """Generate PDF report"""
    try:
        data = request.get_json()
        report_type = data.get('reportType')
        filters = data.get('filters', {})
        
        logger.info(f"Generating PDF report: {report_type}")
        
        # Fetch data based on report type
        report_data = data_fetcher.fetch_report_data(report_type, filters)
        
        # Generate PDF
        pdf_file = pdf_generator.generate_report(report_type, report_data, filters)
        
        return send_file(
            pdf_file,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'{report_type}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf'
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
        
        logger.info(f"Generating Excel report: {report_type}")
        
        # Fetch data from database (use real data by default)
        if use_real_data:
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
            'category': 'inventory',
            'description': 'Current inventory levels'
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
        }
    ]
    
    return jsonify({
        'success': True,
        'data': report_types
    }), 200

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


if __name__ == '__main__':
    port = int(os.getenv('PYTHON_SERVICE_PORT', 5001))
    
    # Start scheduler daemon in background
    if os.getenv('ENABLE_SCHEDULER', 'true').lower() == 'true':
        scheduler_thread = scheduler_daemon.run_in_background()
        logger.info("Report scheduler daemon started in background")
    
    logger.info(f"Starting Famous Gate Report Service on port {port}")
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_ENV') == 'development')
