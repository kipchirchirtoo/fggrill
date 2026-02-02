"""
Auditor Report Generation Module
Generates branded PDF reports for auditor verification functions
"""
from flask import Blueprint, request, jsonify, send_file
from reports.branded_pdf_generator import BrandedPDFGenerator
from reports.database_fetcher import DatabaseFetcher
from datetime import datetime
import io
import logging

logger = logging.getLogger(__name__)

auditor_reports_bp = Blueprint('auditor_reports', __name__, url_prefix='/api/reports/auditor')

branded_pdf = BrandedPDFGenerator()
db_fetcher = DatabaseFetcher()


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
        branch_name = data.get('branch_name', f'Branch #{branch_id}')
        
        # Fetch orders data from database
        orders_data = db_fetcher.fetch_branch_orders_data(branch_id, start_date, end_date)
        
        # Generate PDF
        pdf_buffer = branded_pdf.generate_branch_orders_pdf(
            orders_data=orders_data,
            branch_name=branch_name,
            start_date=start_date,
            end_date=end_date
        )
        
        filename = f"branch_orders_{branch_id}_{datetime.now().strftime('%Y%m%d')}.pdf"
        
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
