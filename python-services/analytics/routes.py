from flask import Blueprint, request, jsonify, send_file
import os
import psycopg2
from psycopg2.extras import RealDictCursor
import asyncio
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from analytics.services.sales_analytics import SalesAnalytics
from analytics.services.branch_sales_analytics import BranchSalesAnalytics
from analytics.services.demand_forecast import DemandForecast
from analytics.services.menu_optimization import MenuOptimization
from analytics.services.inventory_optimizer import InventoryOptimizer
from analytics.services.customer_segmentation import CustomerSegmentation
from analytics.reports.pdf_generator import PDFReportGenerator
from analytics.reports.csv_exporter import CSVExporter
from analytics.reports.excel_exporter import ExcelExporter

analytics_bp = Blueprint('analytics', __name__)

from supabase import create_client

# Initialize Supabase client
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase = create_client(supabase_url, supabase_key)

# Initialize services (assuming they are moved or accessible)
# For now, we'll assume they are in the same directory structure or updated
sales_analytics = SalesAnalytics(supabase_client=supabase)
branch_sales_analytics = BranchSalesAnalytics()
demand_forecast = DemandForecast(supabase_client=supabase)
menu_optimization = MenuOptimization()
inventory_optimizer = InventoryOptimizer()
customer_segmentation = CustomerSegmentation()
pdf_generator = PDFReportGenerator()
csv_exporter = CSVExporter()
excel_exporter = ExcelExporter()

def get_db_connection():
    return psycopg2.connect(
        os.getenv('DATABASE_URL'),
        cursor_factory=RealDictCursor
    )

@analytics_bp.route('/health', methods=['GET'])
def health_check():
    try:
        conn = get_db_connection()
        conn.close()
        return jsonify({"status": "healthy", "database": "connected"}), 200
    except Exception as e:
        return jsonify({"status": "unhealthy", "error": str(e)}), 503

