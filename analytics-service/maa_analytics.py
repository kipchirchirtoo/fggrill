"""
Maintenance, Auditor & Accounting Analytics Service
Advanced analytics, forecasting, and reporting
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import os
import psycopg2
from psycopg2.extras import RealDictCursor
import pandas as pd
import numpy as np

router = APIRouter()

# Database connection
def get_db_connection():
    return psycopg2.connect(
        os.getenv('DATABASE_URL'),
        cursor_factory=RealDictCursor
    )

# ============ MAINTENANCE ANALYTICS ============

@router.get("/maintenance/predictive-analysis")
async def predictive_maintenance_analysis(asset_id: Optional[str] = None):
    """
    Predict equipment failures using historical data
    """
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
            # Simple failure prediction based on historical patterns
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
        
        return {"success": True, "predictions": predictions}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/maintenance/cost-analysis")
async def maintenance_cost_analysis(
    start_date: str,
    end_date: str,
    group_by: str = "category"
):
    """
    Analyze maintenance costs by category, asset, or time period
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get parts costs
        query = f"""
            SELECT 
                DATE_TRUNC('{group_by}', pt.created_at) as period,
                SUM(pt.total_cost) as parts_cost,
                COUNT(DISTINCT wo.id) as work_order_count
            FROM maintenance_parts_transactions pt
            JOIN maintenance_work_orders wo ON wo.id = pt.work_order_id::uuid
            WHERE pt.created_at BETWEEN %s AND %s
            GROUP BY period
            ORDER BY period
        """
        
        cursor.execute(query, (start_date, end_date))
        results = cursor.fetchall()
        
        analysis = {
            "total_parts_cost": sum(r['parts_cost'] for r in results if r['parts_cost']),
            "total_work_orders": sum(r['work_order_count'] for r in results),
            "breakdown": [
                {
                    "period": r['period'].isoformat() if r['period'] else None,
                    "parts_cost": float(r['parts_cost']) if r['parts_cost'] else 0,
                    "work_orders": r['work_order_count']
                }
                for r in results
            ]
        }
        
        cursor.close()
        conn.close()
        
        return {"success": True, "analysis": analysis}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/maintenance/energy-trends")
