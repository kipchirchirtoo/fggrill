"""
Auditor Report Generation Module
Generates branded PDF reports for auditor verification functions
"""
from flask import Blueprint, request, jsonify, send_file
from reports.branded_pdf_generator import BrandedPDFGenerator
from reports.database_fetcher import DatabaseFetcher
from reports.audit_report_templates import AuditReportTemplates
from datetime import datetime
import io
import logging

logger = logging.getLogger(__name__)

auditor_reports_bp = Blueprint('auditor_reports', __name__, url_prefix='/api/reports/auditor')

branded_pdf = BrandedPDFGenerator()
db_fetcher = DatabaseFetcher()
audit_templates = AuditReportTemplates(branded_pdf)



@auditor_reports_bp.route('/sales-verification', methods=['POST'])
def generate_sales_verification_report():
    """Generate sales verification PDF report"""
    try:
        data = request.get_json()
        branch_id = data.get('branch_id')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        branch_name = data.get('branch_name', f'Branch #{branch_id}')
        
        # Fetch sales data from database
        sales_data = db_fetcher.fetch_sales_verification_data(branch_id, start_date, end_date)
        
        # Generate PDF
        pdf_buffer = branded_pdf.generate_sales_verification_pdf(
            sales_data=sales_data,
            branch_name=branch_name,
            start_date=start_date,
            end_date=end_date
        )
        
        filename = f"sales_verification_{branch_id}_{datetime.now().strftime('%Y%m%d')}.pdf"
        
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        logger.error(f"Error generating sales verification report: {str(e)}")
        return jsonify({'error': str(e)}), 500


@auditor_reports_bp.route('/stock-reconciliation', methods=['POST'])
def generate_stock_reconciliation_report():
    """Generate stock reconciliation PDF report"""
    try:
        data = request.get_json()
        branch_id = data.get('branch_id')
        branch_name = data.get('branch_name', f'Branch #{branch_id}')
        
        # Fetch stock data from database
        stock_data = db_fetcher.fetch_stock_levels_data(branch_id)
        
        # Generate PDF
        pdf_buffer = branded_pdf.generate_stock_reconciliation_pdf(
            stock_data=stock_data,
            branch_name=branch_name
        )
        
        filename = f"stock_reconciliation_{branch_id}_{datetime.now().strftime('%Y%m%d')}.pdf"
        
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        logger.error(f"Error generating stock reconciliation report: {str(e)}")
        return jsonify({'error': str(e)}), 500


@auditor_reports_bp.route('/branch-orders', methods=['POST'])
def generate_branch_orders_report():
    """Generate branch orders verification PDF report"""
    try:
        data = request.get_json()
        branch_id = data.get('branch_id')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        branch_name = data.get('branch_name', f'Branch #{branch_id}' if branch_id else 'All Branches')
        
        # Fetch orders data from database
        orders_data = db_fetcher.fetch_branch_orders_data(branch_id, start_date, end_date)
        
        # Get branch info
        branch_info = {'name': branch_name}
        date_range = {'start_date': start_date, 'end_date': end_date}
        
        # Generate comprehensive report using template
        pdf_buffer = audit_templates.generate_branch_orders_report(
            orders_data=orders_data,
            branch_info=branch_info,
            date_range=date_range
        )
        
        filename = f"branch_orders_audit_{branch_id or 'all'}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        logger.error(f"Error generating branch orders report: {str(e)}")
        return jsonify({'error': str(e)}), 500


@auditor_reports_bp.route('/sold-items-analysis', methods=['POST'])
def generate_sold_items_analysis_report():
    """Generate sold items analysis PDF report"""
    try:
        data = request.get_json()
        branch_id = data.get('branch_id')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        branch_name = data.get('branch_name', f'Branch #{branch_id}')
        
        # Fetch sold items data from database
        sold_items_data = db_fetcher.fetch_sold_items_data(branch_id, start_date, end_date)
        
        # Generate PDF
        pdf_buffer = branded_pdf.generate_sold_items_pdf(
            sold_items_data=sold_items_data,
            branch_name=branch_name,
            start_date=start_date,
            end_date=end_date
        )
        
        filename = f"sold_items_analysis_{branch_id}_{datetime.now().strftime('%Y%m%d')}.pdf"
        
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        logger.error(f"Error generating sold items analysis report: {str(e)}")
        return jsonify({'error': str(e)}), 500