@analytics_bp.route('/sales/daily', methods=['POST'])
def analyze_daily_sales():
    try:
        data = request.get_json()
        result = sales_analytics.analyze_daily_sales(
            data.get('start_date'),
            data.get('end_date'),
            data.get('branch_id')
        )
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@analytics_bp.route('/branch-sales', methods=['POST'])
def get_branch_sales_analytics():
    try:
        data = request.get_json() or {}
        branch_id = data.get('branch_id')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        filters = data.get('filters')

        if not branch_id or not start_date or not end_date:
            return jsonify({"error": "branch_id, start_date, and end_date are required"}), 400

        branch_id = int(branch_id)
        sales_data = branch_sales_analytics.aggregate_sales_data(
            branch_id=branch_id,
            start_date=start_date,
            end_date=end_date,
            filters=filters
        )
        branch_name = branch_sales_analytics.get_branch_name(branch_id)

        return jsonify({
            "data": sales_data,
            "metadata": {
                "branch_id": branch_id,
                "branch_name": branch_name,
                "date_range": {
                    "start": start_date,
                    "end": end_date
                },
                "generated_at": datetime.now().isoformat(),
                "filters_applied": filters or {}
            }
        }), 200
    except ValueError:
        return jsonify({"error": "branch_id must be a valid number"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@analytics_bp.route('/branch-sales/export/pdf', methods=['POST'])
def export_branch_sales_pdf():
    try:
        data = request.get_json() or {}
        branch_id = data.get('branch_id')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        filters = data.get('filters')

        if not branch_id or not start_date or not end_date:
            return jsonify({"error": "branch_id, start_date, and end_date are required"}), 400

        branch_id = int(branch_id)
        sales_data = branch_sales_analytics.aggregate_sales_data(
            branch_id=branch_id,
            start_date=start_date,
            end_date=end_date,
            filters=filters
        )
        branch_name = branch_sales_analytics.get_branch_name(branch_id)
        file_path = asyncio.run(pdf_generator.generate_branch_sales_report(
            sales_data=sales_data,
            branch_name=branch_name,
            date_range={
                "start": start_date,
                "end": end_date
            }
        ))

        return send_file(
            file_path,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'branch-sales-{branch_id}-{start_date}-{end_date}.pdf'
        )
    except ValueError:
        return jsonify({"error": "branch_id must be a valid number"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@analytics_bp.route('/branch-sales/export/csv', methods=['POST'])
def export_branch_sales_csv():
    try:
        data = request.get_json() or {}
        branch_id = data.get('branch_id')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        filters = data.get('filters')

        if not branch_id or not start_date or not end_date:
            return jsonify({"error": "branch_id, start_date, and end_date are required"}), 400

        branch_id = int(branch_id)
        sales_data = branch_sales_analytics.aggregate_sales_data(
            branch_id=branch_id,
            start_date=start_date,
            end_date=end_date,
            filters=filters
        )
        branch_name = branch_sales_analytics.get_branch_name(branch_id)
        file_path = csv_exporter.export_branch_sales(
            sales_data=sales_data,
            branch_name=branch_name,
            date_range={
                "start": start_date,
                "end": end_date
            }
        )

        return send_file(
            file_path,
            mimetype='text/csv',
            as_attachment=True,
            download_name=f'branch-sales-{branch_id}-{start_date}-{end_date}.csv'
        )
    except ValueError:
        return jsonify({"error": "branch_id must be a valid number"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@analytics_bp.route('/maintenance/predictive-analysis', methods=['GET'])
def predictive_maintenance_analysis():
    asset_id = request.args.get('asset_id')
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = """
            SELECT 
                a.id, a.name, a.category,
                COUNT(wo.id) as failure_count,
                AVG(EXTRACT(DAY FROM (wo.completed_at - wo.created_at))) as avg_repair_time,
                MAX(wo.created_at) as last_failure,
                a.next_maintenance_date
            FROM maintenance_assets a
            LEFT JOIN maintenance_work_orders wo ON wo.location_id::text = a.id::text
            WHERE a.status != 'out_of_service'
        """
        
        if asset_id:
            query += f" AND a.id = '{asset_id}'"
        
        query += " GROUP BY a.id ORDER BY failure_count DESC"
        
        cursor.execute(query)
        results = cursor.fetchall()
        
        predictions = []
        for row in results:
            days_since_last = (datetime.now() - row['last_failure']).days if row['last_failure'] else 9999
            failure_risk = min(100, (row['failure_count'] * 10) + (days_since_last / 10))
            
            predictions.append({
                "asset_id": row['id'],
                "asset_name": row['name'],
                "category": row['category'],
                "failure_count": row['failure_count'],
                "avg_repair_time_days": float(row['avg_repair_time']) if row['avg_repair_time'] else 0,
                "last_failure": row['last_failure'].isoformat() if row['last_failure'] else None,
                "next_maintenance": row['next_maintenance_date'].isoformat() if row['next_maintenance_date'] else None,
                "failure_risk_score": round(failure_risk, 2),
                "recommendation": "Schedule preventive maintenance" if failure_risk > 60 else "Monitor"
            })
        
        cursor.close()
        conn.close()
        return jsonify({"success": True, "predictions": predictions}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@analytics_bp.route('/pos/insights', methods=['GET'])
def get_pos_insights():
    try:
        branch_id = request.args.get('branch_id', type=int)
        days = request.args.get('days', 7, type=int)
        
        velocity = sales_analytics.analyze_pos_velocity(days, branch_id)
        heatmap = sales_analytics.get_hourly_heatmap(days, branch_id)
        mix = sales_analytics.get_payment_method_mix(days, branch_id)
        
        return jsonify({
            "success": True,
            "data": {
                "top_items": velocity[:5],
                "hourly_heatmap": heatmap,
                "payment_mix": mix
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@analytics_bp.route('/pos/forecast', methods=['POST'])
def get_pos_forecast():
    try:
        data = request.get_json()
        branch_id = data.get('branch_id')
        periods = data.get('periods', 7)
        
        result = demand_forecast.forecast_pos_sales(periods, branch_id)
        return jsonify({"success": True, "data": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@analytics_bp.route('/pos/stock-alerts', methods=['GET'])
def get_stock_alerts():
    try:
        branch_id = request.args.get('branch_id', type=int)
        alerts = sales_analytics.get_stock_out_predictions(branch_id)
        return jsonify({"success": True, "data": alerts}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
