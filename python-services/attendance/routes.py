from flask import Blueprint, request, jsonify
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import pandas as pd
import traceback

attendance_bp = Blueprint('attendance', __name__)

from dotenv import load_dotenv

load_dotenv()

def get_db_connection():
    return psycopg2.connect(
        os.getenv('DATABASE_URL'),
        cursor_factory=RealDictCursor
    )

@attendance_bp.route('/analyze', methods=['GET'])
def analyze_attendance():
    branch_id = request.args.get('branch_id')
    date = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Fetch attendance for the branch and date
        query = """
            SELECT 
                a.*,
                u.first_name,
                u.last_name,
                sp.id_number
            FROM staff_attendance a
            JOIN staff_profiles sp ON a.staff_id = sp.id
            JOIN users u ON sp.user_id = u.id
            WHERE sp.branch_id = %s AND a.attendance_date = %s
        """
        cursor.execute(query, (branch_id, date))
        records = cursor.fetchall()
        
        if not records:
            return jsonify({"success": True, "data": [], "summary": {}}), 200
            
        df = pd.DataFrame(records)
        
        # Group by staff to calculate total hours and status
        staff_stats = []
        total_seconds = 0
        
        for staff_id, group in df.groupby('staff_id'):
            staff_total_seconds = 0
            for _, row in group.iterrows():
                if row['clock_in'] and row['clock_out']:
                    duration = row['clock_out'] - row['clock_in']
                    staff_total_seconds += duration.total_seconds()
            
            total_seconds += staff_total_seconds
            
            # Use the latest status
            latest_record = group.sort_values('clock_in', ascending=False).iloc[0]
            
            hours = staff_total_seconds / 3600
            if pd.isna(hours):
                hours = 0
                
            staff_stats.append({
                "staff_id": staff_id,
                "name": f"{latest_record['first_name']} {latest_record['last_name']}",
                "total_hours": round(hours, 2),
                "status": latest_record['status'],
                "shifts": len(group)
            })

        # Analysis Summary
        total_hours_summary = total_seconds / 3600
        if pd.isna(total_hours_summary):
            total_hours_summary = 0
            
        summary = {
            "total_staff": len(df['staff_id'].unique()),
            "present": len(df[df['status'] == 'present']['staff_id'].unique()),
            "absent": len(df[df['status'] == 'absent']['staff_id'].unique()),
            "late": len(df[df['status'] == 'late']['staff_id'].unique()),
            "total_hours": round(total_hours_summary, 2)
        }
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "success": True,
            "data": records,
            "summary": summary
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@attendance_bp.route('/monitoring', methods=['GET'])
def monitor_attendance():
    branch_id = request.args.get('branch_id')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get late arrivals for the last 7 days
        query = """
            SELECT 
                u.first_name,
                u.last_name,
                a.attendance_date,
                a.clock_in,
                a.status
            FROM staff_attendance a
            JOIN staff_profiles sp ON a.staff_id = sp.id
            JOIN users u ON sp.user_id = u.id
            WHERE sp.branch_id = %s 
            AND a.attendance_date > CURRENT_DATE - INTERVAL '7 days'
            AND (a.status = 'late' OR (a.clock_in::time > '09:00:00'))
            ORDER BY a.attendance_date DESC
        """
        cursor.execute(query, (branch_id,))
        late_records = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "success": True,
            "late_arrivals": late_records
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