async def energy_consumption_trends(
    meter_type: str,
    period: str = "month"
):
    """
    Analyze energy consumption trends and identify anomalies
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = f"""
            SELECT 
                DATE_TRUNC('{period}', reading_date) as period,
                SUM(reading_value) as total_consumption,
                AVG(reading_value) as avg_consumption,
                SUM(cost) as total_cost,
                COUNT(*) as reading_count
            FROM maintenance_meter_readings
            WHERE meter_type = %s
            GROUP BY period
            ORDER BY period DESC
            LIMIT 12
        """
        
        cursor.execute(query, (meter_type,))
        results = cursor.fetchall()
        
        # Calculate trend
        values = [float(r['total_consumption']) for r in results if r['total_consumption']]
        if len(values) > 1:
            trend = "increasing" if values[0] > values[-1] else "decreasing"
            change_pct = ((values[0] - values[-1]) / values[-1]) * 100 if values[-1] > 0 else 0
        else:
            trend = "stable"
            change_pct = 0
        
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "meter_type": meter_type,
            "trend": trend,
            "change_percentage": round(change_pct, 2),
            "data": [
                {
                    "period": r['period'].isoformat() if r['period'] else None,
                    "total_consumption": float(r['total_consumption']) if r['total_consumption'] else 0,
                    "avg_consumption": float(r['avg_consumption']) if r['avg_consumption'] else 0,
                    "total_cost": float(r['total_cost']) if r['total_cost'] else 0,
                    "readings": r['reading_count']
                }
                for r in results
            ]
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============ AUDITOR ANALYTICS ============

@router.get("/auditor/fraud-detection")
async def fraud_detection_analysis():
    """
    Detect potential fraud patterns using Benford's Law and statistical analysis
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Analyze first digit distribution (Benford's Law)
        query = """
            SELECT 
                LEFT(total_amount::text, 1) as first_digit,
                COUNT(*) as count
            FROM finance_transactions
            WHERE total_amount > 0
            GROUP BY first_digit
            ORDER BY first_digit
        """
        
        cursor.execute(query)
        results = cursor.fetchall()
        
        # Expected Benford distribution
        benford_expected = {
            '1': 30.1, '2': 17.6, '3': 12.5, '4': 9.7, '5': 7.9,
            '6': 6.7, '7': 5.8, '8': 5.1, '9': 4.6
        }
        
        total = sum(r['count'] for r in results)
        anomalies = []
        
        for r in results:
            digit = r['first_digit']
            if digit in benford_expected:
                actual_pct = (r['count'] / total) * 100
                expected_pct = benford_expected[digit]
                deviation = abs(actual_pct - expected_pct)
                
                if deviation > 5:  # Significant deviation
                    anomalies.append({
                        "digit": digit,
                        "actual_percentage": round(actual_pct, 2),
                        "expected_percentage": expected_pct,
                        "deviation": round(deviation, 2)
                    })
        
        # Check for duplicate transactions
        cursor.execute("""
            SELECT amount, description, COUNT(*) as duplicates
            FROM finance_transactions
            WHERE created_at > NOW() - INTERVAL '30 days'
            GROUP BY amount, description
            HAVING COUNT(*) > 1
            ORDER BY duplicates DESC
            LIMIT 10
        """)
        
        duplicates = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "benford_analysis": {
                "anomalies_found": len(anomalies),
                "anomalies": anomalies
            },
            "duplicate_transactions": [
                {
                    "amount": float(d['amount']),
                    "description": d['description'],
                    "count": d['duplicates']
                }
                for d in duplicates
            ],
            "risk_level": "high" if len(anomalies) > 3 or len(duplicates) > 5 else "medium" if len(anomalies) > 0 else "low"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/auditor/exception-patterns")
async def exception_pattern_analysis(days: int = 30):
    """
    Identify patterns in audit exceptions
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = """
            SELECT 
                exception_type,
                severity,
                COUNT(*) as occurrence_count,
                AVG(amount) as avg_amount,
                SUM(amount) as total_amount
            FROM audit_exceptions
            WHERE detected_at > NOW() - INTERVAL '%s days'
            GROUP BY exception_type, severity
            ORDER BY occurrence_count DESC
        """
        
        cursor.execute(query, (days,))
        results = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "period_days": days,
            "patterns": [
                {
                    "exception_type": r['exception_type'],
                    "severity": r['severity'],
                    "occurrences": r['occurrence_count'],
                    "avg_amount": float(r['avg_amount']) if r['avg_amount'] else 0,
                    "total_amount": float(r['total_amount']) if r['total_amount'] else 0
                }
                for r in results
            ]
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============ ACCOUNTING ANALYTICS ============

@router.get("/accounting/cash-flow-forecast")
async def cash_flow_forecast(months: int = 3):
    """
    Forecast cash flow based on historical patterns
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get historical data
        cursor.execute("""
            SELECT 
                DATE_TRUNC('month', transaction_date) as month,
                SUM(CASE WHEN debit_amount > 0 THEN debit_amount ELSE 0 END) as outflow,
                SUM(CASE WHEN credit_amount > 0 THEN credit_amount ELSE 0 END) as inflow
            FROM accounting_bank_transactions
            WHERE transaction_date > NOW() - INTERVAL '12 months'
            GROUP BY month
            ORDER BY month
        """)
        
        historical = cursor.fetchall()
        
        if len(historical) == 0:
            return {"success": False, "message": "Insufficient historical data"}
        
        # Simple moving average forecast
        inflows = [float(h['inflow']) if h['inflow'] else 0 for h in historical]
        outflows = [float(h['outflow']) if h['outflow'] else 0 for h in historical]
        
        avg_inflow = np.mean(inflows[-3:]) if len(inflows) >= 3 else np.mean(inflows)
        avg_outflow = np.mean(outflows[-3:]) if len(outflows) >= 3 else np.mean(outflows)
        
        forecast = []
        for i in range(1, months + 1):
            forecast_month = datetime.now() + timedelta(days=30 * i)
            net_flow = avg_inflow - avg_outflow
            
            forecast.append({
                "month": forecast_month.strftime("%Y-%m"),
                "forecast_inflow": round(avg_inflow, 2),
                "forecast_outflow": round(avg_outflow, 2),
                "forecast_net": round(net_flow, 2)
            })
        
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "historical_average_inflow": round(avg_inflow, 2),
            "historical_average_outflow": round(avg_outflow, 2),
            "forecast": forecast
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/accounting/aging-analysis")
async def aging_analysis(analysis_type: str = "receivables"):
    """
    Analyze aging of receivables or payables
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        table = "accounting_ar_invoices" if analysis_type == "receivables" else "accounting_ap_bills"
        
        query = f"""
            SELECT 
                CASE 
                    WHEN CURRENT_DATE - due_date <= 0 THEN 'current'
                    WHEN CURRENT_DATE - due_date BETWEEN 1 AND 30 THEN '1-30 days'
                    WHEN CURRENT_DATE - due_date BETWEEN 31 AND 60 THEN '31-60 days'
                    WHEN CURRENT_DATE - due_date BETWEEN 61 AND 90 THEN '61-90 days'
                    ELSE '90+ days'
                END as aging_bucket,
                COUNT(*) as count,
                SUM(balance) as total_balance
            FROM {table}
            WHERE status = 'pending'
            GROUP BY aging_bucket
            ORDER BY 
                CASE aging_bucket
                    WHEN 'current' THEN 1
                    WHEN '1-30 days' THEN 2
                    WHEN '31-60 days' THEN 3
                    WHEN '61-90 days' THEN 4
                    ELSE 5
                END
        """
        
        cursor.execute(query)
        results = cursor.fetchall()
        
        total_balance = sum(float(r['total_balance']) if r['total_balance'] else 0 for r in results)
        
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "analysis_type": analysis_type,
            "total_outstanding": round(total_balance, 2),
            "aging_breakdown": [
                {
                    "bucket": r['aging_bucket'],
                    "count": r['count'],
                    "balance": float(r['total_balance']) if r['total_balance'] else 0,
                    "percentage": round((float(r['total_balance']) / total_balance * 100) if total_balance > 0 else 0, 2)
                }
                for r in results
            ]
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/accounting/budget-variance")
async def budget_variance_analysis(fiscal_year: int):
    """
    Analyze budget vs actual with variance reporting
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = """
            SELECT 
                b.budget_name,
                b.department,
                b.budget_amount,
                b.actual_amount,
                (b.actual_amount - b.budget_amount) as variance,
                CASE 
                    WHEN b.budget_amount > 0 THEN 
                        ((b.actual_amount - b.budget_amount) / b.budget_amount) * 100
                    ELSE 0
                END as variance_percentage,
                a.account_name,
                a.account_code
            FROM accounting_budgets b
            JOIN accounting_chart_of_accounts a ON a.id = b.account_id
            WHERE b.fiscal_year = %s
            ORDER BY ABS(b.actual_amount - b.budget_amount) DESC
        """
        
        cursor.execute(query, (fiscal_year,))
        results = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "fiscal_year": fiscal_year,
            "variances": [
                {
                    "budget_name": r['budget_name'],
                    "department": r['department'],
                    "account_code": r['account_code'],
                    "account_name": r['account_name'],
                    "budgeted": float(r['budget_amount']),
                    "actual": float(r['actual_amount']) if r['actual_amount'] else 0,
                    "variance": float(r['variance']) if r['variance'] else 0,
                    "variance_percentage": round(float(r['variance_percentage']) if r['variance_percentage'] else 0, 2),
                    "status": "over_budget" if r['variance'] > 0 else "under_budget" if r['variance'] < 0 else "on_budget"
                }
                for r in results
            ]
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