@auditor_reports_bp.route('/financial-verification', methods=['POST'])
def generate_financial_verification_report():
    """Generate financial verification PDF report"""
    try:
        data = request.get_json()
        branch_id = data.get('branch_id')
        date = data.get('date')
        branch_name = data.get('branch_name', f'Branch #{branch_id}')
        
        # Fetch financial data from database
        financial_data = db_fetcher.fetch_financial_verification_data(branch_id, date)
        
        # Generate PDF
        pdf_buffer = branded_pdf.generate_financial_verification_pdf(
            financial_data=financial_data,
            branch_name=branch_name,
            date=date
        )
        
        filename = f"financial_verification_{branch_id}_{datetime.now().strftime('%Y%m%d')}.pdf"
        
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        logger.error(f"Error generating financial verification report: {str(e)}")
        return jsonify({'error': str(e)}), 500


@auditor_reports_bp.route('/revenue-oversight', methods=['POST'])
def generate_revenue_oversight_report():
    """Generate revenue oversight PDF report"""
    try:
        data = request.get_json()
        branch_id = data.get('branch_id')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        branch_name = data.get('branch_name', f'Branch #{branch_id}')
        
        # Fetch revenue data from database
        revenue_data = db_fetcher.fetch_revenue_oversight_data(branch_id, start_date, end_date)
        
        # Generate PDF
        pdf_buffer = branded_pdf.generate_revenue_oversight_pdf(
            revenue_data=revenue_data,
            branch_name=branch_name,
            start_date=start_date,
            end_date=end_date
        )
        
        filename = f"revenue_oversight_{branch_id}_{datetime.now().strftime('%Y%m%d')}.pdf"
        
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        logger.error(f"Error generating revenue oversight report: {str(e)}")
        return jsonify({'error': str(e)}), 500


@auditor_reports_bp.route('/comprehensive-sales-audit', methods=['POST'])
def generate_comprehensive_sales_audit():
    """Generate comprehensive sales audit report with full analysis"""
    try:
        data = request.get_json()
        branch_id = data.get('branch_id')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        
        # Fetch comprehensive sales data
        audit_data = db_fetcher.fetch_sales_verification_data(branch_id, start_date, end_date)
        
        # Get branch info
        branch_info = {'name': data.get('branch_name', f'Branch #{branch_id}')}
        date_range = {'start_date': start_date, 'end_date': end_date}
        
        # Generate comprehensive report
        pdf_buffer = audit_templates.generate_sales_audit_report(
            audit_data=audit_data,
            branch_info=branch_info,
            date_range=date_range
        )
        
        filename = f"comprehensive_sales_audit_{branch_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        logger.error(f"Error generating comprehensive sales audit: {str(e)}")
        return jsonify({'error': str(e)}), 500


@auditor_reports_bp.route('/comprehensive-financial-audit', methods=['POST'])
def generate_comprehensive_financial_audit():
    """Generate comprehensive financial verification audit report"""
    try:
        data = request.get_json()
        branch_id = data.get('branch_id')
        audit_date = data.get('date')
        
        # Fetch comprehensive financial data
        financial_data = db_fetcher.fetch_financial_verification_data(branch_id, audit_date)
        
        # Get branch info
        branch_info = {'name': data.get('branch_name', f'Branch #{branch_id}')}
        
        # Generate comprehensive report
        pdf_buffer = audit_templates.generate_financial_verification_report(
            financial_data=financial_data,
            branch_info=branch_info,
            audit_date=audit_date
        )
        
        filename = f"comprehensive_financial_audit_{branch_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        logger.error(f"Error generating comprehensive financial audit: {str(e)}")
        return jsonify({'error': str(e)}), 500


@auditor_reports_bp.route('/comprehensive-stock-audit', methods=['POST'])
def generate_comprehensive_stock_audit():
    """Generate comprehensive stock reconciliation audit report"""
    try:
        data = request.get_json()
        branch_id = data.get('branch_id')
        
        # Fetch comprehensive stock data
        stock_data = db_fetcher.fetch_stock_levels_data(branch_id)
        
        # Get branch info
        branch_info = {'name': data.get('branch_name', f'Branch #{branch_id}')}
        
        # Generate comprehensive report
        pdf_buffer = audit_templates.generate_stock_audit_report(
            stock_data=stock_data,
            branch_info=branch_info
        )
        
        filename = f"comprehensive_stock_audit_{branch_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        logger.error(f"Error generating comprehensive stock audit: {str(e)}")
        return jsonify({'error': str(e)}), 500

